'use strict';
/** Tests for shared/tiq/reliability.js — Cronbach's alpha + item-total correlation.
 *  Run: node reliability.test.js */
const assert = require('assert');
const R = require('./reliability');

let pass = 0, fail = 0;
function t(name, fn) { try { fn(); pass++; console.log('  ok  ' + name); } catch (e) { fail++; console.log('  FAIL ' + name + ' -> ' + e.message); } }

console.log('\ncronbach alpha');
t('consistent items give high alpha in (0,1]', () => {
  const m = [[10, 8, 9], [2, 3, 1], [7, 6, 8], [5, 4, 6], [9, 10, 9]];
  const a = R.cronbachAlpha(m);
  assert.ok(a > 0.7 && a <= 1, 'alpha ' + a);
});
t('null when too few respondents or items', () => {
  assert.strictEqual(R.cronbachAlpha([[1, 2, 3]]), null);   // n<2
  assert.strictEqual(R.cronbachAlpha([[1], [2], [3]]), null); // k<2
});
t('null when total variance is zero', () => {
  assert.strictEqual(R.cronbachAlpha([[5, 5], [5, 5], [5, 5]]), null);
});

console.log('\nitem-total correlation');
t('coherent items all correlate positively with the rest', () => {
  const m = [[10, 8, 9], [2, 3, 1], [7, 6, 8], [5, 4, 6], [9, 10, 9]];
  const c = R.itemTotalCorrelations(m);
  assert.strictEqual(c.length, 3);
  assert.ok(c.every(x => x > 0), JSON.stringify(c));
});
t('an anti-correlated item scores lower than a coherent one', () => {
  const m = [[10, 9, 1], [2, 1, 9], [8, 7, 2], [3, 2, 8], [9, 10, 1]]; // item 2 moves opposite
  const c = R.itemTotalCorrelations(m);
  assert.ok(c[2] < c[0], JSON.stringify(c));
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
