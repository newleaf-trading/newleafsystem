/**
 * Multi-engine sentiment analysis: Claude + Grok + Gemini + Reddit/StockTwits.
 * All LLM engines route through the LLM router for cost tracking.
 * Weighted composite scoring with automatic redistribution when engines are unavailable.
 */
import axios from 'axios';
import type { LLMRouter } from '../llm/router.js';
import { getModel } from '../llm/model-assignments.js';

interface SentimentResult {
  symbol: string;
  score: number;
  label: 'bullish' | 'neutral' | 'bearish';
  confidence: number;
  summary: string;
  keyDrivers: { factor: string; impact: string; source: string; engine?: string }[];
  materialEvents: string[];
  socialSentiment: string | null;
  sectorContext: string | null;
  engine: string;
}

interface CompositeResult {
  symbol: string;
  composite: { score: number; label: string; confidence: number };
  score: number;
  label: string;
  confidence: number;
  summary: string;
  keyDrivers: { factor: string; impact: string; source: string; engine?: string }[];
  materialEvents: string[];
  socialSentiment: string | null;
  sectorContext: string | null;
  engines: Record<string, unknown>;
  activeEngines: number;
  updatedAt: string;
  source: string;
}

function classifyScore(score: number): 'bullish' | 'neutral' | 'bearish' {
  if (score >= 70) return 'bullish';
  if (score < 40) return 'bearish';
  return 'neutral';
}

function extractJSON(raw: string): any {
  let cleaned = raw
    .replace(/^```json\s*/m, '')
    .replace(/^```\s*/m, '')
    .replace(/```\s*$/m, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found');
  return JSON.parse(cleaned.slice(start, end + 1));
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

// ── Engine: Claude (Anthropic) — Web search + news analysis ──

async function fetchClaude(symbol: string, llm: LLMRouter): Promise<SentimentResult> {
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

  const raw = await llm.call(getModel('sentiment-claude'), {
    system: 'You are a financial sentiment analyst with web search capability. Analyze recent news and market sentiment.',
    user: prompt,
    maxTokens: 1500,
  });
  const data = extractJSON(raw);
  data.engine = 'claude';
  return data;
}

// ── Engine: Grok (xAI) — X/Twitter sentiment ──

async function fetchGrok(symbol: string, llm: LLMRouter): Promise<SentimentResult> {
  const prompt = `You are a financial sentiment analyst specializing in social media analysis.
Analyze the current sentiment for $${symbol} on X (Twitter) and social media.
Focus on the last 48 hours.

Look for:
  1. Trending $${symbol} posts and discussions
  2. Influential trader/analyst mentions and opinions
  3. Retail sentiment direction and velocity
  4. Options flow commentary
  5. Any viral news or narratives
${SENTIMENT_PROMPT_SUFFIX.replace('<SYMBOL>', symbol)}`;

  const raw = await llm.call(getModel('sentiment-grok'), {
    system: 'You are a financial sentiment analyst specializing in X/Twitter social media analysis.',
    user: prompt,
    maxTokens: 1500,
  });
  const data = extractJSON(raw);
  data.engine = 'grok';
  return data;
}

// ── Engine: Gemini (Google) — News & sector ──

async function fetchGemini(symbol: string, llm: LLMRouter): Promise<SentimentResult> {
  const prompt = `You are a financial sentiment analyst specializing in news analysis.
Analyze the current market sentiment for ${symbol} using Google Search.
Focus on developments from the last 48 hours.

Search for:
  1. Major financial news from Bloomberg, Reuters, CNBC, WSJ
  2. Sector rotation narratives and institutional flow
  3. Regulatory and policy developments
  4. Competitor developments that may impact ${symbol}
${SENTIMENT_PROMPT_SUFFIX.replace('<SYMBOL>', symbol)}`;

  const raw = await llm.call(getModel('sentiment-gemini'), {
    system: 'You are a financial sentiment analyst specializing in news and sector analysis.',
    user: prompt,
    maxTokens: 1500,
  });
  const data = extractJSON(raw);
  data.engine = 'gemini';
  return data;
}

// ── Engine: Reddit + StockTwits — Social aggregation (no LLM, direct HTTP) ──

async function fetchReddit(symbol: string): Promise<SentimentResult> {
  let posts: any[] = [];
  let stocktwitsData: { total: number; bullish: number; bearish: number; ratio: number } | null = null;

  const subreddits = ['wallstreetbets', 'options', 'stocks'];
  for (const sub of subreddits) {
    try {
      const url = `https://www.reddit.com/r/${sub}/search.json?q=${symbol}&sort=new&t=week&limit=25`;
      const res = await axios.get(url, {
        headers: { 'User-Agent': 'NewLeaf/1.0 (Options Trading Research)' },
        timeout: 15000,
      });
      const children = res.data?.data?.children || [];
      posts.push(...children.map((c: any) => ({
        title: c.data.title,
        score: c.data.score,
        comments: c.data.num_comments,
        subreddit: sub,
        created: c.data.created_utc,
        upvoteRatio: c.data.upvote_ratio,
      })));
    } catch { /* skip */ }
  }

  try {
    const stRes = await axios.get(`https://api.stocktwits.com/api/2/streams/symbol/${symbol}.json`, { timeout: 10000 });
    const msgs = stRes.data?.messages || [];
    const bullish = msgs.filter((m: any) => m.entities?.sentiment?.basic === 'Bullish').length;
    const bearish = msgs.filter((m: any) => m.entities?.sentiment?.basic === 'Bearish').length;
    stocktwitsData = { total: msgs.length, bullish, bearish, ratio: msgs.length > 0 ? bullish / msgs.length : 0.5 };
  } catch { /* skip */ }

  const totalPosts = posts.length;
  const recentPosts = posts.filter(p => (Date.now() / 1000 - p.created) < 86400);
  const avgUpvoteRatio = posts.length > 0
    ? posts.reduce((s, p) => s + (p.upvoteRatio || 0.5), 0) / posts.length
    : 0.5;
  const highEngagement = posts.filter(p => p.comments > 10 || p.score > 50).length;

  let score = 50;
  if (stocktwitsData) {
    score = Math.round(stocktwitsData.ratio * 100 * 0.6 + avgUpvoteRatio * 100 * 0.4);
  } else if (totalPosts > 0) {
    score = Math.round(avgUpvoteRatio * 100);
  }
  score = Math.max(0, Math.min(100, score));

  const label = classifyScore(score);
  const confidence = Math.min(1, (totalPosts / 20) * 0.5 + (stocktwitsData ? 0.3 : 0) + (highEngagement / 10) * 0.2);

  const parts: string[] = [];
  if (totalPosts > 0) parts.push(`${totalPosts} Reddit posts (${recentPosts.length} in last 24h)`);
  if (stocktwitsData) parts.push(`StockTwits: ${stocktwitsData.bullish}/${stocktwitsData.total} bullish (${Math.round(stocktwitsData.ratio * 100)}%)`);

  return {
    symbol, score, label,
    confidence: Math.round(confidence * 100) / 100,
    summary: parts.length ? parts.join('. ') + '.' : `No significant social discussion for ${symbol}.`,
    keyDrivers: posts.slice(0, 3).map(p => ({
      factor: p.title.slice(0, 100),
      impact: p.upvoteRatio > 0.7 ? 'positive' : p.upvoteRatio < 0.4 ? 'negative' : 'neutral',
      source: `r/${p.subreddit}`,
    })),
    materialEvents: [],
    socialSentiment: stocktwitsData
      ? `StockTwits ${Math.round(stocktwitsData.ratio * 100)}% bullish (${stocktwitsData.total} msgs)`
      : totalPosts > 0 ? `${totalPosts} Reddit discussions` : null,
    sectorContext: null,
    engine: 'reddit',
  };
}

// ── Composite: weighted multi-engine (matches genrecs weights) ──

const ENGINE_WEIGHTS: Record<string, number> = {
  claude: 0.30,
  grok: 0.25,
  gemini: 0.25,
  reddit: 0.20,
};

export async function fetchSentiment(symbol: string, llm: LLMRouter): Promise<CompositeResult | null> {
  const results: Record<string, SentimentResult> = {};
  const promises: Promise<void>[] = [];

  // Launch all engines in parallel
  promises.push(fetchClaude(symbol, llm).then(r => { results.claude = r; }).catch(() => {}));
  promises.push(fetchGrok(symbol, llm).then(r => { results.grok = r; }).catch(() => {}));
  promises.push(fetchGemini(symbol, llm).then(r => { results.gemini = r; }).catch(() => {}));
  promises.push(fetchReddit(symbol).then(r => { results.reddit = r; }).catch(() => {}));

  await Promise.allSettled(promises);

  const active = Object.keys(results);
  if (active.length === 0) return null;

  let totalWeight = 0;
  let weightedScore = 0;
  let weightedConfidence = 0;
  const engineData: Record<string, unknown> = {};

  for (const name of active) {
    const r = results[name];
    const w = ENGINE_WEIGHTS[name] ?? 0.25;
    totalWeight += w;
    weightedScore += (r.score ?? 50) * w;
    weightedConfidence += (r.confidence ?? 0.5) * w;
    engineData[name] = {
      score: r.score, label: r.label, confidence: r.confidence,
      summary: r.summary, keyDrivers: r.keyDrivers,
      socialSentiment: r.socialSentiment, sectorContext: r.sectorContext, weight: w,
    };
  }

  const compositeScore = Math.round(weightedScore / totalWeight);
  const compositeConfidence = Math.round((weightedConfidence / totalWeight) * 100) / 100;
  const compositeLabel = classifyScore(compositeScore);

  const allDrivers = active.flatMap(n => (results[n].keyDrivers || []).map(d => ({ ...d, engine: n })));
  const allMaterial = [...new Set(active.flatMap(n => results[n].materialEvents || []))];
  const socialParts = active.map(n => results[n].socialSentiment).filter(Boolean);
  const sectorParts = active.map(n => results[n].sectorContext).filter(Boolean);

  const bestEngine = active.reduce((a, b) =>
    (results[a]?.confidence ?? 0) > (results[b]?.confidence ?? 0) ? a : b
  );

  return {
    symbol,
    composite: { score: compositeScore, label: compositeLabel, confidence: compositeConfidence },
    score: compositeScore,
    label: compositeLabel,
    confidence: compositeConfidence,
    summary: results[bestEngine]?.summary || `Composite from ${active.length} engines.`,
    keyDrivers: allDrivers.slice(0, 8),
    materialEvents: allMaterial,
    socialSentiment: socialParts.join(' | ') || null,
    sectorContext: sectorParts[0] || null,
    engines: engineData,
    activeEngines: active.length,
    updatedAt: new Date().toISOString(),
    source: active.join('+'),
  };
}
