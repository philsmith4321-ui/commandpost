# CommandPost Phase 8: Deployment & Production — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deploy CommandPost to a DigitalOcean droplet with automated setup, one-command deploys, Nginx reverse proxy with SSL, and PM2 process management.

**Architecture:** All deployment infrastructure lives in shell scripts and config files — no new npm dependencies. A one-time `server-setup.sh` provisions a fresh Ubuntu droplet (Node 20, PM2, Nginx, Certbot, cron). A `deploy.sh` script handles subsequent deploys via SSH. PM2 manages the Next.js process; Nginx reverse-proxies port 3004 with SSL.

**Tech Stack:** Bash, Nginx, PM2, Certbot, Ubuntu 22.04+, Node.js 20 LTS

---

## File Structure

```
.env.production.template              # CREATE: env template with all keys + comments
.gitignore                            # MODIFY: add !.env.production.template exception
ecosystem.config.js                   # CREATE: PM2 process config
scripts/
  server-setup.sh                     # CREATE: one-time Ubuntu server provisioning
  deploy.sh                           # CREATE: one-command deploy from local machine
deploy/
  nginx.conf                          # CREATE: Nginx site config template
  logrotate.conf                      # CREATE: logrotate config
```

**Note:** Phase 8 is entirely shell scripts and config files. There is no TypeScript to unit-test. Validation is done by linting the scripts with `bash -n` (syntax check) and reviewing the output.

---

### Task 1: Environment Template and .gitignore Update

**Files:**
- Create: `.env.production.template`
- Modify: `.gitignore:33-35`

- [ ] **Step 1: Create `.env.production.template`**

Create the file at the repo root:

```
# Next.js
PORT=3004
NODE_ENV=production

# Auth (generate with: openssl rand -hex 32)
AUTH_PASSWORD_HASH=
AUTH_SECRET=

# Twilio (optional — SMS alerts)
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM_NUMBER=
ALERT_TO_NUMBER=

# Stripe (optional — invoice payments)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Claude AI (optional — AI features)
ANTHROPIC_API_KEY=

# Disk Monitoring (optional)
DISK_REPORT_API_KEY=
```

- [ ] **Step 2: Update `.gitignore` to allow the template**

The current `.gitignore` has:

```
# env files (can opt-in for committing if needed)
.env*
!.env.example
```

Add `!.env.production.template` so it becomes:

```
# env files (can opt-in for committing if needed)
.env*
!.env.example
!.env.production.template
```

- [ ] **Step 3: Verify the template is tracked**

Run: `git status`
Expected: `.env.production.template` shows as a new untracked file (not ignored).

- [ ] **Step 4: Commit**

```bash
git add .env.production.template .gitignore
git commit -m "feat: add production env template and gitignore exception"
```

---

### Task 2: PM2 Ecosystem Config

**Files:**
- Create: `ecosystem.config.js`

- [ ] **Step 1: Create `ecosystem.config.js`**

Create at the repo root:

```js
module.exports = {
  apps: [{
    name: 'commandpost',
    script: 'node_modules/.bin/next',
    args: 'start -p 3004',
    cwd: '/var/www/commandpost',
    env_file: '.env',
    max_memory_restart: '512M',
  }]
}
```

- [ ] **Step 2: Commit**

```bash
git add ecosystem.config.js
git commit -m "feat: add PM2 ecosystem config"
```

---

### Task 3: Nginx Config and Logrotate

**Files:**
- Create: `deploy/nginx.conf`
- Create: `deploy/logrotate.conf`

- [ ] **Step 1: Create the `deploy/` directory**

Run: `mkdir -p deploy`

- [ ] **Step 2: Create `deploy/nginx.conf`**

```nginx
server {
    listen 80;
    server_name DOMAIN_PLACEHOLDER;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl;
    server_name DOMAIN_PLACEHOLDER;

    # SSL certs managed by certbot — paths filled in automatically
    # ssl_certificate /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/fullchain.pem;
    # ssl_certificate_key /etc/letsencrypt/live/DOMAIN_PLACEHOLDER/privkey.pem;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:3004;
        proxy_http_version 1.1;

        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    location /_next/static/ {
        proxy_pass http://127.0.0.1:3004;
        add_header Cache-Control "public, max-age=31536000, immutable";
    }
}
```

- [ ] **Step 3: Create `deploy/logrotate.conf`**

```
/var/log/commandpost/*.log {
    weekly
    rotate 4
    compress
    delaycompress
    missingok
    notifempty
}
```

- [ ] **Step 4: Commit**

```bash
git add deploy/nginx.conf deploy/logrotate.conf
git commit -m "feat: add Nginx site config and logrotate config"
```

---

### Task 4: Deploy Script

**Files:**
- Create: `scripts/deploy.sh`

- [ ] **Step 1: Create `scripts/deploy.sh`**

```bash
#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/deploy.sh <hostname>
# Example: ./scripts/deploy.sh commandpost.superpowers.dev

HOST="${1:?Usage: ./scripts/deploy.sh <hostname>}"
USER="commandpost"
APP_DIR="/var/www/commandpost"

echo "Deploying CommandPost to ${HOST}..."

ssh "${USER}@${HOST}" bash -s <<'REMOTE'
set -euo pipefail
cd /var/www/commandpost

echo "Pulling latest code..."
git pull origin main

echo "Installing dependencies..."
npm install --production

echo "Building..."
npm run build

echo "Restarting PM2..."
pm2 restart commandpost
REMOTE

echo ""
echo "Deploy complete at $(date '+%Y-%m-%d %H:%M:%S')"
```

- [ ] **Step 2: Make the script executable**

Run: `chmod +x scripts/deploy.sh`

- [ ] **Step 3: Syntax check**

Run: `bash -n scripts/deploy.sh`
Expected: No output (clean syntax).

- [ ] **Step 4: Commit**

```bash
git add scripts/deploy.sh
git commit -m "feat: add one-command deploy script"
```

---

### Task 5: Server Setup Script

**Files:**
- Create: `scripts/server-setup.sh`

This is the largest file. It provisions a fresh Ubuntu 22.04+ droplet. Run once as root.

- [ ] **Step 1: Create `scripts/server-setup.sh`**

```bash
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
sed -i "s/DOMAIN_PLACEHOLDER/${DOMAIN}/g" "${NGINX_CONF}"

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
```

- [ ] **Step 2: Make the script executable**

Run: `chmod +x scripts/server-setup.sh`

- [ ] **Step 3: Syntax check**

Run: `bash -n scripts/server-setup.sh`
Expected: No output (clean syntax).

- [ ] **Step 4: Commit**

```bash
git add scripts/server-setup.sh
git commit -m "feat: add one-time server provisioning script"
```

---

### Task 6: Final Verification

- [ ] **Step 1: Verify all new files exist**

Run: `ls -la .env.production.template ecosystem.config.js scripts/server-setup.sh scripts/deploy.sh deploy/nginx.conf deploy/logrotate.conf`
Expected: All 6 files listed, both `.sh` files with execute permission.

- [ ] **Step 2: Run existing test suite to ensure nothing broke**

Run: `npx vitest run`
Expected: All 76 tests pass (no regressions — Phase 8 adds no TypeScript code).

- [ ] **Step 3: Run build to ensure nothing broke**

Run: `npm run build`
Expected: Clean build, no errors.

- [ ] **Step 4: Syntax-check both shell scripts**

Run: `bash -n scripts/server-setup.sh && bash -n scripts/deploy.sh && echo "All scripts OK"`
Expected: `All scripts OK`
