#!/usr/bin/env node
/**
 * oi-tracker.js — OI History & Delta Tracking Module
 * ─────────────────────────────────────────────────────────────────────────────
 * Tracks Open Interest (OI) as T-1 baseline data and calculates daily deltas
 * to infer position build-up/unwinding patterns.
 *
 * Functions:
 *   - loadOIHistory()     → Read history/oi.json (90-day retention)
 *   - saveOIHistory()     → Append today's OI snapshot
 *   - calculateOIDelta()  → Compare today vs yesterday, infer position flow
 *   - saveOIDelta()       → Write history/oi-delta.json
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const fs = require('fs');
const path = require('path');

const OI_RETENTION_DAYS = 90;

/**
 * Load OI history from history/oi.json
 * Returns: { symbol, lastUpdated, history: [{date, settlementDate, strikes: {...}}] }
 */
function loadOIHistory(reportsDir, symbol) {
  const historyDir = path.join(reportsDir, symbol, 'history');
  const oiFile = path.join(historyDir, 'oi.json');

  if (!fs.existsSync(oiFile)) {
    return { symbol, lastUpdated: null, history: [] };
  }

  try {
    return JSON.parse(fs.readFileSync(oiFile, 'utf8'));
  } catch (err) {
    console.error(`[OI] Failed to load ${symbol} OI history:`, err.message);
    return { symbol, lastUpdated: null, history: [] };
  }
}

/**
 * Save OI snapshot to history/oi.json
 * Maintains 90-day retention, auto-prunes old entries
 */
function saveOIHistory(reportsDir, symbol, date, contracts) {
  const historyDir = path.join(reportsDir, symbol, 'history');
  const oiFile = path.join(historyDir, 'oi.json');

  fs.mkdirSync(historyDir, { recursive: true });

  // Load existing history
  let data = loadOIHistory(reportsDir, symbol);

  // Build strikes map from contracts
  const strikes = {};
  for (const c of contracts) {
    if (!strikes[c.strike]) {
      strikes[c.strike] = { call_oi: 0, put_oi: 0 };
    }
    if (c.type === 'call') {
      strikes[c.strike].call_oi += c.openInterest || 0;
    } else if (c.type === 'put') {
      strikes[c.strike].put_oi += c.openInterest || 0;
    }
  }

  // Calculate settlement date (T-1)
  const today = new Date(date);
  const settlementDate = new Date(today);
  settlementDate.setDate(settlementDate.getDate() - 1);
  const settlementStr = settlementDate.toISOString().split('T')[0];

  // Remove existing entry for this date (in case of re-run)
  data.history = data.history.filter(h => h.date !== date);

  // Add new entry
  data.history.push({
    date,
    settlementDate: settlementStr,
    strikes
  });

  // Sort by date (newest first)
  data.history.sort((a, b) => b.date.localeCompare(a.date));

  // Prune old entries (keep last 90 days)
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - OI_RETENTION_DAYS);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];
  data.history = data.history.filter(h => h.date >= cutoffStr);

  // Update metadata
  data.lastUpdated = new Date().toISOString();

  // Save
  fs.writeFileSync(oiFile, JSON.stringify(data, null, 2));

  return data;
}

/**
 * Calculate OI delta (today vs yesterday)
 * Returns: { date, strikes: { [strike]: { call_oi, call_oi_prev, call_oi_change, ... } } }
 */
function calculateOIDelta(reportsDir, symbol, date, contracts, priceChange, volumeData) {
  const data = loadOIHistory(reportsDir, symbol);

  if (data.history.length < 2) {
    // Need at least 2 days to calculate delta
    return null;
  }

  // Get today and yesterday
  const todayEntry = data.history.find(h => h.date === date);
  const yesterdayEntry = data.history.find(h => h.date < date);

  if (!todayEntry || !yesterdayEntry) {
    return null;
  }

  const strikes = {};

  // Calculate deltas for each strike
  for (const [strikeStr, todayData] of Object.entries(todayEntry.strikes)) {
    const strike = parseFloat(strikeStr);
    const prevData = yesterdayEntry.strikes[strikeStr] || { call_oi: 0, put_oi: 0 };

    const call_oi_change = todayData.call_oi - prevData.call_oi;
    const put_oi_change = todayData.put_oi - prevData.put_oi;
    const net_change = call_oi_change - put_oi_change;

    const call_oi_change_pct = prevData.call_oi > 0
      ? (call_oi_change / prevData.call_oi) * 100
      : 0;
    const put_oi_change_pct = prevData.put_oi > 0
      ? (put_oi_change / prevData.put_oi) * 100
      : 0;

    // Infer signal from OI change
    let signal = 'neutral';
    if (call_oi_change > 100 && put_oi_change < -100) signal = 'bullish_build_up';
    else if (call_oi_change < -100 && put_oi_change > 100) signal = 'bearish_build_up';
    else if (call_oi_change > 100 && put_oi_change > 100) signal = 'straddle_build_up';
    else if (call_oi_change < -100 && put_oi_change < -100) signal = 'unwinding';

    // Get volume for this strike from contracts
    const strikeContracts = contracts.filter(c => c.strike === strike);
    const call_volume = strikeContracts.find(c => c.type === 'call')?.volume || 0;
    const put_volume = strikeContracts.find(c => c.type === 'put')?.volume || 0;

    // Infer position flow (price + volume analysis)
    let position_flow = inferPositionFlow(
      priceChange,
      volumeData?.volumeTrend || 'neutral',
      call_volume,
      put_volume,
      call_oi_change,
      put_oi_change
    );

    strikes[strikeStr] = {
      call_oi: todayData.call_oi,
      call_oi_prev: prevData.call_oi,
      call_oi_change: Math.round(call_oi_change),
      call_oi_change_pct: +call_oi_change_pct.toFixed(2),
      put_oi: todayData.put_oi,
      put_oi_prev: prevData.put_oi,
      put_oi_change: Math.round(put_oi_change),
      put_oi_change_pct: +put_oi_change_pct.toFixed(2),
      net_change: Math.round(net_change),
      signal,
      position_flow
    };
  }

  return {
    symbol,
    date,
    strikes
  };
}

/**
 * Infer position flow from price action + volume + OI changes
 */
function inferPositionFlow(priceChange, volumeTrend, callVol, putVol, callOIChange, putOIChange) {
  const priceUp = priceChange > 0.5;
  const priceDown = priceChange < -0.5;
  const volumeUp = volumeTrend === 'up' || (callVol + putVol) > 1000;
  const volumeDown = volumeTrend === 'down' || (callVol + putVol) < 500;

  let interpretation = 'neutral';
  let signal = 'neutral';

  // Price Up + Volume Up = Long build-up
  if (priceUp && volumeUp && callOIChange > 0) {
    interpretation = 'New long positions entering';
    signal = 'long_build_up';
  }
  // Price Down + Volume Up = Short build-up
  else if (priceDown && volumeUp && putOIChange > 0) {
    interpretation = 'New short positions entering';
    signal = 'short_build_up';
  }
  // Price Up + Volume Down = Short covering
  else if (priceUp && volumeDown && callOIChange < 0) {
    interpretation = 'Shorts covering positions';
    signal = 'short_covering';
  }
  // Price Down + Volume Down = Long unwinding
  else if (priceDown && volumeDown && putOIChange < 0) {
    interpretation = 'Longs exiting positions';
    signal = 'long_unwinding';
  }

  return {
    price_move: priceUp ? 'up' : priceDown ? 'down' : 'neutral',
    volume_trend: volumeUp ? 'up' : volumeDown ? 'down' : 'neutral',
    interpretation,
    signal
  };
}

/**
 * Save OI delta to history/oi-delta.json
 */
function saveOIDelta(reportsDir, symbol, deltaData) {
  if (!deltaData) return;

  const historyDir = path.join(reportsDir, symbol, 'history');
  const deltaFile = path.join(historyDir, 'oi-delta.json');

  fs.mkdirSync(historyDir, { recursive: true });

  // Load existing delta history (keep last 30 days)
  let history = [];
  if (fs.existsSync(deltaFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(deltaFile, 'utf8'));
      history = data.history || [];
    } catch (err) {
      console.error(`[OI] Failed to load ${symbol} delta history:`, err.message);
    }
  }

  // Remove existing entry for this date
  history = history.filter(h => h.date !== deltaData.date);

  // Add new entry
  history.push(deltaData);

  // Sort by date (newest first)
  history.sort((a, b) => b.date.localeCompare(a.date));

  // Keep last 30 days
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);
  const cutoffStr = cutoffDate.toISOString().split('T')[0];
  history = history.filter(h => h.date >= cutoffStr);

  // Save
  const output = {
    symbol,
    lastUpdated: new Date().toISOString(),
    history
  };

  fs.writeFileSync(deltaFile, JSON.stringify(output, null, 2));

  return output;
}

/**
 * Get OI confidence score based on data quality
 */
function getOIConfidence(contracts) {
  const withOI = contracts.filter(c => c.openInterest > 0).length;
  const totalContracts = contracts.length;

  if (totalContracts === 0) return 0;

  const coverage = withOI / totalContracts;

  // High coverage (>80%) = high confidence
  if (coverage >= 0.8) return 0.85 + (coverage - 0.8) * 0.75;
  // Medium coverage (50-80%) = medium confidence
  if (coverage >= 0.5) return 0.65 + (coverage - 0.5) * 0.67;
  // Low coverage (<50%) = low confidence
  return coverage * 1.3;
}

module.exports = {
  loadOIHistory,
  saveOIHistory,
  calculateOIDelta,
  saveOIDelta,
  getOIConfidence,
  inferPositionFlow
};
