'use strict';

/**
 * NewLeaf TIQ — calibration, pace and consistency indices.
 *
 * Deterministic, pure. Confidence calibration is the single highest-value signal
 * in the instrument (spec-simulator.md §2) and is nearly impossible to fake
 * because confidence is committed before the outcome is known.
 *
 * These functions take already-normalised inputs (confidence and quality in
 * [0,1], pre-scored framing pairs) so they carry no dependency on scoring.js and
 * stay testable in isolation.
 */

function cRound1(x) { return Math.round(x * 10) / 10; }
function cMean(xs) { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0; }
function cMedian(xs) {
  if (!xs.length) return 0;
  const s = xs.slice().sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function cPopStdev(xs, mean) {
  if (!xs.length) return 0;
  return Math.sqrt(xs.reduce((a, b) => a + (b - mean) * (b - mean), 0) / xs.length);
}

// ── Confidence ────────────────────────────────────────────────────────────────

/** Map a 1..scaleMax slider onto [0,1]. 1→0, scaleMax→1. */
function normalizeConfidence(rating, scaleMax = 5) {
  if (scaleMax <= 1) return 0;
  return (rating - 1) / (scaleMax - 1);
}

/**
 * Calibration gap = mean(confidence − decision_quality) over items, both in
 * [0,1]. Being surest on the worst decisions (positive gap) is the pattern most
 * associated with large drawdowns (spec-simulator.md §2).
 *   gap >  0.22 → Overconfident
 *   gap < −0.22 → Underconfident
 *   otherwise   → Well calibrated
 */
function calibrationGap(entries, { threshold = 0.22 } = {}) {
  const diffs = (entries || []).map(e => e.confidence - e.quality);
  const gap = cMean(diffs);
  const label = gap > threshold ? 'Overconfident'
    : gap < -threshold ? 'Underconfident'
      : 'Well calibrated';
  return { gap: cRound1(gap * 100) / 100, label, n: diffs.length };
}

/**
 * Brier score = mean((confidence − outcome)²), outcome ∈ {0,1}. 0 is perfect,
 * 1 is worst. A cleaner overconfidence measure than the raw gap when a binary
 * correct/incorrect is available.
 */
function brierScore(entries) {
  const xs = (entries || []).map(e => {
    const o = e.correct ? 1 : 0;
    return (e.confidence - o) * (e.confidence - o);
  });
  return cMean(xs);
}

// ── Impulsivity / pace ─────────────────────────────────────────────────────────

/**
 * Impulsivity index (spec §3.5): z(response_time / est_seconds) averaged across
 * the sitting with the tails trimmed. Consistently answering in a fraction of
 * the estimated time is a signal in its own right.
 *
 * entries: [{ responseSeconds, estSeconds }]
 * Returns { index, medianRatio, pace, belowFloor }.
 *   pace: Fast (<0.5) | Measured | Deliberate (>1.5), from the median ratio.
 *   belowFloor: median ratio < 0.25 → excluded from norms (spec-norms §6).
 */
function impulsivityIndex(entries, { trim = 0.1, floor = 0.25 } = {}) {
  const ratios = (entries || [])
    .filter(e => e.estSeconds > 0)
    .map(e => e.responseSeconds / e.estSeconds);

  if (!ratios.length) return { index: 0, medianRatio: 0, pace: 'Measured', belowFloor: false };

  const mean = cMean(ratios);
  const sd = cPopStdev(ratios, mean);
  const zs = ratios.map(r => sd > 0 ? (r - mean) / sd : 0).sort((a, b) => a - b);

  // trim symmetric tails before averaging
  const k = Math.floor(zs.length * trim);
  const kept = zs.slice(k, zs.length - k);
  const index = cRound1(cMean(kept.length ? kept : zs));

  const medianRatio = cMedian(ratios);
  const pace = medianRatio < 0.5 ? 'Fast' : medianRatio > 1.5 ? 'Deliberate' : 'Measured';
  const belowFloor = medianRatio < floor;

  return { index, medianRatio, pace, belowFloor };
}

// ── Consistency (framing pairs) ────────────────────────────────────────────────

/**
 * Consistency index (spec-core §1.2). Framing pairs present the same dilemma in
 * a gain frame and a loss frame; a disciplined trader answers both the same way.
 *   penalty = Σ |gainScore − lossScore|   (scores normalised 0..1)
 *   index   = round(100 × (1 − penalty / nPairs))   → 100 is perfect symmetry
 * Returns { index, penalty, nPairs }. index is null with no pairs — the signal
 * is genuinely absent, not a fabricated 100.
 */
function consistencyIndex(pairs) {
  const list = pairs || [];
  if (!list.length) return { index: null, penalty: 0, nPairs: 0 };
  const penalty = list.reduce((a, p) => a + Math.abs(p.gainScore - p.lossScore), 0);
  const index = Math.round(Math.max(0, Math.min(100, 100 * (1 - penalty / list.length))));
  return { index, penalty: cRound1(penalty * 100) / 100, nPairs: list.length };
}

module.exports = {
  normalizeConfidence,
  calibrationGap,
  brierScore,
  impulsivityIndex,
  consistencyIndex
};
