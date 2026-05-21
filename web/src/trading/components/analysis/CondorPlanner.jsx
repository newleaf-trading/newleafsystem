import { fmt } from '../../utils/formatting'

export default function CondorPlanner({ data }) {
  if (!data) return null

  const { condor_allowed, decision, ticker, position_in_band_pct: pos, center, confidence_score } = data
  const { summary, reasons = [], notes = [], suggestedStrikes } = decision ?? {}

  // Generate actionable guidance
  const guidance =
    pos < 25
      ? `Wait for ${ticker} to rotate back toward the center ($${center}) before entering a neutral condor. Price is currently too close to the put wall.`
      : pos > 75
      ? `Wait for ${ticker} to rotate back toward the center ($${center}) before entering a neutral condor. Price is currently too close to the call wall.`
      : condor_allowed
      ? `${ticker} is well-positioned for condor entry. Consider the suggested strikes and monitor for optimal entry timing.`
      : `${ticker} is within the band but does not meet all entry criteria. Review blocked reasons below.`

  return (
    <div
      className="nl-card"
      style={{
        padding: '24px',
        background: condor_allowed ? 'var(--nl-success-light)' : 'var(--nl-warn-light)',
        border: condor_allowed ? '1px solid var(--nl-success-border)' : '1px solid var(--nl-warn-border)',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
        <div>
          <div
            style={{
              fontSize: '20px',
              fontWeight: '700',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              color: condor_allowed ? 'var(--nl-success)' : 'var(--nl-warn)',
            }}
          >
            {condor_allowed ? '✓ Condor Entry Recommended' : '⚠️ Entry Not Recommended'}
          </div>
          <div style={{ fontSize: '14px', color: 'var(--nl-muted-text)', marginTop: '4px' }}>{summary}</div>
        </div>
        {confidence_score != null && (
          <div
            className="num"
            style={{
              fontSize: '30px',
              fontWeight: '900',
              color: condor_allowed ? 'var(--nl-success)' : 'var(--nl-warn)',
            }}
          >
            {(confidence_score * 100).toFixed(0)}%
          </div>
        )}
      </div>

      {/* Guidance */}
      <div
        style={{
          borderRadius: '12px',
          padding: '12px 16px',
          fontSize: '14px',
          marginBottom: '16px',
          background: 'white',
          border: '1px solid var(--nl-border)',
          color: 'var(--nl-text)',
        }}
      >
        💡 {guidance}
      </div>

      {/* Suggested Strikes (if allowed and available) */}
      {condor_allowed && suggestedStrikes && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', letterSpacing: '0.05em', color: 'var(--nl-muted-text)', textTransform: 'uppercase', fontWeight: '600', marginBottom: '8px' }}>
            Suggested Condor Strikes
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '8px' }}>
            {Object.entries(suggestedStrikes).map(([k, v]) => (
              <div
                key={k}
                style={{
                  borderRadius: '12px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  background: 'white',
                  border: '1px solid var(--nl-success-border)',
                }}
              >
                <span style={{ fontSize: '10px', color: 'var(--nl-muted-text)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600', marginBottom: '4px' }}>
                  {k.replace(/_/g, ' ')}
                </span>
                <span className="num" style={{ color: 'var(--nl-success)', fontSize: '16px', fontWeight: '700' }}>${fmt(v)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Blocked Reasons */}
      {reasons.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', letterSpacing: '0.05em', color: 'var(--nl-muted-text)', textTransform: 'uppercase', fontWeight: '600', marginBottom: '8px' }}>
            Blocked Because
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {reasons.map((r, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  borderRadius: '12px',
                  padding: '12px 16px',
                  background: 'white',
                  border: '1px solid var(--nl-warn-border)',
                }}
              >
                <span style={{ color: 'var(--nl-warn)', marginTop: '2px', flexShrink: 0, fontWeight: '700' }}>✕</span>
                <div style={{ flex: 1 }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--nl-warn)', display: 'block' }}>{r.rule}</span>
                  <p style={{ fontSize: '12px', color: 'var(--nl-muted-text)', marginTop: '4px', margin: '4px 0 0 0' }}>{r.detail}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {notes.length > 0 && (
        <div>
          <div style={{ fontSize: '12px', letterSpacing: '0.05em', color: 'var(--nl-muted-text)', textTransform: 'uppercase', fontWeight: '600', marginBottom: '8px' }}>Additional Notes</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {notes.map((n, i) => (
              <div key={i} style={{ fontSize: '12px', color: 'var(--nl-muted-text)', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <span style={{ color: 'var(--nl-info)' }}>•</span>
                <span>{n}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Center and position info */}
      <div
        style={{
          marginTop: '16px',
          paddingTop: '16px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '12px',
          fontSize: '12px',
          borderTop: '1px solid var(--nl-border)',
        }}
      >
        <div>
          <span style={{ color: 'var(--nl-muted-text)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '10px', fontWeight: '600' }}>Center</span>
          <div className="num" style={{ color: 'var(--nl-info)', fontWeight: '700', fontSize: '16px' }}>${center}</div>
        </div>
        <div>
          <span style={{ color: 'var(--nl-muted-text)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '10px', fontWeight: '600' }}>Position in Band</span>
          <div className="num" style={{ color: 'var(--nl-text)', fontWeight: '700', fontSize: '16px' }}>{pos?.toFixed(1)}%</div>
        </div>
      </div>
    </div>
  )
}
