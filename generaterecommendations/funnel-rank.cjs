/**
 * funnel-rank.cjs — Rank, dedupe, and select top signals for pricing.
 *
 * Reads active scanner_signals, scores by opportunityScore × confidence,
 * dedupes by symbol+strategyCode, and returns the top N (buffer) for pricing.
 *
 * The buffer is 2× the final N — the funnel prices this set, then applies
 * a quality bar to select the best N from the priced results.
 *
 * @module funnel-rank
 */
'use strict';

// ═══════════════════════════════════════════════════════════════
// Configuration
// ═══════════════════════════════════════════════════════════════

const DEFAULTS = {
  /** Final target count for Discover */
  N: 15,
  /** Buffer multiplier — price 2× to allow quality-bar filtering */
  bufferMultiplier: 2,
  /** Minimum confidence to consider (filters noise) */
  minConfidence: 0.3,
  /** Strategy types that have real builders (can be priced) */
  priceableStrategies: ['iron_condor', 'iron_butterfly', 'bull_put_spread', 'bear_call_spread'],
};

// ═══════════════════════════════════════════════════════════════
// rankSignals — pure function, no I/O
// ═══════════════════════════════════════════════════════════════

/**
 * Rank, filter, dedupe, and select the top signals for pricing.
 *
 * @param {Array} signals — active scanner_signals docs
 * @param {object} [opts] — override defaults
 * @param {number} [opts.N=15]
 * @param {number} [opts.bufferMultiplier=2]
 * @param {number} [opts.minConfidence=0.3]
 * @param {string[]} [opts.priceableStrategies]
 * @returns {{
 *   selected: Array,       — top 2N signals to price
 *   skipped: Array<{signal, reason}>,
 *   stats: { total, filtered, deduped, selected, bufferSize }
 * }}
 */
function rankSignals(signals, opts = {}) {
  const config = { ...DEFAULTS, ...opts };
  const bufferSize = config.N * config.bufferMultiplier;

  const skipped = [];

  // 1. Filter: only active, priceable strategies, above minimum confidence
  const filtered = signals.filter(s => {
    if (!s.isActive) {
      skipped.push({ signal: s, reason: 'inactive' });
      return false;
    }

    const code = normalizeCode(s.strategyCode || s.strategy);
    if (!config.priceableStrategies.includes(code)) {
      skipped.push({ signal: s, reason: `unpriceable strategy: ${s.strategy} (${code})` });
      return false;
    }

    const confidence = s.gammaData?.confidence?.overall ?? 0;
    if (confidence < config.minConfidence) {
      skipped.push({ signal: s, reason: `low confidence: ${(confidence * 100).toFixed(0)}% < ${(config.minConfidence * 100).toFixed(0)}%` });
      return false;
    }

    return true;
  });

  // 2. Score: opportunityScore × confidence
  const scored = filtered.map(s => {
    const confidence = s.gammaData?.confidence?.overall ?? 0.5;
    const score = (s.opportunityScore || 0) * confidence;
    return { signal: s, score };
  });

  // 3. Sort descending by composite score
  scored.sort((a, b) => b.score - a.score);

  // 4. Dedupe: one per symbol + strategyCode (keep highest-scoring)
  const seen = new Set();
  const deduped = [];
  for (const entry of scored) {
    const key = `${entry.signal.symbol}_${normalizeCode(entry.signal.strategyCode || entry.signal.strategy)}`;
    if (seen.has(key)) {
      skipped.push({ signal: entry.signal, reason: `duplicate: ${key}` });
      continue;
    }
    seen.add(key);
    deduped.push(entry);
  }

  // 5. Take top bufferSize
  const selected = deduped.slice(0, bufferSize).map(e => e.signal);

  return {
    selected,
    skipped,
    stats: {
      total: signals.length,
      filtered: filtered.length,
      deduped: deduped.length,
      selected: selected.length,
      bufferSize,
    },
  };
}

// ═══════════════════════════════════════════════════════════════
// qualitySelect — pick the best N from priced results
// ═══════════════════════════════════════════════════════════════

/**
 * From a set of successfully priced tiles, select the best N by quality.
 *
 * Quality = R:R × 60 + PoP × 40. No separate confidence term — the funnel
 * has no adversarial analysis, so tile.confidence === oddsOfProfit and
 * including it would double-count PoP.
 *
 * @param {Array} pricedTiles — tiles that passed validation
 * @param {number} N — target count
 * @returns {Array} — top N tiles by quality
 */
function qualitySelect(pricedTiles, N) {
  const scored = pricedTiles.map(tile => {
    const rr = tile.rewardRisk || 0;
    const pop = (tile.oddsOfProfit || 0) / 100; // normalize to 0-1

    // R:R and PoP only — no confidence term (would double-count PoP)
    const quality = (rr * 60) + (pop * 40);

    return { tile, quality };
  });

  scored.sort((a, b) => b.quality - a.quality);

  return scored.slice(0, N).map(e => e.tile);
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function normalizeCode(strategy) {
  if (!strategy) return 'unknown';
  return strategy.toLowerCase().replace(/[\s-]+/g, '_').replace(/[^a-z_]/g, '');
}

// ═══════════════════════════════════════════════════════════════
// Exports
// ═══════════════════════════════════════════════════════════════

module.exports = { rankSignals, qualitySelect, normalizeCode, DEFAULTS };
