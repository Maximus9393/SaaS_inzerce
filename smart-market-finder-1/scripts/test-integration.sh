#!/usr/bin/env bash
set -euo pipefail

# test-integration.sh
# Usage: run from anywhere. It will cd into the project root, bring up the compose stack,
# wait for the backend to be reachable on port 3000, run backend integration tests, then tear down.

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
COMPOSE_FILE="$ROOT_DIR/docker-compose.backend.yml"

echo "[integration] root: $ROOT_DIR"
echo "[integration] compose: $COMPOSE_FILE"

echo "[integration] starting docker-compose stack..."
(cd "$ROOT_DIR" && docker compose -f "$COMPOSE_FILE" up -d --build)

echo "[integration] waiting for backend on http://localhost:3000 ..."
WAITED=0
MAX_WAIT=120
while [ $WAITED -lt $MAX_WAIT ]; do
  if curl -sS http://localhost:3000/ >/dev/null 2>&1; then
    echo "[integration] backend is responding"
    break
  fi
  sleep 2
  WAITED=$((WAITED+2))
done

if [ $WAITED -ge $MAX_WAIT ]; then
  echo "[integration] timeout waiting for backend; dumping logs"
  (cd "$ROOT_DIR" && docker compose -f "$COMPOSE_FILE" logs --tail=200)
  (cd "$ROOT_DIR" && docker compose -f "$COMPOSE_FILE" down --volumes)
  exit 2
fi

echo "[integration] running backend tests"
cd "$ROOT_DIR/backend"
npm ci --prefer-offline --no-audit || true
npm test -- -i
RESULT=$?

echo "[integration] tearing down stack"
cd "$ROOT_DIR" && docker compose -f "$COMPOSE_FILE" down --volumes

exit $RESULT
