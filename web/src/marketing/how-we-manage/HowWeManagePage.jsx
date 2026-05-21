/**
 * /how-we-manage — Interactive trade lifecycle visualisation.
 *
 * User controls a time-scrubber to step through a 45-day Iron Condor lifecycle.
 * All visuals derive from a single piece of state: currentSessionIndex.
 *
 * Components:
 *   - TimeScrubber: draggable timeline with verdict bands
 *   - VitalsStrip: spot, delta, DTE, P&L tiles
 *   - VerdictPill: colour-coded state indicator
 *   - DecisionTree: rule hierarchy with active-path highlighting
 *   - AdjustmentPreview: slides in during ACTION_NEEDED/EXIT
 *   - CaptionCard: narrator text that updates per session
 */
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { evaluate, VERDICT } from '../../trading/utils/verdictEngine';
import { getValidAdjustments } from '../../trading/utils/adjustmentCatalogue';
import { PayoffChart } from '../../trading/components/PayoffChart';
import { DEMO_SESSIONS, DEMO_POSITION, sessionToMarketData, getCaptionForSession } from './demoTradeData';
import PageSEO from '../../shared/components/PageSEO';

const VERDICT_COLOURS = {
  ON_TRACK: '#0B7A52',
  MONITOR: '#B7791F',
  ACTION_NEEDED: '#ea580c',
  TAKE_PROFIT: '#0B7A52',
  EXIT: '#C94F4F',
};

const VERDICT_BG = {
  ON_TRACK: 'rgba(11,122,82,0.12)',
  MONITOR: 'rgba(183,121,31,0.12)',
  ACTION_NEEDED: 'rgba(234,88,12,0.12)',
  TAKE_PROFIT: 'rgba(11,122,82,0.12)',
  EXIT: 'rgba(201,79,79,0.12)',
};

const VERDICT_LABELS = {
  ON_TRACK: 'On Track',
  MONITOR: 'Monitor',
  ACTION_NEEDED: 'Action Needed',
  TAKE_PROFIT: 'Take Profit',
  EXIT: 'Exit',
};

const NAV_ITEMS = [
  { label: 'How We Pick', href: '/how-we-pick' },
  { label: 'How We Manage', href: '/how-we-manage', active: true },
  { label: 'How We Recommend', href: '/how-we-recommend' },
  { label: 'Track Record', href: '/track-record' },
];

const TOTAL_SESSIONS = DEMO_SESSIONS.length;

export function HowWeManagePage() {
  const [sessionIndex, setSessionIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const playRef = useRef(null);
  const prefersReducedMotion = usePrefersReducedMotion();

  const session = DEMO_SESSIONS[sessionIndex];

  // Compute verdict from the real engine
  const verdict = useMemo(() => {
    const md = sessionToMarketData(session);
    return evaluate({ ...DEMO_POSITION }, md);
  }, [sessionIndex]);

  // Compute all verdict states for the band visualisation
  const verdictBands = useMemo(() => {
    return DEMO_SESSIONS.map(s => {
      const md = sessionToMarketData(s);
      return evaluate({ ...DEMO_POSITION }, md).state;
    });
  }, []);

  // Adjustment recommendations (only computed when ACTION_NEEDED or EXIT)
  const adjustments = useMemo(() => {
    if (verdict.state !== 'ACTION_NEEDED' && verdict.state !== 'EXIT') return null;
    const md = sessionToMarketData(session);
    const pos = {
      ...DEMO_POSITION,
      legs: DEMO_POSITION.legs,
      maxLoss: DEMO_POSITION.maxLoss,
      entryNetCredit: DEMO_POSITION.entryNetCredit,
      expiry: DEMO_POSITION.expiry,
    };
    return getValidAdjustments(pos, md);
  }, [sessionIndex, verdict.state]);

  const caption = getCaptionForSession(sessionIndex);

  // Play/pause auto-advance
  useEffect(() => {
    if (!isPlaying) { clearInterval(playRef.current); return; }
    playRef.current = setInterval(() => {
      setSessionIndex(prev => {
        if (prev >= TOTAL_SESSIONS - 1) { setIsPlaying(false); return prev; }
        return prev + 1;
      });
    }, 500); // 2 sessions per second
    return () => clearInterval(playRef.current);
  }, [isPlaying]);

  // Keyboard nav
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'ArrowRight') setSessionIndex(prev => Math.min(prev + 1, TOTAL_SESSIONS - 1));
      if (e.key === 'ArrowLeft') setSessionIndex(prev => Math.max(prev - 1, 0));
      if (e.key === ' ') { e.preventDefault(); setIsPlaying(p => !p); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const showAdjustments = verdict.state === 'ACTION_NEEDED' || verdict.state === 'EXIT';

  return (
    <div style={{
      fontFamily: "'Inter', -apple-system, sans-serif",
      background: '#F7F4EE', color: '#0B0F14', minHeight: '100vh',
    }}>
      <PageSEO
        title="How We Manage — Risk Management Framework"
        description="Discover NewLeaf's position management framework including entry/exit rules, adjustment triggers, max loss thresholds, and portfolio-level risk controls for options trading."
        path="/how-we-manage"
      />
      {/* Scrollbar styling */}
      <style>{`
        html { scrollbar-color: rgba(15,61,46,0.30) transparent; scrollbar-width: thin; }
        ::-webkit-scrollbar { width: 10px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(15,61,46,0.30); border-radius: 5px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(15,61,46,0.60); }
      `}</style>

      {/* Mini-nav removed — main Nav provides navigation via "How it works" dropdown */}

      {/* ─── Hero ─── */}
      <section style={{ maxWidth: 800, margin: '0 auto', padding: '120px 2rem 60px', textAlign: 'center' }}>
        <h1 style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 400, lineHeight: 1.1,
          letterSpacing: '-1.5px', color: '#0B2D23', marginBottom: 16,
        }}>
          What happens when a trade goes wrong
        </h1>
        <p style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 'clamp(16px, 2vw, 20px)', fontStyle: 'italic',
          color: '#C9A96E', marginBottom: 32,
        }}>
          Every position, every session, until expiry
        </p>
        <p style={{ fontSize: 15, lineHeight: 1.75, color: '#6b6b60', maxWidth: 560, margin: '0 auto' }}>
          Most positions don't go straight to profit. They wobble, test limits, flirt with their danger lines,
          recover, get re-tested. Watching every one of them is exhausting — for you. We built a system that
          does it instead. Here's what it watches for, and how it decides when to act.
        </p>
      </section>

      {/* ─── Main visualisation ─── */}
      <section style={{ maxWidth: 1200, margin: '0 auto', padding: '0 2rem 40px' }}>

        {/* Top row: payoff chart + vitals */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 20, marginBottom: 20 }}>
          {/* Payoff chart */}
          <div style={{
            background: '#fff', border: '1px solid rgba(17,24,39,0.08)',
            borderRadius: 16, padding: 8, overflow: 'hidden',
          }}>
            <PayoffChart
              legs={DEMO_POSITION.legs}
              spotPrice={session.spot}
              height={280}
              accentColor={VERDICT_COLOURS[verdict.state]}
            />
          </div>

          {/* Vitals strip + verdict */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Verdict pill */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '12px 16px', borderRadius: 12,
              background: VERDICT_BG[verdict.state],
              border: `1px solid ${VERDICT_COLOURS[verdict.state]}30`,
              transition: prefersReducedMotion ? 'none' : 'background 0.3s, border-color 0.3s',
            }}>
              <span style={{
                width: 10, height: 10, borderRadius: '50%',
                background: VERDICT_COLOURS[verdict.state],
                transition: prefersReducedMotion ? 'none' : 'background 0.3s',
              }} />
              <span style={{
                fontSize: 14, fontWeight: 700, color: VERDICT_COLOURS[verdict.state],
                fontFamily: "'Space Mono', monospace", textTransform: 'uppercase',
                letterSpacing: '.08em',
              }}>
                {VERDICT_LABELS[verdict.state]}
              </span>
            </div>

            {/* Vitals tiles */}
            <VitalTile label="Spot Price" value={`$${session.spot.toFixed(2)}`} color="#0B2D23" />
            <VitalTile
              label="Short Delta"
              value={session.shortDelta.toFixed(2)}
              color={session.shortDelta >= 0.35 ? '#C94F4F' : session.shortDelta >= 0.25 ? '#B7791F' : '#0B7A52'}
            />
            <VitalTile label="Days Left" value={`${session.dte} days`} color={session.dte <= 21 ? '#B7791F' : '#0B2D23'} />
            <VitalTile
              label="Current P&L"
              value={`${session.pnl >= 0 ? '+' : ''}$${session.pnl}`}
              color={session.pnl >= 0 ? '#0B7A52' : '#C94F4F'}
            />
          </div>
        </div>

        {/* ─── Time scrubber ─── */}
        <TimeScrubber
          sessionIndex={sessionIndex}
          totalSessions={TOTAL_SESSIONS}
          verdictBands={verdictBands}
          onSessionChange={setSessionIndex}
          isPlaying={isPlaying}
          onPlayToggle={() => setIsPlaying(p => !p)}
          onPrev={() => setSessionIndex(prev => Math.max(prev - 1, 0))}
          onNext={() => setSessionIndex(prev => Math.min(prev + 1, TOTAL_SESSIONS - 1))}
        />

        {/* Bottom row: decision tree + adjustment preview */}
        <div style={{ display: 'grid', gridTemplateColumns: showAdjustments ? '1fr 1fr' : '1fr', gap: 20, marginTop: 20 }}>
          {/* Decision tree */}
          <DecisionTree verdictState={verdict.state} reason={verdict.reason} />

          {/* Adjustment preview — slides in on ACTION_NEEDED/EXIT */}
          {showAdjustments && adjustments && (
            <div style={{
              animation: prefersReducedMotion ? 'none' : 'slideIn 0.3s ease',
            }}>
              <style>{`@keyframes slideIn { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }`}</style>
              <AdjustmentPreview adjustments={adjustments} />
            </div>
          )}
        </div>

        {/* Caption card */}
        <div style={{
          marginTop: 24, padding: '20px 24px', background: 'rgba(255,255,255,0.88)',
          backdropFilter: 'blur(8px)', borderRadius: 14,
          border: '1px solid rgba(11,15,20,0.06)', boxShadow: '0 2px 12px rgba(0,0,0,0.03)',
          maxWidth: 700,
        }}>
          <div style={{
            fontFamily: "'Space Mono', monospace", fontSize: 10, fontWeight: 700,
            color: '#C9A96E', textTransform: 'uppercase', letterSpacing: '.14em', marginBottom: 8,
          }}>
            Day {session.day} of 45
          </div>
          <p style={{ fontSize: 15, lineHeight: 1.7, color: '#374151', margin: 0 }}>
            {caption}
          </p>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section style={{ maxWidth: 600, margin: '0 auto', padding: '60px 2rem 100px', textAlign: 'center' }}>
        <h2 style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 'clamp(22px, 3.5vw, 32px)', fontWeight: 400, color: '#0B2D23',
          marginBottom: 12,
        }}>
          This happens for every position, every session.
        </h2>
        <p style={{ fontSize: 15, color: '#6b6b60', lineHeight: 1.7, marginBottom: 32 }}>
          45 days of monitoring, compressed into one timeline. In the real app, it runs for every position you own.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/how-we-pick" style={{
            padding: '14px 28px', borderRadius: 10,
            background: 'rgba(11,45,35,0.06)', border: '1px solid rgba(11,45,35,0.12)',
            fontSize: 14, fontWeight: 600, color: '#0B2D23', textDecoration: 'none',
          }}>
            See how we pick trades &rarr;
          </a>
          <a href="/invest" style={{
            padding: '14px 28px', borderRadius: 10,
            background: '#C9A96E', color: '#0B2D23',
            fontSize: 14, fontWeight: 700, textDecoration: 'none',
            boxShadow: '0 4px 16px rgba(201,169,110,0.25)',
          }}>
            Start your free trial &rarr;
          </a>
        </div>
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════

function VitalTile({ label, value, color }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid rgba(17,24,39,0.08)', borderRadius: 12, padding: '10px 14px',
    }}>
      <div style={{ fontSize: 9, fontWeight: 800, letterSpacing: '.12em', textTransform: 'uppercase', color: 'rgba(17,24,39,0.45)', marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 20, fontWeight: 700, color }}>
        {value}
      </div>
    </div>
  );
}

function TimeScrubber({ sessionIndex, totalSessions, verdictBands, onSessionChange, isPlaying, onPlayToggle, onPrev, onNext }) {
  const trackRef = useRef(null);

  const handleDrag = useCallback((e) => {
    const track = trackRef.current;
    if (!track) return;
    const rect = track.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX || 0) - rect.left;
    const pct = Math.max(0, Math.min(1, x / rect.width));
    onSessionChange(Math.round(pct * (totalSessions - 1)));
  }, [totalSessions, onSessionChange]);

  const startDrag = useCallback((e) => {
    handleDrag(e);
    const move = (ev) => handleDrag(ev);
    const up = () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); window.removeEventListener('touchmove', move); window.removeEventListener('touchend', up); };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    window.addEventListener('touchmove', move, { passive: true });
    window.addEventListener('touchend', up);
  }, [handleDrag]);

  const pct = sessionIndex / (totalSessions - 1) * 100;

  return (
    <div style={{ background: '#fff', border: '1px solid rgba(17,24,39,0.08)', borderRadius: 14, padding: '16px 20px' }}>
      {/* Controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
        <button onClick={onPrev} style={ctrlBtn} aria-label="Previous session">&larr;</button>
        <button onClick={onPlayToggle} style={{ ...ctrlBtn, width: 40 }} aria-label={isPlaying ? 'Pause' : 'Play'}>
          {isPlaying ? '⏸' : '▶'}
        </button>
        <button onClick={onNext} style={ctrlBtn} aria-label="Next session">&rarr;</button>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, color: '#0B2D23', marginLeft: 8 }}>
          Day {DEMO_SESSIONS[sessionIndex].day} of 45
        </span>
      </div>

      {/* Track with verdict bands */}
      <div
        ref={trackRef}
        onMouseDown={startDrag}
        onTouchStart={startDrag}
        style={{ position: 'relative', height: 32, cursor: 'pointer', borderRadius: 8, overflow: 'hidden', background: '#f3f1ec' }}
        role="slider"
        aria-valuenow={sessionIndex}
        aria-valuemin={0}
        aria-valuemax={totalSessions - 1}
        tabIndex={0}
      >
        {/* Verdict colour bands */}
        {verdictBands.map((state, i) => (
          <div key={i} style={{
            position: 'absolute', left: `${(i / totalSessions) * 100}%`, top: 0, bottom: 0,
            width: `${100 / totalSessions}%`,
            background: VERDICT_BG[state],
          }} />
        ))}

        {/* Scrubber head */}
        <div style={{
          position: 'absolute', left: `${pct}%`, top: 0, bottom: 0,
          transform: 'translateX(-50%)', width: 3, background: '#C9A96E',
          zIndex: 2,
        }}>
          <div style={{
            position: 'absolute', top: -6, left: '50%', transform: 'translateX(-50%)',
            width: 16, height: 16, borderRadius: '50%',
            background: '#C9A96E', border: '2px solid #fff',
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)', cursor: 'grab',
          }} />
        </div>

        {/* Day ticks */}
        {[0, 10, 20, 30, 40, 45].map(day => {
          const idx = DEMO_SESSIONS.findIndex(s => s.day === day);
          if (idx < 0) return null;
          return (
            <div key={day} style={{
              position: 'absolute', left: `${(idx / totalSessions) * 100}%`, bottom: 2,
              fontSize: 8, color: '#9ca3af', fontWeight: 600, transform: 'translateX(-50%)',
            }}>
              {day}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DecisionTree({ verdictState, reason }) {
  const rules = [
    { state: 'EXIT', label: 'Exit', rules: ['Loss ≥ 1.5× credit', 'Strike breached 2+ sessions'] },
    { state: 'TAKE_PROFIT', label: 'Take Profit', rules: ['≥ 50% of max profit captured'] },
    { state: 'ACTION_NEEDED', label: 'Action Needed', rules: ['Short delta ≥ 0.35', 'Strike tested', '21-DTE escalation'] },
    { state: 'MONITOR', label: 'Monitor', rules: ['Short delta ≥ 0.25', 'DTE ≤ 21'] },
    { state: 'ON_TRACK', label: 'On Track', rules: ['Default — all thresholds clear'] },
  ];

  return (
    <div style={{
      background: '#fff', border: '1px solid rgba(17,24,39,0.08)', borderRadius: 14, padding: 20,
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 14 }}>
        Decision tree — which rule fired?
      </div>

      {rules.map(rule => {
        const isActive = rule.state === verdictState;
        return (
          <div key={rule.state} style={{
            padding: '10px 12px', borderRadius: 10, marginBottom: 6,
            background: isActive ? VERDICT_BG[rule.state] : 'transparent',
            border: `1px solid ${isActive ? VERDICT_COLOURS[rule.state] + '30' : 'transparent'}`,
            opacity: isActive ? 1 : 0.35,
            transition: 'all 0.2s ease',
          }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4,
            }}>
              <span style={{
                width: 8, height: 8, borderRadius: '50%',
                background: VERDICT_COLOURS[rule.state],
              }} />
              <span style={{ fontWeight: 700, fontSize: 13, color: VERDICT_COLOURS[rule.state] }}>
                {rule.label}
              </span>
            </div>
            <div style={{ paddingLeft: 16 }}>
              {rule.rules.map(r => (
                <div key={r} style={{ fontSize: 11, color: '#6b7280', lineHeight: 1.6 }}>
                  {r}
                </div>
              ))}
            </div>
          </div>
        );
      })}

      <div style={{ marginTop: 12, fontSize: 11, color: '#9ca3af', fontStyle: 'italic' }}>
        This runs on every session for every position.
      </div>
    </div>
  );
}

function AdjustmentPreview({ adjustments }) {
  const recommended = adjustments?.find(a => a.isRecommended);
  if (!recommended) return null;

  const fmt = (v) => v != null ? (v >= 0 ? `$${Math.abs(v)} debit` : `$${Math.abs(v)} credit`) : '--';

  return (
    <div style={{
      background: '#fff', border: '1px solid rgba(234,88,12,0.15)', borderRadius: 14, padding: 20,
      borderLeft: '3px solid #ea580c',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#ea580c', marginBottom: 10 }}>
        Recommended adjustment
      </div>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
        {recommended.label}
      </h3>
      <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6, marginBottom: 14 }}>
        {recommended.description}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <MiniMetric label="Net Cost" value={fmt(recommended.netCost)} />
        <MiniMetric label="New Prob" value={recommended.newProbability ? `${recommended.newProbability.toFixed(0)}%` : '--'} />
        <MiniMetric label="New Max Loss" value={recommended.newMaxLoss ? `$${recommended.newMaxLoss}` : '--'} />
      </div>
      <p style={{ fontSize: 11, color: '#9ca3af', marginTop: 12, fontStyle: 'italic' }}>
        In the app, you'd see {adjustments.length} options ranked by improvement ratio. This is the top one.
      </p>
    </div>
  );
}

function MiniMetric({ label, value }) {
  return (
    <div style={{ background: 'rgba(247,248,250,0.65)', borderRadius: 8, padding: 8 }}>
      <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(17,24,39,0.4)', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 12, fontWeight: 700 }}>{value}</div>
    </div>
  );
}

const ctrlBtn = {
  width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(17,24,39,0.10)',
  background: '#fff', fontSize: 14, cursor: 'pointer', display: 'flex',
  alignItems: 'center', justifyContent: 'center',
};

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
