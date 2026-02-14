# Diagrama de Arquitectura del Sistema

## Flujo de Comunicación

```mermaid
graph TB
    subgraph "Cliente"
        Client[Usuario/Frontend]
    end

    subgraph "Load Balancer"
        Nginx[Nginx :80]
    end

    subgraph "API Layer"
        Gateway[API Gateway :8080<br/>JWT + Circuit Breaker]
    end

    subgraph "Microservicios Core"
        Users[ms-users :3000<br/>Node.js + PostgreSQL]
        Movies[ms-movies :8000<br/>Python + MongoDB]
        Tickets[ms-tickets :5000<br/>Go + SQLite]
        Showtimes[ms-showtimes :4000<br/>Python + PostgreSQL]
    end

    subgraph "Microservicios Negocio"
        Payments[ms-payments :6000<br/>Node.js + PostgreSQL]
        Notifications[ms-notifications :7000<br/>Node.js + SMTP]
        Reviews[ms-reviews :9000<br/>Go + MongoDB]
        Loyalty[ms-loyalty :10000<br/>Python + PostgreSQL]
        Analytics[ms-analytics :11000<br/>Node.js + PostgreSQL]
    end

    subgraph "Bases de Datos"
        PG[(PostgreSQL :5433)]
        Mongo[(MongoDB :27017)]
        Redis[(Redis :6379)]
    end

    subgraph "Messaging"
        RabbitMQ[RabbitMQ :5672]
    end

    Client --> Nginx
    Nginx --> Gateway
    
    Gateway --> Users
    Gateway --> Movies
    Gateway --> Tickets
    Gateway --> Showtimes
    Gateway --> Payments
    Gateway --> Notifications
    Gateway --> Reviews
    Gateway --> Loyalty
    Gateway --> Analytics

    Users --> PG
    Showtimes --> PG
    Payments --> PG
    Loyalty --> PG
    Analytics --> PG

    Movies --> Mongo
    Movies --> Redis
    Reviews --> Mongo

    Tickets --> Showtimes
    Tickets --> Users
    Tickets --> Notifications
    
    Payments --> Notifications
    Loyalty --> Users
    Loyalty --> Notifications

    Tickets --> RabbitMQ
    Payments --> RabbitMQ
    RabbitMQ --> Notifications

    style Gateway fill:#e1f5ff
    style Nginx fill:#ffe1e1
    style PG fill:#e8f5e9
    style Mongo fill:#e8f5e9
    style Redis fill:#e8f5e9
    style RabbitMQ fill:#fff3e0
```

## Flujo de Compra de Ticket

```mermaid
sequenceDiagram
    participant U as Usuario
    participant G as API Gateway
    participant T as ms-tickets
    participant S as ms-showtimes
    participant US as ms-users
    participant P as ms-payments
    participant N as ms-notifications
    participant L as ms-loyalty
    participant A as ms-analytics

    U->>G: POST /tickets/buy-ticket
    G->>G: Validar JWT
    G->>T: Procesar compra
    
    T->>US: GET /users/:id
    US-->>T: Usuario válido
    
    T->>S: GET /showtimes/:id
    S-->>T: Función válida
    
    T->>T: Verificar asiento disponible
    T->>T: Guardar ticket (UNIQUE constraint)
    
    T->>N: Enviar evento ticket.purchased
    T-->>G: Ticket creado
    G-->>U: Respuesta exitosa

    U->>G: POST /payments
    G->>P: Procesar pago
    P->>P: Simular Stripe
    P->>N: Enviar evento payment.completed
    P-->>U: Pago exitoso

    N->>US: GET /users/:id (obtener email)
    N->>N: Enviar email confirmación
    
    L->>L: Calcular puntos
    L->>US: POST /users/:id/points
    L->>N: Enviar evento points.added
    
    A->>A: Registrar métricas
```

## Tecnologías por Capa

```mermaid
graph LR
    subgraph "Frontend"
        FE[React/Vue<br/>En desarrollo]
    end

    subgraph "Gateway/Proxy"
        NG[Nginx]
        GW[API Gateway<br/>Express.js]
    end

    subgraph "Backend Services"
        N1[Node.js<br/>Express]
        P1[Python<br/>Flask/FastAPI]
        G1[Go<br/>Stdlib]
    end

    subgraph "Databases"
        SQL[PostgreSQL<br/>Relacional]
        DOC[MongoDB<br/>Documentos]
        KV[Redis<br/>Cache]
        F[SQLite<br/>Archivos]
    end

    subgraph "Infrastructure"
        D[Docker<br/>Containers]
        DC[Docker Compose<br/>Orchestration]
        MQ[RabbitMQ<br/>Messaging]
    end

    FE --> NG
    NG --> GW
    GW --> N1
    GW --> P1
    GW --> G1
    
    N1 --> SQL
    P1 --> SQL
    P1 --> DOC
    G1 --> F
    G1 --> DOC
    N1 --> KV

    N1 --> MQ
    P1 --> MQ
    MQ --> N1

    style FE fill:#61dafb
    style NG fill:#009639
    style GW fill:#68a063
    style N1 fill:#68a063
    style P1 fill:#3776ab
    style G1 fill:#00add8
    style SQL fill:#336791
    style DOC fill:#47a248
    style KV fill:#dc382d
    style D fill:#2496ed
    style MQ fill:#ff6600
```

## Base de Datos: Esquema Relacional

```mermaid
erDiagram
    USERS ||--o{ TICKETS : compra
    USERS ||--o{ MEMBERSHIPS : tiene
    USERS ||--o{ PAYMENTS : realiza
    USERS ||--o{ REVIEWS : escribe
    
    SHOWTIMES ||--o{ TICKETS : contiene
    SHOWTIMES }o--|| THEATERS : en
    
    TICKETS ||--|| PAYMENTS : pagado_con
    
    MEMBERSHIPS ||--o{ POINTS_TRANSACTIONS : genera
    MEMBERSHIPS ||--o{ REDEMPTIONS : canjea
    
    REWARDS ||--o{ REDEMPTIONS : canjeado_en

    USERS {
        int id PK
        string name
        string email UK
        string password
        string subscription
        int points
        timestamp created_at
    }

    THEATERS {
        int id PK
        string name
        int total_seats
        array rows
        int seats_per_row
    }

    SHOWTIMES {
        int id PK
        int movie_id FK
        int theater_id FK
        timestamp start_time
        float price
    }

    TICKETS {
        int id PK
        int user_id FK
        int showtime_id FK
        string seat UK
        string status
        float price
    }

    PAYMENTS {
        int id PK
        int user_id FK
        int ticket_id FK
        float amount
        string status
        string stripe_id
    }

    MEMBERSHIPS {
        int id PK
        int user_id FK UK
        string tier
        int points
        int lifetime_points
    }

    REWARDS {
        int id PK
        string name
        int points_required
        string reward_type
    }
```

Este diagrama muestra la arquitectura completa del sistema, incluyendo:
1. Flujo de comunicación entre servicios
2. Flujo secuencial de compra de tickets
3. Stack tecnológico por capas
4. Esquema de base de datos relacional
