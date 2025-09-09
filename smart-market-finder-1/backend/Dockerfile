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
# Copy backend package.json and install dependencies for backend build
COPY backend/package.json backend/package-lock.json* ./
RUN (npm ci --prefer-offline --no-audit --progress=false) || (npm install --no-audit --no-fund --progress=false)

# Copy backend source into image
COPY backend/ ./
# Copy frontend for later building into /app/frontend
COPY frontend/ ./frontend/
RUN npm run build
# generate Prisma client in the builder so the generated client is available
RUN npx prisma generate || true

# Build frontend inside the builder so final image can serve static files
WORKDIR /app/frontend
RUN if [ -f package.json ]; then npm install --no-audit --no-fund --progress=false && npm run build; fi
WORKDIR /app

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
# copy frontend build into final image at /frontend/build so server can serve it
COPY --from=builder /app/frontend/build /frontend/build
# copy prisma schema/migrations so runtime can run migrations
COPY --from=builder /app/prisma /app/prisma
# copy runtime scripts (indexer, importers) into image
COPY --from=builder /app/scripts /app/scripts

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000
# Use start script which runs prisma generate/migrate then starts the server
COPY backend/start.sh /app/start.sh
RUN chmod +x /app/start.sh || true
CMD ["sh", "/app/start.sh"]
