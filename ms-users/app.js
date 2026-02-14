// ms-users/app.js
const express = require("express");
const { Pool } = require("pg");
const bcrypt = require("bcrypt");
const winston = require("winston");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// ========================================
// 📊 LOGGER
// ========================================
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  defaultMeta: { service: "ms-users" },
  transports: [
    new winston.transports.File({ filename: "users-error.log", level: "error" }),
    new winston.transports.Console({ format: winston.format.simple() }),
  ],
});

// ========================================
// 🗄️ CONEXIÓN A POSTGRESQL
// ========================================
const pool = new Pool({
  user: process.env.DB_USER || "postgres",
  host: process.env.DB_HOST || "localhost",
  database: process.env.DB_NAME || "cine_db",
  password: process.env.DB_PASSWORD || "postgres123",
  port: process.env.DB_PORT || 5433,
});

// ========================================
// 📋 CREAR TABLAS
// ========================================
pool.query(`
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    subscription TEXT DEFAULT 'basic',
    points INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )
`).then(() => {
  logger.info("Tabla users verificada/creada");
}).catch((err) => {
  logger.error("Error creando tabla users", { error: err.message });
});

// ========================================
// 🔐 REGISTRO DE USUARIO
// ========================================
app.post("/register", async (req, res) => {
  const { name, email, password, subscription } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ error: "Faltan campos requeridos" });
  }

  try {
    // Hash del password
    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users (name, email, password, subscription) 
       VALUES ($1, $2, $3, $4) RETURNING id, name, email, subscription, points, created_at`,
      [name, email, hashedPassword, subscription || "basic"]
    );

    logger.info("Usuario registrado", { userId: result.rows[0].id, email });
    res.status(201).json({ 
      message: "Usuario creado exitosamente",
      user: result.rows[0] 
    });
  } catch (err) {
    if (err.code === "23505") { // Unique constraint violation
      logger.warn("Intento de registro con email duplicado", { email });
      return res.status(409).json({ error: "El email ya está registrado" });
    }
    logger.error("Error en registro", { error: err.message });
    res.status(500).json({ error: "Error al crear usuario" });
  }
});

// ========================================
// 🔑 LOGIN DE USUARIO
// ========================================
app.post("/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: "Email y contraseña requeridos" });
  }

  try {
    const result = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (result.rows.length === 0) {
      logger.warn("Intento de login con email inexistente", { email });
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const user = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      logger.warn("Intento de login con contraseña incorrecta", { email });
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    // No enviar el password en la respuesta
    delete user.password;

    logger.info("Login exitoso", { userId: user.id, email });
    res.json({ 
      message: "Login exitoso",
      user 
    });
  } catch (err) {
    logger.error("Error en login", { error: err.message });
    res.status(500).json({ error: "Error en autenticación" });
  }
});

// ========================================
// 📖 OBTENER USUARIO POR ID
// ========================================
app.get("/users/:id", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT id, name, email, subscription, points, created_at FROM users WHERE id = $1",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      logger.warn("Usuario no encontrado", { userId: req.params.id });
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    logger.info("Usuario obtenido", { userId: req.params.id });
    res.json(result.rows[0]);
  } catch (err) {
    logger.error("Error obteniendo usuario", { error: err.message });
    res.status(500).json({ error: "Error al obtener usuario" });
  }
});

// ========================================
// 📝 ACTUALIZAR USUARIO
// ========================================
app.put("/users/:id", async (req, res) => {
  const { name, subscription } = req.body;
  const userId = req.params.id;

  try {
    const result = await pool.query(
      `UPDATE users 
       SET name = COALESCE($1, name), 
           subscription = COALESCE($2, subscription),
           updated_at = NOW()
       WHERE id = $3 
       RETURNING id, name, email, subscription, points, updated_at`,
      [name, subscription, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    logger.info("Usuario actualizado", { userId });
    res.json(result.rows[0]);
  } catch (err) {
    logger.error("Error actualizando usuario", { error: err.message });
    res.status(500).json({ error: "Error al actualizar usuario" });
  }
});

// ========================================
// 🎁 AGREGAR PUNTOS (usado por loyalty service)
// ========================================
app.post("/users/:id/points", async (req, res) => {
  const { points } = req.body;
  const userId = req.params.id;

  if (!points || points < 0) {
    return res.status(400).json({ error: "Puntos inválidos" });
  }

  try {
    const result = await pool.query(
      `UPDATE users 
       SET points = points + $1, 
           updated_at = NOW()
       WHERE id = $2 
       RETURNING id, name, email, points`,
      [points, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    logger.info("Puntos agregados", { userId, points });
    res.json(result.rows[0]);
  } catch (err) {
    logger.error("Error agregando puntos", { error: err.message });
    res.status(500).json({ error: "Error al agregar puntos" });
  }
});

// ========================================
// 🏥 HEALTH CHECK
// ========================================
app.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1");
    res.json({
      status: "healthy",
      service: "ms-users",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("Health check falló", { error: err.message });
    res.status(503).json({
      status: "unhealthy",
      service: "ms-users",
      database: "disconnected",
      error: err.message,
    });
  }
});

// ========================================
// 🚀 START SERVER
// ========================================
app.listen(PORT, () => {
  logger.info(`[ms-users] Escuchando en puerto ${PORT}`);
});

module.exports = app;
