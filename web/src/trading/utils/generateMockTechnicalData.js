/**
 * Generate mock technical analysis data for testing
 * Uses improved scoring logic from technicalScoring.js
 */
import {
  calculateTrendScore,
  calculateVolatilityScore,
  calculateLevelScore,
  calculateTechnicalScore,
  suggestStrategy
} from './technicalScoring'

export function generateMockTechnicalData(ticker = 'GOOG', spot = 298.3) {
  // Generate 50-day price history for chart
  const generatePriceHistory = (currentPrice, days = 50) => {
    const history = []
    let price = currentPrice * 0.92 // Start 8% below current
    const volatility = 0.015 // 1.5% daily volatility

    for (let i = 0; i < days; i++) {
      const change = (Math.random() - 0.48) * volatility * price
      price += change
      history.push({
        day: i,
        price: price,
        date: new Date(Date.now() - (days - i) * 24 * 60 * 60 * 1000)
      })
    }

    // Ensure last price matches current spot
    history[history.length - 1].price = currentPrice

    return history
  }

  const priceHistory = generatePriceHistory(spot)

  // Calculate SMAs
  const calculateSMA = (data, period) => {
    return data.map((_, i) => {
      if (i < period - 1) return null
      const sum = data.slice(i - period + 1, i + 1).reduce((a, b) => a + b.price, 0)
      return sum / period
    })
  }

  const sma50Values = calculateSMA(priceHistory, 20) // Use 20 for visual purposes
  const sma100Values = calculateSMA(priceHistory, 40) // Use 40 for visual purposes

  const sma50 = spot * 1.012 // Slightly above current (302)
  const sma100 = spot * 1.032 // Higher above (308)

  // Calculate Bollinger Bands (20-period, 2 std dev)
  const calculateBollingerBands = (data) => {
    const period = 20
    const upperBands = []
    const middleBands = []
    const lowerBands = []

    data.forEach((_, i) => {
      if (i < period - 1) {
        upperBands.push(null)
        middleBands.push(null)
        lowerBands.push(null)
        return
      }

      const slice = data.slice(i - period + 1, i + 1).map(d => d.price)
      const sma = slice.reduce((a, b) => a + b, 0) / period
      const variance = slice.reduce((sum, price) => sum + Math.pow(price - sma, 2), 0) / period
      const stdDev = Math.sqrt(variance)

      middleBands.push(sma)
      upperBands.push(sma + 2 * stdDev)
      lowerBands.push(sma - 2 * stdDev)
    })

    return { upperBands, middleBands, lowerBands }
  }

  const { upperBands, middleBands, lowerBands } = calculateBollingerBands(priceHistory)

  const upperBand = spot * 1.079 // 322
  const middleBand = spot * 1.039 // 310
  const lowerBand = spot * 0.999 // 298

  // Support and Resistance levels
  const support1 = spot * 0.988 // 295
  const support2 = spot * 0.965 // 288
  const resistance1 = spot * 1.039 // 310
  const resistance2 = spot * 1.073 // 320

  // Calculate distances
  const distanceToSupport1 = ((spot - support1) / spot) * 100 // 2.4%
  const distanceToResistance1 = ((resistance1 - spot) / spot) * 100 // 7.2%

  // Use improved scoring functions
  const trendEngine = calculateTrendScore(sma50, sma100, spot)
  const volatilityEngine = calculateVolatilityScore(spot, upperBand, middleBand, lowerBand)
  const levelEngine = calculateLevelScore(spot, support1, resistance1)

  // Calculate overall technical score
  const { score: techScore, label: techLabel } = calculateTechnicalScore(
    trendEngine.score,
    volatilityEngine.score,
    levelEngine.score
  )

  // Determine technical state based on trend primarily
  let techState = 'Neutral'
  if (trendEngine.state.includes('Strong Bullish')) techState = 'Bullish Strong'
  else if (trendEngine.state.includes('Bullish')) techState = 'Bullish Neutral'
  else if (trendEngine.state.includes('Strong Bearish')) techState = 'Bearish Strong'
  else if (trendEngine.state.includes('Bearish')) techState = 'Bearish Neutral'

  // Generate strategy recommendation
  const recommendation = suggestStrategy(trendEngine, volatilityEngine, levelEngine, techScore)

  return {
    ticker,
    spot,

    // Price history for chart
    priceHistory: priceHistory.map((p, i) => ({
      ...p,
      sma50: sma50Values[i],
      sma100: sma100Values[i],
      upperBand: upperBands[i],
      middleBand: middleBands[i],
      lowerBand: lowerBands[i]
    })),

    // Trend Engine (with new structure)
    trendEngine: {
      sma50,
      sma100,
      crossover: trendEngine.crossover,
      slope50: trendEngine.slope50,
      slope100: trendEngine.slope100,
      state: trendEngine.state,
      score: trendEngine.score,
      explanation: trendEngine.explanation
    },

    // Volatility Engine (with new structure)
    volatilityEngine: {
      upperBand,
      middleBand,
      lowerBand,
      bandWidth: volatilityEngine.bandWidth,
      state: volatilityEngine.state,
      squeeze: volatilityEngine.squeeze,
      score: volatilityEngine.score,
      explanation: volatilityEngine.explanation,
      position: volatilityEngine.position
    },

    // Level Engine (with new structure)
    levelEngine: {
      support1,
      support2,
      resistance1,
      resistance2,
      distanceToSupport1: levelEngine.distanceToSupport,
      distanceToResistance1: levelEngine.distanceToResistance,
      state: levelEngine.state,
      score: levelEngine.score,
      explanation: levelEngine.explanation
    },

    // Overall scores
    techScore,
    techState,

    // Recommendation (with confirms/invalidates)
    recommendation: {
      strategy: recommendation.strategy,
      confidence: recommendation.confidence,
      why: recommendation.why,
      risk: recommendation.risk,
      confirms: recommendation.confirms,
      invalidates: recommendation.invalidates
    },

    // Metadata
    meta: {
      generated_at: new Date().toISOString(),
      data_source: 'mock'
    }
  }
}
