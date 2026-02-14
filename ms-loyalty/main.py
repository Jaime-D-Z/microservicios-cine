# ms-loyalty/main.py
from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
import os
from datetime import datetime
import logging
import requests

# Configuración de logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)

PORT = int(os.getenv("PORT", "10000"))

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
    
    # Tabla de membresías
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS memberships (
            id SERIAL PRIMARY KEY,
            user_id INTEGER UNIQUE NOT NULL,
            tier TEXT DEFAULT 'bronze',
            points INTEGER DEFAULT 0,
            lifetime_points INTEGER DEFAULT 0,
            created_at TIMESTAMP DEFAULT NOW(),
            updated_at TIMESTAMP DEFAULT NOW()
        )
    """)
    
    # Tabla de transacciones de puntos
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS points_transactions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            points INTEGER NOT NULL,
            reason TEXT,
            transaction_type TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)
    
    # Tabla de recompensas
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS rewards (
            id SERIAL PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            points_required INTEGER NOT NULL,
            reward_type TEXT,
            active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP DEFAULT NOW()
        )
    """)
    
    # Tabla de canjeos
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS redemptions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER NOT NULL,
            reward_id INTEGER NOT NULL,
            points_used INTEGER NOT NULL,
            status TEXT DEFAULT 'pending',
            redeemed_at TIMESTAMP DEFAULT NOW()
        )
    """)
    
    conn.commit()
    cursor.close()
    conn.close()
    logger.info("Tablas verificadas/creadas")

init_db()

# ========================================
# 👤 CREAR/OBTENER MEMBRESÍA
# ========================================
@app.route("/memberships", methods=["POST"])
def create_membership():
    data = request.json
    user_id = data.get("user_id")
    
    if not user_id:
        return jsonify({"error": "user_id es requerido"}), 400
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Verificar si ya existe
        cursor.execute("SELECT * FROM memberships WHERE user_id = %s", (user_id,))
        existing = cursor.fetchone()
        
        if existing:
            cursor.close()
            conn.close()
            return jsonify(existing), 200
        
        # Crear nueva membresía
        cursor.execute(
            """INSERT INTO memberships (user_id, tier, points, lifetime_points) 
               VALUES (%s, 'bronze', 0, 0) RETURNING *""",
            (user_id,)
        )
        
        result = cursor.fetchone()
        conn.commit()
        cursor.close()
        conn.close()
        
        logger.info(f"Membresía creada para usuario {user_id}")
        return jsonify(result), 201
    except Exception as e:
        logger.error(f"Error creando membresía: {str(e)}")
        return jsonify({"error": str(e)}), 500

@app.route("/memberships/<int:user_id>", methods=["GET"])
def get_membership(user_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute("SELECT * FROM memberships WHERE user_id = %s", (user_id,))
        result = cursor.fetchone()
        
        cursor.close()
        conn.close()
        
        if not result:
            return jsonify({"error": "Membresía no encontrada"}), 404
        
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Error obteniendo membresía: {str(e)}")
        return jsonify({"error": str(e)}), 500

# ========================================
# 🎁 AGREGAR PUNTOS
# ========================================
@app.route("/memberships/<int:user_id>/points", methods=["POST"])
def add_points(user_id):
    data = request.json
    points = data.get("points", 0)
    reason = data.get("reason", "Compra de ticket")
    
    if points <= 0:
        return jsonify({"error": "Los puntos deben ser positivos"}), 400
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Verificar que la membresía existe
        cursor.execute("SELECT * FROM memberships WHERE user_id = %s", (user_id,))
        membership = cursor.fetchone()
        
        if not membership:
            # Crear membresía si no existe
            cursor.execute(
                """INSERT INTO memberships (user_id, tier, points, lifetime_points) 
                   VALUES (%s, 'bronze', 0, 0) RETURNING *""",
                (user_id,)
            )
            membership = cursor.fetchone()
            conn.commit()
        
        # Agregar puntos
        new_points = membership['points'] + points
        new_lifetime = membership['lifetime_points'] + points
        
        # Determinar tier basado en puntos totales
        tier = calculate_tier(new_lifetime)
        
        cursor.execute(
            """UPDATE memberships 
               SET points = %s, lifetime_points = %s, tier = %s, updated_at = NOW() 
               WHERE user_id = %s RETURNING *""",
            (new_points, new_lifetime, tier, user_id)
        )
        
        updated_membership = cursor.fetchone()
        
        # Registrar transacción
        cursor.execute(
            """INSERT INTO points_transactions (user_id, points, reason, transaction_type) 
               VALUES (%s, %s, %s, 'credit')""",
            (user_id, points, reason)
        )
        
        conn.commit()
        
        # Actualizar puntos en ms-users
        try:
            users_service = os.getenv("USERS_SERVICE", "http://127.0.0.1:3000")
            requests.post(
                f"{users_service}/users/{user_id}/points",
                json={"points": points}
            )
        except Exception as e:
            logger.warn(f"No se pudo actualizar ms-users: {str(e)}")
        
        # Notificar al usuario
        try:
            notifications_service = os.getenv("NOTIFICATIONS_SERVICE", "http://127.0.0.1:7000")
            requests.post(
                f"{notifications_service}/events",
                json={
                    "event": "loyalty.points_added",
                    "data": {
                        "user": {"id": user_id, "email": "user@example.com", "points": new_points},
                        "points": points
                    }
                }
            )
        except Exception as e:
            logger.warn(f"No se pudo notificar: {str(e)}")
        
        cursor.close()
        conn.close()
        
        logger.info(f"Puntos agregados: user={user_id}, points={points}, new_total={new_points}")
        
        return jsonify({
            "message": f"{points} puntos agregados exitosamente",
            "membership": updated_membership
        }), 200
    except Exception as e:
        logger.error(f"Error agregando puntos: {str(e)}")
        return jsonify({"error": str(e)}), 500

# ========================================
# 🏆 CALCULAR TIER
# ========================================
def calculate_tier(lifetime_points):
    if lifetime_points >= 5000:
        return "platinum"
    elif lifetime_points >= 2000:
        return "gold"
    elif lifetime_points >= 500:
        return "silver"
    else:
        return "bronze"

# ========================================
# 🎯 CREAR RECOMPENSA
# ========================================
@app.route("/rewards", methods=["POST"])
def create_reward():
    data = request.json
    
    required_fields = ["name", "points_required", "reward_type"]
    if not all(field in data for field in required_fields):
        return jsonify({"error": "Faltan campos requeridos"}), 400
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute(
            """INSERT INTO rewards (name, description, points_required, reward_type) 
               VALUES (%s, %s, %s, %s) RETURNING *""",
            (data["name"], data.get("description"), data["points_required"], data["reward_type"])
        )
        
        result = cursor.fetchone()
        conn.commit()
        cursor.close()
        conn.close()
        
        logger.info(f"Recompensa creada: {result['id']}")
        return jsonify(result), 201
    except Exception as e:
        logger.error(f"Error creando recompensa: {str(e)}")
        return jsonify({"error": str(e)}), 500

# ========================================
# 📋 LISTAR RECOMPENSAS
# ========================================
@app.route("/rewards", methods=["GET"])
def get_rewards():
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute("SELECT * FROM rewards WHERE active = TRUE ORDER BY points_required")
        results = cursor.fetchall()
        
        cursor.close()
        conn.close()
        
        return jsonify(results), 200
    except Exception as e:
        logger.error(f"Error obteniendo recompensas: {str(e)}")
        return jsonify({"error": str(e)}), 500

# ========================================
# 🎁 CANJEAR RECOMPENSA
# ========================================
@app.route("/rewards/<int:reward_id>/redeem", methods=["POST"])
def redeem_reward(reward_id):
    data = request.json
    user_id = data.get("user_id")
    
    if not user_id:
        return jsonify({"error": "user_id es requerido"}), 400
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Obtener recompensa
        cursor.execute("SELECT * FROM rewards WHERE id = %s AND active = TRUE", (reward_id,))
        reward = cursor.fetchone()
        
        if not reward:
            return jsonify({"error": "Recompensa no encontrada o inactiva"}), 404
        
        # Obtener membresía
        cursor.execute("SELECT * FROM memberships WHERE user_id = %s", (user_id,))
        membership = cursor.fetchone()
        
        if not membership:
            return jsonify({"error": "Membresía no encontrada"}), 404
        
        # Verificar puntos suficientes
        if membership['points'] < reward['points_required']:
            return jsonify({"error": "Puntos insuficientes"}), 400
        
        # Descontar puntos
        new_points = membership['points'] - reward['points_required']
        cursor.execute(
            "UPDATE memberships SET points = %s, updated_at = NOW() WHERE user_id = %s",
            (new_points, user_id)
        )
        
        # Registrar transacción
        cursor.execute(
            """INSERT INTO points_transactions (user_id, points, reason, transaction_type) 
               VALUES (%s, %s, %s, 'debit')""",
            (user_id, -reward['points_required'], f"Canje: {reward['name']}")
        )
        
        # Registrar canje
        cursor.execute(
            """INSERT INTO redemptions (user_id, reward_id, points_used, status) 
               VALUES (%s, %s, %s, 'completed') RETURNING *""",
            (user_id, reward_id, reward['points_required'])
        )
        
        redemption = cursor.fetchone()
        conn.commit()
        cursor.close()
        conn.close()
        
        logger.info(f"Recompensa canjeada: user={user_id}, reward={reward_id}")
        
        return jsonify({
            "message": "Recompensa canjeada exitosamente",
            "redemption": redemption,
            "remaining_points": new_points
        }), 201
    except Exception as e:
        logger.error(f"Error canjeando recompensa: {str(e)}")
        return jsonify({"error": str(e)}), 500

# ========================================
# 🏥 HEALTH CHECK
# ========================================
@app.route("/health", methods=["GET"])
def health_check():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT 1")
        cursor.close()
        conn.close()
        
        return jsonify({
            "status": "healthy",
            "service": "ms-loyalty",
            "database": "connected",
            "timestamp": datetime.now().isoformat()
        }), 200
    except Exception as e:
        logger.error(f"Health check falló: {str(e)}")
        return jsonify({
            "status": "unhealthy",
            "service": "ms-loyalty",
            "database": "disconnected",
            "error": str(e)
        }), 503

# ========================================
# 🚀 INICIAR SERVIDOR
# ========================================
if __name__ == "__main__":
    logger.info(f"[ms-loyalty] Escuchando en puerto {PORT}")
    app.run(host="0.0.0.0", port=PORT, debug=False)
