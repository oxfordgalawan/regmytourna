#!/usr/bin/env bash
# RegMyTourna StarPago relay — run on a fresh Ubuntu 24.04 droplet as root or sudo.
# Usage: sudo bash bootstrap-droplet.sh RELAY_FQDN ADMIN_EMAIL
# Prerequisite: /opt/starpago-relay/server.mjs and /opt/starpago-relay/.env (RELAY_SECRET set)

set -euo pipefail

RELAY_FQDN="${1:?Usage: bootstrap-droplet.sh FQDN admin@email.com}"
ADMIN_EMAIL="${2:?Usage: bootstrap-droplet.sh FQDN admin@email.com}"
RELAY_DIR="/opt/starpago-relay"

if [[ ! -f "$RELAY_DIR/server.mjs" ]]; then
  echo "Missing $RELAY_DIR/server.mjs — scp from repo first."
  exit 1
fi
if [[ ! -f "$RELAY_DIR/.env" ]]; then
  echo "Missing $RELAY_DIR/.env with RELAY_SECRET"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update
apt-get upgrade -y
apt-get install -y nginx certbot python3-certbot-nginx ufw curl

curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
apt-get install -y nodejs

ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

chmod 600 "$RELAY_DIR/.env"

cat > /etc/systemd/system/starpago-relay.service <<'UNIT'
[Unit]
Description=StarPago HTTPS relay (RegMyTourna)
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/starpago-relay
EnvironmentFile=/opt/starpago-relay/.env
ExecStart=/usr/bin/node /opt/starpago-relay/server.mjs
Restart=on-failure
RestartSec=5
User=nobody
Group=nogroup
NoNewPrivileges=true

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable --now starpago-relay

cat > "/etc/nginx/sites-available/starpago-relay" <<NGINX
server {
    listen 80;
    server_name ${RELAY_FQDN};

    location / {
        proxy_pass http://127.0.0.1:8787;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        client_max_body_size 2m;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/starpago-relay /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx

certbot --nginx -d "$RELAY_FQDN" --non-interactive --agree-tos -m "$ADMIN_EMAIL"

echo "Done. Verify: curl -sS https://${RELAY_FQDN}/health"
