#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/opt/luenio}"
DESTINATION="${BACKUP_DIR:-$PROJECT_DIR/backups}"
STAMP="$(date -u +%Y%m%d-%H%M%S)"
HELPER_IMAGE="${BACKUP_HELPER_IMAGE:-node:22.23.1-alpine3.24}"
: "${BACKUP_AGE_RECIPIENT:?Set BACKUP_AGE_RECIPIENT to an age public recipient}"
: "${RCLONE_REMOTE:?Set RCLONE_REMOTE, for example luenio-r2:production}"
: "${PRODUCTION_ENV_FILE:=/etc/luenio/production.env}"
: "${STAGING_ENV_FILE:=/etc/luenio/staging.env}"

for command_name in docker age rclone sha256sum; do
  command -v "$command_name" >/dev/null 2>&1 || {
    echo "$command_name is required for encrypted offsite backups." >&2
    exit 1
  }
done

mkdir -p "$DESTINATION"
chmod 700 "$DESTINATION"
cd "$PROJECT_DIR"

docker image inspect "$HELPER_IMAGE" >/dev/null 2>&1 || docker pull "$HELPER_IMAGE"

backup_volume() {
  service="$1"
  volume="$2"
  archive="$DESTINATION/$service-$STAMP.tar.gz.age"
  checksum="$archive.sha256"

  docker run --rm --read-only --security-opt no-new-privileges --cap-drop ALL \
    -v "$volume:/source:ro" "$HELPER_IMAGE" \
    tar czf - -C /source . | age --recipient "$BACKUP_AGE_RECIPIENT" --output "$archive"
  chmod 600 "$archive"
  sha256sum "$archive" >"$checksum"
  chmod 600 "$checksum"
}

production_compose=(docker compose -p luenio-production --env-file "$PRODUCTION_ENV_FILE" -f docker-compose.yml)
staging_compose=(docker compose -p luenio-staging --env-file "$STAGING_ENV_FILE" -f docker-compose.yml)

"${production_compose[@]}" stop n8n
"${staging_compose[@]}" stop n8n
restart_n8n() {
  "${production_compose[@]}" start n8n
  "${staging_compose[@]}" start n8n
}
trap restart_n8n EXIT INT TERM
backup_volume "n8n-production" "luenio-production_n8n_data"
backup_volume "n8n-staging" "luenio-staging_n8n_data"
restart_n8n
trap - EXIT INT TERM

# Caddy remains online. Its certificate state is recoverable and safe to copy
# live, while stopping it would create avoidable public downtime.
backup_volume "caddy" "luenio-edge_caddy_data"

for archive in "$DESTINATION"/*-"$STAMP".tar.gz.age; do
  checksum="$archive.sha256"
  rclone copyto "$archive" "$RCLONE_REMOTE/$(basename "$archive")" --checksum
  rclone copyto "$checksum" "$RCLONE_REMOTE/$(basename "$checksum")" --checksum
done

# Local encrypted cache is only a convenience; the authoritative recovery
# copy is the encrypted offsite object verified above.
find "$DESTINATION" -type f \( -name '*.age' -o -name '*.sha256' \) -mtime +30 -delete
rclone delete "$RCLONE_REMOTE" --min-age 30d --include '*.age' --include '*.sha256'

echo "Encrypted offsite backup completed: $STAMP"
