export default function RangePlaceholder() {
  // This is a placeholder for future integration with support/resistance service
  // Mock data structure for now

  const mockData = {
    rangeHigh: 315.5,
    rangeLow: 298.2,
    rangeCenter: 306.85,
    rangeDuration: 14, // days
    isTightRange: true,
    isNearCenter: true,
  }

  return (
    <div
      className="nl-card"
      style={{
        padding: '20px',
        position: 'relative',
        overflow: 'hidden',
        background: 'linear-gradient(135deg, rgba(168,85,247,0.06), rgba(236,72,153,0.04))',
        border: '1px solid rgba(168,85,247,0.2)',
      }}
    >
      {/* Coming Soon Badge */}
      <div style={{ position: 'absolute', top: '12px', right: '12px' }}>
        <span
          style={{
            fontSize: '9px',
            fontWeight: '700',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            padding: '4px 8px',
            borderRadius: '999px',
            background: 'var(--nl-purple)',
            color: 'white',
          }}
        >
          Coming Soon
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <span style={{ fontSize: '24px' }}>📊</span>
        <h3 style={{ fontSize: '15px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--nl-purple)', fontWeight: '700', margin: 0 }}>
          Price Range Detection
        </h3>
      </div>

      <div
        style={{
          fontSize: '12px',
          marginBottom: '16px',
          borderRadius: '12px',
          padding: '12px',
          background: 'white',
          border: '1px solid var(--nl-border)',
          color: 'var(--nl-muted-text)',
        }}
      >
        ℹ️ This panel will integrate with support/resistance detection service to identify key price levels and ranges.
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
        <div
          style={{ borderRadius: '12px', padding: '12px', background: 'white', border: '1px solid var(--nl-border)' }}
        >
          <div style={{ fontSize: '10px', color: 'var(--nl-purple)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600', marginBottom: '4px' }}>Range High</div>
          <div className="num" style={{ color: 'var(--nl-text)', fontWeight: '700', fontSize: '16px' }}>${mockData.rangeHigh}</div>
        </div>

        <div
          style={{ borderRadius: '12px', padding: '12px', background: 'white', border: '1px solid var(--nl-border)' }}
        >
          <div style={{ fontSize: '10px', color: 'var(--nl-purple)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600', marginBottom: '4px' }}>Range Low</div>
          <div className="num" style={{ color: 'var(--nl-text)', fontWeight: '700', fontSize: '16px' }}>${mockData.rangeLow}</div>
        </div>

        <div
          style={{ borderRadius: '12px', padding: '12px', background: 'white', border: '1px solid var(--nl-border)' }}
        >
          <div style={{ fontSize: '10px', color: 'var(--nl-purple)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600', marginBottom: '4px' }}>Range Center</div>
          <div className="num" style={{ color: 'var(--nl-text)', fontWeight: '700', fontSize: '16px' }}>${mockData.rangeCenter}</div>
        </div>

        <div
          style={{ borderRadius: '12px', padding: '12px', background: 'white', border: '1px solid var(--nl-border)' }}
        >
          <div style={{ fontSize: '10px', color: 'var(--nl-purple)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600', marginBottom: '4px' }}>Range Duration</div>
          <div className="num" style={{ color: 'var(--nl-text)', fontWeight: '700', fontSize: '16px' }}>{mockData.rangeDuration} days</div>
        </div>

        <div
          style={{ borderRadius: '12px', padding: '12px', background: 'white', border: '1px solid var(--nl-border)' }}
        >
          <div style={{ fontSize: '10px', color: 'var(--nl-purple)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600', marginBottom: '4px' }}>Tight Range?</div>
          <div style={{ color: 'var(--nl-purple)', fontWeight: '700', fontSize: '16px' }}>
            {mockData.isTightRange ? '✓ Yes' : '✗ No'}
          </div>
        </div>

        <div
          style={{ borderRadius: '12px', padding: '12px', background: 'white', border: '1px solid var(--nl-border)' }}
        >
          <div style={{ fontSize: '10px', color: 'var(--nl-purple)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '600', marginBottom: '4px' }}>Near Center?</div>
          <div style={{ color: 'var(--nl-purple)', fontWeight: '700', fontSize: '16px' }}>
            {mockData.isNearCenter ? '✓ Yes' : '✗ No'}
          </div>
        </div>
      </div>
    </div>
  )
}
