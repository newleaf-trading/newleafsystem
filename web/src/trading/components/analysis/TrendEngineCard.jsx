import { fmt } from '../../utils/formatting'

export default function TrendEngineCard({ data }) {
  if (!data || !data.trendEngine) return null

  const { sma50, sma100, crossover, slope50, slope100, state, score, explanation } = data.trendEngine

  const getScoreColor = (score) => {
    if (score >= 0.7) return 'var(--nl-success)'
    if (score >= 0.4) return 'var(--nl-info)'
    return 'var(--nl-danger)'
  }

  const getStateColor = (state) => {
    if (!state) return 'var(--nl-info)'
    if (state.includes('Strong Bullish')) return 'var(--nl-success)'
    if (state.includes('Bullish')) return 'var(--nl-success)'
    if (state.includes('Strong Bearish')) return 'var(--nl-danger)'
    if (state.includes('Bearish')) return 'var(--nl-danger)'
    return 'var(--nl-info)'
  }

  return (
    <div className="nl-card" style={{ padding: '20px' }}>
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '15px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--nl-muted-text)', fontWeight: '700', margin: 0, marginBottom: '4px' }}>
          Trend Engine
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--nl-muted-text)', margin: 0 }}>
          Moving average crossover regime
        </p>
      </div>

      {/* INTERPRETATION FIRST - Regime Badge (Hero) */}
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          padding: '10px 16px',
          borderRadius: '12px',
          background: 'var(--nl-surface)',
          border: `2px solid ${getStateColor(state)}`,
          fontSize: '14px',
          fontWeight: '800',
          color: getStateColor(state),
          marginBottom: '12px',
        }}
      >
        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'currentColor' }} />
        {state || 'Neutral Transition'}
      </div>

      {/* Explanation (Context) */}
      <p style={{ fontSize: '13px', color: 'var(--nl-text)', lineHeight: '1.6', marginBottom: '16px', fontStyle: 'italic' }}>
        {explanation || 'Awaiting analysis'}
      </p>

      {/* Supporting Metrics (Secondary) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', paddingTop: '16px', borderTop: '1px solid var(--nl-border)' }}>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--nl-muted-text)', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Crossover</div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--nl-text)' }}>{crossover || 'None'}</div>
        </div>

        <div>
          <div style={{ fontSize: '10px', color: 'var(--nl-muted-text)', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Score</div>
          <div style={{ fontSize: '16px', fontWeight: '800', color: getScoreColor(score) }}>{fmt(score)}</div>
        </div>

        <div>
          <div style={{ fontSize: '10px', color: 'var(--nl-muted-text)', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>SMA 50</div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--nl-text)' }}>
            ${fmt(sma50)} <span style={{ fontSize: '11px', color: 'var(--nl-muted-text)', fontWeight: '600' }}>({slope50})</span>
          </div>
        </div>

        <div>
          <div style={{ fontSize: '10px', color: 'var(--nl-muted-text)', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>SMA 100</div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--nl-text)' }}>
            ${fmt(sma100)} <span style={{ fontSize: '11px', color: 'var(--nl-muted-text)', fontWeight: '600' }}>({slope100})</span>
          </div>
        </div>
      </div>
    </div>
  )
}
