# NewLeaf Pipeline — Claude Code Guidelines

## What This Repo Does

In-process scheduler for market data collection. Replaces system crontab with node-cron.

Runs six scheduled jobs plus a health check:
1. **Fast pipeline** (every 15 min, market hours Mon-Fri) — Alpaca prices + IV for 111 symbols -> R2
2. **Daily OI enrichment** (9:32am ET, Mon-Fri) — Nasdaq OI data (Yahoo Cloud Function fallback) + gamma wall recalc -> R2 + Firestore sync. Catch-up via health check if missed.
3. **Daily funnel** (10:00am ET, Mon-Fri) — Rank scanner signals, price top N, publish picks to Firestore tiles
4. **Event calendar refresh** (4:15pm ET, Mon-Fri) — Fetches next earnings dates from Yahoo Cloud Function (yfinance, per-symbol) + ex-div dates from FMP bulk API. Writes `event-calendar.json` (new format with provenance) + backward-compat `earnings-calendar.json` to web/scanner/, pipeline/, and web/workbench/. Coverage: ~79/111 earnings (ETFs excluded), ~6/111 ex-div.
5. **Weekly premium snapshot** (Fri 4:30pm ET) — Captures ATM call/put premiums for all 111 symbols -> R2 as `watchlist/premium-snapshots/{isoWeek}.json`. Catch-up via health check on Fri/Sat/Sun if missed.
6. **Health check** (every 5 min, always) — Auto-restarts server.cjs, catches up missed daily OI and weekly snapshot jobs

## Scheduler Must Be Running

The pipeline scheduler (`node index.js` / `npm start`) **must be running continuously** on the local machine for all jobs to fire. It uses `caffeinate` to prevent macOS idle sleep, but if the machine is shut down or the process dies, jobs will be missed. The health check catch-up mechanism recovers daily OI and weekly snapshots when the scheduler restarts, but intraday fast pipeline runs and the daily funnel are not recoverable.

**To start:** `cd pipeline && npm start`
**To verify:** Check for the `caffeinate` process and `node index.js` in `ps aux`

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
  yahoo-svc/                    # Yahoo OI fallback — deployed as Firebase Cloud Function
    option_api.py               # Flask API: expiries + option chains with OI via yfinance
    greeks_calculator.py        # Black-Scholes Greeks calculator
    main.py                     # Firebase Cloud Function entry point (wraps Flask app)
    firebase.json               # Firebase deployment config (python310, 2nd gen)
    .firebaserc                 # Firebase project: newleaf-trading
    requirements.txt            # Python deps: firebase-functions, yfinance, flask, etc.
    Dockerfile                  # Alternative Cloud Run deployment (not used)
    start.sh                    # Local dev only — not used in production
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

# Yahoo OI service (Firebase Cloud Function)
cd yahoo-svc && firebase deploy --only functions   # Redeploy
curl https://yahoo-options-svc-m2cty2vxuq-uc.a.run.app/health

# Utilities
node upload-to-r2.js reports/AAPL/latest.json reports/AAPL/latest.json
```

## Data Flow

```
Alpaca API (prices, Greeks)
  + Nasdaq API (OI, volume)    ──primary──┐
  + Yahoo Cloud Fn (OI fallback)──fallback─┤
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

2. **Yahoo Cloud Function** (fallback) — Firebase Cloud Function (2nd gen, Python 3.10)
   - Base URL: `https://yahoo-options-svc-m2cty2vxuq-uc.a.run.app`
   - Expiries: `GET /api/options/{SYMBOL}` -> `{ expirations: [], currentPrice }`
   - Per-expiry OI: `GET /api/options/{SYMBOL}/{EXPIRY}` -> `{ calls: [], puts: [], summary }`
   - Always available (no local startup needed), URL configured in `config.json → yahoosvc.url`
   - Only called when Nasdaq returns empty OI for a given expiry
   - Redeploy: `cd yahoo-svc && firebase deploy --only functions`

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

## Gamma Confidence (Blended)

Strategy selection gates (condor, BWB, directional) use a **blended confidence score**
combining four signals:

```
blendedConfidence = 0.40 × OI-absolute    (liquidity — enough OI for walls to be meaningful)
                  + 0.35 × GEX-relative   (concentration — gamma at the walls, not smeared)
                  + 0.15 × delta          (positioning — are OI positions actively building?)
                  + 0.10 × volume         (activity — is the market trading these strikes?)
```

**IMPORTANT: These weights are intuition-based, NOT outcome-validated.** No accuracy claims
should be made about strategy recommendations until the weights are tuned against real
pick_outcomes data. The blend discriminates (bell curve centered at ~0.52, strategies spread
across 5 types) but has not been proven to predict which structure actually profits.

**Condor gate** is set to 0.60, targeting the **top ~quartile** of blended confidence among
eligible symbols (band 3-15%, 50+ contracts). Delta is currently DARK in the blend (see
"Delta DARK" note below) — re-validate the 0.60 threshold once delta is re-enabled, checking
that it still captures roughly the top quartile (>12% and <40% of eligible symbols).

**Diagonal spread** is defined in `STRATEGIES` but its gate is **deferred** — the structure is
valid but the gate conditions aren't met today. Requirements for activation:
- Genuine moderate trend: ADX 15-25 (not the <20 "weak" population — those have no real lean)
- Cheap vol: IV/RV < 1.0 (not absolute IV >= 25% — that captures IV-rich names where selling
  premium is correct, not buying vega)
- Revisit when a scan shows a real population (3+ symbols) meeting both conditions.
The weak-ADX + absolute-IV gate was reverted after spot-checks showed it bought vega on
IV-rich names (JNJ IV/RV 1.55, NVDA 1.37) and made directional bets on non-trending stocks.

**Iron butterfly at ~25 symbols is correct**, not a fallback failure. These are genuinely
range-bound / moderate-confidence / no-vol-edge / no-trend names. The spot-check proved the
12 diagonal candidates actually belong in butterfly. Do not manufacture strategy diversity
for its own sake.

**Scoring pillar — ADX-aware (RESOLVED)**: The trendPillar in `calcScore()` now uses the
ADX-derived `strengthMult` (1.0/0.7/0.3) to attenuate the discrete trendScore. A weak-ADX
bullish stock gets trendPillar ≈15/25 instead of the old 20/25. The underlying trendScore
is still discrete (0.2/0.35/0.5/0.65/0.8) but the multiplier prevents the worst
number-vs-recommendation contradictions.

**Delta DARK in confidence blend**: `deltaConfidence` is intentionally excluded from the
gate-driving blended confidence (`DELTA_DARK = true` in `gamma-analyzer-enhanced.js`).
Without this, the scanner would include delta once OI history accumulates (2+ daily runs),
but discover passes `null` for `oiDeltaData` (no filesystem OI history access) — the same
ticker would get different `blended_confidence` and potentially different strategies on each
surface. Delta is still computed and exposed in report output (`analysis.delta_confidence`)
for diagnostic validation but does not affect strategy selection.
**Next plumbing fix (after outcome-tracking Layer 1)**: Give the API OI-history access
(read from R2 or Firestore instead of local FS), then flip `DELTA_DARK = false` on BOTH
sides simultaneously, and re-verify scanner === discover on a sample of tickers.

## Accuracy Status: DISCRIMINATES but NOT OUTCOME-VALIDATED

The recommendation engine produces a genuine six-strategy distribution matched to market
regimes (condor for strong walls, BWB for wide bands, calendar for low-IV neutrals,
directional for trending names). It discriminates — but no claim of accuracy, hit-rate, or
win-rate is earned until:

1. Synthetic `pick_outcomes` data is replaced with real trade outcomes
2. Outcomes are measured per strategy (did condors stay in range? did calendars capture vol expansion?)
3. Weights are tuned against actual P&L data, not intuition

**Do not use** "accurate", "proven", "X% win rate", or "track record" in any premium UI or
marketing copy that references the recommendation engine. "AI-recommended, regime-matched"
is the honest description. Specific files to audit:

- `web/workbench/projection.html` — frames 60-65% win-rate as how strategy "unfolds"
- `web/WEEKLY_PIPELINE_ARCHITECTURE.html` — contains hardcoded "67% win rate over 9 weeks"
- `web/src/picks/MonthlyPage.jsx`, `RecapPage.jsx` — display win-rate stats from data that
  is currently synthetic (the `DATA_SOURCE === 'synthetic'` banner is correctly implemented
  but must remain visible until real outcomes exist)
- `web/src/marketing/track-record/TrackRecordPage.jsx` — "verified options picks performance"
  claim needs the synthetic disclosure to stay prominent

## Known Bug Class: "Silently Null"

Watch for this pattern: **code reads a value that's silently null/0, and a downstream check
passes vacuously.** Three instances found during the 2026-05 recommendation audit:

1. **delta_confidence** — `calculateOIDelta()` returned null (no OI history), delta was 0,
   30% of the multi-factor signal was structurally dead. No error, no log.
2. **SMA200** — `sma(closes, 200)` returned 0 (only 172 bars), but `bullishOrder` checked
   `sma100 > sma200` which passed because any positive > 0. Both API and pipeline affected.
3. **BWB IV check** — `atmIv >= 0.25` always passed because atmIv was in percentage form
   (25.24), not decimal (0.2524). The gate was a no-op.

**How to catch it:** When adding a numeric threshold check, verify the upstream value is
actually populated with real data, not a default/zero/null that vacuously satisfies the
condition. Add explicit null guards (`if (value === null) return 'insufficient_data'`)
rather than defaulting to 0 and letting comparisons pass silently.

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

## Yahoo OI Service (Firebase Cloud Function)

Deployed as a Firebase Cloud Function (2nd gen, Python 3.10) in project `newleaf-trading`.
Source code in `yahoo-svc/` — always use the cloud version, never run locally.

```
Base URL: https://yahoo-options-svc-m2cty2vxuq-uc.a.run.app

GET /health                          -> { status: "healthy" }
GET /api/options/{SYMBOL}            -> { expirations: [], currentPrice }
GET /api/options/{SYMBOL}/{EXPIRY}   -> { calls: [], puts: [], summary }
```

- **Deployment**: `cd yahoo-svc && firebase deploy --only functions`
- 1024 MB memory, 120s timeout, max 2 instances, scales to zero when idle
- Single concurrency (yfinance is not thread-safe)
- OI data is T-1 (yesterday's close), same freshness as Nasdaq
- CORS enabled for all origins (GET only)

## Known Issues

- `saveATMContracts is not a function` — ATM contract saver not wired up (non-fatal, logged)
- Nasdaq rate limits after ~80 symbols in a single batch run
- `parseNasdaqExpiryGroup()` uses UTC noon to avoid timezone off-by-one date parsing

## Critical Rules

- **Never modify reports/ directly** — generated by pipeline, uploaded to R2
- **Concurrency must stay <= 2 for daily/full mode** — Nasdaq rate limit protection
- **Always test with single symbol first** before running full watchlist
- **Yahoo Cloud Function is always available** — Nasdaq is primary, Yahoo is auto-fallback
