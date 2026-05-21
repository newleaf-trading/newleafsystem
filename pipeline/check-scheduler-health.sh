#!/bin/bash
# check-scheduler-health.sh
# Runs every 5 min — monitors ALL NewLeaf services and auto-restarts if down
#
# Services monitored:
#   1. server.cjs (localhost:3000) — main web app server
#   2. Yahoo svc (localhost:5300) — OI fallback (managed by scheduler, but checked here too)
#   3. Pipeline runs — checks last run age during market hours

NODE="/Users/manish/.nvm/versions/node/v20.19.5/bin/node"
NEWLEAF_DIR="/Users/manish/dev/newleafsystem"
PIPELINE_DIR="/Users/manish/dev/newleaf-pipeline"
YAHOO_SVC_DIR="$PIPELINE_DIR/yahoo-svc"

R2_URL="https://pub-04bbb919022645b3a3f318b2ebdf48c0.r2.dev/pipeline-status/latest.json"
LOG_FILE="/tmp/newleaf-health.log"
MAX_AGE_MINUTES=30

timestamp() { date "+%Y-%m-%d %H:%M:%S"; }
log() { echo "[$(timestamp)] $1" >> "$LOG_FILE"; }

log "=== Health Check Started ==="

# ── 1. Main web server (server.cjs on port 3000) ─────────────────────────────
SERVER_UP=0
if curl -sf http://localhost:3000 > /dev/null 2>&1; then
  SERVER_UP=1
  log "✓ server.cjs running on :3000"
else
  log "✗ server.cjs DOWN on :3000 — restarting..."

  # Check if process exists but port not responding
  pkill -f "node.*server\.cjs" 2>/dev/null
  sleep 1

  # Start server.cjs in background
  cd "$NEWLEAF_DIR"
  nohup "$NODE" server.cjs >> /tmp/newleaf-server.log 2>&1 &
  SERVER_PID=$!

  # Wait up to 10s for it to come up
  for i in $(seq 1 10); do
    sleep 1
    if curl -sf http://localhost:3000 > /dev/null 2>&1; then
      SERVER_UP=1
      log "✓ server.cjs restarted (PID $SERVER_PID)"
      break
    fi
  done

  if [ $SERVER_UP -eq 0 ]; then
    log "✗ server.cjs FAILED to restart"
  fi
fi

# ── 2. Yahoo OI service (port 5300) ──────────────────────────────────────────
YAHOO_UP=0
if curl -sf http://localhost:5300/health > /dev/null 2>&1; then
  YAHOO_UP=1
  log "✓ Yahoo svc running on :5300"
else
  log "✗ Yahoo svc DOWN on :5300 — restarting..."

  pkill -f "option_api.py" 2>/dev/null
  sleep 1

  cd "$YAHOO_SVC_DIR"
  PORT=5300 nohup python3 option_api.py >> /tmp/newleaf-yahoo-svc.log 2>&1 &
  YAHOO_PID=$!

  for i in $(seq 1 15); do
    sleep 1
    if curl -sf http://localhost:5300/health > /dev/null 2>&1; then
      YAHOO_UP=1
      log "✓ Yahoo svc restarted (PID $YAHOO_PID)"
      break
    fi
  done

  if [ $YAHOO_UP -eq 0 ]; then
    log "⚠ Yahoo svc FAILED to restart (fallback unavailable)"
  fi
fi

# ── 3. Pipeline run freshness ─────────────────────────────────────────────────
# Check if we're in market hours (14:00-21:00 BST = 9am-4pm ET, Mon-Fri)
HOUR=$(date +%H)
DOW=$(date +%u)  # 1=Mon, 7=Sun

IS_MARKET_HOURS=0
if [ $DOW -ge 1 ] && [ $DOW -le 5 ] && [ $HOUR -ge 14 ] && [ $HOUR -le 21 ]; then
  IS_MARKET_HOURS=1
fi

LATEST=$(curl -sf "$R2_URL" 2>/dev/null)
if [ -n "$LATEST" ]; then
  LAST_RUN=$(echo "$LATEST" | jq -r '.timestamp' 2>/dev/null)
  MODE=$(echo "$LATEST" | jq -r '.mode' 2>/dev/null)
  OK=$(echo "$LATEST" | jq -r '.ok' 2>/dev/null)
  FAILED=$(echo "$LATEST" | jq -r '.failed' 2>/dev/null)
  TOTAL=$(echo "$LATEST" | jq -r '.totalSymbols' 2>/dev/null)

  if [ -n "$LAST_RUN" ] && [ "$LAST_RUN" != "null" ]; then
    if [ "$(uname)" == "Darwin" ]; then
      LAST_RUN_EPOCH=$(TZ=UTC date -j -f "%Y-%m-%dT%H:%M:%S" "${LAST_RUN:0:19}" +%s 2>/dev/null)
    else
      LAST_RUN_EPOCH=$(date -d "${LAST_RUN:0:19}Z" +%s 2>/dev/null)
    fi
    NOW_EPOCH=$(date +%s)
    AGE_MINUTES=$(( (NOW_EPOCH - LAST_RUN_EPOCH) / 60 ))

    log "Pipeline: last run ${AGE_MINUTES}m ago [$MODE] ${OK}/${TOTAL} OK, ${FAILED} failed"

    if [ $IS_MARKET_HOURS -eq 1 ] && [ $AGE_MINUTES -gt $MAX_AGE_MINUTES ]; then
      log "⚠ ALERT: No pipeline run in ${AGE_MINUTES}m (max: ${MAX_AGE_MINUTES}m)"
    fi

    if [ -n "$FAILED" ] && [ "$FAILED" != "null" ] && [ "$FAILED" -ge 10 ] 2>/dev/null; then
      log "⚠ WARNING: ${FAILED} symbols failed in last run"
    fi
  fi
else
  log "⚠ Could not fetch pipeline status from R2"
fi

# ── Summary ───────────────────────────────────────────────────────────────────
log "Summary: server=$( [ $SERVER_UP -eq 1 ] && echo 'UP' || echo 'DOWN' ) yahoo=$( [ $YAHOO_UP -eq 1 ] && echo 'UP' || echo 'DOWN' ) market=$( [ $IS_MARKET_HOURS -eq 1 ] && echo 'OPEN' || echo 'CLOSED' )"
log "=== Health Check Complete ==="
echo "" >> "$LOG_FILE"

exit 0
