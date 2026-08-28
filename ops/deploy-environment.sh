#!/usr/bin/env bash
set -euo pipefail

ENVIRONMENT="${1:-}"
ENV_FILE="${2:-}"
PROJECT_DIR="${PROJECT_DIR:-/opt/luenio}"

if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
  echo "Usage: $0 <staging|production> </absolute/env-file>" >&2
  exit 1
fi
[[ "$ENV_FILE" = /* && -f "$ENV_FILE" ]] || {
  echo "Environment file must be an existing absolute path." >&2
  exit 1
}
[[ "$#" -eq 2 ]] || {
  echo "Images are built by CI only; this command accepts exactly two arguments." >&2
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
[[ "$LUENIO_IMAGE" =~ ^ghcr\.io/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$ ]] || {
  echo "LUENIO_IMAGE must be an immutable lowercase GHCR reference with an sha256 digest." >&2
  exit 1
}

node scripts/production-preflight.mjs --env-file "$ENV_FILE"

docker network inspect "$EDGE_NETWORK" >/dev/null 2>&1 ||
  docker network create "$EDGE_NETWORK" >/dev/null

compose=(docker compose -p "luenio-$ENVIRONMENT" --env-file "$ENV_FILE" -f docker-compose.yml)
"${compose[@]}" config --quiet

docker pull "$LUENIO_IMAGE"
docker image inspect "$LUENIO_IMAGE" >/dev/null

container_name="luenio-$ENVIRONMENT-app-1"
previous_image="$(docker inspect --format '{{.Config.Image}}' "$container_name" 2>/dev/null || true)"

"${compose[@]}" up -d --remove-orphans
"${compose[@]}" ps

wait_for_remote_health() {
  local attempts="${1:-12}"
  local delay_seconds="${2:-5}"
  local attempt
  for ((attempt = 1; attempt <= attempts; attempt += 1)); do
    if node scripts/production-preflight.mjs --env-file "$ENV_FILE" --remote; then
      return 0
    fi
    if ((attempt < attempts)); then
      sleep "$delay_seconds"
    fi
  done
  return 1
}

if ! wait_for_remote_health 12 5; then
  echo "Post-deploy health failed." >&2
  if [[ "$previous_image" =~ ^ghcr\.io/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$ ]]; then
    echo "Rolling back to the previously running immutable image." >&2
    LUENIO_IMAGE="$previous_image" "${compose[@]}" up -d --remove-orphans app
    LUENIO_IMAGE="$previous_image" "${compose[@]}" ps
    if ! LUENIO_IMAGE="$previous_image" wait_for_remote_health 12 5; then
      echo "Rollback image did not recover authenticated health." >&2
      exit 2
    fi
    echo "Rollback verified healthy at $previous_image." >&2
  else
    echo "No previous digest-qualified image was available for automatic rollback." >&2
  fi
  exit 1
fi

echo "Deployment verified: $ENVIRONMENT uses $LUENIO_IMAGE"
