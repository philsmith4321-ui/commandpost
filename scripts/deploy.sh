#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/deploy.sh [hostname]
# Defaults to the production host. SSH user is root (the only key that works).
# NOTE: `next build` needs devDependencies (@tailwindcss/postcss, typescript),
# so this runs a FULL `npm install` — never `--production`/`--omit=dev`.

HOST="${1:-143.244.169.43}"
USER="root"

echo "Deploying CommandPost to ${USER}@${HOST}..."

ssh "${USER}@${HOST}" bash -s <<'REMOTE'
set -euo pipefail
cd /var/www/commandpost

echo "Pulling latest code..."
git pull origin main

echo "Installing dependencies (incl. dev — required by next build)..."
npm install

echo "Building..."
npm run build

echo "Restarting PM2..."
pm2 restart commandpost --update-env
REMOTE

echo ""
echo "Deploy complete at $(date '+%Y-%m-%d %H:%M:%S')"
