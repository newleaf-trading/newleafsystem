/**
 * /how-we-score — Scoring algorithm documentation page.
 *
 * Documents the three-pillar opportunity scoring system:
 * Gamma (0-40) + IV (0-35) + Trend (0-25) = Score (0-100)
 */
import { PipelineFlow, MergeDiagram, ScoreBar, FunnelDiagram, CascadeDiagram } from '../shared/Diagrams';
import PageSEO from '../../shared/components/PageSEO';

export function ScoringAlgorithmPage() {
  return (
    <div style={{
      fontFamily: "'Inter', -apple-system, sans-serif",
      background: '#F7F4EE', color: '#0B0F14', minHeight: '100vh',
    }}>
      <PageSEO title="How We Score — NewLeaf Scoring Algorithm" description="Deep dive into NewLeaf's composite scoring algorithm that ranks options opportunities using implied volatility percentile, gamma exposure, trend strength, and probability metrics." path="/how-we-score" />
      {/* Hero */}
      <section style={{ maxWidth: 800, margin: '0 auto', padding: '120px 2rem 60px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.15em', textTransform: 'uppercase', color: '#C9A96E', marginBottom: 16 }}>
          How It Works
        </div>
        <h1 style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 400, lineHeight: 1.1,
          letterSpacing: '-1.5px', color: '#0B2D23', marginBottom: 16,
        }}>
          The Opportunity Score
        </h1>
        <p style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 'clamp(16px, 2vw, 20px)', fontStyle: 'italic',
          color: '#C9A96E', marginBottom: 32,
        }}>
          Three pillars. One number. Zero guesswork.
        </p>
        <p style={{ fontSize: 15, lineHeight: 1.75, color: '#6b6b60', maxWidth: 600, margin: '0 auto' }}>
          Every stock in our universe gets an opportunity score from 0 to 100 every trading day.
          The score combines three independent dimensions &mdash; gamma structure, implied volatility regime,
          and technical trend &mdash; into a single number that tells you how attractive the premium-selling
          setup is right now.
        </p>
      </section>

      {/* Pipeline diagram */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <Card>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 12 }}>
            Scoring Pipeline
          </div>
          <PipelineFlow steps={[
            { label: 'Price Data', sub: 'Alpaca API', color: '#6b7280', icon: '\u{1F4C8}' },
            { label: 'Options Chain', sub: 'Alpaca + Yahoo', color: '#6b7280', icon: '\u{1F4CB}' },
            { label: 'Technical\nAnalysis', sub: 'RSI, BB, SMA', color: '#6366F1', icon: '\u{1F4CA}' },
            { label: 'Gamma\nAnalysis', sub: 'GEX, Walls', color: '#0B7A52', icon: '\u{1F6E1}' },
            { label: 'IV\nAnalysis', sub: 'ATM IV, Rank', color: '#B7791F', icon: '\u{1F525}' },
            { label: 'Score', sub: '0-100', color: '#C9A96E', icon: '\u{2B50}', round: true },
          ]} />
        </Card>
      </section>

      {/* Three-pillar merge diagram */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <MergeDiagram
          inputs={[
            { label: 'Gamma', detail: '0-40 pts', color: '#0B7A52', icon: '\u{1F6E1}' },
            { label: 'IV', detail: '0-35 pts', color: '#B7791F', icon: '\u{1F525}' },
            { label: 'Trend', detail: '0-25 pts', color: '#6366F1', icon: '\u{1F4C8}' },
          ]}
          output={{ label: 'Opportunity Score', detail: '0-100', color: '#C9A96E', icon: '\u{2B50}' }}
          label="weighted sum"
        />
      </section>

      {/* Score strip */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <PillarCard
            name="Gamma Pillar"
            range="0 &ndash; 40"
            weight="40%"
            color="#0B7A52"
            icon="&#9651;"
            description="Measures how well-defined the gamma walls are. Strong put and call walls create a natural price corridor that favours premium sellers."
            factors={[
              'Wall quality (OI concentration at key strikes)',
              'Band width (distance between put and call walls)',
              'Confidence score (data coverage and consistency)',
              'Multi-factor OI scoring (OI + OI delta + volume)',
            ]}
          />
          <PillarCard
            name="IV Pillar"
            range="0 &ndash; 35"
            weight="35%"
            color="#B7791F"
            icon="&#9670;"
            description="Evaluates whether implied volatility sits in the premium-selling sweet spot. Too low means thin premiums; too high signals danger."
            factors={[
              'ATM IV vs. sweet spot (20-50%)',
              'IV rank percentile over 30+ day history',
              'IV regime classification (low / normal / high)',
              'IV by expiry for term structure analysis',
            ]}
          />
          <PillarCard
            name="Trend Pillar"
            range="0 &ndash; 25"
            weight="25%"
            color="#6366F1"
            icon="&#9679;"
            description="Rewards strong directional conviction. Whether bullish or bearish, a clear trend helps strategy selection and strike placement."
            factors={[
              'SMA 50/100 crossover state',
              'Price position relative to moving averages',
              'RSI momentum confirmation',
              'Bollinger Band squeeze detection',
            ]}
          />
        </div>
      </section>

      {/* Score formula */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <Card>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 16 }}>
            The Formula
          </div>
          <div style={{
            fontFamily: "'Space Mono', monospace", fontSize: 18, color: '#0B2D23',
            textAlign: 'center', padding: '24px 0', letterSpacing: '0.02em',
          }}>
            <span style={{ color: '#0B7A52' }}>Gamma</span>
            <span style={{ color: '#9ca3af', margin: '0 8px' }}>+</span>
            <span style={{ color: '#B7791F' }}>IV</span>
            <span style={{ color: '#9ca3af', margin: '0 8px' }}>+</span>
            <span style={{ color: '#6366F1' }}>Trend</span>
            <span style={{ color: '#9ca3af', margin: '0 8px' }}>=</span>
            <span style={{ fontWeight: 700 }}>Score (0-100)</span>
          </div>
        </Card>
      </section>

      {/* Visual score bar example */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <Card>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 8 }}>
            Example: AAPL Score Breakdown
          </div>
          <ScoreBar
            segments={[
              { label: 'Gamma', value: 32, color: '#0B7A52' },
              { label: 'IV', value: 28, color: '#B7791F' },
              { label: 'Trend', value: 18, color: '#6366F1' },
            ]}
            total={78}
            height={36}
          />
          <div style={{ fontSize: 12, color: '#6b6b60', marginTop: 8, fontStyle: 'italic' }}>
            Score 78/100 = Excellent. Strong gamma walls (32/40), good IV regime (28/35), moderate trend (18/25).
          </div>
        </Card>
      </section>

      {/* Gamma deep dive */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <SectionTitle>Gamma Pillar &mdash; Deep Dive</SectionTitle>
        <Card>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: '#374151', marginBottom: 16 }}>
            The Gamma Pillar adapts its scoring method based on available data, falling through three tiers:
          </p>
          <CascadeDiagram tiers={[
            { tier: '1', label: 'GEX Available', description: 'Full gamma exposure data — max 40 pts', color: '#0B7A52' },
            { tier: '2', label: 'OI Only', description: 'Open Interest without GEX — max 28 pts', color: '#B7791F' },
            { tier: '3', label: 'Technicals Fallback', description: 'RSI + Bollinger proxy — max 22 pts', color: '#6b7280' },
          ]} />
          <div style={{ height: 20 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <TierCard
              tier="Tier 1"
              title="GEX Available"
              badge="Best"
              badgeColor="#0B7A52"
              formula="wallQuality × 0.6 + bandQuality × 0.4 → scaled to 40"
              description="When Gamma Exposure (GEX) data is available, we measure the quality of identified gamma walls and the width of the price band between them. A confidence score above 60% with a band width of 3-15% of spot price produces maximum scores."
            />
            <TierCard
              tier="Tier 2"
              title="OI Only"
              badge="Good"
              badgeColor="#B7791F"
              formula="bandQuality → scaled to 28 (capped lower)"
              description="When Open Interest data exists but GEX cannot be computed, we evaluate band quality alone. The maximum score is capped at 28 out of 40, reflecting reduced confidence."
            />
            <TierCard
              tier="Tier 3"
              title="Technicals Fallback"
              badge="Baseline"
              badgeColor="#6b7280"
              formula="rsiScore × 0.5 + bbScore × 0.5 → scaled to 22"
              description="When neither GEX nor OI data is available, we fall back to RSI and Bollinger Band width as proxies for gamma structure. Maximum score is 22 out of 40."
            />
          </div>
        </Card>
      </section>

      {/* IV deep dive */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <SectionTitle>IV Pillar &mdash; The Sweet Spot</SectionTitle>
        <Card>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: '#374151', marginBottom: 16 }}>
            Premium selling is most effective in a specific volatility regime. Our IV pillar scores highest when ATM implied volatility falls in the 20-50% range:
          </p>
          <div style={{
            background: 'rgba(183,121,31,0.06)', borderRadius: 12, padding: 20,
            border: '1px solid rgba(183,121,31,0.12)',
          }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <ZoneCard label="IV &lt; 20%" score="Proportional" color="#6b7280"
                detail="Score = (IV / 20) &times; 35. Thin premiums reduce reward without reducing risk." />
              <ZoneCard label="IV 20-50%" score="Full marks" color="#0B7A52"
                detail="Score = 35. The sweet spot &mdash; enough premium to collect, market not panicking." />
              <ZoneCard label="IV &gt; 50%" score="Decays to 0" color="#C94F4F"
                detail="Score = max(0, 1 - (IV-50)/50) &times; 35. High IV often signals danger ahead." />
            </div>
          </div>
          <p style={{ fontSize: 13, color: '#9ca3af', marginTop: 16, fontStyle: 'italic' }}>
            IV Rank (percentile vs. 30-day history) is also tracked and displayed but does not directly factor into the pillar score &mdash; it provides context for the human analyst.
          </p>
        </Card>
      </section>

      {/* Trend deep dive */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <SectionTitle>Trend Pillar &mdash; Conviction Matters</SectionTitle>
        <Card>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: '#374151', marginBottom: 16 }}>
            The trend pillar rewards conviction in either direction. A strongly bullish or bearish trend scores higher than a directionless market, because clear direction helps us select the right strategy and place strikes with confidence.
          </p>
          <div style={{
            fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#374151',
            background: 'rgba(99,102,241,0.04)', borderRadius: 12, padding: 20,
            border: '1px solid rgba(99,102,241,0.12)',
          }}>
            <div style={{ marginBottom: 8, fontWeight: 700, color: '#6366F1', fontSize: 11, letterSpacing: '.1em', textTransform: 'uppercase' }}>
              Formula
            </div>
            trendPillar = round((0.5 + |trendScore - 0.5|) &times; 25)
            <div style={{ marginTop: 12, fontSize: 12, color: '#6b7280', fontFamily: "'Inter', sans-serif" }}>
              Where trendScore is the technical engine&rsquo;s 0-1 output. A score of 0.85 (Strong Bullish) and 0.10 (Strong Bearish) both produce high pillar values. A neutral 0.50 produces the minimum.
            </div>
          </div>
        </Card>
      </section>

      {/* Score bands */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <SectionTitle>Score Interpretation</SectionTitle>
        <Card>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            <ScoreBand label="Excellent" range="75-100" color="#0B7A52" description="High-confidence setups. Strong gamma walls, ideal IV regime, clear trend." />
            <ScoreBand label="Good" range="60-74" color="#4caf85" description="Solid fundamentals with minor weakness in one pillar." />
            <ScoreBand label="Marginal" range="40-59" color="#B7791F" description="Mixed signals. Trade with caution or wait for improvement." />
            <ScoreBand label="Avoid" range="0-39" color="#C94F4F" description="Multiple pillars failing. Not enough edge to justify risk." />
          </div>
        </Card>
      </section>

      {/* CTA */}
      <CTASection
        title="Scored every morning. 111 stocks."
        subtitle="The scoring engine runs automatically during market hours, re-evaluating every 15 minutes with fresh price data."
        primaryHref="/how-we-pick"
        primaryLabel="See how we pick trades"
        secondaryHref="/probability-engine"
        secondaryLabel="Probability calculation"
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Shared sub-components
// ═══════════════════════════════════════════════════════════════

function Card({ children }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid rgba(17,24,39,0.08)',
      borderRadius: 16, padding: '24px 28px',
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <h2 style={{
      fontFamily: "'Playfair Display', Georgia, serif",
      fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 400,
      color: '#0B2D23', marginBottom: 16,
    }}>
      {children}
    </h2>
  );
}

function PillarCard({ name, range, weight, color, icon, description, factors }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid rgba(17,24,39,0.08)',
      borderRadius: 16, padding: '24px 20px',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 16, color }}>{icon}</span>
        <span style={{ fontWeight: 700, fontSize: 15, color }}>{name}</span>
      </div>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 22, fontWeight: 700, color: '#0B2D23', marginBottom: 4 }}>
        {range}
      </div>
      <div style={{ fontSize: 11, color: '#9ca3af', letterSpacing: '.08em', textTransform: 'uppercase', marginBottom: 12 }}>
        {weight} of total score
      </div>
      <p style={{ fontSize: 13, lineHeight: 1.7, color: '#6b6b60', marginBottom: 14 }}>{description}</p>
      <ul style={{ margin: 0, paddingLeft: 16 }}>
        {factors.map((f, i) => (
          <li key={i} style={{ fontSize: 12, color: '#374151', lineHeight: 1.8 }}>{f}</li>
        ))}
      </ul>
    </div>
  );
}

function TierCard({ tier, title, badge, badgeColor, formula, description }) {
  return (
    <div style={{
      background: 'rgba(17,24,39,0.02)', borderRadius: 12, padding: '16px 20px',
      border: '1px solid rgba(17,24,39,0.06)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 700, color: '#9ca3af' }}>{tier}</span>
        <span style={{ fontWeight: 700, fontSize: 14, color: '#0B2D23' }}>{title}</span>
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
          background: badgeColor + '15', color: badgeColor, letterSpacing: '.06em',
        }}>{badge}</span>
      </div>
      <div style={{
        fontFamily: "'Space Mono', monospace", fontSize: 12, color: '#0B2D23',
        background: 'rgba(17,24,39,0.04)', borderRadius: 6, padding: '8px 12px', marginBottom: 10,
      }}>
        {formula}
      </div>
      <p style={{ fontSize: 13, lineHeight: 1.7, color: '#6b6b60', margin: 0 }}>{description}</p>
    </div>
  );
}

function ZoneCard({ label, score, color, detail }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, color, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#0B2D23', marginBottom: 6 }}>{score}</div>
      <div style={{ fontSize: 11, color: '#6b6b60', lineHeight: 1.5 }}>{detail}</div>
    </div>
  );
}

function ScoreBand({ label, range, color, description }) {
  return (
    <div style={{ textAlign: 'center', padding: '16px 12px' }}>
      <div style={{
        width: '100%', height: 6, borderRadius: 3, background: color, marginBottom: 12, opacity: 0.7,
      }} />
      <div style={{ fontWeight: 700, fontSize: 14, color, marginBottom: 2 }}>{label}</div>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 16, fontWeight: 700, color: '#0B2D23', marginBottom: 6 }}>{range}</div>
      <div style={{ fontSize: 12, color: '#6b6b60', lineHeight: 1.5 }}>{description}</div>
    </div>
  );
}

function CTASection({ title, subtitle, primaryHref, primaryLabel, secondaryHref, secondaryLabel }) {
  return (
    <section style={{ maxWidth: 600, margin: '0 auto', padding: '60px 2rem 100px', textAlign: 'center' }}>
      <h2 style={{
        fontFamily: "'Playfair Display', Georgia, serif",
        fontSize: 'clamp(22px, 3.5vw, 32px)', fontWeight: 400, color: '#0B2D23',
        marginBottom: 12,
      }}>
        {title}
      </h2>
      <p style={{ fontSize: 15, color: '#6b6b60', lineHeight: 1.7, marginBottom: 32 }}>
        {subtitle}
      </p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <a href={secondaryHref} style={{
          padding: '14px 28px', borderRadius: 10,
          background: 'rgba(11,45,35,0.06)', border: '1px solid rgba(11,45,35,0.12)',
          fontSize: 14, fontWeight: 600, color: '#0B2D23', textDecoration: 'none',
        }}>
          {secondaryLabel} &rarr;
        </a>
        <a href={primaryHref} style={{
          padding: '14px 28px', borderRadius: 10,
          background: '#C9A96E', color: '#0B2D23',
          fontSize: 14, fontWeight: 700, textDecoration: 'none',
          boxShadow: '0 4px 16px rgba(201,169,110,0.25)',
        }}>
          {primaryLabel} &rarr;
        </a>
      </div>
    </section>
  );
}
