# NewLeaf — Invest UX rebuild (Claude Code prompt)

Paste this whole file into Claude Code from the repo root (`/Users/manish/newleafsystem/`).
Drop the five HTML mocks into `docs/ux-mocks/` first — they are the visual source of truth.

---

## Goal

Rebuild the Invest surfaces so **total-dollar P&L is the single stored truth and every other number is a pure derivation of it**. This kills the class of bug where the same position shows different P&L on different screens, and removes the per-contract-vs-total confusion. Match the five mocks pixel-intent (not pixel-perfect) and keep the existing brand.

## Repo context (do not re-derive — assume these)

- Monorepo. Web app is React. Firestore (`newleafdb`), Cloudflare R2, Alpaca, OpenRouter, Claude API.
- **D-canonical is law:** `generaterecommendations/` is the sole Firestore writer. No other module writes position/P&L state.
- Six-phase lifecycle: Discover → Decide → Build → Execute → Defend → Adjust.
- Brand tokens (use the existing ones if already defined; otherwise add):
  - Fonts: Fraunces (display), DM Sans (body), Space Mono (numbers)
  - Colors: forest green `#0F3D2E` / deep `#062e22`, gold `#C8A85A`, cream `#F7F4EE`, paper `#fffdf8`, profit `#16835f`, loss `#d94f4f`, amber `#bd7c19`

## Visual source of truth

`docs/ux-mocks/` contains:
- `01-invest-home.html` — Invest home / lifecycle + today's decision summary + flagged rows
- `02-positions.html` — Positions list (decision cards with inline risk gauge)
- `03-position-detail.html` — **Defend** view (open position)
- `04-performance.html` — Performance (track record vs open risk, reconciliation)
- `05-decide-candidate.html` — **Decide** view (pre-trade candidate, sizing stepper)

Read all five before writing code. They define copy, layout, and the two detail-view split.

---

## The core principle (enforce everywhere)

1. The canonical record stores **total dollars**: `pnlTotal`, `pnlPrevClose`, `maxProfitTotal`, `maxLossTotal`, plus `qty`. Per-contract is **always** `total / qty`, never the reverse. No surface multiplies a per-contract figure by qty.
2. Every displayed metric (per-contract, % of max profit, loss used, daily, return on risk, gauge positions, review type, recommendation copy) is produced by **one** pure helper `derivePosition()`. Surfaces import it; they never recompute.
3. `status` (`candidate | open | closed`) routes between the **Decide** view and the **Defend** view. Post-entry-only fields are absent on candidates, so a candidate can never render a "Current P&L."

---

## Work in phases. Plan first, get approval, then implement in small commits. Run typecheck + tests after each phase.

### Phase 0 — orient & propose a plan
- Locate the web app, the Firestore read layer, and `generaterecommendations/`.
- Identify where the current Invest pages live and where shared UI/types should go.
- Output a short written plan + file list. **Wait for my approval before editing.**

### Phase 1 — canonical types + `derivePosition()` + unit tests
Create the type and pure helper (adjust import paths / lib to match repo conventions). This is the backbone — get it reviewed before building UI.

```ts
export type PositionStatus = 'candidate' | 'open' | 'closed';
export type ReviewType = 'time' | 'loss' | 'profit' | null;

export interface Leg {
  action: 'sell' | 'buy';
  type: 'call' | 'put';
  strike: number;
  entryPrice: number;
  currentPrice?: number;   // open only
  delta: number;
  theta: number;
}

export interface CanonicalPosition {
  id: string;
  symbol: string;
  name?: string;
  strategy: string;            // 'iron_condor' | ...
  status: PositionStatus;
  qty: number;                 // contracts
  dte: number;
  spot: number;
  spotPrevClose?: number;

  // AUTHORITATIVE total dollars (sole source of truth)
  maxProfitTotal: number;      // positive
  maxLossTotal: number;        // positive magnitude

  // present only when status !== 'candidate'
  entryDate?: string;
  entryCreditPerContract?: number;
  pnlTotal?: number;           // since entry, total $
  pnlPrevClose?: number;       // pnlTotal as of prior session close (for daily)

  probability?: number;        // 0..1
  breakevens?: [number, number];
  legs?: Leg[];
}

// Tunable thresholds — keep in one config object.
export const REVIEW = {
  timeDteThreshold: 21,   // 21-DTE management rule
  profitTakePct: 35,      // capture >= this => profit-take review
  lossReviewPct: 8,       // loss used >= this => loss review
};

export function derivePosition(p: CanonicalPosition) {
  const span = p.maxLossTotal + p.maxProfitTotal;
  const breakevenPct = (p.maxLossTotal / span) * 100;       // qty-independent
  const rewardRisk = p.maxProfitTotal / p.maxLossTotal;

  const isOpen = p.status !== 'candidate' && p.pnlTotal != null;
  const pnlTotal = p.pnlTotal ?? 0;
  const perContract = isOpen ? pnlTotal / p.qty : 0;
  const daily =
    isOpen && p.pnlPrevClose != null ? pnlTotal - p.pnlPrevClose : null;
  const dailyPerContract = daily != null ? daily / p.qty : null;

  const nowPct = isOpen ? ((pnlTotal + p.maxLossTotal) / span) * 100 : null;
  const profitCapturedPct = (pnlTotal / p.maxProfitTotal) * 100;  // signed
  const lossUsedPct = pnlTotal < 0 ? (Math.abs(pnlTotal) / p.maxLossTotal) * 100 : 0;
  const remainingDownside = p.maxLossTotal + pnlTotal;  // $ from here to max loss
  const maxProfitLeft = p.maxProfitTotal - pnlTotal;
  const returnOnRiskPct = (pnlTotal / p.maxLossTotal) * 100;

  let flagged = false;
  let review: ReviewType = null;
  if (isOpen) {
    if (pnlTotal < 0) { review = 'loss'; flagged = lossUsedPct >= REVIEW.lossReviewPct; }
    else if (profitCapturedPct >= REVIEW.profitTakePct) { review = 'profit'; flagged = true; }
    else if (p.dte <= REVIEW.timeDteThreshold) { review = 'time'; flagged = true; }
  }

  return {
    ...p, span, breakevenPct, rewardRisk, isOpen,
    pnlTotal, perContract, daily, dailyPerContract,
    nowPct, profitCapturedPct, lossUsedPct,
    remainingDownside, maxProfitLeft, returnOnRiskPct,
    flagged, review,
  };
}

// Derived copy — so recommendation text can't drift from the numbers either.
export function recommendation(d: ReturnType<typeof derivePosition>): string {
  switch (d.review) {
    case 'time':  return `Consider closing or rolling — only ${d.dte} DTE remain and just ${Math.round(d.profitCapturedPct)}% of the credit is captured.`;
    case 'loss':  return `Review an adjustment — loss building (${Math.round(d.lossUsedPct)}% of max loss used) with ${d.dte} DTE left to defend.`;
    case 'profit':return `Consider taking profit — ${Math.round(d.profitCapturedPct)}% captured; harvest if it hits your target threshold.`;
    default:      return 'On track — no action needed.';
  }
}
```

Money formatting must be one shared helper too (Intl.NumberFormat), e.g. `usd(n)`, `signedUsd(n)`, `pct(n, dp)`. Round at the display boundary only.

**Tests (must pass):** with the snapshot used in the mocks —
- ABNB: `pnlTotal 176, maxProfitTotal 3124, maxLossTotal 5676, qty 44, dte 7, pnlPrevClose 150` → perContract `4`, daily `26`, profitCaptured ≈ `5.6%`, lossUsed `0`, remainingDownside `5852`, maxProfitLeft `2948`, review `time`.
- BIDU: `pnlTotal -611, maxLossTotal 5610, maxProfitTotal 2190, qty 13, dte 20` → perContract `-47`, lossUsed ≈ `10.9%`, returnOnRisk ≈ `-10.9%`, review `loss`.
- AMZN: `pnlTotal 196, maxProfitTotal 506, maxLossTotal 5494, qty 4, dte 14` → profitCaptured ≈ `38.7%`, review `profit`.
- candidate (status `candidate`, no `pnlTotal`): `isOpen false`, `nowPct null`, `daily null`, `review null`, but `breakevenPct` and `rewardRisk` still compute.

### Phase 2 — shared component kit (one place, both detail views consume)
- `RiskGauge` — props `{ maxLossTotal, maxProfitTotal, pnlTotal?, unit: 'total'|'perContract', qty }`. Renders loss zone / profit zone / break-even, and a "now" marker **only when `pnlTotal` is provided** (open). Marker color from sign. Toggle swaps dollar labels only; percentages/positions are unit-free.
- `MetricCard`, `ReviewBadge` (time=amber, loss=red, profit=green), `LegsTable` (entry-only vs entry+current depending on `status`), `PayoffChart` (condor tent w/ breakevens + spot; "now" line only when open), `MoneyBreakdown` (`+$4 × 44 = +$176`).

### Phase 3 — wire the five views from `derivePosition()` output
- Position detail = **Defend** (`status: open`): hero total-first + daily, decision summary (remaining downside / max profit left / recommendation), metrics (Total P&L, Today, Profit captured, Loss used, Time state), gauge w/ Total↔Per-contract toggle, legs entry-vs-current, payoff, why-flagged, timeline.
- Decide candidate (`status: candidate`): reward:risk + probability + breakevens + capital required, sizing stepper that rescales totals (R:R & probability fixed), gauge with no marker, legs "you'd open", payoff, Take/Save/Pass.
- Positions list: decision cards, inline gauge, per-row chips (per-contract math, captured, loss used), review badge, one-line recommendation.
- Performance: stat cards + **reconciliation** (realised + unrealised = total, today), Open-risk section vs Closed track record. Replace any `% of max` with `% of max profit` + `return on risk`.
- Invest home: lifecycle + today's decision summary strip + flagged rows (3-part context + review badge).

### Phase 4 — make `generaterecommendations/` emit the canonical fields
- Ensure the writer outputs `status`, `maxProfitTotal`, `maxLossTotal`, `pnlTotal`, and **`pnlPrevClose`** (snapshot of `pnlTotal` at prior session close — add a daily snapshot job if one doesn't exist). Candidates are written with `status: 'candidate'` and **no** entry/pnl fields.
- Remove any P&L computation that currently lives in read paths / components.

---

## Constraints

- **Must:** keep `generaterecommendations/` as the only writer; all reads go through `derivePosition()`; total dollars are authoritative; per-contract is always `/ qty`.
- **Must not:** recompute P&L in any view; multiply per-contract by qty anywhere; store both per-contract and total as independent fields; introduce a single conditional template for both detail views — keep two views over the shared kit.
- Keep diffs small and reversible. Don't touch unrelated pipeline/report code. Match existing lint/format and TS config.

## Acceptance criteria

- A given position renders the **same** total P&L on home, positions list, detail, and performance.
- No `% of max` computed by dividing a total by a per-contract figure (the old `-628%` bug is impossible).
- A `candidate` record cannot render Current P&L / since-entry / history.
- `derivePosition()` unit tests pass; typecheck clean; existing tests stay green.
- Review badges (time/loss/profit) and recommendation copy come from the helper, not hardcoded per surface.

## Start

Begin with Phase 0: explore the repo and propose the plan + file list. Do not edit until I approve.
