import { useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, setDoc, serverTimestamp, getDoc } from 'firebase/firestore';
import { auth, db } from '../../firebase/config';

/**
 * Authentication hook with Google and Email/Password support
 * Automatically creates/updates user profile documents in Firestore
 * @returns {Object} { user, loading, signInWithGoogle, signInWithEmail, signUp, signOut }
 */
export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Create or update user profile document in Firestore
  const createOrUpdateUserProfile = async (currentUser) => {
    if (!currentUser) return;

    try {
      const userRef = doc(db, 'users', currentUser.uid);
      const userDoc = await getDoc(userRef);

      if (!userDoc.exists()) {
        // Create new user profile document
        await setDoc(userRef, {
          email: currentUser.email,
          displayName: currentUser.displayName || currentUser.email?.split('@')[0] || 'User',
          photoURL: currentUser.photoURL || null,
          createdAt: serverTimestamp(),
          lastLogin: serverTimestamp(),
        });
        console.log('Created user profile document for', currentUser.email);
      } else {
        // Update last login time
        await setDoc(userRef, {
          lastLogin: serverTimestamp(),
        }, { merge: true });
        console.log('Updated last login for', currentUser.email);
      }
    } catch (error) {
      console.error('Error creating/updating user profile:', error);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);

      // Create or update user profile in Firestore
      if (currentUser) {
        await createOrUpdateUserProfile(currentUser);
      }

      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (error) {
      console.error('Error signing in with Google:', error);
      throw error;
    }
  };

  const signInWithEmail = async (email, password) => {
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Error signing in with email:', error);
      throw error;
    }
  };

  const signUp = async (email, password) => {
    try {
      await createUserWithEmailAndPassword(auth, email, password);
    } catch (error) {
      console.error('Error signing up:', error);
      throw error;
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
      throw error;
    }
  };

  return { user, loading, signInWithGoogle, signInWithEmail, signUp, signOut };
}
