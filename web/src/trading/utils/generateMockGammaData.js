// Generate mock gamma wall data for any ticker

function hash(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

function seededRandom(seed, min, max) {
  const x = Math.sin(seed) * 10000
  const rand = x - Math.floor(x)
  return Math.floor(rand * (max - min + 1)) + min
}

export function generateMockGammaData(ticker = 'GOOG') {
  const seed = hash(ticker)

  // Generate base price (between $50 and $500)
  const basePrice = seededRandom(seed, 50, 500)
  const spot = basePrice + seededRandom(seed + 1, -20, 20)

  // Generate range
  const rangeWidth = seededRandom(seed + 2, 3, 8) / 100
  const rangeLow = spot - spot * rangeWidth / 2
  const rangeHigh = spot + spot * rangeWidth / 2
  const center = (rangeLow + rangeHigh) / 2

  // Position in range (20-80%)
  const positionPct = seededRandom(seed + 3, 20, 80)

  // Put/Call walls
  const put_wall = Math.floor(rangeLow / 5) * 5
  const call_wall = Math.ceil(rangeHigh / 5) * 5

  // Gamma flip
  const gamma_flip = put_wall - seededRandom(seed + 4, 15, 35)

  // Condor decision
  const inSweetSpot = positionPct >= 40 && positionPct <= 60
  const condorAllowed = inSweetSpot && seededRandom(seed + 5, 0, 100) > 30

  const confidenceScore = seededRandom(seed + 6, 65, 95) / 100

  // Generate strikes
  const strikeStart = put_wall - 20
  const strikeEnd = call_wall + 20
  const strikeStep = 5

  const top_strikes = []
  for (let strike = strikeStart; strike <= strikeEnd; strike += strikeStep) {
    const distPct = ((strike - spot) / spot) * 100

    const callGex = seededRandom(hash(`${ticker}-${strike}-call`), 1000000, 8000000)
    const putGex = seededRandom(hash(`${ticker}-${strike}-put`), 1000000, 12000000)
    const netGex = strike > spot ? callGex - putGex * 0.6 : putGex * 0.6 - callGex

    const callOi = Math.floor(callGex / 500)
    const putOi = Math.floor(putGex / 500)

    top_strikes.push({
      strike,
      distPct,
      callGex,
      putGex,
      netGex,
      callOi,
      putOi,
      expiries: seededRandom(hash(`${ticker}-${strike}-exp`), 2, 4)
    })
  }

  return {
    ticker,
    spot: Math.round(spot * 100) / 100,
    put_wall,
    call_wall,
    gamma_flip: Math.round(gamma_flip * 100) / 100,
    center: Math.round(center * 100) / 100,
    band_width_pct: Math.round(rangeWidth * 100 * 100) / 100,
    position_in_band_pct: positionPct,
    confidence_score: confidenceScore,
    condor_allowed: condorAllowed,

    decision: {
      condorAllowed,
      reasons: condorAllowed
        ? []
        : [
            {
              rule: 'center_preference',
              detail: `Spot is at ${positionPct}% of band — prefer 40%–60% (middle of range)`,
            },
          ],
      notes: [],
      suggestedStrikes: condorAllowed
        ? {
            short_put: put_wall,
            long_put: put_wall - 10,
            short_call: call_wall,
            long_call: call_wall + 10,
          }
        : null,
      summary: condorAllowed
        ? '✓ Condor setup looks good'
        : `🚫 Condor blocked — center_preference`,
    },

    walls: {
      call: {
        strike: call_wall,
        gex: seededRandom(seed + 10, 4000000, 8000000),
        oi: seededRandom(seed + 11, 8000, 15000),
        score: seededRandom(seed + 12, 70, 95) / 100,
      },
      put: {
        strike: put_wall,
        gex: seededRandom(seed + 13, 8000000, 15000000),
        oi: seededRandom(seed + 14, 12000, 20000),
        score: seededRandom(seed + 15, 75, 98) / 100,
      },
    },

    top_strikes,

    meta: {
      expiry_set: ['2026-03-13', '2026-03-20', '2026-03-27'],
      contracts_analyzed: seededRandom(seed + 16, 300, 600),
      dte_range: { min: 7, max: 21 },
      generated_at: new Date().toISOString(),
    },

    earnings_check: {
      hasEarnings: seededRandom(seed + 17, 0, 100) < 15,
      earningsDate: null,
      source: 'yahoo',
    },
  }
}
