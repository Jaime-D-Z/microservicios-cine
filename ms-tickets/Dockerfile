FROM golang:1.21-alpine AS builder

WORKDIR /app

# Copiar go.mod y go.sum
COPY go.mod go.sum ./
RUN go mod download

# Copiar código fuente
COPY . .

# Compilar
RUN CGO_ENABLED=0 GOOS=linux go build -o main .

# Stage final
FROM alpine:latest

WORKDIR /app

# Instalar dependencias necesarias para SQLite
RUN apk --no-cache add ca-certificates libc6-compat

COPY --from=builder /app/main .

EXPOSE 5000

ENV PORT=5000

CMD ["./main"]
