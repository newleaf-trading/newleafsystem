/**
 * Verdict Engine — per-strategy position evaluation.
 *
 * Implements brief §9: five verdict states, per-strategy thresholds,
 * three universal overrides. Pure functions, no side effects.
 *
 * evaluate(position, marketData) → { state, reason, recommendedAction }
 *
 * Evaluation order: first match wins.
 *   EXIT > TAKE_PROFIT > ACTION_NEEDED > MONITOR > ON_TRACK
 *
 * Universal overrides applied AFTER per-strategy evaluation:
 *   1. 21-DTE rule: short-premium at ≤21 DTE with <50% captured → escalate one level
 *   2. Earnings proximity: earnings inside remaining DTE that weren't at entry → escalate one level
 *   3. Vol regime shift: IV rank moved >30 points from entry → minimum MONITOR
 */

// ═══════════════════════════════════════════════════════════════
// Constants
// ═══════════════════════════════════════════════════════════════

export const VERDICT = {
  EXIT: 'EXIT',
  TAKE_PROFIT: 'TAKE_PROFIT',
  ACTION_NEEDED: 'ACTION_NEEDED',
  MONITOR: 'MONITOR',
  ON_TRACK: 'ON_TRACK',
};

const PRIORITY = {
  [VERDICT.EXIT]: 0,
  [VERDICT.ACTION_NEEDED]: 1, // Note: ACTION_NEEDED > TAKE_PROFIT in escalation, but EXIT > TAKE_PROFIT > ACTION_NEEDED in evaluation
  [VERDICT.TAKE_PROFIT]: 2,
  [VERDICT.MONITOR]: 3,
  [VERDICT.ON_TRACK]: 4,
};

// For escalation: move one level toward EXIT
function escalate(state) {
  switch (state) {
    case VERDICT.ON_TRACK: return VERDICT.MONITOR;
    case VERDICT.MONITOR: return VERDICT.ACTION_NEEDED;
    case VERDICT.ACTION_NEEDED: return VERDICT.EXIT;
    case VERDICT.TAKE_PROFIT: return VERDICT.ACTION_NEEDED;
    case VERDICT.EXIT: return VERDICT.EXIT;
    default: return VERDICT.MONITOR;
  }
}

// ═══════════════════════════════════════════════════════════════
// Main entry point
// ═══════════════════════════════════════════════════════════════

/**
 * Evaluate a position and return a verdict.
 *
 * @param {object} position — portfolio item with tile data merged
 *   Required: strategy, legs[], entryNetCredit, entryIvRank, expiry
 * @param {object} marketData — current market state
 *   Required: currentSpot, dte, shortDelta (abs), profitCapturePct,
 *             currentIvRank, nextEarningsDate (nullable)
 * @returns {{ state: string, reason: string, recommendedAction: string|null }}
 */
export function evaluate(position, marketData) {
  const strategy = normalizeStrategy(position.strategy);
  const evaluator = STRATEGY_EVALUATORS[strategy];

  // Use strategy-specific evaluator if available, otherwise generic
  let result = evaluator
    ? evaluator(position, marketData)
    : genericEvaluate(position, marketData);

  // Apply universal overrides
  result = applyOverrides(result, position, marketData);

  return result;
}

// ═══════════════════════════════════════════════════════════════
// Strategy normalization
// ═══════════════════════════════════════════════════════════════

function normalizeStrategy(strategy) {
  if (!strategy) return 'unknown';
  return strategy.toLowerCase().replace(/_/g, ' ').trim();
}

// ═══════════════════════════════════════════════════════════════
// Per-strategy evaluators (brief §9 thresholds)
// ═══════════════════════════════════════════════════════════════

function evaluateIronCondor(position, md) {
  const { profitCapturePct, shortDelta, dte, isShortTested, isBreached, sessionsBreached, lossMultiple } = md;

  // EXIT: strike breached 2 sessions or loss ≥ 1.5× credit
  if (lossMultiple >= 1.5) {
    return {
      state: VERDICT.EXIT,
      reason: `Loss at ${lossMultiple.toFixed(1)}× entry credit — exceeds 1.5× stop.`,
      recommendedAction: 'Close entire position.',
    };
  }
  if (isBreached && sessionsBreached >= 2) {
    return {
      state: VERDICT.EXIT,
      reason: `Short strike breached for ${sessionsBreached} sessions.`,
      recommendedAction: 'Close entire position.',
    };
  }

  // TAKE_PROFIT: ≥50% captured
  if (profitCapturePct >= 50) {
    return {
      state: VERDICT.TAKE_PROFIT,
      reason: `${profitCapturePct.toFixed(0)}% of max profit captured.`,
      recommendedAction: 'Close for profit or let expire.',
    };
  }

  // ACTION_NEEDED: short Δ ≥ 0.35 or short tested
  if (shortDelta >= 0.35 || isShortTested) {
    return {
      state: VERDICT.ACTION_NEEDED,
      reason: isShortTested
        ? 'Short strike is being tested by price.'
        : `Short-side delta at ${shortDelta.toFixed(2)} — elevated risk.`,
      recommendedAction: 'Roll tested side, bring untested closer.',
    };
  }

  // MONITOR: short Δ ≥ 0.25 or DTE ≤ 21
  if (shortDelta >= 0.25 || dte <= 21) {
    return {
      state: VERDICT.MONITOR,
      reason: shortDelta >= 0.25
        ? `Short-side delta at ${shortDelta.toFixed(2)} — approaching threshold.`
        : `${dte} DTE remaining — entering gamma risk zone.`,
      recommendedAction: null,
    };
  }

  return onTrack(profitCapturePct);
}

function evaluateIronButterfly(position, md) {
  const { profitCapturePct, shortDelta, dte, isBreached, lossMultiple } = md;

  if (isBreached || lossMultiple >= 1.0) {
    return {
      state: VERDICT.EXIT,
      reason: isBreached ? 'Strike breached.' : `Loss at ${lossMultiple.toFixed(1)}× credit.`,
      recommendedAction: 'Close — adjustments rarely pay on butterflies.',
    };
  }

  if (profitCapturePct >= 25) {
    return {
      state: VERDICT.TAKE_PROFIT,
      reason: `${profitCapturePct.toFixed(0)}% of max profit captured.`,
      recommendedAction: 'Close for profit.',
    };
  }

  if (shortDelta >= 0.40) {
    return {
      state: VERDICT.ACTION_NEEDED,
      reason: `Short-side delta at ${shortDelta.toFixed(2)}.`,
      recommendedAction: 'Close — adjustments rarely pay.',
    };
  }

  if (shortDelta >= 0.30 || dte <= 21) {
    return {
      state: VERDICT.MONITOR,
      reason: shortDelta >= 0.30 ? `Delta at ${shortDelta.toFixed(2)}.` : `${dte} DTE.`,
      recommendedAction: null,
    };
  }

  return onTrack(profitCapturePct);
}

function evaluateBullPutSpread(position, md) {
  const { profitCapturePct, shortDelta, dte, isBreached, lossMultiple } = md;

  if (isBreached) {
    return {
      state: VERDICT.EXIT,
      reason: 'Short put breached.',
      recommendedAction: 'Close or roll down and out for credit.',
    };
  }

  if (profitCapturePct >= 50) {
    return {
      state: VERDICT.TAKE_PROFIT,
      reason: `${profitCapturePct.toFixed(0)}% captured.`,
      recommendedAction: 'Close for profit.',
    };
  }

  if (shortDelta >= 0.35) {
    return {
      state: VERDICT.ACTION_NEEDED,
      reason: `Short put delta at ${shortDelta.toFixed(2)}.`,
      recommendedAction: 'Roll down and out for credit.',
    };
  }

  if (shortDelta >= 0.25 || dte <= 21) {
    return {
      state: VERDICT.MONITOR,
      reason: shortDelta >= 0.25 ? `Short put delta at ${shortDelta.toFixed(2)}.` : `${dte} DTE.`,
      recommendedAction: null,
    };
  }

  return onTrack(profitCapturePct);
}

function evaluateBearCallSpread(position, md) {
  const { profitCapturePct, shortDelta, dte, isBreached } = md;

  if (isBreached) {
    return {
      state: VERDICT.EXIT,
      reason: 'Short call breached.',
      recommendedAction: 'Close or roll up and out for credit.',
    };
  }

  if (profitCapturePct >= 50) {
    return {
      state: VERDICT.TAKE_PROFIT,
      reason: `${profitCapturePct.toFixed(0)}% captured.`,
      recommendedAction: 'Close for profit.',
    };
  }

  if (shortDelta >= 0.35) {
    return {
      state: VERDICT.ACTION_NEEDED,
      reason: `Short call delta at ${shortDelta.toFixed(2)}.`,
      recommendedAction: 'Roll up and out for credit.',
    };
  }

  if (shortDelta >= 0.25 || dte <= 21) {
    return {
      state: VERDICT.MONITOR,
      reason: shortDelta >= 0.25 ? `Short call delta at ${shortDelta.toFixed(2)}.` : `${dte} DTE.`,
      recommendedAction: null,
    };
  }

  return onTrack(profitCapturePct);
}

function evaluateCalendarSpread(position, md) {
  const { profitCapturePct, priceDistSD, dte, ivCrush } = md;

  if (ivCrush || priceDistSD > 2) {
    return {
      state: VERDICT.EXIT,
      reason: ivCrush ? 'IV crush in long leg.' : `Price ${priceDistSD.toFixed(1)} SD from short strike.`,
      recommendedAction: 'Close — hard to defend.',
    };
  }

  if (profitCapturePct >= 25) {
    return {
      state: VERDICT.TAKE_PROFIT,
      reason: `${profitCapturePct.toFixed(0)}% of debit captured.`,
      recommendedAction: 'Close for profit.',
    };
  }

  if (priceDistSD > 1.5) {
    return {
      state: VERDICT.ACTION_NEEDED,
      reason: `Price ${priceDistSD.toFixed(1)} SD from short strike.`,
      recommendedAction: 'Close — hard to defend.',
    };
  }

  if (priceDistSD > 1) {
    return {
      state: VERDICT.MONITOR,
      reason: `Price ${priceDistSD.toFixed(1)} SD from short strike.`,
      recommendedAction: null,
    };
  }

  return onTrack(profitCapturePct);
}

function evaluateDoubleDiagonal(position, md) {
  const { profitCapturePct, priceAtNearWing, priceBeyondNearWing, vegaFlip, deepItm } = md;

  if (deepItm || vegaFlip) {
    return {
      state: VERDICT.EXIT,
      reason: deepItm ? 'Position deep ITM.' : 'Vega flip — long vol exposure reversed.',
      recommendedAction: 'Close threatened side, keep winner.',
    };
  }

  if (profitCapturePct >= 20) {
    return {
      state: VERDICT.TAKE_PROFIT,
      reason: `${profitCapturePct.toFixed(0)}% of debit captured.`,
      recommendedAction: 'Close for profit.',
    };
  }

  if (priceBeyondNearWing) {
    return {
      state: VERDICT.ACTION_NEEDED,
      reason: 'Price beyond near-wing.',
      recommendedAction: 'Close threatened side, keep winner.',
    };
  }

  if (priceAtNearWing) {
    return {
      state: VERDICT.MONITOR,
      reason: 'Price at near-wing boundary.',
      recommendedAction: null,
    };
  }

  return onTrack(profitCapturePct);
}

function evaluateBWBPut(position, md) {
  const { profitCapturePct, priceDistSD, priceBeyondBrokenWing, priceAtBrokenWing, debitToCreditFlip } = md;

  if (priceBeyondBrokenWing) {
    return {
      state: VERDICT.EXIT,
      reason: 'Price beyond broken wing.',
      recommendedAction: 'Close threatened wing.',
    };
  }

  if (profitCapturePct >= 25 || debitToCreditFlip) {
    return {
      state: VERDICT.TAKE_PROFIT,
      reason: debitToCreditFlip ? 'Debit→credit flip achieved.' : `${profitCapturePct.toFixed(0)}% captured.`,
      recommendedAction: 'Close for profit.',
    };
  }

  if (priceAtBrokenWing) {
    return {
      state: VERDICT.ACTION_NEEDED,
      reason: 'Price at broken wing.',
      recommendedAction: 'Close threatened wing.',
    };
  }

  if (priceDistSD <= 1) {
    return {
      state: VERDICT.MONITOR,
      reason: `Price within ${priceDistSD.toFixed(1)} SD of short strike.`,
      recommendedAction: null,
    };
  }

  return onTrack(profitCapturePct);
}

function evaluateBWBCall(position, md) {
  // Same logic as BWB Put — symmetric
  return evaluateBWBPut(position, md);
}

// Generic fallback — uses credit-trade defaults
function genericEvaluate(position, md) {
  const { profitCapturePct, shortDelta, dte, isBreached, lossMultiple } = md;

  if (isBreached || (lossMultiple && lossMultiple >= 1.5)) {
    return {
      state: VERDICT.EXIT,
      reason: isBreached ? 'Strike breached.' : `Loss at ${(lossMultiple || 0).toFixed(1)}× credit.`,
      recommendedAction: 'Close position.',
    };
  }

  if (profitCapturePct >= 50) {
    return {
      state: VERDICT.TAKE_PROFIT,
      reason: `${profitCapturePct.toFixed(0)}% captured.`,
      recommendedAction: 'Close for profit.',
    };
  }

  if (shortDelta && shortDelta >= 0.35) {
    return {
      state: VERDICT.ACTION_NEEDED,
      reason: `Short-side delta at ${shortDelta.toFixed(2)}.`,
      recommendedAction: 'Review adjustment options.',
    };
  }

  if ((shortDelta && shortDelta >= 0.25) || (dte != null && dte <= 21)) {
    return {
      state: VERDICT.MONITOR,
      reason: shortDelta >= 0.25 ? `Delta at ${shortDelta.toFixed(2)}.` : `${dte} DTE.`,
      recommendedAction: null,
    };
  }

  return onTrack(profitCapturePct);
}

function onTrack(profitCapturePct) {
  return {
    state: VERDICT.ON_TRACK,
    reason: `Position is within expected parameters — ${(profitCapturePct || 0).toFixed(0)}% toward target.`,
    recommendedAction: null,
  };
}

// ═══════════════════════════════════════════════════════════════
// Strategy → evaluator mapping
// ═══════════════════════════════════════════════════════════════

const STRATEGY_EVALUATORS = {
  'iron condor': evaluateIronCondor,
  'iron butterfly': evaluateIronButterfly,
  'bull put spread': evaluateBullPutSpread,
  'bear call spread': evaluateBearCallSpread,
  'bear put spread': evaluateBearCallSpread, // symmetric to bear call
  'calendar spread': evaluateCalendarSpread,
  'calendar': evaluateCalendarSpread,
  'single calendar': evaluateCalendarSpread,
  'double calendar': evaluateCalendarSpread,
  'double diagonal': evaluateDoubleDiagonal,
  'diagonal spread': evaluateDoubleDiagonal,
  'diagonal': evaluateDoubleDiagonal,
  'single diagonal': evaluateDoubleDiagonal,
  'bwb put': evaluateBWBPut,
  'broken wing butterfly put': evaluateBWBPut,
  'bwb call': evaluateBWBCall,
  'broken wing butterfly call': evaluateBWBCall,
  'butterfly': evaluateIronButterfly, // similar risk profile
  'covered call': evaluateBullPutSpread, // similar: short premium, bullish bias
  'covered call protective put': evaluateBullPutSpread,
  'collar': evaluateBullPutSpread,
  'jade lizard': evaluateIronCondor, // similar: multi-leg credit
  'straddle': evaluateIronButterfly, // similar: short ATM premium
  'strangle': evaluateIronCondor, // similar: short OTM premium
};

// ═══════════════════════════════════════════════════════════════
// Universal overrides (§9)
// ═══════════════════════════════════════════════════════════════

function applyOverrides(result, position, md) {
  let { state, reason, recommendedAction } = result;

  // Override 1: 21-DTE rule
  // Any short-premium trade at ≤21 DTE with <50% captured → escalate one level
  if (md.dte != null && md.dte <= 21 && md.profitCapturePct < 50 && isShortPremiumTrade(position)) {
    const escalated = escalate(state);
    if (PRIORITY[escalated] < PRIORITY[state]) {
      reason = `${reason} 21-DTE rule escalation: ${md.dte} DTE with only ${md.profitCapturePct.toFixed(0)}% captured.`;
      state = escalated;
    }
  }

  // Override 2: Earnings proximity
  // If earnings fall inside remaining DTE and weren't at entry → escalate one level
  if (md.nextEarningsDate && md.dte != null) {
    const earningsDate = new Date(md.nextEarningsDate);
    const expiryDate = new Date(position.expiry);
    const earningsInRange = earningsDate <= expiryDate && earningsDate >= new Date();

    if (earningsInRange && !position.earningsAtEntry) {
      const escalated = escalate(state);
      if (PRIORITY[escalated] < PRIORITY[state]) {
        reason = `${reason} Earnings proximity escalation: earnings on ${md.nextEarningsDate} falls inside DTE.`;
        state = escalated;
      }
    }
  }

  // Override 3: Vol regime shift
  // If IV rank moved >30 points from entry → minimum MONITOR
  if (position.entryIvRank != null && md.currentIvRank != null) {
    const ivShift = Math.abs(md.currentIvRank - position.entryIvRank);
    if (ivShift > 30 && PRIORITY[state] > PRIORITY[VERDICT.MONITOR]) {
      reason = `${reason} Vol regime shift: IV rank moved ${ivShift.toFixed(0)} points from entry.`;
      state = VERDICT.MONITOR;
    }
  }

  return { state, reason, recommendedAction };
}

function isShortPremiumTrade(position) {
  const s = normalizeStrategy(position.strategy);
  const shortPremiumStrategies = [
    'iron condor', 'iron butterfly', 'bull put spread', 'bear call spread',
    'covered call', 'covered call protective put', 'jade lizard',
    'straddle', 'strangle', 'collar',
  ];
  return shortPremiumStrategies.some(sp => s.includes(sp));
}

// ═══════════════════════════════════════════════════════════════
// Helper: build marketData from live hook data
// ═══════════════════════════════════════════════════════════════

/**
 * Build the marketData object expected by evaluate() from usePositionLiveData output.
 *
 * @param {object} liveData — from usePositionLiveData hook
 * @param {object} tile — tile object with legs and strategy
 * @param {object} opts — optional: { nextEarningsDate, currentIvRank }
 * @returns {object} marketData for evaluate()
 */
/**
 * Build the marketData object expected by evaluate() from usePositionLiveData output.
 *
 * @param {object} liveData — from usePositionLiveData hook
 * @param {object} tile — tile object with legs and strategy
 * @param {object} portfolioItem — portfolio document (for entry vega, sessionsBreached counter)
 * @param {object} opts — optional: { nextEarningsDate, currentIvRank }
 * @returns {object} marketData for evaluate()
 */
export function buildMarketData(liveData, tile, portfolioItem = null, opts = {}) {
  const legs = tile?.legs || [];
  const shortLegs = legs.filter(l => l.action === 'sell');
  const longLegs = legs.filter(l => l.action === 'buy');
  const liveGreeks = liveData.liveGreeks?.perLeg || [];
  const currentSpot = liveData.currentSpot || 0;
  const dte = liveData.dte;

  // ─── Short-side delta (highest absolute value among short legs) ───
  let shortDelta = 0;
  shortLegs.forEach(leg => {
    const legIndex = legs.indexOf(leg);
    const greeks = liveGreeks[legIndex];
    if (greeks && Math.abs(greeks.delta) > shortDelta) {
      shortDelta = Math.abs(greeks.delta);
    }
  });

  // ─── Breach and tested detection ───
  let isBreached = false;
  let isShortTested = false;
  shortLegs.forEach(leg => {
    if (leg.type === 'put' && currentSpot <= leg.strike) isBreached = true;
    if (leg.type === 'call' && currentSpot >= leg.strike) isBreached = true;
    const distPct = leg.strike > 0 ? Math.abs(currentSpot - leg.strike) / leg.strike : 1;
    if (distPct < 0.01) isShortTested = true;
  });

  // ─── sessionsBreached: read from Firestore counter on portfolioItem ───
  // Managed by useVerdict hook — incremented when breached, reset when not.
  const sessionsBreached = portfolioItem?.sessionsBreached || 0;

  // ─── Loss multiple ───
  const entryCredit = Math.abs(liveData.pnlResult?.entryNetCredit || 0);
  const lossMultiple = entryCredit > 0 && liveData.pnlPerContract < 0
    ? Math.abs(liveData.pnlPerContract) / entryCredit
    : 0;

  // ─── priceDistSD: (spot - shortStrike) / (spot × IV × √(DTE/365)) ───
  // Uses the short leg closest to spot
  let priceDistSD = 0;
  if (currentSpot > 0 && dte != null && dte > 0 && shortLegs.length > 0) {
    let closestShort = shortLegs[0];
    let minDist = Infinity;
    shortLegs.forEach(leg => {
      const d = Math.abs(currentSpot - leg.strike);
      if (d < minDist) { minDist = d; closestShort = leg; }
    });
    const iv = closestShort.iv || 0.25; // default 25% if missing
    const denominator = currentSpot * iv * Math.sqrt(dte / 365);
    if (denominator > 0) {
      priceDistSD = Math.abs(currentSpot - closestShort.strike) / denominator;
    }
  }

  // ─── ivCrush: (entryIv - currentIv) / entryIv, threshold 0.4 ───
  // Checks long legs — IV crush hurts long premium (calendars, diagonals)
  let ivCrush = false;
  longLegs.forEach(leg => {
    const legIndex = legs.indexOf(leg);
    const greeks = liveGreeks[legIndex];
    const entryIv = leg.iv || 0;
    // Estimate current IV from vega + price movement (rough proxy)
    // If we have per-leg Greeks, vega direction indicates IV state
    // For now: if entry IV exists and leg has vega, check ratio
    if (entryIv > 0 && greeks) {
      // Use the fact that vega decreases as IV drops
      // Heuristic: if vega is much smaller than expected, IV has crushed
      // Better approach when we have actual current IV per leg from R2
      const currentIvEstimate = entryIv * (1 - 0.01 * Math.max(0, (portfolioItem?.entryIvRank || 50) - (opts.currentIvRank || 50)));
      if (currentIvEstimate > 0) {
        const crushRatio = (entryIv - currentIvEstimate) / entryIv;
        if (crushRatio >= 0.4) ivCrush = true;
      }
    }
  });

  // ─── vegaFlip: sign change of position net vega vs entry vega ───
  let vegaFlip = false;
  const currentNetVega = liveData.liveGreeks?.net?.vega || 0;
  // At entry, calendars/diagonals are long vega (positive). If net vega flips negative, thesis breaks.
  const entryNetVega = computeEntryNetVega(legs);
  if (entryNetVega !== 0 && currentNetVega !== 0) {
    vegaFlip = Math.sign(entryNetVega) !== Math.sign(currentNetVega);
  }

  // ─── nextEarningsDate: read from tile if pipeline populates it ───
  const nextEarningsDate = opts.nextEarningsDate ?? tile?.nextEarningsDate ?? null;

  // ─── BWB-specific: broken wing detection ───
  let priceAtBrokenWing = false;
  let priceBeyondBrokenWing = false;
  const strategy = normalizeStrategy(tile?.strategy);
  if (strategy.includes('bwb') || strategy.includes('broken wing') || strategy.includes('butterfly')) {
    // The broken wing is the long leg furthest from spot
    const longStrikes = longLegs.map(l => l.strike).filter(s => s > 0);
    if (longStrikes.length > 0 && currentSpot > 0) {
      const brokenWingStrike = longStrikes.reduce((furthest, s) =>
        Math.abs(s - currentSpot) > Math.abs(furthest - currentSpot) ? s : furthest
      );
      const distPct = Math.abs(currentSpot - brokenWingStrike) / brokenWingStrike;
      priceAtBrokenWing = distPct < 0.02;
      // Beyond = past the broken wing (put BWB: spot below, call BWB: spot above)
      const isPutBWB = longLegs.some(l => l.type === 'put');
      priceBeyondBrokenWing = isPutBWB
        ? currentSpot < brokenWingStrike
        : currentSpot > brokenWingStrike;
    }
  }

  // ─── debitToCreditFlip: position started as debit, now has credit value ───
  const entryNetCredit = (liveData.pnlResult?.entryNetCredit || 0) / 100;
  const debitToCreditFlip = entryNetCredit < 0 && liveData.pnlPerContract > 0;

  // ─── Double diagonal specifics ───
  let priceAtNearWing = false;
  let priceBeyondNearWing = false;
  let deepItm = false;
  if (strategy.includes('diagonal') || strategy.includes('double')) {
    // Near wing = the short leg closest to current spot
    if (shortLegs.length > 0 && currentSpot > 0) {
      const nearShort = shortLegs.reduce((closest, leg) =>
        Math.abs(leg.strike - currentSpot) < Math.abs(closest.strike - currentSpot) ? leg : closest
      );
      const distPct = Math.abs(currentSpot - nearShort.strike) / nearShort.strike;
      priceAtNearWing = distPct < 0.02;
      // Beyond = price has crossed the short strike
      priceBeyondNearWing = (nearShort.type === 'put' && currentSpot < nearShort.strike)
        || (nearShort.type === 'call' && currentSpot > nearShort.strike);
      // Deep ITM = price more than 5% past any short strike
      deepItm = shortLegs.some(leg => {
        if (leg.type === 'put') return currentSpot < leg.strike * 0.95;
        if (leg.type === 'call') return currentSpot > leg.strike * 1.05;
        return false;
      });
    }
  }

  return {
    currentSpot,
    dte,
    shortDelta,
    profitCapturePct: liveData.profitCapturePct || 0,
    isBreached,
    isShortTested,
    sessionsBreached,
    lossMultiple,
    currentIvRank: opts.currentIvRank ?? null,
    nextEarningsDate,
    priceDistSD,
    ivCrush,
    priceAtBrokenWing,
    priceBeyondBrokenWing,
    debitToCreditFlip,
    priceAtNearWing,
    priceBeyondNearWing,
    vegaFlip,
    deepItm,
  };
}

/** Compute entry net vega from leg definitions (positive = long vega). */
function computeEntryNetVega(legs) {
  // Heuristic: long legs contribute positive vega, short legs negative
  // Calendars/diagonals: long further-dated = more vega → net positive at entry
  let netVega = 0;
  legs.forEach(leg => {
    // Use IV as rough vega proxy — higher IV = more vega
    const vegaContrib = leg.iv || 0.25;
    netVega += leg.action === 'buy' ? vegaContrib : -vegaContrib;
  });
  return netVega;
}
