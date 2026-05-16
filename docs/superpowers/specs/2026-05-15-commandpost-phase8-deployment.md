# CommandPost Phase 8: Deployment & Production — Design Spec

**Date:** 2026-05-15
**Author:** Phil Smith + Claude
**Status:** Approved

## Overview

Deploy CommandPost to a DigitalOcean droplet. Includes a one-time server setup script (Node, Nginx, PM2, certbot, SSL), PM2 process management, system cron for health checks and morning briefings, an env template, a one-command deploy script, and Nginx reverse proxy with SSL.

## Server Setup Script

### `scripts/server-setup.sh`

Run once on a fresh Ubuntu 22.04+ droplet as root. Takes two arguments: the domain name and the git repo URL.

**Usage:**
```bash
ssh root@YOUR_DROPLET_IP 'bash -s' < scripts/server-setup.sh commandpost.superpowers.dev https://github.com/you/commandpost.git
```

**Installs:**
- Node.js 20 LTS via NodeSource
- npm, PM2 (global via npm)
- Nginx
- Certbot (via snap)
- Git (if not present)

**Creates:**
- `commandpost` system user with home `/var/www/commandpost`
- Clones the git repo into `/var/www/commandpost`
- Creates `/var/log/commandpost/` directory (owned by `commandpost` user)
- Creates `data/` directory for the SQLite database
- Copies `.env.production.template` to `.env` and prompts the user to edit it
- Runs `npm install` and `npm run build`
- Installs the PM2 ecosystem config and starts the app
- Saves PM2 startup so it auto-starts on reboot
- Copies Nginx config, enables the site, tests, and reloads
- Runs certbot for SSL with `--nginx` plugin for the given domain
- Installs cron jobs for the `commandpost` user
- Installs logrotate config

**Idempotent where possible:** Checks if packages are already installed before installing. Checks if user exists before creating.

## PM2 Configuration

### `ecosystem.config.js`

At the repo root:

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

Port 3004. Nginx proxies to it. Max 512MB memory before automatic restart.

## Cron Jobs

Set up by the setup script under the `commandpost` user's crontab:

```
*/5 * * * * cd /var/www/commandpost && npx tsx scripts/health-check.ts >> /var/log/commandpost/health-check.log 2>&1
0 12 * * * cd /var/www/commandpost && npx tsx scripts/sms-alerts.ts --morning >> /var/log/commandpost/sms-alerts.log 2>&1
```

- Health check: every 5 minutes
- Morning briefing: 12:00 UTC (7:00 AM Central)

## Environment Template

### `.env.production.template`

Checked into the repo. All keys listed with empty values and explanatory comments.

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

## Deploy Script

### `scripts/deploy.sh`

Run from local machine. Takes the server hostname/domain as an argument.

**Usage:**
```bash
./scripts/deploy.sh commandpost.superpowers.dev
```

**Steps:**
1. SSH into `commandpost@<host>`
2. `cd /var/www/commandpost && git pull origin main`
3. `npm install --production`
4. `npm run build`
5. `pm2 restart commandpost`
6. Print success/failure with timestamp

Uses the `commandpost` user (not root). Assumes SSH key authentication is configured.

## Nginx Configuration

### `deploy/nginx.conf`

Template Nginx site config. The setup script copies it to `/etc/nginx/sites-available/commandpost`, replaces `DOMAIN_PLACEHOLDER` with the actual domain, and symlinks to `sites-enabled`.

**Configuration:**
- Server block on port 80: redirects all traffic to HTTPS
- Server block on port 443:
  - SSL managed by certbot (cert paths filled in by certbot)
  - `proxy_pass http://127.0.0.1:3004`
  - Proxy headers: `Host`, `X-Real-IP`, `X-Forwarded-For`, `X-Forwarded-Proto`
  - WebSocket support headers (`Upgrade`, `Connection`)
  - Location `/_next/static/`: `Cache-Control: public, max-age=31536000, immutable`
  - `client_max_body_size 10M`

## Logrotate

### `deploy/logrotate.conf`

Installed to `/etc/logrotate.d/commandpost`.

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

## File Structure

```
ecosystem.config.js                          # CREATE: PM2 config
.env.production.template                     # CREATE: env template
scripts/
  server-setup.sh                            # CREATE: one-time server provisioning
  deploy.sh                                  # CREATE: one-command deploy
deploy/
  nginx.conf                                 # CREATE: Nginx site config template
  logrotate.conf                             # CREATE: logrotate config
```

## Dependencies

No new npm dependencies. All server-side tools installed by the setup script.
