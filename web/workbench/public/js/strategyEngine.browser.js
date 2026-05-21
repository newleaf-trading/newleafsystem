/**
 * strategyEngine.browser.js
 * Browser version - 8-strategy scoring engine
 */
(function(window) {
'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// WHEEL STRATEGY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Score WHEEL strategy
 *
 * Criteria:
 * - Quality stocks only (70+)
 * - High IV (25%+)
 * - Positive IV-RV spread (5%+)
 * - Avoid earnings (30d+)
 * - Good liquidity (OI 100+)
 *
 * @param {Object} input - Adapted stock data
 * @returns {Object} - {eligible, score, reason, setup}
 */
function scoreWheel(input) {
  const reasons = [];
  let score = 0;

  // ── Eligibility Gates ──
  if (!input.put25) {
    return { eligible: false, score: 0, reason: 'No 25Δ put available', setup: null };
  }

  if (input.quality < 70) {
    return { eligible: false, score: 0, reason: 'Quality too low for assignment', setup: null };
  }

  if (input.atmIv < 0.25) {
    return { eligible: false, score: 0, reason: 'IV too low (<25%)', setup: null };
  }

  if (input.daysToEarnings !== null && input.daysToEarnings < 30) {
    return { eligible: false, score: 0, reason: `Earnings in ${input.daysToEarnings}d`, setup: null };
  }

  // ── Scoring Pillars ──

  // Quality (0-30 pts)
  const qualityScore = Math.min(30, (input.quality - 70) / 25 * 30);
  score += qualityScore;
  reasons.push(`Quality: ${input.quality} → ${qualityScore.toFixed(0)}pts`);

  // IV Rank (0-25 pts)
  // Use atmIv as proxy if ivRank not available
  const ivRankProxy = input.ivRank !== undefined ? input.ivRank : Math.min(100, input.atmIv * 100);
  const ivScore = Math.min(25, ivRankProxy / 4);
  score += ivScore;
  reasons.push(`IV: ${ivRankProxy.toFixed(0)} → ${ivScore.toFixed(0)}pts`);

  // IV-RV Spread (0-20 pts)
  const spreadScore = Math.max(0, Math.min(20, (input.ivRVSpread - 0.05) * 200));
  score += spreadScore;
  reasons.push(`IV-RV spread: ${(input.ivRVSpread * 100).toFixed(1)}% → ${spreadScore.toFixed(0)}pts`);

  // Premium Yield (0-15 pts)
  const premium = input.put25.mid || 0;
  const yield_ = (premium / input.price) * 100;
  const yieldScore = Math.min(15, yield_ * 3);
  score += yieldScore;
  reasons.push(`Yield: ${yield_.toFixed(1)}% → ${yieldScore.toFixed(0)}pts`);

  // Liquidity (0-10 pts)
  const liquidityScore = Math.min(10, (input.avgOI / 1000) * 10);
  score += liquidityScore;
  reasons.push(`Liquidity: ${Math.round(input.avgOI)} OI → ${liquidityScore.toFixed(0)}pts`);

  // ── Setup ──
  const setup = {
    action: 'SELL PUT',
    strike: input.put25.strike,
    expiry: input.put25.expiry,
    dte: input.put25.dte,
    premium: premium,
    yield: yield_,
    assignmentPrice: input.put25.strike,
    maxLoss: input.put25.strike - premium,
    breakeven: input.put25.strike - premium,
    probabilityOTM: Math.abs(input.put25.delta) < 1 ? (1 - Math.abs(input.put25.delta)) * 100 : null
  };

  return {
    eligible: true,
    score: Math.round(score),
    reason: reasons.join(' | '),
    setup
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CSP (Cash-Secured Put) STRATEGY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Score CSP strategy
 *
 * Similar to WHEEL but no quality requirement (willing to take assignment on any stock)
 *
 * @param {Object} input - Adapted stock data
 * @returns {Object} - {eligible, score, reason, setup}
 */
function scoreCSP(input) {
  const reasons = [];
  let score = 0;

  // ── Eligibility Gates ──
  if (!input.put25) {
    return { eligible: false, score: 0, reason: 'No 25Δ put available', setup: null };
  }

  if (input.atmIv < 0.20) {
    return { eligible: false, score: 0, reason: 'IV too low (<20%)', setup: null };
  }

  // ── Scoring Pillars ──

  // IV Rank (0-30 pts) — higher weight than WHEEL
  const ivRankProxy = input.ivRank !== undefined ? input.ivRank : Math.min(100, input.atmIv * 100);
  const ivScore = Math.min(30, ivRankProxy / 3.33);
  score += ivScore;
  reasons.push(`IV: ${ivRankProxy.toFixed(0)} → ${ivScore.toFixed(0)}pts`);

  // IV-RV Spread (0-25 pts)
  const spreadScore = Math.max(0, Math.min(25, (input.ivRVSpread - 0.03) * 250));
  score += spreadScore;
  reasons.push(`IV-RV spread: ${(input.ivRVSpread * 100).toFixed(1)}% → ${spreadScore.toFixed(0)}pts`);

  // Premium Yield (0-20 pts)
  const premium = input.put25.mid || 0;
  const yield_ = (premium / input.price) * 100;
  const yieldScore = Math.min(20, yield_ * 4);
  score += yieldScore;
  reasons.push(`Yield: ${yield_.toFixed(1)}% → ${yieldScore.toFixed(0)}pts`);

  // Quality bonus (0-15 pts) — bonus for high quality, not required
  const qualityBonus = Math.max(0, (input.quality - 50) / 45 * 15);
  score += qualityBonus;
  reasons.push(`Quality: ${input.quality} → ${qualityBonus.toFixed(0)}pts`);

  // Liquidity (0-10 pts)
  const liquidityScore = Math.min(10, (input.avgOI / 1000) * 10);
  score += liquidityScore;
  reasons.push(`Liquidity: ${Math.round(input.avgOI)} OI → ${liquidityScore.toFixed(0)}pts`);

  // ── Setup ──
  const setup = {
    action: 'SELL PUT',
    strike: input.put25.strike,
    expiry: input.put25.expiry,
    dte: input.put25.dte,
    premium: premium,
    yield: yield_,
    maxLoss: input.put25.strike - premium,
    breakeven: input.put25.strike - premium,
    probabilityOTM: Math.abs(input.put25.delta) < 1 ? (1 - Math.abs(input.put25.delta)) * 100 : null
  };

  return {
    eligible: true,
    score: Math.round(score),
    reason: reasons.join(' | '),
    setup
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// IRON CONDOR STRATEGY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Score IRON CONDOR strategy
 *
 * Criteria:
 * - Neutral trend
 * - Condor allowed by gamma wall system
 * - High IV (30%+)
 * - Positive IV-RV spread (8%+)
 * - Both put/call 25Δ available
 *
 * @param {Object} input - Adapted stock data
 * @returns {Object} - {eligible, score, reason, setup}
 */
function scoreIronCondor(input) {
  const reasons = [];
  let score = 0;

  // ── Eligibility Gates ──
  if (!input.put25 || !input.call25) {
    return { eligible: false, score: 0, reason: 'Missing 25Δ contracts', setup: null };
  }

  if (!input.condorAllowed) {
    return { eligible: false, score: 0, reason: 'Condor not allowed by gamma wall system', setup: null };
  }

  if (input.trend !== 'neutral') {
    return { eligible: false, score: 0, reason: `Trend is ${input.trend}, need neutral`, setup: null };
  }

  if (input.atmIv < 0.30) {
    return { eligible: false, score: 0, reason: 'IV too low (<30%)', setup: null };
  }

  if (input.ivRVSpread < 0.08) {
    return { eligible: false, score: 0, reason: 'IV-RV spread too low (<8%)', setup: null };
  }

  // ── Scoring Pillars ──

  // IV Rank (0-35 pts)
  const ivRankProxy = input.ivRank !== undefined ? input.ivRank : Math.min(100, input.atmIv * 100);
  const ivScore = Math.min(35, ivRankProxy / 2.86);
  score += ivScore;
  reasons.push(`IV: ${ivRankProxy.toFixed(0)} → ${ivScore.toFixed(0)}pts`);

  // IV-RV Spread (0-25 pts)
  const spreadScore = Math.min(25, (input.ivRVSpread - 0.08) * 200);
  score += spreadScore;
  reasons.push(`IV-RV spread: ${(input.ivRVSpread * 100).toFixed(1)}% → ${spreadScore.toFixed(0)}pts`);

  // Range-bound score (0-20 pts) — lower ATR = tighter range
  const rangeScore = Math.max(0, 20 - (input.atrPct * 1000));
  score += rangeScore;
  reasons.push(`Range: ATR ${(input.atrPct * 100).toFixed(2)}% → ${rangeScore.toFixed(0)}pts`);

  // Credit (0-15 pts)
  const putCredit = input.put25.mid || 0;
  const callCredit = input.call25.mid || 0;
  const totalCredit = putCredit + callCredit;
  const creditPct = (totalCredit / input.price) * 100;
  const creditScore = Math.min(15, creditPct * 2);
  score += creditScore;
  reasons.push(`Credit: ${creditPct.toFixed(1)}% → ${creditScore.toFixed(0)}pts`);

  // Liquidity (0-5 pts)
  const liquidityScore = Math.min(5, (input.avgOI / 1000) * 5);
  score += liquidityScore;

  // ── Setup ──
  const putWidth = Math.max(1, input.put25.strike * 0.05); // 5% wing width
  const callWidth = Math.max(1, input.call25.strike * 0.05);

  const setup = {
    action: 'IRON CONDOR',
    putSpread: {
      sellStrike: input.put25.strike,
      buyStrike: input.put25.strike - putWidth,
      credit: putCredit
    },
    callSpread: {
      sellStrike: input.call25.strike,
      buyStrike: input.call25.strike + callWidth,
      credit: callCredit
    },
    expiry: input.put25.expiry,
    dte: input.put25.dte,
    totalCredit: totalCredit,
    maxLoss: Math.max(putWidth, callWidth) - totalCredit,
    probabilityProfit: (1 - Math.abs(input.put25.delta) - Math.abs(input.call25.delta)) * 100
  };

  return {
    eligible: true,
    score: Math.round(score),
    reason: reasons.join(' | '),
    setup
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// BROKEN WING BUTTERFLY STRATEGY
// ═══════════════════════════════════════════════════════════════════════════
function scoreBrokenWing(input) {
  const reasons = [];
  let score = 0;

  // Eligibility: need options data and wider band
  if (!input.put25) {
    return { eligible: false, score: 0, reason: 'Missing option contracts', setup: null };
  }

  const bandWidth = input.bandWidthPct || 0;
  const confidence = input.gammaConfidence || 0;

  // BWB needs wider band (>10%) — where condors don't work well
  if (bandWidth < 10) {
    return { eligible: false, score: 0, reason: `Band too narrow (${bandWidth.toFixed(1)}%)`, setup: null };
  }

  // Need at least some gamma wall signal
  if (confidence < 0.1) {
    return { eligible: false, score: 0, reason: 'Insufficient gamma wall confidence', setup: null };
  }

  // IV needs to be sufficient for credit
  if (input.atmIv < 0.20) {
    return { eligible: false, score: 0, reason: 'IV too low for BWB credit (<20%)', setup: null };
  }

  // ── Scoring ──

  // Band width bonus (wider = better for BWB, 0-25 pts)
  const bwScore = Math.min(25, (bandWidth - 10) * 2.5);
  score += bwScore;
  reasons.push(`Band: ${bandWidth.toFixed(1)}% → ${bwScore.toFixed(0)}pts`);

  // IV (0-30 pts) — sweet spot 25-50%
  const ivPct = input.atmIv * 100;
  const ivScore = ivPct >= 25 && ivPct <= 50 ? 30 : Math.min(30, ivPct * 0.6);
  score += ivScore;
  reasons.push(`IV: ${ivPct.toFixed(0)}% → ${ivScore.toFixed(0)}pts`);

  // Gamma wall confidence (0-20 pts)
  const confScore = Math.min(20, confidence * 30);
  score += confScore;
  reasons.push(`Wall conf: ${(confidence * 100).toFixed(0)}% → ${confScore.toFixed(0)}pts`);

  // Liquidity (0-10 pts)
  const liqScore = Math.min(10, (input.avgOI || 0) / 500);
  score += liqScore;

  // Credit potential (0-15 pts)
  const putMid = input.put25?.mid || 0;
  const creditPct = (putMid / input.price) * 100;
  const creditScore = Math.min(15, creditPct * 3);
  score += creditScore;

  // ── Setup: Put BWB (default, most common) ──
  const bodyStrike = input.putWall || (input.price * 0.93);
  const upperWing = input.price; // near ATM
  const upperWidth = upperWing - bodyStrike;
  const lowerWing = bodyStrike - (upperWidth * 1.7);

  const setup = {
    action: 'BROKEN WING BUTTERFLY (Put)',
    direction: 'put',
    upperWing: Math.round(upperWing * 2) / 2,
    body: Math.round(bodyStrike * 2) / 2,
    lowerWing: Math.round(lowerWing * 2) / 2,
    entryType: 'credit',
    zeroRiskAbove: Math.round(upperWing * 2) / 2,
    maxLossBelow: Math.round(lowerWing * 2) / 2,
    expiry: input.put25?.expiry,
    dte: input.put25?.dte,
    riskProfile: 'Zero risk if stock stays above upper wing'
  };

  return {
    eligible: true,
    score: Math.round(score),
    reason: reasons.join(' | '),
    setup
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// BULL PUT SPREAD STRATEGY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Score BULL PUT SPREAD strategy
 *
 * Criteria:
 * - Bullish trend
 * - Above SMA50
 * - High IV (25%+)
 * - Strike below put wall (if available)
 *
 * @param {Object} input - Adapted stock data
 * @returns {Object} - {eligible, score, reason, setup}
 */
function scoreBullPut(input) {
  const reasons = [];
  let score = 0;

  // ── Eligibility Gates ──
  if (!input.put25 || !input.put15) {
    return { eligible: false, score: 0, reason: 'Missing put contracts', setup: null };
  }

  if (input.trend !== 'bullish') {
    return { eligible: false, score: 0, reason: `Trend is ${input.trend}, need bullish`, setup: null };
  }

  if (input.atmIv < 0.25) {
    return { eligible: false, score: 0, reason: 'IV too low (<25%)', setup: null };
  }

  // ── Scoring Pillars ──

  // Trend strength (0-30 pts)
  const trendScore = input.trendScore * 30;
  score += trendScore;
  reasons.push(`Trend: ${(input.trendScore * 100).toFixed(0)}% → ${trendScore.toFixed(0)}pts`);

  // IV Rank (0-25 pts)
  const ivRankProxy = input.ivRank !== undefined ? input.ivRank : Math.min(100, input.atmIv * 100);
  const ivScore = Math.min(25, ivRankProxy / 4);
  score += ivScore;
  reasons.push(`IV: ${ivRankProxy.toFixed(0)} → ${ivScore.toFixed(0)}pts`);

  // Wall clearance (0-20 pts)
  let wallScore = 10; // baseline
  if (input.walls.put && input.put25.strike < input.walls.put) {
    wallScore = 20; // bonus for strike below put wall
    reasons.push(`Put wall: ${input.walls.put} (strike safe)`);
  }
  score += wallScore;

  // Credit (0-15 pts)
  const spread = input.put25.strike - input.put15.strike;
  const credit = (input.put25.mid || 0) - (input.put15.mid || 0);
  const creditPct = (credit / input.price) * 100;
  const creditScore = Math.min(15, creditPct * 3);
  score += creditScore;
  reasons.push(`Credit: $${credit.toFixed(2)} (${creditPct.toFixed(1)}%)`);

  // Liquidity (0-10 pts)
  const liquidityScore = Math.min(10, (input.avgOI / 1000) * 10);
  score += liquidityScore;

  // ── Setup ──
  const setup = {
    action: 'BULL PUT SPREAD',
    sellStrike: input.put25.strike,
    buyStrike: input.put15.strike,
    spread: spread,
    expiry: input.put25.expiry,
    dte: input.put25.dte,
    credit: credit,
    maxLoss: spread - credit,
    breakeven: input.put25.strike - credit,
    probabilityProfit: (1 - Math.abs(input.put25.delta)) * 100
  };

  return {
    eligible: true,
    score: Math.round(score),
    reason: reasons.join(' | '),
    setup
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// BEAR CALL SPREAD STRATEGY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Score BEAR CALL SPREAD strategy
 *
 * Criteria:
 * - Bearish trend
 * - Below SMA50
 * - High IV (25%+)
 * - Strike above call wall (if available)
 *
 * @param {Object} input - Adapted stock data
 * @returns {Object} - {eligible, score, reason, setup}
 */
function scoreBearCall(input) {
  const reasons = [];
  let score = 0;

  // ── Eligibility Gates ──
  if (!input.call25 || !input.call15) {
    // Try to use put15 as proxy for call15 wing
    if (!input.call25) {
      return { eligible: false, score: 0, reason: 'Missing call contracts', setup: null };
    }
  }

  if (input.trend !== 'bearish') {
    return { eligible: false, score: 0, reason: `Trend is ${input.trend}, need bearish`, setup: null };
  }

  if (input.atmIv < 0.25) {
    return { eligible: false, score: 0, reason: 'IV too low (<25%)', setup: null };
  }

  // ── Scoring Pillars ──

  // Trend strength (0-30 pts) — invert since we want strong bearish
  const trendScore = (1 - input.trendScore) * 30;
  score += trendScore;
  reasons.push(`Trend: ${((1 - input.trendScore) * 100).toFixed(0)}% bearish → ${trendScore.toFixed(0)}pts`);

  // IV Rank (0-25 pts)
  const ivRankProxy = input.ivRank !== undefined ? input.ivRank : Math.min(100, input.atmIv * 100);
  const ivScore = Math.min(25, ivRankProxy / 4);
  score += ivScore;
  reasons.push(`IV: ${ivRankProxy.toFixed(0)} → ${ivScore.toFixed(0)}pts`);

  // Wall clearance (0-20 pts)
  let wallScore = 10; // baseline
  if (input.walls.call && input.call25.strike > input.walls.call) {
    wallScore = 20; // bonus for strike above call wall
    reasons.push(`Call wall: ${input.walls.call} (strike safe)`);
  }
  score += wallScore;

  // Credit (0-15 pts)
  const call15 = input.call15 || input.call25; // fallback
  const spread = (call15.strike || input.call25.strike * 1.1) - input.call25.strike;
  const credit = (input.call25.mid || 0) - (call15.mid || 0);
  const creditPct = (credit / input.price) * 100;
  const creditScore = Math.min(15, creditPct * 3);
  score += creditScore;
  reasons.push(`Credit: $${credit.toFixed(2)} (${creditPct.toFixed(1)}%)`);

  // Liquidity (0-10 pts)
  const liquidityScore = Math.min(10, (input.avgOI / 1000) * 10);
  score += liquidityScore;

  // ── Setup ──
  const setup = {
    action: 'BEAR CALL SPREAD',
    sellStrike: input.call25.strike,
    buyStrike: call15.strike || input.call25.strike * 1.1,
    spread: spread,
    expiry: input.call25.expiry,
    dte: input.call25.dte,
    credit: credit,
    maxLoss: spread - credit,
    breakeven: input.call25.strike + credit,
    probabilityProfit: (1 - Math.abs(input.call25.delta)) * 100
  };

  return {
    eligible: true,
    score: Math.round(score),
    reason: reasons.join(' | '),
    setup
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// BULL CALL SPREAD STRATEGY (Debit)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Score BULL CALL SPREAD strategy
 *
 * Criteria:
 * - Bullish trend
 * - LOW IV preferred (debit spread)
 * - Strong momentum
 *
 * @param {Object} input - Adapted stock data
 * @returns {Object} - {eligible, score, reason, setup}
 */
function scoreBullCall(input) {
  const reasons = [];
  let score = 0;

  // ── Eligibility Gates ──
  if (!input.call25 || !input.atmCall) {
    return { eligible: false, score: 0, reason: 'Missing call contracts', setup: null };
  }

  if (input.trend !== 'bullish') {
    return { eligible: false, score: 0, reason: `Trend is ${input.trend}, need bullish`, setup: null };
  }

  // Prefer LOW IV for debit spreads
  if (input.atmIv > 0.50) {
    return { eligible: false, score: 0, reason: 'IV too high for debit spread', setup: null };
  }

  // ── Scoring Pillars ──

  // Trend strength (0-35 pts)
  const trendScore = input.trendScore * 35;
  score += trendScore;
  reasons.push(`Trend: ${(input.trendScore * 100).toFixed(0)}% → ${trendScore.toFixed(0)}pts`);

  // Low IV bonus (0-25 pts) — invert IV score
  const ivScore = Math.max(0, 25 - (input.atmIv * 50));
  score += ivScore;
  reasons.push(`IV: ${(input.atmIv * 100).toFixed(1)}% (low) → ${ivScore.toFixed(0)}pts`);

  // Momentum (0-20 pts)
  const momentumScore = input.aboveSMA50 ? 20 : (input.aboveSMA100 ? 10 : 0);
  score += momentumScore;
  reasons.push(`Momentum: SMA50=${input.aboveSMA50} → ${momentumScore}pts`);

  // Risk/Reward (0-15 pts)
  const debit = (input.atmCall.mid || 0) - (input.call25.mid || 0);
  const maxGain = (input.call25.strike - input.atmCall.strike) - debit;
  const rr = maxGain / debit;
  const rrScore = Math.min(15, rr * 5);
  score += rrScore;
  reasons.push(`R/R: ${rr.toFixed(1)}:1 → ${rrScore.toFixed(0)}pts`);

  // Liquidity (0-5 pts)
  const liquidityScore = Math.min(5, (input.avgOI / 1000) * 5);
  score += liquidityScore;

  // ── Setup ──
  const setup = {
    action: 'BULL CALL SPREAD',
    buyStrike: input.atmCall.strike,
    sellStrike: input.call25.strike,
    expiry: input.call25.expiry,
    dte: input.call25.dte,
    debit: debit,
    maxGain: maxGain,
    maxLoss: debit,
    breakeven: input.atmCall.strike + debit,
    riskReward: rr
  };

  return {
    eligible: true,
    score: Math.round(score),
    reason: reasons.join(' | '),
    setup
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// BEAR PUT SPREAD STRATEGY (Debit)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Score BEAR PUT SPREAD strategy
 *
 * Criteria:
 * - Bearish trend
 * - LOW IV preferred (debit spread)
 * - Strong downward momentum
 *
 * @param {Object} input - Adapted stock data
 * @returns {Object} - {eligible, score, reason, setup}
 */
function scoreBearPut(input) {
  const reasons = [];
  let score = 0;

  // ── Eligibility Gates ──
  if (!input.put25 || !input.atmPut) {
    return { eligible: false, score: 0, reason: 'Missing put contracts', setup: null };
  }

  if (input.trend !== 'bearish') {
    return { eligible: false, score: 0, reason: `Trend is ${input.trend}, need bearish`, setup: null };
  }

  // Prefer LOW IV for debit spreads
  if (input.atmIv > 0.50) {
    return { eligible: false, score: 0, reason: 'IV too high for debit spread', setup: null };
  }

  // ── Scoring Pillars ──

  // Trend strength (0-35 pts) — invert for bearish
  const trendScore = (1 - input.trendScore) * 35;
  score += trendScore;
  reasons.push(`Trend: ${((1 - input.trendScore) * 100).toFixed(0)}% bearish → ${trendScore.toFixed(0)}pts`);

  // Low IV bonus (0-25 pts)
  const ivScore = Math.max(0, 25 - (input.atmIv * 50));
  score += ivScore;
  reasons.push(`IV: ${(input.atmIv * 100).toFixed(1)}% (low) → ${ivScore.toFixed(0)}pts`);

  // Momentum (0-20 pts) — below SMAs
  const momentumScore = !input.aboveSMA50 ? 20 : (!input.aboveSMA100 ? 10 : 0);
  score += momentumScore;
  reasons.push(`Momentum: SMA50=${input.aboveSMA50} → ${momentumScore}pts`);

  // Risk/Reward (0-15 pts)
  const debit = (input.atmPut.mid || 0) - (input.put25.mid || 0);
  const maxGain = (input.atmPut.strike - input.put25.strike) - debit;
  const rr = maxGain / debit;
  const rrScore = Math.min(15, rr * 5);
  score += rrScore;
  reasons.push(`R/R: ${rr.toFixed(1)}:1 → ${rrScore.toFixed(0)}pts`);

  // Liquidity (0-5 pts)
  const liquidityScore = Math.min(5, (input.avgOI / 1000) * 5);
  score += liquidityScore;

  // ── Setup ──
  const setup = {
    action: 'BEAR PUT SPREAD',
    buyStrike: input.atmPut.strike,
    sellStrike: input.put25.strike,
    expiry: input.put25.expiry,
    dte: input.put25.dte,
    debit: debit,
    maxGain: maxGain,
    maxLoss: debit,
    breakeven: input.atmPut.strike - debit,
    riskReward: rr
  };

  return {
    eligible: true,
    score: Math.round(score),
    reason: reasons.join(' | '),
    setup
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CALENDAR SPREAD STRATEGY
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Score CALENDAR SPREAD strategy
 *
 * Criteria:
 * - Positive term slope (front IV > back IV)
 * - Neutral trend
 * - Earnings catalyst in 30-60d
 * - ATM contracts available
 *
 * @param {Object} input - Adapted stock data
 * @returns {Object} - {eligible, score, reason, setup}
 */
function scoreCalendar(input) {
  const reasons = [];
  let score = 0;

  // ── Eligibility Gates ──
  if (!input.atmPut || !input.atmCall) {
    return { eligible: false, score: 0, reason: 'Missing ATM contracts', setup: null };
  }

  if (input.termSlope === null || input.termSlope <= 0) {
    return { eligible: false, score: 0, reason: 'Term slope not positive', setup: null };
  }

  // ── Scoring Pillars ──

  // Term slope (0-40 pts)
  const slopeScore = Math.min(40, input.termSlope * 200);
  score += slopeScore;
  reasons.push(`Term slope: ${(input.termSlope * 100).toFixed(1)}% → ${slopeScore.toFixed(0)}pts`);

  // Neutral bias (0-25 pts)
  const neutralScore = input.trend === 'neutral' ? 25 : 10;
  score += neutralScore;
  reasons.push(`Trend: ${input.trend} → ${neutralScore}pts`);

  // Earnings catalyst (0-20 pts)
  let catalystScore = 0;
  if (input.daysToEarnings !== null && input.daysToEarnings >= 30 && input.daysToEarnings <= 60) {
    catalystScore = 20;
    reasons.push(`Earnings in ${input.daysToEarnings}d → 20pts`);
  }
  score += catalystScore;

  // Liquidity (0-10 pts)
  const liquidityScore = Math.min(10, (input.avgOI / 1000) * 10);
  score += liquidityScore;

  // IV Level (0-5 pts) — prefer moderate IV
  const ivScore = input.atmIv >= 0.25 && input.atmIv <= 0.60 ? 5 : 0;
  score += ivScore;

  // ── Setup ──
  const setup = {
    action: 'CALENDAR SPREAD',
    strike: input.atmPut.strike,
    sellExpiry: input.atmPut.expiry,
    buyExpiry: '(+30d)', // placeholder, need to find next expiry
    sellDTE: input.atmPut.dte,
    buyDTE: input.atmPut.dte + 30,
    debit: input.atmPut.mid || 0, // simplified, actual = long - short
    maxGain: 'Varies with vol expansion',
    maxLoss: 'Net debit',
    catalyst: input.earningsDate || null
  };

  return {
    eligible: true,
    score: Math.round(score),
    reason: reasons.join(' | '),
    setup
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN ENGINE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Analyse single stock across all 8 strategies
 *
 * @param {Object} input - Adapted stock data from pipelineAdapter
 * @returns {Object} - {symbol, strategies: {WHEEL: {...}, CSP: {...}, ...}, topStrategy, overrides}
 */
function analyseStock(input) {
  const strategies = {
    WHEEL: scoreWheel(input),
    CSP: scoreCSP(input),
    IRON_CONDOR: scoreIronCondor(input),
    BROKEN_WING: scoreBrokenWing(input),
    BULL_PUT: scoreBullPut(input),
    BEAR_CALL: scoreBearCall(input),
    BULL_CALL: scoreBullCall(input),
    BEAR_PUT: scoreBearPut(input),
    CALENDAR: scoreCalendar(input)
  };

  // Find top strategy
  const eligible = Object.entries(strategies)
    .filter(([name, result]) => result.eligible)
    .sort((a, b) => b[1].score - a[1].score);

  const topStrategy = eligible.length > 0 ? eligible[0][0] : null;
  const topScore = eligible.length > 0 ? eligible[0][1].score : 0;

  // Overrides (special cases)
  const overrides = [];

  // Override 1: High IV + quality → force CSP/WHEEL
  if (input.quality >= 80 && input.atmIv >= 0.40 && !['WHEEL', 'CSP'].includes(topStrategy)) {
    overrides.push('High IV + quality stock → prefer CSP/WHEEL');
  }

  // Override 2: Earnings < 14d → disable all
  if (input.daysToEarnings !== null && input.daysToEarnings < 14) {
    overrides.push(`Earnings in ${input.daysToEarnings}d → high risk`);
  }

  // Override 3: UVXY-like (ATR > 5%) → only short premium
  if (input.atrPct > 0.05) {
    overrides.push('High ATR → only short premium strategies');
  }

  return {
    symbol: input.symbol,
    price: input.price,
    tier: input.tier,
    quality: input.quality,
    atmIv: input.atmIv,
    trend: input.trend,
    strategies,
    topStrategy,
    topScore,
    overrides
  };
}

/**
 * Run engine on multiple stocks
 *
 * @param {Array} inputs - Array of adapted stock data
 * @returns {Object} - {byStrategy: {WHEEL: [...], CSP: [...]}, bySymbol: {AAPL: {...}}}
 */
function runEngine(inputs) {
  const bySymbol = {};
  const byStrategy = {
    WHEEL: [],
    CSP: [],
    IRON_CONDOR: [],
    BROKEN_WING: [],
    BULL_PUT: [],
    BEAR_CALL: [],
    BULL_CALL: [],
    BEAR_PUT: [],
    CALENDAR: []
  };

  inputs.forEach(input => {
    const analysis = analyseStock(input);
    bySymbol[input.symbol] = analysis;

    // Group by strategy
    Object.entries(analysis.strategies).forEach(([strategyName, result]) => {
      if (result.eligible) {
        byStrategy[strategyName].push({
          symbol: input.symbol,
          score: result.score,
          reason: result.reason,
          setup: result.setup,
          price: input.price,
          tier: input.tier
        });
      }
    });
  });

  // Sort each strategy by score (desc)
  Object.keys(byStrategy).forEach(strategyName => {
    byStrategy[strategyName].sort((a, b) => b.score - a.score);
  });

  return { byStrategy, bySymbol };
}


// Export to window
window.strategyEngine = {
  scoreWheel,
  scoreCSP,
  scoreIronCondor,
  scoreBullPut,
  scoreBearCall,
  scoreBullCall,
  scoreBearPut,
  scoreCalendar,
  analyseStock,
  runEngine
};

})(window);
