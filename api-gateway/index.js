// api-gateway/index.js
const express = require("express");
const proxy = require("express-http-proxy");
const CircuitBreaker = require("opossum");
const rateLimit = require("express-rate-limit");
const helmet = require("helmet");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const winston = require("winston");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 8080;

// ========================================
// 📊 LOGGER CENTRALIZADO
// ========================================
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  defaultMeta: { service: "api-gateway" },
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
    new winston.transports.Console({
      format: winston.format.simple(),
    }),
  ],
});

// ========================================
// 🔒 MIDDLEWARE DE SEGURIDAD
// ========================================
app.use(helmet());
app.use(
  cors({
    origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
    credentials: true,
  }),
);
app.use(express.json());

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // límite de 100 requests por IP
  message: "Demasiadas peticiones desde esta IP, intenta más tarde",
});
app.use(limiter);

// ========================================
// 🔑 AUTENTICACIÓN JWT
// ========================================
const authMiddleware = (req, res, next) => {
  // Rutas públicas que no requieren autenticación
  const publicRoutes = ["/auth/login", "/auth/register", "/movies", "/health"];
  if (publicRoutes.some((route) => req.path.startsWith(route))) {
    return next();
  }

  const token = req.headers.authorization?.split(" ")[1];

  if (!token) {
    logger.warn("Request sin token", { ip: req.ip, path: req.path });
    return res.status(401).json({ error: "Token requerido" });
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_SECRET || "SECRET_KEY_2026",
    );
    req.user = decoded;
    logger.info("Usuario autenticado", { userId: decoded.id, path: req.path });
    next();
  } catch (err) {
    logger.error("Token inválido", { error: err.message });
    res.status(401).json({ error: "Token inválido o expirado" });
  }
};

app.use(authMiddleware);

// ========================================
// ⚡ CIRCUIT BREAKER CONFIGURATION // ========================================
const breakerOptions = {
  timeout: 5000, // 5 segundos
  errorThresholdPercentage: 50,
  resetTimeout: 30000, // 30 segundos
};

const createProxyWithBreaker = (serviceUrl, serviceName, pathPrefix) => {
  return proxy(serviceUrl, {
    proxyReqPathResolver: (req) => {
      // Use originalUrl which contains the full path
      let fullPath = req.originalUrl || req.url;

      // Remove query string if present
      const [pathOnly] = fullPath.split("?");

      let newPath = pathOnly;

      // Only remove prefix if there's something after it
      if (pathOnly.startsWith(pathPrefix + "/")) {
        // There's content after the prefix, remove it
        newPath = pathOnly.substring(pathPrefix.length);
      } else if (pathOnly === pathPrefix) {
        // Exact match: keep the path as is
        newPath = pathPrefix;
      } else if (pathOnly.startsWith(pathPrefix)) {
        // Partial match at start
        newPath = pathOnly.substring(pathPrefix.length);
        if (newPath === "") {
          newPath = "/";
        }
      }

      logger.info(`[${serviceName}] Request:`, {
        originalUrl: req.originalUrl,
        path: pathOnly,
        pathPrefix: pathPrefix,
        newPath: newPath,
      });

      return newPath;
    },
    proxyErrorHandler: (err, res, next) => {
      logger.error(`Error en ${serviceName}`, { error: err.message });
      res.status(503).json({
        error: `El servicio ${serviceName} no está disponible`,
        service: serviceName,
      });
    },
  });
};

// ========================================
// 🌐 SERVICE DISCOVERY (via ENV)
// ========================================
const SERVICES = {
  users: process.env.USERS_SERVICE || "http://127.0.0.1:3000",
  movies: process.env.MOVIES_SERVICE || "http://127.0.0.1:8000",
  tickets: process.env.TICKETS_SERVICE || "http://127.0.0.1:5000",
  showtimes: process.env.SHOWTIMES_SERVICE || "http://127.0.0.1:4000",
  payments: process.env.PAYMENTS_SERVICE || "http://127.0.0.1:6000",
  notifications: process.env.NOTIFICATIONS_SERVICE || "http://127.0.0.1:7000",
  reviews: process.env.REVIEWS_SERVICE || "http://127.0.0.1:9000",
  loyalty: process.env.LOYALTY_SERVICE || "http://127.0.0.1:10000",
  analytics: process.env.ANALYTICS_SERVICE || "http://127.0.0.1:11000",
};

// ========================================
// 🔀 RUTAS CON CIRCUIT BREAKER
// ========================================
app.use("/users", createProxyWithBreaker(SERVICES.users, "ms-users", "/users"));
app.use(
  "/movies",
  createProxyWithBreaker(SERVICES.movies, "ms-movies", "/movies"),
);
app.use(
  "/tickets",
  createProxyWithBreaker(SERVICES.tickets, "ms-tickets", "/tickets"),
);
app.use(
  "/showtimes",
  createProxyWithBreaker(SERVICES.showtimes, "ms-showtimes", "/showtimes"),
);
app.use(
  "/payments",
  createProxyWithBreaker(SERVICES.payments, "ms-payments", "/payments"),
);
app.use(
  "/notifications",
  createProxyWithBreaker(
    SERVICES.notifications,
    "ms-notifications",
    "/notifications",
  ),
);
app.use(
  "/reviews",
  createProxyWithBreaker(SERVICES.reviews, "ms-reviews", "/reviews"),
);
app.use(
  "/loyalty",
  createProxyWithBreaker(SERVICES.loyalty, "ms-loyalty", "/loyalty"),
);
app.use(
  "/analytics",
  createProxyWithBreaker(SERVICES.analytics, "ms-analytics", "/analytics"),
);
// ========================================
// 🏥 HEALTH CHECK
// ========================================
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "api-gateway",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// ========================================
// 🔐 AUTH ENDPOINTS (Login/Register)
// ========================================
app.post("/auth/login", async (req, res) => {
  // Proxy a ms-users para login
  try {
    const response = await fetch(`${SERVICES.users}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();

    if (response.ok) {
      // Generar JWT
      const token = jwt.sign(
        { id: data.user.id, email: data.user.email },
        process.env.JWT_SECRET || "SECRET_KEY_2026",
        { expiresIn: "24h" },
      );
      logger.info("Login exitoso", { userId: data.user.id });
      res.json({ ...data, token });
    } else {
      res.status(response.status).json(data);
    }
  } catch (err) {
    logger.error("Error en login", { error: err.message });
    res.status(500).json({ error: "Error en autenticación" });
  }
});

app.post("/auth/register", async (req, res) => {
  try {
    const response = await fetch(`${SERVICES.users}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req.body),
    });
    const data = await response.json();
    res.status(response.status).json(data);
  } catch (err) {
    logger.error("Error en registro", { error: err.message });
    res.status(500).json({ error: "Error en registro" });
  }
});

// ========================================
// 🚫 ERROR HANDLING
// ========================================
app.use((err, req, res, next) => {
  logger.error("Error no manejado", { error: err.message, stack: err.stack });
  res.status(500).json({
    error: "Error interno del servidor",
    message: process.env.NODE_ENV === "development" ? err.message : undefined,
  });
});

// ========================================
// 🚀 START SERVER
// ========================================
app.listen(PORT, () => {
  logger.info(`[API GATEWAY] Escuchando en puerto ${PORT}`);
  logger.info("Servicios configurados:", SERVICES);
});
