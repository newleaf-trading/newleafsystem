/* GENERATED from shared/tiq/{scoring,norms,calibration,sim}.js — DO NOT EDIT.
   Edit the module sources and run `node shared/tiq/sync.js`. */
;(function (root) {
'use strict';

// ── scoring.js ──
/**
 * NewLeaf TIQ — item scoring, category rollup, composite, TQ and the ruin gate.
 *
 * Deterministic. No model calls, no network, no Date.now(). Mirrors the
 * shared/plan and shared/indicators pattern: plain functions, CommonJS, every
 * export testable in isolation. See docs/tiq/spec-core.md §2–3 for the maths.
 *
 * Item modes present in bank-v1: weighted_choice, multi_select, ranking.
 * diagnostic_only is implemented (spec-defined, trait-only, contributes 0 to
 * max). forced_choice_vector is named in the brief but defined nowhere and used
 * by no item, so it is deliberately NOT implemented — it would be a guess.
 */

// Helper names are scoping-unique across the tiq modules so sync.js can
// concatenate them into one browser scope without collisions.
function sRound1(x) { return Math.round(x * 10) / 10; }
function sClamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }
function sPopStdev(xs, mean) {
  if (!xs.length) return 0;
  const v = xs.reduce((a, b) => a + (b - mean) * (b - mean), 0) / xs.length;
  return Math.sqrt(v);
}

// ── Category weights (spec-core §3.3; mirrors bank-v1 categories block) ──────

const CATEGORY_WEIGHTS = { KQ: 0.18, EQ: 0.24, SQ: 0.20, RQ: 0.28, MQ: 0.10 };
const CATEGORY_KEYS = ['KQ', 'EQ', 'SQ', 'RQ', 'MQ'];

// ── Per-mode scorers ────────────────────────────────────────────────────────

/** weighted_choice: direct point lookup, unknown/missing key scores 0. */
function scoreWeightedChoice(scoring, key) {
  const cp = scoring.choice_points || {};
  return Number.isFinite(cp[key]) ? cp[key] : 0;
}

/**
 * multi_select: +per_correct for each correct key, per_incorrect (negative) for
 * each wrong key, clamped to [floor, max_points] (spec-core §2).
 */
function scoreMultiSelect(scoring, keys) {
  const correct = new Set(scoring.correct_keys || []);
  const perCorrect = scoring.per_correct || 0;
  const perIncorrect = scoring.per_incorrect || 0;
  let pts = 0;
  for (const k of keys || []) pts += correct.has(k) ? perCorrect : perIncorrect;
  const floor = Number.isFinite(scoring.floor) ? scoring.floor : 0;
  return sClamp(pts, floor, scoring.max_points);
}

/**
 * Kendall tau-b between a user ordering and the correct ordering. The two are
 * permutations of the same key set (no ties), so tau-b == tau-a here. Returns a
 * value in [-1, 1]; 1 for identical, -1 for fully reversed.
 */
function kendallTau(order, correctOrder) {
  const rank = new Map(correctOrder.map((k, i) => [k, i]));
  const seq = (order || []).map(k => rank.get(k)).filter(v => v !== undefined);
  const n = seq.length;
  if (n < 2) return 1;
  let c = 0, d = 0;
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const s = Math.sign(seq[j] - seq[i]);
      if (s > 0) c++; else if (s < 0) d++;
    }
  }
  return (c + d) === 0 ? 1 : (c - d) / (c + d);
}

/**
 * ranking: base = max_points × (tau + 1) / 2, minus any violated
 * critical_constraints, floored at 0 (spec-core §3.2). A critical constraint
 * { before, after, penalty } is violated when `before` is ordered after `after`.
 */
function scoreRanking(scoring, order) {
  const tau = kendallTau(order, scoring.correct_order || []);
  let base = scoring.max_points * (tau + 1) / 2;
  if (Array.isArray(scoring.critical_constraints)) {
    for (const cc of scoring.critical_constraints) {
      const ia = (order || []).indexOf(cc.before);
      const ib = (order || []).indexOf(cc.after);
      if (ia > -1 && ib > -1 && ia > ib) base -= cc.penalty;
    }
  }
  return Math.max(0, base);
}

// ── Item dispatch ────────────────────────────────────────────────────────────

/**
 * Score a single item against a response.
 *   response: { choice } | { selected:[] } | { order:[] }
 * Returns { earned, max, ruinFlag, mode }. diagnostic_only always earns 0 and
 * contributes 0 to max (it only feeds the trait profile).
 */
function scoreItem(item, response) {
  const sc = item.scoring;
  const mode = sc.mode;
  const r = response || {};
  let earned = 0;
  let ruinFlag = false;

  if (mode === 'weighted_choice') {
    earned = scoreWeightedChoice(sc, r.choice);
    if (Array.isArray(sc.ruin_flag_choices) && sc.ruin_flag_choices.includes(r.choice)) ruinFlag = true;
  } else if (mode === 'multi_select') {
    earned = scoreMultiSelect(sc, r.selected);
  } else if (mode === 'ranking') {
    earned = scoreRanking(sc, r.order);
  } else if (mode === 'diagnostic_only') {
    earned = 0;
  } else {
    throw new Error('unknown scoring mode: ' + mode);
  }

  const max = mode === 'diagnostic_only' ? 0 : (sc.max_points || 0);
  return { earned, max, ruinFlag, mode };
}

// ── Category rollup ──────────────────────────────────────────────────────────

/**
 * Roll items up per category. category_c = 100 × Σ earned / Σ max (spec §3.1).
 * Unanswered items score 0 but still add to max. Returns per-category
 * { raw, max, score } plus the total ruin_flag count.
 *
 * @param {object[]} items            bank questions
 * @param {object}   responsesById    { [itemId]: response }
 */
function rollupCategories(items, responsesById) {
  const categories = {};
  for (const c of CATEGORY_KEYS) categories[c] = { raw: 0, max: 0, score: 0 };
  let ruinFlagCount = 0;

  for (const item of items) {
    const cat = item.category;
    if (!categories[cat]) categories[cat] = { raw: 0, max: 0, score: 0 };
    const r = scoreItem(item, responsesById[item.id]);
    categories[cat].raw += r.earned;
    categories[cat].max += r.max;
    if (r.ruinFlag) ruinFlagCount++;
  }

  for (const c of Object.keys(categories)) {
    const cc = categories[c];
    cc.score = cc.max > 0 ? sRound1(100 * cc.raw / cc.max) : 0;
  }
  return { categories, ruinFlagCount };
}

/** Weighted composite of the five category scores (0–100). */
function composite(categoryScores, weights = CATEGORY_WEIGHTS) {
  let sum = 0;
  for (const c of Object.keys(weights)) sum += (weights[c] || 0) * (categoryScores[c] || 0);
  return sRound1(sum);
}

// ── TQ ────────────────────────────────────────────────────────────────────────

/**
 * Anchor table (spec §3.3). Piecewise-linear interpolation of composite → TQ,
 * used until the cohort reaches n≥500 and empirical z-scoring takes over.
 * Breakpoints reproduce the published bands:
 *   90–100→130, 80–89→115–129, 68–79→100–114, 55–67→85–99, <55→<85.
 *
 * CAPPED AT 130. TQ 130 is already +2σ; anything above it is a three-sigma
 * claim, and with no cohort behind the table there is nothing to justify one.
 * The top band is therefore flat at 130 until empirical norms exist.
 */
const ANCHOR = [[0, 55], [55, 85], [68, 100], [80, 115], [90, 130], [100, 130]];
const ANCHOR_TQ_CAP = 130;

function anchorTQ(comp) {
  const c = sClamp(comp, 0, 100);
  for (let i = 1; i < ANCHOR.length; i++) {
    const [c0, t0] = ANCHOR[i - 1];
    const [c1, t1] = ANCHOR[i];
    if (c <= c1) return Math.min(ANCHOR_TQ_CAP, t0 + (c - c0) / (c1 - c0) * (t1 - t0));
  }
  return ANCHOR_TQ_CAP;
}

/** Empirical TQ once a real distribution exists: 100 + 15·z(composite). */
function empiricalTQ(comp, norm) {
  return 100 + 15 * (comp - norm.mean) / norm.sd;
}

/**
 * Choose anchor vs empirical TQ. Empirical only once the cohort is large enough
 * to have a trustworthy mean/sd (n≥500 per spec); otherwise anchor.
 * Returns { tq, method }.
 */
function computeTQ(comp, norm) {
  if (norm && norm.n >= 500 && Number.isFinite(norm.sd) && norm.sd > 0 && Number.isFinite(norm.mean)) {
    return { tq: sRound1(empiricalTQ(comp, norm)), method: 'empirical' };
  }
  return { tq: sRound1(anchorTQ(comp)), method: 'anchor' };
}

// ── Ruin gate ──────────────────────────────────────────────────────────────────

/**
 * The ruin gate (spec §3.4). Caps — never raises — TQ.
 *   if RQ < 45 or ruinFlagCount >= 2 → TQ = min(TQ, 95), banner set.
 */
function applyRuinGate(tq, { RQ, ruinFlagCount }) {
  const trip = RQ < 45 || ruinFlagCount >= 2;
  if (!trip) return { tq, gated: false, banner: null };
  return { tq: Math.min(tq, 95), gated: true, banner: 'Capital preservation risk' };
}

// ── Trait profile ────────────────────────────────────────────────────────────

/**
 * Accumulate trait_loadings across chosen keys (fires regardless of whether the
 * choice scored well — spec §1.3), then z-score across the trait vocabulary so
 * an elevated bias stands out from the user's own baseline.
 * Returns { traits: { [trait]: { raw, z } }, top: [{ trait, raw, z }] } (top 3, z>0).
 */
function traitProfile(items, responsesById, vocabulary) {
  const sums = {};
  const vocab = vocabulary && vocabulary.length ? vocabulary.slice() : null;
  if (vocab) for (const tr of vocab) sums[tr] = 0;

  for (const item of items) {
    const loadings = item.scoring && item.scoring.trait_loadings;
    if (!loadings) continue;
    const r = responsesById[item.id];
    const key = r && r.choice;
    if (!key || !loadings[key]) continue;
    for (const [tr, w] of Object.entries(loadings[key])) {
      sums[tr] = (sums[tr] || 0) + w;
    }
  }

  const traitKeys = vocab || Object.keys(sums);
  const values = traitKeys.map(k => sums[k] || 0);
  const mean = values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  const sd = sPopStdev(values, mean);

  const traits = {};
  for (const k of traitKeys) {
    const raw = sums[k] || 0;
    traits[k] = { raw, z: sd > 0 ? sRound1((raw - mean) / sd) : 0 };
  }
  const top = Object.entries(traits)
    .map(([trait, v]) => ({ trait, raw: v.raw, z: v.z }))
    .filter(v => v.z > 0)
    .sort((a, b) => b.z - a.z)
    .slice(0, 3);

  return { traits, top };
}

// ── Front door ────────────────────────────────────────────────────────────────

/**
 * Front-door (Instinct Quiz) score. Honest, no floor — the 50-point floor was
 * removed in spec-simulator.md §1. round(100 × earned / available). The
 * archetype is the headline; this number sits below it.
 */
function frontDoorScore(earned, available) {
  if (!available) return 0;
  return Math.round(100 * earned / available);
}

// ── Orchestration ────────────────────────────────────────────────────────────

/**
 * Score a whole sitting. Pure: pass `opts.norm` ({ n, mean, sd }) to switch TQ
 * to empirical once the cohort is large enough. The caller stamps provenance and
 * persists — this function only computes.
 */
function scoreSitting(bank, responsesById, opts = {}) {
  const { categories, ruinFlagCount } = rollupCategories(bank.questions, responsesById);
  const categoryScores = {};
  for (const c of Object.keys(categories)) categoryScores[c] = categories[c].score;

  const comp = composite(categoryScores);
  const { tq: tqRaw, method } = computeTQ(comp, opts.norm);
  const gate = applyRuinGate(tqRaw, { RQ: categoryScores.RQ || 0, ruinFlagCount });
  const traits = traitProfile(bank.questions, responsesById, bank.trait_vocabulary);

  return {
    categories,
    categoryScores,
    composite: comp,
    tqRaw,
    tqMethod: method,
    tq: gate.tq,
    ruinGate: gate,
    ruinFlagCount,
    traits
  };
}

// ── norms.js ──
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

// ── calibration.js ──
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

// ── sim.js ──
/**
 * NewLeaf TIQ — Decision Simulator engine. Ported from the reference prototype
 * docs/tiq/reference/decision-sim.html; plumbing rewritten, logic preserved.
 *
 * Four commitments, all deliberate (spec-simulator.md §5):
 *   1. The market path is SCRIPTED and never reacts to the user. Fixed path,
 *      variable user state — that is what makes it an assessment and not luck.
 *   2. Scoring is path-dependent: the same action scores differently depending
 *      on the position actually held. (Decision points live in the scenario
 *      nodes and arrive in the decision log; this engine consumes the log.)
 *   3. Decision score and P&L are computed separately, then shown to diverge.
 *   4. The same decision log is replayed against alternate scripts — the
 *      counterfactual. Deterministic and cheap.
 *
 * MONEY IS INTEGER PENCE INTERNALLY. Prices carry two decimals, so a leg's P&L
 * ((credit − mark) × multiplier × contracts) is exact in pence but accumulates
 * float noise in pounds. Every leg is rounded to pence at the moment it is
 * realised (`legPence`), state cash is integer pence, and pounds appear only at
 * the presentation boundary via `toPounds`. This makes path-independence exact
 * by construction: identical decision logs on different scripts return the same
 * integer, not two floats that happen to be close.
 */

const CONTRACT_MULTIPLIER = 100; // option contract multiplier (shares per contract)

/** Price in pounds (2dp) → integer pence. Math.round absorbs float noise (2.30·100). */
function toPence(pounds) { return Math.round(pounds * 100); }

/** Presentation boundary: integer pence → pounds. Call this, and only this, to display. */
function toPounds(pence) { return pence / 100; }

/**
 * Realised/unrealised value of one lot in INTEGER pence, rounded at the price
 * (i.e. at the point of realisation). (creditPence − markPence) is exact for
 * 2dp inputs, so the whole leg is an exact integer.
 */
function legPence(credit, mark, n) {
  return (toPence(credit) - toPence(mark)) * CONTRACT_MULTIPLIER * n;
}

function simCloneLots(lots) { return lots.map(l => ({ n: l.n, credit: l.credit })); }

/** Fresh state for a scenario: the opening position, flat cash (pence), empty log. */
function freshState(scenario) {
  return {
    lots: simCloneLots(scenario.opening_position || []),
    cash: 0, // integer pence
    breaks: [],
    log: []
  };
}

/** Open P&L of the current position at time key `t` on a given script, in integer pence. */
function unrealised(state, script, t) {
  const mark = script[t];
  return state.lots.reduce((a, l) => a + legPence(l.credit, mark, l.n), 0);
}

/**
 * Apply one action at time `t` against `script`. PURE — returns a new state,
 * never mutates the input. Cash is accumulated in integer pence. Actions match
 * the reference prototype:
 *   closeAll, closeTwo, addTwo, addThree, reopen, reopenBig, hold, none.
 * A rich sell/close (addTwo etc.) opens at the current scripted mark.
 */
function applyAction(state, action, t, script) {
  const s = { lots: simCloneLots(state.lots), cash: state.cash, breaks: state.breaks.slice(), log: state.log.slice() };
  const mark = script[t];

  if (action === 'closeAll') {
    s.cash += unrealised(s, script, t);
    s.lots = [];
  } else if (action === 'closeTwo') {
    const l = s.lots[0];
    if (l) {
      s.cash += legPence(l.credit, mark, 2);
      l.n -= 2;
      if (l.n <= 0) s.lots.shift();
    }
  } else if (action === 'addTwo') {
    s.lots.push({ n: 2, credit: mark });
  } else if (action === 'addThree') {
    s.lots.push({ n: 3, credit: mark });
  } else if (action === 'reopen') {
    s.lots.push({ n: 3, credit: mark });
  } else if (action === 'reopenBig') {
    s.lots.push({ n: 6, credit: mark });
  }
  // 'hold' and 'none' change nothing.
  return s;
}

/**
 * Replay a decision log against any script and return the final realised P&L in
 * INTEGER PENCE. This is the counterfactual: run the identical log against
 * SCRIPT_A (what happened) and SCRIPT_B (the other Wednesday). PURE — the log is
 * not consumed, and equal logs on different scripts return equal integers.
 *
 * @param {object} scenario  needs scripts and settle_t
 * @param {object[]} log     [{ act, t }]
 * @param {object} script    mark table, e.g. scenario.scripts.A
 */
function replay(scenario, log, script) {
  let s = freshState(scenario);
  for (const e of log) s = applyAction(s, e.act, e.t, script);
  s.cash += unrealised(s, script, scenario.settle_t);
  return s.cash;
}

/** Total decision points across the log (each decision is scored out of 10). */
function decisionScore(log) {
  return (log || []).reduce((a, e) => a + (Number.isFinite(e.points) ? e.points : (e.pts || 0)), 0);
}

/**
 * Score a completed run. Computes the decision score, the maximum, and P&L (in
 * integer pence) on every script in the scenario, then flags the two teaching
 * cases:
 *   lucky  — low decision score but a positive outcome on the script that
 *            happened ("rescued, not right").
 *   robbed — high decision score but a worse outcome than an alternate script
 *            ("good decisions, worse outcome").
 * P&L is pence; call toPounds() at the presentation boundary. Confidence/pace
 * are computed separately by calibration.js.
 */
function scoreRun(scenario, log, opts = {}) {
  const primary = opts.primaryScript || 'A';
  const nDecisions = (scenario.nodes && scenario.nodes.length) || log.length;
  const maxScore = nDecisions * 10;
  const score = decisionScore(log);

  const pnl = {};
  for (const key of Object.keys(scenario.scripts)) pnl[key] = replay(scenario, log, scenario.scripts[key]);

  const altBest = Math.max(...Object.keys(pnl).filter(k => k !== primary).map(k => pnl[k]), -Infinity);
  const lucky = score <= maxScore * 0.5 && pnl[primary] > 0;
  const robbed = score >= maxScore * 0.7 && Number.isFinite(altBest) && pnl[primary] < altBest;

  return { decisionScore: score, maxScore, pnl, primaryScript: primary, lucky, robbed };
}

  var TIQEngine = {
    CATEGORY_WEIGHTS, CATEGORY_KEYS, ANCHOR, ANCHOR_TQ_CAP, scoreWeightedChoice, scoreMultiSelect, kendallTau, scoreRanking, scoreItem, rollupCategories, composite, anchorTQ, empiricalTQ, computeTQ, applyRuinGate, traitProfile, frontDoorScore, scoreSitting, buildNormTable, percentileOf, percentileBand, resolveCohort, buildLadder, rankOf, describeStanding, criterionBand, displayPrecision, sem, wilson, DISPLAY_TIERS, RANK_MIN_N, COHORT_MIN_N, normalizeConfidence, calibrationGap, brierScore, impulsivityIndex, consistencyIndex, CONTRACT_MULTIPLIER, toPence, toPounds, legPence, freshState, unrealised, applyAction, replay, decisionScore, scoreRun,
    scoring: { CATEGORY_WEIGHTS, CATEGORY_KEYS, ANCHOR, ANCHOR_TQ_CAP, scoreWeightedChoice, scoreMultiSelect, kendallTau, scoreRanking, scoreItem, rollupCategories, composite, anchorTQ, empiricalTQ, computeTQ, applyRuinGate, traitProfile, frontDoorScore, scoreSitting },
    norms: { buildNormTable, percentileOf, percentileBand, resolveCohort, buildLadder, rankOf, describeStanding, criterionBand, displayPrecision, sem, wilson, DISPLAY_TIERS, RANK_MIN_N, COHORT_MIN_N },
    calibration: { normalizeConfidence, calibrationGap, brierScore, impulsivityIndex, consistencyIndex },
    sim: { CONTRACT_MULTIPLIER, toPence, toPounds, legPence, freshState, unrealised, applyAction, replay, decisionScore, scoreRun }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = TIQEngine;
  else root.TIQEngine = TIQEngine;
})(typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : this));
