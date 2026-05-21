#!/usr/bin/env python3
"""
NewLeaf Report Generator — Single command to generate everything.

Usage:
    python3 newleaf-report.py SHOP                          # iron condor, nearest monthly expiry
    python3 newleaf-report.py SHOP --expiry 2026-04-24      # specific expiry
    python3 newleaf-report.py SHOP --strategy put-spread    # put credit spread
    python3 newleaf-report.py SHOP --strategy call-spread   # call credit spread
    python3 newleaf-report.py SHOP --strategy iron-condor   # explicit (default)
    python3 newleaf-report.py SHOP --no-upload              # skip R2 upload
    python3 newleaf-report.py SHOP --portrait-only          # skip landscape
    python3 newleaf-report.py SHOP --no-search              # skip web search, use defaults

Pipeline:
    1. Fetch option chain (Alpaca + Yahoo)
    2. Select strikes based on strategy + gamma walls
    3. Web search for macro/company/analyst context
    4. Build JSON data file
    5. Generate landscape PDF (10 pages)
    6. Generate portrait PDF (9 pages)
    7. Generate video scripts (full + brief)
    8. Upload everything to R2
    9. Print summary with URLs

Supported Strategies:
    iron-condor   — 4-leg neutral (sell put spread + sell call spread)
    put-spread    — 2-leg bullish (sell put, buy lower put)
    call-spread   — 2-leg bearish (sell call, buy higher call)
"""

import sys
import os
import json
import ssl
import subprocess
import urllib.request
from datetime import datetime, date, timedelta
from pathlib import Path

# Fix macOS SSL cert issue
try:
    _ctx = ssl.create_default_context()
    _ctx.check_hostname = False
    _ctx.verify_mode = ssl.CERT_NONE
except Exception:
    _ctx = None

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
OUTPUT_DIR = BASE_DIR / "output"

STRATEGIES = {
    "iron-condor": {"legs": 4, "direction": "neutral", "label": "Iron Condor"},
    "put-spread": {"legs": 2, "direction": "bullish", "label": "Put Credit Spread"},
    "call-spread": {"legs": 2, "direction": "bearish", "label": "Call Credit Spread"},
}

COMPANY_NAMES = {
    "NVDA": "NVIDIA Corporation", "ADBE": "Adobe Inc.", "QQQ": "Invesco QQQ Trust",
    "CRM": "Salesforce Inc.", "AAPL": "Apple Inc.", "MSFT": "Microsoft Corp.",
    "GOOGL": "Alphabet Inc.", "AMZN": "Amazon.com Inc.", "META": "Meta Platforms Inc.",
    "TSLA": "Tesla Inc.", "SPY": "SPDR S&P 500 ETF", "IWM": "iShares Russell 2000 ETF",
    "SLV": "iShares Silver Trust", "BABA": "Alibaba Group", "AMD": "AMD Inc.",
    "NFLX": "Netflix Inc.", "DIS": "Walt Disney Co.", "BA": "Boeing Co.",
    "SHOP": "Shopify Inc.", "SQ": "Block Inc.", "UBER": "Uber Technologies",
    "COIN": "Coinbase Global", "PLTR": "Palantir Technologies", "SNOW": "Snowflake Inc.",
    "CRWD": "CrowdStrike Holdings", "ZS": "Zscaler Inc.", "NET": "Cloudflare Inc.",
    "DDOG": "Datadog Inc.", "MDB": "MongoDB Inc.", "PANW": "Palo Alto Networks",
    "SOFI": "SoFi Technologies", "RIVN": "Rivian Automotive", "LCID": "Lucid Group",
    "PYPL": "PayPal Holdings", "INTC": "Intel Corp.", "AVGO": "Broadcom Inc.",
    "JPM": "JPMorgan Chase", "GS": "Goldman Sachs", "BAC": "Bank of America",
    "XOM": "Exxon Mobil", "CVX": "Chevron Corp.", "LLY": "Eli Lilly",
    "UNH": "UnitedHealth Group", "JNJ": "Johnson & Johnson", "PFE": "Pfizer Inc.",
    "WMT": "Walmart Inc.", "COST": "Costco Wholesale", "HD": "Home Depot",
}


def log(msg):
    print(f"  {msg}")


def step(n, title):
    print(f"\n{'='*60}")
    print(f"  Step {n}: {title}")
    print(f"{'='*60}")


# ─────────────────────────────────────────────────────────────
# Config: Alpaca API keys (direct, no gateway needed)
# ─────────────────────────────────────────────────────────────
ALPACA_CONFIG_PATH = BASE_DIR.parent / "newleaf-alpaca-r2" / "pipeline" / "config.json"

def get_alpaca_keys():
    if ALPACA_CONFIG_PATH.exists():
        with open(ALPACA_CONFIG_PATH) as f:
            cfg = json.load(f)
        return cfg.get("alpaca", {}).get("apiKey", ""), cfg.get("alpaca", {}).get("secretKey", "")
    return os.environ.get("ALPACA_API_KEY", ""), os.environ.get("ALPACA_API_SECRET", "")


def alpaca_get(path, params=None, base="data"):
    """Direct Alpaca API call (no gateway)."""
    key, secret = get_alpaca_keys()
    if base == "data":
        url = f"https://data.alpaca.markets/v1beta1{path}"
    elif base == "data2":
        url = f"https://data.alpaca.markets/v2{path}"
    else:
        url = f"https://api.alpaca.markets/v2{path}"

    if params:
        qs = "&".join(f"{k}={v}" for k, v in params.items())
        url += f"?{qs}"

    req = urllib.request.Request(url, headers={
        "APCA-API-KEY-ID": key,
        "APCA-API-SECRET-KEY": secret,
    })
    with urllib.request.urlopen(req, timeout=15, context=_ctx) as resp:
        return json.loads(resp.read())


def yahoo_get(symbol, expiry=None):
    """Fetch from Yahoo Options service (localhost:5300) or yfinance directly."""
    # Try localhost first (faster if running)
    try:
        if expiry:
            url = f"http://localhost:5300/api/options/{symbol}/{expiry}"
        else:
            url = f"http://localhost:5300/api/options/{symbol}"
        with urllib.request.urlopen(url, timeout=5) as resp:
            return json.loads(resp.read())
    except Exception:
        pass

    # Fallback: use yfinance directly
    try:
        import yfinance as yf
        import math
        ticker = yf.Ticker(symbol)
        if not expiry:
            return {"expirations": list(ticker.options)}
        chain = ticker.option_chain(expiry)

        def clean(v, default=0):
            """Handle NaN, None, inf from yfinance."""
            if v is None: return default
            try:
                if math.isnan(v) or math.isinf(v): return default
            except (TypeError, ValueError):
                pass
            return v

        calls = [{"strike": r.strike, "bid": clean(r.bid), "ask": clean(r.ask),
                   "lastPrice": clean(r.lastPrice),
                   "volume": int(clean(r.volume, 0)), "openInterest": int(clean(r.openInterest, 0)),
                   "impliedVolatility": clean(r.impliedVolatility, 0),
                   "inTheMoney": bool(r.inTheMoney) if r.inTheMoney is not None else False,
                   "optionType": "call", "contractSymbol": str(r.contractSymbol)}
                  for _, r in chain.calls.iterrows()]
        puts = [{"strike": r.strike, "bid": clean(r.bid), "ask": clean(r.ask),
                  "lastPrice": clean(r.lastPrice),
                  "volume": int(clean(r.volume, 0)), "openInterest": int(clean(r.openInterest, 0)),
                  "impliedVolatility": clean(r.impliedVolatility, 0),
                  "inTheMoney": bool(r.inTheMoney) if r.inTheMoney is not None else False,
                  "optionType": "put", "contractSymbol": str(r.contractSymbol)}
                 for _, r in chain.puts.iterrows()]
        info = ticker.info
        price = clean(info.get("regularMarketPrice")) or clean(info.get("previousClose")) or clean(info.get("open", 0))
        return {"calls": calls, "puts": puts, "currentPrice": price,
                "symbol": symbol, "expiration": expiry}
    except Exception as e:
        print(f"  ERROR: Yahoo fetch failed (localhost:5300 down and yfinance failed): {e}")
        print(f"  Install yfinance: pip install yfinance")
        print(f"  Or start Yahoo service: cd ~/dev/OptionAdvisor/yahoooption && python3 app.py")
        sys.exit(1)


# ─────────────────────────────────────────────────────────────
# Step 1: Fetch option chain
# ─────────────────────────────────────────────────────────────
def alpaca_stock_price(symbol):
    """Get current stock price from Alpaca."""
    try:
        data = alpaca_get(f"/stocks/{symbol}/snapshot", base="data2")
        return data.get("latestTrade", {}).get("p") or data.get("dailyBar", {}).get("c", 0)
    except Exception:
        return 0


def fetch_chains(symbol, expiry):
    """Fetch option chain. Primary: Alpaca. Yahoo: expiry list + IV only."""
    yahoo_path = f"/tmp/{symbol.lower()}_chain.json"
    alpaca_path = f"/tmp/{symbol.lower()}_alpaca.json"

    # Yahoo (for IV and as fallback for current price)
    log(f"Fetching Yahoo chain for {symbol} {expiry}...")
    yahoo_data = yahoo_get(symbol, expiry)

    # Get stock price: Alpaca first, Yahoo fallback
    alpaca_price = alpaca_stock_price(symbol)
    if alpaca_price and alpaca_price > 0:
        yahoo_data["currentPrice"] = alpaca_price
        log(f"Stock price from Alpaca: ${alpaca_price:.2f}")

    with open(yahoo_path, 'w') as f:
        json.dump(yahoo_data, f)
    log(f"Yahoo: {len(yahoo_data.get('calls',[]))} calls, {len(yahoo_data.get('puts',[]))} puts, price=${yahoo_data.get('currentPrice','?')}")

    # Alpaca (for live bid/ask, VWAP, volume)
    log(f"Fetching Alpaca chain for {symbol} {expiry}...")
    try:
        # Fetch contracts first to get OCC symbols
        contracts_data = alpaca_get(f"/options/contracts", {
            "underlying_symbols": symbol,
            "expiration_date": expiry,
            "limit": "250",
        }, base="trade")

        occ_symbols = [c["symbol"] for c in contracts_data.get("option_contracts", [])]

        # Fetch snapshots in batches of 100
        all_contracts = []
        for i in range(0, len(occ_symbols), 100):
            batch = occ_symbols[i:i+100]
            snap_data = alpaca_get(f"/options/snapshots", {
                "symbols": ",".join(batch),
                "feed": "indicative",
            }, base="data")

            snapshots = snap_data.get("snapshots", {})
            for occ, snap in snapshots.items():
                quote = snap.get("latestQuote", {})
                trade = snap.get("latestTrade", {})
                greeks = snap.get("greeks", {})
                # Find contract info
                contract_info = next((c for c in contracts_data.get("option_contracts", []) if c["symbol"] == occ), {})

                all_contracts.append({
                    "symbol": occ,
                    "underlying": symbol,
                    "expiry": expiry,
                    "type": contract_info.get("type", "call" if "C" in occ else "put"),
                    "strike": float(contract_info.get("strike_price", 0)),
                    "bid": quote.get("bp", 0),
                    "ask": quote.get("ap", 0),
                    "mid": (quote.get("bp", 0) + quote.get("ap", 0)) / 2,
                    "bidSize": quote.get("bs", 0),
                    "askSize": quote.get("as", 0),
                    "quoteTime": quote.get("t", ""),
                    "lastPrice": trade.get("p", 0),
                    "lastSize": trade.get("s", 0),
                    "tradeTime": trade.get("t", ""),
                    "volume": snap.get("dailyBar", {}).get("v", 0),
                    "vwap": snap.get("dailyBar", {}).get("vw", 0),
                    "trades": snap.get("dailyBar", {}).get("n", 0),
                    "openInterest": contract_info.get("open_interest"),
                    "delta": greeks.get("delta"),
                    "gamma": greeks.get("gamma"),
                    "theta": greeks.get("theta"),
                    "vega": greeks.get("vega"),
                    "iv": greeks.get("implied_volatility"),
                })

        alpaca_result = {"ok": True, "contracts": all_contracts, "count": len(all_contracts)}
        with open(alpaca_path, 'w') as f:
            json.dump(alpaca_result, f)
        log(f"Alpaca: {len(all_contracts)} contracts (direct API)")

    except Exception as e:
        log(f"WARNING: Alpaca fetch failed ({e}), using Yahoo only")
        with open(alpaca_path, 'w') as f:
            json.dump({"contracts": [], "count": 0}, f)

    return yahoo_path, alpaca_path


def find_expiry(symbol):
    """Find the nearest monthly expiry ~2-4 weeks out."""
    log(f"Finding best expiry for {symbol}...")
    try:
        data = yahoo_get(symbol)
        expiries = data.get("expirations", data.get("expiration_dates", []))

        # Find expiry 14-30 days out
        today = date.today()
        target_min = today + timedelta(days=14)
        target_max = today + timedelta(days=35)

        for exp in expiries:
            exp_date = date.fromisoformat(exp)
            if target_min <= exp_date <= target_max:
                log(f"Selected expiry: {exp} ({(exp_date - today).days} DTE)")
                return exp

        # Fallback: first expiry > 10 days out
        for exp in expiries:
            exp_date = date.fromisoformat(exp)
            if (exp_date - today).days > 10:
                log(f"Selected expiry: {exp} ({(exp_date - today).days} DTE)")
                return exp

        print(f"  ERROR: No suitable expiry found for {symbol}")
        print(f"  Available: {expiries[:5]}")
        sys.exit(1)
    except Exception as e:
        print(f"  ERROR: Could not fetch expiries: {e}")
        sys.exit(1)


# ─────────────────────────────────────────────────────────────
# Step 2: Build data JSON
# ─────────────────────────────────────────────────────────────
def build_data(symbol, expiry, strategy, yahoo_path, alpaca_path):
    """Run build-report-data.py to create the JSON."""
    log(f"Building {strategy} data for {symbol}...")
    cmd = [sys.executable, str(BASE_DIR / "build-report-data.py"), symbol, expiry]
    result = subprocess.run(cmd, capture_output=True, text=True, cwd=str(BASE_DIR))
    if result.returncode != 0:
        print(f"  ERROR: {result.stderr}")
        sys.exit(1)
    log(result.stdout.strip().split('\n')[-1])

    json_path = DATA_DIR / f"{symbol.lower()}-iron-condor-v2.json"

    # Update strategy name if not iron condor
    if strategy != "iron-condor":
        with open(json_path) as f:
            data = json.load(f)
        strat_info = STRATEGIES[strategy]
        data["STRATEGY_NAME"] = strat_info["label"]
        # For put/call spreads, zero out the unused side
        if strategy == "put-spread":
            data["SHORT_CALL_STRIKE"] = ""
            data["LONG_CALL_STRIKE"] = ""
            data["SHORT_CALL_PREMIUM"] = ""
            data["LONG_CALL_PREMIUM"] = ""
        elif strategy == "call-spread":
            data["SHORT_PUT_STRIKE"] = ""
            data["LONG_PUT_STRIKE"] = ""
            data["SHORT_PUT_PREMIUM"] = ""
            data["LONG_PUT_PREMIUM"] = ""
        with open(json_path, 'w') as f:
            json.dump(data, f, indent=2)

    return json_path


# ─────────────────────────────────────────────────────────────
# Step 3: Web search for context
# ─────────────────────────────────────────────────────────────
def enrich_with_search(symbol, json_path):
    """
    Print the web search queries. In Claude CLI, this is where
    web search would be called and results injected.
    For automated runs, the hardcoded defaults from build-report-data.py are used.
    """
    company = COMPANY_NAMES.get(symbol, symbol)
    log(f"Context for {symbol} ({company}):")
    log(f"  To enrich with live data, run these web searches:")
    log(f"  1. MACRO:   stock market macro outlook April 2026 {symbol} sector")
    log(f"  2. COMPANY: {company} {symbol} stock news April 2026 earnings")
    log(f"  3. ANALYST: {symbol} analyst ratings consensus price target 2026")
    log(f"  (Using defaults for now — run in Claude CLI for live web search)")


# ─────────────────────────────────────────────────────────────
# Step 4-5: Generate PDFs
# ─────────────────────────────────────────────────────────────
def generate_pdfs(symbol, portrait_only=False):
    """Generate landscape and portrait PDFs."""
    results = {}

    # Landscape
    if not portrait_only:
        log("Generating landscape PDF...")
        cmd = [sys.executable, str(BASE_DIR / "generate-report.py"), symbol]
        r = subprocess.run(cmd, capture_output=True, text=True, cwd=str(BASE_DIR))
        if r.returncode == 0:
            # Find the generated file
            for line in r.stdout.split('\n'):
                if 'output/reports/' in line:
                    path = line.strip().split('/')[-1]
                    results["landscape"] = OUTPUT_DIR / "reports" / path
                    break
            if "landscape" not in results:
                # Guess the path
                ts = datetime.now().strftime("%Y%m%d")
                results["landscape"] = OUTPUT_DIR / "reports" / f"{symbol.upper()}-Iron-Condor-{ts}.pdf"
            log(f"Landscape: {results['landscape'].name}")
        else:
            log(f"WARNING: Landscape generation failed")

    # Portrait
    log("Generating portrait PDF...")
    cmd = [sys.executable, str(BASE_DIR / "generate-report.py"), symbol, "--portrait"]
    r = subprocess.run(cmd, capture_output=True, text=True, cwd=str(BASE_DIR))
    if r.returncode == 0:
        ts = datetime.now().strftime("%Y%m%d")
        results["portrait"] = OUTPUT_DIR / "reports" / f"{symbol.upper()}-Iron-Condor-Portrait-{ts}.pdf"
        log(f"Portrait: {results['portrait'].name}")
    else:
        log(f"WARNING: Portrait generation failed")

    return results


# ─────────────────────────────────────────────────────────────
# Step 6: Generate video scripts
# ─────────────────────────────────────────────────────────────
def generate_scripts(symbol):
    """Generate full + brief video scripts."""
    results = {}

    for mode, flag in [("full", []), ("brief", ["--short"])]:
        cmd = [sys.executable, str(BASE_DIR / "generate-script.py"), symbol] + flag
        r = subprocess.run(cmd, capture_output=True, text=True, cwd=str(BASE_DIR))
        if r.returncode == 0:
            suffix = "-brief" if flag else ""
            results[mode] = OUTPUT_DIR / "scripts" / f"{symbol.upper()}-video-script{suffix}.md"
            log(f"Script ({mode}): {results[mode].name}")

    return results


# ─────────────────────────────────────────────────────────────
# Step 7: Upload to R2
# ─────────────────────────────────────────────────────────────
def upload_to_r2(symbol):
    """Upload all files to R2."""
    cmd = [sys.executable, str(BASE_DIR / "upload-to-r2.py"), symbol]
    r = subprocess.run(cmd, capture_output=True, text=True, cwd=str(BASE_DIR))
    if r.returncode == 0:
        # Extract public URLs
        urls = [l.strip() for l in r.stdout.split('\n') if 'r2.dev/' in l]
        for url in urls:
            log(url)
        return urls
    else:
        log(f"WARNING: Upload failed: {r.stderr[:200]}")
        return []


# ─────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────
def main():
    if len(sys.argv) < 2 or sys.argv[1].startswith("-"):
        print("NewLeaf Report Generator")
        print()
        print("Usage:")
        print("  python3 newleaf-report.py SHOP")
        print("  python3 newleaf-report.py SHOP --expiry 2026-04-24")
        print("  python3 newleaf-report.py SHOP --strategy put-spread")
        print()
        print("Strategies:")
        for key, info in STRATEGIES.items():
            print(f"  {key:15s}  {info['label']} ({info['legs']}-leg, {info['direction']})")
        print()
        print("Flags:")
        print("  --expiry DATE      Specific expiry (YYYY-MM-DD)")
        print("  --strategy NAME    Strategy type (default: iron-condor)")
        print("  --no-upload        Skip R2 upload")
        print("  --portrait-only    Skip landscape PDF")
        print("  --no-search        Skip web search prompts")
        sys.exit(0)

    # Parse args
    symbol = sys.argv[1].upper()
    expiry = None
    strategy = "iron-condor"
    do_upload = True
    portrait_only = False
    do_search = True

    i = 2
    while i < len(sys.argv):
        arg = sys.argv[i]
        if arg == "--expiry" and i + 1 < len(sys.argv):
            expiry = sys.argv[i + 1]
            i += 2
        elif arg == "--strategy" and i + 1 < len(sys.argv):
            strategy = sys.argv[i + 1]
            i += 2
        elif arg == "--no-upload":
            do_upload = False
            i += 1
        elif arg == "--portrait-only":
            portrait_only = True
            i += 1
        elif arg == "--no-search":
            do_search = False
            i += 1
        else:
            i += 1

    if strategy not in STRATEGIES:
        print(f"Unknown strategy: {strategy}")
        print(f"Available: {', '.join(STRATEGIES.keys())}")
        sys.exit(1)

    company = COMPANY_NAMES.get(symbol, symbol)
    strat_label = STRATEGIES[strategy]["label"]

    print()
    print("=" * 60)
    print(f"  NewLeaf Report Generator")
    print(f"  {symbol} ({company}) — {strat_label}")
    print("=" * 60)

    # Step 1: Find expiry if not provided
    step(1, "Fetch Option Chain")
    if not expiry:
        expiry = find_expiry(symbol)
    yahoo_path, alpaca_path = fetch_chains(symbol, expiry)

    # Step 2: Build data JSON
    step(2, "Build Trade Data")
    json_path = build_data(symbol, expiry, strategy, yahoo_path, alpaca_path)

    # Step 3: Web search context
    if do_search:
        step(3, "Market Context (Web Search)")
        enrich_with_search(symbol, json_path)

    # Step 4-5: Generate PDFs
    step(4, "Generate PDFs")
    pdfs = generate_pdfs(symbol, portrait_only)

    # Step 6: Generate scripts
    step(5, "Generate Video Scripts")
    scripts = generate_scripts(symbol)

    # Step 7: Upload
    if do_upload:
        step(6, "Upload to R2")
        urls = upload_to_r2(symbol)

    # Summary
    print()
    print("=" * 60)
    print(f"  COMPLETE — {symbol} {strat_label}")
    print("=" * 60)
    print()

    with open(json_path) as f:
        d = json.load(f)

    print(f"  Symbol:      {symbol} ({company})")
    print(f"  Strategy:    {strat_label}")
    print(f"  Price:       {d.get('CURRENT_PRICE', 'N/A')}")
    print(f"  Expiry:      {expiry} ({d.get('DAYS_TO_EXPIRY', '?')} DTE)")
    print(f"  Strikes:     {d.get('LONG_PUT_STRIKE','')}/{d.get('SHORT_PUT_STRIKE','')}P | {d.get('SHORT_CALL_STRIKE','')}/{d.get('LONG_CALL_STRIKE','')}C")
    print(f"  Credit:      {d.get('NET_CREDIT', 'N/A')}")
    print(f"  Max Profit:  {d.get('MAX_PROFIT', 'N/A')}")
    print(f"  Max Loss:    {d.get('MAX_LOSS', 'N/A')}")
    print(f"  Win Rate:    {d.get('WIN_RATE', 'N/A')}%")
    print(f"  Score:       {d.get('TRADE_SCORE', 'N/A')}/100 ({d.get('CONFIDENCE_LEVEL', '')})")
    print()

    print("  Generated files:")
    for name, path in {**pdfs, **scripts}.items():
        if isinstance(path, Path) and path.exists():
            size = path.stat().st_size / 1024
            print(f"    {name:12s}  {path.name} ({size:.0f} KB)")
    print(f"    {'data':12s}  {json_path.name}")

    if do_upload:
        print()
        print(f"  Index page:  https://pub-04bbb919022645b3a3f318b2ebdf48c0.r2.dev/reports/index.html")

    print()


if __name__ == "__main__":
    main()
