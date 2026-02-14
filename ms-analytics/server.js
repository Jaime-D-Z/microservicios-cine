// ms-analytics/server.js
const express = require("express");
const { Pool } = require("pg");
const winston = require("winston");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 11000;

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
  defaultMeta: { service: "ms-analytics" },
  transports: [
    new winston.transports.File({ filename: "analytics-error.log", level: "error" }),
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
// 📋 CREAR TABLA DE EVENTOS
// ========================================
pool.query(`
  CREATE TABLE IF NOT EXISTS analytics_events (
    id SERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    user_id INTEGER,
    movie_id INTEGER,
    showtime_id INTEGER,
    ticket_id INTEGER,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
  )
`).then(() => {
  logger.info("Tabla analytics_events verificada/creada");
}).catch((err) => {
  logger.error("Error creando tabla analytics_events", { error: err.message });
});

// Crear índices para mejor performance
pool.query(`
  CREATE INDEX IF NOT EXISTS idx_events_type ON analytics_events(event_type);
  CREATE INDEX IF NOT EXISTS idx_events_created_at ON analytics_events(created_at);
  CREATE INDEX IF NOT EXISTS idx_events_movie ON analytics_events(movie_id);
`).catch((err) => {
  logger.warn("Error creando índices", { error: err.message });
});

// ========================================
// 📝 REGISTRAR EVENTO
// ========================================
app.post("/events", async (req, res) => {
  const { event_type, user_id, movie_id, showtime_id, ticket_id, metadata } = req.body;

  if (!event_type) {
    return res.status(400).json({ error: "event_type es requerido" });
  }

  try {
    const result = await pool.query(
      `INSERT INTO analytics_events (event_type, user_id, movie_id, showtime_id, ticket_id, metadata) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [event_type, user_id, movie_id, showtime_id, ticket_id, JSON.stringify(metadata || {})]
    );

    logger.info("Evento registrado", { eventType: event_type, eventId: result.rows[0].id });
    res.status(201).json(result.rows[0]);
  } catch (err) {
    logger.error("Error registrando evento", { error: err.message });
    res.status(500).json({ error: "Error al registrar evento" });
  }
});

// ========================================
// 📊 DASHBOARD GENERAL
// ========================================
app.get("/dashboard", async (req, res) => {
  try {
    // Total de tickets vendidos
    const ticketsResult = await pool.query(
      "SELECT COUNT(*) as total FROM analytics_events WHERE event_type = 'ticket_purchased'"
    );

    // Ingresos totales (estimado)
    const revenueResult = await pool.query(`
      SELECT SUM((metadata->>'price')::numeric) as total_revenue 
      FROM analytics_events 
      WHERE event_type = 'ticket_purchased' AND metadata ? 'price'
    `);

    // Películas más populares
    const popularMoviesResult = await pool.query(`
      SELECT movie_id, COUNT(*) as tickets_sold 
      FROM analytics_events 
      WHERE event_type = 'ticket_purchased' AND movie_id IS NOT NULL
      GROUP BY movie_id 
      ORDER BY tickets_sold DESC 
      LIMIT 5
    `);

    // Usuarios activos (últimos 7 días)
    const activeUsersResult = await pool.query(`
      SELECT COUNT(DISTINCT user_id) as active_users 
      FROM analytics_events 
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `);

    logger.info("Dashboard generado");

    res.json({
      tickets_sold: parseInt(ticketsResult.rows[0].total),
      total_revenue: parseFloat(revenueResult.rows[0].total_revenue || 0),
      popular_movies: popularMoviesResult.rows,
      active_users: parseInt(activeUsersResult.rows[0].active_users),
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("Error generando dashboard", { error: err.message });
    res.status(500).json({ error: "Error al generar dashboard" });
  }
});

// ========================================
// 🎬 MÉTRICAS POR PELÍCULA
// ========================================
app.get("/movies/:movie_id/metrics", async (req, res) => {
  const movieId = req.params.movie_id;

  try {
    // Tickets vendidos
    const ticketsResult = await pool.query(
      `SELECT COUNT(*) as tickets_sold 
       FROM analytics_events 
       WHERE event_type = 'ticket_purchased' AND movie_id = $1`,
      [movieId]
    );

    // Ingresos
    const revenueResult = await pool.query(`
      SELECT SUM((metadata->>'price')::numeric) as revenue 
      FROM analytics_events 
      WHERE event_type = 'ticket_purchased' AND movie_id = $1 AND metadata ? 'price'`,
      [movieId]
    );

    // Visualizaciones de página
    const viewsResult = await pool.query(
      `SELECT COUNT(*) as views 
       FROM analytics_events 
       WHERE event_type = 'movie_viewed' AND movie_id = $1`,
      [movieId]
    );

    // Tasa de conversión
    const tickets = parseInt(ticketsResult.rows[0].tickets_sold);
    const views = parseInt(viewsResult.rows[0].views);
    const conversionRate = views > 0 ? ((tickets / views) * 100).toFixed(2) : 0;

    logger.info("Métricas de película obtenidas", { movieId });

    res.json({
      movie_id: parseInt(movieId),
      tickets_sold: tickets,
      revenue: parseFloat(revenueResult.rows[0].revenue || 0),
      views: views,
      conversion_rate: parseFloat(conversionRate),
    });
  } catch (err) {
    logger.error("Error obteniendo métricas de película", { error: err.message });
    res.status(500).json({ error: "Error al obtener métricas" });
  }
});

// ========================================
// 📅 VENTAS POR PERIODO
// ========================================
app.get("/sales", async (req, res) => {
  const { start_date, end_date, interval } = req.query;

  // interval puede ser: hour, day, week, month
  const groupBy = interval || "day";

  try {
    const result = await pool.query(`
      SELECT 
        DATE_TRUNC($1, created_at) as period,
        COUNT(*) as tickets_sold,
        SUM((metadata->>'price')::numeric) as revenue
      FROM analytics_events 
      WHERE event_type = 'ticket_purchased'
        ${start_date ? "AND created_at >= $2" : ""}
        ${end_date ? "AND created_at <= $3" : ""}
      GROUP BY period 
      ORDER BY period DESC
    `, [groupBy, start_date, end_date].filter(Boolean));

    logger.info("Reporte de ventas generado", { interval: groupBy });

    res.json({
      interval: groupBy,
      data: result.rows.map(row => ({
        period: row.period,
        tickets_sold: parseInt(row.tickets_sold),
        revenue: parseFloat(row.revenue || 0),
      })),
    });
  } catch (err) {
    logger.error("Error generando reporte de ventas", { error: err.message });
    res.status(500).json({ error: "Error al generar reporte" });
  }
});

// ========================================
// 👥 COMPORTAMIENTO DE USUARIOS
// ========================================
app.get("/users/:user_id/behavior", async (req, res) => {
  const userId = req.params.user_id;

  try {
    // Historial de eventos
    const eventsResult = await pool.query(
      `SELECT event_type, COUNT(*) as count 
       FROM analytics_events 
       WHERE user_id = $1 
       GROUP BY event_type`,
      [userId]
    );

    // Películas vistas
    const moviesResult = await pool.query(
      `SELECT movie_id, COUNT(*) as interactions 
       FROM analytics_events 
       WHERE user_id = $1 AND movie_id IS NOT NULL 
       GROUP BY movie_id 
       ORDER BY interactions DESC 
       LIMIT 10`,
      [userId]
    );

    // Gasto total
    const spendingResult = await pool.query(`
      SELECT SUM((metadata->>'price')::numeric) as total_spent 
      FROM analytics_events 
      WHERE user_id = $1 AND event_type = 'ticket_purchased' AND metadata ? 'price'`,
      [userId]
    );

    logger.info("Comportamiento de usuario obtenido", { userId });

    res.json({
      user_id: parseInt(userId),
      events: eventsResult.rows,
      favorite_movies: moviesResult.rows,
      total_spent: parseFloat(spendingResult.rows[0].total_spent || 0),
    });
  } catch (err) {
    logger.error("Error obteniendo comportamiento de usuario", { error: err.message });
    res.status(500).json({ error: "Error al obtener comportamiento" });
  }
});

// ========================================
// 💺 OCUPACIÓN DE SALAS
// ========================================
app.get("/occupancy", async (req, res) => {
  const { showtime_id } = req.query;

  try {
    let query = `
      SELECT 
        showtime_id,
        COUNT(*) as tickets_sold,
        metadata->>'theater_capacity' as capacity
      FROM analytics_events 
      WHERE event_type = 'ticket_purchased'
    `;

    const params = [];
    if (showtime_id) {
      query += " AND showtime_id = $1";
      params.push(showtime_id);
    }

    query += " GROUP BY showtime_id, capacity ORDER BY tickets_sold DESC LIMIT 20";

    const result = await pool.query(query, params);

    const data = result.rows.map(row => ({
      showtime_id: row.showtime_id,
      tickets_sold: parseInt(row.tickets_sold),
      capacity: row.capacity ? parseInt(row.capacity) : null,
      occupancy_rate: row.capacity 
        ? ((parseInt(row.tickets_sold) / parseInt(row.capacity)) * 100).toFixed(2)
        : null,
    }));

    logger.info("Datos de ocupación obtenidos");
    res.json(data);
  } catch (err) {
    logger.error("Error obteniendo ocupación", { error: err.message });
    res.status(500).json({ error: "Error al obtener ocupación" });
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
      service: "ms-analytics",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    logger.error("Health check falló", { error: err.message });
    res.status(503).json({
      status: "unhealthy",
      service: "ms-analytics",
      database: "disconnected",
      error: err.message,
    });
  }
});

// ========================================
// 🚀 START SERVER
// ========================================
app.listen(PORT, () => {
  logger.info(`[ms-analytics] Escuchando en puerto ${PORT}`);
});

module.exports = app;
