package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"
	"net/http"

	_ "github.com/glebarez/go-sqlite"
)

type Ticket struct {
	ID      int    `json:"id"`
	UserID  int    `json:"user_id"`
	MovieID int    `json:"movie_id"`
	Seat    string `json:"seat"`
}

var db *sql.DB

func main() {
	var err error
	// Cambiamos el driver a "sqlite" (la nueva librería)
	db, err = sql.Open("sqlite", "./tickets.db")
	if err != nil {
		log.Fatal("Error al abrir la DB:", err)
	}
	defer db.Close()

	// Crear la tabla automáticamente
	_, err = db.Exec("CREATE TABLE IF NOT EXISTS tickets (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, movie_id INTEGER, seat TEXT)")
	if err != nil {
		log.Fatal("Error al crear la tabla:", err)
	}

	http.HandleFunc("/buy-ticket", buyTicket)

	fmt.Println("[ms-tickets] escuchando en puerto 5000")
	log.Fatal(http.ListenAndServe(":5000", nil))
}

func buyTicket(w http.ResponseWriter, r *http.Request) {
	if r.Method != "POST" {
		http.Error(w, "Solo POST permitido", 405)
		return
	}

	var t Ticket
	if err := json.NewDecoder(r.Body).Decode(&t); err != nil {
		http.Error(w, "JSON invalido", 400)
		return
	}

	// 1. VALIDAR USUARIO (Puerto 3000)
	respUser, errUser := http.Get(fmt.Sprintf("http://127.0.0.1:3000/users/%d", t.UserID))
	if errUser != nil {
		http.Error(w, "ms-users no responde", 503)
		return
	}
	defer respUser.Body.Close()
	if respUser.StatusCode != 200 {
		http.Error(w, "Usuario no existe", 404)
		return
	}

	// 2. VALIDAR PELÍCULA (Puerto 8000)
	respMovie, errMovie := http.Get(fmt.Sprintf("http://127.0.0.1:8000/movies/%d", t.MovieID))
	if errMovie != nil {
		http.Error(w, "ms-movies no responde", 503)
		return
	}
	defer respMovie.Body.Close()
	if respMovie.StatusCode != 200 {
		http.Error(w, "Pelicula no existe", 404)
		return
	}

	// 3. GUARDAR TICKET EN DB
	stmt, err := db.Prepare("INSERT INTO tickets(user_id, movie_id, seat) VALUES(?, ?, ?)")
	if err != nil {
		log.Println("Error en Prepare:", err)
		http.Error(w, "Error interno de DB", 500)
		return
	}
	defer stmt.Close()

	res, err := stmt.Exec(t.UserID, t.MovieID, t.Seat)
	if err != nil {
		log.Println("Error en Exec (Insert):", err)
		http.Error(w, "No se pudo guardar el ticket: "+err.Error(), 500)
		return
	}

	id, _ := res.LastInsertId()
	t.ID = int(id)

	// Respuesta exitosa
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(t)
}
