/**
 * TIQ Assessment — integration test against the Firestore emulator.
 *
 * Run:  npm run test:tiq   (starts the firestore emulator via emulators:exec)
 * or:   firebase emulators:exec --only firestore --project demo-newleaf \
 *         "npx tsx src/routes/tiq.integration.test.ts"
 *
 * Seeds tiqItems from content/tiq/bank-v1.json, then drives start → responses →
 * finish → standing through Fastify's in-process inject(). No network, no LLM.
 */

// Must be set before the route module is (dynamically) imported — it reads the
// DB id at load time, and the emulator serves the default database.
process.env.TIQ_FIRESTORE_DB = process.env.TIQ_FIRESTORE_DB || '(default)';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'demo-newleaf';
process.env.NODE_ENV = 'test';

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import assert from 'assert';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const BANK = require(path.resolve(here, '../../../content/tiq/bank-v1.json'));
const byId: Record<string, any> = Object.fromEntries(BANK.questions.map((q: any) => [q.id, q]));

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  → ' + detail : '')); }
}

function bestAnswer(item: any) {
  const sc = item.scoring;
  if (sc.mode === 'weighted_choice') {
    let bk = null, bv = -Infinity;
    for (const [k, v] of Object.entries(sc.choice_points)) if ((v as number) > bv) { bv = v as number; bk = k; }
    return { choice: bk };
  }
  if (sc.mode === 'multi_select') return { selected: sc.correct_keys.slice() };
  if (sc.mode === 'ranking') return { order: sc.correct_order.slice() };
  return { choice: null };
}
function recklessAnswer(item: any) {
  const sc = item.scoring;
  if (sc.mode === 'weighted_choice') {
    if (sc.ruin_flag_choices?.length) return { choice: sc.ruin_flag_choices[0] };
    let wk = null, wv = Infinity;
    for (const [k, v] of Object.entries(sc.choice_points)) if ((v as number) < wv) { wv = v as number; wk = k; }
    return { choice: wk };
  }
  if (sc.mode === 'multi_select') return { selected: [] };
  if (sc.mode === 'ranking') return { order: sc.correct_order.slice().reverse() };
  return { choice: null };
}

async function main() {
  const admin = require('firebase-admin');
  admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
  const db = admin.firestore(); // emulator default database

  const { seed } = require(path.resolve(here, '../../../scripts/tiq/seed-firestore.js'));
  const seeded = await seed(db);
  console.log(`\nseeded tiqBanks/${seeded.bank_version} + ${seeded.items} tiqItems (emulator)\n`);

  const Fastify = (await import('fastify')).default;
  const { registerTIQRoutes } = await import('./tiq.js');

  const app = Fastify();
  // Stub the auth middleware: free-tier authenticated user.
  app.addHook('onRequest', async (req: any) => { req.userRole = 'free'; req.userId = 'test-user'; });
  registerTIQRoutes(app);
  await app.ready();

  const j = async (opts: any) => {
    const res = await app.inject(opts);
    return { status: res.statusCode, body: res.json() };
  };

  async function runSitting(answer: (item: any) => any, confidence: number) {
    const start = await j({ method: 'POST', url: '/api/tiq/sittings', payload: { userMeta: { experienceBand: '2_5y', countryCode: 'GB' } } });
    const sittingId = start.body.sittingId;
    const results: any[] = [];
    for (const stripped of start.body.items) {
      const full = byId[stripped.id];
      const r = await j({
        method: 'POST', url: `/api/tiq/sittings/${sittingId}/responses`,
        payload: { itemId: stripped.id, ...answer(full), confidence, elapsed_ms: Math.round((full.est_seconds || 60) * 800) }
      });
      results.push({ stripped, resp: r });
    }
    const finish = await j({ method: 'POST', url: `/api/tiq/sittings/${sittingId}/finish`, payload: {} });
    const standing = await j({ method: 'GET', url: `/api/tiq/sittings/${sittingId}/standing` });
    return { sittingId, start, results, finish, standing };
  }

  // ── Sitting 1: ideal respondent ──────────────────────────────────────────────
  console.log('── start / sequence integrity ──');
  const ideal = await runSitting(bestAnswer, 4);
  const start = ideal.start;
  check('start returns 200 with all 40 items', start.status === 200 && start.body.count === 40, `count=${start.body.count}`);

  const sample = start.body.items[0];
  check('served item has stem + choices for rendering', !!sample.stem && Array.isArray(sample.choices) && sample.choices.length > 0);
  check('served item choices carry NO points (key stripped)', start.body.items.every((it: any) => it.choices.every((c: any) => !('points' in c) && !('choice_points' in c))));
  check('served items strip scoring/explanation/learning_objective/pair_id',
    start.body.items.every((it: any) => !('scoring' in it) && !('explanation' in it) && !('learning_objective' in it) && !('pair_id' in it)));

  // framing pair spacing
  const seqIds: string[] = start.body.items.map((it: any) => it.id);
  const pairPos = BANK.questions.filter((q: any) => q.pair_id).map((q: any) => seqIds.indexOf(q.id)).sort((a: number, b: number) => a - b);
  check('framing pair separated by >= 4 intervening items', pairPos.length < 2 || (pairPos[1] - pairPos[0]) >= 5, `positions=${pairPos.join(',')} gap=${pairPos.length > 1 ? pairPos[1] - pairPos[0] : 'n/a'}`);

  console.log('\n── per-response reveal (key comes back only after answering) ──');
  const firstResp = ideal.results[0].resp;
  check('per-response result reveals explanation + best key', firstResp.status === 200 && !!firstResp.body.explanation && Array.isArray(firstResp.body.best), JSON.stringify(firstResp.body.best));
  check('ideal answer scored as best', firstResp.body.isBest === true, `earned=${firstResp.body.earned}/${firstResp.body.max}`);

  // re-answer rejected
  const reanswer = await j({ method: 'POST', url: `/api/tiq/sittings/${ideal.sittingId}/responses`, payload: { itemId: seqIds[0], choice: 'A', confidence: 1, elapsed_ms: 100 } });
  check('re-answering an item is rejected (confidence cannot be revised)', reanswer.status === 409, `status=${reanswer.status}`);

  console.log('\n── finish + standing (ideal) ──');
  const fin = ideal.finish.body;
  check('finish returns computed scores', ideal.finish.status === 200 && fin.status === 'complete');
  check('ideal composite is high, TQ from anchor table', fin.scores.composite >= 95 && fin.scores.tqMethod === 'anchor', `composite=${fin.scores.composite} tq=${fin.scores.tq}`);
  check('ideal TQ capped at 130, ungated', fin.scores.tq === 130 && fin.scores.ruinGate.gated === false, `tq=${fin.scores.tq}`);
  const st = ideal.standing.body;
  check('standing is criterion-only with anchorBased set (no frozen norms yet)', st.mode === 'criterion_only' && st.anchorBased === true, `mode=${st.mode}`);
  check('standing suppresses percentile and rank below cohort floors', st.percentile === null && st.rank === null);
  check('standing carries 5 category scores + learning path', Object.keys(st.categoryScores).length === 5 && Array.isArray(st.learningPath));

  // append-only
  const refin = await j({ method: 'POST', url: `/api/tiq/sittings/${ideal.sittingId}/finish`, payload: {} });
  check('completed sitting cannot be finished again (append-only)', refin.status === 409, `status=${refin.status}`);

  console.log('\n── provenance on the stored sitting ──');
  const doc = (await db.collection('tiqSittings').doc(ideal.sittingId).get()).data();
  check('sitting is complete and append-only-safe', doc.status === 'complete');
  check('nested provenance envelope stamped', doc.provenance?.verify_verdict === 'deterministic' && doc.provenance?.analysis_source === 'shared/tiq' && doc.provenance?.versions?.bank === BANK.version, JSON.stringify(doc.provenance?.versions));

  // ── Sitting 2: reckless respondent → ruin gate ───────────────────────────────
  console.log('\n── ruin gate (reckless respondent) ──');
  const reckless = await runSitting(recklessAnswer, 5);
  const rf = reckless.finish.body.scores;
  check('reckless run trips the ruin gate and caps TQ at 95', rf.ruinGate.gated === true && rf.tq <= 95, `tq=${rf.tq} flags=${rf.ruinFlagCount}`);
  check('ruin banner set', /capital preservation/i.test(rf.ruinGate.banner || ''), rf.ruinGate.banner);
  check('reckless calibration reads Overconfident', rf.calibration.label === 'Overconfident', rf.calibration.label);

  console.log('\n── summary ──');
  console.log(`  ideal:    composite ${fin.scores.composite}  TQ ${fin.scores.tq} (${st.band}, ${st.mode})  gated=${fin.scores.ruinGate.gated}`);
  console.log(`  reckless: composite ${rf.composite}  TQ ${rf.tq} (${reckless.standing.body.band})  gated=${rf.ruinGate.gated}  banner="${rf.ruinGate.banner}"`);
  console.log(`  reckless top traits: ${rf.traits.top.map((t: any) => t.trait + ' (z' + t.z + ')').join(', ')}`);

  await app.close();
  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}

main().catch((err) => { console.error('\nINTEGRATION TEST ERROR:', err); process.exit(1); });
