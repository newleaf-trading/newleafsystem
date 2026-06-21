export interface Leg {
  kind: 'call' | 'put';
  dir: 'long' | 'short';
  strike: number;
  qty: number;
  premium: number;
}

export interface AnalysisResult {
  name: string;
  maxProfit: number;
  maxLoss: number;
  breakevens: number[];
  profitZoneWidth: number;
  rewardRisk: number;
  uncappedProfit: boolean;
  uncappedLoss: boolean;
  grid: Array<{ price: number; pnl: number }>;
}

export interface BandResult {
  lo: number;
  hi: number;
  width: number;
}

export interface StrategyPreset {
  legs: number;
  desc: string;
}

export function buildLegs(
  strategy: string,
  spot: number,
  params?: Record<string, number>
): Leg[];

export function payoff(legs: Leg[], underlyingPrice: number): number;

export function analyse(
  strategies: Array<{ name: string; legs: Leg[] }>,
  spot: number
): AnalysisResult[];

export function bandWidth(
  legs: Leg[],
  spot: number,
  target: number
): BandResult | null;

export const PRESETS: Record<string, StrategyPreset>;
