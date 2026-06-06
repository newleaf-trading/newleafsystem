'use strict';

/**
 * regime.cjs — Zone-based regime classification (fixes D1 + D2)
 *
 * D1 fix: containment computed against merged zone band (support.hi → resistance.lo)
 * D2 fix: confidence from classifier margin; "unclear" caps at 40
 */

const UNCLEAR_CONFIDENCE_CAP = 40;

/**
 * Compute containment rate: % of bars fully inside the zone band.
 * Band = support zone hi → resistance zone lo (the "inner" range).
 * @param {Object[]} candles
 * @param {Object} supportZone - nearest support zone
 * @param {Object} resistanceZone - nearest resistance zone
 * @param {number} lookbackDays
 * @returns {number} 0-1 containment rate
 */
function computeContainment(candles, supportZone, resistanceZone, lookbackDays) {
  if (!supportZone || !resistanceZone) return 0;
  if (supportZone.hi >= resistanceZone.lo) return 0; // zones overlap — no valid range

  const lo = supportZone.touchLo;  // include touch width for containment
  const hi = resistanceZone.touchHi;
  const recent = candles.slice(-lookbackDays);
  if (recent.length === 0) return 0;

  let inside = 0;
  for (const c of recent) {
    if (c.low >= lo && c.high <= hi) inside++;
  }
  return inside / recent.length;
}

/**
 * Classify regime using zone bands.
 * @param {number} spot
 * @param {Object} nearestSupport - ZoneStats from stats.cjs (or null)
 * @param {Object} nearestResistance - ZoneStats from stats.cjs (or null)
 * @param {number} containment - from computeContainment
 * @param {number} adx - ADX(14)
 * @param {number} atrPct - ATR as decimal
 * @returns {{ regime: string, confidence: number }}
 */
function classifyRegime(spot, nearestSupport, nearestResistance, containment, adx, atrPct) {
  const atrDist = (atrPct || 0.02) * spot;
  const scoreable = (z) => z && !z.untested; // >=3 touches

  // Range-bound: high containment + low trend
  if (containment > 0.70 && (adx || 25) < 20 && scoreable(nearestSupport) && scoreable(nearestResistance)) {
    const margin = Math.min(containment - 0.70, 1 - (adx || 25) / 25);
    return { regime: 'range_bound', confidence: Math.round(55 + margin * 100) };
  }

  // Breakout/breakdown: spot closed beyond a scoreable zone
  if (scoreable(nearestResistance) && spot > nearestResistance.zone.touchHi) {
    const dist = (spot - nearestResistance.zone.hi) / atrDist;
    return { regime: 'breakout_up', confidence: Math.round(Math.min(90, 50 + dist * 20)) };
  }
  if (scoreable(nearestSupport) && spot < nearestSupport.zone.touchLo) {
    const dist = (nearestSupport.zone.lo - spot) / atrDist;
    return { regime: 'breakout_down', confidence: Math.round(Math.min(90, 50 + dist * 20)) };
  }

  // Testing support/resistance: spot within 0.5×ATR of a scoreable zone
  if (scoreable(nearestSupport)) {
    const distToSupport = spot - nearestSupport.zone.hi;
    if (distToSupport >= 0 && distToSupport < 0.5 * atrDist) {
      const proximity = 1 - distToSupport / (0.5 * atrDist);
      return { regime: 'testing_support', confidence: Math.round(45 + proximity * 30 + (nearestSupport.smoothedRate || 0) * 15) };
    }
  }
  if (scoreable(nearestResistance)) {
    const distToResistance = nearestResistance.zone.lo - spot;
    if (distToResistance >= 0 && distToResistance < 0.5 * atrDist) {
      const proximity = 1 - distToResistance / (0.5 * atrDist);
      return { regime: 'testing_resistance', confidence: Math.round(45 + proximity * 30 + (nearestResistance.smoothedRate || 0) * 15) };
    }
  }

  // Trending: strong ADX
  if ((adx || 25) > 25) {
    return { regime: 'trending', confidence: Math.round(Math.min(75, 40 + ((adx || 25) - 25) * 2)) };
  }

  // D2 fix: unclear always caps at 40
  return { regime: 'unclear', confidence: Math.min(UNCLEAR_CONFIDENCE_CAP, 30) };
}

module.exports = { classifyRegime, computeContainment, UNCLEAR_CONFIDENCE_CAP };
