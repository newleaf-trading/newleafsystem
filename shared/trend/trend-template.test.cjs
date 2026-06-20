'use strict';

/**
 * trend-template.test.cjs — Deterministic tests for shared/trend/ (Phase 2)
 * Run: node shared/trend/trend-template.test.cjs
 *
 * Fixtures are small and hand-built — no live data, no clock reads.
 */

const { computeTrendTemplate, DEFAULT_CONFIG } = require('./trend-template.cjs');

let passed = 0, failed = 0;
function assert(cond, name) {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.error(`  FAIL  ${name}`); }
}
function eq(a, b, name) { assert(a === b, `${name} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`); }

// ── Fixture builders ────────────────────────────────────────────────────────
const BASE_DATE = new Date('2024-01-01'); // fixed string parse — deterministic, not the clock
function dateFor(i) { const d = new Date(BASE_DATE); d.setDate(d.getDate() + i); return d.toISOString().split('T')[0]; }

function bar(i, close, opts = {}) {
  return {
    date: dateFor(i),
    open: opts.open ?? close,
    high: opts.high ?? close + 0.02,
    low: opts.low ?? close - 0.02,
    close,
    volume: opts.volume ?? 1_000_000,
  };
}

/** closes[] → bars with sequential dates. */
function barsFromCloses(closes, volFn) {
  return closes.map((c, i) => bar(i, +c.toFixed(4), { volume: volFn ? volFn(i) : 1_000_000 }));
}
function rampCloses(n, start, end) {
  return Array.from({ length: n }, (_, i) => start + (end - start) * (i / (n - 1)));
}
function flatBars(n, price) { return barsFromCloses(Array.from({ length: n }, () => price)); }
function rampBars(n, start, end) { return barsFromCloses(rampCloses(n, start, end)); }

/** 60-bar VCP base from pivots (contracting pullbacks); volume dries when `dry`. */
function vcpBaseBars(dry) {
  const pivots = [
    { i: 0, p: 90 }, { i: 8, p: 100 }, { i: 14, p: 90 }, { i: 22, p: 100 },
    { i: 28, p: 94 }, { i: 36, p: 100 }, { i: 42, p: 97 }, { i: 50, p: 100 }, { i: 59, p: 99 },
  ];
  const bars = [];
  for (let i = 0; i < 60; i++) {
    let a = pivots[0], b = pivots[pivots.length - 1];
    for (let k = 0; k < pivots.length - 1; k++) {
      if (i >= pivots[k].i && i <= pivots[k + 1].i) { a = pivots[k]; b = pivots[k + 1]; break; }
    }
    const t = b.i === a.i ? 0 : (i - a.i) / (b.i - a.i);
    const c = +(a.p + (b.p - a.p) * t).toFixed(4);
    bars.push(bar(i, c, { volume: dry ? (i < 30 ? 3_000_000 : 1_000_000) : 2_000_000 }));
  }
  return bars;
}

/** Concatenate bar arrays and re-stamp sequential dates (preserves OHLCV). */
function concatRedate(...arrs) {
  return arrs.flat().map((b, i) => ({ ...b, date: dateFor(i) }));
}

/** Plateau-then-decline: maStackDown + priceBelow200 + rsNegative true, but SMA200 still RISING. */
function earlyConflictBars() {
  const closes = [
    ...Array.from({ length: 60 }, () => 100),   // bars 0-59: low base (200 bars ago = low → slope up)
    ...Array.from({ length: 50 }, () => 200),   // bars 60-109: high plateau (150-200 ago)
    ...rampCloses(150, 200, 130),               // bars 110-259: 150-bar decline → 50<150<200 stack
  ];
  return barsFromCloses(closes);
}

const FLAT_BENCH_260 = flatBars(260, 400);

// ── 1: clean uptrend near highs, positive RS → aligned ───────────────────────
(() => {
  const r = computeTrendTemplate({ bars: rampBars(260, 100, 230), benchmarkBars: FLAT_BENCH_260 });
  console.log('\n[1] clean uptrend → aligned');
  eq(r.verdict, 'aligned', 'verdict aligned');
  ['maStack', 'priceAboveStack', 'ma200Rising', 'rsPositive', 'near52wHigh', 'off52wLow'].forEach(k => assert(r.checks[k], `check ${k} true`));
  eq(r.trendScore, 100, 'trendScore 100 (all six gating checks)');
})();

// ── 2: sustained downtrend near 52w low, negative RS → conflicted (all 4) ─────
(() => {
  const r = computeTrendTemplate({ bars: rampBars(260, 230, 100), benchmarkBars: FLAT_BENCH_260, benchmarkSymbol: 'SPY' });
  console.log('\n[2] sustained downtrend → conflicted');
  eq(r.verdict, 'conflicted', 'verdict conflicted');
  ['maStackDown', 'priceBelow200', 'rsNegative', 'ma200Falling'].forEach(k => assert(r.down[k], `down ${k} true`));
  eq(r.provenance.benchmarkSymbol, 'SPY', 'provenance benchmarkSymbol');
})();

// ── 3: flat / chop → neutral ─────────────────────────────────────────────────
(() => {
  const r = computeTrendTemplate({ bars: flatBars(260, 150), benchmarkBars: flatBars(260, 150) });
  console.log('\n[3] flat chop → neutral');
  eq(r.verdict, 'neutral', 'verdict neutral');
  assert(!r.checks.maStack && !r.down.maStackDown, 'neither stack ordering holds');
  assert(!r.checks.rsPositive && !r.down.rsNegative, 'RS neither positive nor negative');
})();

// ── 4: A1 asymmetric boundary — conflicted at 3/4 with ma200Falling FALSE ─────
(() => {
  const r = computeTrendTemplate({ bars: earlyConflictBars(), benchmarkBars: FLAT_BENCH_260 });
  console.log('\n[4] early-flag: 3/4 down-core, SMA200 not yet rolled over');
  eq(r.verdict, 'conflicted', 'verdict conflicted on 3/4');
  assert(r.down.maStackDown, 'maStackDown true');
  assert(r.down.priceBelow200, 'priceBelow200 true');
  assert(r.down.rsNegative, 'rsNegative true');
  eq(r.down.ma200Falling, false, 'ma200Falling FALSE (lagging member) — fires early');
})();

// ── 5: A1 — strong trend missing ONE up-core → neutral, not aligned ──────────
(() => {
  // benchmark rises faster → rsPositive false, but the stack is still up.
  const r = computeTrendTemplate({ bars: rampBars(260, 100, 230), benchmarkBars: rampBars(260, 100, 320) });
  console.log('\n[5] uptrend but lagging RS → neutral (endorsement is expensive)');
  eq(r.verdict, 'neutral', 'verdict neutral (not aligned)');
  assert(r.checks.maStack && r.checks.priceAboveStack && r.checks.ma200Rising, 'three up-core still true');
  eq(r.checks.rsPositive, false, 'rsPositive false (the missing one)');
})();

// ── 6: VCP flag — contraction + drying volume ────────────────────────────────
(() => {
  const r = computeTrendTemplate({ bars: vcpBaseBars(true), benchmarkBars: flatBars(60, 400) });
  const loud = computeTrendTemplate({ bars: vcpBaseBars(false), benchmarkBars: flatBars(60, 400) });
  console.log('\n[6] VCP base');
  eq(r.vcpActive, true, 'vcpActive true (contraction + volume dry)');
  eq(loud.vcpActive, false, 'vcpActive false (volume does not dry)');
})();

// ── 7: A2 multiplicative conflict penalty (form now, magnitude in Phase 3) ────
(() => {
  console.log('\n[7] adjustedSetupQuality — conflicted multiplier');
  const conflicted = computeTrendTemplate({ bars: rampBars(260, 230, 100), benchmarkBars: FLAT_BENCH_260 });
  eq(conflicted.adjustedSetupQuality(80), 48, 'conflicted 80 → 48 (× 0.6 default)');
  const harsh = computeTrendTemplate({ bars: rampBars(260, 230, 100), benchmarkBars: FLAT_BENCH_260, config: { conflictMultiplier: 0.5 } });
  eq(harsh.adjustedSetupQuality(80), 40, 'custom conflictMultiplier 0.5 → 40');
})();

// ── 8: A3 VCP suppresses NEUTRAL premium only ────────────────────────────────
(() => {
  console.log('\n[8] adjustedSetupQuality — VCP neutral suppression');
  const neutralVcp = computeTrendTemplate({ bars: vcpBaseBars(true), benchmarkBars: flatBars(60, 400) }); // thin → neutral, vcp on
  eq(neutralVcp.verdict, 'neutral', 'thin VCP base → neutral verdict');
  eq(neutralVcp.vcpActive, true, 'vcpActive true');
  eq(neutralVcp.adjustedSetupQuality(70), 59.5, 'neutral + VCP: 70 → 59.5 (× 0.85)');

  const neutralFlat = computeTrendTemplate({ bars: flatBars(260, 150), benchmarkBars: flatBars(260, 150) });
  eq(neutralFlat.adjustedSetupQuality(70), 70, 'neutral, no VCP: 70 unchanged');

  // aligned uptrend with a tightening base at the end → aligned AND vcpActive.
  // Benchmark gently declines so RS still rises across the (wiggly) base window.
  const alignedVcp = computeTrendTemplate({ bars: concatRedate(rampBars(200, 50, 95), vcpBaseBars(true)), benchmarkBars: rampBars(260, 240, 180) });
  eq(alignedVcp.verdict, 'aligned', 'uptrend + tightening base → aligned');
  eq(alignedVcp.vcpActive, true, 'vcpActive true on the aligned case');
  eq(alignedVcp.adjustedSetupQuality(70), 75, 'aligned + VCP NOT suppressed: 70 → 75 (additive bonus)');
})();

// ── 9: A4 overlap instrumentation ────────────────────────────────────────────
(() => {
  console.log('\n[9] overlap with approach-velocity guard');
  const conflictedArgs = { bars: rampBars(260, 230, 100), benchmarkBars: FLAT_BENCH_260 };
  const both = computeTrendTemplate({ ...conflictedArgs, velocityGuardFired: true });
  const trendOnly = computeTrendTemplate({ ...conflictedArgs, velocityGuardFired: false });
  const alignedBoth = computeTrendTemplate({ bars: rampBars(260, 100, 230), benchmarkBars: FLAT_BENCH_260, velocityGuardFired: true });

  eq(both.overlap, true, 'conflicted + guard fired → overlap true');
  eq(trendOnly.overlap, false, 'conflicted + guard not fired → overlap false');
  eq(alignedBoth.overlap, false, 'aligned + guard fired → overlap false (not a conflicted double-charge)');
  eq(both.provenance.velocityGuardFired, true, 'provenance carries velocityGuardFired');
})();

// ── 10: pure-function guarantee — identical output, no mutation ───────────────
(() => {
  console.log('\n[10] purity');
  const bars = rampBars(260, 100, 230);
  const before = JSON.stringify(bars);
  const r1 = computeTrendTemplate({ bars, benchmarkBars: FLAT_BENCH_260, velocityGuardFired: true });
  const r2 = computeTrendTemplate({ bars, benchmarkBars: FLAT_BENCH_260, velocityGuardFired: true });
  eq(JSON.stringify(r1), JSON.stringify(r2), 'identical input → identical output');
  eq(r1.adjustedSetupQuality(50), r2.adjustedSetupQuality(50), 'adjuster deterministic');
  eq(JSON.stringify(bars), before, 'input bars not mutated');
})();

console.log(`\n${'─'.repeat(48)}`);
console.log(`Trend template (Phase 2): ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
