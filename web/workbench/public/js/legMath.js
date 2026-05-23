/**
 * Shared leg math utilities for options strategy calculations.
 * Used by both discover.html and strategy-builder.html.
 *
 * All functions operate on a standard leg shape:
 *   { side: 'long'|'short', type: 'call'|'put', strike: number, mid: number }
 */

/**
 * Compute net credit from a set of legs.
 * Positive = net credit, negative = net debit.
 */
export function computeNetCredit(legs) {
  let nc = 0;
  for (const l of legs) {
    nc += l.side === 'short' ? (l.mid || 0) : -(l.mid || 0);
  }
  return nc;
}

/**
 * Compute P&L at a given underlying price at expiration.
 * @param {number} price - underlying price at expiration
 * @param {Array} legs - array of leg objects
 * @param {number} qty - number of contracts
 * @param {number} [netCredit] - pre-computed net credit (optional)
 * @returns {number} P&L in dollars
 */
export function pnlAt(price, legs, qty, netCredit) {
  const nc = netCredit ?? computeNetCredit(legs);
  let pnl = nc * 100 * qty;
  for (const l of legs) {
    const intrinsic = l.type === 'call'
      ? Math.max(0, price - l.strike)
      : Math.max(0, l.strike - price);
    pnl += (l.side === 'long' ? intrinsic : -intrinsic) * 100 * qty;
  }
  return pnl;
}

/**
 * Compute max loss by sampling across price range.
 * @param {Array} legs
 * @param {number} qty
 * @param {number} [netCredit]
 * @returns {number} absolute max loss (positive number)
 */
export function computeMaxLoss(legs, qty, netCredit) {
  if (!legs.length) return 0;
  const nc = netCredit ?? computeNetCredit(legs);
  const strikes = legs.map(l => l.strike);
  const lo = Math.min(...strikes) - 30;
  const hi = Math.max(...strikes) + 30;
  let minPnl = Infinity;
  for (let i = 0; i <= 500; i++) {
    const price = lo + (hi - lo) * i / 500;
    const p = pnlAt(price, legs, qty, nc);
    if (p < minPnl) minPnl = p;
  }
  return Math.abs(minPnl);
}

/**
 * Compute max profit by sampling across price range.
 * @param {Array} legs
 * @param {number} qty
 * @param {number} [netCredit]
 * @returns {number} max profit (positive number)
 */
export function computeMaxProfit(legs, qty, netCredit) {
  if (!legs.length) return 0;
  const nc = netCredit ?? computeNetCredit(legs);
  const strikes = legs.map(l => l.strike);
  const lo = Math.min(...strikes) - 30;
  const hi = Math.max(...strikes) + 30;
  let maxPnl = -Infinity;
  for (let i = 0; i <= 500; i++) {
    const price = lo + (hi - lo) * i / 500;
    const p = pnlAt(price, legs, qty, nc);
    if (p > maxPnl) maxPnl = p;
  }
  return Math.max(0, maxPnl);
}

/**
 * Find breakeven prices by scanning for zero-crossings.
 * @param {Array} legs
 * @param {number} qty
 * @returns {number[]} array of breakeven prices
 */
export function computeBreakevens(legs, qty) {
  if (!legs.length) return [];
  const nc = computeNetCredit(legs);
  const strikes = legs.map(l => l.strike);
  const lo = Math.min(...strikes) - 20;
  const hi = Math.max(...strikes) + 20;
  const steps = 500;
  const breakevens = [];

  for (let i = 1; i <= steps; i++) {
    const p0 = lo + (hi - lo) * (i - 1) / steps;
    const p1 = lo + (hi - lo) * i / steps;
    const v0 = pnlAt(p0, legs, qty, nc);
    const v1 = pnlAt(p1, legs, qty, nc);
    if ((v0 >= 0) !== (v1 >= 0)) {
      breakevens.push(p0 + (0 - v0) * (p1 - p0) / (v1 - v0));
    }
  }
  return breakevens;
}

/**
 * Compute reward:risk ratio.
 * @param {number} maxProfit
 * @param {number} maxLoss
 * @returns {number}
 */
export function computeRewardRisk(maxProfit, maxLoss) {
  if (maxLoss === 0) return 0;
  return maxProfit / maxLoss;
}
