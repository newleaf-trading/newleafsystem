/**
 * decision-engine.ts — Deterministic strategy decision, regime, risk plan, rationale.
 * ─────────────────────────────────────────────────────────────────────────────
 * Replaces the LLM in the /api/recommend decision path. The deterministic engine
 * already SELECTS + SCORES the strategy; this module classifies the regime, decides
 * go/no-go from the score + gates + data sufficiency, computes a per-strategy risk
 * plan, and produces a template rationale. Pure functions — no I/O, no LLM.
 *
 * Why deterministic: applying fixed numeric thresholds (regime cutoffs, score tiers)
 * is integer comparison — code does it perfectly, repeatably, and for free. The
 * engine's 0-100 score is also the only confidence we can outcome-calibrate.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export type Decision = 'APPROVED_TRADE' | 'WATCHLIST_TRADE' | 'NO_TRADE' | 'DATA_ERROR';
export type Lean = 'bullish' | 'bearish' | 'neutral';

export interface DecisionContext {
  spot: number;
  dte: number;
  strategy: string;            // engine's chosen strategy code
  direction: Lean;             // engine's reconciled direction
  score: number;               // engine composite 0-100
  passedGates: number;         // hard gates passed (excludes the iron_butterfly fallback)
  // regime inputs
  adx: number | null;
  rsi: number | null;
  sma20: number | null;
  sma50: number | null;
  gammaReliable: boolean;      // gamma confidence >= 0.30
  spotInBand: boolean;         // spot strictly inside [putWall, callWall]
  // data sufficiency
  ivRvRatio: number | null;
  noVolData: boolean;          // IV/RV and expected move both unavailable
  missingInputs: number;       // count of {IV/RV, reliable gamma, liquidity} missing
  legsBuilt: boolean;          // deterministic legs constructed (>=2)
  // reaction gate (Step 2)
  reactionVeto?: boolean;        // trend into a zone → NO_TRADE (falling knife OR melt-up into resistance)
  reactionFlag?: string | null;  // direction-aware veto flag: 'falling_knife' | 'melt_up_into_resistance'
  reactionApproaching?: boolean; // promoted to a directional rail but price isn't testing it yet → cap WATCHLIST
  reactionNote?: string | null;  // human-readable reaction reason
  // rationale context
  putWall: number | null;
  callWall: number | null;
  gammaConfidencePct: number | null;
  bandWidthPct: number | null;
}

export interface DecisionResult {
  decision: Decision;
  regime: string;
  direction: Lean;
  confidence: number;          // 0-100 (= engine score; 0 for no-trade)
  riskPlan: { target: string; stop: string; kill: string; time: string };
  dataFlags: string[];
  rationale: string;
  rejectedAlternatives: { strategy: string; reason: string }[];
}

const CREDIT_DEFINED_RISK = new Set([
  'iron_condor', 'iron_butterfly', 'broken_wing_butterfly', 'bull_put_spread', 'bear_call_spread',
]);
const PREMIUM_SELLING = new Set([...CREDIT_DEFINED_RISK, 'calendar_spread']);
const LONG_VOL = new Set(['long_straddle', 'long_strangle']);

const EMPTY_PLAN = { target: '', stop: '', kill: '', time: '' };

/**
 * Classify the market regime from numeric thresholds — the same rules that lived in the
 * prompt, now executed as code. Covers the ADX 20-25 "developing trend" band that the
 * original rules left as a gap (which forced good directional setups to No-trade).
 */
export function classifyRegime(ctx: DecisionContext): { regime: string; lean: Lean } {
  const { adx, rsi, spot, sma20, sma50, gammaReliable, spotInBand } = ctx;
  if (sma20 == null || sma50 == null) return { regime: 'No-trade / wait', lean: 'neutral' };

  const aboveBoth = spot > sma20 && spot > sma50;
  const belowBoth = spot < sma20 && spot < sma50;
  const oversold = rsi != null && rsi < 30;
  const overbought = rsi != null && rsi > 70;
  const strongTrend = adx != null && adx >= 25;
  const moderateTrend = adx != null && adx >= 20 && adx < 25;

  // Strong trend continuation. Tiebreak: a counter-RSI extreme only overrides the trend
  // when the trend is NOT powerful (ADX < 35); above that, trend dominates and RSI is a
  // timing/bounce risk, not a reversal.
  if (strongTrend && aboveBoth) {
    if (overbought && adx! < 35) return { regime: 'Overbought mean-reversion', lean: 'bearish' };
    return { regime: 'Bullish trend continuation', lean: 'bullish' };
  }
  if (strongTrend && belowBoth) {
    if (oversold && adx! < 35) return { regime: 'Oversold mean-reversion', lean: 'bullish' };
    return { regime: 'Bearish trend continuation', lean: 'bearish' };
  }

  // Mean reversion in the absence of a real trend.
  if (oversold && (adx == null || adx < 25)) return { regime: 'Oversold mean-reversion', lean: 'bullish' };
  if (overbought && (adx == null || adx < 25)) return { regime: 'Overbought mean-reversion', lean: 'bearish' };

  // Developing trend: ADX 20-25 with a clean MA stack on one side — a moderate directional
  // lean (reduced conviction; capped below APPROVED by buildDecision).
  if (moderateTrend && aboveBoth) return { regime: 'Developing bullish trend', lean: 'bullish' };
  if (moderateTrend && belowBoth) return { regime: 'Developing bearish trend', lean: 'bearish' };

  // True range: weak trend, reliable band, spot inside it.
  if (adx != null && adx < 20 && gammaReliable && spotInBand) {
    return { regime: 'Range-bound premium selling', lean: 'neutral' };
  }

  return { regime: 'No-trade / wait', lean: 'neutral' };
}

/** Deterministic per-strategy risk plan — arithmetic on the structure, never invented. */
export function riskPlanFor(strategy: string, ctx: DecisionContext): DecisionResult['riskPlan'] {
  const band = (ctx.putWall != null && ctx.callWall != null)
    ? `the gamma band ($${ctx.putWall}–$${ctx.callWall})`
    : 'a short strike';
  const timeExit = ctx.dte >= 30 ? 'Exit by 21 DTE' : 'Exit by 7 DTE';

  if (CREDIT_DEFINED_RISK.has(strategy)) {
    return {
      target: 'Close at 50% of credit captured',
      stop: 'Close if loss reaches 2× credit received',
      kill: `Exit if spot closes beyond ${band}`,
      time: `${timeExit} to limit gamma/assignment risk`,
    };
  }
  if (LONG_VOL.has(strategy)) {
    return {
      target: 'Take profit at 50–100% of debit paid',
      stop: 'Close at 50% of debit lost',
      kill: 'Exit on IV crush or if the move thesis is invalidated',
      time: `${timeExit} to limit theta decay`,
    };
  }
  // calendar / unknown
  return {
    target: 'Close at 50% of max profit',
    stop: 'Close at 2× credit (or 50% of debit) lost',
    kill: `Exit if spot closes beyond ${band}`,
    time: `${timeExit} to manage the structure`,
  };
}

function strategyLabel(code: string): string {
  return code.replace(/_/g, ' ');
}

/** Deterministic ≤80-word rationale from the engine facts (also the LLM-narration fallback). */
export function templateRationale(ctx: DecisionContext, decision: Decision, regime: string): string {
  if (decision === 'DATA_ERROR') {
    return `Insufficient data to evaluate ${ctx.strategy ? strategyLabel(ctx.strategy) : 'a trade'} (${ctx.missingInputs} of 3 key inputs missing) and no coherent directional thesis.`;
  }
  const ind: string[] = [];
  if (ctx.adx != null) ind.push(`ADX ${ctx.adx.toFixed(1)}`);
  if (ctx.rsi != null) ind.push(`RSI ${ctx.rsi.toFixed(1)}`);
  if (ctx.ivRvRatio != null) ind.push(`IV/RV ${ctx.ivRvRatio.toFixed(2)}`);
  const indStr = ind.length ? ` (${ind.join(', ')})` : '';
  const gates = `${ctx.passedGates} gate${ctx.passedGates === 1 ? '' : 's'} passed`;
  const gamma = ctx.gammaConfidencePct != null && ctx.gammaConfidencePct >= 30 && ctx.putWall != null && ctx.callWall != null
    ? `gamma band $${ctx.putWall}–$${ctx.callWall} (conf ${ctx.gammaConfidencePct}%)`
    : 'gamma levels unreliable';

  if (decision === 'NO_TRADE') {
    return `${regime}${indStr}. Engine score ${Math.round(ctx.score)}/100, ${gates} — below the bar for a defined-risk trade here. No recommendation.`;
  }
  const verb = decision === 'APPROVED_TRADE' ? 'Approved' : 'Watchlist';
  return `${regime}${indStr}. Engine score ${Math.round(ctx.score)}/100, ${gates}. ${verb}: defined-risk ${strategyLabel(ctx.strategy)} (${ctx.direction}); ${gamma}.`;
}

/** The core decision: tiers from score, then guardrails. */
export function buildDecision(ctx: DecisionContext): DecisionResult {
  const { regime } = classifyRegime(ctx);
  const flags: string[] = [];
  if (!ctx.gammaReliable) flags.push('gamma_unreliable');

  const noTrade = (decision: Decision, extraFlags: string[] = []): DecisionResult => ({
    decision,
    regime,
    direction: 'neutral',
    confidence: 0,
    riskPlan: EMPTY_PLAN,
    dataFlags: [...flags, ...extraFlags],
    rationale: templateRationale(ctx, decision, regime),
    rejectedAlternatives: [],
  });

  // Hard fails first.
  if (!ctx.legsBuilt) return noTrade('NO_TRADE', ['legs_not_constructible']);
  if (ctx.reactionVeto) return noTrade('NO_TRADE', [ctx.reactionFlag || 'falling_knife']);  // trend into a zone — don't sell premium
  if (ctx.missingInputs >= 2 && regime === 'No-trade / wait') return noTrade('DATA_ERROR', ['insufficient_data']);
  if (regime === 'No-trade / wait') return noTrade('NO_TRADE');

  // Score tiers.
  let decision: Decision = ctx.score >= 65 ? 'APPROVED_TRADE' : ctx.score >= 40 ? 'WATCHLIST_TRADE' : 'NO_TRADE';

  // Guardrails — each can only downgrade.
  if (decision === 'APPROVED_TRADE' && ctx.passedGates === 0) { decision = 'WATCHLIST_TRADE'; flags.push('no_gates_passed'); }
  if (decision === 'APPROVED_TRADE' && ctx.noVolData && PREMIUM_SELLING.has(ctx.strategy)) { decision = 'WATCHLIST_TRADE'; flags.push('missing_vol_data'); }
  if (decision === 'APPROVED_TRADE' && regime.startsWith('Developing')) { decision = 'WATCHLIST_TRADE'; flags.push('moderate_adx'); }
  // Reaction promoted to a directional rail the price is only APPROACHING (not testing yet) → watchlist.
  if (decision === 'APPROVED_TRADE' && ctx.reactionApproaching) { decision = 'WATCHLIST_TRADE'; flags.push('approaching_rail'); }

  if (decision === 'NO_TRADE') return noTrade('NO_TRADE');

  return {
    decision,
    regime,
    direction: ctx.direction,
    confidence: Math.round(ctx.score),
    riskPlan: riskPlanFor(ctx.strategy, ctx),
    dataFlags: flags,
    rationale: templateRationale(ctx, decision, regime),
    rejectedAlternatives: [],
  };
}
