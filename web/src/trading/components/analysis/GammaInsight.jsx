import { generateGammaInsights } from '../../utils/formatting'

export default function GammaInsight({ data }) {
  if (!data) return null

  const insights = generateGammaInsights(data)

  if (!insights.length) return null

  return (
    <div
      className="nl-card"
      style={{
        padding: '20px',
        background: 'var(--nl-info-light)',
        border: '1px solid var(--nl-info-border)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <span style={{ fontSize: '24px' }}>🔍</span>
        <h3 style={{ fontSize: '15px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--nl-info)', fontWeight: '700', margin: 0 }}>
          Gamma Insights
        </h3>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '12px' }}>
        {insights.map((insight, i) => (
          <div
            key={i}
            style={{
              borderRadius: '12px',
              padding: '12px 16px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '12px',
              transition: 'all 0.2s',
              background: 'white',
              border: '1px solid var(--nl-border)',
              boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
            }}
          >
            <span style={{ fontSize: '20px', flexShrink: 0 }}>{insight.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--nl-muted-text)', fontWeight: '600', marginBottom: '4px' }}>
                {insight.type}
              </div>
              <p style={{ fontSize: '14px', color: 'var(--nl-text)', lineHeight: '1.5', margin: 0 }}>{insight.text}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
