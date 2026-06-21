#!/usr/bin/env node
/**
 * gamma-analyzer-enhanced.js — Enhanced Gamma Wall Analysis with Multi-Factor Scoring
 * ─────────────────────────────────────────────────────────────────────────────
 * Enhanced gamma wall detection using:
 *   - OI Baseline (60%) — T-1 settled positions
 *   - OI Delta (30%) — Position build-up/unwinding
 *   - Intraday Volume (10%) — Real-time market activity
 *
 * Formula:
 *   Signal Strength = (0.6 × OI Score) + (0.3 × Delta Score) + (0.1 × Volume Score)
 *
 * Confidence Levels:
 *   > 80% = High confidence (strong signals across all factors)
 *   60-80% = Medium confidence (mixed signals)
 *   < 60% = Weak confidence (conflicting or low data quality)
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const OI_WEIGHT = 0.60;
const DELTA_WEIGHT = 0.30;
const VOLUME_WEIGHT = 0.10;

/**
 * Enhanced gamma analysis with multi-factor scoring
 * Replaces the original analyzeGamma() function
 */
function analyzeGammaEnhanced(contracts, spot, dteMin, dteMax, oiDeltaData) {
  const MUL = 100;
  const WALL_RANGE = 0.15;
  const strikeMap = new Map();

  // Build strike map with GEX, OI, Volume
  for (const c of contracts) {
    if (!strikeMap.has(c.strike)) {
      strikeMap.set(c.strike, {
        strike: c.strike,
        callGex: 0,
        putGex: 0,
        callOi: 0,
        putOi: 0,
        callVolume: 0,
        putVolume: 0,
        callOiChange: 0,
        putOiChange: 0
      });
    }

    const row = strikeMap.get(c.strike);
    const T = (c.dte || 1) / 365;
    const g = c.gamma ?? estimateGamma(c.strike, spot, c.iv || 0.25, T);
    const gex = g * (c.openInterest || 0) * MUL * spot;

    if (c.type === 'call') {
      row.callGex += gex;
      row.callOi += c.openInterest || 0;
      row.callVolume += c.volume || 0;
    } else {
      row.putGex += gex;
      row.putOi += c.openInterest || 0;
      row.putVolume += c.volume || 0;
    }
  }

  // Merge OI delta data if available
  if (oiDeltaData && oiDeltaData.strikes) {
    for (const [strikeStr, deltaInfo] of Object.entries(oiDeltaData.strikes)) {
      const strike = parseFloat(strikeStr);
      if (strikeMap.has(strike)) {
        const row = strikeMap.get(strike);
        row.callOiChange = deltaInfo.call_oi_change || 0;
        row.putOiChange = deltaInfo.put_oi_change || 0;
      }
    }
  }

  const sorted = [...strikeMap.values()].sort((a, b) => a.strike - b.strike);

  // Find gamma walls using multi-factor scoring
  let callWall = null;
  let putWall = null;
  let maxCallScore = 0;
  let maxPutScore = 0;

  for (const r of sorted) {
    if (Math.abs(r.strike - spot) / spot > WALL_RANGE) continue;

    // Calculate multi-factor score for this strike
    const callScore = calculateMultiFactorScore(
      r.callOi,
      r.callOiChange,
      r.callVolume,
      sorted
    );

    const putScore = calculateMultiFactorScore(
      r.putOi,
      r.putOiChange,
      r.putVolume,
      sorted
    );

    // Call wall (above spot)
    if (r.strike > spot && callScore > maxCallScore) {
      maxCallScore = callScore;
      callWall = { ...r, score: callScore };
    }

    // Put wall (below spot)
    if (r.strike < spot && putScore > maxPutScore) {
      maxPutScore = putScore;
      putWall = { ...r, score: putScore };
    }
  }

  // Fallback: if no walls found using scoring, use traditional OI-only method
  if (!callWall || !putWall) {
    let maxCOI = 0, maxPOI = 0;
    for (const r of sorted) {
      if (Math.abs(r.strike - spot) / spot > WALL_RANGE) continue;
      if (r.strike > spot && r.callOi > maxCOI) {
        maxCOI = r.callOi;
        if (!callWall) callWall = { ...r, score: 0.5 };
      }
      if (r.strike < spot && r.putOi > maxPOI) {
        maxPOI = r.putOi;
        if (!putWall) putWall = { ...r, score: 0.5 };
      }
    }
  }

  const cw = callWall?.strike || +((spot * 1.02).toFixed(2));
  const pw = putWall?.strike || +((spot * 0.98).toFixed(2));
  const bandWidth = ((cw - pw) / spot) * 100;
  const posInBand = cw !== pw ? ((spot - pw) / (cw - pw)) * 100 : 50;

  // Gamma flip point
  let gammaFlip = spot;
  for (let i = 1; i < sorted.length; i++) {
    const na = sorted[i - 1].callGex - sorted[i - 1].putGex;
    const nb = sorted[i].callGex - sorted[i].putGex;
    if (Math.sign(na) !== Math.sign(nb)) {
      gammaFlip = (sorted[i - 1].strike + sorted[i].strike) / 2;
      break;
    }
  }

  // Calculate GEX-relative confidence (wall concentration)
  const gexConfidence = calculateConfidence(callWall, putWall, sorted, bandWidth);
  const confidenceBreakdown = calculateConfidence._lastBreakdown || null;
  const wallsFound = gexConfidence !== null;

  // Enhanced confidence breakdown
  const oiConfidence = calculateOIConfidence(sorted);
  const deltaConfidence = calculateDeltaConfidence(sorted);
  const volumeConfidence = calculateVolumeConfidence(sorted);

  // Blended confidence: combines liquidity (OI) + concentration (GEX) + positioning (delta) + activity (volume)
  // Weights: intuition-based, NOT outcome-validated — no accuracy claims until tuned against real outcomes
  const W_OI = 0.40, W_GEX = 0.35, W_DELTA = 0.15, W_VOL = 0.10;

  // DELTA DARK: delta intentionally excluded from gate-driving confidence until discover
  // has OI-history access (R2/Firestore plumbing). Without this, scanner would see delta
  // but discover would not, causing the same ticker to get different strategies on each
  // surface. deltaConfidence is still computed above and exposed in the output for
  // diagnostic validation — it just doesn't drive strategy selection yet.
  // Tracked as the (a) plumbing fix: give API OI-history access, then re-enable delta
  // in the blend on BOTH sides simultaneously.
  const DELTA_DARK = true; // flip to false once discover has OI-history access
  const effectiveDelta = DELTA_DARK ? 0 : deltaConfidence;
  const confidence = wallsFound
    ? W_OI * oiConfidence + W_GEX * gexConfidence + W_DELTA * effectiveDelta + W_VOL * volumeConfidence
    : null;

  // Condor gate
  const condorAllowed =
    bandWidth >= 3 &&
    bandWidth <= 15 &&
    confidence >= 0.6 &&
    contracts.length >= 50;

  const suggestedStrikes = condorAllowed
    ? {
        longPut: Math.round(pw - (cw - pw) * 0.3),
        shortPut: Math.round(pw),
        shortCall: Math.round(cw),
        longCall: Math.round(cw + (cw - pw) * 0.3)
      }
    : null;

  // Top strikes with enhanced data
  const rows = sorted.map(r => ({
    strike: r.strike,
    gamma_exposure: r.callGex - r.putGex,
    call_oi: r.callOi,
    put_oi: r.putOi,
    call_oi_change: r.callOiChange,
    put_oi_change: r.putOiChange,
    call_volume: r.callVolume,
    put_volume: r.putVolume,
    multi_factor_score: calculateMultiFactorScore(
      Math.max(r.callOi, r.putOi),
      Math.abs(r.callOiChange) + Math.abs(r.putOiChange),
      r.callVolume + r.putVolume,
      sorted
    )
  }));

  const hasGex = rows.some(r => Math.abs(r.gamma_exposure) > 0);
  const hasOI = rows.some(r => r.call_oi + r.put_oi > 0);

  let topStrikes;
  if (hasGex) {
    topStrikes = [...rows]
      .sort((a, b) => Math.abs(b.gamma_exposure) - Math.abs(a.gamma_exposure))
      .slice(0, 20);
  } else if (hasOI) {
    topStrikes = rows
      .filter(r => Math.abs(r.strike - spot) / spot <= 0.25 && r.call_oi + r.put_oi > 0)
      .sort((a, b) => b.call_oi + b.put_oi - (a.call_oi + a.put_oi))
      .slice(0, 20)
      .sort((a, b) => a.strike - b.strike);
    if (!topStrikes.length) {
      topStrikes = [...rows]
        .sort((a, b) => Math.abs(a.strike - spot) - Math.abs(b.strike - spot))
        .slice(0, 20)
        .sort((a, b) => a.strike - b.strike);
    }
  } else {
    topStrikes = [...rows]
      .sort((a, b) => Math.abs(a.strike - spot) - Math.abs(b.strike - spot))
      .slice(0, 20)
      .sort((a, b) => a.strike - b.strike);
  }

  // ATM IV
  const atmC = contracts.filter(c => Math.abs(c.strike - spot) / spot < 0.05 && c.iv);
  const atmIv = atmC.length ? (atmC.reduce((s, c) => s + c.iv, 0) / atmC.length) * 100 : null;
  const ivLevel = !atmIv ? 'normal' : atmIv > 50 ? 'high' : atmIv < 25 ? 'low' : 'normal';

  // Calculate IV by expiry for calendar spreads
  const ivByExpiry = {};
  const expiries = [...new Set(contracts.map(c => c.expiry))].sort();
  expiries.forEach(exp => {
    const expiryContracts = contracts.filter(c => c.expiry === exp && c.iv && c.iv > 0);
    if (expiryContracts.length > 0) {
      const avgIV = expiryContracts.reduce((sum, c) => sum + c.iv, 0) / expiryContracts.length;
      ivByExpiry[exp] = +(avgIV * 100).toFixed(2);
    }
  });

  // OI delta summary (for top-level analysis)
  let oiDeltaSummary = null;
  if (oiDeltaData && callWall && putWall) {
    const callWallDelta = oiDeltaData.strikes?.[callWall.strike.toString()];
    const putWallDelta = oiDeltaData.strikes?.[putWall.strike.toString()];

    oiDeltaSummary = {
      call_wall_change: callWallDelta?.call_oi_change || 0,
      put_wall_change: putWallDelta?.put_oi_change || 0,
      net_change: (callWallDelta?.net_change || 0) + (putWallDelta?.net_change || 0),
      trend: inferTrend(callWallDelta, putWallDelta)
    };
  }

  return {
    analysis: {
      put_wall: pw,
      call_wall: cw,
      gamma_flip: gammaFlip,
      band_width_pct: bandWidth,
      position_in_band_pct: Math.round(posInBand),
      confidence_score: confidence,
      gex_confidence: gexConfidence,
      walls_found: wallsFound,
      data_quality: confidence === null ? 'no_walls'
        : confidence >= 0.6 ? 'full'
        : confidence >= 0.3 ? 'partial' : 'weak',
      confidence_breakdown: confidenceBreakdown,
      oi_confidence: oiConfidence,
      delta_confidence: deltaConfidence,
      volume_confidence: volumeConfidence,
      signal_composition: {
        oi_weight: OI_WEIGHT,
        delta_weight: DELTA_WEIGHT,
        volume_weight: VOLUME_WEIGHT
      },
      contracts_analyzed: contracts.length,
      dte_range: { min: dteMin, max: dteMax },
      topStrikes
    },
    condorGate: { condorAllowed, suggestedStrikes },
    ivData: { atmIv, ivLevel, ivByExpiry },
    oiDelta: oiDeltaSummary
  };
}

/**
 * Calculate multi-factor score for a strike
 * Formula: (0.6 × OI) + (0.3 × Delta) + (0.1 × Volume)
 */
function calculateMultiFactorScore(oi, oiChange, volume, allStrikes) {
  // Normalize each component (0-1)
  const maxOI = Math.max(...allStrikes.map(s => Math.max(s.callOi, s.putOi)), 1);
  const maxOIChange = Math.max(
    ...allStrikes.map(s => Math.abs(s.callOiChange) + Math.abs(s.putOiChange)),
    1
  );
  const maxVolume = Math.max(...allStrikes.map(s => s.callVolume + s.putVolume), 1);

  const oiScore = oi / maxOI;
  const deltaScore = Math.abs(oiChange) / maxOIChange;
  const volumeScore = volume / maxVolume;

  return OI_WEIGHT * oiScore + DELTA_WEIGHT * deltaScore + VOLUME_WEIGHT * volumeScore;
}

/**
 * Calculate overall confidence using multi-factor data
 */
function calculateConfidence(callWall, putWall, strikes, bandWidth) {
  if (!callWall || !putWall) return null;  // no walls found — don't disguise as low confidence

  const totalGex = strikes.reduce((s, r) => s + r.callGex + r.putGex, 0);
  const maxCG = callWall.callGex || 0;
  const maxPG = putWall.putGex || 0;

  const wallStrength = totalGex > 0 ? (maxCG + maxPG) / totalGex : 0;
  const bandBonus = Math.max(0, 1 - bandWidth / 20);

  // Base confidence (traditional method)
  const baseConfidence = wallStrength * 0.7 + bandBonus * 0.3;

  // Enhance with multi-factor scores
  const callScore = callWall.score || 0;
  const putScore = putWall.score || 0;
  const multiFactorBonus = (callScore + putScore) / 2;

  const final = Math.min(1, baseConfidence * 0.6 + multiFactorBonus * 0.4);

  // Diagnostic: store breakdown for debugging (attached to function result)
  calculateConfidence._lastBreakdown = {
    wallStrength: +wallStrength.toFixed(4),
    bandBonus: +bandBonus.toFixed(4),
    baseConfidence: +baseConfidence.toFixed(4),
    callWallScore: +callScore.toFixed(4),
    putWallScore: +putScore.toFixed(4),
    multiFactorBonus: +multiFactorBonus.toFixed(4),
    maxCallGex: Math.round(maxCG),
    maxPutGex: Math.round(maxPG),
    totalGex: Math.round(totalGex),
    bandWidth: +bandWidth.toFixed(2),
    final: +final.toFixed(4)
  };

  return final;
}

/**
 * Calculate OI confidence (how good is the OI data?)
 */
function calculateOIConfidence(strikes) {
  const withOI = strikes.filter(s => s.callOi + s.putOi > 0).length;
  const total = strikes.length;

  if (total === 0) return 0;

  const coverage = withOI / total;

  // High coverage = high confidence
  if (coverage >= 0.8) return 0.85 + (coverage - 0.8) * 0.75;
  if (coverage >= 0.5) return 0.65 + (coverage - 0.5) * 0.67;
  return coverage * 1.3;
}

/**
 * Calculate delta confidence (how strong are position changes?)
 */
function calculateDeltaConfidence(strikes) {
  const withDelta = strikes.filter(
    s => Math.abs(s.callOiChange) + Math.abs(s.putOiChange) > 0
  ).length;
  const total = strikes.length;

  if (total === 0) return 0;

  const coverage = withDelta / total;

  // Calculate average delta magnitude
  const totalDelta = strikes.reduce(
    (sum, s) => sum + Math.abs(s.callOiChange) + Math.abs(s.putOiChange),
    0
  );
  const avgDelta = totalDelta / total;

  // Strong deltas (>100 per strike) = high confidence
  const magnitude = Math.min(avgDelta / 100, 1);

  return coverage * 0.6 + magnitude * 0.4;
}

/**
 * Calculate volume confidence (how active is trading?)
 */
function calculateVolumeConfidence(strikes) {
  const totalVolume = strikes.reduce((sum, s) => sum + s.callVolume + s.putVolume, 0);
  const total = strikes.length;

  if (total === 0) return 0;

  const avgVolume = totalVolume / total;

  // High volume (>500 per strike) = high confidence
  return Math.min(avgVolume / 500, 1);
}

/**
 * Infer trend from call/put wall deltas
 */
function inferTrend(callWallDelta, putWallDelta) {
  if (!callWallDelta || !putWallDelta) return 'neutral';

  const callChange = callWallDelta.call_oi_change || 0;
  const putChange = putWallDelta.put_oi_change || 0;

  if (callChange > 100 && putChange < -100) return 'bullish_build_up';
  if (callChange < -100 && putChange > 100) return 'bearish_build_up';
  if (callChange > 100 && putChange > 100) return 'straddle_build_up';
  if (callChange < -100 && putChange < -100) return 'unwinding';

  return 'neutral';
}

/**
 * Estimate gamma using Black-Scholes (for contracts without OPRA Greeks)
 */
function estimateGamma(K, S, iv, T) {
  if (!iv || !T || T <= 0) return 0;
  const sig = Math.min(iv, 5);
  const d1 = (Math.log(S / K) + 0.5 * sig * sig * T) / (sig * Math.sqrt(T));
  return (
    (Math.exp(-0.5 * d1 * d1) / Math.sqrt(2 * Math.PI)) / (S * sig * Math.sqrt(T))
  );
}

module.exports = {
  analyzeGammaEnhanced,
  calculateMultiFactorScore,
  calculateConfidence,
  calculateOIConfidence,
  calculateDeltaConfidence,
  calculateVolumeConfidence
};
