# shared/indicators

Shared technical indicator computations for the NewLeaf monorepo. Pure JavaScript, zero dependencies.

## What it computes

- **SMA** (simple moving average) — any period
- **EMA** (exponential moving average) — any period, plus full series
- **RSI** (Cutler's variant, simple average) — matches `api/src/tools/indicators.ts`
- **Bollinger Bands** (20-period, 2 std dev default) — matches `api/src/tools/indicators.ts`
- **MACD** (12, 26, 9 default) — standard EMA-based computation
- **SMA Crossover Detection** — finds most recent golden/death cross

## Who imports it

- `api/src/tools/indicators.ts` — will delegate to this module (F1.2 migration)
- `generaterecommendations/analyse-tiles.cjs` — injects computed values as ground truth into LLM prompts

## Usage

```javascript
// From generaterecommendations/
const indicators = require('../shared/indicators');
const result = indicators.computeAll(closes);
// result.macd.macdLine, result.macd.signalLine, result.macd.histogram
// result.sma20, result.sma50, result.rsi14, result.bollinger, etc.

// Individual functions
const { sma, ema, rsi, macd, bollingerBands, findRecentSmaCrossover } = require('../shared/indicators');
```

## Testing

```
node shared/indicators/index.test.js
```

No test framework required. Uses `console.assert` style checks.
