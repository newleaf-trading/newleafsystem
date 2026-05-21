# Phase 5 — Deploy: Build Page

_Completed 2026-04-18._

## What shipped

The Build page (`/trading/build`) is now fully functional with shortlist management, per-strategy sizing, corrected allocation math, and an Execute Portfolio action that moves records from shortlist → portfolio.

### BuildPage.jsx — full rewrite (was skeleton from Phase 2)

**Features:**
1. **?add=:tileId auto-add**: "Take this trade" from strategy detail routes here and auto-adds the tile to shortlist
2. **Shortlist display**: All shortlisted strategies with strategy-coloured left stripe, symbol, strategy badge, DTE
3. **Per-strategy quantity controls**: +/− buttons, default 1, minimum 1
4. **Corrected allocation math**: Four summary tiles that always balance:
   - Total Capital (from portfolioSettings)
   - Margin Required (sum of maxLoss × quantity for all shortlisted strategies)
   - Unallocated (Total Capital − Margin Required)
   - Strategies (count)
5. **Over-allocation warning**: Red banner when Margin Required > Total Capital, showing exact overage amount and percentage
6. **Allocation bar**: Visual progress bar showing capital usage, green when within budget, red when over
7. **Per-strategy metrics**: Max Profit (× qty), Max Loss (× qty), Risk/Capital %, Probability
8. **Execute Portfolio action**: Moves all shortlisted strategies to portfolio in Firestore, updates quantities, removes from shortlist, navigates to /trading/positions
9. **Onboarding modal**: Shows for first-time users who haven't set capital yet
10. **Empty state**: Guides user to Discover page

### Allocation math fix

The old PortfolioPageRefactored had:
```
totalInvested = sum(getCapitalRequired(tile, qty))    // could be $14,259
totalCapital = settings.totalCapital                   // $10,000
allocationPct = totalInvested / totalCapital * 100     // 142.6%
cashAvailable = totalCapital - totalInvested           // -$4,259
```

This showed "Allocated $14,259 (-42.6% remaining)" — contradictory. The user couldn't tell if the negative number meant they were over-budget or had extra capacity.

**New approach:**
```
marginRequired = sum(maxLoss × qty for each shortlisted tile)
unallocated = totalCapital - marginRequired
isOverAllocated = marginRequired > totalCapital

Display:
  Total Capital:    $10,000
  Margin Required:  $14,259    ← RED when > Total Capital
  Unallocated:      $0         ← shows $0, not negative
  Warning:          "Over-allocated by $4,259 (143% of capital)"
```

The key principle: **never show contradictory numbers**. If the sum exceeds the total, say so in a single red warning rather than showing impossible math.

### Execute flow (shortlist → portfolio)

```
For each shortlisted tile:
  1. addToPortfolio(tile)     → creates users/:uid/portfolio/:tileId with entry data
  2. updateQuantity(tile.id, qty)  → sets contract count if qty > 1
  3. removeFromShortlist(tile.id)  → deletes users/:uid/shortlist/:tileId
```

After all positions are created, navigates to `/trading/positions` with a 500ms delay for the Firestore snapshot to catch up.

**Data written per position** (by `addToPortfolio` in `usePortfolio.js`):
- `tileId`, `symbol`, `strategy`, `addedAt`
- `legs[]` with `entryPremium`, `entryIv` per leg
- `entryNetCredit` (calculated from leg premiums, in cents)
- `entryDate` (YYYY-MM-DD)
- `entryUnderlyingPrice`
- `status: 'active'`, `quantity` (updated separately)

### Files modified

| File | Change |
|---|---|
| `src/trading/pages/BuildPage.jsx` | Full rewrite — shortlist management, sizing, allocation math, execute flow |

### What was NOT implemented (per scope boundary)

- Diversification checks (no correlation analysis between strategies)
- Portfolio-construction intelligence (no Kelly criterion, no optimal allocation)
- Broker order submission (execute only writes to Firestore, not IB)
- Per-strategy custom allocation amounts (equal risk per strategy by default)
- Margin requirement validation against broker buying power

## Design decisions

1. **Quantity is the only sizing input.** The user adjusts the number of contracts per strategy. The maxLoss × qty produces the margin requirement. No dollar-amount allocation input — that was the source of the 142.6% confusion in the old UI.

2. **Already-owned tiles are filtered out.** If a tile is already in the portfolio (via a prior execute or manual add), it doesn't appear in the Build page even if it's still in the shortlist collection. The shortlist doc is cleaned up naturally.

3. **Execute is all-or-nothing.** All shortlisted strategies are executed together. No partial execution. This keeps the mental model clean: Build is a staging area, Execute commits the whole batch.

4. **Onboarding fires before Build, not during.** If the user has never set their capital, the onboarding modal appears immediately. This ensures the allocation math has a non-zero denominator.

5. **"Add more strategies" button routes to Discover.** This is the return path when the user wants to expand their shortlist before executing.

## What to watch for

- The `addToPortfolio` → `updateQuantity` two-step creates a brief window where the position exists with qty=1 before the update fires. The Firestore snapshot listener on `/trading/positions` may show the old quantity for ~100ms. Harmless but visible in rapid testing.

- If the user refreshes during execute (between addToPortfolio and removeFromShortlist), they could end up with a position in both collections. The Build page filters out owned tiles, so the shortlist doc becomes invisible but still exists. It will be cleaned up on the next execute or can be manually removed via admin.
