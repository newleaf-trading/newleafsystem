import { initializeApp, getApps, cert, type App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

let app: App | undefined;

export function initFirebase(): App {
  if (app) return app;
  if (getApps().length > 0) {
    app = getApps()[0];
    return app;
  }

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    app = initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  } else {
    // Default credentials (works in Cloud Functions or with GOOGLE_APPLICATION_CREDENTIALS)
    app = initializeApp();
  }

  // Allow undefined values in Firestore writes (agent payloads may have optional fields)
  getFirestore().settings({ ignoreUndefinedProperties: true });
  getFirestore('newleafdb').settings({ ignoreUndefinedProperties: true });

  return app;
}
