import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { BrandBar } from '../shared/components/BrandBar';
import { useAuth } from '../shared/hooks/useAuth';
import { Footer } from '../trading/components/Footer';

export default function BlogLayout() {
  const { user, signOut, signInWithGoogle } = useAuth();

  return (
    <div style={{ minHeight: '100vh', background: '#ffffff' }}>
      <BrandBar
        surface="root"
        authState={user ? 'in' : 'out'}
        user={user}
        onSignOut={signOut}
        onSignIn={signInWithGoogle}
      />
      <Suspense fallback={<div style={{ minHeight: 400 }} />}>
        <Outlet />
      </Suspense>
      <Footer />
    </div>
  );
}
