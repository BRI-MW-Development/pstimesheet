#!/bin/bash
# Build PS TimeSheet for production.
# Usage:  ./build-prod.sh
# After this, start with:  ./start-prod.sh  (or  pm2 start ecosystem.config.js)

set -e
ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "================================================"
echo "  PS TimeSheet — Production Build"
echo "================================================"

# ── Frontend ──────────────────────────────────────
echo ""
echo "[1/4] Installing frontend dependencies..."
cd "$ROOT/frontend"
npm ci --prefer-offline --silent

echo "[2/4] Building frontend..."
npm run build
echo "      → frontend/dist ready"

# ── Backend ───────────────────────────────────────
echo ""
echo "[3/4] Installing backend dependencies..."
cd "$ROOT/backend"
npm ci --prefer-offline --silent --omit=dev

echo "[4/4] Building backend..."
npm run build
echo "      → backend/dist ready"

echo ""
echo "================================================"
echo "  Build complete."
echo "  Start the app:"
echo "    ./start-prod.sh          (direct Node)"
echo "    pm2 start ecosystem.config.js  (recommended)"
echo "================================================"
