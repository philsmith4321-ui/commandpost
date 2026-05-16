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
