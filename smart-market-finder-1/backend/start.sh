#!/usr/bin/env sh
set -e

echo "[start.sh] container startup: begin"

# Path to prisma schema inside the image
SCHEMA_PATH="/app/prisma/schema.prisma"

# Generate Prisma client (safe even without DB)
if [ -f "$SCHEMA_PATH" ]; then
  echo "[start.sh] found prisma schema at $SCHEMA_PATH"
  echo "[start.sh] running: npx prisma generate --schema=$SCHEMA_PATH"
  npx prisma generate --schema="$SCHEMA_PATH" || echo "[start.sh] prisma generate failed (continuing)"
else
  echo "[start.sh] prisma schema not found at $SCHEMA_PATH, running default npx prisma generate"
  npx prisma generate || echo "[start.sh] prisma generate failed (continuing)"
fi

# If DATABASE_URL is set, attempt to run migrations with retries (useful when DB isn't immediately ready)
if [ -n "$DATABASE_URL" ]; then
  echo "[start.sh] DATABASE_URL detected — attempting prisma migrate deploy with retries"
  MAX_RETRIES=12
  SLEEP_SECS=5
  i=0
  until [ "$i" -ge "$MAX_RETRIES" ]; do
    if [ -f "$SCHEMA_PATH" ]; then
      if npx prisma migrate deploy --schema="$SCHEMA_PATH"; then
        echo "[start.sh] prisma migrate deploy succeeded"
        break
      fi
    else
      if npx prisma migrate deploy; then
        echo "[start.sh] prisma migrate deploy succeeded"
        break
      fi
    fi
    i=$((i+1))
    echo "[start.sh] prisma migrate deploy failed — retry $i/$MAX_RETRIES after ${SLEEP_SECS}s"
    sleep "$SLEEP_SECS"
  done
  if [ "$i" -ge "$MAX_RETRIES" ]; then
    echo "[start.sh] prisma migrate deploy did not succeed after $MAX_RETRIES attempts — continuing anyway"
  fi
else
  echo "[start.sh] DATABASE_URL not set — skipping migration"
fi

echo "[start.sh] starting node server: node dist/server.js"
# start optional background workers
if [ -f /app/dist/worker/persistWorker.js ]; then
  echo "[start.sh] starting persistWorker in background"
  nohup node /app/dist/worker/persistWorker.js > /var/log/persistWorker.log 2>&1 &
fi

if [ -n "$MEILI_HOST" ] && [ -f /app/scripts/meili_sync_loop.js ]; then
  echo "[start.sh] MEILI_HOST detected — starting meili sync loop in background"
  nohup node /app/scripts/meili_sync_loop.js > /var/log/meili_sync_loop.log 2>&1 &
fi

# start main server
exec node dist/server.js
