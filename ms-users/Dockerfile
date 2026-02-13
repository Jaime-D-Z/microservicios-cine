# Usamos una imagen ligera de Node
FROM node:18-slim

# Creamos la carpeta de trabajo dentro del contenedor
WORKDIR /app

# Copiamos los archivos de dependencias
COPY package*.json ./
RUN npm install

# Copiamos el resto del código
COPY . .

# Exponemos el puerto que usa Express
EXPOSE 3000

# Comando para arrancar
CMD ["node", "app.js"]