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

const YAHOO_OI_URL = process.env.YAHOO_OI_URL || 'https://yahoo-options-svc-m2cty2vxuq-uc.a.run.app';

export interface StrikeOI {
  strike: number;
  expiry: string;
  callOI: number;
  putOI: number;
  callVolume: number;
  putVolume: number;
}

export interface OIChain {
  ticker: string;
  expiry: string;
  strikes: StrikeOI[];
  fetchedAt: string;
}

// ── Primary: Yahoo OI Service (Cloud Run) ───────────────────────────────────

async function fetchFromYahooSvc(ticker: string, expiry: string): Promise<OIChain> {
  const url = `${YAHOO_OI_URL}/api/options/${ticker.toUpperCase()}/${expiry}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Yahoo OI Service ${res.status}: ${url}`);
  const data = await res.json() as any;

  const calls: any[] = data.calls || [];
  const puts: any[] = data.puts || [];

  // Merge calls + puts into per-strike records
  const strikeMap = new Map<number, StrikeOI>();

  for (const c of calls) {
    const strike = c.strike;
    if (!strikeMap.has(strike)) {
      strikeMap.set(strike, { strike, expiry, callOI: 0, putOI: 0, callVolume: 0, putVolume: 0 });
    }
    const s = strikeMap.get(strike)!;
    s.callOI += c.openInterest || 0;
    s.callVolume += c.volume || 0;
  }

  for (const p of puts) {
    const strike = p.strike;
    if (!strikeMap.has(strike)) {
      strikeMap.set(strike, { strike, expiry, callOI: 0, putOI: 0, callVolume: 0, putVolume: 0 });
    }
    const s = strikeMap.get(strike)!;
    s.putOI += p.openInterest || 0;
    s.putVolume += p.volume || 0;
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
  const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Yahoo OI Service ${res.status}: ${url}`);
  const data = await res.json() as any;

  const calls: any[] = data.calls || [];
  const puts: any[] = data.puts || [];
  const spot = spotPrice || data.currentPrice || 0;

  // Build per-strike analysis
  const strikeMap = new Map<number, {
    strike: number; callOI: number; putOI: number;
    callVolume: number; putVolume: number;
    callIV: number; putIV: number;
    callDelta: number; putDelta: number;
    gammaExposure: number;
  }>();

  for (const c of calls) {
    const s = c.strike;
    if (!strikeMap.has(s)) strikeMap.set(s, { strike: s, callOI: 0, putOI: 0, callVolume: 0, putVolume: 0, callIV: 0, putIV: 0, callDelta: 0, putDelta: 0, gammaExposure: 0 });
    const entry = strikeMap.get(s)!;
    entry.callOI = c.openInterest || 0;
    entry.callVolume = c.volume || 0;
    entry.callIV = c.impliedVolatility || 0;
    // Approximate gamma from IV + moneyness (Black-Scholes gamma approximation)
    const moneyness = Math.abs(Math.log(spot / s));
    const approxGamma = moneyness < 0.3 ? 0.01 * (1 - moneyness * 3) : 0.001;
    entry.gammaExposure += (c.openInterest || 0) * approxGamma * spot * spot * 0.01;
  }

  for (const p of puts) {
    const s = p.strike;
    if (!strikeMap.has(s)) strikeMap.set(s, { strike: s, callOI: 0, putOI: 0, callVolume: 0, putVolume: 0, callIV: 0, putIV: 0, callDelta: 0, putDelta: 0, gammaExposure: 0 });
    const entry = strikeMap.get(s)!;
    entry.putOI = p.openInterest || 0;
    entry.putVolume = p.volume || 0;
    entry.putIV = p.impliedVolatility || 0;
    const moneyness = Math.abs(Math.log(spot / s));
    const approxGamma = moneyness < 0.3 ? 0.01 * (1 - moneyness * 3) : 0.001;
    entry.gammaExposure += (p.openInterest || 0) * approxGamma * spot * spot * 0.01;
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

  // Top strikes by gamma exposure
  const topStrikes = [...strikes]
    .sort((a, b) => b.gammaExposure - a.gammaExposure)
    .slice(0, 20)
    .map(s => ({
      strike: s.strike,
      gammaExposure: +s.gammaExposure.toFixed(0),
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
