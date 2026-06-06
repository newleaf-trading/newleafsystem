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
 * @property {number} [openInterest] - OI at nearest strike
 * @property {number} [spreadPct] - option spread as % of mid
 * @property {number} [median5d] - median 5d forward return after touch
 * @property {number} [p75Adverse] - p75 max adverse move
 * @property {string} [earningsDate] - YYYY-MM-DD
 * @property {string} [exDivDate] - YYYY-MM-DD
 * @property {number} [dteWindow] - DTE window for event check (default 21)
 * @property {boolean} [untested] - true if nearest zone has < 3 touches
 * @property {string} [regime]
 */

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
  const dteWindow = input.dteWindow || 21;
  const today = new Date();
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
  if (!exclusionReason && input.openInterest != null && input.openInterest < 500) {
    exclusionReason = 'illiquid';
  }

  // ── Component scores ──
  components.zoneScore = input.zoneScore || 0;
  components.premiumRichness = premiumScore(input.ivRv);
  components.regimeConfidence = input.regimeConfidence || 0;

  // Distance geometry: 0% distance = 100 (on zone), 5% = 0
  const dist = Math.abs(input.distancePct || 0);
  components.distanceGeometry = Math.round(Math.max(0, (1 - dist / 5) * 100));

  // Option liquidity
  let liqScore = 50; // default moderate
  if (input.openInterest != null) {
    if (input.openInterest > 5000) liqScore = 100;
    else if (input.openInterest > 2000) liqScore = 80;
    else if (input.openInterest > 500) liqScore = 60;
    else liqScore = 20;
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

  const total = Math.round(Math.min(100, Math.max(0, weighted)));

  // Low score exclusion
  if (!exclusionReason && total < 65) {
    exclusionReason = 'low_score';
  }

  return { total, components, exclusionReason };
}

module.exports = { setupQuality, SCORE_WEIGHTS, VOL_ETP_LIST };
