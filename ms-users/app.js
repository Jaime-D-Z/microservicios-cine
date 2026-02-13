const express = require("express");
const { Pool } = require("pg"); // Cambiamos sqlite3 por pg
const app = express();
const PORT = 3000;

app.use(express.json());

// Configuración de conexión a Postgres
const pool = new Pool({
  user: "postgres",
  host: "localhost",
  database: "cine_db",
  password: "postgres123",
  port: 5433,
});

// Crear tabla en Postgres (la sintaxis cambia un poco: SERIAL en lugar de AUTOINCREMENT)
pool.query(`
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE,
    subscription TEXT
  )
`);

app.post("/users", async (req, res) => {
  const { name, email, subscription } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO users (name, email, subscription) VALUES ($1, $2, $3) RETURNING *",
      [name, email, subscription],
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/users/:id", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM users WHERE id = $1", [
      req.params.id,
    ]);
    if (result.rows.length === 0)
      return res.status(404).json({ error: "Usuario no encontrado" });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () =>
  console.log(`[ms-users] en puerto ${PORT} con Postgres`),
);
