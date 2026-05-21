/**
 * /strategy-selection — Strategy selection and adjustment documentation.
 *
 * Documents the decision tree for strategy selection and the adjustment catalogue.
 */
import { DecisionTree, PipelineFlow, VerticalFlow, FunnelDiagram } from '../shared/Diagrams';
import PageSEO from '../../shared/components/PageSEO';

export function StrategySelectionPage() {
  return (
    <div style={{
      fontFamily: "'Inter', -apple-system, sans-serif",
      background: '#F7F4EE', color: '#0B0F14', minHeight: '100vh',
    }}>
      <PageSEO title="Strategy Selection — AI-Powered Strategy Matching" description="See how NewLeaf automatically matches market conditions to the optimal options strategy based on volatility regime, trend direction, and risk-reward parameters." path="/strategy-selection" />
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
          Strategy Selection &amp; Adjustment
        </h1>
        <p style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 'clamp(16px, 2vw, 20px)', fontStyle: 'italic',
          color: '#C9A96E', marginBottom: 32,
        }}>
          The right structure for the right market.
        </p>
        <p style={{ fontSize: 15, lineHeight: 1.75, color: '#6b6b60', maxWidth: 600, margin: '0 auto' }}>
          Once a stock passes our scoring filters, we select the optimal options strategy based on gamma
          band width, directional bias, and IV regime. Every strategy comes with a pre-defined
          adjustment playbook.
        </p>
      </section>

      {/* Strategy selection pipeline */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <Card>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 12 }}>
            Strategy Selection Pipeline
          </div>
          <PipelineFlow steps={[
            { label: 'Scored\nStock', sub: '75+ score', color: '#C9A96E', icon: '\u{2B50}' },
            { label: 'Band Width', sub: 'Put-Call gap', color: '#0B7A52', icon: '\u{1F4CF}' },
            { label: 'Trend\nDirection', sub: 'Bull/Bear/Neutral', color: '#6366F1', icon: '\u{1F9ED}' },
            { label: 'IV Regime', sub: 'Sweet spot?', color: '#B7791F', icon: '\u{1F321}' },
            { label: 'Strategy', sub: 'IC/BWB/IB/Spread', color: '#0B2D23', icon: '\u{1F3AF}', round: true },
          ]} />
        </Card>
      </section>

      {/* Visual decision tree */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <Card>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 12 }}>
            Decision Flowchart
          </div>
          <DecisionTree
            root={{ label: 'Evaluate Band Width & Confidence', sub: 'From gamma wall analysis', color: '#0B2D23' }}
            branches={[
              { label: 'Iron Condor', condition: 'Band 3-15%, Conf \u226560%', sub: 'Primary neutral strategy', color: '#0B7A52' },
              { label: 'Broken Wing Butterfly', condition: 'Band 10-40%, Directional', sub: 'Asymmetric with credit', color: '#6366F1' },
              { label: 'Iron Butterfly', condition: 'Band < 3%, ATM', sub: 'Narrow profit zone', color: '#B7791F' },
              { label: 'Vertical Spread', condition: 'Strong trend', sub: 'Directional credit', color: '#C94F4F' },
            ]}
          />
        </Card>
      </section>

      {/* Decision tree details */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <SectionTitle>Strategy Decision Tree</SectionTitle>
        <Card>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: '#374151', marginBottom: 20 }}>
            The strategy engine evaluates market conditions and selects the optimal structure:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <StrategyRow
              name="Iron Condor"
              emoji="&#129419;"
              conditions={['Band width 3-15%', 'Confidence &ge; 60%', 'Contracts &ge; 50']}
              description="The primary strategy. Sells a put spread and call spread simultaneously, defining a range where profit is made if the stock stays between the short strikes. Best when gamma walls create a clear corridor."
              color="#0B7A52"
            />
            <StrategyRow
              name="Broken Wing Butterfly"
              emoji="&#129419;"
              conditions={['Band width 10-40%', 'Confidence &ge; 15-30%', 'Directional bias detected']}
              description="A butterfly with asymmetric wings. Used when the band is too wide for an Iron Condor but strong enough walls exist to anchor the body. The broken wing provides credit entry with directional tilt."
              color="#6366F1"
            />
            <StrategyRow
              name="Iron Butterfly"
              emoji="&#129419;"
              conditions={['Walls exist but band too tight', 'ATM concentration']}
              description="Fallback when put and call walls converge near the same price level. Sells the ATM straddle with protective wings. Higher max profit but narrower profit zone. Take-profit target: 25%."
              color="#B7791F"
            />
            <StrategyRow
              name="Bull Put Spread"
              emoji="&#9650;"
              conditions={['Bullish trend confirmed', 'Put wall provides support']}
              description="Directional credit spread. Sells a put at the gamma wall and buys deeper OTM protection. Used when trend analysis confirms upward momentum."
              color="#0B7A52"
            />
            <StrategyRow
              name="Bear Call Spread"
              emoji="&#9660;"
              conditions={['Bearish trend confirmed', 'Call wall provides resistance']}
              description="Directional credit spread on the bearish side. Sells a call at the gamma wall and buys higher OTM protection. Used when trend confirms downward pressure."
              color="#C94F4F"
            />
          </div>
        </Card>
      </section>

      {/* BWB Strike calculation */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <SectionTitle>Broken Wing Butterfly &mdash; Strike Calculation</SectionTitle>
        <Card>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: '#374151', marginBottom: 16 }}>
            BWB strikes are anchored to gamma walls and asymmetrically extended for credit entry:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <FormulaCard
              title="Put BWB (Bullish)"
              color="#0B7A52"
              lines={[
                'body = roundToStrike(put_wall)',
                'upperWing = body + (price - body) \u00d7 0.6',
                'lowerWing = body - (upperWidth \u00d7 1.7)',
              ]}
            />
            <FormulaCard
              title="Call BWB (Bearish)"
              color="#C94F4F"
              lines={[
                'body = roundToStrike(call_wall)',
                'lowerWing = body - (body - price) \u00d7 0.6',
                'upperWing = body + (lowerWidth \u00d7 1.7)',
              ]}
            />
          </div>
          <div style={{
            marginTop: 16, padding: '14px 18px', background: 'rgba(99,102,241,0.06)',
            borderRadius: 10, border: '1px solid rgba(99,102,241,0.12)',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#6366F1', marginBottom: 8 }}>
              BWB Score Bonus
            </div>
            <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.7 }}>
              +5 if confidence &gt; 60% &bull; +5 if body within &plusmn;2.5 of gamma wall &bull;
              +5 if IV 30-50% &bull; +3 if price &gt; upperWing by &gt;3% &bull; -5 if IV &gt; 60%
            </div>
          </div>
        </Card>
      </section>

      {/* Verdict engine */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <SectionTitle>Position Verdict Engine</SectionTitle>
        <Card>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: '#374151', marginBottom: 20 }}>
            Once a trade is open, the verdict engine continuously evaluates its health. Five states, evaluated in priority order:
          </p>
          <div style={{ marginBottom: 20 }}>
            <VerticalFlow steps={[
              { label: 'Open Position', sub: 'Entry recorded', color: '#0B2D23', icon: '\u{1F4DD}' },
              { label: 'Monitor Every 15 min', sub: 'Delta, P&L, DTE, IV', color: '#6366F1', detail: 'Continuous' },
              { label: 'Evaluate Verdict', sub: 'Priority: EXIT > TAKE_PROFIT > ACTION > MONITOR > ON_TRACK', color: '#B7791F' },
              { label: 'Action or Hold', sub: 'Adjust, close, or continue monitoring', color: '#C9A96E', icon: '\u{2696}' },
            ]} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <VerdictRow state="EXIT" color="#C94F4F" priority="1"
              rules="IC: loss &ge; 1.5&times; credit OR strike breached 2+ sessions. IB: strike breached OR loss &ge; 1.0&times; credit." />
            <VerdictRow state="TAKE PROFIT" color="#0B7A52" priority="2"
              rules="IC/Bull Put: &ge; 50% profit captured. Iron Butterfly: &ge; 25%. Calendar: &ge; 25% debit recovered." />
            <VerdictRow state="ACTION NEEDED" color="#d97706" priority="3"
              rules="IC: short delta &ge; 0.35 OR strike being tested. IB: short delta &ge; 0.40." />
            <VerdictRow state="MONITOR" color="#B7791F" priority="4"
              rules="IC: short delta &ge; 0.25 OR &le; 21 DTE. IB: short delta &ge; 0.30 OR &le; 21 DTE." />
            <VerdictRow state="ON TRACK" color="#6b7280" priority="5"
              rules="Default healthy state. Position performing within expected parameters." />
          </div>
          <div style={{
            marginTop: 16, padding: '14px 18px', background: 'rgba(183,121,31,0.06)',
            borderRadius: 10, border: '1px solid rgba(183,121,31,0.12)',
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#B7791F', marginBottom: 8 }}>
              Universal Overrides
            </div>
            <ul style={{ fontSize: 13, color: '#374151', lineHeight: 1.8, margin: 0, paddingLeft: 16 }}>
              <li><strong>21-DTE Rule:</strong> Short-premium at &le;21 DTE with &lt;50% captured &rarr; escalate one level</li>
              <li><strong>Earnings Proximity:</strong> Earnings inside remaining DTE not at entry &rarr; escalate</li>
              <li><strong>Vol Regime Shift:</strong> IV rank moved &gt;30 points from entry &rarr; minimum MONITOR</li>
            </ul>
          </div>
        </Card>
      </section>

      {/* Adjustment catalogue */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <SectionTitle>Adjustment Catalogue</SectionTitle>
        <Card>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: '#374151', marginBottom: 20 }}>
            When a position reaches ACTION_NEEDED or EXIT, we evaluate adjustments using an improvement ratio:
          </p>
          <FormulaCard title="Adjustment Scoring" color="#0B2D23" lines={[
            'Improvement Ratio = (probAfter - probBefore) / |netCost|',
            '',
            'SMART_ROLL:  improvement \u2265 0.30 AND probAfter \u2265 55%',
            'MARGINAL:    improvement \u2265 0.15 AND probAfter \u2265 50%',
            'DEFENSIVE:   reduces loss without profit aim',
            'HIGH_RISK:   hold & monitor (worst-case exposed)',
          ]} />
          <div style={{ marginTop: 20 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 12 }}>
              Available Adjustments by Strategy
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <AdjustmentCard strategy="Iron Condor" adjustments={['Roll tested side up & out', 'Roll further OTM', 'Roll out only (time)', 'Close tested side', 'Close entire position']} />
              <AdjustmentCard strategy="Bull Put Spread" adjustments={['Roll down & out', 'Roll out only', 'Close entire position']} />
              <AdjustmentCard strategy="Bear Call Spread" adjustments={['Roll up & out', 'Roll out only', 'Close entire position']} />
              <AdjustmentCard strategy="Iron Butterfly" adjustments={['Close entire (mid-trade adjustments rarely pay)', 'Monitor only']} />
            </div>
          </div>
        </Card>
      </section>

      {/* CTA */}
      <section style={{ maxWidth: 600, margin: '0 auto', padding: '60px 2rem 100px', textAlign: 'center' }}>
        <h2 style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 'clamp(22px, 3.5vw, 32px)', fontWeight: 400, color: '#0B2D23', marginBottom: 12,
        }}>
          From selection to exit. Fully systematic.
        </h2>
        <p style={{ fontSize: 15, color: '#6b6b60', lineHeight: 1.7, marginBottom: 32 }}>
          The same decision tree and adjustment rules apply to every trade, removing emotion from the process.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/technical-analysis" style={{
            padding: '14px 28px', borderRadius: 10, background: 'rgba(11,45,35,0.06)',
            border: '1px solid rgba(11,45,35,0.12)', fontSize: 14, fontWeight: 600, color: '#0B2D23', textDecoration: 'none',
          }}>Technical analysis &rarr;</a>
          <a href="/gamma-analysis" style={{
            padding: '14px 28px', borderRadius: 10, background: '#C9A96E', color: '#0B2D23',
            fontSize: 14, fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 16px rgba(201,169,110,0.25)',
          }}>Gamma wall analysis &rarr;</a>
        </div>
      </section>
    </div>
  );
}

// Sub-components
function Card({ children }) { return <div style={{ background: '#fff', border: '1px solid rgba(17,24,39,0.08)', borderRadius: 16, padding: '24px 28px' }}>{children}</div>; }
function SectionTitle({ children }) { return <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 400, color: '#0B2D23', marginBottom: 16 }}>{children}</h2>; }

function StrategyRow({ name, conditions, description, color }) {
  return (
    <div style={{ background: `${color}08`, borderRadius: 14, padding: '18px 22px', border: `1px solid ${color}18` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: 16, color }}>{name}</span>
        {conditions.map((c, i) => (
          <span key={i} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, background: `${color}12`, color, fontWeight: 600, letterSpacing: '.04em' }}>{c}</span>
        ))}
      </div>
      <p style={{ fontSize: 13, lineHeight: 1.7, color: '#6b6b60', margin: 0 }}>{description}</p>
    </div>
  );
}

function FormulaCard({ title, color, lines }) {
  return (
    <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: '#374151', background: `${color}08`, borderRadius: 12, padding: '16px 20px', border: `1px solid ${color}15` }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color, marginBottom: 10 }}>{title}</div>
      {lines.map((l, i) => <div key={i} style={{ lineHeight: 1.8, opacity: l ? 1 : 0.3 }}>{l || '\u00a0'}</div>)}
    </div>
  );
}

function VerdictRow({ state, color, priority, rules }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '28px 120px 1fr', gap: 12, alignItems: 'start', padding: '10px 14px', borderRadius: 10, background: `${color}08`, border: `1px solid ${color}15` }}>
      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, color: '#9ca3af', fontWeight: 700 }}>P{priority}</span>
      <span style={{ fontWeight: 700, fontSize: 13, color }}>{state}</span>
      <span style={{ fontSize: 12, color: '#6b6b60', lineHeight: 1.6 }}>{rules}</span>
    </div>
  );
}

function AdjustmentCard({ strategy, adjustments }) {
  return (
    <div style={{ background: 'rgba(17,24,39,0.02)', borderRadius: 10, padding: '14px 16px', border: '1px solid rgba(17,24,39,0.06)' }}>
      <div style={{ fontWeight: 700, fontSize: 13, color: '#0B2D23', marginBottom: 8 }}>{strategy}</div>
      <ul style={{ margin: 0, paddingLeft: 16 }}>
        {adjustments.map((a, i) => <li key={i} style={{ fontSize: 12, color: '#6b6b60', lineHeight: 1.8 }}>{a}</li>)}
      </ul>
    </div>
  );
}
