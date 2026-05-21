import { useState, useEffect, useRef } from 'react'

export default function ControlBar({ params, onFetch, loading, bandState }) {
  const [ticker, setTicker] = useState(params.ticker)
  const [spot, setSpot] = useState(params.spot)
  const [dteMin, setDteMin] = useState(params.dteMin)
  const [dteMax, setDteMax] = useState(params.dteMax)
  const timerRef = useRef(null)

  useEffect(() => {
    setTicker(params.ticker)
    setSpot(params.spot)
    setDteMin(params.dteMin)
    setDteMax(params.dteMax)
  }, [params.ticker, params.spot, params.dteMin, params.dteMax])

  const submit = () => {
    onFetch({ ticker, spot: parseFloat(spot) || 0, dteMin: parseInt(dteMin), dteMax: parseInt(dteMax) })
  }

  useEffect(() => {
    if (!timerRef.current) return
    clearInterval(timerRef.current)
  }, [])

  // Derive state badge styling
  const stateLabel = bandState?.label || '—'
  const isDanger = stateLabel.includes('Wall')
  const isGood = stateLabel.includes('Sweet')

  return (
    <div className="nl-card" style={{
      display: 'flex', gap: '12px', alignItems: 'end', padding: '14px 16px', flexWrap: 'wrap',
    }}>
      <Field label="Ticker" value={ticker} set={setTicker} cls="uppercase" ph="SPY" style={{ flex: '1 1 120px' }} />
      <Field label="Spot" value={spot} set={setSpot} ph="0" type="number" style={{ flex: '0 0 100px' }} />
      <Field label="DTE Min" value={dteMin} set={setDteMin} ph="20" type="number" style={{ flex: '0 0 80px' }} />
      <Field label="DTE Max" value={dteMax} set={setDteMax} ph="60" type="number" style={{ flex: '0 0 80px' }} />

      <button onClick={submit} disabled={loading} style={{
        height: 42, borderRadius: 10, border: 'none', fontWeight: 700, color: '#fff',
        padding: '0 20px', cursor: loading ? 'not-allowed' : 'pointer',
        background: loading ? 'rgba(11,45,35,0.5)' : '#0B2D23', fontSize: 13, whiteSpace: 'nowrap',
      }}>
        {loading ? '...' : 'Fetch'}
      </button>

      <button onClick={submit} disabled={loading} title="Refresh" style={{
        height: 42, width: 42, borderRadius: 10, fontWeight: 700, cursor: 'pointer',
        background: '#fff', border: '1px solid var(--nl-border)', color: 'var(--nl-text)', fontSize: 16,
      }}>
        ↻
      </button>

      {/* STATE badge inline */}
      {bandState && (
        <div style={{
          height: 42, borderRadius: 10, display: 'flex', alignItems: 'center', padding: '0 14px',
          fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap',
          background: isGood ? 'var(--nl-success-light)' : isDanger ? 'var(--nl-danger-light)' : 'rgba(245,158,11,0.1)',
          border: `1px solid ${isGood ? 'var(--nl-success-border)' : isDanger ? 'var(--nl-danger-border)' : 'rgba(245,158,11,0.3)'}`,
          color: isGood ? 'var(--nl-success)' : isDanger ? 'var(--nl-danger)' : '#b45309',
        }}>
          {stateLabel}
        </div>
      )}
    </div>
  )
}

function Field({ label, value, set, cls = '', ph, type = 'text', style = {} }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', ...style }}>
      <label style={{ fontSize: 10, color: 'var(--nl-muted-text)', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600 }}>{label}</label>
      <input
        type={type} value={value} onChange={e => set(e.target.value)} placeholder={ph}
        onKeyDown={e => e.key === 'Enter' && e.target.blur()}
        className={`num ${cls}`}
        style={{
          height: 42, borderRadius: 10, padding: '0 12px', fontSize: 14, outline: 'none',
          background: '#fff', border: '1px solid var(--nl-border)', color: 'var(--nl-text)', width: '100%',
        }}
      />
    </div>
  )
}
