# Imagen oficial de Python
FROM python:3.9-slim

WORKDIR /app

# Copiamos los requerimientos e instalamos
COPY main.py .
RUN pip install fastapi uvicorn

# Exponemos el puerto de FastAPI
EXPOSE 8000

# Comando para arrancar
CMD ["python", "main.py"]