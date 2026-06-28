/**
 * Detail-Plan routes — backs the Workbench surface at /workbench/plan.
 *
 * Architecture note: every PLAN NUMBER is computed deterministically in the browser by
 * shared/plan (no LLM in the compute path). These endpoints only (a) feed the live book the
 * read-only broker/journal values it overlays onto the deterministic schedule, and (b) persist
 * a provenance-stamped plan template. They never compute cadence/roll-up figures themselves.
 */
import type { FastifyInstance } from 'fastify';
import { requireTier } from '../middleware/rbac.js';
import { randomUUID } from 'crypto';

export function registerPlanRoutes(fastify: FastifyInstance) {
  /**
   * GET /api/plan/live-book
   * Read-only feed for "This week → Live": the broker/Alpaca book + closed-trade journal,
   * shaped as { positions: [{ id, pnl, pnlPct, dte }] } keyed by the schedule's cycle id.
   *
   * STUB: real broker positions don't yet carry the deterministic schedule id (e.g. "ic-3-2"),
   * so reconciling a live Iron Condor to a scheduled cycle (by expiry/short strikes) is a TODO.
   * Until that mapping exists we return an empty overlay (the page then shows the scheduled book
   * with zeroed P&L, read-only) plus the real open-position count for visibility.
   */
  fastify.get('/api/plan/live-book', async (_req, reply) => {
    try {
      const { getFirestore } = await import('firebase-admin/firestore');
      const db = getFirestore('newleafdb');
      const snap = await db.collection('positions').where('status', '==', 'open').get();
      return {
        positions: [], // TODO(reconcile): map open broker positions → schedule cycle ids
        openBrokerPositions: snap.size,
        source: 'firestore-positions',
        note: 'Live overlay pending broker↔schedule id reconciliation; showing scheduled book read-only.',
        generatedAt: new Date().toISOString(),
      };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  /**
   * POST /api/plan/templates
   * Persist a saved Detail-Plan template. Provenance is stamped on the write to match the
   * monorepo's Firestore contract (model_used / prompt_version / verify_verdict /
   * generation_timestamp / code_commit_sha). The plan is deterministic, so model/prompt are
   * null and the verdict is the literal 'deterministic'.
   */
  fastify.post('/api/plan/templates', { preHandler: [requireTier('premium')] }, async (req, reply) => {
    const body = req.body as any;
    if (![1, 3, 5].includes(body?.horizonYears)) {
      return reply.code(400).send({ error: 'horizonYears must be 1, 3 or 5' });
    }
    if (!body?.lanes || typeof body.lanes !== 'object') {
      return reply.code(400).send({ error: 'lanes are required' });
    }
    try {
      const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
      const db = getFirestore('newleafdb');
      const id = randomUUID().replace(/-/g, '').slice(0, 20);
      const now = new Date();

      const doc = {
        id,
        kind: 'detail-plan-template',
        horizonYears: body.horizonYears,
        capital: body.capital ?? null,
        riskPerTrade: body.riskPerTrade ?? null,
        preset: body.preset ?? 'custom',
        lanes: body.lanes,
        thresholds: body.thresholds ?? null,
        targets: body.targets ?? null,
        yearly: Array.isArray(body.yearly) ? body.yearly : [],
        // Authoritative server-stamped provenance (never trust the client's copy alone).
        provenance: {
          model_used: null, // deterministic — no LLM in the compute path
          prompt_version: null,
          verify_verdict: 'deterministic',
          analysis_source: 'shared/plan',
          generation_timestamp: now.toISOString(),
          code_commit_sha: process.env.COMMIT_SHA || process.env.CODE_COMMIT_SHA || null,
        },
        createdBy: (req as any).user?.uid || (req as any).apiKey?.id || null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      };

      await db.collection('planDetailTemplates').doc(id).set(doc);
      return { success: true, id };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });
}
