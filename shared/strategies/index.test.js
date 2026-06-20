'use strict';

/**
 * Strategy engine tests — mirrors shared/indicators/index.test.js convention.
 * Run: node shared/strategies/index.test.js
 */

const { buildLegs, payoff, analyse, bandWidth, PRESETS } = require('./index');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
  } else {
    failed++;
    console.error(`  FAIL: ${label}`);
  }
}

function approx(a, b, tolerance) {
  tolerance = tolerance || 1;
  return Math.abs(a - b) <= tolerance;
}

// ═══════════════════════════════════════════════════════════════
console.log('buildLegs');
// ═══════════════════════════════════════════════════════════════

const spot = 214;

const icLegs = buildLegs('iron_condor', spot, { shortWidth: 10, wing: 10, net: 4 });
assert(icLegs.length === 4, 'iron_condor: 4 legs');
assert(icLegs[0].kind === 'put' && icLegs[0].dir === 'short' && icLegs[0].strike === 204, 'iron_condor: short put at spot-10');
assert(icLegs[2].kind === 'call' && icLegs[2].dir === 'short' && icLegs[2].strike === 224, 'iron_condor: short call at spot+10');
assert(icLegs[1].strike === 194, 'iron_condor: long put at shortPut-wing');
assert(icLegs[3].strike === 234, 'iron_condor: long call at shortCall+wing');

const ibLegs = buildLegs('iron_butterfly', spot, { wing: 10, net: 7 });
assert(ibLegs.length === 4, 'iron_butterfly: 4 legs');
assert(ibLegs[0].strike === 214 && ibLegs[2].strike === 214, 'iron_butterfly: both shorts at spot');
assert(ibLegs[1].strike === 204, 'iron_butterfly: long put at center-wing');
assert(ibLegs[3].strike === 224, 'iron_butterfly: long call at center+wing');

const bpsLegs = buildLegs('bull_put_spread', spot, { shortWidth: 10, wing: 10, net: 3 });
assert(bpsLegs.length === 2, 'bull_put_spread: 2 legs');
assert(bpsLegs[0].dir === 'short' && bpsLegs[0].kind === 'put', 'bull_put_spread: short put');
assert(bpsLegs[1].dir === 'long' && bpsLegs[1].kind === 'put', 'bull_put_spread: long put');

const bcsLegs = buildLegs('bear_call_spread', spot, { shortWidth: 10, wing: 10, net: 3 });
assert(bcsLegs.length === 2, 'bear_call_spread: 2 legs');
assert(bcsLegs[0].dir === 'short' && bcsLegs[0].kind === 'call', 'bear_call_spread: short call');

const stradLegs = buildLegs('long_straddle', spot, { net: -10 });
assert(stradLegs.length === 2, 'long_straddle: 2 legs');
assert(stradLegs[0].dir === 'long' && stradLegs[0].kind === 'call', 'long_straddle: long call');
assert(stradLegs[1].dir === 'long' && stradLegs[1].kind === 'put', 'long_straddle: long put');
assert(stradLegs[0].strike === stradLegs[1].strike, 'long_straddle: same strike');

const strangLegs = buildLegs('long_strangle', spot, { straddleWidth: 10, net: -6 });
assert(strangLegs.length === 2, 'long_strangle: 2 legs');
assert(strangLegs[0].strike === 224 && strangLegs[1].strike === 204, 'long_strangle: OTM strikes');

// ═══════════════════════════════════════════════════════════════
console.log('payoff');
// ═══════════════════════════════════════════════════════════════

// Iron condor at max profit (inside short strikes)
const icPnlMid = payoff(icLegs, 214);
assert(icPnlMid > 0, 'iron_condor: positive P&L at spot (inside shorts)');

// Iron condor at max loss (past long strike)
const icPnlFar = payoff(icLegs, 180);
assert(icPnlFar < 0, 'iron_condor: negative P&L far below');

// Butterfly at max profit (exactly at center)
const ibPnlCenter = payoff(ibLegs, 214);
assert(ibPnlCenter > 0, 'iron_butterfly: positive P&L at center');

// ═══════════════════════════════════════════════════════════════
console.log('analyse — breakevens and max P/L');
// ═══════════════════════════════════════════════════════════════

const results = analyse([
  { name: 'iron_condor', legs: icLegs },
  { name: 'iron_butterfly', legs: ibLegs },
], spot);

const icResult = results[0];
const ibResult = results[1];

assert(icResult.maxProfit > 0, 'iron_condor: maxProfit > 0');
assert(icResult.maxLoss < 0, 'iron_condor: maxLoss < 0');
assert(icResult.breakevens.length === 2, 'iron_condor: 2 breakevens');
// Expected BEs: ~200 and ~228 (shortPut-net=204-4=200, shortCall+net=224+4=228)
assert(approx(icResult.breakevens[0], 200, 2), `iron_condor: lower BE ~200, got ${icResult.breakevens[0]}`);
assert(approx(icResult.breakevens[1], 228, 2), `iron_condor: upper BE ~228, got ${icResult.breakevens[1]}`);

assert(ibResult.maxProfit > 0, 'iron_butterfly: maxProfit > 0');
assert(ibResult.maxLoss < 0, 'iron_butterfly: maxLoss < 0');
assert(ibResult.breakevens.length === 2, 'iron_butterfly: 2 breakevens');
// Expected BEs: ~207 and ~221 (center-net=214-7=207, center+net=214+7=221)
assert(approx(ibResult.breakevens[0], 207, 2), `iron_butterfly: lower BE ~207, got ${ibResult.breakevens[0]}`);
assert(approx(ibResult.breakevens[1], 221, 2), `iron_butterfly: upper BE ~221, got ${ibResult.breakevens[1]}`);

assert(ibResult.rewardRisk > 0, 'iron_butterfly: positive R:R');
assert(icResult.profitZoneWidth > ibResult.profitZoneWidth, 'iron_condor: wider profit zone than butterfly');

// ═══════════════════════════════════════════════════════════════
console.log('analyse — uncapped detection');
// ═══════════════════════════════════════════════════════════════

const stradResult = analyse([{ name: 'long_straddle', legs: stradLegs }], spot);
assert(stradResult[0].uncappedProfit === true, 'long_straddle: uncapped profit detected');
assert(stradResult[0].uncappedLoss === false, 'long_straddle: loss IS capped (premium paid)');

const icUncapped = analyse([{ name: 'ic', legs: icLegs }], spot);
assert(icUncapped[0].uncappedProfit === false, 'iron_condor: profit IS capped');
assert(icUncapped[0].uncappedLoss === false, 'iron_condor: loss IS capped');

// ═══════════════════════════════════════════════════════════════
console.log('bandWidth');
// ═══════════════════════════════════════════════════════════════

const icBand = bandWidth(icLegs, spot, 400);
const ibBand = bandWidth(ibLegs, spot, 400);

if (icResult.maxProfit >= 400) {
  assert(icBand !== null, 'iron_condor: has a >= $400 band');
} else {
  assert(icBand === null, 'iron_condor: no >= $400 band (maxProfit < $400)');
}

if (ibResult.maxProfit >= 400) {
  assert(ibBand !== null, 'iron_butterfly: has a >= $400 band');
  if (icBand && ibBand) {
    assert(icBand.width >= ibBand.width, `iron_condor band (${icBand.width}) >= iron_butterfly band (${ibBand.width})`);
  }
}

// ═══════════════════════════════════════════════════════════════
console.log('edge cases');
// ═══════════════════════════════════════════════════════════════

try {
  buildLegs('invalid_strategy', 100);
  assert(false, 'unknown strategy should throw');
} catch (e) {
  assert(e.message.includes('Unknown strategy'), 'unknown strategy throws with message');
}

// Zero net
const zeroNet = buildLegs('iron_condor', spot, { shortWidth: 10, wing: 10 });
assert(zeroNet.length === 4, 'zero net: still builds 4 legs');

// ═══════════════════════════════════════════════════════════════
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
