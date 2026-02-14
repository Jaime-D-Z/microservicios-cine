# ms-showtimes/main.py
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from typing import Optional, List
import logging

# Configuración de logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(title="MS-Showtimes", version="2.0.0")

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ========================================
# 📊 MODELOS
# ========================================
class Theater(BaseModel):
    id: Optional[int] = None
    name: str
    total_seats: int
    rows: List[str]
    seats_per_row: int

class Showtime(BaseModel):
    id: Optional[int] = None
    movie_id: int
    theater_id: int
    start_time: datetime
    price: float
    available_seats: Optional[int] = None

class SeatAvailability(BaseModel):
    showtime_id: int
    total_seats: int
    occupied_seats: int
    available_seats: int
    occupied_seat_list: List[str]

# ========================================
# 🗄️ CONEXIÓN A BASE DE DATOS
# ========================================
def get_db_connection():
    return psycopg2.connect(
        host=os.getenv("DB_HOST", "localhost"),
        database=os.getenv("DB_NAME", "cine_db"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "postgres123"),
        port=os.getenv("DB_PORT", "5433")
    )

# ========================================
# 🏗️ CREAR TABLAS
# ========================================
def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Tabla de salas
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS theaters (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            total_seats INTEGER NOT NULL,
            rows TEXT[] NOT NULL,
            seats_per_row INTEGER NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)
    
    # Tabla de funciones
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS showtimes (
            id SERIAL PRIMARY KEY,
            movie_id INTEGER NOT NULL,
            theater_id INTEGER NOT NULL,
            start_time TIMESTAMP NOT NULL,
            price REAL DEFAULT 10.0,
            created_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(theater_id, start_time)
        )
    """)
    
    conn.commit()
    cursor.close()
    conn.close()
    logger.info("Tablas verificadas/creadas")

init_db()

# ========================================
# 🎭 CREAR SALA
# ========================================
@app.post("/theaters", status_code=201)
async def create_theater(theater: Theater):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute(
            """INSERT INTO theaters (name, total_seats, rows, seats_per_row) 
               VALUES (%s, %s, %s, %s) RETURNING *""",
            (theater.name, theater.total_seats, theater.rows, theater.seats_per_row)
        )
        
        result = cursor.fetchone()
        conn.commit()
        cursor.close()
        conn.close()
        
        logger.info(f"Sala creada: {result['id']}")
        return result
    except Exception as e:
        logger.error(f"Error creando sala: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ========================================
# 📋 LISTAR SALAS
# ========================================
@app.get("/theaters")
async def get_theaters():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute("SELECT * FROM theaters ORDER BY id")
        results = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        return results
    except Exception as e:
        logger.error(f"Error obteniendo salas: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ========================================
# 🎬 CREAR FUNCIÓN (SHOWTIME)
# ========================================
@app.post("/showtimes", status_code=201)
async def create_showtime(showtime: Showtime):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Verificar que la sala existe
        cursor.execute("SELECT id FROM theaters WHERE id = %s", (showtime.theater_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Sala no encontrada")
        
        cursor.execute(
            """INSERT INTO showtimes (movie_id, theater_id, start_time, price) 
               VALUES (%s, %s, %s, %s) RETURNING *""",
            (showtime.movie_id, showtime.theater_id, showtime.start_time, showtime.price)
        )
        
        result = cursor.fetchone()
        conn.commit()
        cursor.close()
        conn.close()
        
        logger.info(f"Función creada: {result['id']}")
        return result
    except psycopg2.IntegrityError:
        raise HTTPException(status_code=409, detail="Ya existe una función en esa sala a esa hora")
    except Exception as e:
        logger.error(f"Error creando función: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ========================================
# 📅 OBTENER FUNCIONES
# ========================================
@app.get("/showtimes")
async def get_showtimes(
    movie_id: Optional[int] = None,
    theater_id: Optional[int] = None,
    date: Optional[str] = None
):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        query = "SELECT * FROM showtimes WHERE 1=1"
        params = []
        
        if movie_id:
            query += " AND movie_id = %s"
            params.append(movie_id)
        
        if theater_id:
            query += " AND theater_id = %s"
            params.append(theater_id)
        
        if date:
            query += " AND DATE(start_time) = %s"
            params.append(date)
        
        query += " ORDER BY start_time"
        
        cursor.execute(query, params)
        results = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        return results
    except Exception as e:
        logger.error(f"Error obteniendo funciones: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ========================================
# 🎫 OBTENER FUNCIÓN POR ID
# ========================================
@app.get("/showtimes/{showtime_id}")
async def get_showtime(showtime_id: int):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute("SELECT * FROM showtimes WHERE id = %s", (showtime_id,))
        result = cursor.fetchone()
        
        cursor.close()
        conn.close()
        
        if not result:
            raise HTTPException(status_code=404, detail="Función no encontrada")
        
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error obteniendo función: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ========================================
# 💺 OBTENER DISPONIBILIDAD DE ASIENTOS
# ========================================
@app.get("/showtimes/{showtime_id}/seats")
async def get_seat_availability(showtime_id: int):
    try:
        import requests
        
        # Obtener información de la función
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute(
            """SELECT s.*, t.total_seats 
               FROM showtimes s 
               JOIN theaters t ON s.theater_id = t.id 
               WHERE s.id = %s""",
            (showtime_id,)
        )
        showtime = cursor.fetchone()
        
        if not showtime:
            raise HTTPException(status_code=404, detail="Función no encontrada")
        
        # Consultar tickets reservados desde ms-tickets
        tickets_service = os.getenv("TICKETS_SERVICE", "http://127.0.0.1:5000")
        try:
            response = requests.get(f"{tickets_service}/tickets")
            all_tickets = response.json()
            
            # Filtrar tickets de esta función
            occupied_seats = [
                t['seat'] for t in all_tickets 
                if t['showtime_id'] == showtime_id and t['status'] != 'cancelled'
            ]
        except:
            occupied_seats = []
        
        cursor.close()
        conn.close()
        
        total_seats = showtime['total_seats']
        occupied_count = len(occupied_seats)
        
        return {
            "showtime_id": showtime_id,
            "total_seats": total_seats,
            "occupied_seats": occupied_count,
            "available_seats": total_seats - occupied_count,
            "occupied_seat_list": occupied_seats
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error obteniendo disponibilidad: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

# ========================================
# 🏥 HEALTH CHECK
# ========================================
@app.get("/health")
async def health_check():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        cursor.close()
        conn.close()
        
        return {
            "status": "healthy",
            "service": "ms-showtimes",
            "database": "connected",
            "timestamp": datetime.now().isoformat()
        }
    except Exception as e:
        logger.error(f"Health check falló: {str(e)}")
        return {
            "status": "unhealthy",
            "service": "ms-showtimes",
            "database": "disconnected",
            "error": str(e)
        }

# ========================================
# 🚀 INICIAR SERVIDOR
# ========================================
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "4000"))
    logger.info(f"[ms-showtimes] Escuchando en puerto {port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
