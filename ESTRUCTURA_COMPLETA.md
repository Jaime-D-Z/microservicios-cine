# 🎬 Sistema de Cines - Arquitectura Completa de Microservicios

## 📁 Estructura del Proyecto

```
cine-microservicios/
├── api-gateway/
│   ├── index.js (✨ MEJORADO)
│   ├── middleware/
│   │   ├── auth.js
│   │   ├── rateLimit.js
│   │   └── circuitBreaker.js
│   ├── package.json
│   ├── .env
│   └── Dockerfile
│
├── ms-users/
│   ├── app.js (✨ MEJORADO)
│   ├── routes/
│   │   └── users.routes.js
│   ├── controllers/
│   │   └── users.controller.js
│   ├── models/
│   │   └── user.model.js
│   ├── package.json
│   ├── .env
│   └── Dockerfile
│
├── ms-movies/
│   ├── main.py (✨ MEJORADO)
│   ├── models/
│   │   └── movie.py
│   ├── routes/
│   │   └── movies.py
│   ├── requirements.txt
│   ├── .env
│   └── Dockerfile
│
├── ms-tickets/
│   ├── main.go (✨ MEJORADO)
│   ├── handlers/
│   │   └── tickets.go
│   ├── models/
│   │   └── ticket.go
│   ├── db/
│   │   └── database.go
│   ├── go.mod
│   ├── go.sum
│   ├── .env
│   └── Dockerfile
│
├── ms-showtimes/ (🆕 NUEVO)
│   ├── main.py
│   ├── models/
│   │   ├── showtime.py
│   │   └── theater.py
│   ├── routes/
│   │   └── showtimes.py
│   ├── requirements.txt
│   ├── .env
│   └── Dockerfile
│
├── ms-payments/ (🆕 NUEVO)
│   ├── server.js
│   ├── routes/
│   │   └── payments.routes.js
│   ├── controllers/
│   │   └── payments.controller.js
│   ├── services/
│   │   └── stripe.service.js
│   ├── package.json
│   ├── .env
│   └── Dockerfile
│
├── ms-notifications/ (🆕 NUEVO)
│   ├── server.js
│   ├── consumers/
│   │   └── ticket.consumer.js
│   ├── services/
│   │   ├── email.service.js
│   │   └── sms.service.js
│   ├── templates/
│   │   ├── ticket-confirmation.html
│   │   └── payment-receipt.html
│   ├── package.json
│   ├── .env
│   └── Dockerfile
│
├── ms-reviews/ (🆕 NUEVO)
│   ├── main.go
│   ├── handlers/
│   │   └── reviews.go
│   ├── models/
│   │   └── review.go
│   ├── go.mod
│   ├── .env
│   └── Dockerfile
│
├── ms-loyalty/ (🆕 NUEVO)
│   ├── main.py
│   ├── models/
│   │   ├── member.py
│   │   └── points.py
│   ├── routes/
│   │   └── loyalty.py
│   ├── requirements.txt
│   ├── .env
│   └── Dockerfile
│
├── ms-analytics/ (🆕 NUEVO)
│   ├── server.js
│   ├── routes/
│   │   └── analytics.routes.js
│   ├── services/
│   │   └── metrics.service.js
│   ├── package.json
│   ├── .env
│   └── Dockerfile
│
├── shared/
│   ├── logger/
│   │   └── winston.config.js
│   └── utils/
│       └── helpers.js
│
├── docker-compose.yml (✨ COMPLETO)
├── .env.example
├── README.md
└── nginx.conf

```

## 🔧 Tecnologías por Microservicio

| Microservicio | Tecnología | Base de Datos | Puerto |
|---------------|------------|---------------|--------|
| API Gateway | Node.js (Express) | - | 8080 |
| ms-users | Node.js | PostgreSQL | 3000 |
| ms-movies | Python (Flask) | MongoDB | 8000 |
| ms-tickets | Go (Golang) | SQLite | 5000 |
| ms-showtimes | Python (FastAPI) | PostgreSQL | 4000 |
| ms-payments | Node.js | PostgreSQL | 6000 |
| ms-notifications | Node.js | - | 7000 |
| ms-reviews | Go (Golang) | MongoDB | 9000 |
| ms-loyalty | Python (Flask) | PostgreSQL | 10000 |
| ms-analytics | Node.js | TimescaleDB | 11000 |

## 🔄 Flujo de Comunicación

```
Usuario → Nginx → API Gateway → Microservicios
                       ↓
              [JWT Validation]
                       ↓
              [Circuit Breaker]
                       ↓
              [Rate Limiting]
                       ↓
         [Service Discovery/Proxy]
                       ↓
           ┌──────────┴──────────┐
           ↓                     ↓
    [Síncronos HTTP]    [Asíncronos RabbitMQ]
```

## 📊 Bases de Datos

- **PostgreSQL** (puerto 5432): users, showtimes, payments, loyalty
- **MongoDB** (puerto 27017): movies, reviews
- **Redis** (puerto 6379): caché, sesiones
- **RabbitMQ** (puerto 5672): mensajería
- **SQLite**: tickets (para Go, fácil deployment)

## 🚀 Características Implementadas

✅ **Seguridad:**
- JWT Authentication
- API Key rotation
- Rate Limiting
- CORS configurado
- Helmet.js

✅ **Resiliencia:**
- Circuit Breaker
- Retry logic
- Timeouts
- Health checks

✅ **Escalabilidad:**
- Service discovery via ENV
- Load balancing con nginx
- Caché con Redis
- Message queue con RabbitMQ

✅ **Monitoreo:**
- Logging centralizado (Winston)
- Health endpoints
- Métricas de negocio

✅ **Calidad:**
- Estructura MVC
- Validación de datos
- Error handling
- Transacciones DB

