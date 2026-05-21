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

export async function fetchNasdaqOI(ticker: string, expiry: string): Promise<OIChain> {
  // Nasdaq expects date as YYYY-MM-DD
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

  // Nasdaq returns rows with expirygroup headers (strike=null) mixed with data rows
  // Also may return multiple expiries — filter to match our target
  for (const row of rows) {
    if (!row.strike) continue;
    const strike = parseFloat(row.strike);
    if (isNaN(strike)) continue;

    // Check if this row's expiry matches (Nasdaq uses "May 16" format)
    // We'll collect all strikes since we filtered by expireDate param
    const callOI = parseOI(row.c_Openinterest);
    const putOI = parseOI(row.p_Openinterest);
    const callVolume = parseOI(row.c_Volume);
    const putVolume = parseOI(row.p_Volume);

    // Merge with existing strike if duplicate (Nasdaq sometimes returns multiple expiry groups)
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
    const cleaned = val.replace(/,/g, '');
    const n = parseInt(cleaned, 10);
    return isNaN(n) ? 0 : n;
  }
  return 0;
}

/** Identify gamma walls — strikes with outsized OI concentration */
export function findGammaWalls(chain: OIChain, spotPrice: number, topN = 5): {
  walls: { strike: number; totalOI: number; side: 'call' | 'put' | 'both'; strength: number }[];
  putWallStrike: number | null;
  callWallStrike: number | null;
  spotInsideBand: boolean;
} {
  // Calculate total OI per strike
  const withTotal = chain.strikes.map(s => ({
    ...s,
    totalOI: s.callOI + s.putOI,
    netGamma: s.callOI - s.putOI, // positive = call-heavy, negative = put-heavy
  }));

  // Find max OI for normalization
  const maxOI = Math.max(...withTotal.map(s => s.totalOI), 1);

  // Sort by total OI descending
  const sorted = [...withTotal].sort((a, b) => b.totalOI - a.totalOI);
  const walls = sorted.slice(0, topN).map(s => ({
    strike: s.strike,
    totalOI: s.totalOI,
    side: (s.callOI > s.putOI * 2 ? 'call' : s.putOI > s.callOI * 2 ? 'put' : 'both') as 'call' | 'put' | 'both',
    strength: +(s.totalOI / maxOI).toFixed(2),
  }));

  // Find the largest put wall below spot and call wall above spot
  const putWalls = withTotal.filter(s => s.strike < spotPrice && s.putOI > 0).sort((a, b) => b.putOI - a.putOI);
  const callWalls = withTotal.filter(s => s.strike > spotPrice && s.callOI > 0).sort((a, b) => b.callOI - a.callOI);

  const putWallStrike = putWalls[0]?.strike ?? null;
  const callWallStrike = callWalls[0]?.strike ?? null;

  const spotInsideBand = putWallStrike !== null && callWallStrike !== null &&
    spotPrice > putWallStrike && spotPrice < callWallStrike;

  return { walls, putWallStrike, callWallStrike, spotInsideBand };
}
