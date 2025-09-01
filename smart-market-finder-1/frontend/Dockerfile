# Build static frontend and serve with a tiny Node static server
FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --prefer-offline --no-audit --progress=false
COPY . .
RUN npm run build

FROM node:18-alpine
WORKDIR /app
# tiny static server using serve (install globally)
RUN npm install -g serve@14.2.0
COPY --from=builder /app/build ./build
ENV PORT=3002
EXPOSE 3002
CMD ["serve","-s","build","-l","3002"]
