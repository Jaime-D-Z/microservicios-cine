// ms-payments/server.js
const express = require("express");
const { Pool } = require("pg");
const winston = require("winston");
require("dotenv").config();

// NO usar Stripe real sin credenciales, solo simular
// const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

const app = express();
const PORT = process.env.PORT || 6000;

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
  defaultMeta: { service: "ms-payments" },
  transports: [
    new winston.transports.File({ filename: "payments-error.log", level: "error" }),
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
// 📋 CREAR TABLA
// ========================================
pool.query(`
  CREATE TABLE IF NOT EXISTS payments (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    ticket_id INTEGER NOT NULL,
    amount REAL NOT NULL,
    currency TEXT DEFAULT 'USD',
    payment_method TEXT DEFAULT 'card',
    status TEXT DEFAULT 'pending',
    stripe_payment_id TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )
`).then(() => {
  logger.info("Tabla payments verificada/creada");
}).catch((err) => {
  logger.error("Error creando tabla payments", { error: err.message });
});

// ========================================
// 💳 PROCESAR PAGO
// ========================================
app.post("/payments", async (req, res) => {
  const { user_id, ticket_id, amount, payment_method } = req.body;

  if (!user_id || !ticket_id || !amount) {
    return res.status(400).json({ error: "Faltan campos requeridos" });
  }

  try {
    // SIMULACIÓN: En producción aquí iría la integración con Stripe
    /*
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Stripe usa centavos
      currency: "usd",
      payment_method: payment_method,
      confirm: true,
    });
    */

    // Simulamos un pago exitoso
    const stripe_payment_id = `sim_${Date.now()}`;
    const status = Math.random() > 0.1 ? "completed" : "failed"; // 90% éxito

    const result = await pool.query(
      `INSERT INTO payments (user_id, ticket_id, amount, payment_method, status, stripe_payment_id) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [user_id, ticket_id, amount, payment_method || "card", status, stripe_payment_id]
    );

    const payment = result.rows[0];

    if (status === "completed") {
      logger.info("Pago procesado exitosamente", { 
        paymentId: payment.id, 
        userId: user_id,
        amount 
      });

      // Enviar confirmación a notificaciones
      try {
        await fetch(`${process.env.NOTIFICATIONS_SERVICE || "http://127.0.0.1:7000"}/events`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "payment.completed",
            data: payment,
          }),
        });
      } catch (err) {
        logger.warn("No se pudo notificar el pago", { error: err.message });
      }

      res.status(201).json({
        message: "Pago procesado exitosamente",
        payment,
      });
    } else {
      logger.warn("Pago falló", { paymentId: payment.id, userId: user_id });
      res.status(402).json({
        message: "El pago no pudo ser procesado",
        payment,
      });
    }
  } catch (err) {
    logger.error("Error procesando pago", { error: err.message });
    res.status(500).json({ error: "Error al procesar el pago" });
  }
});

// ========================================
// 📖 OBTENER PAGOS DE UN USUARIO
// ========================================
app.get("/payments/user/:user_id", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM payments WHERE user_id = $1 ORDER BY created_at DESC",
      [req.params.user_id]
    );

    logger.info("Pagos obtenidos", { userId: req.params.user_id, count: result.rows.length });
    res.json(result.rows);
  } catch (err) {
    logger.error("Error obteniendo pagos", { error: err.message });
    res.status(500).json({ error: "Error al obtener pagos" });
  }
});

// ========================================
// 📊 OBTENER PAGO POR ID
// ========================================
app.get("/payments/:id", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM payments WHERE id = $1",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Pago no encontrado" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    logger.error("Error obteniendo pago", { error: err.message });
    res.status(500).json({ error: "Error al obtener pago" });
  }
});

// ========================================
// 🔄 REEMBOLSO (Cancelar pago)
// ========================================
app.post("/payments/:id/refund", async (req, res) => {
  try {
    const paymentId = req.params.id;

    // Verificar que el pago existe y está completado
    const checkResult = await pool.query(
      "SELECT * FROM payments WHERE id = $1",
      [paymentId]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: "Pago no encontrado" });
    }

    const payment = checkResult.rows[0];

    if (payment.status !== "completed") {
      return res.status(400).json({ error: "Solo se pueden reembolsar pagos completados" });
    }

    // SIMULACIÓN: En producción llamar a Stripe
    // await stripe.refunds.create({ payment_intent: payment.stripe_payment_id });

    const result = await pool.query(
      `UPDATE payments 
       SET status = 'refunded', updated_at = NOW() 
       WHERE id = $1 
       RETURNING *`,
      [paymentId]
    );

    logger.info("Reembolso procesado", { paymentId });
    res.json({
      message: "Reembolso procesado exitosamente",
      payment: result.rows[0],
    });
  } catch (err) {
    logger.error("Error procesando reembolso", { error: err.message });
    res.status(500).json({ error: "Error al procesar reembolso" });
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
      service: "ms-payments",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("Health check falló", { error: err.message });
    res.status(503).json({
      status: "unhealthy",
      service: "ms-payments",
      database: "disconnected",
      error: err.message,
    });
  }
});

// ========================================
// 🚀 START SERVER
// ========================================
app.listen(PORT, () => {
  logger.info(`[ms-payments] Escuchando en puerto ${PORT}`);
});

module.exports = app;
