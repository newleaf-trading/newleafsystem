# Phase 4a — Decide: Evaluate Mode

_Completed 2026-04-18._

## What shipped

The strategy detail page (`/trading/strategy/:id`) now renders a complete **Evaluate mode** for unowned strategies. Manage mode remains a skeleton (Phase 4b).

### StrategyDetailPage.jsx — full rewrite (was skeleton from Phase 2)

**Data layer:**
- Fetches tile from `tiles` prop (passed from TradingLayout)
- Fetches analysis from `analyses/:tileId` in Firestore (thesis, technicals, risks)
- Subscribes to live price via `PriceContext`
- Derives metrics (maxProfit, maxLoss, R:R, probability, breakevens) from legs via `calculateMetrics()`
- Computes evaluate status pill from probability + R:R thresholds

**Evaluate hero:**
- Status pill: Good setup (green, prob >= 55% and R:R >= 0.3), Marginal (amber, prob >= 40%), Avoid (red)
- Strategy badge with theme colour
- DTE + published date
- Ticker (Playfair serif 36px) + company name + live price
- Thesis one-liner: first sentence from `analysis.strategyRationale.whyThisStrategy`, with fallback to generated text referencing direction and probability
- CTAs: "Take this trade" (gold, routes to `/trading/build?add=:id`) + "Save for later" (ghost, adds to shortlist)

**Vitals row:** Max Profit, Max Loss, Reward:Risk (primary gradient), Probability — 4 tiles, real data.

**Four tabs (all functional):**

| Tab | Content |
|---|---|
| **Setup** (default) | Legs table (Action pill, Type, Strike, Expiry, Premium, Delta). Net Credit/Debit summary tile with per-contract dollar amount. Profit zone tile showing breakeven range + current spot price. |
| **Thesis** | Rationale blocks (Why this strategy? Why these strikes? Why this expiry?). Alternatives considered list. Technical context summary (RSI, IV Rank, Trend, BB Width) from `analyses` collection. Falls back to "not available" message when no analysis exists. |
| **Chart** | P&L at expiration via existing `PnLChart` component (pure SVG). Below-chart tiles: max profit, max loss, breakevens. |
| **Risks** | Risk cards with left-accent stripe: Max Pain Scenario, Earnings Risk, Dividend Risk, Event Risk. Management Plan card (green accent). Sourced from `analysis.riskAnalysis`. Falls back to "not available" message. |

**Content rules enforced (per brief §10.2):**
- Thesis one-liner references actual direction/probability, not generic phrases
- Confidence score not shown anywhere on hero or vitals (lives in Thesis tab technical context)
- No entry P&L, time decay, or breach status shown (meaningless pre-entry)
- No post-entry content in Evaluate mode

### Manage mode (skeleton only)
- Verdict pill from `useVerdict` (stubbed ON_TRACK)
- Verdict reason text
- 4 vitals tiles (placeholder dashes except DTE and probability)
- Tab bar showing Now / Position / Chart / Adjust / History
- "Will be implemented in Phase 4b" placeholder

## Shared sub-components added (within StrategyDetailPage.jsx)

| Component | Purpose |
|---|---|
| `VitalTile` | Single metric tile with label, value, colour semantics, optional primary gradient |
| `TechTile` | Technical indicator tile with label, value, signal badge, description |
| `SetupTab` | Legs table + net credit/debit + profit zone |
| `ThesisTab` | Rationale blocks + alternatives + tech context summary |
| `ChartTab` | PnLChart wrapper + below-chart metric tiles |
| `RisksTab` | Risk event cards with left-accent stripes |

## Design decisions

1. **Status pill thresholds** (Good/Marginal/Avoid) — exact formula in `StrategyDetailPage.jsx`:

   ```
   probability = tile.oddsOfProfit || tile.probOfProfit
                 || lottery.oddsOfProfit || technical.probability || 0

   rewardRisk  = maxLoss > 0 ? maxProfit / maxLoss
                 : (maxProfit > 0 ? Infinity : 0)

   evalStatus =
     probability >= 55 AND rewardRisk >= 0.30  →  Good setup  (green)
     probability >= 40                         →  Marginal    (amber)
     else                                      →  Avoid       (red)
   ```

   Evaluation order: Good is checked first (both conditions must pass), then Marginal (probability only), then Avoid is the fallback. These are initial values — tune after reviewing real tile data.

2. **Thesis one-liner extraction**: Takes the first sentence from `whyThisStrategy` in the analysis document. If no analysis exists, generates a fallback from strategy direction + probability. This keeps the hero always populated.

3. **Legs table includes Delta column**: Even though Delta is a live metric, showing the entry/published delta helps the investor understand directional bias at entry. The value comes from the tile's leg data.

4. **All tab content is inlined** (not separate components in `/components/`): Kept in StrategyDetailPage.jsx for Phase 4a to make the evaluate/manage mode split clear. Phase 4b may extract shared components (e.g. ChartTab could be shared between modes).

5. **PnLChart reused as-is**: The existing pure SVG P&L chart component works well for the Chart tab. No changes needed.

## What was punted to Phase 4b

- Manage mode: full hero with verdict-driven CTA, live P&L, exit signal strip
- Now tab: "what's changed since entry" comparison tiles
- Position tab: entry vs current leg table with per-leg P&L
- Adjust tab: adjustment picker (will be Phase 6 content embedded here)
- History tab: entry event, prior adjustments, P&L path
- Mode-specific chart (entry price marker distinct from current price marker)

## What to watch for

- The `calculateMetrics()` function from `optionsCalc.js` returns breakevens as an array. For iron condors this is typically 2 values; for verticals it's 1; for undefined-risk strategies it may be 0. The UI handles all cases.

- The `LivePriceLarge` component is rendered in the hero. It subscribes to PriceContext internally. If the price feed is delayed or unavailable, it shows the tile's `underlyingPrice` as fallback.

- Analysis data may not exist for all tiles (depends on whether the pipeline has run for that tile). All tabs handle the "no analysis" state with a fallback message.
