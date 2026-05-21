# Phase 6c — Adjust Tab UI + Pending Order Flow

_Completed 2026-04-18._

## What shipped

### New files

| File | Purpose |
|---|---|
| `src/trading/components/AdjustTab.jsx` | Full adjustment picker UI for the Manage-mode Adjust tab. Recommended card, alternatives list, R2 chain pricing, pendingOrder writes, clipboard copy, toast, cancel flow. |

### Modified files

| File | Change |
|---|---|
| `src/trading/pages/StrategyDetailPage.jsx` | Replaced Adjust tab placeholder with `<AdjustTab>` component. Added import. |
| `src/trading/TradingLayout.jsx` | Removed `/trading/position-legacy/:tileId` route and `PositionDetail` import. All traffic now goes to `/trading/strategy/:id`. |
| `docs/redesign/phase-6c-plan.md` | Updated with revised scope — no IB integration, pendingOrder approach. |

### Adjust tab anatomy (per brief §10.4)

```
AdjustTab
├── Context header (symbol, strategy, P&L, count of valid adjustments)
├── Recommended adjustment card
│   ├── Verdict pill (green solid RECOMMENDED)
│   ├── Label + description
│   ├── Outcome tiles: Net Cost, New Probability, New Max Loss
│   ├── Current legs with R2 chain prices (-- until loaded)
│   └── Execute button → writes pendingOrder + clipboard + toast
├── Other valid adjustments list
│   ├── Compact row: pill + label + "Pick this"
│   └── Expands on click to show full detail + outcome tiles + Execute
├── Why-this-recommendation footer
│   └── Static text explaining scoring logic
└── Pending state
    ├── "Adjustment Pending — waiting for execution" message
    └── Cancel button → removes pending flag
```

### Execute flow (no broker integration)

1. **Write pendingOrder** to `users/:uid/pendingOrders/:orderId`:
   ```
   {
     positionId, orderType, legs[], closingLegs[],
     estimatedCost, estimatedFill, status: 'ready_to_execute',
     sourceAdjustment, relatedPositionId, symbol, strategy,
     clipboardTicket, createdAt, cancelledAt: null, executedAt: null
   }
   ```

2. **Copy ticket to clipboard**: Human-readable text like
   `"ADBE · Roll call side further OTM & out / CLOSE short $240 call, long $245 call / expires 2026-05-16 / net $45 debit"`

3. **Toast**: "Order ready — execute at your broker, or wait for NewLeaf Desk"

4. **Position flag**: Sets `adjustment_pending: true` on the portfolio document

### Pending state — two actions

The pending state shows both buttons:

**Mark as executed** (primary, green):
1. Finds all `ready_to_execute` pending orders for this position
2. Flips their status to `'filled'` with `executedAt` timestamp
3. Writes to `portfolio/:tileId/adjustments` subcollection with `{ type, label, oldLegs, newLegs, estimatedCost, adjustedAt, method: 'manual_mark' }`
4. Updates the portfolio document with `lastAdjustment` record
5. Removes `adjustment_pending` flag
6. Shows toast: "Adjustment marked as executed. Position updated."

**Cancel** (outline):
1. Finds all `ready_to_execute` pending orders for this position
2. Sets their status to `'cancelled'` with `cancelledAt` timestamp
3. Removes `adjustment_pending` from position document
4. Shows toast: "Pending adjustment cancelled"
5. Adjust tab returns to normal picker view

### R2 chain pricing

- Prices show "--" until the user expands an adjustment card
- On expansion, fetches R2 chain via `fetchR2Report(symbol)` (cached 30s)
- Uses `matchOptionLeg(chain, strike, expiry, type)` to find real mid prices per leg
- Loading state shows "..." while fetching
- If R2 fetch fails, prices remain "--"

### pendingOrder schema (contract for newleaf-desk)

Defined in `phase-6c-plan.md`. Key fields:

| Field | Type | Purpose |
|---|---|---|
| `positionId` | string | tileId of position being adjusted |
| `orderType` | string | adjustment type key (e.g. `roll_tested_up_out`) |
| `legs[]` | array | proposed new legs with `estimatedPrice` from R2 |
| `closingLegs[]` | array | legs being closed |
| `estimatedCost` | number | net cost per contract in dollars |
| `status` | string | `ready_to_execute` / `cancelled` / `executed` |
| `clipboardTicket` | string | human-readable order text |

### Legacy route retired

`/trading/position-legacy/:tileId` removed from TradingLayout. `PositionDetail` import removed. All position detail traffic now flows through `/trading/strategy/:id` → `StrategyDetailPage` with dual-mode rendering.

## Open decisions from §10.7

### 1. Editability of the recommended roll

**Proposed direction:** Ship as execute-only for now. The "See full detail" expansion shows the current legs with R2 prices but does not allow editing strikes, expiry, or contract count. Edit capability would require:
- Strike picker dropdown per leg (filtered from R2 chain)
- Expiry selector
- Live re-pricing on every change
- Re-scoring the adjustment with new parameters

**Recommendation:** Defer to a future phase. The current UX — recommended adjustment → one-click execute → clipboard ticket for broker — is sufficient for the first release. Editing is a power-user feature that adds significant complexity.

### 2. AI explainer integration

**Proposed direction:** Static text only. The "Why this recommendation" footer explains the scoring logic in plain English. An "Ask AI" button that calls Anthropic with position context would add ~2-3 seconds of latency and require API key management.

**Recommendation:** Defer. The static explanation covers the "why" adequately. AI explainer is a nice-to-have for a future iteration.

### 3. Custom expiry selection

**Proposed direction:** Not implemented. The adjustment catalogue assumes rolling to the next standard weekly expiry. Custom expiry selection would require:
- Calendar UI for picking arbitrary dates
- R2 chain filtering by expiry
- Re-pricing with the selected expiry

**Recommendation:** Defer. The next weekly is the standard default for roll adjustments. Traders with specific calendar preferences can note the desired expiry in the clipboard ticket and adjust at their broker.

## What's next

Phase 7 (Home dashboard redesign) is the final phase per the brief. The Adjust tab is now functional across all eight strategy types, pending orders flow to Firestore, and the position-legacy route is retired.
