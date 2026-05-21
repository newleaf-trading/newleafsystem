import { fmt } from '../../utils/formatting'

export default function VolatilityEngineCard({ data }) {
  if (!data || !data.volatilityEngine) return null

  const { upperBand, middleBand, lowerBand, bandWidth, state, squeeze, score, explanation } = data.volatilityEngine

  const getScoreColor = (score) => {
    if (score >= 0.7) return 'var(--nl-success)'
    if (score >= 0.4) return 'var(--nl-info)'
    return 'var(--nl-warn)'
  }

  const getStateColor = (state) => {
    if (!state) return 'var(--nl-info)'
    if (state.includes('Upper')) return 'var(--nl-success)'
    if (state.includes('Lower')) return 'var(--nl-danger)'
    if (state.includes('Squeeze')) return '#f97316'
    if (state.includes('Wide')) return '#eab308'
    return 'var(--nl-info)'
  }

  return (
    <div className="nl-card" style={{ padding: '20px' }}>
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '15px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--nl-muted-text)', fontWeight: '700', margin: 0, marginBottom: '4px' }}>
          Volatility Engine
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--nl-muted-text)', margin: 0 }}>
          Bollinger Band regime
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
        {state || 'Normal Range'}
      </div>

      {/* Squeeze Indicator (if active) */}
      {squeeze && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 12px',
            borderRadius: '8px',
            background: 'rgba(249, 115, 22, 0.1)',
            border: '1px solid #f97316',
            fontSize: '11px',
            fontWeight: '700',
            color: '#f97316',
            marginBottom: '12px',
            marginLeft: '8px',
          }}
        >
          ⚡ Squeeze Active
        </div>
      )}

      {/* Explanation (Context) */}
      <p style={{ fontSize: '13px', color: 'var(--nl-text)', lineHeight: '1.6', marginBottom: '16px', fontStyle: 'italic' }}>
        {explanation || 'Awaiting analysis'}
      </p>

      {/* Supporting Metrics (Secondary) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', paddingTop: '16px', borderTop: '1px solid var(--nl-border)' }}>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--nl-muted-text)', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Band Width</div>
          <div style={{ fontSize: '16px', fontWeight: '800', color: 'var(--nl-text)' }}>{bandWidth?.toFixed(1)}%</div>
          <div style={{ fontSize: '10px', color: 'var(--nl-muted-text)', marginTop: '2px' }}>
            {bandWidth < 5 ? 'Compressed' : bandWidth > 15 ? 'Expanded' : 'Normal'}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '10px', color: 'var(--nl-muted-text)', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Score</div>
          <div style={{ fontSize: '16px', fontWeight: '800', color: getScoreColor(score) }}>{fmt(score)}</div>
        </div>

        <div>
          <div style={{ fontSize: '10px', color: 'var(--nl-muted-text)', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Upper Band</div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--nl-success)' }}>${fmt(upperBand)}</div>
        </div>

        <div>
          <div style={{ fontSize: '10px', color: 'var(--nl-muted-text)', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Lower Band</div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--nl-danger)' }}>${fmt(lowerBand)}</div>
        </div>
      </div>
    </div>
  )
}
