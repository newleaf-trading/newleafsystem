'use strict';

/**
 * sentiment-fetch.cjs — Fetch sentiment from the NewLeaf API.
 *
 * Replaces direct calls to sentiment-engine.cjs's fetchSentiment().
 * The API endpoint (/api/sentiment/:ticker) runs the unified 4-engine
 * sentiment through the LLM router with cost tracking.
 *
 * computeModifier and buildSentimentContext remain local (genrecs-side
 * interpretation, not data fetching).
 */

const API_BASE_URL = process.env.NEWLEAF_API_URL || 'http://localhost:5400';

/**
 * Fetch composite sentiment for a symbol from the NewLeaf API.
 * Returns null if all engines failed (API returns 502).
 * Throws on network errors or unexpected responses.
 * @param {string} symbol
 * @returns {Promise<object|null>} CompositeResult or null
 */
async function fetchSentiment(symbol) {
  const url = `${API_BASE_URL}/api/sentiment/${encodeURIComponent(symbol)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120000); // 2 min — sentiment runs 4 LLM calls

  let res;
  try {
    res = await fetch(url, { signal: controller.signal });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`fetchSentiment(${symbol}): request timed out after 120s (${url})`);
    }
    throw new Error(`fetchSentiment(${symbol}): network error — ${err.message}`);
  } finally {
    clearTimeout(timeout);
  }

  // 502 = all engines failed — return null (matches old behavior)
  if (res.status === 502) {
    console.error(`  [Sentiment] ${symbol}: API returned 502 — all engines failed`);
    return null;
  }

  if (!res.ok) {
    throw new Error(`fetchSentiment(${symbol}): API returned ${res.status} ${res.statusText} (${url})`);
  }

  let body;
  try {
    body = await res.json();
  } catch {
    throw new Error(`fetchSentiment(${symbol}): malformed JSON response`);
  }

  // API response includes { ...compositeResult, cost: {...} }
  // Strip cost (genrecs doesn't need it) and return the sentiment data
  if (body.cost) delete body.cost;

  // Validate minimum expected fields
  if (body.score === undefined || !body.label) {
    throw new Error(`fetchSentiment(${symbol}): response missing score or label`);
  }

  return body;
}

/**
 * Compute trade modifier from sentiment data.
 * Pure function — operates on the CompositeResult shape from the API.
 */
function computeModifier(sentiment, direction) {
  const score = sentiment?.composite?.score ?? sentiment?.score;
  const confidence = sentiment?.composite?.confidence ?? sentiment?.confidence;

  if (score == null || confidence < 0.5) {
    return { action: 'none', points: 0, flags: [], reason: 'Insufficient confidence' };
  }

  const materialEvents = sentiment?.materialEvents || [];
  if (materialEvents.length > 0) {
    return { action: 'suppress', points: 0, flags: ['suppress'], reason: `Material event: ${materialEvents[0]}` };
  }

  if (score >= 75 && (direction === 'bullish' || direction === 'neutral')) {
    const pts = Math.min(5, Math.round((score - 70) / 6));
    return { action: 'boost', points: pts, flags: [], reason: `Bullish sentiment (${score}) aligned with ${direction} technicals` };
  }

  if (score < 35 && direction === 'bullish') {
    return { action: 'caution', points: -2, flags: ['caution'], reason: `Bearish sentiment (${score}) diverges from bullish technicals` };
  }

  if (score < 30 && direction === 'bearish') {
    return { action: 'bearish', points: -3, flags: [], reason: `Bearish sentiment (${score}) confirms bearish technicals` };
  }

  return { action: 'none', points: 0, flags: [], reason: 'Neutral sentiment — no modifier' };
}

/**
 * Build formatted sentiment context for LLM prompts.
 * Pure function — operates on the CompositeResult shape from the API.
 */
function buildSentimentContext(sentiment) {
  if (!sentiment) return '';

  const score = sentiment.composite?.score ?? sentiment.score;
  const label = sentiment.composite?.label ?? sentiment.label;
  const confidence = sentiment.composite?.confidence ?? sentiment.confidence;
  const engines = sentiment.engines ? Object.keys(sentiment.engines) : [sentiment.source || 'unknown'];

  const drivers = (sentiment.keyDrivers || []).map(d => {
    const icon = d.impact === 'positive' ? '+' : d.impact === 'negative' ? '-' : '~';
    const src = d.source ? ` (${d.source})` : '';
    const eng = d.engine ? ` [${d.engine}]` : '';
    return `    ${icon} ${d.factor}${src}${eng}`;
  }).join('\n');

  const events = (sentiment.materialEvents || []).length > 0
    ? `  Material Events:   ${sentiment.materialEvents.join(', ')}`
    : '  Material Events:   None';

  return `
MARKET SENTIMENT CONTEXT (${engines.length} AI engine${engines.length > 1 ? 's' : ''}: ${engines.join(', ')}):
  Composite Score:   ${score}/100 (${label})
  Confidence:        ${Math.round((confidence || 0) * 100)}%
  Summary:           ${sentiment.summary || 'N/A'}
  Key Drivers:
${drivers || '    (none found)'}
  Social Mood:       ${sentiment.socialSentiment || 'N/A'}
  Sector Theme:      ${sentiment.sectorContext || 'N/A'}
${events}`;
}

module.exports = { fetchSentiment, computeModifier, buildSentimentContext };
