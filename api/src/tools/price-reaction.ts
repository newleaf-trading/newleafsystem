/**
 * price-reaction.ts — Deterministic Price Reaction Analyzer
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure functions. No I/O, no LLM calls. Given historical candles + S/R levels +
 * gamma walls + indicators, computes bounce/rejection/breakout probabilities
 * and maps to strategy bias.
 *
 * Used by:
 *   - movement-range.html (client-side, inlined as JS)
 *   - strategy engine (server-side, imported as TS module)
 *   - LLM judge payload (reaction probabilities fed into reasoning prompt)
 * ─────────────────────────────────────────────────────────────────────────────
 */

// ── Interfaces ──────────────────────────────────────────────────────────────

export type Candle = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
  rsi14?: number;
  macd?: number;
  macdSignal?: number;
  macdHistogram?: number;
  sma20?: number;
  sma50?: number;
  sma100?: number;
  sma200?: number;
  bollingerUpper?: number;
  bollingerMiddle?: number;
  bollingerLower?: number;
};

export type PriceLevel = {
  level: number;
  label?: string;
  source: 'manual' | 'swing' | 'gamma_wall' | 'bollinger' | 'moving_average' | 'pivot';
  strength?: number;
};

export type GammaContext = {
  putWall?: number;
  callWall?: number;
  gammaLow?: number;
  gammaHigh?: number;
  gammaConfidence?: number;
  positionInBandPct?: number;
};

export type PriceReactionInput = {
  ticker: string;
  spot: number;
  candles: Candle[];
  supportLevels: PriceLevel[];
  resistanceLevels: PriceLevel[];
  gamma?: GammaContext;
  ivRv?: number;
  adx?: number;
  lookbackDays?: number;
  zonePct?: number;
  bounceThresholdPct?: number;
  breakThresholdPct?: number;
  forwardWindows?: number[];
};

export type LevelReactionStats = {
  level: number;
  label?: string;
  source: string;
  zoneLow: number;
  zoneHigh: number;
  touchCount: number;
  bounceCount?: number;
  breakCount?: number;
  rejectionCount?: number;
  breakoutCount?: number;
  fakeBreakCount?: number;
  fakeBreakoutCount?: number;
  bounceRate?: number;
  breakRate?: number;
  rejectionRate?: number;
  breakoutRate?: number;
  fakeBreakRate?: number;
  fakeBreakoutRate?: number;
  avgReturn3d?: number;
  avgReturn5d?: number;
  avgReturn10d?: number;
  avgReturn20d?: number;
  medianReturn5d?: number;
  avgMaxAdverseMove?: number;
  avgMaxFavorableMove?: number;
  volumeConfirmationRate?: number;
  rsiConfirmationRate?: number;
  macdConfirmationRate?: number;
  gammaAlignment?: boolean;
  strengthScore: number;
  classification:
    | 'strong_support'
    | 'weak_support'
    | 'broken_support'
    | 'strong_resistance'
    | 'weak_resistance'
    | 'broken_resistance'
    | 'range_boundary'
    | 'insufficient_data';
};

export type RangeStats = {
  support: number;
  resistance: number;
  widthPct: number;
  rangeTouchCount: number;
  containmentRate5d: number;
  containmentRate10d: number;
  containmentRate20d: number;
  avgReturnInsideRange5d: number;
  avgReturnInsideRange10d: number;
  avgMaxAdverseMove: number;
  rangeStrengthScore: number;
  classification: 'strong_range' | 'weak_range' | 'breakout_prone' | 'insufficient_data';
};

export type PriceReactionResult = {
  ticker: string;
  spot: number;
  lookbackDays: number;
  supportStats: LevelReactionStats[];
  resistanceStats: LevelReactionStats[];
  rangeStats: RangeStats[];
  nearestSupport?: LevelReactionStats;
  nearestResistance?: LevelReactionStats;
  activeRange?: RangeStats;
  summary: {
    supportBounceProbability?: number;
    supportBreakProbability?: number;
    resistanceRejectionProbability?: number;
    resistanceBreakoutProbability?: number;
    rangeContainmentProbability?: number;
    directionalBias:
      | 'bullish_bounce'
      | 'bearish_breakdown'
      | 'bearish_rejection'
      | 'bullish_breakout'
      | 'range_bound'
      | 'unclear';
    strategyBias:
      | 'bull_call_spread'
      | 'bull_put_spread'
      | 'bear_call_spread'
      | 'bear_put_spread'
      | 'iron_condor'
      | 'iron_butterfly'
      | 'broken_wing_butterfly'
      | 'no_trade';
    confidence: number;
    warnings: string[];
  };
};

// ── Defaults ────────────────────────────────────────────────────────────────

const DEFAULTS = {
  lookbackDays: 365,
  zonePct: 1.0,
  bounceThresholdPct: 3.0,
  breakThresholdPct: 1.0,
  forwardWindows: [3, 5, 10, 20],
  minTouchesForValidLevel: 3,
  maxDaysToConfirmBounce: 5,
  maxDaysToConfirmBreak: 2,
};

type Config = typeof DEFAULTS;

// ── Touch Event ─────────────────────────────────────────────────────────────

type TouchEvent = {
  index: number;
  date: string;
  candle: Candle;
  touchClose: number;
};

type TouchClassification =
  | 'bounce' | 'break' | 'fake_break'
  | 'rejection' | 'breakout' | 'fake_breakout'
  | 'unresolved';

type ClassifiedTouch = TouchEvent & {
  classification: TouchClassification;
  forwardReturns: Record<number, number>;
  maxAdverseMove: number;
  maxFavorableMove: number;
  volumeConfirmed: boolean;
  rsiConfirmed: boolean;
  macdConfirmed: boolean;
};

// ── Helpers ─────────────────────────────────────────────────────────────────

function zone(level: number, zonePct: number): { low: number; high: number } {
  return {
    low: level * (1 - zonePct / 100),
    high: level * (1 + zonePct / 100),
  };
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function avgVolume(candles: Candle[], endIdx: number, window: number = 20): number {
  const start = Math.max(0, endIdx - window);
  const slice = candles.slice(start, endIdx);
  const vols = slice.filter(c => c.volume != null && c.volume > 0).map(c => c.volume!);
  return vols.length > 0 ? avg(vols) : 0;
}

// ── Find Touch Events ───────────────────────────────────────────────────────

export function findTouchEvents(
  candles: Candle[],
  level: number,
  zonePct: number,
  type: 'support' | 'resistance',
): TouchEvent[] {
  const { low: zLow, high: zHigh } = zone(level, zonePct);
  const events: TouchEvent[] = [];
  let inZone = false;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const touches = type === 'support'
      ? (c.low <= zHigh && c.high >= zLow)
      : (c.high >= zLow && c.low <= zHigh);

    if (touches && !inZone) {
      // New touch event — first candle entering the zone
      events.push({ index: i, date: c.date, candle: c, touchClose: c.close });
      inZone = true;
    } else if (!touches) {
      inZone = false;
    }
  }

  return events;
}

// ── Forward Returns ─────────────────────────────────────────────────────────

export function calculateForwardReturns(
  candles: Candle[],
  eventIndex: number,
  windows: number[],
): Record<number, number> {
  const baseClose = candles[eventIndex].close;
  if (!baseClose || baseClose === 0) return {};
  const returns: Record<number, number> = {};
  for (const w of windows) {
    const futureIdx = eventIndex + w;
    if (futureIdx < candles.length) {
      returns[w] = (candles[futureIdx].close - baseClose) / baseClose;
    }
  }
  return returns;
}

export function calculateMaxAdverseMove(
  candles: Candle[],
  eventIndex: number,
  window: number,
  type: 'support' | 'resistance',
): number {
  const baseClose = candles[eventIndex].close;
  if (!baseClose || baseClose === 0) return 0;
  const end = Math.min(eventIndex + window, candles.length);
  let maxAdverse = 0;

  for (let i = eventIndex + 1; i < end; i++) {
    const move = type === 'support'
      ? (candles[i].low - baseClose) / baseClose   // adverse = downward for support
      : (candles[i].high - baseClose) / baseClose;  // adverse = upward for resistance
    if (type === 'support' && move < maxAdverse) maxAdverse = move;
    if (type === 'resistance' && move > maxAdverse) maxAdverse = move;
  }
  return maxAdverse;
}

function calculateMaxFavorableMove(
  candles: Candle[],
  eventIndex: number,
  window: number,
  type: 'support' | 'resistance',
): number {
  const baseClose = candles[eventIndex].close;
  if (!baseClose || baseClose === 0) return 0;
  const end = Math.min(eventIndex + window, candles.length);
  let maxFav = 0;

  for (let i = eventIndex + 1; i < end; i++) {
    const move = type === 'support'
      ? (candles[i].high - baseClose) / baseClose   // favorable = upward for support
      : (candles[i].low - baseClose) / baseClose;    // favorable = downward for resistance
    if (type === 'support' && move > maxFav) maxFav = move;
    if (type === 'resistance' && move < maxFav) maxFav = move;
  }
  return maxFav;
}

// ── Classify Touch Events ───────────────────────────────────────────────────

export function classifySupportTouch(
  event: TouchEvent,
  candles: Candle[],
  level: number,
  zonePct: number,
  cfg: Config,
): ClassifiedTouch {
  const { low: zLow } = zone(level, zonePct);
  const baseClose = event.touchClose;
  const bounceTarget = baseClose * (1 + cfg.bounceThresholdPct / 100);
  const breakTarget = zLow * (1 - cfg.breakThresholdPct / 100);
  const endIdx = Math.min(event.index + cfg.maxDaysToConfirmBounce, candles.length);

  let classification: TouchClassification = 'unresolved';
  let closedBelow = 0;
  let tradedBelowThenRecovered = false;

  for (let i = event.index + 1; i < endIdx; i++) {
    const c = candles[i];

    // Check bounce: close rises by bounceThresholdPct
    if (c.close >= bounceTarget && classification === 'unresolved') {
      classification = 'bounce';
      break;
    }

    // Check break: close below break target
    if (c.close < breakTarget) {
      closedBelow++;
      if (closedBelow >= cfg.maxDaysToConfirmBreak) {
        classification = 'break';
        break;
      }
    } else {
      // If we traded below intraday but closed back above
      if (closedBelow > 0 && c.close >= zLow) {
        tradedBelowThenRecovered = true;
      }
      closedBelow = 0;
    }
  }

  if (classification === 'unresolved' && tradedBelowThenRecovered) {
    classification = 'fake_break';
  }

  // Confirmations
  const avgVol = avgVolume(candles, event.index);
  const volumeConfirmed = !!(event.candle.volume && avgVol > 0 && event.candle.volume > avgVol);
  const rsiConfirmed = !!(event.candle.rsi14 != null && (event.candle.rsi14 < 40));
  const macdConfirmed = !!(event.candle.macdHistogram != null && event.candle.macdHistogram > 0);

  return {
    ...event,
    classification,
    forwardReturns: calculateForwardReturns(candles, event.index, cfg.forwardWindows),
    maxAdverseMove: calculateMaxAdverseMove(candles, event.index, cfg.maxDaysToConfirmBounce, 'support'),
    maxFavorableMove: calculateMaxFavorableMove(candles, event.index, cfg.maxDaysToConfirmBounce, 'support'),
    volumeConfirmed,
    rsiConfirmed,
    macdConfirmed,
  };
}

export function classifyResistanceTouch(
  event: TouchEvent,
  candles: Candle[],
  level: number,
  zonePct: number,
  cfg: Config,
): ClassifiedTouch {
  const { high: zHigh } = zone(level, zonePct);
  const baseClose = event.touchClose;
  const rejectionTarget = baseClose * (1 - cfg.bounceThresholdPct / 100);
  const breakoutTarget = zHigh * (1 + cfg.breakThresholdPct / 100);
  const endIdx = Math.min(event.index + cfg.maxDaysToConfirmBounce, candles.length);

  let classification: TouchClassification = 'unresolved';
  let closedAbove = 0;
  let tradedAboveThenFell = false;

  for (let i = event.index + 1; i < endIdx; i++) {
    const c = candles[i];

    // Check rejection: close falls by bounceThresholdPct
    if (c.close <= rejectionTarget && classification === 'unresolved') {
      classification = 'rejection';
      break;
    }

    // Check breakout: close above breakout target
    if (c.close > breakoutTarget) {
      closedAbove++;
      if (closedAbove >= cfg.maxDaysToConfirmBreak) {
        classification = 'breakout';
        break;
      }
    } else {
      if (closedAbove > 0 && c.close <= zHigh) {
        tradedAboveThenFell = true;
      }
      closedAbove = 0;
    }
  }

  if (classification === 'unresolved' && tradedAboveThenFell) {
    classification = 'fake_breakout';
  }

  const avgVol = avgVolume(candles, event.index);
  const volumeConfirmed = !!(event.candle.volume && avgVol > 0 && event.candle.volume > avgVol);
  const rsiConfirmed = !!(event.candle.rsi14 != null && event.candle.rsi14 > 60);
  const macdConfirmed = !!(event.candle.macdHistogram != null && event.candle.macdHistogram < 0);

  return {
    ...event,
    classification,
    forwardReturns: calculateForwardReturns(candles, event.index, cfg.forwardWindows),
    maxAdverseMove: calculateMaxAdverseMove(candles, event.index, cfg.maxDaysToConfirmBounce, 'resistance'),
    maxFavorableMove: calculateMaxFavorableMove(candles, event.index, cfg.maxDaysToConfirmBounce, 'resistance'),
    volumeConfirmed,
    rsiConfirmed,
    macdConfirmed,
  };
}

// ── Analyze Support Level ───────────────────────────────────────────────────

export function analyzeSupportLevel(
  candles: Candle[],
  supportLevel: PriceLevel,
  cfg: Config,
  gamma?: GammaContext,
): LevelReactionStats {
  const { low: zLow, high: zHigh } = zone(supportLevel.level, cfg.zonePct);
  const touches = findTouchEvents(candles, supportLevel.level, cfg.zonePct, 'support');
  const classified = touches.map(t => classifySupportTouch(t, candles, supportLevel.level, cfg.zonePct, cfg));

  const bounces = classified.filter(c => c.classification === 'bounce');
  const breaks = classified.filter(c => c.classification === 'break');
  const fakeBreaks = classified.filter(c => c.classification === 'fake_break');
  const total = classified.length;

  const gammaAligned = !!(gamma?.putWall && Math.abs(gamma.putWall - supportLevel.level) / supportLevel.level < 0.02);

  const stats: LevelReactionStats = {
    level: supportLevel.level,
    label: supportLevel.label,
    source: supportLevel.source,
    zoneLow: zLow,
    zoneHigh: zHigh,
    touchCount: total,
    bounceCount: bounces.length,
    breakCount: breaks.length,
    fakeBreakCount: fakeBreaks.length,
    bounceRate: total > 0 ? bounces.length / total : undefined,
    breakRate: total > 0 ? breaks.length / total : undefined,
    fakeBreakRate: total > 0 ? fakeBreaks.length / total : undefined,
    avgReturn3d: avg(classified.map(c => c.forwardReturns[3] ?? 0).filter(r => r !== 0)) || undefined,
    avgReturn5d: avg(classified.map(c => c.forwardReturns[5] ?? 0).filter(r => r !== 0)) || undefined,
    avgReturn10d: avg(classified.map(c => c.forwardReturns[10] ?? 0).filter(r => r !== 0)) || undefined,
    avgReturn20d: avg(classified.map(c => c.forwardReturns[20] ?? 0).filter(r => r !== 0)) || undefined,
    medianReturn5d: median(classified.map(c => c.forwardReturns[5] ?? 0).filter(r => r !== 0)) || undefined,
    avgMaxAdverseMove: avg(classified.map(c => c.maxAdverseMove)) || undefined,
    avgMaxFavorableMove: avg(classified.map(c => c.maxFavorableMove)) || undefined,
    volumeConfirmationRate: total > 0 ? classified.filter(c => c.volumeConfirmed).length / total : undefined,
    rsiConfirmationRate: total > 0 ? classified.filter(c => c.rsiConfirmed).length / total : undefined,
    macdConfirmationRate: total > 0 ? classified.filter(c => c.macdConfirmed).length / total : undefined,
    gammaAlignment: gammaAligned,
    strengthScore: 0,
    classification: 'insufficient_data',
  };

  stats.strengthScore = calculateSupportStrengthScore(stats);
  stats.classification = classifySupportLevel(stats, cfg);

  return stats;
}

// ── Analyze Resistance Level ────────────────────────────────────────────────

export function analyzeResistanceLevel(
  candles: Candle[],
  resistanceLevel: PriceLevel,
  cfg: Config,
  gamma?: GammaContext,
): LevelReactionStats {
  const { low: zLow, high: zHigh } = zone(resistanceLevel.level, cfg.zonePct);
  const touches = findTouchEvents(candles, resistanceLevel.level, cfg.zonePct, 'resistance');
  const classified = touches.map(t => classifyResistanceTouch(t, candles, resistanceLevel.level, cfg.zonePct, cfg));

  const rejections = classified.filter(c => c.classification === 'rejection');
  const breakouts = classified.filter(c => c.classification === 'breakout');
  const fakeBreakouts = classified.filter(c => c.classification === 'fake_breakout');
  const total = classified.length;

  const gammaAligned = !!(gamma?.callWall && Math.abs(gamma.callWall - resistanceLevel.level) / resistanceLevel.level < 0.02);

  const stats: LevelReactionStats = {
    level: resistanceLevel.level,
    label: resistanceLevel.label,
    source: resistanceLevel.source,
    zoneLow: zLow,
    zoneHigh: zHigh,
    touchCount: total,
    rejectionCount: rejections.length,
    breakoutCount: breakouts.length,
    fakeBreakoutCount: fakeBreakouts.length,
    rejectionRate: total > 0 ? rejections.length / total : undefined,
    breakoutRate: total > 0 ? breakouts.length / total : undefined,
    fakeBreakoutRate: total > 0 ? fakeBreakouts.length / total : undefined,
    avgReturn3d: avg(classified.map(c => c.forwardReturns[3] ?? 0).filter(r => r !== 0)) || undefined,
    avgReturn5d: avg(classified.map(c => c.forwardReturns[5] ?? 0).filter(r => r !== 0)) || undefined,
    avgReturn10d: avg(classified.map(c => c.forwardReturns[10] ?? 0).filter(r => r !== 0)) || undefined,
    avgReturn20d: avg(classified.map(c => c.forwardReturns[20] ?? 0).filter(r => r !== 0)) || undefined,
    medianReturn5d: median(classified.map(c => c.forwardReturns[5] ?? 0).filter(r => r !== 0)) || undefined,
    avgMaxAdverseMove: avg(classified.map(c => c.maxAdverseMove)) || undefined,
    avgMaxFavorableMove: avg(classified.map(c => c.maxFavorableMove)) || undefined,
    volumeConfirmationRate: total > 0 ? classified.filter(c => c.volumeConfirmed).length / total : undefined,
    rsiConfirmationRate: total > 0 ? classified.filter(c => c.rsiConfirmed).length / total : undefined,
    macdConfirmationRate: total > 0 ? classified.filter(c => c.macdConfirmed).length / total : undefined,
    gammaAlignment: gammaAligned,
    strengthScore: 0,
    classification: 'insufficient_data',
  };

  stats.strengthScore = calculateResistanceStrengthScore(stats);
  stats.classification = classifyResistanceLevel(stats, cfg);

  return stats;
}

// ── Analyze Range ───────────────────────────────────────────────────────────

export function analyzeRange(
  candles: Candle[],
  supportLevel: PriceLevel,
  resistanceLevel: PriceLevel,
  cfg: Config,
  gamma?: GammaContext,
): RangeStats {
  const sZone = zone(supportLevel.level, cfg.zonePct);
  const rZone = zone(resistanceLevel.level, cfg.zonePct);
  const rangeLow = sZone.low;
  const rangeHigh = rZone.high;
  const midpoint = (supportLevel.level + resistanceLevel.level) / 2;
  const widthPct = midpoint > 0 ? ((resistanceLevel.level - supportLevel.level) / midpoint) * 100 : 0;

  // Count touches of either boundary
  let rangeTouchCount = 0;

  // Containment analysis for different windows
  function containmentRate(window: number): number {
    if (candles.length < window) return 0;
    let containedWindows = 0;
    let totalWindows = 0;
    for (let i = 0; i <= candles.length - window; i++) {
      totalWindows++;
      const windowCandles = candles.slice(i, i + window);
      const allInside = windowCandles.every(c => c.low >= rangeLow && c.high <= rangeHigh);
      if (allInside) containedWindows++;
    }
    return totalWindows > 0 ? containedWindows / totalWindows : 0;
  }

  function avgReturnInRange(window: number): number {
    if (candles.length < window) return 0;
    const returns: number[] = [];
    for (let i = 0; i <= candles.length - window; i++) {
      const start = candles[i];
      const end = candles[i + window - 1];
      if (start.low >= rangeLow && start.high <= rangeHigh) {
        returns.push((end.close - start.close) / start.close);
      }
    }
    return avg(returns);
  }

  // Count boundary touches
  for (const c of candles) {
    if (c.low <= sZone.high && c.low >= sZone.low) rangeTouchCount++;
    if (c.high >= rZone.low && c.high <= rZone.high) rangeTouchCount++;
  }

  // Max adverse excursion while in range
  const adverseMoves: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    if (prev.close >= rangeLow && prev.close <= rangeHigh) {
      const move = Math.min(0, (curr.low - prev.close) / prev.close);
      adverseMoves.push(move);
    }
  }

  const c5 = containmentRate(5);
  const c10 = containmentRate(10);
  const c20 = containmentRate(20);

  const stats: RangeStats = {
    support: supportLevel.level,
    resistance: resistanceLevel.level,
    widthPct,
    rangeTouchCount,
    containmentRate5d: c5,
    containmentRate10d: c10,
    containmentRate20d: c20,
    avgReturnInsideRange5d: avgReturnInRange(5),
    avgReturnInsideRange10d: avgReturnInRange(10),
    avgMaxAdverseMove: avg(adverseMoves),
    rangeStrengthScore: 0,
    classification: 'insufficient_data',
  };

  stats.rangeStrengthScore = calculateRangeStrengthScore(stats, gamma);
  stats.classification = classifyRange(stats);

  return stats;
}

// ── Scoring ─────────────────────────────────────────────────────────────────

/**
 * Support strength: 0-100
 * Weights: bounceRate 30%, touchCount 15%, low breakRate 15%,
 * avg 5d/10d return 15%, maxAdverse 10%, confirmations 10%, gamma 5%
 */
export function calculateSupportStrengthScore(stats: LevelReactionStats): number {
  if (stats.touchCount === 0) return 0;

  let score = 0;

  // Bounce rate (30%)
  const br = stats.bounceRate ?? 0;
  score += Math.min(30, br * 30);

  // Touch count (15%) — more touches = more reliable, cap at 10
  score += Math.min(15, (Math.min(stats.touchCount, 10) / 10) * 15);

  // Low break rate (15%) — lower is better
  const breakRate = stats.breakRate ?? 0;
  score += Math.max(0, (1 - breakRate) * 15);

  // Average forward returns (15%)
  const avgRet = Math.max(stats.avgReturn5d ?? 0, stats.avgReturn10d ?? 0);
  score += Math.min(15, Math.max(0, avgRet * 200)); // 7.5% return = full marks

  // Max adverse move control (10%) — smaller adverse is better
  const adverse = Math.abs(stats.avgMaxAdverseMove ?? 0);
  score += Math.max(0, (1 - adverse * 20) * 10); // 5% adverse = 0 marks

  // Indicator confirmations (10%)
  const volConf = stats.volumeConfirmationRate ?? 0;
  const rsiConf = stats.rsiConfirmationRate ?? 0;
  const macdConf = stats.macdConfirmationRate ?? 0;
  score += ((volConf + rsiConf + macdConf) / 3) * 10;

  // Gamma alignment (5%)
  if (stats.gammaAlignment) score += 5;

  return Math.round(Math.min(100, Math.max(0, score)));
}

export function calculateResistanceStrengthScore(stats: LevelReactionStats): number {
  if (stats.touchCount === 0) return 0;

  let score = 0;

  // Rejection rate (30%)
  const rr = stats.rejectionRate ?? 0;
  score += Math.min(30, rr * 30);

  // Touch count (15%)
  score += Math.min(15, (Math.min(stats.touchCount, 10) / 10) * 15);

  // Low breakout rate (15%)
  const breakoutRate = stats.breakoutRate ?? 0;
  score += Math.max(0, (1 - breakoutRate) * 15);

  // Average forward returns — for resistance, negative returns are good (15%)
  const avgRet = Math.min(stats.avgReturn5d ?? 0, stats.avgReturn10d ?? 0);
  score += Math.min(15, Math.max(0, Math.abs(avgRet) * 200));

  // Max adverse move control (10%)
  const adverse = Math.abs(stats.avgMaxAdverseMove ?? 0);
  score += Math.max(0, (1 - adverse * 20) * 10);

  // Indicator confirmations (10%)
  const volConf = stats.volumeConfirmationRate ?? 0;
  const rsiConf = stats.rsiConfirmationRate ?? 0;
  const macdConf = stats.macdConfirmationRate ?? 0;
  score += ((volConf + rsiConf + macdConf) / 3) * 10;

  // Gamma alignment (5%)
  if (stats.gammaAlignment) score += 5;

  return Math.round(Math.min(100, Math.max(0, score)));
}

export function calculateRangeStrengthScore(stats: RangeStats, gamma?: GammaContext): number {
  let score = 0;

  // Containment rate (40%)
  const c20 = stats.containmentRate20d;
  score += Math.min(40, c20 * 40);

  // Range width — moderate is best: 3-15% (20%)
  const w = stats.widthPct;
  if (w >= 3 && w <= 15) score += 20;
  else if (w > 15 && w <= 25) score += 10;
  else if (w > 0 && w < 3) score += 5;

  // Touch count — more boundary touches = active range (15%)
  score += Math.min(15, (Math.min(stats.rangeTouchCount, 20) / 20) * 15);

  // Low adverse moves (15%)
  const adverse = Math.abs(stats.avgMaxAdverseMove);
  score += Math.max(0, (1 - adverse * 20) * 15);

  // Gamma alignment (10%)
  if (gamma?.gammaConfidence && gamma.gammaConfidence > 0.5) score += 10;
  else if (gamma?.gammaConfidence && gamma.gammaConfidence > 0.3) score += 5;

  return Math.round(Math.min(100, Math.max(0, score)));
}

// ── Classifications ─────────────────────────────────────────────────────────

function classifySupportLevel(stats: LevelReactionStats, cfg: Config): LevelReactionStats['classification'] {
  if (stats.touchCount < cfg.minTouchesForValidLevel) return 'insufficient_data';
  const br = stats.bounceRate ?? 0;
  const bkr = stats.breakRate ?? 0;
  if (bkr > 0.5) return 'broken_support';
  if (br >= 0.6 && stats.strengthScore >= 50) return 'strong_support';
  return 'weak_support';
}

function classifyResistanceLevel(stats: LevelReactionStats, cfg: Config): LevelReactionStats['classification'] {
  if (stats.touchCount < cfg.minTouchesForValidLevel) return 'insufficient_data';
  const rr = stats.rejectionRate ?? 0;
  const bor = stats.breakoutRate ?? 0;
  if (bor > 0.5) return 'broken_resistance';
  if (rr >= 0.6 && stats.strengthScore >= 50) return 'strong_resistance';
  return 'weak_resistance';
}

function classifyRange(stats: RangeStats): RangeStats['classification'] {
  if (stats.rangeTouchCount < 4) return 'insufficient_data';
  if (stats.containmentRate20d >= 0.6 && stats.rangeStrengthScore >= 50) return 'strong_range';
  if (stats.containmentRate20d < 0.3) return 'breakout_prone';
  return 'weak_range';
}

// ── Strategy Bias Mapper ────────────────────────────────────────────────────

export function mapReactionToStrategyBias(
  result: PriceReactionResult,
  marketContext: { ivRv?: number; adx?: number; gammaConfidence?: number; spot?: number },
): PriceReactionResult['summary']['strategyBias'] {
  const { nearestSupport: ns, nearestResistance: nr, activeRange: ar } = result;
  const ivRv = marketContext.ivRv ?? 1.0;
  const adx = marketContext.adx ?? 25;
  const gammaConf = marketContext.gammaConfidence ?? 0;
  const spot = marketContext.spot ?? result.spot;

  // Range-bound strategies (check first — if contained, prefer neutral)
  if (ar && ar.containmentRate20d > 0.6 && adx < 20 && ivRv >= 1.2) {
    // Iron butterfly if near center and high gamma confidence
    if (ar.containmentRate20d > 0.7 && gammaConf > 0.6) {
      const rangeMid = (ar.support + ar.resistance) / 2;
      const distFromCenter = Math.abs(spot - rangeMid) / rangeMid;
      if (distFromCenter < 0.02) return 'iron_butterfly';
    }
    return 'iron_condor';
  }

  // Support-based strategies
  if (ns && (ns.bounceRate ?? 0) > 0.6 && ns.strengthScore > 65) {
    return ivRv >= 1.2 ? 'bull_put_spread' : 'bull_call_spread';
  }

  // Resistance-based strategies
  if (nr && (nr.rejectionRate ?? 0) > 0.6 && nr.strengthScore > 65) {
    return ivRv >= 1.2 ? 'bear_call_spread' : 'bear_put_spread';
  }

  // Modest bounce/rejection — BWB territory
  if (ns && (ns.bounceRate ?? 0) > 0.4 && ns.strengthScore > 40) {
    return 'broken_wing_butterfly';
  }
  if (nr && (nr.rejectionRate ?? 0) > 0.4 && nr.strengthScore > 40) {
    return 'broken_wing_butterfly';
  }

  // Support break or resistance breakout — avoid
  if (ns && (ns.breakRate ?? 0) > 0.5) return 'no_trade';
  if (nr && (nr.breakoutRate ?? 0) > 0.5) return 'no_trade';

  return 'no_trade';
}

// ── Main Entry ──────────────────────────────────────────────────────────────

export function analyzePriceReactions(input: PriceReactionInput): PriceReactionResult {
  const cfg: Config = {
    lookbackDays: input.lookbackDays ?? DEFAULTS.lookbackDays,
    zonePct: input.zonePct ?? DEFAULTS.zonePct,
    bounceThresholdPct: input.bounceThresholdPct ?? DEFAULTS.bounceThresholdPct,
    breakThresholdPct: input.breakThresholdPct ?? DEFAULTS.breakThresholdPct,
    forwardWindows: input.forwardWindows ?? DEFAULTS.forwardWindows,
    minTouchesForValidLevel: DEFAULTS.minTouchesForValidLevel,
    maxDaysToConfirmBounce: DEFAULTS.maxDaysToConfirmBounce,
    maxDaysToConfirmBreak: DEFAULTS.maxDaysToConfirmBreak,
  };

  const warnings: string[] = [];

  // Trim candles to lookback window
  const allCandles = input.candles;
  const candles = cfg.lookbackDays < allCandles.length
    ? allCandles.slice(-cfg.lookbackDays)
    : allCandles;

  if (candles.length < 20) {
    warnings.push(`Only ${candles.length} candles available (need >= 20)`);
    return emptyResult(input, cfg, warnings);
  }

  // Analyze support levels
  const supportStats = input.supportLevels.map(level =>
    analyzeSupportLevel(candles, level, cfg, input.gamma)
  );

  // Analyze resistance levels
  const resistanceStats = input.resistanceLevels.map(level =>
    analyzeResistanceLevel(candles, level, cfg, input.gamma)
  );

  // Find nearest support/resistance to spot
  const validSupport = supportStats.filter(s => s.touchCount > 0);
  const validResistance = resistanceStats.filter(r => r.touchCount > 0);

  const nearestSupport = validSupport.length > 0
    ? validSupport.reduce((best, s) =>
        Math.abs(s.level - input.spot) < Math.abs(best.level - input.spot) ? s : best
      )
    : supportStats[0];

  const nearestResistance = validResistance.length > 0
    ? validResistance.reduce((best, r) =>
        Math.abs(r.level - input.spot) < Math.abs(best.level - input.spot) ? r : best
      )
    : resistanceStats[0];

  // Analyze ranges (pair nearest support with nearest resistance)
  const rangeStats: RangeStats[] = [];
  if (nearestSupport && nearestResistance && nearestSupport.level < nearestResistance.level) {
    rangeStats.push(analyzeRange(
      candles,
      { level: nearestSupport.level, source: nearestSupport.source as PriceLevel['source'] },
      { level: nearestResistance.level, source: nearestResistance.source as PriceLevel['source'] },
      cfg,
      input.gamma,
    ));
  }

  const activeRange = rangeStats[0];

  // Determine directional bias
  const bounceProbability = nearestSupport?.bounceRate;
  const breakProbability = nearestSupport?.breakRate;
  const rejectionProbability = nearestResistance?.rejectionRate;
  const breakoutProbability = nearestResistance?.breakoutRate;
  const containmentProbability = activeRange?.containmentRate20d;

  let directionalBias: PriceReactionResult['summary']['directionalBias'] = 'unclear';
  if (containmentProbability != null && containmentProbability > 0.6) {
    directionalBias = 'range_bound';
  } else if (bounceProbability != null && bounceProbability > 0.6) {
    directionalBias = 'bullish_bounce';
  } else if (rejectionProbability != null && rejectionProbability > 0.6) {
    directionalBias = 'bearish_rejection';
  } else if (breakoutProbability != null && breakoutProbability > 0.5) {
    directionalBias = 'bullish_breakout';
  } else if (breakProbability != null && breakProbability > 0.5) {
    directionalBias = 'bearish_breakdown';
  }

  // Map to strategy bias
  const result: PriceReactionResult = {
    ticker: input.ticker,
    spot: input.spot,
    lookbackDays: cfg.lookbackDays,
    supportStats,
    resistanceStats,
    rangeStats,
    nearestSupport,
    nearestResistance,
    activeRange,
    summary: {
      supportBounceProbability: bounceProbability,
      supportBreakProbability: breakProbability,
      resistanceRejectionProbability: rejectionProbability,
      resistanceBreakoutProbability: breakoutProbability,
      rangeContainmentProbability: containmentProbability,
      directionalBias,
      strategyBias: 'no_trade',
      confidence: 0,
      warnings,
    },
  };

  result.summary.strategyBias = mapReactionToStrategyBias(result, {
    ivRv: input.ivRv,
    adx: input.adx,
    gammaConfidence: input.gamma?.gammaConfidence,
    spot: input.spot,
  });

  // Confidence = max of support score, resistance score, range score
  result.summary.confidence = Math.max(
    nearestSupport?.strengthScore ?? 0,
    nearestResistance?.strengthScore ?? 0,
    activeRange?.rangeStrengthScore ?? 0,
  );

  return result;
}

// ── Empty Result ────────────────────────────────────────────────────────────

function emptyResult(input: PriceReactionInput, cfg: Config, warnings: string[]): PriceReactionResult {
  return {
    ticker: input.ticker,
    spot: input.spot,
    lookbackDays: cfg.lookbackDays,
    supportStats: [],
    resistanceStats: [],
    rangeStats: [],
    summary: {
      directionalBias: 'unclear',
      strategyBias: 'no_trade',
      confidence: 0,
      warnings,
    },
  };
}
