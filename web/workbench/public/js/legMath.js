/**
 * Shared leg math utilities for options strategy calculations.
 * Used by both discover.html and strategy-builder.html.
 *
 * All functions operate on a standard leg shape:
 *   { side: 'long'|'short', type: 'call'|'put', strike: number, mid: number, qty?: number }
 *
 * qty is the PER-LEG quantity (defaults to 1). Structures with uneven legs — e.g. a
 * 1-2-1 broken-wing butterfly (short body ×2) or ratio spreads — depend on it; ignoring
 * it turns a 1-2-1 fly into a 1-1-1 net-long position with the wrong payoff/credit.
 */

/**
 * Compute net credit from a set of legs.
 * Positive = net credit, negative = net debit.
 */
export function computeNetCredit(legs) {
  let nc = 0;
  for (const l of legs) {
    const q = l.qty || 1;
    nc += (l.side === 'short' ? (l.mid || 0) : -(l.mid || 0)) * q;
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
    const q = l.qty || 1;
    const intrinsic = l.type === 'call'
      ? Math.max(0, price - l.strike)
      : Math.max(0, l.strike - price);
    pnl += (l.side === 'long' ? intrinsic : -intrinsic) * 100 * qty * q;
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

/**
 * Estimate probability of profit (PoP) by integrating the payoff over a lognormal
 * terminal-price distribution. General — works for ANY defined-risk structure, including
 * single-breakeven debit verticals (bull/bear call/put spreads) where a breakeven-range
 * heuristic returns nothing. Risk-neutral drift (no directional assumption).
 * @param {Array}  legs
 * @param {number} qty
 * @param {number} netCredit  net premium (>0 credit, <0 debit); recomputed if omitted
 * @param {number} spot       current underlying price
 * @param {number} ivPct      ATM implied vol in PERCENT (e.g. 58.1)
 * @param {number} dte        days to expiration
 * @returns {number|null} PoP in percent (0–100), or null if inputs are insufficient
 */
export function estimatePoP(legs, qty, netCredit, spot, ivPct, dte) {
  if (!legs || !legs.length || !(spot > 0) || !(ivPct > 0) || !(dte > 0)) return null;
  const T = dte / 365;
  const sigma = (ivPct / 100) * Math.sqrt(T);
  if (!(sigma > 0)) return null;
  const nc = (typeof netCredit === 'number') ? netCredit : computeNetCredit(legs);
  // Terminal price is lognormal: ln(S_T/spot) ~ N(-½σ², σ²). Integrate the standard-normal
  // density in z, mapping each z to a terminal price, and sum the probability mass where P&L > 0.
  const mu = -0.5 * sigma * sigma;
  const N = 800, zMin = -5, zMax = 5, dz = (zMax - zMin) / N;
  let probProfit = 0, probTotal = 0;
  for (let i = 0; i < N; i++) {
    const z = zMin + (zMax - zMin) * (i + 0.5) / N;
    const w = Math.exp(-0.5 * z * z) * dz;            // ∝ standard-normal density
    const price = spot * Math.exp(mu + sigma * z);    // lognormal terminal price
    probTotal += w;
    if (pnlAt(price, legs, qty, nc) > 0) probProfit += w;
  }
  return probTotal > 0 ? Math.round(100 * probProfit / probTotal) : null;
}
