import type { Bar } from './alpaca.js';
import { sma, rsi, bollingerBands, macd as computeMacd } from '../../../shared/indicators/index.js';

export interface TechnicalIndicators {
  price: number;
  sma20: number;
  sma50: number;
  sma100: number;
  sma200: number;
  rsi14: number;
  bollingerUpper: number;
  bollingerLower: number;
  bollingerWidth: number;
  adx14: number;
  atr14: number;
  priceVsSma: string; // "above_all" | "below_all" | "mixed"
  smaTrend: string;   // "bullish" | "bearish" | "mixed"
  macdLine: number;
  macdSignal: number;
  macdHistogram: number;
}

// ── ADX/ATR helpers (bar-based, stay local) ─────────────────────────────────

function trueRange(bars: Bar[]): number[] {
  const tr: number[] = [];
  for (let i = 1; i < bars.length; i++) {
    const h = bars[i].h;
    const l = bars[i].l;
    const pc = bars[i - 1].c;
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  return tr;
}

function adx(bars: Bar[], period = 14): number {
  if (bars.length < period * 2 + 1) return 20;
  const plusDM: number[] = [];
  const minusDM: number[] = [];
  const tr = trueRange(bars);

  for (let i = 1; i < bars.length; i++) {
    const upMove = bars[i].h - bars[i - 1].h;
    const downMove = bars[i - 1].l - bars[i].l;
    plusDM.push(upMove > downMove && upMove > 0 ? upMove : 0);
    minusDM.push(downMove > upMove && downMove > 0 ? downMove : 0);
  }

  const smooth = (arr: number[], p: number) => {
    let val = arr.slice(0, p).reduce((a, b) => a + b, 0) / p;
    for (let i = p; i < arr.length; i++) val = (val * (p - 1) + arr[i]) / p;
    return val;
  };

  const atr = smooth(tr, period);
  if (atr === 0) return 20;
  const pdi = (smooth(plusDM, period) / atr) * 100;
  const mdi = (smooth(minusDM, period) / atr) * 100;
  const dxSum = pdi + mdi;
  if (dxSum === 0) return 20;
  return +((Math.abs(pdi - mdi) / dxSum) * 100).toFixed(1);
}

// ── Main computation ────────────────────────────────────────────────────────

export function computeIndicators(bars: Bar[], currentPrice?: number): TechnicalIndicators {
  const closes = bars.map(b => b.c);
  const price = currentPrice ?? closes[closes.length - 1] ?? 0;

  // Delegated to shared/indicators
  const sma20Val = sma(closes, 20);
  const sma50Val = sma(closes, 50);
  const sma100Val = sma(closes, 100);
  const sma200Val = sma(closes, 200);
  const rsi14Val = rsi(closes);
  const bb = bollingerBands(closes, 20, 2);
  const macdResult = computeMacd(closes);

  // Local: ADX, ATR (bar-based, not in shared/)
  const adx14Val = adx(bars);
  const trArr = trueRange(bars.slice(-15));
  const atr14 = trArr.length >= 14 ? +(trArr.slice(-14).reduce((a, b) => a + b, 0) / 14).toFixed(2) : 0;

  // Local: SMA alignment interpretation
  const smas = [sma20Val, sma50Val, sma100Val, sma200Val].filter(s => s > 0);
  const aboveAll = smas.every(s => price > s);
  const belowAll = smas.every(s => price < s);
  const priceVsSma = aboveAll ? 'above_all' : belowAll ? 'below_all' : 'mixed';

  const bullishOrder = sma20Val > sma50Val && sma50Val > sma100Val && sma100Val > sma200Val;
  const bearishOrder = sma20Val < sma50Val && sma50Val < sma100Val && sma100Val < sma200Val;
  const smaTrend = bullishOrder ? 'bullish' : bearishOrder ? 'bearish' : 'mixed';

  return {
    price: +price.toFixed(2),
    sma20: +sma20Val.toFixed(2),
    sma50: +sma50Val.toFixed(2),
    sma100: +sma100Val.toFixed(2),
    sma200: +sma200Val.toFixed(2),
    rsi14: rsi14Val,
    bollingerUpper: bb.upper,
    bollingerLower: bb.lower,
    bollingerWidth: bb.width,
    adx14: adx14Val,
    atr14: +atr14,
    priceVsSma,
    smaTrend,
    macdLine: macdResult?.macdLine ?? 0,
    macdSignal: macdResult?.signalLine ?? 0,
    macdHistogram: macdResult?.histogram ?? 0,
  };
}
