'use strict';

/**
 * score.cjs — Composite Setup Quality score (0-100)
 */

const { premiumLabel, premiumScore } = require('./premium.cjs');

const SCORE_WEIGHTS = {
  zoneScore:        0.30,
  premiumRichness:  0.20,
  regimeConfidence: 0.15,
  distanceGeometry: 0.15,
  optionLiquidity:  0.10,
  forwardEdge:      0.10,
};

const VOL_ETP_LIST = new Set([
  'UVXY', 'SVXY', 'VXX', 'VIXY', 'VIXM',
  'SQQQ', 'TQQQ', 'SPXU', 'SPXL', 'TZA', 'TNA',
  'SOXS', 'SOXL', 'LABU', 'LABD', 'ARKK',
]);

/**
 * @typedef {Object} QualityInput
 * @property {string} symbol
 * @property {number} spot
 * @property {number} zoneScore - from stats.cjs (nearest zone's score)
 * @property {number} ivRv - IV/RV ratio
 * @property {number} regimeConfidence - from regime.cjs
 * @property {number} distancePct - % distance from spot to nearest zone (0=on zone, higher=further)
 * @property {number} [topStrikesOI] - sum of call_oi+put_oi from gammaData.analysis.topStrikes[] (strike-level proxy, not candidate short strike)
 * @property {boolean} [oiDataAvailable] - false if all OI is zero (fast pipeline run, no daily OI enrichment)
 * @property {number} [spreadPct] - option spread as % of mid
 * @property {number} [median5d] - median 5d forward return after touch
 * @property {number} [p75Adverse] - p75 max adverse move
 * @property {string} [earningsDate] - YYYY-MM-DD
 * @property {string} [exDivDate] - YYYY-MM-DD
 * @property {number} [dteWindow] - DTE window for event check (default 21)
 * @property {boolean} [untested] - true if nearest zone has < 3 touches
 * @property {string} [regime]
 * @property {number} [supportZoneScore] - smoothed zone score for nearest support rail
 * @property {number} [resistanceZoneScore] - smoothed zone score for nearest resistance rail
 * @property {string} [strategyBias] - suggested strategy (bull_put_spread, bear_call_spread, iron_condor, etc.)
 * @property {number} [approachMove3bar] - absolute net move over last 3 bars as decimal (e.g. 0.05 = 5%)
 * @property {number} [atrPct] - ATR(14) as decimal for approach-velocity check
 */

const RELEVANT_RAIL_MIN = 65;

/**
 * Compute composite setupQuality.
 * @param {QualityInput} input
 * @returns {{ total: number, components: Object, exclusionReason?: string }}
 */
function setupQuality(input) {
  const components = {};
  let exclusionReason = null;

  // ── Exclusion checks ──
  // Event risk: earnings or ex-div inside DTE window
  // earningsDate may come from the report (if pipeline wrote it) or from a calendar lookup
  const dteWindow = input.dteWindow || 21;
  const today = input._today || new Date(); // injectable for testing
  const earningsVerified = input.earningsDate != null;
  if (input.earningsDate) {
    const ed = new Date(input.earningsDate);
    const daysToEarnings = (ed - today) / 86400000;
    if (daysToEarnings >= 0 && daysToEarnings <= dteWindow) {
      exclusionReason = 'earnings_in_window';
    }
  }
  if (!exclusionReason && input.exDivDate) {
    const xd = new Date(input.exDivDate);
    const daysToExDiv = (xd - today) / 86400000;
    if (daysToExDiv >= 0 && daysToExDiv <= dteWindow) {
      exclusionReason = 'exdiv_in_window';
    }
  }

  // Untested zones
  if (!exclusionReason && input.untested) {
    exclusionReason = 'untested_zone';
  }

  // Illiquid / vol ETP
  if (!exclusionReason && VOL_ETP_LIST.has(input.symbol)) {
    exclusionReason = 'vol_etp';
  }
  if (!exclusionReason && input.spreadPct && input.spreadPct > 5) {
    exclusionReason = 'illiquid';
  }
  // OI exclusion: only exclude when OI data IS available and confirmed low
  // If OI data is absent (fast pipeline run), do NOT exclude — mark as unverified
  if (!exclusionReason && input.oiDataAvailable === true && input.topStrikesOI != null && input.topStrikesOI < 500) {
    exclusionReason = 'illiquid';
  }

  // Track whether liquidity was verified
  const liquidityVerified = input.oiDataAvailable !== false;

  // ── Component scores ──
  components.zoneScore = input.zoneScore || 0;
  components.premiumRichness = premiumScore(input.ivRv);
  components.regimeConfidence = input.regimeConfidence || 0;

  // Distance geometry: 0% distance = 100 (on zone), 5% = 0
  const dist = Math.abs(input.distancePct || 0);
  components.distanceGeometry = Math.round(Math.max(0, (1 - dist / 5) * 100));

  // Option liquidity score from topStrikes OI (strike-level proxy)
  let liqScore = 50; // default moderate when no OI data
  if (input.oiDataAvailable !== false && input.topStrikesOI != null) {
    if (input.topStrikesOI > 50000) liqScore = 100;
    else if (input.topStrikesOI > 20000) liqScore = 80;
    else if (input.topStrikesOI > 5000) liqScore = 60;
    else liqScore = 30;
  }
  if (input.spreadPct != null) {
    if (input.spreadPct < 1) liqScore = Math.max(liqScore, 90);
    else if (input.spreadPct > 3) liqScore = Math.min(liqScore, 40);
  }
  components.optionLiquidity = liqScore;

  // Forward edge
  const med5 = input.median5d || 0;
  components.forwardEdge = Math.round(Math.min(100, Math.max(0, med5 * 2000))); // 5% = 100

  // Event risk penalty
  let eventPenalty = 0;
  if (input.earningsDate) {
    const ed = new Date(input.earningsDate);
    const days = (ed - today) / 86400000;
    if (days >= 0 && days <= dteWindow * 1.5) {
      eventPenalty = Math.round(Math.max(0, 30 - days)); // closer earnings = bigger penalty
    }
  }
  components.eventRiskPenalty = eventPenalty;

  // ── Composite ──
  const weighted =
    components.zoneScore * SCORE_WEIGHTS.zoneScore +
    components.premiumRichness * SCORE_WEIGHTS.premiumRichness +
    components.regimeConfidence * SCORE_WEIGHTS.regimeConfidence +
    components.distanceGeometry * SCORE_WEIGHTS.distanceGeometry +
    components.optionLiquidity * SCORE_WEIGHTS.optionLiquidity +
    components.forwardEdge * SCORE_WEIGHTS.forwardEdge -
    eventPenalty;

  let total = Math.round(Math.min(100, Math.max(0, weighted)));

  // ── Relevant-rail gate ──
  // The zone the strategy sells against must have smoothed score >= 65.
  // Support-side strategies: check support rail. Resistance-side: check resistance rail.
  // Condor/butterfly: both rails must clear.
  let gateReason = null;
  const bias = input.strategyBias || '';
  const sZS = input.supportZoneScore ?? 0;
  const rZS = input.resistanceZoneScore ?? 0;

  const needsSupport = bias.includes('bull_put') || bias.includes('bull_call') || input.regime === 'testing_support';
  const needsResistance = bias.includes('bear_call') || bias.includes('bear_put') || input.regime === 'testing_resistance';
  const needsBoth = bias.includes('condor') || bias.includes('butterfly');

  if (!exclusionReason) {
    if (needsBoth && (sZS < RELEVANT_RAIL_MIN || rZS < RELEVANT_RAIL_MIN)) {
      gateReason = 'weak relevant rail';
      total = Math.min(total, 64);
    } else if (needsSupport && sZS < RELEVANT_RAIL_MIN) {
      gateReason = 'weak relevant rail';
      total = Math.min(total, 64);
    } else if (needsResistance && rZS < RELEVANT_RAIL_MIN) {
      gateReason = 'weak relevant rail';
      total = Math.min(total, 64);
    }
  }

  // Low score exclusion
  // ── Approach-velocity guard (falling-knife) ──
  // If price reached the zone fast (3-bar move > 2×ATR toward zone), cap at 64
  if (!exclusionReason && !gateReason && input.approachMove3bar != null && input.atrPct) {
    const moveAbs = Math.abs(input.approachMove3bar);
    const threshold = 3 * input.atrPct; // 3×ATR: targets genuinely hostile drops, not normal vol
    if (moveAbs > threshold) {
      gateReason = 'hostile approach';
      total = Math.min(total, 64);
    }
  }

  if (!exclusionReason && total < 65) {
    exclusionReason = 'low_score';
  }

  return { total, components, exclusionReason, liquidityVerified, earningsVerified, gateReason };
}

/**
 * Range Quality score 0–100. Continuous — does NOT require range_bound regime.
 * Surfaces the best condor/butterfly candidates regardless of binary regime.
 *
 * @param {Object} input
 * @param {number} input.containment - 0-1 containment fraction
 * @param {number} input.adx - ADX(14)
 * @param {number} input.supportScore - nearest support zone score
 * @param {number} input.resistanceScore - nearest resistance zone score
 * @param {boolean} input.supportTested - ≥3 touches
 * @param {boolean} input.resistanceTested - ≥3 touches
 * @param {number|null} input.posInRange - 0-1 position in range
 * @returns {number} 0-100
 */
function rangeQuality(input) {
  let score = 0;

  // Containment fraction (40%)
  score += Math.min(40, (input.containment || 0) * 40);

  // ADX inverse: lower ADX = better for range (25%)
  // ADX 0 → 25, ADX 15 → 17, ADX 25 → 0
  const adx = input.adx || 25;
  score += Math.max(0, (1 - adx / 25) * 25);

  // Both rails tested and strong (20%)
  const sStrong = input.supportTested && input.supportScore >= 65;
  const rStrong = input.resistanceTested && input.resistanceScore >= 65;
  if (sStrong && rStrong) score += 20;
  else if (sStrong || rStrong) score += 8;
  else if (input.supportTested || input.resistanceTested) score += 3;

  // Centeredness: 1 − |posInRange − 0.5| × 2 (15%)
  // pos 0.5 → 15, pos 0.0 or 1.0 → 0
  if (input.posInRange != null) {
    const centeredness = 1 - Math.abs(input.posInRange - 0.5) * 2;
    score += Math.max(0, centeredness * 15);
  }

  return Math.round(Math.min(100, Math.max(0, score)));
}

module.exports = { setupQuality, rangeQuality, SCORE_WEIGHTS, VOL_ETP_LIST, RELEVANT_RAIL_MIN };
