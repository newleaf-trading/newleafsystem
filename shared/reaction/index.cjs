'use strict';

/**
 * shared/reaction/index.cjs — Price Reaction Analyzer v2
 *
 * Deterministic zone-based S/R analysis with Wilson smoothing,
 * ATR-clustered levels, and composite Setup Quality scoring.
 */

const { clusterLevels, gatherLevels, MERGE_ATR_MULT, TOUCH_ATR_MULT } = require('./zones.cjs');
const { analyzeZone, findZoneTouches, wilsonInterval, MIN_TOUCHES } = require('./stats.cjs');
const { forwardReturns, median, percentile } = require('./forward.cjs');
const { premiumLabel, premiumScore, PREMIUM_THRESHOLDS } = require('./premium.cjs');
const { classifyRegime, computeContainment, UNCLEAR_CONFIDENCE_CAP } = require('./regime.cjs');
const { setupQuality, SCORE_WEIGHTS, VOL_ETP_LIST } = require('./score.cjs');

module.exports = {
  // zones
  clusterLevels, gatherLevels, MERGE_ATR_MULT, TOUCH_ATR_MULT,
  // stats
  analyzeZone, findZoneTouches, wilsonInterval, MIN_TOUCHES,
  // forward
  forwardReturns, median, percentile,
  // premium
  premiumLabel, premiumScore, PREMIUM_THRESHOLDS,
  // regime
  classifyRegime, computeContainment, UNCLEAR_CONFIDENCE_CAP,
  // score
  setupQuality, SCORE_WEIGHTS, VOL_ETP_LIST,
};
