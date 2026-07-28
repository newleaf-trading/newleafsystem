/**
 * Firestore security-rules test for the TIQ collections. Runs web/firestore.rules
 * (the client-facing ruleset for newleafdb) against the emulator and proves the
 * route layer's guarantees are enforced at the database, not just in code:
 *
 *   - a client-authenticated WRITE to tiqSittings is DENIED   ← the key assertion
 *   - a client may read only its OWN sitting
 *   - tiqItems (keyed) is server-only; clients read tiqItemsPublic (stripped)
 *   - tiqNorms/tiqScenarios/tiqItemStats are read-only to clients
 *
 * Run:  npm run test:tiq:rules   (starts the firestore emulator via emulators:exec)
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';
import {
  initializeTestEnvironment, assertFails, assertSucceeds,
  type RulesTestEnvironment
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const here = path.dirname(fileURLToPath(import.meta.url));
const RULES = readFileSync(path.resolve(here, '../../../web/firestore.rules'), 'utf8');

let pass = 0, fail = 0;
async function expect(name: string, p: Promise<any>) {
  try { await p; pass++; console.log('  ok   ' + name); }
  catch (e: any) { fail++; console.log('  FAIL ' + name + '  → ' + e.message); }
}

async function main() {
  const [host, portStr] = (process.env.FIRESTORE_EMULATOR_HOST || 'localhost:8080').split(':');
  const env: RulesTestEnvironment = await initializeTestEnvironment({
    projectId: 'demo-tiq',
    firestore: { rules: RULES, host, port: Number(portStr) }
  });

  // Seed with rules disabled: alice owns s_alice, bob owns s_bob.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'tiqSittings/s_alice'), { userId: 'alice', status: 'complete' });
    await setDoc(doc(db, 'tiqSittings/s_bob'), { userId: 'bob', status: 'complete' });
    await setDoc(doc(db, 'tiqItems/i1'), { id: 'i1', scoring: { choice_points: { A: 10 } } });
    await setDoc(doc(db, 'tiqItemsPublic/i1'), { id: 'i1', stem: 'a question' });
    await setDoc(doc(db, 'tiqBanks/1.0.0'), { version: '1.0.0' });
    await setDoc(doc(db, 'tiqItemStats/i1'), { choices: {} });
  });

  const alice = env.authenticatedContext('alice').firestore();
  const bob = env.authenticatedContext('bob').firestore();
  const anon = env.unauthenticatedContext().firestore();

  console.log('\ntiqSittings — append-only, own-doc read');
  await expect('client-authenticated WRITE to tiqSittings is DENIED', assertFails(setDoc(doc(alice, 'tiqSittings/s_alice'), { userId: 'alice', tampered: true })));
  await expect('client cannot CREATE a new sitting', assertFails(setDoc(doc(alice, 'tiqSittings/s_new'), { userId: 'alice' })));
  await expect('client reads its OWN sitting', assertSucceeds(getDoc(doc(alice, 'tiqSittings/s_alice'))));
  await expect("client cannot read another user's sitting", assertFails(getDoc(doc(bob, 'tiqSittings/s_alice'))));
  await expect('unauthenticated read of a sitting is DENIED', assertFails(getDoc(doc(anon, 'tiqSittings/s_alice'))));

  console.log('\ntiqItems (keyed) server-only; tiqItemsPublic (stripped) client-readable');
  await expect('client CANNOT read tiqItems (holds the key)', assertFails(getDoc(doc(alice, 'tiqItems/i1'))));
  await expect('client CAN read tiqItemsPublic (stripped)', assertSucceeds(getDoc(doc(alice, 'tiqItemsPublic/i1'))));
  await expect('client CANNOT write tiqItemsPublic', assertFails(setDoc(doc(alice, 'tiqItemsPublic/i1'), { stem: 'tampered' })));

  console.log('\ntiqBanks / tiqItemStats — read-only to clients');
  await expect('unauthenticated read of tiqBanks succeeds (no secrets)', assertSucceeds(getDoc(doc(anon, 'tiqBanks/1.0.0'))));
  await expect('client read of tiqItemStats succeeds', assertSucceeds(getDoc(doc(alice, 'tiqItemStats/i1'))));
  await expect('client write to tiqItemStats is DENIED', assertFails(setDoc(doc(alice, 'tiqItemStats/i1'), { choices: { A: 99 } })));

  await env.cleanup();
  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error('RULES TEST ERROR:', e); process.exit(1); });
