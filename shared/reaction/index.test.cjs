'use strict';

/**
 * index.test.cjs — Deterministic tests for shared/reaction/
 * Run: node shared/reaction/index.test.cjs
 */

const { clusterLevels, gatherLevels, nearestScoreableZones } = require('./zones.cjs');
const { analyzeZone, wilsonInterval, MIN_TOUCHES } = require('./stats.cjs');
const { forwardReturns, median, percentile } = require('./forward.cjs');
const { premiumLabel, premiumScore, PREMIUM_THRESHOLDS } = require('./premium.cjs');
const { classifyRegime, computeContainment, trendDirection } = require('./regime.cjs');
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
    regimeConfidence: 81, distancePct: 1.6, topStrikesOI: 48200, oiDataAvailable: true,
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
    distancePct: 8, topStrikesOI: 100, oiDataAvailable: true,
  });
  assert(result.exclusionReason != null, `Low quality excluded (reason: ${result.exclusionReason})`);
}
{
  // OI absent (fast pipeline) — NOT excluded, but liquidityVerified=false
  const result = setupQuality({
    symbol: 'AAPL', spot: 300, zoneScore: 80, ivRv: 1.3, regimeConfidence: 70,
    distancePct: 1, topStrikesOI: 0, oiDataAvailable: false,
  });
  assert(result.exclusionReason !== 'illiquid', 'OI absent does NOT exclude as illiquid');
  assert(result.liquidityVerified === false, 'liquidityVerified=false when OI absent');
}

// ── Median / percentile ──
console.log('\n--- Median / percentile ---');
assert(median([1, 2, 3, 4, 5]) === 3, 'Median of [1,2,3,4,5] = 3');
assert(median([1, 2, 3, 4]) === 2.5, 'Median of [1,2,3,4] = 2.5');
assertClose(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 75), 7.75, 0.5, 'P75 of 1-10');

// ── Relevant-rail gate ──
console.log('\n--- Relevant-rail gate ---');
{
  // NFLX-like: testing_support, S-zone score 51 (< 65), rich premium, close distance
  // Must NOT be tradeable (capped at 64)
  const result = setupQuality({
    symbol: 'NFLX', spot: 900, zoneScore: 58, ivRv: 1.46,
    regimeConfidence: 55, distancePct: 0.1,
    topStrikesOI: 30000, oiDataAvailable: true,
    median5d: 0.03, regime: 'testing_support',
    supportZoneScore: 51, resistanceZoneScore: 58,
    strategyBias: 'bull_put_spread',
  });
  assert(result.total <= 64, `NFLX-like capped at 64 (got ${result.total}) — weak support rail`);
  assert(result.gateReason === 'weak relevant rail', `NFLX-like gateReason = weak relevant rail (got ${result.gateReason})`);
  assert(result.exclusionReason === 'low_score', `NFLX-like excluded as low_score (got ${result.exclusionReason})`);
}
{
  // XLF-like: testing_support, S-zone score 73 (>= 65), rich premium
  // Must be tradeable
  const result = setupQuality({
    symbol: 'XLF', spot: 50, zoneScore: 83, ivRv: 1.49,
    regimeConfidence: 84, distancePct: 0.0,
    topStrikesOI: 100000, oiDataAvailable: true,
    median5d: 0.01, regime: 'testing_support',
    supportZoneScore: 73, resistanceZoneScore: 83,
    strategyBias: 'bull_put_spread',
  });
  assert(result.total >= 65, `XLF-like tradeable (sq=${result.total})`);
  assert(result.gateReason == null, `XLF-like no gate (got ${result.gateReason})`);
  assert(result.exclusionReason == null, `XLF-like not excluded (got ${result.exclusionReason})`);
}
{
  // Condor bias: both rails must clear 65. Support 73, resistance 50 → gated.
  const result = setupQuality({
    symbol: 'TEST', spot: 100, zoneScore: 73, ivRv: 1.3,
    regimeConfidence: 70, distancePct: 2.0,
    topStrikesOI: 20000, oiDataAvailable: true,
    regime: 'range_bound', supportZoneScore: 73, resistanceZoneScore: 50,
    strategyBias: 'iron_condor',
  });
  assert(result.total <= 64, `Condor with weak R rail capped (got ${result.total})`);
  assert(result.gateReason === 'weak relevant rail', `Condor gateReason set`);
}

// ── Bias mapping (posInRange-aware) ──
console.log('\n--- Bias: condor centering + skewed structures ---');
const { mapBias, calcPosInRange, validateBiasCategory, INCOME_BIASES, DIRECTIONAL_BIASES } = require('./bias.cjs');
{
  // posInRange sanity
  assertClose(calcPosInRange(100, 90, 110), 0.5, 0.01, 'posInRange: midpoint = 0.5');
  assertClose(calcPosInRange(91, 90, 110), 0.05, 0.01, 'posInRange: near support = 0.05');
  assertClose(calcPosInRange(109, 90, 110), 0.95, 0.01, 'posInRange: near resistance = 0.95');
  assert(calcPosInRange(100, null, 110) === null, 'posInRange: null support → null');
}
{
  // XLF-like: testing_support, posInRange ~0.02, IV rich → bull_put, NOT condor
  const r = mapBias({ regime: 'testing_support', supportScore: 73, resistanceScore: 83, supportTested: true, resistanceTested: true, ivRv: 1.49, spot: 52, supportLo: 51.5, resistanceHi: 53 });
  assert(r.bias === 'bull_put_spread', `XLF near support + IV rich → bull_put (got ${r.bias})`);
  assert(r.posInRange !== null && r.posInRange < 0.40, `XLF posInRange < 0.40 (got ${r.posInRange?.toFixed(2)})`);
  assert(r.structureGeometry.skew === 'bullish', 'XLF bullish skew');
  assert(r.structureGeometry.testedRail === 'support', 'XLF tested rail = support');
}
{
  // MDLZ-like: testing_resistance, at resistance rail, IV rich → bear_call, NOT condor
  const r = mapBias({ regime: 'testing_resistance', supportScore: 67, resistanceScore: 86, supportTested: true, resistanceTested: true, ivRv: 1.45, spot: 63, supportLo: 61, resistanceHi: 63.5 });
  assert(r.bias === 'bear_call_spread', `MDLZ near resistance + IV rich → bear_call (got ${r.bias})`);
  assert(r.posInRange > 0.60, `MDLZ posInRange > 0.60 (got ${r.posInRange?.toFixed(2)})`);
}
{
  // HON-like: testing_resistance at rail, IV rich → bear_call
  const r = mapBias({ regime: 'testing_resistance', supportScore: 68, resistanceScore: 83, supportTested: true, resistanceTested: true, ivRv: 1.52, spot: 215, supportLo: 212, resistanceHi: 216 });
  assert(r.bias === 'bear_call_spread', `HON near resistance + IV rich → bear_call (got ${r.bias})`);
}
{
  // Synthetic range_bound, posInRange=0.50, both strong → symmetric Iron Condor
  const r = mapBias({ regime: 'range_bound', supportScore: 80, resistanceScore: 80, supportTested: true, resistanceTested: true, ivRv: 1.3, spot: 100, supportLo: 95, resistanceHi: 105, containment: 0.75, adx: 15 });
  assert(r.bias === 'iron_condor', `Centred range_bound → symmetric condor (got ${r.bias})`);
  assert(r.posInRange >= 0.40 && r.posInRange <= 0.60, 'Centred posInRange in [0.40, 0.60]');
  assert(r.structureGeometry.skew === 'none', 'No skew for symmetric condor');
  assert(r.structureGeometry.testedRail === 'both', 'Tested rail = both');
}
{
  // Iron Butterfly: very centred + high gamma conf
  const r = mapBias({ regime: 'range_bound', supportScore: 80, resistanceScore: 80, supportTested: true, resistanceTested: true, ivRv: 1.3, spot: 100, supportLo: 95, resistanceHi: 105, bandCentre: 100, gammaConfidence: 0.7, containment: 0.75, adx: 15 });
  assert(r.bias === 'iron_butterfly', `Centred + gamma → butterfly (got ${r.bias})`);
}
{
  // Skewed condor: range_bound, posInRange=0.35 (near support side)
  const r = mapBias({ regime: 'range_bound', supportScore: 80, resistanceScore: 80, supportTested: true, resistanceTested: true, ivRv: 1.3, spot: 98.5, supportLo: 95, resistanceHi: 105, containment: 0.75, adx: 15 });
  assert(r.bias === 'skewed_condor', `Off-centre range → skewed_condor (got ${r.bias})`);
  assert(r.structureGeometry.skew === 'bullish', 'Skew bullish (near support side)');
}
{
  // Near support, moderate IV → BWB
  const r = mapBias({ regime: 'testing_support', supportScore: 75, resistanceScore: 0, supportTested: true, resistanceTested: false, ivRv: 1.05, spot: 100, supportLo: 99, resistanceHi: 110 });
  assert(r.bias === 'broken_wing_butterfly', `Near support + moderate IV → BWB (got ${r.bias})`);
  assert(r.structureGeometry.skew === 'bullish', 'BWB bullish skew');
}
{
  // Breakout + IV cheap → debit
  const r = mapBias({ regime: 'breakout_up', supportScore: 70, resistanceScore: 30, supportTested: true, resistanceTested: false, ivRv: 0.9, spot: 150 });
  assert(r.bias === 'bull_call_spread', `Breakout + IV cheap → bull_call (got ${r.bias})`);
  assert(r.category === 'directional', 'debit = directional');
}
{
  // TLT: unclear, R strong, IV rich → bear_call (half-blind)
  const r = mapBias({ regime: 'unclear', supportScore: 0, resistanceScore: 73, supportTested: false, resistanceTested: true, ivRv: 1.42, spot: 95, supportLo: null, resistanceHi: 97 });
  assert(r.bias === 'bear_call_spread', `TLT unclear + R strong + IV rich → bear_call (got ${r.bias})`);
  assert(r.halfBlind === true, 'TLT half-blind');
}

// ── Income/Directional separation ──
console.log('\n--- Income/Directional separation ---');
{
  assert(validateBiasCategory('bull_call_spread', 'income') === false, 'bull_call in income → INVALID');
  assert(validateBiasCategory('bear_put_spread', 'income') === false, 'bear_put in income → INVALID');
  assert(validateBiasCategory('bull_put_spread', 'income') === true, 'bull_put in income → valid');
  assert(validateBiasCategory('iron_condor', 'income') === true, 'condor in income → valid');
  assert(INCOME_BIASES.has('skewed_condor'), 'skewed_condor is income');
  assert(DIRECTIONAL_BIASES.has('bull_call_spread'), 'bull_call is directional');
}

// ── Earnings calendar: apply known dates even when stale ──
console.log('\n--- Earnings calendar (apply known dates) ---');
{
  // KR-like: earningsDate is 6 days out (inside 21d window) → must be excluded
  const today = new Date('2026-06-06');
  const result = setupQuality({
    symbol: 'KR', spot: 60, zoneScore: 75, ivRv: 1.49,
    regimeConfidence: 68, distancePct: 0.3,
    topStrikesOI: 20000, oiDataAvailable: true,
    earningsDate: '2026-06-12', // 6 days out
    regime: 'unclear', supportZoneScore: 75, resistanceZoneScore: 66,
    strategyBias: 'bull_put_spread', _today: today,
  });
  assert(result.exclusionReason === 'earnings_in_window', `KR with earnings Jun 12 → excluded (got ${result.exclusionReason})`);
  assert(result.earningsVerified === true, 'KR earningsVerified = true (date provided)');
}
{
  // AAPL-like: earningsDate is 90 days out → NOT excluded
  const today = new Date('2026-06-06');
  const result = setupQuality({
    symbol: 'AAPL', spot: 300, zoneScore: 80, ivRv: 1.3,
    regimeConfidence: 70, distancePct: 1,
    topStrikesOI: 50000, oiDataAvailable: true,
    earningsDate: '2026-09-01', // far out
    regime: 'testing_support', supportZoneScore: 80, resistanceZoneScore: 70,
    strategyBias: 'iron_condor', _today: today,
  });
  assert(result.exclusionReason !== 'earnings_in_window', 'AAPL earnings Sep → NOT excluded');
  assert(result.earningsVerified === true, 'AAPL earningsVerified = true');
}
{
  // Symbol with null earningsDate → not excluded but earningsVerified=false
  const result = setupQuality({
    symbol: 'PLTR', spot: 50, zoneScore: 70, ivRv: 1.2,
    regimeConfidence: 60, distancePct: 1,
    topStrikesOI: 10000, oiDataAvailable: true,
    earningsDate: null,
    regime: 'testing_support', supportZoneScore: 70, resistanceZoneScore: 60,
    strategyBias: 'bull_put_spread',
  });
  assert(result.exclusionReason !== 'earnings_in_window', 'null earnings → NOT excluded for earnings');
  assert(result.earningsVerified === false, 'null earnings → earningsVerified=false');
}

// ── SPY fixture: nearest-zone selection ──
console.log('\n--- SPY fixture: nearest scoreable zone ---');
{
  // SPY: spot 738, scoreable supports at 684 and 730-732, resistance at 740
  const supportStats = [
    { zone: { lo: 684, hi: 684, touchLo: 680, touchHi: 688 }, untested: false, touchCount: 13, score: 60 },
    { zone: { lo: 730, hi: 732, touchLo: 726, touchHi: 736 }, untested: false, touchCount: 5, score: 55 },
  ];
  const resistanceStats = [
    { zone: { lo: 740, hi: 740, touchLo: 736, touchHi: 744 }, untested: false, touchCount: 5, score: 50 },
    { zone: { lo: 760, hi: 762, touchLo: 756, touchHi: 766 }, untested: false, touchCount: 3, score: 40 },
  ];
  const { nearestSupport, nearestResistance } = nearestScoreableZones(738, supportStats, resistanceStats);
  assert(nearestSupport?.zone.lo === 730, `SPY nearest support lo = 730 (got ${nearestSupport?.zone.lo})`);
  assert(nearestSupport?.zone.hi === 732, `SPY nearest support hi = 732 (got ${nearestSupport?.zone.hi})`);
  assert(nearestResistance?.zone.lo === 740, `SPY nearest resistance lo = 740 (got ${nearestResistance?.zone.lo})`);
}
{
  // Edge: no scoreable zones — falls back to closest untested
  const supportStats = [
    { zone: { lo: 700, hi: 700, touchLo: 696, touchHi: 704 }, untested: true, touchCount: 1, score: 0 },
    { zone: { lo: 730, hi: 730, touchLo: 726, touchHi: 734 }, untested: true, touchCount: 2, score: 0 },
  ];
  const { nearestSupport } = nearestScoreableZones(738, supportStats, []);
  assert(nearestSupport?.zone.lo === 730, `Fallback to closest untested: lo = 730 (got ${nearestSupport?.zone.lo})`);
}

// ── Range Quality score ──
console.log('\n--- Range Quality ---');
const { rangeQuality } = require('./score.cjs');
{
  // Perfect condor candidate: high containment, low ADX, both strong, centred
  const rq = rangeQuality({ containment: 0.8, adx: 12, supportScore: 80, resistanceScore: 75, supportTested: true, resistanceTested: true, posInRange: 0.5 });
  assert(rq >= 75, `Perfect condor candidate rangeQuality >= 75 (got ${rq})`);
}
{
  // At-rail, trending: low containment, high ADX, one rail, off-centre
  const rq = rangeQuality({ containment: 0.2, adx: 35, supportScore: 70, resistanceScore: 0, supportTested: true, resistanceTested: false, posInRange: 0.1 });
  assert(rq < 30, `At-rail trending rangeQuality < 30 (got ${rq})`);
}
{
  // Moderate: decent containment, moderate ADX, both tested but one weak
  const rq = rangeQuality({ containment: 0.5, adx: 20, supportScore: 70, resistanceScore: 55, supportTested: true, resistanceTested: true, posInRange: 0.45 });
  assert(rq >= 30 && rq <= 60, `Moderate rangeQuality 30-60 (got ${rq})`);
}

// ── Falling-knife patch tests ──
console.log('\n--- Falling-knife: regime precedence ---');
{
  // COIN fixture: ADX 34, spot falling into put wall → trending, trendIntoZone
  const candles = [];
  // 6 bars declining sharply
  for (let i = 0; i < 20; i++) candles.push(makeCandle(i, 180 - i * 1.5));
  const sZone = { zone: { lo: 148, hi: 152, touchLo: 144, touchHi: 156 }, untested: false, smoothedRate: 0.7, touchCount: 5, score: 76 };
  const result = classifyRegime(151, sZone, null, 0, 34, 0.035, { candles });
  assert(result.regime === 'trending', `COIN ADX 34 → trending (got ${result.regime})`);
  assert(result.trendIntoZone === true, 'COIN trending INTO support zone');
}
{
  // COIN bias: trending + trendIntoZone → no_trade for income
  const biasR = mapBias({ regime: 'trending', supportScore: 76, resistanceScore: 44, supportTested: true, resistanceTested: false, ivRv: 1.11, spot: 151, supportLo: 148, resistanceHi: 170, trendIntoZone: true, adx: 34 });
  assert(biasR.bias === 'no_trade', `COIN trending into zone → no_trade (got ${biasR.bias})`);
  assert(biasR.noTradeReason != null && biasR.noTradeReason.includes('trend into zone'), 'COIN has trend-into-zone reason');
}

console.log('\n--- Falling-knife: approach-velocity guard ---');
{
  // Fast approach: 3-bar move 12.7% > 3×ATR 10.5% → capped at 64
  const result = setupQuality({
    symbol: 'COIN', spot: 151, zoneScore: 76, ivRv: 1.11,
    regimeConfidence: 58, distancePct: 0.1,
    topStrikesOI: 30000, oiDataAvailable: true,
    regime: 'trending', supportZoneScore: 76, resistanceZoneScore: 44,
    strategyBias: 'no_trade', approachMove3bar: 0.127, atrPct: 0.035,
  });
  assert(result.gateReason === 'hostile approach', `Fast approach → hostile approach (got ${result.gateReason})`);
  assert(result.total <= 64, `Capped at 64 (got ${result.total})`);
}
{
  // Slow approach: 3-bar move 2% < 3×ATR 3% → no cap
  const result = setupQuality({
    symbol: 'XLF', spot: 52, zoneScore: 83, ivRv: 1.49,
    regimeConfidence: 84, distancePct: 0.0,
    topStrikesOI: 100000, oiDataAvailable: true,
    regime: 'testing_support', supportZoneScore: 73, resistanceZoneScore: 83,
    strategyBias: 'iron_condor', approachMove3bar: 0.02, atrPct: 0.01,
  });
  assert(result.gateReason !== 'hostile approach', `Slow approach → no hostile gate (got ${result.gateReason})`);
}

console.log('\n--- Falling-knife: BB-above-spot excluded ---');
{
  // BB lower is ABOVE spot (violated band) → should not be gathered
  const levels = gatherLevels(150, { bbLower: 155, bbUpper: 220, sma50: 180, bars: [] });
  const hasViolatedBB = levels.some(l => l.label === 'BB lower');
  assert(!hasViolatedBB, 'Violated BB lower (above spot) excluded from levels');
  const hasBBUpper = levels.some(l => l.label === 'BB upper');
  assert(hasBBUpper, 'BB upper (above spot) kept');
}
{
  // BB upper is BELOW spot (violated band) → should not be gathered
  const levels = gatherLevels(250, { bbLower: 200, bbUpper: 240, sma50: 230, bars: [] });
  const hasViolatedBBUp = levels.some(l => l.label === 'BB upper');
  assert(!hasViolatedBBUp, 'Violated BB upper (below spot) excluded from levels');
}

console.log('\n--- Falling-knife: pending touch ---');
{
  // Touch on last bar → should be pending, not hold
  const candles = [];
  for (let i = 0; i < 20; i++) candles.push(makeCandle(i, 110));
  // Touch on the very last bar
  candles.push(makeCandle(20, 101, { low: 99.5 }));
  const zone = { lo: 100, hi: 100, touchLo: 98, touchHi: 102, sources: ['test'], type: 'support' };
  const stats = analyzeZone(candles, zone, 'support');
  const lastTouch = stats.touches?.find(t => t.index === 20);
  assert(lastTouch?.classification === 'pending', `Touch on last bar = pending (got ${lastTouch?.classification})`);
  assert(stats.pendingCount >= 1, `pendingCount >= 1 (got ${stats.pendingCount})`);
}

// ── Quality mean-reversion exception ──
console.log('\n--- Quality mean-reversion exception ---');
{
  const { computeReactionGate, applyReactionGate } = require('./gate.cjs');
  // applyReactionGate: qualityBounce overrides the knife veto and promotes a NEUTRAL pick.
  const knifeGate = { qualityBounce: true, rsi: 12, trendIntoZone: true, trendIntoZoneSide: 'support',
    bias: 'no_trade', testingSupport: true };
  const a = applyReactionGate('broken_wing_butterfly', knifeGate);
  assert(!!a && a.strategy === 'bull_call_spread' && a.direction === 'bullish' && a.flag === 'quality_mean_reversion',
    `quality bounce → bull_call promotion (got ${JSON.stringify(a)})`);
  // Only neutral picks are promoted — a directional pick is never given a quality promotion.
  const b = applyReactionGate('bull_put_spread', knifeGate);
  assert(!b || b.flag !== 'quality_mean_reversion', 'quality bounce does not promote a directional pick');

  // computeReactionGate: the flag + its guards. Steep 6-bar decline into a defended put wall.
  const candles = [];
  for (let i = 0; i < 40; i++) candles.push(makeCandle(i, 180 - i * 0.8));
  const shared = { candles, callWall: 200, sma50: 170, sma100: 175, sma200: 178,
    bbLower: 145, bbUpper: 205, atrPct: 0.035, adx: 34, ivRv: 0.86, gammaConfidence: 0.7 };
  // Mega + oversold + spot ABOVE a defended wall → qualityBounce true.
  const gYes = computeReactionGate({ ...shared, spot: 151, putWall: 148, rsi: 12, isQualityName: true });
  assert(gYes && gYes.qualityBounce === true, `mega oversold above defended wall → qualityBounce (got ${gYes && gYes.qualityBounce})`);
  assert(gYes && gYes.rsi === 12, 'gate surfaces rsi');
  // Structural-break guard: spot BELOW the put wall → wall broken → qualityBounce false.
  const gBreak = computeReactionGate({ ...shared, spot: 145, putWall: 148, rsi: 12, isQualityName: true });
  assert(gBreak && gBreak.qualityBounce === false, `spot below wall → no bounce (got ${gBreak && gBreak.qualityBounce})`);
  // Not a quality name → false.
  const gNotQ = computeReactionGate({ ...shared, spot: 151, putWall: 148, rsi: 12, isQualityName: false });
  assert(gNotQ && gNotQ.qualityBounce === false, 'non-mega → no bounce');
  // Not oversold → false.
  const gNotOS = computeReactionGate({ ...shared, spot: 151, putWall: 148, rsi: 55, isQualityName: true });
  assert(gNotOS && gNotOS.qualityBounce === false, 'not oversold → no bounce');
  // Weak wall (low gamma confidence) → false.
  const gWeak = computeReactionGate({ ...shared, gammaConfidence: 0.3, spot: 151, putWall: 148, rsi: 12, isQualityName: true });
  assert(gWeak && gWeak.qualityBounce === false, 'undefended wall (low conf) → no bounce');
}

// ── Events: parseEventCalendar, staleness, exclusions ──
console.log('\n--- Events: calendar parsing + exclusions ---');
const { parseEventCalendar, stalenessLabel, checkEarningsExclusion, checkExDivExclusion } = require('./events.cjs');
{
  // Parse new format
  const cal = parseEventCalendar({
    _lastUpdated: '2026-06-06', _source: 'FMP',
    symbols: { AAPL: { earnings: '2026-07-29', exDiv: '2026-07-10' }, SPY: { earnings: null, exDiv: null } },
  });
  assert(cal.lastUpdated === '2026-06-06', 'Parse new: lastUpdated');
  assert(cal.symbols.AAPL.earnings === '2026-07-29', 'Parse new: AAPL earnings');
  assert(cal.symbols.AAPL.exDiv === '2026-07-10', 'Parse new: AAPL exDiv');
  assert(cal.symbols.SPY.earnings === null, 'Parse new: SPY null earnings');
}
{
  // Parse old format
  const cal = parseEventCalendar({
    _lastUpdated: '2026-04-03',
    symbols: { _comment: 'ignore', AAPL: '2026-04-29', SPY: null },
  });
  assert(cal.symbols.AAPL.earnings === '2026-04-29', 'Parse old: AAPL earnings');
  assert(cal.symbols.AAPL.exDiv === null, 'Parse old: no exDiv in old format');
  assert(!cal.symbols._comment, 'Parse old: skips _prefixed keys');
}
{
  // Staleness
  const fresh = stalenessLabel('2026-06-05', new Date('2026-06-06'));
  assert(fresh.stale === false, 'Fresh calendar: not stale');
  const old = stalenessLabel('2026-04-03', new Date('2026-06-06'));
  assert(old.stale === true, 'Old calendar: stale');
  assert(old.label.includes('2026-04-03'), 'Stale label includes date');
  const missing = stalenessLabel(null);
  assert(missing.stale === true, 'No calendar: stale');
}
{
  // Earnings exclusion: inside window
  const r = checkEarningsExclusion('2026-06-12', 21, new Date('2026-06-06'));
  assert(r.excluded === true, 'Earnings 6d out → excluded');
  assert(r.verified === true, 'Earnings verified (date provided)');
  assert(r.daysTo === 6, 'DaysTo = 6');
}
{
  // Earnings: outside window
  const r = checkEarningsExclusion('2026-09-01', 21, new Date('2026-06-06'));
  assert(r.excluded === false, 'Earnings 87d out → NOT excluded');
}
{
  // Earnings: null → not excluded, unverified
  const r = checkEarningsExclusion(null, 21);
  assert(r.excluded === false, 'Null earnings → not excluded');
  assert(r.verified === false, 'Null earnings → unverified');
}
{
  // Ex-div: short call bias + exDiv inside window → excluded
  const r = checkExDivExclusion('2026-06-15', 'bear_call_spread', 21, new Date('2026-06-06'));
  assert(r.excluded === true, 'ExDiv 9d + bear_call → excluded');
  assert(r.reason.includes('short call'), 'Reason mentions short call');
}
{
  // Ex-div: bull_put bias (no short call) + exDiv inside window → NOT excluded
  const r = checkExDivExclusion('2026-06-15', 'bull_put_spread', 21, new Date('2026-06-06'));
  assert(r.excluded === false, 'ExDiv + bull_put (no short call) → NOT excluded');
}
{
  // Ex-div: iron_condor (has short call) + exDiv inside window → excluded
  const r = checkExDivExclusion('2026-06-15', 'iron_condor', 21, new Date('2026-06-06'));
  assert(r.excluded === true, 'ExDiv + iron_condor (short call) → excluded');
}
{
  // Ex-div: null → not excluded, unverified
  const r = checkExDivExclusion(null, 'bear_call_spread', 21);
  assert(r.excluded === false, 'Null exDiv → not excluded');
  assert(r.verified === false, 'Null exDiv → unverified');
}

// ── Summary ──
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
