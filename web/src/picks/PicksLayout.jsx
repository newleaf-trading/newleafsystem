import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { BrandBar } from '../shared/components/BrandBar';
import { useAuth } from '../shared/hooks/useAuth';

function ContentSkeleton() {
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '48px 2rem' }}>
      <div style={{ height: 12, width: 120, background: 'rgba(15,61,46,.06)', borderRadius: 4, marginBottom: 16 }} />
      <div style={{ height: 28, width: 320, background: 'rgba(15,61,46,.08)', borderRadius: 6, marginBottom: 12 }} />
      <div style={{ height: 14, width: 240, background: 'rgba(15,61,46,.05)', borderRadius: 4 }} />
    </div>
  );
}

export default function PicksLayout() {
  const { user, signOut, signInWithGoogle } = useAuth();

  return (
    <div style={{ minHeight: '100vh', background: '#F7F5F0' }}>
      <BrandBar
        surface="picks"
        authState={user ? 'in' : 'out'}
        user={user}
        onSignOut={signOut}
        onSignIn={signInWithGoogle}
      />
      <Suspense fallback={<ContentSkeleton />}>
        <Outlet />
      </Suspense>
      <footer style={{
        borderTop: '1px solid rgba(15,61,46,.08)',
        padding: '24px 2rem',
        textAlign: 'center',
        fontSize: 12,
        color: '#6b6b60',
        fontFamily: "'Inter', sans-serif",
      }}>
        NewLeaf System &mdash; Options intelligence platform. Past performance does not guarantee future results.
      </footer>
    </div>
  );
}
