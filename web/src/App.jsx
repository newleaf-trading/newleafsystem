import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './shared/hooks/useAuth';
import { BrandBar } from './shared/components/BrandBar';

// Lightweight layout shells — loaded eagerly (tiny)
import PublicLayout from './trading/PublicLayout';
import WorkbenchLayout from './shared/components/WorkbenchLayout';
import PicksLayout from './picks/PicksLayout';

// Loading skeleton — shows nav immediately, content fades in
function PageSkeleton() {
  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '48px 2rem' }}>
      <div style={{ height: 12, width: 120, background: 'rgba(15,61,46,.06)', borderRadius: 4, marginBottom: 16 }} />
      <div style={{ height: 28, width: 320, background: 'rgba(15,61,46,.08)', borderRadius: 6, marginBottom: 12 }} />
      <div style={{ height: 14, width: 240, background: 'rgba(15,61,46,.05)', borderRadius: 4, marginBottom: 32 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14 }}>
        {[1,2,3,4].map(i => (
          <div key={i} style={{ height: 80, background: 'rgba(15,61,46,.04)', borderRadius: 12, border: '1px solid rgba(15,61,46,.06)' }} />
        ))}
      </div>
    </div>
  );
}

// Lazy-loaded route components
const LandingPage = lazy(() => import('./trading/pages/LandingPageV7').then(m => ({ default: m.LandingPageV7 })));
const LearnPage = lazy(() => import('./trading/pages/LearnPage').then(m => ({ default: m.LearnPage })));
const TradingLayout = lazy(() => import('./trading/TradingLayout'));
const WorkbenchAnalysisWrapper = lazy(() => import('./shared/components/WorkbenchAnalysisWrapper'));
const ProjectionPage = lazy(() => import('./trading/pages/ProjectionPage'));

// Marketing pages — lazy
const HowWePickPage = lazy(() => import('./marketing/how-we-pick/HowWePickPage').then(m => ({ default: m.HowWePickPage })));
const HowWeManagePage = lazy(() => import('./marketing/how-we-manage/HowWeManagePage').then(m => ({ default: m.HowWeManagePage })));
const HowWeRecommendPage = lazy(() => import('./marketing/how-we-recommend/HowWeRecommendPage').then(m => ({ default: m.HowWeRecommendPage })));
const TrackRecordPage = lazy(() => import('./marketing/track-record/TrackRecordPage').then(m => ({ default: m.TrackRecordPage })));
const AboutPage = lazy(() => import('./marketing/about/AboutPage').then(m => ({ default: m.AboutPage })));

// Instinct Quiz — public acquisition front door (no auth, no tier)
const InstinctPage = lazy(() => import('./instinct/InstinctPage'));

// Documentation pages — lazy
const ScoringAlgorithmPage = lazy(() => import('./marketing/scoring-algorithm/ScoringAlgorithmPage').then(m => ({ default: m.ScoringAlgorithmPage })));
const ProbabilityEnginePage = lazy(() => import('./marketing/probability-engine/ProbabilityEnginePage').then(m => ({ default: m.ProbabilityEnginePage })));
const StrategySelectionPage = lazy(() => import('./marketing/strategy-selection/StrategySelectionPage').then(m => ({ default: m.StrategySelectionPage })));
const TechnicalAnalysisPage = lazy(() => import('./marketing/technical-analysis/TechnicalAnalysisPage').then(m => ({ default: m.TechnicalAnalysisPage })));
const GammaAnalysisPage = lazy(() => import('./marketing/gamma-analysis/GammaAnalysisPage').then(m => ({ default: m.GammaAnalysisPage })));
const AISentimentPage = lazy(() => import('./marketing/ai-sentiment/AISentimentPage').then(m => ({ default: m.AISentimentPage })));
const AIPortfolioPage = lazy(() => import('./marketing/ai-portfolio/AIPortfolioPage').then(m => ({ default: m.AIPortfolioPage })));
const VerificationDeskPage = lazy(() => import('./marketing/verification-desk/VerificationDeskPage').then(m => ({ default: m.VerificationDeskPage })));

// Picks — lazy
const PicksPage = lazy(() => import('./picks/PicksPage'));
const RecapPage = lazy(() => import('./picks/RecapPage'));
const MonthlyPage = lazy(() => import('./picks/MonthlyPage'));
const WeekViewerPage = lazy(() => import('./picks/WeekViewerPage'));
const PickAnalysisPage = lazy(() => import('./picks/PickAnalysisPage'));

// Auth pages — lazy
const StandaloneLoginPage = lazy(() => import('./trading/pages/StandaloneLoginPage').then(m => ({ default: m.StandaloneLoginPage })));

// Product pages — lazy
const DeskPage = lazy(() => import('./trading/pages/DeskPage'));
const QuantPage = lazy(() => import('./trading/pages/QuantPage'));
const PricingPage = lazy(() => import('./trading/pages/PricingPage'));

// Blog — lazy
const BlogLayout = lazy(() => import('./blog/BlogLayout'));
const BlogIndexPage = lazy(() => import('./blog/BlogIndexPage'));
const BlogPostLayout = lazy(() => import('./blog/BlogPostLayout'));
const NotFoundPage = lazy(() => import('./shared/components/NotFoundPage'));

// Strategy skill pages — lazy (rarely visited)
const IronCondorSkill = lazy(() => import('./trading/pages/strategies/IronCondorSkill'));
const DoubleDiagonalSkill = lazy(() => import('./trading/pages/strategies/DoubleDiagonalSkill'));
const BullPutSpreadSkill = lazy(() => import('./trading/pages/strategies/BullPutSpreadSkill'));
const BearPutSpreadSkill = lazy(() => import('./trading/pages/strategies/BearPutSpreadSkill'));
const CoveredCallProtPutSkill = lazy(() => import('./trading/pages/strategies/CoveredCallProtPutSkill'));
const CalendarSpreadSkill = lazy(() => import('./trading/pages/strategies/CalendarSpreadSkill'));
const StraddleStrangleSkill = lazy(() => import('./trading/pages/strategies/StraddleStrangleSkill'));
const ButterflySkill = lazy(() => import('./trading/pages/strategies/ButterflySkill'));
const CollarSkill = lazy(() => import('./trading/pages/strategies/CollarSkill'));
const JadeLizardSkill = lazy(() => import('./trading/pages/strategies/JadeLizardSkill'));

// Landing page wrapper
function LandingWithAuth() {
  const { signInWithGoogle, signInWithEmail, signUp } = useAuth();
  return (
    <Suspense fallback={<PageSkeleton />}>
      <LandingPage
        onSignInWithGoogle={signInWithGoogle}
        onSignInWithEmail={signInWithEmail}
        onSignUp={signUp}
      />
    </Suspense>
  );
}

export default function App() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#F7F5F0' }}><BrandBar surface="root" /><PageSkeleton /></div>}>
      <Routes>
        {/* ═══ PUBLIC PAGES ═══ */}
        <Route path="/" element={<LandingWithAuth />} />
        <Route element={<PublicLayout />}>
          <Route path="/learn" element={<LearnPage />} />
        </Route>

        {/* Marketing / visualisation pages — public, with main nav */}
        <Route element={<PublicLayout />}>
          <Route path="/how-we-pick" element={<HowWePickPage />} />
          <Route path="/how-we-manage" element={<HowWeManagePage />} />
          <Route path="/how-we-recommend" element={<HowWeRecommendPage />} />
          <Route path="/track-record" element={<TrackRecordPage />} />
          <Route path="/how-we-score" element={<ScoringAlgorithmPage />} />
          <Route path="/probability-engine" element={<ProbabilityEnginePage />} />
          <Route path="/strategy-selection" element={<StrategySelectionPage />} />
          <Route path="/technical-analysis" element={<TechnicalAnalysisPage />} />
          <Route path="/gamma-analysis" element={<GammaAnalysisPage />} />
          <Route path="/ai-sentiment" element={<AISentimentPage />} />
          <Route path="/ai-portfolio" element={<AIPortfolioPage />} />
          <Route path="/verification-desk" element={<VerificationDeskPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/instinct" element={<InstinctPage />} />
        </Route>

        {/* Product pages */}
        <Route element={<PublicLayout />}>
          <Route path="/desk" element={<DeskPage />} />
          <Route path="/quant" element={<QuantPage />} />
          <Route path="/pricing" element={<PricingPage />} />
        </Route>

        {/* Strategy skill pages */}
        <Route path="/strategies/iron-condor" element={<IronCondorSkill />} />
        <Route path="/strategies/double-diagonal" element={<DoubleDiagonalSkill />} />
        <Route path="/strategies/bull-put-spread" element={<BullPutSpreadSkill />} />
        <Route path="/strategies/bear-put-spread" element={<BearPutSpreadSkill />} />
        <Route path="/strategies/covered-call" element={<CoveredCallProtPutSkill />} />
        <Route path="/strategies/calendar-spread" element={<CalendarSpreadSkill />} />
        <Route path="/strategies/straddle-strangle" element={<StraddleStrangleSkill />} />
        <Route path="/strategies/butterfly" element={<ButterflySkill />} />
        <Route path="/strategies/collar" element={<CollarSkill />} />
        <Route path="/strategies/jade-lizard" element={<JadeLizardSkill />} />

        {/* ═══ PICKS ═══ */}
        <Route path="/picks/*" element={<PicksLayout />}>
          <Route index element={<PicksPage />} />
          <Route path="recap" element={<RecapPage />} />
          <Route path="monthly" element={<MonthlyPage />} />
          <Route path="analysis/:symbol" element={<PickAnalysisPage />} />
          <Route path=":weekId" element={<WeekViewerPage />} />
        </Route>

        {/* ═══ WORKBENCH ANALYSIS ═══ */}
        <Route element={<WorkbenchLayout />}>
          <Route path="/workbench/analysis" element={<WorkbenchAnalysisWrapper />} />
          <Route path="/workbench/analysis/:ticker" element={<WorkbenchAnalysisWrapper />} />
          <Route path="/workbench/projection" element={<ProjectionPage mode="operator" />} />
        </Route>

        {/* ═══ Auth ═══ */}
        <Route path="/login" element={<StandaloneLoginPage defaultMode="login" />} />
        <Route path="/signup" element={<StandaloneLoginPage defaultMode="signup" />} />

        {/* ═══ INVEST (formerly Trading) ═══ */}
        <Route path="/invest/*" element={<TradingLayout />} />

        {/* ═══ BLOG ═══ */}
        <Route path="/blog" element={<BlogLayout />}>
          <Route index element={<BlogIndexPage />} />
          <Route path=":slug" element={<BlogPostLayout />} />
        </Route>

        {/* Legacy /trading redirect → /invest */}
        <Route path="/trading/*" element={<Navigate to="/invest" replace />} />

        {/* 404 */}
        <Route element={<PublicLayout />}>
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
