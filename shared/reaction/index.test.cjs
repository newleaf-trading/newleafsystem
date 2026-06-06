'use strict';

/**
 * index.test.cjs — Deterministic tests for shared/reaction/
 * Run: node shared/reaction/index.test.cjs
 */

const { clusterLevels, gatherLevels } = require('./zones.cjs');
const { analyzeZone, wilsonInterval, MIN_TOUCHES } = require('./stats.cjs');
const { forwardReturns, median, percentile } = require('./forward.cjs');
const { premiumLabel, premiumScore, PREMIUM_THRESHOLDS } = require('./premium.cjs');
const { classifyRegime, computeContainment } = require('./regime.cjs');
const { setupQuality, VOL_ETP_LIST } = require('./score.cjs');

let passed = 0, failed = 0;
function assert(cond, name) {
  if (cond) { passed++; console.log(`  PASS  ${name}`); }
  else { failed++; console.error(`  FAIL  ${name}`); }
}
function assertClose(a, b, tol, name) {
  if (a == null) { failed++; console.error(`  FAIL  ${name} (got null)`); return; }
  if (Math.abs(a - b) <= tol) { passed++; console.log(`  PASS  ${name} (${a.toFixed(4)} ~ ${b})`); }
  else { failed++; console.error(`  FAIL  ${name} (got ${a.toFixed(4)}, expected ~${b})`); }
}

// ── Helpers ──
function makeCandle(i, close, opts = {}) {
  const d = new Date('2026-01-01');
  d.setDate(d.getDate() + i);
  return {
    date: d.toISOString().split('T')[0],
    open: opts.open ?? close * 0.998,
    high: opts.high ?? close * 1.005,
    low: opts.low ?? close * 0.995,
    close,
    volume: opts.volume ?? 1000000,
  };
}

function makeBounceCandles(support, spot, numBounces = 3) {
  const candles = [];
  let idx = 0;
  for (let b = 0; b < numBounces; b++) {
    // Flat period
    for (let i = 0; i < 5; i++) candles.push(makeCandle(idx++, spot));
    // Dip to support and bounce
    candles.push(makeCandle(idx++, support + 1, { low: support * 0.998, volume: 2000000 }));
    candles.push(makeCandle(idx++, support + 3));
    candles.push(makeCandle(idx++, spot * 1.02));
    candles.push(makeCandle(idx++, spot * 1.03));
    candles.push(makeCandle(idx++, spot * 1.01));
  }
  return candles;
}

function makeRangeCandles(support, resistance, count = 50) {
  const mid = (support + resistance) / 2;
  const amp = (resistance - support) / 2 * 0.7;
  const candles = [];
  for (let i = 0; i < count; i++) {
    const price = mid + amp * Math.sin(i * 0.3);
    candles.push(makeCandle(i, price, {
      high: price * 1.002,
      low: price * 0.998,
    }));
  }
  return candles;
}

// ══════════════════════════════════════════════════════════════════════
console.log('\n=== shared/reaction/ Tests ===\n');

// ── D3: Premium thresholds ──
console.log('--- D3: Premium thresholds ---');
assert(premiumLabel(0.91) === 'cheap', 'IV/RV 0.91 = cheap (D3 fix)');
assert(premiumLabel(0.95) === 'cheap', 'IV/RV 0.95 = cheap (boundary)');
assert(premiumLabel(0.96) === 'fair', 'IV/RV 0.96 = fair');
assert(premiumLabel(1.14) === 'fair', 'IV/RV 1.14 = fair');
assert(premiumLabel(1.15) === 'rich', 'IV/RV 1.15 = rich (boundary)');
assert(premiumLabel(1.34) === 'rich', 'IV/RV 1.34 = rich');
assert(premiumLabel(0) === '--', 'IV/RV 0 = --');
assert(premiumLabel(null) === '--', 'IV/RV null = --');

// ── Zone merging ──
console.log('\n--- Zone merging (ATR-based) ---');
{
  // Two SMAs 0.8% apart should merge (spot=400, atrPct=0.02 → mergeThreshold=0.6*0.02*400=4.8)
  const levels = [
    { price: 390, source: 'moving_average', label: 'SMA50' },
    { price: 393, source: 'moving_average', label: 'SMA100' }, // 3 apart < 4.8
  ];
  const { supportZones } = clusterLevels(400, levels, 0.02);
  assert(supportZones.length === 1, 'Two SMAs 0.8% apart merge into one zone');
  assert(supportZones[0].sources.length === 2, 'Merged zone has 2 sources');
  assert(supportZones[0].lo === 390, 'Zone lo = lower SMA');
  assert(supportZones[0].hi === 393, 'Zone hi = higher SMA');
}

{
  // Two levels far apart should NOT merge
  const levels = [
    { price: 380, source: 'swing', label: '20d low' },
    { price: 395, source: 'moving_average', label: 'SMA50' }, // 15 apart > 4.8
  ];
  const { supportZones } = clusterLevels(400, levels, 0.02);
  assert(supportZones.length === 2, 'Two far levels stay separate');
}

{
  // Levels above spot go to resistance
  const levels = [
    { price: 410, source: 'gamma_wall', label: 'Call wall' },
    { price: 395, source: 'moving_average', label: 'SMA50' },
  ];
  const { supportZones, resistanceZones } = clusterLevels(400, levels, 0.02);
  assert(supportZones.length === 1, 'SMA50 below spot → support');
  assert(resistanceZones.length === 1, 'Call wall above spot → resistance');
}

// ── Wilson smoothing ──
console.log('\n--- Wilson smoothing ---');
{
  const w = wilsonInterval(6, 7);
  assert(w.smoothed > 0.55 && w.smoothed < 0.85, `6/7 smoothed=${w.smoothed.toFixed(3)} (expected ~0.55-0.85)`);
  assert(w.ciLow < w.ciHigh, 'CI low < CI high');
}
{
  const w = wilsonInterval(1, 1);
  assert(w.smoothed < 0.70, `1/1 smoothed=${w.smoothed.toFixed(3)} < 0.70 (Wilson caps single observation)`);
}
{
  const w = wilsonInterval(0, 0);
  assert(w.smoothed === 0, '0/0 smoothed = 0');
}

// ── N-gate: untested zones ──
console.log('\n--- N-gate: untested zones ---');
{
  // Zone with only 1 touch should be untested
  const candles = [];
  for (let i = 0; i < 30; i++) candles.push(makeCandle(i, 110));
  candles.push(makeCandle(30, 101, { low: 99.5 })); // single touch
  for (let i = 31; i < 40; i++) candles.push(makeCandle(i, 110));

  const zone = { lo: 100, hi: 100, touchLo: 98, touchHi: 102, sources: ['test'], type: 'support' };
  const stats = analyzeZone(candles, zone, 'support');
  assert(stats.untested === true, '1-touch zone is flagged untested');
  assert(stats.score === 0, '1-touch zone score = 0 (gated)');
}

// ── Zone stats: multiple bounces ──
console.log('\n--- Zone stats: bounce analysis ---');
{
  const candles = makeBounceCandles(100, 110, 4); // 4 bounces
  const zone = { lo: 99, hi: 101, touchLo: 97, touchHi: 103, sources: ['Put wall', 'SMA50'], type: 'support' };
  const stats = analyzeZone(candles, zone, 'support');
  assert(stats.touchCount >= 3, `Touch count >= 3 (got ${stats.touchCount})`);
  assert(stats.holdCount >= 2, `Hold count >= 2 (got ${stats.holdCount})`);
  assert(stats.untested === false, 'Zone is NOT untested (≥3 touches)');
  assert(stats.smoothedRate > 0, `Smoothed rate > 0 (got ${stats.smoothedRate.toFixed(3)})`);
  assert(stats.score > 0, `Zone score > 0 (got ${stats.score})`);
}

// ── Forward returns ──
console.log('\n--- Forward returns ---');
{
  const candles = [];
  for (let i = 0; i < 30; i++) candles.push(makeCandle(i, 100 + i * 0.5));
  const touches = [{ index: 5 }, { index: 15 }];
  const fwd = forwardReturns(candles, touches, [3, 5]);
  assert(fwd.median3d != null, 'Median 3d computed');
  assert(fwd.median5d != null, 'Median 5d computed');
  assert(fwd.median3d > 0, 'Median 3d > 0 (upward trend)');
}

// ── D1 fix: Containment with MSFT-like scenario ──
console.log('\n--- D1 fix: Containment ---');
{
  // MSFT: spot $417, support zone $408-$412, resistance zone $440-$445
  // Bars oscillating between $410 and $440 should have HIGH containment
  const candles = [];
  for (let i = 0; i < 45; i++) {
    const price = 425 + 12 * Math.sin(i * 0.2);
    candles.push(makeCandle(i, price, {
      high: price + 3,
      low: price - 3,
    }));
  }
  const supportZone = { lo: 408, hi: 412, touchLo: 405, touchHi: 415, sources: ['SMA50', 'SMA100'], type: 'support' };
  const resistanceZone = { lo: 440, hi: 445, touchLo: 437, touchHi: 448, sources: ['Call wall', 'BB upper'], type: 'resistance' };

  const containment = computeContainment(candles, supportZone, resistanceZone, 45);
  assert(containment > 0, `Containment > 0 (got ${(containment * 100).toFixed(0)}%) — D1 FIX`);
  assert(containment > 0.5, `Containment > 50% for range-bound MSFT-like (got ${(containment * 100).toFixed(0)}%)`);
}

// ── D2 fix: Unclear regime caps confidence ──
console.log('\n--- D2 fix: Unclear confidence cap ---');
{
  // No scoreable zones, no strong ADX → unclear
  const result = classifyRegime(100, null, null, 0, 15, 0.02);
  assert(result.regime === 'unclear', `No zones → unclear regime (got ${result.regime})`);
  assert(result.confidence <= 40, `Unclear confidence <= 40 (got ${result.confidence})`);
}
{
  // Range-bound with good containment → NOT unclear
  const sZone = { zone: { lo: 95, hi: 97, touchLo: 93, touchHi: 99 }, untested: false, smoothedRate: 0.7 };
  const rZone = { zone: { lo: 108, hi: 110, touchLo: 106, touchHi: 112 }, untested: false, smoothedRate: 0.65 };
  const result = classifyRegime(103, sZone, rZone, 0.75, 15, 0.02);
  assert(result.regime === 'range_bound', `Range-bound regime (got ${result.regime})`);
  assert(result.confidence > 40, `Range-bound confidence > 40 (got ${result.confidence})`);
}

// ── Regime classification ──
console.log('\n--- Regime classification ---');
{
  const sZone = { zone: { lo: 95, hi: 97, touchLo: 93, touchHi: 99 }, untested: false, smoothedRate: 0.75 };
  // Spot just above support zone hi (within 0.5*ATR)
  const result = classifyRegime(97.5, sZone, null, 0, 15, 0.02);
  assert(result.regime === 'testing_support', `Spot near support = testing_support (got ${result.regime})`);
}
{
  // Strong ADX → trending
  const result = classifyRegime(100, null, null, 0, 35, 0.02);
  assert(result.regime === 'trending', `ADX 35 → trending (got ${result.regime})`);
}

// ── Setup Quality scoring ──
console.log('\n--- Setup Quality scoring ---');
{
  const result = setupQuality({
    symbol: 'AVGO', spot: 1412, zoneScore: 84, ivRv: 1.34,
    regimeConfidence: 81, distancePct: 1.6, openInterest: 4820,
    spreadPct: 1.1, median5d: 0.021,
  });
  assert(result.total >= 70, `AVGO quality >= 70 (got ${result.total})`);
  assert(result.exclusionReason == null, 'AVGO not excluded');
}
{
  // Vol ETP should be excluded
  const result = setupQuality({ symbol: 'UVXY', spot: 50, zoneScore: 80, ivRv: 2.0, regimeConfidence: 70 });
  assert(result.exclusionReason === 'vol_etp', 'UVXY excluded as vol ETP');
}
{
  // Untested zone excluded
  const result = setupQuality({ symbol: 'PLTR', spot: 50, zoneScore: 0, untested: true, ivRv: 1.2, regimeConfidence: 50 });
  assert(result.exclusionReason === 'untested_zone', 'Untested zone excluded');
}
{
  // Low score excluded
  const result = setupQuality({
    symbol: 'XYZ', spot: 50, zoneScore: 20, ivRv: 0.8, regimeConfidence: 30,
    distancePct: 8, openInterest: 100,
  });
  assert(result.exclusionReason != null, `Low quality excluded (reason: ${result.exclusionReason})`);
}

// ── Median / percentile ──
console.log('\n--- Median / percentile ---');
assert(median([1, 2, 3, 4, 5]) === 3, 'Median of [1,2,3,4,5] = 3');
assert(median([1, 2, 3, 4]) === 2.5, 'Median of [1,2,3,4] = 2.5');
assertClose(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 75), 7.75, 0.5, 'P75 of 1-10');

// ── Summary ──
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
