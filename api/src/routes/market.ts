import type { FastifyInstance } from 'fastify';
import { requireTier } from '../middleware/rbac.js';
import { getStockSnapshot, getOptionsSnapshot, getHistoricalBars } from '../tools/alpaca.js';
import { computeIndicators } from '../tools/indicators.js';
import { fetchNasdaqOI, findGammaWalls } from '../tools/nasdaq-oi.js';
import { fetchSentiment } from '../tools/sentiment.js';
import type { LLMRouter } from '../llm/router.js';

export function registerMarketRoutes(fastify: FastifyInstance, llm: LLMRouter) {
  // GET /api/snapshot/:ticker — free tier
  fastify.get('/api/snapshot/:ticker', { preHandler: [requireTier('free')] }, async (req) => {
    const { ticker } = req.params as { ticker: string };
    const snapshot = await getStockSnapshot(ticker.toUpperCase());

    // Generate standard expirations: next 8 Fridays + next 3 monthly third Fridays
    const expirations: string[] = [];
    const now = new Date();
    for (let i = 0; i < 56; i++) {
      const d = new Date(now.getTime() + i * 86400000);
      if (d.getDay() === 5) expirations.push(d.toISOString().slice(0, 10));
      if (expirations.length >= 8) break;
    }
    for (let m = 0; m < 4; m++) {
      const month = new Date(now.getFullYear(), now.getMonth() + m, 1);
      let day = month;
      while (day.getDay() !== 5) day = new Date(day.getTime() + 86400000);
      const thirdFri = new Date(day.getTime() + 14 * 86400000);
      const iso = thirdFri.toISOString().slice(0, 10);
      if (thirdFri > now && !expirations.includes(iso)) expirations.push(iso);
    }
    expirations.sort();
    return { snapshot, expirations };
  });

  // GET /api/chain/:ticker/:expiry — basic tier
  fastify.get('/api/chain/:ticker/:expiry', { preHandler: [requireTier('basic')] }, async (req) => {
    const { ticker, expiry } = req.params as { ticker: string; expiry: string };
    const contracts = await getOptionsSnapshot(ticker.toUpperCase(), expiry);
    const strikeMap = new Map<number, { strike: number; call?: typeof contracts[0]; put?: typeof contracts[0] }>();
    for (const c of contracts) {
      if (!strikeMap.has(c.strike)) strikeMap.set(c.strike, { strike: c.strike });
      const entry = strikeMap.get(c.strike)!;
      if (c.type === 'call') entry.call = c; else entry.put = c;
    }
    return { strikes: [...strikeMap.values()].sort((a, b) => a.strike - b.strike) };
  });

  // GET /api/indicators/:ticker — basic tier
  fastify.get('/api/indicators/:ticker', { preHandler: [requireTier('basic')] }, async (req) => {
    const { ticker } = req.params as { ticker: string };
    const tk = ticker.toUpperCase();
    const bars = await getHistoricalBars(tk, 250);
    const snapshot = await getStockSnapshot(tk);
    const indicators = computeIndicators(bars, snapshot.price);
    return { indicators };
  });

  // GET /api/gamma/:ticker/:expiry — basic tier
  fastify.get('/api/gamma/:ticker/:expiry', { preHandler: [requireTier('basic')] }, async (req) => {
    const { ticker, expiry } = req.params as { ticker: string; expiry: string };
    const tk = ticker.toUpperCase();
    const [snapshot, oiChain] = await Promise.all([
      getStockSnapshot(tk),
      fetchNasdaqOI(tk, expiry),
    ]);
    const analysis = findGammaWalls(oiChain, snapshot.price);
    const range = snapshot.price * 0.15;
    const oiByStrike = oiChain.strikes
      .filter(s => s.strike >= snapshot.price - range && s.strike <= snapshot.price + range)
      .map(s => ({ strike: s.strike, callOI: s.callOI, putOI: s.putOI, callVolume: s.callVolume, putVolume: s.putVolume }));
    return {
      walls: analysis.walls,
      putWallStrike: analysis.putWallStrike,
      callWallStrike: analysis.callWallStrike,
      spotInsideBand: analysis.spotInsideBand,
      oiByStrike,
      spot: snapshot.price,
    };
  });

  // GET /api/sentiment/:ticker — basic tier (Claude + Grok + Gemini + Reddit/StockTwits)
  fastify.get('/api/sentiment/:ticker', { preHandler: [requireTier('basic')] }, async (req, reply) => {
    const { ticker } = req.params as { ticker: string };
    llm.resetUsage();
    const result = await fetchSentiment(ticker.toUpperCase(), llm);
    if (!result) return reply.code(502).send({ error: 'All sentiment engines failed' });
    return { ...result, cost: llm.getUsage() };
  });

  // GET /api/bars/:ticker — basic tier (historical bars for pipeline)
  fastify.get('/api/bars/:ticker', { preHandler: [requireTier('basic')] }, async (req) => {
    const { ticker } = req.params as { ticker: string };
    const query = req.query as { days?: string };
    const days = Math.min(365, Math.max(1, parseInt(query.days || '250', 10)));
    const bars = await getHistoricalBars(ticker.toUpperCase(), days);
    return { bars };
  });
}
