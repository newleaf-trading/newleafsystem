# NewLeaf Invest — Outcome Tracking Schema (Design Spec)

**Purpose:** Convert the recommendation engine from *discriminating* (varies sensibly by setup) to *accurate* (validated against real outcomes). This is the data model + scoring logic that lets every weight in the engine — the confidence blend (0.40/0.35/0.15/0.10), the score pillars (40/35/25), the ADX multiplier (1.0/0.7/0.3), the 0.60 condor gate — be tuned against what actually happened instead of intuition.

**Where it lives:** The **Invest** layer. Scanner and discover *recommend* (stateless). Invest *holds and closes* positions over time. Exit rules and outcome scoring are Invest-layer concerns — they do not touch scanner/discover.

---

## Core principle: track FOUR things separately, never conflate them

The whole value of this system is keeping these axes independent. Collapsing any two of them produces a number that can't tune the engine.

| Axis | Values | Used for |
|------|--------|----------|
| **Source** | `paper` (every recommendation, auto) / `real` (ones Manish entered) | paper = engine tuning (full sample, no bias); real = track record (credibility) |
| **Exit basis** | `expiry` (hold to expiry) / `managed` (exit rules) | expiry = clean thesis signal for weight-tuning; managed = realistic performance |
| **Thesis held?** | boolean/graded — did the market do what the engine predicted? | tuning the WEIGHTS (was the reasoning right) |
| **P&L** | number — did it make money? | business metric (did it pay) |

**Why separate thesis from P&L:** thesis-held + P&L-negative = engine was right, variance bit (don't punish weights). Thesis-failed + P&L-positive = got lucky (don't reward weights). **Weights are tuned on thesis accuracy only.** P&L is reported separately.

---

## Layer 1 — Entry snapshot (logged when a recommendation is made)

A faithful record of what the engine saw and decided. Mechanical, no judgment calls.

```
position {
  id                  // uuid
  symbol
  recommended_at      // date/time of the engine run
  source              // 'paper' (default, all recs) | 'real' (Manish marked entered)

  // --- what the engine decided ---
  strategy            // iron_condor | iron_butterfly | broken_wing_butterfly
                      //   | calendar_spread | bull_put_spread | bear_call_spread
  direction           // bullish | bearish | neutral

  // --- the inputs that produced it (for correlating to outcome) ---
  gate_values {
    blended_confidence
    oi_confidence
    gex_confidence
    delta_confidence
    volume_confidence
    band_width_pct
    adx
    trend_strength     // strong | moderate | weak
    volatility_regime  // squeeze | normal | expansion
    atm_iv
    iv_rv_ratio
    composite_score    // the /100
    call_wall
    put_wall
  }

  // --- the structure itself ---
  structure {
    legs[]             // strike, type (put/call), buy/sell, expiry
    entry_credit_or_debit
    max_profit
    max_loss
    short_strikes      // the strikes that define "in the zone"
    body_strike        // for butterfly/BWB
  }

  spot_at_entry
  evaluation_dates {
    expiry_date
    managed_review_cadence   // e.g. daily mark-to-market until a managed exit fires
  }
}
```

For `real` positions, also capture actual fills:
```
  real_fill {
    entered_at, actual_credit_debit, contracts, broker (IBKR)
  }
```

---

## Layer 2 — Outcome scoring (logged when a position closes)

Each position produces **two outcome rows** — one `expiry`, one `managed` — each scoring thesis + P&L.

```
outcome {
  position_id
  exit_basis          // 'expiry' | 'managed'
  closed_at
  spot_at_close

  thesis_held         // true | false | partial   (see per-strategy rules below)
  thesis_detail       // structured: what specifically held/failed
  pnl                 // realized $ (paper = simulated from price path; real = actual)
  pnl_pct_of_max      // pnl / max_profit, for normalizing across structures
}
```

---

## Per-strategy "thesis held" definitions

These define what counts as the engine's reasoning being *correct*, independent of P&L. **The two marked TODO need Manish's trader judgment — do not default them.**

| Strategy | Thesis held if... | Status |
|----------|-------------------|--------|
| **Iron Condor** | spot stayed **between the short strikes** through the evaluation point (range held) | DRAFT — confirm |
| **Iron Butterfly** | spot stayed **within the wings**, ideally near the body | DRAFT — confirm |
| **Bull Put Spread** | direction held (price ≥ short put) AND put wall acted as support | DRAFT — confirm |
| **Bear Call Spread** | direction held (price ≤ short call) AND call wall acted as resistance | DRAFT — confirm |
| **Calendar Spread** | `TODO(Manish)`: thesis held if **IV expanded regardless of price**? OR **IV expanded AND price stayed near strike**? (vega-long — thesis ≠ direction) | **NEEDS INPUT** |
| **Broken Wing Butterfly** | `TODO(Manish)`: what counts as "worked" — **free side never went ITM**? / **body zone reached**? / **credit held**? (asymmetric — not symmetric like condor) | **NEEDS INPUT** |

---

## Managed-exit rules

`TODO(Manish)` — these define when a `managed` position closes. Without them, the managed outcome is undefined. Specify whether one rule set applies to all six structures or they differ:

```
managed_exit_rules {
  profit_target       // TODO: e.g. 50% of max profit? differs by structure?
  time_stop           // TODO: e.g. 21 DTE? fixed holding period?
  loss_stop           // TODO: e.g. 2x credit received? strike-breach? none?
  // per-structure overrides if needed:
  //   iron_condor: {...}
  //   calendar_spread: {...}   (vega trades often managed differently)
}
```

The managed outcome is computed by walking the daily price path from entry and firing the FIRST rule that triggers (profit target / time stop / loss stop), recording P&L at that exit. The expiry outcome ignores these rules and marks at expiration.

---

## Feedback loop (how outcomes tune the engine) — design notes, build LAST

Do **not** auto-tune weights from early data. The loop:

1. Accumulate a meaningful sample of *closed* outcomes (months, not days — these are dated trades).
2. Per strategy, compute **thesis-hit-rate** segmented by the gate values: e.g. "do condors with blended_confidence 0.60–0.65 hold their thesis less often than 0.70+?" If yes → the 0.60 gate or the confidence weights need adjustment.
3. Correlate each gate input to thesis outcomes to see which signals actually predict success — this is what validates (or revises) the 0.40/0.35/0.15/0.10 blend and the ADX multiplier.
4. **Guard against overfitting:** tune on aggregate patterns across many trades, never react to individual outcomes. A condor losing once is variance; condors with confidence < 0.65 holding 40% of the time across 50 samples is signal.

**Until this loop has real closed outcomes, the CLAUDE.md honesty line stays: discriminating, not accurate. No hit-rate/accuracy claim in any UI or marketing.**

---

## Build sequencing

1. **Layer 1 (entry snapshot)** — start logging every recommendation as a `paper` position immediately. Cheap, and the sooner it starts, the sooner the sample accrues. Can begin as soon as delta re-validation is closed and the engine isn't being recalibrated.
2. **Layer 2 (outcome scoring)** — the price-path evaluator that closes positions and scores thesis + P&L. Needs the TODO definitions filled.
3. **`real` position marking** — UI to flag a recommendation as actually entered + capture fills.
4. **Feedback loop** — last, only after a real sample of closed outcomes exists.

## Open inputs blocking a complete build (Manish)
- [ ] Calendar "thesis held" definition
- [ ] BWB "thesis held" definition
- [ ] Managed-exit rules (profit / time / loss; uniform or per-structure)
- [ ] Confirm the 4 DRAFT thesis definitions (condor / butterfly / bull put / bear call)
