'use strict';

/**
 * Shared technical indicator computations for the NewLeaf monorepo.
 *
 * Consumed by:
 *   - api/src/tools/indicators.ts  (will import after F1.2 migration)
 *   - generaterecommendations/analyse-tiles.cjs  (injects ground-truth into prompts)
 *
 * All formulas match the existing api/src/tools/indicators.ts implementations
 * to prevent drift between the workbench and the analysis pipeline.
 */

// ── SMA ─────────────────────────────────────────────────────────────────────

/**
 * Simple Moving Average over the last `period` values.
 * Returns 0 if insufficient data.
 */
function sma(closes, period) {
  if (closes.length < period) return 0;
  const slice = closes.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / period;
}

// ── EMA ─────────────────────────────────────────────────────────────────────

/**
 * Exponential Moving Average.
 * Seeds with SMA of the first `period` values, then applies the EMA formula.
 * Returns 0 if insufficient data.
 */
function ema(closes, period) {
  if (closes.length < period) return 0;
  const k = 2 / (period + 1);
  // Seed with SMA of first `period` closes
  let value = 0;
  for (let i = 0; i < period; i++) value += closes[i];
  value /= period;
  // Apply EMA from period onward
  for (let i = period; i < closes.length; i++) {
    value = closes[i] * k + value * (1 - k);
  }
  return value;
}

/**
 * Full EMA series starting from index `period - 1`.
 * Returns an array of length `closes.length - period + 1`.
 */
function emaSeries(closes, period) {
  if (closes.length < period) return [];
  const k = 2 / (period + 1);
  const result = [];
  let value = 0;
  for (let i = 0; i < period; i++) value += closes[i];
  value /= period;
  result.push(value);
  for (let i = period; i < closes.length; i++) {
    value = closes[i] * k + value * (1 - k);
    result.push(value);
  }
  return result;
}

// ── RSI ─────────────────────────────────────────────────────────────────────

/**
 * Relative Strength Index (Cutler's variant — simple average, not Wilder's smoothed).
 * Matches the existing api/src/tools/indicators.ts implementation.
 * Returns 50 if insufficient data.
 */
function rsi(closes, period = 14) {
  if (closes.length < period + 1) return 50;
  let gains = 0, losses = 0;
  for (let i = closes.length - period; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    if (diff > 0) gains += diff;
    else losses -= diff;
  }
  if (losses === 0) return 100;
  const rs = (gains / period) / (losses / period);
  return +(100 - 100 / (1 + rs)).toFixed(1);
}

// ── Bollinger Bands ─────────────────────────────────────────────────────────

/**
 * Population standard deviation.
 */
function stddev(values, mean) {
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

/**
 * Bollinger Bands (20-period, 2 std dev).
 * Returns { upper, middle, lower, width }.
 * Matches api/src/tools/indicators.ts.
 */
function bollingerBands(closes, period = 20, mult = 2) {
  const middle = sma(closes, period);
  if (middle === 0) return { upper: 0, middle: 0, lower: 0, width: 0 };
  const slice = closes.slice(-period);
  const sd = slice.length >= period ? stddev(slice, middle) : 0;
  const upper = +(middle + mult * sd).toFixed(2);
  const lower = +(middle - mult * sd).toFixed(2);
  const width = middle > 0 ? +((upper - lower) / middle * 100).toFixed(2) : 0;
  return { upper, middle: +middle.toFixed(2), lower, width };
}

// ── MACD ────────────────────────────────────────────────────────────────────

/**
 * MACD (12, 26, 9) — Moving Average Convergence Divergence.
 *
 * Standard formula:
 *   macdLine   = EMA(12) - EMA(26)
 *   signalLine = EMA(9) of macdLine
 *   histogram  = macdLine - signalLine
 *
 * Requires at least 35 closes (26 for slow EMA seed + 9 for signal seed).
 * Returns { macdLine, signalLine, histogram } or null if insufficient data.
 */
function macd(closes, fast = 12, slow = 26, signal = 9) {
  // Need enough data: slow period to seed EMA, then signal period for signal line
  if (closes.length < slow + signal) return null;

  const fastSeries = emaSeries(closes, fast);
  const slowSeries = emaSeries(closes, slow);

  // Align: slowSeries starts at index slow-1, fastSeries at fast-1
  // The MACD line series starts where both exist
  const offset = slow - fast; // how many more fast values exist before slow starts
  const macdSeries = [];
  for (let i = 0; i < slowSeries.length; i++) {
    macdSeries.push(fastSeries[i + offset] - slowSeries[i]);
  }

  if (macdSeries.length < signal) return null;

  // Signal line = EMA(signal) of macdSeries
  const signalSeries = emaSeries(macdSeries, signal);
  const signalVal = signalSeries[signalSeries.length - 1];
  const macdVal = macdSeries[macdSeries.length - 1];
  const histogram = macdVal - signalVal;

  return {
    macdLine: +macdVal.toFixed(4),
    signalLine: +signalVal.toFixed(4),
    histogram: +histogram.toFixed(4),
  };
}

// ── SMA Crossover Detection ─────────────────────────────────────────────────

/**
 * Find the most recent SMA crossover between a fast and slow period.
 * Scans backward through closes to find where fast SMA crossed slow SMA.
 *
 * Returns { daysAgo, type } where type is "golden_cross" (fast crosses above slow)
 * or "death_cross" (fast crosses below slow), or null if no crossover in lookback.
 */
function findRecentSmaCrossover(closes, fastPeriod = 20, slowPeriod = 50, lookback = 60) {
  if (closes.length < slowPeriod + lookback) {
    // Not enough data for full lookback; use what we have
    if (closes.length <= slowPeriod) return null;
  }

  const startIdx = Math.max(slowPeriod, closes.length - lookback);

  for (let i = closes.length - 1; i > startIdx; i--) {
    const fastNow = sma(closes.slice(0, i + 1), fastPeriod);
    const slowNow = sma(closes.slice(0, i + 1), slowPeriod);
    const fastPrev = sma(closes.slice(0, i), fastPeriod);
    const slowPrev = sma(closes.slice(0, i), slowPeriod);

    if (fastNow === 0 || slowNow === 0 || fastPrev === 0 || slowPrev === 0) continue;

    // Golden cross: fast was below slow, now above
    if (fastPrev <= slowPrev && fastNow > slowNow) {
      return { daysAgo: closes.length - 1 - i, type: 'golden_cross' };
    }
    // Death cross: fast was above slow, now below
    if (fastPrev >= slowPrev && fastNow < slowNow) {
      return { daysAgo: closes.length - 1 - i, type: 'death_cross' };
    }
  }

  return null;
}

// ── Compute All ─────────────────────────────────────────────────────────────

/**
 * Compute all indicators from an array of closing prices.
 * This is the main entry point for generaterecommendations/.
 */
function computeAll(closes) {
  return {
    sma20: +sma(closes, 20).toFixed(2),
    sma50: +sma(closes, 50).toFixed(2),
    sma100: +sma(closes, 100).toFixed(2),
    sma200: +sma(closes, 200).toFixed(2),
    rsi14: rsi(closes, 14),
    bollinger: bollingerBands(closes, 20, 2),
    macd: macd(closes, 12, 26, 9),
    smaCrossover: findRecentSmaCrossover(closes, 20, 50, 60),
  };
}

module.exports = {
  sma,
  ema,
  emaSeries,
  rsi,
  stddev,
  bollingerBands,
  macd,
  findRecentSmaCrossover,
  computeAll,
};
