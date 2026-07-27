'use strict';

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

module.exports = {
  CATEGORY_WEIGHTS,
  CATEGORY_KEYS,
  ANCHOR,
  ANCHOR_TQ_CAP,
  scoreWeightedChoice,
  scoreMultiSelect,
  kendallTau,
  scoreRanking,
  scoreItem,
  rollupCategories,
  composite,
  anchorTQ,
  empiricalTQ,
  computeTQ,
  applyRuinGate,
  traitProfile,
  frontDoorScore,
  scoreSitting
};
