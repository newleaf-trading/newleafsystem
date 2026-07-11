'use strict';
/**
 * gate.cjs — the single, shared reaction gate (engine unification, Step 2).
 * ─────────────────────────────────────────────────────────────────────────────
 * ONE implementation used by every surface — the API (/api/recommend), the pipeline
 * (reports), and movement-range — so they can never disagree:
 *
 *   computeReactionGate(inputs) → runs the full S/R pipeline (gatherLevels →
 *     clusterLevels → analyzeZone → nearestScoreableZones → classifyRegime → mapBias),
 *     passing trendIntoZone to mapBias so the FALLING-KNIFE VETO actually fires.
 *
 *   applyReactionGate(gammaStrategyCode, gate) → decides what to do with a NEUTRAL
 *     gamma pick: veto (falling knife), promote to the aligned directional spread, or
 *     keep the gamma pick. Distance (testing vs approaching) is reported so the decision
 *     layer can cap APPROVED → WATCHLIST.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const { gatherLevels, clusterLevels, nearestScoreableZones } = require('./zones.cjs');
const { analyzeZone } = require('./stats.cjs');
const { classifyRegime, computeContainment } = require('./regime.cjs');
const { mapBias } = require('./bias.cjs');

/** Full S/R reaction analysis for one name. Mirrors movement-range exactly + fixes the veto. */
function computeReactionGate(input) {
  const { spot, candles, putWall, callWall, sma50, sma100, sma200, bbLower, bbUpper, atrPct, adx, ivRv, gammaConfidence, rsi, isQualityName } = input;
  if (!spot || !Array.isArray(candles) || candles.length < 20) return null;

  const levels = gatherLevels(spot, { putWall, callWall, sma50, sma100, sma200, bbLower, bbUpper, bars: candles });
  const { supportZones, resistanceZones } = clusterLevels(spot, levels, atrPct || 0.02);
  const sStats = supportZones.map(z => analyzeZone(candles, z, 'support'));
  const rStats = resistanceZones.map(z => analyzeZone(candles, z, 'resistance'));
  const { nearestSupport: nearS, nearestResistance: nearR } = nearestScoreableZones(spot, sStats, rStats);

  let containment = 0;
  if (nearS && nearR && nearS.zone.hi < nearR.zone.lo) containment = computeContainment(candles, nearS.zone, nearR.zone, 45);

  // CRITICAL: pass { candles } so trendDirection (→ trendIntoZone falling-knife flag) is computed.
  const { regime, confidence, trendIntoZone, trendIntoZoneSide } = classifyRegime(spot, nearS, nearR, containment, adx, atrPct || 0.02, { candles });

  const bandCentre = nearS && nearR && nearS.zone.hi < nearR.zone.lo ? (nearS.zone.hi + nearR.zone.lo) / 2 : null;
  const biasResult = mapBias({
    regime,
    supportScore: nearS ? nearS.score : 0, resistanceScore: nearR ? nearR.score : 0,
    supportTested: nearS ? !nearS.untested : false, resistanceTested: nearR ? !nearR.untested : false,
    ivRv: ivRv || 0, spot,
    supportLo: nearS && nearS.zone ? nearS.zone.lo : null,
    resistanceHi: nearR && nearR.zone ? nearR.zone.hi : null,
    bandCentre, gammaConfidence: gammaConfidence || 0, containment, adx,
    trendIntoZone,  // ← the falling-knife veto input that movement-range used to drop
  });

  const rail = z => (z && !z.untested) ? { level: (z.zone.hi + z.zone.lo) / 2, score: z.score, rate: z.smoothedRate, tested: true } : null;

  // ── Quality mean-reversion exception input ───────────────────────────────────
  // A mega-cap sitting oversold ABOVE a defended support wall is a bounce candidate,
  // not a falling knife. We compute the flag here (it needs regime + bias + wall state);
  // the decision to promote lives in applyReactionGate. Structural-break guard: spot must
  // be ABOVE the put wall with a trustworthy wall reading — a broken/undefended wall IS the
  // real structure change, so the exception voids and normal knife protection returns.
  const oversold = typeof rsi === 'number' && rsi < 30;
  const wallDefended = putWall != null && spot > putWall && (gammaConfidence || 0) >= 0.6;
  const standAsideOrKnife =
    (trendIntoZone && trendIntoZoneSide === 'support') ||  // falling-knife veto setup
    biasResult.bias === 'no_trade' ||                       // engine standing aside
    regime === 'testing_support';                           // sitting on support
  const qualityBounce = !!(isQualityName && oversold && wallDefended && standAsideOrKnife);

  return {
    regime, regimeConfidence: confidence, trendIntoZone: !!trendIntoZone, trendIntoZoneSide: trendIntoZoneSide || null,
    bias: biasResult.bias, biasCategory: biasResult.category, posInRange: biasResult.posInRange,
    noTradeReason: biasResult.noTradeReason || null,
    qualityBounce, rsi: (typeof rsi === 'number' ? rsi : null),
    support: rail(nearS), resistance: rail(nearR),
    // "Testing" uses the reaction engine's own regime (price within 0.5×ATR of the rail) →
    // a tested rail being tested = APPROVED-eligible; merely trending toward it = approaching → WATCHLIST.
    testingSupport: regime === 'testing_support',
    testingResistance: regime === 'testing_resistance',
  };
}

const NEUTRAL_PICKS = new Set(['iron_butterfly', 'broken_wing_butterfly', 'iron_condor']);
// Directional spreads the deterministic leg builder can construct (credit + debit verticals).
const PROMOTABLE = {
  bull_put_spread: 'bullish', bear_call_spread: 'bearish',
  bull_call_spread: 'bullish', bear_put_spread: 'bearish',
};

/**
 * Decide what the reaction gate does to the engine's pick.
 *   { veto: true, ... }                 → falling knife: do not sell premium here
 *   { strategy, direction, testing, ... } → promote a neutral pick to the directional spread
 *   null                                → keep the gamma pick
 */
function applyReactionGate(gammaStrategyCode, gate) {
  if (!gate) return null;

  // Quality mean-reversion exception (mega-cap only; upstream-gated on oversold + a defended
  // support wall still intact — see computeReactionGate). Reinterpret the falling-knife /
  // stand-aside setup as a bounce: waive the veto and promote a NEUTRAL gamma pick to a
  // defined-risk DEBIT vertical (bull call spread). A debit vertical fits cheap IV/RV, caps
  // loss at the debit paid, and — being a debit — sidesteps the prices_as_debit NO_TRADE that
  // rejects credit structures. Runs BEFORE the veto so the knife flag can't fire for these.
  // Never flips an already-directional engine pick (only promotes NEUTRAL_PICKS).
  if (gate.qualityBounce && NEUTRAL_PICKS.has(gammaStrategyCode)) {
    return {
      strategy: 'bull_call_spread', direction: 'bullish', testing: !!gate.testingSupport,
      flag: 'quality_mean_reversion',
      note: `quality mean-reversion — mega-cap oversold${gate.rsi != null ? ` (RSI ${Math.round(gate.rsi)})` : ''} above a defended support wall; falling-knife veto waived, defined-risk bull call spread`,
    };
  }

  // Trend-into-zone veto applies to ANY premium-selling pick (mapBias returns no_trade + trendIntoZone).
  // The flag is DIRECTION-AWARE: a downtrend into support is a falling knife; an uptrend into
  // resistance is a melt-up / breakout risk — labelling the latter "falling_knife" is wrong.
  if (gate.trendIntoZone && gate.bias === 'no_trade') {
    const intoResistance = gate.trendIntoZoneSide === 'resistance';
    return {
      veto: true,
      flag: intoResistance ? 'melt_up_into_resistance' : 'falling_knife',
      note: gate.noTradeReason || (intoResistance
        ? `melt-up / breakout risk — uptrend into resistance (${gate.regime})`
        : `falling-knife risk — downtrend into support (${gate.regime})`),
    };
  }

  // Only re-route NEUTRAL gamma picks; never flip an already-directional engine pick.
  if (!NEUTRAL_PICKS.has(gammaStrategyCode)) return null;

  const dir = PROMOTABLE[gate.bias];
  if (dir) {
    const onSupport = dir === 'bullish';
    const testing = onSupport ? gate.testingSupport : gate.testingResistance;
    const r = onSupport ? gate.support : gate.resistance;
    return {
      strategy: gate.bias, direction: dir, testing: !!testing,
      flag: testing ? `testing_${onSupport ? 'support' : 'resistance'}` : `approaching_${onSupport ? 'support' : 'resistance'}`,
      note: `${gate.bias.replace(/_/g, ' ')} — ${testing ? 'testing' : 'approaching'} ${onSupport ? 'support' : 'resistance'} $${r ? Math.round(r.level) : '?'} (score ${r ? r.score : '?'}, holds ${r ? Math.round((r.rate || 0) * 100) : '?'}%, ${gate.regime})`,
    };
  }
  // bull_call/bear_put (debit) · skewed_condor · neutral biases · plain no_trade → keep gamma pick.
  return null;
}

module.exports = { computeReactionGate, applyReactionGate, NEUTRAL_PICKS };
