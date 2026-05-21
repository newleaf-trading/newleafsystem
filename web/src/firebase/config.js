// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as fbSignOut } from "firebase/auth";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";
import { getAI, GoogleAIBackend } from "firebase/ai";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBHOeCWF_Z-xATalX911Q_0isAKsJzHpwk",
  authDomain: "newleaf-trading.firebaseapp.com",
  projectId: "newleaf-trading",
  storageBucket: "newleaf-trading.firebasestorage.app",
  messagingSenderId: "240392819045",
  appId: "1:240392819045:web:a1dc19e5dcfa29e6cdd18c",
  measurementId: "G-06YFVHFNYT"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;

// Initialize Firestore with the named database "newleafdb"
export const db = getFirestore(app, 'newleafdb');

// Initialize Firebase Authentication
export const auth = getAuth(app);

// Initialize Cloud Functions
export const functions = getFunctions(app);

// Use emulator for local development (uncomment to enable)
// if (window.location.hostname === 'localhost') {
//   connectFunctionsEmulator(functions, 'localhost', 5001);
// }

// Initialize Firebase AI Logic (Gemini Developer API)
export const ai = typeof window !== 'undefined' ? getAI(app, { backend: new GoogleAIBackend() }) : null;


// Auth helpers (used by WorkbenchLayout)
export async function signInWithGoogle() {
  const provider = new GoogleAuthProvider();
  return signInWithPopup(auth, provider);
}

export async function signOut() {
  return fbSignOut(auth);
}

// Export app instance
export { app };
