// ms-reviews/main.go
package main

import (
	"context"
	"encoding/json"
	"log"
	"net/http"
	"os"
	"strconv"
	"time"

	"github.com/joho/godotenv"
	"go.mongodb.org/mongo-driver/bson"
	"go.mongodb.org/mongo-driver/bson/primitive"
	"go.mongodb.org/mongo-driver/mongo"
	"go.mongodb.org/mongo-driver/mongo/options"
)

type Review struct {
	ID        primitive.ObjectID `json:"id" bson:"_id,omitempty"`
	UserID    int                `json:"user_id" bson:"user_id"`
	MovieID   int                `json:"movie_id" bson:"movie_id"`
	Rating    float64            `json:"rating" bson:"rating"`
	Comment   string             `json:"comment" bson:"comment"`
	CreatedAt time.Time          `json:"created_at" bson:"created_at"`
}

type MovieRatingStats struct {
	MovieID       int     `json:"movie_id"`
	AverageRating float64 `json:"average_rating"`
	TotalReviews  int     `json:"total_reviews"`
}

var collection *mongo.Collection

func main() {
	// Cargar variables de entorno
	godotenv.Load()

	// Conectar a MongoDB
	mongoURI := getEnv("MONGO_URI", "mongodb://localhost:27017")
	clientOptions := options.Client().ApplyURI(mongoURI)

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	client, err := mongo.Connect(ctx, clientOptions)
	if err != nil {
		log.Fatal("Error conectando a MongoDB:", err)
	}

	// Verificar conexión
	err = client.Ping(ctx, nil)
	if err != nil {
		log.Fatal("No se pudo conectar a MongoDB:", err)
	}

	log.Println("[ms-reviews] Conectado a MongoDB")

	// Obtener colección
	dbName := getEnv("MONGO_DB", "cine_db")
	collection = client.Database(dbName).Collection("reviews")

	// Crear índices
	indexModel := mongo.IndexModel{
		Keys: bson.D{
			{Key: "movie_id", Value: 1},
			{Key: "user_id", Value: 1},
		},
	}
	_, err = collection.Indexes().CreateOne(ctx, indexModel)
	if err != nil {
		log.Println("Advertencia: no se pudo crear índice:", err)
	}

	// Rutas
	http.HandleFunc("/reviews", handleReviews)
	http.HandleFunc("/reviews/movie/", getReviewsByMovie)
	http.HandleFunc("/reviews/user/", getReviewsByUser)
	http.HandleFunc("/reviews/stats/", getMovieStats)
	http.HandleFunc("/health", healthCheck)

	port := getEnv("PORT", "9000")
	log.Printf("[ms-reviews] Escuchando en puerto %s", port)
	log.Fatal(http.ListenAndServe(":"+port, nil))
}

// ========================================
// 📝 CREAR / LISTAR REVIEWS
// ========================================
func handleReviews(w http.ResponseWriter, r *http.Request) {
	switch r.Method {
	case "POST":
		createReview(w, r)
	case "GET":
		getAllReviews(w, r)
	default:
		http.Error(w, "Método no permitido", 405)
	}
}

func createReview(w http.ResponseWriter, r *http.Request) {
	var review Review
	if err := json.NewDecoder(r.Body).Decode(&review); err != nil {
		http.Error(w, "JSON inválido", 400)
		return
	}

	// Validaciones
	if review.UserID == 0 || review.MovieID == 0 || review.Rating == 0 {
		http.Error(w, "Faltan campos requeridos", 400)
		return
	}

	if review.Rating < 1 || review.Rating > 5 {
		http.Error(w, "El rating debe estar entre 1 y 5", 400)
		return
	}

	review.CreatedAt = time.Now()

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	result, err := collection.InsertOne(ctx, review)
	if err != nil {
		log.Println("Error insertando review:", err)
		http.Error(w, "Error al guardar review", 500)
		return
	}

	review.ID = result.InsertedID.(primitive.ObjectID)

	log.Printf("Review creada: ID=%s, Movie=%d, Rating=%.1f", review.ID.Hex(), review.MovieID, review.Rating)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(201)
	json.NewEncoder(w).Encode(map[string]interface{}{
		"message": "Review creada exitosamente",
		"review":  review,
	})
}

func getAllReviews(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	cursor, err := collection.Find(ctx, bson.M{})
	if err != nil {
		log.Println("Error obteniendo reviews:", err)
		http.Error(w, "Error al obtener reviews", 500)
		return
	}
	defer cursor.Close(ctx)

	var reviews []Review
	if err = cursor.All(ctx, &reviews); err != nil {
		log.Println("Error decodificando reviews:", err)
		http.Error(w, "Error al decodificar reviews", 500)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(reviews)
}

// ========================================
// 🎬 REVIEWS POR PELÍCULA
// ========================================
func getReviewsByMovie(w http.ResponseWriter, r *http.Request) {
	movieIDStr := r.URL.Path[len("/reviews/movie/"):]
	movieID, err := strconv.Atoi(movieIDStr)
	if err != nil {
		http.Error(w, "ID de película inválido", 400)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	filter := bson.M{"movie_id": movieID}
	cursor, err := collection.Find(ctx, filter)
	if err != nil {
		log.Println("Error obteniendo reviews:", err)
		http.Error(w, "Error al obtener reviews", 500)
		return
	}
	defer cursor.Close(ctx)

	var reviews []Review
	if err = cursor.All(ctx, &reviews); err != nil {
		log.Println("Error decodificando reviews:", err)
		http.Error(w, "Error al decodificar reviews", 500)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(reviews)
}

// ========================================
// 👤 REVIEWS POR USUARIO
// ========================================
func getReviewsByUser(w http.ResponseWriter, r *http.Request) {
	userIDStr := r.URL.Path[len("/reviews/user/"):]
	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		http.Error(w, "ID de usuario inválido", 400)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	filter := bson.M{"user_id": userID}
	cursor, err := collection.Find(ctx, filter)
	if err != nil {
		log.Println("Error obteniendo reviews:", err)
		http.Error(w, "Error al obtener reviews", 500)
		return
	}
	defer cursor.Close(ctx)

	var reviews []Review
	if err = cursor.All(ctx, &reviews); err != nil {
		log.Println("Error decodificando reviews:", err)
		http.Error(w, "Error al decodificar reviews", 500)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(reviews)
}

// ========================================
// 📊 ESTADÍSTICAS DE PELÍCULA
// ========================================
func getMovieStats(w http.ResponseWriter, r *http.Request) {
	movieIDStr := r.URL.Path[len("/reviews/stats/"):]
	movieID, err := strconv.Atoi(movieIDStr)
	if err != nil {
		http.Error(w, "ID de película inválido", 400)
		return
	}

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()

	// Usar agregación para calcular promedio
	pipeline := mongo.Pipeline{
		{{Key: "$match", Value: bson.D{{Key: "movie_id", Value: movieID}}}},
		{{Key: "$group", Value: bson.D{
			{Key: "_id", Value: "$movie_id"},
			{Key: "avgRating", Value: bson.D{{Key: "$avg", Value: "$rating"}}},
			{Key: "count", Value: bson.D{{Key: "$sum", Value: 1}}},
		}}},
	}

	cursor, err := collection.Aggregate(ctx, pipeline)
	if err != nil {
		log.Println("Error en agregación:", err)
		http.Error(w, "Error al calcular estadísticas", 500)
		return
	}
	defer cursor.Close(ctx)

	var results []bson.M
	if err = cursor.All(ctx, &results); err != nil {
		log.Println("Error decodificando resultados:", err)
		http.Error(w, "Error al decodificar estadísticas", 500)
		return
	}

	if len(results) == 0 {
		stats := MovieRatingStats{
			MovieID:       movieID,
			AverageRating: 0,
			TotalReviews:  0,
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(stats)
		return
	}

	result := results[0]
	stats := MovieRatingStats{
		MovieID:       movieID,
		AverageRating: result["avgRating"].(float64),
		TotalReviews:  int(result["count"].(int32)),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

// ========================================
// 🏥 HEALTH CHECK
// ========================================
func healthCheck(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	err := collection.Database().Client().Ping(ctx, nil)
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
		"service":   "ms-reviews",
		"database":  dbStatus,
		"timestamp": time.Now(),
	})
}

// ========================================
// 🛠️ HELPER
// ========================================
func getEnv(key, defaultValue string) string {
	value := os.Getenv(key)
	if value == "" {
		return defaultValue
	}
	return value
}
