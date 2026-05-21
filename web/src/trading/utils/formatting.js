// ══════════════════════════════════════════════════════════════════════════════
// Formatting Utilities — Gamma Wall Dashboard
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Format number to fixed decimal places
 */
export function fmt(n, decimals = 2) {
  return n != null ? Number(n).toFixed(decimals) : '—'
}

/**
 * Format as percentage
 */
export function fmtPct(n, decimals = 1) {
  return n != null ? `${Number(n).toFixed(decimals)}%` : '—'
}

/**
 * Format large numbers as K/M/B abbreviations
 */
export function fmtAbbr(n) {
  if (n == null) return '—'
  const abs = Math.abs(n)
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`
  if (abs >= 1e6) return `${(n / 1e6).toFixed(2)}M`
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`
  return Number(n).toFixed(0)
}

/**
 * Derive market state from position in band
 */
export function deriveMarketState(data) {
  if (!data) return null

  const { spot, put_wall, call_wall, position_in_band_pct, center } = data

  // Determine state
  let state = 'unknown'
  let stateLabel = 'Unknown'
  let stateColor = '#64748b'
  let stateBgColor = '#f1f5f9'

  if (spot < put_wall) {
    state = 'outside_band_below'
    stateLabel = 'Outside Band (Below)'
    stateColor = '#dc2626'
    stateBgColor = '#fee2e2'
  } else if (spot > call_wall) {
    state = 'outside_band_above'
    stateLabel = 'Outside Band (Above)'
    stateColor = '#dc2626'
    stateBgColor = '#fee2e2'
  } else if (position_in_band_pct < 25) {
    state = 'near_put_wall'
    stateLabel = 'Near Put Wall'
    stateColor = '#ea580c'
    stateBgColor = '#ffedd5'
  } else if (position_in_band_pct > 75) {
    state = 'near_call_wall'
    stateLabel = 'Near Call Wall'
    stateColor = '#ea580c'
    stateBgColor = '#ffedd5'
  } else {
    state = 'centered'
    stateLabel = 'Centered'
    stateColor = '#16a34a'
    stateBgColor = '#dcfce7'
  }

  return {
    state,
    stateLabel,
    stateColor,
    stateBgColor,
    spot,
    put_wall,
    call_wall,
    center,
    position_in_band_pct,
    band_width: call_wall - put_wall,
  }
}

/**
 * Generate gamma insight narratives from data
 */
export function generateGammaInsights(data) {
  if (!data) return []

  const insights = []
  const {
    put_wall,
    call_wall,
    center,
    spot,
    position_in_band_pct,
    condor_allowed,
    confidence_score,
    walls,
    band_width_pct,
    ticker,
  } = data

  // Wall strength insights
  if (walls?.put?.gex) {
    insights.push({
      type: 'support',
      text: `Strong put support at $${put_wall} with ${fmtAbbr(walls.put.gex)} GEX.`,
      icon: '🛡️',
    })
  }

  if (walls?.call?.gex) {
    insights.push({
      type: 'resistance',
      text: `Call resistance at $${call_wall} with ${fmtAbbr(walls.call.gex)} GEX.`,
      icon: '🚧',
    })
  }

  // Position insights
  if (position_in_band_pct < 25) {
    insights.push({
      type: 'position',
      text: `Current spot is near the lower edge of the gamma band (${fmtPct(position_in_band_pct)} position).`,
      icon: '⚠️',
    })
  } else if (position_in_band_pct > 75) {
    insights.push({
      type: 'position',
      text: `Current spot is near the upper edge of the gamma band (${fmtPct(position_in_band_pct)} position).`,
      icon: '⚠️',
    })
  } else {
    insights.push({
      type: 'position',
      text: `Spot is well-centered in the gamma band (${fmtPct(position_in_band_pct)} position).`,
      icon: '✓',
    })
  }

  // Condor insights
  if (!condor_allowed) {
    insights.push({
      type: 'strategy',
      text: 'Condor entry is not preferred until price rotates toward center.',
      icon: '🚫',
    })
  } else {
    insights.push({
      type: 'strategy',
      text: `Condor strategy looks favorable with ${fmtPct(confidence_score * 100, 0)} confidence.`,
      icon: '✅',
    })
  }

  // Band width insight
  if (band_width_pct < 5) {
    insights.push({
      type: 'range',
      text: `Gamma band width is relatively tight (${fmtPct(band_width_pct)}), which supports range-based option strategies.`,
      icon: '📊',
    })
  } else if (band_width_pct > 10) {
    insights.push({
      type: 'range',
      text: `Gamma band is wide (${fmtPct(band_width_pct)}), suggesting higher volatility expectations.`,
      icon: '📈',
    })
  }

  return insights
}

/**
 * Generate mini insight sentence for top of dashboard
 */
export function generateMiniInsight(data) {
  if (!data) return ''

  const { ticker, position_in_band_pct, condor_allowed } = data

  if (position_in_band_pct < 30) {
    return `${ticker} is trading near the lower edge of its gamma band; neutral premium selling is currently less favorable.`
  } else if (position_in_band_pct > 70) {
    return `${ticker} is trading near the upper edge of its gamma band; neutral premium selling is currently less favorable.`
  } else if (condor_allowed) {
    return `${ticker} is well-positioned within its gamma band; conditions look favorable for neutral option strategies.`
  } else {
    return `${ticker} is trading within its gamma band but does not meet all criteria for optimal condor entry.`
  }
}

/**
 * Determine zone color for band position
 */
export function getZoneColor(pct) {
  if (pct < 25) return { bg: '#fee2e2', border: '#ef4444', text: '#dc2626' }
  if (pct < 40) return { bg: '#ffedd5', border: '#f97316', text: '#ea580c' }
  if (pct <= 60) return { bg: '#dcfce7', border: '#22c55e', text: '#16a34a' }
  if (pct <= 75) return { bg: '#ffedd5', border: '#f97316', text: '#ea580c' }
  return { bg: '#fee2e2', border: '#ef4444', text: '#dc2626' }
}

/**
 * Get condor status badge styling
 */
export function getCondorBadge(allowed) {
  return allowed
    ? { bg: '#dcfce7', border: '#22c55e', text: '#16a34a', label: '✓ Allowed' }
    : { bg: '#fee2e2', border: '#ef4444', text: '#dc2626', label: '✗ Blocked' }
}
