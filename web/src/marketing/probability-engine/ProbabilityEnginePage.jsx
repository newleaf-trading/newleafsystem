/**
 * /probability-engine — Probability of profit and Black-Scholes documentation.
 *
 * Documents how NewLeaf calculates probability of profit, option pricing,
 * Greeks, and the three-tier pricing hierarchy.
 */
import { PipelineFlow, CascadeDiagram, MergeDiagram, VerticalFlow } from '../shared/Diagrams';
import PageSEO from '../../shared/components/PageSEO';

export function ProbabilityEnginePage() {
  return (
    <div style={{
      fontFamily: "'Inter', -apple-system, sans-serif",
      background: '#F7F4EE', color: '#0B0F14', minHeight: '100vh',
    }}>
      <PageSEO title="Probability Engine — Options Probability Analysis" description="NewLeaf's probability engine calculates expected move ranges, probability of profit, and scenario analysis for every options strategy using real-time market data." path="/probability-engine" />
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
          Probability Engine
        </h1>
        <p style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 'clamp(16px, 2vw, 20px)', fontStyle: 'italic',
          color: '#C9A96E', marginBottom: 32,
        }}>
          Black-Scholes. Three-tier pricing. Real probabilities.
        </p>
        <p style={{ fontSize: 15, lineHeight: 1.75, color: '#6b6b60', maxWidth: 600, margin: '0 auto' }}>
          Every trade recommendation includes a probability of profit, real-time P&amp;L tracking, and
          Greeks that update with the market. Here&rsquo;s the mathematics behind the numbers.
        </p>
      </section>

      {/* Pricing pipeline diagram */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <Card>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 12 }}>
            Option Pricing Pipeline
          </div>
          <PipelineFlow steps={[
            { label: 'Spot Price', sub: 'Live feed', color: '#6b7280', icon: '\u{1F4B2}' },
            { label: 'Options Chain', sub: 'Strike + IV', color: '#6b7280', icon: '\u{26D3}' },
            { label: 'Black-Scholes', sub: 'd1, d2, N(x)', color: '#0B7A52', icon: '\u{1F9EE}' },
            { label: 'Greeks', sub: '\u0394 \u0393 \u0398 V', color: '#6366F1', icon: '\u{1F4D0}' },
            { label: 'P&L', sub: 'Per leg', color: '#B7791F', icon: '\u{1F4B0}' },
            { label: 'Verdict', sub: '5 states', color: '#C9A96E', icon: '\u{2696}', round: true },
          ]} />
        </Card>
      </section>

      {/* Black-Scholes */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <SectionTitle>Black-Scholes Option Pricing</SectionTitle>
        <Card>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: '#374151', marginBottom: 20 }}>
            At the core of our probability engine is the Black-Scholes model. We use it for option pricing,
            Greeks calculation, and probability estimation when market prices are unavailable.
          </p>
          <FormulaBlock title="Core Equations">
            <div style={{ marginBottom: 12 }}>
              <span style={{ color: '#0B7A52', fontWeight: 700 }}>d1</span> = (ln(S/K) + (r + &sigma;&sup2;/2)T) / (&sigma;&radic;T)
            </div>
            <div style={{ marginBottom: 12 }}>
              <span style={{ color: '#0B7A52', fontWeight: 700 }}>d2</span> = d1 - &sigma;&radic;T
            </div>
            <div style={{ marginBottom: 12 }}>
              <span style={{ color: '#B7791F', fontWeight: 700 }}>Call</span> = S &times; N(d1) - K &times; e<sup>-rT</sup> &times; N(d2)
            </div>
            <div>
              <span style={{ color: '#B7791F', fontWeight: 700 }}>Put</span> = K &times; e<sup>-rT</sup> &times; N(-d2) - S &times; N(-d1)
            </div>
          </FormulaBlock>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12, marginTop: 20 }}>
            <ParamCard symbol="S" name="Spot Price" description="Current market price of the underlying stock or ETF" />
            <ParamCard symbol="K" name="Strike Price" description="The exercise price of the option contract" />
            <ParamCard symbol="T" name="Time to Expiry" description="Years remaining until expiration (DTE / 365)" />
            <ParamCard symbol="&sigma;" name="Implied Volatility" description="Market's expectation of future price movement (annualised)" />
            <ParamCard symbol="r" name="Risk-Free Rate" description="Treasury rate, defaulting to 4.5% in our models" />
            <ParamCard symbol="N(x)" name="Normal CDF" description="Cumulative standard normal distribution function" />
          </div>
        </Card>
      </section>

      {/* Greeks */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <SectionTitle>The Greeks</SectionTitle>
        <Card>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: '#374151', marginBottom: 20 }}>
            Greeks measure how option prices respond to changes in market conditions. We compute them for every
            leg of every position, every 15 minutes.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <GreekCard
              letter="&Delta;"
              name="Delta"
              formula="Call: N(d1) &nbsp;|&nbsp; Put: N(d1) - 1"
              description="Rate of change of option price per $1 move in the underlying. Our verdict engine monitors short delta to trigger adjustments when it exceeds 0.35."
              color="#0B7A52"
            />
            <GreekCard
              letter="&Gamma;"
              name="Gamma"
              formula="N'(d1) / (S &times; &sigma; &times; &radic;T)"
              description="Rate of change of delta. Gamma risk accelerates inside 21 DTE, which is why we apply the 21-DTE escalation rule."
              color="#6366F1"
            />
            <GreekCard
              letter="&Theta;"
              name="Theta"
              formula="(-S&times;N'(d1)&times;&sigma; / 2&radic;T - r&times;K&times;e^(-rT)&times;N(d2)) / 365"
              description="Time decay per day. This is the premium seller's primary income — our strategies are designed to maximise theta capture."
              color="#B7791F"
            />
            <GreekCard
              letter="V"
              name="Vega"
              formula="S &times; N'(d1) &times; &radic;T / 100"
              description="Sensitivity to a 1% change in implied volatility. We track vega exposure to detect IV regime shifts that may require position adjustment."
              color="#C94F4F"
            />
          </div>
        </Card>
      </section>

      {/* Three-tier pricing */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <SectionTitle>Three-Tier Pricing Hierarchy</SectionTitle>
        <Card>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: '#374151', marginBottom: 20 }}>
            For live P&amp;L tracking, we use a cascading pricing system that balances accuracy with availability:
          </p>
          <CascadeDiagram tiers={[
            { tier: '1', label: 'R2 Market Match', description: 'Exact mid-price from latest 15-min scan', color: '#0B7A52' },
            { tier: '2', label: 'Black-Scholes Estimate', description: 'Modelled price using spot + entry IV', color: '#B7791F' },
            { tier: '3', label: 'Intrinsic Value', description: 'max(0, S-K) for calls, max(0, K-S) for puts', color: '#6b7280' },
          ]} />
          <div style={{ height: 20 }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <TierRow
              tier="1"
              title="R2 Market Match"
              badge="Most Accurate"
              badgeColor="#0B7A52"
              description="Exact mid-price from our latest 15-minute scan. Uses real bid-ask data from Alpaca's options feed. Available during market hours for all watchlist symbols."
            />
            <TierRow
              tier="2"
              title="Black-Scholes Estimate"
              badge="Modelled"
              badgeColor="#B7791F"
              description="When market data is stale or unavailable, we estimate the option price using Black-Scholes with the current spot price and the IV observed at entry. Accurate for liquid names."
            />
            <TierRow
              tier="3"
              title="Intrinsic Value"
              badge="Fallback"
              badgeColor="#6b7280"
              description="At or near expiry when time value approaches zero, we use intrinsic value: max(0, S-K) for calls, max(0, K-S) for puts. Simple but correct at expiration."
            />
          </div>
        </Card>
      </section>

      {/* Profit capture */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <SectionTitle>Profit Capture Metric</SectionTitle>
        <Card>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: '#374151', marginBottom: 16 }}>
            Every open position tracks its profit capture percentage &mdash; how much of the maximum possible profit
            has been realised so far:
          </p>
          <FormulaBlock title="Profit Capture">
            <div>profitCapturePct = (currentNetValue / maxProfit) &times; 100</div>
          </FormulaBlock>
          <p style={{ fontSize: 13, color: '#6b6b60', marginTop: 16, lineHeight: 1.7 }}>
            This metric drives automated take-profit alerts. For Iron Condors and Bull Put Spreads, we recommend
            closing at 50% profit capture. For Iron Butterflies, the threshold is 25% due to their narrower profit zone.
          </p>
        </Card>
      </section>

      {/* CTA */}
      <CTASection
        title="Maths you can trust"
        subtitle="The same Black-Scholes model used by institutional desks, applied to every recommendation, every day."
        primaryHref="/strategy-selection"
        primaryLabel="Strategy selection"
        secondaryHref="/how-we-score"
        secondaryLabel="Scoring algorithm"
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Sub-components
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

function FormulaBlock({ title, children }) {
  return (
    <div style={{
      fontFamily: "'Space Mono', monospace", fontSize: 14, color: '#0B2D23',
      background: 'rgba(11,45,35,0.04)', borderRadius: 12, padding: '20px 24px',
      border: '1px solid rgba(11,45,35,0.08)',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 12 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function ParamCard({ symbol, name, description }) {
  return (
    <div style={{
      background: 'rgba(17,24,39,0.02)', borderRadius: 10, padding: '12px 16px',
      border: '1px solid rgba(17,24,39,0.05)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <span style={{
          fontFamily: "'Space Mono', monospace", fontSize: 18, fontWeight: 700, color: '#C9A96E',
          width: 28, textAlign: 'center',
        }}>
          {symbol}
        </span>
        <span style={{ fontWeight: 700, fontSize: 13, color: '#0B2D23' }}>{name}</span>
      </div>
      <p style={{ fontSize: 12, color: '#6b6b60', margin: 0, paddingLeft: 38, lineHeight: 1.5 }}>{description}</p>
    </div>
  );
}

function GreekCard({ letter, name, formula, description, color }) {
  return (
    <div style={{
      background: `${color}08`, borderRadius: 14, padding: '18px 20px',
      border: `1px solid ${color}18`,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
        <span style={{
          fontFamily: "'Playfair Display', Georgia, serif", fontSize: 28, fontWeight: 700, color,
        }}>
          {letter}
        </span>
        <span style={{ fontWeight: 700, fontSize: 15, color: '#0B2D23' }}>{name}</span>
      </div>
      <div style={{
        fontFamily: "'Space Mono', monospace", fontSize: 11, color: '#374151',
        background: 'rgba(17,24,39,0.04)', borderRadius: 6, padding: '6px 10px', marginBottom: 10,
      }}>
        {formula}
      </div>
      <p style={{ fontSize: 12, lineHeight: 1.6, color: '#6b6b60', margin: 0 }}>{description}</p>
    </div>
  );
}

function TierRow({ tier, title, badge, badgeColor, description }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '36px 1fr', gap: 16, alignItems: 'start',
      background: 'rgba(17,24,39,0.02)', borderRadius: 12, padding: '16px 20px',
      border: '1px solid rgba(17,24,39,0.06)',
    }}>
      <div style={{
        fontFamily: "'Space Mono', monospace", fontSize: 20, fontWeight: 700, color: '#C9A96E',
        textAlign: 'center', lineHeight: '28px',
      }}>
        {tier}
      </div>
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#0B2D23' }}>{title}</span>
          <span style={{
            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
            background: badgeColor + '15', color: badgeColor, letterSpacing: '.06em',
          }}>{badge}</span>
        </div>
        <p style={{ fontSize: 13, lineHeight: 1.7, color: '#6b6b60', margin: 0 }}>{description}</p>
      </div>
    </div>
  );
}

function CTASection({ title, subtitle, primaryHref, primaryLabel, secondaryHref, secondaryLabel }) {
  return (
    <section style={{ maxWidth: 600, margin: '0 auto', padding: '60px 2rem 100px', textAlign: 'center' }}>
      <h2 style={{
        fontFamily: "'Playfair Display', Georgia, serif",
        fontSize: 'clamp(22px, 3.5vw, 32px)', fontWeight: 400, color: '#0B2D23', marginBottom: 12,
      }}>
        {title}
      </h2>
      <p style={{ fontSize: 15, color: '#6b6b60', lineHeight: 1.7, marginBottom: 32 }}>{subtitle}</p>
      <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
        <a href={secondaryHref} style={{
          padding: '14px 28px', borderRadius: 10, background: 'rgba(11,45,35,0.06)',
          border: '1px solid rgba(11,45,35,0.12)', fontSize: 14, fontWeight: 600, color: '#0B2D23', textDecoration: 'none',
        }}>{secondaryLabel} &rarr;</a>
        <a href={primaryHref} style={{
          padding: '14px 28px', borderRadius: 10, background: '#C9A96E', color: '#0B2D23',
          fontSize: 14, fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 16px rgba(201,169,110,0.25)',
        }}>{primaryLabel} &rarr;</a>
      </div>
    </section>
  );
}
