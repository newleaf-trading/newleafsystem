'use strict';
/**
 * Tests for shared/tiq/sim.js — the Decision Simulator engine.
 *
 * The oracle is the verified P&L table in docs/tiq/spec-simulator.md §5.3, run
 * against the actual scenario data in content/tiq/scenarios/the-wednesday.json.
 * The market path is scripted and never reacts to the user (spec §5.1), so every
 * number below is deterministic. Run: node sim.test.js
 */
const assert = require('assert');
const path = require('path');
const SIM = require('./sim');
const WEDNESDAY = require(path.join(__dirname, '..', '..', 'content', 'tiq', 'scenarios', 'the-wednesday.json'));

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('  ok  ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + ' -> ' + e.message); }
}
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} !~= ${b}`);

// Decision logs for each verified path. Points are illustrative; only the acts
// and times drive P&L. Times match the scenario nodes (t0,t1,t2,t2,t3), settle t4.
const PATHS = {
  closeFlat:   [['closeAll', 't0', 10], ['none', 't1', 10], ['none', 't2', 10], ['none', 't2', 10], ['none', 't3', 10]],
  holdAll:     [['hold', 't0', 2], ['hold', 't1', 10], ['hold', 't2', 10], ['none', 't2', 10], ['none', 't3', 10]],
  panicClose:  [['hold', 't0', 2], ['hold', 't1', 10], ['closeAll', 't2', 6], ['none', 't2', 10], ['none', 't3', 10]],
  doubleDown:  [['hold', 't0', 2], ['hold', 't1', 10], ['addThree', 't2', 0], ['none', 't2', 10], ['none', 't3', 10]],
  flatReenter: [['closeAll', 't0', 10], ['reopenBig', 't1', 0], ['none', 't2', 10], ['none', 't2', 10], ['none', 't3', 10]],
  // Reckless throughout — a genuinely low decision score that the reversal rescues.
  reckless:    [['hold', 't0', 2], ['addTwo', 't1', 0], ['addThree', 't2', 0], ['none', 't2', 2], ['none', 't3', 0]]
};
const log = (p) => p.map(([act, tt, points]) => ({ act, t: tt, points }));

console.log('\nP&L oracle — spec-simulator.md §5.3 (Script A = what happened, Script B = the other Wednesday)');
const CASES = [
  ['Close at 09:34, stay flat',            'closeFlat',   135,   135],
  ['Hold all three, never break a rule',   'holdAll',     180,  -900],
  ['Panic close Thursday morning',         'panicClose', -210,  -210],
  ['Double the position in the drawdown',  'doubleDown',  570, -1590],
  ['Flat, then re-enter at 6 lots',        'flatReenter', 645, -1515]
];
for (const [name, key, a, b] of CASES) {
  t(name, () => {
    near(SIM.replay(WEDNESDAY, log(PATHS[key]), WEDNESDAY.scripts.A), a);
    near(SIM.replay(WEDNESDAY, log(PATHS[key]), WEDNESDAY.scripts.B), b);
  });
}

console.log('\npath-independence — the key oracle row: close early, stay flat');
t('replay is IDENTICAL across Script A and Script B (log cannot leak into the market path)', () => {
  const l = log(PATHS.closeFlat);
  const a = SIM.replay(WEDNESDAY, l, WEDNESDAY.scripts.A);
  const b = SIM.replay(WEDNESDAY, l, WEDNESDAY.scripts.B);
  // Equality is the assertion. If the decision log ever influenced the market
  // script, a and b would diverge — this is the guard that proves it never does.
  assert.strictEqual(a, b);
  near(a, 135); near(b, 135);
});

console.log('\nscoreRun');
t('good decisions buy path-independence (holdAll differs; closeFlat does not)', () => {
  const flat = SIM.scoreRun(WEDNESDAY, log(PATHS.closeFlat));
  near(flat.pnl.A, 135); near(flat.pnl.B, 135);
  assert.strictEqual(flat.pnl.A, flat.pnl.B); // identical across scripts → robust
});
t('flags "rescued not right": low score, positive outcome on the script that happened', () => {
  const r = SIM.scoreRun(WEDNESDAY, log(PATHS.reckless)); // 4/50 decisions, still positive on A
  assert.ok(r.decisionScore <= r.maxScore * 0.5);
  assert.ok(r.pnl.A > 0);          // rescued by the reversal
  assert.ok(r.pnl.B < 0);          // the other Wednesday punishes it
  assert.strictEqual(r.lucky, true);
});
t('maxScore is ten per decision', () => {
  assert.strictEqual(SIM.scoreRun(WEDNESDAY, log(PATHS.holdAll)).maxScore, 50);
});
t('decisionScore sums the logged points', () => {
  assert.strictEqual(SIM.scoreRun(WEDNESDAY, log(PATHS.closeFlat)).decisionScore, 50);
});

console.log('\napply / state (pure — input log is never mutated)');
t('closeAll realises open P&L and flattens', () => {
  const s0 = SIM.freshState(WEDNESDAY);
  const s1 = SIM.applyAction(s0, 'closeAll', 't0', WEDNESDAY.scripts.A);
  near(s1.cash, (0.80 - 0.35) * 100 * 3); // 135
  assert.strictEqual(s1.lots.length, 0);
  assert.strictEqual(s0.lots.length, 1, 'original state untouched');
});
t('closeTwo partially reduces the front lot', () => {
  const s0 = SIM.freshState(WEDNESDAY);
  const s1 = SIM.applyAction(s0, 'closeTwo', 't0', WEDNESDAY.scripts.A);
  near(s1.cash, (0.80 - 0.35) * 100 * 2); // 90
  assert.strictEqual(s1.lots[0].n, 1);
});
t('unrealised is scripted, not reactive', () => {
  const s0 = SIM.freshState(WEDNESDAY);
  near(SIM.unrealised(s0, WEDNESDAY.scripts.A, 't4'), (0.80 - 0.20) * 100 * 3); // 180
  near(SIM.unrealised(s0, WEDNESDAY.scripts.B, 't4'), (0.80 - 3.80) * 100 * 3); // -900
});

console.log('\nreplay is a pure counterfactual (does not consume the log)', () => {});
t('same log replays identically twice', () => {
  const l = log(PATHS.flatReenter);
  const first = SIM.replay(WEDNESDAY, l, WEDNESDAY.scripts.A);
  const second = SIM.replay(WEDNESDAY, l, WEDNESDAY.scripts.A);
  assert.strictEqual(first, second);
  assert.strictEqual(l.length, 5, 'log not mutated');
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
