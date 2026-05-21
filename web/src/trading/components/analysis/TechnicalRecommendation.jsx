import { fmt } from '../../utils/formatting'

export default function TechnicalRecommendation({ recommendation, techScore, techState }) {
  if (!recommendation) return null

  const { strategy, confidence, why, risk, confirms, invalidates } = recommendation

  const getStateColor = (state) => {
    if (!state) return 'var(--nl-info)'
    if (state.includes('Bullish')) return 'var(--nl-success)'
    if (state.includes('Bearish')) return 'var(--nl-danger)'
    return 'var(--nl-info)'
  }

  const getConfidenceColor = (conf) => {
    if (conf >= 0.7) return 'var(--nl-success)'
    if (conf >= 0.5) return 'var(--nl-info)'
    return 'var(--nl-warn)'
  }

  const getStrategyColor = (strat) => {
    if (!strat) return 'var(--nl-text)'
    if (strat.includes('Bull')) return 'var(--nl-success)'
    if (strat.includes('Bear')) return 'var(--nl-danger)'
    if (strat === 'Wait') return 'var(--nl-warn)'
    return 'var(--nl-info)'
  }

  return (
    <div className="nl-card" style={{ padding: '20px' }}>
      {/* Header */}
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ fontSize: '15px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--nl-muted-text)', fontWeight: '700', margin: 0, marginBottom: '4px' }}>
          Strategy Recommendation
        </h3>
        <p style={{ fontSize: '13px', color: 'var(--nl-muted-text)', margin: 0 }}>
          Decision-focused trade setup
        </p>
      </div>

      {/* Technical State Badge */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '10px', color: 'var(--nl-muted-text)', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Market Regime
        </div>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 14px',
            borderRadius: '10px',
            background: 'var(--nl-surface)',
            border: `2px solid ${getStateColor(techState)}`,
            fontSize: '13px',
            fontWeight: '700',
            color: getStateColor(techState),
          }}
        >
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'currentColor' }} />
          {techState || 'Neutral'}
        </div>
      </div>

      {/* Best Strategy (Hero) */}
      <div style={{ marginBottom: '16px', padding: '16px', background: 'var(--nl-surface)', borderRadius: '12px', border: '1px solid var(--nl-border)' }}>
        <div style={{ fontSize: '10px', color: 'var(--nl-muted-text)', marginBottom: '6px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Best Strategy
        </div>
        <div style={{ fontSize: '20px', fontWeight: '900', color: getStrategyColor(strategy), marginBottom: '4px' }}>
          {strategy}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
          <div style={{ fontSize: '11px', color: 'var(--nl-muted-text)', fontWeight: '600' }}>
            Confidence:
          </div>
          <div style={{ fontSize: '16px', fontWeight: '800', color: getConfidenceColor(confidence) }}>
            {fmt(confidence)}
          </div>
          <div
            style={{
              flex: 1,
              height: '6px',
              background: 'var(--nl-border)',
              borderRadius: '999px',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                height: '100%',
                width: `${confidence * 100}%`,
                background: getConfidenceColor(confidence),
                transition: 'width 0.3s ease',
              }}
            />
          </div>
        </div>
      </div>

      {/* Why (Rationale) */}
      <div style={{ marginBottom: '16px' }}>
        <div style={{ fontSize: '11px', color: 'var(--nl-muted-text)', marginBottom: '8px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Rationale
        </div>
        <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: 'var(--nl-text)', lineHeight: '1.8' }}>
          {why && why.length > 0 ? (
            why.map((reason, i) => <li key={i} style={{ marginBottom: '4px' }}>{reason}</li>)
          ) : (
            <li>No specific rationale provided</li>
          )}
        </ul>
      </div>

      {/* Confirms/Invalidates Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
        {/* What Confirms */}
        <div
          style={{
            padding: '14px',
            background: 'rgba(16, 185, 129, 0.05)',
            border: '1px solid rgba(16, 185, 129, 0.3)',
            borderRadius: '10px',
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--nl-success)', marginBottom: '8px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
            ✓ CONFIRMS THESIS
          </div>
          <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: 'var(--nl-text)', lineHeight: '1.7' }}>
            {confirms && confirms.length > 0 ? (
              confirms.map((item, i) => <li key={i} style={{ marginBottom: '3px' }}>{item}</li>)
            ) : (
              <li>No confirmation signals specified</li>
            )}
          </ul>
        </div>

        {/* What Invalidates */}
        <div
          style={{
            padding: '14px',
            background: 'rgba(239, 68, 68, 0.05)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            borderRadius: '10px',
          }}
        >
          <div style={{ fontSize: '11px', color: 'var(--nl-danger)', marginBottom: '8px', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '6px' }}>
            ✗ INVALIDATES THESIS
          </div>
          <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: 'var(--nl-text)', lineHeight: '1.7' }}>
            {invalidates && invalidates.length > 0 ? (
              invalidates.map((item, i) => <li key={i} style={{ marginBottom: '3px' }}>{item}</li>)
            ) : (
              <li>No invalidation signals specified</li>
            )}
          </ul>
        </div>
      </div>

      {/* Risk */}
      <div
        style={{
          padding: '12px 16px',
          background: 'rgba(251, 191, 36, 0.05)',
          border: '1px solid rgba(251, 191, 36, 0.3)',
          borderRadius: '8px',
        }}
      >
        <div style={{ fontSize: '10px', color: 'var(--nl-warn)', marginBottom: '4px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Key Risk
        </div>
        <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--nl-text)' }}>
          {risk || 'Unknown risk profile'}
        </div>
      </div>
    </div>
  )
}
