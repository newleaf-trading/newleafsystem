# Data Contract Notes

## Leg shape divergence between discover.html and strategy-builder.html

The two workbench pages use different leg data shapes, which prevents sharing `legMath.js` and `payoffChart.js` across both pages.

**discover.html** (premium AI flow):
```
{ side: 'long'|'short', type: 'call'|'put', strike: number, mid: number, iv: number }
```
- Flat structure, no `contract` nesting
- No per-leg expiry (all legs share `state.selectedExpiry`)
- Intrinsic-only payoff calculation (no Black-Scholes time-value)
- Quantity stored in `state.qty` (shared across all legs)

**strategy-builder.html** (free builder):
```
{ dir: 'long'|'short', contract: { strike, type, bid, ask, mid, iv, delta, ... }, qty: number, _dte: number }
```
- Nested `contract` object with full Greeks
- Per-leg `_dte` field enables multi-expiry strategies (calendars, diagonals)
- Black-Scholes payoff for calendar spreads via `samplePayoff()` with time-value
- Per-leg `qty` field (can differ across legs for ratio spreads)

**Why they differ:** The free builder was built first with full options chain data and BS support. The discover page was built later as a lighter guided flow with a simpler data model optimized for the 5-step journey. Calendar/diagonal support was added to the builder but the discover leg shape was never extended to match.

**Prerequisite for unification:** Extend the discover leg shape to include per-leg `expiry` and `_dte`. Wrap the BS-aware payoff path behind a flag or adapter so both pages can use `legMath.js`. The adapter pattern: `legMath.computeMaxLoss(legs, qty)` checks if any leg has `_dte` and dispatches to the BS path when multi-expiry is detected.

**Status:** Deferred. The shared modules (`legMath.js`, `payoffChart.js`) currently serve discover.html only. strategy-builder.html runs its own inline implementations.
