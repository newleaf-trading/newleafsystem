'use strict';

/**
 * Detail-Plan model tests — mirrors the shared/indicators/index.test.js convention
 * (the monorepo has no Jest runner; shared/* modules self-test via a plain node harness).
 * Run: node shared/plan/index.test.js   (exit 1 on any failure)
 *
 * Deterministic throughout: a fixed startISO is injected so week dates never depend on the
 * wall clock, and the SANDBOX seeded PRNG is asserted reproducible.
 */

const M = require('./index');

let passed = 0;
let failed = 0;
function assert(condition, label) {
  if (condition) { passed++; } else { failed++; console.error(`  FAIL: ${label}`); }
}
function eq(a, b, label) { assert(a === b, `${label} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`); }

function cfg(years) { const c = M.defaultConfig(); c.horizonYears = years || 3; return c; }
const OPTS = { startISO: '2026-01-05' }; // a Monday

// ── dates ─────────────────────────────────────────────────────────────────
console.log('Dates');
eq(M.nextMondayISO('2026-06-27'), '2026-06-29', 'nextMonday from a Saturday → following Monday');
eq(M.nextMondayISO('2026-06-29'), '2026-06-29', 'nextMonday from a Monday → same day');
eq(M.nextMondayISO('2026-06-28'), '2026-06-29', 'nextMonday from a Sunday → next day');
eq(M.weekDateISO(3, '2026-01-05'), '2026-01-19', 'week 3 is +14 days');

// ── totalWeeks ─────────────────────────────────────────────────────────────
console.log('totalWeeks');
eq(M.totalWeeks(cfg(1)), 52, '1yr → 52 weeks');
eq(M.totalWeeks(cfg(3)), 156, '3yr → 156 weeks');
eq(M.totalWeeks(cfg(5)), 260, '5yr → 260 weeks');

// ── cyclesForLane (drives the timeline) ────────────────────────────────────
console.log('cyclesForLane');
{
  const c = cfg(3);
  const bcs = M.cyclesForLane(c, 'bcs');
  const ic = M.cyclesForLane(c, 'ic');
  const bfly = M.cyclesForLane(c, 'bfly');
  // base/3yr cycle counts: BCS opens wk 1,4,…,154 → 52; IC wk 1,3,…,155 → 78; BFLY wk 1..156 → 156.
  eq(bcs.length, 52, 'BCS cycles 3yr → 52');
  eq(ic.length, 78, 'IC cycles 3yr → 78');
  eq(bfly.length, 156, 'BFLY cycles 3yr → 156');
  // a cycle's span is exactly `expiry` weeks (away from the horizon edge).
  eq(bcs[0].openWeek, 1, 'first BCS opens week 1');
  eq(bcs[0].endWeek, 3, 'first BCS spans 3 weeks (expiry)');
  eq(bcs[1].openWeek, 4, 'second BCS opens week 4 (every 3)');
  eq(ic[0].endWeek, 2, 'first IC spans 2 weeks');
  eq(bfly[0].endWeek, 1, 'first BFLY spans 1 week');
  eq(bcs[0].qty, 1, 'BCS qty 1'); eq(ic[0].qty, 2, 'IC qty 2'); eq(bfly[0].qty, 2, 'BFLY qty 2');
  // off / empty lanes yield no cycles
  const off = cfg(1); off.lanes.bcs.on = false;
  eq(M.cyclesForLane(off, 'bcs').length, 0, 'off lane → no cycles');
}

// ── buildCalendar: open/close scheduling ───────────────────────────────────
console.log('buildCalendar');
{
  const cal = M.buildCalendar(cfg(1), OPTS);
  eq(cal.length, 52, '1yr calendar has 52 weeks');
  eq(cal[0].date, '2026-01-05', 'week 1 carries the start date');
  eq(cal[0].opens.bfly, 2, 'bfly opens 2 in week 1');
  eq(cal[0].closes.bfly, 2, 'bfly (1wk) closes 2 in week 1');
  eq(cal[0].opens.ic, 2, 'ic opens 2 in week 1');
  eq(cal[1].opens.ic || 0, 0, 'ic does NOT open in week 2 (every 2)');
  eq(cal[1].closes.ic, 2, 'ic cohort from wk1 closes in week 2');
  eq(cal[0].opens.bcs, 1, 'bcs opens 1 in week 1');
  eq(cal[2].closes.bcs, 1, 'bcs cohort from wk1 closes in week 3');
}

// ── SPEC ASSERT: base/3yr expiry counts + planned profit ───────────────────
console.log('roll-up totals (spec)');
{
  const c = cfg(3);
  const cal = M.buildCalendar(c, OPTS);
  const expir = { bcs: 0, ic: 0, bfly: 0 };
  cal.forEach((w) => { for (const k in w.closes) expir[k] += w.closes[k]; });
  eq(expir.bcs, 52, 'base/3yr → 52 BCS expiries');
  eq(expir.ic, 156, 'base/3yr → 156 IC expiries');
  eq(expir.bfly, 312, 'base/3yr → 312 BFLY expiries');

  const years = M.yearBuckets(c, OPTS);
  const planned = years.reduce((a, y) => a + y.planned, 0);
  eq(planned, 52 * 180 + 156 * 120 + 312 * 80, 'planned profit = Σ expiries × target');
  eq(planned, 53040, 'base/3yr planned profit ≈ $53k (exactly $53,040)');
  eq(years.length, 3, '3yr → 3 year buckets');
  // per-structure planned splits sum to the year total
  const y1 = years[0];
  eq(y1.plannedBy.bcs + y1.plannedBy.ic + y1.plannedBy.bfly, y1.planned, 'year planned == Σ per-structure');
}

// ── compoundYears (reinvest realized gains) ────────────────────────────────
console.log('compoundYears');
{
  const c = cfg(5); c.capital = 100000;
  const flat = M.yearBuckets(c, OPTS);
  const comp = M.compoundYears(c, OPTS);
  eq(comp.length, 5, '5 compounded year rows');
  // Year 1 is unscaled (factor 1.0)
  assert(approxEq(comp[0].planned, flat[0].planned), 'year 1 planned == base (factor 1.0)');
  eq(comp[0].capitalStart, 100000, 'year 1 starts at capital');
  // Each subsequent year strictly grows (gains reinvested)
  for (let i = 1; i < comp.length; i++) {
    assert(comp[i].planned > comp[i - 1].planned, `year ${i + 1} planned > year ${i} (compounding)`);
    assert(approxEq(comp[i].capitalStart, comp[i - 1].capitalEnd), `year ${i + 1} opens at prior year-end capital`);
  }
  // per-structure split still sums to the (scaled) year total
  const y2 = comp[1];
  assert(approxEq(y2.plannedBy.bcs + y2.plannedBy.ic + y2.plannedBy.bfly, y2.planned), 'compounded per-structure sums to year total');
  // higher capital → smaller % return → less compounding lift
  const rich = cfg(5); rich.capital = 1000000;
  const compRich = M.compoundYears(rich, OPTS);
  assert((compRich[4].planned / compRich[0].planned) < (comp[4].planned / comp[0].planned), 'more capital → flatter compounding');

  // RECONCILED with projection edge: capital compounds at edge over the plan's trade count
  const edged = cfg(1); edged.capital = 100000; edged.edgePerTrade = 0.0036; // 0.36%/trade
  const ce = M.compoundYears(edged, OPTS);
  const trades1 = ce[0].trades;
  assert(trades1 > 0, 'year carries its scheduled trade count');
  eq(ce[0].basis, 'edge', 'edge basis when edgePerTrade set');
  assert(approxEq(ce[0].capitalEnd, 100000 * Math.pow(1.0036, trades1)), 'capitalEnd = cap·(1+edge)^trades');
  // a bigger edge → strictly more growth (monotonic in edge)
  const edged2 = cfg(1); edged2.capital = 100000; edged2.edgePerTrade = 0.0072;
  assert(M.compoundYears(edged2, OPTS)[0].planned > ce[0].planned, 'larger edge → more planned growth');
  // no edge → falls back to self-rate (basis 'realized')
  eq(M.compoundYears(cfg(1), OPTS)[0].basis, 'realized', 'no edge → realized self-rate basis');

  // RECONCILED + tpy match: plan final capital == projection's cap·(1+ev)^(tpy·yrs)
  const match = cfg(5); match.capital = 100000; match.edgePerTrade = 0.0036; match.projectionTpy = 240;
  const cm = M.compoundYears(match, OPTS);
  cm.forEach((y, i) => { assert(y.tpyMatched === true, `year ${i + 1} uses projection tpy`); eq(y.trades, 240, `year ${i + 1} compounds over 240 trades`); });
  const planFinal = cm[cm.length - 1].capitalEnd;
  const projFinal = 100000 * Math.pow(1.0036, 240 * 5); // projection engine's expected final
  assert(approxEq(planFinal / projFinal, 1) || Math.abs(planFinal - projFinal) / projFinal < 1e-9, 'plan final == projection final when tpy matched');
  // scheduledTrades still reports the cadence's own count (transparency)
  assert(cm[0].scheduledTrades > 0 && cm[0].scheduledTrades !== 240, 'scheduledTrades reports the cadence count, distinct from tpy');
}
function approxEq(a, b) { return Math.abs(a - b) < 0.01; }

// ── positionsForWeek ───────────────────────────────────────────────────────
console.log('positionsForWeek');
{
  const pos = M.positionsForWeek(cfg(1), 1, OPTS);
  eq(pos.length, 5, 'week 1 base ladder: 1 BCS + 2 IC + 2 BFLY = 5 live');
  const bcs = pos.find((p) => p.id === 'bcs-1-1');
  eq(bcs.end, 3, 'bcs-1-1 expires week 3');
  eq(bcs.dte, (3 - 1) * 7 + 5, 'bcs-1-1 DTE = 19 (deterministic)');
  const w2 = M.positionsForWeek(cfg(1), 2, OPTS);
  assert(!w2.some((p) => p.id === 'bfly-1-1'), 'bfly-1-1 expired, not live in wk2');
  assert(w2.some((p) => p.id === 'bfly-2-1'), 'bfly-2-1 (opened wk2) is live in wk2');
}
{
  const a = M.positionsForWeek(cfg(1), 1, Object.assign({ sandbox: true }, OPTS));
  const b = M.positionsForWeek(cfg(1), 1, Object.assign({ sandbox: true }, OPTS));
  eq(a[0].pnlPct, b[0].pnlPct, 'sandbox pnlPct reproducible');
  assert(a.some((p) => p.pnlPct !== 0), 'sandbox fills non-zero pnl');
  const live = { 'bcs-1-1': { pnl: 90, pnlPct: 50, dte: 4 } };
  const lp = M.positionsForWeek(cfg(1), 1, Object.assign({ live: live }, OPTS)).find((p) => p.id === 'bcs-1-1');
  eq(lp.pnl, 90, 'live overlay sets pnl');
  eq(lp.dte, 4, 'live overlay sets dte');
}

// ── statusOf ───────────────────────────────────────────────────────────────
console.log('statusOf');
const C = cfg(1);
eq(M.statusOf(10, 30, false, C).level, 'go', 'mid pnl, far DTE → green');
eq(M.statusOf(50, 30, false, C).level, 'watch', '+50% take-profit → amber');
eq(M.statusOf(-25, 30, false, C).level, 'watch', '-25% drawdown → amber');
eq(M.statusOf(10, 15, false, C).level, 'watch', 'DTE 15 (8-21) → amber');
eq(M.statusOf(-100, 30, false, C).level, 'act', '2× credit stop → red');
eq(M.statusOf(10, 5, false, C).level, 'act', 'DTE 5 → red');
eq(M.statusOf(10, 30, true, C).level, 'act', 'missing scheduled trade → red');
eq(M.statusOf(-100, 5, false, C).level, 'act', 'stop dominates DTE-watch (no downgrade)');
eq(M.statusOf(10, 22, false, C).level, 'go', 'DTE 22 just outside manage window → green');
{
  const tight = cfg(1);
  tight.thresholds = Object.assign({}, M.DEFAULT_THRESHOLDS, { takeProfitPct: 30 });
  eq(M.statusOf(35, 30, false, tight).level, 'watch', 'custom +30% take-profit → amber');
  eq(M.statusOf(35, 30, false, C).level, 'go', 'same pnl green under default 50%');
}

// ── presetOf ───────────────────────────────────────────────────────────────
console.log('presetOf');
eq(M.presetOf(cfg(1)), 'base', 'default lanes match base preset');
{
  const edited = cfg(1); edited.lanes.bcs.qty = 9;
  eq(M.presetOf(edited), 'custom', 'editing a lane → custom');
}

// ── probability of profit / risk-reward ────────────────────────────────────
console.log('portfolioOdds');
function approx(a, b, tol) { return Math.abs(a - b) <= (tol || 0.005); }
{
  const c = cfg(3);
  // defaults: ic pop .70 rr 1, bfly pop .45 rr 2, bcs pop .70 rr 2
  eq(M.oddsOf(c, 'ic').rewardToRisk, 1, 'ic reward:risk 1');
  eq(M.oddsOf(c, 'bfly').pop, 0.45, 'bfly pop 0.45');
  // risk = target ÷ rewardToRisk
  eq(M.riskOf(c, 'bcs'), 90, 'bcs risk = 180 / 2 = 90');
  eq(M.riskOf(c, 'ic'), 120, 'ic risk = 120 / 1 = 120');
  eq(M.riskOf(c, 'bfly'), 40, 'bfly risk = 80 / 2 = 40');

  const po = M.portfolioOdds(c, OPTS);
  // base/3yr trade counts: 52 BCS, 156 IC, 312 BFLY (= 520 trades)
  eq(po.trades, 520, 'total trades = 520');
  // blended POP = (52·.70 + 156·.70 + 312·.45) / 520
  assert(approx(po.blendedPop, (52*0.70 + 156*0.70 + 312*0.45) / 520), 'blended POP weighted by trade count');
  // blended reward:risk = Σreward / Σrisk
  const totR = 52*180 + 156*120 + 312*80;          // 53,040 (== planned profit)
  const totK = 52*90 + 156*120 + 312*40;           // risk dollars
  assert(approx(po.blendedRewardToRisk, totR / totK, 0.001), 'blended reward:risk = Σreward/Σrisk');
  eq(po.totalReward, 53040, 'total reward == planned profit');
  // expectancy per trade = Σ(ev·n)/Σn ; ev_i = pop·reward − (1−pop)·risk
  const ev = { bcs: 0.70*180 - 0.30*90, ic: 0.70*120 - 0.30*120, bfly: 0.45*80 - 0.55*40 };
  const expExpect = (ev.bcs*52 + ev.ic*156 + ev.bfly*312) / 520;
  assert(approx(po.expectancyPerTrade, expExpect, 0.001), 'expectancy per trade blends EV');
  // selecting strategies changes the blend: condor-only mix → POP 70%, R:R 1:1
  const icOnly = cfg(3); icOnly.lanes = JSON.parse(JSON.stringify(M.PRESETS.condors3));
  const po2 = M.portfolioOdds(icOnly, OPTS);
  assert(approx(po2.blendedPop, 0.70), 'IC-only mix → blended POP 70%');
  assert(approx(po2.blendedRewardToRisk, 1, 0.001), 'IC-only mix → blended R:R 1:1');
}

// ── compliance ─────────────────────────────────────────────────────────────
console.log('compliance');
eq(M.compliancePct({}), 0, 'no checks → 0%');
eq(M.compliancePct({ opens: 1, profit: 1, dte: 1, stop: 1, risk: 1, cadence: 1, journal: 1 }), 100, 'all checks → 100%');
assert(M.missingScheduledOpen(cfg(1), 1, {}, OPTS) === true, 'unticked scheduled open → missing');
assert(M.missingScheduledOpen(cfg(1), 1, { opens: true }, OPTS) === false, 'ticked open → not missing');

// ── summary ─────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
