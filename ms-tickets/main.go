// ms-tickets/main.go
package main

import (
	"bytes"
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"

	_ "github.com/glebarez/go-sqlite"
	"github.com/joho/godotenv"
)

type Ticket struct {
	ID         int       `json:"id"`
	UserID     int       `json:"user_id"`
	ShowtimeID int       `json:"showtime_id"`
	Seat       string    `json:"seat"`
	Status     string    `json:"status"`
	Price      float64   `json:"price"`
	CreatedAt  time.Time `json:"created_at"`
}

type MessageQueue struct {
	Event string      `json:"event"`
	Data  interface{} `json:"data"`
}

var db *sql.DB

func main() {
	// Cargar variables de entorno
	godotenv.Load()

	var err error
	db, err = sql.Open("sqlite", "./tickets.db")
	if err != nil {
		log.Fatal("Error al abrir la DB:", err)
	}
	defer db.Close()

	// Crear la tabla con UNIQUE constraint para prevenir doble reserva
	createTableSQL := `
	CREATE TABLE IF NOT EXISTS tickets (
		id INTEGER PRIMARY KEY AUTOINCREMENT,
		user_id INTEGER NOT NULL,
		showtime_id INTEGER NOT NULL,
		seat TEXT NOT NULL,
		status TEXT DEFAULT 'reserved',
		price REAL DEFAULT 0.0,
		created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
		UNIQUE(showtime_id, seat)
	)`

	_, err = db.Exec(createTableSQL)
	if err != nil {
		log.Fatal("Error al crear la tabla:", err)
	}

	log.Println("[ms-tickets] Tabla verificada/creada")

	// Rutas
	http.HandleFunc("/buy-ticket", buyTicket)
	http.HandleFunc("/tickets", getTickets)
	http.HandleFunc("/tickets/user/", getTicketsByUser)
	http.HandleFunc("/health", healthCheck)

	port := os.Getenv("PORT")
	if port == "" {
		port = "5000"
	}

	log.Printf("[ms-tickets] Escuchando en puerto %s", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}

// ========================================
// 🎫 COMPRAR TICKET
// ========================================
func buyTicket(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Solo POST permitido", 405)
		return
	}

	var t Ticket
	if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
		http.Error(w, "JSON inválido", 400)
		return
	}

	// Validaciones
	if t.UserID == 0 || t.ShowtimeID == 0 || t.Seat == "" {
		http.Error(w, "Faltan campos requeridos", 400)
		return
	}

	log.Printf("Procesando compra de ticket: user=%d, showtime=%d, seat=%s", t.UserID, t.ShowtimeID, t.Seat)

	// 1. VALIDAR USUARIO (Puerto 3000)
	usersService := getEnv("USERS_SERVICE", "http://127.0.0.1:3000")
	respUser, errUser := http.Get(fmt.Sprintf("%s/users/%d", usersService, t.UserID))
	if errUser != nil {
		log.Printf("Error conectando con ms-users: %v", errUser)
		http.Error(w, "Servicio de usuarios no disponible", 503)
		return
	}
	defer respUser.Body.Close()

	if respUser.StatusCode != 200 {
		log.Printf("Usuario %d no existe", t.UserID)
		http.Error(w, "Usuario no existe", 404)
		return
	}

	// 2. VALIDAR FUNCIÓN (Showtime - Puerto 4000)
	showtimesService := getEnv("SHOWTIMES_SERVICE", "http://127.0.0.1:4000")
	respShowtime, errShowtime := http.Get(fmt.Sprintf("%s/showtimes/%d", showtimesService, t.ShowtimeID))
	if errShowtime != nil {
		log.Printf("Error conectando con ms-showtimes: %v", errShowtime)
		http.Error(w, "Servicio de funciones no disponible", 503)
		return
	}
	defer respShowtime.Body.Close()

	if respShowtime.StatusCode != 200 {
		log.Printf("Función %d no existe", t.ShowtimeID)
		http.Error(w, "Función no existe", 404)
		return
	}

	// Decodificar precio de la función
	var showtimeData map[string]interface{}
	json.NewDecoder(respShowtime.Body).Decode(&showtimeData)
	if price, ok := showtimeData["price"].(float64); ok {
		t.Price = price
	} else {
		t.Price = 10.0 // Precio por defecto
	}

	// 3. VERIFICAR SI EL ASIENTO YA ESTÁ OCUPADO
	var existingID int
	checkSQL := "SELECT id FROM tickets WHERE showtime_id = ? AND seat = ? AND status != 'cancelled'"
	err := db.QueryRow(checkSQL, t.ShowtimeID, t.Seat).Scan(&existingID)
	
	if err == nil {
		log.Printf("Asiento %s ya está reservado en función %d", t.Seat, t.ShowtimeID)
		http.Error(w, "Este asiento ya está ocupado", 409)
		return
	}

	// 4. GUARDAR TICKET EN DB
	stmt, err := db.Prepare("INSERT INTO tickets(user_id, showtime_id, seat, status, price) VALUES(?, ?, ?, ?, ?)")
	if err != nil {
		log.Println("Error en Prepare:", err)
		http.Error(w, "Error interno de DB", 500)
		return
	}
	defer stmt.Close()

	res, err := stmt.Exec(t.UserID, t.ShowtimeID, t.Seat, "reserved", t.Price)
	if err != nil {
		log.Println("Error en Exec (Insert):", err)
		http.Error(w, "No se pudo guardar el ticket", 500)
		return
	}

	id, _ := res.LastInsertId()
	t.ID = int(id)
	t.Status = "reserved"
	t.CreatedAt = time.Now()

	log.Printf("Ticket creado exitosamente: ID=%d", t.ID)

	// 5. PUBLICAR MENSAJE A COLA (simulado - en producción usar RabbitMQ)
	go publishTicketEvent("ticket.purchased", t)

	// Respuesta exitosa
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(201)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Ticket comprado exitosamente",
		"ticket":  t,
	})
}

// ========================================
// 📋 OBTENER TODOS LOS TICKETS
// ========================================
func getTickets(w http.ResponseWriter, r *http.Request) {
	if r.Method != "GET" {
		http.Error(w, "Solo GET permitido", 405)
		return
	}

	rows, err := db.Query("SELECT id, user_id, showtime_id, seat, status, price, created_at FROM tickets ORDER BY created_at DESC")
	if err != nil {
		log.Println("Error en Query:", err)
		http.Error(w, "Error al obtener tickets", 500)
		return
	}
	defer rows.Close()

	var tickets []Ticket
	for rows.Next() {
		var t Ticket
		err := rows.Scan(&t.ID, &t.UserID, &t.ShowtimeID, &t.Seat, &t.Status, &t.Price, &t.CreatedAt)
		if err != nil {
			log.Println("Error en Scan:", err)
			continue
		}
		tickets = append(tickets, t)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tickets)
}

// ========================================
// 👤 OBTENER TICKETS DE UN USUARIO
// ========================================
func getTicketsByUser(w http.ResponseWriter, r *http.Request) {
	// Extraer user_id de la URL: /tickets/user/{id}
	userID := r.URL.Path[len("/tickets/user/"):]

	rows, err := db.Query("SELECT id, user_id, showtime_id, seat, status, price, created_at FROM tickets WHERE user_id = ? ORDER BY created_at DESC", userID)
	if err != nil {
		log.Println("Error en Query:", err)
		http.Error(w, "Error al obtener tickets", 500)
		return
	}
	defer rows.Close()

	var tickets []Ticket
	for rows.Next() {
		var t Ticket
		err := rows.Scan(&t.ID, &t.UserID, &t.ShowtimeID, &t.Seat, &t.Status, &t.Price, &t.CreatedAt)
		if err != nil {
			log.Println("Error en Scan:", err)
			continue
		}
		tickets = append(tickets, t)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tickets)
}

// ========================================
// 🏥 HEALTH CHECK
// ========================================
func healthCheck(w http.ResponseWriter, r *http.Request) {
	// Verificar conexión a DB
	err := db.Ping()
	status := "healthy"
	dbStatus := "connected"
	statusCode := 200

	if err != nil {
		status = "unhealthy"
		dbStatus = "disconnected"
		statusCode = 503
		log.Printf("Health check falló: %v", err)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(statusCode)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":    status,
		"service":   "ms-tickets",
		"database":  dbStatus,
		"timestamp": time.Now(),
	})
}

// ========================================
// 📤 PUBLICAR EVENTO (Simulado)
// ========================================
func publishTicketEvent(event string, data interface{}) {
	notificationService := getEnv("NOTIFICATIONS_SERVICE", "http://127.0.0.1:7000")

	message := MessageQueue{
		Event: event,
		Data:  data,
	}

	jsonData, _ := json.Marshal(message)
	resp, err := http.Post(
		notificationService+"/events",
		"application/json",
		bytes.NewBuffer(jsonData),
	)

	if err != nil {
		log.Printf("No se pudo enviar evento a notificaciones: %v", err)
		return
	}
	defer resp.Body.Close()

	log.Printf("Evento '%s' publicado a ms-notifications", event)
}

// ========================================
// 🛠️ HELPER: Obtener variable de entorno
// ========================================
func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}
