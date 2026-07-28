/**
 * TIQ Decision Simulator — integration test against the Firestore emulator.
 *
 * Run:  npm run test:tiq:sim
 *
 * Seeds tiqScenarios from content/tiq/scenarios/the-wednesday.json, then drives
 * sessions → decisions → finish through Fastify inject(). The headline assertion
 * is the path-independence guard THROUGH THE API: the close-early-stay-flat log
 * returns identical P&L across Script A and Script B.
 */

process.env.TIQ_FIRESTORE_DB = process.env.TIQ_FIRESTORE_DB || '(default)';
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'demo-newleaf';
process.env.NODE_ENV = 'test';

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));

let pass = 0, fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log('  FAIL ' + name + (detail ? '  → ' + detail : '')); }
}

// Choice text per node, matched server-side to score the decision (points stay secret).
const CLOSE_EARLY: Record<string, string> = {
  n1: 'Close all three. The rule fired',
  n2: 'Nothing tonight. Look tomorrow with a plan',
  n3: 'Stay flat. You have no setup and no plan for today',
  n4: 'Nothing. Write down what a valid NVDA entry would look like and set an alert',
  n5: '2% per trade. Same as always'
};
const RECKLESS: Record<string, string> = {
  n1: 'Hold all three. The setup still looks fine',
  n2: 'Sell two more at 1.05 — better prices than this morning',
  n3: 'Sell three more at 1.50. The premium is enormous',
  n4: 'Take a small defined-risk position to be involved',
  n5: '3% — the last two days cost me and there is ground to make up'
};

async function main() {
  const admin = require('firebase-admin');
  admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT });
  const db = admin.firestore();

  const { seed } = require(path.resolve(here, '../../../scripts/tiq/seed-firestore.js'));
  const seeded = await seed(db);
  console.log(`\nseeded ${seeded.scenarios} scenario(s) (emulator)\n`);

  const Fastify = (await import('fastify')).default;
  const { registerTIQRoutes } = await import('./tiq.js');
  const app = Fastify();
  app.addHook('onRequest', async (req: any) => { req.userRole = 'free'; req.userId = 'test-user'; });
  registerTIQRoutes(app);
  await app.ready();

  const j = async (opts: any) => { const r = await app.inject(opts); return { status: r.statusCode, body: r.json() }; };

  async function runSession(picks: Record<string, string>, confidence: number) {
    const start = await j({ method: 'POST', url: '/api/tiq/sim/the-wednesday/sessions', payload: {} });
    const sessionId = start.body.sessionId;
    const scen = start.body.scenario;
    for (const node of scen.nodes) {
      await j({ method: 'POST', url: `/api/tiq/sim/the-wednesday/sessions/${sessionId}/decisions`, payload: { nodeId: node.id, choiceText: picks[node.id], confidence, elapsed_ms: 5000 } });
    }
    const finish = await j({ method: 'POST', url: `/api/tiq/sim/the-wednesday/sessions/${sessionId}/finish`, payload: {} });
    return { sessionId, start, finish };
  }

  console.log('── scenario stripping ──');
  const probe = await j({ method: 'POST', url: '/api/tiq/sim/the-wednesday/sessions', payload: {} });
  const scen = probe.body.scenario;
  check('start returns a session + scenario', probe.status === 200 && !!probe.body.sessionId && !!scen);
  check('served scenario keeps the scripts (fixed market path drives the tape)', !!scen.scripts && !!scen.scripts.A && !!scen.scripts.B);
  const allOpts = scen.nodes.flatMap((n: any) => [...(n.options || []), ...Object.values(n.option_variants || {}).flat() as any[]]);
  check('served options carry NO decision points (key stripped)', allOpts.every((o: any) => !('points' in o)));
  check('served options keep act + breaks for the tape', allOpts.every((o: any) => 'act' in o || 'variants' in o));

  console.log('\n── path-independence THROUGH THE API — close early, stay flat ──');
  const flat = await runSession(CLOSE_EARLY, 0.7);
  const r = flat.finish.body.result;
  check('finish returns a result across every script', flat.finish.status === 200 && r.scriptCount === 2);
  check('P&L is IDENTICAL across Script A and Script B (exact integer pence)', r.pnl.A === r.pnl.B, `A=${r.pnl.A} B=${r.pnl.B}`);
  check('P&L equals +£135 on both (oracle, via the API)', r.pnl.A === 13500 && r.pnlPounds.A === 135, `pounds=${r.pnlPounds.A}`);
  check('every script survives (account not wiped)', r.survival.survivalShare === 1);
  check('decision score is 50/50 (all best) — so NOT lucky', r.decisionScore === 50 && r.lucky === false);

  console.log('\n── "rescued, not right" — the most important screen ──');
  const reck = await runSession(RECKLESS, 1.0);
  const rr = reck.finish.body.result;
  check('reckless: low decision score (<=50% of max)', rr.decisionScore <= rr.maxScore * 0.5, `score=${rr.decisionScore}`);
  check('reckless: positive P&L on the actual script (A)', rr.pnlPounds.A > 0, `A=${rr.pnlPounds.A}`);
  check('reckless: negative P&L on the other Wednesday (B)', rr.pnlPounds.B < 0, `B=${rr.pnlPounds.B}`);
  check('reckless: "lucky" (rescued, not right) fires', rr.lucky === true);
  check('reckless: over-sure while wrong reads Overconfident', rr.calibration.label === 'Overconfident', rr.calibration.label);

  console.log('\n── append-only + provenance + repeatable, not an assessment attempt ──');
  const refin = await j({ method: 'POST', url: `/api/tiq/sim/the-wednesday/sessions/${flat.sessionId}/finish`, payload: {} });
  check('a finished session cannot be finished again', refin.status === 409);
  const redec = await j({ method: 'POST', url: `/api/tiq/sim/the-wednesday/sessions/${flat.sessionId}/decisions`, payload: { nodeId: 'n1', choiceText: CLOSE_EARLY.n1 } });
  check('a completed session rejects further decisions', redec.status === 409);

  const doc = (await db.collection('tiqSimSessions').doc(flat.sessionId).get()).data();
  check('nested provenance stamped with scenario version', doc.provenance?.verify_verdict === 'deterministic' && doc.provenance?.versions?.scenario === '1.0.0', JSON.stringify(doc.provenance?.versions));

  const sittings = await db.collection('tiqSittings').get();
  check('simulator sessions do NOT create assessment sittings', sittings.size === 0, `sittings=${sittings.size}`);

  console.log('\n── summary ──');
  console.log(`  close-early: A ${r.pnlPounds.A}  B ${r.pnlPounds.B}  score ${r.decisionScore}/${r.maxScore}  survival ${Math.round(r.survival.survivalShare * 100)}%`);
  console.log(`  reckless:    A ${rr.pnlPounds.A}  B ${rr.pnlPounds.B}  score ${rr.decisionScore}/${rr.maxScore}  lucky=${rr.lucky}  ${rr.calibration.label}`);

  await app.close();
  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}

main().catch((err) => { console.error('\nSIM INTEGRATION TEST ERROR:', err); process.exit(1); });
