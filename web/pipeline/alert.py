#!/usr/bin/env python3
"""
NewLeaf Alert Generator — Client communications for position changes.

Usage:
    python3 alert.py adjust NVDA --action "Roll short call $188→$192" --reason "Near resistance"
    python3 alert.py close NVDA --exit-price 1.06 --reason "50% profit target hit"
    python3 alert.py take-profit NVDA         # Auto: 50% profit alert
    python3 alert.py stop-loss NVDA           # Auto: stop loss alert
    python3 alert.py time-exit NVDA           # Auto: 2 days before expiry
    python3 alert.py list                     # Show all alerts
    python3 alert.py sync                     # Upload alerts to R2

Each alert generates:
    - Alert JSON (for dashboard)
    - Short video script (~30s for TikTok/YouTube Shorts)
    - Social post text (copy-paste for Twitter/X)
"""

import sys
import json
import boto3
from datetime import datetime, date
from pathlib import Path
from botocore.config import Config

BASE_DIR = Path(__file__).parent
POS_DIR = BASE_DIR / "positions"
ALERT_DIR = BASE_DIR / "alerts"
DATA_DIR = BASE_DIR / "data"
CONFIG_PATH = BASE_DIR.parent / "newleaf-alpaca-r2" / "pipeline" / "config.json"

COMPANY_NAMES = {
    "NVDA": "NVIDIA", "ADBE": "Adobe", "QQQ": "QQQ", "CRM": "Salesforce",
    "SHOP": "Shopify", "AAPL": "Apple", "TSLA": "Tesla", "META": "Meta",
    "AMZN": "Amazon", "MSFT": "Microsoft", "AMD": "AMD", "SLV": "Silver ETF",
}


def ensure_dirs():
    ALERT_DIR.mkdir(parents=True, exist_ok=True)
    (ALERT_DIR / "archive").mkdir(exist_ok=True)


def load_active():
    f = POS_DIR / "active.json"
    if f.exists():
        with open(f) as fh:
            return json.load(fh)
    return {"positions": []}


def find_position(symbol):
    active = load_active()
    for p in active["positions"]:
        if p["symbol"] == symbol.upper() and p["status"] in ("open", "adjusted"):
            return p
    return None


def load_alerts():
    f = ALERT_DIR / "latest.json"
    if f.exists():
        with open(f) as fh:
            return json.load(fh)
    return {"alerts": []}


def save_alerts(data):
    data["updated"] = datetime.now().isoformat()
    with open(ALERT_DIR / "latest.json", 'w') as f:
        json.dump(data, f, indent=2)


def create_alert(symbol, alert_type, action, reason, details=None):
    """Create alert + video script + social post."""
    pos = find_position(symbol)
    company = COMPANY_NAMES.get(symbol, symbol)
    now = datetime.now()

    alert = {
        "id": f"{symbol}-{now.strftime('%Y%m%d-%H%M')}",
        "symbol": symbol,
        "company": company,
        "type": alert_type,  # adjust, take-profit, stop-loss, time-exit, close
        "action": action,
        "reason": reason,
        "date": date.today().isoformat(),
        "time": now.strftime("%H:%M"),
        "position": {
            "strategy": pos["strategy"] if pos else "Iron Condor",
            "credit": pos["credit"] if pos else 0,
            "strikes": pos["strikes"] if pos else "",
            "expiry": pos["expiry"] if pos else "",
        },
        "details": details or {},
    }

    # Generate video script (~30s for Shorts/TikTok)
    if alert_type == "take-profit":
        script = f"""NewLeaf System alert for {company}, ticker {symbol}.

Our {pos['strategy'] if pos else 'iron condor'} has hit the 50% profit target. Time to close.

We collected ${pos['credit'] if pos else '?'} per share in credit. The position is now worth half that. That's a clean 50% return in just a few days.

The rule is simple: when you hit 50%, take it. Don't get greedy. Close the entire spread with a market order and move on to the next trade.

This is NewLeaf System. Defined risk. Defined reward."""

    elif alert_type == "stop-loss":
        script = f"""NewLeaf System alert for {company}, ticker {symbol}.

Our {pos['strategy'] if pos else 'iron condor'} has hit the stop loss level. Close the position now.

The position has doubled in cost from our original credit. This is our pre-defined exit point. Don't hold hoping for a reversal.

Close the entire spread immediately. The loss is defined and manageable. This is why we trade defined-risk strategies.

This is NewLeaf System. Protect your capital."""

    elif alert_type == "time-exit":
        script = f"""NewLeaf System alert for {company}, ticker {symbol}.

We're two days from expiration. Time to close regardless of P&L.

Gamma risk explodes in the final 48 hours. Small price moves can cause massive swings in your position value. It's not worth the risk.

Close the spread today. Take whatever profit or small loss remains. The discipline of time-based exits is what separates professionals from gamblers.

This is NewLeaf System. Manage your risk."""

    elif alert_type == "adjust":
        script = f"""NewLeaf System alert for {company}, ticker {symbol}.

We're making an adjustment to our position. {action}.

The reason: {reason}.

This is a defensive move to protect our existing credit. Only make this adjustment if you can collect additional credit. If it requires a debit to roll, consider closing instead.

This is NewLeaf System. Active management, defined risk."""

    else:  # generic close
        script = f"""NewLeaf System alert for {company}, ticker {symbol}.

We're closing our {pos['strategy'] if pos else 'position'}. {reason}.

{action}.

This is NewLeaf System. Every exit is part of the plan."""

    alert["videoScript"] = script

    # Social post
    type_emoji = {"take-profit": "💰", "stop-loss": "🛑", "time-exit": "⏰", "adjust": "🔄", "close": "📋"}
    emoji = type_emoji.get(alert_type, "📋")
    alert["socialPost"] = f"{emoji} #{symbol} Alert: {action}. {reason}. #options #trading #newleafsystem"

    # Save alert
    alerts = load_alerts()
    alerts["alerts"].insert(0, alert)
    save_alerts(alerts)

    # Archive individual alert
    archive_path = ALERT_DIR / "archive" / f"{alert['id']}.json"
    with open(archive_path, 'w') as f:
        json.dump(alert, f, indent=2)

    # Save video script
    script_path = ALERT_DIR / f"{alert['id']}-script.md"
    with open(script_path, 'w') as f:
        f.write(f"# {symbol} Alert — {alert_type.replace('-', ' ').title()}\n\n")
        f.write(f"**Type:** {alert_type} | **Date:** {alert['date']} | **Duration:** ~30s\n\n---\n\n")
        f.write(script)
        f.write(f"\n\n---\n\n**Social Post:**\n{alert['socialPost']}\n")

    return alert


def cmd_take_profit(args):
    symbol = args[0].upper()
    pos = find_position(symbol)
    if not pos:
        print(f"No open position for {symbol}"); sys.exit(1)
    half_credit = pos["credit"] / 2
    alert = create_alert(symbol, "take-profit",
        f"Close {pos['strategy']} at ${half_credit:.2f} debit (50% profit)",
        f"Position reached 50% of max profit. Close to lock in gains.")
    print(f"Alert created: {alert['id']}")
    print(f"  Type: TAKE PROFIT")
    print(f"  Action: Close at ${half_credit:.2f} debit")
    print(f"  Script: alerts/{alert['id']}-script.md")


def cmd_stop_loss(args):
    symbol = args[0].upper()
    pos = find_position(symbol)
    if not pos:
        print(f"No open position for {symbol}"); sys.exit(1)
    double_credit = pos["credit"] * 2
    alert = create_alert(symbol, "stop-loss",
        f"Close {pos['strategy']} — position worth ${double_credit:.2f} debit (2x credit)",
        f"Stop loss triggered. Position doubled in cost.")
    print(f"Alert created: {alert['id']}")
    print(f"  Type: STOP LOSS")
    print(f"  Action: Close immediately")
    print(f"  Script: alerts/{alert['id']}-script.md")


def cmd_time_exit(args):
    symbol = args[0].upper()
    pos = find_position(symbol)
    if not pos:
        print(f"No open position for {symbol}"); sys.exit(1)
    alert = create_alert(symbol, "time-exit",
        f"Close {pos['strategy']} — 2 days before expiration",
        f"Time-based exit. Gamma risk too high in final 48 hours.")
    print(f"Alert created: {alert['id']}")
    print(f"  Type: TIME EXIT")
    print(f"  Script: alerts/{alert['id']}-script.md")


def cmd_adjust(args):
    symbol = args[0].upper()
    action = reason = ""
    i = 1
    while i < len(args):
        if args[i] == "--action" and i+1 < len(args): action = args[i+1]; i += 2
        elif args[i] == "--reason" and i+1 < len(args): reason = args[i+1]; i += 2
        else: i += 1
    if not action:
        print("--action required"); sys.exit(1)
    alert = create_alert(symbol, "adjust", action, reason or "Position adjustment required")
    print(f"Alert created: {alert['id']}")
    print(f"  Action: {action}")
    print(f"  Script: alerts/{alert['id']}-script.md")


def cmd_close(args):
    symbol = args[0].upper()
    exit_price = None; reason = ""
    i = 1
    while i < len(args):
        if args[i] == "--exit-price" and i+1 < len(args): exit_price = float(args[i+1]); i += 2
        elif args[i] == "--reason" and i+1 < len(args): reason = args[i+1]; i += 2
        else: i += 1
    alert = create_alert(symbol, "close",
        f"Close position{' at $'+str(exit_price)+' debit' if exit_price else ''}",
        reason or "Position being closed")
    print(f"Alert created: {alert['id']}")
    print(f"  Script: alerts/{alert['id']}-script.md")


def cmd_list(args):
    alerts = load_alerts()
    if not alerts["alerts"]:
        print("No alerts."); return
    print(f"Alerts ({len(alerts['alerts'])})")
    print(f"{'ID':<25} {'Type':<15} {'Action'}")
    print("-" * 70)
    for a in alerts["alerts"][:20]:
        print(f"{a['id']:<25} {a['type']:<15} {a['action'][:50]}")


def cmd_sync(args):
    print("Syncing alerts to R2...")
    with open(CONFIG_PATH) as f:
        r2 = json.load(f)["r2"]
    client = boto3.client("s3", endpoint_url=r2["endpoint"],
        aws_access_key_id=r2["accessKeyId"], aws_secret_access_key=r2["secretAccessKey"],
        region_name="auto", config=Config(signature_version="s3v4"))

    latest = ALERT_DIR / "latest.json"
    if latest.exists():
        with open(latest, "rb") as f:
            client.put_object(Bucket=r2["bucket"], Key="reports/alerts/latest.json",
                Body=f.read(), ContentType="application/json", CacheControl="public, max-age=60")
        print(f"  Uploaded: reports/alerts/latest.json")

    # Upload individual alert scripts
    for script in ALERT_DIR.glob("*-script.md"):
        with open(script, "rb") as f:
            client.put_object(Bucket=r2["bucket"], Key=f"reports/alerts/{script.name}",
                Body=f.read(), ContentType="text/markdown", CacheControl="public, max-age=3600")
        print(f"  Uploaded: reports/alerts/{script.name}")

    print(f"  Live: {r2['publicBaseUrl']}/reports/alerts/latest.json")


def main():
    ensure_dirs()
    if len(sys.argv) < 2:
        print("NewLeaf Alert Generator")
        print()
        print("Commands:")
        print("  take-profit SYMBOL     50% profit target alert")
        print("  stop-loss   SYMBOL     Stop loss alert")
        print("  time-exit   SYMBOL     2-day pre-expiry alert")
        print("  adjust SYMBOL --action '...' [--reason '...']")
        print("  close  SYMBOL --exit-price X.XX [--reason '...']")
        print("  list                   Show all alerts")
        print("  sync                   Upload to R2")
        sys.exit(0)

    commands = {
        "take-profit": cmd_take_profit, "stop-loss": cmd_stop_loss,
        "time-exit": cmd_time_exit, "adjust": cmd_adjust,
        "close": cmd_close, "list": cmd_list, "sync": cmd_sync,
    }
    cmd = sys.argv[1].lower()
    if cmd not in commands:
        print(f"Unknown: {cmd}. Available: {', '.join(commands)}"); sys.exit(1)
    commands[cmd](sys.argv[2:])


if __name__ == "__main__":
    main()
