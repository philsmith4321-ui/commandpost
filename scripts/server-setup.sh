#!/usr/bin/env bash
set -euo pipefail

# Usage: ssh root@YOUR_DROPLET_IP 'bash -s' < scripts/server-setup.sh <domain> <git-repo-url>
# Example: ssh root@1.2.3.4 'bash -s' < scripts/server-setup.sh commandpost.superpowers.dev https://github.com/you/commandpost.git

DOMAIN="${1:?Usage: server-setup.sh <domain> <git-repo-url>}"
REPO_URL="${2:?Usage: server-setup.sh <domain> <git-repo-url>}"

APP_USER="commandpost"
APP_DIR="/var/www/commandpost"
LOG_DIR="/var/log/commandpost"

echo "=== CommandPost Server Setup ==="
echo "Domain: ${DOMAIN}"
echo "Repo:   ${REPO_URL}"
echo ""

# -------------------------------------------------------
# 1. System packages
# -------------------------------------------------------
echo "--- Installing system packages ---"

apt-get update -y

# Git
if ! command -v git &>/dev/null; then
  apt-get install -y git
  echo "Installed git."
else
  echo "git already installed."
fi

# Nginx
if ! command -v nginx &>/dev/null; then
  apt-get install -y nginx
  echo "Installed nginx."
else
  echo "nginx already installed."
fi

# Node.js 20 LTS via NodeSource
if ! command -v node &>/dev/null || [[ "$(node -v)" != v20.* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
  echo "Installed Node.js $(node -v)."
else
  echo "Node.js $(node -v) already installed."
fi

# PM2
if ! command -v pm2 &>/dev/null; then
  npm install -g pm2
  echo "Installed PM2."
else
  echo "PM2 already installed."
fi

# Certbot via snap
if ! command -v certbot &>/dev/null; then
  snap install --classic certbot 2>/dev/null || apt-get install -y certbot python3-certbot-nginx
  ln -sf /snap/bin/certbot /usr/bin/certbot 2>/dev/null || true
  echo "Installed certbot."
else
  echo "certbot already installed."
fi

# -------------------------------------------------------
# 2. App user and directories
# -------------------------------------------------------
echo ""
echo "--- Setting up app user and directories ---"

if ! id "${APP_USER}" &>/dev/null; then
  useradd --system --home-dir "${APP_DIR}" --create-home --shell /bin/bash "${APP_USER}"
  echo "Created user ${APP_USER}."
else
  echo "User ${APP_USER} already exists."
fi

mkdir -p "${LOG_DIR}"
chown "${APP_USER}:${APP_USER}" "${LOG_DIR}"

# -------------------------------------------------------
# 3. Clone repo and set up app
# -------------------------------------------------------
echo ""
echo "--- Cloning repo and setting up app ---"

if [ ! -d "${APP_DIR}/.git" ]; then
  # Clone into a temp dir, then move contents (since home dir already exists)
  TMP_DIR=$(mktemp -d)
  git clone "${REPO_URL}" "${TMP_DIR}"
  cp -a "${TMP_DIR}/." "${APP_DIR}/"
  rm -rf "${TMP_DIR}"
  chown -R "${APP_USER}:${APP_USER}" "${APP_DIR}"
  echo "Cloned repo into ${APP_DIR}."
else
  echo "Repo already cloned. Pulling latest..."
  su - "${APP_USER}" -c "cd ${APP_DIR} && git pull origin main"
fi

# Create data directory for SQLite
su - "${APP_USER}" -c "mkdir -p ${APP_DIR}/data"

# Copy env template if .env doesn't exist
if [ ! -f "${APP_DIR}/.env" ]; then
  cp "${APP_DIR}/.env.production.template" "${APP_DIR}/.env"
  chown "${APP_USER}:${APP_USER}" "${APP_DIR}/.env"
  echo ""
  echo "*** IMPORTANT: Edit ${APP_DIR}/.env with your production values ***"
  echo "*** Run: nano ${APP_DIR}/.env ***"
  echo ""
else
  echo ".env already exists. Skipping copy."
fi

# Install dependencies and build
echo "Installing npm dependencies..."
su - "${APP_USER}" -c "cd ${APP_DIR} && npm install"

echo "Building app..."
su - "${APP_USER}" -c "cd ${APP_DIR} && npm run build"

# -------------------------------------------------------
# 4. PM2 setup
# -------------------------------------------------------
echo ""
echo "--- Setting up PM2 ---"

su - "${APP_USER}" -c "cd ${APP_DIR} && pm2 start ecosystem.config.js"
su - "${APP_USER}" -c "pm2 save"

# PM2 startup (runs as root, registers the commandpost user's PM2)
pm2 startup systemd -u "${APP_USER}" --hp "${APP_DIR}"

echo "PM2 configured and app started."

# -------------------------------------------------------
# 5. Nginx configuration
# -------------------------------------------------------
echo ""
echo "--- Setting up Nginx ---"

NGINX_CONF="/etc/nginx/sites-available/commandpost"
cp "${APP_DIR}/deploy/nginx.conf" "${NGINX_CONF}"
sed -i "s|DOMAIN_PLACEHOLDER|${DOMAIN}|g" "${NGINX_CONF}"

ln -sf "${NGINX_CONF}" /etc/nginx/sites-enabled/commandpost

# Remove default site if it exists
rm -f /etc/nginx/sites-enabled/default

nginx -t
systemctl reload nginx

echo "Nginx configured for ${DOMAIN}."

# -------------------------------------------------------
# 6. SSL via Certbot
# -------------------------------------------------------
echo ""
echo "--- Setting up SSL ---"

certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos --register-unsafely-without-email

echo "SSL configured for ${DOMAIN}."

# -------------------------------------------------------
# 7. Cron jobs
# -------------------------------------------------------
echo ""
echo "--- Setting up cron jobs ---"

CRON_CONTENT="*/5 * * * * cd ${APP_DIR} && npx tsx scripts/health-check.ts >> ${LOG_DIR}/health-check.log 2>&1
0 12 * * * cd ${APP_DIR} && npx tsx scripts/sms-alerts.ts --morning >> ${LOG_DIR}/sms-alerts.log 2>&1"

echo "${CRON_CONTENT}" | crontab -u "${APP_USER}" -

echo "Cron jobs installed for ${APP_USER}."

# -------------------------------------------------------
# 8. Logrotate
# -------------------------------------------------------
echo ""
echo "--- Setting up logrotate ---"

cp "${APP_DIR}/deploy/logrotate.conf" /etc/logrotate.d/commandpost

echo "Logrotate configured."

# -------------------------------------------------------
# Done
# -------------------------------------------------------
echo ""
echo "=== Setup complete! ==="
echo "App running at https://${DOMAIN}"
echo ""
echo "Next steps:"
echo "  1. Edit ${APP_DIR}/.env with production values"
echo "  2. Restart: su - ${APP_USER} -c 'cd ${APP_DIR} && pm2 restart commandpost'"
echo "  3. Future deploys: ./scripts/deploy.sh ${DOMAIN}"
