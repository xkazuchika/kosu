FROM node:22-slim AS base

ENV KOSU_DATA_DIR=/data

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci --include=dev

COPY . .
RUN npm run build

ENV NODE_ENV=production

RUN mkdir -p /data

EXPOSE 3000

CMD ["sh", "-c", "npm run db:migrate && npm run start"]
