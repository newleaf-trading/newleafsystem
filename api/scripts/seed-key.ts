import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { randomUUID } from 'crypto';

async function main() {
  initializeApp({ credential: applicationDefault(), projectId: 'newleaf-trading' });
  const db = getFirestore();

  const key = 'nl_' + randomUUID().replace(/-/g, '');
  const doc = db.collection('apiKeys').doc();
  await doc.set({
    key,
    name: 'newleaf-desk-prod',
    role: 'admin',
    ownerId: 'manish',
    active: true,
    createdAt: new Date(),
    lastUsedAt: null,
    requestCount: 0,
  });
  console.log('Key:', key);
  console.log('Doc:', doc.id);
  process.exit(0);
}
main();
