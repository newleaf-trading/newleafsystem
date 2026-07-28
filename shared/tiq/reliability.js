'use strict';

/**
 * NewLeaf TIQ — reliability analysis. Cronbach's alpha per category and the
 * corrected item-total correlation per item.
 *
 * Pure and deterministic; the Firestore read that feeds it lives in
 * scripts/tiq/reliability.js. This is the number that decides whether the bank
 * is sound enough to attach percentiles to: alpha below 0.70 in a category means
 * that category needs more items before its scores are worth norming
 * (spec-norms §1.2) — a content decision, not a code change.
 */

function rMean(a) { return a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0; }
function rSampleVar(a) {
  if (a.length < 2) return 0;
  const m = rMean(a);
  return a.reduce((s, v) => s + (v - m) * (v - m), 0) / (a.length - 1);
}
function rRound(x, d = 4) { const p = 10 ** d; return Math.round(x * p) / p; }

/**
 * Cronbach's alpha for one category's response matrix.
 *   alpha = k/(k-1) * (1 - Σ var(item_i) / var(total))
 * @param {number[][]} matrix rows = respondents, cols = items (same k per row)
 * @returns {number|null} alpha, or null when undefined (n<2, k<2, zero total var)
 */
function cronbachAlpha(matrix) {
  const n = matrix.length;
  if (n < 2) return null;
  const k = matrix[0].length;
  if (k < 2) return null;
  let sumItemVar = 0;
  for (let j = 0; j < k; j++) sumItemVar += rSampleVar(matrix.map(r => r[j]));
  const totalVar = rSampleVar(matrix.map(r => r.reduce((a, b) => a + b, 0)));
  if (totalVar === 0) return null;
  return rRound((k / (k - 1)) * (1 - sumItemVar / totalVar));
}

/** Pearson correlation, or null if undefined (n<2 or a constant series). */
function pearson(x, y) {
  const n = x.length;
  if (n < 2) return null;
  const mx = rMean(x), my = rMean(y);
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const dx = x[i] - mx, dy = y[i] - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  if (sxx === 0 || syy === 0) return null;
  return rRound(sxy / Math.sqrt(sxx * syy));
}

/**
 * Corrected item-total correlation per item: each item's score against the sum
 * of the OTHER items (item excluded) — the standard discrimination index. Low or
 * negative values flag an item that isn't measuring what its category measures.
 * @returns {(number|null)[]} one correlation per column
 */
function itemTotalCorrelations(matrix) {
  if (!matrix.length) return [];
  const k = matrix[0].length;
  const out = [];
  for (let j = 0; j < k; j++) {
    const item = matrix.map(r => r[j]);
    const rest = matrix.map(r => r.reduce((a, b, idx) => (idx === j ? a : a + b), 0));
    out.push(pearson(item, rest));
  }
  return out;
}

module.exports = { cronbachAlpha, itemTotalCorrelations, pearson };
