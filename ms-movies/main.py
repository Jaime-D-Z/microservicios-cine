from fastapi import FastAPI, HTTPException, Depends
from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from pydantic import BaseModel, ConfigDict

# ------------------ CONFIGURACIÓN DB ------------------

SQLALCHEMY_DATABASE_URL = "mysql+pymysql://root:@localhost/cine_movies"


engine = create_engine(SQLALCHEMY_DATABASE_URL)

SessionLocal = sessionmaker(bind=engine)

Base = declarative_base()

# ------------------ MODELO DE LA TABLA ------------------

class MovieDB(Base):
    __tablename__ = "movies"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255))
    genre = Column(String(100))
    duration = Column(Integer)


# Crear tablas
Base.metadata.create_all(bind=engine)

# ------------------ ESQUEMAS PYDANTIC ------------------

class MovieCreate(BaseModel):
    title: str
    genre: str
    duration: int


class Movie(BaseModel):
    id: int
    title: str
    genre: str
    duration: int

    model_config = ConfigDict(from_attributes=True)

# ------------------ FASTAPI ------------------

app = FastAPI()

# Dependencia DB
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ------------------ ENDPOINTS ------------------

@app.get("/movies", response_model=list[Movie])
def list_movies(db: Session = Depends(get_db)):
    return db.query(MovieDB).all()


@app.post("/movies", response_model=Movie)
def create_movie(movie: MovieCreate, db: Session = Depends(get_db)):
    new_movie = MovieDB(**movie.model_dump())
    db.add(new_movie)
    db.commit()
    db.refresh(new_movie)
    return new_movie


@app.get("/movies/{movie_id}", response_model=Movie)
def get_movie(movie_id: int, db: Session = Depends(get_db)):
    movie = db.query(MovieDB).filter(MovieDB.id == movie_id).first()
    if not movie:
        raise HTTPException(status_code=404, detail="Película no encontrada")
    return movie
