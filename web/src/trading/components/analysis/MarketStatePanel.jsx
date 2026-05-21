import { deriveMarketState, fmt, fmtPct } from '../../utils/formatting'

export default function MarketStatePanel({ data }) {
  if (!data) return null

  const state = deriveMarketState(data)
  if (!state) return null

  const { stateLabel, stateColor, stateBgColor, spot, put_wall, call_wall, center, position_in_band_pct, band_width } =
    state

  const { condor_allowed, confidence_score } = data

  return (
    <div className="nl-card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '15px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--nl-muted-text)', fontWeight: '700', margin: 0 }}>
          Market State
        </h3>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        {/* State */}
        <div style={{ gridColumn: 'span 2' }}>
          <div style={{ fontSize: '10px', color: 'var(--nl-muted-text)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', fontWeight: '600' }}>Current State</div>
          <div
            style={{
              padding: '10px 16px',
              borderRadius: '12px',
              fontWeight: '700',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'white',
              border: `1px solid ${stateColor}`,
              color: stateColor,
            }}
          >
            <span style={{ fontSize: '18px' }}>📍</span>
            <span>{stateLabel}</span>
          </div>
        </div>

        {/* Gamma Band */}
        <div style={{ gridColumn: 'span 2' }}>
          <div style={{ fontSize: '10px', color: 'var(--nl-muted-text)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', fontWeight: '600' }}>Gamma Band</div>
          <div
            style={{
              borderRadius: '12px',
              padding: '10px 16px',
              background: 'white',
              border: '1px solid var(--nl-border)',
            }}
          >
            <div className="num" style={{ fontWeight: '700', fontSize: '14px', color: 'var(--nl-text)' }}>
              ${put_wall} – ${call_wall}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--nl-muted-text)', marginTop: '2px' }}>Width: ${fmt(band_width)}</div>
          </div>
        </div>

        {/* Current Spot */}
        <div>
          <div style={{ fontSize: '10px', color: 'var(--nl-muted-text)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', fontWeight: '600' }}>Current Spot</div>
          <div
            style={{
              borderRadius: '12px',
              padding: '10px 16px',
              background: 'white',
              border: '1px solid var(--nl-border)',
            }}
          >
            <div className="num" style={{ fontWeight: '900', fontSize: '18px', color: 'var(--nl-text)' }}>${spot}</div>
          </div>
        </div>

        {/* Center */}
        <div>
          <div style={{ fontSize: '10px', color: 'var(--nl-muted-text)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', fontWeight: '600' }}>Center</div>
          <div
            style={{
              borderRadius: '12px',
              padding: '10px 16px',
              background: 'var(--nl-info-light)',
              border: '1px solid var(--nl-info-border)',
            }}
          >
            <div className="num" style={{ fontWeight: '900', fontSize: '18px', color: 'var(--nl-info)' }}>${center}</div>
          </div>
        </div>

        {/* Position in Band */}
        <div>
          <div style={{ fontSize: '10px', color: 'var(--nl-muted-text)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', fontWeight: '600' }}>Position in Band</div>
          <div
            style={{
              borderRadius: '12px',
              padding: '10px 16px',
              background: 'white',
              border: '1px solid var(--nl-border)',
            }}
          >
            <div className="num" style={{ fontWeight: '900', fontSize: '18px', color: 'var(--nl-text)' }}>{fmtPct(position_in_band_pct)}</div>
          </div>
        </div>

        {/* Confidence Score */}
        <div>
          <div style={{ fontSize: '10px', color: 'var(--nl-muted-text)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', fontWeight: '600' }}>Confidence Score</div>
          <div
            style={{
              borderRadius: '12px',
              padding: '10px 16px',
              background: condor_allowed ? 'var(--nl-success-light)' : 'var(--nl-danger-light)',
              border: condor_allowed ? '1px solid var(--nl-success-border)' : '1px solid var(--nl-danger-border)',
            }}
          >
            <div
              className="num"
              style={{ fontWeight: '900', fontSize: '18px', color: condor_allowed ? 'var(--nl-success)' : 'var(--nl-danger)' }}
            >
              {fmt(confidence_score)}
            </div>
          </div>
        </div>

        {/* Condor Status */}
        <div style={{ gridColumn: 'span 2' }}>
          <div style={{ fontSize: '10px', color: 'var(--nl-muted-text)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px', fontWeight: '600' }}>Condor Status</div>
          <div
            style={{
              padding: '12px 16px',
              borderRadius: '12px',
              fontWeight: '700',
              fontSize: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: condor_allowed ? 'var(--nl-success-light)' : 'var(--nl-danger-light)',
              border: condor_allowed ? '1px solid var(--nl-success-border)' : '1px solid var(--nl-danger-border)',
              color: condor_allowed ? 'var(--nl-success)' : 'var(--nl-danger)',
            }}
          >
            <span>{condor_allowed ? '✓ Entry Allowed' : '✗ Entry Blocked'}</span>
            <span className="num" style={{ fontSize: '18px' }}>{(confidence_score * 100).toFixed(0)}%</span>
          </div>
        </div>
      </div>
    </div>
  )
}
