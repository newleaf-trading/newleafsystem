/**
 * price-reaction.test.ts — Unit tests for the Price Reaction Analyzer
 *
 * Run: npx tsx src/tools/price-reaction.test.ts
 */

import {
  analyzePriceReactions,
  analyzeSupportLevel,
  analyzeResistanceLevel,
  analyzeRange,
  findTouchEvents,
  classifySupportTouch,
  classifyResistanceTouch,
  calculateForwardReturns,
  calculateMaxAdverseMove,
  calculateSupportStrengthScore,
  calculateResistanceStrengthScore,
  mapReactionToStrategyBias,
  type Candle,
  type PriceLevel,
  type PriceReactionInput,
  type PriceReactionResult,
} from './price-reaction.js';

let passed = 0;
let failed = 0;

function assert(condition: boolean, name: string) {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    console.error(`  FAIL  ${name}`);
  }
}

function assertClose(actual: number | undefined, expected: number, tolerance: number, name: string) {
  if (actual == null) { failed++; console.error(`  FAIL  ${name} (got undefined)`); return; }
  const ok = Math.abs(actual - expected) <= tolerance;
  if (ok) { passed++; console.log(`  PASS  ${name} (${actual.toFixed(4)} ~ ${expected})`); }
  else { failed++; console.error(`  FAIL  ${name} (got ${actual.toFixed(4)}, expected ~${expected})`); }
}

// ── Synthetic candle generators ─────────────────────────────────────────────

function makeCandle(i: number, close: number, opts: Partial<Candle> = {}): Candle {
  const d = new Date('2026-01-01');
  d.setDate(d.getDate() + i);
  return {
    date: d.toISOString().split('T')[0],
    open: opts.open ?? close * 0.998,
    high: opts.high ?? close * 1.005,
    low: opts.low ?? close * 0.995,
    close,
    volume: opts.volume ?? 1000000,
    rsi14: opts.rsi14,
    macdHistogram: opts.macdHistogram,
    ...opts,
  };
}

/** Create a sequence: flat, dip to support, bounce back up */
function makeSupportBounceCandles(support: number, spot: number, count: number = 30): Candle[] {
  const candles: Candle[] = [];
  for (let i = 0; i < 10; i++) candles.push(makeCandle(i, spot)); // flat
  // Dip to support
  candles.push(makeCandle(10, support + 1, { low: support * 0.998, rsi14: 32 }));
  candles.push(makeCandle(11, support + 2, { low: support * 1.001, rsi14: 35 }));
  // Bounce up
  for (let i = 12; i < 17; i++) candles.push(makeCandle(i, spot * (1 + (i - 11) * 0.008)));
  // Another dip and bounce
  candles.push(makeCandle(17, support + 0.5, { low: support * 0.999, rsi14: 28, volume: 2000000 }));
  candles.push(makeCandle(18, support + 3, { rsi14: 38 }));
  for (let i = 19; i < count; i++) candles.push(makeCandle(i, spot * (1 + (i - 18) * 0.005)));
  return candles;
}

/** Create a sequence: flat, push to resistance, reject down */
function makeResistanceRejectionCandles(resistance: number, spot: number, count: number = 30): Candle[] {
  const candles: Candle[] = [];
  for (let i = 0; i < 10; i++) candles.push(makeCandle(i, spot));
  // Push up to resistance
  candles.push(makeCandle(10, resistance - 1, { high: resistance * 1.002, rsi14: 72 }));
  candles.push(makeCandle(11, resistance - 3, { high: resistance * 0.999, rsi14: 68 }));
  // Fall away
  for (let i = 12; i < 17; i++) candles.push(makeCandle(i, spot * (1 - (i - 11) * 0.008)));
  // Another test and rejection
  candles.push(makeCandle(17, resistance - 0.5, { high: resistance * 1.001, rsi14: 75, volume: 2000000 }));
  candles.push(makeCandle(18, resistance - 5, { rsi14: 62 }));
  for (let i = 19; i < count; i++) candles.push(makeCandle(i, spot * (1 - (i - 18) * 0.003)));
  return candles;
}

/** Create a sequence: support break */
function makeSupportBreakCandles(support: number, spot: number): Candle[] {
  const candles: Candle[] = [];
  for (let i = 0; i < 10; i++) candles.push(makeCandle(i, spot));
  // Touch support
  candles.push(makeCandle(10, support + 1, { low: support * 0.998 }));
  // Break below
  candles.push(makeCandle(11, support * 0.98, { low: support * 0.975 }));
  candles.push(makeCandle(12, support * 0.97, { low: support * 0.965 }));
  candles.push(makeCandle(13, support * 0.96));
  for (let i = 14; i < 25; i++) candles.push(makeCandle(i, support * (0.96 - (i - 14) * 0.005)));
  return candles;
}

/** Create a range-bound sequence */
function makeRangeBoundCandles(support: number, resistance: number, count: number = 40): Candle[] {
  const mid = (support + resistance) / 2;
  const amp = (resistance - support) / 2 * 0.8;
  const candles: Candle[] = [];
  for (let i = 0; i < count; i++) {
    const price = mid + amp * Math.sin(i * 0.4);
    candles.push(makeCandle(i, price, {
      high: price * 1.003,
      low: price * 0.997,
    }));
  }
  return candles;
}

/** Create a fake breakdown sequence */
function makeFakeBreakdownCandles(support: number, spot: number): Candle[] {
  const candles: Candle[] = [];
  for (let i = 0; i < 10; i++) candles.push(makeCandle(i, spot));
  // Intraday break below support but close above
  candles.push(makeCandle(10, support + 2, { low: support * 0.985, high: support * 1.01 }));
  candles.push(makeCandle(11, support + 3)); // recovers
  for (let i = 12; i < 20; i++) candles.push(makeCandle(i, spot));
  return candles;
}

// ── Tests ───────────────────────────────────────────────────────────────────

console.log('\n=== Price Reaction Analyzer Tests ===\n');

// ── findTouchEvents ──
console.log('--- findTouchEvents ---');
{
  const candles = makeSupportBounceCandles(100, 110);
  const events = findTouchEvents(candles, 100, 1.0, 'support');
  assert(events.length === 2, 'Finds 2 support touch events');
  assert(events[0].index === 10, 'First touch at correct index');
  assert(events[1].index === 17, 'Second touch at correct index');
}

{
  const candles = makeResistanceRejectionCandles(120, 110);
  const events = findTouchEvents(candles, 120, 1.0, 'resistance');
  assert(events.length === 2, 'Finds 2 resistance touch events');
}

// ── classifySupportTouch ──
console.log('\n--- classifySupportTouch ---');
{
  const candles = makeSupportBounceCandles(100, 110);
  const events = findTouchEvents(candles, 100, 1.0, 'support');
  const cfg = { lookbackDays: 365, zonePct: 1.0, bounceThresholdPct: 3.0, breakThresholdPct: 1.0, forwardWindows: [3, 5, 10, 20], minTouchesForValidLevel: 3, maxDaysToConfirmBounce: 5, maxDaysToConfirmBreak: 2 };
  const classified = classifySupportTouch(events[0], candles, 100, 1.0, cfg);
  assert(classified.classification === 'bounce', 'Classifies support bounce correctly');
}

{
  const candles = makeSupportBreakCandles(100, 110);
  const events = findTouchEvents(candles, 100, 1.0, 'support');
  const cfg = { lookbackDays: 365, zonePct: 1.0, bounceThresholdPct: 3.0, breakThresholdPct: 1.0, forwardWindows: [3, 5, 10, 20], minTouchesForValidLevel: 3, maxDaysToConfirmBounce: 5, maxDaysToConfirmBreak: 2 };
  if (events.length > 0) {
    const classified = classifySupportTouch(events[0], candles, 100, 1.0, cfg);
    assert(classified.classification === 'break', 'Classifies support break correctly');
  } else {
    assert(false, 'Classifies support break correctly (no events found)');
  }
}

// ── classifyResistanceTouch ──
console.log('\n--- classifyResistanceTouch ---');
{
  const candles = makeResistanceRejectionCandles(120, 110);
  const events = findTouchEvents(candles, 120, 1.0, 'resistance');
  const cfg = { lookbackDays: 365, zonePct: 1.0, bounceThresholdPct: 3.0, breakThresholdPct: 1.0, forwardWindows: [3, 5, 10, 20], minTouchesForValidLevel: 3, maxDaysToConfirmBounce: 5, maxDaysToConfirmBreak: 2 };
  if (events.length > 0) {
    const classified = classifyResistanceTouch(events[0], candles, 120, 1.0, cfg);
    assert(classified.classification === 'rejection', 'Classifies resistance rejection correctly');
  } else {
    assert(false, 'Classifies resistance rejection correctly (no events found)');
  }
}

// ── calculateForwardReturns ──
console.log('\n--- calculateForwardReturns ---');
{
  const candles: Candle[] = [];
  for (let i = 0; i < 25; i++) candles.push(makeCandle(i, 100 + i));
  const returns = calculateForwardReturns(candles, 5, [3, 5, 10]);
  assert(returns[3] != null, 'Computes 3-day forward return');
  assert(returns[5] != null, 'Computes 5-day forward return');
  assert(returns[10] != null, 'Computes 10-day forward return');
  assertClose(returns[3], 3 / 105, 0.01, '3d return is correct');
}

// ── analyzeSupportLevel ──
console.log('\n--- analyzeSupportLevel ---');
{
  const candles = makeSupportBounceCandles(100, 110, 40);
  const level: PriceLevel = { level: 100, source: 'gamma_wall', label: 'Put Wall' };
  const cfg = { lookbackDays: 365, zonePct: 1.0, bounceThresholdPct: 3.0, breakThresholdPct: 1.0, forwardWindows: [3, 5, 10, 20], minTouchesForValidLevel: 2, maxDaysToConfirmBounce: 5, maxDaysToConfirmBreak: 2 };
  const gamma = { putWall: 100, gammaConfidence: 0.7 };
  const stats = analyzeSupportLevel(candles, level, cfg, gamma);
  assert(stats.touchCount >= 2, `Support touch count >= 2 (got ${stats.touchCount})`);
  assert((stats.bounceCount ?? 0) >= 1, `Support bounce count >= 1 (got ${stats.bounceCount})`);
  assert(stats.gammaAlignment === true, 'Gamma alignment detected');
  assert(stats.strengthScore > 0, `Strength score > 0 (got ${stats.strengthScore})`);
}

// ── analyzeResistanceLevel ──
console.log('\n--- analyzeResistanceLevel ---');
{
  const candles = makeResistanceRejectionCandles(120, 110, 40);
  const level: PriceLevel = { level: 120, source: 'gamma_wall', label: 'Call Wall' };
  const cfg = { lookbackDays: 365, zonePct: 1.0, bounceThresholdPct: 3.0, breakThresholdPct: 1.0, forwardWindows: [3, 5, 10, 20], minTouchesForValidLevel: 2, maxDaysToConfirmBounce: 5, maxDaysToConfirmBreak: 2 };
  const gamma = { callWall: 120, gammaConfidence: 0.7 };
  const stats = analyzeResistanceLevel(candles, level, cfg, gamma);
  assert(stats.touchCount >= 2, `Resistance touch count >= 2 (got ${stats.touchCount})`);
  assert((stats.rejectionCount ?? 0) >= 1, `Rejection count >= 1 (got ${stats.rejectionCount})`);
  assert(stats.gammaAlignment === true, 'Gamma alignment detected');
  assert(stats.strengthScore > 0, `Strength score > 0 (got ${stats.strengthScore})`);
}

// ── analyzeRange ──
console.log('\n--- analyzeRange ---');
{
  const candles = makeRangeBoundCandles(95, 105, 50);
  const support: PriceLevel = { level: 95, source: 'gamma_wall' };
  const resistance: PriceLevel = { level: 105, source: 'gamma_wall' };
  const cfg = { lookbackDays: 365, zonePct: 1.0, bounceThresholdPct: 3.0, breakThresholdPct: 1.0, forwardWindows: [3, 5, 10, 20], minTouchesForValidLevel: 3, maxDaysToConfirmBounce: 5, maxDaysToConfirmBreak: 2 };
  const gamma = { putWall: 95, callWall: 105, gammaConfidence: 0.7 };
  const stats = analyzeRange(candles, support, resistance, cfg, gamma);
  assert(stats.widthPct > 5, `Range width > 5% (got ${stats.widthPct.toFixed(1)}%)`);
  assert(stats.containmentRate5d > 0, `Containment 5d > 0 (got ${stats.containmentRate5d.toFixed(2)})`);
  assert(stats.rangeStrengthScore > 0, `Range score > 0 (got ${stats.rangeStrengthScore})`);
}

// ── RSI confirmation ──
console.log('\n--- RSI confirmation ---');
{
  const candles = makeSupportBounceCandles(100, 110, 40);
  const level: PriceLevel = { level: 100, source: 'gamma_wall' };
  const cfg = { lookbackDays: 365, zonePct: 1.0, bounceThresholdPct: 3.0, breakThresholdPct: 1.0, forwardWindows: [3, 5, 10, 20], minTouchesForValidLevel: 2, maxDaysToConfirmBounce: 5, maxDaysToConfirmBreak: 2 };
  const stats = analyzeSupportLevel(candles, level, cfg);
  assert(stats.rsiConfirmationRate != null, 'RSI confirmation rate computed');
  assert((stats.rsiConfirmationRate ?? 0) > 0, `RSI confirms at least one bounce (rate: ${stats.rsiConfirmationRate?.toFixed(2)})`);
}

// ── Gamma alignment ──
console.log('\n--- Gamma alignment ---');
{
  const candles = makeSupportBounceCandles(100, 110);
  const level: PriceLevel = { level: 100, source: 'swing' };
  const cfg = { lookbackDays: 365, zonePct: 1.0, bounceThresholdPct: 3.0, breakThresholdPct: 1.0, forwardWindows: [3, 5, 10, 20], minTouchesForValidLevel: 2, maxDaysToConfirmBounce: 5, maxDaysToConfirmBreak: 2 };

  const statsAligned = analyzeSupportLevel(candles, level, cfg, { putWall: 100.5 });
  assert(statsAligned.gammaAlignment === true, 'Gamma put wall aligned with support');

  const statsFar = analyzeSupportLevel(candles, level, cfg, { putWall: 90 });
  assert(statsFar.gammaAlignment === false, 'Gamma put wall NOT aligned (too far)');
}

// ── Strategy bias mapping ──
console.log('\n--- Strategy bias mapping ---');
{
  // Bull put spread: strong support bounce + high IV/RV
  const result: PriceReactionResult = {
    ticker: 'TEST', spot: 102, lookbackDays: 365,
    supportStats: [], resistanceStats: [], rangeStats: [],
    nearestSupport: { level: 100, source: 'gamma_wall', zoneLow: 99, zoneHigh: 101, touchCount: 7, bounceCount: 5, breakCount: 2, bounceRate: 0.71, breakRate: 0.29, strengthScore: 78, classification: 'strong_support' },
    nearestResistance: { level: 120, source: 'gamma_wall', zoneLow: 118.8, zoneHigh: 121.2, touchCount: 3, rejectionCount: 1, rejectionRate: 0.33, strengthScore: 30, classification: 'weak_resistance' },
    summary: { directionalBias: 'bullish_bounce', strategyBias: 'no_trade', confidence: 78, warnings: [] },
  };
  const bias = mapReactionToStrategyBias(result, { ivRv: 1.3 });
  assert(bias === 'bull_put_spread', `Strategy bias = bull_put_spread (got ${bias})`);
}

{
  // Bear call spread: strong resistance rejection + high IV/RV
  const result: PriceReactionResult = {
    ticker: 'TEST', spot: 118, lookbackDays: 365,
    supportStats: [], resistanceStats: [], rangeStats: [],
    nearestSupport: { level: 100, source: 'swing', zoneLow: 99, zoneHigh: 101, touchCount: 2, strengthScore: 20, classification: 'insufficient_data' },
    nearestResistance: { level: 120, source: 'gamma_wall', zoneLow: 118.8, zoneHigh: 121.2, touchCount: 8, rejectionCount: 6, rejectionRate: 0.75, breakoutCount: 2, breakoutRate: 0.25, strengthScore: 72, classification: 'strong_resistance' },
    summary: { directionalBias: 'bearish_rejection', strategyBias: 'no_trade', confidence: 72, warnings: [] },
  };
  const bias = mapReactionToStrategyBias(result, { ivRv: 1.5 });
  assert(bias === 'bear_call_spread', `Strategy bias = bear_call_spread (got ${bias})`);
}

{
  // Iron condor: range-bound + low ADX + high IV/RV
  const result: PriceReactionResult = {
    ticker: 'TEST', spot: 100, lookbackDays: 365,
    supportStats: [], resistanceStats: [], rangeStats: [],
    nearestSupport: { level: 95, source: 'gamma_wall', zoneLow: 94, zoneHigh: 96, touchCount: 5, bounceRate: 0.6, strengthScore: 50, classification: 'weak_support' },
    nearestResistance: { level: 105, source: 'gamma_wall', zoneLow: 104, zoneHigh: 106, touchCount: 5, rejectionRate: 0.6, strengthScore: 50, classification: 'weak_resistance' },
    activeRange: { support: 95, resistance: 105, widthPct: 10, rangeTouchCount: 10, containmentRate5d: 0.8, containmentRate10d: 0.75, containmentRate20d: 0.7, avgReturnInsideRange5d: 0.001, avgReturnInsideRange10d: 0.002, avgMaxAdverseMove: -0.01, rangeStrengthScore: 65, classification: 'strong_range' },
    summary: { directionalBias: 'range_bound', strategyBias: 'no_trade', confidence: 65, warnings: [] },
  };
  const bias = mapReactionToStrategyBias(result, { ivRv: 1.3, adx: 15 });
  assert(bias === 'iron_condor', `Strategy bias = iron_condor (got ${bias})`);
}

{
  // No trade: support breaking
  const result: PriceReactionResult = {
    ticker: 'TEST', spot: 98, lookbackDays: 365,
    supportStats: [], resistanceStats: [], rangeStats: [],
    nearestSupport: { level: 100, source: 'swing', zoneLow: 99, zoneHigh: 101, touchCount: 6, bounceCount: 2, breakCount: 4, bounceRate: 0.33, breakRate: 0.67, strengthScore: 25, classification: 'broken_support' },
    summary: { directionalBias: 'bearish_breakdown', strategyBias: 'no_trade', confidence: 25, warnings: [] },
  };
  const bias = mapReactionToStrategyBias(result, { ivRv: 1.0 });
  assert(bias === 'no_trade', `Strategy bias = no_trade for broken support (got ${bias})`);
}

// ── Full integration: analyzePriceReactions ──
console.log('\n--- Full integration: analyzePriceReactions ---');
{
  const candles = makeSupportBounceCandles(100, 110, 50);
  const input: PriceReactionInput = {
    ticker: 'META',
    spot: 112,
    candles,
    supportLevels: [
      { level: 100, source: 'gamma_wall', label: 'Put Wall' },
      { level: 105, source: 'moving_average', label: 'SMA50' },
    ],
    resistanceLevels: [
      { level: 120, source: 'gamma_wall', label: 'Call Wall' },
    ],
    gamma: { putWall: 100, callWall: 120, gammaConfidence: 0.65 },
    ivRv: 1.2,
    adx: 18,
    lookbackDays: 50,
  };
  const result = analyzePriceReactions(input);
  assert(result.ticker === 'META', 'Result ticker matches');
  assert(result.supportStats.length === 2, 'Analyzes both support levels');
  assert(result.resistanceStats.length === 1, 'Analyzes resistance level');
  assert(result.nearestSupport != null, 'Nearest support identified');
  assert(result.summary.strategyBias !== undefined, `Strategy bias: ${result.summary.strategyBias}`);
  assert(result.summary.confidence > 0, `Confidence > 0 (got ${result.summary.confidence})`);
  assert(result.summary.warnings.length === 0, 'No warnings');
  console.log(`  Result: regime=${result.summary.directionalBias}, strategy=${result.summary.strategyBias}, confidence=${result.summary.confidence}`);
}

// ── Edge case: insufficient data ──
console.log('\n--- Edge cases ---');
{
  const input: PriceReactionInput = {
    ticker: 'TINY',
    spot: 50,
    candles: [makeCandle(0, 50), makeCandle(1, 51)],
    supportLevels: [{ level: 48, source: 'manual' }],
    resistanceLevels: [{ level: 52, source: 'manual' }],
  };
  const result = analyzePriceReactions(input);
  assert(result.summary.directionalBias === 'unclear', 'Insufficient data returns unclear');
  assert(result.summary.warnings.length > 0, 'Warning for insufficient data');
}

// ── Summary ──
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
