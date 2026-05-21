import { Link } from 'react-router-dom';
import PageSEO from '../../shared/components/PageSEO';

export default function QuantPage() {
  return (
    <div style={{ background: '#F7F4EE', minHeight: '60vh' }}>
      <PageSEO
        title="NewLeaf Quant — AI-Powered Options Research Engine"
        description="Institutional-grade quantitative research for options trading. Gamma wall detection, 3-pillar scoring, bulk scanning across 150+ symbols, and AI-generated trade rationale."
        path="/quant"
      />

      {/* Hero */}
      <section style={{ padding: '80px 2rem 60px', textAlign: 'center', maxWidth: 800, margin: '0 auto' }}>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: '#C9A96E', marginBottom: 16 }}>
          Research Engine
        </p>
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(36px, 5vw, 52px)', fontWeight: 700, color: '#0B2D23', lineHeight: 1.15, marginBottom: 20 }}>
          NewLeaf <em style={{ color: '#C9A96E', fontStyle: 'italic' }}>Quant</em>
        </h1>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 18, color: '#4a4a4a', lineHeight: 1.7, maxWidth: 640, margin: '0 auto' }}>
          The quantitative engine behind every NewLeaf recommendation. Scans 150+ symbols in real time, scores every opportunity across three pillars, and generates AI-powered trade rationale.
        </p>
      </section>

      {/* Features */}
      <section style={{ maxWidth: 960, margin: '0 auto', padding: '0 2rem 60px', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24 }}>
        {[
          { icon: '🔬', title: 'Gamma Wall Detection', desc: 'Identifies key support and resistance levels using options market maker positioning. See where the "walls" are before you place a trade.' },
          { icon: '📈', title: '3-Pillar Scoring (0–100)', desc: 'Every opportunity is scored: Gamma (0–40) + Implied Volatility (0–35) + Trend (0–25). One unified score across all 8 strategies.' },
          { icon: '🌐', title: 'Bulk Scan Engine', desc: 'Scans 150+ liquid underlyings across 8 options strategies simultaneously. From universe to ranked opportunities in seconds.' },
          { icon: '🤖', title: 'AI Trade Rationale', desc: 'Each scored opportunity includes an AI-generated explanation of why the setup is attractive — volatility context, technical levels, and risk factors.' },
          { icon: '📉', title: 'IV Surface Analysis', desc: 'Maps the implied volatility surface across strikes and expirations. Identifies skew anomalies and calendar spread opportunities.' },
          { icon: '🔗', title: 'Pipeline Integration', desc: 'Feeds directly into Workbench for manual analysis, Picks for curation, and Desk for execution. One scan powers the entire system.' },
        ].map((f, i) => (
          <div key={i} style={{ background: '#fff', border: '1px solid rgba(11,45,35,.08)', borderRadius: 12, padding: '28px 24px' }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>{f.icon}</div>
            <h3 style={{ fontFamily: "'Inter', sans-serif", fontSize: 16, fontWeight: 700, color: '#0B2D23', marginBottom: 8 }}>{f.title}</h3>
            <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 14, color: '#6b6b60', lineHeight: 1.6 }}>{f.desc}</p>
          </div>
        ))}
      </section>

      {/* Pipeline */}
      <section style={{ background: '#0B2D23', padding: '60px 2rem', textAlign: 'center' }}>
        <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 28, color: '#F7F4EE', marginBottom: 12 }}>The Quant Pipeline</h2>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 15, color: 'rgba(255,255,255,.6)', maxWidth: 600, margin: '0 auto 40px', lineHeight: 1.7 }}>
          From raw market data to actionable intelligence in four stages.
        </p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 32, flexWrap: 'wrap', maxWidth: 800, margin: '0 auto' }}>
          {[
            { step: '1', label: 'Ingest', desc: 'Pull real-time options chains, price data, and Greeks' },
            { step: '2', label: 'Scan', desc: 'Filter 150+ symbols across 8 strategy templates' },
            { step: '3', label: 'Score', desc: '3-pillar scoring: Gamma + IV + Trend = 0–100' },
            { step: '4', label: 'Publish', desc: 'Push scored results to Workbench, Picks, and Desk' },
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
          Interested in NewLeaf Quant?
        </h2>
        <p style={{ fontFamily: "'Inter', sans-serif", fontSize: 15, color: '#6b6b60', maxWidth: 480, margin: '0 auto 32px', lineHeight: 1.7 }}>
          NewLeaf Quant powers the research behind our platform. Contact our team to learn about API access, custom scans, and enterprise licensing.
        </p>
        <a href="mailto:hello@newleafsystem.com?subject=NewLeaf Quant Inquiry" style={{ display: 'inline-flex', alignItems: 'center', background: '#C9A96E', color: '#0B2D23', padding: '14px 32px', borderRadius: 8, textDecoration: 'none', fontFamily: "'Inter', sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', boxShadow: '0 2px 8px rgba(200,168,90,.3)' }}>
          Contact Sales
        </a>
        <div style={{ marginTop: 16, fontFamily: "'Inter', sans-serif", fontSize: 13, color: '#999' }}>
          hello@newleafsystem.com
        </div>
      </section>
    </div>
  );
}
