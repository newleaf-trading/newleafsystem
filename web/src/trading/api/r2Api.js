/**
 * r2Api.js — R2 data fetcher + transformation layer
 *
 * Fetches from R2 via /r2/reports/{SYMBOL}/latest.json (proxied through server.cjs)
 * and transforms to the shapes the existing React components expect.
 */

import {
  calculateTrendScore,
  calculateVolatilityScore,
  calculateLevelScore,
  calculateTechnicalScore,
  suggestStrategy,
} from '../utils/technicalScoring';

// ── R2 public bucket URL ─────────────────────────────────────────────────────

const R2_BASE = 'https://pub-04bbb919022645b3a3f318b2ebdf48c0.r2.dev';

// ── In-memory cache (30s TTL per symbol) ─────────────────────────────────────

const cache = new Map();
const CACHE_TTL = 30_000;

/**
 * Fetch a symbol's latest report from R2.
 * Uses the public R2 URL directly (works on both localhost and production).
 * Cached for 30s to avoid redundant fetches when AnalysisPage calls both
 * gamma and technical in quick succession.
 */
export async function fetchR2Report(symbol) {
  const key = symbol.toUpperCase();
  const cached = cache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.data;
  }

  const url = `${R2_BASE}/reports/${key}/latest.json`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`R2 fetch failed: ${res.status} for ${key}`);
  const data = await res.json();

  cache.set(key, { data, fetchedAt: Date.now() });
  return data;
}

// ── Gamma data transformation ────────────────────────────────────────────────

/**
 * Transform R2 report into the flat shape that gamma-tab components expect.
 * Components read: data.spot, data.put_wall, data.call_wall, data.center,
 * data.gamma_flip, data.top_strikes[], data.condor_allowed, etc.
 */
export function transformToGammaData(r2) {
  const analysis = r2.gammaData?.analysis || {};
  const condorGate = r2.gammaData?.condorGate || {};
  const spot = r2.snapshot?.price || 0;
  const putWall = analysis.put_wall || 0;
  const callWall = analysis.call_wall || 0;

  // Build top_strikes from R2's topStrikes + enrich with optionChain aggregates
  const chain = r2.optionChain || [];

  // Aggregate option chain by strike for richer data
  const chainByStrike = {};
  for (const c of chain) {
    const k = c.strike;
    if (!chainByStrike[k]) chainByStrike[k] = { callOi: 0, putOi: 0, callVol: 0, putVol: 0, callGex: 0, putGex: 0, expiries: new Set() };
    const agg = chainByStrike[k];
    if (c.type === 'call') {
      agg.callOi += c.openInterest || 0;
      agg.callVol += c.volume || 0;
      agg.callGex += (c.gamma || 0) * (c.openInterest || 0) * spot * spot * 0.01;
    } else {
      agg.putOi += c.openInterest || 0;
      agg.putVol += c.volume || 0;
      agg.putGex -= (c.gamma || 0) * (c.openInterest || 0) * spot * spot * 0.01;
    }
    agg.expiries.add(c.expiry);
  }

  const topStrikes = (analysis.topStrikes || []).map(s => {
    const agg = chainByStrike[s.strike] || {};
    const callOi = agg.callOi || s.call_oi || 0;
    const putOi = agg.putOi || s.put_oi || 0;
    const callVol = agg.callVol || s.call_volume || 0;
    const putVol = agg.putVol || s.put_volume || 0;
    const callGex = agg.callGex || (s.gamma_exposure > 0 ? s.gamma_exposure : 0);
    const putGex = agg.putGex || (s.gamma_exposure < 0 ? s.gamma_exposure : 0);
    return {
      strike: s.strike,
      netGex: callGex + putGex || s.gamma_exposure || 0,
      callGex,
      putGex,
      callOi,
      putOi,
      callVolume: callVol,
      putVolume: putVol,
      distPct: spot ? parseFloat((((s.strike - spot) / spot) * 100).toFixed(1)) : 0,
      expiries: agg.expiries?.size || 1,
      score: s.multi_factor_score || 0,
    };
  });

  // Find wall OI from topStrikes
  const putWallStrike = topStrikes.find(s => s.strike === putWall);
  const callWallStrike = topStrikes.find(s => s.strike === callWall);

  return {
    spot,
    ticker: r2.meta?.symbol || '',
    put_wall: putWall,
    call_wall: callWall,
    center: putWall && callWall ? parseFloat(((putWall + callWall) / 2).toFixed(2)) : spot,
    gamma_flip: analysis.gamma_flip || spot,
    band_width_pct: analysis.band_width_pct || 0,
    position_in_band_pct: analysis.position_in_band_pct || 50,
    confidence_score: analysis.confidence_score || 0,
    condor_allowed: condorGate.condorAllowed || false,
    band_width: callWall && putWall ? callWall - putWall : 0,
    top_strikes: topStrikes,
    walls: {
      put: { strike: putWall, oi: putWallStrike?.putOi || 0, score: putWallStrike?.score || 0 },
      call: { strike: callWall, oi: callWallStrike?.callOi || 0, score: callWallStrike?.score || 0 },
    },
    condorGate: {
      condorAllowed: condorGate.condorAllowed || false,
      summary: condorGate.condorAllowed ? 'Condor setup available' : 'Condor entry not recommended',
      reasons: condorGate.condorAllowed ? [] : [{ rule: 'pipeline_check', detail: 'Pipeline condor gate blocked entry' }],
      notes: [],
      suggestedStrikes: condorGate.suggestedStrikes || null,
    },
    decision: {
      condorAllowed: condorGate.condorAllowed || false,
      summary: condorGate.condorAllowed ? 'Condor setup available' : 'Condor entry not recommended',
      reasons: condorGate.condorAllowed ? [] : ['Pipeline condor gate blocked entry'],
      notes: [],
      suggestedStrikes: condorGate.suggestedStrikes || null,
    },
    earnings_check: {
      hasEarnings: !!r2.earningsDate,
      earningsDate: r2.earningsDate || null,
      source: 'r2',
    },
    // IV data
    ivData: r2.gammaData?.ivData || {},
    meta: {
      generated_at: r2.meta?.generatedAt || new Date().toISOString(),
      contracts_analyzed: analysis.contracts_analyzed || 0,
      dte_range: analysis.dte_range || {},
      expiry_set: r2.optionChain
        ? [...new Set(r2.optionChain.map(c => c.expiry))].sort()
        : [],
    },
  };
}

// ── Technical data transformation ────────────────────────────────────────────

/**
 * Compute rolling SMA from an array of close prices.
 */
function computeRollingSMA(closes, period) {
  return closes.map((_, i) => {
    if (i < period - 1) return null;
    const slice = closes.slice(i - period + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / period;
  });
}

/**
 * Transform R2 report into the shape that technical-tab components expect.
 * Uses existing scoring functions from technicalScoring.js.
 */
export function transformToTechnicalData(r2) {
  const td = r2.technicalData || {};
  const spot = r2.snapshot?.price || 0;
  const sma50 = td.sma50 || spot * 0.97;
  const sma100 = td.sma100 || spot * 0.94;
  const bb = td.bb || {};
  const sr = td.sr || {};

  // Compute engines using existing scoring functions
  const trendEngine = {
    ...calculateTrendScore(sma50, sma100, spot),
    sma50,
    sma100,
  };

  const upperBand = bb.upper || spot * 1.06;
  const middleBand = bb.middle || spot;
  const lowerBand = bb.lower || spot * 0.94;

  const volatilityEngine = {
    ...calculateVolatilityScore(spot, upperBand, middleBand, lowerBand),
    upperBand,
    middleBand,
    lowerBand,
  };

  const support1 = sr.support1 || spot * 0.95;
  const resistance1 = sr.resistance1 || spot * 1.05;

  const levelEngine = {
    ...calculateLevelScore(spot, support1, resistance1),
    support1,
    resistance1,
  };

  const techScoreResult = calculateTechnicalScore(
    trendEngine.score,
    volatilityEngine.score,
    levelEngine.score
  );

  const recommendation = suggestStrategy(trendEngine, volatilityEngine, levelEngine, techScoreResult.score);

  // Build priceHistory by merging OHLCV + BB series
  const rawHistory = td.priceHistory || [];
  const bbSeries = td.bbSeries || [];
  const bbMap = new Map(bbSeries.map(b => [b.t, b]));

  // Compute rolling SMAs from close prices
  const closes = rawHistory.map(bar => bar.c);
  const sma50Series = computeRollingSMA(closes, 50);
  const sma100Series = computeRollingSMA(closes, 100);

  const priceHistory = rawHistory.map((bar, i) => {
    const bbEntry = bbMap.get(bar.t);
    return {
      date: bar.t,
      price: bar.c,
      open: bar.o,
      high: bar.h,
      low: bar.l,
      volume: bar.v,
      sma50: sma50Series[i],
      sma100: sma100Series[i],
      upperBand: bbEntry?.upper || null,
      middleBand: bbEntry?.middle || null,
      lowerBand: bbEntry?.lower || null,
    };
  });

  return {
    spot,
    rsi: td.rsi || 50,
    rsiSeries: td.rsiSeries || [],
    trendEngine,
    volatilityEngine,
    levelEngine,
    techScore: techScoreResult.score,
    techState: techScoreResult.label,
    recommendation,
    priceHistory,
    // Raw values for reference
    aboveSMA50: td.aboveSMA50 ?? (spot > sma50),
    aboveSMA100: td.aboveSMA100 ?? (spot > sma100),
    realizedVol30d: td.realizedVol30d || null,
    atrPct: td.atrPct || null,
  };
}

// ── Price fetcher for PriceContext ────────────────────────────────────────────

/**
 * Fetch prices for multiple symbols from R2.
 * Returns { [symbol]: { symbol, price, change, changePercent, ... } }
 */
export async function fetchR2Prices(symbols) {
  const results = {};
  await Promise.allSettled(
    symbols.map(async (symbol) => {
      try {
        const r2 = await fetchR2Report(symbol);
        const snap = r2.snapshot || {};
        results[symbol.toUpperCase()] = {
          symbol: symbol.toUpperCase(),
          price: snap.price || 0,
          change: snap.change || 0,
          changePercent: snap.changePercent || 0,
          volume: snap.volume || 0,
          previousClose: snap.prevClose || 0,
          open: snap.open || 0,
          dayHigh: snap.high || 0,
          dayLow: snap.low || 0,
          lastUpdated: r2.meta?.generatedAt || new Date().toISOString(),
          marketState: 'REGULAR',
        };
      } catch (err) {
        console.warn(`[r2Api] Price fetch failed for ${symbol}:`, err.message);
      }
    })
  );
  return results;
}

// ── Live option chain from newleaf-api (Alpaca) ─────────────────────────────

const NL_API = 'https://us-central1-newleaf-trading.cloudfunctions.net/api';
const NL_KEY = 'nl_31ee32be43bd4f07a3520ae15c4b3162';

const chainCache = new Map();
const CHAIN_TTL = 60_000; // 60s

/**
 * Fetch live option chain for a symbol+expiry from newleaf-api.
 * Returns array of { strike, type, expiry, mid, bid, ask, iv, delta, gamma, theta, vega }.
 * Cached for 60s per symbol+expiry.
 */
export async function fetchLiveChain(symbol, expiry) {
  if (!symbol || !expiry) return null;
  const key = `${symbol.toUpperCase()}:${expiry}`;
  const cached = chainCache.get(key);
  if (cached && Date.now() - cached.fetchedAt < CHAIN_TTL) return cached.data;

  try {
    const res = await fetch(`${NL_API}/api/chain/${symbol.toUpperCase()}/${expiry}`, {
      headers: { 'x-api-key': NL_KEY },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const strikes = json.strikes || [];

    // Flatten strike map into array matching matchOptionLeg format
    const contracts = [];
    for (const s of strikes) {
      if (s.call) contracts.push({ strike: s.strike, type: 'call', expiry, mid: s.call.mid, bid: s.call.bid, ask: s.call.ask, iv: s.call.iv, delta: s.call.delta, gamma: s.call.gamma, theta: s.call.theta, vega: s.call.vega });
      if (s.put) contracts.push({ strike: s.strike, type: 'put', expiry, mid: s.put.mid, bid: s.put.bid, ask: s.put.ask, iv: s.put.iv, delta: s.put.delta, gamma: s.put.gamma, theta: s.put.theta, vega: s.put.vega });
    }

    chainCache.set(key, { data: contracts, fetchedAt: Date.now() });
    return contracts;
  } catch (err) {
    console.warn(`[r2Api] Live chain fetch failed for ${key}:`, err.message);
    return null;
  }
}

// ── Option leg matcher for portfolio P&L ─────────────────────────────────────

/**
 * Find the current mid-price for a specific option leg from R2's option chain.
 * Returns mid price or null if not found.
 */
export function matchOptionLeg(optionChain, strike, expiry, type) {
  if (!optionChain || !Array.isArray(optionChain)) return null;
  if (!expiry) return null; // Never match without expiry — wrong expiry = wrong price

  const normalizedType = (type || '').toLowerCase();
  const numStrike = Number(strike);

  const match = optionChain.find(c =>
    Number(c.strike) === numStrike &&
    c.type === normalizedType &&
    c.expiry === expiry
  );

  return match ? match.mid : null;
}
