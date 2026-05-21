# Phase 6c — Adjust Tab UI + Pending Order Flow

_Plan revised 2026-04-18. IB integration is out of scope for this app — execution lives in newleaf-desk._

## Scope

1. **Adjust tab UI** per brief §10.4 — recommended card, alternatives list, why-this footer
2. **Detail drawer** with proposed new legs — real R2 chain pricing when expanded, "--" until loaded
3. **Execute Roll** writes a `pendingOrder` to Firestore — does NOT call any broker
4. **Clipboard copy** of human-readable order ticket
5. **Confirmation toast** — "Order ready — execute at your broker, or wait for NewLeaf Desk"
6. **Position flag** — sets `adjustment_pending` on the position so verdict engine pauses
7. **Cancel flow** — cancels pending order, removes flag

## pendingOrder Firestore schema

Collection: `users/:uid/pendingOrders/:orderId`

```
{
  positionId: string,          // tileId of the position being adjusted
  orderType: string,           // adjustment type key (e.g. 'roll_tested_up_out')
  legs: [                      // proposed new leg structure
    {
      action: 'buy' | 'sell',
      type: 'call' | 'put',
      strike: number,
      expiry: string,          // YYYY-MM-DD
      estimatedPrice: number,  // per-share from R2 chain, or null
    }
  ],
  closingLegs: [               // legs being closed (current position legs)
    { same shape as above }
  ],
  estimatedCost: number,       // net debit (positive) or credit (negative), per contract in dollars
  estimatedFill: string,       // human-readable: "$0.45 debit" or "$0.30 credit"
  status: 'ready_to_execute' | 'cancelled' | 'executed',
  sourceAdjustment: string,    // adjustment label for display
  relatedPositionId: string,   // same as positionId (for newleaf-desk cross-reference)
  symbol: string,
  strategy: string,
  clipboardTicket: string,     // the human-readable ticket text
  createdAt: timestamp,
  cancelledAt: timestamp | null,
  executedAt: timestamp | null,
}
```

This schema is the **contract** that newleaf-desk will consume. newleaf-desk reads `status: 'ready_to_execute'`, places the order, then writes `status: 'executed'` + `executedAt`.

## Verdict engine integration

When a position has `adjustment_pending: true`:
- Verdict engine still evaluates (data stays current)
- But the Adjust tab shows "Adjustment pending — waiting for execution" instead of the picker
- The verdict pill on Positions page shows a ⏳ indicator

When a pending order is cancelled:
- Remove `adjustment_pending` from position
- Set `status: 'cancelled'` on the pendingOrder doc
- Adjust tab returns to normal picker view

## What this phase does NOT do

- No broker API calls (no IB, no Alpaca orders, no anything)
- No order routing — pendingOrder sits in Firestore until newleaf-desk picks it up
- No estimated prices from rough models — only real R2 chain prices or "--"
- No AI explainer — static "Why this recommendation" text from scoring logic
- No custom expiry selection — uses next standard weekly
- No strike editing in the detail drawer — shows proposed strikes from catalogue
