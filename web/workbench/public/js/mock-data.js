/**
 * mock-data.js
 * ============
 * Realistic mock pipeline output for testing strategy-logic.html
 * and all scanner pages without an R2 connection.
 *
 * Usage in any HTML page:
 *   <script src="js/mock-data.js"></script>
 *   Then window.MOCK_REPORTS is available.
 *
 * Or in Node.js:
 *   const { MOCK_REPORTS, MOCK_MANIFEST, MOCK_STRATEGY_RESULTS } = require('./mock-data.js');
 *
 * These 12 stocks cover all strategy types:
 *   - High IV neutral → Iron Condor / CSP (MARA, UVXY, RIOT)
 *   - Mega cap bullish → Wheel / CSP (NVDA, AMZN)
 *   - Large cap neutral → Bull Put / CSP (SPY, QQQ)
 *   - Bearish high IV → Bear Call (TQQQ, COIN)
 *   - Low IV bullish → Bull Call (COST, MSFT)
 *   - Neutral term slope → Calendar (AAPL, SCHW)
 */

const MOCK_REPORTS = [

  // ── NVDA — mega cap, bullish, high IV → best for CSP + WHEEL ──────────────
  {
    meta: { symbol: 'NVDA', generatedBy: 'newleaf-pipeline/3.0', mode: 'daily' },
    marketCapTier: 'mega',
    sector: 'Technology',
    qualityScore: 92,
    earningsDate: '2026-05-21',
    snapshot: {
      price: 118.40,
      changePercent: 1.8,
      atmIv: 0.62,
      ivLevel: 'high',
    },
    technicalData: {
      trendEngine: { state: 'bullish', score: 0.78 },
      rsi: 62,
      sma50: 112.30,
      sma100: 108.80,
      sma200: 98.40,
      aboveSMA50: true,
      aboveSMA100: true,
      aboveSMA200: true,
      realizedVol30d: 0.48,
      atrPct: 0.028,
      priceHistory: Array.from({length:60},(_,i)=>100+i*0.3+Math.random()*3),
    },
    gammaData: {
      ivData: { ivRank: 62, atmIv: 0.62 },
      condorGate: { condorAllowed: false }, // trending — condor blocked
      analysis: {
        confidence_score: 0.82,
        direction: 'bullish',
        key_levels: [
          { price: 110.00, type: 'support', strength: 0.8 },
          { price: 130.00, type: 'resistance', strength: 0.7 },
        ],
      },
      ivByExpiry: {
        '2026-04-17': 0.68,
        '2026-05-15': 0.58,
        '2026-06-20': 0.52,
      },
    },
    scoring: {
      opportunityScore: 84,
      pillars: { gamma: 28, iv: 30, trend: 26 },
      strategy: { name: 'Cash-Secured Put', code: 'csp', icon: '📉', reasons: ['High IV','Bullish trend'] },
      direction: 'bullish',
    },
    optionChain: [
      { strike: 100, expiry: '2026-04-17', dte: 14, type: 'put',  bid: 0.10, ask: 0.14, mid: 0.12, iv: 0.71, delta: -0.08, gamma: 0.01, theta: -0.04, openInterest: 4200, oiChange: 120 },
      { strike: 105, expiry: '2026-04-17', dte: 14, type: 'put',  bid: 0.28, ask: 0.34, mid: 0.31, iv: 0.68, delta: -0.15, gamma: 0.02, theta: -0.07, openInterest: 3800, oiChange: 88 },
      { strike: 110, expiry: '2026-04-17', dte: 14, type: 'put',  bid: 1.10, ask: 1.18, mid: 1.14, iv: 0.65, delta: -0.25, gamma: 0.04, theta: -0.12, openInterest: 5600, oiChange: 240 },
      { strike: 115, expiry: '2026-04-17', dte: 14, type: 'put',  bid: 2.80, ask: 2.95, mid: 2.88, iv: 0.63, delta: -0.40, gamma: 0.05, theta: -0.15, openInterest: 2100, oiChange: 55 },
      { strike: 120, expiry: '2026-04-17', dte: 14, type: 'call', bid: 2.60, ask: 2.75, mid: 2.68, iv: 0.61, delta:  0.42, gamma: 0.05, theta: -0.14, openInterest: 1800, oiChange: 42 },
      { strike: 125, expiry: '2026-04-17', dte: 14, type: 'call', bid: 1.05, ask: 1.14, mid: 1.10, iv: 0.59, delta:  0.26, gamma: 0.04, theta: -0.11, openInterest: 3200, oiChange: 98 },
      { strike: 130, expiry: '2026-04-17', dte: 14, type: 'call', bid: 0.32, ask: 0.38, mid: 0.35, iv: 0.57, delta:  0.14, gamma: 0.02, theta: -0.07, openInterest: 2800, oiChange: 66 },
      { strike: 110, expiry: '2026-05-15', dte: 42, type: 'put',  bid: 2.40, ask: 2.58, mid: 2.49, iv: 0.60, delta: -0.24, gamma: 0.02, theta: -0.06, openInterest: 4800, oiChange: 180 },
      { strike: 115, expiry: '2026-05-15', dte: 42, type: 'put',  bid: 4.20, ask: 4.40, mid: 4.30, iv: 0.58, delta: -0.38, gamma: 0.03, theta: -0.08, openInterest: 1900, oiChange: 44 },
      { strike: 120, expiry: '2026-05-15', dte: 42, type: 'call', bid: 4.10, ask: 4.30, mid: 4.20, iv: 0.56, delta:  0.40, gamma: 0.03, theta: -0.07, openInterest: 1600, oiChange: 38 },
      { strike: 125, expiry: '2026-05-15', dte: 42, type: 'call', bid: 1.95, ask: 2.10, mid: 2.03, iv: 0.54, delta:  0.25, gamma: 0.02, theta: -0.06, openInterest: 2900, oiChange: 82 },
    ],
  },

  // ── SPY — ETF, neutral, moderate IV → Iron Condor + Bull Put ──────────────
  {
    meta: { symbol: 'SPY', generatedBy: 'newleaf-pipeline/3.0', mode: 'daily' },
    marketCapTier: 'etf',
    sector: 'Index & ETF',
    qualityScore: 85,
    earningsDate: null,
    snapshot: { price: 512.40, changePercent: -1.2, atmIv: 0.28, ivLevel: 'medium' },
    technicalData: {
      trendEngine: { state: 'neutral', score: 0.38 },
      rsi: 48,
      sma50: 508.20,
      sma100: 499.40,
      sma200: 481.60,
      aboveSMA50: true, aboveSMA100: true, aboveSMA200: true,
      realizedVol30d: 0.165,
      atrPct: 0.011,
      priceHistory: Array.from({length:60},(_,i)=>480+i*0.55+Math.random()*4),
    },
    gammaData: {
      ivData: { ivRank: 44, atmIv: 0.28 },
      condorGate: { condorAllowed: true },
      analysis: {
        confidence_score: 0.71,
        direction: 'neutral',
        key_levels: [
          { price: 490.00, type: 'support', strength: 0.9 },
          { price: 500.00, type: 'support', strength: 0.75 },
          { price: 525.00, type: 'resistance', strength: 0.8 },
          { price: 540.00, type: 'resistance', strength: 0.65 },
        ],
      },
      ivByExpiry: {
        '2026-04-17': 0.30,
        '2026-04-24': 0.28,
        '2026-05-15': 0.25,
        '2026-06-20': 0.22,
      },
    },
    scoring: {
      opportunityScore: 78,
      pillars: { gamma: 22, iv: 18, trend: 38 },
      strategy: { name: 'Iron Condor', code: 'iron_condor', icon: '🦅', reasons: ['Neutral trend','Low ATR'] },
      direction: 'neutral',
    },
    optionChain: [
      { strike: 490, expiry: '2026-04-17', dte: 14, type: 'put',  bid: 0.48, ask: 0.54, mid: 0.51, iv: 0.31, delta: -0.14, gamma: 0.01, theta: -0.08, openInterest: 8400, oiChange: 320 },
      { strike: 495, expiry: '2026-04-17', dte: 14, type: 'put',  bid: 1.05, ask: 1.12, mid: 1.09, iv: 0.30, delta: -0.23, gamma: 0.02, theta: -0.11, openInterest: 12200, oiChange: 480 },
      { strike: 500, expiry: '2026-04-17', dte: 14, type: 'put',  bid: 2.10, ask: 2.20, mid: 2.15, iv: 0.29, delta: -0.36, gamma: 0.03, theta: -0.14, openInterest: 9800, oiChange: 260 },
      { strike: 515, expiry: '2026-04-17', dte: 14, type: 'call', bid: 2.05, ask: 2.15, mid: 2.10, iv: 0.28, delta:  0.35, gamma: 0.03, theta: -0.13, openInterest: 7600, oiChange: 198 },
      { strike: 520, expiry: '2026-04-17', dte: 14, type: 'call', bid: 0.98, ask: 1.06, mid: 1.02, iv: 0.27, delta:  0.22, gamma: 0.02, theta: -0.10, openInterest: 11400, oiChange: 420 },
      { strike: 525, expiry: '2026-04-17', dte: 14, type: 'call', bid: 0.38, ask: 0.44, mid: 0.41, iv: 0.26, delta:  0.12, gamma: 0.01, theta: -0.07, openInterest: 9200, oiChange: 280 },
      { strike: 490, expiry: '2026-05-15', dte: 42, type: 'put',  bid: 1.85, ask: 1.96, mid: 1.91, iv: 0.26, delta: -0.22, gamma: 0.01, theta: -0.05, openInterest: 6800, oiChange: 180 },
      { strike: 520, expiry: '2026-05-15', dte: 42, type: 'call', bid: 3.20, ask: 3.35, mid: 3.28, iv: 0.25, delta:  0.24, gamma: 0.01, theta: -0.05, openInterest: 5400, oiChange: 140 },
    ],
  },

  // ── MARA — high beta, neutral, very high IV → Iron Condor ideal ───────────
  {
    meta: { symbol: 'MARA', generatedBy: 'newleaf-pipeline/3.0', mode: 'daily' },
    marketCapTier: 'mid',
    sector: 'Crypto',
    qualityScore: 42,
    earningsDate: '2026-05-08',
    snapshot: { price: 8.19, changePercent: 2.4, atmIv: 0.88, ivLevel: 'extreme' },
    technicalData: {
      trendEngine: { state: 'neutral', score: 0.42 },
      rsi: 52,
      sma50: 7.80,
      sma100: 8.20,
      sma200: 9.10,
      aboveSMA50: true, aboveSMA100: false, aboveSMA200: false,
      realizedVol30d: 0.72,
      atrPct: 0.048,
      priceHistory: Array.from({length:60},(_,i)=>7+Math.sin(i/5)*1.5+Math.random()*0.8),
    },
    gammaData: {
      ivData: { ivRank: 68, atmIv: 0.88 },
      condorGate: { condorAllowed: true },
      analysis: {
        confidence_score: 0.60,
        direction: 'neutral',
        key_levels: [
          { price: 6.50, type: 'support', strength: 0.7 },
          { price: 7.00, type: 'support', strength: 0.8 },
          { price: 9.00, type: 'resistance', strength: 0.75 },
          { price: 10.00, type: 'resistance', strength: 0.65 },
        ],
      },
      ivByExpiry: {
        '2026-04-17': 0.95,
        '2026-05-15': 0.82,
        '2026-06-20': 0.74,
      },
    },
    scoring: {
      opportunityScore: 71,
      pillars: { gamma: 30, iv: 28, trend: 13 },
      strategy: { name: 'Iron Condor', code: 'iron_condor', icon: '🦅', reasons: ['Extreme IV','Neutral'] },
      direction: 'neutral',
    },
    optionChain: [
      { strike: 6.0,  expiry: '2026-05-15', dte: 42, type: 'put',  bid: 0.18, ask: 0.24, mid: 0.21, iv: 0.98, delta: -0.12, gamma: 0.04, theta: -0.02, openInterest: 1240, oiChange: 88 },
      { strike: 7.0,  expiry: '2026-05-15', dte: 42, type: 'put',  bid: 0.58, ask: 0.66, mid: 0.62, iv: 0.92, delta: -0.24, gamma: 0.06, theta: -0.03, openInterest: 2800, oiChange: 140 },
      { strike: 8.0,  expiry: '2026-05-15', dte: 42, type: 'put',  bid: 1.42, ask: 1.56, mid: 1.49, iv: 0.88, delta: -0.42, gamma: 0.08, theta: -0.04, openInterest: 1600, oiChange: 62 },
      { strike: 9.0,  expiry: '2026-05-15', dte: 42, type: 'call', bid: 1.35, ask: 1.50, mid: 1.43, iv: 0.84, delta:  0.38, gamma: 0.07, theta: -0.04, openInterest: 2200, oiChange: 95 },
      { strike: 10.0, expiry: '2026-05-15', dte: 42, type: 'call', bid: 0.62, ask: 0.74, mid: 0.68, iv: 0.81, delta:  0.24, gamma: 0.05, theta: -0.03, openInterest: 3100, oiChange: 128 },
      { strike: 11.0, expiry: '2026-05-15', dte: 42, type: 'call', bid: 0.22, ask: 0.30, mid: 0.26, iv: 0.78, delta:  0.14, gamma: 0.03, theta: -0.02, openInterest: 1800, oiChange: 72 },
      { strike: 7.0,  expiry: '2026-04-17', dte: 14, type: 'put',  bid: 0.35, ask: 0.44, mid: 0.40, iv: 0.95, delta: -0.22, gamma: 0.08, theta: -0.05, openInterest: 1900, oiChange: 80 },
      { strike: 9.0,  expiry: '2026-04-17', dte: 14, type: 'call', bid: 0.38, ask: 0.48, mid: 0.43, iv: 0.91, delta:  0.21, gamma: 0.07, theta: -0.05, openInterest: 2400, oiChange: 105 },
    ],
  },

  // ── UVXY — vol ETF, bearish, extreme IV → Bear Call ideal ─────────────────
  {
    meta: { symbol: 'UVXY', generatedBy: 'newleaf-pipeline/3.0', mode: 'daily' },
    marketCapTier: 'etf',
    sector: 'Volatility',
    qualityScore: 45,
    earningsDate: null,
    snapshot: { price: 51.90, changePercent: -4.2, atmIv: 1.10, ivLevel: 'extreme' },
    technicalData: {
      trendEngine: { state: 'bearish', score: 0.82 },
      rsi: 34,
      sma50: 58.40,
      sma100: 62.10,
      sma200: 68.80,
      aboveSMA50: false, aboveSMA100: false, aboveSMA200: false,
      realizedVol30d: 0.88,
      atrPct: 0.055,
      priceHistory: Array.from({length:60},(_,i)=>70-i*0.3+Math.random()*3),
    },
    gammaData: {
      ivData: { ivRank: 82, atmIv: 1.10 },
      condorGate: { condorAllowed: false },
      analysis: {
        confidence_score: 0.88,
        direction: 'bearish',
        key_levels: [
          { price: 45.00, type: 'support', strength: 0.7 },
          { price: 58.00, type: 'resistance', strength: 0.85 },
          { price: 65.00, type: 'resistance', strength: 0.72 },
        ],
      },
      ivByExpiry: {
        '2026-04-17': 1.18,
        '2026-04-24': 1.05,
        '2026-05-15': 0.92,
      },
    },
    scoring: {
      opportunityScore: 74,
      pillars: { gamma: 35, iv: 30, trend: 9 },
      strategy: { name: 'Bear Call Spread', code: 'bear_call', icon: '📉', reasons: ['Extreme IV','Bearish','Mean-reverts'] },
      direction: 'bearish',
    },
    optionChain: [
      { strike: 55, expiry: '2026-04-17', dte: 14, type: 'call', bid: 1.08, ask: 1.22, mid: 1.15, iv: 1.18, delta:  0.24, gamma: 0.04, theta: -0.14, openInterest: 3800, oiChange: 180 },
      { strike: 58, expiry: '2026-04-17', dte: 14, type: 'call', bid: 0.52, ask: 0.64, mid: 0.58, iv: 1.14, delta:  0.16, gamma: 0.03, theta: -0.10, openInterest: 2600, oiChange: 110 },
      { strike: 62, expiry: '2026-04-17', dte: 14, type: 'call', bid: 0.18, ask: 0.26, mid: 0.22, iv: 1.09, delta:  0.08, gamma: 0.02, theta: -0.06, openInterest: 1900, oiChange: 75 },
      { strike: 45, expiry: '2026-04-17', dte: 14, type: 'put',  bid: 0.82, ask: 0.96, mid: 0.89, iv: 1.20, delta: -0.22, gamma: 0.04, theta: -0.13, openInterest: 2200, oiChange: 92 },
      { strike: 48, expiry: '2026-04-17', dte: 14, type: 'put',  bid: 1.68, ask: 1.84, mid: 1.76, iv: 1.16, delta: -0.38, gamma: 0.05, theta: -0.16, openInterest: 1400, oiChange: 48 },
    ],
  },

  // ── SOFI — mid cap, neutral, high IV → CSP ────────────────────────────────
  {
    meta: { symbol: 'SOFI', generatedBy: 'newleaf-pipeline/3.0', mode: 'daily' },
    marketCapTier: 'mid',
    sector: 'Financials',
    qualityScore: 55,
    earningsDate: '2026-04-29',
    snapshot: { price: 15.67, changePercent: 0.8, atmIv: 0.55, ivLevel: 'high' },
    technicalData: {
      trendEngine: { state: 'neutral', score: 0.44 },
      rsi: 51,
      sma50: 14.80,
      sma100: 14.20,
      sma200: 13.60,
      aboveSMA50: true, aboveSMA100: true, aboveSMA200: true,
      realizedVol30d: 0.42,
      atrPct: 0.032,
      priceHistory: Array.from({length:60},(_,i)=>13+i*0.04+Math.random()*0.5),
    },
    gammaData: {
      ivData: { ivRank: 55, atmIv: 0.55 },
      condorGate: { condorAllowed: true },
      analysis: {
        confidence_score: 0.62,
        direction: 'neutral',
        key_levels: [
          { price: 14.00, type: 'support', strength: 0.75 },
          { price: 18.00, type: 'resistance', strength: 0.65 },
        ],
      },
      ivByExpiry: {
        '2026-04-17': 0.62,
        '2026-05-15': 0.52,
        '2026-06-20': 0.46,
      },
    },
    scoring: {
      opportunityScore: 68,
      pillars: { gamma: 22, iv: 24, trend: 22 },
      strategy: { name: 'Cash-Secured Put', code: 'csp', icon: '📉', reasons: ['High IV','Neutral trend'] },
      direction: 'neutral',
    },
    optionChain: [
      { strike: 13.0, expiry: '2026-04-17', dte: 14, type: 'put',  bid: 0.08, ask: 0.12, mid: 0.10, iv: 0.62, delta: -0.10, gamma: 0.03, theta: -0.02, openInterest: 820, oiChange: 40 },
      { strike: 14.0, expiry: '2026-04-17', dte: 14, type: 'put',  bid: 0.28, ask: 0.34, mid: 0.31, iv: 0.59, delta: -0.24, gamma: 0.05, theta: -0.03, openInterest: 1640, oiChange: 88 },
      { strike: 15.0, expiry: '2026-04-17', dte: 14, type: 'put',  bid: 0.68, ask: 0.76, mid: 0.72, iv: 0.56, delta: -0.40, gamma: 0.07, theta: -0.04, openInterest: 1200, oiChange: 55 },
      { strike: 16.0, expiry: '2026-04-17', dte: 14, type: 'call', bid: 0.62, ask: 0.70, mid: 0.66, iv: 0.54, delta:  0.38, gamma: 0.06, theta: -0.04, openInterest: 980, oiChange: 42 },
      { strike: 17.0, expiry: '2026-04-17', dte: 14, type: 'call', bid: 0.22, ask: 0.28, mid: 0.25, iv: 0.52, delta:  0.20, gamma: 0.04, theta: -0.02, openInterest: 1440, oiChange: 68 },
      { strike: 14.0, expiry: '2026-05-15', dte: 42, type: 'put',  bid: 0.54, ask: 0.62, mid: 0.58, iv: 0.54, delta: -0.24, gamma: 0.03, theta: -0.02, openInterest: 1800, oiChange: 80 },
      { strike: 16.0, expiry: '2026-05-15', dte: 42, type: 'call', bid: 0.88, ask: 0.98, mid: 0.93, iv: 0.50, delta:  0.24, gamma: 0.03, theta: -0.02, openInterest: 1100, oiChange: 48 },
    ],
  },

  // ── SCHW — large cap, bullish, moderate IV → WHEEL quality stock ──────────
  {
    meta: { symbol: 'SCHW', generatedBy: 'newleaf-pipeline/3.0', mode: 'daily' },
    marketCapTier: 'large',
    sector: 'Financials',
    qualityScore: 78,
    earningsDate: '2026-04-22',
    snapshot: { price: 78.50, changePercent: 0.4, atmIv: 0.38, ivLevel: 'medium' },
    technicalData: {
      trendEngine: { state: 'bullish', score: 0.64 },
      rsi: 58,
      sma50: 76.20,
      sma100: 73.40,
      sma200: 69.80,
      aboveSMA50: true, aboveSMA100: true, aboveSMA200: true,
      realizedVol30d: 0.28,
      atrPct: 0.018,
      priceHistory: Array.from({length:60},(_,i)=>68+i*0.18+Math.random()*1.2),
    },
    gammaData: {
      ivData: { ivRank: 42, atmIv: 0.38 },
      condorGate: { condorAllowed: true },
      analysis: {
        confidence_score: 0.74,
        direction: 'bullish',
        key_levels: [
          { price: 74.00, type: 'support', strength: 0.8 },
          { price: 80.00, type: 'resistance', strength: 0.7 },
          { price: 85.00, type: 'resistance', strength: 0.6 },
        ],
      },
      ivByExpiry: {
        '2026-04-17': 0.42,
        '2026-05-15': 0.36,
        '2026-06-20': 0.32,
      },
    },
    scoring: {
      opportunityScore: 76,
      pillars: { gamma: 20, iv: 18, trend: 38 },
      strategy: { name: 'Wheel', code: 'wheel', icon: '♻', reasons: ['Quality large cap','Bullish trend'] },
      direction: 'bullish',
    },
    optionChain: [
      { strike: 72, expiry: '2026-04-17', dte: 14, type: 'put',  bid: 0.12, ask: 0.16, mid: 0.14, iv: 0.42, delta: -0.10, gamma: 0.02, theta: -0.03, openInterest: 680, oiChange: 28 },
      { strike: 74, expiry: '2026-04-17', dte: 14, type: 'put',  bid: 0.32, ask: 0.38, mid: 0.35, iv: 0.40, delta: -0.22, gamma: 0.03, theta: -0.05, openInterest: 1240, oiChange: 52 },
      { strike: 76, expiry: '2026-04-17', dte: 14, type: 'put',  bid: 0.72, ask: 0.80, mid: 0.76, iv: 0.38, delta: -0.36, gamma: 0.04, theta: -0.07, openInterest: 920, oiChange: 38 },
      { strike: 80, expiry: '2026-04-17', dte: 14, type: 'call', bid: 0.68, ask: 0.76, mid: 0.72, iv: 0.36, delta:  0.34, gamma: 0.04, theta: -0.07, openInterest: 840, oiChange: 34 },
      { strike: 82, expiry: '2026-04-17', dte: 14, type: 'call', bid: 0.22, ask: 0.28, mid: 0.25, iv: 0.34, delta:  0.18, gamma: 0.02, theta: -0.04, openInterest: 1100, oiChange: 45 },
      { strike: 74, expiry: '2026-05-15', dte: 42, type: 'put',  bid: 0.72, ask: 0.82, mid: 0.77, iv: 0.36, delta: -0.24, gamma: 0.02, theta: -0.03, openInterest: 1480, oiChange: 62 },
      { strike: 80, expiry: '2026-05-15', dte: 42, type: 'call', bid: 1.18, ask: 1.30, mid: 1.24, iv: 0.34, delta:  0.26, gamma: 0.02, theta: -0.03, openInterest: 960, oiChange: 40 },
    ],
  },

  // ── COST — mega cap, bullish, low IV → Bull Call ideal ────────────────────
  {
    meta: { symbol: 'COST', generatedBy: 'newleaf-pipeline/3.0', mode: 'daily' },
    marketCapTier: 'mega',
    sector: 'Consumer',
    qualityScore: 88,
    earningsDate: '2026-06-05',
    snapshot: { price: 1009.97, changePercent: 0.6, atmIv: 0.22, ivLevel: 'low' },
    technicalData: {
      trendEngine: { state: 'bullish', score: 0.72 },
      rsi: 62,
      sma50: 985.40,
      sma100: 960.20,
      sma200: 920.80,
      aboveSMA50: true, aboveSMA100: true, aboveSMA200: true,
      realizedVol30d: 0.18,
      atrPct: 0.010,
      priceHistory: Array.from({length:60},(_,i)=>920+i*1.5+Math.random()*8),
    },
    gammaData: {
      ivData: { ivRank: 22, atmIv: 0.22 },
      condorGate: { condorAllowed: false },
      analysis: {
        confidence_score: 0.78,
        direction: 'bullish',
        key_levels: [
          { price: 980.00, type: 'support', strength: 0.85 },
          { price: 1050.00, type: 'resistance', strength: 0.7 },
        ],
      },
      ivByExpiry: {
        '2026-04-17': 0.24,
        '2026-05-15': 0.21,
        '2026-06-20': 0.20,
      },
    },
    scoring: {
      opportunityScore: 72,
      pillars: { gamma: 15, iv: 12, trend: 45 },
      strategy: { name: 'Bull Call Spread', code: 'bull_call', icon: '🚀', reasons: ['Low IV','Bullish trend'] },
      direction: 'bullish',
    },
    optionChain: [
      { strike: 990,  expiry: '2026-05-15', dte: 42, type: 'put',  bid: 3.20, ask: 3.50, mid: 3.35, iv: 0.24, delta: -0.22, gamma: 0.001, theta: -0.18, openInterest: 420, oiChange: 18 },
      { strike: 1010, expiry: '2026-05-15', dte: 42, type: 'call', bid: 18.40, ask: 19.20, mid: 18.80, iv: 0.22, delta:  0.48, gamma: 0.001, theta: -0.22, openInterest: 380, oiChange: 15 },
      { strike: 1040, expiry: '2026-05-15', dte: 42, type: 'call', bid: 5.80, ask: 6.40, mid: 6.10, iv: 0.20, delta:  0.24, gamma: 0.001, theta: -0.14, openInterest: 520, oiChange: 22 },
      { strike: 1060, expiry: '2026-05-15', dte: 42, type: 'call', bid: 1.90, ask: 2.20, mid: 2.05, iv: 0.19, delta:  0.12, gamma: 0.0008, theta: -0.08, openInterest: 640, oiChange: 26 },
    ],
  },

  // ── AAPL — mega cap, neutral, moderate IV → Calendar ideal ────────────────
  {
    meta: { symbol: 'AAPL', generatedBy: 'newleaf-pipeline/3.0', mode: 'daily' },
    marketCapTier: 'mega',
    sector: 'Technology',
    qualityScore: 90,
    earningsDate: '2026-04-29',
    snapshot: { price: 195.00, changePercent: -0.3, atmIv: 0.36, ivLevel: 'medium' },
    technicalData: {
      trendEngine: { state: 'neutral', score: 0.30 },
      rsi: 50,
      sma50: 193.40,
      sma100: 191.80,
      sma200: 188.60,
      aboveSMA50: true, aboveSMA100: true, aboveSMA200: true,
      realizedVol30d: 0.24,
      atrPct: 0.013,
      priceHistory: Array.from({length:60},(_,i)=>188+Math.sin(i/8)*4+Math.random()*2),
    },
    gammaData: {
      ivData: { ivRank: 38, atmIv: 0.36 },
      condorGate: { condorAllowed: true },
      analysis: {
        confidence_score: 0.68,
        direction: 'neutral',
        key_levels: [
          { price: 188.00, type: 'support', strength: 0.82 },
          { price: 200.00, type: 'resistance', strength: 0.78 },
          { price: 210.00, type: 'resistance', strength: 0.60 },
        ],
      },
      ivByExpiry: {
        '2026-04-17': 0.42,  // front month elevated (near earnings)
        '2026-04-24': 0.38,
        '2026-05-15': 0.32,  // back month cheaper
        '2026-06-20': 0.29,
      },
    },
    scoring: {
      opportunityScore: 70,
      pillars: { gamma: 20, iv: 20, trend: 30 },
      strategy: { name: 'Calendar Spread', code: 'calendar', icon: '📅', reasons: ['IV term slope +10%','Earnings in back window'] },
      direction: 'neutral',
    },
    optionChain: [
      { strike: 190, expiry: '2026-04-17', dte: 14, type: 'put',  bid: 0.85, ask: 0.95, mid: 0.90, iv: 0.42, delta: -0.22, gamma: 0.03, theta: -0.08, openInterest: 4200, oiChange: 180 },
      { strike: 195, expiry: '2026-04-17', dte: 14, type: 'call', bid: 2.10, ask: 2.24, mid: 2.17, iv: 0.40, delta:  0.44, gamma: 0.04, theta: -0.10, openInterest: 5800, oiChange: 240 },
      { strike: 195, expiry: '2026-05-15', dte: 42, type: 'call', bid: 4.40, ask: 4.60, mid: 4.50, iv: 0.32, delta:  0.42, gamma: 0.02, theta: -0.05, openInterest: 3800, oiChange: 140 },
      { strike: 195, expiry: '2026-05-15', dte: 42, type: 'put',  bid: 3.80, ask: 4.00, mid: 3.90, iv: 0.33, delta: -0.40, gamma: 0.02, theta: -0.05, openInterest: 3200, oiChange: 120 },
      { strike: 200, expiry: '2026-04-17', dte: 14, type: 'call', bid: 0.52, ask: 0.60, mid: 0.56, iv: 0.38, delta:  0.22, gamma: 0.03, theta: -0.07, openInterest: 6400, oiChange: 280 },
      { strike: 200, expiry: '2026-05-15', dte: 42, type: 'call', bid: 2.20, ask: 2.36, mid: 2.28, iv: 0.30, delta:  0.24, gamma: 0.02, theta: -0.04, openInterest: 4600, oiChange: 190 },
    ],
  },

  // ── RIOT — high beta, bearish, high IV → Bear Put / Bear Call ─────────────
  {
    meta: { symbol: 'RIOT', generatedBy: 'newleaf-pipeline/3.0', mode: 'daily' },
    marketCapTier: 'mid',
    sector: 'Crypto',
    qualityScore: 40,
    earningsDate: '2026-05-12',
    snapshot: { price: 12.78, changePercent: -3.1, atmIv: 0.78, ivLevel: 'high' },
    technicalData: {
      trendEngine: { state: 'bearish', score: 0.71 },
      rsi: 34,
      sma50: 14.20,
      sma100: 15.80,
      sma200: 18.40,
      aboveSMA50: false, aboveSMA100: false, aboveSMA200: false,
      realizedVol30d: 0.62,
      atrPct: 0.044,
      priceHistory: Array.from({length:60},(_,i)=>18-i*0.09+Math.random()*0.8),
    },
    gammaData: {
      ivData: { ivRank: 62, atmIv: 0.78 },
      condorGate: { condorAllowed: false },
      analysis: {
        confidence_score: 0.72,
        direction: 'bearish',
        key_levels: [
          { price: 11.50, type: 'support', strength: 0.65 },
          { price: 14.00, type: 'resistance', strength: 0.80 },
          { price: 16.00, type: 'resistance', strength: 0.70 },
        ],
      },
      ivByExpiry: {
        '2026-04-17': 0.85,
        '2026-05-15': 0.72,
        '2026-06-20': 0.65,
      },
    },
    scoring: {
      opportunityScore: 64,
      pillars: { gamma: 28, iv: 24, trend: 12 },
      strategy: { name: 'Bear Put Spread', code: 'bear_put', icon: '🐻', reasons: ['Bearish trend','Elevated IV'] },
      direction: 'bearish',
    },
    optionChain: [
      { strike: 11.0, expiry: '2026-05-15', dte: 42, type: 'put',  bid: 0.32, ask: 0.40, mid: 0.36, iv: 0.82, delta: -0.18, gamma: 0.05, theta: -0.02, openInterest: 980, oiChange: 45 },
      { strike: 12.0, expiry: '2026-05-15', dte: 42, type: 'put',  bid: 0.72, ask: 0.82, mid: 0.77, iv: 0.79, delta: -0.30, gamma: 0.06, theta: -0.03, openInterest: 1640, oiChange: 72 },
      { strike: 13.0, expiry: '2026-05-15', dte: 42, type: 'put',  bid: 1.35, ask: 1.50, mid: 1.43, iv: 0.76, delta: -0.44, gamma: 0.07, theta: -0.04, openInterest: 1200, oiChange: 52 },
      { strike: 14.0, expiry: '2026-05-15', dte: 42, type: 'call', bid: 1.28, ask: 1.44, mid: 1.36, iv: 0.74, delta:  0.40, gamma: 0.06, theta: -0.03, openInterest: 880, oiChange: 38 },
      { strike: 15.0, expiry: '2026-05-15', dte: 42, type: 'call', bid: 0.58, ask: 0.70, mid: 0.64, iv: 0.71, delta:  0.24, gamma: 0.04, theta: -0.02, openInterest: 1320, oiChange: 58 },
    ],
  },

  // ── QQQ — ETF, bullish, moderate IV → Bull Put ────────────────────────────
  {
    meta: { symbol: 'QQQ', generatedBy: 'newleaf-pipeline/3.0', mode: 'daily' },
    marketCapTier: 'etf',
    sector: 'Index & ETF',
    qualityScore: 82,
    earningsDate: null,
    snapshot: { price: 432.10, changePercent: -0.9, atmIv: 0.30, ivLevel: 'medium' },
    technicalData: {
      trendEngine: { state: 'bullish', score: 0.58 },
      rsi: 56,
      sma50: 424.80,
      sma100: 414.60,
      sma200: 398.40,
      aboveSMA50: true, aboveSMA100: true, aboveSMA200: true,
      realizedVol30d: 0.22,
      atrPct: 0.013,
      priceHistory: Array.from({length:60},(_,i)=>395+i*0.62+Math.random()*3),
    },
    gammaData: {
      ivData: { ivRank: 40, atmIv: 0.30 },
      condorGate: { condorAllowed: true },
      analysis: {
        confidence_score: 0.69,
        direction: 'bullish',
        key_levels: [
          { price: 418.00, type: 'support', strength: 0.82 },
          { price: 425.00, type: 'support', strength: 0.70 },
          { price: 445.00, type: 'resistance', strength: 0.74 },
        ],
      },
      ivByExpiry: {
        '2026-04-17': 0.33,
        '2026-04-24': 0.30,
        '2026-05-15': 0.27,
        '2026-06-20': 0.24,
      },
    },
    scoring: {
      opportunityScore: 74,
      pillars: { gamma: 18, iv: 16, trend: 40 },
      strategy: { name: 'Bull Put Spread', code: 'bull_put', icon: '📈', reasons: ['Bullish trend','ETF quality'] },
      direction: 'bullish',
    },
    optionChain: [
      { strike: 415, expiry: '2026-04-17', dte: 14, type: 'put',  bid: 0.52, ask: 0.60, mid: 0.56, iv: 0.33, delta: -0.18, gamma: 0.02, theta: -0.08, openInterest: 5800, oiChange: 240 },
      { strike: 420, expiry: '2026-04-17', dte: 14, type: 'put',  bid: 1.18, ask: 1.28, mid: 1.23, iv: 0.31, delta: -0.28, gamma: 0.03, theta: -0.11, openInterest: 7200, oiChange: 300 },
      { strike: 425, expiry: '2026-04-17', dte: 14, type: 'put',  bid: 2.20, ask: 2.34, mid: 2.27, iv: 0.30, delta: -0.40, gamma: 0.04, theta: -0.14, openInterest: 4800, oiChange: 180 },
      { strike: 438, expiry: '2026-04-17', dte: 14, type: 'call', bid: 2.10, ask: 2.24, mid: 2.17, iv: 0.29, delta:  0.38, gamma: 0.04, theta: -0.13, openInterest: 5600, oiChange: 210 },
      { strike: 445, expiry: '2026-04-17', dte: 14, type: 'call', bid: 0.68, ask: 0.78, mid: 0.73, iv: 0.27, delta:  0.20, gamma: 0.02, theta: -0.08, openInterest: 8400, oiChange: 320 },
      { strike: 420, expiry: '2026-05-15', dte: 42, type: 'put',  bid: 2.80, ask: 2.98, mid: 2.89, iv: 0.28, delta: -0.26, gamma: 0.01, theta: -0.05, openInterest: 4200, oiChange: 160 },
      { strike: 445, expiry: '2026-05-15', dte: 42, type: 'call', bid: 2.60, ask: 2.78, mid: 2.69, iv: 0.25, delta:  0.24, gamma: 0.01, theta: -0.04, openInterest: 3800, oiChange: 140 },
    ],
  },

  // ── COIN — large cap, neutral/bearish, high IV → Bear Call ────────────────
  {
    meta: { symbol: 'COIN', generatedBy: 'newleaf-pipeline/3.0', mode: 'daily' },
    marketCapTier: 'large',
    sector: 'Crypto',
    qualityScore: 52,
    earningsDate: '2026-05-06',
    snapshot: { price: 171.66, changePercent: -2.8, atmIv: 0.72, ivLevel: 'high' },
    technicalData: {
      trendEngine: { state: 'neutral', score: 0.48 },
      rsi: 44,
      sma50: 182.40,
      sma100: 190.80,
      sma200: 208.60,
      aboveSMA50: false, aboveSMA100: false, aboveSMA200: false,
      realizedVol30d: 0.58,
      atrPct: 0.038,
      priceHistory: Array.from({length:60},(_,i)=>210-i*0.64+Math.random()*4),
    },
    gammaData: {
      ivData: { ivRank: 58, atmIv: 0.72 },
      condorGate: { condorAllowed: true },
      analysis: {
        confidence_score: 0.64,
        direction: 'neutral',
        key_levels: [
          { price: 160.00, type: 'support', strength: 0.72 },
          { price: 185.00, type: 'resistance', strength: 0.78 },
          { price: 200.00, type: 'resistance', strength: 0.68 },
        ],
      },
      ivByExpiry: {
        '2026-04-17': 0.78,
        '2026-05-15': 0.66,
        '2026-06-20': 0.59,
      },
    },
    scoring: {
      opportunityScore: 67,
      pillars: { gamma: 24, iv: 26, trend: 17 },
      strategy: { name: 'Bear Call Spread', code: 'bear_call', icon: '📉', reasons: ['High IV','Below all SMAs'] },
      direction: 'neutral',
    },
    optionChain: [
      { strike: 155, expiry: '2026-05-15', dte: 42, type: 'put',  bid: 2.80, ask: 3.10, mid: 2.95, iv: 0.78, delta: -0.20, gamma: 0.02, theta: -0.05, openInterest: 1440, oiChange: 62 },
      { strike: 165, expiry: '2026-05-15', dte: 42, type: 'put',  bid: 6.20, ask: 6.60, mid: 6.40, iv: 0.74, delta: -0.36, gamma: 0.03, theta: -0.07, openInterest: 980, oiChange: 42 },
      { strike: 180, expiry: '2026-05-15', dte: 42, type: 'call', bid: 6.80, ask: 7.20, mid: 7.00, iv: 0.70, delta:  0.38, gamma: 0.03, theta: -0.07, openInterest: 1160, oiChange: 50 },
      { strike: 190, expiry: '2026-05-15', dte: 42, type: 'call', bid: 3.40, ask: 3.70, mid: 3.55, iv: 0.67, delta:  0.24, gamma: 0.02, theta: -0.05, openInterest: 1840, oiChange: 78 },
      { strike: 200, expiry: '2026-05-15', dte: 42, type: 'call', bid: 1.40, ask: 1.62, mid: 1.51, iv: 0.64, delta:  0.14, gamma: 0.01, theta: -0.03, openInterest: 2200, oiChange: 92 },
      { strike: 185, expiry: '2026-04-17', dte: 14, type: 'call', bid: 1.45, ask: 1.65, mid: 1.55, iv: 0.76, delta:  0.22, gamma: 0.02, theta: -0.08, openInterest: 2600, oiChange: 110 },
    ],
  },

  // ── MSFT — mega cap, bullish, low IV → Bull Call ideal ────────────────────
  {
    meta: { symbol: 'MSFT', generatedBy: 'newleaf-pipeline/3.0', mode: 'daily' },
    marketCapTier: 'mega',
    sector: 'Technology',
    qualityScore: 91,
    earningsDate: '2026-04-22',
    snapshot: { price: 356.15, changePercent: 0.5, atmIv: 0.25, ivLevel: 'low' },
    technicalData: {
      trendEngine: { state: 'bullish', score: 0.65 },
      rsi: 60,
      sma50: 348.40,
      sma100: 338.80,
      sma200: 322.60,
      aboveSMA50: true, aboveSMA100: true, aboveSMA200: true,
      realizedVol30d: 0.20,
      atrPct: 0.011,
      priceHistory: Array.from({length:60},(_,i)=>320+i*0.60+Math.random()*3),
    },
    gammaData: {
      ivData: { ivRank: 32, atmIv: 0.25 },
      condorGate: { condorAllowed: false },
      analysis: {
        confidence_score: 0.76,
        direction: 'bullish',
        key_levels: [
          { price: 342.00, type: 'support', strength: 0.84 },
          { price: 370.00, type: 'resistance', strength: 0.72 },
        ],
      },
      ivByExpiry: {
        '2026-04-17': 0.30,  // earnings bump
        '2026-05-15': 0.24,
        '2026-06-20': 0.22,
      },
    },
    scoring: {
      opportunityScore: 70,
      pillars: { gamma: 14, iv: 11, trend: 45 },
      strategy: { name: 'Bull Call Spread', code: 'bull_call', icon: '🚀', reasons: ['Low IV','Strong bullish','Earnings catalyst'] },
      direction: 'bullish',
    },
    optionChain: [
      { strike: 345, expiry: '2026-05-15', dte: 42, type: 'put',  bid: 2.10, ask: 2.30, mid: 2.20, iv: 0.26, delta: -0.22, gamma: 0.008, theta: -0.10, openInterest: 2800, oiChange: 110 },
      { strike: 357, expiry: '2026-05-15', dte: 42, type: 'call', bid: 9.20, ask: 9.60, mid: 9.40, iv: 0.25, delta:  0.46, gamma: 0.009, theta: -0.12, openInterest: 2400, oiChange: 95 },
      { strike: 375, expiry: '2026-05-15', dte: 42, type: 'call', bid: 3.40, ask: 3.70, mid: 3.55, iv: 0.23, delta:  0.24, gamma: 0.006, theta: -0.08, openInterest: 3200, oiChange: 128 },
      { strike: 390, expiry: '2026-05-15', dte: 42, type: 'call', bid: 0.88, ask: 1.02, mid: 0.95, iv: 0.22, delta:  0.12, gamma: 0.004, theta: -0.05, openInterest: 4200, oiChange: 168 },
    ],
  },

];


// ── Manifest (mirrors real R2 manifest.json) ──────────────────────────────────
const MOCK_MANIFEST = {
  version: '3.0',
  updatedAt: new Date().toISOString(),
  mode: 'daily',
  reports: MOCK_REPORTS.map(r => ({
    symbol: r.meta.symbol,
    sector: r.sector,
    tier: r.marketCapTier,
    updatedAt: new Date().toISOString(),
    opportunityScore: r.scoring.opportunityScore,
    topStrategy: r.scoring.strategy.code,
    trend: r.technicalData.trendEngine.state,
    ivRank: r.gammaData.ivData.ivRank,
  })),
};


// ── Pre-computed strategy results (what the engine would return) ──────────────
// Useful for testing scanner pages without running the full engine.
const MOCK_STRATEGY_RESULTS = {
  CSP: [
    { symbol:'NVDA', score:84, grade:'A', trend:'bullish', ivRank:62, tier:'mega',
      setup:{ action:'Sell $110 Put', expiry:'2026-04-17', dte:14, credit:1.14, creditDollars:114, breakEven:108.86, strikePct:7.1, putYield:0.96 } },
    { symbol:'SOFI', score:68, grade:'B', trend:'neutral', ivRank:55, tier:'mid',
      setup:{ action:'Sell $14 Put', expiry:'2026-04-17', dte:14, credit:0.31, creditDollars:31, breakEven:13.69, strikePct:10.7, putYield:1.98 } },
    { symbol:'MARA', score:65, grade:'B', trend:'neutral', ivRank:68, tier:'mid',
      setup:{ action:'Sell $7 Put', expiry:'2026-05-15', dte:42, credit:0.62, creditDollars:62, breakEven:6.38, strikePct:14.5, putYield:7.57 } },
    { symbol:'RIOT', score:58, grade:'C', trend:'bearish', ivRank:62, tier:'mid',
      setup:{ action:'Sell $12 Put', expiry:'2026-05-15', dte:42, credit:0.77, creditDollars:77, breakEven:11.23, strikePct:6.1, putYield:6.03 } },
    { symbol:'SCHW', score:76, grade:'B', trend:'bullish', ivRank:42, tier:'large',
      setup:{ action:'Sell $74 Put', expiry:'2026-04-17', dte:14, credit:0.35, creditDollars:35, breakEven:73.65, strikePct:5.7, putYield:0.45 } },
    { symbol:'SPY',  score:72, grade:'B', trend:'neutral', ivRank:44, tier:'etf',
      setup:{ action:'Sell $495 Put', expiry:'2026-04-17', dte:14, credit:1.09, creditDollars:109, breakEven:493.91, strikePct:3.4, putYield:0.21 } },
  ],
  WHEEL: [
    { symbol:'SCHW', score:76, grade:'B', trend:'bullish', ivRank:42, tier:'large',
      setup:{ action:'Sell $74 Put', expiry:'2026-04-17', dte:14, credit:0.35, creditDollars:35, breakEven:73.65, capitalRequired:7400, putYield:0.45 } },
    { symbol:'SPY',  score:70, grade:'B', trend:'neutral', ivRank:44, tier:'etf',
      setup:{ action:'Sell $495 Put', expiry:'2026-04-17', dte:14, credit:1.09, creditDollars:109, breakEven:493.91, capitalRequired:49500, putYield:0.21 } },
  ],
  IRON_CONDOR: [
    { symbol:'MARA', score:77, grade:'B', trend:'neutral', ivRank:68, tier:'mid',
      setup:{ putShort:7, putLong:6, callShort:10, callLong:11, credit:1.27, creditDollars:127, maxLoss:373, dte:42, expiry:'2026-05-15' } },
    { symbol:'UVXY', score:74, grade:'B', trend:'bearish', ivRank:82, tier:'etf',
      setup:{ putShort:43, putLong:40, callShort:58, callLong:62, credit:1.73, creditDollars:173, maxLoss:227, dte:14, expiry:'2026-04-17' } },
    { symbol:'SPY',  score:78, grade:'B', trend:'neutral', ivRank:44, tier:'etf',
      setup:{ putShort:490, putLong:480, callShort:525, callLong:535, credit:1.50, creditDollars:150, maxLoss:850, dte:14, expiry:'2026-04-17' } },
    { symbol:'SOFI', score:65, grade:'B', trend:'neutral', ivRank:55, tier:'mid',
      setup:{ putShort:14, putLong:12, callShort:18, callLong:20, credit:0.86, creditDollars:86, maxLoss:114, dte:42, expiry:'2026-05-15' } },
  ],
  BULL_PUT: [
    { symbol:'QQQ',  score:74, grade:'B', trend:'bullish', ivRank:40, tier:'etf',
      setup:{ shortPut:420, longPut:410, credit:0.67, creditDollars:67, maxLoss:933, rr:0.07, dte:14, expiry:'2026-04-17' } },
    { symbol:'SCHW', score:72, grade:'B', trend:'bullish', ivRank:42, tier:'large',
      setup:{ shortPut:74, longPut:71, credit:0.21, creditDollars:21, maxLoss:279, rr:0.08, dte:14, expiry:'2026-04-17' } },
    { symbol:'SPY',  score:70, grade:'B', trend:'neutral', ivRank:44, tier:'etf',
      setup:{ shortPut:495, longPut:485, credit:0.58, creditDollars:58, maxLoss:942, rr:0.06, dte:14, expiry:'2026-04-17' } },
    { symbol:'NVDA', score:68, grade:'B', trend:'bullish', ivRank:62, tier:'mega',
      setup:{ shortPut:110, longPut:105, credit:0.83, creditDollars:83, maxLoss:417, rr:0.20, dte:14, expiry:'2026-04-17' } },
  ],
  BEAR_CALL: [
    { symbol:'UVXY', score:82, grade:'A', trend:'bearish', ivRank:82, tier:'etf',
      setup:{ shortCall:58, longCall:62, credit:1.15, creditDollars:115, maxLoss:285, rr:0.40, wallAbove:65, wallDist:25.2, dte:14, expiry:'2026-04-17' } },
    { symbol:'COIN', score:68, grade:'B', trend:'neutral', ivRank:58, tier:'large',
      setup:{ shortCall:185, longCall:200, credit:1.55, creditDollars:155, maxLoss:1345, rr:0.12, wallAbove:200, wallDist:16.5, dte:14, expiry:'2026-04-17' } },
    { symbol:'RIOT', score:64, grade:'B', trend:'bearish', ivRank:62, tier:'mid',
      setup:{ shortCall:14, longCall:16, credit:0.72, creditDollars:72, maxLoss:128, rr:0.56, wallAbove:16, wallDist:25.2, dte:42, expiry:'2026-05-15' } },
    { symbol:'MARA', score:60, grade:'C', trend:'neutral', ivRank:68, tier:'mid',
      setup:{ shortCall:10, longCall:12, credit:0.68, creditDollars:68, maxLoss:132, rr:0.52, wallAbove:13, wallDist:58.7, dte:42, expiry:'2026-05-15' } },
  ],
  BULL_CALL: [
    { symbol:'COST', score:72, grade:'B', trend:'bullish', ivRank:22, tier:'mega',
      setup:{ buyCall:1010, sellCall:1060, debit:12.70, debitDollars:1270, maxProfit:3730, dte:42, expiry:'2026-05-15' } },
    { symbol:'MSFT', score:70, grade:'B', trend:'bullish', ivRank:32, tier:'mega',
      setup:{ buyCall:357, sellCall:390, debit:8.45, debitDollars:845, maxProfit:2455, dte:42, expiry:'2026-05-15' } },
    { symbol:'QQQ',  score:62, grade:'B', trend:'bullish', ivRank:40, tier:'etf',
      setup:{ buyCall:435, sellCall:455, debit:4.18, debitDollars:418, maxProfit:1582, dte:14, expiry:'2026-04-17' } },
  ],
  BEAR_PUT: [
    { symbol:'RIOT', score:64, grade:'B', trend:'bearish', ivRank:62, tier:'mid',
      setup:{ buyPut:13, sellPut:10, debit:1.07, debitDollars:107, maxProfit:193, dte:42, expiry:'2026-05-15' } },
    { symbol:'UVXY', score:60, grade:'C', trend:'bearish', ivRank:82, tier:'etf',
      setup:{ buyPut:50, sellPut:43, debit:3.80, debitDollars:380, maxProfit:320, dte:14, expiry:'2026-04-17' } },
  ],
  CALENDAR: [
    { symbol:'AAPL', score:72, grade:'B', trend:'neutral', ivRank:38, tier:'mega',
      setup:{ strike:195, sellFront:'2026-04-17', buyBack:'2026-05-15', frontIV:'42.0', backIV:'32.0', slope:10.0, event:'2026-04-29' } },
    { symbol:'SCHW', score:65, grade:'B', trend:'bullish', ivRank:42, tier:'large',
      setup:{ strike:78, sellFront:'2026-04-17', buyBack:'2026-05-15', frontIV:'42.0', backIV:'36.0', slope:6.0, event:'2026-04-22' } },
    { symbol:'SPY',  score:62, grade:'B', trend:'neutral', ivRank:44, tier:'etf',
      setup:{ strike:512, sellFront:'2026-04-17', buyBack:'2026-05-15', frontIV:'30.0', backIV:'25.0', slope:5.0, event:null } },
  ],
};

// Total count summary (for hub index page tile animation)
const MOCK_COUNTS = {
  CSP:         MOCK_STRATEGY_RESULTS.CSP.length,
  WHEEL:       MOCK_STRATEGY_RESULTS.WHEEL.length,
  IRON_CONDOR: MOCK_STRATEGY_RESULTS.IRON_CONDOR.length,
  BULL_PUT:    MOCK_STRATEGY_RESULTS.BULL_PUT.length,
  BEAR_CALL:   MOCK_STRATEGY_RESULTS.BEAR_CALL.length,
  BULL_CALL:   MOCK_STRATEGY_RESULTS.BULL_CALL.length,
  BEAR_PUT:    MOCK_STRATEGY_RESULTS.BEAR_PUT.length,
  CALENDAR:    MOCK_STRATEGY_RESULTS.CALENDAR.length,
  total:       Object.values(MOCK_STRATEGY_RESULTS).reduce((s,a)=>s+a.length,0),
  avgIVR:      Math.round(MOCK_REPORTS.reduce((s,r)=>s+r.gammaData.ivData.ivRank,0)/MOCK_REPORTS.length),
  avgPutYield: 2.1,
  lastScan:    new Date().toISOString().slice(0,10),
};

if (typeof module !== 'undefined') {
  module.exports = { MOCK_REPORTS, MOCK_MANIFEST, MOCK_STRATEGY_RESULTS, MOCK_COUNTS };
} else {
  window.MOCK_REPORTS = MOCK_REPORTS;
  window.MOCK_MANIFEST = MOCK_MANIFEST;
  window.MOCK_STRATEGY_RESULTS = MOCK_STRATEGY_RESULTS;
  window.MOCK_COUNTS = MOCK_COUNTS;
}
