#!/usr/bin/env sh
set -e

echo "[start.sh] container startup: begin"

# Generate Prisma client (safe even without DB)
SCHEMA_PATH="/app/prisma/schema.prisma"
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
      echo "[start.sh] prisma migrate deploy succeeded"
      break
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
exec node dist/server.js
#!/usr/bin/env sh
set -e

# Small startup script to ensure Prisma client is generated and migrations applied (if DATABASE_URL present).
# It retries a few times to allow dependent services (DB) to be up when running in render/docker.

MAX_RETRIES=6
SLEEP=5

echo "Generating Prisma client..."
# generate client (no failure if not needed)
npx prisma generate || true

if [ -n "$DATABASE_URL" ]; then
  echo "DATABASE_URL detected, attempting prisma migrate..."
  i=0
  until [ $i -ge $MAX_RETRIES ]
  do
    if npx prisma migrate deploy; then
      echo "Prisma migrate deploy succeeded"
      break
    fi
    i=$((i+1))
    echo "Prisma migrate failed, retrying in $SLEEP seconds... ($i/$MAX_RETRIES)"
    sleep $SLEEP
  done
else
  echo "No DATABASE_URL provided; skipping prisma migrate"
fi

echo "Starting server..."
exec node dist/server.js
