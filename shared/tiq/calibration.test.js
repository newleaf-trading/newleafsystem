'use strict';
/**
 * Tests for shared/tiq/calibration.js — confidence gap (Brier), impulsivity /
 * pace index, framing-pair consistency index. Run: node calibration.test.js
 */
const assert = require('assert');
const C = require('./calibration');

let pass = 0, fail = 0;
function t(name, fn) {
  try { fn(); pass++; console.log('  ok  ' + name); }
  catch (e) { fail++; console.log('  FAIL ' + name + ' -> ' + e.message); }
}
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} !~= ${b}`);

console.log('\nconfidence normalisation');
t('1..5 slider maps onto 0..1', () => {
  near(C.normalizeConfidence(1), 0);
  near(C.normalizeConfidence(3), 0.5);
  near(C.normalizeConfidence(5), 1);
});

console.log('\ncalibration gap (spec-simulator §2 thresholds)');
t('sure on the worst decisions reads Overconfident', () => {
  const entries = [
    { confidence: 1.0, quality: 0.2 },
    { confidence: 0.7, quality: 0.3 },
    { confidence: 1.0, quality: 0.4 }
  ];
  const r = C.calibrationGap(entries);
  assert.ok(r.gap > 0.22);
  assert.strictEqual(r.label, 'Overconfident');
});
t('second-guessing good decisions reads Underconfident', () => {
  const r = C.calibrationGap([{ confidence: 0.15, quality: 1.0 }, { confidence: 0.4, quality: 0.9 }]);
  assert.ok(r.gap < -0.22);
  assert.strictEqual(r.label, 'Underconfident');
});
t('confidence tracking quality reads Well calibrated', () => {
  const r = C.calibrationGap([{ confidence: 0.7, quality: 0.7 }, { confidence: 0.4, quality: 0.5 }]);
  assert.strictEqual(r.label, 'Well calibrated');
});
t('empty input is well calibrated with zero gap', () => {
  const r = C.calibrationGap([]);
  near(r.gap, 0); assert.strictEqual(r.label, 'Well calibrated');
});

console.log('\nBrier score');
t('perfect calibration scores 0, worst scores 1', () => {
  near(C.brierScore([{ confidence: 1, correct: 1 }, { confidence: 0, correct: 0 }]), 0);
  near(C.brierScore([{ confidence: 1, correct: 0 }, { confidence: 0, correct: 1 }]), 1);
});

console.log('\nimpulsivity / pace');
t('answering far under estimated time flags below the response floor', () => {
  const entries = [
    { responseSeconds: 12, estSeconds: 60 },
    { responseSeconds: 15, estSeconds: 75 },
    { responseSeconds: 10, estSeconds: 50 }
  ];
  const r = C.impulsivityIndex(entries);
  near(r.medianRatio, 0.2, 1e-9);
  assert.strictEqual(r.belowFloor, true);
  assert.strictEqual(r.pace, 'Fast');
});
t('deliberate pace when well over estimate', () => {
  const r = C.impulsivityIndex([
    { responseSeconds: 120, estSeconds: 60 },
    { responseSeconds: 150, estSeconds: 75 }
  ]);
  assert.strictEqual(r.pace, 'Deliberate');
  assert.strictEqual(r.belowFloor, false);
});
t('index is a trimmed mean z and is finite even when all ratios are equal', () => {
  const r = C.impulsivityIndex([
    { responseSeconds: 30, estSeconds: 60 },
    { responseSeconds: 30, estSeconds: 60 },
    { responseSeconds: 30, estSeconds: 60 }
  ]);
  assert.ok(Number.isFinite(r.index));
  near(r.index, 0); // zero variance → z of 0
});

console.log('\nconsistency index (framing pairs, spec-core §1.2)');
t('perfect symmetry scores 100', () => {
  assert.strictEqual(C.consistencyIndex([{ gainScore: 1, lossScore: 1 }, { gainScore: 0.5, lossScore: 0.5 }]).index, 100);
});
t('total asymmetry scores 0', () => {
  assert.strictEqual(C.consistencyIndex([{ gainScore: 1, lossScore: 0 }]).index, 0);
});
t('partial gap scales linearly', () => {
  assert.strictEqual(C.consistencyIndex([{ gainScore: 0.8, lossScore: 0.6 }]).index, 80);
});
t('no pairs returns null index, not a fabricated 100', () => {
  const r = C.consistencyIndex([]);
  assert.strictEqual(r.index, null);
  assert.strictEqual(r.nPairs, 0);
});

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
