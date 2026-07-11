/**
 * reaction-features.ts — API wrapper over the SHARED reaction gate (engine unification, Step 2).
 * ─────────────────────────────────────────────────────────────────────────────
 * Delegates to shared/reaction/gate.cjs — the SAME code the pipeline and movement-range
 * use — so the API can never disagree with them. It runs the full S/R pipeline +
 * mapBias (with the falling-knife veto), and decides: veto / promote / keep.
 * ─────────────────────────────────────────────────────────────────────────────
 */
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import type { Bar } from './alpaca.js';

const require = createRequire(import.meta.url);
const thisDir = path.dirname(fileURLToPath(import.meta.url));
// Dev runs from api/src/tools (repo-root /shared); Cloud Functions runs from dist/tools where the
// build copies shared/reaction into the bundle at api/shared (→ /workspace/shared deployed).
const localReaction = path.resolve(thisDir, '../../../shared/reaction/index.cjs');
const deployedReaction = path.resolve(thisDir, '../../shared/reaction/index.cjs');
const R = require(fs.existsSync(localReaction) ? localReaction : deployedReaction);

export interface ReactionRail { level: number; score: number; rate: number; tested: boolean; }
export interface ReactionGate {
  regime: string; regimeConfidence: number; trendIntoZone: boolean;
  bias: string; biasCategory: string; posInRange: number | null; noTradeReason: string | null;
  qualityBounce: boolean; rsi: number | null;
  support: ReactionRail | null; resistance: ReactionRail | null;
  testingSupport: boolean; testingResistance: boolean;
}
export interface ReactionAction {
  veto?: boolean; strategy?: string; direction?: 'bullish' | 'bearish'; testing?: boolean;
  flag: string; note: string;
}

/** Run the shared reaction gate for one name. Returns null if data is insufficient. */
export function computeReactionGate(opts: {
  spot: number; bars: Bar[];
  putWall: number | null; callWall: number | null;
  sma50: number | null; sma100: number | null; sma200: number | null;
  bbLower: number | null; bbUpper: number | null;
  atrPct: number | null; adx: number | null; ivRv: number | null; gammaConfidence: number;
  rsi?: number | null; isQualityName?: boolean;
}): ReactionGate | null {
  const candles = (opts.bars || []).map(b => ({ date: b.t, open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v }));
  return R.computeReactionGate({
    spot: opts.spot, candles,
    putWall: opts.putWall ?? undefined, callWall: opts.callWall ?? undefined,
    sma50: opts.sma50 ?? undefined, sma100: opts.sma100 ?? undefined, sma200: opts.sma200 ?? undefined,
    bbLower: opts.bbLower ?? undefined, bbUpper: opts.bbUpper ?? undefined,
    atrPct: opts.atrPct ?? 0.02, adx: opts.adx ?? undefined,
    ivRv: opts.ivRv ?? 0, gammaConfidence: opts.gammaConfidence,
    rsi: opts.rsi ?? undefined, isQualityName: !!opts.isQualityName,
  }) as ReactionGate | null;
}

/** veto (falling knife) · promote neutral pick to directional · or null (keep gamma pick). */
export function applyReactionGate(gammaStrategyCode: string, gate: ReactionGate | null): ReactionAction | null {
  return R.applyReactionGate(gammaStrategyCode, gate) as ReactionAction | null;
}
