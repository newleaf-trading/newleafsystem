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
