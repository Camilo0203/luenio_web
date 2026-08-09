#!/usr/bin/env sh
set -eu

: "${APP_URL:=https://luenio.com}"
: "${ORIGIN_IP:?Set ORIGIN_IP to the VPS public IP}"

domain_status="$(curl --silent --show-error --max-time 15 --output /dev/null --write-out '%{http_code}' "$APP_URL")"
if [ "$domain_status" != "200" ]; then
  echo "Domain check failed with HTTP $domain_status." >&2
  exit 1
fi

hostname="$(printf '%s' "$APP_URL" | sed -E 's#^https?://([^/]+).*#\1#')"
if curl --silent --show-error --insecure --max-time 8 --resolve "$hostname:443:$ORIGIN_IP" "$APP_URL" >/dev/null 2>&1; then
  echo "Direct origin is still reachable. Do not launch until the provider firewall/UFW blocks it." >&2
  exit 1
fi

echo "Domain is available through the edge and direct-origin HTTPS is blocked."
