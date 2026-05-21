import { useState } from 'react'

export default function MetaPanel({ data }) {
  const [copied, setCopied] = useState(false)
  if (!data) return null
  const { meta, earnings_check } = data

  const copyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(data, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="nl-card" style={{ padding: '20px', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
        <h3 style={{ fontSize: '15px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--nl-muted-text)', fontWeight: '700', margin: 0 }}>Meta</h3>
        <button
          onClick={copyJSON}
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
          {copied ? '✓ Copied' : '{ } Copy JSON'}
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px' }}>
        <div>
          <div style={{ color: 'var(--nl-muted-text)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '9px', fontWeight: '600', marginBottom: '4px' }}>Contracts</div>
          <div className="num" style={{ color: 'var(--nl-text)', fontSize: '18px', fontWeight: '700' }}>{meta?.contracts_analyzed ?? '—'}</div>
        </div>
        <div>
          <div style={{ color: 'var(--nl-muted-text)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '9px', fontWeight: '600', marginBottom: '4px' }}>DTE Range</div>
          <div className="num" style={{ color: 'var(--nl-text)' }}>
            {meta?.dte_range?.min ?? '—'} – {meta?.dte_range?.max ?? '—'} days
          </div>
        </div>
        <div style={{ gridColumn: 'span 2' }}>
          <div style={{ color: 'var(--nl-muted-text)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '9px', fontWeight: '600', marginBottom: '4px' }}>Expiry Set</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {(meta?.expiry_set ?? []).map(exp => (
              <span
                key={exp}
                className="num"
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  fontSize: '10px',
                  background: '#f8f9fa',
                  border: '1px solid var(--nl-border)',
                  color: 'var(--nl-text)',
                }}
              >
                {exp}
              </span>
            ))}
          </div>
        </div>
        <div>
          <div style={{ color: 'var(--nl-muted-text)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '9px', fontWeight: '600', marginBottom: '4px' }}>Generated</div>
          <div className="num" style={{ color: 'var(--nl-muted-text)', fontSize: '10px' }}>
            {meta?.generated_at ? new Date(meta.generated_at).toLocaleTimeString() : '—'}
          </div>
        </div>
        {earnings_check && (
          <div>
            <div style={{ color: 'var(--nl-muted-text)', textTransform: 'uppercase', letterSpacing: '0.05em', fontSize: '9px', fontWeight: '600', marginBottom: '4px' }}>Earnings</div>
            <div
              style={{
                fontSize: '10px',
                fontWeight: '600',
                color: earnings_check.hasEarnings ? 'var(--nl-warn)' : 'var(--nl-success)',
              }}
            >
              {earnings_check.hasEarnings ? `⚠ ${earnings_check.earningsDate}` : '✓ None in window'}
            </div>
            <div style={{ fontSize: '9px', color: 'var(--nl-muted-text)', marginTop: '2px' }}>via {earnings_check.source}</div>
          </div>
        )}
      </div>
    </div>
  )
}
