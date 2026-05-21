#!/bin/bash
# start.sh — Launches pipeline scheduler
set -e
cd "$(dirname "$0")"

echo "Starting NewLeaf Pipeline..."
exec node index.js
