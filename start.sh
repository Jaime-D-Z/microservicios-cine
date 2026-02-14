#!/bin/bash

echo "🎬 Sistema de Cines - Microservicios"
echo "===================================="
echo ""

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Función para verificar si un comando existe
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Verificar Docker
echo "📦 Verificando Docker..."
if ! command_exists docker; then
    echo -e "${RED}❌ Docker no está instalado${NC}"
    echo "Por favor instala Docker: https://docs.docker.com/get-docker/"
    exit 1
fi
echo -e "${GREEN}✅ Docker instalado${NC}"

# Verificar Docker Compose
echo "📦 Verificando Docker Compose..."
if ! command_exists docker-compose; then
    echo -e "${RED}❌ Docker Compose no está instalado${NC}"
    echo "Por favor instala Docker Compose: https://docs.docker.com/compose/install/"
    exit 1
fi
echo -e "${GREEN}✅ Docker Compose instalado${NC}"
echo ""

# Verificar si existe .env
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  Archivo .env no encontrado. Copiando desde .env.example...${NC}"
    cp .env.example .env
    echo -e "${GREEN}✅ Archivo .env creado${NC}"
    echo -e "${YELLOW}⚠️  Por favor edita el archivo .env con tus configuraciones${NC}"
    echo ""
fi

# Preguntar qué hacer
echo "¿Qué deseas hacer?"
echo "1) Iniciar todos los servicios"
echo "2) Detener todos los servicios"
echo "3) Ver logs"
echo "4) Reiniciar servicios"
echo "5) Ver estado de servicios"
echo "6) Limpiar todo (⚠️ elimina datos)"
echo ""
read -p "Selecciona una opción (1-6): " option

case $option in
    1)
        echo ""
        echo "🚀 Iniciando todos los servicios..."
        docker-compose up -d
        echo ""
        echo -e "${GREEN}✅ Servicios iniciados${NC}"
        echo ""
        echo "📊 URLs de los servicios:"
        echo "  • API Gateway:      http://localhost:8080"
        echo "  • ms-users:         http://localhost:3000"
        echo "  • ms-movies:        http://localhost:8000"
        echo "  • ms-tickets:       http://localhost:5000"
        echo "  • ms-showtimes:     http://localhost:4000"
        echo "  • ms-payments:      http://localhost:6000"
        echo "  • ms-notifications: http://localhost:7000"
        echo "  • ms-reviews:       http://localhost:9000"
        echo "  • ms-loyalty:       http://localhost:10000"
        echo "  • ms-analytics:     http://localhost:11000"
        echo "  • Nginx:            http://localhost:80"
        echo "  • RabbitMQ UI:      http://localhost:15672 (admin/admin123)"
        echo ""
        echo "Para ver logs: ./start.sh (opción 3)"
        ;;
    2)
        echo ""
        echo "🛑 Deteniendo todos los servicios..."
        docker-compose down
        echo -e "${GREEN}✅ Servicios detenidos${NC}"
        ;;
    3)
        echo ""
        echo "📋 Mostrando logs (Ctrl+C para salir)..."
        docker-compose logs -f
        ;;
    4)
        echo ""
        echo "🔄 Reiniciando servicios..."
        docker-compose restart
        echo -e "${GREEN}✅ Servicios reiniciados${NC}"
        ;;
    5)
        echo ""
        echo "📊 Estado de los servicios:"
        docker-compose ps
        ;;
    6)
        echo ""
        echo -e "${RED}⚠️  ADVERTENCIA: Esto eliminará todos los contenedores y datos${NC}"
        read -p "¿Estás seguro? (yes/no): " confirm
        if [ "$confirm" == "yes" ]; then
            echo "🗑️  Eliminando todo..."
            docker-compose down -v
            echo -e "${GREEN}✅ Todo limpiado${NC}"
        else
            echo "Operación cancelada"
        fi
        ;;
    *)
        echo -e "${RED}❌ Opción inválida${NC}"
        exit 1
        ;;
esac
