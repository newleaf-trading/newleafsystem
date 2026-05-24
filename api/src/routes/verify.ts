import type { FastifyInstance } from 'fastify';
import { requireTier } from '../middleware/rbac.js';
import { TradeIdeaSchema } from '../types.js';
import { VerificationOrchestrator } from '../orchestrator.js';
import { JobStore } from '../state/store.js';
import { verifyCache } from '../lib/cache.js';
import { createHash } from 'crypto';

export function registerVerifyRoutes(fastify: FastifyInstance, orchestrator: VerificationOrchestrator, store: JobStore) {
  // POST /verify — premium tier (cached 30 min by legs hash — same legs = same verdict)
  fastify.post('/verify', { preHandler: [requireTier('premium')] }, async (req, reply) => {
    const body = req.body as Record<string, unknown>;
    const validModes = ['premium', 'budget-v3', 'budget-r1', 'budget-qwq'] as const;
    const modelMode = validModes.includes(body.modelMode as any) ? body.modelMode as typeof validModes[number] : 'premium';
    const parsed = TradeIdeaSchema.safeParse(body);
    if (!parsed.success) return reply.code(400).send({ error: parsed.error.issues });

    // Cache key: hash of ticker + sorted legs + model mode
    const legsKey = JSON.stringify({ t: parsed.data.ticker, l: (parsed.data.legs || []).sort((a: any, b: any) => a.strike - b.strike), m: modelMode });
    const cacheKey = createHash('sha256').update(legsKey).digest('hex').slice(0, 16);
    const cached = verifyCache.get(cacheKey);
    if (cached) {
      fastify.log.info(`[verify] Cache hit for ${parsed.data.ticker} (${cacheKey})`);
      return { ...cached, cached: true, modelMode };
    }

    try {
      const result = await orchestrator.verify(parsed.data, modelMode);
      verifyCache.set(cacheKey, result);
      return { ...result, modelMode };
    } catch (err) {
      fastify.log.error(err);
      return reply.code(500).send({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  // GET /status/:jobId — premium tier
  fastify.get('/status/:jobId', { preHandler: [requireTier('premium')] }, async (req) => {
    const { jobId } = req.params as { jobId: string };
    return (await store.getJob(jobId)) ?? { error: 'not_found' };
  });
}
