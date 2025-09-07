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
# install all deps (including dev deps for tsc). Try `npm ci` for reproducible installs, fall back to `npm install` when lockfile is missing.
RUN (npm ci --prefer-offline --no-audit --progress=false) || (npm install --no-audit --no-fund --progress=false)

# Copy source and build
COPY . .
RUN npm run build
# generate Prisma client in the builder so the generated client is available
RUN npx prisma generate || true

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
# Copy node_modules (including generated Prisma client) and built artifacts from builder
COPY --from=builder /app/node_modules ./node_modules
# copy built artifacts from builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/src/utils/psc.json ./dist/src/utils/psc.json

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000
CMD ["node", "dist/server.js"]
