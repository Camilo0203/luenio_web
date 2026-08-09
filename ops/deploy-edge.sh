#!/usr/bin/env bash
set -euo pipefail

EDGE_ENV_FILE="${1:-}"
PROJECT_DIR="${PROJECT_DIR:-/opt/luenio}"

[[ "$EDGE_ENV_FILE" = /* && -f "$EDGE_ENV_FILE" ]] || {
  echo "Usage: $0 </absolute/edge-env-file>" >&2
  exit 1
}

cd "$PROJECT_DIR"
node scripts/edge-preflight.mjs "$EDGE_ENV_FILE"
docker network inspect luenio-production-edge >/dev/null 2>&1 ||
  docker network create luenio-production-edge >/dev/null
docker network inspect luenio-staging-edge >/dev/null 2>&1 ||
  docker network create luenio-staging-edge >/dev/null

export EDGE_ENV_FILE
docker compose -p luenio-edge --env-file "$EDGE_ENV_FILE" -f ops/edge-compose.yml config --quiet
docker compose -p luenio-edge --env-file "$EDGE_ENV_FILE" -f ops/edge-compose.yml up -d
docker compose -p luenio-edge --env-file "$EDGE_ENV_FILE" -f ops/edge-compose.yml ps
