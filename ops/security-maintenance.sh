#!/usr/bin/env sh
set -eu

: "${SUPABASE_URL:?Set SUPABASE_URL in the protected environment file}"
: "${SUPABASE_SERVICE_ROLE_KEY:?Set SUPABASE_SERVICE_ROLE_KEY in the protected environment file}"

case "$SUPABASE_URL" in
  https://*) ;;
  *)
    echo "SUPABASE_URL must use HTTPS" >&2
    exit 1
    ;;
esac

umask 077
CURL_CONFIG="$(mktemp)"
RESPONSE_FILE="$(mktemp)"
trap 'rm -f "$CURL_CONFIG" "$RESPONSE_FILE"' EXIT

cat >"$CURL_CONFIG" <<EOF
silent
show-error
fail-with-body
max-time = 30
request = "POST"
header = "apikey: $SUPABASE_SERVICE_ROLE_KEY"
header = "Authorization: Bearer $SUPABASE_SERVICE_ROLE_KEY"
header = "Content-Type: application/json"
data = "{}"
EOF

curl --config "$CURL_CONFIG" \
  --output "$RESPONSE_FILE" \
  "${SUPABASE_URL%/}/rest/v1/rpc/luenio_security_maintenance"

grep -q '"completedAt"' "$RESPONSE_FILE" || {
  echo "Supabase maintenance returned an unexpected response" >&2
  exit 1
}

logger -t luenio-security-maintenance "Expired security records were pruned successfully"
