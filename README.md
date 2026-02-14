# 🎬 Sistema de Cines - Arquitectura de Microservicios

Sistema completo de gestión de cines con arquitectura de microservicios, implementado con Node.js, Python (Flask/FastAPI), y Go.

## 📋 Tabla de Contenidos

- [Características](#características)
- [Arquitectura](#arquitectura)
- [Tecnologías](#tecnologías)
- [Instalación](#instalación)
- [Uso](#uso)
- [API Endpoints](#api-endpoints)
- [Flujos de Trabajo](#flujos-de-trabajo)

## ✨ Características

### Servicios Principales

✅ **API Gateway** - Gateway central con autenticación JWT, circuit breaker y rate limiting  
✅ **ms-users** - Gestión de usuarios con autenticación bcrypt  
✅ **ms-movies** - Catálogo de películas (MongoDB + Redis cache)  
✅ **ms-tickets** - Compra de tickets con prevención de doble reserva  
✅ **ms-showtimes** - Gestión de funciones, horarios y salas  
✅ **ms-payments** - Procesamiento de pagos (Stripe simulado)  
✅ **ms-notifications** - Emails y notificaciones (SMTP)  
✅ **ms-reviews** - Sistema de reseñas y ratings (MongoDB)  
✅ **ms-loyalty** - Programa de puntos y membresías  
✅ **ms-analytics** - Métricas de negocio y dashboards  

### Características Técnicas

- 🔐 Autenticación JWT con refresh tokens
- ⚡ Circuit Breaker para resiliencia
- 🚦 Rate Limiting para protección
- 📊 Logging centralizado con Winston
- 🗄️ Múltiples bases de datos (PostgreSQL, MongoDB, SQLite, Redis)
- 🐰 Message Queue con RabbitMQ
- 🏥 Health checks en todos los servicios
- 🐳 Docker Compose para deployment
- 🔄 Load Balancing con Nginx

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────┐
│            Nginx (Port 80)              │
└────────────────┬────────────────────────┘
                 │
┌────────────────▼────────────────────────┐
│      API Gateway (Port 8080)            │
│    JWT Auth + Circuit Breaker           │
└─────┬──────┬──────┬──────┬──────┬───────┘
      │      │      │      │      │
      ▼      ▼      ▼      ▼      ▼
┌─────────┬─────────┬─────────┬─────────┬─────────┐
│ Users   │ Movies  │Showtimes│ Tickets │Payments │
│ :3000   │ :8000   │ :4000   │ :5000   │ :6000   │
└─────────┴─────────┴─────────┴─────────┴─────────┘
      │      │      │      │      │
      ▼      ▼      ▼      ▼      ▼
┌─────────┬─────────┬─────────┬─────────┬─────────┐
│Notifs   │ Reviews │ Loyalty │Analytics│         │
│ :7000   │ :9000   │ :10000  │ :11000  │         │
└─────────┴─────────┴─────────┴─────────┴─────────┘
      │
      ▼
┌─────────────────────────────────────────┐
│        RabbitMQ (Port 5672)             │
└─────────────────────────────────────────┘
```

## 🛠️ Tecnologías

| Microservicio | Lenguaje | Framework | Base de Datos | Puerto |
|---------------|----------|-----------|---------------|--------|
| API Gateway | Node.js | Express | - | 8080 |
| ms-users | Node.js | Express | PostgreSQL | 3000 |
| ms-movies | Python | Flask | MongoDB + Redis | 8000 |
| ms-tickets | Go | Stdlib | SQLite | 5000 |
| ms-showtimes | Python | FastAPI | PostgreSQL | 4000 |
| ms-payments | Node.js | Express | PostgreSQL | 6000 |
| ms-notifications | Node.js | Express | - | 7000 |
| ms-reviews | Go | Stdlib | MongoDB | 9000 |
| ms-loyalty | Python | Flask | PostgreSQL | 10000 |
| ms-analytics | Node.js | Express | PostgreSQL | 11000 |

## 📦 Instalación

### Prerrequisitos

- Docker y Docker Compose
- Node.js 18+ (para desarrollo local)
- Python 3.11+ (para desarrollo local)
- Go 1.21+ (para desarrollo local)

### Instalación con Docker (Recomendado)

```bash
# 1. Clonar el repositorio
git clone https://github.com/tu-usuario/cine-microservicios.git
cd cine-microservicios

# 2. Copiar archivo de variables de entorno
cp .env.example .env

# 3. Editar .env con tus configuraciones
nano .env

# 4. Levantar todos los servicios
docker-compose up -d

# 5. Ver logs
docker-compose logs -f

# 6. Verificar que todos los servicios estén corriendo
docker-compose ps
```

### Instalación Local (Desarrollo)

#### 1. Bases de Datos

```bash
# PostgreSQL
docker run -d \
  --name postgres \
  -e POSTGRES_PASSWORD=postgres123 \
  -e POSTGRES_DB=cine_db \
  -p 5433:5432 \
  postgres:15

# MongoDB
docker run -d \
  --name mongodb \
  -e MONGO_INITDB_ROOT_USERNAME=admin \
  -e MONGO_INITDB_ROOT_PASSWORD=admin123 \
  -p 27017:27017 \
  mongo:7

# Redis
docker run -d \
  --name redis \
  -p 6379:6379 \
  redis:7-alpine

# RabbitMQ
docker run -d \
  --name rabbitmq \
  -e RABBITMQ_DEFAULT_USER=admin \
  -e RABBITMQ_DEFAULT_PASS=admin123 \
  -p 5672:5672 \
  -p 15672:15672 \
  rabbitmq:3-management
```

#### 2. Microservicios

```bash
# API Gateway
cd api-gateway
npm install
npm start

# ms-users
cd ms-users
npm install
npm start

# ms-tickets (Go)
cd ms-tickets
go mod download
go run main.go

# ms-showtimes (Python)
cd ms-showtimes
pip install -r requirements.txt
python main.py

# ms-payments
cd ms-payments
npm install
npm start

# ms-notifications
cd ms-notifications
npm install
npm start

# ms-reviews (Go)
cd ms-reviews
go mod download
go run main.go

# ms-loyalty (Python)
cd ms-loyalty
pip install -r requirements.txt
python main.py

# ms-analytics
cd ms-analytics
npm install
npm start
```

## 🚀 Uso

### 1. Registrar un Usuario

```bash
curl -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Juan Pérez",
    "email": "juan@example.com",
    "password": "password123",
    "subscription": "premium"
  }'
```

### 2. Login

```bash
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "juan@example.com",
    "password": "password123"
  }'

# Guarda el token JWT que recibes
```

### 3. Crear una Sala de Cine

```bash
curl -X POST http://localhost:8080/showtimes/theaters \
  -H "Authorization: Bearer TU_TOKEN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sala Premium 1",
    "total_seats": 100,
    "rows": ["A", "B", "C", "D", "E"],
    "seats_per_row": 20
  }'
```

### 4. Crear una Función

```bash
curl -X POST http://localhost:8080/showtimes/showtimes \
  -H "Authorization: Bearer TU_TOKEN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "movie_id": 1,
    "theater_id": 1,
    "start_time": "2026-02-15T20:00:00",
    "price": 12.50
  }'
```

### 5. Comprar un Ticket

```bash
curl -X POST http://localhost:8080/tickets/buy-ticket \
  -H "Authorization: Bearer TU_TOKEN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "showtime_id": 1,
    "seat": "A5"
  }'
```

### 6. Procesar Pago

```bash
curl -X POST http://localhost:8080/payments/payments \
  -H "Authorization: Bearer TU_TOKEN_JWT" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "ticket_id": 1,
    "amount": 12.50,
    "payment_method": "card"
  }'
```

## 📚 API Endpoints

### API Gateway (Puerto 8080)

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/auth/register` | Registrar usuario |
| POST | `/auth/login` | Login y obtener JWT |
| GET | `/health` | Health check del gateway |

### ms-users (Puerto 3000)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/register` | Registrar usuario | No |
| POST | `/login` | Login | No |
| GET | `/users/:id` | Obtener usuario | Sí |
| PUT | `/users/:id` | Actualizar usuario | Sí |
| POST | `/users/:id/points` | Agregar puntos | Sí |

### ms-showtimes (Puerto 4000)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/theaters` | Crear sala | Sí |
| GET | `/theaters` | Listar salas | Sí |
| POST | `/showtimes` | Crear función | Sí |
| GET | `/showtimes` | Listar funciones | Sí |
| GET | `/showtimes/:id` | Obtener función | Sí |
| GET | `/showtimes/:id/seats` | Ver disponibilidad | Sí |

### ms-tickets (Puerto 5000)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/buy-ticket` | Comprar ticket | Sí |
| GET | `/tickets` | Listar todos los tickets | Sí |
| GET | `/tickets/user/:id` | Tickets de un usuario | Sí |

### ms-payments (Puerto 6000)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/payments` | Procesar pago | Sí |
| GET | `/payments/:id` | Obtener pago | Sí |
| GET | `/payments/user/:id` | Pagos de usuario | Sí |
| POST | `/payments/:id/refund` | Reembolso | Sí |

### ms-notifications (Puerto 7000)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/events` | Recibir evento | No |
| POST | `/send-email` | Enviar email manual | Sí |
| POST | `/send-sms` | Enviar SMS | Sí |

### ms-reviews (Puerto 9000)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/reviews` | Crear reseña | Sí |
| GET | `/reviews` | Listar reseñas | No |
| GET | `/reviews/movie/:id` | Reseñas de película | No |
| GET | `/reviews/user/:id` | Reseñas de usuario | Sí |
| GET | `/reviews/stats/:id` | Estadísticas | No |

### ms-loyalty (Puerto 10000)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/memberships` | Crear membresía | Sí |
| GET | `/memberships/:user_id` | Obtener membresía | Sí |
| POST | `/memberships/:user_id/points` | Agregar puntos | Sí |
| POST | `/rewards` | Crear recompensa | Sí |
| GET | `/rewards` | Listar recompensas | No |
| POST | `/rewards/:id/redeem` | Canjear recompensa | Sí |

### ms-analytics (Puerto 11000)

| Método | Endpoint | Descripción | Auth |
|--------|----------|-------------|------|
| POST | `/events` | Registrar evento | No |
| GET | `/dashboard` | Dashboard general | Sí |
| GET | `/movies/:id/metrics` | Métricas de película | Sí |
| GET | `/sales` | Ventas por periodo | Sí |
| GET | `/users/:id/behavior` | Comportamiento usuario | Sí |
| GET | `/occupancy` | Ocupación de salas | Sí |

## 🔄 Flujos de Trabajo

### Flujo Completo de Compra de Ticket

```
1. Usuario se registra → ms-users
2. Usuario hace login → API Gateway (JWT)
3. Usuario busca películas → ms-movies (con cache Redis)
4. Usuario ve horarios disponibles → ms-showtimes
5. Usuario selecciona asiento → ms-showtimes (verifica disponibilidad)
6. Usuario compra ticket → ms-tickets
   ├─ Valida usuario en ms-users
   ├─ Valida función en ms-showtimes
   ├─ Previene doble reserva (UNIQUE constraint)
   └─ Publica evento a RabbitMQ
7. Sistema procesa pago → ms-payments
   ├─ Procesa con Stripe
   └─ Envía confirmación a ms-notifications
8. Usuario recibe email → ms-notifications
9. Sistema otorga puntos → ms-loyalty
   ├─ Calcula tier del usuario
   └─ Notifica puntos ganados
10. Sistema registra métricas → ms-analytics
```

## 🧪 Testing

```bash
# Health checks
curl http://localhost:8080/health
curl http://localhost:3000/health
curl http://localhost:4000/health
curl http://localhost:5000/health
curl http://localhost:6000/health
curl http://localhost:7000/health
curl http://localhost:9000/health
curl http://localhost:10000/health
curl http://localhost:11000/health

# RabbitMQ Management
# Acceder a: http://localhost:15672
# Usuario: admin
# Contraseña: admin123
```

## 🐳 Docker Commands

```bash
# Iniciar todos los servicios
docker-compose up -d

# Ver logs de todos los servicios
docker-compose logs -f

# Ver logs de un servicio específico
docker-compose logs -f ms-users

# Detener todos los servicios
docker-compose down

# Detener y eliminar volúmenes (⚠️ elimina datos)
docker-compose down -v

# Reconstruir imágenes
docker-compose build

# Reiniciar un servicio
docker-compose restart ms-users

# Ver estado de los servicios
docker-compose ps
```

## 🔧 Troubleshooting

### Error: Puerto ya en uso

```bash
# Ver qué proceso usa el puerto
lsof -i :8080

# Matar el proceso
kill -9 PID
```

### Error: Base de datos no conecta

```bash
# Verificar que PostgreSQL esté corriendo
docker ps | grep postgres

# Ver logs de PostgreSQL
docker logs postgres

# Reiniciar PostgreSQL
docker restart postgres
```

### Error: Servicios no se comunican

```bash
# Verificar la red de Docker
docker network ls
docker network inspect cine-microservicios_cine-network

# Verificar que todos los servicios estén en la misma red
docker inspect <container_name> | grep NetworkMode
```

## 📈 Próximas Mejoras

- [ ] Implementar RabbitMQ real (actualmente simulado en algunos servicios)
- [ ] Agregar tests unitarios y de integración
- [ ] Implementar Service Mesh (Istio)
- [ ] Agregar Prometheus + Grafana para monitoring
- [ ] Implementar Distributed Tracing (Jaeger)
- [ ] CI/CD con GitHub Actions
- [ ] Kubernetes deployment
- [ ] Frontend con React

## 📄 Licencia

MIT

## 👥 Autor

Jaime - [GitHub](https://github.com/Jaime-D-Z)

---

**¿Necesitas ayuda?** Abre un issue en GitHub o contacta el desarrollador
