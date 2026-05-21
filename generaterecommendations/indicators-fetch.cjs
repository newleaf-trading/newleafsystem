'use strict';

/**
 * indicators-fetch.cjs — Fetch computed technical indicators from the NewLeaf API.
 *
 * Used by publish-pick.cjs and analyse-tiles.cjs to inject real indicator values
 * into LLM prompts as ground truth, preventing hallucinated MACD/RSI/BB/SMA values.
 *
 * Architecture: genrecs does NOT compute indicators locally. It calls api/'s
 * /api/indicators/:ticker endpoint which uses shared/indicators/ internally.
 */

const API_BASE_URL = process.env.NEWLEAF_API_URL || 'http://localhost:5400';

const REQUIRED_FIELDS = [
  'rsi14', 'bollingerUpper', 'bollingerLower', 'bollingerWidth',
  'macdLine', 'macdSignal', 'macdHistogram',
  'sma20', 'sma50', 'sma100',
];

/**
 * Fetch computed indicators for a symbol from the NewLeaf API.
 * Throws on any failure — network, non-200, missing fields, malformed JSON.
 * @param {string} symbol
 * @returns {Promise<object>} The indicators object from api/
 */
async function fetchIndicators(symbol) {
  const url = `${API_BASE_URL}/api/indicators/${encodeURIComponent(symbol)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  let res;
  try {
    res = await fetch(url, { signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`fetchIndicators(${symbol}): request timed out after 10s (${url})`);
    }
    throw new Error(`fetchIndicators(${symbol}): network error — ${err.message}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    throw new Error(`fetchIndicators(${symbol}): API returned ${res.status} ${res.statusText} (${url})`);
  }

  let body;
  try {
    body = await res.json();
  } catch {
    throw new Error(`fetchIndicators(${symbol}): malformed JSON response`);
  }

  const indicators = body?.indicators;
  if (!indicators || typeof indicators !== 'object') {
    throw new Error(`fetchIndicators(${symbol}): response missing 'indicators' object`);
  }

  for (const field of REQUIRED_FIELDS) {
    const val = indicators[field];
    if (val === undefined || val === null || !Number.isFinite(val)) {
      throw new Error(`fetchIndicators(${symbol}): missing or invalid field '${field}' (got ${val})`);
    }
  }

  return indicators;
}

/**
 * Build a prompt context block with ground-truth indicator values.
 * Injected near the top of the LLM prompt so all numeric indicators are anchored.
 * @param {object} ind — indicators object from fetchIndicators()
 * @returns {string}
 */
function buildIndicatorsContext(ind) {
  return `
GROUND TRUTH TECHNICAL INDICATORS (use these EXACT values, do not modify):
  - RSI(14): ${ind.rsi14.toFixed(1)}
  - Bollinger Bands (20, 2σ): upper=${ind.bollingerUpper.toFixed(2)}, middle=${ind.sma20.toFixed(2)}, lower=${ind.bollingerLower.toFixed(2)}, width=${ind.bollingerWidth.toFixed(2)}%
  - MACD(12,26,9): line=${ind.macdLine.toFixed(3)}, signal=${ind.macdSignal.toFixed(3)}, histogram=${ind.macdHistogram.toFixed(3)}
  - Moving Averages: SMA20=${ind.sma20.toFixed(2)}, SMA50=${ind.sma50.toFixed(2)}, SMA100=${ind.sma100.toFixed(2)}, SMA200=${(ind.sma200 ?? 0).toFixed(2)}
  - Trend context: ${ind.smaTrend || 'N/A'}, price ${ind.priceVsSma || 'N/A'}`;
}

/**
 * Validate that Claude's response echoes back the ground-truth indicator values
 * rather than substituting its own numbers.
 *
 * Tolerances:
 *   RSI: 0.5 absolute
 *   Prices (BB, SMAs): 1% relative
 *   MACD: 0.001 absolute
 *
 * Only validates numeric fields. Signal/description text fields are LLM output
 * and intentionally not validated.
 *
 * @param {object} analysis — parsed Claude analysis JSON
 * @param {object} ind — indicators object from fetchIndicators()
 * @throws if LLM substituted numbers
 */
function validateIndicatorsInResponse(analysis, ind) {
  const ti = analysis?.technicalIndicators;
  if (!ti) throw new Error('Validation: analysis missing technicalIndicators');

  const errors = [];

  function checkAbsolute(label, actual, expected, tolerance) {
    if (actual === undefined || actual === null) return; // field may be absent, that's a schema issue not substitution
    if (Math.abs(actual - expected) > tolerance) {
      errors.push(`${label}: expected ${expected}, got ${actual} (tolerance ${tolerance})`);
    }
  }

  function checkRelative(label, actual, expected, tolerancePct) {
    if (actual === undefined || actual === null) return;
    if (expected === 0) {
      if (Math.abs(actual) > 1) errors.push(`${label}: expected ~0, got ${actual}`);
      return;
    }
    const pct = Math.abs((actual - expected) / expected);
    if (pct > tolerancePct) {
      errors.push(`${label}: expected ${expected}, got ${actual} (${(pct * 100).toFixed(1)}% off, tolerance ${tolerancePct * 100}%)`);
    }
  }

  // RSI
  if (ti.rsi) checkAbsolute('rsi.value', ti.rsi.value, ind.rsi14, 0.5);

  // Bollinger Bands
  if (ti.bollingerBands) {
    checkRelative('bb.upper', ti.bollingerBands.upper, ind.bollingerUpper, 0.01);
    checkRelative('bb.lower', ti.bollingerBands.lower, ind.bollingerLower, 0.01);
    checkRelative('bb.middle', ti.bollingerBands.middle, ind.sma20, 0.01);
  }

  // MACD
  if (ti.macd) {
    checkAbsolute('macd.macdLine', ti.macd.macdLine, ind.macdLine, 0.001);
    checkAbsolute('macd.signalLine', ti.macd.signalLine, ind.macdSignal, 0.001);
    checkAbsolute('macd.histogram', ti.macd.histogram, ind.macdHistogram, 0.001);
  }

  // Moving Averages
  if (ti.movingAverages) {
    checkRelative('ma.sma20', ti.movingAverages.sma20, ind.sma20, 0.01);
    checkRelative('ma.sma50', ti.movingAverages.sma50, ind.sma50, 0.01);
    checkRelative('ma.sma100', ti.movingAverages.sma100, ind.sma100, 0.01);
  }

  if (errors.length > 0) {
    throw new Error(`Indicator validation failed — LLM substituted values:\n  ${errors.join('\n  ')}`);
  }
}

module.exports = { fetchIndicators, buildIndicatorsContext, validateIndicatorsInResponse };
