# @newleaf/strategies

Pure options strategy comparison engine. No I/O, no side effects.

## Functions

### `buildLegs(strategy, spot, params?) → Leg[]`
Build leg structure for a strategy preset. Params override defaults (shortWidth, wing, net, skew, straddleWidth).

### `payoff(legs, underlyingPrice) → number`
P&L in dollars at expiration for a given underlying price. Includes intrinsic value + net premium × qty × 100.

### `analyse(strategies, spot) → AnalysisResult[]`
Full numerical analysis over a 480-point price grid (±45% beyond widest strike). Returns maxProfit, maxLoss, breakevens, profitZoneWidth, rewardRisk, uncapped flags.

### `bandWidth(legs, spot, target) → {lo, hi, width} | null`
Price range delivering ≥ target profit.

## Strategy Presets
- `iron_condor` — Sell OTM put + call, buy further OTM wings
- `iron_butterfly` — Sell ATM put + call, buy OTM wings
- `broken_wing_fly` — Asymmetric butterfly
- `bull_put_spread` — Sell OTM put, buy further OTM put
- `bear_call_spread` — Sell OTM call, buy further OTM call
- `long_straddle` — Buy ATM call + put
- `long_strangle` — Buy OTM call + put

## CLI
```bash
node generaterecommendations/compare.cjs --ticker AAPL --spot 214 \
  --strategy "iron_condor:shortWidth=10,wing=10,net=4" \
  --strategy "iron_butterfly:wing=10,net=7" \
  --target 400 [--json] [--live]
```

## Tests
```bash
node shared/strategies/index.test.js
```
