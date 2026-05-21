#!/usr/bin/env node
/**
 * sentiment-engine.js — Multi-Engine AI Sentiment Analysis
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Four AI engines produce a weighted composite sentiment score:
 *   1. Claude (Anthropic) — Web search + financial news analysis (30%)
 *   2. Grok (xAI)         — X/Twitter social sentiment (25%)
 *   3. Gemini (Google)     — Google News + sector narratives (25%)
 *   4. Reddit/Social       — Reddit WSB + StockTwits aggregation (20%)
 *
 * Engines with missing API keys are skipped; weight redistributes.
 * Cache: reports/{SYMBOL}/sentiment.json — 6-hour TTL
 *
 * Exports:
 *   fetchSentiment(symbol)              → composite + per-engine data
 *   computeModifier(sentiment, dir)     → { action, points, flags, reason }
 *   buildSentimentContext(sentiment)     → formatted text for Claude prompt
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

const { spawnSync } = require('child_process');
const fs   = require('fs');
const path = require('path');
const axios = require('axios');

const REPORTS_DIR = path.join(__dirname, 'reports');
const CACHE_MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours

// ── Config ──────────────────────────────────────────────────────────────────

function loadConfig() {
  try {
    const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
    return cfg.sentiment || {};
  } catch { return {}; }
}

function getEngineConfig() {
  const cfg = loadConfig();
  return {
    claude:  { enabled: true, weight: 0.30, ...(cfg.engines?.claude || {}) },
    grok:    { enabled: false, weight: 0.25, apiKey: '', ...(cfg.engines?.grok || {}) },
    gemini:  { enabled: false, weight: 0.25, apiKey: '', ...(cfg.engines?.gemini || {}) },
    reddit:  { enabled: true, weight: 0.20, ...(cfg.engines?.reddit || {}) },
  };
}

// ── Shared Helpers ──────────────────────────────────────────────────────────

function extractJSON(raw) {
  let cleaned = raw
    .replace(/^```json\s*/m, '')
    .replace(/^```\s*/m, '')
    .replace(/```\s*$/m, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end   = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found in output');
  return JSON.parse(cleaned.slice(start, end + 1));
}

function classifyScore(score) {
  if (score >= 70) return 'bullish';
  if (score < 40) return 'bearish';
  return 'neutral';
}

const SENTIMENT_PROMPT_SUFFIX = `
Return ONLY a JSON object (no markdown, no explanation):
{
  "symbol": "<SYMBOL>",
  "score": <0-100, 50=neutral, above 70=bullish, below 30=bearish>,
  "label": "<bullish|neutral|bearish>",
  "confidence": <0.0-1.0>,
  "summary": "<2-3 sentence synthesis>",
  "keyDrivers": [
    {"factor": "<specific event>", "impact": "<positive|negative|neutral>", "source": "<source name>"}
  ],
  "materialEvents": ["<only if imminent: earnings, M&A, regulatory>"],
  "socialSentiment": "<retail/social mood or null>",
  "sectorContext": "<sector theme or null>"
}
Be specific and cite real sources.`;

// ═══════════════════════════════════════════════════════════════════════════
// ENGINE 1: Claude (Anthropic) — Web Search
// ═══════════════════════════════════════════════════════════════════════════

async function fetchSentimentClaude(symbol) {
  const prompt = `You are a financial sentiment analyst for an options trading system.
Analyze the current market sentiment for ${symbol} using web search.
Focus on developments from the last 48 hours.

Search for:
  1. Breaking news and developments
  2. Analyst upgrades, downgrades, price target changes
  3. Earnings announcements, guidance, or pre-announcements
  4. Material corporate events (M&A, regulatory, legal)
  5. Social media and retail trader sentiment
  6. Sector-wide themes affecting this stock
${SENTIMENT_PROMPT_SUFFIX.replace('<SYMBOL>', symbol)}
If you find no significant news, return score 50 with label "neutral" and confidence below 0.5.`;

  const result = spawnSync('claude', [
    '--print', '--output-format', 'text',
    '--allowedTools', 'WebFetch,WebSearch',
  ], {
    input: prompt,
    encoding: 'utf8',
    timeout: 300000,
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.status !== 0) throw new Error(`Claude CLI: ${result.stderr || result.error?.message || 'timeout'}`);
  const data = extractJSON(result.stdout.trim());
  data.engine = 'claude';
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════
// ENGINE 2: Grok (xAI) — X/Twitter Analysis
// ═══════════════════════════════════════════════════════════════════════════

async function fetchSentimentGrok(symbol, apiKey) {
  const prompt = `You are a financial sentiment analyst specializing in social media analysis.
Analyze the current sentiment for $${symbol} on X (Twitter) and social media.
Focus on the last 48 hours.

Look for:
  1. Trending $${symbol} posts and discussions
  2. Influential trader/analyst mentions and opinions
  3. Retail sentiment direction and velocity (is sentiment shifting?)
  4. Meme stock activity or unusual social volume
  5. Options flow commentary ($${symbol} calls/puts discussion)
  6. Any viral news or narratives about this stock
${SENTIMENT_PROMPT_SUFFIX.replace('<SYMBOL>', symbol)}`;

  const response = await axios.post('https://api.x.ai/v1/chat/completions', {
    model: 'grok-3-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
  }, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    timeout: 120000,
  });

  const raw = response.data.choices?.[0]?.message?.content || '';
  const data = extractJSON(raw);
  data.engine = 'grok';
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════
// ENGINE 3: Gemini (Google) — News & Sector Analysis
// ═══════════════════════════════════════════════════════════════════════════

async function fetchSentimentGemini(symbol, apiKey) {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    tools: [{ googleSearch: {} }],
  });

  const prompt = `You are a financial sentiment analyst specializing in news analysis.
Analyze the current market sentiment for ${symbol} using Google Search.
Focus on developments from the last 48 hours.

Search for:
  1. Major financial news from Bloomberg, Reuters, CNBC, WSJ
  2. Sector rotation narratives and institutional flow
  3. Regulatory and policy developments affecting this stock
  4. Supply chain and industry-specific news
  5. Competitor developments that may impact ${symbol}
  6. Macro-economic events affecting this stock's sector
${SENTIMENT_PROMPT_SUFFIX.replace('<SYMBOL>', symbol)}`;

  const result = await model.generateContent(prompt);
  const raw = result.response.text();
  const data = extractJSON(raw);
  data.engine = 'gemini';
  return data;
}

// ═══════════════════════════════════════════════════════════════════════════
// ENGINE 4: Reddit + StockTwits — Social Aggregation
// ═══════════════════════════════════════════════════════════════════════════

async function fetchSentimentReddit(symbol) {
  let posts = [];
  let stocktwitsData = null;

  // Reddit: search WSB and r/options
  const subreddits = ['wallstreetbets', 'options', 'stocks'];
  for (const sub of subreddits) {
    try {
      const url = `https://www.reddit.com/r/${sub}/search.json?q=${symbol}&sort=new&t=week&limit=25`;
      const res = await axios.get(url, {
        headers: { 'User-Agent': 'NewLeaf/1.0 (Options Trading Research)' },
        timeout: 15000,
      });
      const children = res.data?.data?.children || [];
      posts.push(...children.map(c => ({
        title: c.data.title,
        score: c.data.score,
        comments: c.data.num_comments,
        subreddit: sub,
        created: c.data.created_utc,
        upvoteRatio: c.data.upvote_ratio,
      })));
    } catch { /* skip failed subreddit */ }
  }

  // StockTwits
  try {
    const stRes = await axios.get(`https://api.stocktwits.com/api/2/streams/symbol/${symbol}.json`, {
      timeout: 10000,
    });
    const msgs = stRes.data?.messages || [];
    const bullish = msgs.filter(m => m.entities?.sentiment?.basic === 'Bullish').length;
    const bearish = msgs.filter(m => m.entities?.sentiment?.basic === 'Bearish').length;
    stocktwitsData = {
      total: msgs.length,
      bullish,
      bearish,
      ratio: msgs.length > 0 ? bullish / msgs.length : 0.5,
    };
  } catch { /* StockTwits unavailable */ }

  // Score from aggregated data
  const totalPosts = posts.length;
  const recentPosts = posts.filter(p => (Date.now() / 1000 - p.created) < 86400); // last 24h
  const avgUpvoteRatio = posts.length > 0
    ? posts.reduce((s, p) => s + (p.upvoteRatio || 0.5), 0) / posts.length
    : 0.5;
  const highEngagement = posts.filter(p => p.comments > 10 || p.score > 50).length;

  // Compute score
  let score = 50; // baseline neutral
  if (stocktwitsData) {
    const stScore = stocktwitsData.ratio * 100; // 0-100 based on bullish ratio
    score = Math.round(stScore * 0.6 + (avgUpvoteRatio * 100) * 0.4);
  } else if (totalPosts > 0) {
    score = Math.round(avgUpvoteRatio * 100);
  }
  score = Math.max(0, Math.min(100, score));

  const label = classifyScore(score);
  const confidence = Math.min(1, (totalPosts / 20) * 0.5 + (stocktwitsData ? 0.3 : 0) + (highEngagement / 10) * 0.2);

  // Build summary
  const parts = [];
  if (totalPosts > 0) parts.push(`${totalPosts} Reddit posts across WSB/options/stocks (${recentPosts.length} in last 24h)`);
  if (stocktwitsData) parts.push(`StockTwits: ${stocktwitsData.bullish}/${stocktwitsData.total} bullish (${Math.round(stocktwitsData.ratio * 100)}%)`);
  if (highEngagement > 0) parts.push(`${highEngagement} high-engagement posts`);

  return {
    symbol,
    score,
    label,
    confidence: Math.round(confidence * 100) / 100,
    summary: parts.length > 0 ? parts.join('. ') + '.' : `No significant social discussion found for ${symbol}.`,
    keyDrivers: posts.slice(0, 3).map(p => ({
      factor: p.title.slice(0, 100),
      impact: p.upvoteRatio > 0.7 ? 'positive' : p.upvoteRatio < 0.4 ? 'negative' : 'neutral',
      source: `r/${p.subreddit}`,
    })),
    materialEvents: [],
    socialSentiment: stocktwitsData
      ? `StockTwits ${Math.round(stocktwitsData.ratio * 100)}% bullish (${stocktwitsData.total} messages)`
      : (totalPosts > 0 ? `${totalPosts} Reddit discussions, avg upvote ratio ${Math.round(avgUpvoteRatio * 100)}%` : null),
    sectorContext: null,
    engine: 'reddit',
    raw: { totalPosts, recentPosts: recentPosts.length, highEngagement, stocktwitsData },
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPOSITE: Weighted Multi-Engine Sentiment
// ═══════════════════════════════════════════════════════════════════════════

async function fetchSentiment(symbol) {
  // Check cache first
  const cached = loadCache(symbol);
  if (cached) {
    console.log(`  [Sentiment] ${symbol}: cache hit (${cached.composite?.label || cached.label} ${cached.composite?.score || cached.score})`);
    // Backwards compat: old cache format had score at top level
    if (!cached.composite && cached.score != null) {
      cached.composite = { score: cached.score, label: cached.label, confidence: cached.confidence };
    }
    return cached;
  }

  console.log(`  [Sentiment] ${symbol}: fetching from all engines...`);
  const engines = getEngineConfig();
  const results = {};
  const promises = [];

  // Launch enabled engines in parallel
  if (engines.claude.enabled) {
    promises.push(
      fetchSentimentClaude(symbol)
        .then(r => { results.claude = r; console.log(`  [Sentiment] ${symbol} Claude: ${r.label} ${r.score}`); })
        .catch(e => { console.error(`  [Sentiment] ${symbol} Claude FAILED: ${e.message}`); })
    );
  }

  if (engines.grok.enabled && engines.grok.apiKey) {
    promises.push(
      fetchSentimentGrok(symbol, engines.grok.apiKey)
        .then(r => { results.grok = r; console.log(`  [Sentiment] ${symbol} Grok: ${r.label} ${r.score}`); })
        .catch(e => { console.error(`  [Sentiment] ${symbol} Grok FAILED: ${e.message}`); })
    );
  }

  if (engines.gemini.enabled && engines.gemini.apiKey) {
    promises.push(
      fetchSentimentGemini(symbol, engines.gemini.apiKey)
        .then(r => { results.gemini = r; console.log(`  [Sentiment] ${symbol} Gemini: ${r.label} ${r.score}`); })
        .catch(e => { console.error(`  [Sentiment] ${symbol} Gemini FAILED: ${e.message}`); })
    );
  }

  if (engines.reddit.enabled) {
    promises.push(
      fetchSentimentReddit(symbol)
        .then(r => { results.reddit = r; console.log(`  [Sentiment] ${symbol} Reddit: ${r.label} ${r.score}`); })
        .catch(e => { console.error(`  [Sentiment] ${symbol} Reddit FAILED: ${e.message}`); })
    );
  }

  await Promise.allSettled(promises);

  // If no engines succeeded, return null
  const activeEngines = Object.keys(results);
  if (activeEngines.length === 0) {
    console.error(`  [Sentiment] ${symbol}: ALL engines failed`);
    return null;
  }

  // Calculate weighted composite
  let totalWeight = 0;
  let weightedScore = 0;
  let weightedConfidence = 0;
  const engineData = {};

  for (const name of activeEngines) {
    const r = results[name];
    const w = engines[name]?.weight || 0.25;
    totalWeight += w;
    weightedScore += (r.score || 50) * w;
    weightedConfidence += (r.confidence || 0.5) * w;
    engineData[name] = {
      score: r.score,
      label: r.label,
      confidence: r.confidence,
      summary: r.summary,
      keyDrivers: r.keyDrivers,
      socialSentiment: r.socialSentiment,
      sectorContext: r.sectorContext,
      weight: w,
    };
  }

  // Normalize weights (redistribute from missing engines)
  const compositeScore = Math.round(weightedScore / totalWeight);
  const compositeConfidence = Math.round((weightedConfidence / totalWeight) * 100) / 100;
  const compositeLabel = classifyScore(compositeScore);

  // Merge key drivers, material events, social, and sector from all engines
  const allDrivers = activeEngines.flatMap(name => (results[name].keyDrivers || []).map(d => ({ ...d, engine: name })));
  const allMaterialEvents = [...new Set(activeEngines.flatMap(name => results[name].materialEvents || []))];
  const socialParts = activeEngines.map(n => results[n].socialSentiment).filter(Boolean);
  const sectorParts = activeEngines.map(n => results[n].sectorContext).filter(Boolean);

  // Best summary from highest-confidence engine
  const bestEngine = activeEngines.reduce((a, b) =>
    (results[a]?.confidence || 0) > (results[b]?.confidence || 0) ? a : b
  );

  const composite = {
    symbol,
    composite: {
      score: compositeScore,
      label: compositeLabel,
      confidence: compositeConfidence,
    },
    // Top-level fields for backwards compatibility
    score: compositeScore,
    label: compositeLabel,
    confidence: compositeConfidence,
    summary: results[bestEngine]?.summary || `Composite sentiment from ${activeEngines.length} engines.`,
    keyDrivers: allDrivers.slice(0, 8),
    materialEvents: allMaterialEvents,
    socialSentiment: socialParts.join(' | ') || null,
    sectorContext: sectorParts[0] || null,
    engines: engineData,
    activeEngines: activeEngines.length,
    updatedAt: new Date().toISOString(),
    date: new Date().toISOString().slice(0, 10),
    source: activeEngines.join('+'),
  };

  // Compute modifier
  composite.modifier = computeModifier(composite, 'neutral');

  // Save to cache
  saveCache(symbol, composite);
  console.log(`  [Sentiment] ${symbol}: composite ${compositeLabel} ${compositeScore} (${activeEngines.length} engines: ${activeEngines.join(', ')})`);

  return composite;
}

// ── Cache ───────────────────────────────────────────────────────────────────

function getCachePath(symbol) {
  return path.join(REPORTS_DIR, symbol, 'sentiment.json');
}

function loadCache(symbol) {
  const cachePath = getCachePath(symbol);
  if (!fs.existsSync(cachePath)) return null;
  try {
    const data = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    const age = Date.now() - new Date(data.updatedAt).getTime();
    if (age > CACHE_MAX_AGE_MS) return null;
    return data;
  } catch { return null; }
}

function saveCache(symbol, data) {
  const dir = path.join(REPORTS_DIR, symbol);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getCachePath(symbol), JSON.stringify(data, null, 2));
}

// ── Modifier Logic ──────────────────────────────────────────────────────────

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

// ── Prompt Context Builder ──────────────────────────────────────────────────

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

// ── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
  fetchSentiment,
  fetchSentimentClaude,
  fetchSentimentGrok,
  fetchSentimentGemini,
  fetchSentimentReddit,
  computeModifier,
  buildSentimentContext,
  loadCache,
};
