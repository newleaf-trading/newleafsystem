import type { FastifyInstance } from 'fastify';
import { requireTier } from '../middleware/rbac.js';
import { LLMRouter, type ModelTier } from '../llm/router.js';
import { StrategyAdvisor } from '../agents/advisor.js';
import { getStockSnapshot, getOptionsSnapshot, getHistoricalBars } from '../tools/alpaca.js';
import { computeIndicators } from '../tools/indicators.js';
import { fetchNasdaqOI, findGammaWalls } from '../tools/nasdaq-oi.js';
import { aiReadCache, recommendCache } from '../lib/cache.js';
import { createHash } from 'crypto';

export function registerAIRoutes(fastify: FastifyInstance, llm: LLMRouter) {
  const advisor = new StrategyAdvisor(llm);

  // POST /api/ai-read — premium tier (cached 5 min by ticker — same market state)
  fastify.post('/api/ai-read', { preHandler: [requireTier('premium')] }, async (req) => {
    const { ticker, spot, ivRank, atr14, rsi, adx, trend, putWall, callWall, earningsDaysOut } = req.body as Record<string, any>;
    if (!ticker || !spot) return { error: 'ticker and spot required' };

    const tk = (ticker as string).toUpperCase();
    const cached = aiReadCache.get(tk);
    if (cached) return { ...cached, cached: true };

    const prompt = `Given ${tk} at $${spot}, IV rank ${ivRank ?? 'N/A'}, RSI ${rsi ?? 'N/A'}, ADX ${adx ?? 'N/A'}, trend ${trend ?? 'unknown'}, ATR14 ${atr14 ?? 'N/A'}, put wall $${putWall ?? 'N/A'}, call wall $${callWall ?? 'N/A'}, earnings in ${earningsDaysOut ?? 'N/A'} days: produce one sentence market read. Format: "{Directional bias} ({key indicators}) with {premium environment} and {gamma context}. Setup favors {strategy class}." Be specific, cite real numbers. No hedging language.`;

    llm.resetUsage();
    const result = await llm.call('qwq', {
      system: 'You are a concise market analyst. Respond with exactly one sentence.',
      user: prompt,
      maxTokens: 200,
    });
    const response = { read: result, cost: llm.getUsage() };
    aiReadCache.set(tk, response);
    return response;
  });

  // POST /api/recommend — premium tier (cached 10 min by ticker+expiry)
  fastify.post('/api/recommend', { preHandler: [requireTier('premium')] }, async (req) => {
    const { ticker, expiry, modelMode: rm } = req.body as { ticker: string; expiry: string; modelMode?: string };
    if (!ticker || !expiry) return { error: 'ticker and expiry required' };
    const tk = ticker.toUpperCase();
    const cacheKey = `${tk}:${expiry}`;
    const cached = recommendCache.get(cacheKey);
    if (cached) return { ...cached, cached: true };

    const [snapshot, bars, contracts, oiChain] = await Promise.all([
      getStockSnapshot(tk),
      getHistoricalBars(tk, 250),
      getOptionsSnapshot(tk, expiry),
      fetchNasdaqOI(tk, expiry).catch(() => null),
    ]);

    const indicators = computeIndicators(bars, snapshot.price);

    const strikeMap = new Map<number, { strike: number; call?: typeof contracts[0]; put?: typeof contracts[0] }>();
    for (const c of contracts) {
      if (!strikeMap.has(c.strike)) strikeMap.set(c.strike, { strike: c.strike });
      const entry = strikeMap.get(c.strike)!;
      if (c.type === 'call') entry.call = c; else entry.put = c;
    }
    const chain = [...strikeMap.values()].sort((a, b) => a.strike - b.strike);

    let gammaAnalysis;
    if (oiChain) {
      const analysis = findGammaWalls(oiChain, snapshot.price);
      const range = snapshot.price * 0.15;
      gammaAnalysis = {
        walls: analysis.walls,
        putWallStrike: analysis.putWallStrike,
        callWallStrike: analysis.callWallStrike,
        spotInsideBand: analysis.spotInsideBand,
        oiByStrike: oiChain.strikes
          .filter(s => s.strike >= snapshot.price - range && s.strike <= snapshot.price + range)
          .map(s => ({ strike: s.strike, callOI: s.callOI, putOI: s.putOI, callVolume: s.callVolume, putVolume: s.putVolume })),
      };
    }

    llm.resetUsage();
    const validModes = ['premium', 'budget-v3', 'budget-r1', 'budget-qwq'] as const;
    const modelMode = validModes.includes(rm as any) ? rm as typeof validModes[number] : 'budget-qwq';
    const recommendation = await advisor.recommend({ ticker: tk, expiry, snapshot, indicators, gammaAnalysis, chain, modelMode });
    const response = { recommendation, snapshot, indicators, gammaAnalysis, cost: llm.getUsage() };
    recommendCache.set(cacheKey, response);
    return response;
  });

  // POST /api/chat — premium tier
  fastify.post('/api/chat', { preHandler: [requireTier('premium')] }, async (req) => {
    const { message, context } = req.body as { message: string; context?: Record<string, unknown>; modelMode?: string };
    const body = req.body as Record<string, unknown>;
    const validModes = ['premium', 'budget-v3', 'budget-r1', 'budget-qwq'] as const;
    const mode = validModes.includes(body.modelMode as any) ? body.modelMode as typeof validModes[number] : 'budget-v3';
    const modeModelMap: Record<string, ModelTier> = {
      'premium': 'qwq', 'budget-v3': 'deepseek', 'budget-r1': 'deepseek-r1', 'budget-qwq': 'qwq',
    };
    const chatModel = modeModelMap[mode] ?? 'deepseek';

    const system = `You are a helpful options trading assistant on the NewLeaf Verification Desk. You have access to the full verification result for the current trade. Answer questions concisely and specifically, referencing the data you have. If the user asks about adjustments, suggest specific strikes and strategies. Keep answers under 150 words.`;

    const contextStr = context ? `\n\nCurrent verification context:\n${JSON.stringify(context, null, 2).slice(0, 4000)}` : '';

    llm.resetUsage();
    const response = await llm.call(chatModel, {
      system,
      user: message + contextStr,
      maxTokens: 500,
    });
    return { response, cost: llm.getUsage() };
  });

  // POST /api/llm/call — generic LLM call for internal services (genrecs, pipeline)
  fastify.post('/api/llm/call', { preHandler: [requireTier('basic')] }, async (req, reply) => {
    const { model, system, user, maxTokens } = req.body as {
      model?: ModelTier; system?: string; user?: string; maxTokens?: number;
    };
    if (!model || !system || !user) {
      return reply.code(400).send({ error: 'model, system, and user are required' });
    }
    llm.resetUsage();
    const response = await llm.call(model, { system, user, maxTokens: maxTokens ?? 4000 });
    return { response, model, cost: llm.getUsage() };
  });
}
