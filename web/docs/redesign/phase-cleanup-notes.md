# Post-Redesign Cleanup Notes

_Updated 2026-04-18._

## Blocking modal audit

| Modal | Location | Status | Notes |
|---|---|---|---|
| `OnboardingModal` | `components/OnboardingModal.jsx` | **Removed from active routes** | Was imported by BuildPage (removed). Still imported by dead pages: PortfolioPage, PortfolioPageNew, PortfolioPageRefactored — none are routed in the new IA. |
| `BuildTradeModal` | `components/analysis/BuildTradeModal.jsx` | **Keep** | Not a gate — user-initiated action modal from Analysis page. Opens on explicit button click, not on page load. Acceptable pattern. |
| `LoginPage` (isModal mode) | `components/LoginPage.jsx` | **Keep** | Auth flow — blocking modal is appropriate for authentication. |
| `VoiceAssistant` | `components/VoiceAssistant.jsx` | **Keep** | Overlay, not a gate — user-initiated via mic button. |
| `AIChatDrawer` | `components/AIChatDrawer.jsx` | **Keep** | Drawer, not a gate — user-initiated via Ask AI button. |
| `confirm-dialog` | CSS in `newleaf-system.css` | **Keep** | Confirmation dialog for destructive actions — appropriate use of modal. |

**Conclusion:** No remaining blocking modals in active routes. The only modal-as-gate pattern (OnboardingModal on BuildPage) has been replaced with an inline capital editor.

## Capital editing — new inline pattern

The Build page now handles capital in two states:

**Capital set (totalCapital > 0):**
- Summary tile shows Total Capital with a pencil icon
- Click to edit inline — input replaces the value
- Enter/blur saves, Escape cancels
- No modal, no popup, no blocker

**Capital not set (totalCapital === 0 or null):**
- Gold-tinted inline card: "Set your total capital to start sizing strategies"
- "Set capital" button reveals inline input + Save button
- Same calm pattern as "No strategies queued" empty state

## Firestore path confirmation

Capital reads and writes both use the same path:
- `users/:uid/portfolioSettings/config` → `totalCapital` field
- `usePortfolioSettings.js` line 20: reads via `getDoc`
- `usePortfolioSettings.js` line 44: writes via `setDoc` with merge
- Build page summary tile reads `settings.totalCapital`
- No path mismatch.

## Design-system inconsistencies flagged

| Element | Current state | Design-system pattern | Action needed |
|---|---|---|---|
| OnboardingModal risk cards | Fixed 3-col grid, pill radius `999px`, flex-column layout | Matches `--nl-radius-pill` and card patterns | Done — fixed in this session |
| OnboardingModal brand name | Was "NewLeaf System", now "NewLeaf Trading" | Brand constant should exist in a shared config | Future: create a `BRAND_NAME` constant in a shared config file, used by OnboardingModal, AppHeader, Footer, LoginPage |
| Quick-select buttons in OnboardingModal | Pill-shaped, 1px border, `--gray-200` border colour | Matches `filter-chip` pattern in design system | OK |
| Goal cards in OnboardingModal | 2-col auto-fit grid, checkmark on selection | Matches selection-card pattern | OK |
| Drawdown slider in OnboardingModal | Range input with custom thumb | Matches `nl-range-input` pattern in design system | OK |

## Accumulated cleanup list

| Item | Status | Notes |
|---|---|---|
| `/trading/position-legacy/:tileId` route | Done | Retired in Phase 6c |
| OnboardingModal removed from BuildPage | Done | Replaced with inline capital editor |
| Dead page files on disk | Ready to delete | `DiscoverPage.jsx`, `PortfolioPage.jsx`, `PortfolioPageNew.jsx`, `PortfolioPageNew.jsx.bak`, `PerformancePage.jsx`, `HomePage.jsx` |
| `dashboard-mockup.css` | Ready to delete | No longer imported after DashboardPage rewrite |
| `alertEngine.js` | Ready to delete | Fully replaced by verdict engine |
| `OnboardingModal.jsx` | Candidate for deletion | No active consumers. Could keep for reference or delete. |
| Rename `/trading` → `/invest` | Pending decision | Needs testing against real positions first |
| Rename "NewLeaf Trading" → final brand | Pending decision | Affects AppHeader, Footer, LoginPage, landing pages |
| Brand name constant | Future | Create shared `BRAND_NAME` constant instead of hardcoding across components |
| HeyGen script + marketing update | Blocked by rename decision | |
| 24-hour soft prompt for unresolved pendingOrders | Future UX | Toast or banner on dashboard when a pendingOrder has been `ready_to_execute` for >24h |
| React component UI tests | Future | When project grows beyond solo scale |
| Aggregated adjustment history view | Future | Data exists in adjustments subcollection |
| `needsOnboarding` logic in usePortfolioSettings | Simplified | Now checks `totalCapital` presence — may want to remove `isConfigured` field entirely as redundant |
| Workbench migration to shared PayoffChart | Future | Migrate `workbench/strategy-builder.html` to use `src/trading/utils/payoffMath.js`. Eliminates duplicate vanilla-JS payoff implementation. |

## Future catalogue expansion: active defence adjustments

The "active defence" class of adjustments is underrepresented. Iron Condor now has "Roll put side up" (bullish defence), but similar moves exist for other strategies:

- **Iron Condor**: convert to butterfly, add call spread above breached level
- **Bull Put Spread**: add call credit spread to neutralise
- **Bear Call Spread**: add put credit spread to neutralise
- **BWB**: roll narrow side out

Full review and expansion is a future phase. Also worth considering: a "trader view" filter (bullish/neutral/bearish) to surface adjustments that match the user's current directional opinion.
