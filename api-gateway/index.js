const express = require("express");
const proxy = require("express-http-proxy");
const app = express();
const PORT = 8080;

// Middleware de seguridad simple
const authMiddleware = (req, res, next) => {
  const apiKey = req.headers["x-api-key"];
  if (apiKey === "CINE-SECRET-2026") {
    next(); // Credencial correcta, puede pasar
  } else {
    res.status(401).json({ error: "No autorizado. Falta API KEY válida." });
  }
};

// Aplicamos seguridad a todas las rutas
app.use(authMiddleware);

app.use(
  "/users",
  proxy("http://127.0.0.1:3000", { proxyReqPathResolver: (req) => req.url }),
);
app.use(
  "/movies",
  proxy("http://127.0.0.1:8000", { proxyReqPathResolver: (req) => req.url }),
);
app.use(
  "/tickets",
  proxy("http://127.0.0.1:5000", { proxyReqPathResolver: (req) => req.url }),
);

app.listen(PORT, () => console.log(`[GATEWAY SEGURO] en puerto ${PORT}`));
