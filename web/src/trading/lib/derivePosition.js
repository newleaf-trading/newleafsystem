/**
 * derivePosition.js — Single derivation engine for Invest surfaces.
 *
 * RULES:
 *   1. The canonical record stores TOTAL DOLLARS: pnlTotal, pnlPrevClose,
 *      maxProfitTotal, maxLossTotal, plus qty.
 *   2. Per-contract is ALWAYS total / qty — never the reverse.
 *   3. Every displayed metric comes from derivePosition(). Surfaces import
 *      it; they never recompute.
 *   4. `status` routes between Decide (candidate) and Defend (open/closed).
 *      Candidates have no entry/pnl fields.
 *
 * @module derivePosition
 */

// ═══════════════════════════════════════════════════════════════
// Types (JSDoc — no TypeScript dependency)
// ═══════════════════════════════════════════════════════════════

/**
 * @typedef {'candidate' | 'open' | 'closed'} PositionStatus
 * @typedef {'time' | 'loss' | 'profit' | null} ReviewType
 */

/**
 * @typedef {object} Leg
 * @property {'sell' | 'buy'} action
 * @property {'call' | 'put'} type
 * @property {number} strike
 * @property {number} entryPrice       — per-share premium at entry
 * @property {number} [currentPrice]   — per-share premium now (open only)
 * @property {number} delta
 * @property {number} theta
 */

/**
 * The canonical shape every Invest surface consumes.
 * toCanonical() produces this from raw Firestore docs.
 *
 * @typedef {object} CanonicalPosition
 * @property {string}  id
 * @property {string}  symbol
 * @property {string}  [name]
 * @property {string}  strategy          — 'iron_condor' | ...
 * @property {PositionStatus} status
 * @property {number}  qty               — contract count
 * @property {number}  dte
 * @property {number}  spot
 * @property {number}  [spotPrevClose]
 *
 * @property {number}  maxProfitTotal    — positive, total $
 * @property {number}  maxLossTotal      — positive magnitude, total $
 *
 * @property {string}  [entryDate]
 * @property {number}  [entryCreditPerContract]
 * @property {number}  [pnlTotal]        — total $ since entry (undefined for candidates)
 * @property {number}  [pnlPrevClose]    — pnlTotal as of prior session close
 *
 * @property {number}  [probability]     — 0..1
 * @property {number[]} [breakevens]     — [lower, upper]
 * @property {Leg[]}   [legs]
 */

// ═══════════════════════════════════════════════════════════════
// Tunable thresholds — reconciled from verdictEngine.js
//
//   verdictEngine uses per-strategy thresholds (50% condor, 25% butterfly,
//   delta-based, breach-based, etc.). For the Invest surfaces we collapse
//   to three buckets: time / loss / profit. The thresholds below control
//   which bucket fires and whether the row is "flagged" (needs review).
//
//   21-DTE rule:  verdictEngine §9 universal override ≤21 DTE +
//                 <50% captured → escalate. We adopt the same 21-DTE
//                 trigger but flag at any capture level.
//   profitTake:   verdictEngine's iron condor uses 50%, butterfly 25%.
//                 We use 35% as the unified "consider harvest" gate —
//                 it catches AMZN at 39% per the mock.
//   lossReview:   verdictEngine gates on delta/breach, not loss%.
//                 We add a simple 8% of max-loss trigger for the
//                 "loss is building" flag per the mock.
// ═══════════════════════════════════════════════════════════════

export const REVIEW = {
  timeDteThreshold: 21,
  // TODO: make profitTakePct per-strategy (condor 50%, butterfly 25%, etc.)
  //       once we have enough outcome data to validate strategy-specific gates.
  profitTakePct: 35,
  lossReviewPct: 8,
};

// ═══════════════════════════════════════════════════════════════
// derivePosition — pure derivation, zero side effects
// ═══════════════════════════════════════════════════════════════

/**
 * Derive every display metric from a canonical position.
 *
 * @param {CanonicalPosition} p
 * @returns {object} All original fields plus derived metrics.
 */
export function derivePosition(p) {
  // Coerce to safe numbers — prevents NaN from undefined/null fields
  const maxLoss = p.maxLossTotal || 0;
  const maxProfit = p.maxProfitTotal || 0;
  const qty = p.qty || 0;
  const hasDte = p.dte != null && isFinite(p.dte);
  const dte = hasDte ? p.dte : 0;
  const spot = p.spot || 0;

  const span = maxLoss + maxProfit;
  const breakevenPct = span > 0 ? (maxLoss / span) * 100 : 50;
  const rewardRisk = maxLoss > 0 ? maxProfit / maxLoss : 0;

  const isOpen = p.status !== 'candidate' && p.pnlTotal != null;
  const pnlTotal = p.pnlTotal ?? 0;
  const perContract = isOpen && qty > 0 ? pnlTotal / qty : 0;

  // Daily: null when pnlPrevClose is unavailable — views hide "today" rather than show $0
  const daily =
    isOpen && p.pnlPrevClose != null ? pnlTotal - p.pnlPrevClose : null;
  const dailyPerContract =
    daily != null && qty > 0 ? daily / qty : null;

  // Gauge position: where "now" sits on the loss→profit bar (0=max loss, 100=max profit)
  const nowPct = isOpen && span > 0
    ? ((pnlTotal + maxLoss) / span) * 100
    : null;

  // Profit/loss metrics
  const profitCapturedPct = maxProfit > 0
    ? (pnlTotal / maxProfit) * 100
    : 0;
  const lossUsedPct = pnlTotal < 0 && maxLoss > 0
    ? (Math.abs(pnlTotal) / maxLoss) * 100
    : 0;
  const remainingDownside = maxLoss + pnlTotal;
  const maxProfitLeft = maxProfit - pnlTotal;
  const returnOnRiskPct = maxLoss > 0
    ? (pnlTotal / maxLoss) * 100
    : 0;

  // Breach detection: spot outside breakevens
  const breached = isOpen && p.breakevens?.length === 2 && spot > 0
    && (spot < p.breakevens[0] || spot > p.breakevens[1]);

  // Review classification — simplified 3-bucket system
  let flagged = false;
  /** @type {ReviewType} */
  let review = null;
  if (isOpen) {
    if (pnlTotal < 0 || breached) {
      review = 'loss';
      flagged = lossUsedPct >= REVIEW.lossReviewPct || breached;
    } else if (profitCapturedPct >= REVIEW.profitTakePct) {
      review = 'profit';
      flagged = true;
    } else if (hasDte && dte <= REVIEW.timeDteThreshold) {
      review = 'time';
      flagged = true;
    }
  }

  return {
    ...p,
    // Coerced safe values (overwrite any undefined from p)
    maxLossTotal: maxLoss,
    maxProfitTotal: maxProfit,
    qty,
    dte,
    spot,
    // Derived
    span,
    breakevenPct,
    rewardRisk,
    isOpen,
    pnlTotal,
    perContract,
    daily,
    dailyPerContract,
    nowPct,
    profitCapturedPct,
    lossUsedPct,
    remainingDownside,
    maxProfitLeft,
    returnOnRiskPct,
    breached,
    flagged,
    review,
  };
}

// ═══════════════════════════════════════════════════════════════
// recommendation — derived copy that can't drift from the numbers
// ═══════════════════════════════════════════════════════════════

/**
 * One-line recommendation tied to the review bucket.
 *
 * @param {ReturnType<typeof derivePosition>} d
 * @returns {string}
 */
export function recommendation(d) {
  switch (d.review) {
    case 'time':
      return `Consider closing or rolling \u2014 only ${d.dte} DTE remain and just ${Math.round(d.profitCapturedPct)}% of the credit is captured.`;
    case 'loss':
      return `Review an adjustment \u2014 loss building (${Math.round(d.lossUsedPct)}% of max loss used) with ${d.dte} DTE left to defend.`;
    case 'profit':
      return `Consider taking profit \u2014 ${Math.round(d.profitCapturedPct)}% captured; harvest if it hits your target threshold.`;
    default:
      return 'On track \u2014 no action needed.';
  }
}
