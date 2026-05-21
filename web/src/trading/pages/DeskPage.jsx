import { Link } from 'react-router-dom';
import PageSEO from '../../shared/components/PageSEO';

export default function DeskPage() {
  return (
    <div style={{ background: '#F7F4EE', minHeight: '60vh' }}>
      <PageSEO
        title="NewLeaf Desk — Institutional-Grade Options Execution"
        description="Execute multi-leg options orders with precision. Combo orders, human-in-the-loop confirmation, real-time IB quotes, and risk-checked execution for defined-risk strategies."
        path="/desk"
      />

      {/* Hero */}
      <section style={{ padding: '80px 2rem 60px', textAlign: 'center', maxWidth: 800, margin: '0 auto' }}>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#C9A96E', marginBottom: 16 }}>
          Execution Layer
        </p>
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(36px, 5vw, 52px)', fontWeight: 700, color: '#0B2D23', lineHeight: 1.15, marginBottom: 20 }}>
          NewLeaf <em style={{ color: '#C9A96E', fontStyle: 'italic' }}>Desk</em>
        </h1>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 18, color: '#4a4a4a', lineHeight: 1.7, maxWidth: 640, margin: '0 auto' }}>
          Institutional-grade options execution for defined-risk strategies. Every order is risk-checked, combo-routed, and confirmed by a human before it hits the market.
        </p>
      </section>

      {/* Video */}
      <section style={{ maxWidth: 860, margin: '0 auto', padding: '0 2rem 60px' }}>
        <div style={{ position: 'relative', width: '100%', paddingBottom: '56.25%', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(11,45,35,.08)', boxShadow: '0 4px 24px rgba(11,45,35,.08)' }}>
          <iframe
            src="https://www.youtube.com/embed/bW03V5Re_2g"
            title="NewLeaf Verification Desk"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
          />
        </div>
      </section>

      {/* Features */}
      <section style={{ maxWidth: 960, margin: '0 auto', padding: '0 2rem 60px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24 }}>
        {[
          { icon: '⚡', title: 'Combo Orders', desc: 'Multi-leg options orders execute as a single combo — all legs or none. No leg risk, no partial fills, no surprises.' },
          { icon: '🛡️', title: 'Human-in-the-Loop', desc: 'Every order is reviewed and confirmed before execution. No accidental trades, no fat fingers, no unauthorized fills.' },
          { icon: '📊', title: 'Live IB Quotes', desc: 'Real-time bid/ask from Interactive Brokers. See exact fill prices, slippage estimates, and commission costs before you confirm.' },
          { icon: '🔒', title: 'Risk-Checked Execution', desc: 'Position size, portfolio heat, and max loss are validated against your risk budget before any order is submitted.' },
          { icon: '📋', title: 'Order Audit Trail', desc: 'Complete execution history with timestamps, fill prices, and P&L attribution. Every trade is traceable and auditable.' },
          { icon: '🔄', title: 'Adjustment Routing', desc: 'Roll, close, or adjust existing positions with one click. The system calculates the optimal adjustment and routes it as a combo.' },
        ].map((f, i) => (
          <div key={i} style={{ background: '#fff', border: '1px solid rgba(11,45,35,.08)', borderRadius: 12, padding: '28px 24px' }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
            <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, fontWeight: 700, color: '#0B2D23', marginBottom: 8 }}>{f.title}</h3>
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: '#6b6b60', lineHeight: 1.6 }}>{f.desc}</p>
          </div>
        ))}
      </section>

      {/* How it works */}
      <section style={{ background: '#0B2D23', padding: '60px 2rem', textAlign: 'center' }}>
        <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 28, color: '#F7F4EE', marginBottom: 12 }}>How It Works</h2>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 15, color: 'rgba(255,255,255,.6)', maxWidth: 600, margin: '0 auto 40px', lineHeight: 1.7 }}>
          From strategy selection to confirmed fill — a seamless pipeline.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 32, flexWrap: 'wrap', maxWidth: 800, margin: '0 auto' }}>
          {[
            { step: '1', label: 'Select', desc: 'Pick a strategy from Workbench or Picks' },
            { step: '2', label: 'Review', desc: 'See live quotes, Greeks, and risk metrics' },
            { step: '3', label: 'Confirm', desc: 'Human approval before order submission' },
            { step: '4', label: 'Execute', desc: 'Combo order routed to Interactive Brokers' },
          ].map((s, i) => (
            <div key={i} style={{ textAlign: 'center', width: 160 }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: '#C9A96E', color: '#0B2D23', fontFamily: "'Inter', sans-serif", fontWeight: 700, fontSize: 16, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>{s.step}</div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 700, color: '#F7F4EE', marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, color: 'rgba(255,255,255,.5)' }}>{s.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section style={{ padding: '80px 2rem', textAlign: 'center' }}>
        <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 32, fontWeight: 700, color: '#0B2D23', marginBottom: 12 }}>
          Interested in NewLeaf Desk?
        </h2>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 15, color: '#6b6b60', maxWidth: 480, margin: '0 auto 32px', lineHeight: 1.7 }}>
          NewLeaf Desk is available for qualified accounts. Contact our team to learn about integration, pricing, and onboarding.
        </p>
        <a href="mailto:hello@newleafsystem.com?subject=NewLeaf Desk Inquiry" style={{ display: 'inline-flex', alignItems: 'center', background: '#C9A96E', color: '#0B2D23', padding: '14px 32px', borderRadius: 8, textDecoration: 'none', fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', boxShadow: '0 2px 8px rgba(200,168,90,.3)' }}>
          Contact Sales
        </a>
        <div style={{ marginTop: 16, fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#999' }}>
          hello@newleafsystem.com
        </div>
      </section>
    </div>
  );
}
