/**
 * Gamma Metrics Extraction & Analysis (Week 2)
 * Processes options chain to calculate GEX, identify walls, and compute confidence scores
 * @module gammaMetrics
 */

'use strict';

/**
 * Calculate Gamma Exposure (GEX) for a single strike
 * GEX = gamma × openInterest × 100 × spotPrice
 * 
 * @param {number} gamma - Option gamma
 * @param {number} oi - Open Interest
 * @param {number} spot - Current stock price
 * @returns {number} Gamma exposure
 */
function calculateGEX(gamma, oi, spot) {
  if (!gamma || !oi || !spot) return 0;
  return gamma * oi * 100 * spot;
}

/**
 * Estimate gamma using Black-Scholes (fallback when OPRA not available)
 * @private
 */
function estimateGamma(strike, spot, iv, dte) {
  if (dte <= 0) return 0;
  
  const T = dte / 365;
  const sigma = Math.min(iv || 0.25, 5); // Cap IV at 500%
  
  if (sigma <= 0 || T <= 0) return 0;
  
  const d1 = (Math.log(spot / strike) + 0.5 * sigma * sigma * T) / (sigma * Math.sqrt(T));
  const gamma = Math.exp(-0.5 * d1 * d1) / Math.sqrt(2 * Math.PI) / (spot * sigma * Math.sqrt(T));
  
  return gamma;
}

/**
 * Calculate multi-factor score for a strike
 * Formula: (0.6 × OI Score) + (0.3 × Delta Score) + (0.1 × Volume Score)
 * 
 * @param {number} oi - Open Interest
 * @param {number} oiChange - OI delta (change from yesterday)
 * @param {number} volume - Intraday volume
 * @param {Object} ranges - Min/max ranges for normalization
 * @returns {number} Multi-factor score (0-1)
 */
function calculateMultiFactorScore(oi, oiChange, volume, ranges) {
  // Normalize OI (60% weight)
  const oiScore = ranges.maxOI > 0 
    ? (oi / ranges.maxOI) * 0.6 
    : 0;
  
  // Normalize OI change (30% weight) - absolute value
  const deltaScore = ranges.maxOIChange > 0 
    ? (Math.abs(oiChange || 0) / ranges.maxOIChange) * 0.3 
    : 0;
  
  // Normalize volume (10% weight)
  const volumeScore = ranges.maxVolume > 0 
    ? (volume / ranges.maxVolume) * 0.1 
    : 0;
  
  return oiScore + deltaScore + volumeScore;
}

/**
 * Calculate ranges for normalization
 * @private
 */
function calculateRanges(strikes) {
  const ranges = {
    maxOI: 0,
    maxOIChange: 0,
    maxVolume: 0
  };
  
  for (const strike of strikes) {
    // Check both calls and puts
    if (strike.call) {
      ranges.maxOI = Math.max(ranges.maxOI, strike.call.openInterest || 0);
      ranges.maxOIChange = Math.max(ranges.maxOIChange, Math.abs(strike.call.oiChange || 0));
      ranges.maxVolume = Math.max(ranges.maxVolume, strike.call.volume || 0);
    }
    
    if (strike.put) {
      ranges.maxOI = Math.max(ranges.maxOI, strike.put.openInterest || 0);
      ranges.maxOIChange = Math.max(ranges.maxOIChange, Math.abs(strike.put.oiChange || 0));
      ranges.maxVolume = Math.max(ranges.maxVolume, strike.put.volume || 0);
    }
  }
  
  return ranges;
}

/**
 * Process options chain and extract gamma metrics
 * 
 * @param {Object} chainData - Options chain from fetchOptionsChain
 * @param {number} spot - Current stock price
 * @param {Object} oiDeltaData - Optional OI delta data from oi-tracker
 * @returns {Object} Gamma analysis results
 */
function extractGammaMetrics(chainData, spot, oiDeltaData = null) {
  if (!chainData.expiries || chainData.expiries.length === 0) {
    throw new Error('No expiries in chain data');
  }
  
  // Combine all strikes from all expiries
  let allStrikes = [];
  
  for (const expiry of chainData.expiries) {
    if (!expiry.strikes || expiry.strikes.length === 0) continue;
    
    const dte = expiry.dte;
    
    for (const strike of expiry.strikes) {
      // Get OI delta if available
      const oiDelta = oiDeltaData?.strikes?.[strike.strike] || {};
      
      allStrikes.push({
        strike: strike.strike,
        expiry: expiry.date,
        dte,
        call: strike.call ? {
          ...strike.call,
          oiChange: oiDelta.call_oi_change || 0
        } : null,
        put: strike.put ? {
          ...strike.put,
          oiChange: oiDelta.put_oi_change || 0
        } : null
      });
    }
  }
  
  if (allStrikes.length === 0) {
    throw new Error('No strikes found in chain data');
  }
  
  // Calculate ranges for normalization
  const ranges = calculateRanges(allStrikes);
  
  // Process each strike
  const processedStrikes = [];
  
  for (const strike of allStrikes) {
    const strikeData = {
      strike: strike.strike,
      expiry: strike.expiry,
      dte: strike.dte,
      callGEX: 0,
      putGEX: 0,
      callScore: 0,
      putScore: 0,
      callOI: 0,
      putOI: 0,
      callVolume: 0,
      putVolume: 0
    };
    
    // Process call
    if (strike.call) {
      const callGamma = strike.call.gamma || estimateGamma(
        strike.strike, 
        spot, 
        strike.call.iv || 0.25, 
        strike.dte
      );
      
      strikeData.callGEX = calculateGEX(callGamma, strike.call.openInterest || 0, spot);
      strikeData.callScore = calculateMultiFactorScore(
        strike.call.openInterest || 0,
        strike.call.oiChange || 0,
        strike.call.volume || 0,
        ranges
      );
      strikeData.callOI = strike.call.openInterest || 0;
      strikeData.callVolume = strike.call.volume || 0;
    }
    
    // Process put
    if (strike.put) {
      const putGamma = strike.put.gamma || estimateGamma(
        strike.strike, 
        spot, 
        strike.put.iv || 0.25, 
        strike.dte
      );
      
      strikeData.putGEX = calculateGEX(putGamma, strike.put.openInterest || 0, spot);
      strikeData.putScore = calculateMultiFactorScore(
        strike.put.openInterest || 0,
        strike.put.oiChange || 0,
        strike.put.volume || 0,
        ranges
      );
      strikeData.putOI = strike.put.openInterest || 0;
      strikeData.putVolume = strike.put.volume || 0;
    }
    
    processedStrikes.push(strikeData);
  }
  
  // Identify walls using multi-factor scoring
  const putWallData = findPutWall(processedStrikes, spot);
  const callWallData = findCallWall(processedStrikes, spot);
  const gammaFlip = findGammaFlip(processedStrikes, spot);
  
  // Calculate confidence scores
  const confidence = calculateConfidenceScores(processedStrikes, putWallData, callWallData);
  
  // Calculate band metrics
  const bandWidth = putWallData && callWallData 
    ? ((callWallData.strike - putWallData.strike) / spot) * 100 
    : 0;
  
  const positionInBand = putWallData && callWallData && bandWidth > 0
    ? ((spot - putWallData.strike) / (callWallData.strike - putWallData.strike)) * 100
    : 50;
  
  return {
    putWall: putWallData?.strike || null,
    putWallScore: putWallData?.score || 0,
    callWall: callWallData?.strike || null,
    callWallScore: callWallData?.score || 0,
    gammaFlip: gammaFlip,
    bandWidthPct: bandWidth,
    positionInBandPct: positionInBand,
    confidence: {
      overall: confidence.overall,
      oi: confidence.oi,
      delta: confidence.delta,
      volume: confidence.volume
    },
    contractsAnalyzed: allStrikes.length,
    topStrikes: getTopStrikes(processedStrikes, 10),
    strikes: processedStrikes
  };
}

/**
 * Find put wall (max multi-factor score below spot)
 * @private
 */
function findPutWall(strikes, spot) {
  const putStrikes = strikes
    .filter(s => s.strike < spot && s.strike > spot * 0.85) // Within 15% below spot
    .filter(s => s.putScore > 0)
    .sort((a, b) => b.putScore - a.putScore);
  
  return putStrikes.length > 0 
    ? { strike: putStrikes[0].strike, score: putStrikes[0].putScore }
    : null;
}

/**
 * Find call wall (max multi-factor score above spot)
 * @private
 */
function findCallWall(strikes, spot) {
  const callStrikes = strikes
    .filter(s => s.strike > spot && s.strike < spot * 1.15) // Within 15% above spot
    .filter(s => s.callScore > 0)
    .sort((a, b) => b.callScore - a.callScore);
  
  return callStrikes.length > 0 
    ? { strike: callStrikes[0].strike, score: callStrikes[0].callScore }
    : null;
}

/**
 * Find gamma flip (where net GEX crosses zero)
 * @private
 */
function findGammaFlip(strikes, spot) {
  // Sort strikes by price
  const sortedStrikes = [...strikes].sort((a, b) => a.strike - b.strike);
  
  for (let i = 0; i < sortedStrikes.length - 1; i++) {
    const netGex1 = sortedStrikes[i].callGEX - sortedStrikes[i].putGEX;
    const netGex2 = sortedStrikes[i + 1].callGEX - sortedStrikes[i + 1].putGEX;
    
    // Check if sign changes
    if (Math.sign(netGex1) !== Math.sign(netGex2)) {
      // Interpolate between strikes
      return (sortedStrikes[i].strike + sortedStrikes[i + 1].strike) / 2;
    }
  }
  
  // Default to spot if no flip found
  return spot;
}

/**
 * Calculate confidence scores
 * @private
 */
function calculateConfidenceScores(strikes, putWall, callWall) {
  // OI confidence (data quality)
  const oiCoverage = strikes.filter(s => 
    (s.callOI > 0 || s.putOI > 0)
  ).length / strikes.length;
  
  const oiConfidence = oiCoverage;
  
  // Delta confidence (OI change strength)
  const hasOIChanges = strikes.some(s => 
    (s.call?.oiChange !== undefined && s.call?.oiChange !== 0) ||
    (s.put?.oiChange !== undefined && s.put?.oiChange !== 0)
  );
  
  const deltaConfidence = hasOIChanges ? 0.7 : 0; // Placeholder
  
  // Volume confidence (trading activity)
  const avgVolume = strikes.reduce((sum, s) => 
    sum + (s.callVolume || 0) + (s.putVolume || 0), 0
  ) / strikes.length;
  
  const volumeConfidence = Math.min(avgVolume / 500, 1); // 500 contracts = high confidence
  
  // Overall confidence (wall strength + band quality)
  const wallStrength = (putWall?.score || 0) + (callWall?.score || 0);
  const bandQuality = putWall && callWall ? 0.5 : 0;
  
  const overallConfidence = Math.min(
    (wallStrength * 0.6 + bandQuality * 0.4 + oiConfidence * 0.2) / 1.2,
    1
  );
  
  return {
    overall: overallConfidence,
    oi: oiConfidence,
    delta: deltaConfidence,
    volume: volumeConfidence
  };
}

/**
 * Get top N strikes by total exposure
 * @private
 */
function getTopStrikes(strikes, n = 10) {
  return [...strikes]
    .map(s => ({
      strike: s.strike,
      totalGEX: s.callGEX + s.putGEX,
      callOI: s.callOI,
      putOI: s.putOI,
      callVolume: s.callVolume,
      putVolume: s.putVolume
    }))
    .sort((a, b) => b.totalGEX - a.totalGEX)
    .slice(0, n);
}

module.exports = {
  extractGammaMetrics,
  calculateGEX,
  calculateMultiFactorScore
};
