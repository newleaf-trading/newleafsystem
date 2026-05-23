/**
 * POST /api/publish-from-analysis
 *
 * Receives the full analysis payload collected by discover.html's 5-step flow
 * and writes it to Firestore as a published pick (tile + analysis + weeklyPicks + publication).
 *
 * This replaces the old flow of saving a WIP and running publish-pick.cjs manually.
 * All data is already collected — this endpoint is a "save to production" operation.
 */
import type { FastifyInstance } from 'fastify';
import { requireTier } from '../middleware/rbac.js';
import { randomUUID } from 'crypto';

export function registerPublishRoutes(fastify: FastifyInstance) {
  fastify.post('/api/publish-from-analysis', { preHandler: [requireTier('premium')] }, async (req, reply) => {
    const body = req.body as any;
    if (!body.ticker || !body.strategy || !body.legs?.length) {
      return reply.code(400).send({ error: 'ticker, strategy, and legs are required' });
    }

    try {
      const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
      const db = getFirestore();

      const tileId = randomUUID().replace(/-/g, '').slice(0, 20);
      const now = new Date();
      const weekId = getISOWeek(now);

      // ── Build tile document ──
      const tile = {
        id: tileId,
        symbol: body.ticker,
        strategy: body.strategy,
        direction: body.direction || 'neutral',
        publishedSpotPrice: body.spotPrice,
        underlyingPrice: body.spotPrice,
        currentPrice: body.spotPrice,
        price: body.spotPrice,
        expiry: body.expiry,
        dte: body.dte || 0,
        legs: body.legs,
        greeks: body.greeks || {},
        gammaData: body.gammaData || {},
        maxProfit: body.maxProfit || 0,
        maxLoss: body.maxLoss || 0,
        netCredit: body.netCredit || 0,
        rewardRisk: body.rewardRisk || 0,
        oddsOfProfit: body.pop || 0,
        breakevens: body.breakevens || [],
        source: 'discover-publish',
        isActive: true,
        sortOrder: Date.now(),
        confidence: body.verdict?.confidence || 50,
        sentiment: body.sentiment || null,
        // Provenance
        model_used: 'discover-pipeline',
        prompt_version: 'discover-v1.0',
        analysis_source: 'discover-publish',
        verify_job_id: body.verifyJobId || null,
        verify_verdict: body.verdict?.call || null,
        verify_confidence: body.verdict?.confidence || null,
        generation_timestamp: now.toISOString(),
        code_commit_sha: null,
        createdAt: FieldValue.serverTimestamp(),
        lastUpdated: FieldValue.serverTimestamp(),
      };

      // ── Build analysis document ──
      const analysis = {
        // From the verification pipeline
        strategyRationale: body.analysis?.strategyRationale || {
          whyThisStrategy: body.aiRead || '',
          whyTheseStrikes: '',
          whyThisExpiry: '',
        },
        technicalIndicators: body.analysis?.technicalIndicators || body.indicators || {},
        thetaDecaySchedule: body.analysis?.thetaDecaySchedule || {},
        riskAnalysis: body.analysis?.riskAnalysis || {},
        // Verification evidence
        _verdict: body.verdict || null,
        _evidence: body.evidence || null,
        _debate: body.debate || null,
        _riskReport: body.riskReport || null,
        _sentiment: body.sentiment || null,
        _gammaAnalysis: body.gammaAnalysis || null,
        // Provenance
        model_used: 'discover-pipeline',
        prompt_version: 'discover-v1.0',
        analysis_source: 'discover-publish',
        verify_job_id: body.verifyJobId || null,
        verify_verdict: body.verdict?.call || null,
        verify_confidence: body.verdict?.confidence || null,
        generation_timestamp: now.toISOString(),
        code_commit_sha: null,
        _generatedAt: FieldValue.serverTimestamp(),
        _tileId: tileId,
        _symbol: body.ticker,
        _strategy: body.strategy,
      };

      // ── Write all documents ──
      const batch = db.batch();

      // Tile
      batch.set(db.collection('tiles').doc(tileId), tile);

      // Analysis
      batch.set(db.collection('analyses').doc(tileId), analysis);

      // Publication tracking
      const publication = {
        tileId,
        symbol: body.ticker,
        strategy: body.strategy,
        weekId,
        spotPrice: body.spotPrice,
        maxProfit: body.maxProfit || 0,
        maxLoss: body.maxLoss || 0,
        rewardRisk: body.rewardRisk || 0,
        oddsOfProfit: body.pop || 0,
        netCredit: body.netCredit || 0,
        expiry: body.expiry,
        dte: body.dte || 0,
        thesis: body.aiRead || '',
        channels: {
          picks:     { status: 'complete', url: `https://newleafsystem.com/picks/analysis/${body.ticker.toLowerCase()}`, updatedAt: now.toISOString() },
          invest:    { status: 'complete', url: `https://newleafsystem.com/invest/position/${tileId}`, updatedAt: now.toISOString() },
          pdf:       { status: 'tbd', url: null, updatedAt: null },
          youtube:   { status: 'tbd', url: null, updatedAt: null },
          linkedin:  { status: 'tbd', url: null, updatedAt: null },
          twitter:   { status: 'tbd', url: null, updatedAt: null },
          instagram: { status: 'tbd', url: null, updatedAt: null },
          email:     { status: 'tbd', url: null, updatedAt: null },
        },
        createdAt: FieldValue.serverTimestamp(),
      };
      batch.set(db.collection('publications').doc(tileId), publication);

      // WeeklyPicks
      const pickSummary = {
        tileId,
        symbol: body.ticker,
        strategy: body.strategy,
        direction: body.direction || 'neutral',
        price: body.spotPrice,
        maxProfit: body.maxProfit || 0,
        maxLoss: body.maxLoss || 0,
        rewardRisk: body.rewardRisk || 0,
        oddsOfProfit: body.pop || 0,
        expiry: body.expiry,
        dte: body.dte || 0,
        thesis: body.aiRead || '',
      };

      const weekRef = db.collection('weeklyPicks').doc(weekId);
      const weekDoc = await weekRef.get();
      if (weekDoc.exists) {
        batch.update(weekRef, {
          tileIds: FieldValue.arrayUnion(tileId),
          picks: FieldValue.arrayUnion(pickSummary),
          tileCount: FieldValue.increment(1),
          lastUpdated: FieldValue.serverTimestamp(),
        });
      } else {
        const monday = new Date(now);
        monday.setDate(now.getDate() - (now.getDay() || 7) + 1);
        const friday = new Date(monday);
        friday.setDate(monday.getDate() + 4);
        const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
        batch.set(weekRef, {
          weekId, status: 'current',
          dateRange: `${fmt(monday)} — ${fmt(friday)}`,
          publishedAt: FieldValue.serverTimestamp(),
          theme: 'Options strategies selected by NewLeaf scoring engine',
          tileIds: [tileId], tileCount: 1, picks: [pickSummary],
        });
      }

      await batch.commit();

      return {
        success: true,
        tileId,
        weekId,
        urls: {
          picks: `https://newleafsystem.com/picks/analysis/${body.ticker.toLowerCase()}`,
          invest: `https://newleafsystem.com/invest/position/${tileId}`,
        },
      };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });
}

function getISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}
