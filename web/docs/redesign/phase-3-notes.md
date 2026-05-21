# Phase 3 — Discover

_Completed 2026-04-18._

## What changed

### Modified files

| File | Changes |
|---|---|
| `src/trading/pages/DiscoverPageNew.jsx` | 1. Owned tiles excluded from results (`isInPortfolio` check in filter). 2. Confidence/probability filter removed from advanced filters and filter state. 3. "Saved" tab removed from strategy type tabs. 4. Market Pulse Banner replaced with compact single-line regime indicator. 5. Card CTAs changed from "Add to Portfolio" to "Take this trade" + "Save for later". 6. Card click navigates to `/trading/strategy/:id` instead of `/trading/position/:id`. 7. `useShortlist` hook integrated. 8. `Banner` import removed (no longer used on this page). |
| `src/trading/components/ui/index.jsx` | StrategyCard component updated: 1. New props `onTakeTrade`, `onSaveForLater`, `isSaved` for the Phase 3 CTA pattern. 2. Confidence display removed from risk bar label row. 3. New CTA block renders "Take this trade" + "Save for later" when `onTakeTrade` is provided. 4. Legacy `onAdd` CTA preserved for backward compatibility (PortfolioPageRefactored still uses it). |

### Behavior changes

| Before | After |
|---|---|
| Owned tiles visible on Discover with "In Portfolio" badge | Owned tiles excluded entirely — they live on `/trading/positions` |
| "Saved ★" tab to filter to portfolio items | Tab removed — no owned tiles to show |
| Confidence score shown on every card risk bar | Removed — will live on strategy detail page only (Phase 4) |
| Full-width Market Pulse Banner with icon, description, badge | Compact single-line: "📡 Low Volatility Environment · 8 strategies available" |
| "Add to Portfolio" → creates position in Firestore immediately | "Take this trade" → routes to `/trading/build?add=:id` (shortlist staging) |
| No "Save for later" option | "Save for later" → adds to `users/:uid/shortlist/:tileId` without routing |
| Card click → `/trading/position/:id` | Card click → `/trading/strategy/:id` (new dual-mode detail page) |
| Confidence/probability range slider in advanced filters | Removed — filter was filtering on the same data as the Probability metric, which is already on the card |

## Design decisions

1. **Shortlisted items still visible on Discover.** The brief says "exclude anything already in the portfolio." Shortlisted items are NOT in the portfolio — they're candidates staged for Build. So a shortlisted tile shows on Discover with the "Save for later" button changed to "✓ Saved". The user can still click "Take this trade" to route to Build, or click the card to see full detail.

2. **Market Pulse kept as single line, not removed entirely.** The VIX-driven headline ("Low Volatility Environment", "Elevated Volatility") is genuinely useful regime context. What was cut: the paragraph-length description and the full-width banner layout. The single line takes one row, not three.

3. **Confidence filter removed entirely** (not just hidden). Rationale: the confidence scores on tiles are currently the same as `probOfProfit` — there's no independent confidence metric from the analyst. Filtering by "confidence" is filtering by probability, which the Risk Level filter already covers indirectly. If a true analyst-confidence score is added later (separate from probability), the filter can be re-added.

4. **StrategyCard backward compatibility.** The old `onAdd`/`isAdded` props still work — `PortfolioPageRefactored` (Build mode) uses them. The new `onTakeTrade`/`onSaveForLater`/`isSaved` props take precedence when present. The card renders one CTA pattern or the other, never both.

## What was punted

| Item | Deferred to |
|---|---|
| Strategy detail page content (tabs, data, mode switch) | Phase 4 |
| Card visual differentiation for shortlisted vs fresh tiles | Phase 4 or 5 (could add a subtle shortlist indicator, but the "✓ Saved" button state may be enough) |
| Removal of dead `Banner` usage from other pages | Cleanup phase |

## What to watch for

- If a user has ALL tiles in their portfolio, Discover will show 0 strategies. The empty state handles this but might want a specific message like "All strategies are in your portfolio" rather than "No strategies match this filter."

- The `isInPortfolio` function is called during the `filteredTiles` memo. Since `usePortfolio` uses a Firestore `onSnapshot` listener, portfolio changes propagate in real-time — removing a position from `/trading/positions` will immediately show it again on Discover.
