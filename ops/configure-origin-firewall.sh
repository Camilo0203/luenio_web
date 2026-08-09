#!/usr/bin/env sh
set -eu

# Run on the VPS only after luenio.com is proxied by Cloudflare. Requiring a
# fixed administrator CIDR avoids accidentally exposing SSH or locking out the
# operator while replacing broad HTTP rules.
: "${ADMIN_IP_CIDR:?Set ADMIN_IP_CIDR to your trusted SSH IP/CIDR, for example 203.0.113.10/32}"
SSH_PORT="${SSH_PORT:-22}"

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this script as root." >&2
  exit 1
fi

command -v ufw >/dev/null 2>&1 || {
  echo "ufw is required." >&2
  exit 1
}

CLOUDFLARE_IPV4="
173.245.48.0/20
103.21.244.0/22
103.22.200.0/22
103.31.4.0/22
141.101.64.0/18
108.162.192.0/18
190.93.240.0/20
188.114.96.0/20
197.234.240.0/22
198.41.128.0/17
162.158.0.0/15
104.16.0.0/13
104.24.0.0/14
172.64.0.0/13
131.0.72.0/22
"

CLOUDFLARE_IPV6="
2400:cb00::/32
2606:4700::/32
2803:f800::/32
2405:b500::/32
2405:8100::/32
2a06:98c0::/29
2c0f:f248::/32
"

ufw default deny incoming
ufw default allow outgoing
ufw allow from "$ADMIN_IP_CIDR" to any port "$SSH_PORT" proto tcp comment 'Luenio trusted SSH'

for range in $CLOUDFLARE_IPV4 $CLOUDFLARE_IPV6; do
  ufw allow from "$range" to any port 80 proto tcp comment 'Cloudflare HTTP'
  ufw allow from "$range" to any port 443 proto tcp comment 'Cloudflare HTTPS'
done

# Remove broad rules commonly added during initial TLS setup. The Cloudflare
# ranges above remain before these explicit deny rules.
ufw --force delete allow 80/tcp >/dev/null 2>&1 || true
ufw --force delete allow 443/tcp >/dev/null 2>&1 || true
ufw deny 80/tcp comment 'Block direct origin HTTP'
ufw deny 443/tcp comment 'Block direct origin HTTPS'
ufw logging medium
ufw --force enable
ufw status verbose

echo "Origin firewall applied. Test the domain and direct origin from a different network."
