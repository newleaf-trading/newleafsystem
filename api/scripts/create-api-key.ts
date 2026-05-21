/**
 * CLI script to create API keys in Firestore.
 * Usage: npx tsx scripts/create-api-key.ts --name "my-service" --role premium --owner "service-id"
 */
import 'dotenv/config';
import { randomUUID } from 'crypto';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const args = process.argv.slice(2);
function getArg(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  return idx >= 0 ? args[idx + 1] : undefined;
}

const name = getArg('--name');
const role = getArg('--role') ?? 'basic';
const ownerId = getArg('--owner') ?? 'cli';

if (!name) {
  console.error('Usage: tsx scripts/create-api-key.ts --name <name> [--role free|basic|premium|admin] [--owner <id>]');
  process.exit(1);
}

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (projectId && clientEmail && privateKey) {
  initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
} else {
  initializeApp();
}

const db = getFirestore();
const key = `nl_${randomUUID().replace(/-/g, '')}`;
const doc = db.collection('apiKeys').doc();

await doc.set({
  key,
  name,
  role,
  ownerId,
  active: true,
  createdAt: new Date(),
  lastUsedAt: null,
  requestCount: 0,
});

console.log(`API key created successfully:`);
console.log(`  ID:    ${doc.id}`);
console.log(`  Key:   ${key}`);
console.log(`  Name:  ${name}`);
console.log(`  Role:  ${role}`);
console.log(`  Owner: ${ownerId}`);
console.log(`\nStore this key securely — it won't be shown again.`);
process.exit(0);
