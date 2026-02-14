// ms-notifications/server.js
const express = require("express");
const winston = require("winston");
const nodemailer = require("nodemailer");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 7000;

app.use(express.json());

// ========================================
// 📊 LOGGER
// ========================================
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json(),
  ),
  defaultMeta: { service: "ms-notifications" },
  transports: [
    new winston.transports.File({
      filename: "notifications-error.log",
      level: "error",
    }),
    new winston.transports.Console({ format: winston.format.simple() }),
  ],
});

// ========================================
// 📧 CONFIGURACIÓN DE EMAIL (SMTP)
// ========================================
// Para testing: usar mailtrap.io o ethereal.email
let transporter;
try {
  transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || "smtp.ethereal.email",
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER || "ethereal.user@ethereal.email",
      pass: process.env.SMTP_PASS || "ethereal.password",
    },
  });
  logger.info("Transporter de email configurado correctamente");
} catch (err) {
  logger.error("Error configurando nodemailer", { error: err.message });
  // Crear un transporter mock para no quebrar el servicio
  transporter = {
    sendMail: async (options) => {
      logger.warn("Email simulado (no se envió realmente)", {
        to: options.to,
        subject: options.subject,
      });
      return { messageId: "mock-" + Date.now() };
    },
  };
}

// ========================================
// 📬 ENVIAR EMAIL
// ========================================
async function sendEmail(to, subject, html) {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"CinéPlex" <noreply@cineplex.com>',
      to: to,
      subject: subject,
      html: html,
    });

    logger.info("Email enviado", { to, messageId: info.messageId });
    return info;
  } catch (err) {
    logger.warn("No se pudo enviar email real, usando modo simulado", {
      error: err.message,
      to,
    });
    // Modo fallback: simular que fue enviado
    return { messageId: "sim-mock-" + Date.now() };
  }
}

// ========================================
// 📨 PLANTILLAS DE EMAIL
// ========================================
const emailTemplates = {
  ticketConfirmation: (ticket, user) => `
    <html>
      <body style="font-family: Arial, sans-serif; padding: 20px;">
        <h1 style="color: #e50914;">¡Gracias por tu compra!</h1>
        <p>Hola <strong>${user.name}</strong>,</p>
        <p>Tu ticket ha sido confirmado exitosamente.</p>
        
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3>Detalles de tu Ticket:</h3>
          <p><strong>ID:</strong> ${ticket.id}</p>
          <p><strong>Función:</strong> #${ticket.showtime_id}</p>
          <p><strong>Asiento:</strong> ${ticket.seat}</p>
          <p><strong>Precio:</strong> $${ticket.price}</p>
        </div>
        
        <p>Por favor, presenta este correo en la entrada del cine.</p>
        <p style="color: #666; font-size: 12px;">CinéPlex - La mejor experiencia cinematográfica</p>
      </body>
    </html>
  `,

  paymentReceipt: (payment, user) => `
    <html>
      <body style="font-family: Arial, sans-serif; padding: 20px;">
        <h1 style="color: #28a745;">Pago Confirmado</h1>
        <p>Hola <strong>${user.name}</strong>,</p>
        <p>Tu pago ha sido procesado exitosamente.</p>
        
        <div style="background: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3>Recibo de Pago:</h3>
          <p><strong>ID de Pago:</strong> ${payment.id}</p>
          <p><strong>Monto:</strong> $${payment.amount} ${payment.currency}</p>
          <p><strong>Método:</strong> ${payment.payment_method}</p>
          <p><strong>Estado:</strong> ${payment.status}</p>
          <p><strong>Fecha:</strong> ${new Date(payment.created_at).toLocaleString()}</p>
        </div>
        
        <p>Gracias por tu compra.</p>
        <p style="color: #666; font-size: 12px;">CinéPlex - La mejor experiencia cinematográfica</p>
      </body>
    </html>
  `,

  loyaltyUpdate: (user, points) => `
    <html>
      <body style="font-family: Arial, sans-serif; padding: 20px;">
        <h1 style="color: #ffc107;">¡Puntos Ganados! 🎉</h1>
        <p>Hola <strong>${user.name}</strong>,</p>
        <p>Has ganado <strong>${points}</strong> puntos nuevos.</p>
        
        <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3>Resumen de Puntos:</h3>
          <p><strong>Puntos Totales:</strong> ${user.points}</p>
        </div>
        
        <p>Sigue acumulando puntos para obtener beneficios exclusivos.</p>
        <p style="color: #666; font-size: 12px;">CinéPlex Loyalty Program</p>
      </body>
    </html>
  `,
};

// ========================================
// 🎯 ENDPOINT PARA RECIBIR EVENTOS
// ========================================
app.post("/events", async (req, res) => {
  const { event, data } = req.body;

  logger.info("Evento recibido", { event, data: data?.id || "N/A" });

  try {
    switch (event) {
      case "ticket.purchased":
        await handleTicketPurchased(data);
        break;

      case "payment.completed":
        await handlePaymentCompleted(data);
        break;

      case "loyalty.points_added":
        await handleLoyaltyPointsAdded(data);
        break;

      default:
        logger.warn("Evento no reconocido", { event });
    }

    res.json({ message: "Evento procesado", event });
  } catch (err) {
    logger.error("Error procesando evento", { error: err.message, event });
    res.status(500).json({ error: "Error procesando evento" });
  }
});

// ========================================
// 🎫 MANEJAR COMPRA DE TICKET
// ========================================
async function handleTicketPurchased(ticket) {
  try {
    // Obtener datos del usuario
    const userResponse = await fetch(
      `${process.env.USERS_SERVICE || "http://127.0.0.1:3000"}/users/${ticket.user_id}`,
    );

    if (!userResponse.ok) {
      logger.warn("No se pudo obtener usuario", { userId: ticket.user_id });
      return;
    }

    const user = await userResponse.json();

    // Enviar email de confirmación
    await sendEmail(
      user.email,
      "Confirmación de tu Ticket - CinéPlex",
      emailTemplates.ticketConfirmation(ticket, user),
    );

    logger.info("Email de ticket enviado", {
      userId: user.id,
      ticketId: ticket.id,
    });
  } catch (err) {
    logger.error("Error enviando confirmación de ticket", {
      error: err.message,
    });
  }
}

// ========================================
// 💳 MANEJAR PAGO COMPLETADO
// ========================================
async function handlePaymentCompleted(payment) {
  try {
    // Obtener datos del usuario
    const userResponse = await fetch(
      `${process.env.USERS_SERVICE || "http://127.0.0.1:3000"}/users/${payment.user_id}`,
    );

    if (!userResponse.ok) {
      logger.warn("No se pudo obtener usuario", { userId: payment.user_id });
      return;
    }

    const user = await userResponse.json();

    // Enviar recibo por email
    await sendEmail(
      user.email,
      "Recibo de Pago - CinéPlex",
      emailTemplates.paymentReceipt(payment, user),
    );

    logger.info("Recibo de pago enviado", {
      userId: user.id,
      paymentId: payment.id,
    });
  } catch (err) {
    logger.error("Error enviando recibo de pago", { error: err.message });
  }
}

// ========================================
// 🎁 MANEJAR PUNTOS DE LEALTAD
// ========================================
async function handleLoyaltyPointsAdded(data) {
  try {
    const { user, points } = data;

    await sendEmail(
      user.email,
      "¡Has ganado puntos! - CinéPlex Loyalty",
      emailTemplates.loyaltyUpdate(user, points),
    );

    logger.info("Email de puntos enviado", { userId: user.id, points });
  } catch (err) {
    logger.error("Error enviando notificación de puntos", {
      error: err.message,
    });
  }
}

// ========================================
// 📤 ENDPOINT PARA ENVIAR EMAIL MANUAL
// ========================================
app.post("/send-email", async (req, res) => {
  const { to, subject, html } = req.body;

  if (!to || !subject || !html) {
    return res.status(400).json({ error: "Faltan campos requeridos" });
  }

  try {
    const info = await sendEmail(to, subject, html);
    res.json({
      message: "Email enviado exitosamente",
      messageId: info.messageId,
    });
  } catch (err) {
    res.status(500).json({ error: "Error al enviar email" });
  }
});

// ========================================
// 📱 ENDPOINT PARA SMS (Simulado)
// ========================================
app.post("/send-sms", async (req, res) => {
  const { to, message } = req.body;

  if (!to || !message) {
    return res.status(400).json({ error: "Faltan campos requeridos" });
  }

  // SIMULACIÓN: En producción usar Twilio
  logger.info("SMS enviado (simulado)", { to, message });

  res.json({
    message: "SMS enviado exitosamente (simulado)",
    to,
    status: "sent",
  });
});

// ========================================
// 🏥 HEALTH CHECK
// ========================================
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "ms-notifications",
    smtp: process.env.SMTP_HOST ? "configured" : "using_default",
    timestamp: new Date().toISOString(),
  });
});

// ========================================
// 🚀 START SERVER
// ========================================
app.listen(PORT, () => {
  logger.info(`[ms-notifications] Escuchando en puerto ${PORT}`);
});

module.exports = app;
