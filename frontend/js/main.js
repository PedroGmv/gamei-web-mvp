/**
 * GAMEI — Lógica da interface e simulação do funil de reservas.
 * Stack: JavaScript vanilla (sem frameworks).
 */

(function () {
  "use strict";

  // ---------------------------------------------------------------------------
  // Seções retráteis no Mobile (Accordion)
  // ---------------------------------------------------------------------------

  function initMobileSections() {
    const sections = $$("main > section:not(#hero)");
    const mq = window.matchMedia("(max-width: 900px)");

    sections.forEach((sec) => {
      const inner = $(".section-inner", sec);
      if (!inner) return;

      const label = $(".section-label", inner);
      const title = $(".section-title", inner);
      if (!title) return;

      // Cria o cabeçalho clicável
      const header = document.createElement("div");
      header.className = "section-header js-section-toggle";
      header.setAttribute("role", "button");
      header.setAttribute("tabindex", "0");
      header.setAttribute("aria-expanded", "false");

      const titlesWrap = document.createElement("div");
      titlesWrap.className = "section-header__titles";
      if (label) titlesWrap.appendChild(label);
      titlesWrap.appendChild(title);
      header.appendChild(titlesWrap);

      const toggleBtn = document.createElement("div");
      toggleBtn.className = "section-toggle-icon";
      toggleBtn.setAttribute("aria-hidden", "true");
      header.appendChild(toggleBtn);

      // Move o resto do conteúdo para dentro de um bloco ocultável
      const content = document.createElement("div");
      content.className = "section-content";

      while (inner.firstChild) {
        content.appendChild(inner.firstChild);
      }

      inner.appendChild(header);
      inner.appendChild(content);

      const toggleSection = () => {
        if (!mq.matches) return;
        const isOpen = sec.classList.contains("is-section-open");
        sec.classList.toggle("is-section-open", !isOpen);
        header.setAttribute("aria-expanded", String(!isOpen));
      };

      header.addEventListener("click", toggleSection);
      header.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleSection();
        }
      });
    });

    function updateView() {
      if (mq.matches) {
        sections.forEach((sec) => {
          // Deixamos a seção de Reservas aberta por padrão
          if (sec.id === "reservas") {
            sec.classList.add("is-section-open");
            $(".js-section-toggle", sec)?.setAttribute("aria-expanded", "true");
          } else {
            sec.classList.remove("is-section-open");
            $(".js-section-toggle", sec)?.setAttribute("aria-expanded", "false");
          }
        });
      } else {
        sections.forEach((sec) => {
          sec.classList.add("is-section-open");
          $(".js-section-toggle", sec)?.removeAttribute("aria-expanded");
        });
      }
    }

    mq.addEventListener("change", updateView);
    updateView();

    // Intercepta links (menu/botões) para garantir que a seção abrirá quando clicada
    document.addEventListener("click", (e) => {
      const link = e.target.closest('a[href^="#"]');
      if (!link) return;
      const targetId = link.getAttribute("href");
      if (targetId.length > 1 && mq.matches) {
        try {
          const targetSec = $(targetId);
          if (targetSec && !targetSec.classList.contains("is-section-open")) {
            targetSec.classList.add("is-section-open");
            $(".js-section-toggle", targetSec)?.setAttribute("aria-expanded", "true");
          }
        } catch (err) {}
      }
    });
  }

  // ---------------------------------------------------------------------------

  const PRICING = {
    /** Cápsula Temática: valor fixo por experiência, cardápio rápido. */
    tematica: {
      id: "tematica",
      label: "Cápsula Temática Predefinida",
      base: 229.90,
      duration: "1h30 a 2h30",
      currency: "BRL",
      blurb:
        "Prato assinatura incluso. Ambiente temático fixo e permanência de 1h30 a 2h30. Taxa adicional para trocar de prato ou alterar clima/luz.",
      climaExtra: 19.9,
    },
    /** Cápsula Prime: premium, controle total e menu completo. */
    prime: {
      id: "prime",
      label: "Cápsula Personalizável",
      base: 180,
      duration: "2h a 3h",
      currency: "BRL",
      blurb:
        "Permanência de 2h a 3h, controle total de clima, acesso integral ao menu (incluindo exclusivos) e atendimento prioritário.",
      climaExtra: 0,
    },
  };

  const TIME_BLOCKS = [
    { value: "18h", label: "18h — Entrada cedo" },
    { value: "19h30", label: "19h30 — Jantar" },
    { value: "21h", label: "21h — Jantar tardio" },
    { value: "22h30", label: "22h30 — Noite" },
    { value: "23h30", label: "23h30 — Madrugada" },
    { value: "00h30", label: "00h30 — Madrugada" },
    { value: "01h30", label: "01h30 — Madrugada" },
    { value: "02h30", label: "02h30 — Coruja (última)" },
  ];

  /** Chave do rascunho da reserva em sessionStorage (mesma aba / sessão). */
  const STORAGE_KEY_RESERVA = "gamei_reserva_v1";

  // ---------------------------------------------------------------------------
  // Estado do wizard (apenas em memória)
  // ---------------------------------------------------------------------------

  const state = {
    step: 1,
    name: "",
    phone: "",
    date: "",
    timeBlock: "",
    tier: null,
    room: "",
    climaAddon: false,
  };

  // ---------------------------------------------------------------------------
  // Helpers de DOM
  // ---------------------------------------------------------------------------

  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function formatMoney(value) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  }

  /** Define data mínima no input date (hoje, horário local). */
  function setMinDate(input) {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    input.min = `${y}-${m}-${day}`;
  }

  function formatDateBR(iso) {
    if (!iso) return "—";
    const [y, m, d] = iso.split("-");
    if (!y || !m || !d) return iso;
    return `${d}/${m}/${y}`;
  }

  function syncStateFromForm() {
    state.name = $("#reserva-nome")?.value || "";
    state.phone = $("#reserva-celular")?.value || "";
    state.date = $("#reserva-data")?.value || "";
    state.timeBlock = $("#reserva-horario")?.value || "";
    state.tier = getTierFromInputs();
    state.room = $("#reserva-sala")?.value || "";
    state.climaAddon = Boolean($("#addon-clima")?.checked);
  }

  function saveReservaDraft() {
    try {
      syncStateFromForm();
      const tierInput = $('input[name="tier"]:checked');
      const payload = {
        v: 1,
        step: state.step,
        name: state.name,
        phone: state.phone,
        date: state.date,
        timeBlock: state.timeBlock,
        tierId: tierInput ? tierInput.value : null,
        roomId: state.room,
        climaAddon: state.climaAddon,
      };
      sessionStorage.setItem(STORAGE_KEY_RESERVA, JSON.stringify(payload));
    } catch (e) {
      /* quota ou modo anônimo restrito */
    }
  }

  function clearReservaDraft() {
    try {
      sessionStorage.removeItem(STORAGE_KEY_RESERVA);
    } catch (e) {
      /* ignore */
    }
  }

  function isDateNotPast(iso) {
    if (!iso) return false;
    const [y, m, d] = iso.split("-");
    const chosen = new Date(Number(y), Number(m) - 1, Number(d));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return chosen >= today;
  }

  /** canonical, og:image e twitter:image com URL absoluta (ignora file://). */
  function initCanonicalAndSocial() {
    const canonical = $("#canonical-link");
    if (canonical && window.location.protocol !== "file:") {
      canonical.setAttribute("href", window.location.href.split("#")[0]);
    }
    if (window.location.protocol === "file:") return;

    let imgUrl = "";
    try {
      imgUrl = new URL("img/sala-personalizavel.png", new URL(".", window.location.href).href).href;
    } catch (e) {
      return;
    }

    const pageUrl = window.location.href.split("#")[0];
    const ogImage = document.querySelector('meta[property="og:image"]');
    const ogUrl = document.querySelector('meta[property="og:url"]');
    const twImage = document.querySelector('meta[name="twitter:image"]');
    if (ogUrl) ogUrl.setAttribute("content", pageUrl);
    if (ogImage) ogImage.setAttribute("content", imgUrl);
    if (twImage) twImage.setAttribute("content", imgUrl);
  }

  // ---------------------------------------------------------------------------
  // Cabeçalho ao rolar
  // ---------------------------------------------------------------------------

  function initHeaderScroll() {
    const header = $(".site-header");
    if (!header) return;

    const onScroll = () => {
      header.classList.toggle("is-scrolled", window.scrollY > 40);
    };

    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
  }

  /** Menu lateral em telas estreitas: abre/fecha, bloqueia scroll e fecha ao navegar. */
  function initMobileNav() {
    const header = $("#site-header");
    const toggle = $("#nav-toggle");
    const backdrop = $("#nav-backdrop");
    const nav = $("#main-navigation");
    if (!header || !toggle || !backdrop || !nav) return;

    const mq = window.matchMedia("(max-width: 900px)");
    const navLinks = $$(".nav-main a", nav);

    function setNavOpen(open) {
      header.classList.toggle("is-nav-open", open);
      document.body.classList.toggle("is-nav-open", open);
      toggle.setAttribute("aria-expanded", open);
      toggle.setAttribute(
        "aria-label",
        open ? "Fechar menu de navegação" : "Abrir menu de navegação"
      );
      backdrop.setAttribute("aria-hidden", open ? "false" : "true");
    }

    toggle.addEventListener("click", () => {
      setNavOpen(!header.classList.contains("is-nav-open"));
    });

    backdrop.addEventListener("click", () => setNavOpen(false));

    navLinks.forEach((link) => {
      link.addEventListener("click", () => setNavOpen(false));
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setNavOpen(false);
    });

    window.addEventListener(
      "resize",
      () => {
        if (!mq.matches) setNavOpen(false);
      },
      { passive: true }
    );
  }

  // ---------------------------------------------------------------------------
  // Wizard de reservas
  // ---------------------------------------------------------------------------

  function getTierFromInputs() {
    const checked = $('input[name="tier"]:checked');
    if (!checked) return null;
    return PRICING[checked.value] || null;
  }

  function updateAddonVisibility() {
    const tier = getTierFromInputs();
    const row = $("#addon-clima-row");
    const cb = $("#addon-clima");
    const roomGroup = $("#room-selection-group");
    const roomSelect = $("#reserva-sala");
    if (!row || !cb) return;

    if (tier && tier.id === "tematica") {
      row.classList.remove("is-hidden");
      if (roomGroup) roomGroup.classList.remove("is-hidden");
      if (roomSelect && roomSelect.options[0].disabled) {
        roomSelect.options[0].textContent = "Selecione a sala desejada...";
      }
    } else {
      row.classList.add("is-hidden");
      cb.checked = false;
      state.climaAddon = false;
      if (roomGroup) roomGroup.classList.add("is-hidden");
      if (roomSelect) roomSelect.value = "";
      state.room = "";
    }
  }

  function calculateTotal() {
    const tier = state.tier;
    if (!tier) return 0;
    let total = tier.base;
    if (tier.id === "tematica" && state.climaAddon) {
      total += tier.climaExtra;
    }
    return total;
  }

  function renderSummary() {
    const tier = state.tier;
    const list = $("#summary-lines");
    if (!list) return;

    list.innerHTML = "";

    const addLine = (label, value) => {
      const li = document.createElement("li");
      const spanLabel = document.createElement("span");
      spanLabel.textContent = label;
      const spanValue = document.createElement("span");
      spanValue.textContent = value;
      li.appendChild(spanLabel);
      li.appendChild(spanValue);
      list.appendChild(li);
    };

    addLine("Nome", state.name || "—");
    addLine("Celular", state.phone || "—");
    addLine("Data", formatDateBR(state.date));
    addLine("Horário", state.timeBlock || "—");

    if (tier) {
      addLine("Experiência", tier.label);
      if (tier.id === "tematica" && state.room) {
        addLine("Sala Escolhida", state.room);
      }
      addLine("Tempo previsto", tier.duration);
      addLine("Valor base", formatMoney(tier.base));
      if (tier.id === "tematica" && state.climaAddon) {
        addLine("Personalização de clima / luz / som", formatMoney(tier.climaExtra));
      } else if (tier.id === "prime") {
        addLine("Personalização", "Inclusa");
      }
    }

    const totalEl = $("#summary-total-value");
    if (totalEl) {
      totalEl.textContent = formatMoney(calculateTotal());
    }
  }

  function goToStep(n) {
    state.step = n;
    $$(".wizard-step").forEach((el) => {
      el.classList.toggle("is-visible", Number(el.dataset.step) === n);
    });

    $$(".wizard-step-dot").forEach((dot) => {
      const num = Number(dot.dataset.step);
      dot.classList.remove("is-active", "is-done");
      if (num === n) dot.classList.add("is-active");
      else if (num < n) dot.classList.add("is-done");
    });

    const backBtn = $("#wizard-back");
    if (backBtn) {
      backBtn.classList.toggle("is-hidden", n === 1);
    }

    const nextBtn = $("#wizard-next");
    if (nextBtn) {
      nextBtn.textContent = n === 3 ? "Concluir simulação" : "Continuar";
    }

    saveReservaDraft();
  }

  function validateStep1() {
    const nameInput = $("#reserva-nome");
    const phoneInput = $("#reserva-celular");
    const dateInput = $("#reserva-data");
    const timeSelect = $("#reserva-horario");
    const msg = $("#wizard-message");

    state.name = nameInput?.value.trim() || "";
    state.phone = phoneInput?.value.trim() || "";
    state.date = dateInput?.value || "";
    state.timeBlock = timeSelect?.value || "";

    if (!state.name || !state.phone || !state.date || !state.timeBlock) {
      if (msg) {
        msg.className = "wizard-message is-error";
        msg.textContent = "Preencha todos os campos (nome, celular, data e horário) para continuar.";
      }
      return false;
    }

    const [y, m, d] = state.date.split("-");
    const chosen = new Date(Number(y), Number(m) - 1, Number(d));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (chosen < today) {
      if (msg) {
        msg.className = "wizard-message is-error";
        msg.textContent = "A data não pode ser no passado.";
      }
      return false;
    }

    if (msg) {
      msg.className = "wizard-message";
      msg.textContent = "";
    }
    return true;
  }

  function validateStep2() {
    const tier = getTierFromInputs();
    const msg = $("#wizard-message");
    state.tier = tier;
    state.room = $("#reserva-sala")?.value || "";
    state.climaAddon = Boolean($("#addon-clima")?.checked);

    if (!tier) {
      if (msg) {
        msg.className = "wizard-message is-error";
        msg.textContent = "Escolha um dos tiers de experiência.";
      }
      return false;
    }

    if (tier.id === "tematica" && !state.room) {
      if (msg) {
        msg.className = "wizard-message is-error";
        msg.textContent = "Selecione uma das salas temáticas disponíveis para o seu horário.";
      }
      return false;
    }

    if (msg) {
      msg.className = "wizard-message";
      msg.textContent = "";
    }
    return true;
  }

  async function finishWizard() {
    const msg = $("#wizard-message");
    
    // Prepara os dados do estado (state) para enviar
    const payload = {
      nome: state.name,
      celular: state.phone,
      data: state.date,
      horario: state.timeBlock,
      experiencia: state.tier ? state.tier.label : "",
      sala: state.room || "N/A",
      valor: calculateTotal()
    };

    // URL do seu Backend. 
    // Alterna automaticamente entre ambiente local e produção baseado no hostname
    const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.protocol === "file:";
    const API_URL = isLocalhost 
      ? "http://localhost:3000/api/reservas" 
      : "https://SEU-LINK-DO-RENDER-AQUI.onrender.com/api/reservas"; // Link gerado pelo Render

    try {
      if (msg) {
        msg.className = "wizard-message";
        msg.textContent = "Processando reserva...";
        msg.style.display = "block";
      }

      // Faz a requisição POST para o nosso servidor Node.js
      const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) throw new Error("Falha ao salvar no banco.");

      if (msg) {
        msg.className = "wizard-message is-success";
        msg.innerHTML = "<strong>Reserva confirmada!</strong> Seus dados foram salvos no banco de dados com sucesso. Obrigado por experimentar o GAMEI.";
        msg.scrollIntoView({ behavior: "smooth", block: "nearest" });
        
        // Limpa a mensagem de sucesso após 7 segundos
        setTimeout(() => {
          msg.className = "wizard-message";
          msg.textContent = "";
        }, 7000);
      }
    } catch (error) {
      if (msg) {
        msg.className = "wizard-message is-error";
        msg.textContent = "Erro ao conectar com o servidor. Tente novamente mais tarde.";
      }
      return; // Interrompe a função para não limpar o formulário se deu erro
    }

    goToStep(1);
    state.name = "";
    state.phone = "";
    state.date = "";
    state.timeBlock = "";
    state.tier = null;
    state.room = "";
    state.climaAddon = false;
    const form = $("#form-reserva");
    if (form) form.reset();
    updateAddonVisibility();
    setMinDate($("#reserva-data"));
    clearReservaDraft();
    const hint = $("#reserva-draft-hint");
    if (hint) hint.classList.add("is-hidden");
  }

  function tryRestoreReservaDraft() {
    let draft = null;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY_RESERVA);
      if (raw) draft = JSON.parse(raw);
    } catch (e) {
      return;
    }
    if (!draft || draft.v !== 1) return;

    const nameInput = $("#reserva-nome");
    const phoneInput = $("#reserva-celular");
    const dateInput = $("#reserva-data");
    const timeSelect = $("#reserva-horario");
    const roomSelect = $("#reserva-sala");
    const hint = $("#reserva-draft-hint");
    if (!dateInput || !timeSelect) return;

    let restored = false;

    if (draft.name && nameInput) {
      nameInput.value = draft.name;
      restored = true;
    }

    if (draft.phone && phoneInput) {
      phoneInput.value = draft.phone;
      restored = true;
    }

    if (draft.date && isDateNotPast(draft.date)) {
      dateInput.value = draft.date;
      restored = true;
    }

    if (draft.timeBlock && TIME_BLOCKS.some((b) => b.value === draft.timeBlock)) {
      timeSelect.value = draft.timeBlock;
      restored = true;
    }

    if (draft.tierId && PRICING[draft.tierId]) {
      const radio = $(`input[name="tier"][value="${draft.tierId}"]`);
      if (radio) {
        radio.checked = true;
        restored = true;
      }
    }

    if (draft.roomId && draft.tierId === "tematica" && roomSelect) {
      roomSelect.value = draft.roomId;
      restored = true;
    }

    const cb = $("#addon-clima");
    if (cb && draft.tierId === "tematica" && draft.climaAddon) {
      cb.checked = true;
      restored = true;
    } else if (cb && draft.tierId !== "tematica") {
      cb.checked = false;
    }

    updateAddonVisibility();
    syncStateFromForm();

    let step = Math.min(Math.max(1, Number(draft.step) || 1), 3);

    if (!state.name || !state.phone || !state.date || !state.timeBlock) {
      step = 1;
    } else if (step >= 3 && !getTierFromInputs()) {
      step = 2;
    }

    goToStep(step);
    syncStateFromForm();

    if (step === 3 && state.tier) {
      renderSummary();
    }

    if (restored && hint) hint.classList.remove("is-hidden");
  }

  function initWizard() {
    const dateInput = $("#reserva-data");
    const timeSelect = $("#reserva-horario");
    const nextBtn = $("#wizard-next");
    const backBtn = $("#wizard-back");

    if (dateInput) setMinDate(dateInput);

    if (timeSelect && timeSelect.options.length === 0) {
      TIME_BLOCKS.forEach((b) => {
        const opt = document.createElement("option");
        opt.value = b.value;
        opt.textContent = b.label;
        timeSelect.appendChild(opt);
      });
    }

    $$('input[name="tier"]').forEach((radio) => {
      radio.addEventListener("change", () => {
        updateAddonVisibility();
        saveReservaDraft();
      });
    });

    $("#addon-clima")?.addEventListener("change", (e) => {
      state.climaAddon = e.target.checked;
      saveReservaDraft();
    });

const weekdaysBR = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const todayWeekday = weekdaysBR[new Date().getDay()];
    $('#today-weekday').textContent = todayWeekday;
    
    $("#reserva-nome")?.addEventListener("input", saveReservaDraft);
    $("#reserva-celular")?.addEventListener("input", saveReservaDraft);
    $("#reserva-sala")?.addEventListener("change", saveReservaDraft);
    dateInput?.addEventListener("change", () => {
      if ($("#reserva-sala")) $("#reserva-sala").value = "";
      saveReservaDraft();
    });
    timeSelect?.addEventListener("change", () => {
      if ($("#reserva-sala")) $("#reserva-sala").value = "";
      saveReservaDraft();
    });

    $("#form-reserva")?.addEventListener("submit", (e) => e.preventDefault());

    nextBtn?.addEventListener("click", () => {
      const msg = $("#wizard-message");
      if (msg && msg.classList.contains("is-success")) {
        msg.className = "wizard-message";
        msg.textContent = "";
      }

      if (state.step === 1) {
        if (!validateStep1()) return;
        goToStep(2);
        updateAddonVisibility();
        return;
      }

      if (state.step === 2) {
        if (!validateStep2()) return;
        renderSummary();
        goToStep(3);
        return;
      }

      if (state.step === 3) {
        finishWizard();
      }
    });

    backBtn?.addEventListener("click", () => {
      if (state.step <= 1) return;
      goToStep(state.step - 1);
      const msg = $("#wizard-message");
      if (msg) {
        msg.className = "wizard-message";
        msg.textContent = "";
      }
    });

    goToStep(1);
    tryRestoreReservaDraft();
  }

  // ---------------------------------------------------------------------------
  // Botão Flutuante de Reservas (Mobile)
  // ---------------------------------------------------------------------------

  function initFloatingCTA() {
    const cta = $("#mobile-cta");
    const reservasSec = $("#reservas");
    if (!cta || !reservasSec) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          // Esconde o botão se a seção de reservas já estiver na tela
          cta.classList.toggle("is-hidden", entry.isIntersecting);
        });
      },
      { threshold: 0.1 }
    );

    observer.observe(reservasSec);
  }

  // ---------------------------------------------------------------------------
  // Boot
  // ---------------------------------------------------------------------------

  document.addEventListener("DOMContentLoaded", () => {
    initCanonicalAndSocial();
    initHeaderScroll();
    initMobileNav();
    initMobileSections();
    initFloatingCTA();
    initWizard();
  });
})();
