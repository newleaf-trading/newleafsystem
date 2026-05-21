/**
 * /how-we-pick — scrollytelling marketing page.
 *
 * Tells the story of how NewLeaf filters 11,342 tickers down to 3 daily recommendations.
 * Phase 1 of 4 visualisation pages. Pure scrollytelling, no interactive controls.
 *
 * Architecture:
 *   - DotField.jsx: Canvas-based dot particle system (D3 for layout, Canvas for rendering)
 *   - ScrollOrchestration.jsx: GSAP ScrollTrigger pinning and timeline
 *   - This file: page layout, captions, hero, CTA
 */
import { useRef, useState, useEffect, useCallback } from 'react';
import { DotField } from './DotField';
import { useScrollOrchestration } from './ScrollOrchestration';
import PageSEO from '../../shared/components/PageSEO';

// ═══════════════════════════════════════════════════════════════
// Stage data — drives both captions and dot transitions
// ═══════════════════════════════════════════════════════════════

const STAGES = [
  {
    id: 'universe',
    count: 11342,
    caption: "The US options market. Every stock, every ETF. Thousands of tickers, most of which will never produce a good trade today.",
    transition: 'grid', // initial full grid
  },
  {
    id: 'liquidity',
    count: 1847,
    caption: "Most tickers have options in name only. We drop anything with tight bid-ask spreads or thin open interest \u2014 executing a 4-leg spread needs real depth.",
    transition: 'fade-majority',
  },
  {
    id: 'volatility',
    count: 412,
    caption: "Premium-selling works in a specific zone of fear. Too calm and there\u2019s nothing to collect. Too scared and something\u2019s wrong. We find each stock\u2019s sweet spot.",
    transition: 'histogram',
  },
  {
    id: 'events',
    count: 287,
    caption: "Earnings and dividends inside our trading window introduce binary risk that wasn\u2019t in the original thesis. We skip them.",
    transition: 'calendar',
  },
  {
    id: 'technicals',
    count: 164,
    caption: "Is the stock at a level where big options dealers are likely to defend price? At a clean technical level? Or is it fighting the trend? We check the chart context.",
    transition: 'chart-context',
  },
  {
    id: 'strikes',
    count: 87,
    caption: "Choosing which strikes to sell at is the whole game. We use delta targets and expected-move sizing, not round numbers.",
    transition: 'strike-ladder',
  },
  {
    id: 'scoring',
    count: 12,
    caption: "Every candidate gets scored for probability of profit, risk-reward, and expected value. If any is below our floor, it\u2019s dropped.",
    transition: 'funnel',
  },
  {
    id: 'final',
    count: 3,
    caption: "The three best trades of the day. Ranked by expected return on capital. Ready to review.",
    transition: 'cards',
  },
];

const LABELLED_SYMBOLS = ['AAPL', 'MSFT', 'QQQ', 'SPY', 'TSLA', 'AMZN', 'NVDA', 'META', 'GOOG', 'AMD',
  'NFLX', 'DIS', 'JPM', 'BA', 'COST', 'CRM', 'ADBE', 'V', 'MA', 'HON'];

// ═══════════════════════════════════════════════════════════════
// Page navigation items
// ═══════════════════════════════════════════════════════════════

const NAV_ITEMS = [
  { label: 'How We Pick', href: '/how-we-pick', active: true },
  { label: 'How We Recommend', href: '/how-we-recommend' },
  { label: 'How We Manage', href: '/how-we-manage' },
  { label: 'Track Record', href: '/track-record' },
];

// ═══════════════════════════════════════════════════════════════
// Main page component
// ═══════════════════════════════════════════════════════════════

export function HowWePickPage() {
  const containerRef = useRef(null);
  const [currentStage, setCurrentStage] = useState(0);
  const [displayCount, setDisplayCount] = useState(STAGES[0].count);
  const prefersReducedMotion = usePrefersReducedMotion();

  // Wire scroll-driven stage transitions
  useScrollOrchestration(
    containerRef,
    prefersReducedMotion ? [] : STAGES, // disable orchestration when reduced motion
    setCurrentStage,
    setDisplayCount,
  );

  return (
    <div
      ref={containerRef}
      style={{
        fontFamily: "'Inter', -apple-system, sans-serif",
        background: '#F7F4EE',
        color: '#0B0F14',
        minHeight: '100vh',
      }}
    >
      <PageSEO
        title="How We Pick — NewLeaf Scoring Algorithm"
        description="Learn how NewLeaf's 4-engine AI system scores options opportunities using implied volatility rank, gamma wall positioning, trend analysis, and multi-timeframe technical signals."
        path="/how-we-pick"
      />
      {/* Scrollbar styling */}
      <style>{`
        .how-we-pick-page::-webkit-scrollbar { width: 10px; }
        .how-we-pick-page::-webkit-scrollbar-track { background: transparent; }
        .how-we-pick-page::-webkit-scrollbar-thumb {
          background: rgba(15,61,46,0.30); border-radius: 5px;
        }
        .how-we-pick-page::-webkit-scrollbar-thumb:hover {
          background: rgba(15,61,46,0.60);
        }
        html { scrollbar-color: rgba(15,61,46,0.30) transparent; scrollbar-width: thin; }
        @keyframes bounce-arrow {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(6px); }
        }
      `}</style>
      {/* Mini-nav removed — main Nav provides navigation via "How it works" dropdown */}

      {/* ─── Stage progress indicator ─── */}
      {!prefersReducedMotion && (
        <StageProgressIndicator
          stages={STAGES}
          currentStage={currentStage}
          containerRef={containerRef}
        />
      )}

      {/* ─── Hero ─── */}
      <section style={{
        maxWidth: 800, margin: '0 auto', padding: '120px 2rem 80px',
        textAlign: 'center',
      }}>
        <h1 style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 'clamp(36px, 5vw, 56px)',
          fontWeight: 400, lineHeight: 1.1,
          letterSpacing: '-1.5px',
          color: '#0B2D23', marginBottom: 16,
        }}>
          How we find trades worth taking
        </h1>
        <p style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 'clamp(16px, 2vw, 20px)',
          fontStyle: 'italic',
          color: '#C9A96E', marginBottom: 32,
          letterSpacing: '-0.2px',
        }}>
          Every morning, before you open the app
        </p>
        <p style={{
          fontSize: 15, lineHeight: 1.75,
          color: '#6b6b60', maxWidth: 560, margin: '0 auto',
        }}>
          The options market is enormous. Thousands of tickers, millions of contracts, most of them noise.
          Our pipeline runs before the opening bell, filtering the entire US options market down to the
          handful of structures where the math is on your side. Here's how.
        </p>

        {/* Scroll indicator — fades out once user scrolls past hero */}
        <ScrollIndicator />

        {/* Auto-play button */}
        {!prefersReducedMotion && (
          <AutoPlayButton containerRef={containerRef} stages={STAGES} />
        )}
      </section>

      {/* ─── Scrollytelling sections ─── */}
      {prefersReducedMotion ? (
        // Static fallback: show each stage's final state
        <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 2rem 60px' }}>
          {STAGES.map((stage, i) => (
            <section key={stage.id} style={{ marginBottom: 80 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 16 }}>
                <span style={{
                  fontFamily: "'Space Mono', monospace", fontSize: 32, fontWeight: 700,
                  color: '#0B2D23',
                }}>
                  {stage.count.toLocaleString()}
                </span>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#C9A96E', textTransform: 'uppercase', letterSpacing: '.1em' }}>
                  tickers remaining
                </span>
              </div>
              <p style={{ fontSize: 16, lineHeight: 1.7, color: '#374151', maxWidth: 600 }}>
                {stage.caption}
              </p>
              {i < STAGES.length - 1 && (
                <div style={{ width: 1, height: 40, background: 'rgba(11,45,35,0.12)', margin: '24px 0 0 16px' }} />
              )}
            </section>
          ))}
        </div>
      ) : (
        // Animated scrollytelling — Phase 3 will add GSAP orchestration
        // For now, render sections statically with DotField placeholder
        <div style={{ position: 'relative' }}>
          {/* Sticky dot field container */}
          <div style={{
            position: 'sticky', top: 0, height: '100vh',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none',
          }}>
            {/* Canvas dot field — fades out on final stage */}
            <div style={{
              opacity: currentStage === 7 ? 0 : 1,
              transition: 'opacity 0.6s ease',
            }}>
              <DotField
                stage={currentStage}
                stages={STAGES}
                labelledSymbols={LABELLED_SYMBOLS}
              />
            </div>

            {/* Stage 8: packed bubble hero + tile cards below */}
            {currentStage === 7 && (
              <div style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%, -50%)',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24,
                opacity: 1,
                animation: 'fadeIn 0.6s ease',
                pointerEvents: 'auto',
              }}>
                {/* Packed bubble hero */}
                <PackedBubbleChart />

                {/* Discover-style tile cards (secondary) */}
                <div style={{ display: 'flex', gap: 16 }}>
                {[
                  { symbol: 'AAPL', strategy: 'Iron Condor', roc: '8%', prob: '72%', maxProfit: '$224', maxLoss: '$276' },
                  { symbol: 'NVDA', strategy: 'Bull Put Spread', roc: '11%', prob: '68%', maxProfit: '$165', maxLoss: '$835' },
                  { symbol: 'QQQ', strategy: 'Iron Condor', roc: '7%', prob: '75%', maxProfit: '$182', maxLoss: '$818' },
                ].map(tile => (
                  <div key={tile.symbol} style={{
                    background: '#fff', border: '1px solid rgba(17,24,39,0.10)',
                    borderRadius: 16, padding: 12, width: 200,
                    boxShadow: '0 4px 12px rgba(17,24,39,0.04)',
                    fontSize: 12,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <div style={{ fontWeight: 900, fontSize: 14 }}>{tile.symbol}</div>
                      <span style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
                        padding: '2px 6px', borderRadius: 999,
                        background: 'rgba(201,169,110,0.12)', color: 'rgba(17,24,39,0.7)',
                      }}>
                        {tile.strategy}
                      </span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {[
                        { label: 'Prob', value: tile.prob },
                        { label: 'ROC', value: tile.roc },
                      ].map(m => (
                        <div key={m.label} style={{
                          background: 'rgba(247,248,250,0.65)', borderRadius: 8, padding: 6,
                        }}>
                          <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(17,24,39,0.4)', marginBottom: 2 }}>
                            {m.label}
                          </div>
                          <div style={{ fontSize: 13, fontWeight: 900 }}>{m.value}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                </div>
              </div>
            )}

            {/* Counter overlay */}
            <div style={{
              position: 'absolute', bottom: 60, left: '50%', transform: 'translateX(-50%)',
              textAlign: 'center',
            }}>
              <div style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 'clamp(36px, 6vw, 56px)',
                fontWeight: 700, color: '#0B2D23',
                letterSpacing: '-1px',
              }}>
                {displayCount.toLocaleString()}
              </div>
              <div style={{
                fontSize: 11, fontWeight: 600, color: '#C9A96E',
                textTransform: 'uppercase', letterSpacing: '.12em',
                marginTop: 4,
              }}>
                tickers remaining
              </div>
            </div>
          </div>

          {/* Caption sections — scroll past the sticky dot field */}
          {STAGES.map((stage, i) => (
            <section
              key={stage.id}
              data-stage={i}
              style={{
                minHeight: '100vh',
                display: 'flex', alignItems: 'center',
                padding: '0 2rem',
              }}
            >
              <div style={{
                maxWidth: 400,
                marginLeft: 'auto',
                padding: '40px 32px',
                background: 'rgba(255,255,255,0.88)',
                backdropFilter: 'blur(8px)',
                borderRadius: 16,
                border: '1px solid rgba(11,15,20,0.06)',
                boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
              }}>
                <div style={{
                  fontFamily: "'Space Mono', monospace",
                  fontSize: 10, fontWeight: 700,
                  color: '#C9A96E', textTransform: 'uppercase',
                  letterSpacing: '.16em', marginBottom: 12,
                }}>
                  Stage {i + 1} of {STAGES.length}
                </div>
                <p style={{
                  fontSize: 16, lineHeight: 1.7, color: '#374151',
                  margin: 0,
                }}>
                  {stage.caption}
                </p>
              </div>
            </section>
          ))}
        </div>
      )}

      {/* ─── CTA section ─── */}
      <section style={{
        maxWidth: 600, margin: '0 auto', padding: '80px 2rem 120px',
        textAlign: 'center',
      }}>
        <h2 style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 'clamp(24px, 3.5vw, 36px)',
          fontWeight: 400, color: '#0B2D23',
          marginBottom: 12, letterSpacing: '-0.5px',
        }}>
          That's the funnel. Every morning.
        </h2>
        <p style={{
          fontSize: 15, color: '#6b6b60', lineHeight: 1.7,
          marginBottom: 32,
        }}>
          The three trades that survive are the ones worth your attention.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            disabled
            style={{
              padding: '14px 28px', borderRadius: 10,
              background: 'rgba(11,45,35,0.06)', border: '1px solid rgba(11,45,35,0.12)',
              fontSize: 14, fontWeight: 600, color: '#9ca3af',
              cursor: 'default',
            }}
          >
            See how we recommend trades &rarr;
            <span style={{ fontSize: 10, marginLeft: 6, opacity: 0.6 }}>coming soon</span>
          </button>
          <a
            href="/invest"
            style={{
              padding: '14px 28px', borderRadius: 10,
              background: '#C9A96E', color: '#0B2D23',
              fontSize: 14, fontWeight: 700, textDecoration: 'none',
              boxShadow: '0 4px 16px rgba(201,169,110,0.25)',
              display: 'inline-block',
            }}
          >
            Start your free trial &rarr;
          </a>
        </div>
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Accessibility hook
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// Packed bubble chart — Stage 8 hero visual
// ═══════════════════════════════════════════════════════════════

function PackedBubbleChart() {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Lazy-import Highcharts + more module to keep bundle isolated
    Promise.all([
      import('highcharts'),
      import('highcharts/highcharts-more'),
    ]).then(([Highcharts, HighchartsMore]) => {
      const HC = Highcharts.default || Highcharts;
      const HCMore = HighchartsMore.default || HighchartsMore;
      HCMore(HC);

      chartRef.current = HC.chart(containerRef.current, {
        chart: {
          type: 'packedbubble',
          backgroundColor: 'transparent',
          height: 200,
          style: { fontFamily: "'Inter', sans-serif" },
          animation: { duration: 600 },
        },
        title: { text: null },
        credits: { enabled: false },
        legend: { enabled: false },
        tooltip: {
          backgroundColor: '#0B2D23',
          borderColor: '#1a5c44',
          borderRadius: 8,
          style: { color: '#fff', fontSize: '12px', fontFamily: "'Space Mono', monospace" },
          pointFormat: '<b>{point.name}</b><br/>{point.strategy}<br/>ROC: {point.roc}',
          useHTML: true,
        },
        plotOptions: {
          packedbubble: {
            minSize: '40%',
            maxSize: '80%',
            layoutAlgorithm: {
              gravitationalConstant: 0.02,
              splitSeries: false,
            },
            dataLabels: {
              enabled: true,
              format: '{point.name}',
              style: {
                fontSize: '14px',
                fontWeight: '900',
                color: '#fff',
                textOutline: 'none',
                fontFamily: "'Space Mono', monospace",
              },
            },
          },
        },
        series: [{
          data: [
            { name: 'AAPL', value: 8, color: '#0F3D2E', strategy: 'Iron Condor', roc: '8%' },
            { name: 'NVDA', value: 11, color: '#C8A85A', strategy: 'Bull Put Spread', roc: '11%' },
            { name: 'QQQ', value: 7, color: '#0F3D2E', strategy: 'Iron Condor', roc: '7%' },
          ],
        }],
      });
    });

    return () => {
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
    };
  }, []);

  return <div ref={containerRef} style={{ width: 400, maxWidth: '90vw' }} />;
}

// ═══════════════════════════════════════════════════════════════
// Scroll indicator — bouncing arrow below hero, fades on scroll
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// Auto-play button — smoothly scrolls through all stages
// ═══════════════════════════════════════════════════════════════

function AutoPlayButton({ containerRef, stages }) {
  const [playing, setPlaying] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const timerRef = useRef(null);
  const stageIndexRef = useRef(0);
  const userScrolledRef = useRef(false);

  useEffect(() => {
    setIsMobile(window.innerWidth < 768);
  }, []);

  // Detect manual scroll during autoplay — stop if user scrolls
  useEffect(() => {
    if (!playing) return;
    userScrolledRef.current = false;

    const handleUserScroll = () => {
      // Only count as "user scroll" if we're not the ones scrolling
      if (!userScrolledRef.current) {
        userScrolledRef.current = true;
        // Give a brief window — our programmatic scroll also fires this
        setTimeout(() => {
          if (userScrolledRef.current) {
            setPlaying(false);
          }
        }, 100);
      }
    };

    // Use wheel/touch events specifically — these are user-initiated
    window.addEventListener('wheel', () => setPlaying(false), { once: true, passive: true });
    window.addEventListener('touchmove', () => setPlaying(false), { once: true, passive: true });

    return () => {
      window.removeEventListener('wheel', () => setPlaying(false));
      window.removeEventListener('touchmove', () => setPlaying(false));
    };
  }, [playing]);

  // Auto-scroll through stages
  useEffect(() => {
    if (!playing || !containerRef.current) {
      clearInterval(timerRef.current);
      return;
    }

    stageIndexRef.current = 0;
    const sections = containerRef.current.querySelectorAll('[data-stage]');
    if (sections.length === 0) { setPlaying(false); return; }

    const advanceStage = () => {
      if (stageIndexRef.current >= sections.length) {
        setPlaying(false);
        return;
      }
      sections[stageIndexRef.current].scrollIntoView({ behavior: 'smooth', block: 'center' });
      stageIndexRef.current++;
    };

    // Start immediately, then every 3.5 seconds
    advanceStage();
    timerRef.current = setInterval(advanceStage, 3500);

    return () => clearInterval(timerRef.current);
  }, [playing, containerRef]);

  if (isMobile) {
    return (
      <div style={{ textAlign: 'center', marginTop: 16 }}>
        <span style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>
          Auto-play (desktop only)
        </span>
      </div>
    );
  }

  return (
    <div style={{ textAlign: 'center', marginTop: 16 }}>
      <button
        onClick={() => setPlaying(p => !p)}
        style={{
          padding: '8px 20px', borderRadius: 20,
          background: playing ? 'rgba(11,45,35,0.08)' : 'transparent',
          border: '1px solid rgba(11,45,35,0.15)',
          fontSize: 13, fontWeight: 600, color: '#0B2D23',
          cursor: 'pointer', transition: 'background 0.15s',
          display: 'inline-flex', alignItems: 'center', gap: 6,
        }}
      >
        {playing ? (
          <><span style={{ fontSize: 11 }}>&#9646;&#9646;</span> Pause</>
        ) : (
          <><span style={{ fontSize: 11 }}>&#9654;</span> Play automatically</>
        )}
      </button>
    </div>
  );
}

function ScrollIndicator() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 400) setVisible(false);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div style={{
      textAlign: 'center', marginTop: 48,
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.6s ease',
      pointerEvents: visible ? 'auto' : 'none',
    }}>
      <div style={{ fontSize: 13, fontWeight: 500, color: '#0B2D23', marginBottom: 10 }}>
        Scroll to watch the market get filtered
      </div>
      <svg
        width="32" height="32" viewBox="0 0 32 32" fill="none"
        style={{ animation: 'bounce-arrow 1.2s ease-in-out infinite' }}
      >
        <path d="M8 12l8 8 8-8" stroke="#0B2D23" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Stage progress indicator — fixed left-side dots
// ═══════════════════════════════════════════════════════════════

const STAGE_TITLES = [
  '1. The universe',
  '2. Liquidity gate',
  '3. Volatility regime',
  '4. Event check',
  '5. Technical context',
  '6. Strike construction',
  '7. Scoring',
  '8. Today\u2019s three',
];

function StageProgressIndicator({ stages, currentStage, containerRef }) {
  const [visible, setVisible] = useState(false);
  const [hoveredDot, setHoveredDot] = useState(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const heroEnd = 500; // approximate hero height
      const pageBottom = document.body.scrollHeight - window.innerHeight - 200;
      const y = window.scrollY;
      setVisible(y > heroEnd && y < pageBottom);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToStage = (index) => {
    const section = containerRef.current?.querySelector(`[data-stage="${index}"]`);
    if (section) section.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  if (!visible) return null;

  // Mobile: horizontal bottom bar
  if (isMobile) {
    return (
      <div style={{
        position: 'fixed', bottom: 12, left: '50%', transform: 'translateX(-50%)',
        zIndex: 90, display: 'flex', gap: 8, alignItems: 'center',
        background: 'rgba(255,255,255,0.85)', backdropFilter: 'blur(8px)',
        padding: '8px 14px', borderRadius: 20,
        border: '1px solid rgba(11,15,20,0.06)', boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
      }}>
        {stages.map((_, i) => (
          <button
            key={i}
            onClick={() => scrollToStage(i)}
            style={{
              width: currentStage === i ? 12 : 8,
              height: currentStage === i ? 12 : 8,
              borderRadius: '50%', border: 'none', padding: 0, cursor: 'pointer',
              background: '#0B2D23',
              opacity: currentStage === i ? 1 : 0.25,
              transition: 'all 0.2s ease',
            }}
            aria-label={STAGE_TITLES[i]}
          />
        ))}
      </div>
    );
  }

  // Desktop: vertical left-side dots
  return (
    <div style={{
      position: 'fixed', left: 40, top: '50%', transform: 'translateY(-50%)',
      zIndex: 90, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
    }}>
      {stages.map((_, i) => (
        <div key={i} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          {/* Connecting line (between dots, not above first or below last) */}
          {i > 0 && (
            <div style={{
              position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
              width: 1, height: 10, background: 'rgba(11,45,35,0.15)',
            }} />
          )}
          <button
            onClick={() => scrollToStage(i)}
            onMouseEnter={() => setHoveredDot(i)}
            onMouseLeave={() => setHoveredDot(null)}
            style={{
              width: currentStage === i ? 12 : 8,
              height: currentStage === i ? 12 : 8,
              borderRadius: '50%', border: 'none', padding: 0, cursor: 'pointer',
              background: '#0B2D23',
              opacity: currentStage === i ? 1 : 0.25,
              transition: 'all 0.2s ease',
              marginTop: i > 0 ? 10 : 0,
            }}
            aria-label={STAGE_TITLES[i]}
          />
          {/* Tooltip */}
          {hoveredDot === i && (
            <div style={{
              position: 'absolute', left: 22, top: '50%', transform: 'translateY(-50%)',
              whiteSpace: 'nowrap', fontSize: 12, fontWeight: 600, color: '#0B2D23',
              background: 'rgba(255,255,255,0.92)', backdropFilter: 'blur(6px)',
              padding: '4px 10px', borderRadius: 6,
              border: '1px solid rgba(11,15,20,0.08)', boxShadow: '0 2px 6px rgba(0,0,0,0.06)',
            }}>
              {STAGE_TITLES[i]}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Accessibility hook
// ═══════════════════════════════════════════════════════════════

function usePrefersReducedMotion() {
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(mq.matches);
    const handler = (e) => setPrefersReduced(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  return prefersReduced;
}
