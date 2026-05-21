export default function TechnicalChart({ data }) {
  if (!data || !data.priceHistory) return null

  const { priceHistory, trendEngine, volatilityEngine, levelEngine } = data
  const { sma50, sma100 } = trendEngine
  const { upperBand, middleBand, lowerBand } = volatilityEngine
  const { support1, resistance1 } = levelEngine

  // Find price range for scaling
  const prices = priceHistory.map(p => p.price)
  const allValues = [...prices, sma50, sma100, upperBand, lowerBand, support1, resistance1].filter(v => v != null)
  const minPrice = Math.min(...allValues)
  const maxPrice = Math.max(...allValues)
  const priceRange = maxPrice - minPrice
  const padding = priceRange * 0.1

  // Helper to convert price to Y position (inverted: 0 = top, 100 = bottom)
  const priceToY = (price) => {
    return ((maxPrice + padding - price) / (priceRange + 2 * padding)) * 100
  }

  // Helper to convert index to X position
  const indexToX = (index) => {
    return (index / (priceHistory.length - 1)) * 100
  }

  // Generate SVG path for price line
  const pricePath = priceHistory
    .map((p, i) => {
      const x = indexToX(i)
      const y = priceToY(p.price)
      return `${i === 0 ? 'M' : 'L'} ${x} ${y}`
    })
    .join(' ')

  // Generate SVG path for SMA lines
  const sma50Path = priceHistory
    .map((p, i) => {
      if (!p.sma50) return null
      const x = indexToX(i)
      const y = priceToY(p.sma50)
      return `${i === 0 || !priceHistory[i - 1]?.sma50 ? 'M' : 'L'} ${x} ${y}`
    })
    .filter(Boolean)
    .join(' ')

  const sma100Path = priceHistory
    .map((p, i) => {
      if (!p.sma100) return null
      const x = indexToX(i)
      const y = priceToY(p.sma100)
      return `${i === 0 || !priceHistory[i - 1]?.sma100 ? 'M' : 'L'} ${x} ${y}`
    })
    .filter(Boolean)
    .join(' ')

  // Generate Bollinger Band paths
  const upperBandPath = priceHistory
    .map((p, i) => {
      if (!p.upperBand) return null
      const x = indexToX(i)
      const y = priceToY(p.upperBand)
      return `${i === 0 || !priceHistory[i - 1]?.upperBand ? 'M' : 'L'} ${x} ${y}`
    })
    .filter(Boolean)
    .join(' ')

  const middleBandPath = priceHistory
    .map((p, i) => {
      if (!p.middleBand) return null
      const x = indexToX(i)
      const y = priceToY(p.middleBand)
      return `${i === 0 || !priceHistory[i - 1]?.middleBand ? 'M' : 'L'} ${x} ${y}`
    })
    .filter(Boolean)
    .join(' ')

  const lowerBandPath = priceHistory
    .map((p, i) => {
      if (!p.lowerBand) return null
      const x = indexToX(i)
      const y = priceToY(p.lowerBand)
      return `${i === 0 || !priceHistory[i - 1]?.lowerBand ? 'M' : 'L'} ${x} ${y}`
    })
    .filter(Boolean)
    .join(' ')

  const currentSpot = priceHistory[priceHistory.length - 1]?.price

  return (
    <div className="nl-card" style={{ padding: '20px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
        <h3 style={{ fontSize: '15px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--nl-muted-text)', fontWeight: '700', margin: 0 }}>
          Technical Chart — SMA + Bollinger Bands
        </h3>

        {/* Legend */}
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', fontSize: '12px', color: 'var(--nl-muted-text)' }}>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#3b82f6' }} />
            Price
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#8b5cf6' }} />
            SMA 50
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#ec4899' }} />
            SMA 100
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#10b981' }} />
            BB Upper
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#ef4444' }} />
            BB Lower
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ background: '#f59e0b' }} />
            Support/Resistance
          </span>
        </div>
      </div>

      {/* Chart Container */}
      <div
        style={{
          position: 'relative',
          height: '400px',
          borderRadius: '18px',
          overflow: 'hidden',
          border: '1px solid var(--nl-border)',
          background: 'linear-gradient(180deg, rgba(247,248,250,0.5), rgba(255,255,255,1))',
        }}
      >
        {/* Grid lines */}
        {[20, 40, 60, 80].map(p => (
          <div
            key={p}
            style={{
              position: 'absolute',
              top: `${p}%`,
              left: 0,
              right: 0,
              height: '1px',
              background: 'rgba(0,0,0,0.04)',
            }}
          />
        ))}

        {/* SVG Chart */}
        <svg
          width="100%"
          height="100%"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          style={{ position: 'absolute', top: 0, left: 0 }}
        >
          {/* Bollinger Band Fill - Reduced opacity for less visual clutter */}
          {upperBandPath && lowerBandPath && (
            <path
              d={`${upperBandPath} L 100 ${priceToY(lowerBand)} ${lowerBandPath.split('M')[1]} Z`}
              fill="rgba(16, 185, 129, 0.03)"
              stroke="none"
            />
          )}

          {/* Bollinger Bands - Lighter strokes */}
          {upperBandPath && (
            <path
              d={upperBandPath}
              fill="none"
              stroke="#10b981"
              strokeWidth="0.25"
              strokeDasharray="2 2"
              opacity="0.5"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {middleBandPath && (
            <path
              d={middleBandPath}
              fill="none"
              stroke="#6b7280"
              strokeWidth="0.2"
              strokeDasharray="1 1"
              opacity="0.4"
              vectorEffect="non-scaling-stroke"
            />
          )}
          {lowerBandPath && (
            <path
              d={lowerBandPath}
              fill="none"
              stroke="#ef4444"
              strokeWidth="0.25"
              strokeDasharray="2 2"
              opacity="0.5"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {/* SMA 100 - Lighter */}
          {sma100Path && (
            <path
              d={sma100Path}
              fill="none"
              stroke="#ec4899"
              strokeWidth="0.35"
              opacity="0.6"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {/* SMA 50 - Lighter */}
          {sma50Path && (
            <path
              d={sma50Path}
              fill="none"
              stroke="#8b5cf6"
              strokeWidth="0.35"
              opacity="0.6"
              vectorEffect="non-scaling-stroke"
            />
          )}

          {/* Price Line - PROMINENT (thicker, brighter, full opacity) */}
          <path
            d={pricePath}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="1.0"
            vectorEffect="non-scaling-stroke"
          />

          {/* Current Spot Marker - Larger */}
          <circle
            cx="100"
            cy={priceToY(currentSpot)}
            r="1.2"
            fill="#3b82f6"
            vectorEffect="non-scaling-stroke"
          />
        </svg>

        {/* Support/Resistance Lines - Stronger and more visible */}
        <div
          style={{
            position: 'absolute',
            top: `${priceToY(support1)}%`,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, transparent, #10b981 10%, #10b981 90%, transparent)',
            opacity: 0.75,
            boxShadow: '0 0 4px rgba(16, 185, 129, 0.3)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: `${priceToY(resistance1)}%`,
            left: 0,
            right: 0,
            height: '3px',
            background: 'linear-gradient(90deg, transparent, #ef4444 10%, #ef4444 90%, transparent)',
            opacity: 0.75,
            boxShadow: '0 0 4px rgba(239, 68, 68, 0.3)',
          }}
        />

        {/* Price Labels */}
        <div
          style={{
            position: 'absolute',
            right: '8px',
            top: `${priceToY(currentSpot)}%`,
            transform: 'translateY(-50%)',
            background: '#3b82f6',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: '700',
          }}
        >
          ${currentSpot?.toFixed(2)}
        </div>

        {/* Support Label - Clearer */}
        <div
          style={{
            position: 'absolute',
            right: '8px',
            top: `${priceToY(support1)}%`,
            transform: 'translateY(-50%)',
            background: '#10b981',
            color: 'white',
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: '700',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        >
          Support ${support1?.toFixed(0)}
        </div>

        {/* Resistance Label - Clearer */}
        <div
          style={{
            position: 'absolute',
            right: '8px',
            top: `${priceToY(resistance1)}%`,
            transform: 'translateY(-50%)',
            background: '#ef4444',
            color: 'white',
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: '700',
            boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
          }}
        >
          Resistance ${resistance1?.toFixed(0)}
        </div>
      </div>
    </div>
  )
}
