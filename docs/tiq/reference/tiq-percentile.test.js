'use strict';
const assert = require('assert');
const N = require('./tiq-percentile');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('  ok  ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + ' -> ' + e.message); }
}

// deterministic pseudo-normal sample
function sample(n, mean = 100, sd = 15, seed = 42) {
  let s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
  const out = [];
  for (let i = 0; i < n; i++) {
    let u = 0;
    for (let k = 0; k < 12; k++) u += rnd();
    out.push(mean + sd * (u - 6));
  }
  return out;
}

console.log('\nnorm table');
t('counts and moments', () => {
  const nt = N.buildNormTable([90, 100, 100, 110, 120]);
  assert.strictEqual(nt.n, 5);
  assert.strictEqual(nt.mean, 104);
  assert.ok(nt.sd > 0);
});
t('table is sorted ascending with cumulative below', () => {
  const nt = N.buildNormTable([120, 90, 100, 100, 110]);
  assert.deepStrictEqual(nt.table.map(r => r.score), [90, 100, 110, 120]);
  assert.deepStrictEqual(nt.table.map(r => r.below), [0, 1, 3, 4]);
  assert.strictEqual(nt.table[1].equal, 2);
});
t('ignores non-finite scores', () => {
  const nt = N.buildNormTable([100, NaN, null, undefined, 110]);
  assert.strictEqual(nt.n, 2);
});

console.log('\nmid-rank percentile');
t('median of a symmetric sample sits near 50', () => {
  const nt = N.buildNormTable(sample(4000));
  const p = N.percentileOf(nt.mean, nt);
  assert.ok(Math.abs(p.percentile - 50) < 3, 'got ' + p.percentile);
});
t('ties split evenly', () => {
  const nt = N.buildNormTable(new Array(40).fill(100));
  // 0 below, 40 equal -> (0 + 20)/40 = 50
  assert.strictEqual(N.percentileOf(100, nt).percentile, 50);
});
t('half the cohort tied below puts you above them', () => {
  const nt = N.buildNormTable([...new Array(20).fill(90), ...new Array(20).fill(110)]);
  assert.strictEqual(N.percentileOf(110, nt).percentile, 75);
});
t('minimum score is not 0th and maximum is not 100th', () => {
  const scores = sample(1000);
  const nt = N.buildNormTable(scores);
  const lo = N.percentileOf(Math.min(...scores), nt);
  const hi = N.percentileOf(Math.max(...scores), nt);
  assert.ok(lo.percentile > 0, 'floor');
  assert.ok(hi.percentile < 100, 'ceiling');
});
t('monotonic in score', () => {
  const nt = N.buildNormTable(sample(2000));
  let prev = -1;
  for (let s = 60; s <= 140; s += 2) {
    const p = N.percentileOf(s, nt).percentile;
    assert.ok(p >= prev, 'non-monotonic at ' + s);
    prev = p;
  }
});
t('suppressed below cohort minimum', () => {
  const nt = N.buildNormTable([100, 105, 110]);
  const p = N.percentileOf(105, nt);
  assert.strictEqual(p.percentile, null);
  assert.strictEqual(p.reason, 'cohort_too_small');
});

console.log('\nWilson interval width vs n');
t('interval narrows as n grows', () => {
  const small = N.buildNormTable(sample(50, 100, 15, 7));
  const big = N.buildNormTable(sample(5000, 100, 15, 7));
  const ws = N.percentileOf(100, small);
  const wb = N.percentileOf(100, big);
  assert.ok((ws.high - ws.low) > (wb.high - wb.low) * 3,
    `small=${(ws.high - ws.low).toFixed(1)} big=${(wb.high - wb.low).toFixed(1)}`);
});
t('interval stays inside 0..100 at the tails', () => {
  const nt = N.buildNormTable(sample(200));
  const p = N.percentileOf(160, nt);
  assert.ok(p.low >= 0 && p.high <= 100);
});

console.log('\nmeasurement error');
t('sem matches sd*sqrt(1-r)', () => {
  assert.ok(Math.abs(N.sem(15, 0.82) - 15 * Math.sqrt(0.18)) < 1e-9);
});
t('40-item alpha 0.82 gives roughly 6.4 TQ points', () => {
  const s = N.sem(15, 0.82);
  assert.ok(s > 6.0 && s < 6.8, 'got ' + s);
});
t('percentile band is wider than the point estimate', () => {
  const nt = N.buildNormTable(sample(5000));
  const b = N.percentileBand(112, nt, 0.82);
  assert.ok(b.high - b.low > 10, 'band ' + (b.high - b.low));
  assert.ok(b.low < b.percentile && b.percentile < b.high);
});

console.log('\ncohort ladder');
t('experience band precedes country', () => {
  const l = N.buildLadder({ countryCode: 'GB', continent: 'EU', experienceBand: '1_3y' });
  assert.strictEqual(l[0], 'exp:1_3y|country:GB');
  assert.ok(l.indexOf('exp:1_3y') < l.indexOf('country:GB'));
  assert.strictEqual(l[l.length - 1], 'global');
});
t('falls back past thin cohorts', () => {
  const tables = new Map([
    ['country:MT', N.buildNormTable(sample(4))],
    ['subregion:southern_europe', N.buildNormTable(sample(12))],
    ['continent:EU', N.buildNormTable(sample(900))],
    ['global', N.buildNormTable(sample(5000))]
  ]);
  const r = N.resolveCohort(['country:MT', 'subregion:southern_europe', 'continent:EU', 'global'], tables);
  assert.strictEqual(r.cohortId, 'continent:EU');
  assert.strictEqual(r.fellBack, true);
});
t('no fallback flag when the first cohort is usable', () => {
  const tables = new Map([['country:GB', N.buildNormTable(sample(800))]]);
  const r = N.resolveCohort(['country:GB', 'global'], tables);
  assert.strictEqual(r.fellBack, false);
});

console.log('\nrank');
t('top score ranks 1', () => {
  const scores = sample(800);
  const nt = N.buildNormTable(scores);
  assert.strictEqual(N.rankOf(Math.max(...scores) + 1, nt).rank, 1);
});
t('ties share the better rank', () => {
  const scores = [...sample(600), 130, 130, 130];
  const nt = N.buildNormTable(scores);
  const above = scores.filter(s => Math.round(s) > 130).length;
  assert.strictEqual(N.rankOf(130, nt).rank, above + 1);
});
t('rank suppressed under 500', () => {
  const nt = N.buildNormTable(sample(300));
  const r = N.rankOf(110, nt);
  assert.strictEqual(r.rank, null);
  assert.strictEqual(r.suppressed, true);
});

console.log('\ndisplay precision ladder');
t('tiers', () => {
  assert.strictEqual(N.displayPrecision(5000), 'percentile');
  assert.strictEqual(N.displayPrecision(1000), 'percentile');
  assert.strictEqual(N.displayPrecision(400), 'decile');
  assert.strictEqual(N.displayPrecision(50), 'quartile');
  assert.strictEqual(N.displayPrecision(10), 'none');
});

console.log('\ndescribeStanding');
t('degrades to criterion band when nothing qualifies', () => {
  const tables = new Map([['global', N.buildNormTable(sample(8))]]);
  const out = N.describeStanding(118, tables, { countryCode: 'GB' });
  assert.strictEqual(out.mode, 'criterion_only');
  assert.strictEqual(out.percentile, null);
  assert.strictEqual(out.band, 'Strong');
});
t('normed output carries cohort, band and rank', () => {
  const tables = new Map([['country:GB', N.buildNormTable(sample(3000))]]);
  const out = N.describeStanding(118, tables, { countryCode: 'GB' });
  assert.strictEqual(out.mode, 'normed');
  assert.strictEqual(out.precision, 'percentile');
  assert.ok(out.display.endsWith('percentile'));
  assert.ok(out.rank > 0 && out.rank <= out.rankOf);
  assert.ok(out.percentileLow < out.percentileHigh);
});
t('mid-size cohort shows a decile and suppresses rank', () => {
  const tables = new Map([['country:GB', N.buildNormTable(sample(400))]]);
  const out = N.describeStanding(112, tables, { countryCode: 'GB' });
  assert.strictEqual(out.precision, 'decile');
  assert.ok(out.display.includes('decile'));
  assert.strictEqual(out.rank, null);
});
t('criterion bands', () => {
  assert.strictEqual(N.criterionBand(135), 'Exceptional');
  assert.strictEqual(N.criterionBand(115), 'Strong');
  assert.strictEqual(N.criterionBand(101), 'Competent');
  assert.strictEqual(N.criterionBand(90), 'Developing');
  assert.strictEqual(N.criterionBand(70), 'Foundational');
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
