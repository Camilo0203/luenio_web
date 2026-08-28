#!/usr/bin/env bash
set -euo pipefail

TARGET="${1:-}"
ARCHIVE="${2:-}"
AGE_IDENTITY_FILE="${AGE_IDENTITY_FILE:-}"
HELPER_IMAGE="${BACKUP_HELPER_IMAGE:-node:22.23.1-alpine3.24}"
PROJECT_DIR="${PROJECT_DIR:-/opt/luenio}"

case "$TARGET" in
  n8n-production)
    project="luenio-production"
    service="n8n"
    volume="luenio-production_n8n_data"
    env_file="${PRODUCTION_ENV_FILE:-/etc/luenio/production.env}"
    compose_file="$PROJECT_DIR/docker-compose.yml"
    ;;
  n8n-staging)
    project="luenio-staging"
    service="n8n"
    volume="luenio-staging_n8n_data"
    env_file="${STAGING_ENV_FILE:-/etc/luenio/staging.env}"
    compose_file="$PROJECT_DIR/docker-compose.yml"
    ;;
  caddy)
    project="luenio-edge"
    service="caddy"
    volume="luenio-edge_caddy_data"
    env_file="${EDGE_ENV_FILE:-/etc/luenio/edge.env}"
    compose_file="$PROJECT_DIR/ops/edge-compose.yml"
    ;;
  *)
    echo "Usage: $0 <n8n-production|n8n-staging|caddy> <archive.tar.gz.age>" >&2
    exit 1
    ;;
esac

[[ -f "$ARCHIVE" ]] || { echo "Archive not found: $ARCHIVE" >&2; exit 1; }
: "${AGE_IDENTITY_FILE:?Set AGE_IDENTITY_FILE to the offline age private-key file}"
[[ -f "$AGE_IDENTITY_FILE" ]] || { echo "Age identity file not found." >&2; exit 1; }

checksum_file="$ARCHIVE.sha256"
[[ -f "$checksum_file" ]] || { echo "Checksum file not found: $checksum_file" >&2; exit 1; }
(cd "$(dirname "$ARCHIVE")" && sha256sum --check "$(basename "$checksum_file")")

# Validate that the encrypted payload is a readable gzip tar and cannot escape
# the target volume before stopping any service or extracting any file.
if ! age --decrypt --identity "$AGE_IDENTITY_FILE" "$ARCHIVE" |
  tar tzf - |
  awk '
    /^\// { bad = 1 }
    { count = split($0, parts, "/"); for (i = 1; i <= count; i += 1) if (parts[i] == "..") bad = 1 }
    END { exit bad }
  '; then
  echo "Archive validation failed or contains an unsafe path; nothing was restored." >&2
  exit 1
fi

docker image inspect "$HELPER_IMAGE" >/dev/null 2>&1 || docker pull "$HELPER_IMAGE"
if ! docker run --rm --read-only --security-opt no-new-privileges --cap-drop ALL \
  -v "$volume:/target:ro" "$HELPER_IMAGE" sh -c 'test -z "$(ls -A /target)"'; then
  echo "Target volume $volume is not empty; refusing destructive restore." >&2
  exit 1
fi

compose=(docker compose -p "$project" --env-file "$env_file" -f "$compose_file")
container_id="$("${compose[@]}" ps -q "$service")"
was_running="false"
if [[ -n "$container_id" ]]; then
  was_running="$(docker inspect --format '{{.State.Running}}' "$container_id")"
fi
"${compose[@]}" stop "$service"

if ! age --decrypt --identity "$AGE_IDENTITY_FILE" "$ARCHIVE" |
  docker run --rm -i --read-only --security-opt no-new-privileges --cap-drop ALL \
    -v "$volume:/target" "$HELPER_IMAGE" tar xzf - -C /target; then
  echo "Restore failed. The service remains stopped and the target may be partial; inspect it before retrying." >&2
  exit 1
fi

if [[ "$was_running" == "true" ]]; then
  "${compose[@]}" start "$service"
fi

echo "Restored $TARGET from encrypted archive $ARCHIVE"
