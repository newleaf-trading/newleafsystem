/**
 * price-reaction.ts — Typed wrapper over shared/reaction/ engine
 * ─────────────────────────────────────────────────────────────────────────────
 * Thin adapter preserving the original API for strategy engine, leg-builder,
 * and existing tests. All analytics logic lives in shared/reaction/*.cjs.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const require = createRequire(import.meta.url);
const thisDir = path.dirname(fileURLToPath(import.meta.url));
// Dev runs from api/src/tools (repo-root /shared); Cloud Functions runs from dist/tools, where
// the build copies shared/reaction into the bundle at api/shared (→ /workspace/shared deployed).
const localReaction = path.resolve(thisDir, '../../../shared/reaction/index.cjs');
const deployedReaction = path.resolve(thisDir, '../../shared/reaction/index.cjs');
const reactionPath = require('fs').existsSync(localReaction) ? localReaction : deployedReaction;
const reaction = require(reactionPath);

const {
  clusterLevels, gatherLevels,
  analyzeZone, findZoneTouches, wilsonInterval,
  forwardReturns: fwdReturns,
  premiumLabel, premiumScore,
  classifyRegime: classifyRegimeFn, computeContainment,
  setupQuality,
} = reaction;

// ── Re-exported types (unchanged from original) ─────────────────────────────

export type Candle = {
  date: string; open: number; high: number; low: number; close: number;
  volume?: number; rsi14?: number; macd?: number; macdSignal?: number;
  macdHistogram?: number; sma20?: number; sma50?: number; sma100?: number;
  sma200?: number; bollingerUpper?: number; bollingerMiddle?: number; bollingerLower?: number;
};

export type PriceLevel = {
  level: number; label?: string;
  source: 'manual' | 'swing' | 'gamma_wall' | 'bollinger' | 'moving_average' | 'pivot';
  strength?: number;
};

export type GammaContext = {
  putWall?: number; callWall?: number; gammaLow?: number; gammaHigh?: number;
  gammaConfidence?: number; positionInBandPct?: number;
};

export type PriceReactionInput = {
  ticker: string; spot: number; candles: Candle[];
  supportLevels: PriceLevel[]; resistanceLevels: PriceLevel[];
  gamma?: GammaContext; ivRv?: number; adx?: number;
  lookbackDays?: number; zonePct?: number;
  bounceThresholdPct?: number; breakThresholdPct?: number; forwardWindows?: number[];
};

export type LevelReactionStats = {
  level: number; label?: string; source: string; zoneLow: number; zoneHigh: number;
  touchCount: number; bounceCount?: number; breakCount?: number;
  rejectionCount?: number; breakoutCount?: number;
  fakeBreakCount?: number; fakeBreakoutCount?: number;
  bounceRate?: number; breakRate?: number; rejectionRate?: number; breakoutRate?: number;
  fakeBreakRate?: number; fakeBreakoutRate?: number;
  avgReturn3d?: number; avgReturn5d?: number; avgReturn10d?: number; avgReturn20d?: number;
  medianReturn5d?: number;
  avgMaxAdverseMove?: number; avgMaxFavorableMove?: number;
  volumeConfirmationRate?: number; rsiConfirmationRate?: number; macdConfirmationRate?: number;
  gammaAlignment?: boolean; strengthScore: number;
  classification: 'strong_support' | 'weak_support' | 'broken_support'
    | 'strong_resistance' | 'weak_resistance' | 'broken_resistance'
    | 'range_boundary' | 'insufficient_data';
};

export type RangeStats = {
  support: number; resistance: number; widthPct: number; rangeTouchCount: number;
  containmentRate5d: number; containmentRate10d: number; containmentRate20d: number;
  avgReturnInsideRange5d: number; avgReturnInsideRange10d: number;
  avgMaxAdverseMove: number; rangeStrengthScore: number;
  classification: 'strong_range' | 'weak_range' | 'breakout_prone' | 'insufficient_data';
};

export type PriceReactionResult = {
  ticker: string; spot: number; lookbackDays: number;
  supportStats: LevelReactionStats[]; resistanceStats: LevelReactionStats[];
  rangeStats: RangeStats[];
  nearestSupport?: LevelReactionStats; nearestResistance?: LevelReactionStats;
  activeRange?: RangeStats;
  summary: {
    supportBounceProbability?: number; supportBreakProbability?: number;
    resistanceRejectionProbability?: number; resistanceBreakoutProbability?: number;
    rangeContainmentProbability?: number;
    directionalBias: 'bullish_bounce' | 'bearish_breakdown' | 'bearish_rejection'
      | 'bullish_breakout' | 'range_bound' | 'unclear';
    strategyBias: 'bull_call_spread' | 'bull_put_spread' | 'bear_call_spread' | 'bear_put_spread'
      | 'iron_condor' | 'iron_butterfly' | 'broken_wing_butterfly' | 'no_trade';
    confidence: number; warnings: string[];
  };
};

// ── Adapters: level → zone ──────────────────────────────────────────────────

function levelToZone(level: number, zonePct: number, type: 'support' | 'resistance', sources: string[] = ['level']) {
  const half = level * (zonePct / 100);
  return {
    lo: level - half, hi: level + half,
    touchLo: level - half * 1.25, touchHi: level + half * 1.25,
    sources, type,
  };
}

// ── Wrapped exports (same signatures as original) ───────────────────────────

export function findTouchEvents(
  candles: Candle[], level: number, zonePct: number, type: 'support' | 'resistance',
) {
  const zone = levelToZone(level, zonePct, type);
  return findZoneTouches(candles, zone, type);
}

export function calculateForwardReturns(
  candles: Candle[], eventIndex: number, windows: number[],
): Record<number, number> {
  const base = candles[eventIndex]?.close;
  if (!base) return {};
  const r: Record<number, number> = {};
  for (const w of windows) {
    if (eventIndex + w < candles.length) {
      r[w] = (candles[eventIndex + w].close - base) / base;
    }
  }
  return r;
}

export function calculateMaxAdverseMove(
  candles: Candle[], eventIndex: number, window: number, type: 'support' | 'resistance',
): number {
  const base = candles[eventIndex]?.close;
  if (!base) return 0;
  const end = Math.min(eventIndex + window, candles.length);
  let max = 0;
  for (let i = eventIndex + 1; i < end; i++) {
    const m = type === 'support' ? (candles[i].low - base) / base : (candles[i].high - base) / base;
    if (type === 'support' && m < max) max = m;
    if (type === 'resistance' && m > max) max = m;
  }
  return max;
}

export function classifySupportTouch(
  event: any, candles: Candle[], level: number, zonePct: number, cfg: any,
) {
  const zone = levelToZone(level, zonePct, 'support');
  const breakTarget = zone.touchLo * (1 - (cfg.breakThresholdPct || 1) / 100);
  const bounceTarget = event.touchClose * (1 + (cfg.bounceThresholdPct || 3) / 100);
  const end = Math.min(event.index + (cfg.maxDaysToConfirmBounce || 5), candles.length);
  let cls = 'unresolved', closedBelow = 0, fakeR = false;
  for (let i = event.index + 1; i < end; i++) {
    const c = candles[i];
    if (c.close >= bounceTarget && cls === 'unresolved') { cls = 'bounce'; break; }
    if (c.close < breakTarget) { closedBelow++; if (closedBelow >= (cfg.maxDaysToConfirmBreak || 2)) { cls = 'break'; break; } }
    else { if (closedBelow > 0 && c.close >= zone.touchLo) fakeR = true; closedBelow = 0; }
  }
  if (cls === 'unresolved' && fakeR) cls = 'fake_break';
  return {
    ...event, classification: cls,
    forwardReturns: calculateForwardReturns(candles, event.index, cfg.forwardWindows || [3, 5, 10, 20]),
    maxAdverseMove: calculateMaxAdverseMove(candles, event.index, cfg.maxDaysToConfirmBounce || 5, 'support'),
    maxFavorableMove: 0,
    volumeConfirmed: false, rsiConfirmed: !!(event.candle?.rsi14 != null && event.candle.rsi14 < 40),
    macdConfirmed: false,
  };
}

export function classifyResistanceTouch(
  event: any, candles: Candle[], level: number, zonePct: number, cfg: any,
) {
  const zone = levelToZone(level, zonePct, 'resistance');
  const rejTarget = event.touchClose * (1 - (cfg.bounceThresholdPct || 3) / 100);
  const breakoutTarget = zone.touchHi * (1 + (cfg.breakThresholdPct || 1) / 100);
  const end = Math.min(event.index + (cfg.maxDaysToConfirmBounce || 5), candles.length);
  let cls = 'unresolved', closedAbove = 0, fakeR = false;
  for (let i = event.index + 1; i < end; i++) {
    const c = candles[i];
    if (c.close <= rejTarget && cls === 'unresolved') { cls = 'rejection'; break; }
    if (c.close > breakoutTarget) { closedAbove++; if (closedAbove >= (cfg.maxDaysToConfirmBreak || 2)) { cls = 'breakout'; break; } }
    else { if (closedAbove > 0 && c.close <= zone.touchHi) fakeR = true; closedAbove = 0; }
  }
  if (cls === 'unresolved' && fakeR) cls = 'fake_breakout';
  return {
    ...event, classification: cls,
    forwardReturns: calculateForwardReturns(candles, event.index, cfg.forwardWindows || [3, 5, 10, 20]),
    maxAdverseMove: calculateMaxAdverseMove(candles, event.index, cfg.maxDaysToConfirmBounce || 5, 'resistance'),
    maxFavorableMove: 0,
    volumeConfirmed: false, rsiConfirmed: !!(event.candle?.rsi14 != null && event.candle.rsi14 > 60),
    macdConfirmed: false,
  };
}

export function analyzeSupportLevel(
  candles: Candle[], supportLevel: PriceLevel, cfg: any, gamma?: GammaContext,
): LevelReactionStats {
  const zone = levelToZone(supportLevel.level, cfg.zonePct || 1.0, 'support', [supportLevel.label || supportLevel.source]);
  const stats = analyzeZone(candles, zone, 'support', { minTouches: cfg.minTouchesForValidLevel ?? 3 });
  const gammaAligned = !!(gamma?.putWall && Math.abs(gamma.putWall - supportLevel.level) / supportLevel.level < 0.02);

  return {
    level: supportLevel.level, label: supportLevel.label, source: supportLevel.source,
    zoneLow: zone.lo, zoneHigh: zone.hi,
    touchCount: stats.touchCount,
    bounceCount: stats.holdCount, breakCount: stats.breakCount, fakeBreakCount: stats.fakeBreakCount,
    bounceRate: stats.touchCount > 0 ? stats.holdCount / stats.touchCount : undefined,
    breakRate: stats.touchCount > 0 ? stats.breakCount / stats.touchCount : undefined,
    fakeBreakRate: stats.touchCount > 0 ? (stats.fakeBreakCount || 0) / stats.touchCount : undefined,
    avgReturn3d: undefined, avgReturn5d: undefined, avgReturn10d: undefined, avgReturn20d: undefined,
    avgMaxAdverseMove: undefined, avgMaxFavorableMove: undefined,
    volumeConfirmationRate: stats.volConfRate,
    rsiConfirmationRate: stats.touches?.filter((t: any) => t.candle?.rsi14 != null && t.candle.rsi14 < 40).length / (stats.touchCount || 1) || undefined,
    macdConfirmationRate: undefined,
    gammaAlignment: gammaAligned,
    strengthScore: stats.score,
    classification: stats.touchCount < (cfg.minTouchesForValidLevel || 3)
      ? 'insufficient_data'
      : (stats.breakCount / (stats.touchCount || 1) > 0.5) ? 'broken_support'
      : (stats.smoothedRate >= 0.6 && stats.score >= 50) ? 'strong_support' : 'weak_support',
  };
}

export function analyzeResistanceLevel(
  candles: Candle[], resistanceLevel: PriceLevel, cfg: any, gamma?: GammaContext,
): LevelReactionStats {
  const zone = levelToZone(resistanceLevel.level, cfg.zonePct || 1.0, 'resistance', [resistanceLevel.label || resistanceLevel.source]);
  const stats = analyzeZone(candles, zone, 'resistance', { minTouches: cfg.minTouchesForValidLevel ?? 3 });
  const gammaAligned = !!(gamma?.callWall && Math.abs(gamma.callWall - resistanceLevel.level) / resistanceLevel.level < 0.02);

  return {
    level: resistanceLevel.level, label: resistanceLevel.label, source: resistanceLevel.source,
    zoneLow: zone.lo, zoneHigh: zone.hi,
    touchCount: stats.touchCount,
    rejectionCount: stats.rejectCount, breakoutCount: stats.breakoutCount, fakeBreakoutCount: stats.fakeBreakoutCount,
    rejectionRate: stats.touchCount > 0 ? stats.rejectCount / stats.touchCount : undefined,
    breakoutRate: stats.touchCount > 0 ? stats.breakoutCount / stats.touchCount : undefined,
    fakeBreakoutRate: stats.touchCount > 0 ? (stats.fakeBreakoutCount || 0) / stats.touchCount : undefined,
    avgReturn3d: undefined, avgReturn5d: undefined, avgReturn10d: undefined, avgReturn20d: undefined,
    avgMaxAdverseMove: undefined, avgMaxFavorableMove: undefined,
    volumeConfirmationRate: stats.volConfRate,
    rsiConfirmationRate: stats.touches?.filter((t: any) => t.candle?.rsi14 != null && t.candle.rsi14 > 60).length / (stats.touchCount || 1) || undefined,
    macdConfirmationRate: undefined,
    gammaAlignment: gammaAligned,
    strengthScore: stats.score,
    classification: stats.touchCount < (cfg.minTouchesForValidLevel || 3)
      ? 'insufficient_data'
      : (stats.breakoutCount / (stats.touchCount || 1) > 0.5) ? 'broken_resistance'
      : (stats.smoothedRate >= 0.6 && stats.score >= 50) ? 'strong_resistance' : 'weak_resistance',
  };
}

export function analyzeRange(
  candles: Candle[], supportLevel: PriceLevel, resistanceLevel: PriceLevel, cfg: any, gamma?: GammaContext,
): RangeStats {
  const sZone = levelToZone(supportLevel.level, cfg.zonePct || 1.0, 'support');
  const rZone = levelToZone(resistanceLevel.level, cfg.zonePct || 1.0, 'resistance');

  // Use merged band for containment (D1 fix)
  const lo = sZone.touchLo;
  const hi = rZone.touchHi;
  const mid = (supportLevel.level + resistanceLevel.level) / 2;
  const widthPct = mid > 0 ? ((resistanceLevel.level - supportLevel.level) / mid) * 100 : 0;

  function cont(w: number) {
    if (candles.length < w) return 0;
    const recent = candles.slice(-w);
    let inside = 0;
    for (const c of recent) { if (c.low >= lo && c.high <= hi) inside++; }
    return inside / recent.length;
  }

  let tc = 0;
  for (const c of candles) {
    if (c.low <= sZone.hi && c.low >= sZone.lo) tc++;
    if (c.high >= rZone.lo && c.high <= rZone.hi) tc++;
  }

  const am: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    if (candles[i - 1].close >= lo && candles[i - 1].close <= hi) {
      am.push(Math.min(0, (candles[i].low - candles[i - 1].close) / candles[i - 1].close));
    }
  }

  const c5 = cont(5), c10 = cont(10), c20 = cont(20);
  let score = Math.min(40, c20 * 40)
    + (widthPct >= 3 && widthPct <= 15 ? 20 : widthPct > 15 && widthPct <= 25 ? 10 : 0)
    + Math.min(15, (Math.min(tc, 20) / 20) * 15)
    + Math.max(0, (1 - Math.abs(am.length ? am.reduce((a, b) => a + b, 0) / am.length : 0) * 20) * 15);
  if (gamma?.gammaConfidence && gamma.gammaConfidence > 0.5) score += 10;
  else if (gamma?.gammaConfidence && gamma.gammaConfidence > 0.3) score += 5;
  score = Math.round(Math.min(100, Math.max(0, score)));

  let cls: RangeStats['classification'] = 'insufficient_data';
  if (tc >= 4 && c20 >= 0.6 && score >= 50) cls = 'strong_range';
  else if (c20 < 0.3) cls = 'breakout_prone';
  else if (tc >= 4) cls = 'weak_range';

  return {
    support: supportLevel.level, resistance: resistanceLevel.level, widthPct,
    rangeTouchCount: tc,
    containmentRate5d: c5, containmentRate10d: c10, containmentRate20d: c20,
    avgReturnInsideRange5d: 0, avgReturnInsideRange10d: 0,
    avgMaxAdverseMove: am.length ? am.reduce((a, b) => a + b, 0) / am.length : 0,
    rangeStrengthScore: score, classification: cls,
  };
}

export function calculateSupportStrengthScore(stats: LevelReactionStats): number {
  // Delegate concept: score from the zone stats
  if (stats.touchCount === 0) return 0;
  let sc = Math.min(30, (stats.bounceRate ?? 0) * 30)
    + Math.min(15, (Math.min(stats.touchCount, 10) / 10) * 15)
    + Math.max(0, (1 - (stats.breakRate ?? 0)) * 15)
    + Math.min(15, Math.max(0, (Math.max(stats.avgReturn5d ?? 0, stats.avgReturn10d ?? 0)) * 200))
    + Math.max(0, (1 - Math.abs(stats.avgMaxAdverseMove ?? 0) * 20) * 10)
    + ((stats.volumeConfirmationRate ?? 0) + (stats.rsiConfirmationRate ?? 0)) / 2 * 10;
  if (stats.gammaAlignment) sc += 5;
  return Math.round(Math.min(100, Math.max(0, sc)));
}

export function calculateResistanceStrengthScore(stats: LevelReactionStats): number {
  if (stats.touchCount === 0) return 0;
  let sc = Math.min(30, (stats.rejectionRate ?? 0) * 30)
    + Math.min(15, (Math.min(stats.touchCount, 10) / 10) * 15)
    + Math.max(0, (1 - (stats.breakoutRate ?? 0)) * 15)
    + Math.min(15, Math.max(0, Math.abs(Math.min(stats.avgReturn5d ?? 0, stats.avgReturn10d ?? 0)) * 200))
    + Math.max(0, (1 - Math.abs(stats.avgMaxAdverseMove ?? 0) * 20) * 10)
    + ((stats.volumeConfirmationRate ?? 0) + (stats.rsiConfirmationRate ?? 0)) / 2 * 10;
  if (stats.gammaAlignment) sc += 5;
  return Math.round(Math.min(100, Math.max(0, sc)));
}

export function mapReactionToStrategyBias(
  result: PriceReactionResult,
  marketContext: { ivRv?: number; adx?: number; gammaConfidence?: number; spot?: number },
): PriceReactionResult['summary']['strategyBias'] {
  const { nearestSupport: ns, nearestResistance: nr, activeRange: ar } = result;
  const ivRv = marketContext.ivRv ?? 1.0;
  const adx = marketContext.adx ?? 25;
  const gammaConf = marketContext.gammaConfidence ?? 0;
  const spot = marketContext.spot ?? result.spot;

  if (ar && ar.containmentRate20d > 0.6 && adx < 20 && ivRv >= 1.2) {
    if (ar.containmentRate20d > 0.7 && gammaConf > 0.6) {
      const rangeMid = (ar.support + ar.resistance) / 2;
      if (Math.abs(spot - rangeMid) / rangeMid < 0.02) return 'iron_butterfly';
    }
    return 'iron_condor';
  }
  if (ns && (ns.bounceRate ?? 0) > 0.6 && ns.strengthScore > 65) return ivRv >= 1.2 ? 'bull_put_spread' : 'bull_call_spread';
  if (nr && (nr.rejectionRate ?? 0) > 0.6 && nr.strengthScore > 65) return ivRv >= 1.2 ? 'bear_call_spread' : 'bear_put_spread';
  if (ns && (ns.bounceRate ?? 0) > 0.4 && ns.strengthScore > 40) return 'broken_wing_butterfly';
  if (nr && (nr.rejectionRate ?? 0) > 0.4 && nr.strengthScore > 40) return 'broken_wing_butterfly';
  if (ns && (ns.breakRate ?? 0) > 0.5) return 'no_trade';
  if (nr && (nr.breakoutRate ?? 0) > 0.5) return 'no_trade';
  return 'no_trade';
}

export function analyzePriceReactions(input: PriceReactionInput): PriceReactionResult {
  const cfg = {
    lookbackDays: input.lookbackDays ?? 365,
    zonePct: input.zonePct ?? 1.0,
    bounceThresholdPct: input.bounceThresholdPct ?? 3.0,
    breakThresholdPct: input.breakThresholdPct ?? 1.0,
    forwardWindows: input.forwardWindows ?? [3, 5, 10, 20],
    minTouchesForValidLevel: 3,
    maxDaysToConfirmBounce: 5,
    maxDaysToConfirmBreak: 2,
  };

  const warnings: string[] = [];
  const candles = cfg.lookbackDays < input.candles.length ? input.candles.slice(-cfg.lookbackDays) : input.candles;

  if (candles.length < 20) {
    warnings.push(`Only ${candles.length} candles available (need >= 20)`);
    return emptyResult(input, cfg.lookbackDays, warnings);
  }

  const supportStats = input.supportLevels.map(l => analyzeSupportLevel(candles, l, cfg, input.gamma));
  const resistanceStats = input.resistanceLevels.map(l => analyzeResistanceLevel(candles, l, cfg, input.gamma));

  const validS = supportStats.filter(s => s.touchCount > 0);
  const validR = resistanceStats.filter(r => r.touchCount > 0);
  const nearestSupport = validS.length > 0
    ? validS.reduce((b, s) => Math.abs(s.level - input.spot) < Math.abs(b.level - input.spot) ? s : b) : supportStats[0];
  const nearestResistance = validR.length > 0
    ? validR.reduce((b, r) => Math.abs(r.level - input.spot) < Math.abs(b.level - input.spot) ? r : b) : resistanceStats[0];

  const rangeStats: RangeStats[] = [];
  if (nearestSupport && nearestResistance && nearestSupport.level < nearestResistance.level) {
    rangeStats.push(analyzeRange(candles,
      { level: nearestSupport.level, source: nearestSupport.source as PriceLevel['source'] },
      { level: nearestResistance.level, source: nearestResistance.source as PriceLevel['source'] },
      cfg, input.gamma));
  }
  const activeRange = rangeStats[0];

  const bp = nearestSupport?.bounceRate;
  const bkp = nearestSupport?.breakRate;
  const rp = nearestResistance?.rejectionRate;
  const bop = nearestResistance?.breakoutRate;
  const cp = activeRange?.containmentRate20d;

  let directionalBias: PriceReactionResult['summary']['directionalBias'] = 'unclear';
  if (cp != null && cp > 0.6) directionalBias = 'range_bound';
  else if (bp != null && bp > 0.6) directionalBias = 'bullish_bounce';
  else if (rp != null && rp > 0.6) directionalBias = 'bearish_rejection';
  else if (bop != null && bop > 0.5) directionalBias = 'bullish_breakout';
  else if (bkp != null && bkp > 0.5) directionalBias = 'bearish_breakdown';

  const result: PriceReactionResult = {
    ticker: input.ticker, spot: input.spot, lookbackDays: cfg.lookbackDays,
    supportStats, resistanceStats, rangeStats,
    nearestSupport, nearestResistance, activeRange,
    summary: {
      supportBounceProbability: bp, supportBreakProbability: bkp,
      resistanceRejectionProbability: rp, resistanceBreakoutProbability: bop,
      rangeContainmentProbability: cp,
      directionalBias, strategyBias: 'no_trade',
      confidence: Math.max(nearestSupport?.strengthScore ?? 0, nearestResistance?.strengthScore ?? 0, activeRange?.rangeStrengthScore ?? 0),
      warnings,
    },
  };

  result.summary.strategyBias = mapReactionToStrategyBias(result, {
    ivRv: input.ivRv, adx: input.adx, gammaConfidence: input.gamma?.gammaConfidence, spot: input.spot,
  });

  return result;
}

function emptyResult(input: PriceReactionInput, lookbackDays: number, warnings: string[]): PriceReactionResult {
  return {
    ticker: input.ticker, spot: input.spot, lookbackDays,
    supportStats: [], resistanceStats: [], rangeStats: [],
    summary: { directionalBias: 'unclear', strategyBias: 'no_trade', confidence: 0, warnings },
  };
}
