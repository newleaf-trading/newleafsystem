/**
 * Payoff computation for options strategies.
 * Shared between PayoffChart (Highcharts) and workbench (vanilla canvas).
 *
 * samplePayoff(legs, spot) → [{price, pnl}]
 */

/**
 * Generate a 200-point P&L-at-expiration curve.
 *
 * @param {object[]} legs — [{action, type, strike, premium, quantity}]
 * @param {number} spot — current underlying price
 * @returns {{price: number, pnl: number}[]}
 */
export function samplePayoff(legs, spot) {
  if (!legs || legs.length === 0 || !spot) return [];

  const strikes = legs.map(l => l.strike).filter(s => s > 0);
  if (strikes.length === 0) return [];

  const minK = Math.min(...strikes, spot);
  const maxK = Math.max(...strikes, spot);
  const span = (maxK - minK) || (spot * 0.1);
  const lo = Math.max(0.01, minK - span * 0.6);
  const hi = maxK + span * 0.6;
  const step = (hi - lo) / 200;

  // Net credit: sell premiums minus buy premiums, ×100 per contract
  let netCredit = 0;
  legs.forEach(l => {
    const prem = l.premium || 0;
    const qty = l.quantity || 1;
    if ((l.action || '').toLowerCase() === 'sell') netCredit += prem * qty * 100;
    else netCredit -= prem * qty * 100;
  });

  const out = [];
  for (let p = lo; p <= hi; p += step) {
    let pnl = 0;
    legs.forEach(l => {
      const isCall = (l.type || '').toLowerCase() === 'call';
      const isSell = (l.action || '').toLowerCase() === 'sell';
      const intrinsic = isCall ? Math.max(p - l.strike, 0) : Math.max(l.strike - p, 0);
      const sign = isSell ? -1 : 1;
      pnl += sign * (l.quantity || 1) * intrinsic;
    });
    out.push([Math.round(p * 100) / 100, Math.round((pnl * 100 + netCredit) * 100) / 100]);
  }
  return out;
}

/**
 * Detect breakeven prices from a payoff curve.
 * @param {number[][]} data — [[price, pnl], ...]
 * @returns {number[]}
 */
export function detectBreakevens(data) {
  const bes = [];
  for (let i = 1; i < data.length; i++) {
    const a = data[i - 1][1];
    const b = data[i][1];
    if (a * b <= 0 && a !== b) {
      const x = data[i - 1][0] + (data[i][0] - data[i - 1][0]) * Math.abs(a) / (Math.abs(a) + Math.abs(b));
      bes.push(Math.round(x * 100) / 100);
    }
  }
  return bes;
}
