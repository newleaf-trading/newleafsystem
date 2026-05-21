/**
 * PhaseHeader — consistent 5-phase identity bar for trading pages.
 *
 * Shows Discover → Decide → Build → Execute → Defend strip with
 * current phase highlighted, plus page eyebrow, title, subtitle.
 *
 * Used on: Discover, Build, Positions, Strategy Detail.
 * NOT used on: Home (has LifecycleHero), Performance (own header), Admin.
 */
import { useNavigate } from 'react-router-dom';

const PHASES = [
  { key: 'discover', label: 'Discover', route: '/invest/discover', clickable: true },
  { key: 'decide',   label: 'Decide',   route: '/invest/discover', clickable: true },
  { key: 'build',    label: 'Build',    route: '/invest/build',    clickable: true },
  { key: 'execute',  label: 'Execute',  route: null,                clickable: false },
  { key: 'defend',   label: 'Defend',   route: '/invest/positions', clickable: true },
];

const EYEBROWS = {
  discover: "DISCOVER \u00B7 TODAY\u2019S SETUPS",
  decide:   "DECIDE \u00B7 PROBABILITY & FIT",
  build:    "BUILD \u00B7 STRATEGY & LEGS",
  execute:  "EXECUTE \u00B7 FILL WITH EDGE",
  defend:   "DEFEND \u00B7 POSITIONS FLAGGED",
};

export function PhaseHeader({ currentPhase, title, subtitle, activeCount, compact = false }) {
  const navigate = useNavigate();

  const go = (phase) => {
    if (phase.clickable && phase.key !== currentPhase && phase.route) {
      navigate(phase.route);
    }
  };

  return (
    <div style={{ marginBottom: 20 }}>
      <style>{`
        @media (max-width: 640px) {
          .ph-node:not(.ph-current) { display: none !important; }
          .ph-line { display: none !important; }
        }
      `}</style>

      {/* ─── Phase strip ─── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: compact ? '8px 0' : '14px 0',
      }}>
        {PHASES.map((phase, i) => {
          const cur = phase.key === currentPhase;
          const can = phase.clickable && !cur;

          return (
            <div key={phase.key} style={{ display: 'contents' }}>
              {i > 0 && (
                <div className="ph-line" style={{ flex: '0 1 60px', height: 1, background: 'rgba(15,61,46,0.12)' }} />
              )}

              <button
                className={`ph-node${cur ? ' ph-current' : ''}`}
                onClick={() => go(phase)}
                aria-label={`${phase.label} phase`}
                aria-current={cur ? 'page' : undefined}
                tabIndex={can ? 0 : -1}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                  background: 'none', border: 'none', padding: '4px 10px',
                  cursor: can ? 'pointer' : 'default',
                  opacity: cur ? 1 : phase.clickable ? 0.45 : 0.25,
                  transition: 'opacity 0.15s',
                  outline: 'none',
                }}
                onMouseEnter={(e) => { if (can) e.currentTarget.style.opacity = '0.7'; }}
                onMouseLeave={(e) => { if (!cur) e.currentTarget.style.opacity = phase.clickable ? '0.45' : '0.25'; }}
                onFocus={(e) => { if (can) e.currentTarget.style.opacity = '0.7'; }}
                onBlur={(e) => { if (!cur) e.currentTarget.style.opacity = phase.clickable ? '0.45' : '0.25'; }}
              >
                <div style={{
                  width: cur ? 12 : 10, height: cur ? 12 : 10,
                  borderRadius: '50%',
                  background: cur ? '#0F3D2E' : 'transparent',
                  border: `1.5px solid ${cur ? '#0F3D2E' : 'rgba(15,61,46,0.35)'}`,
                  position: 'relative', transition: 'all 0.2s',
                }}>
                  {cur && activeCount > 0 && (
                    <div style={{
                      position: 'absolute', top: -5, right: -8,
                      minWidth: 16, height: 16, padding: '0 4px',
                      borderRadius: 8, background: '#0F3D2E', color: '#F7F4EE',
                      fontSize: 9, fontWeight: 700, fontFamily: "'Space Mono', monospace",
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      border: '2px solid #F7F4EE',
                    }}>
                      {activeCount}
                    </div>
                  )}
                </div>

                <span style={{
                  fontSize: 11, fontWeight: cur ? 700 : 500,
                  letterSpacing: '.06em', textTransform: 'uppercase',
                  color: cur ? '#0F3D2E' : '#6B7A72',
                  whiteSpace: 'nowrap',
                }}>
                  {phase.label}
                </span>
              </button>
            </div>
          );
        })}
      </div>

      {/* ─── Eyebrow ─── */}
      <div style={{
        fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: '.16em',
        textTransform: 'uppercase', color: '#C8A85A',
        marginTop: compact ? 8 : 16, marginBottom: 8,
      }}>
        {EYEBROWS[currentPhase]}
      </div>

      {/* ─── Title ─── */}
      <h1 style={{
        fontFamily: "'Playfair Display', serif", fontSize: 32,
        fontWeight: 400, color: '#0F3D2E', marginBottom: subtitle ? 6 : 0,
        letterSpacing: '-0.3px',
      }}>
        {title}
      </h1>

      {/* ─── Subtitle ─── */}
      {subtitle && (
        <p style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}
