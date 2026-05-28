#!/usr/bin/env bash
# One-shot deploy script for Web MCP Auditor on Ubuntu 22.04/24.04.
#
# Usage on a fresh VPS (as root):
#   curl -fsSL https://raw.githubusercontent.com/marko-fedorenko/web-mcp-auditor/main/scripts/deploy.sh \
#     | bash -s -- DOMAIN=audit.example.com EMAIL=you@example.com
#
# Or with no domain (HTTP only on the IP):
#   curl -fsSL https://raw.githubusercontent.com/marko-fedorenko/web-mcp-auditor/main/scripts/deploy.sh \
#     | bash -s --
#
# Re-runs are safe (idempotent): existing systemd unit is restarted, nginx config replaced.

set -euo pipefail

# -------- Parse args --------
DOMAIN=""
EMAIL=""
REPO="${REPO:-https://github.com/marko-fedorenko/web-mcp-auditor.git}"
APP_DIR="${APP_DIR:-/opt/web-mcp-auditor}"
PORT="${PORT:-3000}"
NODE_MAJOR="${NODE_MAJOR:-22}"

for arg in "$@"; do
  case $arg in
    DOMAIN=*) DOMAIN="${arg#DOMAIN=}" ;;
    EMAIL=*)  EMAIL="${arg#EMAIL=}" ;;
    PORT=*)   PORT="${arg#PORT=}" ;;
    APP_DIR=*) APP_DIR="${arg#APP_DIR=}" ;;
    REPO=*)   REPO="${arg#REPO=}" ;;
  esac
done

if [[ $EUID -ne 0 ]]; then
  echo "ERROR: Run as root (or via sudo). Currently: $(whoami)" >&2
  exit 1
fi

DOMAIN_LABEL="${DOMAIN:-(none, HTTP on IP)}"
EMAIL_LABEL="${EMAIL:-(skipping Lets Encrypt)}"

echo "============================================="
echo "  Web MCP Auditor - automated deploy"
echo "============================================="
echo "  Domain:  $DOMAIN_LABEL"
echo "  Email:   $EMAIL_LABEL"
echo "  Port:    $PORT"
echo "  Dir:     $APP_DIR"
echo "  Repo:    $REPO"
echo "============================================="
echo ""

# -------- 1. System packages --------
echo "==> [1/8] Installing system packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl ca-certificates gnupg git nginx ufw unzip \
  xvfb fonts-liberation \
  libnss3 libatk1.0-0 libatk-bridge2.0-0 libcups2 libdrm2 \
  libxkbcommon0 libxcomposite1 libxdamage1 libxfixes3 libxrandr2 \
  libgbm1 libpango-1.0-0 libcairo2 libasound2t64 2>/dev/null \
  || apt-get install -y -qq libasound2  # Ubuntu 22.04 has libasound2, 24.04 has libasound2t64

# Node.js from NodeSource
if ! command -v node >/dev/null 2>&1 || [[ "$(node --version | sed 's/v//' | cut -d. -f1)" -lt "$NODE_MAJOR" ]]; then
  echo "  -> Installing Node.js $NODE_MAJOR via NodeSource..."
  curl -fsSL "https://deb.nodesource.com/setup_${NODE_MAJOR}.x" | bash - >/dev/null
  apt-get install -y -qq nodejs
fi
echo "  OK node $(node --version), npm $(npm --version)"

# -------- 2. App user --------
APP_USER="webmcp"
if ! id "$APP_USER" >/dev/null 2>&1; then
  echo "==> [2/8] Creating system user '$APP_USER'..."
  useradd --system --create-home --shell /bin/bash --home-dir "/home/$APP_USER" "$APP_USER"
else
  echo "==> [2/8] User '$APP_USER' already exists, skipping."
fi

# -------- 3. Clone or update repo --------
echo "==> [3/8] Fetching source from $REPO..."
if [[ -d "$APP_DIR/.git" ]]; then
  echo "  -> Repo exists, updating..."
  sudo -u "$APP_USER" git -C "$APP_DIR" fetch --depth 1 origin main
  sudo -u "$APP_USER" git -C "$APP_DIR" reset --hard origin/main
else
  rm -rf "$APP_DIR"
  mkdir -p "$(dirname "$APP_DIR")"
  git clone --depth 1 "$REPO" "$APP_DIR"
  chown -R "$APP_USER:$APP_USER" "$APP_DIR"
fi

# -------- 4. npm install --------
echo "==> [4/8] Installing npm dependencies..."
cd "$APP_DIR"
# PUPPETEER_SKIP_DOWNLOAD=1 prevents puppeteer's postinstall from downloading its
# bundled chromium (~280 MB) -- we install Chrome beta 149 separately in step 5.
sudo -u "$APP_USER" -H bash -c "cd '$APP_DIR' && PUPPETEER_SKIP_DOWNLOAD=1 npm ci --omit=dev --no-audit --no-fund"

# -------- 5. Install Chrome beta (>=149) --------
CHROME_BIN=""
if [[ -d "$APP_DIR/chrome" ]]; then
  CHROME_BIN="$(find "$APP_DIR/chrome" -name chrome -type f 2>/dev/null | head -1 || true)"
fi
if [[ -z "$CHROME_BIN" ]]; then
  echo "==> [5/8] Installing Chrome beta (>=149) via @puppeteer/browsers..."
  sudo -u "$APP_USER" -H bash -c "cd '$APP_DIR' && npx -y @puppeteer/browsers install chrome@beta --path='$APP_DIR/chrome'"
  CHROME_BIN="$(find "$APP_DIR/chrome" -name chrome -type f | head -1)"
else
  echo "==> [5/8] Chrome already installed at $CHROME_BIN"
fi
echo "  OK Chrome at: $CHROME_BIN"

# -------- 6. systemd unit --------
echo "==> [6/8] Configuring systemd service..."
cat > /etc/systemd/system/web-mcp-auditor.service <<EOF
[Unit]
Description=Web MCP Auditor
After=network.target

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_DIR
Environment=PORT=$PORT
Environment=NODE_ENV=production
Environment=PUPPETEER_SKIP_DOWNLOAD=1
Environment=PUPPETEER_EXECUTABLE_PATH=$CHROME_BIN
Environment=XVFB_AVAILABLE=1
Environment=AUDIT_CONCURRENCY=2
ExecStart=/usr/bin/xvfb-run -a --server-args="-screen 0 1280x800x24" /usr/bin/node $APP_DIR/server.js
Restart=on-failure
RestartSec=5s
MemoryMax=1500M
StandardOutput=journal
StandardError=journal

# Hardening
NoNewPrivileges=true
PrivateTmp=true
ProtectHome=true
ProtectSystem=strict
ReadWritePaths=$APP_DIR
CapabilityBoundingSet=

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable web-mcp-auditor.service >/dev/null
systemctl restart web-mcp-auditor.service
sleep 3

if systemctl is-active --quiet web-mcp-auditor.service; then
  echo "  OK Service is running"
else
  echo "  FAIL Service failed to start. Logs:"
  journalctl -u web-mcp-auditor.service -n 30 --no-pager
  exit 1
fi

# -------- 7. nginx --------
echo "==> [7/8] Configuring nginx reverse proxy..."
SERVER_NAME="${DOMAIN:-_}"
cat > /etc/nginx/sites-available/web-mcp-auditor <<EOF
server {
    listen 80;
    listen [::]:80;
    server_name $SERVER_NAME;

    client_max_body_size 64k;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
        proxy_send_timeout 60s;
        proxy_connect_timeout 10s;
    }
}
EOF
ln -sf /etc/nginx/sites-available/web-mcp-auditor /etc/nginx/sites-enabled/web-mcp-auditor
rm -f /etc/nginx/sites-enabled/default
nginx -t >/dev/null
systemctl reload nginx
echo "  OK nginx reloaded"

# Open firewall (only if ufw is installed and active)
if command -v ufw >/dev/null 2>&1; then
  ufw allow 22/tcp >/dev/null 2>&1 || true
  ufw allow 80/tcp >/dev/null 2>&1 || true
  ufw allow 443/tcp >/dev/null 2>&1 || true
fi

# -------- 8. Let's Encrypt (optional) --------
if [[ -n "$DOMAIN" && -n "$EMAIL" ]]; then
  echo "==> [8/8] Obtaining Lets Encrypt certificate for $DOMAIN..."
  apt-get install -y -qq certbot python3-certbot-nginx
  certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos --email "$EMAIL" --redirect --no-eff-email
  echo "  OK HTTPS enabled"
else
  echo "==> [8/8] Skipping Lets Encrypt (no DOMAIN+EMAIL provided)."
fi

# -------- Smoke test --------
echo ""
echo "============================================="
echo "  Smoke test"
echo "============================================="
sleep 2
HEALTH=$(curl -fsS "http://127.0.0.1:$PORT/api/health" || echo '{"ok":false,"error":"connection failed"}')
echo "  /api/health -> $HEALTH"

if [[ -n "$DOMAIN" ]]; then
  URL="https://$DOMAIN/"
  [[ -z "$EMAIL" ]] && URL="http://$DOMAIN/"
else
  IP=$(curl -fsS https://api.ipify.org 2>/dev/null || hostname -I | awk '{print $1}')
  URL="http://$IP/"
fi

echo ""
echo "============================================="
echo "  DEPLOYED"
echo "============================================="
echo "  Visit:  $URL"
echo "  Logs:   journalctl -u web-mcp-auditor -f"
echo "  Update: re-run the deploy.sh curl one-liner (idempotent)"
echo "============================================="
