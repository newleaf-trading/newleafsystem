#!/bin/bash
# check-scheduler-health.sh
# Runs every 5 min to verify schedulers are working properly
# Alerts if jobs are missed or hung

R2_URL="https://pub-04bbb919022645b3a3f318b2ebdf48c0.r2.dev/pipeline-status/latest.json"
LOG_FILE="/tmp/newleaf-health.log"
MAX_AGE_MINUTES=30  # Alert if last run >30 min old during market hours

timestamp() {
  date "+%Y-%m-%d %H:%M:%S"
}

log() {
  echo "[$(timestamp)] $1" >> "$LOG_FILE"
}

log "=== Health Check Started ==="

# Fetch latest run from R2
LATEST=$(curl -s "$R2_URL")
if [ -z "$LATEST" ]; then
  log "⚠️  ERROR: Failed to fetch status from R2"
  exit 1
fi

# Extract run details
LAST_RUN=$(echo "$LATEST" | jq -r '.timestamp')
MODE=$(echo "$LATEST" | jq -r '.mode')
OK=$(echo "$LATEST" | jq -r '.ok')
FAILED=$(echo "$LATEST" | jq -r '.failed')
TOTAL=$(echo "$LATEST" | jq -r '.totalSymbols')

# Calculate age of last run (timestamps are UTC — convert properly)
if [ "$(uname)" == "Darwin" ]; then
  # macOS — parse as UTC by setting TZ temporarily
  LAST_RUN_EPOCH=$(TZ=UTC date -j -f "%Y-%m-%dT%H:%M:%S" "${LAST_RUN:0:19}" +%s 2>/dev/null)
else
  # Linux — append Z to signal UTC
  LAST_RUN_EPOCH=$(date -d "${LAST_RUN:0:19}Z" +%s 2>/dev/null)
fi

NOW_EPOCH=$(date +%s)
AGE_MINUTES=$(( (NOW_EPOCH - LAST_RUN_EPOCH) / 60 ))

log "Last run: $LAST_RUN (${AGE_MINUTES}m ago) [$MODE] ${OK}/${TOTAL} OK, ${FAILED} failed"

# Check if we're in market hours (14:00-21:00 BST = 9am-4pm ET, Mon-Fri)
HOUR=$(date +%H)
DOW=$(date +%u)  # 1=Mon, 7=Sun

IS_MARKET_HOURS=0
if [ $DOW -ge 1 ] && [ $DOW -le 5 ] && [ $HOUR -ge 14 ] && [ $HOUR -le 21 ]; then
  IS_MARKET_HOURS=1
fi

# Health checks
if [ $IS_MARKET_HOURS -eq 1 ]; then
  # During market hours - expect runs every 15 min
  if [ $AGE_MINUTES -gt $MAX_AGE_MINUTES ]; then
    log "❌ ALERT: No pipeline run in ${AGE_MINUTES} minutes (max: ${MAX_AGE_MINUTES})"
    log "   This likely indicates a scheduler failure or hung process"

    # Check if any pipeline process is running
    RUNNING=$(ps aux | grep -E "newleaf-pipeline.js|scheduler-intraday.js" | grep -v grep | wc -l)
    if [ $RUNNING -gt 0 ]; then
      log "   ⚠️  Pipeline process is still running (may be hung)"
      log "   Consider: pkill -f newleaf-pipeline"
    else
      log "   ℹ️  No pipeline process running"
      log "   Check crontab: crontab -l | grep newleaf"
    fi

    exit 1
  fi

  # Check for failures
  if [ $FAILED -gt 0 ]; then
    FAIL_RATE=$(echo "scale=1; $FAILED * 100 / $TOTAL" | bc)
    log "⚠️  WARNING: ${FAILED}/${TOTAL} symbols failed (${FAIL_RATE}%)"

    if [ $FAILED -ge 10 ]; then
      log "❌ ALERT: High failure rate - check pipeline logs"
      exit 1
    fi
  fi

  log "✓ Pipeline healthy - last run ${AGE_MINUTES}m ago, ${OK}/${TOTAL} OK"

else
  # Outside market hours
  log "ℹ️  Outside market hours (${HOUR}:00 BST) - skipping age check"

  if [ $FAILED -gt 0 ]; then
    log "⚠️  Note: Last run had ${FAILED} failures"
  fi
fi

log "=== Health Check Complete ==="
echo "" >> "$LOG_FILE"

exit 0
