#!/usr/bin/env node
'use strict';

/**
 * Reliability report for the TIQ bank. Reads completed tiqSittings and computes,
 * per category: Cronbach's alpha and the corrected item-total correlation per
 * item. The maths is the pure module shared/tiq/reliability.js; this file only
 * does the Firestore read.
 *
 *   node scripts/tiq/reliability.js                 # → newleafdb (or TIQ_FIRESTORE_DB)
 *
 * This is the number that decides whether the bank is sound enough to attach
 * percentiles to. ALPHA BELOW 0.70 IN A CATEGORY = add items to that category
 * before turning on empirical norms — a content decision, not a code change
 * (spec-norms §1.2, docs/tiq/OPEN-ITEMS.md). Needs a real cohort; prints a notice
 * and exits cleanly when there is too little data.
 */

const path = require('path');
const R = require(path.resolve(__dirname, '..', '..', 'shared', 'tiq', 'reliability.js'));
const BANK = require(path.resolve(__dirname, '..', '..', 'content', 'tiq', 'bank-v1.json'));

const DB_ID = process.env.TIQ_FIRESTORE_DB || 'newleafdb';
const MIN_N = 30; // below this, alpha is noise (spec-norms §1.2)

function requireAdmin() {
  try { return require('firebase-admin'); }
  catch { return require(path.resolve(__dirname, '..', '..', 'api', 'node_modules', 'firebase-admin')); }
}
function requireAdminFirestore() {
  try { return require('firebase-admin/firestore'); }
  catch { return require(path.resolve(__dirname, '..', '..', 'api', 'node_modules', 'firebase-admin', 'lib', 'firestore')); }
}
function dbHandle() {
  const admin = requireAdmin();
  if (!admin.apps.length) admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'demo-newleaf' });
  // Modular getFirestore is named-database aware; namespaced admin.firestore(app, id)
  // is not and would read (default) instead of newleafdb.
  const { getFirestore } = requireAdminFirestore();
  return (DB_ID && DB_ID !== '(default)') ? getFirestore(DB_ID) : getFirestore();
}

async function run(db) {
  const bankVersion = BANK.version;
  const catItems = {}; // category -> [itemId] in a stable order
  for (const q of BANK.questions) (catItems[q.category] ||= []).push(q.id);

  const snap = await db.collection('tiqSittings')
    .where('status', '==', 'complete')
    .where('bank_version', '==', bankVersion)
    .get();
  const sittings = snap.docs.map((d) => d.data());

  console.log(`\nReliability — bank ${bankVersion} · ${sittings.length} completed sitting(s)\n`);
  if (sittings.length < MIN_N) {
    console.log(`  Too few sittings (need >= ${MIN_N}). Alpha would be noise — skipping.`);
    console.log('  This is expected until a real cohort exists (see docs/tiq/OPEN-ITEMS.md).\n');
    return { ready: false };
  }

  const report = {};
  for (const [cat, items] of Object.entries(catItems)) {
    // rows = sittings that answered every item in the category (complete matrix)
    const matrix = [];
    for (const s of sittings) {
      const row = items.map((id) => s.responses && s.responses[id] && s.responses[id].earned);
      if (row.every((v) => Number.isFinite(v))) matrix.push(row);
    }
    const alpha = R.cronbachAlpha(matrix);
    const itc = R.itemTotalCorrelations(matrix);
    const flag = alpha != null && alpha < 0.70 ? '  ⚠ below 0.70 — add items before norming this category' : '';
    console.log(`${cat}: n=${matrix.length} k=${items.length} alpha=${alpha == null ? 'n/a' : alpha}${flag}`);
    items.forEach((id, j) => console.log(`    ${id}  r_it=${itc[j] == null ? 'n/a' : itc[j]}`));
    console.log('');
    report[cat] = { n: matrix.length, k: items.length, alpha, itemTotal: itc };
  }
  return { ready: true, report };
}

module.exports = { run };

if (require.main === module) {
  (async () => {
    try { await run(dbHandle()); process.exit(0); }
    catch (e) { console.error('reliability failed:', e.message); process.exit(1); }
  })();
}
