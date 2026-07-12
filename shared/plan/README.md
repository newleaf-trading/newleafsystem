# shared/plan

Deterministic model behind the Workbench **Detail Plan** surface (`/workbench/plan`) — the
operational layer under the projection curve at `/workbench/projection`.

**Principle (non-negotiable): deterministic code computes every number; LLMs only narrate.**
The ladder, calendar, timeline, monthly/yearly roll-ups and traffic-light status are pure
functions of `config + the live broker/journal feed`. No LLM sits in the compute path. All
dates are **injected** (never `Date.now()`) and SANDBOX what-if numbers flow through a
**seeded PRNG**, so identical inputs always yield identical output.

## Config

```js
{
  horizonYears: 1 | 3 | 5,
  capital, riskPerTrade,
  lanes: { bcs|ic|bfly: { qty, expiry, every, on } },
  thresholds: { takeProfitPct:50, drawdownPct:-25, stopPct:-100, manageDte:21, actDte:7 },
  targets: { bcs:180, ic:120, bfly:80 },   // planned realised credit per contract
}
```

Presets: `base` (bcs 1/3/3 · ic 2/2/2 · bfly 2/1/1), `spreads` (2 BCS·3w), `condors3` (3 IC·2w),
`condor1` (1 IC·1w). Editing any lane makes `presetOf(cfg)` return `'custom'`.

## API

```js
const PM = require('newleafsystem-shared-plan'); // or window.PlanModel in the browser

PM.cyclesForLane(cfg, 'bcs');         // [{openWeek,endWeek,qty}] — ONE entry per cycle (drives the Gantt)
PM.buildCalendar(cfg, opts);          // weeks[{week,date,opens{},closes{}}]
PM.positionsForWeek(cfg, w, opts);    // live contracts in week w (+ {sandbox}/{live} overlays)
PM.statusOf(pnlPct, dte, missing, cfg);// {level: go|watch|act, label, action, reasons}
PM.monthBuckets(cfg, opts);           // per calendar-month opens/expiries/planned profit (hYear)
PM.yearBuckets(cfg, opts);            // per horizon-year, planned profit split by structure
PM.compliancePct(checks);             // weekly checklist → %
PM.missingScheduledOpen(cfg, w, checks, opts); // unticked scheduled open → feeds missing=true
```

`opts` injects the start Monday: `{ todayISO }` → week 1 is the next Monday, or `{ startISO }`
for a fixed week-1 date (used by the tests).

Management rules in `statusOf` (editable per book via `cfg.thresholds`): GREEN −25%…+50% & DTE>21;
AMBER +50% bank / −25% drawdown / DTE 8–21; RED −100% (2× credit) / DTE≤7 / scheduled trade missing.

## Tests

The monorepo has no Jest runner — `shared/*` modules self-test via a plain node harness
(same as `shared/indicators`):

```bash
node shared/plan/index.test.js
```

Spec sanity (base / 3yr): **52 BCS + 156 IC + 312 BFLY expiries**, **$53,040 planned**.

## Browser copy / drift guard

The static Workbench has no bundler, so the browser loads a generated copy:

```bash
node shared/plan/sync.js          # write web/workbench/public/js/planModel.js
node shared/plan/sync.js --check  # exit 1 if stale (CI guard)
```

Edit `index.js` only; never hand-edit the generated `planModel.js`.
