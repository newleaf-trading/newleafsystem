import PageSEO from '../../shared/components/PageSEO';

// ═══════════════════════════════════════════════════════════════
// AboutPage — public marketing page (root surface).
// Story copy reuses the landing-page philosophy; contact block holds
// the company email. Renders inside PublicLayout (BrandBar + Footer).
// ═══════════════════════════════════════════════════════════════

const CONTACT_EMAIL = 'marketing@newleafsystem.com';
const CONTACT_ADDRESS = ['The Long Lodge', '265–269 Kingston Road', 'London SW19 3NW'];

const STAGES = [
  { k: 'Quant', d: 'Scan & analyse — gamma walls, IV rank, trend alignment.' },
  { k: 'Workbench', d: 'Design & verify — build the structure, price it live, stress it.' },
  { k: 'Picks', d: 'Curate & recommend — analyst-approved trades with the rationale.' },
  { k: 'Invest', d: 'Discover & allocate — risk-budgeted, defined-risk by construction.' },
  { k: 'Defend', d: 'Execute & manage — confirm, monitor, and protect open trades.' },
];

export function AboutPage() {
  return (
    <div style={{
      fontFamily: "'Inter', -apple-system, sans-serif",
      background: '#F7F4EE', color: '#0B0F14', minHeight: '100vh',
    }}>
      <PageSEO
        title="About — NewLeaf System"
        description="NewLeaf System is one connected pipeline for structured options trading: research, design, recommendation, allocation, and defence — every position defined-risk by construction."
        path="/about"
      />

      {/* ─── Hero ─── */}
      <section style={{ maxWidth: 800, margin: '0 auto', padding: '120px 2rem 56px', textAlign: 'center' }}>
        <h1 style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 400, lineHeight: 1.1,
          letterSpacing: '-1.5px', color: '#0B2D23', marginBottom: 16,
        }}>
          About NewLeaf System
        </h1>
        <p style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 'clamp(16px, 2vw, 20px)', fontStyle: 'italic',
          color: '#C9A96E', marginBottom: 32,
        }}>
          One system. Every step of the trade.
        </p>
        <p style={{ fontSize: 15, lineHeight: 1.75, color: '#6b6b60', maxWidth: 600, margin: '0 auto' }}>
          NewLeaf System is a structured options trading platform built around a single idea: every trade
          should move through one connected pipeline — from research to execution — with no manual exports,
          no broken hand-offs, and defined risk at every step.
        </p>
      </section>

      {/* ─── Philosophy ─── */}
      <section style={{ maxWidth: 640, margin: '0 auto', padding: '0 2rem 8px' }}>
        <div style={{
          padding: '28px 30px', background: 'rgba(255,255,255,0.9)',
          borderRadius: 16, border: '1px solid rgba(11,15,20,0.06)',
          boxShadow: '0 2px 12px rgba(0,0,0,0.03)',
        }}>
          <p style={{ fontSize: 16, lineHeight: 1.8, color: '#374151', margin: 0 }}>
            Every new leaf starts with a seed — an idea, planted with intention. Nurtured through rigorous
            research. Shaped into a defined-risk strategy. Grown into a live, executed trade. That progression
            is the whole product: one connected pipeline, moving at market speed.
          </p>
        </div>
      </section>

      {/* ─── The pipeline ─── */}
      <section style={{ maxWidth: 640, margin: '0 auto', padding: '40px 2rem 8px' }}>
        <h2 style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 'clamp(22px, 3.5vw, 30px)', fontWeight: 400, color: '#0B2D23',
          marginBottom: 6, textAlign: 'center',
        }}>
          One connected pipeline
        </h2>
        <p style={{ fontSize: 14, color: '#9b9b8e', textAlign: 'center', marginBottom: 28 }}>
          The moment a strategy is approved, you see it. The moment you allocate, execution is ready.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {STAGES.map((s, i) => (
            <div key={s.k} style={{
              display: 'flex', alignItems: 'flex-start', gap: 14,
              padding: '14px 18px', background: '#fff',
              borderRadius: 12, border: '1px solid rgba(17,24,39,0.08)',
            }}>
              <span style={{
                flexShrink: 0, fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 700,
                color: '#C9A96E', minWidth: 22, paddingTop: 2,
              }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span>
                <span style={{ fontWeight: 700, color: '#0B2D23', fontSize: 15 }}>{s.k}</span>
                <span style={{ color: '#6b6b60', fontSize: 14, lineHeight: 1.6 }}> — {s.d}</span>
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* ─── Contact ─── */}
      <section style={{ maxWidth: 640, margin: '0 auto', padding: '48px 2rem 8px' }}>
        <div style={{
          padding: '30px 32px', background: '#0B2D23', borderRadius: 16,
          textAlign: 'center', boxShadow: '0 8px 30px rgba(11,45,35,0.18)',
        }}>
          <p style={{
            fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 700,
            letterSpacing: '.14em', textTransform: 'uppercase', color: '#C9A96E', marginBottom: 12,
          }}>
            Get in touch
          </p>
          <h2 style={{
            fontFamily: "'Playfair Display', Georgia, serif",
            fontSize: 'clamp(20px, 3vw, 28px)', fontWeight: 400, color: '#F7F4EE', marginBottom: 16,
          }}>
            We'd love to hear from you
          </h2>
          <a href={`mailto:${CONTACT_EMAIL}`} style={{
            display: 'inline-block', padding: '12px 26px', borderRadius: 10,
            background: '#C9A96E', color: '#0B2D23', fontSize: 15, fontWeight: 700,
            textDecoration: 'none', boxShadow: '0 4px 16px rgba(201,169,110,0.25)',
          }}>
            {CONTACT_EMAIL}
          </a>
          <address style={{
            marginTop: 22, fontStyle: 'normal', lineHeight: 1.7,
            fontSize: 14, color: 'rgba(247,244,238,0.72)',
          }}>
            <span style={{
              display: 'block', fontFamily: "'Space Mono', monospace", fontSize: 10, fontWeight: 700,
              letterSpacing: '.14em', textTransform: 'uppercase', color: 'rgba(201,169,110,0.85)', marginBottom: 6,
            }}>
              Registered office
            </span>
            {CONTACT_ADDRESS.map((line) => <span key={line} style={{ display: 'block' }}>{line}</span>)}
          </address>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section style={{ maxWidth: 600, margin: '0 auto', padding: '48px 2rem 100px', textAlign: 'center' }}>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/how-we-pick" style={{
            padding: '14px 28px', borderRadius: 10,
            background: 'rgba(11,45,35,0.06)', border: '1px solid rgba(11,45,35,0.12)',
            fontSize: 14, fontWeight: 600, color: '#0B2D23', textDecoration: 'none',
          }}>
            See how it works &rarr;
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
