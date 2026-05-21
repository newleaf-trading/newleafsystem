const BASE = 'https://data.alpaca.markets';

function headers(): Record<string, string> {
  return {
    'APCA-API-KEY-ID': process.env.ALPACA_API_KEY ?? '',
    'APCA-API-SECRET-KEY': process.env.ALPACA_SECRET_KEY ?? '',
    'Accept': 'application/json',
  };
}

async function alpacaFetch(url: string): Promise<unknown> {
  const res = await fetch(url, { headers: headers(), signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Alpaca ${res.status}: ${await res.text().then(t => t.slice(0, 200))}`);
  return res.json();
}

// --- Stock snapshot ---

export interface StockSnapshot {
  price: number;
  prevClose: number;
  change: number;
  changePct: number;
  volume: number;
  open: number;
  high: number;
  low: number;
}

export async function getStockSnapshot(ticker: string): Promise<StockSnapshot> {
  const d = await alpacaFetch(`${BASE}/v2/stocks/${ticker}/snapshot`) as Record<string, any>;
  const t = d.latestTrade ?? {};
  const q = d.latestQuote ?? {};
  const b = d.dailyBar ?? {};
  const p = d.prevDailyBar ?? {};
  const price = t.p ?? q.ap ?? b.c ?? 0;
  const prevClose = p.c ?? 0;
  return {
    price,
    prevClose,
    change: +(price - prevClose).toFixed(2),
    changePct: prevClose ? +((price - prevClose) / prevClose * 100).toFixed(2) : 0,
    volume: b.v ?? 0,
    open: b.o ?? 0,
    high: b.h ?? 0,
    low: b.l ?? 0,
  };
}

// --- Historical bars ---

export interface Bar { t: string; o: number; h: number; l: number; c: number; v: number; }

export async function getHistoricalBars(ticker: string, days = 250): Promise<Bar[]> {
  const end = new Date();
  const start = new Date(end.getTime() - days * 86400000);
  const params = new URLSearchParams({
    timeframe: '1Day',
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
    limit: '500',
    adjustment: 'split',
  });
  const d = await alpacaFetch(`${BASE}/v2/stocks/${ticker}/bars?${params}`) as Record<string, any>;
  return (d.bars ?? []).map((b: any) => ({ t: b.t, o: b.o, h: b.h, l: b.l, c: b.c, v: b.v }));
}

// --- Options chain ---

export interface OptionContract {
  occ: string;
  type: 'call' | 'put';
  strike: number;
  iv: number | null;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  bid: number;
  ask: number;
  mid: number;
  volume: number;
}

export async function getOptionsSnapshot(ticker: string, expiry: string): Promise<OptionContract[]> {
  const params = new URLSearchParams({ expiration_date: expiry, feed: 'indicative', limit: '1000' });
  const d = await alpacaFetch(`${BASE}/v1beta1/options/snapshots/${ticker}?${params}`) as Record<string, any>;
  const snapshots = d.snapshots ?? {};
  const contracts: OptionContract[] = [];

  for (const [occ, snap] of Object.entries(snapshots) as [string, any][]) {
    const match = occ.match(/^([A-Z1-9]+)(\d{6})([CP])(\d{8})$/);
    if (!match) continue;
    const greeks = snap.greeks ?? {};
    const quote = snap.latestQuote ?? {};
    const bid = quote.bp ?? 0;
    const ask = quote.ap ?? 0;
    contracts.push({
      occ,
      type: match[3] === 'C' ? 'call' : 'put',
      strike: parseInt(match[4], 10) / 1000,
      iv: greeks.midIV ?? snap.impliedVolatility ?? null,
      delta: greeks.delta ?? null,
      gamma: greeks.gamma ?? null,
      theta: greeks.theta ?? null,
      vega: greeks.vega ?? null,
      bid,
      ask,
      mid: +((bid + ask) / 2).toFixed(2),
      volume: snap.dailyBar?.v ?? 0,
    });
  }

  return contracts.sort((a, b) => a.strike - b.strike || (a.type === 'call' ? -1 : 1));
}
