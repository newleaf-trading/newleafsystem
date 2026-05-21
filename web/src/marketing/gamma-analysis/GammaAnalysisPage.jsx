/**
 * /gamma-analysis — Gamma wall analysis documentation page.
 *
 * Documents GEX calculation, wall detection, multi-factor scoring,
 * confidence scoring, and band width analysis.
 */
import { PipelineFlow, MergeDiagram, DecisionTree } from '../shared/Diagrams';
import PageSEO from '../../shared/components/PageSEO';

export function GammaAnalysisPage() {
  return (
    <div style={{
      fontFamily: "'Inter', -apple-system, sans-serif",
      background: '#F7F4EE', color: '#0B0F14', minHeight: '100vh',
    }}>
      <PageSEO title="Gamma Analysis — Options Flow & Positioning" description="Analyze gamma exposure walls, dealer positioning, and options flow data to identify key price levels and expected volatility zones for smarter trade timing." path="/gamma-analysis" />
      {/* Hero */}
      <section style={{ maxWidth: 800, margin: '0 auto', padding: '120px 2rem 60px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.15em', textTransform: 'uppercase', color: '#C9A96E', marginBottom: 16 }}>How It Works</div>
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 400, lineHeight: 1.1, letterSpacing: '-1.5px', color: '#0B2D23', marginBottom: 16 }}>
          Gamma Wall Analysis
        </h1>
        <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(16px, 2vw, 20px)', fontStyle: 'italic', color: '#C9A96E', marginBottom: 32 }}>
          Where dealers defend. Where price stalls.
        </p>
        <p style={{ fontSize: 15, lineHeight: 1.75, color: '#6b6b60', maxWidth: 620, margin: '0 auto' }}>
          Gamma walls form at strikes where market makers hold concentrated options positions.
          These strikes act as magnets and barriers for price movement &mdash; exactly the corridors
          premium sellers need. Our analysis identifies them in real-time.
        </p>
      </section>

      {/* Gamma analysis pipeline */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <Card>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 12 }}>
            Gamma Analysis Pipeline
          </div>
          <PipelineFlow steps={[
            { label: 'Options\nChain', sub: 'All strikes', color: '#6b7280', icon: '\u{26D3}' },
            { label: 'OI +\nVolume', sub: 'Yahoo + Alpaca', color: '#6b7280', icon: '\u{1F4CA}' },
            { label: 'GEX Calc', sub: '\u03B3 \u00d7 OI \u00d7 100 \u00d7 S', color: '#0B7A52', icon: '\u{1F9EE}' },
            { label: 'Wall\nDetection', sub: 'Multi-factor', color: '#6366F1', icon: '\u{1F6E1}' },
            { label: 'Band\nWidth', sub: 'Put-Call gap', color: '#B7791F', icon: '\u{1F4CF}' },
            { label: 'Confidence', sub: '0-100%', color: '#C9A96E', icon: '\u{2705}', round: true },
          ]} />
        </Card>
      </section>

      {/* Multi-factor merge */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <MergeDiagram
          inputs={[
            { label: 'Open Interest', detail: '60% weight', color: '#0B7A52', icon: '\u{1F4CA}' },
            { label: 'OI Delta', detail: '30% weight', color: '#6366F1', icon: '\u{1F4C8}' },
            { label: 'Volume', detail: '10% weight', color: '#B7791F', icon: '\u{1F4B9}' },
          ]}
          output={{ label: 'Multi-Factor Wall Score', detail: 'Per strike', color: '#0B2D23' }}
          label="weighted score"
        />
      </section>

      {/* Wall result decision */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <Card>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 12 }}>
            Wall Classification
          </div>
          <DecisionTree
            root={{ label: 'Highest Multi-Factor Score', sub: 'Per side (puts below, calls above spot)', color: '#0B2D23' }}
            branches={[
              { label: 'Put Wall', condition: 'Below spot', sub: 'Support level — dealers buy dips here', color: '#0B7A52' },
              { label: 'Gamma Flip', condition: 'Net GEX = 0', sub: 'Transition from stabilising to amplifying', color: '#B7791F' },
              { label: 'Call Wall', condition: 'Above spot', sub: 'Resistance level — dealers sell rallies here', color: '#C94F4F' },
            ]}
          />
        </Card>
      </section>

      {/* GEX Calculation */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <SectionTitle>Gamma Exposure (GEX)</SectionTitle>
        <Card>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: '#374151', marginBottom: 16 }}>
            GEX quantifies the dollar-denominated gamma exposure at each strike. It tells us how much
            dealers need to hedge for a $1 move in the underlying.
          </p>
          <Formula>GEX = gamma &times; openInterest &times; 100 &times; spotPrice</Formula>
          <p style={{ fontSize: 13, color: '#6b6b60', marginTop: 16, lineHeight: 1.7 }}>
            Positive GEX (call-dominated strikes) creates a stabilising effect &mdash; dealers buy dips and sell
            rallies. Negative GEX (put-dominated) amplifies moves. The <strong>gamma flip</strong> level where
            net GEX crosses zero is a critical inflection point.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 20 }}>
            <InfoBox color="#0B7A52" title="Positive GEX Zone" description="Above gamma flip. Dealers hedge by selling rallies and buying dips. Price tends to stay rangebound. Ideal for premium selling." />
            <InfoBox color="#C94F4F" title="Negative GEX Zone" description="Below gamma flip. Dealers amplify moves by selling into declines. Price becomes volatile. Premium selling carries higher risk." />
          </div>
        </Card>
      </section>

      {/* Multi-factor wall detection */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <SectionTitle>Multi-Factor Wall Detection</SectionTitle>
        <Card>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: '#374151', marginBottom: 20 }}>
            We don&rsquo;t just look at Open Interest. Our enhanced wall detection uses a weighted multi-factor score
            to identify the most meaningful strikes:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            <FactorCard
              weight="60%"
              name="Open Interest"
              color="#0B7A52"
              description="Raw OI concentration at each strike, normalised against the maximum across all strikes. The dominant factor in wall identification."
              formula="oiScore = (oi / maxOI) \u00d7 0.60"
            />
            <FactorCard
              weight="30%"
              name="OI Delta"
              color="#6366F1"
              description="Day-over-day change in Open Interest. Rising OI indicates new positions being built, confirming the wall's strength."
              formula="deltaScore = (|oiChange| / maxOIChange) \u00d7 0.30"
            />
            <FactorCard
              weight="10%"
              name="Volume"
              color="#B7791F"
              description="Today's trading volume at each strike. High volume confirms active interest and liquidity."
              formula="volScore = (volume / maxVolume) \u00d7 0.10"
            />
          </div>
          <div style={{ marginTop: 16, padding: '14px 18px', background: 'rgba(11,45,35,0.04)', borderRadius: 10, border: '1px solid rgba(11,45,35,0.08)' }}>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#0B2D23', textAlign: 'center' }}>
              Multi-Factor Score = OI Score + Delta Score + Volume Score
            </div>
          </div>
        </Card>
      </section>

      {/* Wall identification */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <SectionTitle>Wall Identification</SectionTitle>
        <Card>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#0B7A52', marginBottom: 10 }}>Put Wall</div>
              <p style={{ fontSize: 13, lineHeight: 1.7, color: '#6b6b60' }}>
                The strike with the highest put multi-factor score below the current spot price (within 15% range).
                Acts as <strong>support</strong> &mdash; dealers holding puts here will buy the underlying to hedge,
                creating buying pressure.
              </p>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: '#C94F4F', marginBottom: 10 }}>Call Wall</div>
              <p style={{ fontSize: 13, lineHeight: 1.7, color: '#6b6b60' }}>
                The strike with the highest call multi-factor score above the current spot price (within 15% range).
                Acts as <strong>resistance</strong> &mdash; dealers holding calls here will sell the underlying to hedge,
                creating selling pressure.
              </p>
            </div>
          </div>
        </Card>
      </section>

      {/* Confidence & band */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <SectionTitle>Confidence Scoring</SectionTitle>
        <Card>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: '#374151', marginBottom: 20 }}>
            Not all gamma wall readings are equally reliable. Our confidence score evaluates data quality:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <ConfidenceRow factor="OI Coverage" description="Percentage of strikes with non-zero Open Interest. Higher coverage = better wall identification." weight="Base" />
            <ConfidenceRow factor="Delta Magnitude" description="Average OI change per strike. Above 100 contracts/strike indicates strong institutional flow." weight="+Bonus" />
            <ConfidenceRow factor="Volume Depth" description="Average volume relative to 500 contracts threshold. Liquid markets produce more reliable walls." weight="+Bonus" />
          </div>
          <div style={{ marginTop: 16, padding: '14px 18px', background: 'rgba(11,45,35,0.04)', borderRadius: 10, border: '1px solid rgba(11,45,35,0.08)' }}>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: '#0B2D23' }}>
              confidence = min(1, baseConfidence &times; 0.6 + multiFactorBonus &times; 0.4)
            </div>
          </div>
        </Card>
      </section>

      {/* Band width */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <SectionTitle>Band Width &amp; Position</SectionTitle>
        <Card>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: '#374151', marginBottom: 16 }}>
            The distance between the put and call walls defines the trading band. Band width drives strategy selection:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <Formula>
              {'bandWidth% = ((callWall - putWall) / spot) \u00d7 100\n\npositionInBand% = ((spot - putWall) / (callWall - putWall)) \u00d7 100'}
            </Formula>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <BandZone range="3-15%" strategy="Iron Condor" color="#0B7A52" description="Ideal corridor width" />
              <BandZone range="10-40%" strategy="Broken Wing Butterfly" color="#6366F1" description="Wider with directional bias" />
              <BandZone range="< 3%" strategy="Iron Butterfly" color="#B7791F" description="Walls too close, ATM trade" />
              <BandZone range="> 40%" strategy="Vertical Spread" color="#6b7280" description="Band too wide for defined-risk" />
            </div>
          </div>
        </Card>
      </section>

      {/* CTA */}
      <section style={{ maxWidth: 600, margin: '0 auto', padding: '60px 2rem 100px', textAlign: 'center' }}>
        <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(22px, 3.5vw, 32px)', fontWeight: 400, color: '#0B2D23', marginBottom: 12 }}>
          The invisible hand of the options market.
        </h2>
        <p style={{ fontSize: 15, color: '#6b6b60', lineHeight: 1.7, marginBottom: 32 }}>
          Gamma walls are refreshed every 15 minutes with live OI data from Yahoo and Alpaca.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/how-we-score" style={{ padding: '14px 28px', borderRadius: 10, background: 'rgba(11,45,35,0.06)', border: '1px solid rgba(11,45,35,0.12)', fontSize: 14, fontWeight: 600, color: '#0B2D23', textDecoration: 'none' }}>Scoring algorithm &rarr;</a>
          <a href="/ai-sentiment" style={{ padding: '14px 28px', borderRadius: 10, background: '#C9A96E', color: '#0B2D23', fontSize: 14, fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 16px rgba(201,169,110,0.25)' }}>AI sentiment analysis &rarr;</a>
        </div>
      </section>
    </div>
  );
}

// Sub-components
function Card({ children }) { return <div style={{ background: '#fff', border: '1px solid rgba(17,24,39,0.08)', borderRadius: 16, padding: '24px 28px' }}>{children}</div>; }
function SectionTitle({ children }) { return <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 400, color: '#0B2D23', marginBottom: 16 }}>{children}</h2>; }
function Formula({ children }) { return <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#0B2D23', background: 'rgba(11,45,35,0.04)', borderRadius: 10, padding: '14px 18px', border: '1px solid rgba(11,45,35,0.08)', whiteSpace: 'pre-line' }}>{children}</div>; }

function InfoBox({ color, title, description }) {
  return (
    <div style={{ background: `${color}08`, borderRadius: 12, padding: '16px 18px', border: `1px solid ${color}15` }}>
      <div style={{ fontWeight: 700, fontSize: 13, color, marginBottom: 6 }}>{title}</div>
      <p style={{ fontSize: 12, lineHeight: 1.6, color: '#6b6b60', margin: 0 }}>{description}</p>
    </div>
  );
}

function FactorCard({ weight, name, color, description, formula }) {
  return (
    <div style={{ background: `${color}06`, borderRadius: 14, padding: '18px 16px', border: `1px solid ${color}12` }}>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 22, fontWeight: 700, color, marginBottom: 4 }}>{weight}</div>
      <div style={{ fontWeight: 700, fontSize: 14, color: '#0B2D23', marginBottom: 8 }}>{name}</div>
      <p style={{ fontSize: 12, lineHeight: 1.6, color: '#6b6b60', marginBottom: 10 }}>{description}</p>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: '#374151', background: 'rgba(17,24,39,0.04)', borderRadius: 6, padding: '6px 10px' }}>{formula}</div>
    </div>
  );
}

function ConfidenceRow({ factor, description, weight }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '120px 1fr 60px', gap: 12, alignItems: 'center', padding: '8px 14px', borderRadius: 8, background: 'rgba(17,24,39,0.02)' }}>
      <span style={{ fontWeight: 700, fontSize: 12, color: '#0B2D23' }}>{factor}</span>
      <span style={{ fontSize: 12, color: '#6b6b60' }}>{description}</span>
      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: '#C9A96E', fontWeight: 700, textAlign: 'right' }}>{weight}</span>
    </div>
  );
}

function BandZone({ range, strategy, color, description }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '60px 1fr', gap: 10, alignItems: 'center', padding: '8px 12px', borderRadius: 8, background: `${color}08` }}>
      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 700, color }}>{range}</span>
      <div>
        <span style={{ fontWeight: 600, fontSize: 12, color: '#0B2D23' }}>{strategy}</span>
        <span style={{ fontSize: 11, color: '#6b6b60', marginLeft: 6 }}>&mdash; {description}</span>
      </div>
    </div>
  );
}
