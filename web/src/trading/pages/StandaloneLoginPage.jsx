import { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { LoginPage } from '../components/LoginPage';
import { signInWithGoogle, auth } from '../../firebase/config';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, doc, setDoc, serverTimestamp } from 'firebase/firestore';

export function StandaloneLoginPage({ defaultMode = 'login' }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const redirect = params.get('redirect') || '/invest';

  // If already logged in, redirect
  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      if (user) {
        // Ensure user doc exists in Firestore
        const db = getFirestore(undefined, 'newleafdb');
        setDoc(doc(db, 'users', user.uid), {
          email: user.email,
          displayName: user.displayName || '',
          photoURL: user.photoURL || '',
          lastLoginAt: serverTimestamp(),
        }, { merge: true }).catch(() => {});
        navigate(redirect, { replace: true });
      }
    });
  }, [navigate, redirect]);

  return (
    <LoginPage
      defaultMode={defaultMode}
      onSignInWithGoogle={signInWithGoogle}
      onSignInWithEmail={(email, password) => signInWithEmailAndPassword(auth, email, password)}
      onSignUp={(email, password) => createUserWithEmailAndPassword(auth, email, password)}
    />
  );
}
