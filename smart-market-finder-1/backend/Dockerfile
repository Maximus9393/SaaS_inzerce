# Multi-stage Dockerfile for backend (Node + TypeScript)
FROM node:18-bullseye-slim AS builder

# Install apt deps needed by puppeteer (Chromium)
RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates \
  fonts-liberation \
  libnss3 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libx11-xcb1 \
  libxcomposite1 \
  libxrandr2 \
  libgbm1 \
  libasound2 \
  libxss1 \
  libxshmfence1 \
  libpangocairo-1.0-0 \
  wget \
  gnupg2 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY package.json package-lock.json* ./
# install all deps (including dev deps for tsc)
RUN npm ci --prefer-offline --no-audit --progress=false

# Copy source and build
COPY . .
RUN npm run build

# Production image
FROM node:18-bullseye-slim

# runtime deps for puppeteer
RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates \
  fonts-liberation \
  libnss3 \
  libatk1.0-0 \
  libatk-bridge2.0-0 \
  libcups2 \
  libx11-xcb1 \
  libxcomposite1 \
  libxrandr2 \
  libgbm1 \
  libasound2 \
  libxss1 \
  libxshmfence1 \
  libpangocairo-1.0-0 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
# copy package.json and install only production deps
COPY package.json package-lock.json* ./
RUN npm ci --production --prefer-offline --no-audit --progress=false

# copy built artifacts from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/utils/psc.json ./dist/src/utils/psc.json

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000
CMD ["node", "dist/server.js"]
