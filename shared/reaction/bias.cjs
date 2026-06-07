'use strict';

/**
 * bias.cjs — Position-aware strategy bias mapping
 *
 * Uses posInRange (0 = at support, 1 = at resistance) to select the
 * right structure. Symmetric condors only at band centre; single-rail
 * credit spreads or BWBs when near a rail.
 *
 * Emits structureGeometry on every suggestion so leg-builder can later
 * place strikes asymmetrically.
 */

const STRONG_RAIL_MIN = 65;

/**
 * Compute position-in-range.
 * @param {number} spot
 * @param {number} supportLo - nearest support zone lo
 * @param {number} resistanceHi - nearest resistance zone hi
 * @returns {number|null} 0 = at support, 1 = at resistance, null = no valid range
 */
function calcPosInRange(spot, supportLo, resistanceHi) {
  if (supportLo == null || resistanceHi == null) return null;
  const width = resistanceHi - supportLo;
  if (width <= 0) return null;
  return Math.max(0, Math.min(1, (spot - supportLo) / width));
}

/**
 * @typedef {Object} StructureGeometry
 * @property {string} type - iron_condor | iron_butterfly | bull_put_spread | bear_call_spread | broken_wing_butterfly | bull_call_spread | bear_put_spread | no_trade
 * @property {'none'|'bullish'|'bearish'} skew
 * @property {string|null} bodyAnchor - 'support'|'resistance'|'centre'|null
 * @property {string|null} testedRail - 'support'|'resistance'|'both'|null
 */

/**
 * @param {Object} input
 * @param {string} input.regime
 * @param {number} input.supportScore
 * @param {number} input.resistanceScore
 * @param {boolean} input.supportTested
 * @param {boolean} input.resistanceTested
 * @param {number} input.ivRv
 * @param {number} input.spot
 * @param {number} [input.supportLo] - nearest support zone lo
 * @param {number} [input.resistanceHi] - nearest resistance zone hi
 * @param {number} [input.bandCentre]
 * @param {number} [input.gammaConfidence]
 * @param {number} [input.containment]
 * @param {number} [input.adx]
 * @param {boolean} [input.trendIntoZone]
 * @returns {{ bias: string, category: 'income'|'directional'|'none', halfBlind: boolean, noTradeReason: string|null, posInRange: number|null, structureGeometry: StructureGeometry }}
 */
function mapBias(input) {
  const {
    regime, supportScore: sS, resistanceScore: rS,
    supportTested: sT, resistanceTested: rT, ivRv,
    spot, supportLo, resistanceHi, bandCentre, gammaConfidence, containment, adx, trendIntoZone,
  } = input;

  const sStrong = sT && sS >= STRONG_RAIL_MIN;
  const rStrong = rT && rS >= STRONG_RAIL_MIN;
  const halfBlind = (sT && !rT) || (!sT && rT);
  const posInRange = calcPosInRange(spot, supportLo, resistanceHi);
  const ivRich = ivRv >= 1.15;
  const ivCheap = ivRv <= 0.95;

  const out = (bias, category, skew, bodyAnchor, testedRail, noTradeReason) => ({
    bias, category, halfBlind,
    noTradeReason: noTradeReason || null,
    posInRange,
    structureGeometry: { type: bias, skew: skew || 'none', bodyAnchor: bodyAnchor || null, testedRail: testedRail || null },
  });

  // ── Trending into zone → no_trade ──
  if (regime === 'trending' && trendIntoZone) {
    return out('no_trade', 'none', 'none', null, null, `breakdown/breakout risk — trend into zone, ADX ${Math.round(adx || 25)}`);
  }

  // ── Breakout/breakdown ──
  if (regime === 'breakout_up') {
    if (ivRv <= 1.0) return out('bull_call_spread', 'directional', 'bullish', null, null);
    if (sStrong) return out('bull_put_spread', 'income', 'bullish', 'support', 'support');
    return out('no_trade', 'none', 'none', null, null);
  }
  if (regime === 'breakout_down') {
    if (ivRv <= 1.0) return out('bear_put_spread', 'directional', 'bearish', null, null);
    if (rStrong) return out('bear_call_spread', 'income', 'bearish', 'resistance', 'resistance');
    return out('no_trade', 'none', 'none', null, null);
  }

  // ── Position-aware structure selection ──

  // 1. SYMMETRIC IRON CONDOR — only when centred in range
  const bothStrong = sStrong && rStrong;
  const rangeBound = regime === 'range_bound' || ((containment || 0) > 0.6 && (adx || 25) < 20);

  if (rangeBound && bothStrong && posInRange !== null && posInRange >= 0.40 && posInRange <= 0.60) {
    // Iron Butterfly: tighter centre + high gamma confidence
    if (posInRange >= 0.45 && posInRange <= 0.55 && (gammaConfidence || 0) > 0.6) {
      return out('iron_butterfly', 'income', 'none', 'centre', 'both');
    }
    return out('iron_condor', 'income', 'none', 'centre', 'both');
  }

  // 4. SKEWED CONDOR — off-centre but both rails strong, range_bound
  if (rangeBound && bothStrong && posInRange !== null) {
    if (posInRange >= 0.30 && posInRange < 0.40) {
      return out('skewed_condor', 'income', 'bullish', 'support', 'both');
    }
    if (posInRange > 0.60 && posInRange <= 0.70) {
      return out('skewed_condor', 'income', 'bearish', 'resistance', 'both');
    }
  }

  // 2. NEAR SUPPORT (posInRange < 0.40, includes testing_support)
  const nearSupport = (posInRange !== null && posInRange < 0.40) || regime === 'testing_support';
  if (nearSupport && sStrong) {
    if (ivRich) return out('bull_put_spread', 'income', 'bullish', 'support', 'support');
    if (ivCheap) return out('bull_call_spread', 'directional', 'bullish', null, 'support');
    // Moderate IV: BWB (put-side, body below spot, wider wing downside)
    return out('broken_wing_butterfly', 'income', 'bullish', 'support', 'support');
  }

  // 3. NEAR RESISTANCE (posInRange > 0.60, includes testing_resistance)
  const nearResistance = (posInRange !== null && posInRange > 0.60) || regime === 'testing_resistance';
  if (nearResistance && rStrong) {
    if (ivRich) return out('bear_call_spread', 'income', 'bearish', 'resistance', 'resistance');
    if (ivCheap) return out('bear_put_spread', 'directional', 'bearish', null, 'resistance');
    return out('broken_wing_butterfly', 'income', 'bearish', 'resistance', 'resistance');
  }

  // ── Trending (not into zone) ──
  if (regime === 'trending') {
    if (sStrong && ivRv >= 1.0) return out('bull_put_spread', 'income', 'bullish', 'support', 'support');
    if (rStrong && ivRv >= 1.0) return out('bear_call_spread', 'income', 'bearish', 'resistance', 'resistance');
    return out('no_trade', 'none', 'none', null, null);
  }

  // ── Unclear / fallback ──
  if (sStrong && ivRich) return out('bull_put_spread', 'income', 'bullish', 'support', 'support');
  if (rStrong && ivRich) return out('bear_call_spread', 'income', 'bearish', 'resistance', 'resistance');

  return out('no_trade', 'none', 'none', null, null);
}

function validateBiasCategory(bias, category) {
  const DEBIT_BIASES = new Set(['bull_call_spread', 'bear_put_spread']);
  if (category === 'income' && DEBIT_BIASES.has(bias)) return false;
  return true;
}

const INCOME_BIASES = new Set(['bull_put_spread', 'bear_call_spread', 'iron_condor', 'iron_butterfly', 'broken_wing_butterfly', 'skewed_condor']);
const DIRECTIONAL_BIASES = new Set(['bull_call_spread', 'bear_put_spread']);

module.exports = { mapBias, calcPosInRange, validateBiasCategory, STRONG_RAIL_MIN, INCOME_BIASES, DIRECTIONAL_BIASES };
