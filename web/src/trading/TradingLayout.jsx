import { useState, useCallback } from 'react';
import { Routes, Route, Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../shared/hooks/useAuth';
import { useTiles } from './hooks/useTiles';
import { PriceProvider } from './contexts/PriceContext';
import { BrandBar } from '../shared/components/BrandBar';
import { Footer } from './components/Footer';
import { VoiceAssistant } from './components/VoiceAssistant';
import { AIChatDrawer } from './components/AIChatDrawer';
import { InvestPage } from '../marketing/invest/InvestPage';

// Auth-gated pages
import { DashboardPage } from './pages/DashboardPage';
import { DiscoverPageNew as DiscoverPage } from './pages/DiscoverPageNew';
import { PerformancePageNew as PerformancePage } from './pages/PerformancePageNew';
import { AdminPage } from './pages/AdminPage';
import { AnalysisPage } from './pages/AnalysisPage';

// Phase 2 — new pages
import { StrategyDetailPage } from './pages/StrategyDetailPage';
import { BuildPage } from './pages/BuildPage';
import { PositionsPage } from './pages/PositionsPage';

// Phase 3 — Invest rebuild (status-routed detail views)
import { StrategyRouter } from './pages/StrategyRouter';
import { DashboardPageNew } from './pages/DashboardPageNew';
import { PositionsPageNew } from './pages/PositionsPageNew';
import { PerformancePageRebuild } from './pages/PerformancePageRebuild';
import { BuildPageNew } from './pages/BuildPageNew';
import ProjectionPage from './pages/ProjectionPage';
import { PlansPage } from './pages/PlansPage';
import { ActivePlanDetailPage } from './pages/ActivePlanDetailPage';

// Redirect helper for /invest/position/:tileId → /invest/strategy/:tileId
function PositionRedirect() {
  const { tileId } = useParams();
  return <Navigate to={`/invest/strategy/${tileId}`} replace />;
}

export default function TradingLayout() {
  const { user, loading: authLoading, signInWithGoogle, signInWithEmail, signUp, signOut } = useAuth();
  const { tiles, loading: tilesLoading, error } = useTiles();

  // AI Chat drawer state
  const [chatOpen, setChatOpen] = useState(false);
  const [chatInitialMessage, setChatInitialMessage] = useState(null);

  const openChat = useCallback((message = null) => {
    setChatInitialMessage(message);
    setChatOpen(true);
  }, []);

  const closeChat = useCallback(() => {
    setChatOpen(false);
    setChatInitialMessage(null);
  }, []);

  if (authLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">&#127811;</div>
        <p className="loading-text">Loading NewLeaf System...</p>
      </div>
    );
  }

  // Not logged in → show BrandBar in invest-logged-out mode + InvestPage
  if (!user) {
    return (
      <div style={{ minHeight: '100vh', background: '#F7F5F0' }}>
        <BrandBar
          surface="invest"
          authState="out"
          onSignIn={signInWithGoogle}
        />
        <InvestPage
          onSignInWithGoogle={signInWithGoogle}
          onSignInWithEmail={signInWithEmail}
          onSignUp={signUp}
        />
      </div>
    );
  }

  if (tilesLoading) {
    return (
      <div className="loading-container">
        <div className="loading-spinner">&#127811;</div>
        <p className="loading-text">Loading opportunities...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="loading-container">
        <h2 style={{ fontSize: '1.875rem', fontWeight: '700', color: '#dc2626', marginBottom: '1rem' }}>
          Error Loading Tiles
        </h2>
        <p style={{ fontSize: '1.125rem', color: '#111827', marginBottom: '0.5rem' }}>{error}</p>
        <button
          onClick={signOut}
          style={{
            marginTop: '1rem', padding: '0.75rem 1.5rem',
            background: '#15803d', color: '#ffffff', border: 'none',
            borderRadius: '0.5rem', fontSize: '0.875rem', fontWeight: '600', cursor: 'pointer'
          }}
        >
          Sign Out
        </button>
      </div>
    );
  }

  return (
    <PriceProvider>
      <div style={{ minHeight: '100vh', background: '#ffffff' }}>
        <BrandBar
          surface="invest"
          authState="in"
          user={user}
          onSignOut={signOut}
          onSignIn={signInWithGoogle}
          onOpenChat={openChat}
        />

        <Routes>
          {/* ═══ Core routes — Phase 3 rebuild ═══ */}
          <Route path="/" element={<DashboardPageNew user={user} tiles={tiles} onOpenChat={openChat} />} />
          <Route path="/discover" element={<DiscoverPage tiles={tiles} />} />
          <Route path="/strategy/:id" element={<StrategyRouter tiles={tiles} onOpenChat={openChat} />} />
          <Route path="/build" element={<BuildPageNew tiles={tiles} />} />
          <Route path="/defend" element={<PositionsPageNew tiles={tiles} onOpenChat={openChat} />} />
          <Route path="/performance" element={<PerformancePageRebuild tiles={tiles} />} />
          <Route path="/projection" element={<ProjectionPage mode="investor" />} />
          <Route path="/plans" element={<PlansPage />} />
          <Route path="/plans/active" element={<ActivePlanDetailPage />} />

          {/* ═══ Utility routes ═══ */}
          <Route path="/analysis/:ticker" element={<AnalysisPage />} />
          <Route path="/analysis" element={<AnalysisPage />} />
          <Route path="/admin" element={<AdminPage />} />

          {/* ═══ Legacy routes — keep working, redirect to new paths ═══ */}
          <Route path="/positions" element={<Navigate to="/invest/defend" replace />} />
          <Route path="/portfolio" element={<Navigate to="/invest/defend" replace />} />
          <Route path="/position/:tileId" element={<PositionRedirect />} />

          {/* Legacy PositionDetail retired in Phase 6c — all traffic goes to /strategy/:id */}
        </Routes>

        <Footer />
        <VoiceAssistant tiles={tiles} />
        <AIChatDrawer
          isOpen={chatOpen}
          onClose={closeChat}
          tiles={tiles}
          initialMessage={chatInitialMessage}
        />
      </div>
    </PriceProvider>
  );
}
