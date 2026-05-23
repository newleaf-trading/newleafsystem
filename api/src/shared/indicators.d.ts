export function sma(closes: number[], period: number): number;
export function ema(closes: number[], period: number): number;
export function emaSeries(closes: number[], period: number): number[];
export function rsi(closes: number[], period?: number): number;
export function stddev(values: number[], mean: number): number;

export function bollingerBands(
  closes: number[],
  period?: number,
  mult?: number,
): { upper: number; middle: number; lower: number; width: number };

export function macd(
  closes: number[],
  fast?: number,
  slow?: number,
  signal?: number,
): { macdLine: number; signalLine: number; histogram: number } | null;

export function findRecentSmaCrossover(
  closes: number[],
  fastPeriod?: number,
  slowPeriod?: number,
  lookback?: number,
): { daysAgo: number; type: 'golden_cross' | 'death_cross' } | null;

export function computeAll(closes: number[]): {
  sma20: number;
  sma50: number;
  sma100: number;
  sma200: number;
  rsi14: number;
  bollinger: { upper: number; middle: number; lower: number; width: number };
  macd: { macdLine: number; signalLine: number; histogram: number } | null;
  smaCrossover: { daysAgo: number; type: 'golden_cross' | 'death_cross' } | null;
};
