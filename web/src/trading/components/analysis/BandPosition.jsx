export default function BandPosition({ data }) {
  if (!data) return null

  const { put_wall, call_wall, center, spot, position_in_band_pct: pos } = data
  const pct = pos ?? 50

  // Derive band state from position percentage
  // 0% = at put wall, 100% = at call wall, 50% = at center
  const getBandState = () => {
    if (pct >= 85) return { label: 'Near Call Wall', color: 'var(--nl-danger)', bg: 'var(--nl-danger-light)', border: 'var(--nl-danger-border)' }
    if (pct >= 65) return { label: 'Above Center', color: 'var(--nl-warn)', bg: 'var(--nl-warn-light, rgba(245,158,11,0.1))', border: 'var(--nl-warn-border, rgba(245,158,11,0.3))' }
    if (pct >= 40) return { label: 'Sweet Spot', color: 'var(--nl-success)', bg: 'var(--nl-success-light)', border: 'var(--nl-success-border)' }
    if (pct >= 15) return { label: 'Below Center', color: 'var(--nl-warn)', bg: 'var(--nl-warn-light, rgba(245,158,11,0.1))', border: 'var(--nl-warn-border, rgba(245,158,11,0.3))' }
    return { label: 'Near Put Wall', color: 'var(--nl-danger)', bg: 'var(--nl-danger-light)', border: 'var(--nl-danger-border)' }
  }

  const bandState = getBandState()
  const inSweetSpot = pct >= 40 && pct <= 60

  // Suggested wait zone: center ± small buffer
  const waitLow = center ? Math.round(center - (call_wall - put_wall) * 0.1) : '—'
  const waitHigh = center ? Math.round(center + (call_wall - put_wall) * 0.1) : '—'

  return (
    <div className="nl-card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '15px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--nl-muted-text)', fontWeight: '700', margin: 0 }}>Band Position</h3>
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            padding: '6px 12px',
            borderRadius: '999px',
            background: bandState.bg,
            border: `1px solid ${bandState.border}`,
            color: bandState.color,
          }}
        >
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'currentColor' }} />
          {bandState.label}
        </div>
      </div>

      {inSweetSpot && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            borderRadius: '999px',
            fontSize: '12px',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '20px',
            background: 'var(--nl-success-light)',
            border: '1px solid var(--nl-success-border)',
            color: 'var(--nl-success)',
          }}
        >
          Condor Sweet Spot · 40%–60%
        </div>
      )}

      <div
        style={{
          position: 'relative',
          height: '62px',
          borderRadius: '18px',
          overflow: 'hidden',
          border: '1px solid var(--nl-border)',
          background: '#f8f9fa',
          marginBottom: '12px',
        }}
      >
        {/* Zones */}
        <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
          <div style={{ width: '25%', background: 'rgba(239,68,68,0.12)' }} />
          <div style={{ width: '15%', background: 'rgba(245,158,11,0.10)' }} />
          <div style={{ width: '20%', background: 'rgba(34,197,94,0.10)' }} />
          <div style={{ width: '20%', background: 'rgba(34,197,94,0.10)' }} />
          <div style={{ width: '15%', background: 'rgba(245,158,11,0.10)' }} />
          <div style={{ width: '5%', background: 'rgba(239,68,68,0.12)' }} />
        </div>

        {/* Markers */}
        <Marker left="0%" color="var(--red)" label={`Put ${put_wall}`} />
        <Marker left="50%" color="var(--blue)" label={`Center ${center}`} />
        <Marker left="100%" color="var(--green)" label={`Call ${call_wall}`} />

        {/* Spot pin */}
        <div
          style={{
            position: 'absolute',
            width: '14px',
            height: '14px',
            borderRadius: '50%',
            border: '2px solid var(--nl-primary-green)',
            top: '18px',
            left: `${Math.min(100, Math.max(0, pct))}%`,
            marginLeft: '-7px',
            background: 'white',
            boxShadow: '0 0 0 4px rgba(11, 45, 35,0.10)',
          }}
        />
      </div>

      <div className="grid grid-cols-2 gap-4 mt-5">
        <Mini label="Spot / Range" value={`${spot?.toFixed(2)} / ${put_wall}–${call_wall}`} />
        <Mini label="Suggested Wait Zone" value={`${waitLow}–${waitHigh}`} />
      </div>
    </div>
  )
}

function Marker({ left, color, label }) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        bottom: 0,
        left,
        width: '2px',
        background: color ? color : 'transparent',
        opacity: 0.6,
      }}
    >
      <span
        style={{
          position: 'absolute',
          top: '-24px',
          left: '50%',
          transform: 'translateX(-50%)',
          fontSize: '12px',
          whiteSpace: 'nowrap',
          color,
          fontWeight: '600',
        }}
      >
        {label}
      </span>
    </div>
  )
}

function Mini({ label, value }) {
  return (
    <div
      style={{
        borderRadius: '12px',
        padding: '14px',
        background: 'white',
        border: '1px solid var(--nl-border)',
      }}
    >
      <div style={{ fontSize: '12px', color: 'var(--nl-muted-text)', marginBottom: '6px' }}>{label}</div>
      <div className="num" style={{ fontSize: '22px', fontWeight: '900', color: 'var(--nl-text)' }}>{value}</div>
    </div>
  )
}
