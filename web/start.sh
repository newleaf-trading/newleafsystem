#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# NewLeaf System — Start All Services
# ═══════════════════════════════════════════════════════════════════
#
#   ./start.sh           # start everything
#   ./start.sh --no-cron # start services only, no scheduler
#
# Services started:
#   1. Yahoo Options Service (port 5300) — must be first
#   2. Node Server (port 3000) — static files + R2 proxy
#   3. Cron jobs (if not --no-cron)
#
# ═══════════════════════════════════════════════════════════════════

set -e
cd "$(dirname "$0")"
BASE=$(pwd)
NO_CRON=false
[[ "$*" == *"--no-cron"* ]] && NO_CRON=true

echo ""
echo "  ╔══════════════════════════════════════════════╗"
echo "  ║  NewLeaf System — Starting Services          ║"
echo "  ╚══════════════════════════════════════════════╝"
echo ""

# ── Load NVM ──────────────────────────────────────────────────────
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && source "$NVM_DIR/nvm.sh"

# ── 1. Yahoo Options Service ─────────────────────────────────────
echo "  ▸ Starting Yahoo Options Service (port 5300)..."
if lsof -i :5300 -sTCP:LISTEN -P -n >/dev/null 2>&1; then
  echo "    Already running ✓"
else
  cd "$BASE/scanner/yahoo-svc"
  nohup python3 option_api.py > /tmp/newleaf-yahoo.log 2>&1 &
  YAHOO_PID=$!
  sleep 2
  if curl -sf http://localhost:5300/health >/dev/null 2>&1; then
    echo "    Started (PID $YAHOO_PID) ✓"
  else
    echo "    ⚠ Failed to start — check /tmp/newleaf-yahoo.log"
  fi
  cd "$BASE"
fi

# ── 2. Node Server ───────────────────────────────────────────────
echo "  ▸ Starting Node Server (port 3000)..."
if lsof -i :3000 -sTCP:LISTEN -P -n >/dev/null 2>&1; then
  echo "    Already running ✓"
else
  nohup node server.cjs > /tmp/newleaf-server.log 2>&1 &
  SERVER_PID=$!
  sleep 1
  if curl -sf http://localhost:3000/ >/dev/null 2>&1; then
    echo "    Started (PID $SERVER_PID) ✓"
  else
    echo "    ⚠ Failed to start — check /tmp/newleaf-server.log"
  fi
fi

# ── 3. Cron Jobs ─────────────────────────────────────────────────
if [ "$NO_CRON" = true ]; then
  echo "  ▸ Cron jobs: SKIPPED (--no-cron)"
else
  echo "  ▸ Installing cron jobs..."
  # Preserve existing non-newleaf cron entries
  (crontab -l 2>/dev/null | grep -v "# NewLeaf" | grep -v "newleafsystem") > /tmp/cron-existing.txt || true
  cat /tmp/cron-existing.txt "$BASE/scanner/crontab" | crontab -
  echo "    Cron installed ✓"
fi

# ── Status ───────────────────────────────────────────────────────
echo ""
echo "  ────────────────────────────────────────────"
echo "  Services:"
echo "    Yahoo:   $(curl -sf http://localhost:5300/health | python3 -c 'import json,sys;print(json.load(sys.stdin).get("status","?"))' 2>/dev/null || echo 'NOT RUNNING')"
echo "    Server:  $(curl -sf http://localhost:3000/ >/dev/null 2>&1 && echo 'OK' || echo 'NOT RUNNING')"
echo "    Cron:    $(crontab -l 2>/dev/null | grep -c 'newleafsystem') jobs"
echo ""
echo "  URLs:"
echo "    http://localhost:3000/              Landing"
echo "    http://localhost:3000/status.html   Pipeline status"
echo "    http://localhost:3000/picks         Weekly picks"
echo "    http://localhost:5300/health        Yahoo service"
echo "  ────────────────────────────────────────────"
echo ""
