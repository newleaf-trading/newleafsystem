/**
 * Open Interest data — primary source: Yahoo OI Service (Cloud Run),
 * fallback: Nasdaq.com scraping.
 *
 * The Yahoo OI Service lives at services/yahoo-oi/ and is deployed to
 * Cloud Run. It provides real OI from yfinance (Yahoo Finance blocks
 * direct Node.js calls, so a Python wrapper is required).
 *
 * Exports are unchanged from the original nasdaq-oi.ts so all consumers
 * (routes/market.ts, routes/ai.ts, tools/market-data.ts) work without changes.
 */

import type { OptionContract } from './alpaca.js';

const YAHOO_OI_URL = process.env.YAHOO_OI_URL || 'https://yahoo-options-svc-m2cty2vxuq-uc.a.run.app';

/** Option contract enriched with the fields the gamma engine + leg builder need. */
export type EnrichedContract = OptionContract & { openInterest: number; dte: number; expiry: string };

export interface StrikeOI {
  strike: number;
  expiry: string;
  callOI: number;
  putOI: number;
  callVolume: number;
  putVolume: number;
  callIv?: number | null;
  putIv?: number | null;
}

export interface OIChain {
  ticker: string;
  expiry: string;
  strikes: StrikeOI[];
  fetchedAt: string;
}

// ── Primary: Yahoo OI Service (Cloud Run) ───────────────────────────────────

async function fetchYahooExpiries(ticker: string): Promise<string[]> {
  const url = `${YAHOO_OI_URL}/api/options/${ticker.toUpperCase()}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Yahoo OI Service (expiries) ${res.status}`);
  const data = await res.json() as any;
  return (data.expirations || []) as string[];
}

function nearestExpiry(target: string, available: string[]): string | null {
  if (!available.length) return null;
  const t = new Date(`${target}T00:00:00Z`).getTime();
  let best: string | null = null, bestDiff = Infinity;
  for (const e of available) {
    const diff = Math.abs(new Date(`${e}T00:00:00Z`).getTime() - t);
    if (diff < bestDiff) { bestDiff = diff; best = e; }
  }
  return best;
}

async function fetchYahooChain(ticker: string, expiry: string): Promise<any> {
  const url = `${YAHOO_OI_URL}/api/options/${ticker.toUpperCase()}/${expiry}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Yahoo OI Service ${res.status}: ${url}`);
  const data = await res.json() as any;
  if (data.error) throw new Error(`Yahoo OI Service: ${String(data.error).slice(0, 120)}`);
  return data;
}

// Alpaca and Yahoo can disagree on the exact expiry date around holidays (e.g. Alpaca lists
// the nominal Friday 2026-07-03 while Yahoo lists the actual last trading day 2026-07-02).
// On a "cannot be found" miss, snap to the nearest available Yahoo expiry — strikes still
// align, so the per-strike merge downstream is unaffected.
async function fetchYahooChainWithSnap(ticker: string, expiry: string): Promise<any> {
  try {
    return await fetchYahooChain(ticker, expiry);
  } catch (err) {
    const expiries = await fetchYahooExpiries(ticker);
    const near = nearestExpiry(expiry, expiries);
    if (!near || near === expiry) throw err;
    console.warn(`[OI] Yahoo expiry ${expiry} not found for ${ticker}; snapping to nearest ${near}`);
    return await fetchYahooChain(ticker, near);
  }
}

/**
 * Build a full option chain from the Yahoo OI service (strikes, bid/ask/mid, IV, OI, volume).
 * Used when Alpaca's indicative feed returns an empty/sparse chain — Yahoo has the complete
 * chain including the greeks inputs (IV) and OI that Alpaca's indicative feed lacks.
 */
export async function fetchYahooContracts(ticker: string, expiry: string, dte: number): Promise<EnrichedContract[]> {
  const data = await fetchYahooChainWithSnap(ticker, expiry);
  const yymmdd = expiry.slice(2).replace(/-/g, '');
  const map = (c: any, type: 'call' | 'put'): EnrichedContract => {
    const bid = c.bid ?? 0, ask = c.ask ?? 0;
    const mid = c.midPrice ?? +(((bid + ask) / 2)).toFixed(2);
    const strikeCode = String(Math.round((c.strike ?? 0) * 1000)).padStart(8, '0');
    return {
      occ: `${ticker.toUpperCase()}${yymmdd}${type === 'call' ? 'C' : 'P'}${strikeCode}`,
      type,
      strike: c.strike,
      iv: (c.impliedVolatility != null && c.impliedVolatility > 0) ? c.impliedVolatility : null,
      delta: null, gamma: null, theta: null, vega: null,
      bid, ask, mid,
      volume: c.volume ?? 0,
      openInterest: c.openInterest ?? 0,
      dte, expiry,
    };
  };
  const out: EnrichedContract[] = [];
  for (const c of (data.calls || [])) out.push(map(c, 'call'));
  for (const p of (data.puts || [])) out.push(map(p, 'put'));
  return out.sort((a, b) => a.strike - b.strike || (a.type === 'call' ? -1 : 1));
}

async function fetchFromYahooSvc(ticker: string, expiry: string): Promise<OIChain> {
  const data = await fetchYahooChainWithSnap(ticker, expiry);

  const calls: any[] = data.calls || [];
  const puts: any[] = data.puts || [];

  // Merge calls + puts into per-strike records (carry IV — Alpaca's indicative feed has none)
  const strikeMap = new Map<number, StrikeOI>();

  for (const c of calls) {
    const strike = c.strike;
    if (!strikeMap.has(strike)) {
      strikeMap.set(strike, { strike, expiry, callOI: 0, putOI: 0, callVolume: 0, putVolume: 0, callIv: null, putIv: null });
    }
    const s = strikeMap.get(strike)!;
    s.callOI += c.openInterest || 0;
    s.callVolume += c.volume || 0;
    if (c.impliedVolatility != null && c.impliedVolatility > 0) s.callIv = c.impliedVolatility;
  }

  for (const p of puts) {
    const strike = p.strike;
    if (!strikeMap.has(strike)) {
      strikeMap.set(strike, { strike, expiry, callOI: 0, putOI: 0, callVolume: 0, putVolume: 0, callIv: null, putIv: null });
    }
    const s = strikeMap.get(strike)!;
    s.putOI += p.openInterest || 0;
    s.putVolume += p.volume || 0;
    if (p.impliedVolatility != null && p.impliedVolatility > 0) s.putIv = p.impliedVolatility;
  }

  const strikes = [...strikeMap.values()].sort((a, b) => a.strike - b.strike);
  return { ticker: ticker.toUpperCase(), expiry, strikes, fetchedAt: new Date().toISOString() };
}

// ── Fallback: Nasdaq.com scraping ───────────────────────────────────────────

async function fetchFromNasdaq(ticker: string, expiry: string): Promise<OIChain> {
  const url = `https://api.nasdaq.com/api/quote/${ticker.toUpperCase()}/option-chain?assetclass=stocks&limit=200&expireDate=${expiry}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`Nasdaq API ${res.status}`);
  const json = await res.json() as any;

  const rows = json?.data?.table?.rows ?? [];
  const strikes: StrikeOI[] = [];

  for (const row of rows) {
    if (!row.strike) continue;
    const strike = parseFloat(row.strike);
    if (isNaN(strike)) continue;

    const callOI = parseOI(row.c_Openinterest);
    const putOI = parseOI(row.p_Openinterest);
    const callVolume = parseOI(row.c_Volume);
    const putVolume = parseOI(row.p_Volume);

    const existing = strikes.find(s => s.strike === strike);
    if (existing) {
      existing.callOI += callOI;
      existing.putOI += putOI;
      existing.callVolume += callVolume;
      existing.putVolume += putVolume;
    } else {
      strikes.push({ strike, expiry, callOI, putOI, callVolume, putVolume });
    }
  }

  strikes.sort((a, b) => a.strike - b.strike);
  return { ticker: ticker.toUpperCase(), expiry, strikes, fetchedAt: new Date().toISOString() };
}

function parseOI(val: unknown): number {
  if (typeof val === 'number') return val;
  if (typeof val === 'string') {
    const n = parseInt(val.replace(/,/g, ''), 10);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

// ── Public API (unchanged exports) ──────────────────────────────────────────

/**
 * Fetch OI data. Primary: Yahoo OI Service (Cloud Run). Fallback: Nasdaq scraping.
 */
export async function fetchNasdaqOI(ticker: string, expiry: string): Promise<OIChain> {
  try {
    return await fetchFromYahooSvc(ticker, expiry);
  } catch (yahooErr: any) {
    console.warn(`[OI] Yahoo OI Service failed for ${ticker}/${expiry}: ${yahooErr.message}. Falling back to Nasdaq.`);
    return fetchFromNasdaq(ticker, expiry);
  }
}

/** Identify gamma walls — strikes with outsized OI concentration */
export function findGammaWalls(chain: OIChain, spotPrice: number, topN = 5): {
  walls: { strike: number; totalOI: number; side: 'call' | 'put' | 'both'; strength: number }[];
  putWallStrike: number | null;
  callWallStrike: number | null;
  spotInsideBand: boolean;
} {
  const withTotal = chain.strikes.map(s => ({
    ...s,
    totalOI: s.callOI + s.putOI,
    netGamma: s.callOI - s.putOI,
  }));

  const maxOI = Math.max(...withTotal.map(s => s.totalOI), 1);

  const sorted = [...withTotal].sort((a, b) => b.totalOI - a.totalOI);
  const walls = sorted.slice(0, topN).map(s => ({
    strike: s.strike,
    totalOI: s.totalOI,
    side: (s.callOI > s.putOI * 2 ? 'call' : s.putOI > s.callOI * 2 ? 'put' : 'both') as 'call' | 'put' | 'both',
    strength: +(s.totalOI / maxOI).toFixed(2),
  }));

  const putWalls = withTotal.filter(s => s.strike < spotPrice && s.putOI > 0).sort((a, b) => b.putOI - a.putOI);
  const callWalls = withTotal.filter(s => s.strike > spotPrice && s.callOI > 0).sort((a, b) => b.callOI - a.callOI);

  const putWallStrike = putWalls[0]?.strike ?? null;
  const callWallStrike = callWalls[0]?.strike ?? null;

  const spotInsideBand = putWallStrike !== null && callWallStrike !== null &&
    spotPrice > putWallStrike && spotPrice < callWallStrike;

  return { walls, putWallStrike, callWallStrike, spotInsideBand };
}

// ── Full Gamma Analysis (computed from Yahoo OI Service, no R2) ─────────

export interface GammaAnalysis {
  oiWalls: { putStrike: number | null; callStrike: number | null };
  gexWalls: { putStrike: number | null; callStrike: number | null };
  bandWidthPct: number;
  positionInBandPct: number;
  confidenceScore: number;
  oiConfidence: number;
  volumeConfidence: number;
  deltaConfidence: number;
  contractsAnalyzed: number;
  atmIv: number | null;
  ivLevel: string;
  topStrikes: { strike: number; gammaExposure: number; callOI: number; putOI: number; callVolume: number; putVolume: number }[];
  spotInsideBand: boolean;
}

/**
 * Compute full gamma analysis from Yahoo OI Service.
 * No R2 dependency — works for ANY optionable ticker.
 */
export async function fetchFullGammaAnalysis(ticker: string, expiry: string, spotPrice: number): Promise<GammaAnalysis> {
  const url = `${YAHOO_OI_URL}/api/options/${ticker.toUpperCase()}/${expiry}`;

  // Retry up to 2 times — Yahoo/yfinance rate-limits frequent calls
  let data: any;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) {
        if (attempt < 2) { await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); continue; }
        throw new Error(`Yahoo OI Service ${res.status}: ${url}`);
      }
      data = await res.json();
      break;
    } catch (err: any) {
      if (attempt < 2) { await new Promise(r => setTimeout(r, 1000 * (attempt + 1))); continue; }
      throw err;
    }
  }

  const calls: any[] = data.calls || [];
  const puts: any[] = data.puts || [];
  const spot = spotPrice || data.currentPrice || 0;

  // Black-Scholes gamma: N'(d1) / (S * σ * √T)
  // where d1 = [ln(S/K) + (σ²/2)*T] / (σ*√T), N'(x) = (1/√2π)*e^(-x²/2)
  const daysToExpiry = Math.max(1, Math.round((new Date(expiry).getTime() - Date.now()) / 86400000));
  const T = daysToExpiry / 365;
  const sqrtT = Math.sqrt(T);
  const sqrt2pi = Math.sqrt(2 * Math.PI);

  function bsGamma(strike: number, iv: number): number {
    if (!iv || iv <= 0 || !spot || spot <= 0 || !strike || strike <= 0) return 0;
    const sigma = iv; // already decimal (e.g. 0.35)
    const denom = sigma * sqrtT;
    if (denom <= 0 || !isFinite(denom)) return 0;
    try {
      const d1 = (Math.log(spot / strike) + (sigma * sigma / 2) * T) / denom;
      if (!isFinite(d1)) return 0;
      const nPrimeD1 = Math.exp(-d1 * d1 / 2) / sqrt2pi;
      const gamma = nPrimeD1 / (spot * denom);
      return isFinite(gamma) ? gamma : 0;
    } catch { return 0; }
  }

  // Build per-strike analysis with proper BS gamma
  const strikeMap = new Map<number, {
    strike: number; callOI: number; putOI: number;
    callVolume: number; putVolume: number;
    callIV: number; putIV: number;
    callGex: number; putGex: number; netGex: number;
    gammaExposure: number;
  }>();

  for (const c of calls) {
    const s = c.strike;
    if (!strikeMap.has(s)) strikeMap.set(s, { strike: s, callOI: 0, putOI: 0, callVolume: 0, putVolume: 0, callIV: 0, putIV: 0, callGex: 0, putGex: 0, netGex: 0, gammaExposure: 0 });
    const entry = strikeMap.get(s)!;
    entry.callOI = c.openInterest || 0;
    entry.callVolume = c.volume || 0;
    entry.callIV = c.impliedVolatility || 0;
    const gamma = bsGamma(s, c.impliedVolatility || 0);
    const size = (c.openInterest || 0) > 0 ? c.openInterest : (c.volume || 0);
    const gex = gamma * size * spot * spot * 0.01;
    entry.callGex += gex;
    entry.gammaExposure += gex;
  }

  for (const p of puts) {
    const s = p.strike;
    if (!strikeMap.has(s)) strikeMap.set(s, { strike: s, callOI: 0, putOI: 0, callVolume: 0, putVolume: 0, callIV: 0, putIV: 0, callGex: 0, putGex: 0, netGex: 0, gammaExposure: 0 });
    const entry = strikeMap.get(s)!;
    entry.putOI = p.openInterest || 0;
    entry.putVolume = p.volume || 0;
    entry.putIV = p.impliedVolatility || 0;
    const gamma = bsGamma(s, p.impliedVolatility || 0);
    const size = (p.openInterest || 0) > 0 ? p.openInterest : (p.volume || 0);
    const gex = gamma * size * spot * spot * 0.01;
    entry.putGex -= gex; // negative for puts (dealers buy when price falls)
    entry.gammaExposure += gex; // absolute for wall detection
  }

  // Compute netGex for each strike
  for (const entry of strikeMap.values()) {
    entry.netGex = entry.callGex + entry.putGex;
  }

  const strikes = [...strikeMap.values()].sort((a, b) => a.strike - b.strike);
  const contractsAnalyzed = calls.length + puts.length;

  // OI walls (raw OI concentration)
  const putSideOI = strikes.filter(s => s.strike < spot).sort((a, b) => b.putOI - a.putOI);
  const callSideOI = strikes.filter(s => s.strike > spot).sort((a, b) => b.callOI - a.callOI);
  const oiWalls = {
    putStrike: putSideOI[0]?.strike ?? null,
    callStrike: callSideOI[0]?.strike ?? null,
  };

  // GEX walls (gamma-weighted)
  const putSideGEX = strikes.filter(s => s.strike < spot && s.putOI > s.callOI).sort((a, b) => b.gammaExposure - a.gammaExposure);
  const callSideGEX = strikes.filter(s => s.strike > spot && s.callOI > s.putOI).sort((a, b) => b.gammaExposure - a.gammaExposure);
  const gexWalls = {
    putStrike: putSideGEX[0]?.strike ?? oiWalls.putStrike,
    callStrike: callSideGEX[0]?.strike ?? oiWalls.callStrike,
  };

  // Band metrics
  const pw = gexWalls.putStrike ?? spot * 0.95;
  const cw = gexWalls.callStrike ?? spot * 1.05;
  const bandWidthPct = spot > 0 ? ((cw - pw) / spot) * 100 : 0;
  const positionInBandPct = (cw - pw) > 0 ? Math.round(((spot - pw) / (cw - pw)) * 100) : 50;
  const spotInsideBand = spot > pw && spot < cw;

  // Confidence scores
  const totalOI = strikes.reduce((s, x) => s + x.callOI + x.putOI, 0);
  const totalVolume = strikes.reduce((s, x) => s + x.callVolume + x.putVolume, 0);
  const oiConfidence = Math.min(1, totalOI / 5000); // normalize to 5k OI
  const volumeConfidence = Math.min(1, totalVolume / 2000);
  // Delta confidence: how concentrated is OI near the walls vs spread thin
  const wallOI = (putSideOI[0]?.putOI || 0) + (callSideOI[0]?.callOI || 0);
  const deltaConfidence = totalOI > 0 ? Math.min(1, (wallOI / totalOI) * 3) : 0;
  const confidenceScore = oiConfidence * 0.5 + volumeConfidence * 0.2 + deltaConfidence * 0.3;

  // ATM IV: find the nearest-to-money call + put, average their IV
  const sortedByDist = strikes.map(s => ({ ...s, dist: Math.abs(s.strike - spot) })).sort((a, b) => a.dist - b.dist);
  const atm = sortedByDist[0];
  let atmIv: number | null = null;
  if (atm) {
    const ivs = [atm.callIV, atm.putIV].filter(v => v > 0);
    atmIv = ivs.length ? +(ivs.reduce((a, b) => a + b, 0) / ivs.length * 100).toFixed(1) : null;
  }
  const ivLevel = atmIv ? (atmIv > 50 ? 'high' : atmIv > 25 ? 'normal' : 'low') : 'unknown';

  // Top strikes by gamma exposure (with call/put/net GEX)
  const topStrikes = [...strikes]
    .sort((a, b) => b.gammaExposure - a.gammaExposure)
    .slice(0, 20)
    .map(s => ({
      strike: s.strike,
      gammaExposure: +s.gammaExposure.toFixed(0),
      callGex: +s.callGex.toFixed(0),
      putGex: +s.putGex.toFixed(0),
      netGex: +s.netGex.toFixed(0),
      callOI: s.callOI,
      putOI: s.putOI,
      callVolume: s.callVolume,
      putVolume: s.putVolume,
    }));

  return {
    oiWalls, gexWalls,
    bandWidthPct: +bandWidthPct.toFixed(1),
    positionInBandPct,
    confidenceScore: +confidenceScore.toFixed(3),
    oiConfidence: +oiConfidence.toFixed(3),
    volumeConfidence: +volumeConfidence.toFixed(3),
    deltaConfidence: +deltaConfidence.toFixed(3),
    contractsAnalyzed,
    atmIv, ivLevel,
    topStrikes,
    spotInsideBand,
  };
}
