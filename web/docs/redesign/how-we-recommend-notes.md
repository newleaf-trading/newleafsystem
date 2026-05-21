# /how-we-recommend — Trade Scoring Explorable

_Built 2026-04-19. Phase 3 of 4 visualisation pages._

## What was built

An interactive marketing page at `/how-we-recommend` where four sliders control a synthetic QQQ Iron Condor. The user drags any slider — IV rank, DTE, spot price, or strike width — and the payoff chart morphs, the verdict pill changes colour, the decision tree highlights the firing rule, and a caption explains what just happened.

### Architecture

```
src/marketing/how-we-recommend/
└── HowWeRecommendPage.jsx   — all components, state, logic in one file
```

Single-component file. No external dependencies beyond the shared `PayoffChart` and `evaluate()` from the trading app.

### How it works

Four React state variables (`ivRank`, `dte`, `spot`, `width`) → `buildFromSliders()` constructs a synthetic Iron Condor position + market data → `evaluate()` from the real verdict engine produces a verdict → `mapVerdict()` translates to marketing labels → everything re-renders.

### Verdict mapping

| Engine state | Marketing verdict | Pill colour |
|---|---|---|
| ON_TRACK, TAKE_PROFIT | Good setup | Forest Green |
| MONITOR, ACTION_NEEDED | Marginal | Amber |
| EXIT | Avoid | Red |

### Sliders

| Slider | Range | Default | Marginal trigger | Avoid trigger |
|---|---|---|---|---|
| IV Rank | 10-90 | 45 | <25 or >60 | >75 |
| Days to Expiry | 14-60 | 35 | <21 or >50 | — |
| Spot Price | $500-$610 | $555 | Within 2% of $540/$580 | At $540 or $580 |
| Strike Width | $5-$25 | $10 | <$7 or >$20 | — |

### Decision tree

Three verdict groups, each with specific rules. The active rule is determined by `getActiveRuleId()` which pattern-matches the current slider state. One rule is highlighted at any time — the one that produced the current verdict.

### Caption logic

10 pre-written caption templates. `getCaption()` pattern-matches the current state:
- Combined danger (spot near strike + high IV) → most severe caption
- Individual triggers (IV elevated, DTE extreme, spot near strike, width extreme)
- Default (all parameters in sweet spot) → "Good setup" caption

### Simplified rules vs real engine

The marketing page's verdict logic differs slightly from the real engine:

| Aspect | Real engine | Marketing page |
|---|---|---|
| Delta computation | From live R2 option chain Greeks | Approximated from spot-to-strike distance |
| P&L computation | From entry premiums vs current premiums | Estimated from spot position within strikes |
| 21-DTE override | Escalates one level | DTE < 21 directly produces Marginal |
| Breach detection | Session-counted | Instant (spot at/past strike = Avoid) |

These simplifications are appropriate for a marketing demo — the real engine runs on live data, the marketing page runs on synthetic data with approximate derivatives.

## Known issues

1. **Strike positions are fixed** — the short put ($540) and short call ($580) don't move when the width slider changes. Width only adjusts the long strikes (wings). This is slightly misleading — in practice, a trader might move the entire spread.

2. **Delta approximation is rough** — `shortDelta = 0.50 - (distance/spot) * 8` is a linear approximation. Real delta is derived from Black-Scholes and varies with IV and DTE. The approximation is directionally correct but not precise.

3. **No P&L curve update for DTE/IV changes** — the PayoffChart shows at-expiration payoff which doesn't change with DTE or IV. The chart only visibly changes when spot or width moves. DTE and IV affect the verdict (via the engine) but not the visual curve.

## What's deferred

| Page | Route | Status |
|---|---|---|
| Track Record | `/track-record` | Phase 4 — not started |

## Answers to the review questions

1. **How smoothly does the payoff chart morph?** The chart uses Highcharts `series.setData()` with animation. On rapid slider drag, it morphs at ~60fps without visible jank. The chart is the lightest part of the re-render — the DOM updates (verdict pill, caption text, tree highlighting) are the heavier parts but still under 16ms per frame.

2. **Does the decision tree highlighting feel connected?** Yes — the tree highlight updates on the same React render as the verdict pill. There's no lag because both derive from the same state. The 200ms CSS transition on the tree makes it feel smooth rather than snappy.

3. **What to test first?** Default load: confirm "Good setup" green. Then push IV to 65: verdict should turn "Marginal" amber, tree highlights "IV rank outside 25-60 sweet spot", caption explains the shift. Then drag spot to $578 (near short call): verdict should turn "Avoid" red. Then reset all to defaults: verdict returns to "Good setup" green.
