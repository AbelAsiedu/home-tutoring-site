FROM node:22-bookworm-slim

WORKDIR /app
RUN mkdir -p /data

COPY package*.json ./
RUN npm ci

COPY frontend/package*.json ./frontend/
RUN cd frontend && npm install --no-audit --no-fund

COPY . .
RUN cd frontend && npm run build

ENV NODE_ENV=production
ENV PORT=3001
ENV DATABASE_PATH=/data/data.db

EXPOSE 3001

CMD ["npm", "start"]
