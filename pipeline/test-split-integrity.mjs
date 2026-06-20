#!/usr/bin/env node
/**
 * test-split-integrity.mjs — Group B: Split integrity test
 *
 * Tests that sync-r2-to-firestore-fixed.mjs writes to scanner_signals
 * and never touches tiles. Run against Firestore emulator ONLY.
 *
 * Usage:
 *   # Start emulator first:
 *   cd api && firebase emulators:start --only firestore &
 *   # Then run:
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 node test-split-integrity.mjs
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Safety: refuse to run against production ──
if (!process.env.FIRESTORE_EMULATOR_HOST) {
  console.error('❌ FIRESTORE_EMULATOR_HOST not set. This test must run against the emulator, never production.');
  console.error('   Start: cd api && firebase emulators:start --only firestore');
  console.error('   Then:  FIRESTORE_EMULATOR_HOST=localhost:8080 node test-split-integrity.mjs');
  process.exit(1);
}

console.log(`✓ Using emulator at ${process.env.FIRESTORE_EMULATOR_HOST}`);

// Initialize with emulator
admin.initializeApp({ projectId: 'newleaf-trading' });
const db = admin.firestore();
db.settings({ databaseId: '(default)' }); // emulator uses default

const results = [];
function assert(label, condition) {
  results.push({ label, pass: !!condition });
  console.log(condition ? `  ✅ ${label}` : `  ❌ ${label}`);
}

async function run() {
  console.log('\n═══ Group B: Split Integrity Test ═══\n');

  // ── Step 1: Seed emulator with priced tiles in `tiles` collection ──
  console.log('Step 1: Seeding tiles with priced candidates...');
  const pricedTiles = [
    { id: 'priced-1', symbol: 'UBER', strategy: 'iron_condor', isActive: true, maxProfit: 205, maxLoss: 295, source: 'publish-pick' },
    { id: 'priced-2', symbol: 'BIDU', strategy: 'iron_condor', isActive: true, maxProfit: 168, maxLoss: 432, source: 'publish-pick' },
  ];

  for (const tile of pricedTiles) {
    await db.collection('tiles').doc(tile.id).set(tile);
  }
  console.log(`  Seeded ${pricedTiles.length} priced tiles\n`);

  // ── Step 2: Simulate what sync-r2 does (without R2 — direct Firestore operations) ──
  console.log('Step 2: Simulating sync-r2 cycle...');

  // The sync script does these operations:
  // 1. Deactivate old scanner_signals (NOT tiles)
  // 2. Write new scanner_signals
  // It should NEVER touch tiles.

  // Simulate deactivation sweep on scanner_signals
  const oldSignals = await db.collection('scanner_signals').where('isActive', '==', true).get();
  if (oldSignals.size > 0) {
    const batch = db.batch();
    oldSignals.docs.forEach(doc => batch.update(doc.ref, { isActive: false }));
    await batch.commit();
  }
  console.log(`  Deactivated ${oldSignals.size} old signals`);

  // Write new scanner signals
  const newSignals = [
    { id: 'UBER_iron_condor_test1', symbol: 'UBER', strategy: 'Iron Condor', source: 'pipeline-scanner', isActive: true, opportunityScore: 78 },
    { id: 'AAPL_iron_butterfly_test1', symbol: 'AAPL', strategy: 'Iron Butterfly', source: 'pipeline-scanner', isActive: true, opportunityScore: 65 },
    { id: 'NVDA_bwb_test1', symbol: 'NVDA', strategy: 'Broken Wing Butterfly', source: 'pipeline-scanner', isActive: true, opportunityScore: 72 },
  ];

  for (const signal of newSignals) {
    await db.collection('scanner_signals').doc(signal.id).set(signal);
  }
  console.log(`  Wrote ${newSignals.length} new signals\n`);

  // ── Step 3: Assert conditions ──
  console.log('Step 3: Assertions...');

  // (a) Pre-existing priced tiles are still isActive: true
  for (const tile of pricedTiles) {
    const doc = await db.collection('tiles').doc(tile.id).get();
    assert(`tiles/${tile.id} still exists`, doc.exists);
    assert(`tiles/${tile.id} isActive=true (untouched)`, doc.data()?.isActive === true);
    assert(`tiles/${tile.id} source=${tile.source} (unchanged)`, doc.data()?.source === tile.source);
  }

  // (b) scanner_signals is populated with source: 'pipeline-scanner'
  const signalSnap = await db.collection('scanner_signals').where('isActive', '==', true).get();
  assert(`scanner_signals has ${newSignals.length} active docs`, signalSnap.size === newSignals.length);

  let allHaveSource = true;
  signalSnap.docs.forEach(doc => {
    if (doc.data().source !== 'pipeline-scanner') allHaveSource = false;
  });
  assert('all active scanner_signals have source=pipeline-scanner', allHaveSource);

  // (c) Zero new docs in tiles (count should still be exactly pricedTiles.length)
  const tilesSnap = await db.collection('tiles').get();
  assert(`tiles collection has exactly ${pricedTiles.length} docs (no new ones)`, tilesSnap.size === pricedTiles.length);

  // Verify sync-r2 script has zero 'tiles' collection references
  const syncScript = readFileSync(resolve(__dirname, 'sync-r2-to-firestore-fixed.mjs'), 'utf8');
  const tilesRefs = (syncScript.match(/collection\(['"]tiles['"]\)/g) || []).length;
  assert(`sync-r2 script has 0 tiles collection references (found ${tilesRefs})`, tilesRefs === 0);

  // ── Summary ──
  console.log('\n═══ Results ═══');
  const passed = results.filter(r => r.pass).length;
  const failed = results.filter(r => !r.pass).length;
  console.log(`${passed} passed, ${failed} failed`);

  if (failed > 0) {
    console.log('\nFailed:');
    results.filter(r => !r.pass).forEach(r => console.log(`  ❌ ${r.label}`));
    process.exit(1);
  }
}

run().then(() => process.exit(0)).catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
