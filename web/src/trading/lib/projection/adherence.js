/**
 * adherence — deterministic diagnostic: is the investor on track vs their plan?
 *
 * Phase 2a is READ/COMPUTE/NARRATE only. Nothing here blocks, places, or sizes a
 * trade. Every figure is computed in code; narration is a fixed template (no LLM).
 *
 * Anchoring rule: ONLY trades closed on/after plan.startDate count toward cadence
 * and edge — pre-plan history must never leak in.
 *
 * Attribution identity (guaranteed by construction, asserted in tests):
 *   cadenceGap + edgeGap === expectedCapital − actualCapital
 */
import { percentilesAtTrade } from './engine';

const MS_PER_WEEK = 7 * 86_400_000;
const COLD_START_MIN_TRADES = 5;
const CAPITAL_TOLERANCE = 1; // dollars

/** Plan capital basis vs the account's configured capital. */
export function capitalReconciliation(plan, accountCapital) {
  const planCapital = plan?.capital ?? null;
  const matched =
    planCapital != null &&
    accountCapital != null &&
    Math.abs(planCapital - accountCapital) <= CAPITAL_TOLERANCE;
  return { matched, planCapital, accountCapital };
}

/** Closed trades on/after startDate, with realised P&L (per-contract × quantity). */
export function planRelativeClosed(closedPositions, startDate) {
  const start = new Date(startDate + 'T00:00:00').getTime();
  const trades = (closedPositions || []).filter((p) => {
    if (p.status !== 'closed' || !p.closedAt) return false;
    const t = new Date(p.closedAt).getTime();
    return Number.isFinite(t) && t >= start;
  });
  const realisedPnl = trades.reduce(
    (sum, p) => sum + (p.realizedPnl || 0) * (p.quantity || 1),
    0
  );
  return { trades, actualTrades: trades.length, realisedPnl };
}

/** Fractional weeks since startDate (never negative). */
export function elapsedWeeks(startDate, now = Date.now()) {
  const start = new Date(startDate + 'T00:00:00').getTime();
  if (!Number.isFinite(start)) return 0;
  return Math.max(0, (now - start) / MS_PER_WEEK);
}

/** Engine state reconstructed from the frozen plan snapshot + a horizon. */
function stateFromPlan(plan, years) {
  return {
    cap: plan.capital,
    yrs: years,
    tpy: Math.round(plan.tradesPerWeek * 52),
    wr: plan.winRate,
    aw: plan.avgWin,
    al: plan.avgLoss,
    capPct: plan.riskCapPct,
  };
}

/**
 * Full adherence read. Returns a phase plus, when `active`, the attribution and
 * equity-vs-band. In `reconcile`/`coldstart` no attribution or band is produced.
 */
export function computeAdherence({ plan, accountCapital, closedPositions, now = Date.now() }) {
  if (!plan) return { phase: 'none' };

  const reconciliation = capitalReconciliation(plan, accountCapital);
  const weeks = elapsedWeeks(plan.startDate, now);
  const { actualTrades, realisedPnl } = planRelativeClosed(closedPositions, plan.startDate);
  const tradesPerWeek = plan.tradesPerWeek;
  const weekNumber = Math.floor(weeks) + 1;
  const tradesTakenThisWeek = tradesOpenedThisWeek(closedPositions, plan.startDate, now);

  const base = {
    weeks,
    weekNumber,
    actualTrades,
    realisedPnl,
    tradesPerWeek,
    tradesTakenThisWeek,
    startCapital: plan.capital,
    ev: plan.evPerTrade,
    reconciliation,
  };

  // A band on a capital basis that doesn't match the real account is nonsense.
  if (!reconciliation.matched) return { ...base, phase: 'reconcile' };

  // Not enough signal to grade.
  if (weeks < 1 || actualTrades < COLD_START_MIN_TRADES) {
    return { ...base, phase: 'coldstart' };
  }

  const startCapital = plan.capital;
  const ev = plan.evPerTrade;
  const expectedTrades = tradesPerWeek * weeks;
  const expectedCapital = startCapital * Math.pow(1 + ev, expectedTrades);
  const paceAdjusted = startCapital * Math.pow(1 + ev, actualTrades);
  const actualCapital = startCapital + realisedPnl;

  const cadenceGap = expectedCapital - paceAdjusted; // under-trading
  const edgeGap = paceAdjusted - actualCapital; // realised edge vs assumption
  const realisedEdge = actualTrades > 0 ? Math.pow(actualCapital / startCapital, 1 / actualTrades) - 1 : null;

  // Signed contributions to (actual − expected), for the diverging drift bars.
  // cadenceContribution = −cadenceGap, edgeContribution = −edgeGap, and they sum to net.
  const netVsExpected = actualCapital - expectedCapital;
  const cadenceContribution = paceAdjusted - expectedCapital;
  const edgeContribution = actualCapital - paceAdjusted;
  const cadenceRatio = expectedTrades > 0 ? actualTrades / expectedTrades : 1;
  const edgeAhead = realisedEdge != null && realisedEdge >= ev;
  const behindCadence = actualTrades < expectedTrades;

  // Equity-vs-band: percentile band time-indexed to expectedTrades.
  const horizonYears = Math.max(1, Math.ceil(expectedTrades / Math.max(1, Math.round(tradesPerWeek * 52))));
  const band = percentilesAtTrade(stateFromPlan(plan, horizonYears), expectedTrades);

  return {
    ...base,
    phase: 'active',
    expectedTrades,
    expectedCapital,
    paceAdjusted,
    actualCapital,
    cadenceGap,
    edgeGap,
    netVsExpected,
    cadenceContribution,
    edgeContribution,
    cadenceRatio,
    realisedEdge,
    edgeAhead,
    behindCadence,
    band,
  };
}

/** Trades opened (entryDate) within the current plan-relative week. */
function tradesOpenedThisWeek(closedPositions, startDate, now) {
  const start = new Date(startDate + 'T00:00:00').getTime();
  if (!Number.isFinite(start)) return 0;
  const weeksElapsed = Math.floor(Math.max(0, (now - start) / MS_PER_WEEK));
  const weekStart = start + weeksElapsed * MS_PER_WEEK;
  return (closedPositions || []).filter((p) => {
    if (!p.entryDate) return false;
    const t = new Date(p.entryDate + 'T00:00:00').getTime();
    return Number.isFinite(t) && t >= weekStart && t <= now;
  }).length;
}

const FOOTER = 'Cadence is a metronome, not a debt.';

/**
 * Deterministic narration. Numbers are computed upstream and injected here; this
 * function NEVER generates a figure and NEVER renders trades-owed / catch-up copy.
 */
export function narrateAdherence(a) {
  if (!a || a.phase === 'none') return { verdict: '', footer: FOOTER };

  if (a.phase === 'reconcile') {
    return {
      verdict: "Plan capital doesn't match your account. Re-commit to reconcile before grading.",
      footer: FOOTER,
    };
  }

  if (a.phase === 'coldstart') {
    const target = Math.round(a.tradesPerWeek);
    return {
      verdict: `Week ${a.weekNumber} — plan just set. ${a.tradesTakenThisWeek} of ~${target} qualified setups this week. Start when you’re ready.`,
      footer: FOOTER,
    };
  }

  // active: name the lever from the computed edge/cadence, never the figures.
  const edgeAhead = a.edgeAhead ?? (a.realisedEdge != null && a.realisedEdge >= a.ev);
  const behindCadence = a.behindCadence ?? true;
  let verdict;
  if (!edgeAhead) {
    verdict = "Edge is below plan — stop and check the edge, don't trade more. Pace won't fix a thin edge.";
  } else if (behindCadence) {
    verdict = 'Your edge is running ahead of plan — the only thing holding you back is cadence. The fix is pace, not risk. Keep taking qualified setups as they appear.';
  } else {
    verdict = "You're on edge and on pace — let it compound. No changes needed.";
  }
  return { verdict, footer: FOOTER };
}
