/**
 * /invest — NewLeaf Invest page.
 *
 * Video hero → Six-phase lifecycle donut diagram → phase detail cards.
 * Follows the same visual language as the landing page's 4-app donut,
 * but shows the 6 trading phases: Discover → Decide → Build → Execute → Defend → Adjust.
 */

import { useState } from 'react';

const PHASES = [
  {
    id: 'discover',
    num: '01',
    name: 'Discover',
    tagline: "Find today's trades",
    desc: "Curated strategies matched to user's risk profile, IV regime, and budget.",
    icon: '🔍',
    color: '#7c3aed',
    colorAlpha: 'rgba(124,58,237,',
  },
  {
    id: 'decide',
    num: '02',
    name: 'Decide',
    tagline: 'Evaluate this trade',
    desc: 'Thesis, probability, risks, and legs \u2014 in one view per recommendation.',
    icon: '🧭',
    color: '#d97706',
    colorAlpha: 'rgba(217,119,6,',
  },
  {
    id: 'build',
    num: '03',
    name: 'Build',
    tagline: 'Size the portfolio',
    desc: 'Combine shortlisted trades, size against capital, enforce concentration limits.',
    icon: '📐',
    color: '#059669',
    colorAlpha: 'rgba(5,150,105,',
  },
  {
    id: 'execute',
    num: '04',
    name: 'Execute',
    tagline: 'Place with your broker',
    desc: 'Hand-off via pendingOrder to external broker with verified leg configuration.',
    icon: '🚀',
    color: '#dc2626',
    colorAlpha: 'rgba(220,38,38,',
  },
  {
    id: 'defend',
    num: '05',
    name: 'Defend',
    tagline: 'Watch until exit',
    desc: 'Verdict engine runs every session. Five states. Rules-based. Fully auditable.',
    icon: '🛡️',
    color: '#2563eb',
    colorAlpha: 'rgba(37,99,235,',
  },
  {
    id: 'adjust',
    num: '06',
    name: 'Adjust',
    tagline: 'When defence is needed',
    desc: 'Ranked adjustment catalogue per strategy. Execute-ready orders.',
    icon: '🔄',
    color: '#ea580c',
    colorAlpha: 'rgba(234,88,12,',
  },
];

// ═══════════════════════════════════════════════════════════════
// SVG donut geometry — 6 segments, 54° each, 6° gaps
// Center: (280, 280), outer R = 195, inner r = 105
// viewBox: 0 0 560 560
// ═══════════════════════════════════════════════════════════════

const CX = 280, CY = 280, R = 195, r = 105;
const DEG = Math.PI / 180;

function pt(cx, cy, radius, angleDeg) {
  // angleDeg measured clockwise from top (12 o'clock)
  const rad = angleDeg * DEG;
  return [
    Math.round((cx + radius * Math.sin(rad)) * 10) / 10,
    Math.round((cy - radius * Math.cos(rad)) * 10) / 10,
  ];
}

// Each segment: startAngle to endAngle (clockwise from top)
const SEGMENT_ANGLES = [
  { start: 3, end: 57 },     // Discover
  { start: 63, end: 117 },   // Decide
  { start: 123, end: 177 },  // Build
  { start: 183, end: 237 },  // Execute
  { start: 243, end: 297 },  // Defend
  { start: 303, end: 357 },  // Adjust
];

function segmentPath(i) {
  const { start, end } = SEGMENT_ANGLES[i];
  const [ox1, oy1] = pt(CX, CY, R, start);
  const [ox2, oy2] = pt(CX, CY, R, end);
  const [ix1, iy1] = pt(CX, CY, r, end);
  const [ix2, iy2] = pt(CX, CY, r, start);
  return `M ${ox1},${oy1} A ${R},${R} 0 0,1 ${ox2},${oy2} L ${ix1},${iy1} A ${r},${r} 0 0,0 ${ix2},${iy2} Z`;
}

// Arrow positions at gap centres (0°, 60°, 120°, 180°, 240°, 300°)
const ARROW_RADIUS = 150;
const ARROW_GAPS = [0, 60, 120, 180, 240, 300];

// Badge positions at outer edge (segment centres at 30°, 90°, 150°, 210°, 270°, 330°)
const BADGE_RADIUS = 208;
const BADGE_ANGLES = [30, 90, 150, 210, 270, 330];

// Label positions inside the ring (midpoint of ring thickness)
const LABEL_RADIUS = 150;

function PhaseDiagram() {
  return (
    <svg
      className="phase-diagram"
      viewBox="0 0 560 560"
      xmlns="http://www.w3.org/2000/svg"
      style={{ width: '100%', maxWidth: 520, height: 'auto', display: 'block',
        filter: 'drop-shadow(0 0 60px rgba(201,169,110,.13)) drop-shadow(0 0 120px rgba(13,148,136,.09))' }}
    >
      <defs>
        <radialGradient id="inv-hub-bg" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#1c3a28"/>
          <stop offset="100%" stopColor="#080f09"/>
        </radialGradient>
        <radialGradient id="inv-outer-glow" cx="50%" cy="50%" r="50%">
          <stop offset="60%" stopColor="transparent"/>
          <stop offset="100%" stopColor="rgba(201,169,110,.04)"/>
        </radialGradient>
        <filter id="inv-hub-shadow" x="-40%" y="-40%" width="180%" height="180%">
          <feGaussianBlur stdDeviation="10" result="blur"/>
          <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <style>{`
          .inv-seg { cursor: pointer; transition: filter .2s; }
          .inv-seg:hover { filter: brightness(1.18); }
          .inv-flow-ring { animation: inv-flow-cw 10s linear infinite; transform-origin: ${CX}px ${CY}px; }
          @keyframes inv-flow-cw { from { stroke-dashoffset: 220 } to { stroke-dashoffset: 0 } }
          .inv-hub-pulse { animation: inv-hub-glow 3s ease-in-out infinite; }
          @keyframes inv-hub-glow { 0%,100% { opacity: .25 } 50% { opacity: .55 } }
        `}</style>
      </defs>

      {/* Ambient rings */}
      <circle cx={CX} cy={CY} r="228" fill="url(#inv-outer-glow)"/>
      <circle cx={CX} cy={CY} r="210" fill="none" stroke="rgba(201,169,110,.04)" strokeWidth="24"/>

      {/* Animated dashed flow ring */}
      <circle className="inv-flow-ring" cx={CX} cy={CY} r="148" fill="none"
        stroke="rgba(201,169,110,.22)" strokeWidth="1.5" strokeDasharray="7 11"/>

      {/* Six segments */}
      {PHASES.map((phase, i) => (
        <path
          key={phase.id}
          className={`inv-seg inv-seg-${phase.id}`}
          d={segmentPath(i)}
          fill={phase.color}
          stroke="rgba(255,255,255,.08)"
          strokeWidth="1.5"
          opacity="0.92"
        />
      ))}

      {/* Flow arrows between segments */}
      {ARROW_GAPS.map((angle, i) => {
        const [ax, ay] = pt(CX, CY, ARROW_RADIUS, angle);
        return (
          <g key={`arrow-${i}`} transform={`translate(${ax},${ay}) rotate(${angle})`}>
            <polygon points="8,0 -3.5,-5 -3.5,5" fill="rgba(255,255,255,.75)"/>
          </g>
        );
      })}

      {/* Hub pulse + centre */}
      <circle className="inv-hub-pulse" cx={CX} cy={CY} r="100" fill="none"
        stroke="rgba(201,169,110,.4)" strokeWidth="2"/>
      <circle cx={CX} cy={CY} r="93" fill="url(#inv-hub-bg)" filter="url(#inv-hub-shadow)"/>
      <circle cx={CX} cy={CY} r="93" fill="none" stroke="rgba(201,169,110,.28)" strokeWidth="1.5"/>
      <circle cx={CX} cy={CY} r="87" fill="none" stroke="rgba(201,169,110,.07)" strokeWidth="1"/>

      {/* Hub text */}
      <text x={CX} y={CY - 27} textAnchor="middle" fill="rgba(201,169,110,.6)"
        fontSize="8" fontFamily="'Space Mono', monospace" letterSpacing="2.8">
        TRADE LIFECYCLE
      </text>
      <text x={CX} y={CY - 4} textAnchor="middle" fill="white"
        fontSize="16" fontWeight="700" fontFamily="'Playfair Display', Georgia, serif">
        Six Phases
      </text>
      <text x={CX} y={CY + 13} textAnchor="middle" fill="rgba(255,255,255,.5)"
        fontSize="10.5" fontFamily="'DM Sans', sans-serif">
        One path. Every trade.
      </text>
      <text x={CX} y={CY + 31} textAnchor="middle" fill="rgba(255,255,255,.28)"
        fontSize="7.5" fontFamily="'Space Mono', monospace" letterSpacing="0.5">
        structured · repeatable · auditable
      </text>

      {/* Segment labels inside ring + number badges at edge */}
      {PHASES.map((phase, i) => {
        const angle = BADGE_ANGLES[i];
        const [bx, by] = pt(CX, CY, BADGE_RADIUS, angle);
        const [lx, ly] = pt(CX, CY, LABEL_RADIUS, angle);

        // Rotate text to align with the segment's radial direction
        // For bottom-half segments (120°-240°), flip 180° so text isn't upside down
        const isBottom = angle > 120 && angle < 240;
        const textRotation = isBottom ? angle - 180 : angle;

        return (
          <g key={`label-${phase.id}`}>
            {/* Number badge at outer ring edge */}
            <circle cx={bx} cy={by} r="11" fill={`${phase.colorAlpha}.55)`}
              stroke="rgba(255,255,255,.25)" strokeWidth="1"/>
            <text x={bx} y={by + 4} textAnchor="middle" fill="white"
              fontSize="8" fontWeight="700" fontFamily="'Space Mono', monospace">
              {phase.num}
            </text>

            {/* Name + tagline inside the segment, rotated to follow the ring */}
            <g transform={`translate(${lx},${ly}) rotate(${textRotation})`}>
              <text x="0" y="-4" textAnchor="middle"
                fill="rgba(255,255,255,.95)" fontSize="11" fontWeight="700"
                fontFamily="'Space Mono', monospace">
                {phase.name}
              </text>
              <text x="0" y="10" textAnchor="middle"
                fill="rgba(255,255,255,.5)" fontSize="7.5"
                fontFamily="'DM Sans', sans-serif">
                {phase.tagline}
              </text>
            </g>
          </g>
        );
      })}
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════
// Phase cards grid
// ═══════════════════════════════════════════════════════════════

function PhaseCard({ phase }) {
  return (
    <div style={{
      background: '#0B2D23',
      borderRadius: 16,
      padding: '28px 24px 24px',
      position: 'relative',
      overflow: 'hidden',
      border: `1px solid ${phase.colorAlpha}0.22)`,
      transition: 'transform .2s, border-color .2s',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.borderColor = `${phase.colorAlpha}0.45)`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.borderColor = `${phase.colorAlpha}0.22)`; }}
    >
      {/* Top accent line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 3,
        background: phase.color, borderRadius: '16px 16px 0 0',
      }}/>

      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
        <span style={{ fontSize: 28 }}>{phase.icon}</span>
        <span style={{
          fontFamily: "'Inter', sans-serif",
          fontSize: 12, fontWeight: 700,
          color: `${phase.colorAlpha}0.7)`,
          letterSpacing: '.05em',
        }}>{phase.num}</span>
      </div>

      {/* Name */}
      <h3 style={{
        fontFamily: "'Playfair Display', Georgia, serif",
        fontSize: 'clamp(22px, 2vw, 28px)',
        fontWeight: 900, color: '#fff',
        letterSpacing: '-0.5px', lineHeight: 1.1,
        marginBottom: 6,
      }}>{phase.name}</h3>

      {/* Tagline */}
      <p style={{
        fontFamily: "'Inter', sans-serif",
        fontSize: 13, fontWeight: 600, fontStyle: 'italic',
        color: '#C9A96E',
        marginBottom: 12,
      }}>{phase.tagline}</p>

      {/* Description */}
      <p style={{
        fontFamily: "'Inter', sans-serif",
        fontSize: 13, lineHeight: 1.72,
        color: 'rgba(255,255,255,.58)',
      }}>{phase.desc}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Signup band — reusable CTA section
// ═══════════════════════════════════════════════════════════════

function SignupBand({ label, headline, subhead, onSignInWithGoogle }) {
  if (!onSignInWithGoogle) return null;
  return (
    <section style={{
      background: 'linear-gradient(180deg, #0e3325 0%, #0B2D23 100%)',
      padding: '64px 0',
      textAlign: 'center',
    }}>
      <div style={{ width: 'min(600px, calc(100% - 40px))', margin: '0 auto' }}>
        {/* Label */}
        <p style={{
          fontFamily: "'Space Mono', monospace",
          fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase',
          color: '#C9A96E', fontWeight: 700,
          marginBottom: 14,
        }}>{label}</p>

        {/* Headline */}
        <h2 style={{
          fontFamily: "'Fraunces', 'Playfair Display', Georgia, serif",
          fontSize: 'clamp(24px, 2.8vw, 34px)',
          fontWeight: 600, lineHeight: 1.2,
          color: '#F7F4EE',
          letterSpacing: '-0.5px',
          marginBottom: 10,
        }}>{headline}</h2>

        {/* Subhead */}
        <p style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 14, color: 'rgba(255,255,255,.45)',
          lineHeight: 1.6,
          marginBottom: 28,
        }}>{subhead}</p>

        {/* Primary CTA */}
        <button
          onClick={onSignInWithGoogle}
          className="invest-signup-cta"
          style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
            padding: '16px 40px', background: '#C8A85A', color: '#0B2D23',
            border: 'none', borderRadius: 12, fontSize: 16, fontWeight: 800, cursor: 'pointer',
            fontFamily: "'DM Sans', sans-serif",
            boxShadow: '0 8px 28px rgba(200,168,90,.3)',
            transition: 'transform .15s, box-shadow .15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 36px rgba(200,168,90,.4)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 28px rgba(200,168,90,.3)'; }}
        >
          Get started free &rarr;
        </button>

        {/* Secondary link */}
        <p style={{
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 13, color: 'rgba(255,255,255,.38)',
          marginTop: 14, marginBottom: 0,
        }}>
          Already have an account?{' '}
          <button
            onClick={onSignInWithGoogle}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#C9A96E', fontSize: 13, fontWeight: 700,
              fontFamily: "'DM Sans', sans-serif", textDecoration: 'underline',
              textUnderlineOffset: 2, padding: 0,
            }}
          >
            Sign in
          </button>
        </p>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════
// Video hero component
// ═══════════════════════════════════════════════════════════════

function VideoHero({ onSignInWithGoogle }) {
  const [playing, setPlaying] = useState(false);

  const handlePlay = () => {
    setPlaying(true);
  };

  return (
    <section style={{
      background: 'linear-gradient(145deg, #04120c 0%, #081a10 30%, #0c2318 60%, #0b2d23 100%)',
      padding: '56px 0 64px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Grid overlay */}
      <div style={{
        position: 'absolute', inset: 0,
        backgroundImage: 'linear-gradient(rgba(201,169,110,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(201,169,110,.035) 1px, transparent 1px)',
        backgroundSize: '56px 56px',
        pointerEvents: 'none',
      }}/>

      <div className="invest-hero-layout" style={{
        width: 'min(1160px, calc(100% - 40px))',
        margin: '0 auto',
        position: 'relative',
        zIndex: 1,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: '3rem',
        alignItems: 'center',
      }}>
        {/* Left column — copy + CTAs */}
        <div>
          {/* Pill */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '5px 13px', borderRadius: 999,
            background: 'rgba(201,169,110,.11)',
            border: '1px solid rgba(201,169,110,.28)',
            color: '#C9A96E',
            fontSize: 10.5, fontWeight: 700,
            letterSpacing: '.1em', textTransform: 'uppercase',
            marginBottom: 20,
            fontFamily: "'Inter', sans-serif",
          }}>
            <span style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#C9A96E',
              animation: 'pulse 2.2s ease-in-out infinite',
            }}/>
            NEWLEAF INVEST
          </div>

          <h1 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 'clamp(30px, 3.2vw, 46px)',
            fontWeight: 900, lineHeight: 1.05,
            letterSpacing: '-1.5px', color: '#fff',
            marginBottom: 14,
          }}>
            Options trading,<br/>
            <em style={{ fontStyle: 'italic', color: '#C9A96E' }}>structured and repeatable.</em>
          </h1>

          <p style={{
            fontSize: 15, color: 'rgba(255,255,255,.55)',
            lineHeight: 1.78,
            marginBottom: 6,
            fontFamily: "'DM Sans', sans-serif",
          }}>
            Most platforms help you enter a trade. NewLeaf Invest manages the entire
            cycle — from idea, to sizing, to exit.
          </p>
          <p style={{
            fontSize: 13, color: 'rgba(255,255,255,.38)',
            lineHeight: 1.72,
            marginBottom: 28,
            fontFamily: "'DM Sans', sans-serif",
          }}>
            One of three apps in the NewLeaf system, built for retail traders who want
            to operate like an institutional desk.
          </p>

          {/* Primary CTA — Get started */}
          {onSignInWithGoogle && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
              <button
                onClick={onSignInWithGoogle}
                style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  padding: '18px 48px', background: '#C8A85A', color: '#0B2D23',
                  border: 'none', borderRadius: 12, fontSize: 18, fontWeight: 800, cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                  boxShadow: '0 8px 32px rgba(200,168,90,.35), 0 0 0 2px rgba(200,168,90,.15)',
                  transition: 'transform .15s, box-shadow .15s',
                }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 12px 40px rgba(200,168,90,.45), 0 0 0 2px rgba(200,168,90,.25)'; }}
                onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 8px 32px rgba(200,168,90,.35), 0 0 0 2px rgba(200,168,90,.15)'; }}
              >
                Get started free &rarr;
              </button>

              {/* Secondary CTA — Watch video */}
              <button
                onClick={handlePlay}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  padding: '12px 24px',
                  background: 'transparent', color: '#C9A96E',
                  border: '1px solid rgba(201,169,110,.4)',
                  borderRadius: 10, fontSize: 14, fontWeight: 600, cursor: 'pointer',
                  fontFamily: "'DM Sans', sans-serif",
                  transition: 'border-color .18s, background .18s',
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(201,169,110,.7)'; e.currentTarget.style.background = 'rgba(201,169,110,.06)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(201,169,110,.4)'; e.currentTarget.style.background = 'transparent'; }}
              >
                &#9654;&ensp;Watch the 3-minute overview
              </button>
              <span style={{
                fontSize: 12, color: 'rgba(255,255,255,.3)',
                fontFamily: "'DM Sans', sans-serif",
                marginTop: -6,
              }}>
                See the full trade lifecycle in action — 3 min
              </span>

              {/* Tertiary — sign in link */}
              <p style={{
                fontSize: 13, color: 'rgba(255,255,255,.38)',
                fontFamily: "'DM Sans', sans-serif",
                marginTop: 4, marginBottom: 0,
              }}>
                Already have an account?{' '}
                <button
                  onClick={onSignInWithGoogle}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: '#F7F4EE', fontSize: 13, fontWeight: 600,
                    fontFamily: "'DM Sans', sans-serif", textDecoration: 'underline',
                    textUnderlineOffset: 2, padding: 0,
                  }}
                >
                  Sign in
                </button>
              </p>
            </div>
          )}
        </div>

        {/* Right column — video */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{
            position: 'relative',
            width: '100%',
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: '0 16px 64px rgba(0,0,0,.45), 0 0 0 1px rgba(201,169,110,.15)',
            aspectRatio: '16/9',
            background: '#000',
          }}>
            {playing ? (
              <iframe
                src="https://www.youtube.com/embed/4zMnz-rJE8c?autoplay=1&rel=0"
                title="NewLeaf Invest Overview"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{
                  width: '100%',
                  height: '100%',
                  border: 'none',
                }}
              />
            ) : (
              <button
                onClick={handlePlay}
                style={{
                  position: 'relative',
                  width: '100%',
                  height: '100%',
                  padding: 0,
                  border: 'none',
                  cursor: 'pointer',
                  background: '#000',
                }}
              >
                <img
                  src="https://pub-554c552d94e74e32822dd23be2656ba0.r2.dev/NewLeafInvestThumbNailV3.png"
                  alt="Video thumbnail"
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: 'block',
                  }}
                />
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  background: 'rgba(0,0,0,.25)',
                  transition: 'background .2s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,.15)'}
                onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,.25)'}
                >
                  <div style={{
                    width: 64, height: 64,
                    borderRadius: '50%',
                    background: 'rgba(201,169,110,.92)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: '0 8px 32px rgba(0,0,0,.4)',
                  }}>
                    <svg width="24" height="28" viewBox="0 0 28 32" fill="none">
                      <path d="M4 2L26 16L4 30V2Z" fill="#061a13" stroke="#061a13" strokeWidth="2" strokeLinejoin="round"/>
                    </svg>
                  </div>
                  <span style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 12, fontWeight: 600,
                    color: 'rgba(255,255,255,.85)',
                    letterSpacing: '.03em',
                  }}>
                    Play overview
                  </span>
                </div>
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ═══════════════════════════════════════════════════════════════
// Page component
// ═══════════════════════════════════════════════════════════════

export function InvestPage({ onSignInWithGoogle, onSignInWithEmail, onSignUp }) {
  return (
    <div style={{ background: '#F7F4EE', minHeight: '100vh', scrollPaddingTop: 64 }}>
      {/* Video hero — above the fold */}
      <VideoHero onSignInWithGoogle={onSignInWithGoogle} />

      {/* Signup band — post-video capture */}
      <SignupBand
        label="READY TO TRY IT?"
        headline="Start managing trades like a desk."
        subhead="Free to explore. No credit card required."
        onSignInWithGoogle={onSignInWithGoogle}
      />

      {/* 3A — Reframing pull-quote */}
      <section style={{
        background: '#F7F4EE',
        padding: '72px 0 64px',
        textAlign: 'center',
      }}>
        <div style={{ width: 'min(820px, calc(100% - 40px))', margin: '0 auto' }}>
          <p style={{
            fontFamily: "'Fraunces', 'Playfair Display', Georgia, serif",
            fontStyle: 'italic',
            fontSize: 'clamp(22px, 2.6vw, 30px)',
            fontWeight: 400,
            lineHeight: 1.55,
            color: '#0B2D23',
            letterSpacing: '-0.3px',
            position: 'relative',
            padding: '0 24px',
          }}>
            <span style={{ color: '#C9A96E', fontSize: '1.3em', verticalAlign: '-0.05em', marginRight: 4 }}>&ldquo;</span>
            Two phases get you into a trade. Four manage it once it&rsquo;s live.
            That ratio is the whole point.
            <span style={{ color: '#C9A96E', fontSize: '1.3em', verticalAlign: '-0.05em', marginLeft: 4 }}>&rdquo;</span>
          </p>
        </div>
      </section>

      {/* 3B — The NewLeaf system — three product cards */}
      <section style={{
        background: 'linear-gradient(145deg, #04120c 0%, #081a10 30%, #0c2318 60%, #0b2d23 100%)',
        padding: '72px 0 80px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(201,169,110,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(201,169,110,.035) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          pointerEvents: 'none',
        }}/>

        <div style={{
          width: 'min(1060px, calc(100% - 40px))',
          margin: '0 auto',
          position: 'relative',
          zIndex: 1,
          textAlign: 'center',
        }}>
          <h2 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 'clamp(28px, 3.2vw, 40px)',
            fontWeight: 900, lineHeight: 1.08,
            letterSpacing: '-1.5px', color: '#fff',
            marginBottom: 8,
          }}>
            The NewLeaf system.
          </h2>
          <p style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 15, color: 'rgba(255,255,255,.5)',
            lineHeight: 1.7, marginBottom: 40,
          }}>
            Three apps. One philosophy. Every trade covered.
          </p>

          {/* Cards */}
          <div className="invest-system-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
            marginBottom: 32,
          }}>
            {/* Picks */}
            <div style={{
              background: '#0B2D23',
              borderRadius: 16,
              padding: '28px 24px 24px',
              border: '1px solid rgba(255,255,255,.08)',
              textAlign: 'left',
            }}>
              <p style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase',
                color: 'rgba(255,255,255,.35)', marginBottom: 10,
              }}>APP 01</p>
              <h3 style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: 22, fontWeight: 900, color: '#fff',
                marginBottom: 8,
              }}>
                NewLeaf <em style={{ fontStyle: 'italic', color: 'rgba(255,255,255,.55)', fontWeight: 500 }}>Picks</em>
              </h3>
              <p style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 14, lineHeight: 1.7, color: 'rgba(255,255,255,.5)',
              }}>
                Curated trade recommendations, delivered daily.
              </p>
            </div>

            {/* Workbench */}
            <div style={{
              background: '#0B2D23',
              borderRadius: 16,
              padding: '28px 24px 24px',
              border: '1px solid rgba(255,255,255,.08)',
              textAlign: 'left',
            }}>
              <p style={{
                fontFamily: "'Space Mono', monospace",
                fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase',
                color: 'rgba(255,255,255,.35)', marginBottom: 10,
              }}>APP 02</p>
              <h3 style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: 22, fontWeight: 900, color: '#fff',
                marginBottom: 8,
              }}>
                NewLeaf <em style={{ fontStyle: 'italic', color: 'rgba(255,255,255,.55)', fontWeight: 500 }}>Workbench</em>
              </h3>
              <p style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 14, lineHeight: 1.7, color: 'rgba(255,255,255,.5)',
              }}>
                Where our analysts screen 150+ stocks to find them.
              </p>
            </div>

            {/* Invest — highlighted */}
            <div style={{
              background: '#0B2D23',
              borderRadius: 16,
              padding: '28px 24px 24px',
              border: '1px solid rgba(201,169,110,.35)',
              textAlign: 'left',
              position: 'relative',
              boxShadow: '0 0 32px rgba(201,169,110,.08)',
            }}>
              {/* Gold accent top */}
              <div style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 3,
                background: '#C9A96E', borderRadius: '16px 16px 0 0',
              }}/>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <p style={{
                  fontFamily: "'Space Mono', monospace",
                  fontSize: 10, letterSpacing: '.15em', textTransform: 'uppercase',
                  color: 'rgba(255,255,255,.35)', margin: 0,
                }}>APP 03</p>
                <span style={{
                  fontFamily: "'Space Mono', monospace",
                  fontSize: 9, letterSpacing: '.08em',
                  color: '#C9A96E', fontWeight: 700,
                  background: 'rgba(201,169,110,.1)',
                  padding: '3px 8px', borderRadius: 4,
                }}>YOU ARE HERE</span>
              </div>
              <h3 style={{
                fontFamily: "'Playfair Display', Georgia, serif",
                fontSize: 22, fontWeight: 900, color: '#fff',
                marginBottom: 8,
              }}>
                NewLeaf <em style={{ fontStyle: 'italic', color: '#C9A96E', fontWeight: 500 }}>Invest</em>
              </h3>
              <p style={{
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 14, lineHeight: 1.7, color: 'rgba(255,255,255,.5)',
              }}>
                The platform that manages the full trade lifecycle once you&rsquo;re in.
              </p>
            </div>
          </div>

          <p style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 14, color: 'rgba(255,255,255,.38)',
            lineHeight: 1.72, maxWidth: '60ch',
            margin: '0 auto',
          }}>
            This page is about Invest. Picks and Workbench feed it — but Invest works with trades from anywhere.
          </p>
        </div>
      </section>

      {/* 3C — "Who this is for" band */}
      <section style={{
        background: '#0B2D23',
        padding: '56px 0',
        textAlign: 'center',
      }}>
        <div style={{ width: 'min(780px, calc(100% - 40px))', margin: '0 auto' }}>
          <p style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 'clamp(17px, 1.9vw, 21px)',
            fontWeight: 400,
            lineHeight: 1.72,
            color: '#F7F4EE',
            letterSpacing: '-0.2px',
            margin: 0,
          }}>
            For the retail trader running iron condors, spreads, and wheels — who&rsquo;s
            tired of spreadsheets, missed exits, and platforms that stop helping the
            moment the order fills.
          </p>
        </div>
      </section>

      {/* Closing signup band */}
      <SignupBand
        label="ONE LAST THING"
        headline="The cycle runs every day. Start yours."
        subhead="Free to get started. Upgrade when you're ready."
        onSignInWithGoogle={onSignInWithGoogle}
      />

      {/* Six Phases — below the fold */}
      <section style={{
        background: 'linear-gradient(145deg, #04120c 0%, #081a10 30%, #0c2318 60%, #0b2d23 100%)',
        padding: '72px 0 80px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Grid overlay */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'linear-gradient(rgba(201,169,110,.035) 1px, transparent 1px), linear-gradient(90deg, rgba(201,169,110,.035) 1px, transparent 1px)',
          backgroundSize: '56px 56px',
          pointerEvents: 'none',
        }}/>

        <div className="invest-hero-grid" style={{
          width: 'min(1160px, calc(100% - 40px))',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '1fr 520px',
          gap: 48,
          alignItems: 'center',
          position: 'relative',
          zIndex: 1,
        }}>
          {/* Left copy */}
          <div>
            {/* Pill */}
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              padding: '5px 13px', borderRadius: 999,
              background: 'rgba(201,169,110,.11)',
              border: '1px solid rgba(201,169,110,.28)',
              color: '#C9A96E',
              fontSize: 10.5, fontWeight: 700,
              letterSpacing: '.1em', textTransform: 'uppercase',
              marginBottom: 22,
              fontFamily: "'Inter', sans-serif",
            }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: '#C9A96E',
                animation: 'pulse 2.2s ease-in-out infinite',
              }}/>
              THE SIX PHASES
            </div>

            <h1 style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 'clamp(38px, 4.5vw, 58px)',
              fontWeight: 900, lineHeight: 0.97,
              letterSpacing: '-2px', color: '#fff',
              marginBottom: 18,
            }}>
              Every trade travels<br/>
              <em style={{ fontStyle: 'italic', color: '#C9A96E' }}>the same path.</em>
            </h1>

            <p style={{
              fontSize: 16, color: 'rgba(255,255,255,.58)',
              lineHeight: 1.78, maxWidth: '50ch',
              marginBottom: 30,
              fontFamily: "'Inter', sans-serif",
            }}>
              From the moment an idea lands in Discover until the position closes,
              NewLeaf walks every trade through six phases. Each phase is a dedicated
              surface in the product.
            </p>
          </div>

          {/* Right — Donut diagram */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PhaseDiagram />
          </div>
        </div>
      </section>

      {/* Phase cards section */}
      <section style={{ padding: '80px 0' }}>
        <div style={{ width: 'min(1160px, calc(100% - 40px))', margin: '0 auto' }}>
          {/* Section header */}
          <div style={{ marginBottom: 48 }}>
            <p style={{
              fontSize: 10, letterSpacing: '.2em', textTransform: 'uppercase',
              fontWeight: 700, color: 'rgba(11,15,20,.4)',
              marginBottom: 10,
              fontFamily: "'Inter', sans-serif",
            }}>
              PHASE DETAIL
            </p>
            <h2 style={{
              fontFamily: "'Playfair Display', Georgia, serif",
              fontSize: 'clamp(30px, 3.5vw, 44px)',
              fontWeight: 900, letterSpacing: '-1.5px',
              lineHeight: 1.06, color: '#0B0F14',
              marginBottom: 12,
            }}>
              What happens at <em style={{ fontStyle: 'italic', color: '#0B2D23' }}>each stage.</em>
            </h2>
            <p style={{
              fontSize: 15, color: 'rgba(11,15,20,.62)',
              lineHeight: 1.78, maxWidth: '54ch',
              fontFamily: "'Inter', sans-serif",
            }}>
              Every phase is a dedicated surface with its own purpose, its own data,
              and its own set of actions. Nothing is skipped.
            </p>
          </div>

          {/* Cards grid */}
          <div className="invest-cards-grid" style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 16,
          }}>
            {PHASES.map(phase => (
              <PhaseCard key={phase.id} phase={phase} />
            ))}
          </div>
        </div>
      </section>

      {/* Responsive overrides */}
      <style>{`
        @keyframes pulse {
          0%,100% { opacity:1; transform:scale(1) }
          50%      { opacity:.4; transform:scale(.75) }
        }
        @media (max-width: 1024px) {
          .invest-hero-layout { grid-template-columns: 1fr !important; gap: 2rem !important; text-align: center; }
          .invest-hero-layout > div:first-child { display: flex; flex-direction: column; align-items: center; }
          .invest-hero-layout > div:first-child > div:last-child { align-items: center !important; }
        }
        @media (max-width: 960px) {
          .invest-hero-grid { grid-template-columns: 1fr !important; gap: 44px !important; }
          .invest-hero-grid > div:last-child { max-width: 420px; margin: 0 auto; }
        }
        @media (max-width: 768px) {
          .invest-cards-grid { grid-template-columns: 1fr 1fr !important; }
          .invest-system-grid { grid-template-columns: 1fr !important; }
          .invest-signup-cta { width: 100% !important; }
        }
        @media (max-width: 520px) {
          .invest-cards-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
