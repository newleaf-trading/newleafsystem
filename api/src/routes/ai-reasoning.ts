/**
 * POST /api/reasoning/analyze — Deep reasoning analysis (6 parallel calls)
 *
 * Input: ticker + engine pick + market data + ENRICHED legs (with real mids)
 * Output: thesis, risk, scenarios, exit, regime, sizing + meta (grade, conviction)
 *
 * Requires enriched legs from /api/recommend. Will reject if legs are missing mids.
 */
import type { FastifyInstance } from 'fastify';
import type { LLMRouter } from '../llm/router.js';
import { requireTier } from '../middleware/rbac.js';
import { ReasoningEngine, type ReasoningInput } from '../agents/reasoner.js';
import { createHash } from 'crypto';

// 15-minute cache keyed by ticker + expiry + structure hash
const cache = new Map<string, { data: any; legs: any[]; ts: number }>();
const CACHE_TTL = 15 * 60 * 1000;

/** Hash the leg structure so cache only hits when legs are identical */
function structureHash(legs: any[]): string {
  const normalized = legs
    .map(l => [l.type, l.side || l.action, l.strike, Math.round((l.mid ?? 0) * 100) / 100])
    .sort();
  return createHash('sha1').update(JSON.stringify(normalized)).digest('hex').slice(0, 12);
}

function getCached(key: string) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry;
  cache.delete(key);
  return null;
}

export function registerReasoningRoutes(fastify: FastifyInstance, llm: LLMRouter) {
  const engine = new ReasoningEngine(llm);

  fastify.post('/api/reasoning/analyze', { preHandler: [requireTier('premium')] }, async (req, reply) => {
    const body = req.body as any;
    const ticker = (body.ticker || '').toUpperCase();
    if (!ticker) return { error: 'ticker is required' };

    // Extract and normalize legs
    const rawLegs = body.legs ?? body.recommendation?.strategies?.[0]?.legs ?? [];
    const legs = rawLegs.map((l: any) => ({
      ...l,
      side: l.side || (l.action === 'SELL' ? 'short' : l.action === 'BUY' ? 'long' : l.side),
      action: l.action || (l.side === 'short' ? 'SELL' : l.side === 'long' ? 'BUY' : l.action),
    }));

    // Validate: require enriched legs with real mids
    // Recommend is the sole pricing authority — reasoning does not estimate prices
    const missingMid = legs.find((l: any) => typeof l.mid !== 'number' || l.mid <= 0);
    if (legs.length > 0 && missingMid) {
      console.warn(`[Reasoning] rejecting: leg ${missingMid.type}@${missingMid.strike} has no mid`);
      return reply.code(400).send({
        error: 'LEGS_NOT_PRICED',
        detail: `Leg ${missingMid.type}@${missingMid.strike} has no mid price. `
          + `Call /api/recommend first to get enriched legs; reasoning does not estimate prices.`,
      });
    }

    // Cache key includes structure hash — different legs = different cache entry
    const expiry = body.expiry || body.dte || '';
    const legHash = legs.length > 0 ? structureHash(legs) : 'no-legs';
    const cacheKey = `${ticker}:${expiry}:${legHash}`;

    const cached = getCached(cacheKey);
    if (cached) {
      console.log(`[Reasoning] cache hit for ${cacheKey}`);
      return { ...cached.data, _cached: true };
    }

    // Build reasoning input
    const input: ReasoningInput = {
      ticker,
      spot: body.spot ?? body.snapshot?.price ?? 0,
      expiry: body.expiry || '',
      dte: body.dte ?? 21,
      strategy: body.strategy ?? body.pick?.strategy ?? body.enginePick?.strategy ?? 'unknown',
      direction: body.direction ?? body.pick?.direction ?? body.enginePick?.direction ?? 'neutral',
      score: body.score ?? body.pick?.score ?? body.enginePick?.score ?? 0,
      // Technicals
      rsi: body.rsi ?? body.indicators?.rsi14 ?? 50,
      adx: body.adx ?? body.indicators?.adx14 ?? 20,
      atr: body.atr ?? body.indicators?.atr14 ?? 0,
      trendState: body.trendState ?? body.indicators?.smaTrend ?? 'neutral',
      trendScore: body.trendScore ?? 0.5,
      trendStrength: body.trendStrength ?? 'moderate',
      bbWidth: body.bbWidth ?? body.indicators?.bollingerWidth ?? 0,
      volRegime: body.volRegime ?? 'normal',
      smaSummary: body.smaSummary ?? body.indicators?.priceVsSma ?? 'unknown',
      // Gamma
      putWall: body.putWall ?? body.gammaAnalysis?.putWallStrike ?? 0,
      callWall: body.callWall ?? body.gammaAnalysis?.callWallStrike ?? 0,
      bandWidth: body.bandWidth ?? body.engineSnapshot?.gateValues?.bandWidthPct ?? 0,
      confidence: body.confidence ?? body.engineSnapshot?.gateValues?.blendedConfidence ?? 0,
      condorAllowed: body.condorAllowed ?? false,
      // IV
      atmIv: body.atmIv ?? body.engineSnapshot?.gateValues?.atmIv ?? 0,
      rv30: body.rv30 ?? 0,
      ivRvRatio: body.ivRvRatio ?? body.engineSnapshot?.gateValues?.ivRvRatio ?? 1,
      ivRank: body.ivRank ?? 0,
      // Legs (validated above — all have real mids)
      legs,
      netCredit: body.netCredit ?? body.recommendation?.strategies?.[0]?.netCredit,
      maxProfit: body.maxProfit,
      maxLoss: body.maxLoss,
      netDelta: body.netDelta,
      netGamma: body.netGamma,
      netTheta: body.netTheta,
      netVega: body.netVega,
      // Events
      earningsDays: body.earningsDays,
      exDivDays: body.exDivDays,
    };

    console.log(`[Reasoning] analyzing ${ticker} (${input.strategy}, ${input.direction}, ${legs.length} legs, hash=${legHash})`);
    const result = await engine.analyze(input);

    // Cache with leg snapshot for guardrail checks
    cache.set(cacheKey, { data: result, legs, ts: Date.now() });

    const usage = llm.getUsage();
    return {
      ...result,
      cost: usage,
    };
  });
}
