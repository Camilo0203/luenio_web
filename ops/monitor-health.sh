#!/usr/bin/env sh
set -eu

APP_URL="${APP_URL:-https://staging.luenio.com}"
ALERT_WEBHOOK_URL="${ALERT_WEBHOOK_URL:-}"
: "${HEALTHCHECK_TOKEN:?Set HEALTHCHECK_TOKEN in the protected monitor environment file}"
BODY_FILE="$(mktemp)"
trap 'rm -f "$BODY_FILE"' EXIT

STATUS="$(curl --silent --show-error --max-time 12 --output "$BODY_FILE" --write-out '%{http_code}' \
  --header "Authorization: Bearer $HEALTHCHECK_TOKEN" "$APP_URL/api/health?details=1" || true)"
if [ "$STATUS" = "200" ] && \
  grep -q '"ok":true' "$BODY_FILE" && \
  grep -q '"criticalReady":true' "$BODY_FILE" && \
  grep -q '"mode":"supabase"' "$BODY_FILE" && \
  grep -q '"deliveryQueue":{"healthy":true' "$BODY_FILE"; then
  exit 0
fi

MESSAGE="Luenio protected health check failed for $APP_URL (HTTP $STATUS)"
logger -t luenio-health "$MESSAGE"
if [ -n "$ALERT_WEBHOOK_URL" ]; then
  curl --silent --show-error --max-time 10 --request POST \
    --header 'Content-Type: application/json' \
    --data "{\"text\":\"$MESSAGE\"}" "$ALERT_WEBHOOK_URL" >/dev/null || true
fi
exit 1
