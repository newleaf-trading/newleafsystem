# NewLeaf AI Architecture — Code Extract for Review

## 1. Pipeline analysis call site (analyse-tiles.cjs)

### Prompt template — `pipeline/analyse-tiles.cjs:75-211`

```javascript
function buildPrompt(tile, sentimentCtx) {
  const legs = (tile.legs || []).map(l =>
    `  ${l.action?.toUpperCase()} ${l.type?.toUpperCase()} $${l.strike} @ mid=${fmtPrice(l.mid || l.premium)}` +
    ` | δ=${l.delta ?? 'N/A'}  θ=${l.theta ?? 'N/A'}  ν=${l.vega ?? 'N/A'}`
  ).join('\n');

  const gammaCtx = tile.gammaData ? `
GAMMA WALL CONTEXT:
  Put Wall:        ${fmtPrice(tile.gammaData.put_wall)}
  Call Wall:       ${fmtPrice(tile.gammaData.call_wall)}
  Gamma Flip:      ${fmtPrice(tile.gammaData.gamma_flip)}
  Band Width:      ${tile.gammaData.band_width_pct?.toFixed(1) ?? 'N/A'}%
  Condor Allowed:  ${tile.gammaData.condor_allowed ? 'YES' : 'NO'}
  Confidence:      ${tile.gammaData.confidence_score ? (tile.gammaData.confidence_score * 100).toFixed(0) + '%' : 'N/A'}` : '';

  const greeksCtx = tile.greeks ? `
NET GREEKS:
  Net Delta:  ${tile.greeks.netDelta ?? 'N/A'}
  Net Theta:  ${tile.greeks.netTheta ?? 'N/A'} (per share)
  Net Vega:   ${tile.greeks.netVega ?? 'N/A'}
  Net Gamma:  ${tile.greeks.netGamma ?? 'N/A'}` : '';

  return `You are a professional options analyst for NewLeaf Trading.
Generate a complete deep analysis JSON document for the tile below.

TILE DATA:
  ID:          ${tile.id}
  Symbol:      ${tile.symbol || tile.ticker}
  Strategy:    ${tile.strategy}
  Direction:   ${tile.direction || 'neutral'}
  Spot Price:  ${fmtPrice(tile.underlyingPrice || tile.currentPrice || tile.price)}
  Expiry:      ${tile.expiry || tile.expirationDate}
  DTE:         ${tile.dte || tile.daysToExpiry} days
  Net Credit:  ${fmtPrice(tile.netCredit)} per share (${fmtPrice((tile.netCredit || 0) * 100)}/contract)
  Max Profit:  ${fmtPrice(tile.maxProfit)}
  Max Loss:    ${fmtPrice(tile.maxLoss)}
  R:R:         ${tile.rewardRisk ?? 'N/A'}x
  PoP:         ${tile.oddsOfProfit ?? tile.probOfProfit ?? 'N/A'}%
  Theta/Day:   ${fmtPrice(tile.netTheta)}

LEGS:
${legs}
${gammaCtx}
${greeksCtx}
${sentimentCtx || ''}

OUTPUT INSTRUCTIONS:
Return ONLY a valid JSON object (no markdown, no backticks, no explanation).
The JSON must follow this EXACT schema:

{
  "strategyRationale": {
    "whyThisStrategy": "2-3 sentences",
    "whyTheseStrikes": "2-3 sentences",
    "whyThisExpiry": "2-3 sentences",
    "alternativesConsidered": [{ "strategy": "Name", "reason": "Why rejected" }]
  },
  "technicalIndicators": {
    "rsi": { "value": <number>, "signal": "<bullish|bearish|neutral>", "description": "1-2 sentences" },
    "bollingerBands": { "upper": <price>, "middle": <price>, "lower": <price>, "width": <pct>, "signal": "...", "description": "..." },
    "macd": { "macdLine": <n>, "signalLine": <n>, "histogram": <n>, "signal": "...", "description": "..." },
    "movingAverages": { "sma20": <p>, "sma50": <p>, "sma100": <p>, "crossoverDaysAgo": <n|null>, "isBullish": <bool>, "signal": "...", "description": "...", "history": [] },
    "impliedVolatility": { "currentIV": <pct>, "ivRank": <0-100>, "ivPercentile": <0-100>, "historicalVol30": <pct>, "description": "..." },
    "supportResistance": { "support": [{ "level": <price>, "strength": "strong|moderate", "description": "..." }], "resistance": [...] }
  },
  "thetaDecaySchedule": {
    "description": "2-3 sentences",
    "dailyDecay": [{ "daysToExpiry": <dte>, "dailyTheta": <$>, "cumulativeTheta": <$> }, ...],
    "earlyCloseRecommendation": "Specific advice"
  },
  "riskAnalysis": {
    "maxPainScenario": "...", "earningsRisk": "...",
    "dividendRisk": "...", "eventRisk": "...", "managementPlan": "..."
  }
}`;
}
```

### spawnSync call — `pipeline/analyse-tiles.cjs:216-239`

```javascript
function callClaude(prompt) {
  const tmpFile = path.join('/tmp', `nl-prompt-${Date.now()}.txt`);
  fs.writeFileSync(tmpFile, prompt, 'utf8');
  try {
    const result = spawnSync('claude', ['--print', '--output-format', 'text'], {
      input: prompt, encoding: 'utf8',
      timeout: 300000,   // 5 min
      maxBuffer: 10 * 1024 * 1024,
    });
    if (result.status !== 0) {
      throw new Error(`Claude CLI exited ${result.status}: ${result.stderr || result.error?.message || 'Unknown'}`);
    }
    return result.stdout?.trim() || '';
  } finally {
    if (fs.existsSync(tmpFile)) fs.unlinkSync(tmpFile);
  }
}
```

### JSON parsing/validation — `pipeline/analyse-tiles.cjs:243-274`

```javascript
function extractJSON(raw) {
  let cleaned = raw.replace(/^```json\s*/m, '').replace(/^```\s*/m, '').replace(/```\s*$/m, '').trim();
  const start = cleaned.indexOf('{');
  const end   = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON object found in Claude output');
  return JSON.parse(cleaned.slice(start, end + 1));
}

function validate(analysis) {
  const required = ['strategyRationale', 'technicalIndicators', 'thetaDecaySchedule', 'riskAnalysis'];
  for (const key of required) { if (!analysis[key]) throw new Error(`Missing required field: ${key}`); }
  if (!analysis.strategyRationale.whyThisStrategy) throw new Error('Missing whyThisStrategy');
  if (!analysis.technicalIndicators.rsi) throw new Error('Missing RSI');
  if (!Array.isArray(analysis.thetaDecaySchedule.dailyDecay)) throw new Error('Missing dailyDecay array');
  if (!analysis.riskAnalysis.managementPlan) throw new Error('Missing managementPlan');
  return true;
}
```

### Error handling — No retry. Failed tiles caught and skipped. 3s pause between tiles. Material events suppress tile before Claude call.

---

## 2. Pipeline sentiment engine (scanner/sentiment-engine.js)

### Engine 1: Claude CLI — `sentiment-engine.js:93-122`

```javascript
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
  ], { input: prompt, encoding: 'utf8', timeout: 300000, maxBuffer: 10 * 1024 * 1024 });

  if (result.status !== 0) throw new Error(`Claude CLI: ${result.stderr || result.error?.message || 'timeout'}`);
  const data = extractJSON(result.stdout.trim());
  data.engine = 'claude';
  return data;
}
```

### Engine 2: Grok REST — `sentiment-engine.js:128-158`

```javascript
async function fetchSentimentGrok(symbol, apiKey) {
  const prompt = `You are a financial sentiment analyst specializing in social media analysis.
Analyze the current sentiment for $${symbol} on X (Twitter) and social media.
Focus on the last 48 hours.

Look for:
  1. Trending $${symbol} posts and discussions
  2. Influential trader/analyst mentions and opinions
  3. Retail sentiment direction and velocity
  4. Meme stock activity or unusual social volume
  5. Options flow commentary ($${symbol} calls/puts discussion)
  6. Any viral news or narratives about this stock
${SENTIMENT_PROMPT_SUFFIX.replace('<SYMBOL>', symbol)}`;

  const response = await axios.post('https://api.x.ai/v1/chat/completions', {
    model: 'grok-3-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
  }, {
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    timeout: 120000,
  });
  const data = extractJSON(response.data.choices?.[0]?.message?.content || '');
  data.engine = 'grok';
  return data;
}
```

### Engine 3: Gemini SDK — `sentiment-engine.js:164-190`

```javascript
async function fetchSentimentGemini(symbol, apiKey) {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', tools: [{ googleSearch: {} }] });

  const prompt = `You are a financial sentiment analyst specializing in news analysis.
Analyze the current market sentiment for ${symbol} using Google Search.
Focus on developments from the last 48 hours.

Search for:
  1. Major financial news from Bloomberg, Reuters, CNBC, WSJ
  2. Sector rotation narratives and institutional flow
  3. Regulatory and policy developments
  4. Supply chain and industry-specific news
  5. Competitor developments that may impact ${symbol}
  6. Macro-economic events affecting this stock's sector
${SENTIMENT_PROMPT_SUFFIX.replace('<SYMBOL>', symbol)}`;

  const result = await model.generateContent(prompt);
  const data = extractJSON(result.response.text());
  data.engine = 'gemini';
  return data;
}
```

### Engine 4: Reddit/StockTwits — `sentiment-engine.js:196-283`

Fetches from `reddit.com/r/{wallstreetbets,options,stocks}/search.json` and `api.stocktwits.com/api/2/streams/symbol/{sym}.json`. No LLM call. Score = `stocktwitsData.ratio * 100 * 0.6 + avgUpvoteRatio * 100 * 0.4`. Returns same `{ symbol, score, label, confidence, summary, keyDrivers, materialEvents, socialSentiment, sectorContext, engine: 'reddit' }` shape.

### Score combination logic — `sentiment-engine.js:348-374`

```javascript
// Inside fetchSentiment(), after all engines resolve:
let totalWeight = 0, weightedScore = 0, weightedConfidence = 0;
for (const name of activeEngines) {
  const r = results[name];
  const w = engines[name]?.weight || 0.25;  // Default weights: claude=0.30, grok=0.25, gemini=0.25, reddit=0.20
  totalWeight += w;
  weightedScore += (r.score || 50) * w;
  weightedConfidence += (r.confidence || 0.5) * w;
}
// Normalize (auto-redistributes weight from missing engines)
const compositeScore = Math.round(weightedScore / totalWeight);
const compositeConfidence = Math.round((weightedConfidence / totalWeight) * 100) / 100;
const compositeLabel = classifyScore(compositeScore); // >=70 bullish, <40 bearish, else neutral
```

### Sample output — `scanner/reports/ADBE/sentiment.json` (2026-05-16)

```json
{ "symbol": "ADBE",
  "composite": { "score": 71, "label": "bullish", "confidence": 0.8 },
  "keyDrivers": [
    { "factor": "ADBE up 4.55% on sector rally", "impact": "positive", "source": "TradingKey", "engine": "claude" },
    { "factor": "$25B share repurchase authorized", "impact": "positive", "source": "Yahoo Finance", "engine": "claude" },
    { "factor": "Mizuho downgrade, PT cut $315→$270", "impact": "negative", "source": "MarketBeat", "engine": "claude" }
  ],
  "materialEvents": ["Q2 FY2026 earnings June 11, 2026"],
  "engines": { "claude": {"score":63,"weight":0.3}, "reddit": {"score":89,"weight":0.2}, "grok": {"score":62,"weight":0.25}, "gemini": {"score":75,"weight":0.25} },
  "activeEngines": 4, "source": "claude+reddit+grok+gemini",
  "modifier": { "action": "suppress", "points": 0, "flags": ["suppress"], "reason": "Material event: Q2 FY2026 earnings..." } }
```

---

## 3. API sentiment (newleaf-api/src/tools/sentiment.ts)

### 3 engines — Grok, Gemini, Reddit (NO Claude engine). Weights: `{ grok: 0.35, gemini: 0.35, reddit: 0.30 }` (different from pipeline's 30/25/25/20). Same prompts as pipeline. Grok uses `grok-3-mini`, Gemini uses `gemini-2.5-flash` via direct SDK (bypasses LLM Router). Same weighted-average combination.

### GET /api/sentiment/:ticker — `newleaf-api/src/routes/market.ts:80-86`

```typescript
fastify.get('/api/sentiment/:ticker', { preHandler: [requireTier('basic')] }, async (req, reply) => {
  const { ticker } = req.params as { ticker: string };
  const result = await fetchSentiment(ticker.toUpperCase());
  if (!result) return reply.code(502).send({ error: 'All sentiment engines failed' });
  return result;
});
```

---

## 4. LLM Router public interface (newleaf-api/src/llm/router.ts)

### ModelTier type

```typescript
export type ModelTier = 'claude-sonnet' | 'claude-haiku' | 'gpt-4' | 'grok' | 'deepseek' | 'deepseek-r1' | 'qwq' | 'qwen-max';
```

### Class signature (public methods only)

```typescript
export class LLMRouter {
  constructor();  // reads env vars: ANTHROPIC_API_KEY, OPENAI_API_KEY, XAI_API_KEY, DEEPSEEK_API_KEY, TOGETHER_API_KEY, DASHSCOPE_API_KEY
  resetUsage(): void;
  getUsage(): { calls: TokenUsage[]; totalCost: number; totalInputTokens: number; totalOutputTokens: number };
  getTraces(): LLMTrace[];
  call(model: ModelTier, opts: LLMCall): Promise<string>;
}
```

### Response shapes

```typescript
export interface LLMCall { system: string; user: string; maxTokens?: number; }
export interface TokenUsage { model: ModelTier; inputTokens: number; outputTokens: number; cost: number; }
export interface LLMTrace { model: ModelTier; system: string; user: string; response: string; inputTokens: number; outputTokens: number; cost: number; durationMs: number; }
```

### Pricing table (per million tokens)

```typescript
const PRICING: Record<ModelTier, { input: number; output: number }> = {
  'claude-sonnet': { input: 3,    output: 15   },
  'claude-haiku':  { input: 0.80, output: 4    },
  'gpt-4':         { input: 2.50, output: 10   },
  'grok':          { input: 3,    output: 15   },
  'deepseek':      { input: 0.27, output: 1.10 },
  'deepseek-r1':   { input: 0.55, output: 2.19 },
  'qwq':           { input: 0.30, output: 1.20 },
  'qwen-max':      { input: 1.60, output: 6.40 },
};
```

### Model ID mapping inside `call()`

```
claude-sonnet → claude-sonnet-4-20250514   |  grok     → grok-4
claude-haiku  → claude-haiku-4-5-20251001  |  deepseek → deepseek-chat
gpt-4         → gpt-4o                     |  deepseek-r1 → deepseek-reasoner
qwq           → qwen-plus                  |  qwen-max → qwen-max
```

---

## 5. Discover.html analysis flow

### Fetch sequence — `workbench/discover.html`

```
Stage 1 (handleLoad):
  GET  /api/snapshot/{ticker}     → { snapshot: { price, change, changePct }, expirations }
  GET  /api/indicators/{ticker}   → { indicators: { rsi14, adx14, atr14, smaTrend } }
  GET  /api/gamma/{ticker}/{exp}  → { putWallStrike, callWallStrike, spotInsideBand, oiByStrike, spot }
  POST /api/ai-read               → { read: "one-sentence narrative", cost }
       body: { ticker, spot, ivRank, atr14, rsi, adx, trend, putWall, callWall, earningsDaysOut }

Stage 2 (enterStage2):
  GET  /api/chain/{ticker}/{exp}  → { strikes: [{ strike, put: {bid,ask,mid,iv,delta}, call: {...} }] }
  POST /api/recommend             → { recommendation: { strategies: [{strategy,legs,score,rationale}] }, indicators, cost }
       body: { ticker, expiry, modelMode: 'budget-qwq' }

Stage 4 (verify):
  POST /verify                    → { verdict, evidence, debate, riskReport, suggestedFix, cost, durationMs }
       body: { ticker, structure, legs: [{type,side,strike,expiry}], netCredit, source: 'investor_draft', modelMode: 'budget-qwq' }
```

### /verify orchestrator — `newleaf-api/src/orchestrator.ts:41-97`

```typescript
async verify(input: TradeIdea, modelMode: ModelMode = 'premium'): Promise<VerificationResult> {
  this.llm.resetUsage();
  const jobId = await this.store.createJob(input);
  let md = process.env.ALPACA_API_KEY ? await fetchMarketData(input).catch(() => undefined) : undefined;
  const ctx = { jobId, marketData: md, modelMode };

  // Phase 1: 4 analysts in parallel
  const [technical, gamma, iv, sentiment] = await Promise.all([
    this.analysts.technical.run(input, ctx),   // premium: claude-sonnet  | budget-qwq: qwq
    this.analysts.gamma.run(input, ctx),       // premium: claude-sonnet  | budget-qwq: qwq
    this.analysts.iv.run(input, ctx),          // premium: claude-haiku   | budget-qwq: qwq
    this.analysts.sentiment.run(input, ctx),   // always:  deepseek (no budget override)
  ]);

  // Phase 2: 2-round debate (sequential)
  const r1Bull = await this.bull.run({ input, evidence, round: 1 }, ctx);           // premium: gpt-4
  const r1Bear = await this.bear.run({ input, evidence, opposing: r1Bull, round: 1 }, ctx); // premium: gpt-4
  const r2Bull = await this.bull.run({ input, evidence, opposing: r1Bear, round: 2 }, ctx);
  const r2Bear = await this.bear.run({ input, evidence, opposing: r2Bull, round: 2 }, ctx);

  // Phase 3: risk + judge (sequential)
  const riskReport = await this.risk.run({ input, evidence, debate }, ctx);  // premium: claude-sonnet
  const verdict = await this.judge.run({ input, evidence, debate, riskReport }, ctx); // premium: claude-sonnet | budget-qwq: qwen-max (critical)

  // Phase 4: fixer (if not pass)
  if (verdict.call !== 'pass') suggestedFix = await this.fixer.fix({ ... }); // premium: claude-sonnet | budget-qwq: qwen-max

  return { jobId, verdict, evidence, debate, riskReport, suggestedFix, cost: this.llm.getUsage(), durationMs };
}
```

### /verify route — `newleaf-api/src/routes/verify.ts`

```typescript
fastify.post('/verify', { preHandler: [requireTier('premium')] }, async (req, reply) => {
  const validModes = ['premium', 'budget-v3', 'budget-r1', 'budget-qwq'] as const;
  const modelMode = validModes.includes(body.modelMode as any) ? body.modelMode : 'premium';
  const parsed = TradeIdeaSchema.safeParse(body);
  if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues });
  const result = await orchestrator.verify(parsed.data, modelMode);
  return { ...result, modelMode };
});
```

---

## 6. Pick outcomes schema

### Document shape — `scripts/seed-pick-outcomes.js:42-57` (from seed data)

```javascript
{
  weekId: '2026-W07',              // string — ISO week
  weekStart: '2026-02-10',        // string — YYYY-MM-DD
  weekEnd: '2026-02-14',          // string
  marketNote: 'Pre-CPI...',       // string — weekly context
  ticker: 'AAPL',                 // string
  spotAtEntry: 232.50,            // number
  strategy: 'Iron Condor',        // string
  strategySlug: 'iron-condor',    // string (used in doc ID)
  sentiment: 'NEUTRAL',           // string — BULLISH|NEUTRAL|BEARISH
  legs: [                         // array of leg objects
    { action: 'BUY', type: 'PUT', strike: 220, mid: 0.45, delta: -0.08 },
    { action: 'SELL', type: 'PUT', strike: 225, mid: 1.10, delta: -0.18 },
    { action: 'SELL', type: 'CALL', strike: 240, mid: 1.20, delta: 0.20 },
    { action: 'BUY', type: 'CALL', strike: 245, mid: 0.50, delta: 0.09 }
  ],
  expiry: '2026-02-14',           // string
  dte: 5,                         // number
  netCredit: 1.35,                // number (per share)
  maxProfit: 135,                 // number ($)
  maxLoss: 365,                   // number ($)
  winRateEstimate: 72,            // number (%)
  rewardRiskRatio: 0.37,          // number
  outcome: 'WIN',                 // string — WIN|LOSS|PARTIAL|null (null = open)
  closedAt: 'expiry',             // string — 'expiry'|'early'
  actualPnl: 128,                 // number ($)
  pnlPercent: 95,                 // number (%)
  spotAtExpiry: 234.20,           // number
  closeReason: 'All strikes expired OTM', // string
  createdAt: '2026-02-10T14:30:00Z',     // string ISO
  closedAtTs: '2026-02-14T21:00:00Z'     // string ISO
}
```

### Firestore write (update) — `scripts/update-pick-outcomes.js:128-136`

```javascript
await db.collection('pick_outcomes').doc(pick.id).update({
  outcome: result.outcome,        // WIN|LOSS|PARTIAL
  actualPnl: result.actualPnl,
  pnlPercent: result.pnlPercent,
  spotAtExpiry: parseFloat(spot.toFixed(2)),
  closeReason: result.closeReason,
  closedAt: 'expiry',
  closedAtTs: new Date().toISOString()
});
```

### Provenance fields: `model_used`, `prompt_version` — **DO NOT EXIST** anywhere in the codebase. No pick_outcomes document records which AI model produced the analysis or which prompt version was used.

---

## 7. Firebase aiChat function

### Full function — `OptionAdvisor/newleaf-trading/functions/index.js:223-330`

```javascript
exports.aiChat = onCall({ secrets: [geminiApiKey] }, async (request) => {
  if (!request.auth) throw new HttpsError('unauthenticated', 'Must be signed in');
  const { message, portfolio, tiles: clientTiles, settings, history } = request.data;
  if (!message) throw new HttpsError('invalid-argument', 'message required');
  const apiKey = geminiApiKey.value();
  if (!apiKey) throw new HttpsError('failed-precondition', 'GEMINI_API_KEY not configured');

  const portfolioSummary = (portfolio || []).map(p => {
    const legs = (p.legs || []).map(l =>
      `${l.action.toUpperCase()} ${l.type} ${l.strike} @ ${(l.entryPremium || 0).toFixed(2)}${l.currentPremium ? ` (now ${l.currentPremium.toFixed(2)})` : ''}`
    ).join(', ');
    return `• ${p.symbol} ${p.strategy} | Entry: ${p.entryNetCredit || 0} | P&L: ${p.unrealizedPnl || 0} | DTE: ${p.daysToExpiry || '?'} | Status: ${p.status || 'active'}${legs ? ` | Legs: ${legs}` : ''}`;
  }).join('\n') || 'No positions yet.';

  const availableTiles = (clientTiles || []).map(t =>
    `• ${t.symbol} ${t.strategy} | ROC: ${t.returnOnCapital || 0}% | MaxLoss: ${t.technical?.maxLoss || t.maxLoss || 0} | MaxWin: ${t.lottery?.maxWin || t.maxProfit || 0} | DTE: ${t.daysToExpiry || 0} | Prob: ${t.oddsOfProfit || t.probOfProfit || '?'}%`
  ).join('\n') || 'No strategies available.';

  const systemPrompt = `You are NewLeaf AI, a structured options strategy assistant inside the NewLeaf System platform.
You help users manage their options portfolio with disciplined, rules-based frameworks.

IMPORTANT RULES:
- Be concise and actionable. Max 3-4 sentences unless the user asks for detail.
- Use dollar amounts and percentages when discussing P&L.
- When suggesting actions, include them in a JSON block at the END of your response.
- Never give definitive financial advice — frame suggestions as options to consider.

ACTIONS you can suggest:
\`\`\`actions
[{"type": "ADD_POSITION", "tileId": "<tile_id>", "symbol": "<SYMBOL>"},
 {"type": "REMOVE_POSITION", "tileId": "<tile_id>", "symbol": "<SYMBOL>"},
 {"type": "NAVIGATE", "to": "/portfolio" | "/discover" | "/performance" | "/admin"},
 {"type": "SET_MODE", "mode": "build" | "manage"}]
\`\`\`

USER'S PORTFOLIO (Capital: ${settings?.totalCapital || 50000}):
${portfolioSummary}

AVAILABLE STRATEGIES:
${availableTiles}`;

  const contents = [];
  if (history && Array.isArray(history)) {
    history.forEach(h => { contents.push({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.text }] }); });
  }
  contents.push({ role: 'user', parts: [{ text: message }] });

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemPrompt }] },
        contents,
        generationConfig: { temperature: 0.7, maxOutputTokens: 1024 },
      }),
    }
  );
  if (!response.ok) throw new HttpsError('internal', 'AI service error');
  const data = await response.json();
  const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Sorry, I couldn\'t generate a response.';

  let actions = [];
  let cleanText = aiText;
  const actionsMatch = aiText.match(/```actions\n?([\s\S]*?)```/);
  if (actionsMatch) {
    try { actions = JSON.parse(actionsMatch[1].trim()); cleanText = aiText.replace(/```actions\n?[\s\S]*?```/, '').trim(); }
    catch (e) { /* ignore parse failure */ }
  }
  return { text: cleanText, actions };
});
```

---

## 8. Config and secrets

### scanner/config.json (keys REDACTED)

```json
{
  "alpaca": { "apiKey": "REDACTED", "secretKey": "REDACTED" },
  "r2": { "accountId": "REDACTED", "bucket": "newleaf", "accessKeyId": "REDACTED", "secretAccessKey": "REDACTED", "endpoint": "https://bdac00e7cad9fd1fb1091543292c293a.r2.cloudflarestorage.com", "publicBaseUrl": "https://pub-04bbb919022645b3a3f318b2ebdf48c0.r2.dev" },
  "yahoosvc": { "url": "http://localhost:5300" },
  "pipeline": { "dteMin": 0, "dteMax": 60, "concurrency": 5 },
  "email": { "smtp": { "host": "smtp.gmail.com", "port": 587, "user": "REDACTED", "pass": "REDACTED" }, "from": "NewLeaf Invest <marketing@newleafsystem.com>", "recipients": ["manish28june@gmail.com"] },
  "watchlist": ["SPY","QQQ","IWM","DIA","TLT","XLF","XLK","AAPL","MSFT","NVDA","AMZN","GOOG","META","TSLA","AMD","...(144 symbols total)"],
  "sentiment": {
    "enabled": true, "cacheMaxAgeMinutes": 360,
    "engines": {
      "claude":  { "enabled": true, "weight": 0.30 },
      "grok":    { "enabled": true, "weight": 0.25, "apiKey": "REDACTED" },
      "gemini":  { "enabled": true, "weight": 0.25, "apiKey": "REDACTED" },
      "reddit":  { "enabled": true, "weight": 0.20 }
    }
  }
}
```

### Env vars in newleaf-api/.env.local (names only)

```
ANTHROPIC_API_KEY
OPENAI_API_KEY
XAI_API_KEY
DEEPSEEK_API_KEY
TOGETHER_API_KEY
DASHSCOPE_API_KEY
ALPACA_API_KEY
ALPACA_SECRET_KEY
SERPER_API_KEY
FIREBASE_PROJECT_ID
FIREBASE_CLIENT_EMAIL
FIREBASE_PRIVATE_KEY
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET
DEV_API_KEY
DEV_API_ROLE
PORT
LOG_LEVEL
USE_MOCK_LLM
NODE_ENV
```

### Firebase secrets (functions/index.js)

```javascript
const { defineSecret } = require("firebase-functions/params");
const geminiApiKey = defineSecret('GEMINI_API_KEY');
// Only secret. Used by aiChat: { secrets: [geminiApiKey] }
```
