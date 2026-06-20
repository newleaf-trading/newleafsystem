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

    // Validate — mirrors validateTile rules
    if (!body.ticker || !body.strategy) {
      return reply.code(400).send({ error: 'ticker and strategy are required' });
    }
    if (!Array.isArray(body.legs) || body.legs.length < 2) {
      return reply.code(400).send({ error: `legs must have ≥ 2 entries, got ${body.legs?.length ?? 0}` });
    }
    const allLegsUnpriced = (body.legs as any[]).every((l: any) => (l.premium || l.mid || 0) === 0);
    if (allLegsUnpriced) {
      return reply.code(400).send({
        error: 'All leg premiums are $0 — cannot publish unpriced candidate. ' +
               'Ensure the option chain returned valid mid prices before publishing.'
      });
    }

    try {
      const { getFirestore, FieldValue } = await import('firebase-admin/firestore');
      const db = getFirestore('newleafdb');

      const tileId = randomUUID().replace(/-/g, '').slice(0, 20);
      const now = new Date();
      const weekId = getISOWeek(now);

      // ── Validate P&L ──
      if (!(body.maxProfit > 0) || !(body.maxLoss > 0)) {
        return reply.code(400).send({ error: `Invalid P&L: maxProfit=${body.maxProfit}, maxLoss=${body.maxLoss}` });
      }
      if (!body.expiry) {
        return reply.code(400).send({ error: 'Missing expiry' });
      }
      if (!(body.spotPrice > 0)) {
        return reply.code(400).send({ error: 'Missing spotPrice' });
      }

      // ── PoP: null when uncomputable, never fabricated ──
      const oddsOfProfit = (typeof body.pop === 'number' && body.pop > 0) ? body.pop : null;

      // ── Breakevens: valid [lower, upper] or undefined — never [] ──
      const rawBE = body.breakevens;
      const breakevens = (Array.isArray(rawBE) && rawBE.length === 2) ? rawBE : undefined;

      // ── Build tile document (canonical schema) ──
      const tile = {
        id: tileId,
        symbol: body.ticker,
        strategy: body.strategy,
        direction: body.direction || 'neutral',
        publishedSpotPrice: body.spotPrice,
        underlyingPrice: body.spotPrice,
        expiry: body.expiry,
        daysToExpiry: body.dte || 0,
        legs: body.legs,
        greeks: body.greeks || {},
        gammaData: body.gammaData || {},
        maxProfit: body.maxProfit,
        maxLoss: body.maxLoss,
        netCredit: body.netCredit || 0,
        rewardRisk: body.rewardRisk || 0,
        oddsOfProfit,
        breakevens,
        source: 'discover-publish',
        isActive: true,
        sortOrder: Date.now(),
        // Named confidence fields — no generic 'confidence'
        verdictConfidence: (typeof body.verdict?.confidence === 'number') ? body.verdict.confidence : null,
        wallConfidence: null,
        sentiment: body.sentiment || null,
        // Provenance (nested)
        provenance: {
          model: 'discover-pipeline',
          prompt: 'discover-v1.0',
          source: 'discover-publish',
          verifyJobId: body.verifyJobId || null,
          verifyVerdict: body.verdict?.call || null,
          verifyConfidence: body.verdict?.confidence || null,
          generatedAt: now.toISOString(),
          commitSha: null,
        },
        createdAt: FieldValue.serverTimestamp(),
        lastUpdated: FieldValue.serverTimestamp(),
      };

      // ── Publish gate — reject if verdict < 65 or no-verdict + PoP < 65 ──
      const vc = tile.verdictConfidence;
      const pop = tile.oddsOfProfit;
      if (vc != null && vc < 65) {
        return reply.code(400).send({ error: `Adversarial verdict confidence ${vc} < 65 threshold. Tile rejected.` });
      }
      if (vc == null && (pop || 0) < 65) {
        return reply.code(400).send({ error: `PoP ${pop ?? 'null'} < 65% floor (no verdict). Tile rejected.` });
      }

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

      // ── Invest Layer 1: log published pick as a paper position ──────────
      const gateValues = body.engineSnapshot?.gateValues ?? null;
      if (!gateValues) {
        console.warn(`[Invest] WARNING: position ${tileId} (${body.ticker}) has NO gate values — engineSnapshot missing from publish payload. Position NOT logged.`);
      } else {
        const shortStrikes = deriveShortStrikes(body.legs, body.strategy);
        const bodyStrike = deriveBodyStrike(body.legs, body.strategy);
        const exitConfig = getExitDefaults(body.strategy);

        const position = {
          id: tileId,
          symbol: body.ticker,
          publishedAt: FieldValue.serverTimestamp(),
          source: 'paper' as const,
          status: 'open' as const,
          strategy: body.strategy,
          direction: body.direction || 'neutral',
          gateValues,
          structure: {
            legs: (body.legs || []).map((l: any) => ({
              type: (l.type || '').toLowerCase(),
              side: l.action || l.side || 'unknown',
              strike: l.strike,
              expiry: body.expiry,
              entryBid: l.bid ?? null,
              entryAsk: l.ask ?? null,
              entryMid: l.mid ?? l.premium ?? null,
              delta: l.delta ?? null,
            })),
            entryCreditOrDebit: body.netCredit ?? 0,
            maxProfit: body.maxProfit ?? 0,
            maxLoss: body.maxLoss ?? 0,
            shortStrikes,
            bodyStrike,
            breakevens: body.breakevens || [],
          },
          spotAtEntry: body.spotPrice ?? 0,
          expiry: body.expiry,
          dte: body.dte || 0,
          realFill: null,
          managedExitConfig: exitConfig,
          tileId,
          weekId,
          closedAt: null,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        };

        await db.collection('positions').doc(tileId).set(position);
        console.log(`[Invest] Position logged: ${tileId} (${body.ticker} ${body.strategy}) with gate values`);
      }

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

// ── Invest helpers ────────────────────────────────────────────────────────────

/** Extract short (sold) strikes from legs based on strategy */
function deriveShortStrikes(legs: any[], strategy: string): number[] {
  if (!legs?.length) return [];
  return legs
    .filter((l: any) => (l.action === 'SELL' || l.side === 'short'))
    .map((l: any) => l.strike)
    .filter((s: number) => s > 0)
    .sort((a: number, b: number) => a - b);
}

/** Extract body strike (butterfly/BWB center) from legs */
function deriveBodyStrike(legs: any[], strategy: string): number | null {
  if (!strategy) return null;
  const code = strategy.toLowerCase().replace(/[\s-]/g, '_');
  if (code !== 'iron_butterfly' && code !== 'broken_wing_butterfly') return null;
  // Body = the strike that appears in SELL legs more than once (butterfly), or
  // for iron butterfly the shared short strike
  const sells = (legs || []).filter((l: any) => l.action === 'SELL' || l.side === 'short');
  if (!sells.length) return null;
  // Iron butterfly: both shorts at same strike
  if (code === 'iron_butterfly' && sells.length >= 2 && sells[0].strike === sells[1].strike) {
    return sells[0].strike;
  }
  // BWB: the short strike(s) — body is the sold strike
  if (code === 'broken_wing_butterfly') {
    const strikeCounts = new Map<number, number>();
    for (const s of sells) strikeCounts.set(s.strike, (strikeCounts.get(s.strike) || 0) + 1);
    // Body is the strike that appears twice (or the most frequent)
    let maxCount = 0, body = null;
    for (const [strike, count] of strikeCounts) {
      if (count > maxCount) { maxCount = count; body = strike; }
    }
    return body;
  }
  return null;
}

/** Parameterized managed-exit defaults per strategy (from exit-settings research) */
function getExitDefaults(strategy: string): { profitTargetPct: number; dteStop: number; lossMultiple: number } {
  const code = (strategy || '').toLowerCase().replace(/[\s-]/g, '_');
  const defaults: Record<string, { profitTargetPct: number; dteStop: number; lossMultiple: number }> = {
    iron_condor:            { profitTargetPct: 0.50, dteStop: 21, lossMultiple: 2.0 },
    iron_butterfly:         { profitTargetPct: 0.50, dteStop: 21, lossMultiple: 2.0 },
    bull_put_spread:        { profitTargetPct: 0.50, dteStop: 21, lossMultiple: 2.0 },
    bear_call_spread:       { profitTargetPct: 0.50, dteStop: 21, lossMultiple: 2.0 },
    calendar_spread:        { profitTargetPct: 0.50, dteStop: 7,  lossMultiple: 2.0 },
    broken_wing_butterfly:  { profitTargetPct: 0.50, dteStop: 7,  lossMultiple: 2.5 },
  };
  return defaults[code] || defaults.iron_condor;
}

function getISOWeek(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}
