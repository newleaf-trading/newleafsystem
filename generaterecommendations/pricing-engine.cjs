/**
 * pricing-engine.cjs — Shared pricing logic for option strategies.
 *
 * Extracted from publish-pick.cjs so both publish-pick and funnel-price
 * use one pricing path. Pure functions — no I/O, no Firestore.
 *
 * Also includes the shared validate-and-normalize step so all writers
 * use one validator (prevents drift).
 *
 * @module pricing-engine
 */
'use strict';

// ═══════════════════════════════════════════════════════════════
// Math helpers
// ═══════════════════════════════════════════════════════════════

function erf(x) {
  const sign = x >= 0 ? 1 : -1; x = Math.abs(x);
  const t = 1.0 / (1.0 + 0.3275911 * x);
  const y = 1.0 - (((((1.061405429 * t + -1.453152027) * t) + 1.421413741) * t + -0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return sign * y;
}

function findClosest(contracts, target) {
  if (!contracts || !contracts.length) return null;
  return contracts.reduce((best, c) => Math.abs(c.strike - target) < Math.abs(best.strike - target) ? c : best);
}

function calcPoP(lower, upper, spot, iv, dte) {
  if (!iv || !dte) return null; // null, not 0.5 — never fabricate
  const sigma = spot * iv * Math.sqrt(dte / 365);
  if (sigma <= 0) return null;
  const zL = (lower - spot) / sigma, zU = (upper - spot) / sigma;
  return 0.5 * (1 + erf(zU / Math.sqrt(2))) - 0.5 * (1 + erf(zL / Math.sqrt(2)));
}

// ═══════════════════════════════════════════════════════════════
// Strategy builders
// ═══════════════════════════════════════════════════════════════

function buildIronCondor(spot, calls, puts, expiry) {
  const dte = Math.round((new Date(expiry) - new Date()) / 86400000);
  const wing = Math.max(5, Math.round(spot * 0.05));

  const shortPut  = findClosest(puts, spot * 0.90);
  const shortCall = findClosest(calls, spot * 1.10);
  const longPut   = findClosest(puts, shortPut.strike - wing);
  const longCall  = findClosest(calls, shortCall.strike + wing);

  if (!shortPut || !shortCall || !longPut || !longCall) throw new Error('Could not find all 4 legs');
  if (longPut.strike >= shortPut.strike || longCall.strike <= shortCall.strike) throw new Error('Invalid strike structure');

  const credit = (shortPut.mid - longPut.mid) + (shortCall.mid - longCall.mid);
  if (credit <= 0) throw new Error(`Negative credit: ${credit.toFixed(2)}`);

  const maxProfit = credit * 100;
  const maxLoss = (Math.max(shortPut.strike - longPut.strike, longCall.strike - shortCall.strike) - credit) * 100;
  const lowerBE = shortPut.strike - credit, upperBE = shortCall.strike + credit;
  const iv = shortPut.iv || shortCall.iv || null;
  const pop = iv ? calcPoP(lowerBE, upperBE, spot, iv, dte) : null;

  return {
    strategy: 'Iron Condor', direction: 'neutral', expiry, dte,
    legs: [
      { action: 'BUY',  type: 'PUT',  strike: longPut.strike,   premium: longPut.mid,   delta: longPut.delta,   theta: longPut.theta,   vega: longPut.vega,   iv: longPut.iv },
      { action: 'SELL', type: 'PUT',  strike: shortPut.strike,  premium: shortPut.mid,  delta: shortPut.delta,  theta: shortPut.theta,  vega: shortPut.vega,  iv: shortPut.iv },
      { action: 'SELL', type: 'CALL', strike: shortCall.strike, premium: shortCall.mid, delta: shortCall.delta, theta: shortCall.theta, vega: shortCall.vega, iv: shortCall.iv },
      { action: 'BUY',  type: 'CALL', strike: longCall.strike,  premium: longCall.mid,  delta: longCall.delta,  theta: longCall.theta,  vega: longCall.vega,  iv: longCall.iv },
    ],
    netCredit: credit, maxProfit, maxLoss,
    rewardRisk: maxProfit / maxLoss,
    oddsOfProfit: pop != null ? Math.round(pop * 100) : null,
    breakevens: { lower: lowerBE, upper: upperBE },
    greeks: {
      netDelta: (shortPut.delta||0) + (shortCall.delta||0) - (longPut.delta||0) - (longCall.delta||0),
      netTheta: ((shortPut.theta||0) + (shortCall.theta||0) - (longPut.theta||0) - (longCall.theta||0)),
      netVega:  ((shortPut.vega||0) + (shortCall.vega||0) - (longPut.vega||0) - (longCall.vega||0)),
      netGamma: ((shortPut.gamma||0) + (shortCall.gamma||0) - (longPut.gamma||0) - (longCall.gamma||0)),
    },
  };
}

function buildIronButterfly(spot, calls, puts, expiry) {
  const dte = Math.round((new Date(expiry) - new Date()) / 86400000);
  const wing = Math.max(5, Math.round(spot * 0.05));

  const shortPut  = findClosest(puts, spot);
  const shortCall = findClosest(calls, spot);
  const longPut   = findClosest(puts, spot - wing);
  const longCall  = findClosest(calls, spot + wing);

  if (!shortPut || !shortCall || !longPut || !longCall) throw new Error('Could not find all 4 legs');

  const credit = (shortPut.mid - longPut.mid) + (shortCall.mid - longCall.mid);
  if (credit <= 0) throw new Error(`Negative credit: ${credit.toFixed(2)}`);

  const maxProfit = credit * 100;
  const maxLoss = (wing - credit) * 100;
  const lowerBE = shortPut.strike - credit, upperBE = shortCall.strike + credit;
  const iv = shortPut.iv || shortCall.iv || null;
  const pop = iv ? calcPoP(lowerBE, upperBE, spot, iv, dte) : null;

  return {
    strategy: 'Iron Butterfly', direction: 'neutral', expiry, dte,
    legs: [
      { action: 'BUY',  type: 'PUT',  strike: longPut.strike,   premium: longPut.mid,   delta: longPut.delta,   theta: longPut.theta,   vega: longPut.vega,   iv: longPut.iv },
      { action: 'SELL', type: 'PUT',  strike: shortPut.strike,  premium: shortPut.mid,  delta: shortPut.delta,  theta: shortPut.theta,  vega: shortPut.vega,  iv: shortPut.iv },
      { action: 'SELL', type: 'CALL', strike: shortCall.strike, premium: shortCall.mid, delta: shortCall.delta, theta: shortCall.theta, vega: shortCall.vega, iv: shortCall.iv },
      { action: 'BUY',  type: 'CALL', strike: longCall.strike,  premium: longCall.mid,  delta: longCall.delta,  theta: longCall.theta,  vega: longCall.vega,  iv: longCall.iv },
    ],
    netCredit: credit, maxProfit, maxLoss,
    rewardRisk: maxProfit / maxLoss,
    oddsOfProfit: pop != null ? Math.round(pop * 100) : null,
    breakevens: { lower: lowerBE, upper: upperBE },
    greeks: {
      netDelta: (shortPut.delta||0) + (shortCall.delta||0) - (longPut.delta||0) - (longCall.delta||0),
      netTheta: ((shortPut.theta||0) + (shortCall.theta||0) - (longPut.theta||0) - (longCall.theta||0)),
      netVega:  ((shortPut.vega||0) + (shortCall.vega||0) - (longPut.vega||0) - (longCall.vega||0)),
      netGamma: ((shortPut.gamma||0) + (shortCall.gamma||0) - (longPut.gamma||0) - (longCall.gamma||0)),
    },
  };
}

function buildBullPutSpread(spot, puts, expiry) {
  const dte = Math.round((new Date(expiry) - new Date()) / 86400000);
  const wing = Math.max(5, Math.round(spot * 0.05));

  const shortPut = findClosest(puts, spot * 0.95);
  const longPut  = findClosest(puts, shortPut.strike - wing);

  if (!shortPut || !longPut) throw new Error('Could not find spread legs');
  if (longPut.strike >= shortPut.strike) throw new Error('Invalid strike structure');

  const credit = shortPut.mid - longPut.mid;
  if (credit <= 0) throw new Error(`Negative credit: ${credit.toFixed(2)}`);

  const width = shortPut.strike - longPut.strike;
  const maxProfit = credit * 100;
  const maxLoss = (width - credit) * 100;
  const breakeven = shortPut.strike - credit;
  const iv = shortPut.iv || null;
  const pop = iv ? 0.5 * (1 + erf((spot - breakeven) / (spot * iv * Math.sqrt(dte / 365)) / Math.sqrt(2))) : null;

  return {
    strategy: 'Bull Put Spread', direction: 'bullish', expiry, dte,
    legs: [
      { action: 'BUY',  type: 'PUT', strike: longPut.strike,  premium: longPut.mid,  delta: longPut.delta,  theta: longPut.theta,  vega: longPut.vega,  iv: longPut.iv },
      { action: 'SELL', type: 'PUT', strike: shortPut.strike, premium: shortPut.mid, delta: shortPut.delta, theta: shortPut.theta, vega: shortPut.vega, iv: shortPut.iv },
    ],
    netCredit: credit, maxProfit, maxLoss,
    rewardRisk: maxProfit / maxLoss,
    oddsOfProfit: pop != null ? Math.round(pop * 100) : null,
    breakevens: { lower: breakeven, upper: null },
    greeks: {
      netDelta: (shortPut.delta||0) - (longPut.delta||0),
      netTheta: (shortPut.theta||0) - (longPut.theta||0),
      netVega:  (shortPut.vega||0) - (longPut.vega||0),
      netGamma: (shortPut.gamma||0) - (longPut.gamma||0),
    },
  };
}

function buildBearCallSpread(spot, calls, expiry) {
  const dte = Math.round((new Date(expiry) - new Date()) / 86400000);
  const wing = Math.max(5, Math.round(spot * 0.05));

  const shortCall = findClosest(calls, spot * 1.05);
  const longCall  = findClosest(calls, shortCall.strike + wing);

  if (!shortCall || !longCall) throw new Error('Could not find spread legs');
  if (longCall.strike <= shortCall.strike) throw new Error('Invalid strike structure');

  const credit = shortCall.mid - longCall.mid;
  if (credit <= 0) throw new Error(`Negative credit: ${credit.toFixed(2)}`);

  const width = longCall.strike - shortCall.strike;
  const maxProfit = credit * 100;
  const maxLoss = (width - credit) * 100;
  const breakeven = shortCall.strike + credit;
  const iv = shortCall.iv || null;
  const pop = iv ? 0.5 * (1 + erf((breakeven - spot) / (spot * iv * Math.sqrt(dte / 365)) / Math.sqrt(2))) : null;

  return {
    strategy: 'Bear Call Spread', direction: 'bearish', expiry, dte,
    legs: [
      { action: 'SELL', type: 'CALL', strike: shortCall.strike, premium: shortCall.mid, delta: shortCall.delta, theta: shortCall.theta, vega: shortCall.vega, iv: shortCall.iv },
      { action: 'BUY',  type: 'CALL', strike: longCall.strike,  premium: longCall.mid,  delta: longCall.delta,  theta: longCall.theta,  vega: longCall.vega,  iv: longCall.iv },
    ],
    netCredit: credit, maxProfit, maxLoss,
    rewardRisk: maxProfit / maxLoss,
    oddsOfProfit: pop != null ? Math.round(pop * 100) : null,
    breakevens: { lower: null, upper: breakeven },
    greeks: {
      netDelta: (shortCall.delta||0) - (longCall.delta||0),
      netTheta: (shortCall.theta||0) - (longCall.theta||0),
      netVega:  (shortCall.vega||0) - (longCall.vega||0),
      netGamma: (shortCall.gamma||0) - (longCall.gamma||0),
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// Strategy router
// ═══════════════════════════════════════════════════════════════

const SUPPORTED_STRATEGIES = ['iron condor', 'iron butterfly', 'bull put', 'bear call'];

function buildStrategy(strategyName, spot, calls, puts, expiry) {
  const name = strategyName.toLowerCase().replace(/[^a-z ]/g, '').trim();
  if (name.includes('iron condor'))      return buildIronCondor(spot, calls, puts, expiry);
  if (name.includes('iron butterfly'))   return buildIronButterfly(spot, calls, puts, expiry);
  if (name.includes('bull put'))         return buildBullPutSpread(spot, puts, expiry);
  if (name.includes('bear call'))        return buildBearCallSpread(spot, calls, expiry);

  throw new Error(
    `No builder for strategy "${strategyName}". ` +
    `Supported types: ${SUPPORTED_STRATEGIES.join(', ')}. ` +
    `Add a build function before publishing this type.`
  );
}

// ═══════════════════════════════════════════════════════════════
// Shared tile validation + normalization
// ═══════════════════════════════════════════════════════════════

/**
 * Validate a tile before writing to Firestore.
 * Mirrors web/src/trading/lib/tileSchema.js validateTile exactly.
 * Returns { valid: true } or { valid: false, reason }.
 */
function validateTileForWrite(tile) {
  if (!tile) return { valid: false, reason: 'tile is null' };
  if (!tile.id || !tile.symbol || !tile.strategy) return { valid: false, reason: 'missing identity (id/symbol/strategy)' };
  if (!Array.isArray(tile.legs) || tile.legs.length < 2) return { valid: false, reason: `legs must have ≥ 2 entries, got ${tile.legs?.length ?? 0}` };
  if (!tile.legs.some(l => (l.premium || 0) !== 0)) return { valid: false, reason: 'all leg premiums are 0 — unpriced' };
  if (!(tile.maxProfit > 0)) return { valid: false, reason: `maxProfit must be > 0, got ${tile.maxProfit}` };
  if (!(tile.maxLoss > 0)) return { valid: false, reason: `maxLoss must be > 0, got ${tile.maxLoss}` };
  if (!tile.expiry && !tile.legs?.some(l => l.expiry)) return { valid: false, reason: 'missing expiry' };
  if (!(tile.underlyingPrice > 0)) return { valid: false, reason: `underlyingPrice must be > 0, got ${tile.underlyingPrice}` };
  if (!tile.source) return { valid: false, reason: 'missing source' };
  if (tile.breakevens !== undefined && tile.breakevens !== null && (!Array.isArray(tile.breakevens) || tile.breakevens.length !== 2)) {
    return { valid: false, reason: `breakevens must be [lower, upper] or absent, got length ${tile.breakevens?.length}` };
  }
  // 11. Reject generic 'confidence' field — use verdictConfidence, wallConfidence, or oddsOfProfit
  if (tile.confidence !== undefined) {
    return { valid: false, reason: 'generic "confidence" field is deprecated — use verdictConfidence, wallConfidence, or oddsOfProfit' };
  }
  return { valid: true };
}

/**
 * Normalize a build result into a canonical tile shape.
 * PoP: null when uncomputable. Breakevens: [lower, upper] or undefined.
 */
function normalizeBuildResult(result, { tileId, symbol, spot, source, gammaData, engineSnapshot }) {
  const computedPoP = result.oddsOfProfit;
  const oddsOfProfit = (typeof computedPoP === 'number' && computedPoP > 0) ? computedPoP : null;

  const rawBE = result.breakevens;
  const breakevens = (Array.isArray(rawBE) && rawBE.length === 2) ? rawBE
    : (rawBE?.lower != null && rawBE?.upper != null) ? [rawBE.lower, rawBE.upper]
    : (rawBE?.lower != null) ? [rawBE.lower, null] // single-sided
    : (rawBE?.upper != null) ? [null, rawBE.upper]
    : undefined;

  // Normalize to [lower, upper] with 2 elements or undefined
  const validBE = (Array.isArray(breakevens) && breakevens.filter(v => v != null).length === 2)
    ? breakevens : undefined;

  return {
    id: tileId,
    symbol,
    strategy: result.strategy,
    direction: result.direction,
    publishedSpotPrice: spot,
    underlyingPrice: spot,
    expiry: result.expiry,
    daysToExpiry: result.dte,
    legs: result.legs,
    greeks: result.greeks,
    maxProfit: result.maxProfit,
    maxLoss: result.maxLoss,
    netCredit: result.netCredit,
    rewardRisk: result.rewardRisk,
    oddsOfProfit,
    breakevens: validBE,
    gammaData: gammaData || {},
    // Named confidence fields only — no generic 'confidence'
    verdictConfidence: null,  // funnel has no adversarial verdict
    wallConfidence: gammaData?.confidence?.overall ?? gammaData?.analysis?.confidence_score ?? null,
    aiInsight: null,
    engineSnapshot: engineSnapshot || null,
    provenance: {
      source,
      generatedAt: new Date().toISOString(),
      model: null,
      commitSha: null,
    },
    source,
    isActive: true,
    sortOrder: Date.now(),
  };
}

// ═══════════════════════════════════════════════════════════════
// Publish gate (CJS copy — must agree with ESM in tileSchema.js)
// ═══════════════════════════════════════════════════════════════

const POP_FLOOR = 65;
const VERDICT_FLOOR = 65;

/**
 * Apply the publish gate. Three branches:
 *   1. verdictConfidence present and ≥ 65 → PASS (verified)
 *   2. verdictConfidence present and < 65 → REJECT (adversary flagged it)
 *   3. verdictConfidence absent → PASS iff oddsOfProfit ≥ 65
 */
function applyPublishGate(tile) {
  const vc = tile.verdictConfidence;
  const pop = tile.oddsOfProfit;

  if (vc != null) {
    if (vc >= VERDICT_FLOOR) {
      return { pass: true, tier: 'verified' };
    }
    return { pass: false, reason: `adversarial verdict ${vc} < ${VERDICT_FLOOR} threshold`, tier: 'priced' };
  }

  if ((pop || 0) >= POP_FLOOR) {
    return { pass: true, tier: 'priced' };
  }
  return { pass: false, reason: `PoP ${pop ?? 'null'} < ${POP_FLOOR}% floor (no verdict)`, tier: 'priced' };
}

// ═══════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════

module.exports = {
  // Pure math
  erf, findClosest, calcPoP,
  // Builders
  buildIronCondor, buildIronButterfly, buildBullPutSpread, buildBearCallSpread,
  buildStrategy, SUPPORTED_STRATEGIES,
  // Validation + normalization + publish gate
  validateTileForWrite, normalizeBuildResult,
  applyPublishGate, POP_FLOOR, VERDICT_FLOOR,
};
