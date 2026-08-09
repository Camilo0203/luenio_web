#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-/opt/luenio}"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

for command_name in curl awk grep sort diff cat tr sed logger; do
  command -v "$command_name" >/dev/null 2>&1 || {
    echo "$command_name is required." >&2
    exit 1
  }
done

curl --silent --show-error --fail --proto '=https' --tlsv1.2 --max-time 20 \
  https://www.cloudflare.com/ips-v4 >"$TMP_DIR/ipv4"
curl --silent --show-error --fail --proto '=https' --tlsv1.2 --max-time 20 \
  https://www.cloudflare.com/ips-v6 >"$TMP_DIR/ipv6"
cat "$TMP_DIR/ipv4" "$TMP_DIR/ipv6" | tr ' ' '\n' | sed '/^$/d' | sort -u >"$TMP_DIR/official"

awk '/trusted_proxies static/ { for (field = 3; field <= NF; field += 1) print $field }' \
  "$PROJECT_DIR/Caddyfile" | sort -u >"$TMP_DIR/caddy"

awk '
  /^CLOUDFLARE_IPV4="/ { capture = 1; next }
  /^CLOUDFLARE_IPV6="/ { capture = 1; next }
  capture && /^"$/ { capture = 0; next }
  capture && /\// { print }
' "$PROJECT_DIR/ops/configure-origin-firewall.sh" | sed '/^$/d' | sort -u >"$TMP_DIR/firewall"

for source_name in caddy firewall; do
  if ! diff -u "$TMP_DIR/official" "$TMP_DIR/$source_name"; then
    logger -t luenio-cloudflare-ranges "Cloudflare IP ranges differ in $source_name"
    echo "Cloudflare IP ranges changed. Review and update $source_name before applying firewall changes." >&2
    exit 1
  fi
done

logger -t luenio-cloudflare-ranges "Cloudflare IP ranges match the official lists"
