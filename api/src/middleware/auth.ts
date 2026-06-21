import type { FastifyRequest, FastifyReply } from 'fastify';
import { getFirestore } from 'firebase-admin/firestore';
import { initFirebase } from '../lib/firebase.js';

export type UserRole = 'free' | 'basic' | 'premium' | 'admin';

declare module 'fastify' {
  interface FastifyRequest {
    userRole: UserRole;
    userId: string;
    _apiKeyDocRef?: FirebaseFirestore.DocumentReference;
  }
}

export async function authMiddleware(request: FastifyRequest, reply: FastifyReply) {
  // Health check is always open
  if (request.url === '/health') {
    request.userRole = 'free';
    request.userId = 'anonymous';
    return;
  }

  const apiKey = request.headers['x-api-key'] as string | undefined;
  if (!apiKey) {
    return reply.code(401).send({ error: 'Missing X-API-Key header' });
  }

  // Dev mode: use env-based key (no Firestore needed)
  if (process.env.NODE_ENV !== 'production') {
    const devKey = process.env.DEV_API_KEY;
    if (devKey && apiKey === devKey) {
      request.userRole = (process.env.DEV_API_ROLE as UserRole) ?? 'admin';
      request.userId = 'dev-user';
      return;
    }
    // In dev, also try Firestore if available (for testing RBAC)
    if (!process.env.FIREBASE_PROJECT_ID) {
      return reply.code(401).send({ error: 'Invalid API key' });
    }
  }

  // Production: look up key in Firestore
  try {
    initFirebase();
    const db = getFirestore('newleafdb');
    const snap = await db.collection('apiKeys')
      .where('key', '==', apiKey)
      .where('active', '==', true)
      .limit(1)
      .get();

    if (snap.empty) {
      return reply.code(401).send({ error: 'Invalid API key' });
    }

    const doc = snap.docs[0];
    const data = doc.data();
    request.userRole = data.role as UserRole;
    request.userId = data.ownerId ?? doc.id;
    request._apiKeyDocRef = doc.ref;

    // Fire-and-forget: increment request count (HTTP-level)
    doc.ref.update({
      lastUsedAt: new Date(),
      requestCount: (data.requestCount ?? 0) + 1,
    }).catch(() => {});
  } catch (err) {
    request.raw.destroy();
    return reply.code(500).send({ error: 'Auth service unavailable' });
  }
}
