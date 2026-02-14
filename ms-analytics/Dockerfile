FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --only=production

COPY . .

EXPOSE 11000

ENV NODE_ENV=production
ENV PORT=11000

CMD ["node", "server.js"]
