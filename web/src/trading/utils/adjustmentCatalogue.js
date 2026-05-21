/**
 * Adjustment Catalogue — valid adjustments per strategy.
 *
 * Implements brief §10.5 (catalogue) and §10.6 (scoring).
 * Pure functions — no side effects, no UI, no Firestore.
 *
 * getValidAdjustments(position, marketData) → AdjustmentPreview[]
 * computeAdjustment(position, marketData, adjustmentType) → AdjustmentPreview
 */

// ═══════════════════════════════════════════════════════════════
// Types and constants
// ═══════════════════════════════════════════════════════════════

/**
 * @typedef {object} AdjustmentPreview
 * @property {string} type — unique key for this adjustment
 * @property {string} label — human-readable name
 * @property {string} description — what happens if you pick this (one sentence)
 * @property {string} verdictPill — one of PILL types below
 * @property {number} netCost — positive = debit, negative = credit. Per contract in dollars.
 * @property {number} newProbability — estimated probability of profit after adjustment (0-100)
 * @property {number} newMaxLoss — new max loss after adjustment. Per contract in dollars.
 * @property {object[]} newLegs — proposed new leg structure (same shape as tile.legs)
 * @property {number} improvementRatio — (prob_after - prob_before) / |net_cost|
 * @property {boolean} isRecommended — true for the top-scoring adjustment
 */

export const PILL = {
  RECOMMENDED: 'recommended',   // green solid — highest-scoring
  SMART_ROLL: 'smart_roll',     // green — passes improvement ratio threshold
  MARGINAL: 'marginal',         // amber — passes validity but below threshold
  DEFENSIVE: 'defensive',       // blue — reduces loss exposure without profit aim
  DIRECTIONAL_PIVOT: 'directional_pivot', // purple — changes thesis
  CLEAN_EXIT: 'clean_exit',     // gray — take the known loss
  HIGH_RISK: 'high_risk',       // red — hold & monitor (passive choice with worst-case consequences)
};

// Improvement ratio thresholds (§10.6)
const SMART_THRESHOLD = 0.30;
const SMART_PROB_MIN = 55;
const MARGINAL_THRESHOLD = 0.15;
const MARGINAL_PROB_MIN = 50;

// ═══════════════════════════════════════════════════════════════
// Main entry point
// ═══════════════════════════════════════════════════════════════

/**
 * Returns all valid adjustments for a position, scored and sorted.
 * The first item (if not Hold & monitor) is marked isRecommended.
 *
 * @param {object} position — portfolio item with tile merged
 * @param {object} marketData — from buildMarketData()
 * @returns {AdjustmentPreview[]}
 */
export function getValidAdjustments(position, marketData) {
  const strategy = normalizeStrategy(position.strategy);
  const catalogue = STRATEGY_CATALOGUES[strategy];

  if (!catalogue) {
    // Unknown strategy — return close + hold only
    return scoreAndSort([
      buildCloseEntire(position, marketData),
      buildHoldAndMonitor(position, marketData),
    ], position, marketData);
  }

  const adjustments = catalogue(position, marketData);
  return scoreAndSort(adjustments, position, marketData);
}

/**
 * Compute a single adjustment preview by type.
 *
 * @param {object} position
 * @param {object} marketData
 * @param {string} adjustmentType — e.g. 'roll_tested_up_out'
 * @returns {AdjustmentPreview|null}
 */
export function computeAdjustment(position, marketData, adjustmentType) {
  const all = getValidAdjustments(position, marketData);
  return all.find(a => a.type === adjustmentType) || null;
}

// ═══════════════════════════════════════════════════════════════
// Per-strategy catalogues (§10.5)
// ═══════════════════════════════════════════════════════════════

function ironCondorCatalogue(pos, md) {
  const testedSide = getTestedSide(pos, md);

  const adjustments = [
    buildRollTestedUpAndOut(pos, md, testedSide),
    buildRollTestedFurtherOTM(pos, md, testedSide),
    buildRollTestedOutOnly(pos, md, testedSide),
    buildCloseTestedSide(pos, md, testedSide),
    // Active defence: roll the untested (put) side up to re-collect credit
    // Only offered when call side is tested (put side has decayed)
    ...(testedSide === 'call' ? [buildRollPutSideUp(pos, md)] : []),
    buildCloseEntire(pos, md),
    buildHoldAndMonitor(pos, md),
  ];

  // Disallowed: rolling both sides simultaneously (§10.5)
  // Disallowed: convert to vertical — thesis shifts go through Discover → Build as a fresh trade
  return adjustments;
}

function ironButterflyCatalogue(pos, md) {
  return [
    buildCloseEntire(pos, md),
    buildHoldAndMonitor(pos, md),
  ];
  // Disallowed: mid-trade strike rolls (§10.5)
  // Disallowed: widen to condor — IB trades that go wrong are close-and-walk in practice
}

function bullPutSpreadCatalogue(pos, md) {
  return [
    buildRollDownAndOut(pos, md),
    buildRollOutOnly(pos, md, 'put'),
    buildCloseEntire(pos, md),
    buildHoldAndMonitor(pos, md),
  ];
  // Disallowed: converting to IC at a loss (§10.5)
}

function bearCallSpreadCatalogue(pos, md) {
  return [
    buildRollUpAndOut(pos, md),
    buildRollOutOnly(pos, md, 'call'),
    buildCloseEntire(pos, md),
    buildHoldAndMonitor(pos, md),
  ];
  // Disallowed: converting to IC at a loss (§10.5)
}

function bwbCatalogue(pos, md) {
  return [
    buildCloseThreatenedWing(pos, md),
    buildCloseEntire(pos, md),
    buildHoldAndMonitor(pos, md),
  ];
  // Disallowed: closing individual legs piecemeal (§10.5)
  // Disallowed: roll entire structure out — slippage cost exceeds savings in practice
}

function calendarCatalogue(pos, md) {
  return [
    buildRollShortLegOut(pos, md),
    buildCloseEntire(pos, md),
    buildHoldAndMonitor(pos, md),
  ];
  // Disallowed: adjusting the long leg (§10.5)
}

function doubleDiagonalCatalogue(pos, md) {
  const testedSide = getTestedSide(pos, md);

  return [
    buildCloseThreatenedSide(pos, md, testedSide),
    buildRollThreatenedSideOut(pos, md, testedSide),
    buildCloseEntire(pos, md),
    buildHoldAndMonitor(pos, md),
  ];
  // Disallowed: adjusting both sides simultaneously (§10.5)
}

// ═══════════════════════════════════════════════════════════════
// Strategy → catalogue mapping
// ═══════════════════════════════════════════════════════════════

const STRATEGY_CATALOGUES = {
  'iron condor': ironCondorCatalogue,
  'iron butterfly': ironButterflyCatalogue,
  'bull put spread': bullPutSpreadCatalogue,
  'bear call spread': bearCallSpreadCatalogue,
  'bear put spread': bearCallSpreadCatalogue,
  'bwb put': bwbCatalogue,
  'broken wing butterfly put': bwbCatalogue,
  'bwb call': bwbCatalogue,
  'broken wing butterfly call': bwbCatalogue,
  'butterfly': ironButterflyCatalogue,
  'calendar spread': calendarCatalogue,
  'calendar': calendarCatalogue,
  'single calendar': calendarCatalogue,
  'double calendar': calendarCatalogue,
  'double diagonal': doubleDiagonalCatalogue,
  'diagonal spread': doubleDiagonalCatalogue,
  'diagonal': doubleDiagonalCatalogue,
  'single diagonal': doubleDiagonalCatalogue,
  'covered call': bullPutSpreadCatalogue,
  'covered call protective put': bullPutSpreadCatalogue,
  'collar': bullPutSpreadCatalogue,
  'jade lizard': ironCondorCatalogue,
  'straddle': ironButterflyCatalogue,
  'strangle': ironCondorCatalogue,
};

// ═══════════════════════════════════════════════════════════════
// Adjustment builders — each returns an AdjustmentPreview
// ═══════════════════════════════════════════════════════════════

function buildRollTestedUpAndOut(pos, md, testedSide) {
  const shortLeg = getTestedShortLeg(pos, md, testedSide);
  const rollCredit = estimateRollCredit(pos, md, shortLeg, { strikeShift: true, expiryShift: true });
  const newProb = estimateNewProbability(pos, md, { strikeShift: 5, expiryShift: 7 });

  return {
    type: 'roll_tested_up_out',
    label: `Roll ${testedSide} side further OTM & out`,
    description: `Move the ${testedSide} spread further from spot and extend expiry by ~1 week for a ${rollCredit >= 0 ? 'credit' : 'debit'}.`,
    netCost: rollCredit,
    newProbability: newProb,
    newMaxLoss: estimateNewMaxLoss(pos, md, rollCredit),
    newLegs: computeRollTestedLegs(pos, testedSide, { strikeShift: true, expiryShift: true }),
    improvementRatio: 0,
    verdictPill: PILL.MARGINAL,
    isRecommended: false,
  };
}

function buildRollTestedFurtherOTM(pos, md, testedSide) {
  const shortLeg = getTestedShortLeg(pos, md, testedSide);
  const rollCredit = estimateRollCredit(pos, md, shortLeg, { strikeShift: true, expiryShift: false });
  const newProb = estimateNewProbability(pos, md, { strikeShift: 5, expiryShift: 0 });

  return {
    type: 'roll_tested_otm',
    label: `Roll ${testedSide} side further OTM`,
    description: `Move the ${testedSide} spread further from spot, same expiry. Usually a debit.`,
    netCost: rollCredit,
    newProbability: newProb,
    newMaxLoss: estimateNewMaxLoss(pos, md, rollCredit),
    newLegs: computeRollTestedLegs(pos, testedSide, { strikeShift: true, expiryShift: false }),
    improvementRatio: 0,
    verdictPill: PILL.MARGINAL,
    isRecommended: false,
  };
}

function buildRollTestedOutOnly(pos, md, testedSide) {
  const shortLeg = getTestedShortLeg(pos, md, testedSide);
  const rollCredit = estimateRollCredit(pos, md, shortLeg, { strikeShift: false, expiryShift: true });
  const newProb = estimateNewProbability(pos, md, { strikeShift: 0, expiryShift: 7 });

  return {
    type: 'roll_tested_out',
    label: `Roll ${testedSide} side out to next expiry`,
    description: `Extend the ${testedSide} spread to next weekly expiry, same strikes. Usually a small credit.`,
    netCost: rollCredit,
    newProbability: newProb,
    newMaxLoss: estimateNewMaxLoss(pos, md, rollCredit),
    newLegs: computeRollTestedLegs(pos, testedSide, { strikeShift: false, expiryShift: true }),
    improvementRatio: 0,
    verdictPill: PILL.MARGINAL,
    isRecommended: false,
  };
}

function buildCloseTestedSide(pos, md, testedSide) {
  const closeCost = estimateCloseCost(pos, md, testedSide);

  return {
    type: 'close_tested_side',
    label: `Close ${testedSide} side only`,
    description: `Buy back the ${testedSide} spread. Leaves the profitable side open.`,
    netCost: closeCost,
    newProbability: 90,
    newMaxLoss: estimateRemainingMaxLoss(pos, md, testedSide),
    newLegs: computeCloseSideLegs(pos, testedSide),
    improvementRatio: 0,
    verdictPill: PILL.DEFENSIVE,
    isRecommended: false,
  };
}

// buildConvertToVertical removed — thesis shifts go through Discover → Build as a fresh trade (Phase 6b review)

function buildRollPutSideUp(pos, md) {
  const proposedLegs = computeRollPutSideUpLegs(pos, md);
  const newPutLegs = proposedLegs.filter(l => (l.type || '').toLowerCase() === 'put');
  const shortPut = newPutLegs.find(l => (l.action || '').toLowerCase() === 'sell');
  const shortStrike = shortPut?.strike || 0;

  // Net cost estimate: closing nearly-worthless puts collects credit,
  // opening new higher puts collects additional credit (minus long cost)
  const oldPutCredit = estimateCloseCost(pos, md, 'put'); // credit from closing old puts
  const newSpreadCredit = estimateRollCredit(pos, md, null, { strikeShift: false, expiryShift: false });
  const netCost = oldPutCredit + newSpreadCredit; // usually net credit

  // Probability: chance spot stays above new short put by expiry
  const spot = md.currentSpot || 0;
  const buffer = spot > 0 && shortStrike > 0 ? ((spot - shortStrike) / spot) * 100 : 10;
  const newProb = Math.min(85, Math.max(30, 50 + buffer * 2));

  // Max loss warning: new spread width + call-side current loss can exceed original max loss
  const spreadWidth = 5 * 100; // $5 spread = $500
  const currentCallLoss = Math.abs(md.lossMultiple || 0) * Math.abs((pos.entryNetCredit || 0) / 100);
  const newMaxLoss = spreadWidth + currentCallLoss;

  return {
    type: 'roll_put_side_up',
    label: 'Roll put side up (active bullish defence)',
    description: `Close worthless put spread, open new $${shortStrike} put spread closer to spot. Collects fresh credit on a bullish defence. Higher risk if ${pos.legs?.[0]?.symbol || 'underlying'} retraces below $${shortStrike}.`,
    netCost,
    newProbability: newProb,
    newMaxLoss: Math.round(newMaxLoss),
    newLegs: proposedLegs,
    improvementRatio: 0,
    verdictPill: PILL.DIRECTIONAL_PIVOT,
    isRecommended: false,
  };
}

function buildConvertToCondor(pos, md) {
  return {
    type: 'convert_to_condor',
    label: 'Widen wings to Iron Condor',
    description: 'Move the short strikes apart to create an Iron Condor with a wider profit zone. Usually a debit.',
    netCost: estimateWidenCost(pos, md),
    newProbability: estimateNewProbability(pos, md, { widenWings: true }),
    newMaxLoss: pos.maxLoss || 0, // Approximately same
    newLegs: [],
    improvementRatio: 0,
    verdictPill: PILL.MARGINAL,
    isRecommended: false,
  };
}

function buildRollDownAndOut(pos, md) {
  const rollCredit = estimateRollCredit(pos, md, getShortPutLeg(pos), { strikeShift: true, expiryShift: true });
  const newProb = estimateNewProbability(pos, md, { strikeShift: 5, expiryShift: 7 });

  return {
    type: 'roll_down_out',
    label: 'Roll down and out',
    description: 'Move the put spread to lower strikes and a later expiry for credit.',
    netCost: rollCredit,
    newProbability: newProb,
    newMaxLoss: estimateNewMaxLoss(pos, md, rollCredit),
    newLegs: computeRollDownOutLegs(pos),
    improvementRatio: 0,
    verdictPill: PILL.MARGINAL,
    isRecommended: false,
  };
}

function buildRollUpAndOut(pos, md) {
  const rollCredit = estimateRollCredit(pos, md, getShortCallLeg(pos), { strikeShift: true, expiryShift: true });
  const newProb = estimateNewProbability(pos, md, { strikeShift: 5, expiryShift: 7 });

  return {
    type: 'roll_up_out',
    label: 'Roll up and out',
    description: 'Move the call spread to higher strikes and a later expiry for credit.',
    netCost: rollCredit,
    newProbability: newProb,
    newMaxLoss: estimateNewMaxLoss(pos, md, rollCredit),
    newLegs: computeRollUpOutLegs(pos),
    improvementRatio: 0,
    verdictPill: PILL.MARGINAL,
    isRecommended: false,
  };
}

function buildRollOutOnly(pos, md, type) {
  const shortLeg = type === 'put' ? getShortPutLeg(pos) : getShortCallLeg(pos);
  const rollCredit = estimateRollCredit(pos, md, shortLeg, { strikeShift: false, expiryShift: true });
  const newProb = estimateNewProbability(pos, md, { strikeShift: 0, expiryShift: 7 });

  return {
    type: 'roll_out_only',
    label: 'Roll to further expiry only',
    description: 'Extend to next expiry at same strikes. Collects additional time premium.',
    netCost: rollCredit,
    newProbability: newProb,
    newMaxLoss: estimateNewMaxLoss(pos, md, rollCredit),
    newLegs: computeRollOutOnlyLegs(pos),
    improvementRatio: 0,
    verdictPill: PILL.MARGINAL,
    isRecommended: false,
  };
}

function buildCloseThreatenedWing(pos, md) {
  const testedSide = getTestedSide(pos, md);
  return {
    type: 'close_threatened_wing',
    label: 'Close threatened wing',
    description: 'Buy back the wing under pressure. Caps further loss on that side.',
    netCost: estimateCloseCost(pos, md, testedSide),
    newProbability: 85,
    newMaxLoss: 0,
    newLegs: computeCloseSideLegs(pos, testedSide),
    improvementRatio: 0,
    verdictPill: PILL.DEFENSIVE,
    isRecommended: false,
  };
}

function buildRollEntireOut(pos, md) {
  const rollCredit = estimateRollCredit(pos, md, null, { strikeShift: false, expiryShift: true, allLegs: true });

  return {
    type: 'roll_entire_out',
    label: 'Roll entire structure out',
    description: 'Extend all legs to next expiry. Gives more time for thesis to play out.',
    netCost: rollCredit,
    newProbability: estimateNewProbability(pos, md, { expiryShift: 7 }),
    newMaxLoss: pos.maxLoss || 0,
    newLegs: [],
    improvementRatio: 0,
    verdictPill: PILL.MARGINAL,
    isRecommended: false,
  };
}

function buildRollShortLegOut(pos, md) {
  const shortLeg = (pos.legs || []).find(l => l.action === 'sell');
  const rollCredit = estimateRollCredit(pos, md, shortLeg, { strikeShift: false, expiryShift: true });

  return {
    type: 'roll_short_out',
    label: 'Roll short leg out',
    description: 'Close the near-term short and sell the next weekly at same strike. Collects time premium.',
    netCost: rollCredit,
    newProbability: estimateNewProbability(pos, md, { expiryShift: 7 }),
    newMaxLoss: pos.maxLoss || 0,
    newLegs: computeRollShortOutLegs(pos),
    improvementRatio: 0,
    verdictPill: PILL.MARGINAL,
    isRecommended: false,
  };
}

function buildCloseThreatenedSide(pos, md, testedSide) {
  return {
    type: 'close_threatened_side',
    label: `Close threatened ${testedSide} side`,
    description: `Close the ${testedSide} side legs. Keep the profitable side running.`,
    netCost: estimateCloseCost(pos, md, testedSide),
    newProbability: 85,
    newMaxLoss: estimateRemainingMaxLoss(pos, md, testedSide),
    newLegs: computeCloseSideLegs(pos, testedSide),
    improvementRatio: 0,
    verdictPill: PILL.DEFENSIVE,
    isRecommended: false,
  };
}

function buildRollThreatenedSideOut(pos, md, testedSide) {
  const rollCredit = estimateRollCredit(pos, md, null, { strikeShift: false, expiryShift: true, side: testedSide });

  return {
    type: 'roll_threatened_out',
    label: `Roll threatened ${testedSide} side out`,
    description: `Extend the ${testedSide} side to next expiry. More time for price to recover.`,
    netCost: rollCredit,
    newProbability: estimateNewProbability(pos, md, { expiryShift: 7 }),
    newMaxLoss: pos.maxLoss || 0,
    newLegs: computeRollTestedLegs(pos, testedSide, { strikeShift: false, expiryShift: true }),
    improvementRatio: 0,
    verdictPill: PILL.MARGINAL,
    isRecommended: false,
  };
}

// ─── Always-present adjustments ───

function buildCloseEntire(pos, md) {
  const currentPnl = md.profitCapturePct || 0;
  const pnlDollars = (pos.entryNetCredit || 0) / 100 * (currentPnl / 100);

  return {
    type: 'close_entire',
    label: 'Close entire position',
    description: `Close all legs now. ${pnlDollars >= 0 ? 'Lock in' : 'Realize'} current P&L.`,
    netCost: 0, // Closing cost is just the current value
    newProbability: 100, // Certainty — position is closed
    newMaxLoss: 0,
    newLegs: [],
    improvementRatio: 0,
    verdictPill: PILL.CLEAN_EXIT,
    isRecommended: false,
  };
}

function buildHoldAndMonitor(pos, md) {
  return {
    type: 'hold_and_monitor',
    label: 'Hold & monitor',
    description: 'Take no action. Accept the risk of further deterioration.',
    netCost: 0,
    newProbability: md.profitCapturePct > 0 ? Math.max(30, 100 - md.profitCapturePct) : 30,
    newMaxLoss: pos.maxLoss || 0,
    newLegs: pos.legs || [],
    improvementRatio: 0,
    verdictPill: PILL.HIGH_RISK,
    isRecommended: false,
  };
}

// ═══════════════════════════════════════════════════════════════
// Scoring (§10.6)
// ═══════════════════════════════════════════════════════════════

function scoreAndSort(adjustments, pos, md) {
  const currentProb = md.profitCapturePct > 0
    ? Math.min(100, 50 + md.profitCapturePct / 2)
    : Math.max(10, 50 + md.profitCapturePct / 2);

  // Score each adjustment
  adjustments.forEach(adj => {
    if (adj.type === 'hold_and_monitor' || adj.type === 'close_entire') {
      // These have fixed pills — don't re-score
      return;
    }

    const probGain = (adj.newProbability || 50) - currentProb;
    const cost = Math.abs(adj.netCost) || 1; // avoid division by zero
    adj.improvementRatio = probGain / cost;

    // Assign pill based on thresholds (§10.6)
    if (adj.verdictPill === PILL.DEFENSIVE || adj.verdictPill === PILL.DIRECTIONAL_PIVOT) {
      // Keep assigned pill — these are structural, not scored
      return;
    }

    if (adj.improvementRatio >= SMART_THRESHOLD && adj.newProbability >= SMART_PROB_MIN) {
      adj.verdictPill = PILL.SMART_ROLL;
    } else if (adj.improvementRatio >= MARGINAL_THRESHOLD || adj.newProbability >= MARGINAL_PROB_MIN) {
      adj.verdictPill = PILL.MARGINAL;
    }
    // Below both thresholds: stays MARGINAL (still shown, never recommended)
  });

  // Sort: smart > defensive > directional > marginal > clean_exit > high_risk
  const pillOrder = {
    [PILL.SMART_ROLL]: 0,
    [PILL.DEFENSIVE]: 1,
    [PILL.DIRECTIONAL_PIVOT]: 2,
    [PILL.MARGINAL]: 3,
    [PILL.CLEAN_EXIT]: 4,
    [PILL.HIGH_RISK]: 5,
  };

  adjustments.sort((a, b) => {
    const oa = pillOrder[a.verdictPill] ?? 3;
    const ob = pillOrder[b.verdictPill] ?? 3;
    if (oa !== ob) return oa - ob;
    return (b.improvementRatio || 0) - (a.improvementRatio || 0);
  });

  // Mark the recommended adjustment (§10.6)
  // Never recommend Hold & monitor. If no better option, recommend Close entire.
  const recommended = adjustments.find(a =>
    a.type !== 'hold_and_monitor' && a.type !== 'close_entire'
  );
  if (recommended && recommended.verdictPill !== PILL.HIGH_RISK) {
    recommended.verdictPill = PILL.RECOMMENDED;
    recommended.isRecommended = true;
  } else {
    // Fall back: recommend Close entire
    const closeAdj = adjustments.find(a => a.type === 'close_entire');
    if (closeAdj) {
      closeAdj.isRecommended = true;
      closeAdj.verdictPill = PILL.RECOMMENDED;
    }
  }

  return adjustments;
}

// ═══════════════════════════════════════════════════════════════
// Estimation helpers
// ═══════════════════════════════════════════════════════════════

function normalizeStrategy(strategy) {
  if (!strategy) return 'unknown';
  return strategy.toLowerCase().replace(/_/g, ' ').trim();
}

function getTestedSide(pos, md) {
  const legs = pos.legs || [];
  const spot = md.currentSpot || 0;
  const shortPuts = legs.filter(l => l.action === 'sell' && l.type === 'put');
  const shortCalls = legs.filter(l => l.action === 'sell' && l.type === 'call');

  if (shortPuts.length === 0 && shortCalls.length === 0) return 'put';

  // The tested side is the one whose short strike is closer to spot
  const putDist = shortPuts.length > 0
    ? Math.min(...shortPuts.map(l => Math.abs(spot - l.strike)))
    : Infinity;
  const callDist = shortCalls.length > 0
    ? Math.min(...shortCalls.map(l => Math.abs(spot - l.strike)))
    : Infinity;

  return putDist < callDist ? 'put' : 'call';
}

function getTestedShortLeg(pos, md, side) {
  const legs = pos.legs || [];
  return legs.find(l => l.action === 'sell' && l.type === side) || legs[0];
}

function getShortPutLeg(pos) {
  return (pos.legs || []).find(l => l.action === 'sell' && l.type === 'put');
}

function getShortCallLeg(pos) {
  return (pos.legs || []).find(l => l.action === 'sell' && l.type === 'call');
}

/**
 * Estimate roll credit/debit.
 * Positive = credit received, negative = debit paid.
 * Rough model: rolling further OTM costs ~30% of spread width per $5 shift.
 * Rolling out in time collects ~40% of original credit per week.
 */
function estimateRollCredit(pos, md, shortLeg, opts = {}) {
  const entryCredit = Math.abs((pos.entryNetCredit || 0) / 100); // per-share
  let credit = 0;

  if (opts.expiryShift) {
    // Rolling out collects additional time premium
    credit += entryCredit * 0.35;
  }

  if (opts.strikeShift) {
    // Rolling strikes further OTM costs money (buying back closer, selling further)
    credit -= entryCredit * 0.25;
  }

  // Convert to per-contract dollars
  return Math.round(credit * 100);
}

/**
 * Estimate new probability after adjustment.
 * Rough model: each $5 OTM shift adds ~5% probability.
 * Each week of additional time adds ~3% probability.
 */
function estimateNewProbability(pos, md, opts = {}) {
  const currentProb = md.profitCapturePct > 0 ? 55 : 40;
  let probBoost = 0;

  if (opts.strikeShift) probBoost += (opts.strikeShift || 5) * 1.0;
  if (opts.expiryShift) probBoost += (opts.expiryShift || 7) * 0.5;
  if (opts.widenWings) probBoost += 10;
  if (opts.directional) return 45; // Directional pivot — lower prob, different thesis

  return Math.min(90, Math.max(20, currentProb + probBoost));
}

function estimateNewMaxLoss(pos, md, rollCredit) {
  const currentMaxLoss = pos.maxLoss || 0;
  // Debit rolls increase max loss, credit rolls decrease it
  return Math.max(0, currentMaxLoss - rollCredit);
}

function estimateCloseCost(pos, md, side) {
  const legs = pos.legs || [];
  const sideLegs = legs.filter(l => l.type === side);
  // Rough estimate: close cost is proportional to how much value remains
  const entryCredit = Math.abs((pos.entryNetCredit || 0) / 100);
  const retained = md.profitCapturePct > 0 ? entryCredit * (1 - md.profitCapturePct / 100) : entryCredit * 1.2;
  return -Math.round(retained * 50); // Half the total value for one side, in dollars
}

function estimateRemainingMaxLoss(pos, md, closedSide) {
  // After closing one side, remaining max loss is roughly half
  return Math.round((pos.maxLoss || 0) * 0.5);
}

function estimateWidenCost(pos, md) {
  const entryCredit = Math.abs((pos.entryNetCredit || 0) / 100);
  return -Math.round(entryCredit * 30); // Widening wings is a debit
}

// ═══════════════════════════════════════════════════════════════
// Proposed leg computation — generates what the position would
// look like AFTER the adjustment is applied
// ═══════════════════════════════════════════════════════════════

const STRIKE_SHIFT = 5;     // $5 per shift step (standard options chain increment)
const EXPIRY_SHIFT_DAYS = 7; // 1 week forward

function shiftExpiry(expiry, days) {
  if (!expiry) return expiry;
  const d = new Date(expiry + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

/** Roll tested side: shift strikes further OTM + optionally extend expiry */
function computeRollTestedLegs(pos, testedSide, { strikeShift = false, expiryShift = false }) {
  const legs = pos.legs || [];
  return legs.map(leg => {
    const isTestedSide = (leg.type || '').toLowerCase() === testedSide;
    if (!isTestedSide) return { ...leg }; // untested side unchanged

    const newLeg = { ...leg };
    if (strikeShift) {
      // Move further OTM: puts go lower, calls go higher
      if (testedSide === 'put') newLeg.strike = leg.strike - STRIKE_SHIFT;
      else newLeg.strike = leg.strike + STRIKE_SHIFT;
    }
    if (expiryShift) {
      newLeg.expiry = shiftExpiry(leg.expiry || pos.expiry, EXPIRY_SHIFT_DAYS);
    }
    return newLeg;
  });
}

/** Close one side: keep only the opposite side's legs */
function computeCloseSideLegs(pos, sideToClose) {
  return (pos.legs || []).filter(leg => (leg.type || '').toLowerCase() !== sideToClose);
}

/** Roll entire structure out: same strikes, later expiry on all legs */
function computeRollAllOutLegs(pos) {
  return (pos.legs || []).map(leg => ({
    ...leg,
    expiry: shiftExpiry(leg.expiry || pos.expiry, EXPIRY_SHIFT_DAYS),
  }));
}

/** Roll short leg out (calendars): same strike, later expiry on sell legs only */
function computeRollShortOutLegs(pos) {
  return (pos.legs || []).map(leg => {
    if ((leg.action || '').toLowerCase() === 'sell') {
      return { ...leg, expiry: shiftExpiry(leg.expiry || pos.expiry, EXPIRY_SHIFT_DAYS) };
    }
    return { ...leg };
  });
}

/** Roll down and out (bull put): shift put strikes lower + extend expiry */
function computeRollDownOutLegs(pos) {
  return (pos.legs || []).map(leg => ({
    ...leg,
    strike: leg.strike - STRIKE_SHIFT,
    expiry: shiftExpiry(leg.expiry || pos.expiry, EXPIRY_SHIFT_DAYS),
  }));
}

/** Roll up and out (bear call): shift call strikes higher + extend expiry */
function computeRollUpOutLegs(pos) {
  return (pos.legs || []).map(leg => ({
    ...leg,
    strike: leg.strike + STRIKE_SHIFT,
    expiry: shiftExpiry(leg.expiry || pos.expiry, EXPIRY_SHIFT_DAYS),
  }));
}

/** Roll out only: same strikes, later expiry on all legs */
function computeRollOutOnlyLegs(pos) {
  return computeRollAllOutLegs(pos);
}

/**
 * Select new put spread strikes for "Roll put side up" active defence.
 * Short put: ~1 SD below current spot. Long put: $5 below short.
 * @param {number} spot — current underlying price
 * @param {number} iv — implied volatility (decimal, e.g. 0.25 = 25%)
 * @param {number} dte — days to expiry
 * @returns {{ shortStrike: number, longStrike: number }}
 */
function selectNewPutStrikes(spot, iv, dte) {
  // 1 SD move = spot × IV × √(DTE/365)
  const effectiveIv = iv > 1 ? iv / 100 : iv; // normalise if percentage
  const oneSD = spot * (effectiveIv || 0.25) * Math.sqrt(Math.max(dte || 7, 1) / 365);
  // Short put at ~1 SD below spot, rounded to nearest $5
  const rawShort = spot - oneSD;
  const shortStrike = Math.round(rawShort / 5) * 5;
  const longStrike = shortStrike - 5;
  return { shortStrike, longStrike };
}

/**
 * Compute legs for "Roll put side up" — close existing put spread,
 * open new put spread at higher strikes closer to spot. Keep call side.
 */
function computeRollPutSideUpLegs(pos, md) {
  const legs = pos.legs || [];
  const spot = md.currentSpot || 0;

  // Find current put legs' average IV for strike selection
  const putLegs = legs.filter(l => (l.type || '').toLowerCase() === 'put');
  const avgIv = putLegs.length > 0
    ? putLegs.reduce((sum, l) => sum + (l.iv || 0.25), 0) / putLegs.length
    : 0.25;

  const { shortStrike, longStrike } = selectNewPutStrikes(spot, avgIv, md.dte || 21);
  const expiry = pos.expiry || legs[0]?.expiry;

  // Keep call legs unchanged, replace put legs with new strikes
  const callLegs = legs.filter(l => (l.type || '').toLowerCase() === 'call');
  const newPutLegs = [
    { action: 'buy', type: 'put', strike: longStrike, premium: 0, expiry },
    { action: 'sell', type: 'put', strike: shortStrike, premium: 0, expiry },
  ];

  return [...newPutLegs, ...callLegs];
}
