#!/bin/bash
# NewLeaf Yahoo Options Service — start script
# Usage: ./start.sh [port]

PORT=${1:-5300}
DIR="$(cd "$(dirname "$0")" && pwd)"

echo ""
echo "  NewLeaf Yahoo Options Service"
echo "  ─────────────────────────────"
echo "  Dir:  $DIR"
echo "  Port: $PORT"
echo ""

cd "$DIR"

if ! command -v python3 &>/dev/null; then
  echo "  ERROR: python3 not found"; exit 1
fi

if ! python3 -c "import flask, yfinance" 2>/dev/null; then
  echo "  Installing requirements..."
  pip3 install -r requirements.txt --break-system-packages 2>/dev/null \
    || pip3 install -r requirements.txt
fi

echo "  Starting on http://localhost:$PORT"
echo "  Ctrl+C to stop"
echo ""

PORT=$PORT python3 option_api.py
