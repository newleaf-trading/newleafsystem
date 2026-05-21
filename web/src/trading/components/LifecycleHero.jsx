/**
 * LifecycleHero — 5-stage options lifecycle hero for the Trading home page.
 * Ported from newleaf_hero_mockup.html.
 */
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

// Brand tokens
const T = {
  forest: '#0F3D2E',
  forestDeep: '#0A2B20',
  forestSoft: 'rgba(15,61,46,0.08)',
  forestText2: 'rgba(15,61,46,0.68)',
  forestText3: 'rgba(15,61,46,0.48)',
  gold: '#C8A85A',
  goldSoft: 'rgba(200,168,90,0.15)',
  goldLine: 'rgba(200,168,90,0.55)',
  cream: '#F7F4EE',
  creamDeep: '#EFEBE0',
  oxblood: '#B54634',
  oxbloodSoft: 'rgba(181,70,52,0.12)',
  serif: "'Fraunces', 'Playfair Display', Georgia, serif",
  sans: "'DM Sans', 'Inter', -apple-system, sans-serif",
  mono: "'Space Mono', 'SF Mono', monospace",
};

// Icon style must be declared before ICONS (const temporal dead zone)
const iconStyle = { stroke: 'currentColor', strokeWidth: 1.5, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' };

// Stage SVG icons (from mockup)
const ICONS = {
  discover: <svg width="22" height="22" viewBox="0 0 24 24" style={iconStyle}><circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  decide: <svg width="22" height="22" viewBox="0 0 24 24" style={iconStyle}><path d="M12 3v8M12 11l-6 9M12 11l6 9"/><circle cx="12" cy="3" r="1.5" fill={T.forest}/></svg>,
  build: <svg width="22" height="22" viewBox="0 0 24 24" style={iconStyle}><polygon points="12 3 3 7.5 12 12 21 7.5 12 3"/><polyline points="3 16.5 12 21 21 16.5"/><polyline points="3 12 12 16.5 21 12"/></svg>,
  execute: <svg width="22" height="22" viewBox="0 0 24 24" style={iconStyle}><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
  defend: <svg width="22" height="22" viewBox="0 0 24 24" style={iconStyle}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
};

const STAGES_DEF = [
  { key: 'discover', label: 'Discover', route: '/invest/discover' },
  { key: 'decide', label: 'Decide', route: '/invest/discover' },
  { key: 'build', label: 'Build', route: '/invest/build' },
  { key: 'execute', label: 'Execute', route: '/invest/build' },
  { key: 'defend', label: 'Defend', route: null }, // scrolls to exits
];

export function LifecycleHero({ user, counts, capitalDeployedPct, marketStatus, variant = 'full' }) {
  const navigate = useNavigate();
  const [animate, setAnimate] = useState(false);
  const prefersReduced = usePrefersReducedMotion();

  // Skip animations on return visits within session
  useEffect(() => {
    const seen = sessionStorage.getItem('newleaf-hero-seen');
    if (!seen && !prefersReduced) {
      setAnimate(true);
      sessionStorage.setItem('newleaf-hero-seen', '1');
    }
  }, []);

  const firstName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || '';
  const lastName = user?.displayName?.split(' ').slice(1).join(' ') || '';
  const fullName = `${firstName} ${lastName}`.trim();

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long' });

  const exitsFlagged = counts?.exitsFlagged || 0;
  const discoverCount = counts?.discover || 0;
  const activeCount = counts?.active || 0;

  // Active stage logic
  const activeStage = exitsFlagged > 0 ? 'defend' : discoverCount > 0 ? 'discover' : null;

  const stageStatus = (key) => {
    switch (key) {
      case 'discover': return discoverCount > 0 ? `${discoverCount} new setups` : 'No new setups';
      case 'decide': return 'Probability & fit';
      case 'build': return 'Strategy & legs';
      case 'execute': return 'Fill with edge';
      case 'defend': return exitsFlagged > 0 ? `${exitsFlagged} exits flagged` : 'All on track';
      default: return '';
    }
  };

  const handleStageClick = (stage) => {
    if (stage.key === 'defend') {
      // Scroll to exits section
      document.querySelector('[data-section="defend"]')?.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate(stage.route);
    }
  };

  const anim = (delay) => animate ? {
    opacity: 0,
    animation: `heroFadeUp 0.6s ${delay}s forwards`,
  } : {};

  return (
    <>
      <style>{`
        @keyframes heroFadeUp {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes heroDrawLine {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        @keyframes heroPulse {
          0% { transform: scale(1); opacity: 0.6; }
          70% { transform: scale(1.35); opacity: 0; }
          100% { opacity: 0; }
        }
        @media (max-width: 900px) {
          .lifecycle-headline { white-space: normal !important; }
          .lifecycle-stages { gap: 2px !important; }
          .lifecycle-stage-label { font-size: 13px !important; }
          .lifecycle-stage-status { font-size: 10px !important; }
        }
      `}</style>

      <div style={{ padding: '24px 0 0' }}>
        <section style={{
          background: T.cream,
          padding: variant === 'compact' ? '32px 40px 28px' : '18px 48px 18px',
          borderRadius: 20,
          border: `1px solid ${T.forestSoft}`,
          position: 'relative',
          overflow: 'hidden',
        }}>
          {/* Decorative radial gradients */}
          <div style={{ position: 'absolute', top: -120, right: -120, width: 340, height: 340, background: 'radial-gradient(circle, rgba(200,168,90,0.1), transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -80, left: -80, width: 240, height: 240, background: 'radial-gradient(circle, rgba(15,61,46,0.04), transparent 70%)', pointerEvents: 'none' }} />

          {variant === 'full' && (
            <>
              {/* Greeting */}
              <div style={{
                fontFamily: T.serif, fontStyle: 'italic', fontSize: '12px', fontWeight: 400,
                color: T.forestText2, marginBottom: 6, letterSpacing: '0.005em',
                ...anim(0.1),
              }}>
                {greeting}, {fullName}
                <span style={{ display: 'inline-block', width: 22, height: 1, background: T.gold, verticalAlign: 'middle', margin: '0 10px 3px', opacity: 0.6 }} />
                <span style={{ fontStyle: 'normal', fontFamily: T.mono, fontSize: 12, color: T.forestText3, letterSpacing: '0.02em' }}>
                  {dateStr}
                </span>
              </div>

              {/* Eyebrow */}
              <div style={{
                fontSize: '10.5px', letterSpacing: '0.24em', color: T.gold,
                textTransform: 'uppercase', marginBottom: 8, fontWeight: 500,
                ...anim(0.2),
              }}>
                The options lifecycle
              </div>

              {/* Headline */}
              <h1 className="lifecycle-headline" style={{
                fontFamily: T.serif, fontSize: '36px',
                lineHeight: 1, fontWeight: 300, marginBottom: 8, letterSpacing: '-0.02em',
                whiteSpace: 'nowrap', color: T.forest,
                ...anim(0.3),
              }}>
                From signal to <em style={{ fontStyle: 'italic', color: T.gold, fontWeight: 300 }}>safeguard</em>.
              </h1>

              {/* Subhead */}
              <p style={{
                fontFamily: T.sans, fontSize: 13, lineHeight: 1.55,
                color: T.forestText2, marginBottom: 14, maxWidth: '56ch',
                ...anim(0.45),
              }}>
                NewLeaf carries every options trade through five disciplined stages. No gaps between research and risk.
              </p>
            </>
          )}

          {/* Lifecycle strip */}
          <div style={{ position: 'relative', padding: '12px 4px 0' }}>
            {/* Gold connector line */}
            <div style={{
              position: 'absolute', left: '10%', right: '10%',
              top: 'calc(12px + 28px)', height: 1,
              background: 'linear-gradient(to right, rgba(200,168,90,0) 0%, rgba(200,168,90,0.5) 15%, rgba(200,168,90,0.65) 50%, rgba(200,168,90,0.5) 85%, rgba(200,168,90,0) 100%)',
              transformOrigin: 'left',
              ...(animate ? { transform: 'scaleX(0)', animation: 'heroDrawLine 1.2s 0.5s cubic-bezier(0.16,1,0.3,1) forwards' } : {}),
            }} />

            {/* 5 stages */}
            <div className="lifecycle-stages" style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, position: 'relative' }}>
              {STAGES_DEF.map((stage, i) => {
                const isActive = activeStage === stage.key;
                const badge = stage.key === 'discover' && discoverCount > 0 ? { type: 'info', count: discoverCount }
                  : stage.key === 'defend' && exitsFlagged > 0 ? { type: 'alert', count: exitsFlagged }
                  : null;

                return (
                  <div
                    key={stage.key}
                    onClick={() => handleStageClick(stage)}
                    role="button"
                    tabIndex={0}
                    aria-label={`${stage.label}: ${stageStatus(stage.key)}`}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleStageClick(stage); } }}
                    style={{
                      textAlign: 'center', cursor: 'pointer',
                      ...(animate ? { opacity: 0, animation: `heroFadeUp 0.5s ${0.8 + i * 0.15}s forwards` } : {}),
                    }}
                  >
                    {/* Node */}
                    <div style={{
                      width: 56, height: 56, borderRadius: '50%',
                      background: isActive ? T.forest : T.cream,
                      border: `1px solid ${isActive ? T.forest : T.goldLine}`,
                      margin: '0 auto 16px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      position: 'relative',
                      color: isActive ? T.gold : T.forest,
                      transition: 'transform 0.25s, box-shadow 0.25s',
                      boxShadow: isActive ? `0 0 0 5px ${T.oxbloodSoft}` : 'none',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = isActive ? `0 0 0 5px ${T.oxbloodSoft}` : '0 4px 16px rgba(15,61,46,0.08)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = isActive ? `0 0 0 5px ${T.oxbloodSoft}` : 'none'; }}
                    >
                      {ICONS[stage.key]}

                      {/* Badge */}
                      {badge && (
                        <div style={{
                          position: 'absolute', top: -4, right: -4,
                          minWidth: 18, height: 18, padding: '0 5px',
                          borderRadius: 10,
                          background: badge.type === 'alert' ? T.oxblood : T.forest,
                          color: T.cream, fontSize: '9.5px', fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          border: `2.5px solid ${T.cream}`, fontFamily: T.mono,
                        }}>
                          {badge.count}
                        </div>
                      )}

                      {/* Pulse ring on active defend */}
                      {isActive && stage.key === 'defend' && !prefersReduced && (
                        <div style={{
                          position: 'absolute', inset: -5, borderRadius: '50%',
                          border: `1px solid ${T.oxblood}`,
                          animation: 'heroPulse 2.4s infinite',
                        }} />
                      )}
                    </div>

                    {/* Label */}
                    <div className="lifecycle-stage-label" style={{
                      fontFamily: T.serif, fontSize: 17, fontWeight: 500,
                      marginBottom: 4, letterSpacing: '-0.005em', color: T.forest,
                    }}>
                      {stage.label}
                    </div>

                    {/* Status */}
                    <div className="lifecycle-stage-status" style={{
                      fontSize: '11.5px', letterSpacing: '0.02em',
                      color: isActive && stage.key === 'defend' ? T.oxblood : T.forestText3,
                      fontWeight: isActive && stage.key === 'defend' ? 500 : 400,
                    }}>
                      {stageStatus(stage.key)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Footer strip */}
          <div style={{
            marginTop: 44, paddingTop: 22,
            borderTop: `1px solid ${T.forestSoft}`,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            flexWrap: 'wrap', gap: 16,
            ...anim(1.6),
          }}>
            <div style={{ fontFamily: T.mono, fontSize: 12, color: T.forestText2, letterSpacing: '0.02em' }}>
              {activeCount} active positions &nbsp;&middot;&nbsp; {capitalDeployedPct}% capital deployed
              {exitsFlagged > 0 && (
                <> &nbsp;&middot;&nbsp; <span style={{ color: T.oxblood, fontWeight: 700 }}>{exitsFlagged} need attention</span></>
              )}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              {exitsFlagged > 0 ? (
                <button onClick={() => document.querySelector('[data-section="defend"]')?.scrollIntoView({ behavior: 'smooth' })} style={btnPrimary}>
                  Review exits &rarr;
                </button>
              ) : (
                <button onClick={() => navigate('/invest/discover')} style={btnPrimary}>
                  Discover ideas &rarr;
                </button>
              )}
              <button onClick={() => navigate('/invest/discover')} style={btnGhost}>
                {exitsFlagged > 0 ? 'Discover ideas' : 'View positions'}
              </button>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}

// Shared button styles
const btnPrimary = {
  padding: '10px 18px', borderRadius: 4, fontFamily: "'DM Sans', 'Inter', sans-serif",
  fontSize: '12.5px', fontWeight: 500, letterSpacing: '0.04em', cursor: 'pointer',
  background: '#0F3D2E', color: '#F7F4EE', border: '1px solid #0F3D2E',
};
const btnGhost = {
  padding: '10px 18px', borderRadius: 4, fontFamily: "'DM Sans', 'Inter', sans-serif",
  fontSize: '12.5px', fontWeight: 500, letterSpacing: '0.04em', cursor: 'pointer',
  background: 'transparent', color: '#0F3D2E', border: '1px solid rgba(15,61,46,0.22)',
};

function usePrefersReducedMotion() {
  const [p, setP] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setP(mq.matches);
    const h = (e) => setP(e.matches);
    mq.addEventListener('change', h);
    return () => mq.removeEventListener('change', h);
  }, []);
  return p;
}
