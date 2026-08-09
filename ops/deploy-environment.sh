#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="${1:-}"
ENV_FILE="${2:-}"
MODE="${3:---no-build}"
PROJECT_DIR="${PROJECT_DIR:-/opt/luenio}"

if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
  echo "Usage: $0 <staging|production> </absolute/env-file> [--build|--no-build]" >&2
  exit 1
fi
[[ "$ENV_FILE" = /* && -f "$ENV_FILE" ]] || {
  echo "Environment file must be an existing absolute path." >&2
  exit 1
}
[[ "$MODE" == "--build" || "$MODE" == "--no-build" ]] || {
  echo "Third argument must be --build or --no-build." >&2
  exit 1
}

cd "$PROJECT_DIR"
set -a
# shellcheck disable=SC1090
. "$ENV_FILE"
set +a

: "${EDGE_NETWORK:?EDGE_NETWORK is required}"
: "${LUENIO_IMAGE:?LUENIO_IMAGE is required}"
: "${LUENIO_ENV_FILE:?LUENIO_ENV_FILE is required}"
: "${APP_EDGE_ALIAS:?APP_EDGE_ALIAS is required}"
: "${N8N_EDGE_ALIAS:?N8N_EDGE_ALIAS is required}"
[[ "$LUENIO_ENV_FILE" == "$ENV_FILE" ]] || {
  echo "LUENIO_ENV_FILE must equal the env path passed to this script." >&2
  exit 1
}
[[ "$EDGE_NETWORK" == "luenio-$ENVIRONMENT-edge" ]] || {
  echo "EDGE_NETWORK must be luenio-$ENVIRONMENT-edge." >&2
  exit 1
}
[[ "$APP_EDGE_ALIAS" == "app-$ENVIRONMENT" ]] || {
  echo "APP_EDGE_ALIAS must be app-$ENVIRONMENT." >&2
  exit 1
}
[[ "$N8N_EDGE_ALIAS" == "n8n-$ENVIRONMENT" ]] || {
  echo "N8N_EDGE_ALIAS must be n8n-$ENVIRONMENT." >&2
  exit 1
}

node scripts/production-preflight.mjs

docker network inspect "$EDGE_NETWORK" >/dev/null 2>&1 ||
  docker network create "$EDGE_NETWORK" >/dev/null

compose=(docker compose -p "luenio-$ENVIRONMENT" --env-file "$ENV_FILE" -f docker-compose.yml)
"${compose[@]}" config --quiet

if [[ "$MODE" == "--build" ]]; then
  "${compose[@]}" build app
else
  docker image inspect "$LUENIO_IMAGE" >/dev/null 2>&1 || {
    echo "Image $LUENIO_IMAGE is not present; build and validate it in staging first." >&2
    exit 1
  }
fi

"${compose[@]}" up -d --remove-orphans
"${compose[@]}" ps
