/**
 * strategy-engine.js — Shared Strategy Decision Engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for strategy recommendations. Used by:
 *   - pipeline/newleaf-pipeline.js  (scanner — batch processing)
 *   - api/src/routes/ai.ts          (discover — interactive recommendations)
 *
 * Exports pure functions with no I/O, no filesystem, no API calls.
 * All data must be passed in; the engine only computes and decides.
 *
 * IMPORTANT: Blend weights (0.40/0.35/0.15/0.10) and scoring pillars (40/35/25)
 * are intuition-based, NOT outcome-validated. No accuracy claims until tuned
 * against real pick_outcomes data.
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

// ── Technical Helpers ────────────────────────────────────────────────────────

const calcSMA = (prices, n) => prices.length < n ? null : prices.slice(-n).reduce((a, b) => a + b, 0) / n;

function calcBB(prices, n = 20, k = 2) {
  if (prices.length < n) return null;
  const sl = prices.slice(-n), sma = sl.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(sl.map(p => (p - sma) ** 2).reduce((a, b) => a + b, 0) / n);
  return { upper: sma + k * sd, middle: sma, lower: sma - k * sd, width: (k * sd * 2 / sma) * 100 };
}

function calcRSI(prices, n = 14) {
  if (prices.length < n + 1) return null;
  const sl = prices.slice(-(n + 1)), diffs = sl.slice(1).map((p, i) => p - sl[i]);
  const avgG = diffs.filter(d => d > 0).reduce((a, b) => a + b, 0) / n;
  const avgL = diffs.filter(d => d < 0).map(Math.abs).reduce((a, b) => a + b, 0) / n;
  return avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL);
}

function calcADX(bars, period = 14) {
  if (bars.length < period * 2 + 1) return null;
  const plusDM = [], minusDM = [], tr = [];
  for (let i = 1; i < bars.length; i++) {
    const h = bars[i].h, l = bars[i].l, pc = bars[i - 1].c;
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
    const upMove = h - bars[i - 1].h, downMove = bars[i - 1].l - l;
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }
  const smooth = (arr, p) => {
    let val = arr.slice(0, p).reduce((a, b) => a + b, 0) / p;
    for (let i = p; i < arr.length; i++) val = (val * (p - 1) + arr[i]) / p;
    return val;
  };
  const atr = smooth(tr, period);
  if (atr === 0) return null;
  const pdi = (smooth(plusDM, period) / atr) * 100;
  const mdi = (smooth(minusDM, period) / atr) * 100;
  const dxSum = pdi + mdi;
  if (dxSum === 0) return null;
  return +((Math.abs(pdi - mdi) / dxSum) * 100).toFixed(1);
}

function calcRealizedVol(closes) {
  if (!closes || closes.length < 30) return null;
  const recent = closes.slice(-30);
  const returns = recent.slice(1).map((p, i) => Math.log(p / recent[i]));
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
  return Math.sqrt(variance * 252);
}

function calcATRPct(closes, price) {
  if (!closes || closes.length < 15) return 0.02;
  const ranges = closes.slice(-14).map((p, i, arr) =>
    i === 0 ? 0 : Math.abs(arr[i] - arr[i - 1]) / arr[i - 1]
  );
  return ranges.slice(1).reduce((a, b) => a + b, 0) / 13;
}

// ── Technical Analysis ───────────────────────────────────────────────────────

function analyzeTechnicals(bars, spot) {
  const closes = bars.map(b => b.c), rsi = calcRSI(closes), bb = calcBB(closes);
  const sma50 = calcSMA(closes, 50), sma100 = calcSMA(closes, 100), sma200 = calcSMA(closes, 200), recent = closes.slice(-20);
  let rsiState = 'Neutral';
  if (rsi !== null) { if (rsi < 20) rsiState = 'Oversold'; else if (rsi < 30) rsiState = 'Near Oversold'; else if (rsi > 80) rsiState = 'Overbought'; else if (rsi > 70) rsiState = 'Near Overbought'; }
  let trendScore = 0.5;
  if (sma50 && sma100) { if (spot > sma50 && sma50 > sma100) trendScore = 0.8; else if (spot < sma50 && sma50 < sma100) trendScore = 0.2; }
  else if (sma50) trendScore = spot > sma50 ? 0.65 : 0.35;
  const trendState = trendScore > 0.6 ? 'Bullish' : trendScore < 0.4 ? 'Bearish' : 'Neutral';
  const bbW = bb?.width ?? 0, volState = bbW < 5 ? 'Squeeze' : bbW > 20 ? 'High Volatility' : bbW > 12 ? 'High' : 'Normal';
  const bbSeries = []; for (let i = 19; i < bars.length; i++) { const v = calcBB(bars.slice(i - 19, i + 1).map(b => b.c)); if (v) bbSeries.push({ t: bars[i].t, upper: v.upper, middle: v.middle, lower: v.lower }); }
  const rsiSeries = []; for (let i = 14; i < bars.length; i++) { const v = calcRSI(bars.slice(i - 14, i + 1).map(b => b.c)); if (v !== null) rsiSeries.push({ t: bars[i].t, rsi: v }); }

  const aboveSMA50 = sma50 ? spot > sma50 : null;
  const aboveSMA100 = sma100 ? spot > sma100 : null;
  const aboveSMA200 = sma200 ? spot > sma200 : null;
  const realizedVol30d = calcRealizedVol(closes);
  const atrPct = calcATRPct(closes, spot);

  // Enriched trend outputs
  const trendDirection = trendScore > 0.6 ? 'bullish' : trendScore < 0.4 ? 'bearish' : 'neutral';
  const adx14 = calcADX(bars);
  const trendStrength = adx14 === null ? 'moderate'
    : adx14 > 30 ? 'strong'
    : adx14 >= 20 ? 'moderate'
    : 'weak';
  const volatilityRegime = bbW < 5 ? 'squeeze' : bbW > 15 ? 'expansion' : 'normal';
  const momentumFlag = (rsi !== null && rsi > 75) ? 'overbought'
    : (rsi !== null && rsi < 25) ? 'oversold' : null;

  return {
    rsi, sma50, sma100, sma200, bb, adx14, avgScore: trendScore,
    rsiEngine: { state: rsiState }, trendEngine: { state: trendState, score: trendScore, direction: trendDirection, strength: trendStrength },
    volatilityEngine: { state: volState, squeeze: bbW < 5, regime: volatilityRegime },
    momentumFlag,
    sr: { support1: Math.min(...recent), resistance1: Math.max(...closes) },
    priceHistory: bars, bbSeries, rsiSeries,
    aboveSMA50, aboveSMA100, aboveSMA200, realizedVol30d, atrPct
  };
}

// ── Scoring ──────────────────────────────────────────────────────────────────

function calcScore(gammaData, technicalData) {
  const { confidence_score, band_width_pct: bw = 30 } = gammaData.analysis;
  const cs = confidence_score ?? 0;
  const hasGex = (gammaData.analysis.topStrikes || []).some(s => Math.abs(s.gamma_exposure) > 0);
  const hasOI = (gammaData.analysis.topStrikes || []).some(s => (s.call_oi + s.put_oi) > 0);
  let gammaPillar;
  if (hasGex) { const wallQ = Math.min(1, cs * 1.5), bandQ = bw >= 3 && bw <= 15 ? 1 : bw < 3 ? bw / 3 : Math.max(0, 1 - (bw - 15) / 15); gammaPillar = Math.round((wallQ * 0.6 + bandQ * 0.4) * 40); }
  else if (hasOI) { const bandQ = bw >= 3 && bw <= 15 ? 1 : bw < 3 ? bw / 3 : Math.max(0, 1 - (bw - 15) / 15); gammaPillar = Math.round(bandQ * 28); }
  else { const rsi = technicalData.rsi ?? 50, bbW = technicalData.bb?.width ?? 15; const rsiScore = rsi > 20 && rsi < 80 ? 1 - Math.abs(rsi - 50) / 50 : 0.2, bbScore = bbW >= 3 && bbW <= 15 ? 1 : bbW < 3 ? bbW / 3 : Math.max(0, 1 - (bbW - 15) / 15); gammaPillar = Math.round((rsiScore * 0.5 + bbScore * 0.5) * 22); }
  const iv = gammaData.ivData?.atmIv, ivScore = iv ? (iv > 20 && iv < 50 ? 1 : iv < 20 ? iv / 20 : Math.max(0, 1 - (iv - 50) / 50)) : 0.6;
  const ivPillar = Math.round(ivScore * 35);
  // ADX-aware trend pillar: direction conviction × strength multiplier
  const ts = technicalData.trendEngine?.score ?? 0.5;
  const strength = technicalData.trendEngine?.strength ?? 'moderate';
  const dirConviction = Math.abs(ts - 0.5);
  const strengthMult = strength === 'strong' ? 1.0 : strength === 'moderate' ? 0.7 : 0.3;
  const trendPillar = Math.round((0.5 + dirConviction * strengthMult) * 25);
  return { total: gammaPillar + ivPillar + trendPillar, pillars: { gamma: gammaPillar, iv: ivPillar, trend: trendPillar }, hasOptions: hasGex || hasOI };
}

function getDirection(gammaData, technicalData) {
  const ts = technicalData.trendEngine?.score ?? 0.5, cs = gammaData.analysis.confidence_score ?? 0;
  const strength = technicalData.trendEngine?.strength ?? 'moderate';
  if (ts > 0.65 && cs > 0.4 && strength !== 'weak') return 'bullish';
  if (ts < 0.35 && cs > 0.4 && strength !== 'weak') return 'bearish';
  return 'neutral';
}

// ── Strategies ───────────────────────────────────────────────────────────────

const STRATEGIES = {
  iron_condor:            { name: 'Iron Condor',            code: 'iron_condor',            icon: '🦅', reasons: ['Strong gamma walls identified', 'Optimal band width for premium', 'Neutral regime confirmed', 'Sell both sides for income'] },
  iron_butterfly:         { name: 'Iron Butterfly',         code: 'iron_butterfly',         icon: '🦋', reasons: ['Gamma band exists but narrow', 'Tighter profit zone, higher premium', 'Lower risk than condor', 'Benefits from low volatility'] },
  bull_put_spread:        { name: 'Bull Put Spread',        code: 'bull_put_spread',        icon: '📈', reasons: ['Bullish trend confirmed', 'Put wall provides strong support', 'Collect premium with defined risk', 'Theta decay works in your favour'] },
  bear_call_spread:       { name: 'Bear Call Spread',       code: 'bear_call_spread',       icon: '📉', reasons: ['Bearish trend identified', 'Call wall acts as resistance', 'Defined risk, defined reward', 'Premium income in downtrend'] },
  broken_wing_butterfly:  { name: 'Broken Wing Butterfly',  code: 'broken_wing_butterfly',  icon: '🦗', reasons: ['Gamma wall provides dealer floor/ceiling', 'Credit entry — zero risk on one side', 'Wider band favours asymmetric structure', 'IV supports sufficient credit collection'] },
  calendar_spread:        { name: 'Calendar Spread',        code: 'calendar_spread',        icon: '📅', reasons: ['IV below historical norms — vol is cheap to buy', 'Neutral trend favours non-directional structure', 'Buy back-month vol, sell front-month for theta offset', 'Low vol historically mean-reverts — vega-long captures snap-back'] },
  diagonal_spread:        { name: 'Diagonal Spread',        code: 'diagonal_spread',        icon: '📐', reasons: ['Mild directional lean but weak trend strength (ADX<20)', 'Moderate IV supports front-month premium collection', 'Combines vega-long with slight directional tilt', 'Lower risk than pure directional spread in weak-trend regime'] },
};

// ── BWB Strike Selection ─────────────────────────────────────────────────────

function roundToStrike(price, basePrice) {
  if (basePrice < 50) return Math.round(price);
  if (basePrice < 200) return Math.round(price / 2.5) * 2.5;
  return Math.round(price / 5) * 5;
}

function calculateBWBStrikes(data, direction = 'put') {
  const price = data.snapshot?.price || data.price || 0;
  const pw = data.gammaData?.analysis?.put_wall || price * 0.93;
  const cw = data.gammaData?.analysis?.call_wall || price * 1.07;

  if (direction === 'put') {
    const body = roundToStrike(pw, price);
    const upperWing = roundToStrike(body + (price - body) * 0.6, price);
    const upperWidth = upperWing - body;
    const lowerWing = roundToStrike(body - (upperWidth * 1.7), price);
    return {
      direction: 'put', subtype: 'put_bwb',
      longPutUpper: upperWing, shortPut: body, longPutLower: lowerWing,
      upperWidth, lowerWidth: body - lowerWing,
      maxProfitZone: `$${body}`, zeroRiskAbove: `$${upperWing}`, maxLossBelow: `$${lowerWing}`,
      notes: `Body at $${body} gamma wall. Zero risk above $${upperWing}. Wider lower wing collects credit.`
    };
  }

  if (direction === 'call') {
    const body = roundToStrike(cw, price);
    const lowerWing = roundToStrike(body - (body - price) * 0.6, price);
    const lowerWidth = body - lowerWing;
    const upperWing = roundToStrike(body + (lowerWidth * 1.7), price);
    return {
      direction: 'call', subtype: 'call_bwb',
      longCallLower: lowerWing, shortCall: body, longCallUpper: upperWing,
      lowerWidth, upperWidth: upperWing - body,
      maxProfitZone: `$${body}`, zeroRiskBelow: `$${lowerWing}`, maxLossAbove: `$${upperWing}`,
      notes: `Body at $${body} gamma wall. Zero risk below $${lowerWing}. Wider upper wing collects credit.`
    };
  }
  return null;
}

function scoreBWB(gammaData, bwbStrikes, price) {
  let bonus = 0;
  const { confidence_score, put_wall, call_wall } = gammaData.analysis;
  const atmIv = gammaData.ivData?.atmIv || 0;
  if (confidence_score > 0.6) bonus += 5;
  const bodyAtWall = bwbStrikes.direction === 'put'
    ? Math.abs(bwbStrikes.shortPut - put_wall) <= 2.5
    : Math.abs((bwbStrikes.shortCall || 0) - call_wall) <= 2.5;
  if (bodyAtWall) bonus += 5;
  if (atmIv >= 30 && atmIv <= 50) bonus += 5;
  if (bwbStrikes.direction === 'put' && price > 0) {
    const bufferPct = (price - bwbStrikes.longPutUpper) / price;
    if (bufferPct > 0.03) bonus += 3;
  }
  if (atmIv > 60) bonus -= 5;
  return Math.max(0, bonus);
}

// ── Premium-adequacy penalty ──────────────────────────────────────────────────
// Structures that PROFIT by selling premium (credit) are down-scored when the
// premium is thin — i.e. implied vol sits BELOW 30-day realized vol (IV/RV < 1),
// meaning you're being paid too little for the risk. Heuristic, not outcome-
// validated (consistent with the rest of the engine's scoring). atmIv is in
// percentage form (e.g. 53.5), realizedVol30d is a decimal (e.g. 0.66).
const CREDIT_STRATEGY_CODES = new Set([
  'iron_condor', 'iron_butterfly', 'broken_wing_butterfly',
  'bull_put_spread', 'bear_call_spread', 'short_strangle', 'short_straddle',
]);

function premiumRiskPenalty(strategyCode, gammaData, technicalData) {
  if (!CREDIT_STRATEGY_CODES.has(strategyCode)) return { penalty: 0, reasons: [] };
  const atmIv = gammaData?.ivData?.atmIv || 0; // percentage form
  const rv = technicalData?.realizedVol30d ? technicalData.realizedVol30d * 100 : null;
  const ivRvRatio = (rv && rv > 0 && atmIv > 0) ? atmIv / rv : null;
  if (ivRvRatio === null || ivRvRatio >= 1.0) return { penalty: 0, reasons: [] };
  // Thinner premium → larger penalty, capped at -20.
  const penalty = -Math.min(20, Math.round((1.0 - ivRvRatio) * 50));
  return { penalty, reasons: [`thin premium: IV/RV ${ivRvRatio.toFixed(2)} < 1.0 for a credit structure`] };
}

// ── Strategy Selection ───────────────────────────────────────────────────────

function selectStrategy(gammaData, direction, snapshotPrice, technicalData) {
  // 1. Iron Condor: strong walls, optimal band (3-15%)
  if (gammaData.condorGate.condorAllowed) return STRATEGIES.iron_condor;

  // 2. Broken Wing Butterfly: wider band (>15%) OR moderate confidence + strong single wall
  const bw = gammaData.analysis.band_width_pct || 0;
  const conf = gammaData.analysis.confidence_score || 0;
  const atmIv = gammaData.ivData?.atmIv || 0;
  const bwbEligible = (
    (bw > 15 && bw <= 40 && conf >= 0.15) ||
    (bw > 10 && bw <= 35 && conf >= 0.30 && atmIv >= 25)
  );

  if (bwbEligible) {
    const bwbDir = (direction === 'bearish') ? 'call' : 'put';
    const bwbStrikes = calculateBWBStrikes(
      { snapshot: { price: snapshotPrice }, gammaData },
      bwbDir
    );
    const bwbBonus = scoreBWB(gammaData, bwbStrikes, snapshotPrice);

    if (bwbBonus >= 0) {
      const strat = { ...STRATEGIES.broken_wing_butterfly };
      strat.subtype = bwbStrikes.subtype;
      strat.strikes = bwbStrikes;
      strat.bwbBonus = bwbBonus;
      strat.characteristics = {
        entryType: 'credit',
        zeroRiskSide: bwbDir === 'put' ? 'above' : 'below',
        maxLossSide: bwbDir === 'put' ? 'below' : 'above',
        dteIdeal: '21-35',
        riskProfile: `low — only at risk on severe ${bwbDir === 'put' ? 'downside' : 'upside'}`
      };
      strat.reasons = [
        `Strong ${bwbDir} gamma wall at $${bwbDir === 'put' ? gammaData.analysis.put_wall : gammaData.analysis.call_wall} acts as dealer ${bwbDir === 'put' ? 'floor' : 'ceiling'}`,
        `Credit entry — zero risk if stock stays ${bwbDir === 'put' ? 'above' : 'below'} $${bwbDir === 'put' ? bwbStrikes.zeroRiskAbove : bwbStrikes.zeroRiskBelow}`.replace(/\$/g, ''),
        `IV at ${atmIv > 1 ? Math.round(atmIv) : Math.round(atmIv * 100)}% provides sufficient premium for asymmetric credit`,
        `Band width ${bw.toFixed(1)}% — too wide for Iron Condor, BWB preferred`
      ];
      return strat;
    }
  }

  // 3. Directional spreads
  if (direction === 'bullish') return STRATEGIES.bull_put_spread;
  if (direction === 'bearish') return STRATEGIES.bear_call_spread;

  // 4. Calendar spread: neutral trend + cheap vol (vega-long — buy vol below realized)
  const rv = technicalData?.realizedVol30d ? technicalData.realizedVol30d * 100 : null;
  const ivRvRatio = (rv && rv > 0 && atmIv > 0) ? atmIv / rv : null;
  if (direction === 'neutral' && atmIv > 0 && atmIv < 25 && ivRvRatio !== null && ivRvRatio < 1.0) {
    return STRATEGIES.calendar_spread;
  }

  // 5. Diagonal spread: DEFERRED — needs ADX 15-25 + IV/RV < 1.0

  // 6. Fallback — iron butterfly is CORRECT for range-bound / moderate-confidence /
  //    no-vol-edge / no-trend regimes. Not a routing failure.
  return STRATEGIES.iron_butterfly;
}

// ── Direction Reconciliation ─────────────────────────────────────────────────
// Display direction must match the strategy's nature.
// A condor/butterfly/calendar is neutral regardless of what the trend says —
// the condor gate fires before the directional check.
const NEUTRAL_STRATEGIES = new Set(['iron_condor', 'iron_butterfly', 'calendar_spread']);

function reconcileDirection(rawDirection, strategyCode) {
  return NEUTRAL_STRATEGIES.has(strategyCode) ? 'neutral' : rawDirection;
}

// ── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  // Technical analysis
  calcSMA, calcBB, calcRSI, calcADX, calcRealizedVol, calcATRPct,
  analyzeTechnicals,
  // Scoring & strategy
  calcScore, getDirection, selectStrategy, reconcileDirection,
  STRATEGIES,
  // BWB helpers (used by pipeline report assembly)
  roundToStrike, calculateBWBStrikes, scoreBWB,
  // Premium-adequacy penalty (thin IV/RV for credit structures)
  premiumRiskPenalty,
};
