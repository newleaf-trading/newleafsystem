/**
 * /technical-analysis — Technical analysis documentation page.
 *
 * Documents RSI, Bollinger Bands, moving averages, trend engine,
 * realized volatility, and ATR calculations.
 */
import { PipelineFlow, MergeDiagram } from '../shared/Diagrams';
import PageSEO from '../../shared/components/PageSEO';

export function TechnicalAnalysisPage() {
  return (
    <div style={{
      fontFamily: "'Inter', -apple-system, sans-serif",
      background: '#F7F4EE', color: '#0B0F14', minHeight: '100vh',
    }}>
      <PageSEO title="Technical Analysis — Multi-Timeframe Signals" description="NewLeaf's technical analysis engine combines multi-timeframe trend detection, support/resistance levels, and momentum indicators to time options entries." path="/technical-analysis" />
      {/* Hero */}
      <section style={{ maxWidth: 800, margin: '0 auto', padding: '120px 2rem 60px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.15em', textTransform: 'uppercase', color: '#C9A96E', marginBottom: 16 }}>How It Works</div>
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 400, lineHeight: 1.1, letterSpacing: '-1.5px', color: '#0B2D23', marginBottom: 16 }}>
          Technical Analysis
        </h1>
        <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(16px, 2vw, 20px)', fontStyle: 'italic', color: '#C9A96E', marginBottom: 32 }}>
          RSI. Bollinger Bands. Moving averages. Quantified.
        </p>
        <p style={{ fontSize: 15, lineHeight: 1.75, color: '#6b6b60', maxWidth: 600, margin: '0 auto' }}>
          Our technical analysis engine runs six independent indicators on 250 days of price history for every
          symbol, every 15 minutes. These feed into the Trend Pillar of the opportunity score and drive strategy selection.
        </p>
      </section>

      {/* Indicator pipeline */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <Card>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 12 }}>
            Technical Indicator Pipeline
          </div>
          <PipelineFlow steps={[
            { label: '250-Day\nHistory', sub: 'OHLCV bars', color: '#6b7280', icon: '\u{1F4C5}' },
            { label: 'RSI', sub: '14-period', color: '#C94F4F', icon: '\u{1F4C9}' },
            { label: 'Bollinger', sub: '20-period', color: '#6366F1', icon: '\u{1F4CA}' },
            { label: 'SMA', sub: '50/100/200', color: '#0B7A52', icon: '\u{1F4C8}' },
            { label: 'RV & ATR', sub: '30/14 day', color: '#B7791F', icon: '\u{1F4CF}' },
          ]} />
        </Card>
      </section>

      {/* Composite merge */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <MergeDiagram
          inputs={[
            { label: 'Trend', detail: '40% weight', color: '#0B7A52', icon: '\u{1F4C8}' },
            { label: 'Volatility', detail: '30% weight', color: '#6366F1', icon: '\u{1F4CA}' },
            { label: 'Levels', detail: '30% weight', color: '#B7791F', icon: '\u{1F4CF}' },
          ]}
          output={{ label: 'Composite Score', detail: '0.0 - 1.0', color: '#C9A96E', icon: '\u{1F3AF}' }}
          label="weighted composite"
        />
      </section>

      {/* RSI */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <SectionTitle>RSI &mdash; Relative Strength Index</SectionTitle>
        <Card>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <p style={{ fontSize: 14, lineHeight: 1.8, color: '#374151', marginBottom: 16 }}>
                The 14-period RSI measures momentum by comparing average gains versus average losses. We use it
                to detect overbought and oversold conditions that inform strike placement.
              </p>
              <Formula>RSI = 100 - (100 / (1 + avgGain / avgLoss))</Formula>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <RSIZone label="Overbought" range="> 80" color="#C94F4F" description="Extreme upside momentum. Price may revert. Favours bearish strategies." />
              <RSIZone label="Near Overbought" range="70-80" color="#d97706" description="Elevated momentum. Monitor for reversal signals." />
              <RSIZone label="Neutral" range="30-70" color="#6b7280" description="Normal trading range. Both bullish and bearish setups valid." />
              <RSIZone label="Near Oversold" range="20-30" color="#d97706" description="Momentum weakening. Watch for bounce." />
              <RSIZone label="Oversold" range="< 20" color="#0B7A52" description="Extreme downside. Price may bounce. Favours bullish strategies." />
            </div>
          </div>
        </Card>
      </section>

      {/* Bollinger Bands */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <SectionTitle>Bollinger Bands</SectionTitle>
        <Card>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: '#374151', marginBottom: 16 }}>
            20-period Bollinger Bands with 2 standard deviations measure price volatility and squeeze conditions.
            Band width is a key input to the Gamma Pillar&rsquo;s fallback tier.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Formula>
              {'SMA = 20-day simple moving average\nUpper = SMA + 2 \u00d7 SD\nLower = SMA - 2 \u00d7 SD\nWidth = (2 \u00d7 SD / SMA) \u00d7 100'}
            </Formula>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <VolState label="Squeeze" range="< 5%" color="#6366F1" description="Tight bands signal low volatility. Breakout imminent." />
              <VolState label="Normal" range="5-12%" color="#0B7A52" description="Ideal volatility for premium selling strategies." />
              <VolState label="High" range="12-20%" color="#B7791F" description="Elevated volatility. Wider strikes recommended." />
              <VolState label="Very High" range="> 20%" color="#C94F4F" description="Extreme volatility. Caution advised." />
            </div>
          </div>
        </Card>
      </section>

      {/* Moving Averages & Trend */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <SectionTitle>Trend Engine &mdash; Moving Average Analysis</SectionTitle>
        <Card>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: '#374151', marginBottom: 20 }}>
            The trend engine computes SMA 50, SMA 100, and SMA 200, then classifies the trend based on
            crossover state and price position relative to these averages:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <TrendRow score="0.85" state="Strong Bullish" color="#0B7A52"
              condition="SMA50/SMA100 ratio > 1.02, price above both, > 1.03 above SMA100" />
            <TrendRow score="0.70" state="Bullish" color="#4caf85"
              condition="SMA50/SMA100 ratio > 1.005, price above SMA50" />
            <TrendRow score="0.55" state="Bearish Pressure, Bounce" color="#d97706"
              condition="SMA50/SMA100 ratio < 0.98, but price recovering above SMA50" />
            <TrendRow score="0.50" state="Neutral" color="#6b7280"
              condition="Converging SMAs, price near both averages" />
            <TrendRow score="0.45" state="Bullish Structure, Weak" color="#d97706"
              condition="SMA50/SMA100 ratio > 1.02, but price falling below SMA50" />
            <TrendRow score="0.30" state="Bearish" color="#e05c5c"
              condition="SMA50/SMA100 ratio < 0.995, price below SMA50" />
            <TrendRow score="0.10" state="Strong Bearish" color="#C94F4F"
              condition="SMA50/SMA100 ratio < 0.98, price below both, < 0.97 below SMA100" />
          </div>
          <div style={{ marginTop: 16, padding: '12px 16px', background: 'rgba(201,169,110,0.08)', borderRadius: 10, border: '1px solid rgba(201,169,110,0.15)' }}>
            <span style={{ fontSize: 12, color: '#B7791F', fontWeight: 600 }}>Golden Cross:</span>
            <span style={{ fontSize: 12, color: '#6b6b60', marginLeft: 6 }}>SMA50 crosses above SMA100 &mdash; bullish signal</span>
            <span style={{ fontSize: 12, color: '#6b6b60', margin: '0 12px' }}>&bull;</span>
            <span style={{ fontSize: 12, color: '#C94F4F', fontWeight: 600 }}>Death Cross:</span>
            <span style={{ fontSize: 12, color: '#6b6b60', marginLeft: 6 }}>SMA50 crosses below SMA100 &mdash; bearish signal</span>
          </div>
        </Card>
      </section>

      {/* Composite score */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <SectionTitle>Composite Technical Score</SectionTitle>
        <Card>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: '#374151', marginBottom: 16 }}>
            Three independent scoring engines combine into a single composite score:
          </p>
          <Formula>Composite = (Trend &times; 0.4) + (Volatility &times; 0.3) + (Level &times; 0.3)</Formula>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 20 }}>
            <CompositeLabel label="Strong Setup" range="&ge; 0.75" color="#0B7A52" />
            <CompositeLabel label="Moderate Setup" range="&ge; 0.60" color="#4caf85" />
            <CompositeLabel label="Weak Setup" range="&ge; 0.45" color="#B7791F" />
            <CompositeLabel label="Avoid" range="< 0.45" color="#C94F4F" />
          </div>
        </Card>
      </section>

      {/* Additional metrics */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <SectionTitle>Additional Metrics</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#0B2D23', marginBottom: 8 }}>Realized Volatility (30-day)</div>
            <Formula>{'Returns = ln(price[i] / price[i-1])\nRV = \u221a(mean(returns\u00b2) \u00d7 252)'}</Formula>
            <p style={{ fontSize: 12, color: '#6b6b60', marginTop: 10, lineHeight: 1.6 }}>
              Compares actual price movement to implied volatility. When RV &lt; IV, premium sellers have an edge.
            </p>
          </Card>
          <Card>
            <div style={{ fontWeight: 700, fontSize: 14, color: '#0B2D23', marginBottom: 8 }}>ATR % (14-period)</div>
            <Formula>{'ATR = avg(|high-low|, 14 days)\nATR% = ATR / current_price'}</Formula>
            <p style={{ fontSize: 12, color: '#6b6b60', marginTop: 10, lineHeight: 1.6 }}>
              Average True Range as a percentage of price. Used for strike width sizing and expected move estimation.
            </p>
          </Card>
        </div>
      </section>

      {/* CTA */}
      <section style={{ maxWidth: 600, margin: '0 auto', padding: '60px 2rem 100px', textAlign: 'center' }}>
        <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(22px, 3.5vw, 32px)', fontWeight: 400, color: '#0B2D23', marginBottom: 12 }}>
          Six indicators. Every stock. Every 15 minutes.
        </h2>
        <p style={{ fontSize: 15, color: '#6b6b60', lineHeight: 1.7, marginBottom: 32 }}>
          Technical analysis runs continuously during market hours, feeding real-time signals into the scoring engine.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/gamma-analysis" style={{ padding: '14px 28px', borderRadius: 10, background: 'rgba(11,45,35,0.06)', border: '1px solid rgba(11,45,35,0.12)', fontSize: 14, fontWeight: 600, color: '#0B2D23', textDecoration: 'none' }}>Gamma wall analysis &rarr;</a>
          <a href="/ai-sentiment" style={{ padding: '14px 28px', borderRadius: 10, background: '#C9A96E', color: '#0B2D23', fontSize: 14, fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 16px rgba(201,169,110,0.25)' }}>AI sentiment analysis &rarr;</a>
        </div>
      </section>
    </div>
  );
}

// Sub-components
function Card({ children }) { return <div style={{ background: '#fff', border: '1px solid rgba(17,24,39,0.08)', borderRadius: 16, padding: '24px 28px' }}>{children}</div>; }
function SectionTitle({ children }) { return <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 400, color: '#0B2D23', marginBottom: 16 }}>{children}</h2>; }

function Formula({ children }) {
  return (
    <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#0B2D23', background: 'rgba(11,45,35,0.04)', borderRadius: 10, padding: '14px 18px', border: '1px solid rgba(11,45,35,0.08)', whiteSpace: 'pre-line' }}>
      {children}
    </div>
  );
}

function RSIZone({ label, range, color, description }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '110px 50px 1fr', gap: 8, alignItems: 'center', padding: '6px 12px', borderRadius: 8, background: `${color}08` }}>
      <span style={{ fontWeight: 700, fontSize: 12, color }}>{label}</span>
      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: '#374151' }}>{range}</span>
      <span style={{ fontSize: 11, color: '#6b6b60' }}>{description}</span>
    </div>
  );
}

function VolState({ label, range, color, description }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '80px 50px 1fr', gap: 8, alignItems: 'center', padding: '6px 12px', borderRadius: 8, background: `${color}08` }}>
      <span style={{ fontWeight: 700, fontSize: 12, color }}>{label}</span>
      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: '#374151' }}>{range}</span>
      <span style={{ fontSize: 11, color: '#6b6b60' }}>{description}</span>
    </div>
  );
}

function TrendRow({ score, state, color, condition }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '48px 170px 1fr', gap: 12, alignItems: 'center', padding: '8px 14px', borderRadius: 10, background: `${color}08`, border: `1px solid ${color}12` }}>
      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 14, fontWeight: 700, color }}>{score}</span>
      <span style={{ fontWeight: 700, fontSize: 13, color }}>{state}</span>
      <span style={{ fontSize: 12, color: '#6b6b60' }}>{condition}</span>
    </div>
  );
}

function CompositeLabel({ label, range, color }) {
  return (
    <div style={{ textAlign: 'center', padding: '12px 8px' }}>
      <div style={{ width: '100%', height: 4, borderRadius: 2, background: color, marginBottom: 8, opacity: 0.6 }} />
      <div style={{ fontWeight: 700, fontSize: 13, color }}>{label}</div>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 14, fontWeight: 700, color: '#0B2D23', marginTop: 2 }}>{range}</div>
    </div>
  );
}
