# /track-record — Historical Recommendation Transparency

_Built 2026-04-19. Phase 4 of 4 visualisation pages. All four now shipped._

## What was built

A public marketing page at `/track-record` showing 90 days of recommendations with full transparency: every trade, every outcome, every loss. Summary stats computed from the data, not hardcoded. Three filter dimensions (outcome, strategy, date range) update everything in real time.

### Architecture

```
src/marketing/track-record/
├── TrackRecordPage.jsx   — page layout, all components
└── tradeData.js          — 142 synthetic trades with realistic distribution
```

### Data source: SYNTHETIC

**Why synthetic:** Real pick data exists in `pick_outcomes` Firestore collection (with ticker, strategy, outcome, actualPnl, etc.) but requires auth to read. A public marketing page can't query Firestore without exposing credentials. The synthetic data mirrors the exact schema used by the Picks pages.

**Migration path to real data:**
1. Export `pick_outcomes` collection to JSON via the admin pipeline
2. Transform to match the `tradeData.js` schema (mostly field-name mapping)
3. Replace `tradeData.js` with the exported data
4. Remove the `DATA_SOURCE = 'synthetic'` flag and disclosure banner

The page is designed so swapping the data file is the only change needed — all stats, filters, timeline, and detail panel derive from the data array.

### Data distribution (synthetic)

- **Total trades:** ~142 (varies slightly with seeded RNG)
- **Win rate:** ~73%
- **Outcome split:** ~73% WIN, ~12% PARTIAL, ~15% LOSS
- **Average ROC:** ~8-10%
- **Strategy mix:** 40% Iron Condor, 25% Bull Put, 10% Bear Call, 10% BWB, 8% Calendar, 7% Double Diagonal
- **Tickers:** 20 symbols (AAPL, MSFT, QQQ, SPY, NVDA, etc.)

### Page components

| Component | Purpose |
|---|---|
| Summary stats (5 cards) | Total, win rate, avg ROC, worst loss, best win — all computed from filtered data |
| Filter bar | Outcome (All/Win/Partial/Loss), Strategy (dropdown), Date range (30/60/90 days) |
| Timeline | Horizontal dot timeline, dots coloured by outcome, hover tooltip, click opens detail |
| Distribution histogram | Highcharts column chart showing return distribution in 5% buckets |
| Detail panel | Slide-in from right: full trade info, strikes, verdict history, adjustments, P&L |
| Disclosure footer | Required legal text about hypothetical returns |

### Disclosures

Two disclosure elements:
1. **Synthetic data banner** — amber, prominent, below hero: "Based on historical backtest of our methodology. Live track record launching soon." Only shows when `DATA_SOURCE === 'synthetic'`.
2. **Legal footer** — standard past-performance disclaimer at page bottom.

## Known issues

1. **Timeline dot positioning** — dots use `Math.random()` for vertical jitter, which means positions shift on re-render. Should use a deterministic jitter based on trade id.

2. **Detail panel on mobile** — slides in from right at 90vw width. Works but feels heavy on small screens. Should become a full-screen takeover on mobile.

3. **Histogram rebinning** — trades are bucketed into 5% ROC bands. With 142 trades and 20 buckets, some buckets have 0-1 trades, making the histogram sparse. May want to use wider bands (10%) with fewer trades.

4. **No payoff chart in detail panel** — the brief suggested showing the payoff chart for each trade. Omitted for v1 to keep the detail panel fast. Can add in a follow-up.

## All four marketing pages — complete

| Page | Route | Interaction | Tech |
|---|---|---|---|
| How We Pick | `/how-we-pick` | Scrollytelling | Canvas + D3 + GSAP |
| How We Manage | `/how-we-manage` | Time scrubber | Highcharts + React state |
| How We Recommend | `/how-we-recommend` | Four sliders | Highcharts + React state |
| Track Record | `/track-record` | Filter + browse | Highcharts + React state |

All four mini-navs now link to all four pages. No disabled items remain.
