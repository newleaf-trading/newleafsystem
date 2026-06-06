'use strict';

/**
 * forward.cjs — Median forward returns + p75 max adverse move after zone touches
 */

function median(arr) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function percentile(arr, p) {
  if (!arr.length) return null;
  const s = [...arr].sort((a, b) => a - b);
  const idx = (p / 100) * (s.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (idx - lo);
}

/**
 * Compute median forward returns and p75 max adverse move for touch events.
 * @param {Object[]} candles - full candle array
 * @param {Object[]} touches - touch events with { index }
 * @param {number[]} windows - forward windows in days [3, 5, 10, 20]
 * @param {'support'|'resistance'} type
 * @returns {{ median3d, median5d, median10d, median20d, p75Adverse }}
 */
function forwardReturns(candles, touches, windows = [3, 5, 10, 20], type = 'support') {
  const result = {};

  for (const w of windows) {
    const returns = [];
    for (const t of touches) {
      const base = candles[t.index]?.close;
      const future = candles[t.index + w]?.close;
      if (base && future) returns.push((future - base) / base);
    }
    result[`median${w}d`] = median(returns);
  }

  // p75 max adverse move
  const adverseMoves = [];
  for (const t of touches) {
    const base = candles[t.index]?.close;
    if (!base) continue;
    let maxAdverse = 0;
    const end = Math.min(t.index + 10, candles.length);
    for (let i = t.index + 1; i < end; i++) {
      const move = type === 'support'
        ? (candles[i].low - base) / base    // adverse = down for support
        : (candles[i].high - base) / base;  // adverse = up for resistance
      if (type === 'support' && move < maxAdverse) maxAdverse = move;
      if (type === 'resistance' && move > maxAdverse) maxAdverse = move;
    }
    adverseMoves.push(maxAdverse);
  }

  result.p75Adverse = percentile(adverseMoves.map(Math.abs), 75);

  return result;
}

module.exports = { forwardReturns, median, percentile };
