#!/bin/bash
# Start backend (NestJS watch mode) + frontend (Vite HMR) concurrently for development.
# Usage: ./start-dev.sh

ROOT="$(cd "$(dirname "$0")" && pwd)"

echo "=== Starting PS TimeSheet (dev) ==="
echo "Backend  → http://localhost:3000/api"
echo "Frontend → http://localhost:5173"
echo "Press Ctrl-C to stop both."
echo ""

# Kill children when this script exits
trap 'kill 0' SIGINT SIGTERM EXIT

cd "$ROOT/backend"  && npm run start:dev &
cd "$ROOT/frontend" && npm run dev &

wait
