#!/bin/bash
# ═══════════════════════════════════════════════════════════════════
# NewLeaf System — Stop All Services
# ═══════════════════════════════════════════════════════════════════

echo ""
echo "  Stopping NewLeaf System services..."
echo ""

# Stop Yahoo service (port 5300)
YAHOO_PID=$(lsof -i :5300 -sTCP:LISTEN -t 2>/dev/null)
if [ -n "$YAHOO_PID" ]; then
  kill $YAHOO_PID 2>/dev/null
  echo "  ✓ Yahoo service stopped (PID $YAHOO_PID)"
else
  echo "  - Yahoo service not running"
fi

# Stop Node server (port 3000)
SERVER_PID=$(lsof -i :3000 -sTCP:LISTEN -t 2>/dev/null)
if [ -n "$SERVER_PID" ]; then
  kill $SERVER_PID 2>/dev/null
  echo "  ✓ Node server stopped (PID $SERVER_PID)"
else
  echo "  - Node server not running"
fi

# Remove cron jobs
CRON_COUNT=$(crontab -l 2>/dev/null | grep -c 'newleafsystem' || echo 0)
if [ "$CRON_COUNT" -gt 0 ]; then
  crontab -l 2>/dev/null | grep -v "# NewLeaf" | grep -v "newleafsystem" | crontab -
  echo "  ✓ Cron jobs removed ($CRON_COUNT entries)"
else
  echo "  - No cron jobs to remove"
fi

echo ""
echo "  All services stopped."
echo ""
