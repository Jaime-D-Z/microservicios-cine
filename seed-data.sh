#!/bin/bash

# Script para crear datos de prueba en el sistema

echo "🌱 Poblando base de datos con datos de prueba..."
echo ""

API_URL="http://localhost:8080"
TOKEN=""

# Colores
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}1. Registrando usuarios de prueba...${NC}"

# Usuario 1
RESPONSE=$(curl -s -X POST $API_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Ana García",
    "email": "ana@test.com",
    "password": "test123",
    "subscription": "premium"
  }')
echo "✅ Usuario: ana@test.com"

# Usuario 2
curl -s -X POST $API_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Carlos López",
    "email": "carlos@test.com",
    "password": "test123",
    "subscription": "basic"
  }' > /dev/null
echo "✅ Usuario: carlos@test.com"

# Usuario 3
curl -s -X POST $API_URL/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "name": "María Rodríguez",
    "email": "maria@test.com",
    "password": "test123",
    "subscription": "gold"
  }' > /dev/null
echo "✅ Usuario: maria@test.com"

echo ""
echo -e "${BLUE}2. Obteniendo token de autenticación...${NC}"

# Login y obtener token
LOGIN_RESPONSE=$(curl -s -X POST $API_URL/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "ana@test.com",
    "password": "test123"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
    echo "❌ Error obteniendo token"
    exit 1
fi

echo "✅ Token obtenido"

echo ""
echo -e "${BLUE}3. Creando salas de cine...${NC}"

# Sala 1
curl -s -X POST $API_URL/showtimes/theaters \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sala Premium 1",
    "total_seats": 100,
    "rows": ["A","B","C","D","E","F","G","H","I","J"],
    "seats_per_row": 10
  }' > /dev/null
echo "✅ Sala Premium 1 (100 asientos)"

# Sala 2
curl -s -X POST $API_URL/showtimes/theaters \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sala VIP 2",
    "total_seats": 50,
    "rows": ["A","B","C","D","E"],
    "seats_per_row": 10
  }' > /dev/null
echo "✅ Sala VIP 2 (50 asientos)"

# Sala 3
curl -s -X POST $API_URL/showtimes/theaters \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Sala Estándar 3",
    "total_seats": 80,
    "rows": ["A","B","C","D","E","F","G","H"],
    "seats_per_row": 10
  }' > /dev/null
echo "✅ Sala Estándar 3 (80 asientos)"

echo ""
echo -e "${BLUE}4. Creando funciones (showtimes)...${NC}"

# Funciones para hoy
TODAY=$(date -u +"%Y-%m-%dT19:00:00")
TOMORROW=$(date -u -d "+1 day" +"%Y-%m-%dT20:00:00")

# Función 1
curl -s -X POST $API_URL/showtimes/showtimes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"movie_id\": 1,
    \"theater_id\": 1,
    \"start_time\": \"$TODAY\",
    \"price\": 15.00
  }" > /dev/null
echo "✅ Función 1: Película 1 - Hoy 19:00 - \$15.00"

# Función 2
curl -s -X POST $API_URL/showtimes/showtimes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"movie_id\": 2,
    \"theater_id\": 2,
    \"start_time\": \"$TODAY\",
    \"price\": 20.00
  }" > /dev/null
echo "✅ Función 2: Película 2 - Hoy 19:00 - \$20.00"

# Función 3
curl -s -X POST $API_URL/showtimes/showtimes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"movie_id\": 3,
    \"theater_id\": 3,
    \"start_time\": \"$TOMORROW\",
    \"price\": 12.00
  }" > /dev/null
echo "✅ Función 3: Película 3 - Mañana 20:00 - \$12.00"

# Función 4
curl -s -X POST $API_URL/showtimes/showtimes \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"movie_id\": 1,
    \"theater_id\": 1,
    \"start_time\": \"$TOMORROW\",
    \"price\": 15.00
  }" > /dev/null
echo "✅ Función 4: Película 1 - Mañana 20:00 - \$15.00"

echo ""
echo -e "${BLUE}5. Creando recompensas del programa de lealtad...${NC}"

# Recompensa 1
curl -s -X POST $API_URL/loyalty/rewards \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Entrada Gratis",
    "description": "Una entrada gratis para cualquier función",
    "points_required": 500,
    "reward_type": "free_ticket"
  }' > /dev/null
echo "✅ Entrada Gratis - 500 puntos"

# Recompensa 2
curl -s -X POST $API_URL/loyalty/rewards \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Combo Premium",
    "description": "Palomitas grandes + Bebida grande + Nachos",
    "points_required": 300,
    "reward_type": "food_combo"
  }' > /dev/null
echo "✅ Combo Premium - 300 puntos"

# Recompensa 3
curl -s -X POST $API_URL/loyalty/rewards \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Upgrade a VIP",
    "description": "Upgrade de asiento estándar a VIP",
    "points_required": 200,
    "reward_type": "seat_upgrade"
  }' > /dev/null
echo "✅ Upgrade a VIP - 200 puntos"

echo ""
echo -e "${BLUE}6. Comprando tickets de prueba...${NC}"

# Ticket 1
curl -s -X POST $API_URL/tickets/buy-ticket \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "showtime_id": 1,
    "seat": "A5"
  }' > /dev/null
echo "✅ Ticket: Usuario 1 - Función 1 - Asiento A5"

# Ticket 2
curl -s -X POST $API_URL/tickets/buy-ticket \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "showtime_id": 1,
    "seat": "A6"
  }' > /dev/null
echo "✅ Ticket: Usuario 1 - Función 1 - Asiento A6"

# Ticket 3
curl -s -X POST $API_URL/tickets/buy-ticket \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 2,
    "showtime_id": 2,
    "seat": "B10"
  }' > /dev/null
echo "✅ Ticket: Usuario 2 - Función 2 - Asiento B10"

echo ""
echo -e "${BLUE}7. Creando reseñas de películas...${NC}"

# Review 1
curl -s -X POST $API_URL/reviews/reviews \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "movie_id": 1,
    "rating": 4.5,
    "comment": "Excelente película, muy entretenida"
  }' > /dev/null
echo "✅ Review: Película 1 - 4.5 estrellas"

# Review 2
curl -s -X POST $API_URL/reviews/reviews \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 2,
    "movie_id": 1,
    "rating": 5.0,
    "comment": "¡Increíble! La mejor película del año"
  }' > /dev/null
echo "✅ Review: Película 1 - 5.0 estrellas"

# Review 3
curl -s -X POST $API_URL/reviews/reviews \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": 1,
    "movie_id": 2,
    "rating": 3.5,
    "comment": "Buena, pero esperaba más"
  }' > /dev/null
echo "✅ Review: Película 2 - 3.5 estrellas"

echo ""
echo -e "${GREEN}✅ ¡Datos de prueba creados exitosamente!${NC}"
echo ""
echo "📊 Resumen:"
echo "  • 3 usuarios creados"
echo "  • 3 salas de cine"
echo "  • 4 funciones programadas"
echo "  • 3 recompensas disponibles"
echo "  • 3 tickets comprados"
echo "  • 3 reseñas publicadas"
echo ""
echo "🔑 Credenciales de prueba:"
echo "  • ana@test.com / test123"
echo "  • carlos@test.com / test123"
echo "  • maria@test.com / test123"
echo ""
echo "🎯 Próximos pasos:"
echo "  1. Hacer login: curl -X POST $API_URL/auth/login ..."
echo "  2. Ver funciones: curl $API_URL/showtimes/showtimes"
echo "  3. Ver analytics: curl $API_URL/analytics/dashboard"
