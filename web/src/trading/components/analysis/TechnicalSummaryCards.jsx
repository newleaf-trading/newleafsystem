import { fmt, fmtPct } from '../../utils/formatting'

function Card({ label, value, sub, color = 'text' }) {
  const colorMap = {
    text: 'var(--nl-text)',
    green: 'var(--nl-success)',
    red: 'var(--nl-danger)',
    yellow: 'var(--nl-warn)',
    blue: 'var(--nl-info)',
    purple: '#7c3aed',
    orange: '#f97316'
  }

  return (
    <div className="nl-card" style={{ padding: '16px', minHeight: '110px', display: 'flex', flexDirection: 'column' }}>
      <div style={{ fontSize: '11px', color: 'var(--nl-muted-text)', textTransform: 'uppercase', letterSpacing: '0.10em', marginBottom: '12px', fontWeight: '600' }}>
        {label}
      </div>
      <div className="num" style={{ fontSize: '30px', fontWeight: '900', marginBottom: '8px', color: colorMap[color] || 'var(--nl-text)' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: '13px', color: 'var(--nl-muted-text)', marginTop: 'auto' }}>{sub}</div>}
    </div>
  )
}

export default function TechnicalSummaryCards({ data }) {
  if (!data) return null

  const { spot, trendEngine, volatilityEngine, levelEngine, techScore, techState } = data

  // Determine trend color with better logic
  const getTrendColor = (state) => {
    if (!state) return 'text'
    if (state.includes('Strong Bullish')) return 'green'
    if (state.includes('Bullish')) return 'green'
    if (state.includes('Strong Bearish')) return 'red'
    if (state.includes('Bearish')) return 'red'
    return 'blue'
  }

  // Determine BB state color
  const getBBColor = (state) => {
    if (!state) return 'text'
    if (state.includes('Upper')) return 'green'
    if (state.includes('Lower')) return 'red'
    if (state.includes('Squeeze')) return 'orange'
    if (state.includes('Wide')) return 'yellow'
    return 'blue'
  }

  // Determine tech score color
  const getTechScoreColor = (score) => {
    if (score >= 0.75) return 'green'
    if (score >= 0.60) return 'blue'
    if (score >= 0.45) return 'yellow'
    return 'red'
  }

  // Get level position context
  const getLevelContext = () => {
    if (!levelEngine) return 'No levels'
    const { distanceToSupport1, distanceToResistance1 } = levelEngine
    if (distanceToSupport1 < 1) return 'At support'
    if (distanceToResistance1 < 1) return 'At resistance'
    if (distanceToSupport1 < 3) return 'Near support'
    if (distanceToResistance1 < 3) return 'Near resistance'
    return 'Mid-range'
  }

  // Get trend regime label (never blank, never ambiguous)
  const getTrendLabel = () => {
    if (!trendEngine?.state) return 'Neutral'
    const state = trendEngine.state

    // Strong directional
    if (state.includes('Strong Bullish')) return 'Strong Bull'
    if (state.includes('Strong Bearish')) return 'Strong Bear'

    // Moderate directional
    if (state === 'Bullish Trend') return 'Bullish'
    if (state === 'Bearish Trend') return 'Bearish'

    // Mixed/complex states
    if (state.includes('Bullish Structure')) return 'Mixed Bull'
    if (state.includes('Bearish Pressure')) return 'Mixed Bear'
    if (state.includes('Compression')) return 'Compressing'

    // Default neutral
    return 'Neutral'
  }

  // Get volatility regime label
  const getVolLabel = () => {
    if (!volatilityEngine?.state) return 'Normal'
    const state = volatilityEngine.state

    if (state.includes('Squeeze')) return 'Squeeze'
    if (state.includes('Upper Band')) return 'Upper Band'
    if (state.includes('Lower Band')) return 'Lower Band'
    if (state.includes('Wide')) return 'High Vol'
    if (state.includes('Middle')) return 'Mid-Range'

    return 'Normal'
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
      <Card
        label="Spot Price"
        value={`$${fmt(spot)}`}
        sub="Current quote"
      />

      <Card
        label="Trend Regime"
        value={getTrendLabel()}
        sub={trendEngine?.explanation || trendEngine?.state || 'Awaiting data'}
        color={getTrendColor(trendEngine?.state)}
      />

      <Card
        label="Volatility Regime"
        value={getVolLabel()}
        sub={volatilityEngine?.explanation || volatilityEngine?.state || 'Awaiting data'}
        color={getBBColor(volatilityEngine?.state)}
      />

      <Card
        label="Nearest Support"
        value={`${fmtPct(levelEngine?.distanceToSupport1)}`}
        sub={`$${fmt(levelEngine?.support1)} — ${levelEngine?.distanceToSupport1 < 2 ? 'Critical zone' : 'Below price'}`}
        color={levelEngine?.distanceToSupport1 < 2 ? 'green' : 'text'}
      />

      <Card
        label="Nearest Resistance"
        value={`${fmtPct(levelEngine?.distanceToResistance1)}`}
        sub={`$${fmt(levelEngine?.resistance1)} — ${levelEngine?.distanceToResistance1 < 2 ? 'Overhead cap' : 'Above price'}`}
        color={levelEngine?.distanceToResistance1 < 2 ? 'red' : 'text'}
      />

      <Card
        label="Setup Score"
        value={fmt(techScore)}
        sub={`${techScore >= 0.75 ? 'Strong Setup' : techScore >= 0.60 ? 'Moderate Setup' : techScore >= 0.45 ? 'Weak Setup' : 'Avoid'} — ${getLevelContext()}`}
        color={getTechScoreColor(techScore)}
      />
    </div>
  )
}
