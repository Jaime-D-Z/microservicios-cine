FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --only=production

COPY . .

EXPOSE 7000

ENV NODE_ENV=production
ENV PORT=7000

CMD ["node", "server.js"]
