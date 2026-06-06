'use strict';

/**
 * premium.cjs — IV/RV premium labeling
 * Single source of truth for premium classification thresholds.
 */

const PREMIUM_THRESHOLDS = { cheap: 0.95, fair: 1.15 };

/**
 * @param {number} ivRv - IV / RV ratio
 * @returns {'cheap'|'fair'|'rich'|'--'}
 */
function premiumLabel(ivRv) {
  if (ivRv == null || !isFinite(ivRv) || ivRv <= 0) return '--';
  if (ivRv <= PREMIUM_THRESHOLDS.cheap) return 'cheap';
  if (ivRv < PREMIUM_THRESHOLDS.fair) return 'fair';
  return 'rich';
}

/**
 * @param {number} ivRv
 * @returns {number} 0-100 score for premium richness
 */
function premiumScore(ivRv) {
  if (ivRv == null || !isFinite(ivRv) || ivRv <= 0) return 0;
  // Linear scale: 0.8→0, 1.0→40, 1.15→70, 1.5→100
  if (ivRv <= 0.8) return 0;
  if (ivRv >= 1.5) return 100;
  return Math.round(((ivRv - 0.8) / 0.7) * 100);
}

module.exports = { premiumLabel, premiumScore, PREMIUM_THRESHOLDS };
