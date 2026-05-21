# NewLeaf Trading — Information Architecture Proposal

_Phase 1 audit output. No code changes. Review before proceeding to Phase 2._

---

## 1. Current route map and component inventory

### Active routes (TradingLayout.jsx:154-162)

| Current route | Component | Import alias | File |
|---|---|---|---|
| `/trading` | `DashboardPage` | — | `pages/DashboardPage.jsx` |
| `/trading/discover` | `DiscoverPageNew` | `DiscoverPage` | `pages/DiscoverPageNew.jsx` |
| `/trading/portfolio` | `PortfolioPageRefactored` | `PortfolioPage` | `pages/PortfolioPageRefactored.jsx` |
| `/trading/performance` | `PerformancePageNew` | `PerformancePage` | `pages/PerformancePageNew.jsx` |
| `/trading/position/:tileId` | `PositionDetail` | — | `pages/PositionDetail.jsx` |
| `/trading/analysis/:ticker` | `AnalysisPage` | — | `pages/AnalysisPage.jsx` |
| `/trading/analysis` | `AnalysisPage` | — | `pages/AnalysisPage.jsx` |
| `/trading/admin` | `AdminPage` | — | `pages/AdminPage.jsx` |

### Dead / superseded page files (still on disk, not routed)

| File | Notes |
|---|---|
| `pages/DiscoverPage.jsx` | Superseded by `DiscoverPageNew.jsx` |
| `pages/PortfolioPage.jsx` | Superseded by `PortfolioPageRefactored.jsx` |
| `pages/PortfolioPageNew.jsx` | Superseded by `PortfolioPageRefactored.jsx` |
| `pages/PerformancePage.jsx` | Superseded by `PerformancePageNew.jsx` |
| `pages/HomePage.jsx` | Superseded by `DashboardPage.jsx` |
| `pages/LearnPage.jsx` | Routed at `/learn` in App.jsx, not under `/trading` |

### Layout shell

- `TradingLayout.jsx` — auth gate, loads tiles, renders `AppHeader` + `Footer` + `VoiceAssistant` + `AIChatDrawer`
- `AppHeader.jsx` — dark-green nav bar, links: Home, Discover, Analysis, Portfolio, Performance, Learn, Admin (if admin), Workbench
- `layout/AppShell.jsx` — alternative shell (`TopNav` + `BottomNav`), not currently used in TradingLayout

---

## 2. Per-component audit: phase mapping and disposition

### DashboardPage.jsx — current `/trading`

**What it does:** Portfolio overview with alert cards (risk / harvest / monitor), key metrics (total P&L, return %, win rate), and pending actions. Uses `evaluatePortfolio()` from `alertEngine.js` to generate position alerts.

**Phase mapping:** Primarily **Defend** — surfaces positions needing action. Also cross-cuts into Performance (metrics at top). Does NOT surface Discover content.

**Problems identified in brief:**
- Mixes past performance stats with urgent position alerts without hierarchy.
- "No structural risk detected" banner can contradict individual position states.
- Positions at risk are buried below the fold.

**Disposition:** **Refactor** into the Phase 7 home dashboard. Lead with EXIT/ACTION_NEEDED positions, then latest Discover, then performance snapshot. Cut the static governance banner.

---

### DiscoverPageNew.jsx — current `/trading/discover`

**What it does:** Browses `tiles` collection with market pulse banner, advanced filters (reward:risk, DTE, risk level), strategy cards with "Add to Portfolio" CTA. Checks `isInPortfolio()` to show "In Portfolio" badge.

**Phase mapping:** **Discover** — correct.

**Problems identified in brief:**
- Owned and unowned cards look identical except for a small badge.
- Confidence scores (34, 25, 30, 45) shown without calibration.

**Disposition:** **Refactor**. Remove confidence scores from card surface (show on detail page only). Visually distinguish owned cards with verdict-coloured left stripe + verdict-driven CTA. Consider splitting into "Your positions" (top) and "New opportunities" (below) per Phase 3 spec, but this may belong on `/trading` home instead to keep Discover purely for unowned strategies.

**Brief spec says:** "Discover must exclude anything already in the portfolio." This means owned cards should NOT appear on Discover at all — they live on `/trading/positions` (Defend). Implement this in Phase 3.

---

### PortfolioPageRefactored.jsx — current `/trading/portfolio`

**What it does:** Two modes toggled by `buildManageMode` state:
- **Build mode** — shows available tiles (like Discover) to add to portfolio
- **Manage mode** — positions table, allocation pie chart, risk dashboard, capital editor, contract quantity controls, R2-based live pricing

**Phase mapping:** Build mode = **Deploy**. Manage mode = **Defend**. This is the core problem — one page serving two phases.

**Problems identified in brief:**
- Build vs Manage ambiguity — pre-entry and post-entry on one page.
- Allocation math confusion: "Allocated $14,259 (-42.6% remaining)" contradictory.
- No clear pre-entry → post-entry boundary.

**Disposition:** **Split** into two pages:
- `/trading/build` (Deploy) — takes shortlisted strategies, applies risk budget, sizes contracts, executes. Build mode only. Pre-entry only.
- `/trading/positions` (Defend) — active position monitoring with verdicts, sorted by urgency. Manage mode only.
- Redirect `/trading/portfolio` → `/trading/positions` for URL continuity.

---

### PerformancePageNew.jsx — current `/trading/performance`

**What it does:** KPI cards (Total P&L, Return %, Win Rate, Avg Win/Loss), active vs closed position tables, P&L history line chart.

**Phase mapping:** **Cross-cutting** — historical review, not specific to one phase.

**Disposition:** **Keep as-is** with minor cleanup. No phase conflict. Route unchanged.

---

### PositionDetail.jsx — current `/trading/position/:tileId`

**What it does:** Strategy hero (symbol, strategy, DTE, live price), tabs (Overview, Why This Trade?, Technical Analysis, Theta & Risk), live P&L, Greeks, payoff chart, legs table, AI-generated analysis from `analyses/:tileId` collection.

**Phase mapping:** Currently serves both **Decide** (pre-entry evaluation) and **Defend** (post-entry monitoring), but does NOT switch mode based on ownership. Same content shown regardless.

**Problems identified in brief:**
- Pre-trade justification ("Why this trade aligns with neutral market conditions") shown post-entry when it's no longer relevant.
- No verdict-driven CTA post-entry.
- Same hero stats whether owned or not.

**Disposition:** **Refactor** into the dual-mode strategy detail page per brief spec:
- Route changes: `/trading/position/:tileId` → `/trading/strategy/:id` (rename to match brief IA)
- Mode driven by `isInPortfolio(id)`:
  - **Evaluate mode** (unowned): thesis, R:R, probability, [Take this trade] CTA
  - **Manage mode** (owned): verdict, current P&L, recommended action CTA, Adjust tab
- Redirect `/trading/position/:id` → `/trading/strategy/:id` for continuity.

---

### AnalysisPage.jsx — current `/trading/analysis` and `/trading/analysis/:ticker`

**What it does:** Gamma wall, technical analysis, strike heatmap, volatility insights, "Build Trade" modal. Independent of portfolio — purely exploratory research.

**Phase mapping:** **Discover** (market research) + partially **Decide** (validate strategy selection before entry).

**Disposition:** **Evaluate merge** with the Decide page. The gamma/technical data shown here overlaps with what the strategy detail page should show in its Technical Analysis tab. However, this page serves a distinct role: ticker-level research without a specific strategy in mind. It's the workbench-lite for investors.

**Recommendation:** Keep for now as a standalone analysis tool at `/trading/analysis/:ticker`. It is not duplicative of the strategy detail page — it operates at the ticker level, not the strategy level. However, it should be accessible from the strategy detail page (e.g., "Analyze {symbol}" link in the Technical tab) rather than as a top-level nav item. **Remove from the primary nav** — it's a utility, not a phase.

---

### AdminPage.jsx — current `/trading/admin`

**Phase mapping:** Cross-cutting (system management, admin-only).

**Disposition:** **Keep as-is**. Gated by admin email check. No phase conflict. Not visible to investors.

---

### LearnPage.jsx — current `/learn` (via App.jsx, not TradingLayout)

**Phase mapping:** Cross-cutting (education, strategy reference).

**Disposition:** **Keep as-is**. Route unchanged.

---

## 3. Proposed route map

| Route | Phase | Component (new) | Replaces |
|---|---|---|---|
| `/trading` | Cross-cutting | `HomePage` (refactored DashboardPage) | `DashboardPage` |
| `/trading/discover` | Discover | `DiscoverPage` (refactored DiscoverPageNew) | `DiscoverPageNew` |
| `/trading/strategy/:id` | Decide | `StrategyDetailPage` (refactored PositionDetail) | `PositionDetail` at `/trading/position/:tileId` |
| `/trading/build` | Deploy | `BuildPage` (extracted from PortfolioPageRefactored build mode) | `PortfolioPageRefactored` build mode |
| `/trading/positions` | Defend | `PositionsPage` (extracted from PortfolioPageRefactored manage mode) | `PortfolioPageRefactored` manage mode |
| `/trading/performance` | Cross-cutting | `PerformancePage` (keep) | `PerformancePageNew` |
| `/trading/analysis/:ticker` | Utility | `AnalysisPage` (keep) | `AnalysisPage` |
| `/trading/admin` | Cross-cutting | `AdminPage` (keep) | `AdminPage` |

### Redirects needed

| Old path | New path | Reason |
|---|---|---|
| `/trading/portfolio` | `/trading/positions` | Route split |
| `/trading/position/:id` | `/trading/strategy/:id` | Rename + dual-mode |

### Nav bar changes

**Current:** Home - Discover - Analysis - Portfolio - Performance - Learn - Admin - Workbench

**Proposed:** Home - Discover - Build - Positions - Performance - Learn

- **Analysis** removed from primary nav (accessible from strategy detail page and via direct URL)
- **Portfolio** split into **Build** and **Positions**
- **Admin** hidden from nav for non-admin users (already gated, but link still shows)
- **Workbench** removed from nav (it's a separate app, linked via cross-app nav separator)
- **Learn** stays in primary nav (keeps nav at 6 items max)

---

## 4. New component tree

```
TradingLayout
├── AppHeader (updated nav: Home, Discover, Build, Positions, Performance, Learn)
├── Routes
│   ├── / → HomePage
│   │   ├── UrgentPositionsSection (EXIT, ACTION_NEEDED positions)
│   │   ├── NewInDiscoverSection (3 freshest unowned tiles)
│   │   └── PerformanceSnapshot (this-month P&L, win rate, deployed capital)
│   │
│   ├── /discover → DiscoverPage
│   │   └── StrategyCardGrid (unowned tiles only, filters, no confidence scores)
│   │
│   ├── /strategy/:id → StrategyDetailPage
│   │   ├── if unowned → EvaluateMode
│   │   │   ├── EvaluateHero (status pill, thesis, R:R, [Take this trade] CTA)
│   │   │   ├── VitalsRow (Max profit, Max loss, R:R, Probability)
│   │   │   └── Tabs: Setup, Thesis, Chart, Risks
│   │   └── if owned → ManageMode
│   │       ├── ManageHero (verdict pill, recommendation, current P&L, verdict CTA)
│   │       ├── VitalsRow (Current P&L, Max loss used, Time left, Probability trend)
│   │       ├── ExitSignalStrip (if ACTION_NEEDED or EXIT)
│   │       └── Tabs: Now, Position, Chart, Adjust, History
│   │
│   ├── /build → BuildPage
│   │   ├── ShortlistSection (strategies saved but not entered)
│   │   ├── AllocationPanel (capital, risk budget, per-position sizing)
│   │   └── ExecutePortfolioAction
│   │
│   ├── /positions → PositionsPage
│   │   └── PositionCardList (sorted by verdict urgency: EXIT > ACTION_NEEDED > ...)
│   │
│   ├── /performance → PerformancePage (keep)
│   ├── /analysis/:ticker → AnalysisPage (keep)
│   └── /admin → AdminPage (keep)
├── Footer
├── VoiceAssistant
└── AIChatDrawer
```

---

## 5. Data-model audit: what exists and what's missing

### What the Firestore schema already supports

| Capability | How it works today | Status |
|---|---|---|
| Owned vs unowned distinction | `tiles` = available, `users/:uid/portfolio/:tileId` = owned. `isInPortfolio(tileId)` checks. | Works |
| Entry credit per position | `portfolio.entryNetCredit` (cents) + per-leg `entryPremium` | Works |
| Entry IV per leg | `portfolio.legs[].entryIv` (nullable) | Works (may be null for some positions) |
| Entry date | `portfolio.entryDate` (YYYY-MM-DD string) | Works |
| Entry underlying price | `portfolio.entryUnderlyingPrice` | Works |
| Position status | `portfolio.status` = `'active'` or `'closed'` | Works but binary only |
| Quantity (contracts) | `portfolio.quantity` (default 1) | Works |
| Capital allocation settings | `users/:uid/portfolioSettings/config` with `totalCapital`, `riskTolerance`, `maxAllocation` | Works |
| AI-generated analysis | `analyses/:tileId` with thesis, technicals, theta schedule, risks | Works |
| Live Greeks/P&L | Computed client-side from R2 option chain data, not stored | Works (ephemeral) |

### Schema gaps that must be filled for the redesign

| Gap | Needed for | Proposed change | Priority |
|---|---|---|---|
| **No shortlist/watchlist** | Deploy phase — Build page needs a "saved but not entered" state | Add `users/:uid/shortlist/:tileId` subcollection, or add `shortlisted: boolean` + `shortlistedAt: timestamp` fields to portfolio items with `status: 'shortlisted'` | **Phase 2** — must exist before Build page |
| **No verdict field on positions** | Defend phase — verdict engine results must persist | Add `verdict` field to portfolio items: `{ state: 'ON_TRACK' | 'TAKE_PROFIT' | 'MONITOR' | 'ACTION_NEEDED' | 'EXIT', reason: string, recommendedAction: string, evaluatedAt: timestamp }` | **Phase 6** — verdict engine writes this |
| **No verdict history** | Back-testing verdict thresholds per brief §9 | Add `users/:uid/portfolio/:tileId/verdictHistory` subcollection with `{ state, reason, evaluatedAt, marketData }` per transition | **Phase 6** |
| **No entry IV at position level** | Verdict engine §9 vol-regime-shift override needs entry IV rank | Add `entryIvRank: number` to portfolio item (populate from tile or R2 at entry time) | **Phase 6** |
| **No earnings date tracking** | Verdict engine §9 earnings-proximity override | Store `nextEarningsDate` on tiles (from upstream pipeline) and check at evaluation time | **Phase 6** |
| **No adjustment history** | History tab in Manage mode, Phase 6 roll flows | Add `users/:uid/portfolio/:tileId/adjustments` subcollection with `{ type, oldLegs, newLegs, creditDebit, adjustedAt }` | **Phase 6** |

### Schema field that exists but needs rework

| Field | Issue | Fix |
|---|---|---|
| `portfolioSettings.maxAllocation` | Stored as decimal (0.30 = 30%), but UI shows confusing math ("Allocated $14,259 (-42.6% remaining)") | The display math is broken in `PortfolioPageRefactored`, not the schema. Fix the UI formula — allocated should never exceed totalCapital without an explanation. |

**Allocation math analysis:** The "Allocated $14,259 (-42.6% remaining)" issue is a UI display bug, not a data model problem. `totalCapital` is $10K but positions requiring $14,259 of buying power were added. The UI should show: "Total Capital: $10,000 | Margin Required: $14,259 | Over-allocated by: $4,259 (warning)". The schema is fine — the formula in PortfolioPageRefactored needs fixing.

---

## 6. Implementation plan for remaining phases

### Phase 2 — Skeletons and routing
- Create new route map in `TradingLayout.jsx`
- Create placeholder components: `BuildPage`, `PositionsPage`, `StrategyDetailPage`
- Add redirects: `/trading/portfolio` → `/trading/positions`, `/trading/position/:id` → `/trading/strategy/:id`
- Implement `usePositionState(strategyId)` hook (reads `isInPortfolio`)
- Stub `useVerdict(positionId)` hook (returns hardcoded `ON_TRACK`)
- Update `AppHeader` nav links
- Add `shortlist` support to `usePortfolio` (or create `useShortlist`)

### Phase 3 — Discover
- Filter out owned tiles from DiscoverPage
- Remove confidence scores from card surface
- Simplify or cut Market Pulse banner
- Add "Save for later" (shortlist) CTA as secondary action on cards

### Phase 4 — Decide (StrategyDetailPage)
- Refactor PositionDetail into dual-mode component
- Evaluate mode: thesis-led hero, Setup/Thesis/Chart/Risks tabs
- Manage mode: verdict-led hero, Now/Position/Chart/Adjust/History tabs
- Wire mode switch to `usePositionState`

### Phase 5 — Deploy (BuildPage)
- Extract build logic from PortfolioPageRefactored
- Show shortlisted strategies with sizing UI
- Fix allocation math display
- "Execute portfolio" action creates positions in Firestore

### Phase 6 — Defend (PositionsPage + verdict engine)
- New `/trading/positions` page with verdict-sorted position cards
- Implement verdict engine as pure functions (one per strategy per §9)
- Implement adjustment picker per §10.4-10.6
- Roll flow as drawer within Adjust tab
- Store verdict transitions to Firestore
- Write `phase-6-notes.md` addressing open decisions from §10.7

### Phase 7 — Home dashboard
- Refactor DashboardPage to "what needs attention today?"
- Top: urgent positions (EXIT, ACTION_NEEDED)
- Middle: latest Discover (3 newest unowned)
- Bottom: performance snapshot
- Cut static governance banner

---

## 7. Key decisions and corrections

### Brief assumption check: font families

The brief specifies: "Fraunces (serif) for headings, Space Mono for numbers, DM Sans for body text."

**Actual state:** The app loads **Playfair Display** (serif), **Inter** (body), and **Space Mono** (mono) via Google Fonts in `index.html:16`. `tailwind.config.js` references Instrument Sans / Fraunces / IBM Plex Mono but these are not loaded.

The brief's font spec (Fraunces, Space Mono, DM Sans) does NOT match what's currently shipped. Two options:
1. **Match brief** — switch to Fraunces + DM Sans + Space Mono (requires loading new fonts)
2. **Match code** — keep Playfair Display + Inter + Space Mono (working today)

**Recommendation:** Keep current fonts (Playfair Display + Inter + Space Mono) for Phases 2-7. Font migration is a separate task that touches every page and is orthogonal to the IA restructuring. Note: Space Mono is already correct.

### Brief assumption check: primary colour

Brief says `#0F3D2E`. Code uses `#0B2D23` everywhere. These are close but not identical. `#0B2D23` is the actual brand colour in all token files, CSS, and components. **Use `#0B2D23` — do not change to `#0F3D2E`.**

### Brief assumption check: accent colour

Brief says `#C8A85A`. Code uses `#C9A96E`. Same situation. **Use `#C9A96E`.**

---

## 8. Files to touch per phase (preliminary)

| Phase | New files | Modified files | Deleted files |
|---|---|---|---|
| 2 | `pages/BuildPage.jsx`, `pages/PositionsPage.jsx`, `pages/StrategyDetailPage.jsx`, `hooks/usePositionState.js`, `hooks/useVerdict.js` | `TradingLayout.jsx`, `AppHeader.jsx` | None |
| 3 | None | `pages/DiscoverPageNew.jsx`, `components/ui/index.jsx` (card changes) | None |
| 4 | None | `pages/StrategyDetailPage.jsx` (flesh out from skeleton) | None |
| 5 | None | `pages/BuildPage.jsx` (flesh out), `hooks/usePortfolio.js` (shortlist support) | None |
| 6 | `utils/verdictEngine.js`, `utils/adjustmentCatalogue.js`, `utils/adjustmentScoring.js`, `components/AdjustmentPicker.jsx` | `pages/PositionsPage.jsx`, `pages/StrategyDetailPage.jsx`, `hooks/useVerdict.js` | None |
| 7 | None | `pages/DashboardPage.jsx` (or replace with new `HomePage.jsx`) | None |
| Cleanup | None | None | `pages/DiscoverPage.jsx`, `pages/PortfolioPage.jsx`, `pages/PortfolioPageNew.jsx`, `pages/PerformancePage.jsx`, `pages/HomePage.jsx` |

---

_End of Phase 1. Ready for review before Phase 2._
