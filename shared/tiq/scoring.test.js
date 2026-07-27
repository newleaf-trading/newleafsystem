'use strict';
/**
 * Tests for shared/tiq/scoring.js — item scoring (3 live modes + diagnostic),
 * category rollup, composite, anchor/empirical TQ, ruin gate, trait profile.
 *
 * Plain node:assert harness, same shape as shared/plan/index.test.js and the
 * reference docs/tiq/reference/tiq-percentile.test.js. Run: node scoring.test.js
 */
const assert = require('assert');
const S = require('./scoring');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('  ok  ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + ' -> ' + e.message); }
}
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} !~= ${b}`);

// ── fixtures modelled on content/tiq/bank-v1.json ──────────────────────────
const WEIGHTED = {
  id: 'KQ-A-BEG-0001', category: 'KQ', difficulty: 'beginner',
  scoring: { mode: 'weighted_choice', max_points: 10, choice_points: { A: 10, B: 3, C: 4, D: 0 }, ruin_flag_choices: ['D'] }
};
const MULTI = {
  id: 'KQ-D-ADV-0006', category: 'KQ', difficulty: 'advanced',
  scoring: { mode: 'multi_select', max_points: 10, correct_keys: ['A', 'B', 'C', 'D'], per_correct: 2.5, per_incorrect: -2.5, floor: 0 }
};
const RANKING = {
  id: 'SQ-C-INT-0020', category: 'SQ', difficulty: 'intermediate',
  scoring: { mode: 'ranking', max_points: 10, correct_order: ['A', 'B', 'C', 'D', 'E', 'F'], method: 'kendall_tau_scaled', partial_credit: true }
};
const DIAGNOSTIC = {
  id: 'EQ-Z-INT-9999', category: 'EQ', difficulty: 'intermediate',
  scoring: { mode: 'diagnostic_only', max_points: 0, trait_loadings: { A: { discipline: 2 }, B: { loss_aversion: 3 } } }
};

console.log('\nweighted_choice');
t('direct point lookup', () => {
  assert.strictEqual(S.scoreWeightedChoice(WEIGHTED.scoring, 'A'), 10);
  assert.strictEqual(S.scoreWeightedChoice(WEIGHTED.scoring, 'B'), 3);
  assert.strictEqual(S.scoreWeightedChoice(WEIGHTED.scoring, 'D'), 0);
});
t('unknown or missing key scores 0', () => {
  assert.strictEqual(S.scoreWeightedChoice(WEIGHTED.scoring, 'Z'), 0);
  assert.strictEqual(S.scoreWeightedChoice(WEIGHTED.scoring, undefined), 0);
});
t('scoreItem flags a ruin choice and not a safe one', () => {
  assert.strictEqual(S.scoreItem(WEIGHTED, { choice: 'D' }).ruinFlag, true);
  assert.strictEqual(S.scoreItem(WEIGHTED, { choice: 'A' }).ruinFlag, false);
});

console.log('\nmulti_select');
t('all correct hits max', () => near(S.scoreMultiSelect(MULTI.scoring, ['A', 'B', 'C', 'D']), 10));
t('one wrong subtracts', () => near(S.scoreMultiSelect(MULTI.scoring, ['A', 'B', 'C', 'D', 'E']), 7.5));
t('clamps at floor, never negative', () => {
  near(S.scoreMultiSelect(MULTI.scoring, ['E']), 0);
  near(S.scoreMultiSelect(MULTI.scoring, ['A', 'E']), 0);
});
t('empty selection scores floor', () => near(S.scoreMultiSelect(MULTI.scoring, []), 0));

console.log('\nranking — kendall tau');
t('correct order scores full marks', () => near(S.scoreRanking(RANKING.scoring, ['A', 'B', 'C', 'D', 'E', 'F']), 10));
t('reversed order scores zero', () => near(S.scoreRanking(RANKING.scoring, ['F', 'E', 'D', 'C', 'B', 'A']), 0));
t('one adjacent swap loses a little', () => {
  // tau = (14-1)/15 = 0.8667 ; base = 10*(1+tau)/2 = 9.333
  near(S.scoreRanking(RANKING.scoring, ['B', 'A', 'C', 'D', 'E', 'F']), 10 * (1 + 13 / 15) / 2, 1e-6);
});
t('kendallTau extremes', () => {
  near(S.kendallTau(['A', 'B', 'C'], ['A', 'B', 'C']), 1);
  near(S.kendallTau(['C', 'B', 'A'], ['A', 'B', 'C']), -1);
});
t('critical constraint penalty subtracts and never goes below 0', () => {
  const sc = { mode: 'ranking', max_points: 10, correct_order: ['A', 'B', 'C'],
    critical_constraints: [{ before: 'A', after: 'B', penalty: 4 }] };
  // perfect order, but constraint says A before B — satisfied → no penalty
  near(S.scoreRanking(sc, ['A', 'B', 'C']), 10);
  // A after B violates the constraint → 10 base? tau for [B,A,C] = (2-1)/3=0.333 base=6.667 -4 = 2.667
  near(S.scoreRanking(sc, ['B', 'A', 'C']), Math.max(0, 10 * (1 + 1 / 3) / 2 - 4), 1e-6);
});

console.log('\ndiagnostic_only');
t('scores zero and contributes zero to max', () => {
  const r = S.scoreItem(DIAGNOSTIC, { choice: 'B' });
  assert.strictEqual(r.earned, 0);
  assert.strictEqual(r.max, 0);
});

console.log('\ncategory rollup');
const ITEMS = [WEIGHTED, MULTI, RANKING];
t('rollup computes 100*raw/max per category and counts ruin flags', () => {
  const responses = {
    'KQ-A-BEG-0001': { choice: 'D' },              // 0/10, ruin flag
    'KQ-D-ADV-0006': { selected: ['A', 'B', 'C', 'D'] }, // 10/10
    'SQ-C-INT-0020': { order: ['A', 'B', 'C', 'D', 'E', 'F'] } // 10/10
  };
  const out = S.rollupCategories(ITEMS, responses);
  near(out.categories.KQ.raw, 10);
  near(out.categories.KQ.max, 20);
  near(out.categories.KQ.score, 50);
  near(out.categories.SQ.score, 100);
  assert.strictEqual(out.ruinFlagCount, 1);
});

console.log('\ncomposite + TQ');
t('composite is the spec-weighted blend', () => {
  const c = S.composite({ KQ: 80, EQ: 70, SQ: 60, RQ: 90, MQ: 50 });
  near(c, 0.18 * 80 + 0.24 * 70 + 0.20 * 60 + 0.28 * 90 + 0.10 * 50); // 73.4
});
t('category weights sum to 1', () => {
  const w = S.CATEGORY_WEIGHTS;
  near(w.KQ + w.EQ + w.SQ + w.RQ + w.MQ, 1);
});
t('anchor TQ is monotonic, lands in the spec bands, and is capped at 130', () => {
  const mid = S.anchorTQ(73.4);
  assert.ok(mid >= 100 && mid <= 114);        // 68–79 → 100–114
  assert.ok(S.anchorTQ(50) < 85);             // <55 → <85
  let prev = -Infinity;
  for (let c = 0; c <= 100; c += 5) {
    const tq = S.anchorTQ(c);
    assert.ok(tq >= prev, 'non-monotonic at ' + c);
    assert.ok(tq <= 130, 'anchor TQ exceeded the 130 cap at ' + c + ' -> ' + tq);
    prev = tq;
  }
  assert.strictEqual(S.anchorTQ(100), 130);   // top of the table is flat at the cap
  assert.strictEqual(S.anchorTQ(95), 130);    // no >130 claim without a cohort
});
t('computeTQ uses anchor when cohort is thin, empirical at n>=500', () => {
  assert.strictEqual(S.computeTQ(73.4).method, 'anchor');
  assert.strictEqual(S.computeTQ(73.4, { n: 100, mean: 70, sd: 10 }).method, 'anchor');
  const emp = S.computeTQ(85, { n: 800, mean: 70, sd: 10 });
  assert.strictEqual(emp.method, 'empirical');
  near(emp.tq, 100 + 15 * (85 - 70) / 10, 0.05); // 122.5
});

console.log('\nruin gate');
t('low RQ caps TQ at 95 with a banner', () => {
  const g = S.applyRuinGate(122, { RQ: 40, ruinFlagCount: 0 });
  assert.strictEqual(g.tq, 95); assert.strictEqual(g.gated, true);
  assert.ok(/capital preservation/i.test(g.banner));
});
t('two ruin flags cap TQ at 95', () => {
  assert.strictEqual(S.applyRuinGate(130, { RQ: 70, ruinFlagCount: 2 }).tq, 95);
});
t('clean sitting is not gated', () => {
  const g = S.applyRuinGate(122, { RQ: 70, ruinFlagCount: 1 });
  assert.strictEqual(g.tq, 122); assert.strictEqual(g.gated, false); assert.strictEqual(g.banner, null);
});
t('gate never raises a score below the cap', () => {
  assert.strictEqual(S.applyRuinGate(80, { RQ: 10, ruinFlagCount: 5 }).tq, 80);
});

console.log('\ntrait profile');
t('z-scores traits and surfaces the elevated one', () => {
  const items = [WEIGHTED, DIAGNOSTIC, {
    id: 'EQ-F-INT-0010', category: 'EQ',
    scoring: { mode: 'weighted_choice', max_points: 10, choice_points: { A: 10, B: 6 }, trait_loadings: { B: { loss_aversion: 2 } } }
  }];
  const responses = { 'KQ-A-BEG-0001': { choice: 'A' }, 'EQ-Z-INT-9999': { choice: 'B' }, 'EQ-F-INT-0010': { choice: 'B' } };
  const vocab = ['discipline', 'loss_aversion', 'fear', 'greed'];
  const prof = S.traitProfile(items, responses, vocab);
  // loss_aversion loaded 3 (diagnostic B) + 2 = 5, everything else 0 → highest z
  assert.strictEqual(prof.top[0].trait, 'loss_aversion');
  assert.ok(prof.top[0].z > 0);
});

console.log('\nfront-door score');
t('honest, no floor (post-v1.3 concession)', () => {
  assert.strictEqual(S.frontDoorScore(67, 100), 67);
  assert.strictEqual(S.frontDoorScore(0, 40), 0);
  assert.strictEqual(S.frontDoorScore(30, 40), 75);
});

console.log('\nscoreSitting orchestration');
t('returns categories, composite, gated TQ and traits together', () => {
  const bank = { trait_vocabulary: ['discipline', 'loss_aversion'], questions: ITEMS };
  const responses = {
    'KQ-A-BEG-0001': { choice: 'D' }, 'KQ-D-ADV-0006': { selected: ['A', 'B', 'C', 'D'] },
    'SQ-C-INT-0020': { order: ['A', 'B', 'C', 'D', 'E', 'F'] }
  };
  const out = S.scoreSitting(bank, responses);
  assert.ok('composite' in out && 'tq' in out && 'categoryScores' in out);
  assert.strictEqual(out.ruinFlagCount, 1);
  assert.strictEqual(out.tqMethod, 'anchor');
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
