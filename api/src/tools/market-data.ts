import type { TradeIdea } from '../types.js';
import { getStockSnapshot, getHistoricalBars, getOptionsSnapshot } from './alpaca.js';
import { computeIndicators } from './indicators.js';
import { fetchNasdaqOI, findGammaWalls } from './nasdaq-oi.js';
import type { StockSnapshot, OptionContract } from './alpaca.js';
import type { TechnicalIndicators } from './indicators.js';
import type { OIChain } from './nasdaq-oi.js';

export interface LegMarketData {
  type: 'call' | 'put';
  side: 'long' | 'short';
  strike: number;
  expiry: string;
  bid: number;
  ask: number;
  mid: number;
  iv: number | null;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
}

export interface GammaWall {
  strike: number;
  totalOI: number;
  side: 'call' | 'put' | 'both';
  strength: number;
}

export interface GammaAnalysis {
  walls: GammaWall[];
  putWallStrike: number | null;
  callWallStrike: number | null;
  spotInsideBand: boolean;
  oiByStrike: { strike: number; callOI: number; putOI: number; callVolume: number; putVolume: number }[];
}

export interface MarketData {
  ticker: string;
  snapshot: StockSnapshot;
  indicators: TechnicalIndicators;
  legs: LegMarketData[];
  nearbyStrikes: { strike: number; callOI: number; putOI: number; callGamma: number | null; putGamma: number | null }[];
  gammaAnalysis?: GammaAnalysis;
  fetchedAt: string;
}

export async function fetchMarketData(input: TradeIdea): Promise<MarketData> {
  const expiry = input.legs[0]?.expiry ?? '';

  // Fetch stock data, options, and OI in parallel
  const [snapshot, bars, options, oiChain] = await Promise.all([
    getStockSnapshot(input.ticker),
    getHistoricalBars(input.ticker, 250),
    expiry ? getOptionsSnapshot(input.ticker, expiry) : Promise.resolve([] as OptionContract[]),
    expiry ? fetchNasdaqOI(input.ticker, expiry).catch(() => null) : Promise.resolve(null),
  ]);

  const indicators = computeIndicators(bars, snapshot.price);

  // Match each trade leg to its option contract
  const legs: LegMarketData[] = input.legs.map(leg => {
    const match = options.find(o => o.type === leg.type && Math.abs(o.strike - leg.strike) < 0.01);
    return {
      type: leg.type,
      side: leg.side,
      strike: leg.strike,
      expiry: leg.expiry,
      bid: match?.bid ?? 0,
      ask: match?.ask ?? 0,
      mid: match?.mid ?? 0,
      iv: match?.iv ?? null,
      delta: match?.delta ?? null,
      gamma: match?.gamma ?? null,
      theta: match?.theta ?? null,
      vega: match?.vega ?? null,
    };
  });

  // Nearby strikes for gamma analysis (from Alpaca greeks)
  const spotStrike = Math.round(snapshot.price / 5) * 5;
  const nearbyStrikes = [];
  for (let s = spotStrike - 50; s <= spotStrike + 50; s += 5) {
    const call = options.find(o => o.type === 'call' && Math.abs(o.strike - s) < 0.01);
    const put = options.find(o => o.type === 'put' && Math.abs(o.strike - s) < 0.01);
    if (call || put) {
      nearbyStrikes.push({
        strike: s,
        callOI: call?.volume ?? 0,
        putOI: put?.volume ?? 0,
        callGamma: call?.gamma ?? null,
        putGamma: put?.gamma ?? null,
      });
    }
  }

  // Build gamma wall analysis from Nasdaq OI data
  let gammaAnalysis: GammaAnalysis | undefined;
  if (oiChain) {
    const analysis = findGammaWalls(oiChain, snapshot.price);
    // Filter OI to strikes near spot (±15% of price)
    const range = snapshot.price * 0.15;
    const relevantOI = oiChain.strikes.filter(s =>
      s.strike >= snapshot.price - range && s.strike <= snapshot.price + range
    );
    gammaAnalysis = {
      walls: analysis.walls,
      putWallStrike: analysis.putWallStrike,
      callWallStrike: analysis.callWallStrike,
      spotInsideBand: analysis.spotInsideBand,
      oiByStrike: relevantOI.map(s => ({
        strike: s.strike,
        callOI: s.callOI,
        putOI: s.putOI,
        callVolume: s.callVolume,
        putVolume: s.putVolume,
      })),
    };
  }

  return {
    ticker: input.ticker,
    snapshot,
    indicators,
    legs,
    nearbyStrikes,
    gammaAnalysis,
    fetchedAt: new Date().toISOString(),
  };
}
