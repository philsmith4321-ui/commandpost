#!/usr/bin/env bash
set -euo pipefail

# Usage: ./disk-report.sh <commandpost-url> <api-key> [hostname-override]
# Example: ./disk-report.sh https://commandpost.example.com my-secret-key
# Meant to run hourly via cron: 0 * * * * /path/to/disk-report.sh https://... key

if [ $# -lt 2 ]; then
  echo "Usage: $0 <commandpost-url> <api-key> [hostname]"
  exit 1
fi

URL="$1"
KEY="$2"
HOST="${3:-$(hostname)}"

# Build JSON array of disk entries from df, filtering to real filesystems
DISKS=$(df -B1 2>/dev/null | awk 'NR>1 && $1 ~ /^\/dev/ {
  total = $2 / 1073741824
  used = $3 / 1073741824
  pct = (used / total) * 100
  printf "{\"mount\":\"%s\",\"total_gb\":%.1f,\"used_gb\":%.1f,\"percent_used\":%.1f},", $6, total, used, pct
}')

# Remove trailing comma and wrap in array
DISKS="[${DISKS%,}]"

PAYLOAD="{\"endpoint_name\":\"${HOST}\",\"disks\":${DISKS}}"

RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
  "${URL}/api/disk-report?key=${KEY}" \
  -H "Content-Type: application/json" \
  -d "${PAYLOAD}")

HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -1)

if [ "$HTTP_CODE" -eq 200 ]; then
  echo "OK: Disk report sent for ${HOST}"
  exit 0
else
  echo "FAIL (HTTP ${HTTP_CODE}): ${BODY}"
  exit 1
fi
