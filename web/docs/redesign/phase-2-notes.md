# Phase 2 — Skeletons and Routing

_Completed 2026-04-18._

## What changed

### New files

| File | Purpose |
|---|---|
| `src/trading/pages/StrategyDetailPage.jsx` | Dual-mode strategy detail skeleton (Decide). Renders Evaluate or Manage mode based on `usePositionState`. |
| `src/trading/pages/BuildPage.jsx` | Portfolio builder skeleton (Deploy). Shows shortlisted strategies, accepts `?add=:tileId` from "Take this trade" flow. |
| `src/trading/pages/PositionsPage.jsx` | Active positions skeleton (Defend). Lists portfolio items sorted by verdict urgency with left-stripe colour. |
| `src/trading/hooks/useShortlist.js` | Firestore CRUD for `users/:uid/shortlist/:tileId`. Add, remove, list, check. |
| `src/trading/hooks/usePositionState.js` | Returns `'unowned'` / `'shortlisted'` / `'owned'` for a given strategy ID. |
| `src/trading/hooks/useVerdict.js` | Stub returning `ON_TRACK` for all positions. Exports `VERDICT_STATES` and `VERDICT_CONFIG` constants. |

### Modified files

| File | Change |
|---|---|
| `src/trading/TradingLayout.jsx` | Added new route entries, legacy redirects (`/portfolio` → `/positions`, `/position/:id` → `/strategy/:id`), imported new components. |
| `src/trading/components/AppHeader.jsx` | Nav links updated: `Home, Discover, Build, Positions, Performance, Learn`. Removed Analysis from primary nav. Admin stays for admin users. |

### Route map (as-shipped)

| Route | Component | Phase | Status |
|---|---|---|---|
| `/trading` | DashboardPage | Cross-cutting | Existing (unchanged) |
| `/trading/discover` | DiscoverPageNew | Discover | Existing (unchanged) |
| `/trading/strategy/:id` | StrategyDetailPage | Decide | **New skeleton** |
| `/trading/build` | BuildPage | Deploy | **New skeleton** |
| `/trading/positions` | PositionsPage | Defend | **New skeleton** |
| `/trading/performance` | PerformancePageNew | Cross-cutting | Existing (unchanged) |
| `/trading/analysis` | AnalysisPage | Utility | Existing (removed from nav, still accessible via URL) |
| `/trading/admin` | AdminPage | Cross-cutting | Existing (unchanged) |
| `/trading/portfolio` | → `/trading/positions` | Redirect | **New redirect** |
| `/trading/position/:id` | → `/trading/strategy/:id` | Redirect | **New redirect** |
| `/trading/position-legacy/:id` | PositionDetail | Legacy | Kept as fallback during transition |

## Decisions made

1. **Workbench link:** Stays as `<a href="/workbench/">` after the nav separator (cross-app link to a separate Firebase-hosted site). Not a React Router link. No change needed.

2. **"Take this trade" flow:** Routes to `/trading/build?add=:tileId`. BuildPage reads the `add` param, auto-adds to shortlist, and cleans the URL. This means the shortlist is the single staging area for all pre-entry strategies.

3. **Shortlist collection:** `users/:uid/shortlist/:tileId` — lightweight documents with `tileId`, `symbol`, `strategy`, `addedAt`. No leg data stored (that comes from the tile at execution time).

4. **Legacy PositionDetail:** Kept at `/trading/position-legacy/:tileId` so existing deep links can be manually tested during transition. Will be retired when Phase 4 is complete.

5. **Verdict colours:** Follow brief §8 guardrail. Green = on track / take profit. Amber = monitor. Orange = action needed. Red = exit. Defined in `VERDICT_CONFIG` in `useVerdict.js`.

## What was punted

| Item | Deferred to |
|---|---|
| Full strategy detail page (tabs, content, data fetching) | Phase 4 |
| Shortlist → portfolio execution flow | Phase 5 |
| Verdict engine (real evaluations replacing ON_TRACK stub) | Phase 6 |
| Home dashboard redesign (urgent positions, discover preview) | Phase 7 |
| Removal of dead page files (DiscoverPage.jsx, PortfolioPage.jsx, etc.) | Cleanup after all phases |

## What to watch for

- `useShortlist` and `usePortfolio` both use real-time Firestore listeners. If a user adds a strategy to shortlist and then immediately navigates to Build, there's a brief window where the snapshot hasn't fired yet. The `?add=` param + `addToShortlist()` write handles this — by the time the page renders, the write has completed and the snapshot will catch up within milliseconds.

- `PositionRedirect` component handles the redirect from `/trading/position/:tileId` to `/trading/strategy/:tileId`. It uses `useParams()` to extract the tileId, so it must be a component (not a raw `<Navigate>`).

- The `position-legacy` route is a temporary escape hatch. If Phase 4 implementation is delayed, existing position detail links can be manually redirected there. Remove it when Phase 4 ships.
