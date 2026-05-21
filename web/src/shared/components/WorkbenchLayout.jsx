/**
 * WorkbenchLayout — layout shell for React pages under /workbench/*
 *
 * Previously loaded nav-component.html via fetch and injected it.
 * Now uses BrandBar directly. The static workbench HTML pages still
 * load nav-component.html themselves.
 */
import { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { BrandBar } from './BrandBar';
import { useAuth } from '../hooks/useAuth';

export default function WorkbenchLayout() {
  const { user, signOut, signInWithGoogle } = useAuth();

  return (
    <div style={{ minHeight: '100vh', background: '#ffffff' }}>
      <BrandBar
        surface="workbench"
        authState={user ? 'in' : 'out'}
        user={user}
        onSignOut={signOut}
        onSignIn={signInWithGoogle}
      />
      <Suspense fallback={<div style={{ minHeight: 400 }} />}>
        <Outlet />
      </Suspense>
    </div>
  );
}
