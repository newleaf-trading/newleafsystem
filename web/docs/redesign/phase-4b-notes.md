# Phase 4b — Decide: Manage Mode

_Completed 2026-04-18._

## What shipped

The strategy detail page (`/trading/strategy/:id`) now renders a complete **Manage mode** for owned positions. Both Evaluate and Manage modes are fully functional.

### StrategyDetailPage.jsx — Manage mode additions

**New imports:**
- `usePositionLiveData` — live P&L, Greeks, risk scenarios, DTE from R2 API
- `LiveLegsTable` — existing entry-vs-current legs table component
- `VERDICT_STATES` — verdict state constants for control flow

**Data layer (Manage mode):**
- `portfolioItem` found from `portfolioItems` by matching `tileId`
- `usePositionLiveData(tile, portfolioItem)` returns: `currentSpot`, `entrySpot`, `priceMove`, `dte`, `pnlPerContract`, `pnlTotal`, `progressPct`, `profitCapturePct`, `strategyStatus`, `liveGreeks`, `riskScenarios`, `legDetails`
- Live data refreshes every 60 seconds from R2 option chain API

**Manage hero:**
- Verdict pill from `useVerdict` (ON_TRACK stubbed in Phase 2 — real engine in Phase 6)
- Strategy badge with theme colour
- DTE + entry date from portfolio item
- Ticker + company name + **live P&L** (large, right-aligned, green/red)
- Per-contract and total P&L with quantity
- Live spot price
- Hero message: actionable text per verdict state, per brief §10.3 table
- Verdict-driven CTA: gold for Take Profit/Monitor, red for Action Needed/Exit, hidden for On Track

**Hero CTA mapping (per brief §10.3):**

| Verdict | Primary CTA | Secondary CTA |
|---|---|---|
| On track | _(hidden)_ | View position |
| Take profit | Close for +$X | Let expire |
| Monitor | Set alert | View position |
| Action needed | Review adjustments (or verdict.recommendedAction) | Hold & monitor |
| Exit | Close now _(red button)_ | Details |

**Exit signal strip:**
Renders between hero and vitals when verdict is `ACTION_NEEDED` or `EXIT`. Connected to hero via flush border radii (hero bottom corners squared, strip has bottom corners rounded). Red background for EXIT, orange for ACTION_NEEDED.

**Vitals row:**
- Current P&L (green/red based on sign)
- Max Loss Used (percentage — `|pnl| / maxLoss * 100` when negative, 0% when positive; red when >50%)
- Time Left (days, red when ≤21 DTE — matches brief §9 21-DTE rule)
- Probability (from tile data)

### Five tabs — 4 functional, 1 placeholder

| Tab | Content | Status |
|---|---|---|
| **Now** (default) | 4 entry→current comparison tiles (Spot Price, Net Delta, Net Theta, P&L Progress). Progress bar with max-loss/max-profit scale. "What Broke the Thesis" callout (only when Monitor/Action/Exit). | Complete |
| **Position** | `LiveLegsTable` component (entry vs current premium, per-leg P&L, delta, theta). Net Greeks summary (4 tiles: Delta, Theta, Vega, Gamma with live spot indicator). | Complete |
| **Chart** | P&L at expiration via `PnLChart`. Below-chart tiles: entry price, current price, price move %, breakevens. Risk scenarios (3 cards: bullish/flat/bearish with live P&L calculations). | Complete |
| **Adjust** | Placeholder with wrench icon. "Adjustment picker lands in Phase 6." | Placeholder |
| **History** | Timeline view with entry event (date, symbol, strategy, entry price, net credit, quantity) and current state (P&L, spot, move %). Note that adjustment history and P&L path chart will populate in Phase 6. | Complete (partial — no adjustment events yet) |

### New sub-components (within StrategyDetailPage.jsx)

| Component | Purpose |
|---|---|
| `NowTab` | Entry→current comparison, progress bar, thesis-broken callout |
| `PositionTab` | LiveLegsTable + Greeks summary grid |
| `ManageChartTab` | PnLChart + entry/current price context + risk scenarios |
| `HistoryTab` | Timeline with entry event and current state |
| `ChangeTile` | Entry→Current comparison tile with arrow and optional % change |

### Content rules enforced (per brief §10.3)

- Hero message is actionable, not descriptive (e.g. "Let it work — 35% toward target" not "Position is open")
- No pre-trade thesis content in Manage mode — "Why this trade" rationale is Evaluate-mode only
- "What broke the thesis" callout only renders when verdict is Monitor/Action/Exit; suppressed for On Track and Take Profit
- Verdict drives the primary CTA — not a generic "View details" button

## Design decisions

1. **Exit signal strip flush with hero.** When urgent (EXIT/ACTION_NEEDED), the hero's bottom corners go square and the strip's top has no border, creating a visually connected unit. The strip adds the bottom border-radius. This makes urgent states impossible to miss.

2. **P&L shown in hero, not just vitals.** For Manage mode the P&L is the most important number. It appears both in the hero (large, right-aligned) and in the vitals row (first tile). This is intentional — the hero P&L is for scanning, the vitals row P&L is for comparison with the other three metrics.

3. **History tab shows partial data.** Entry event is populated from portfolio item data. Adjustment events and P&L path chart are noted as "Phase 6" placeholders. This is the right scoping per the scope boundary instruction.

4. **`LiveLegsTable` reused as-is.** The existing component handles entry-vs-current premium, per-leg P&L, and live Greeks per leg. No changes needed — just imported and rendered in the Position tab.

5. **`btnDanger` style added.** Red button for EXIT and ACTION_NEEDED CTAs. Follows the brief §8 colour guardrail: red = exit.

## Cleanup item for Phase 6

As requested: **Retire `/trading/position-legacy/:tileId` route** when Phase 6 ships. Added to the Phase 6 scope.

## What's next

Phase 5 (Deploy — Build page) is the next deliverable per brief §7. Phase 6 (Defend — verdict engine + adjustment picker) will flesh out the Adjust tab placeholder and make the verdict pills live.
