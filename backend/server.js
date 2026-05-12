const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const { z } = require('zod');

const app = express();
const port = 3000;

// Permite que o front-end envie dados para este servidor e entenda o formato JSON
app.use(cors());
app.use(express.json());

// Define o caminho do banco: usa a variável de ambiente DB_PATH (para produção) 
// ou cria localmente como './reservas.db' se estiver no seu computador
const dbPath = process.env.DB_PATH || './reservas.db';
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) console.error('Erro ao conectar ao banco:', err.message);
  else console.log(`Conectado ao banco de dados SQLite em ${dbPath} com sucesso!`);
});

// Cria a tabela caso ela não exista
db.run(`CREATE TABLE IF NOT EXISTS reservas (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nome TEXT,
  celular TEXT,
  data TEXT,
  horario TEXT,
  experiencia TEXT,
  sala TEXT,
  valor REAL
)`);

// Schema de validação usando Zod
const reservaSchema = z.object({
  nome: z.string().min(2, 'O nome deve ter pelo menos 2 caracteres.'),
  celular: z.string().regex(/^\d{10,11}$/, 'O celular deve conter 10 ou 11 dígitos numéricos com DDD.'),
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'A data deve estar no formato AAAA-MM-DD.'),
  horario: z.string().min(1, 'O horário é obrigatório.'),
  experiencia: z.string().min(1, 'A experiência é obrigatória.'),
  sala: z.string().optional(),
  valor: z.number().min(0, 'O valor não pode ser negativo.').optional()
});

// Rota (API) que vai receber a reserva do nosso front-end
app.post('/api/reservas', (req, res) => {
  // Limpa a formatação do celular vinda do front-end (ex: "(21) 90000-0000" vira "21900000000")
  if (req.body.celular) {
    req.body.celular = req.body.celular.replace(/\D/g, '');
  }

  // Valida os dados da requisição contra o schema do Zod
  const validacao = reservaSchema.safeParse(req.body);

  if (!validacao.success) {
    // Se falhar, retorna o primeiro erro encontrado para o Front-end
    return res.status(400).json({ error: validacao.error.errors[0].message });
  }

  // Se passou na validação, usamos os dados limpos validados pelo Zod
  const { nome, celular, data, horario, experiencia, sala, valor } = validacao.data;

  const sql = `INSERT INTO reservas (nome, celular, data, horario, experiencia, sala, valor) VALUES (?, ?, ?, ?, ?, ?, ?)`;
  db.run(sql, [nome, celular, data, horario, experiencia, sala, valor], function(err) {
    if (err) return res.status(500).json({ error: err.message });
    res.status(201).json({ id: this.lastID, message: 'Reserva salva no SQLite!' });
  });
});

// Rota (API) para listar todas as reservas salvas no banco de dados
app.get('/api/reservas', (req, res) => {
  const sql = `SELECT * FROM reservas`;
  db.all(sql, [], (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.status(200).json(rows);
  });
});

app.listen(port, () => console.log(`Servidor Back-end rodando em http://localhost:${port}`));