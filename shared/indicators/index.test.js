'use strict';

const {
  sma, ema, emaSeries, rsi, stddev,
  bollingerBands, macd, findRecentSmaCrossover, computeAll,
} = require('./index');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${label}`);
  }
}

function approx(a, b, tolerance = 0.01) {
  return Math.abs(a - b) < tolerance;
}

// ── SMA ─────────────────────────────────────────────────────────────────────

console.log('SMA');

assert(sma([1, 2, 3, 4, 5], 5) === 3, 'sma([1,2,3,4,5], 5) === 3');
assert(sma([10, 20, 30], 3) === 20, 'sma([10,20,30], 3) === 20');
assert(sma([1, 2], 5) === 0, 'sma insufficient data returns 0');
assert(sma([1, 2, 3, 4, 5, 6], 3) === 5, 'sma uses last N values: (4+5+6)/3 = 5');

// ── EMA ─────────────────────────────────────────────────────────────────────

console.log('EMA');

// Flat sequence: EMA of all 1s should be 1
const flat12 = Array(20).fill(1);
assert(approx(ema(flat12, 12), 1), 'ema flat sequence equals 1');

// EMA insufficient data
assert(ema([1, 2, 3], 10) === 0, 'ema insufficient data returns 0');

// EMA with known calculation:
// closes = [1, 2, 3, 4, 5], period = 3
// seed = (1+2+3)/3 = 2
// k = 2/(3+1) = 0.5
// step 4: 4*0.5 + 2*0.5 = 3
// step 5: 5*0.5 + 3*0.5 = 4
assert(approx(ema([1, 2, 3, 4, 5], 3), 4, 0.001), 'ema([1,2,3,4,5], 3) === 4');

// ── emaSeries ───────────────────────────────────────────────────────────────

console.log('emaSeries');

const series = emaSeries([1, 2, 3, 4, 5], 3);
assert(series.length === 3, 'emaSeries length = closes.length - period + 1');
assert(approx(series[0], 2, 0.001), 'emaSeries[0] = seed SMA = 2');
assert(approx(series[1], 3, 0.001), 'emaSeries[1] = 3');
assert(approx(series[2], 4, 0.001), 'emaSeries[2] = 4');

// ── RSI ─────────────────────────────────────────────────────────────────────

console.log('RSI');

// Monotonic gains: 15 values all increasing by 1 → all gains, zero losses → RSI = 100
const rising = Array.from({ length: 15 }, (_, i) => 100 + i);
assert(rsi(rising, 14) === 100, 'rsi monotonic gains === 100');

// Monotonic losses: 15 values all decreasing by 1 → all losses, zero gains
// losses = 14, gains = 0 → RS = 0 → RSI = 0
const falling = Array.from({ length: 15 }, (_, i) => 100 - i);
assert(rsi(falling, 14) === 0, 'rsi monotonic losses === 0');

// Flat: no changes → gains=0, losses=0 → losses===0 check → returns 100
const flat14 = Array(15).fill(50);
assert(rsi(flat14, 14) === 100, 'rsi flat returns 100 (no losses)');

// Insufficient data
assert(rsi([1, 2, 3], 14) === 50, 'rsi insufficient data returns 50');

// ── stddev ──────────────────────────────────────────────────────────────────

console.log('stddev');

assert(stddev([1, 1, 1, 1], 1) === 0, 'stddev of constant values === 0');
// [1,2,3,4,5] mean=3, variance = (4+1+0+1+4)/5 = 2, sd = sqrt(2) ≈ 1.4142
assert(approx(stddev([1, 2, 3, 4, 5], 3), Math.sqrt(2), 0.001), 'stddev([1,2,3,4,5], mean=3)');

// ── Bollinger Bands ─────────────────────────────────────────────────────────

console.log('Bollinger Bands');

// 20 identical values: BB should collapse (upper = middle = lower, width = 0)
const flat20 = Array(20).fill(100);
const bb = bollingerBands(flat20, 20, 2);
assert(bb.middle === 100, 'bb middle === 100 for flat data');
assert(bb.upper === 100, 'bb upper === 100 for flat data (zero stddev)');
assert(bb.lower === 100, 'bb lower === 100 for flat data (zero stddev)');
assert(bb.width === 0, 'bb width === 0 for flat data');

// Insufficient data
const bbShort = bollingerBands([1, 2, 3], 20, 2);
assert(bbShort.middle === 0, 'bb insufficient data returns zeros');

// ── MACD ────────────────────────────────────────────────────────────────────

console.log('MACD');

// Flat sequence: EMA(12) = EMA(26) = constant → macdLine = 0, signal = 0, histogram = 0
const flat50 = Array(50).fill(100);
const m1 = macd(flat50);
assert(m1 !== null, 'macd returns non-null for 50 flat values');
assert(m1.macdLine === 0, 'macd flat: macdLine === 0');
assert(m1.signalLine === 0, 'macd flat: signalLine === 0');
assert(m1.histogram === 0, 'macd flat: histogram === 0');

// Insufficient data
assert(macd(Array(30).fill(100)) === null, 'macd returns null for 30 values (need 35)');

// Trending up: MACD should be positive (fast EMA > slow EMA)
const trendUp = Array.from({ length: 60 }, (_, i) => 100 + i * 0.5);
const m2 = macd(trendUp);
assert(m2 !== null, 'macd trending up returns non-null');
assert(m2.macdLine > 0, 'macd trending up: macdLine > 0');

// Trending down: MACD should be negative
const trendDown = Array.from({ length: 60 }, (_, i) => 200 - i * 0.5);
const m3 = macd(trendDown);
assert(m3 !== null, 'macd trending down returns non-null');
assert(m3.macdLine < 0, 'macd trending down: macdLine < 0');

// ── findRecentSmaCrossover ──────────────────────────────────────────────────

console.log('findRecentSmaCrossover');

// Construct a golden cross scenario:
// 80 values where SMA20 starts below SMA50 and crosses above near the end
const crossData = [];
// First 60 values: declining (SMA20 < SMA50)
for (let i = 0; i < 60; i++) crossData.push(100 - i * 0.2);
// Last 30 values: sharp rally (SMA20 rises above SMA50)
for (let i = 0; i < 30; i++) crossData.push(crossData[59] + i * 1.5);

const cross = findRecentSmaCrossover(crossData, 20, 50, 60);
assert(cross !== null, 'crossover detected in synthetic data');
assert(cross.type === 'golden_cross', 'crossover type is golden_cross');
assert(typeof cross.daysAgo === 'number' && cross.daysAgo >= 0, 'daysAgo is non-negative number');

// No crossover in flat data
const flatCross = findRecentSmaCrossover(Array(200).fill(50), 20, 50, 60);
assert(flatCross === null, 'no crossover in flat data');

// Insufficient data
assert(findRecentSmaCrossover([1, 2, 3], 20, 50) === null, 'crossover null for insufficient data');

// ── computeAll ──────────────────────────────────────────────────────────────

console.log('computeAll');

const allCloses = Array.from({ length: 250 }, (_, i) => 100 + Math.sin(i / 10) * 5);
const all = computeAll(allCloses);
assert(typeof all.sma20 === 'number' && all.sma20 > 0, 'computeAll has sma20');
assert(typeof all.sma50 === 'number' && all.sma50 > 0, 'computeAll has sma50');
assert(typeof all.rsi14 === 'number', 'computeAll has rsi14');
assert(all.bollinger && typeof all.bollinger.upper === 'number', 'computeAll has bollinger');
assert(all.macd && typeof all.macd.macdLine === 'number', 'computeAll has macd');

// ── Summary ─────────────────────────────────────────────────────────────────

console.log('');
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('All tests passed.');
}
