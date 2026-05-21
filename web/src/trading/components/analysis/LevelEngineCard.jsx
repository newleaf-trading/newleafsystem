import { fmt, fmtPct } from '../../utils/formatting'

export default function LevelEngineCard({ data }) {
  if (!data || !data.levelEngine) return null

  const { support1, resistance1, distanceToSupport1, distanceToResistance1, state, score, explanation } = data.levelEngine

  const getScoreColor = (score) => {
    if (score >= 0.7) return 'var(--nl-success)'
    if (score >= 0.4) return 'var(--nl-info)'
    return 'var(--nl-warn)'
  }

  const getStateColor = (state) => {
    if (!state) return 'var(--nl-info)'
    if (state.includes('At Support') || state.includes('Near Support') || state.includes('Breakout')) return 'var(--nl-success)'
    if (state.includes('At Resistance') || state.includes('Near Resistance')) return 'var(--nl-danger)'
    if (state.includes('Breakdown')) return 'var(--nl-danger)'
    if (state.includes('Mid-Range') || state.includes('Balanced')) return 'var(--nl-info)'
    return 'var(--nl-info)'
  }

  // Determine nearest critical level
  const getNearestLevel = () => {
    if (distanceToSupport1 < distanceToResistance1) {
      return { type: 'Support', price: support1, distance: distanceToSupport1, color: 'var(--nl-success)' }
    } else {
      return { type: 'Resistance', price: resistance1, distance: distanceToResistance1, color: 'var(--nl-danger)' }
    }
  }

  const nearestLevel = getNearestLevel()

  return (
    <div className="nl-card" style={{ padding: '20px' }}>
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '15px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--nl-muted-text)', fontWeight: '700', margin: 0, marginBottom: '4px' }}>
          Level Engine
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--nl-muted-text)', margin: 0 }}>
          Support & resistance regime
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
        {state || 'Mid-Range'}
      </div>

      {/* Explanation (Context) */}
      <p style={{ fontSize: '13px', color: 'var(--nl-text)', lineHeight: '1.6', marginBottom: '16px', fontStyle: 'italic' }}>
        {explanation || 'Awaiting analysis'}
      </p>

      {/* Nearest Level Alert */}
      <div
        style={{
          padding: '12px',
          background: nearestLevel.distance < 2 ? 'rgba(239, 68, 68, 0.05)' : 'var(--nl-surface)',
          border: `1px solid ${nearestLevel.distance < 2 ? nearestLevel.color : 'var(--nl-border)'}`,
          borderRadius: '10px',
          marginBottom: '16px',
        }}
      >
        <div style={{ fontSize: '10px', color: 'var(--nl-muted-text)', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Nearest Level
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
          <div style={{ fontSize: '18px', fontWeight: '800', color: nearestLevel.color }}>
            ${fmt(nearestLevel.price)}
          </div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--nl-muted-text)' }}>
            {nearestLevel.type}
          </div>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--nl-text)', marginTop: '4px', fontWeight: '600' }}>
          {fmtPct(nearestLevel.distance)} away {nearestLevel.distance < 2 ? '⚠️ Critical zone' : ''}
        </div>
      </div>

      {/* Supporting Metrics (Secondary) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', paddingTop: '16px', borderTop: '1px solid var(--nl-border)' }}>
        <div>
          <div style={{ fontSize: '10px', color: 'var(--nl-muted-text)', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Score</div>
          <div style={{ fontSize: '16px', fontWeight: '800', color: getScoreColor(score) }}>{fmt(score)}</div>
        </div>

        <div>
          <div style={{ fontSize: '10px', color: 'var(--nl-muted-text)', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Position</div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--nl-text)' }}>
            {distanceToSupport1 < 2 ? 'At Support' : distanceToResistance1 < 2 ? 'At Resistance' : 'Mid-Range'}
          </div>
        </div>

        <div>
          <div style={{ fontSize: '10px', color: 'var(--nl-muted-text)', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Support</div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--nl-success)' }}>${fmt(support1)}</div>
        </div>

        <div>
          <div style={{ fontSize: '10px', color: 'var(--nl-muted-text)', marginBottom: '4px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Resistance</div>
          <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--nl-danger)' }}>${fmt(resistance1)}</div>
        </div>
      </div>
    </div>
  )
}
