#!/usr/bin/env node
'use strict';

/**
 * Seed the TIQ Firestore mirror from the source of truth in content/tiq/.
 * content/tiq/*.json is authoritative; Firestore is a seeded mirror (see
 * docs/tiq/TIQ-BUILD.md). Never hand-edit items in the console — edit the JSON
 * and re-seed. Idempotent: documents are set by id.
 *
 *   node scripts/tiq/seed-firestore.js                 # → newleafdb (or TIQ_FIRESTORE_DB)
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 \
 *     GCLOUD_PROJECT=demo-newleaf TIQ_FIRESTORE_DB='(default)' \
 *     node scripts/tiq/seed-firestore.js               # → emulator
 *
 * Exports seed(db) so the integration test can seed the emulator in-process.
 */

const path = require('path');

const TIQ = require(path.resolve(__dirname, '..', '..', 'shared', 'tiq', 'index.js'));
const BANK = require(path.resolve(__dirname, '..', '..', 'content', 'tiq', 'bank-v1.json'));

const DB_ID = process.env.TIQ_FIRESTORE_DB || 'newleafdb';

// firebase-admin lives in api/node_modules; this script sits at the repo root
// where there is no node_modules, so fall back to the api install explicitly.
function requireAdmin() {
  try { return require('firebase-admin'); }
  catch { return require(path.resolve(__dirname, '..', '..', 'api', 'node_modules', 'firebase-admin')); }
}

function dbHandle() {
  const admin = requireAdmin();
  if (!admin.apps.length) {
    admin.initializeApp({ projectId: process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'demo-newleaf' });
  }
  return DB_ID && DB_ID !== '(default)' ? admin.firestore(undefined, DB_ID) : admin.firestore();
}

async function seed(db) {
  const provenance = TIQ.provenance({
    timestamp: new Date().toISOString(),
    commitSha: process.env.COMMIT_SHA || null,
    bankVersion: BANK.version,
    normVersion: null,
    scenarioVersion: null
  });

  // Bank metadata (trait vocabulary, category weights) as one doc per version.
  await db.collection('tiqBanks').doc(BANK.version).set({
    version: BANK.version,
    bank_id: BANK.bank_id,
    trait_vocabulary: BANK.trait_vocabulary,
    categories: BANK.categories,
    scale: BANK.scale,
    seededAtISO: new Date().toISOString(),
    provenance
  });

  // Items — full mirror (server-only, carries the key) AND a stripped public
  // projection (tiqItemsPublic) that clients may read directly. Firestore rules
  // cannot strip fields on read, so the projection is how "read the stripped
  // fields only" is enforced (see web/firestore.rules).
  let batch = db.batch();
  let n = 0;
  for (const item of BANK.questions) {
    batch.set(db.collection('tiqItems').doc(item.id), {
      ...item,
      bank_version: BANK.version,
      active: true,
      provenance
    });
    batch.set(db.collection('tiqItemsPublic').doc(item.id), {
      ...stripForPublic(item),
      bank_version: BANK.version,
      active: true
    });
    if (++n % 200 === 0) { await batch.commit(); batch = db.batch(); }
  }
  await batch.commit();
  return { bank_version: BANK.version, items: BANK.questions.length };
}

/** The client-safe view of an item — no key, no scoring block, no explanation. */
function stripForPublic(item) {
  return {
    id: item.id,
    category: item.category,
    subskill: item.subskill,
    difficulty: item.difficulty,
    type: item.type,
    scenario: item.scenario ?? null,
    stem: item.stem,
    choices: (item.choices || []).map((c) => ({ key: c.key, text: c.text })),
    mode: item.scoring ? item.scoring.mode : null,
    est_seconds: item.est_seconds ?? null
    // omitted: scoring, explanation, learning_objective, bias, tags, generator, pair_id, pair_role
  };
}

module.exports = { seed, dbHandle };

if (require.main === module) {
  (async () => {
    try {
      const res = await seed(dbHandle());
      console.log(`Seeded tiqBanks/${res.bank_version} + ${res.items} tiqItems into "${DB_ID}".`);
      process.exit(0);
    } catch (err) {
      console.error('Seed failed:', err.message);
      process.exit(1);
    }
  })();
}
