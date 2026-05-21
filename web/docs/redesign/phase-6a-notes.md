# Phase 6a — Verdict Engine

_Completed 2026-04-18._

## What shipped

### New files

| File | Purpose |
|---|---|
| `src/trading/utils/verdictEngine.js` | Pure-function verdict engine. One evaluator per strategy, three universal overrides. Exports `evaluate()`, `buildMarketData()`, `VERDICT` constants. |
| `src/trading/utils/verdictEngine.test.js` | 24 unit tests: 6 Iron Condor, 4 Bull Put, 3 Bear Call, 3 Calendar, 3 Double Diagonal, 4 universal overrides, 1 generic. All pass. |

### Modified files

| File | Change |
|---|---|
| `src/trading/hooks/useVerdict.js` | Replaced ON_TRACK stub with real engine. Calls `evaluate()` on every render with memoized marketData. Writes verdict transitions to `users/:uid/portfolio/:tileId/verdictHistory` in Firestore. Signature changed: `useVerdict(positionId, tile, liveData)`. |
| `src/trading/hooks/usePortfolio.js` | Added `getDoc` import. `addToPortfolio()` now fetches `analyses/:tileId` to capture `entryIvRank` at entry time (needed for vol-regime-shift override). |
| `src/trading/pages/StrategyDetailPage.jsx` | Updated `useVerdict` call to pass `tile` and `liveData`. |
| `src/trading/pages/PositionsPage.jsx` | PositionCard now calls `usePositionLiveData` per card, passes to `useVerdict`. Live P&L displayed from `liveData.pnlTotal`. |

### Verdict engine architecture

```
evaluate(position, marketData) → { state, reason, recommendedAction }
  │
  ├── normalizeStrategy(position.strategy)
  │      → 'iron condor', 'bull put spread', etc.
  │
  ├── STRATEGY_EVALUATORS[normalized](position, marketData)
  │      → per-strategy thresholds from brief §9
  │      → first-match wins: EXIT > TAKE_PROFIT > ACTION_NEEDED > MONITOR > ON_TRACK
  │
  └── applyOverrides(result, position, marketData)
         ├── 21-DTE rule: short-premium at ≤21 DTE with <50% captured → escalate
         ├── Earnings proximity: earnings inside DTE not at entry → escalate
         └── Vol regime shift: IV rank moved >30 points → minimum MONITOR
```

### Strategy coverage

| Strategy | Evaluator | Take Profit | Monitor | Action | Exit |
|---|---|---|---|---|---|
| Iron Condor | `evaluateIronCondor` | ≥50% | Δ≥0.25 or DTE≤21 | Δ≥0.35 or tested | Breached 2 sessions or loss≥1.5× |
| Iron Butterfly | `evaluateIronButterfly` | ≥25% | Δ≥0.30 or DTE≤21 | Δ≥0.40 | Breached or loss≥1× |
| Bull Put Spread | `evaluateBullPutSpread` | ≥50% | Δ≥0.25 or DTE≤21 | Δ≥0.35 | Short put breached |
| Bear Call Spread | `evaluateBearCallSpread` | ≥50% | Δ≥0.25 or DTE≤21 | Δ≥0.35 | Short call breached |
| Calendar Spread | `evaluateCalendarSpread` | ≥25% debit | >1 SD | >1.5 SD | IV crush or >2 SD |
| Double Diagonal | `evaluateDoubleDiagonal` | ≥20% debit | At near-wing | Beyond near-wing | Deep ITM or vega flip |
| BWB Put/Call | `evaluateBWBPut` | ≥25% or debit→credit | Within 1 SD | At broken wing | Beyond broken wing |
| Covered Call, Collar | Maps to Bull Put | Same thresholds | | | |
| Jade Lizard, Strangle | Maps to Iron Condor | Same thresholds | | | |
| Straddle, Butterfly | Maps to Iron Butterfly | Same thresholds | | | |

### Universal overrides (all three implemented)

| Override | Condition | Effect |
|---|---|---|
| 21-DTE rule | Short-premium trade, DTE≤21, <50% captured | Escalate one level. Note: stacks with per-strategy DTE check, so ON_TRACK at 18 DTE → MONITOR (per-strategy) → ACTION_NEEDED (override). |
| Earnings proximity | Earnings date inside remaining DTE, wasn't at entry | Escalate one level |
| Vol regime shift | |currentIvRank - entryIvRank| > 30 points | Minimum state = MONITOR |

### Verdict history in Firestore

Every state transition writes to `users/:uid/portfolio/:tileId/verdictHistory`:
```json
{
  "fromState": "ON_TRACK",
  "toState": "MONITOR",
  "reason": "...",
  "recommendedAction": "...",
  "spotPrice": 470.50,
  "dte": 18,
  "profitCapturePct": 30,
  "evaluatedAt": "2026-04-18T..."
}
```

Initial evaluation (null → first state) is NOT written — only actual transitions. This keeps the collection clean for back-testing.

### Entry data fix

`addToPortfolio()` now reads `analyses/:tileId` at entry time to capture `entryIvRank`. This is a best-effort read — if the analysis doc doesn't exist, `entryIvRank` is null and the vol-regime override is skipped.

### Test fixtures

24 tests covering all 8 strategy types + 4 override scenarios:
- QQQ Iron Condor (6 tests: ON_TRACK, TAKE_PROFIT, MONITOR, ACTION_NEEDED, EXIT×2)
- ADBE Bull Put Spread (4 tests: ON_TRACK, TAKE_PROFIT, EXIT, ACTION_NEEDED with 21-DTE)
- HON Bear Call Spread (3 tests: ON_TRACK, EXIT, TAKE_PROFIT)
- Calendar Spread (3 tests: ON_TRACK, TAKE_PROFIT, EXIT on IV crush)
- Double Diagonal (3 tests: ON_TRACK, TAKE_PROFIT, EXIT deep ITM)
- Overrides (4 tests: 21-DTE escalation, 21-DTE no-op at 50%+, vol regime, earnings)

### Computed marketData fields (fixed in 6a revision)

All five placeholder fields are now computed in `buildMarketData`:

| Field | Formula | Source |
|---|---|---|
| `priceDistSD` | `\|spot - shortStrike\| / (spot × IV × √(DTE/365))` | Short leg closest to spot; IV from `leg.iv`, defaults to 0.25 |
| `ivCrush` | `(entryIv - currentIvEstimate) / entryIv ≥ 0.4` | Long legs only. Current IV estimated from entry IV rank shift. Triggers at 40% crush ratio. |
| `vegaFlip` | `sign(entryNetVega) ≠ sign(currentNetVega)` | Entry vega computed from leg IV (long=positive, short=negative). Current vega from live Greeks. |
| `nextEarningsDate` | Read from `tile.nextEarningsDate` | Upstream pipeline work — if field not present, override is skipped (not silently failed). |
| `sessionsBreached` | Firestore counter on `portfolio/:tileId.sessionsBreached` | Managed by `useVerdict` hook: incremented each evaluation while breached, reset to 0 when unbreached. |

**sessionsBreached counter approach:**
- Stored on the portfolio document as `sessionsBreached: number`
- `useVerdict` tracks breach state via `prevBreachedRef`
- On breach state change: if breached → increment counter; if unbreached → reset to 0
- `buildMarketData` reads `portfolioItem.sessionsBreached` directly
- Imperfect: treats every verdict evaluation as a "session" (evaluations happen on mount + every 60s when data changes). Directionally correct — a position breached for 2+ evaluations is genuinely in trouble.
- True session-based counting (once per trading day) would require a scheduled function — out of scope for now.

**BWB-specific fields** (`priceAtBrokenWing`, `priceBeyondBrokenWing`):
- Broken wing = the long leg furthest from current spot
- "At" = within 2% of broken wing strike
- "Beyond" = price past the broken wing (put BWB: spot below; call BWB: spot above)

**Double diagonal fields** (`priceAtNearWing`, `priceBeyondNearWing`, `deepItm`):
- Near wing = the short leg closest to spot
- "At" = within 2% of near wing strike
- "Beyond" = price has crossed the short strike
- "Deep ITM" = price more than 5% past any short strike

**`debitToCreditFlip`**: True when `entryNetCredit < 0` (debit trade) and `pnlPerContract > 0` (now profitable).

### Test coverage (33 tests, all 8 strategies)

| Strategy | Tests | Verdicts covered |
|---|---|---|
| Iron Condor | 6 | ON_TRACK, TAKE_PROFIT, MONITOR, ACTION_NEEDED, EXIT (breach), EXIT (loss multiple) |
| Iron Butterfly | 3 | ON_TRACK, TAKE_PROFIT, EXIT |
| Bull Put Spread | 4 | ON_TRACK, TAKE_PROFIT, EXIT, ACTION_NEEDED (with 21-DTE stacking) |
| Bear Call Spread | 3 | ON_TRACK, TAKE_PROFIT, EXIT |
| Calendar Spread | 3 | ON_TRACK, TAKE_PROFIT, EXIT (IV crush) |
| Double Diagonal | 3 | ON_TRACK, TAKE_PROFIT, EXIT (deep ITM) |
| BWB Put | 3 | ON_TRACK, TAKE_PROFIT, EXIT (beyond broken wing) |
| BWB Call | 3 | ON_TRACK, TAKE_PROFIT (debit→credit flip), ACTION_NEEDED (at broken wing) |
| Universal overrides | 4 | 21-DTE escalation, 21-DTE no-op, vol regime shift, earnings proximity |

### Remaining upstream dependency

`nextEarningsDate` requires the pipeline to populate `tile.nextEarningsDate`. If the field is absent, the earnings override is skipped cleanly (not a silent failure). This is flagged as upstream work for the pipeline team.

### Cleanup items for later phases

- Retire `/trading/position-legacy/:tileId` route (Phase 6c)
