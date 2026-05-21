# NewLeaf Pipeline

Automated options market data pipeline for the [NewLeaf](https://newleafsystem.com) trading system. Collects prices, IV, Greeks, and Open Interest for 111 symbols on a schedule, calculates gamma walls and opportunity scores, and publishes to Cloudflare R2 + Firebase Firestore.

## Quick Start

```bash
npm install
cp .env.template .env          # Add your Alpaca keys
# Edit config.json with R2 + API credentials

npm start                       # Start scheduler (runs all jobs on cron)
```

## What It Does

The scheduler (`index.js`) runs three jobs during market hours (Mon-Fri):

| Job | Schedule | What |
|-----|----------|------|
| **Fast pipeline** | Every 15 min, 9:30am-4pm ET | Alpaca prices + IV + Greeks for 111 symbols. 5 parallel workers. ~30 seconds. |
| **Daily OI enrichment** | 9:32am ET (once) | Fetches Open Interest from Nasdaq API, recalculates gamma walls, saves daily snapshot. |
| **Health check** | Every 5 min | Restarts Yahoo svc and server.cjs if down. |

After the daily OI job, it also runs:
- **Watchlist pipeline** — regenerates the manifest
- **Firestore sync** — pushes data to `gamma_analysis` collection

## Data Sources

```
Alpaca API ──────── prices, IV, Greeks, option chains
Nasdaq API ──────── Open Interest, volume (primary, ~80 symbols before rate limit)
Yahoo svc (:5300) ─ Open Interest fallback (Python Flask + yfinance)
```

The daily pipeline tries Nasdaq first. If Nasdaq returns empty OI for an expiry, it falls back to Yahoo. Each report tracks which source was used in `meta.dataSource.openInterest`.

## Data Flow

```
                    Alpaca (prices/Greeks)
                    Nasdaq (OI - primary)
                    Yahoo  (OI - fallback)
                            │
                    newleaf-pipeline.js
                            │
              ┌─────────────┼──────────────┐
              v             v              v
     reports/{SYM}/    R2 (CDN)      Firestore
     latest.json     public JSON    gamma_analysis
     {date}.json
```

**R2 upload rules:**
- `latest.json` — uploaded every run (intraday carries forward daily gamma data)
- `{date}.json` — uploaded only by daily pipeline, only if real OI data exists (not proxy)
- `{timestamp}.json` — uploaded every run (full history)

## File Structure

```
index.js                     # Node-cron scheduler (entry point)
newleaf-pipeline.js          # Core pipeline: fetch, analyze, score, upload
pipeline-fast.js             # Intraday wrapper (--intraday, concurrency=5)
pipeline-oi-enrichment.js    # Daily wrapper (--daily, concurrency=2)
pipeline-watchlist.js        # Manifest regeneration
gamma-analyzer-enhanced.js   # Multi-factor gamma wall detection + confidence
oi-tracker.js                # OI history + T vs T-1 delta calculation
sync-r2-to-firestore-fixed.mjs  # R2 -> Firestore sync
upload-to-r2.js              # Single file upload utility
save-atm-contracts.js        # ATM contract snapshots for strategy builder
sentiment-engine.js          # AI sentiment (Claude/Grok/Gemini/Reddit)
check-scheduler-health.sh    # Health check script
start.sh                     # Start scheduler as daemon
watchlist.json               # 111 symbols
company-metadata.json        # Sector + market cap per symbol
config.json                  # Credentials (gitignored)
lib/
  alpacaOptionsChain.js      # Alpaca chain fetch helpers
  gammaMetrics.js            # GEX calculations
  optionsHelpers.js          # Shared utilities
yahoo-svc/                   # Yahoo OI fallback (Python Flask)
  option_api.py              # GET /api/options/{SYM}/{EXPIRY}
  greeks_calculator.py       # Black-Scholes Greeks
  start.sh                   # Launch on port 5300
reports/                     # Local report cache (gitignored)
output/                      # Run logs (gitignored)
```

## Manual Commands

```bash
# Run fast pipeline once
node index.js --once

# Single symbol, full OI
node newleaf-pipeline.js AAPL --daily

# All symbols, daily mode
node newleaf-pipeline.js --watchlist --daily

# Re-upload local data to R2
node upload-to-r2.js reports/AAPL/2026-05-20.json reports/AAPL/2026-05-20.json

# Start Yahoo fallback service
cd yahoo-svc && ./start.sh

# Check Yahoo health
curl http://localhost:5300/health
```

## Gamma Wall Analysis

Each symbol gets gamma walls (put wall / call wall) calculated from Open Interest concentration:

- **Signal**: `(0.6 x OI) + (0.3 x OI Delta) + (0.1 x Volume)` per strike
- **Put wall**: Highest-scoring put strike below spot (support)
- **Call wall**: Highest-scoring call strike above spot (resistance)
- **Confidence**: Based on wall strength, band quality, OI coverage

When OI is unavailable (intraday mode), proxy walls are used (`spot x 0.98` / `spot x 1.02`) with 30% confidence.

## Scoring

Each symbol gets an opportunity score (0-100):

| Pillar | Max | Inputs |
|--------|-----|--------|
| Gamma | 40 | Wall strength, band width, OI concentration |
| IV | 35 | ATM implied volatility level |
| Trend | 25 | RSI, ADX, Bollinger Bands, trend state |

## Configuration

| File | Purpose |
|------|---------|
| `config.json` | Alpaca API keys, R2 credentials, Yahoo svc URL |
| `watchlist.json` | 111 symbols to scan |
| `company-metadata.json` | Sector and market cap per symbol |
| `serviceAccountKey.json` | Firebase service account for Firestore |
| `.env` | Environment overrides |

All credential files are gitignored.

## Frontend

The web frontend lives in a separate repo (`newleafsystem/`). The strategy builder at `workbench/strategy-builder.html` reads data from R2 and displays gamma walls, GEX charts, and strategy recommendations.

## Troubleshooting

**Gamma walls showing proxy data ($spot x 0.98/1.02, 0 contracts):**
1. Check R2: `curl https://pub-04bbb919022645b3a3f318b2ebdf48c0.r2.dev/reports/AAPL/{date}.json`
2. If `contracts_analyzed: 0`, re-upload local data: `node upload-to-r2.js reports/AAPL/{date}.json reports/AAPL/{date}.json`
3. Verify only one scheduler is running: `ps aux | grep "node.*index.js" | grep -v grep`

**Nasdaq rate limiting:**
- Hits after ~80 symbols. Yahoo svc handles the rest.
- If Yahoo is down, remaining symbols get proxy data.
- Check: `curl http://localhost:5300/health`

**Yahoo svc not running:**
- The scheduler auto-restarts it every 5 min via health check.
- Manual: `cd yahoo-svc && ./start.sh`
