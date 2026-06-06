'use strict';

/**
 * zones.cjs — ATR-based level clustering into zones
 *
 * Levels within 0.6 × ATR(14) × spot of each other merge into one zone.
 * Zone touch detection width = 0.25 × ATR(14) × spot beyond zone edges.
 */

const MERGE_ATR_MULT = 0.6;
const TOUCH_ATR_MULT = 0.25;

/**
 * @typedef {Object} Level
 * @property {number} price
 * @property {string} source - gamma_wall | moving_average | bollinger | swing
 * @property {string} label
 */

/**
 * @typedef {Object} Zone
 * @property {number} lo - lowest level price in this zone
 * @property {number} hi - highest level price in this zone
 * @property {number} touchLo - lo minus touch width (for touch detection)
 * @property {number} touchHi - hi plus touch width (for touch detection)
 * @property {string[]} sources - all merged source labels
 * @property {'support'|'resistance'} type
 */

/**
 * Cluster raw levels into zones using ATR-based merge distance.
 * @param {number} spot - current price
 * @param {Level[]} levels - all raw S/R levels
 * @param {number} atrPct - ATR(14) as decimal (e.g. 0.02 = 2%)
 * @returns {{ supportZones: Zone[], resistanceZones: Zone[] }}
 */
function clusterLevels(spot, levels, atrPct) {
  if (!spot || !levels?.length || !atrPct) return { supportZones: [], resistanceZones: [] };

  const mergeThreshold = MERGE_ATR_MULT * atrPct * spot;
  const touchWidth = TOUCH_ATR_MULT * atrPct * spot;

  // Separate into support (below spot) and resistance (above spot)
  // Filter out levels > 15% from spot
  const supportLevels = levels
    .filter(l => l.price > 0 && l.price < spot && (spot - l.price) / spot < 0.15)
    .sort((a, b) => a.price - b.price);

  const resistanceLevels = levels
    .filter(l => l.price > 0 && l.price > spot && (l.price - spot) / spot < 0.15)
    .sort((a, b) => a.price - b.price);

  function merge(sorted, type) {
    const zones = [];
    for (const level of sorted) {
      const last = zones[zones.length - 1];
      if (last && Math.abs(level.price - last.hi) <= mergeThreshold) {
        // Merge into existing zone
        last.hi = Math.max(last.hi, level.price);
        last.sources.push(level.label || level.source);
      } else {
        // New zone
        zones.push({
          lo: level.price,
          hi: level.price,
          touchLo: 0, // computed after all merges
          touchHi: 0,
          sources: [level.label || level.source],
          type,
        });
      }
    }
    // Compute touch detection bounds
    for (const z of zones) {
      z.touchLo = z.lo - touchWidth;
      z.touchHi = z.hi + touchWidth;
    }
    return zones;
  }

  return {
    supportZones: merge(supportLevels, 'support'),
    resistanceZones: merge(resistanceLevels, 'resistance'),
  };
}

/**
 * Gather raw levels from a report's technical + gamma data.
 * @param {number} spot
 * @param {Object} opts - { putWall, callWall, sma50, sma100, sma200, bbLower, bbUpper, bars }
 * @returns {Level[]}
 */
function gatherLevels(spot, opts) {
  const levels = [];
  const add = (price, source, label) => {
    if (price && price > 0 && isFinite(price)) levels.push({ price, source, label });
  };

  if (opts.putWall) add(opts.putWall, 'gamma_wall', 'Put wall');
  if (opts.callWall) add(opts.callWall, 'gamma_wall', 'Call wall');
  if (opts.sma50) add(opts.sma50, 'moving_average', 'SMA50');
  if (opts.sma100) add(opts.sma100, 'moving_average', 'SMA100');
  if (opts.sma200) add(opts.sma200, 'moving_average', 'SMA200');
  if (opts.bbLower) add(opts.bbLower, 'bollinger', 'BB lower');
  if (opts.bbUpper) add(opts.bbUpper, 'bollinger', 'BB upper');

  // Swing high/low from recent bars
  if (opts.bars?.length >= 20) {
    const recent = opts.bars.slice(-20);
    const lo = Math.min(...recent.map(b => b.low ?? b.l));
    const hi = Math.max(...recent.map(b => b.high ?? b.h));
    add(lo, 'swing', '20d low');
    add(hi, 'swing', '20d high');
  }

  return levels;
}

module.exports = { clusterLevels, gatherLevels, MERGE_ATR_MULT, TOUCH_ATR_MULT };
