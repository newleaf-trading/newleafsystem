import { fmt, fmtPct } from '../../utils/formatting'

const fmtPrice = (n) => n != null ? `$${Math.round(Number(n))}` : '—'

function Card({ label, value, sub, color = 'text' }) {
  const colorMap = {
    text: 'var(--nl-text)',
    green: 'var(--nl-success)',
    red: 'var(--nl-danger)',
    yellow: 'var(--nl-warn)',
    blue: 'var(--nl-info)',
    purple: '#7c3aed',
  }

  return (
    <div className="nl-card" style={{ padding: '14px 12px', minHeight: '100px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ fontSize: '10px', color: 'var(--nl-muted-text)', textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: '10px', fontWeight: '600' }}>{label}</div>
      <div className="num" style={{ fontSize: 'clamp(20px, 2.5vw, 28px)', fontWeight: '900', marginBottom: '6px', color: colorMap[color] || 'var(--nl-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: '11px', color: 'var(--nl-muted-text)', marginTop: 'auto', lineHeight: 1.3 }}>{sub}</div>}
    </div>
  )
}

export default function SummaryCards({ data }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      <Card label="Spot" value={fmtPrice(data?.spot)} sub="Current price" />
      <Card label="Put Wall" value={fmtPrice(data?.put_wall)} color="red" sub={`Score ${fmt(data?.walls?.put?.score)}`} />
      <Card label="Call Wall" value={fmtPrice(data?.call_wall)} color="green" sub={`Score ${fmt(data?.walls?.call?.score)}`} />
      <Card label="Gamma Flip" value={fmtPrice(data?.gamma_flip)} color="purple" sub="GEX sign change" />
      <Card label="Position" value={fmtPct(data?.position_in_band_pct)} color="yellow" sub="In gamma band" />
    </div>
  )
}
