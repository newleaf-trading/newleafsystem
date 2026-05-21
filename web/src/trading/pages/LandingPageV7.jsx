import { useState, useEffect } from 'react';
import { LoginPage } from '../components/LoginPage';
import { PlantGrowthIllustration } from '../components/PlantGrowthIllustration';
import { BrandBar } from '../../shared/components/BrandBar';
import PageSEO from '../../shared/components/PageSEO';
import { useAuth } from '../../shared/hooks/useAuth';
import '../styles/landing-v7.css';

export function LandingPageV7({ onSignInWithGoogle, onSignInWithEmail, onSignUp }) {
  const { user, signOut, signInWithGoogle } = useAuth();
  const [showAuth, setShowAuth] = useState(null); // null | 'login' | 'signup'

  const handleGetStarted = (mode = 'signup') => setShowAuth(mode);
  const handleCloseAuth = () => {
    setShowAuth(null);
    window.history.replaceState(null, '', '/');
  };

  // Check for hash on mount and hash changes
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash === '#signin') {
        setShowAuth('login');
      } else if (hash === '#signup') {
        setShowAuth('signup');
      }
    };

    // Check on mount
    handleHashChange();

    // Listen for hash changes
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  if (showAuth) {
    return (
      <LoginPage
        mode={showAuth}
        onClose={handleCloseAuth}
        onSignInWithGoogle={onSignInWithGoogle}
        onSignInWithEmail={onSignInWithEmail}
        onSignUp={onSignUp}
      />
    );
  }

  return (
    <div className="landing-v7">
      <PageSEO
        title="NewLeaf System — AI-Powered Options Intelligence Platform"
        description="NewLeaf System scans 108 stocks in real time across 8 options strategies. AI-powered scoring, analyst-curated picks, and a full strategy workbench for smarter options trading."
        path="/"
      />
      <BrandBar
        surface="root"
        authState={user ? 'in' : 'out'}
        user={user}
        onSignOut={signOut}
        onSignIn={signInWithGoogle}
      />

      {/* HERO — full-bleed video */}
      <section className="hero-vid">
        <h1 className="sr-only">One system. Every step of the trade.</h1>

        {/* Desktop: landscape video */}
        <iframe
          className="hero-bg-video hero-bg-desktop"
          src="https://www.youtube.com/embed/EAjd5E5NK-A?autoplay=1&mute=1&loop=1&controls=0&showinfo=0&rel=0&modestbranding=1&playlist=EAjd5E5NK-A&playsinline=1&disablekb=1&iv_load_policy=3"
          title="NewLeaf System growth journey"
          allow="autoplay; encrypted-media"
          allowFullScreen
        ></iframe>
        {/* Mobile: vertical Shorts video */}
        <iframe
          className="hero-bg-video hero-bg-mobile"
          src="https://www.youtube.com/embed/HCBWTZTsNj0?autoplay=1&mute=1&loop=1&controls=0&rel=0&modestbranding=1&playlist=HCBWTZTsNj0&playsinline=1"
          title="NewLeaf System mobile overview"
          allow="autoplay; encrypted-media"
          allowFullScreen
        ></iframe>

        <div className="hero-grad"></div>

        <div className="hero-ctas-tr">
          <button className="hero-cta-gold" onClick={() => handleGetStarted('signup')}>Get Started Free →</button>
          <button className="hero-cta-glass" onClick={() => document.getElementById('video')?.scrollIntoView({ behavior: 'smooth' })}>Watch Demo</button>
        </div>

        <div className="hero-lower">
          <div className="hero-stats-pill">
            <div className="hero-stat">
              <span className="hero-stat-num">5</span>
              <span className="hero-stat-lbl">Apps</span>
            </div>
            <div className="hero-stat-div"></div>
            <div className="hero-stat">
              <span className="hero-stat-num">150+</span>
              <span className="hero-stat-lbl">Symbols</span>
            </div>
            <div className="hero-stat-div"></div>
            <div className="hero-stat">
              <span className="hero-stat-num">3</span>
              <span className="hero-stat-lbl">Pillars</span>
            </div>
            <div className="hero-stat-div"></div>
            <div className="hero-stat">
              <span className="hero-stat-num">1</span>
              <span className="hero-stat-lbl">Data Hub</span>
            </div>
          </div>
        </div>

        <div className="hero-wave">
          <svg viewBox="0 0 1200 64" preserveAspectRatio="none">
            <path d="M0,0 C200,64 400,64 600,32 C800,0 1000,0 1200,48 L1200,64 L0,64 Z" fill="#F7F4EE"/>
          </svg>
        </div>
      </section>

      {/* TICKER STRIP */}
      <div className="strip">
        <div className="strip-track">
          {[
            { color: '#7c3aed', text: 'Gamma Wall Analysis · 150+ Symbols' },
            { color: '#d97706', text: 'Analyst-Curated Strategy Tiles' },
            { color: '#0d9488', text: 'Risk-Budgeted Portfolio Builder' },
            { color: '#dc2626', text: 'Live IB Execution · Human-in-Loop' },
            { color: '#0B2D23', text: 'Single Firestore Hub · Zero Duplication' },
            { color: '#C9A96E', text: '3-Pillar Scoring · Gamma / IV / Trend' },
            { color: '#0d9488', text: 'Theta Decay Tracker · Live P&L' },
            { color: '#dc2626', text: 'Combo Orders · All Legs or None' },
            // duplicate for seamless loop
            { color: '#7c3aed', text: 'Gamma Wall Analysis · 150+ Symbols' },
            { color: '#d97706', text: 'Analyst-Curated Strategy Tiles' },
            { color: '#0d9488', text: 'Risk-Budgeted Portfolio Builder' },
            { color: '#dc2626', text: 'Live IB Execution · Human-in-Loop' },
            { color: '#0B2D23', text: 'Single Firestore Hub · Zero Duplication' },
            { color: '#C9A96E', text: '3-Pillar Scoring · Gamma / IV / Trend' },
            { color: '#0d9488', text: 'Theta Decay Tracker · Live P&L' },
            { color: '#dc2626', text: 'Combo Orders · All Legs or None' },
          ].map((item, i) => (
            <div key={i} className="strip-item">
              <div className="si-dot" style={{background: item.color}}></div>
              {item.text}
            </div>
          ))}
        </div>
      </div>

      {/* VIDEO SECTION */}
      <section id="video" style={{padding: '100px 0', background: 'var(--bg)'}}>
        <div className="wrap">
          <div className="section-header" style={{textAlign: 'center', marginBottom: '48px'}}>
            <div className="sec-kicker" style={{color: 'var(--dim)', marginBottom: '12px'}}>Watch</div>
            <h2 style={{fontFamily: 'var(--fd)', fontSize: '42px', fontWeight: '900', lineHeight: '1.2', color: 'var(--tx)', marginBottom: '18px'}}>
              See NewLeaf System in action
            </h2>
            <p style={{fontSize: '16px', lineHeight: '1.75', color: 'var(--mut)', maxWidth: '600px', margin: '0 auto'}}>
              A 2-minute overview of how structured strategies deliver consistent, defined-risk results — from scan to execution.
            </p>
          </div>

          <div className="video-shell" style={{maxWidth: '900px', margin: '0 auto', background: 'var(--card)', borderRadius: 'var(--r4)', overflow: 'hidden', boxShadow: 'var(--s2)', border: '1px solid var(--bdr)'}}>
            <div className="video-top" style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 20px', background: 'rgba(17,24,39,0.02)', borderBottom: '1px solid var(--bdr)'}}>
              <div style={{display: 'flex', gap: '8px', alignItems: 'center'}}>
                <div className="preview-dots" style={{display: 'flex', gap: '6px'}}>
                  <div style={{width: '12px', height: '12px', borderRadius: '50%', background: '#ef4444'}}></div>
                  <div style={{width: '12px', height: '12px', borderRadius: '50%', background: '#f59e0b'}}></div>
                  <div style={{width: '12px', height: '12px', borderRadius: '50%', background: '#10b981'}}></div>
                </div>
                <div style={{fontWeight: '800', color: 'rgba(17,24,39,0.7)', fontSize: '12px'}}>Demo</div>
              </div>
              <div style={{fontSize: '12px', fontWeight: '750', color: 'rgba(17,24,39,0.55)'}}>2:13</div>
            </div>
            <div className="video-body">
              <iframe
                src="https://www.youtube.com/embed/iTIUmr8ZHh4"
                title="NewLeaf System Overview"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{width: '100%', display: 'block', aspectRatio: '16/9', border: 'none'}}
              />
            </div>
          </div>

          <div className="exchange-strip" style={{textAlign: 'center', marginTop: '48px', fontSize: '11px', fontWeight: '600', letterSpacing: '0.15em', textTransform: 'uppercase', color: 'var(--dim)', fontFamily: 'var(--fm)'}}>
            Analyzing options across major exchanges
          </div>
          <div className="exchanges" style={{display: 'flex', justifyContent: 'center', gap: '32px', marginTop: '18px', fontSize: '13px', fontWeight: '700', color: 'var(--mut)', fontFamily: 'var(--fm)'}}>
            <div>NYSE</div>
            <div>NASDAQ</div>
            <div>CBOE</div>
            <div>S&P 500</div>
            <div>Russell 2000</div>
          </div>
        </div>
      </section>

      {/* BRAND STORY SECTION - The Philosophy */}
      <section id="brand-story" className="brand-story-sec">
        <div className="wrap">
          <div className="brand-story-header">
            <div className="sec-kicker" style={{color:'rgba(201, 169, 110,0.6)'}}>The Philosophy</div>
            <h2>Every new leaf<br/>starts with a <em>seed.</em></h2>
            <p className="sec-sub">An idea planted with intention. Nurtured through rigorous research. Shaped into a defined-risk strategy. Grown into a live, executed trade. Five applications. One connected pipeline. That's the NewLeaf journey.</p>
          </div>
        </div>

        {/* Full-width plant growth illustration */}
        <div className="growth-bg-wrap">
          <PlantGrowthIllustration />
        </div>

        {/* Stage cards overlay */}
        <div className="wrap" style={{position:'relative', zIndex:5, marginTop:'28px'}}>
          <div className="stage-grid">
            {/* Stage 1 — THE SEED */}
            <div className="stage-card sc-q gs1">
              <div className="sc-badge"><span className="sc-badge-dot"></span>THE SEED · 01</div>
              <div className="sc-app">newleaf-quant</div>
              <div className="sc-verb">Scan &<br/>Analyse</div>
              <p className="sc-desc">Every trade starts with raw data. newleaf-quant sweeps 150+ tickers for gamma wall confluences, scores IV rank against the historical range, and aligns signals with price trend.</p>
              <div className="sc-features">
                <div className="sc-feat">Gamma wall detection across S&P 500 constituents</div>
                <div className="sc-feat">3-pillar scoring: Gamma / IV Rank / Trend alignment</div>
                <div className="sc-feat">Bulk scan engine — 150 symbols per automated run</div>
                <div className="sc-feat">AI-generated trade rationale for each proposal</div>
              </div>
            </div>

            {/* Stage 2 — FIRST LIGHT */}
            <div className="stage-card sc-w gs2">
              <div className="sc-badge"><span className="sc-badge-dot"></span>FIRST LIGHT · 02</div>
              <div className="sc-app">newleaf-workbench</div>
              <div className="sc-verb">Design &<br/>Promote</div>
              <p className="sc-desc">The analyst's craft table. The Trade Builder generates multiple strategy variants per proposal — iron condors, verticals, calendars — each scored and priced with live IB quotes.</p>
              <div className="sc-features">
                <div className="sc-feat">Multi-variant Trade Builder with side-by-side comparison</div>
                <div className="sc-feat">Live IB bid / ask / mid pricing per leg in real time</div>
                <div className="sc-feat">One-click promotion to the investor strategy library</div>
                <div className="sc-feat">Bulk scan queue with live progress and error review</div>
              </div>
            </div>

            {/* Stage 3 — TOP PICKS */}
            <div className="stage-card sc-p gs3">
              <div className="sc-badge"><span className="sc-badge-dot"></span>TOP PICKS · 03</div>
              <div className="sc-app">newleaf-picks</div>
              <div className="sc-verb">Curate &<br/>Recommend</div>
              <p className="sc-desc">The strategy showcase. Analyst-approved picks surface as curated tiles with full rationale, scoring breakdown, and live Greeks — ready for investors to review and act on.</p>
              <div className="sc-features">
                <div className="sc-feat">Analyst-curated strategy picks with scoring details</div>
                <div className="sc-feat">Full rationale and Greeks breakdown per pick</div>
                <div className="sc-feat">Filterable by strategy type, expiry, and risk profile</div>
                <div className="sc-feat">One-click add to portfolio from any pick tile</div>
              </div>
            </div>

            {/* Stage 4 — TAKING SHAPE */}
            <div className="stage-card sc-t gs4">
              <div className="sc-badge"><span className="sc-badge-dot"></span>TAKING SHAPE · 04</div>
              <div className="sc-app">newleaf-invest</div>
              <div className="sc-verb">Discover &<br/>Allocate</div>
              <p className="sc-desc">The investor's front door. Curated strategy tiles arrive with full rationale, Greeks breakdown, and theta decay projections. A risk-budgeted portfolio builder lets you size each position.</p>
              <div className="sc-features">
                <div className="sc-feat">Curated strategy tile discovery with rich detail views</div>
                <div className="sc-feat">Portfolio builder with fund allocation and risk budgeting</div>
                <div className="sc-feat">Theta decay tracker and live P&L monitoring</div>
                <div className="sc-feat">Quantities written directly to Firestore for execution</div>
              </div>
            </div>

            {/* Stage 5 — NEW LEAF */}
            <div className="stage-card sc-d gs5">
              <div className="sc-badge"><span className="sc-badge-dot"></span>NEW LEAF · 05</div>
              <div className="sc-app">newleaf-desk</div>
              <div className="sc-verb">Confirm &<br/>Execute</div>
              <p className="sc-desc">Where decisions become trades. newleaf-desk reads your portfolio allocation from Firestore, fetches a fresh 3-call IB quote snapshot per leg, and presents a single confirmation screen.</p>
              <div className="sc-features">
                <div className="sc-feat">Reads portfolio allocation and quantities from Firestore</div>
                <div className="sc-feat">Live 3-call IB quote snapshot — bid, ask, and mid per leg</div>
                <div className="sc-feat">Combo orders: all legs fill atomically or rollback</div>
                <div className="sc-feat">Human-in-the-loop — one deliberate trade at a time</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* PIPELINE SECTION */}
      <section className="pipe-sec">
        <div className="wrap">
          <div className="sec-header">
            <div className="sec-kicker">How It Works</div>
            <h2>Research → Design → Pick → Invest → Execute</h2>
            <p className="sec-sub">Every strategy tile you see has been through a rigorous 5-stage pipeline — so by the time it reaches you, the hard work is already done.</p>
          </div>

          <div className="pipeline">
            {/* Step 1: Quant */}
            <div className="pipe-step ps1">
              <div className="pipe-icon">
                <div className="pipe-num">01</div>
                ⚛️
              </div>
              <div className="pipe-name">newleaf-quant</div>
              <div className="pipe-verb">Scan & Score</div>
              <div className="pipe-desc">Gamma wall analysis runs across 150+ tickers. Each symbol is scored on Gamma structure, IV environment, and Trend.</div>
            </div>

            {/* Arrow 1 */}
            <div className="pipe-arrow pa1">
              <svg viewBox="0 0 28 24" fill="none">
                <line className="arrow-line" x1="0" y1="12" x2="20" y2="12" strokeWidth="1.8" strokeLinecap="round"/>
                <polygon className="arrow-head" points="18,6 28,12 18,18"/>
              </svg>
            </div>

            {/* Step 2: Workbench */}
            <div className="pipe-step ps2">
              <div className="pipe-icon">
                <div className="pipe-num">02</div>
                🔧
              </div>
              <div className="pipe-name">newleaf-workbench</div>
              <div className="pipe-verb">Build & Approve</div>
              <div className="pipe-desc">An analyst reviews top proposals, builds multi-variant structures, and selects only the best for the investor library.</div>
            </div>

            {/* Arrow 2 */}
            <div className="pipe-arrow pa2">
              <svg viewBox="0 0 28 24" fill="none">
                <line className="arrow-line" x1="0" y1="12" x2="20" y2="12" strokeWidth="1.8" strokeLinecap="round"/>
                <polygon className="arrow-head" points="18,6 28,12 18,18"/>
              </svg>
            </div>

            {/* Step 3: Picks */}
            <div className="pipe-step ps3">
              <div className="pipe-icon">
                <div className="pipe-num">03</div>
                🎯
              </div>
              <div className="pipe-name">newleaf-picks</div>
              <div className="pipe-verb">Curate & Recommend</div>
              <div className="pipe-desc">Analyst-approved picks surface as curated tiles with scoring and rationale — ready for investors.</div>
            </div>

            {/* Arrow 3 */}
            <div className="pipe-arrow pa3">
              <svg viewBox="0 0 28 24" fill="none">
                <line className="arrow-line" x1="0" y1="12" x2="20" y2="12" strokeWidth="1.8" strokeLinecap="round"/>
                <polygon className="arrow-head" points="18,6 28,12 18,18"/>
              </svg>
            </div>

            {/* Step 4: Invest */}
            <div className="pipe-step ps4">
              <div className="pipe-icon">
                <div className="pipe-num">04</div>
                📊
              </div>
              <div className="pipe-name">newleaf-invest</div>
              <div className="pipe-verb">Discover & Allocate</div>
              <div className="pipe-desc">You discover curated strategy tiles and build a risk-budgeted portfolio.</div>
            </div>

            {/* Arrow 4 */}
            <div className="pipe-arrow pa4">
              <svg viewBox="0 0 28 24" fill="none">
                <line className="arrow-line" x1="0" y1="12" x2="20" y2="12" strokeWidth="1.8" strokeLinecap="round"/>
                <polygon className="arrow-head" points="18,6 28,12 18,18"/>
              </svg>
            </div>

            {/* Step 5: Desk */}
            <div className="pipe-step ps5">
              <div className="pipe-icon">
                <div className="pipe-num">05</div>
                ⚡
              </div>
              <div className="pipe-name">newleaf-desk</div>
              <div className="pipe-verb">Confirm & Execute</div>
              <div className="pipe-desc">Live IB quotes fetched per leg. Combo orders placed — all legs fill together or none fill at all.</div>
            </div>
          </div>
        </div>
      </section>

      {/* APP CARDS */}
      <section id="apps">
        <div className="wrap">
          <div className="sec-header">
            <div className="sec-kicker">The Platform</div>
            <h2>Five layers. <em>One experience.</em></h2>
            <p className="sec-sub">Two back-end engines that do the research. One picks library. One investor platform where you trade. One execution layer that places the orders.</p>
          </div>

          <div className="cards-grid">
            {/* Quant Card */}
            <div className="app-card ac-q">
              <div className="ac-top">
                <div className="ac-icon">⚛️</div>
                <div className="ac-badge b-new"><div className="b-dot"></div> Research Engine</div>
              </div>
              <div className="ac-name">newleaf-quant</div>
              <div className="ac-role">The intelligence layer — runs behind the scenes</div>
              <div className="ac-desc">Scans 150+ symbols daily for gamma wall structures, elevated IV environments, and trend alignment.</div>
              <div className="ac-features">
                <div className="af">Gamma wall + ATM IV analysis</div>
                <div className="af">3-pillar scoring: Gamma / IV / Trend</div>
                <div className="af">Bulk scan engine — 150 symbols per run</div>
                <div className="af">AI-powered trade rationale generation</div>
              </div>
            </div>

            {/* Workbench Card */}
            <div className="app-card ac-w">
              <div className="ac-top">
                <div className="ac-icon">🔧</div>
                <div className="ac-badge b-new"><div className="b-dot"></div> Curation Engine</div>
              </div>
              <div className="ac-name">newleaf-workbench</div>
              <div className="ac-role">Analyst tool — curates what you see in the library</div>
              <div className="ac-desc">An analyst reviews all quant proposals, builds multi-variant structures with live IB pricing.</div>
              <div className="ac-features">
                <div className="af">Multi-variant Trade Builder</div>
                <div className="af">Live IB quote pricing per leg</div>
                <div className="af">Tile promotion to investor library</div>
                <div className="af">Quality filter before anything reaches you</div>
              </div>
            </div>

            {/* Picks Card */}
            <div className="app-card ac-p">
              <div className="ac-top">
                <div className="ac-icon">🎯</div>
                <div className="ac-badge b-new"><div className="b-dot"></div> Strategy Picks</div>
              </div>
              <div className="ac-name">newleaf-picks</div>
              <div className="ac-role">Curated strategy library — browse top picks</div>
              <div className="ac-desc">Analyst-approved strategy picks with full scoring breakdown, rationale, and live Greeks — ready for portfolio inclusion.</div>
              <div className="ac-features">
                <div className="af">Analyst-curated strategy picks</div>
                <div className="af">Full scoring + rationale per pick</div>
                <div className="af">Filter by type, expiry, risk profile</div>
                <div className="af">One-click add to your portfolio</div>
              </div>
            </div>

            {/* Invest Card */}
            <div className="app-card ac-t">
              <div className="ac-top">
                <div className="ac-icon">📊</div>
                <div className="ac-badge b-live"><div className="b-dot"></div> Your Platform</div>
              </div>
              <div className="ac-name">newleaf-invest</div>
              <div className="ac-role">Investor Platform — this is where you trade</div>
              <div className="ac-desc">Discover curated strategy tiles, understand each trade through rationale, technicals, and Greeks.</div>
              <div className="ac-features">
                <div className="af">Curated strategy tile discovery</div>
                <div className="af">Portfolio builder + fund allocation</div>
                <div className="af">Theta decay tracker + live P&L</div>
                <div className="af">Performance analytics dashboard</div>
              </div>
              <a href="#cta" className="ac-link">Start Free on newleaf-invest →</a>
            </div>

            {/* Desk Card */}
            <div className="app-card ac-d">
              <div className="ac-top">
                <div className="ac-icon">⚡</div>
                <div className="ac-badge b-new"><div className="b-dot"></div> Execution Layer</div>
              </div>
              <div className="ac-name">newleaf-desk</div>
              <div className="ac-role">Execution layer — live order placement</div>
              <div className="ac-desc">Once you've built your portfolio allocation, the execution desk reads your quantities and places combo orders.</div>
              <div className="ac-features">
                <div className="af">Reads your portfolio allocation automatically</div>
                <div className="af">Live IB quotes — fresh snapshot per leg</div>
                <div className="af">Combo orders — all legs fill or none fill</div>
                <div className="af">Human-in-the-loop, one trade at a time</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HUB SECTION */}
      <section className="hub-sec" id="hub">
        <div className="wrap">
          <div className="hub-grid">
            <div className="hub-visual">
              <div className="hub-box">
                <div className="hub-box-icon">🔗</div>
                <div className="hub-box-title">Always in Sync</div>
                <div className="hub-box-sub">One login · All five apps</div>
                <div className="hub-box-desc">Changes made in one app are<br/>instantly visible in all the others.<br/>No exports. No stale data. Ever.</div>
              </div>
              <div className="hub-cols">
                {[
                  { color:'#7c3aed', app:'newleaf-quant', flow:'Writes proposals & scores' },
                  { color:'#d97706', app:'newleaf-workbench', flow:'Promotes strategy tiles' },
                  { color:'#2563eb', app:'newleaf-picks', flow:'Surfaces curated picks' },
                  { color:'#0d9488', app:'newleaf-invest', flow:'Writes portfolio allocation' },
                  { color:'#dc2626', app:'newleaf-desk', flow:'Reads qty · writes fills' },
                ].map((item, i) => (
                  <div key={i} className="hub-col">
                    <div className="hc-dot" style={{background: item.color}}></div>
                    <div>
                      <div className="hc-app">{item.app}</div>
                      <div className="hc-flow">{item.flow}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="sec-kicker">Architecture</div>
              <h2>One data layer.<br/><em>Zero duplication.</em></h2>
              <p className="sec-sub">The moment the analyst approves a strategy, you see it. The moment you allocate, execution is ready. The pipeline moves at market speed.</p>
              <div className="hub-points">
                {[
                  { icon:'🔐', title:'One login, everywhere', desc:"Sign in once and your identity, portfolio, and allocations are shared across the full system." },
                  { icon:'⚡', title:"Strategies appear the moment they're published", desc:"When the analyst approves a new tile, it appears in your library within seconds — no manual refresh, no batch updates." },
                  { icon:'🛡️', title:'Every position is defined-risk', desc:"Every strategy on the platform has a known maximum loss. No naked exposure. You always know the worst case before you enter." },
                ].map((pt, i) => (
                  <div key={i} className="hp">
                    <div className="hp-icon">{pt.icon}</div>
                    <div>
                      <div className="hp-title">{pt.title}</div>
                      <div className="hp-desc">{pt.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FINAL CTA */}
      <section id="cta">
        <div className="wrap">
          <div className="cta-box">
            <div className="cta-copy">
              <div className="sec-kicker">Get Started</div>
              <h2>Operate your portfolio like a system.</h2>
              <p>Start free on newleaf-invest. Explore today's curated strategy library, build your risk-budgeted portfolio, and execute with full confidence.</p>
            </div>
            <div className="cta-right">
              <button className="btn-cta-ghost" onClick={() => handleGetStarted('signup')}>View Pricing</button>
              <button className="btn-cta-gold" onClick={() => handleGetStarted('signup')}>Start Free →</button>
            </div>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer>
        <div className="wrap">
          <div className="footer-row">
            <div className="footer-disc">
              <strong>Disclaimer:</strong> NewLeaf System is an educational and decision-support platform. It does not provide personalised financial advice. Options trading involves significant risk and may not be suitable for all investors. Past performance does not guarantee future results.
            </div>
            <div className="footer-copy">© 2026 NewLeaf System</div>
          </div>
          <div style={{ borderTop: '1px solid rgba(255,255,255,.1)', marginTop: 16, paddingTop: 16, display: 'flex', gap: 24, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href="/privacy-policy" style={{ color: 'rgba(255,255,255,.5)', fontSize: 12, textDecoration: 'none' }}>Privacy Policy</a>
            <a href="/terms-and-conditions" style={{ color: 'rgba(255,255,255,.5)', fontSize: 12, textDecoration: 'none' }}>Terms &amp; Conditions</a>
            <a href="mailto:support@newleafsystem.com" style={{ color: 'rgba(255,255,255,.5)', fontSize: 12, textDecoration: 'none' }}>Contact</a>
          </div>
        </div>
      </footer>
    </div>
  );
}

// System Diagram Component — 5 segments (72° each, 8° gaps)
function SystemDiagram() {
  const handleSegmentClick = (page) => {
    if (page === '/quant/' || page === '/desk/') {
      alert('Coming soon — contact sales@newleafsystem.com for early access.');
      return;
    }
    window.location.href = page;
  };

  return (
    <svg className="sys-diagram" viewBox="0 0 480 480" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="hub-bg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1c3a28"/>
          <stop offset="100%" stopColor="#080f09"/>
        </radialGradient>
        <radialGradient id="outer-glow" cx="50%" cy="50%" r="50%">
          <stop offset="60%" stopColor="transparent"/>
          <stop offset="100%" stopColor="rgba(201, 169, 110,.04)"/>
        </radialGradient>
        <filter id="hub-shadow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="10" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>

      {/* Outermost ambient ring */}
      <circle cx="240" cy="240" r="228" fill="url(#outer-glow)"/>
      <circle cx="240" cy="240" r="210" fill="none" stroke="rgba(201, 169, 110,.04)" strokeWidth="24"/>

      {/* Animated dashed flow ring */}
      <circle className="flow-ring" cx="240" cy="240" r="148" fill="none" stroke="rgba(201, 169, 110,.22)" strokeWidth="1.5" strokeDasharray="7 11"/>

      {/* SEGMENT 1: QUANT (top, purple) — 328° to 32° */}
      <path
        className="seg seg-q"
        d="M 136.7,74.6 A 195,195 0 0,1 343.3,74.6 L 295.6,151.0 A 105,105 0 0,0 184.4,151.0 Z"
        fill="#7c3aed"
        stroke="rgba(255,255,255,.08)"
        strokeWidth="1.5"
        opacity="0.92"
        style={{ cursor: 'pointer' }}
        onClick={() => handleSegmentClick('/quant/')}
      />

      {/* SEGMENT 2: WORKBENCH (upper-right, amber) — 40° to 104° */}
      <path
        className="seg seg-w"
        d="M 365.3,90.6 A 195,195 0 0,1 429.2,287.2 L 341.9,265.4 A 105,105 0 0,0 307.5,159.6 Z"
        fill="#d97706"
        stroke="rgba(255,255,255,.08)"
        strokeWidth="1.5"
        opacity="0.92"
        style={{ cursor: 'pointer' }}
        onClick={() => handleSegmentClick('/workbench/')}
      />

      {/* SEGMENT 3: PICKS (lower-right, blue) — 112° to 176° */}
      <path
        className="seg seg-p"
        d="M 420.8,313.0 A 195,195 0 0,1 253.6,434.5 L 247.3,344.7 A 105,105 0 0,0 337.4,279.3 Z"
        fill="#2563eb"
        stroke="rgba(255,255,255,.08)"
        strokeWidth="1.5"
        opacity="0.92"
        style={{ cursor: 'pointer' }}
        onClick={() => handleSegmentClick('/picks/')}
      />

      {/* SEGMENT 4: INVEST (lower-left, teal) — 184° to 248° */}
      <path
        className="seg seg-t"
        d="M 226.4,434.5 A 195,195 0 0,1 59.2,313.0 L 142.6,279.3 A 105,105 0 0,0 232.7,344.7 Z"
        fill="#0d9488"
        stroke="rgba(255,255,255,.08)"
        strokeWidth="1.5"
        opacity="0.92"
        style={{ cursor: 'pointer' }}
        onClick={() => handleSegmentClick('/invest/')}
      />

      {/* SEGMENT 5: DESK (upper-left, red) — 256° to 320° */}
      <path
        className="seg seg-d"
        d="M 50.8,287.2 A 195,195 0 0,1 114.7,90.6 L 172.5,159.6 A 105,105 0 0,0 138.1,265.4 Z"
        fill="#dc2626"
        stroke="rgba(255,255,255,.08)"
        strokeWidth="1.5"
        opacity="0.92"
        style={{ cursor: 'pointer' }}
        onClick={() => handleSegmentClick('/desk/')}
      />

      {/* Flow arrows between segments */}
      <g transform="translate(354.6,82.2) rotate(36)"><polygon points="9,0 -4,-6 -4,6" fill="rgba(255,255,255,.82)"/></g>
      <g transform="translate(425.4,300.3) rotate(108)"><polygon points="9,0 -4,-6 -4,6" fill="rgba(255,255,255,.82)"/></g>
      <g transform="translate(240,435) rotate(180)"><polygon points="9,0 -4,-6 -4,6" fill="rgba(255,255,255,.82)"/></g>
      <g transform="translate(54.6,300.3) rotate(252)"><polygon points="9,0 -4,-6 -4,6" fill="rgba(255,255,255,.82)"/></g>

      {/* Hub pulse */}
      <circle className="hub-pulse" cx="240" cy="240" r="100" fill="none" stroke="rgba(201, 169, 110,.4)" strokeWidth="2"/>
      <circle cx="240" cy="240" r="93" fill="url(#hub-bg)" filter="url(#hub-shadow)"/>
      <circle cx="240" cy="240" r="93" fill="none" stroke="rgba(201, 169, 110,.28)" strokeWidth="1.5"/>
      <circle cx="240" cy="240" r="87" fill="none" stroke="rgba(201, 169, 110,.07)" strokeWidth="1"/>

      {/* Hub text */}
      <text x="240" y="213" textAnchor="middle" fill="rgba(201, 169, 110,.6)" fontSize="8" fontFamily="Space Mono, monospace" letterSpacing="2.8">CONNECTED HUB</text>
      <text x="240" y="236" textAnchor="middle" fill="white" fontSize="16" fontWeight="700" fontFamily="Fraunces, Georgia, serif">Always in Sync</text>
      <text x="240" y="253" textAnchor="middle" fill="rgba(255,255,255,.5)" fontSize="10.5" fontFamily="DM Sans, sans-serif">One login. All five apps.</text>
      <text x="240" y="271" textAnchor="middle" fill="rgba(255,255,255,.28)" fontSize="7.5" fontFamily="Space Mono, monospace" letterSpacing="0.5">real-time · no manual exports</text>

      {/* Segment labels — positioned at visual centre of each segment */}
      {/* 1. Quant (0°, top) */}
      <text x="240" y="80" textAnchor="middle" fill="rgba(255,255,255,.9)" fontSize="10" fontWeight="700" fontFamily="Space Mono, monospace">newleaf-quant</text>
      <text x="240" y="95" textAnchor="middle" fill="rgba(255,255,255,.65)" fontSize="9.5" fontFamily="DM Sans, sans-serif">Quant Research</text>

      {/* 2. Workbench (72°, upper-right) */}
      <text x="387" y="192" textAnchor="middle" fill="rgba(255,255,255,.9)" fontSize="9.5" fontWeight="700" fontFamily="Space Mono, monospace">newleaf-</text>
      <text x="387" y="206" textAnchor="middle" fill="rgba(255,255,255,.9)" fontSize="9.5" fontWeight="700" fontFamily="Space Mono, monospace">workbench</text>
      <text x="387" y="220" textAnchor="middle" fill="rgba(255,255,255,.65)" fontSize="9" fontFamily="DM Sans, sans-serif">Trade Design</text>

      {/* 3. Picks (144°, lower-right) */}
      <text x="330" y="358" textAnchor="middle" fill="rgba(255,255,255,.9)" fontSize="9.5" fontWeight="700" fontFamily="Space Mono, monospace">newleaf-</text>
      <text x="330" y="372" textAnchor="middle" fill="rgba(255,255,255,.9)" fontSize="9.5" fontWeight="700" fontFamily="Space Mono, monospace">picks</text>
      <text x="330" y="386" textAnchor="middle" fill="rgba(255,255,255,.65)" fontSize="9" fontFamily="DM Sans, sans-serif">Strategy Picks</text>

      {/* 4. Invest (216°, lower-left) */}
      <text x="152" y="358" textAnchor="middle" fill="rgba(255,255,255,.9)" fontSize="9.5" fontWeight="700" fontFamily="Space Mono, monospace">newleaf-</text>
      <text x="152" y="372" textAnchor="middle" fill="rgba(255,255,255,.9)" fontSize="9.5" fontWeight="700" fontFamily="Space Mono, monospace">invest</text>
      <text x="152" y="386" textAnchor="middle" fill="rgba(255,255,255,.65)" fontSize="9" fontFamily="DM Sans, sans-serif">Investor Platform</text>

      {/* 5. Desk (288°, upper-left) */}
      <text x="93" y="192" textAnchor="middle" fill="rgba(255,255,255,.9)" fontSize="9.5" fontWeight="700" fontFamily="Space Mono, monospace">newleaf-</text>
      <text x="93" y="206" textAnchor="middle" fill="rgba(255,255,255,.9)" fontSize="9.5" fontWeight="700" fontFamily="Space Mono, monospace">desk</text>
      <text x="93" y="220" textAnchor="middle" fill="rgba(255,255,255,.65)" fontSize="9" fontFamily="DM Sans, sans-serif">Execution</text>

      {/* Segment number badges */}
      <circle cx="240" cy="32" r="12" fill="rgba(124,58,237,.55)" stroke="rgba(255,255,255,.25)" strokeWidth="1"/>
      <text x="240" y="36.5" textAnchor="middle" fill="white" fontSize="8.5" fontWeight="700" fontFamily="Space Mono, monospace">01</text>

      <circle cx="438" cy="176" r="12" fill="rgba(217,119,6,.55)" stroke="rgba(255,255,255,.25)" strokeWidth="1"/>
      <text x="438" y="180.5" textAnchor="middle" fill="white" fontSize="8.5" fontWeight="700" fontFamily="Space Mono, monospace">02</text>

      <circle cx="362" cy="408" r="12" fill="rgba(37,99,235,.55)" stroke="rgba(255,255,255,.25)" strokeWidth="1"/>
      <text x="362" y="412.5" textAnchor="middle" fill="white" fontSize="8.5" fontWeight="700" fontFamily="Space Mono, monospace">03</text>

      <circle cx="118" cy="408" r="12" fill="rgba(13,148,136,.55)" stroke="rgba(255,255,255,.25)" strokeWidth="1"/>
      <text x="118" y="412.5" textAnchor="middle" fill="white" fontSize="8.5" fontWeight="700" fontFamily="Space Mono, monospace">04</text>

      <circle cx="42" cy="176" r="12" fill="rgba(220,38,38,.55)" stroke="rgba(255,255,255,.25)" strokeWidth="1"/>
      <text x="42" y="180.5" textAnchor="middle" fill="white" fontSize="8.5" fontWeight="700" fontFamily="Space Mono, monospace">05</text>

      {/* Emoji icons */}
      <text x="240" y="67" textAnchor="middle" fontSize="14">⚛️</text>
      <text x="387" y="178" textAnchor="middle" fontSize="14">🔧</text>
      <text x="330" y="344" textAnchor="middle" fontSize="14">🎯</text>
      <text x="152" y="344" textAnchor="middle" fontSize="14">📊</text>
      <text x="93" y="178" textAnchor="middle" fontSize="14">⚡</text>
    </svg>
  );
}
