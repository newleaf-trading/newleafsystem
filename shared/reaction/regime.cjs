'use strict';

/**
 * regime.cjs — Zone-based regime classification
 *
 * PRECEDENCE ORDER (falling-knife patch):
 *   1. breakout/breakdown (spot beyond a zone)
 *   2. trending (ADX > 25) — runs BEFORE proximity checks
 *      If trending TOWARD a nearby zone, trendIntoZone flag set
 *   3. testing_support / testing_resistance (spot within 0.5×ATR)
 *   4. range_bound (high containment + low ADX)
 *   5. unclear (caps confidence at 40)
 */

const UNCLEAR_CONFIDENCE_CAP = 40;
const TREND_ADX_THRESHOLD = 25;

/**
 * Compute containment rate against merged zone band.
 */
function computeContainment(candles, supportZone, resistanceZone, lookbackDays) {
  if (!supportZone || !resistanceZone) return 0;
  if (supportZone.hi >= resistanceZone.lo) return 0;
  const lo = supportZone.touchLo, hi = resistanceZone.touchHi;
  const recent = candles.slice(-lookbackDays);
  if (!recent.length) return 0;
  let inside = 0;
  for (const c of recent) { if (c.low >= lo && c.high <= hi) inside++; }
  return inside / recent.length;
}

/**
 * Detect trend direction from recent price action.
 * Uses 5-bar net move direction as a simple proxy for DI+/DI-.
 * @param {Object[]} candles
 * @returns {'up'|'down'|'flat'}
 */
function trendDirection(candles) {
  if (!candles || candles.length < 6) return 'flat';
  const recent = candles.slice(-6);
  const move = recent[recent.length - 1].close - recent[0].close;
  const pct = Math.abs(move) / recent[0].close;
  if (pct < 0.005) return 'flat'; // < 0.5% is flat
  return move > 0 ? 'up' : 'down';
}

/**
 * Classify regime with correct precedence.
 * @param {number} spot
 * @param {Object|null} nearestSupport - ZoneStats
 * @param {Object|null} nearestResistance - ZoneStats
 * @param {number} containment
 * @param {number} adx
 * @param {number} atrPct
 * @param {Object} [opts] - { candles } for trend direction detection
 * @returns {{ regime: string, confidence: number, trendIntoZone: boolean }}
 */
function classifyRegime(spot, nearestSupport, nearestResistance, containment, adx, atrPct, opts) {
  const atrDist = (atrPct || 0.02) * spot;
  const scoreable = (z) => z && !z.untested;
  const tDir = opts?.candles ? trendDirection(opts.candles) : 'flat';
  let trendIntoZone = false;
  let trendIntoZoneSide = null; // 'support' (downtrend→falling knife) | 'resistance' (uptrend→melt-up/breakout)

  // ── 1. Breakout/breakdown: spot beyond a scoreable zone ──
  if (scoreable(nearestResistance) && spot > nearestResistance.zone.touchHi) {
    const dist = (spot - nearestResistance.zone.hi) / atrDist;
    return { regime: 'breakout_up', confidence: Math.round(Math.min(90, 50 + dist * 20)), trendIntoZone: false };
  }
  if (scoreable(nearestSupport) && spot < nearestSupport.zone.touchLo) {
    const dist = (nearestSupport.zone.lo - spot) / atrDist;
    return { regime: 'breakout_down', confidence: Math.round(Math.min(90, 50 + dist * 20)), trendIntoZone: false };
  }

  // ── 2. Trending: ADX > 25 — runs BEFORE proximity ──
  if ((adx || 25) > TREND_ADX_THRESHOLD) {
    // Check if trending INTO a nearby zone (falling-knife / breakout-risk)
    if (tDir === 'down' && scoreable(nearestSupport)) {
      const distToS = spot - nearestSupport.zone.lo; // distance to zone lo (can be negative if inside/below)
      if (distToS < 1.5 * atrDist && distToS > -0.5 * atrDist) { trendIntoZone = true; trendIntoZoneSide = 'support'; } // downtrend into/near support → falling knife
    }
    if (tDir === 'up' && scoreable(nearestResistance)) {
      const distToR = nearestResistance.zone.hi - spot;
      if (distToR < 1.5 * atrDist && distToR > -0.5 * atrDist) { trendIntoZone = true; trendIntoZoneSide = 'resistance'; } // uptrend into/near resistance → melt-up/breakout, NOT a falling knife
    }
    return {
      regime: 'trending',
      confidence: Math.round(Math.min(80, 40 + ((adx || 25) - 25) * 2)),
      trendIntoZone, trendIntoZoneSide,
    };
  }

  // ── 3. Testing support/resistance: spot within 0.5×ATR ──
  if (scoreable(nearestSupport)) {
    const d = spot - nearestSupport.zone.hi;
    if (d >= 0 && d < 0.5 * atrDist) {
      const prox = 1 - d / (0.5 * atrDist);
      return { regime: 'testing_support', confidence: Math.round(45 + prox * 30 + (nearestSupport.smoothedRate || 0) * 15), trendIntoZone: false };
    }
  }
  if (scoreable(nearestResistance)) {
    const d = nearestResistance.zone.lo - spot;
    if (d >= 0 && d < 0.5 * atrDist) {
      const prox = 1 - d / (0.5 * atrDist);
      return { regime: 'testing_resistance', confidence: Math.round(45 + prox * 30 + (nearestResistance.smoothedRate || 0) * 15), trendIntoZone: false };
    }
  }

  // ── 4. Range-bound: high containment + low ADX ──
  if (containment > 0.70 && (adx || 25) < 20 && scoreable(nearestSupport) && scoreable(nearestResistance)) {
    const margin = Math.min(containment - 0.70, 1 - (adx || 25) / 25);
    return { regime: 'range_bound', confidence: Math.round(55 + margin * 100), trendIntoZone: false };
  }

  // ── 5. Unclear ──
  return { regime: 'unclear', confidence: Math.min(UNCLEAR_CONFIDENCE_CAP, 30), trendIntoZone: false };
}

module.exports = { classifyRegime, computeContainment, trendDirection, UNCLEAR_CONFIDENCE_CAP, TREND_ADX_THRESHOLD };
