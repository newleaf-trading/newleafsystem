import { randomUUID } from 'crypto';
import type { FastifyInstance } from 'fastify';
import { requireTier } from '../middleware/rbac.js';
import type { UserRole } from '../middleware/auth.js';

export function registerAdminRoutes(fastify: FastifyInstance) {
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
}
