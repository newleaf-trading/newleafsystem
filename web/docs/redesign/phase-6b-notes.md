# Phase 6b — Adjustment Catalogue and Scoring

_Completed 2026-04-18._

## What shipped

### New files

| File | Purpose |
|---|---|
| `src/trading/utils/adjustmentCatalogue.js` | Pure-function catalogue + scoring. `getValidAdjustments(position, marketData) → AdjustmentPreview[]`. `computeAdjustment(position, marketData, type) → AdjustmentPreview`. |
| `src/trading/utils/adjustmentCatalogue.test.js` | 23 unit tests across all 8 strategies + scoring behaviour. |

### No UI touched. No rendering code. Pure functions only.

---

## Full adjustment catalogue for review

### Iron Condor (7 adjustments)

| Type | Label | Pill | Description |
|---|---|---|---|
| `roll_tested_up_out` | Roll [side] side further OTM & out | Smart/Marginal | Move tested spread further from spot + extend expiry. Best all-around defence. |
| `roll_tested_otm` | Roll [side] side further OTM | Marginal | Move tested spread further from spot, same expiry. Usually a debit — you're paying to buy space. |
| `roll_tested_out` | Roll [side] side out to next expiry | Smart/Marginal | Same strikes, later expiry. Collects additional time premium. Good when strikes are fine but time is short. |
| `close_tested_side` | Close [side] side only | Defensive | Buy back the tested spread. Leaves profitable side running as a free position. |
| `convert_to_vertical` | Convert to [side] vertical | Directional Pivot | Close the untested side for credit. Changes thesis from neutral to directional. |
| `close_entire` | Close entire position | Clean Exit | Lock in or realize current P&L. |
| `hold_and_monitor` | Hold & monitor | High Risk | Take no action. Always present, never recommended. |

**Disallowed:** Rolling both sides simultaneously. Rationale: it doubles the transaction cost and rarely produces better risk/reward than rolling one side.

**My observation on the brief's catalogue:** The brief lists "Roll tested side up & out," "Roll tested side up only," and "Roll tested side out only." I renamed "up only" to "further OTM" because "roll up" is ambiguous for puts — "rolling up a put" could mean moving closer to money (wrong direction). "Further OTM" is unambiguous regardless of option type.

### Iron Butterfly (3 adjustments)

| Type | Label | Pill |
|---|---|---|
| `convert_to_condor` | Widen wings to Iron Condor | Marginal |
| `close_entire` | Close entire position | Clean Exit |
| `hold_and_monitor` | Hold & monitor | High Risk |

**Disallowed:** Mid-trade strike rolls. Rationale: butterflies have zero-width ATM spread. Rolling a strike changes the fundamental structure.

**My observation:** The brief's catalogue is correct here. Butterflies are hard to adjust — widening to a condor is the only structural defence, and even that's marginal. "Close" is usually the right answer, which the scoring handles by making it the recommended when no roll passes the threshold.

### Bull Put Spread (4 adjustments)

| Type | Label | Pill |
|---|---|---|
| `roll_down_out` | Roll down and out | Smart/Marginal |
| `roll_out_only` | Roll to further expiry only | Marginal |
| `close_entire` | Close entire position | Clean Exit |
| `hold_and_monitor` | Hold & monitor | High Risk |

**Disallowed:** Converting to IC at a loss.

### Bear Call Spread (4 adjustments)

| Type | Label | Pill |
|---|---|---|
| `roll_up_out` | Roll up and out | Smart/Marginal |
| `roll_out_only` | Roll to further expiry only | Marginal |
| `close_entire` | Close entire position | Clean Exit |
| `hold_and_monitor` | Hold & monitor | High Risk |

**Disallowed:** Converting to IC at a loss.

### BWB Put (4 adjustments)

| Type | Label | Pill |
|---|---|---|
| `close_threatened_wing` | Close threatened wing | Defensive |
| `roll_entire_out` | Roll entire structure out | Marginal |
| `close_entire` | Close entire position | Clean Exit |
| `hold_and_monitor` | Hold & monitor | High Risk |

**Disallowed:** Closing individual legs piecemeal.

### BWB Call (4 adjustments)

Same as BWB Put — symmetric structure.

### Calendar Spread (3 adjustments)

| Type | Label | Pill |
|---|---|---|
| `roll_short_out` | Roll short leg out | Smart/Marginal |
| `close_entire` | Close entire position | Clean Exit |
| `hold_and_monitor` | Hold & monitor | High Risk |

**Disallowed:** Adjusting the long leg.

**My observation:** The brief's catalogue is correct. Calendar spreads are fundamentally hard to defend — the only viable adjustment is rolling the short leg to the next expiry to collect more time premium. If the thesis is broken (IV crush or large price move), closing is the right answer.

### Double Diagonal (4 adjustments)

| Type | Label | Pill |
|---|---|---|
| `close_threatened_side` | Close threatened [side] side | Defensive |
| `roll_threatened_out` | Roll threatened [side] side out | Marginal |
| `close_entire` | Close entire position | Clean Exit |
| `hold_and_monitor` | Hold & monitor | High Risk |

**Disallowed:** Adjusting both sides simultaneously.

---

## Scoring logic (§10.6)

### Improvement ratio

```
improvement_ratio = (probability_after - probability_before) / |net_cost_per_contract|
```

### Pill assignment thresholds

| Pill | Condition |
|---|---|
| **Recommended** (green solid) | Highest-scoring non-hold/non-close adjustment. Assigned during sort. |
| **Smart roll** (green) | `ratio ≥ 0.30 AND newProbability ≥ 55%` |
| **Marginal** (amber) | `ratio ≥ 0.15 OR newProbability ≥ 50%` |
| **Defensive** (blue) | Structural — assigned to close-tested-side, close-threatened-wing. Not scored. |
| **Directional pivot** (purple) | Structural — assigned to convert-to-vertical. Not scored. |
| **Clean exit** (gray) | Always assigned to close_entire. |
| **High risk** (red) | Always assigned to hold_and_monitor. Never recommended. |

### Sort order

`Smart > Defensive > Directional > Marginal > Clean Exit > High Risk`

Within same pill tier: sorted by improvement ratio descending.

### Recommendation logic

1. Find the first non-hold, non-close adjustment in sorted order.
2. If it exists and isn't HIGH_RISK → mark as RECOMMENDED.
3. Otherwise → fallback: mark close_entire as RECOMMENDED.
4. Hold & monitor is **never** the default recommendation.

---

## Estimation models

The current implementation uses rough estimation models for roll credits, probabilities, and max loss changes. These are placeholders that will be refined when Phase 6c wires up the R2 option chain for real pricing:

| Estimate | Model | Accuracy |
|---|---|---|
| Roll credit (time) | 35% of original per-share credit per week extended | Rough — actual depends on IV and time remaining |
| Roll credit (strike) | -25% of original per-share credit per $5 OTM shift | Rough — actual depends on skew |
| New probability | Current prob + 1% per $1 OTM + 0.5% per day extended | Rough — should use delta at new strikes |
| New max loss | Current max loss - roll credit | Directionally correct |

**These will be replaced with real R2 chain lookups in Phase 6c when the adjustment picker has actual strike/expiry selection UI.**

---

## Catalogue review: observations for the brief author

1. **"Roll tested side up only"** — renamed to **"Roll tested side further OTM"**. "Up" for puts means moving the put spread *down* in strike, which is confusing. "Further OTM" is direction-agnostic.

2. **No concerns with the disallowed adjustments.** Each disallowed action is genuinely counterproductive for its strategy type.

3. **Iron Butterfly adjustment options are intentionally limited.** The brief says "Close — adjustments rarely pay" which is accurate. The only structural alternative is widening to a condor, which the catalogue includes.

4. **Calendar "Roll short leg out" is the standard defence.** Matches real trading practice. The brief correctly disallows adjusting the long leg — that's where the time value lives.

5. **BWB "Close threatened wing" vs "Close individual legs piecemeal."** These sound similar but are different: "close the wing" means buying back the defined broken-wing pair as a unit, not cherry-picking individual legs. The catalogue treats the wing as a structural unit.

---

## Test coverage (23 tests)

| Strategy | Tests | What's verified |
|---|---|---|
| Iron Condor | 5 | Count, types, hold is HIGH_RISK, exactly one recommended, tested side detection (call + put) |
| Bull Put Spread | 2 | Count + types, disallowed check, roll pill assignment |
| Bear Call Spread | 2 | Count + types, disallowed check |
| Iron Butterfly | 2 | Count + types (no rolls), recommendation logic |
| BWB Put | 2 | Count + types, DEFENSIVE pill on close_threatened_wing |
| BWB Call | 2 | Count, no piecemeal close |
| Calendar Spread | 2 | Count + types (no long-leg adjustment), roll credit sign |
| Double Diagonal | 2 | Count + types, threatened side detection (call vs put based on spot) |
| Scoring | 4 | RECOMMENDED assignment, fallback to close, computeAdjustment single lookup, null for invalid |

---

_End of Phase 6b. No UI code was touched. Ready for catalogue review before Phase 6c._
