/**
 * TIQ Assessment routes — backs the Workbench surface at /workbench/tiq.
 *
 * Architecture (docs/tiq/TIQ-BUILD.md): every number is computed server-side by
 * the deterministic engine in shared/tiq. The item sequence is served with the
 * answer key, scoring blocks and explanations STRIPPED — a client that can see
 * the key before answering makes the instrument worthless. Correct answers and
 * explanations come back only in the per-response result, after the answer is in.
 *
 *   POST /api/tiq/sittings                 start, returns stripped item sequence
 *   POST /api/tiq/sittings/:id/responses   record choice + confidence + elapsed_ms
 *   POST /api/tiq/sittings/:id/finish       compute and store all scores
 *   GET  /api/tiq/sittings/:id/standing     TQ, categories, traits, percentile, rank
 *
 * tiqSittings is append-only: a completed sitting is never mutated, a retake is a
 * new document. Provenance is stamped on every write. Percentile/rank read from
 * frozen tiqNorms only — never computed live over tiqSittings. There are no norms
 * yet, so standing degrades to the criterion band with anchorBased set.
 */
import type { FastifyInstance } from 'fastify';
import { requireTier } from '../middleware/rbac.js';
import { randomUUID } from 'crypto';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

// shared/tiq is CommonJS. Dev runs from api/src/routes (repo-root /shared); the
// build copies shared/tiq into the bundle at api/shared (→ dist/routes at runtime).
const require = createRequire(import.meta.url);
const thisDir = path.dirname(fileURLToPath(import.meta.url));
const localTiq = path.resolve(thisDir, '../../../shared/tiq/index.js');
const deployedTiq = path.resolve(thisDir, '../../shared/tiq/index.js');
const TIQ = require(require('fs').existsSync(localTiq) ? localTiq : deployedTiq);

// Named database in production; overridable so the Firestore emulator (which
// serves the default database) can run the integration tests.
const DB_ID = process.env.TIQ_FIRESTORE_DB || 'newleafdb';

async function getDb() {
  const { getFirestore } = await import('firebase-admin/firestore');
  // The emulator serves the default database; production uses the named 'newleafdb'.
  return DB_ID && DB_ID !== '(default)' ? getFirestore(DB_ID) : getFirestore();
}

// ── bank loading (Firestore is the seeded mirror of content/tiq) ─────────────

let bankCache: any = null;

async function loadBank(db: any) {
  if (bankCache) return bankCache;
  const bankSnap = await db.collection('tiqBanks').orderBy('version', 'desc').limit(1).get();
  if (bankSnap.empty) throw new Error('tiqBanks is empty — run scripts/tiq/seed-firestore.js');
  const meta = bankSnap.docs[0].data();
  const itemsSnap = await db.collection('tiqItems')
    .where('bank_version', '==', meta.version)
    .where('active', '==', true)
    .get();
  const questions = itemsSnap.docs.map((d: any) => d.data());
  bankCache = {
    bank_version: meta.version,
    trait_vocabulary: meta.trait_vocabulary || [],
    categories: meta.categories || {},
    questions,
    byId: Object.fromEntries(questions.map((q: any) => [q.id, q]))
  };
  return bankCache;
}

// ── sequence: framing pairs served as a unit, >= 4 intervening items apart ───

const MIN_PAIR_GAP = 5; // 5 positions apart == at least 4 items between the pair

function buildSequence(questions: any[]): string[] {
  const order = questions.map(q => q.id).sort();
  const pairs: Record<string, string[]> = {};
  for (const q of questions) if (q.pair_id) (pairs[q.pair_id] ||= []).push(q.id);
  for (const ids of Object.values(pairs)) {
    if (ids.length < 2) continue;
    const idxs = ids.map(id => order.indexOf(id)).sort((a, b) => a - b);
    const [a, b] = idxs;
    if (b - a < MIN_PAIR_GAP) {
      const [moved] = order.splice(b, 1);
      order.splice(Math.min(a + MIN_PAIR_GAP, order.length), 0, moved);
    }
  }
  return order;
}

/** Strip everything that could reveal the key or the framing pair. */
function stripItem(item: any) {
  return {
    id: item.id,
    category: item.category,
    subskill: item.subskill,
    difficulty: item.difficulty,
    type: item.type,
    scenario: item.scenario ?? null,
    stem: item.stem,
    choices: (item.choices || []).map((c: any) => ({ key: c.key, text: c.text })),
    mode: item.scoring?.mode,
    est_seconds: item.est_seconds ?? null,
    visual: item.visual ?? null // diagram spec — reveals nothing about the answer
    // stripped: scoring, explanation, learning_objective, bias, tags, generator,
    // pair_id, pair_role.
  };
}

/** Normalise a per-response body into the shape shared/tiq.scoreItem expects. */
function responseShape(body: any) {
  if (Array.isArray(body?.selected)) return { selected: body.selected };
  if (Array.isArray(body?.order)) return { order: body.order };
  return { choice: body?.choice };
}

function bestKeys(item: any): string[] {
  const sc = item.scoring || {};
  if (sc.mode === 'weighted_choice') {
    const cp = sc.choice_points || {};
    const max = Math.max(...Object.values(cp).map((v: any) => Number(v)));
    return Object.keys(cp).filter(k => cp[k] === max);
  }
  if (sc.mode === 'multi_select') return sc.correct_keys || [];
  if (sc.mode === 'ranking') return sc.correct_order || [];
  return [];
}

function provenanceNow(bankVersion: string) {
  return TIQ.provenance({
    timestamp: new Date().toISOString(),
    commitSha: process.env.COMMIT_SHA || process.env.CODE_COMMIT_SHA || null,
    bankVersion,
    normVersion: null,
    scenarioVersion: null
  });
}

// ── simulator: scenario loading, stripping and server-side option scoring ────

const scenarioCache: Record<string, any> = {};
async function loadScenario(db: any, id: string) {
  if (scenarioCache[id]) return scenarioCache[id];
  const snap = await db.collection('tiqScenarios').doc(id).get();
  if (!snap.exists) return null;
  scenarioCache[id] = snap.data();
  return scenarioCache[id];
}

/**
 * Every option a node can present, across all three variant mechanisms (flat
 * options, per-option variants, node-level option_variants), flattened with its
 * decision `points`. Used ONLY server-side to score a decision — the client
 * identifies its choice by text, and points are never sent to it.
 */
function collectNodeOptions(node: any): any[] {
  const out: any[] = [];
  const add = (o: any, v?: any) => out.push({ text: (v || o).text, points: (v || o).points, act: o.act, breaks: o.breaks || null });
  if (Array.isArray(node.options)) {
    for (const o of node.options) {
      if (o.variants) for (const vk of Object.keys(o.variants)) add(o, o.variants[vk]);
      else add(o);
    }
  }
  if (node.option_variants) {
    for (const vk of Object.keys(node.option_variants)) for (const o of node.option_variants[vk]) add(o);
  }
  return out;
}

/** Strip decision `points` from every option; keep text/act/breaks so the client
 *  can render, drive the running tape (via act) and count rules broken (via breaks).
 *  Scripts stay — the market path is fixed and public by design (spec-simulator §5.1). */
function stripScenario(scen: any) {
  const stripOpt = (o: any) => {
    const c: any = { text: o.text, act: o.act };
    if (o.breaks) c.breaks = o.breaks;
    if (o.variants) { c.variants = {}; for (const vk of Object.keys(o.variants)) c.variants[vk] = { text: o.variants[vk].text }; }
    return c;
  };
  const nodes = (scen.nodes || []).map((n: any) => {
    const nn: any = { id: n.id, t: n.t, clock: n.clock };
    for (const k of ['beat', 'beat_variants', 'question', 'question_variants']) if (n[k] !== undefined) nn[k] = n[k];
    if (Array.isArray(n.options)) nn.options = n.options.map(stripOpt);
    if (n.option_variants) { nn.option_variants = {}; for (const vk of Object.keys(n.option_variants)) nn.option_variants[vk] = n.option_variants[vk].map(stripOpt); }
    return nn;
  });
  return {
    id: scen.id, scenario_version: scen.scenario_version, title: scen.title,
    account: scen.account, rules: scen.rules, instrument: scen.instrument,
    opening_position: scen.opening_position, settle_t: scen.settle_t,
    scripts: scen.scripts, script_labels: scen.script_labels || {},
    confidence_scale: scen.confidence_scale || [], nodes
  };
}

function provenanceScenario(scen: any) {
  return TIQ.provenance({
    timestamp: new Date().toISOString(),
    commitSha: process.env.COMMIT_SHA || process.env.CODE_COMMIT_SHA || null,
    bankVersion: null, normVersion: null, scenarioVersion: scen.scenario_version || null
  });
}

export function registerTIQRoutes(fastify: FastifyInstance) {
  const gate = { preHandler: [requireTier('free')] }; // authenticated; free tier is enough

  // ── start ──────────────────────────────────────────────────────────────────
  fastify.post('/api/tiq/sittings', gate, async (req, reply) => {
    try {
      const db = await getDb();
      const bank = await loadBank(db);
      const { FieldValue } = await import('firebase-admin/firestore');

      const sequence = buildSequence(bank.questions);
      const id = randomUUID().replace(/-/g, '').slice(0, 20);
      const now = new Date();

      const userMeta = (req.body as any)?.userMeta || {}; // { experienceBand, countryCode, ... }

      await db.collection('tiqSittings').doc(id).set({
        id,
        kind: 'tiq-sitting',
        status: 'in_progress',
        userId: (req as any).userId || null,
        userMeta,
        bank_version: bank.bank_version,
        sequence,
        responses: {},
        provenance: provenanceNow(bank.bank_version),
        createdAt: FieldValue.serverTimestamp(),
        startedAtISO: now.toISOString()
      });

      const items = sequence.map(qid => stripItem(bank.byId[qid]));
      return { sittingId: id, bank_version: bank.bank_version, count: items.length, items };
    } catch (err: any) {
      req.log?.error?.(err);
      return reply.code(500).send({ error: err.message });
    }
  });

  // ── record one response ──────────────────────────────────────────────────────
  fastify.post('/api/tiq/sittings/:id/responses', gate, async (req, reply) => {
    const { id } = req.params as any;
    const body = req.body as any;
    const itemId = body?.itemId;
    if (!itemId) return reply.code(400).send({ error: 'itemId is required' });

    try {
      const db = await getDb();
      const { FieldValue } = await import('firebase-admin/firestore');
      const ref = db.collection('tiqSittings').doc(id);
      const snap = await ref.get();
      if (!snap.exists) return reply.code(404).send({ error: 'sitting not found' });
      const sitting = snap.data() as any;

      if (sitting.status === 'complete') return reply.code(409).send({ error: 'sitting is complete; a retake is a new sitting' });
      if (!sitting.sequence.includes(itemId)) return reply.code(400).send({ error: 'item not in this sitting' });
      if (sitting.responses?.[itemId]) return reply.code(409).send({ error: 'already answered; confidence cannot be revised' });

      const bank = await loadBank(db);
      const item = bank.byId[itemId];
      if (!item) return reply.code(400).send({ error: 'unknown item' });

      const shaped = responseShape(body);
      const scored = TIQ.scoreItem(item, shaped); // { earned, max, ruinFlag, mode }

      const record = {
        ...shaped,
        confidence: Number.isFinite(body.confidence) ? body.confidence : null, // 1..5 slider
        elapsed_ms: Number.isFinite(body.elapsed_ms) ? body.elapsed_ms : null,
        earned: scored.earned,
        max: scored.max,
        ruinFlag: scored.ruinFlag,
        answeredAtISO: new Date().toISOString()
      };

      await ref.update({
        [`responses.${itemId}`]: record,
        answeredCount: (Object.keys(sitting.responses || {}).length) + 1,
        provenance: provenanceNow(sitting.bank_version)
      });

      // The result — and ONLY here — reveals the key and the explanation.
      return {
        itemId,
        earned: scored.earned,
        max: scored.max,
        best: bestKeys(item),
        isBest: scored.max > 0 ? scored.earned === scored.max : null,
        explanation: item.explanation || null
      };
    } catch (err: any) {
      req.log?.error?.(err);
      return reply.code(500).send({ error: err.message });
    }
  });

  // ── finish: compute and store all scores ─────────────────────────────────────
  fastify.post('/api/tiq/sittings/:id/finish', gate, async (req, reply) => {
    const { id } = req.params as any;
    try {
      const db = await getDb();
      const { FieldValue } = await import('firebase-admin/firestore');
      const ref = db.collection('tiqSittings').doc(id);
      const snap = await ref.get();
      if (!snap.exists) return reply.code(404).send({ error: 'sitting not found' });
      const sitting = snap.data() as any;
      if (sitting.status === 'complete') return reply.code(409).send({ error: 'sitting already finished; retakes are new documents' });

      const bank = await loadBank(db);
      const responsesById = sitting.responses || {};

      // Core scores — all deterministic, server-side.
      const core = TIQ.scoreSitting(
        { questions: bank.questions, trait_vocabulary: bank.trait_vocabulary },
        responsesById
      );

      // Calibration, pace, consistency from the stored per-response data.
      const calEntries: any[] = [];
      const paceEntries: any[] = [];
      for (const item of bank.questions) {
        const r = responsesById[item.id];
        if (!r) continue;
        const max = item.scoring?.max_points || 0;
        if (r.confidence != null && max > 0) {
          calEntries.push({ confidence: TIQ.normalizeConfidence(r.confidence), quality: r.earned / max });
        }
        if (r.elapsed_ms != null && item.est_seconds) {
          paceEntries.push({ responseSeconds: r.elapsed_ms / 1000, estSeconds: item.est_seconds });
        }
      }
      const calibration = TIQ.calibrationGap(calEntries);
      const pace = TIQ.impulsivityIndex(paceEntries);

      // Framing pairs → normalised gain/loss scores → consistency index.
      const pairMap: Record<string, any> = {};
      for (const item of bank.questions) {
        if (!item.pair_id) continue;
        const r = responsesById[item.id];
        const max = item.scoring?.max_points || 0;
        const norm = r && max > 0 ? r.earned / max : 0;
        (pairMap[item.pair_id] ||= {});
        pairMap[item.pair_id][item.pair_role === 'loss_frame' ? 'lossScore' : 'gainScore'] = norm;
      }
      const pairs = Object.values(pairMap).filter((p: any) => 'gainScore' in p && 'lossScore' in p);
      const consistency = TIQ.consistencyIndex(pairs);

      // Trait evidence: for each elevated trait, the item whose chosen answer
      // loaded it, and what the better answer was.
      const traitEvidence = core.traits.top.map((t: any) => {
        for (const qid of sitting.sequence) {
          const item = bank.byId[qid];
          const r = responsesById[qid];
          const loads = item.scoring?.trait_loadings?.[r?.choice];
          if (loads && loads[t.trait]) {
            const chosen = (item.choices || []).find((c: any) => c.key === r.choice);
            return {
              trait: t.trait, z: t.z, itemId: qid, stem: item.stem,
              yourChoice: chosen?.text || null,
              better: item.explanation?.correct || null,
              learning_objective: item.learning_objective || null
            };
          }
        }
        return { trait: t.trait, z: t.z, itemId: null };
      });

      // Learning path: learning_objective of missed items, deduped by subskill, cap 7.
      const seenSub = new Set<string>();
      const learningPath: string[] = [];
      for (const qid of sitting.sequence) {
        const item = bank.byId[qid];
        const r = responsesById[qid];
        const max = item.scoring?.max_points || 0;
        const missed = !r || (max > 0 && r.earned < max);
        if (missed && item.learning_objective && !seenSub.has(item.subskill)) {
          seenSub.add(item.subskill);
          learningPath.push(item.learning_objective);
          if (learningPath.length >= 7) break;
        }
      }

      const scores = {
        categories: core.categories,
        categoryScores: core.categoryScores,
        composite: core.composite,
        tqRaw: core.tqRaw,
        tqMethod: core.tqMethod,
        tq: core.tq,
        ruinGate: core.ruinGate,
        ruinFlagCount: core.ruinFlagCount,
        traits: core.traits,
        traitEvidence,
        calibration,
        pace,
        consistency,
        learningPath
      };

      await ref.update({
        status: 'complete',
        scores,
        finishedAt: FieldValue.serverTimestamp(),
        finishedAtISO: new Date().toISOString(),
        provenance: provenanceNow(sitting.bank_version)
      });

      return { sittingId: id, status: 'complete', scores };
    } catch (err: any) {
      req.log?.error?.(err);
      return reply.code(500).send({ error: err.message });
    }
  });

  // ── consensus (front-door bar) — STUBBED behind a flag ───────────────────────
  // The front door uses the bank's static illustrative values until real
  // telemetry exists; we never present fabricated percentages as live
  // (spec-frontdoor §3). This returns available:false until TIQ_CONSENSUS_LIVE=1
  // and tiqItemStats has data for the item.
  fastify.get('/api/tiq/items/:id/consensus', gate, async (req, reply) => {
    const { id } = req.params as any;
    if (process.env.TIQ_CONSENSUS_LIVE !== '1') {
      return { itemId: id, available: false, source: 'static', note: 'Live consensus disabled until tiqItemStats has real data.' };
    }
    try {
      const db = await getDb();
      const snap = await db.collection('tiqItemStats').doc(id).get();
      if (!snap.exists) return { itemId: id, available: false, source: 'static' };
      const d = snap.data() as any;
      return { itemId: id, available: true, source: 'telemetry', n: d.n || 0, choices: d.choices || {}, abandonRate: d.abandonRate ?? null };
    } catch (err: any) {
      return reply.code(500).send({ error: err.message });
    }
  });

  // ── standing: TQ, categories, traits, percentile, rank ───────────────────────
  fastify.get('/api/tiq/sittings/:id/standing', gate, async (req, reply) => {
    const { id } = req.params as any;
    try {
      const db = await getDb();
      const snap = await db.collection('tiqSittings').doc(id).get();
      if (!snap.exists) return reply.code(404).send({ error: 'sitting not found' });
      const sitting = snap.data() as any;
      if (sitting.status !== 'complete') return reply.code(409).send({ error: 'sitting is not finished' });
      const s = sitting.scores;

      // Frozen norms only. There are none, so describeStanding degrades to the
      // criterion band with anchorBased set. NEVER computed live over tiqSittings.
      const normTables = await loadFrozenNorms(db, sitting.bank_version);
      const standing = TIQ.describeStanding(s.tq, normTables, sitting.userMeta || {}, { tqMethod: s.tqMethod });

      return {
        sittingId: id,
        status: sitting.status,
        tq: s.tq,
        band: standing.band,
        anchorBased: standing.anchorBased,
        mode: standing.mode,
        precision: standing.precision || 'none',
        display: standing.display || standing.band,
        percentile: standing.percentile ?? null,
        percentileLow: standing.percentileLow ?? null,
        percentileHigh: standing.percentileHigh ?? null,
        rank: standing.rank ?? null,
        rankOf: standing.rankOf ?? null,
        cohortId: standing.cohortId ?? null,
        cohortN: standing.cohortN ?? 0,
        categoryScores: s.categoryScores,
        categories: s.categories,
        traits: s.traits.top,
        traitEvidence: s.traitEvidence,
        consistency: s.consistency,
        pace: s.pace,
        calibration: s.calibration,
        learningPath: s.learningPath
      };
    } catch (err: any) {
      req.log?.error?.(err);
      return reply.code(500).send({ error: err.message });
    }
  });

  // ── SIMULATOR — repeatable sessions, separate from assessment sittings ───────
  // Sessions are repeatable by design (a user has many), and NOTHING here touches
  // tiqSittings or the norms/standing path — they are not assessment attempts.

  // start a session → returns the scenario with decision points STRIPPED
  fastify.post('/api/tiq/sim/:scenarioId/sessions', gate, async (req, reply) => {
    const { scenarioId } = req.params as any;
    try {
      const db = await getDb();
      const scen = await loadScenario(db, scenarioId);
      if (!scen) return reply.code(404).send({ error: 'scenario not found' });
      const { FieldValue } = await import('firebase-admin/firestore');
      const id = randomUUID().replace(/-/g, '').slice(0, 20);

      await db.collection('tiqSimSessions').doc(id).set({
        id,
        kind: 'tiq-sim-session',
        scenarioId,
        scenario_version: scen.scenario_version || null,
        status: 'in_progress',
        userId: (req as any).userId || null,
        decisions: {},
        provenance: provenanceScenario(scen),
        createdAt: FieldValue.serverTimestamp(),
        startedAtISO: new Date().toISOString()
      });
      return { sessionId: id, scenario: stripScenario(scen) };
    } catch (err: any) {
      req.log?.error?.(err);
      return reply.code(500).send({ error: err.message });
    }
  });

  // record one decision — server derives act/t/points from the scenario by the
  // chosen option's text; points are scored server-side and never revealed here.
  fastify.post('/api/tiq/sim/:scenarioId/sessions/:id/decisions', gate, async (req, reply) => {
    const { scenarioId, id } = req.params as any;
    const body = req.body as any;
    if (!body?.nodeId || body?.choiceText == null) return reply.code(400).send({ error: 'nodeId and choiceText are required' });
    try {
      const db = await getDb();
      const ref = db.collection('tiqSimSessions').doc(id);
      const snap = await ref.get();
      if (!snap.exists) return reply.code(404).send({ error: 'session not found' });
      const session = snap.data() as any;
      if (session.status === 'complete') return reply.code(409).send({ error: 'session is complete; start a new session' });
      if (session.decisions?.[body.nodeId]) return reply.code(409).send({ error: 'node already decided' });

      const scen = await loadScenario(db, scenarioId);
      const node = (scen?.nodes || []).find((n: any) => n.id === body.nodeId);
      if (!node) return reply.code(400).send({ error: 'unknown node' });
      const opt = collectNodeOptions(node).find((o) => o.text === body.choiceText);
      if (!opt) return reply.code(400).send({ error: 'unknown choice' });

      await ref.update({
        [`decisions.${body.nodeId}`]: {
          act: opt.act, t: node.t, points: opt.points, breaks: opt.breaks || null,
          choiceText: body.choiceText,
          confidence: Number.isFinite(body.confidence) ? body.confidence : null,
          elapsed_ms: Number.isFinite(body.elapsed_ms) ? body.elapsed_ms : null,
          answeredAtISO: new Date().toISOString()
        },
        provenance: provenanceScenario(scen)
      });
      return { ok: true, nodeId: body.nodeId };
    } catch (err: any) {
      req.log?.error?.(err);
      return reply.code(500).send({ error: err.message });
    }
  });

  // finish — server-side scoreRun across EVERY script, plus survival stats.
  fastify.post('/api/tiq/sim/:scenarioId/sessions/:id/finish', gate, async (req, reply) => {
    const { scenarioId, id } = req.params as any;
    try {
      const db = await getDb();
      const { FieldValue } = await import('firebase-admin/firestore');
      const ref = db.collection('tiqSimSessions').doc(id);
      const snap = await ref.get();
      if (!snap.exists) return reply.code(404).send({ error: 'session not found' });
      const session = snap.data() as any;
      if (session.status === 'complete') return reply.code(409).send({ error: 'session already finished; retakes are new sessions' });

      const scen = await loadScenario(db, scenarioId);
      const log = (scen.nodes || [])
        .map((n: any) => session.decisions?.[n.id])
        .filter(Boolean)
        .map((d: any) => ({ act: d.act, t: d.t, points: d.points }));

      const run = TIQ.scoreRun(scen, log); // pnl in integer pence, keyed by script

      // Confidence calibration — needs the secret per-decision points, so it is
      // computed here, server-side (spec-simulator §2). Confidence arrives on the
      // scenario's 0–1 scale; decision quality is points/10.
      const calEntries = (scen.nodes || [])
        .map((n: any) => session.decisions?.[n.id])
        .filter((d: any) => d && d.confidence != null)
        .map((d: any) => ({ confidence: d.confidence, quality: (d.points || 0) / 10 }));
      const calibration = TIQ.calibrationGap(calEntries);

      const accountPence = (scen.account || 0) * 100;
      const survival = TIQ.survivalStats(Object.values(run.pnl), accountPence);
      const pnlPounds: Record<string, number> = {};
      for (const k of Object.keys(run.pnl)) pnlPounds[k] = TIQ.toPounds(run.pnl[k]);

      const result = {
        decisionScore: run.decisionScore,
        maxScore: run.maxScore,
        pnl: run.pnl,                 // integer pence — the exact, path-independent numbers
        pnlPounds,                    // presentation
        primaryScript: run.primaryScript,
        scriptLabels: scen.script_labels || {},
        scriptCount: Object.keys(run.pnl).length,
        lucky: run.lucky,             // decisionScore <= 50% of max AND actual-script P&L positive
        robbed: run.robbed,
        calibration,
        survival: {
          ...survival,
          medianPounds: TIQ.toPounds(survival.median),
          worstDecilePounds: TIQ.toPounds(survival.worstDecile)
        }
      };

      await ref.update({
        status: 'complete',
        result,
        finishedAt: FieldValue.serverTimestamp(),
        finishedAtISO: new Date().toISOString(),
        provenance: provenanceScenario(scen)
      });
      return { sessionId: id, status: 'complete', result };
    } catch (err: any) {
      req.log?.error?.(err);
      return reply.code(500).send({ error: err.message });
    }
  });
}

/** Load frozen norm tables for the TQ scale, keyed by cohortId. Empty until built. */
async function loadFrozenNorms(db: any, _bankVersion: string): Promise<Map<string, any>> {
  const tables = new Map<string, any>();
  const versSnap = await db.collection('tiqNorms').orderBy('normVersion', 'desc').limit(1).get().catch(() => null);
  if (!versSnap || versSnap.empty) return tables; // none yet → criterion-only standing
  const normVersion = versSnap.docs[0].data().normVersion;
  const cohortSnap = await db.collection('tiqNorms').doc(normVersion).collection('cohorts').where('scoreKey', '==', 'TQ').get();
  for (const d of cohortSnap.docs) tables.set(d.data().cohortId, d.data());
  return tables;
}
