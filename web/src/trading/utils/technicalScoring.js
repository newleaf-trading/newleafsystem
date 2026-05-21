/**
 * Technical Analysis Scoring Utilities — Decision-Focused Edition
 * Pure functions for calculating trend, volatility, and level scores
 */

/**
 * Calculate Trend Score with improved regime logic
 */
export function calculateTrendScore(sma50, sma100, spot) {
  const ratio = sma50 / sma100
  const priceVsSMA50 = spot / sma50
  const priceVsSMA100 = spot / sma100

  let score = 0.5
  let state = 'Neutral Transition'
  let crossover = 'None'
  let explanation = ''

  // Strong bullish: both SMAs aligned, price above both
  if (ratio > 1.02 && priceVsSMA50 > 1.02 && priceVsSMA100 > 1.03) {
    score = 0.85
    state = 'Strong Bullish Trend'
    crossover = 'Golden Cross'
    explanation = 'Both moving averages rising, price leading upward'
  }
  // Moderate bullish: price above 50, 50 above 100
  else if (ratio > 1.005 && priceVsSMA50 > 1.0) {
    score = 0.70
    state = 'Bullish Trend'
    crossover = 'Golden Cross'
    explanation = 'Uptrend intact, price holding above 50-day MA'
  }
  // Bullish structure, weak execution (Golden Cross but price below SMA50)
  else if (ratio > 1.02 && priceVsSMA50 < 0.99) {
    score = 0.45
    state = 'Bullish Structure, Short-Term Weakness'
    crossover = 'Golden Cross'
    explanation = 'Long-term structure bullish, but recent price action weak'
  }
  // Bearish structure with weak execution
  else if (ratio < 0.98 && priceVsSMA50 > 1.01) {
    score = 0.55
    state = 'Bearish Pressure, Short-Term Bounce'
    crossover = 'Death Cross'
    explanation = 'Long-term structure bearish, temporary strength'
  }
  // Moderate bearish: price below 50, 50 below 100
  else if (ratio < 0.995 && priceVsSMA50 < 1.0) {
    score = 0.30
    state = 'Bearish Trend'
    crossover = 'Death Cross'
    explanation = 'Downtrend in force, price below 50-day MA'
  }
  // Strong bearish: full alignment down
  else if (ratio < 0.98 && priceVsSMA50 < 0.98 && priceVsSMA100 < 0.97) {
    score = 0.10
    state = 'Strong Bearish Trend'
    crossover = 'Death Cross'
    explanation = 'All indicators bearish, momentum down'
  }
  // True neutral: SMAs converging, price near both
  else if (Math.abs(ratio - 1) < 0.005 && Math.abs(priceVsSMA50 - 1) < 0.02) {
    score = 0.50
    state = 'Neutral Compression'
    crossover = 'Converging'
    explanation = 'Moving averages converging, awaiting direction'
  }
  // Transition state
  else {
    score = 0.50
    state = 'Neutral Transition'
    crossover = 'Mixed'
    explanation = 'Mixed signals, no clear trend established'
  }

  return {
    score,
    state,
    crossover,
    explanation,
    slope50: ratio > 1.01 ? 'Rising' : ratio < 0.99 ? 'Falling' : 'Flat',
    slope100: priceVsSMA100 > 1.02 ? 'Rising' : priceVsSMA100 < 0.98 ? 'Falling' : 'Flat'
  }
}

/**
 * Calculate Volatility Score with regime interpretation
 */
export function calculateVolatilityScore(spot, upperBand, middleBand, lowerBand) {
  const bandWidth = ((upperBand - lowerBand) / middleBand) * 100
  const position = (spot - lowerBand) / (upperBand - lowerBand)

  let score = 0.5
  let state = 'Normal Range'
  let squeeze = false
  let explanation = ''

  // Squeeze setup (high-probability breakout pending)
  if (bandWidth < 5) {
    squeeze = true
    score = 0.70
    state = 'Squeeze Setup'
    explanation = 'Volatility compressing—breakout likely soon'
  }
  // Riding upper band (momentum breakout)
  else if (position > 0.85 && bandWidth > 6) {
    score = 0.40
    state = 'Upper Band Ride'
    explanation = 'Strong momentum, but pullback risk elevated'
  }
  // Riding lower band (oversold or breakdown)
  else if (position < 0.15 && bandWidth > 6) {
    score = 0.40
    state = 'Lower Band Ride'
    explanation = 'Oversold or breakdown—bounce or continuation?'
  }
  // Middle band (ideal for neutral strategies)
  else if (position > 0.35 && position < 0.65 && bandWidth > 5 && bandWidth < 12) {
    score = 0.75
    state = 'Middle Band'
    explanation = 'Neutral zone, ideal for range-bound strategies'
  }
  // Wide bands (high volatility, breakout risk)
  else if (bandWidth > 15) {
    score = 0.30
    state = 'Wide Bands—Expansion Risk'
    explanation = 'High volatility environment, directional bias unclear'
  }
  // Normal range
  else {
    score = 0.60
    state = 'Normal Range'
    explanation = 'Standard volatility, no extreme conditions'
  }

  return {
    score,
    state,
    squeeze,
    bandWidth: Math.round(bandWidth * 10) / 10,
    position: Math.round(position * 100),
    explanation
  }
}

/**
 * Calculate Level Score with actionable interpretation
 */
export function calculateLevelScore(spot, support1, resistance1) {
  const distanceToSupport = ((spot - support1) / spot) * 100
  const distanceToResistance = ((resistance1 - spot) / spot) * 100
  const rangeSize = resistance1 - support1
  const positionInRange = (spot - support1) / rangeSize

  let score = 0.5
  let state = 'Mid-Range'
  let explanation = ''

  // At support (bounce or breakdown)
  if (distanceToSupport < 1) {
    score = 0.80
    state = 'At Support—Critical Level'
    explanation = 'Price testing support, bounce likely or breakdown imminent'
  }
  // Near support
  else if (distanceToSupport < 3) {
    score = 0.70
    state = 'Near Support'
    explanation = 'Approaching key support, watch for reaction'
  }
  // At resistance (rejection or breakout)
  else if (distanceToResistance < 1) {
    score = 0.30
    state = 'At Resistance—Decision Point'
    explanation = 'Price testing resistance, rejection or breakout ahead'
  }
  // Near resistance
  else if (distanceToResistance < 3) {
    score = 0.35
    state = 'Near Resistance'
    explanation = 'Nearing resistance zone, upside limited'
  }
  // Healthy mid-range
  else if (positionInRange > 0.4 && positionInRange < 0.6) {
    score = 0.75
    state = 'Mid-Range—Balanced'
    explanation = 'Price centered in range, no immediate pressure'
  }
  // Breakout above resistance
  else if (spot > resistance1 * 1.01) {
    score = 0.85
    state = 'Breakout Above Resistance'
    explanation = 'Cleared resistance, momentum favors continuation'
  }
  // Breakdown below support
  else if (spot < support1 * 0.99) {
    score = 0.15
    state = 'Breakdown Below Support'
    explanation = 'Support failed, further downside likely'
  }
  // Lower third of range
  else if (positionInRange < 0.35) {
    score = 0.65
    state = 'Lower Third of Range'
    explanation = 'Closer to support, limited downside risk'
  }
  // Upper third of range
  else {
    score = 0.40
    state = 'Upper Third of Range'
    explanation = 'Closer to resistance, limited upside room'
  }

  return {
    score,
    state,
    distanceToSupport: Math.round(distanceToSupport * 10) / 10,
    distanceToResistance: Math.round(distanceToResistance * 10) / 10,
    explanation
  }
}

/**
 * Calculate overall Technical Score
 */
export function calculateTechnicalScore(trendScore, volatilityScore, levelScore) {
  const score = (trendScore * 0.4) + (volatilityScore * 0.3) + (levelScore * 0.3)
  const roundedScore = Math.round(score * 100) / 100

  let label = 'Weak Setup'
  if (roundedScore >= 0.75) label = 'Strong Setup'
  else if (roundedScore >= 0.60) label = 'Moderate Setup'
  else if (roundedScore >= 0.45) label = 'Weak Setup'
  else label = 'Avoid'

  return { score: roundedScore, label }
}

/**
 * Suggest strategy with confirms/invalidates context
 */
export function suggestStrategy(trendEngine, volatilityEngine, levelEngine, techScore) {
  const { score: trendScore, state: trendState } = trendEngine
  const { squeeze, state: bbState } = volatilityEngine
  const { score: levelScore, state: levelState } = levelEngine

  let strategy = 'Wait'
  let confidence = 0.50
  let why = []
  let risk = ''
  let confirms = []
  let invalidates = []

  // Strong bullish trend
  if (trendScore > 0.70 && !levelState.includes('Resistance')) {
    strategy = 'Bull Call Spread'
    confidence = 0.75
    why = [
      trendState,
      'Price momentum favors upside',
      levelState.includes('Support') ? 'Bouncing from support' : 'No major resistance ahead'
    ]
    risk = 'Reversal at resistance or trend breakdown'
    confirms = ['Price closes above 50-day MA', 'Volume on up days increases', 'Holds above support']
    invalidates = ['Breaks below 50-day MA', 'Bearish engulfing candle', 'Fails at resistance']
  }
  // Strong bearish trend
  else if (trendScore < 0.30 && !levelState.includes('Support')) {
    strategy = 'Bear Put Spread'
    confidence = 0.70
    why = [
      trendState,
      'Downside momentum intact',
      levelState.includes('Resistance') ? 'Rejected at resistance' : 'No strong support nearby'
    ]
    risk = 'Bounce at support or trend reversal'
    confirms = ['Price stays below 50-day MA', 'New lower lows', 'Breaks support']
    invalidates = ['Reclaims 50-day MA', 'Bullish reversal pattern', 'Holds at support']
  }
  // Squeeze detected
  else if (squeeze) {
    strategy = 'Straddle or Wait for Breakout'
    confidence = 0.65
    why = [
      'Bollinger Band squeeze active',
      'Low volatility precedes expansion',
      'Direction unclear—await breakout'
    ]
    risk = 'False breakout or whipsaw'
    confirms = ['Sharp volume increase', 'Clean breakout above/below bands', 'Follow-through day 2']
    invalidates = ['Remains range-bound', 'Fakeout reversal', 'Volume stays low']
  }
  // Near support (bounce setup)
  else if (levelScore > 0.65 && (levelState.includes('Support') || levelState.includes('Lower'))) {
    strategy = 'Bull Put Spread'
    confidence = 0.70
    why = [
      levelState,
      'Support zone identified',
      'Downside risk limited by support'
    ]
    risk = 'Support breakdown leads to further decline'
    confirms = ['Bounces with volume', 'Bullish reversal candle', 'Holds above support']
    invalidates = ['Breaks support on volume', 'Continued selling pressure', 'New lows']
  }
  // Near resistance (rejection setup)
  else if (levelScore < 0.40 && (levelState.includes('Resistance') || levelState.includes('Upper'))) {
    strategy = 'Bear Call Spread'
    confidence = 0.68
    why = [
      levelState,
      'Resistance zone identified',
      'Upside capped by resistance'
    ]
    risk = 'Breakout above resistance extends rally'
    confirms = ['Rejects resistance', 'Bearish reversal pattern', 'Selling volume increases']
    invalidates = ['Breaks resistance on volume', 'New highs', 'Continued buying']
  }
  // Neutral/mid-range setup
  else if (techScore > 0.55 && bbState.includes('Middle') && levelState.includes('Range')) {
    strategy = 'Iron Condor'
    confidence = 0.72
    why = [
      'Price in neutral zone',
      'Middle of Bollinger Bands',
      'Range-bound environment',
      'No strong directional bias'
    ]
    risk = 'Breakout from range invalidates setup'
    confirms = ['Stays within bands', 'Low volatility persists', 'Rangebound price action']
    invalidates = ['Breaks above/below range', 'Volume spike', 'Trend develops']
  }
  // Mixed or unclear
  else {
    strategy = 'Wait'
    confidence = 0.50
    why = [
      'No high-confidence technical setup',
      'Mixed or conflicting signals',
      'Better entry likely to develop'
    ]
    risk = 'Missing early move if setup clarifies'
    confirms = ['Clear trend emerges', 'Breakout/breakdown occurs', 'Setup Score improves']
    invalidates = ['Conditions remain mixed', 'Volatility increases', 'No clear direction']
  }

  return {
    strategy,
    confidence,
    why,
    risk,
    confirms,
    invalidates
  }
}

/**
 * Generate regime summary for quick assessment
 */
export function generateRegimeSummary(trendEngine, volatilityEngine, levelEngine) {
  return {
    trend: trendEngine.state,
    volatility: volatilityEngine.state,
    levels: levelEngine.state,
    overall: `${trendEngine.state} / ${volatilityEngine.state} / ${levelEngine.state}`
  }
}
