/**
 * NewLeaf TIQ — norms, percentiles and regional rank.
 *
 * Deterministic. No model calls. Mirrors the shared/indicators/ pattern:
 * pure functions, CommonJS, fully testable.
 *
 * Build a norm table nightly from the sittings table, freeze it under a
 * norm_version, and serve every percentile from the frozen table so a
 * user's percentile does not drift between logins.
 */

'use strict';

// ---------------------------------------------------------------------------
// Display gating. Below these cohort sizes the number is noise dressed as
// precision, so we coarsen the display rather than hide it entirely.
// ---------------------------------------------------------------------------

const DISPLAY_TIERS = [
  { minN: 1000, precision: 'percentile' }, // "78th percentile"
  { minN: 200,  precision: 'decile'     }, // "8th decile"
  { minN: 30,   precision: 'quartile'   }, // "upper quartile"
  { minN: 0,    precision: 'none'       }  // criterion band only
];

const RANK_MIN_N = 500;   // below this, never show an ordinal rank
const COHORT_MIN_N = 30;  // below this, a cohort cannot be used at all

function displayPrecision(n) {
  return DISPLAY_TIERS.find(t => n >= t.minN).precision;
}

// ---------------------------------------------------------------------------
// Norm table
// ---------------------------------------------------------------------------

/**
 * Build a frozen norm table from an array of scores.
 * Scores are TQ or category scores, rounded to integers before tabulation.
 *
 * @param {number[]} scores
 * @param {object}   meta   { cohortId, normVersion, scoreKey }
 */
function buildNormTable(scores, meta = {}) {
  if (!Array.isArray(scores)) throw new TypeError('scores must be an array');

  const clean = scores
    .filter(s => Number.isFinite(s))
    .map(s => Math.round(s));

  const n = clean.length;
  const counts = new Map();
  for (const s of clean) counts.set(s, (counts.get(s) || 0) + 1);

  const distinct = [...counts.keys()].sort((a, b) => a - b);

  // cumulative count strictly below each distinct score
  const table = [];
  let below = 0;
  for (const score of distinct) {
    const equal = counts.get(score);
    table.push({ score, below, equal });
    below += equal;
  }

  return {
    cohortId: meta.cohortId || 'global',
    scoreKey: meta.scoreKey || 'TQ',
    normVersion: meta.normVersion || null,
    builtAt: meta.builtAt || null,
    n,
    mean: n ? clean.reduce((a, b) => a + b, 0) / n : null,
    sd: n > 1 ? stdev(clean) : null,
    table
  };
}

function stdev(xs) {
  const m = xs.reduce((a, b) => a + b, 0) / xs.length;
  const v = xs.reduce((a, b) => a + (b - m) * (b - m), 0) / (xs.length - 1);
  return Math.sqrt(v);
}

// ---------------------------------------------------------------------------
// Percentile
// ---------------------------------------------------------------------------

/**
 * Mid-rank percentile (the "modified percentile rank" used by standardised
 * tests). Ties are split, so a score at the exact median returns 50 rather
 * than something above or below it depending on tie direction.
 *
 *   PR = 100 * (below + 0.5 * equal) / n
 *
 * Returns a Wilson interval alongside the point estimate. Wilson is used
 * rather than the normal approximation because it stays inside [0,100] and
 * behaves at the tails, which is exactly where percentile claims are made.
 */
function percentileOf(score, normTable, { z = 1.96 } = {}) {
  const { n, table } = normTable;
  if (!n || n < COHORT_MIN_N) {
    return { percentile: null, low: null, high: null, n, reason: 'cohort_too_small' };
  }

  const s = Math.round(score);

  let below = 0;
  let equal = 0;
  for (const row of table) {
    if (row.score < s) below = row.below + row.equal;
    else if (row.score === s) { below = row.below; equal = row.equal; break; }
    else break;
  }

  const p = (below + 0.5 * equal) / n;
  const ci = wilson(p, n, z);

  // Reported percentile never reaches 0 or 100. The mid-rank formula already
  // guarantees this mathematically, but rounding can push the top score to
  // 100.0, which claims the user beat everyone including themselves.
  return {
    percentile: clampPct(round1(p * 100)),
    low: round1(ci.low * 100),
    high: round1(ci.high * 100),
    n,
    precision: displayPrecision(n),
    reason: null
  };
}

/** Wilson score interval for a proportion. */
function wilson(p, n, z = 1.96) {
  const d = 1 + (z * z) / n;
  const centre = p + (z * z) / (2 * n);
  const margin = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return {
    low: clamp01((centre - margin) / d),
    high: clamp01((centre + margin) / d)
  };
}

// ---------------------------------------------------------------------------
// Measurement error
// ---------------------------------------------------------------------------

/**
 * Standard error of measurement on the TQ scale.
 *   SEM = sd * sqrt(1 - reliability)
 *
 * With ~40 items and a Cronbach alpha around 0.82, SEM is roughly 6.4 TQ
 * points, so the 95% band is about +/- 13. Any single-sitting rank is
 * meaningfully uncertain and the UI should say so.
 */
function sem(sd, reliability) {
  if (reliability < 0 || reliability > 1) throw new RangeError('reliability must be 0..1');
  return sd * Math.sqrt(1 - reliability);
}

/** Percentile band implied by measurement error, not just sampling error. */
function percentileBand(score, normTable, reliability, { z = 1.96 } = {}) {
  const s = sem(normTable.sd ?? 15, reliability);
  const lo = percentileOf(score - z * s, normTable);
  const hi = percentileOf(score + z * s, normTable);
  const mid = percentileOf(score, normTable);
  return {
    percentile: mid.percentile,
    low: lo.percentile,
    high: hi.percentile,
    sem: round1(s),
    n: normTable.n
  };
}

// ---------------------------------------------------------------------------
// Cohort resolution
// ---------------------------------------------------------------------------

/**
 * Walk the cohort ladder outward until one is large enough to use.
 * Region fragments fast: a global n of 2,000 might be 140 in the UK and 3 in
 * Malta, so the ladder falls back rather than showing a percentile computed
 * against four people.
 *
 * @param {string[]} ladder  ordered, most specific first
 *                           e.g. ['country:GB','subregion:northern_europe','continent:EU','global']
 * @param {Map<string, object>} normTables  cohortId -> norm table
 */
function resolveCohort(ladder, normTables, { minN = COHORT_MIN_N } = {}) {
  for (const cohortId of ladder) {
    const t = normTables.get(cohortId);
    if (t && t.n >= minN) {
      return { cohortId, table: t, fellBack: cohortId !== ladder[0] };
    }
  }
  return { cohortId: null, table: null, fellBack: true };
}

/**
 * Build the ladder for a user. Experience band is placed first deliberately:
 * comparing a trader to others at the same stage is analytically informative,
 * whereas comparing them to others in the same country mostly is not.
 */
function buildLadder({ countryCode, subregion, continent, experienceBand }) {
  const ladder = [];
  if (experienceBand && countryCode) ladder.push(`exp:${experienceBand}|country:${countryCode}`);
  if (experienceBand) ladder.push(`exp:${experienceBand}`);
  if (countryCode) ladder.push(`country:${countryCode}`);
  if (subregion) ladder.push(`subregion:${subregion}`);
  if (continent) ladder.push(`continent:${continent}`);
  ladder.push('global');
  return ladder;
}

// ---------------------------------------------------------------------------
// Rank
// ---------------------------------------------------------------------------

/**
 * Competition rank (1224 style): equal scores share the best rank.
 * Only returned when the cohort is large enough for an ordinal to mean
 * anything; otherwise the caller should fall back to a percentile band.
 */
function rankOf(score, normTable, { minN = RANK_MIN_N } = {}) {
  const { n, table } = normTable;
  if (!n || n < minN) {
    return { rank: null, of: n, suppressed: true, reason: 'cohort_too_small_for_rank' };
  }

  const s = Math.round(score);
  let above = 0;
  for (const row of table) {
    if (row.score > s) above += row.equal;
  }

  return { rank: above + 1, of: n, suppressed: false, reason: null };
}

// ---------------------------------------------------------------------------
// Presentation
// ---------------------------------------------------------------------------

const CRITERION_BANDS = [
  { min: 130, label: 'Exceptional' },
  { min: 115, label: 'Strong' },
  { min: 100, label: 'Competent' },
  { min: 85,  label: 'Developing' },
  { min: -Infinity, label: 'Foundational' }
];

function criterionBand(tq) {
  return CRITERION_BANDS.find(b => tq >= b.min).label;
}

/**
 * Single entry point for the results screen. Always returns something
 * displayable: when the cohort is thin it degrades to a criterion band
 * rather than inventing a percentile.
 *
 * `anchorBased` is the caveat flag for the TQ number itself: while the score is
 * derived from the fixed anchor table rather than an empirical distribution
 * (n<500), the results screen must say so (spec-core §3.3, spec-norms §8). Pass
 * opts.tqMethod ('anchor' | 'empirical') from scoring.computeTQ; it defaults to
 * anchor-based, which is the honest default until a real cohort exists.
 */
function describeStanding(score, normTables, userMeta, opts = {}) {
  const { reliability = 0.82, tqMethod } = opts;
  const anchorBased = tqMethod ? tqMethod !== 'empirical' : true;
  const ladder = buildLadder(userMeta);
  const { cohortId, table, fellBack } = resolveCohort(ladder, normTables);

  const base = {
    score: round1(score),
    band: criterionBand(score),
    anchorBased,
    cohortId,
    fellBack,
    requestedCohort: ladder[0]
  };

  if (!table) {
    return { ...base, mode: 'criterion_only', percentile: null, rank: null };
  }

  const precision = displayPrecision(table.n);
  const band = percentileBand(score, table, reliability);
  const rank = rankOf(score, table);

  let display;
  if (precision === 'none') display = base.band;
  else if (precision === 'quartile') display = quartileLabel(band.percentile);
  else if (precision === 'decile') display = `${ordinal(Math.ceil(band.percentile / 10))} decile`;
  else display = `${ordinal(Math.round(band.percentile))} percentile`;

  return {
    ...base,
    mode: precision === 'none' ? 'criterion_only' : 'normed',
    precision,
    display,
    percentile: precision === 'none' ? null : band.percentile,
    percentileLow: band.low,
    percentileHigh: band.high,
    sem: band.sem,
    rank: rank.suppressed ? null : rank.rank,
    rankOf: rank.of,
    cohortN: table.n
  };
}

function quartileLabel(p) {
  if (p >= 75) return 'Upper quartile';
  if (p >= 50) return 'Third quartile';
  if (p >= 25) return 'Second quartile';
  return 'Lower quartile';
}

// ---------------------------------------------------------------------------

function ordinal(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

function clamp01(x) { return Math.max(0, Math.min(1, x)); }
function clampPct(x) { return Math.max(0.1, Math.min(99.9, x)); }
function round1(x) { return Math.round(x * 10) / 10; }

module.exports = {
  buildNormTable,
  percentileOf,
  percentileBand,
  resolveCohort,
  buildLadder,
  rankOf,
  describeStanding,
  criterionBand,
  displayPrecision,
  sem,
  wilson,
  DISPLAY_TIERS,
  RANK_MIN_N,
  COHORT_MIN_N
};
