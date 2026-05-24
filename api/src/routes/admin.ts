import { randomUUID } from 'crypto';
import type { FastifyInstance } from 'fastify';
import { requireTier } from '../middleware/rbac.js';
import type { UserRole } from '../middleware/auth.js';
import { MODEL_ASSIGNMENTS } from '../llm/model-assignments.js';
import type { LLMRouter } from '../llm/router.js';
import { getAllCacheStats } from '../lib/cache.js';

export function registerAdminRoutes(fastify: FastifyInstance, llm?: LLMRouter) {
  // POST /admin/keys — create a new API key
  fastify.post('/admin/keys', { preHandler: [requireTier('admin')] }, async (req, reply) => {
    const { name, role, ownerId } = req.body as { name?: string; role?: UserRole; ownerId?: string };
    if (!name) return reply.code(400).send({ error: 'name is required' });

    const validRoles: UserRole[] = ['free', 'basic', 'premium', 'admin'];
    const keyRole = validRoles.includes(role as UserRole) ? role! : 'free';

    const key = `nl_${randomUUID().replace(/-/g, '')}`;

    if (process.env.NODE_ENV !== 'production') {
      // Dev mode: return the key without persisting to Firestore
      return { id: randomUUID(), key, name, role: keyRole, ownerId: ownerId ?? 'dev', active: true, createdAt: new Date().toISOString() };
    }

    const { getFirestore } = await import('firebase-admin/firestore');
    const db = getFirestore();
    const doc = db.collection('apiKeys').doc();
    const record = {
      key,
      name,
      role: keyRole,
      ownerId: ownerId ?? req.userId,
      active: true,
      createdAt: new Date(),
      lastUsedAt: null,
      requestCount: 0,
    };
    await doc.set(record);
    return { id: doc.id, key, name, role: keyRole, active: true, createdAt: record.createdAt.toISOString() };
  });

  // GET /admin/keys — list all API keys
  fastify.get('/admin/keys', { preHandler: [requireTier('admin')] }, async () => {
    if (process.env.NODE_ENV !== 'production') {
      return { keys: [{ id: 'dev', name: 'dev-key', role: process.env.DEV_API_ROLE ?? 'admin', active: true }] };
    }

    const { getFirestore } = await import('firebase-admin/firestore');
    const snap = await getFirestore().collection('apiKeys').orderBy('createdAt', 'desc').get();
    const keys = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name,
        role: data.role,
        ownerId: data.ownerId,
        active: data.active,
        lastUsedAt: data.lastUsedAt?.toDate?.()?.toISOString() ?? null,
        requestCount: data.requestCount ?? 0,
        createdAt: data.createdAt?.toDate?.()?.toISOString() ?? null,
        // Never expose the full key — show prefix only
        keyPrefix: data.key?.slice(0, 8) + '...',
      };
    });
    return { keys };
  });

  // DELETE /admin/keys/:id — deactivate an API key
  fastify.delete('/admin/keys/:id', { preHandler: [requireTier('admin')] }, async (req, reply) => {
    const { id } = req.params as { id: string };

    if (process.env.NODE_ENV !== 'production') {
      return { success: true, id };
    }

    const { getFirestore } = await import('firebase-admin/firestore');
    const doc = getFirestore().collection('apiKeys').doc(id);
    const snap = await doc.get();
    if (!snap.exists) return reply.code(404).send({ error: 'Key not found' });
    await doc.update({ active: false });
    return { success: true, id };
  });

  // GET /admin/model-assignments — list all model assignments
  fastify.get('/admin/model-assignments', { preHandler: [requireTier('admin')] }, async () => {
    return {
      assignments: MODEL_ASSIGNMENTS.map(a => ({
        service: a.service,
        description: a.description,
        currentModel: a.currentModel,
        alternatives: a.alternatives,
        envOverride: a.envOverride,
        category: a.category,
      })),
    };
  });

  // GET /admin/usage-summary — LLM usage stats from current session
  fastify.get('/admin/usage-summary', { preHandler: [requireTier('admin')] }, async () => {
    if (!llm) return { usage: null, message: 'LLM router not available' };
    const usage = llm.getUsage();
    // Group by model
    const byModel: Record<string, { calls: number; inputTokens: number; outputTokens: number; cost: number }> = {};
    for (const call of usage.calls) {
      if (!byModel[call.model]) byModel[call.model] = { calls: 0, inputTokens: 0, outputTokens: 0, cost: 0 };
      byModel[call.model].calls++;
      byModel[call.model].inputTokens += call.inputTokens;
      byModel[call.model].outputTokens += call.outputTokens;
      byModel[call.model].cost += call.cost;
    }
    // Round costs
    for (const m of Object.values(byModel)) m.cost = +m.cost.toFixed(6);
    return {
      totalCalls: usage.calls.length,
      totalCost: usage.totalCost,
      totalInputTokens: usage.totalInputTokens,
      totalOutputTokens: usage.totalOutputTokens,
      byModel,
    };
  });

  // GET /admin/cache-stats — cache hit rates and entry counts
  fastify.get('/admin/cache-stats', { preHandler: [requireTier('admin')] }, async () => {
    return getAllCacheStats();
  });
}
