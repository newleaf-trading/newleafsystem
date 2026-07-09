/**
 * decision-engine.test.ts — regime classification + decision tiers + guardrails.
 * Run: npx tsx src/tools/decision-engine.test.ts
 */
import { buildDecision, classifyRegime, type DecisionContext } from './decision-engine.js';

let passed = 0, failed = 0;
function ok(cond: boolean, msg: string) { if (cond) { passed++; } else { failed++; console.error('FAIL: ' + msg); } }

const base: DecisionContext = {
  spot: 100, dte: 20, strategy: 'broken_wing_butterfly', direction: 'neutral',
  score: 70, passedGates: 1, adx: 22, rsi: 50, sma20: 100, sma50: 100,
  gammaReliable: true, spotInBand: true, ivRvRatio: 1.1, noVolData: false,
  missingInputs: 0, legsBuilt: true, netCredit: 1.5, putWall: 90, callWall: 110,
  gammaConfidencePct: 55, bandWidthPct: 10,
};

// ABNB: ADX 7.1 (no trend), spot inside a reliable band → range-bound premium selling, score 84 → APPROVED.
{
  const ctx = { ...base, spot: 131.97, adx: 7.1, rsi: 49.1, sma20: 133.19, sma50: 135.36,
    gammaReliable: true, spotInBand: true, score: 84, passedGates: 1, strategy: 'broken_wing_butterfly',
    putWall: 115, callWall: 133, ivRvRatio: 1.49 };
  ok(classifyRegime(ctx).regime === 'Range-bound premium selling', 'ABNB → range-bound premium selling');
  const d = buildDecision(ctx);
  ok(d.decision === 'APPROVED_TRADE', `ABNB → APPROVED (got ${d.decision})`);
  ok(d.confidence === 84, 'ABNB confidence = engine score 84');
}

// META: ADX 23.4 (developing), spot below both SMAs → developing bearish, score 88 capped to WATCHLIST.
{
  const ctx = { ...base, spot: 566.28, adx: 23.4, rsi: 35.7, sma20: 604.18, sma50: 621.82,
    gammaReliable: true, spotInBand: false, score: 88, passedGates: 2, direction: 'bearish' as const,
    putWall: 565, callWall: 630, ivRvRatio: 1.1 };
  ok(classifyRegime(ctx).regime === 'Developing bearish trend', 'META → developing bearish trend');
  const d = buildDecision(ctx);
  ok(d.decision === 'WATCHLIST_TRADE', `META → WATCHLIST capped by developing trend (got ${d.decision})`);
  ok(d.dataFlags.includes('moderate_adx'), 'META → moderate_adx flag');
  ok(d.direction === 'bearish', 'META → bearish direction');
}

// AMZN: ADX 48.5 strong + oversold RSI 25.9 below both SMAs → tiebreak trend wins (ADX>=35).
{
  const ctx = { ...base, spot: 236.51, adx: 48.5, rsi: 25.9, sma20: 257.15, sma50: 254.73,
    spotInBand: false, score: 60, direction: 'bearish' as const };
  ok(classifyRegime(ctx).regime === 'Bearish trend continuation', 'AMZN → bearish trend continuation (tiebreak, ADX≥35)');
}

// Oversold with weak trend (ADX 18) → mean reversion, not trend.
{
  const ctx = { ...base, adx: 18, rsi: 28, sma20: 110, sma50: 112, spot: 100, spotInBand: false };
  ok(classifyRegime(ctx).regime === 'Oversold mean-reversion', 'weak ADX + oversold → mean reversion');
}

// No SMAs → No-trade/wait → NO_TRADE.
{
  const d = buildDecision({ ...base, sma20: null, sma50: null });
  ok(d.decision === 'NO_TRADE' && d.regime === 'No-trade / wait', 'missing SMAs → NO_TRADE');
}

// Legs not constructible → NO_TRADE regardless of score.
{
  const d = buildDecision({ ...base, score: 90, legsBuilt: false });
  ok(d.decision === 'NO_TRADE' && d.dataFlags.includes('legs_not_constructible'), 'no legs → NO_TRADE');
}

// 2+ inputs missing AND no thesis → DATA_ERROR.
{
  const d = buildDecision({ ...base, sma20: null, sma50: null, missingInputs: 3 });
  ok(d.decision === 'DATA_ERROR', 'missing data + no thesis → DATA_ERROR');
}

// All gates failed caps APPROVED → WATCHLIST.
{
  const d = buildDecision({ ...base, adx: 7, score: 80, passedGates: 0 });
  ok(d.decision === 'WATCHLIST_TRADE' && d.dataFlags.includes('no_gates_passed'), 'no gates → APPROVED capped to WATCHLIST');
}

// Premium selling without vol data caps APPROVED → WATCHLIST.
{
  const d = buildDecision({ ...base, adx: 7, score: 80, passedGates: 2, noVolData: true, ivRvRatio: null, strategy: 'iron_butterfly' });
  ok(d.decision === 'WATCHLIST_TRADE' && d.dataFlags.includes('missing_vol_data'), 'no vol data → premium selling capped to WATCHLIST');
}

// Risk plan: credit strategy uses credit language.
{
  const d = buildDecision({ ...base, adx: 7, score: 70, strategy: 'iron_condor' });
  ok(d.riskPlan.target.includes('credit'), 'credit strategy → credit-based target');
  ok(d.riskPlan.kill.includes('gamma band'), 'risk plan kill references the gamma band');
}

// ── Phase 1: premium-economics gates (the ADBE-style fix) ──
// A credit structure that prices as a net debit → NO_TRADE, not an APPROVED "credit" trade.
{
  const d = buildDecision({ ...base, adx: 7, score: 88, spotInBand: true, gammaReliable: true, strategy: 'broken_wing_butterfly', ivRvRatio: 0.91, netCredit: -3.20 });
  ok(d.decision === 'NO_TRADE' && d.dataFlags.includes('prices_as_debit'), `debit BWB → NO_TRADE prices_as_debit (got ${d.decision})`);
  ok(/net debit/i.test(d.rationale), 'debit rationale names the real cause (not "below the bar")');
}
// Thin premium (IV/RV < 0.85) on a credit structure → NO_TRADE regardless of score.
{
  const d = buildDecision({ ...base, adx: 7, score: 90, spotInBand: true, strategy: 'iron_condor', ivRvRatio: 0.7, netCredit: 2 });
  ok(d.decision === 'NO_TRADE' && d.dataFlags.includes('premium_too_thin'), `thin premium → NO_TRADE (got ${d.decision})`);
}
// Marginally thin (0.85–1.0) with a real credit → tradeable but capped at WATCHLIST, not APPROVED.
{
  const d = buildDecision({ ...base, adx: 7, score: 88, spotInBand: true, gammaReliable: true, strategy: 'broken_wing_butterfly', ivRvRatio: 0.91, netCredit: 1.1 });
  ok(d.decision === 'WATCHLIST_TRADE' && d.dataFlags.includes('thin_premium'), `IV/RV 0.91 credit → WATCHLIST thin_premium (got ${d.decision})`);
}
// Healthy premium + real credit → still APPROVED (no false negatives).
{
  const d = buildDecision({ ...base, adx: 7, score: 80, spotInBand: true, gammaReliable: true, strategy: 'iron_condor', ivRvRatio: 1.4, netCredit: 2 });
  ok(d.decision === 'APPROVED_TRADE', `rich premium + credit → APPROVED (got ${d.decision})`);
}
// Unpriceable legs (netCredit null) must NOT trigger the debit gate.
{
  const d = buildDecision({ ...base, adx: 7, score: 80, spotInBand: true, gammaReliable: true, strategy: 'iron_condor', ivRvRatio: 1.4, netCredit: null });
  ok(d.decision === 'APPROVED_TRADE', `null netCredit → not blocked by debit gate (got ${d.decision})`);
}

console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
