import { useState } from 'react'
import { fmtAbbr } from '../../utils/formatting'

const COLS = [
  { key: 'strike', label: 'Strike', align: 'right' },
  { key: 'distPct', label: 'Dist %', align: 'right' },
  { key: 'callGex', label: 'Call GEX', align: 'right' },
  { key: 'putGex', label: 'Put GEX', align: 'right' },
  { key: 'netGex', label: 'Net GEX', align: 'right' },
  { key: 'callOi', label: 'Call OI', align: 'right' },
  { key: 'putOi', label: 'Put OI', align: 'right' },
  { key: 'expiries', label: 'Exp', align: 'center' },
]

function exportCSV(rows) {
  const header = COLS.map(c => c.label).join(',')
  const lines = rows.map(r =>
    [r.strike, r.distPct, r.callGex, r.putGex, r.netGex, r.callOi, r.putOi, r.expiries].join(',')
  )
  const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv' })
  const a = Object.assign(document.createElement('a'), {
    href: URL.createObjectURL(blob),
    download: 'gamma-strikes.csv',
  })
  a.click()
}

export default function StrikeTable({ data }) {
  const [sortKey, setSortKey] = useState('strike')
  const [sortDir, setSortDir] = useState(1)

  if (!data?.top_strikes?.length) {
    return (
      <div className="nl-card" style={{ padding: '24px', color: 'var(--nl-muted-text)', fontSize: '14px', textAlign: 'center' }}>
        No strike data
      </div>
    )
  }

  const { top_strikes, put_wall, call_wall, spot } = data
  const sorted = [...top_strikes].sort((a, b) => ((a[sortKey] ?? 0) - (b[sortKey] ?? 0)) * sortDir)

  const nearestSpot = top_strikes.reduce((p, c) =>
    Math.abs(c.strike - spot) < Math.abs(p.strike - spot) ? c : p
  )

  const handleSort = key => {
    if (key === sortKey) setSortDir(d => -d)
    else {
      setSortKey(key)
      setSortDir(1)
    }
  }

  return (
    <div className="nl-card" style={{ overflow: 'hidden', padding: 0 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--nl-border)',
          background: '#f8f9fa',
        }}
      >
        <h3 style={{ fontSize: '15px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--nl-muted-text)', fontWeight: '700', margin: 0 }}>
          Strike Exposure
        </h3>
        <button
          onClick={() => exportCSV(sorted)}
          style={{
            fontSize: '10px',
            padding: '6px 10px',
            borderRadius: '8px',
            transition: 'all 0.2s',
            cursor: 'pointer',
            background: 'white',
            border: '1px solid var(--nl-border)',
            color: 'var(--nl-muted-text)',
          }}
        >
          ↓ Export CSV
        </button>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', fontSize: '12px' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid var(--nl-border)', background: '#f8f9fa' }}>
              {COLS.map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  style={{
                    padding: '10px 16px',
                    color: 'var(--nl-muted-text)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    fontWeight: '600',
                    fontSize: '10px',
                    cursor: 'pointer',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                    transition: 'color 0.2s',
                    textAlign: col.align === 'right' ? 'right' : 'center',
                  }}
                >
                  {col.label}
                  {sortKey === col.key && <span style={{ marginLeft: '4px', color: 'var(--nl-info)' }}>{sortDir > 0 ? '↑' : '↓'}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map(row => {
              const isPut = row.strike === put_wall
              const isCall = row.strike === call_wall
              const isNearest = row.strike === nearestSpot.strike

              return (
                <tr
                  key={row.strike}
                  style={{
                    borderBottom: '1px solid var(--nl-border)',
                    background: isPut
                      ? 'rgba(239,68,68,0.05)'
                      : isCall
                      ? 'rgba(34,197,94,0.05)'
                      : isNearest
                      ? 'rgba(59,130,246,0.05)'
                      : 'transparent',
                    borderLeft: isPut
                      ? '2px solid var(--nl-danger)'
                      : isCall
                      ? '2px solid var(--nl-success)'
                      : isNearest
                      ? '2px solid var(--nl-info)'
                      : 'none',
                    transition: 'background 0.2s',
                  }}
                >
                  <td className="num" style={{ padding: '10px 16px', textAlign: 'right', fontWeight: '600', color: 'var(--nl-text)' }}>
                    ${row.strike}
                    {isPut && <span style={{ marginLeft: '6px', fontSize: '9px', color: 'var(--nl-danger)' }}>PUT</span>}
                    {isCall && <span style={{ marginLeft: '6px', fontSize: '9px', color: 'var(--nl-success)' }}>CALL</span>}
                    {isNearest && !isPut && !isCall && (
                      <span style={{ marginLeft: '6px', fontSize: '9px', color: 'var(--nl-info)' }}>SPOT</span>
                    )}
                  </td>
                  <td
                    className="num"
                    style={{
                      padding: '10px 16px',
                      textAlign: 'right',
                      color: row.distPct < 0 ? 'var(--nl-danger)' : 'var(--nl-success)',
                    }}
                  >
                    {row.distPct?.toFixed(2)}%
                  </td>
                  <td className="num" style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--nl-success)', fontWeight: '600' }}>
                    {fmtAbbr(row.callGex)}
                  </td>
                  <td className="num" style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--nl-danger)', fontWeight: '600' }}>{fmtAbbr(row.putGex)}</td>
                  <td
                    className="num"
                    style={{
                      padding: '10px 16px',
                      textAlign: 'right',
                      fontWeight: '700',
                      color: row.netGex >= 0 ? 'var(--nl-success)' : 'var(--nl-danger)',
                    }}
                  >
                    {fmtAbbr(row.netGex)}
                  </td>
                  <td className="num" style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--nl-muted-text)' }}>{row.callOi?.toLocaleString()}</td>
                  <td className="num" style={{ padding: '10px 16px', textAlign: 'right', color: 'var(--nl-muted-text)' }}>{row.putOi?.toLocaleString()}</td>
                  <td className="num" style={{ padding: '10px 16px', textAlign: 'center', color: 'var(--nl-muted-text)' }}>{row.expiries}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
