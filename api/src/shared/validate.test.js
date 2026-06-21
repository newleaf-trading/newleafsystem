import { validateStrategy, classifyLegs } from './validate.js';

let passed = 0, failed = 0;
function ok(cond, msg) { if (cond) passed++; else { failed++; console.error('FAIL: ' + msg); } }
const L = (action, type, strike, qty = 1) => ({ action, type, strike, qty });

// --- valid structures ---
ok(validateStrategy('iron_condor', [
  L('SELL','PUT',127), L('BUY','PUT',124), L('SELL','CALL',136), L('BUY','CALL',139)
]).valid, 'qwen-max iron_condor is valid');

ok(validateStrategy('broken_wing_butterfly', [
  L('BUY','CALL',130), L('SELL','CALL',135,2), L('BUY','CALL',142)
]).valid, 'canonical call BWB (1-2-1, unequal wings) is valid');

ok(validateStrategy('iron_butterfly', [
  L('SELL','PUT',132), L('SELL','CALL',132), L('BUY','PUT',127), L('BUY','CALL',137)
]).valid, 'iron_butterfly with shared body is valid');

ok(validateStrategy('bull_put_spread', [L('SELL','PUT',125), L('BUY','PUT',120)]).valid, 'bull put spread valid');
ok(validateStrategy('long_straddle', [L('BUY','CALL',132), L('BUY','PUT',132)]).valid, 'straddle valid');
ok(validateStrategy('long_strangle', [L('BUY','CALL',135), L('BUY','PUT',130)]).valid, 'strangle valid');

// --- the eval's failures ---
const qwenPlus = validateStrategy('broken_wing_butterfly', [
  L('SELL','PUT',125), L('BUY','PUT',119), L('SELL','CALL',133), L('BUY','CALL',140)
]);
ok(!qwenPlus.valid, 'qwen-plus condor-as-BWB is rejected');
ok(qwenPlus.actual === 'iron_condor', 'qwen-plus legs classified as iron_condor');

const sonnet = validateStrategy('broken_wing_butterfly', [
  L('BUY','CALL',128), L('SELL','CALL',131), L('BUY','CALL',135)
]);
ok(!sonnet.valid, 'sonnet 1-short/2-long is rejected');
ok(sonnet.errors.some(e => e.includes('unbalanced')), 'sonnet flagged as unbalanced/backspread');

const gpt4o = validateStrategy('broken_wing_butterfly', [
  L('SELL','CALL',130), L('BUY','CALL',134), L('BUY','CALL',140)
]);
ok(!gpt4o.valid, 'gpt-4o short-at-lowest is rejected');

const haiku = validateStrategy('broken_wing_butterfly', [
  L('SELL','CALL',132), L('BUY','CALL',135), L('SELL','PUT',130), L('BUY','PUT',127)
]);
ok(!haiku.valid, 'haiku mixed put+call labelled BWB is rejected');
ok(haiku.actual === 'iron_butterfly' || haiku.actual === 'iron_condor', 'haiku classified as a four-leg iron structure');

// --- ordering / label sanity ---
ok(!validateStrategy('iron_condor', [
  L('SELL','PUT',136), L('BUY','PUT',124), L('SELL','CALL',127), L('BUY','CALL',139)
]).valid, 'condor with shorts crossed is rejected');

ok(classifyLegs([L('BUY','CALL',130), L('SELL','CALL',135,2), L('BUY','CALL',140)]) === 'butterfly',
  'equal-wing 1-2-1 classifies as symmetric butterfly');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
