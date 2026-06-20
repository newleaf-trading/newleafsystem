'use strict';

/**
 * @newleaf/strategies — Pure options strategy comparison engine.
 *
 * Side-effect-free. No I/O. All Alpaca calls live in the CLI layer.
 *
 * Exports: buildLegs, payoff, analyse, bandWidth, PRESETS
 */

// ═══════════════════════════════════════════════════════════════
// Strategy presets — parameter-driven, single expiry
// ═══════════════════════════════════════════════════════════════

const PRESETS = {
  iron_condor:      { legs: 4, desc: 'Sell OTM put + call, buy further OTM wings' },
  iron_butterfly:   { legs: 4, desc: 'Sell ATM put + call, buy OTM wings' },
  broken_wing_fly:  { legs: 4, desc: 'Asymmetric butterfly — wider wing on one side' },
  bull_put_spread:  { legs: 2, desc: 'Sell OTM put, buy further OTM put' },
  bear_call_spread: { legs: 2, desc: 'Sell OTM call, buy further OTM call' },
  long_straddle:    { legs: 2, desc: 'Buy ATM call + put' },
  long_strangle:    { legs: 2, desc: 'Buy OTM call + put' },
};

// ═══════════════════════════════════════════════════════════════
// buildLegs — derive legs from spot + params
// ═══════════════════════════════════════════════════════════════

/**
 * Build the leg structure for a strategy preset.
 *
 * @param {string} strategy — preset name (e.g. 'iron_condor')
 * @param {number} spot — underlying price
 * @param {object} [params] — override defaults
 *   shortWidth: distance from spot to short strikes (default spot*0.05)
 *   wing: distance from short to long (default 10)
 *   net: net premium per share, credit positive (default computed)
 *   skew: BWF skew ratio for wider wing (default 1.5)
 *   straddleWidth: distance from spot for strangle (default spot*0.05)
 * @returns {Array<{kind:'call'|'put', dir:'long'|'short', strike:number, qty:number, premium:number}>}
 */
function buildLegs(strategy, spot, params) {
  const p = params || {};
  const sw = p.shortWidth || Math.round(spot * 0.05);
  const wing = p.wing || 10;
  const net = p.net; // per-share net premium (credit positive)

  switch (strategy) {
    case 'iron_condor': {
      const spStrike = Math.round(spot - sw);
      const scStrike = Math.round(spot + sw);
      const lpStrike = spStrike - wing;
      const lcStrike = scStrike + wing;
      const legs = [
        { kind: 'put',  dir: 'short', strike: spStrike, qty: 1, premium: 0 },
        { kind: 'put',  dir: 'long',  strike: lpStrike, qty: 1, premium: 0 },
        { kind: 'call', dir: 'short', strike: scStrike, qty: 1, premium: 0 },
        { kind: 'call', dir: 'long',  strike: lcStrike, qty: 1, premium: 0 },
      ];
      if (net != null) distributeNet(legs, net);
      return legs;
    }

    case 'iron_butterfly': {
      const center = Math.round(spot);
      const legs = [
        { kind: 'put',  dir: 'short', strike: center,        qty: 1, premium: 0 },
        { kind: 'put',  dir: 'long',  strike: center - wing,  qty: 1, premium: 0 },
        { kind: 'call', dir: 'short', strike: center,        qty: 1, premium: 0 },
        { kind: 'call', dir: 'long',  strike: center + wing,  qty: 1, premium: 0 },
      ];
      if (net != null) distributeNet(legs, net);
      return legs;
    }

    case 'broken_wing_fly': {
      const skew = p.skew || 1.5;
      const center = Math.round(spot);
      const legs = [
        { kind: 'put',  dir: 'short', strike: center,                    qty: 2, premium: 0 },
        { kind: 'put',  dir: 'long',  strike: center - wing,              qty: 1, premium: 0 },
        { kind: 'put',  dir: 'long',  strike: center - Math.round(wing * skew), qty: 1, premium: 0 },
      ];
      if (net != null) distributeNet(legs, net);
      return legs;
    }

    case 'bull_put_spread': {
      const spStrike = Math.round(spot - sw);
      const legs = [
        { kind: 'put', dir: 'short', strike: spStrike,        qty: 1, premium: 0 },
        { kind: 'put', dir: 'long',  strike: spStrike - wing,  qty: 1, premium: 0 },
      ];
      if (net != null) distributeNet(legs, net);
      return legs;
    }

    case 'bear_call_spread': {
      const scStrike = Math.round(spot + sw);
      const legs = [
        { kind: 'call', dir: 'short', strike: scStrike,        qty: 1, premium: 0 },
        { kind: 'call', dir: 'long',  strike: scStrike + wing,  qty: 1, premium: 0 },
      ];
      if (net != null) distributeNet(legs, net);
      return legs;
    }

    case 'long_straddle': {
      const center = Math.round(spot);
      const halfNet = net != null ? net / 2 : 0;
      return [
        { kind: 'call', dir: 'long', strike: center, qty: 1, premium: Math.abs(halfNet) },
        { kind: 'put',  dir: 'long', strike: center, qty: 1, premium: Math.abs(halfNet) },
      ];
    }

    case 'long_strangle': {
      const w = p.straddleWidth || sw;
      const halfNet = net != null ? net / 2 : 0;
      return [
        { kind: 'call', dir: 'long', strike: Math.round(spot + w), qty: 1, premium: Math.abs(halfNet) },
        { kind: 'put',  dir: 'long', strike: Math.round(spot - w), qty: 1, premium: Math.abs(halfNet) },
      ];
    }

    default:
      throw new Error(`Unknown strategy: ${strategy}. Known: ${Object.keys(PRESETS).join(', ')}`);
  }
}

/**
 * Distribute net premium across legs so that:
 *   Σ(short.premium × short.qty) - Σ(long.premium × long.qty) = net
 *
 * For credit structures (net > 0): shorts collect, longs cost less.
 * Uses a fixed long-cost assumption to derive short premiums.
 */
function distributeNet(legs, net) {
  const shorts = legs.filter(l => l.dir === 'short');
  const longs = legs.filter(l => l.dir === 'long');
  const totalShortQty = shorts.reduce((s, l) => s + l.qty, 0);
  const totalLongQty = longs.reduce((s, l) => s + l.qty, 0);

  if (totalShortQty > 0 && totalLongQty > 0) {
    // Assume long premium is 30% of |net| per unit qty
    const longPremPerQty = Math.abs(net) * 0.3;
    const totalLongCost = longPremPerQty * totalLongQty;
    // Short premium must satisfy: shortPrem * shortQty - totalLongCost = net
    const shortPremPerQty = (net + totalLongCost) / totalShortQty;
    shorts.forEach(l => { l.premium = Math.max(0, shortPremPerQty); });
    longs.forEach(l => { l.premium = Math.max(0, longPremPerQty); });
  } else if (totalLongQty > 0) {
    // All-long (straddle/strangle): distribute debit evenly
    longs.forEach(l => { l.premium = Math.abs(net) / totalLongQty; });
  }
}

// ═══════════════════════════════════════════════════════════════
// payoff — P&L at expiration for a given underlying price
// ═══════════════════════════════════════════════════════════════

/**
 * Compute P&L at expiration for a strategy at a given underlying price.
 *
 * @param {Array} legs — from buildLegs
 * @param {number} underlyingPrice — price at expiration
 * @returns {number} — P&L in dollars (per contract set, ×100 multiplier)
 */
function payoff(legs, underlyingPrice) {
  let pnl = 0;
  for (const leg of legs) {
    const sign = leg.dir === 'short' ? -1 : 1;
    const intrinsic = leg.kind === 'call'
      ? Math.max(0, underlyingPrice - leg.strike)
      : Math.max(0, leg.strike - underlyingPrice);

    // Premium: short collects, long pays
    const premiumPnl = leg.dir === 'short' ? leg.premium : -leg.premium;

    pnl += (sign * intrinsic + premiumPnl) * leg.qty * 100;
  }
  return Math.round(pnl * 100) / 100;
}

// ═══════════════════════════════════════════════════════════════
// analyse — full numerical analysis over a price grid
// ═══════════════════════════════════════════════════════════════

/**
 * Analyse one or more strategies numerically.
 *
 * @param {Array<{name:string, legs:Array}>} strategies
 * @param {number} spot
 * @returns {Array<{name, maxProfit, maxLoss, breakevens, profitZoneWidth, rewardRisk, uncappedProfit, uncappedLoss}>}
 */
function analyse(strategies, spot) {
  // Find widest strike range across all strategies
  let minStrike = Infinity, maxStrike = -Infinity;
  for (const s of strategies) {
    for (const l of s.legs) {
      if (l.strike < minStrike) minStrike = l.strike;
      if (l.strike > maxStrike) maxStrike = l.strike;
    }
  }
  const range = maxStrike - minStrike || spot * 0.2;
  const lo = Math.max(0, minStrike - range * 0.45);
  const hi = maxStrike + range * 0.45;
  const step = (hi - lo) / 480;

  const grid = [];
  for (let i = 0; i <= 480; i++) {
    grid.push(+(lo + i * step).toFixed(2));
  }

  return strategies.map(s => {
    const pnls = grid.map(p => ({ price: p, pnl: payoff(s.legs, p) }));
    const maxProfit = Math.max(...pnls.map(p => p.pnl));
    const maxLoss = Math.min(...pnls.map(p => p.pnl));

    // Breakevens: zero-crossings
    const breakevens = [];
    for (let i = 1; i < pnls.length; i++) {
      if ((pnls[i - 1].pnl <= 0 && pnls[i].pnl > 0) || (pnls[i - 1].pnl > 0 && pnls[i].pnl <= 0)) {
        // Linear interpolation
        const p0 = pnls[i - 1], p1 = pnls[i];
        const be = p0.price + (0 - p0.pnl) * (p1.price - p0.price) / (p1.pnl - p0.pnl);
        breakevens.push(+be.toFixed(2));
      }
    }

    // Profit zone width
    const profitPrices = pnls.filter(p => p.pnl > 0);
    const profitZoneWidth = profitPrices.length > 0
      ? +(profitPrices[profitPrices.length - 1].price - profitPrices[0].price).toFixed(2)
      : 0;

    // Uncapped detection: check slope AND level at boundaries
    // Uncapped profit: boundary P&L is large AND still rising
    // Uncapped loss: boundary P&L is deeply negative AND still falling
    const leftPnl = pnls[0].pnl;
    const rightPnl = pnls[pnls.length - 1].pnl;
    const slopeLeft = pnls.length > 2 ? (pnls[1].pnl - pnls[0].pnl) / step : 0;
    const slopeRight = pnls.length > 2 ? (pnls[pnls.length - 1].pnl - pnls[pnls.length - 2].pnl) / step : 0;
    // Profit is uncapped if boundary P&L is positive and slope continues outward
    const uncappedProfit = (leftPnl > 100 && slopeLeft < -50) || (rightPnl > 100 && slopeRight > 50);
    // Loss is uncapped if boundary P&L is negative and slope continues downward
    const uncappedLoss = (leftPnl < -100 && slopeLeft > 50) || (rightPnl < -100 && slopeRight < -50);

    const rewardRisk = maxLoss < 0 ? +(maxProfit / Math.abs(maxLoss)).toFixed(3) : Infinity;

    return {
      name: s.name,
      maxProfit,
      maxLoss,
      breakevens,
      profitZoneWidth,
      rewardRisk,
      uncappedProfit,
      uncappedLoss,
      grid: pnls,
    };
  });
}

// ═══════════════════════════════════════════════════════════════
// bandWidth — price range delivering >= target profit
// ═══════════════════════════════════════════════════════════════

/**
 * Find the price range where profit >= target.
 *
 * @param {Array} legs — from buildLegs
 * @param {number} spot
 * @param {number} target — dollar target (e.g. 400)
 * @returns {{lo:number, hi:number, width:number} | null}
 */
function bandWidth(legs, spot, target) {
  const strikes = legs.map(l => l.strike);
  const minS = Math.min(...strikes), maxS = Math.max(...strikes);
  const range = maxS - minS || spot * 0.2;
  const lo = Math.max(0, minS - range * 0.45);
  const hi = maxS + range * 0.45;
  const step = (hi - lo) / 480;

  let bandLo = null, bandHi = null;
  for (let i = 0; i <= 480; i++) {
    const price = lo + i * step;
    const pnl = payoff(legs, price);
    if (pnl >= target) {
      if (bandLo === null) bandLo = price;
      bandHi = price;
    }
  }

  if (bandLo === null) return null;
  return {
    lo: +bandLo.toFixed(2),
    hi: +bandHi.toFixed(2),
    width: +(bandHi - bandLo).toFixed(2),
  };
}

// ═══════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════

module.exports = { buildLegs, payoff, analyse, bandWidth, PRESETS };
