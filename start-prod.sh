#!/bin/bash
# Start PS TimeSheet in production (plain Node — use PM2 for auto-restart).
# Usage: ./start-prod.sh

ROOT="$(cd "$(dirname "$0")" && pwd)"

if [ ! -f "$ROOT/backend/dist/main.js" ]; then
  echo "ERROR: backend/dist/main.js not found. Run ./build-prod.sh first."
  exit 1
fi

if [ ! -f "$ROOT/frontend/dist/index.html" ]; then
  echo "ERROR: frontend/dist/index.html not found. Run ./build-prod.sh first."
  exit 1
fi

PORT="${PORT:-3000}"
echo "Starting PS TimeSheet on port $PORT ..."
cd "$ROOT/backend"
node dist/main.js
