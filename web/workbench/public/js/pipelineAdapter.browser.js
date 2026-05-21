/**
 * pipelineAdapter.browser.js
 * Browser version - adapts pipeline reports to strategy engine input
 */
(function(window) {
'use strict';

/**
 * Find nearest contract by target delta
 *
 * @param {Array} chain - Full option chain from latest.json
 * @param {string} type - 'put' or 'call'
 * @param {number} targetDelta - Target delta (absolute value, e.g., 0.25)
 * @param {number} minDTE - Minimum days to expiration
 * @param {number} maxDTE - Maximum days to expiration
 * @returns {Object|null} - Nearest contract or null
 */
function findContractByDelta(chain, type, targetDelta, minDTE = 14, maxDTE = 90) {
  if (!Array.isArray(chain) || chain.length === 0) return null;

  const candidates = chain.filter(c =>
    c.type === type &&
    c.dte >= minDTE &&
    c.dte <= maxDTE &&
    c.delta !== undefined &&
    c.delta !== null &&
    c.delta !== 0
  );

  if (candidates.length === 0) return null;

  // Sort by closest to target delta (absolute value)
  candidates.sort((a, b) => {
    const deltaA = Math.abs(Math.abs(a.delta) - targetDelta);
    const deltaB = Math.abs(Math.abs(b.delta) - targetDelta);
    return deltaA - deltaB;
  });

  const best = candidates[0];

  return {
    strike: best.strike,
    expiry: best.expiry,
    dte: best.dte,
    delta: best.delta,
    mid: best.mid || ((best.bid || 0) + (best.ask || 0)) / 2,
    bid: best.bid,
    ask: best.ask,
    iv: best.iv,
    theta: best.theta,
    gamma: best.gamma,
    volume: best.volume,
    openInterest: best.openInterest
  };
}

/**
 * Extract IV term structure slope
 *
 * @param {Object} ivByExpiry - IV by expiry from gammaData.ivData.ivByExpiry
 * @returns {number|null} - Slope (30d IV - 60d IV) or null
 */
function extractTermSlope(ivByExpiry) {
  if (!ivByExpiry || typeof ivByExpiry !== 'object') return null;

  const expiries = Object.keys(ivByExpiry).sort();
  if (expiries.length < 2) return null;

  const today = new Date();
  const ivData = expiries.map(exp => {
    const expDate = new Date(exp);
    const dte = Math.round((expDate - today) / (1000 * 60 * 60 * 24));
    return { dte, iv: ivByExpiry[exp] };
  });

  // Find nearest to 30d and 60d
  const iv30 = ivData.reduce((prev, curr) =>
    Math.abs(curr.dte - 30) < Math.abs(prev.dte - 30) ? curr : prev
  );
  const iv60 = ivData.reduce((prev, curr) =>
    Math.abs(curr.dte - 60) < Math.abs(prev.dte - 60) ? curr : prev
  );

  if (!iv30 || !iv60 || !iv30.iv || !iv60.iv) return null;

  // Convert from percentage to decimal, positive slope = front-month IV higher (bullish for calendars)
  return (iv30.iv - iv60.iv) / 100;
}

/**
 * Adapt raw pipeline report to strategy engine input
 *
 * @param {Object} report - Raw latest.json from pipeline
 * @returns {Object} - Clean input for strategyEngine
 */
function adaptReportToEngineInput(report) {
  if (!report || !report.meta || !report.meta.symbol) {
    throw new Error('Invalid report: missing meta.symbol');
  }

  const symbol = report.meta.symbol;
  const price = report.snapshot?.price || 0;

  // ── Tier & Quality ──
  const tier = report.marketCapTier || 'unknown';
  const sector = report.sector || 'Unknown';
  const quality = report.qualityScore || 50;

  // ── IV Metrics ──
  // Note: atmIv is stored as percentage (20.5 = 20.5%), convert to decimal
  const atmIv = (report.gammaData?.ivData?.atmIv || 0) / 100;
  const ivRank = report.gammaData?.ivData?.ivRank; // undefined until 30 days
  const ivByExpiry = report.gammaData?.ivData?.ivByExpiry || {};
  const termSlope = extractTermSlope(ivByExpiry);

  // ── Volatility ──
  const realizedVol = report.technicalData?.realizedVol30d || 0;
  const ivRVSpread = atmIv - realizedVol; // positive = IV > RV (good for premium selling)
  const atrPct = report.technicalData?.atrPct || 0;

  // ── Trend ──
  const trendState = report.technicalData?.trendEngine?.state || 'Neutral';
  const trendScore = report.technicalData?.trendEngine?.score || 0.5;
  const aboveSMA50 = report.technicalData?.aboveSMA50 || false;
  const aboveSMA100 = report.technicalData?.aboveSMA100 || false;
  const aboveSMA200 = report.technicalData?.aboveSMA200; // null until 200 bars

  // Map trend state to simple enum
  let trend = 'neutral';
  if (trendState === 'Bullish' || (trendScore >= 0.6 && aboveSMA50)) {
    trend = 'bullish';
  } else if (trendState === 'Bearish' || (trendScore <= 0.4 && !aboveSMA50)) {
    trend = 'bearish';
  }

  // ── Earnings ──
  const earningsDate = report.earningsDate || null;
  let daysToEarnings = null;
  if (earningsDate) {
    const today = new Date();
    const earnDate = new Date(earningsDate);
    daysToEarnings = Math.round((earnDate - today) / (1000 * 60 * 60 * 24));
  }

  // ── Gamma Walls ──
  const walls = {
    call: report.gammaData?.walls?.callWall || null,
    put: report.gammaData?.walls?.putWall || null
  };

  // ── Condor Gate & Gamma Analysis ──
  const condorAllowed = report.gammaData?.condorGate?.condorAllowed || false;
  const bandWidthPct = report.gammaData?.analysis?.band_width_pct || 0;
  const gammaConfidence = report.gammaData?.analysis?.confidence_score || 0;
  const putWall = report.gammaData?.analysis?.put_wall || null;
  const callWall = report.gammaData?.analysis?.call_wall || null;

  // ── Option Chain ──
  const chain = report.optionChain || [];

  // Find key contracts
  const put25 = findContractByDelta(chain, 'put', 0.25, 14, 90);
  const put15 = findContractByDelta(chain, 'put', 0.15, 14, 90);
  const call25 = findContractByDelta(chain, 'call', 0.25, 14, 90);
  const call15 = findContractByDelta(chain, 'call', 0.15, 14, 90);

  // ATM straddle (for neutral strategies)
  const atmPut = findContractByDelta(chain, 'put', 0.50, 14, 90);
  const atmCall = findContractByDelta(chain, 'call', 0.50, 14, 90);

  // ── Liquidity ──
  // Average volume and OI across put25/call25
  let avgVolume = 0;
  let avgOI = 0;
  const liquidityContracts = [put25, call25].filter(c => c !== null);
  if (liquidityContracts.length > 0) {
    avgVolume = liquidityContracts.reduce((sum, c) => sum + (c.volume || 0), 0) / liquidityContracts.length;
    avgOI = liquidityContracts.reduce((sum, c) => sum + (c.openInterest || 0), 0) / liquidityContracts.length;
  }

  // ── Opportunity Score ──
  const opportunityScore = report.scoring?.opportunityScore || 0;

  // ── Return Clean Object ──
  return {
    symbol,
    price,
    tier,
    sector,
    quality,

    // IV metrics
    atmIv,
    ivRank,
    ivRVSpread,
    termSlope,

    // Volatility
    realizedVol,
    atrPct,

    // Trend
    trend,
    trendScore,
    aboveSMA50,
    aboveSMA100,
    aboveSMA200,

    // Earnings
    earningsDate,
    daysToEarnings,

    // Walls & Gamma
    walls,
    condorAllowed,
    bandWidthPct,
    gammaConfidence,
    putWall,
    callWall,

    // Contracts
    put25,
    put15,
    call25,
    call15,
    atmPut,
    atmCall,

    // Liquidity
    avgVolume,
    avgOI,

    // Score
    opportunityScore,

    // Full chain (for advanced strategies)
    chain
  };
}

// ── Exports ──

// Export to window
window.pipelineAdapter = {
  findContractByDelta,
  extractTermSlope,
  adaptReportToEngineInput
};

})(window);
