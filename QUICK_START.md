# 🚀 GUÍA RÁPIDA - Sistema de Cines

## Inicio Rápido

```bash
# 1. Clonar y configurar
git clone <repo>
cd cine-microservicios
cp .env.example .env

# 2. Iniciar con Docker
chmod +x start.sh
./start.sh
# Selecciona opción 1

# 3. Esperar ~30 segundos para que todos los servicios inicien

# 4. Probar
curl http://localhost:8080/health
```

## 🎯 Casos de Uso Comunes

### 1. Registrar y hacer login

```bash
# Registrar
curl -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test User",
    "email": "test@test.com",
    "password": "test123"
  }'

# Login (guarda el token)
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@test.com",
    "password": "test123"
  }'

# Exportar token
export TOKEN="tu_token_aqui"
```

### 2. Crear sala y función

```bash
# Crear sala
curl -X POST http://localhost:8080/showtimes/theaters \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sala 1",
    "total_seats": 50,
    "rows": ["A","B","C","D","E"],
    "seats_per_row": 10
  }'

# Crear función
curl -X POST http://localhost:8080/showtimes/showtimes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "movie_id": 1,
    "theater_id": 1,
    "start_time": "2026-02-20T19:00:00",
    "price": 15.00
  }'
```

### 3. Comprar ticket completo

```bash
# 1. Ver disponibilidad
curl http://localhost:8080/showtimes/showtimes/1/seats \
  -H "Authorization: Bearer $TOKEN"

# 2. Comprar ticket
curl -X POST http://localhost:8080/tickets/buy-ticket \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "showtime_id": 1,
    "seat": "A5"
  }'

# 3. Procesar pago
curl -X POST http://localhost:8080/payments/payments \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "ticket_id": 1,
    "amount": 15.00,
    "payment_method": "card"
  }'
```

### 4. Ver analytics

```bash
# Dashboard general
curl http://localhost:8080/analytics/dashboard \
  -H "Authorization: Bearer $TOKEN"

# Métricas de película
curl http://localhost:8080/analytics/movies/1/metrics \
  -H "Authorization: Bearer $TOKEN"

# Ventas del día
curl "http://localhost:8080/analytics/sales?interval=day" \
  -H "Authorization: Bearer $TOKEN"
```

## 🔧 Comandos Docker Útiles

```bash
# Ver logs de un servicio
docker-compose logs -f ms-users

# Reiniciar un servicio
docker-compose restart ms-tickets

# Entrar a un contenedor
docker exec -it cine-ms-users sh

# Ver recursos usados
docker stats

# Limpiar imágenes no usadas
docker image prune -a
```

## 🐛 Debugging

### Servicio no responde

```bash
# 1. Verificar que esté corriendo
docker-compose ps

# 2. Ver logs
docker-compose logs ms-users

# 3. Verificar health
curl http://localhost:3000/health

# 4. Reiniciar
docker-compose restart ms-users
```

### Base de datos no conecta

```bash
# Verificar PostgreSQL
docker logs cine-postgres

# Conectar manualmente
docker exec -it cine-postgres psql -U postgres -d cine_db

# Ver tablas
\dt

# Verificar MongoDB
docker exec -it cine-mongodb mongosh -u admin -p admin123
```

## 📊 Monitoring

### RabbitMQ Dashboard
- URL: http://localhost:15672
- User: admin
- Pass: admin123

### Ver logs en tiempo real
```bash
# Todos los servicios
docker-compose logs -f

# Solo errores
docker-compose logs -f | grep ERROR

# Un servicio específico
docker-compose logs -f ms-payments
```

## 🎯 Variables de Entorno Importantes

```bash
# JWT
JWT_SECRET=tu_secreto_aqui

# PostgreSQL
DB_HOST=localhost
DB_PORT=5433
DB_PASSWORD=postgres123

# MongoDB
MONGO_URI=mongodb://admin:admin123@localhost:27017

# SMTP (para emails)
SMTP_HOST=smtp.gmail.com
SMTP_USER=tu-email@gmail.com
SMTP_PASS=tu-app-password
```

## 🚨 Troubleshooting Rápido

| Problema | Solución |
|----------|----------|
| Puerto ya en uso | `lsof -i :8080` y `kill -9 PID` |
| Servicio no inicia | `docker-compose logs servicio` |
| No hay conexión entre servicios | Verificar red: `docker network inspect cine-microservicios_cine-network` |
| Base de datos vacía | Reiniciar: `docker-compose restart postgres` |
| Token JWT inválido | Hacer login nuevamente |

## 📈 Performance Tips

1. **Redis Cache**: Las películas se cachean 5 minutos
2. **Connection Pool**: PostgreSQL usa pool de 10 conexiones
3. **Rate Limit**: 100 requests/15min por IP
4. **Circuit Breaker**: Se abre tras 50% de errores

## 🎓 Próximos Pasos

1. ✅ Completar el setup básico
2. 📝 Crear datos de prueba (salas, películas, funciones)
3. 🧪 Probar flujo completo de compra
4. 📊 Revisar analytics y métricas
5. 🎨 Agregar frontend (opcional)

## 💡 Tips de Desarrollo

- Usa Postman/Thunder Client para probar APIs
- Guarda los tokens JWT en variables de entorno
- Revisa logs frecuentemente con `docker-compose logs -f`
- Usa RabbitMQ UI para ver mensajes en cola
- Monitorea recursos con `docker stats`

---

**¿Dudas?** Revisa el README.md principal o abre un issue.
