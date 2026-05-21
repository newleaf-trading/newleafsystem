# Phase 7 — Home Dashboard

_Completed 2026-04-18._

## What shipped

### Modified files

| File | Change |
|---|---|
| `src/trading/pages/DashboardPage.jsx` | Full rewrite — three-section "what needs attention" layout replacing the old hero + governance banner + alert cards. |

### Dashboard layout

```
DashboardPage
├── Greeting (time-aware, first name)
├── Subtitle (N active positions, X% capital deployed)
│
├── Section 1: Urgent positions (if any)
│   ├── EXIT cards (red left-stripe, "Close now" CTA)
│   ├── ACTION_NEEDED cards (orange left-stripe, "Review" CTA)
│   └── Calm summary bar ("N positions active · View all")
│
├── Section 2: Two-column split
│   ├── Left: New in Discover
│   │   ├── 3 most recently published tiles (not owned, not shortlisted)
│   │   ├── Symbol, strategy, DTE, ROC
│   │   ├── Click → /trading/strategy/:id
│   │   └── "View all strategies" button → /trading/discover
│   │
│   └── Right: Performance Snapshot
│       ├── This Month P&L (green/red, with % return)
│       ├── Win Rate (X/Y trades)
│       └── Capital Deployed (amount + % of total)
│
└── Empty states
    ├── No positions → "Ready to start" CTA → Discover
    ├── No new strategies → "No new strategies available"
    └── No performance data → "--" values + "Your first month's data will populate here"
```

### What was cut

| Element | Reason |
|---|---|
| "Portfolio governance active · No structural risk detected" | Brief §8: contradictory when positions are breached. Replaced with verdict-derived calm summary. |
| Regime strip ("Stable Compression · Moderate · Income Structures Favored") | Not actionable. Market regime context lives on Discover page. |
| Chart placeholder | Brief says no new charts or visualisations. |
| KPI grid (This Month, Win Rate, Active, Next Expiry) | Replaced with Performance Snapshot tiles — same data, cleaner layout. |
| `evaluatePortfolio()` alert engine | Replaced entirely by verdict engine from Phase 6a. |
| `useAlertConfig()` import | No longer used — alerts are verdict-driven now. |
| PosCard component | Replaced by `UrgentPositionCard` which uses `useVerdict` for real verdicts. |

### How urgent positions work

Each active position renders as an `UrgentPositionCard` component that:
1. Calls `usePositionLiveData(tile, item)` for live P&L
2. Calls `useVerdict(tileId, tile, liveData)` for real verdict
3. If verdict is EXIT or ACTION_NEEDED → renders a full-width action row with:
   - Verdict pill, symbol, strategy, reason text, P&L, action button
   - EXIT: red button "Close now" → routes to `/trading/strategy/:id`
   - ACTION_NEEDED: orange button "Review" → routes to `/trading/strategy/:id`
4. If verdict is ON_TRACK, MONITOR, or TAKE_PROFIT → renders nothing (covered by calm summary)

The calm summary bar shows below any urgent cards: "N positions active · positions needing attention appear above · View all"

### Performance snapshot

Three tiles reusing the same data calculation pattern from the old dashboard:
- **This Month P&L**: total unrealized P&L across active positions, shown in dollars + percentage of total capital
- **Win Rate**: winners / closed trades with P&L, null if no closed trades (shows "--")
- **Capital Deployed**: sum of max loss × quantity for active positions, shown as amount + percentage

All tiles show "--" with onboarding copy when no data exists.

### New in Discover

Three most recently published tiles that are:
- Not in the user's portfolio (owned)
- Not in the user's shortlist
- Have valid data (maxProfit > 0 or legs exist)

Sorted by `publishedAt` descending. Each card shows symbol, strategy, DTE, ROC. Click routes to `/trading/strategy/:id`. "View all strategies" routes to `/trading/discover`.

---

## Post-redesign cleanup list

| Item | Status | Notes |
|---|---|---|
| `/trading/position-legacy/:tileId` route | Done (Phase 6c) | Retired, PositionDetail import removed |
| Rename `/trading` → `/invest` | Pending decision | Needs testing against real positions first |
| Rename "NewLeaf Trading" → "NewLeaf [final]" | Pending decision | Affects AppHeader wordmark, landing page, meta tags |
| Update HeyGen script + marketing to final name | Blocked by rename decision | |
| 24-hour soft prompt for unresolved pendingOrders | Future UX improvement | Toast or banner on dashboard when a pendingOrder has been `ready_to_execute` for >24h |
| React component UI tests | Future | When project grows beyond solo-developer scale. Vitest is installed, test patterns established in verdictEngine.test.js |
| Aggregated adjustment history view | Future | Data exists in `portfolio/:tileId/adjustments` subcollection. Could surface as a portfolio-level history tab. Not needed now. |
| Dead page file cleanup | Ready to execute | Files on disk but not imported: `DiscoverPage.jsx`, `PortfolioPage.jsx`, `PortfolioPageNew.jsx`, `PerformancePage.jsx` (old version), `HomePage.jsx`. Safe to delete. |
| `dashboard-mockup.css` cleanup | Ready to execute | No longer imported after DashboardPage rewrite. Safe to delete. |
| `alertEngine.js` cleanup | Ready to execute | No longer imported anywhere. Fully replaced by verdict engine. Safe to delete. |

---

## Redesign summary — all 7 phases

| Phase | Deliverable | Key files |
|---|---|---|
| 1 | IA audit + proposal | `docs/redesign/ia-proposal.md` |
| 2 | Routes + skeletons + hooks | TradingLayout, AppHeader, useShortlist, usePositionState, useVerdict |
| 3 | Discover page (unowned only, new CTAs) | DiscoverPageNew.jsx, ui/index.jsx |
| 4a | Strategy detail — Evaluate mode | StrategyDetailPage.jsx (Setup, Thesis, Chart, Risks tabs) |
| 4b | Strategy detail — Manage mode | StrategyDetailPage.jsx (Now, Position, Chart, Adjust, History tabs) |
| 5 | Build page (Deploy) | BuildPage.jsx (shortlist + sizing + execute) |
| 6a | Verdict engine | verdictEngine.js (33 tests, 8 strategies, 3 overrides) |
| 6b | Adjustment catalogue | adjustmentCatalogue.js (23 tests, scored + sorted) |
| 6c | Adjust tab + pending orders | AdjustTab.jsx (picker, R2 pricing, pendingOrder, clipboard, mark executed) |
| 7 | Home dashboard | DashboardPage.jsx (urgent positions, discover preview, performance snapshot) |

**Total test count:** 56 (33 verdict engine + 23 adjustment catalogue)

**New Firestore collections introduced:**
- `users/:uid/shortlist/:tileId` — saved-for-later strategies
- `users/:uid/pendingOrders/:orderId` — adjustment orders for newleaf-desk
- `users/:uid/portfolio/:tileId/verdictHistory` — verdict state transitions
- `users/:uid/portfolio/:tileId/adjustments` — executed adjustment history

**New fields added to existing documents:**
- `portfolio/:tileId.entryIvRank` — IV rank at entry (for vol-regime override)
- `portfolio/:tileId.sessionsBreached` — breach counter (for EXIT detection)
- `portfolio/:tileId.adjustment_pending` — pauses verdict CTA during execution
- `portfolio/:tileId.lastAdjustment` — most recent adjustment record
