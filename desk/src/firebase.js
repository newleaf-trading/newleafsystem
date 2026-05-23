import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as fbSignOut } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyBHOeCWF_Z-xATalX911Q_0isAKsJzHpwk",
  authDomain: "newleaf-trading.firebaseapp.com",
  projectId: "newleaf-trading",
  storageBucket: "newleaf-trading.firebasestorage.app",
  messagingSenderId: "240392819045",
  appId: "1:240392819045:web:a1dc19e5dcfa29e6cdd18c",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, 'newleafdb');
export const auth = getAuth(app);

export async function signInWithGoogle() {
  return signInWithPopup(auth, new GoogleAuthProvider());
}

export async function signOut() {
  return fbSignOut(auth);
}
