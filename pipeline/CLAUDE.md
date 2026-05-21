# NewLeaf Pipeline — Claude Code Guidelines

## What This Repo Does

In-process scheduler for market data collection. Replaces system crontab with node-cron.

Runs three main jobs on schedule:
1. **Fast pipeline** (every 15 min, market hours) — Alpaca prices + IV for 111 symbols -> R2
2. **Daily OI enrichment** (9:32am ET) — Nasdaq OI data + gamma wall recalc -> R2 + Firestore sync
3. **Health check** (every 5 min) — Pipeline status monitoring

## Architecture

```
newleaf-pipeline/
  index.js                      # node-cron scheduler (entry point: npm start)
  newleaf-pipeline.js           # Core pipeline (Alpaca + Nasdaq OI + Yahoo fallback, scores, R2 upload)
  pipeline-fast.js              # 15-min wrapper (Alpaca only, 5 parallel workers)
  pipeline-oi-enrichment.js     # Daily wrapper (Nasdaq OI, concurrency=2)
  pipeline-watchlist.js         # Manifest regeneration
  sync-r2-to-firestore-fixed.mjs  # Syncs R2 data -> Firestore gamma_analysis collection
  sentiment-engine.js           # 4-engine AI sentiment (Claude/Grok/Gemini/Reddit)
  gamma-analyzer-enhanced.js    # Multi-factor gamma wall analysis + confidence scoring
  oi-tracker.js                 # OI history tracking + delta calculation (T vs T-1)
  upload-to-r2.js               # Single file upload utility for R2
  save-atm-contracts.js         # ATM contract snapshot saver
  save-watchlist-snapshot.js    # Watchlist snapshot for historical tracking
  check-scheduler-health.sh     # Health check script
  start.sh                      # Start scheduler daemon
  config.json                   # All credentials and settings (gitignored)
  watchlist.json                # 111 symbols to scan
  company-metadata.json         # Sector/market cap data per symbol
  lib/
    adapters/
      ibAdapter.js              # Interactive Brokers adapter (stub, future)
    optionsChain.js             # Adapter orchestration layer (planned)
    alpacaOptionsChain.js       # Alpaca chain fetch helpers
    gammaMetrics.js             # Gamma exposure calculations
    optionsHelpers.js           # Shared options utilities
  yahoo-svc/                    # Yahoo OI fallback service (Python Flask)
    option_api.py               # Flask API: expiries + option chains with OI via yfinance
    greeks_calculator.py        # Black-Scholes Greeks calculator
    requirements.txt            # Python deps: yfinance, flask, flask-cors
    start.sh                    # Launch script: PORT=5300 python3 option_api.py
  reports/                      # Local report cache (per-symbol JSON, gitignored)
  output/                       # Pipeline logs and run status
```

## Key Commands

```bash
# Scheduler
npm start                    # Start scheduler (production)
node index.js --once         # Run fast pipeline once and exit

# Manual pipeline runs
node newleaf-pipeline.js AAPL --daily        # Single symbol, full OI
node newleaf-pipeline.js --watchlist --daily  # All 111 symbols, full OI
node newleaf-pipeline.js --watchlist          # Intraday mode (Alpaca only, no OI)

# Wrappers
npm run fast                 # Fast pipeline (intraday, all symbols)
npm run daily                # Full daily pipeline
npm run oi                   # OI enrichment only
npm run sync                 # Sync R2 -> Firestore

# Yahoo OI service (fallback)
cd yahoo-svc && ./start.sh   # Start on port 5300
curl http://localhost:5300/health

# Utilities
node upload-to-r2.js reports/AAPL/latest.json reports/AAPL/latest.json
```

## Data Flow

```
Alpaca API (prices, Greeks)
  + Nasdaq API (OI, volume)    ──primary──┐
  + Yahoo svc (OI fallback)    ──fallback─┤
                                          v
                               newleaf-pipeline.js
                                          │
                            ┌─────────────┼──────────────┐
                            v             v              v
                   reports/{sym}/     R2 upload     Firestore sync
                   latest.json       (public CDN)  (gamma_analysis)
```

## OI Data Source Fallback Chain

The pipeline uses a two-tier fallback for Open Interest data:

1. **Nasdaq API** (primary) — free public endpoint, no API key needed
   - Expiries: `GET /api/quote/{SYMBOL}/option-chain?assetclass=stocks&limit=500`
   - Per-expiry OI: `GET /api/quote/{SYMBOL}/option-chain?assetclass=stocks&limit=200&expireDate={YYYY-MM-DD}`
   - Rate limited: ~80 symbols before 429 responses. Exponential backoff (3s/6s/12s/24s).

2. **Yahoo svc** (fallback) — Python Flask service using yfinance, port 5300
   - Expiries: `GET /api/options/{SYMBOL}` -> `{ expirations: [], currentPrice }`
   - Per-expiry OI: `GET /api/options/{SYMBOL}/{EXPIRY}` -> `{ calls: [], puts: [], summary }`
   - Must be started separately: `cd yahoo-svc && ./start.sh`
   - Checked at startup; cached as `_yahooAvailable` flag
   - Only called when Nasdaq returns empty OI for a given expiry

**Fallback logic** (per-symbol, per-expiry):
- If Nasdaq expiries fail -> try Yahoo expiries -> if both fail, throw
- For each expiry: try Nasdaq OI -> if empty, try Yahoo OI -> merge whatever we get
- `meta.dataSource.openInterest` in report tracks actual source: `nasdaq-api`, `yahoo-svc`, or `none`

## Pipeline Modes

| Mode | Flag | OI Source | Concurrency | Use Case |
|------|------|-----------|-------------|----------|
| Intraday | (default) | None (Alpaca only) | 5 | 15-min price updates during market hours |
| Daily | `--daily` | Nasdaq + Yahoo fallback | 2 | Morning OI enrichment |
| Full | neither flag | Nasdaq + Yahoo fallback | 2 | Full recalculation |

## Scoring System

Each symbol gets a score (0-100) from three pillars:
- **Gamma pillar** (0-40): Wall strength, band width, OI concentration
- **IV pillar** (0-35): ATM IV level assessment
- **Trend pillar** (0-25): RSI, ADX, Bollinger Bands, trend state

When OI is unavailable, gamma pillar falls back to technical proxy scoring (~22 max).

## Configuration

- `config.json` — Alpaca keys, R2 creds, sentiment API keys, watchlist, yahoosvc URL
- `watchlist.json` — 111 symbols with sector/cap metadata
- `serviceAccountKey.json` — Firebase service account (for Firestore sync)
- All config files are gitignored

## Nasdaq API

OI data is fetched from the public Nasdaq option chain API:
```
https://api.nasdaq.com/api/quote/{TICKER}/option-chain?assetclass={stocks|etf}&limit=200&expireDate={YYYY-MM-DD}
```

- ETFs (SPY, QQQ, GLD, etc.) use `assetclass=etf`
- Stocks (AAPL, NVDA, etc.) use `assetclass=stocks`
- No API key required — public endpoint
- Returns: strike, call/put OI, volume, bid/ask, last price
- Rate limits aggressively (~80 symbols per batch)

## Yahoo OI Service

Located in `yahoo-svc/`. Python Flask app using yfinance:
```
GET /health                          -> { status: "healthy" }
GET /api/options/{SYMBOL}            -> { expirations: [], currentPrice }
GET /api/options/{SYMBOL}/{EXPIRY}   -> { calls: [], puts: [], summary }
```

- Port: 5300 (configurable via PORT env var)
- Single-threaded Flask (prevents yfinance thread exhaustion)
- OI data is T-1 (yesterday's close), same freshness as Nasdaq
- Start: `cd yahoo-svc && ./start.sh`

## Known Issues

- `saveATMContracts is not a function` — ATM contract saver not wired up (non-fatal, logged)
- Nasdaq rate limits after ~80 symbols in a single batch run
- Yahoo svc must be started manually (not auto-started by scheduler)
- `parseNasdaqExpiryGroup()` uses UTC noon to avoid timezone off-by-one date parsing

## Critical Rules

- **Never modify reports/ directly** — generated by pipeline, uploaded to R2
- **Concurrency must stay <= 2 for daily/full mode** — Nasdaq rate limit protection
- **Always test with single symbol first** before running full watchlist
- **Yahoo svc is optional** — pipeline works without it, Nasdaq is primary
