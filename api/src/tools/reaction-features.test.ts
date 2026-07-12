/**
 * reaction-features.test.ts — the shared reaction gate's promotion/veto decisions.
 * Run: npx tsx src/tools/reaction-features.test.ts
 */
import { applyReactionGate, type ReactionGate } from './reaction-features.js';

let passed = 0, failed = 0;
const ok = (c: boolean, m: string) => { if (c) passed++; else { failed++; console.error('FAIL: ' + m); } };

const base: ReactionGate = {
  regime: 'testing_support', regimeConfidence: 70, trendIntoZone: false,
  bias: 'bull_put_spread', biasCategory: 'income', posInRange: 0.2, noTradeReason: null,
  qualityBounce: false, rsi: 45,
  support: { level: 400, score: 82, rate: 0.8, tested: true },
  resistance: { level: 450, score: 40, rate: 0.2, tested: false },
  testingSupport: true, testingResistance: false,
};

// Promote a neutral pick to bull_put when mapBias says so + testing support → testing=true.
{
  const a = applyReactionGate('broken_wing_butterfly', base);
  ok(!!a && a.strategy === 'bull_put_spread' && a.direction === 'bullish' && a.testing === true, `BWB→bull_put testing (got ${JSON.stringify(a)})`);
}

// Approaching (regime trending, not testing) → testing=false → caller caps to WATCHLIST.
{
  const g = { ...base, regime: 'trending', testingSupport: false };
  const a = applyReactionGate('iron_butterfly', g);
  ok(!!a && a.strategy === 'bull_put_spread' && a.testing === false, `approaching → testing=false (got ${JSON.stringify(a)})`);
}

// Resistance side → bear_call.
{
  const g: ReactionGate = { ...base, regime: 'testing_resistance', bias: 'bear_call_spread',
    testingSupport: false, testingResistance: true,
    resistance: { level: 450, score: 78, rate: 0.75, tested: true } };
  const a = applyReactionGate('iron_condor', g);
  ok(!!a && a.strategy === 'bear_call_spread' && a.direction === 'bearish' && a.testing === true, 'IC→bear_call testing resistance');
}

// Falling knife: trend into a zone + mapBias no_trade → VETO (regardless of gamma pick).
{
  const g: ReactionGate = { ...base, regime: 'trending', trendIntoZone: true, bias: 'no_trade', noTradeReason: 'trend into zone' };
  const a = applyReactionGate('broken_wing_butterfly', g);
  ok(!!a && a.veto === true && a.flag === 'falling_knife', `falling-knife veto (got ${JSON.stringify(a)})`);
}

// Quality mean-reversion exception: a mega-cap oversold above a defended wall (qualityBounce=true)
// promotes a NEUTRAL pick to a defined-risk bull call spread — even when the knife veto would fire.
{
  const g: ReactionGate = { ...base, regime: 'trending', trendIntoZone: true, trendIntoZoneSide: 'support',
    bias: 'no_trade', noTradeReason: 'trend into support', qualityBounce: true, rsi: 12 } as any;
  const a = applyReactionGate('broken_wing_butterfly', g);
  ok(!!a && a.strategy === 'bull_call_spread' && a.direction === 'bullish' && a.flag === 'quality_mean_reversion',
    `quality bounce waives knife → bull_call (got ${JSON.stringify(a)})`);
  ok(!!a && /RSI 12/.test(a.note), `quality bounce note cites RSI (got ${a?.note})`);
}
// Quality bounce only promotes NEUTRAL picks — it never emits a quality promotion for an
// already-directional engine pick (a bear_call in a knife setup still vetoes as before).
{
  const a = applyReactionGate('bear_call_spread', { ...base, qualityBounce: true, bias: 'no_trade', trendIntoZone: true } as any);
  ok(!a || a.flag !== 'quality_mean_reversion', 'quality bounce does not promote a directional pick');
}

// Directional gamma pick is never re-routed.
ok(applyReactionGate('bear_call_spread', base) === null, 'directional pick untouched');

// Debit verticals are now buildable → they promote too.
{
  const a = applyReactionGate('iron_butterfly', { ...base, bias: 'bull_call_spread' });
  ok(!!a && a.strategy === 'bull_call_spread' && a.direction === 'bullish', 'bull_call_spread (debit) promotes bullish');
}
// Non-promotable bias (skewed / neutral) → keep gamma pick.
ok(applyReactionGate('iron_butterfly', { ...base, bias: 'skewed_condor' }) === null, 'skewed condor → keep gamma pick');
ok(applyReactionGate('iron_butterfly', { ...base, bias: 'no_trade', trendIntoZone: false }) === null, 'plain no_trade (no knife) → keep gamma pick');

// Null gate → null.
ok(applyReactionGate('iron_butterfly', null) === null, 'null gate → null');

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
