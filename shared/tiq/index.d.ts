// Hand-written types for newleafsystem-shared-tiq. Mirrors shared/indicators
// and shared/plan (no build step; keep in sync with the .js by hand).

export type CategoryKey = 'KQ' | 'EQ' | 'SQ' | 'RQ' | 'MQ';
export type ScoringMode = 'weighted_choice' | 'multi_select' | 'ranking' | 'diagnostic_only';

export interface ItemScore { earned: number; max: number; ruinFlag: boolean; mode: string; }
export interface CategoryRollup { raw: number; max: number; score: number; }
export interface RuinGateResult { tq: number; gated: boolean; banner: string | null; }
export interface TraitEntry { trait: string; raw: number; z: number; }

export interface SittingResult {
  categories: Record<string, CategoryRollup>;
  categoryScores: Record<string, number>;
  composite: number;
  tqRaw: number;
  tqMethod: 'anchor' | 'empirical';
  tq: number;
  ruinGate: RuinGateResult;
  ruinFlagCount: number;
  traits: { traits: Record<string, { raw: number; z: number }>; top: TraitEntry[] };
}

// ── scoring ──────────────────────────────────────────────────────────────────
export const CATEGORY_WEIGHTS: Record<CategoryKey, number>;
export const CATEGORY_KEYS: CategoryKey[];
export function scoreWeightedChoice(scoring: any, key: string | undefined): number;
export function scoreMultiSelect(scoring: any, keys: string[]): number;
export function kendallTau(order: string[], correctOrder: string[]): number;
export function scoreRanking(scoring: any, order: string[]): number;
export function scoreItem(item: any, response: any): ItemScore;
export function rollupCategories(items: any[], responsesById: Record<string, any>):
  { categories: Record<string, CategoryRollup>; ruinFlagCount: number };
export function composite(categoryScores: Record<string, number>, weights?: Record<string, number>): number;
export function anchorTQ(composite: number): number;
export function empiricalTQ(composite: number, norm: { mean: number; sd: number }): number;
export function computeTQ(composite: number, norm?: { n: number; mean: number; sd: number }):
  { tq: number; method: 'anchor' | 'empirical' };
export function applyRuinGate(tq: number, ctx: { RQ: number; ruinFlagCount: number }): RuinGateResult;
export function traitProfile(items: any[], responsesById: Record<string, any>, vocabulary?: string[]):
  { traits: Record<string, { raw: number; z: number }>; top: TraitEntry[] };
export function frontDoorScore(earned: number, available: number): number;
export function scoreSitting(bank: any, responsesById: Record<string, any>, opts?: { norm?: any }): SittingResult;

// ── norms (ported from docs/tiq/reference/tiq-percentile.js) ──────────────────
export function buildNormTable(scores: number[], meta?: object): any;
export function percentileOf(score: number, normTable: any, opts?: { z?: number }): any;
export function percentileBand(score: number, normTable: any, reliability: number, opts?: { z?: number }): any;
export function resolveCohort(ladder: string[], normTables: Map<string, any>, opts?: { minN?: number }): any;
export function buildLadder(meta: { countryCode?: string; subregion?: string; continent?: string; experienceBand?: string }): string[];
export function rankOf(score: number, normTable: any, opts?: { minN?: number }): any;
export function describeStanding(score: number, normTables: Map<string, any>, userMeta: any, opts?: { reliability?: number }): any;
export function criterionBand(tq: number): string;
export function displayPrecision(n: number): 'percentile' | 'decile' | 'quartile' | 'none';
export function sem(sd: number, reliability: number): number;
export function wilson(p: number, n: number, z?: number): { low: number; high: number };
export const DISPLAY_TIERS: Array<{ minN: number; precision: string }>;
export const RANK_MIN_N: number;
export const COHORT_MIN_N: number;

// ── calibration ──────────────────────────────────────────────────────────────
export function normalizeConfidence(rating: number, scaleMax?: number): number;
export function calibrationGap(entries: Array<{ confidence: number; quality: number }>, opts?: { threshold?: number }):
  { gap: number; label: 'Overconfident' | 'Underconfident' | 'Well calibrated'; n: number };
export function brierScore(entries: Array<{ confidence: number; correct: boolean | number }>): number;
export function impulsivityIndex(entries: Array<{ responseSeconds: number; estSeconds: number }>, opts?: { trim?: number; floor?: number }):
  { index: number; medianRatio: number; pace: 'Fast' | 'Measured' | 'Deliberate'; belowFloor: boolean };
export function consistencyIndex(pairs: Array<{ gainScore: number; lossScore: number }>):
  { index: number | null; penalty: number; nPairs: number };

// ── sim (money is INTEGER PENCE; call toPounds at the presentation boundary) ───
export const CONTRACT_MULTIPLIER: number;
export function toPence(pounds: number): number;
export function toPounds(pence: number): number;
export function legPence(credit: number, mark: number, n: number): number;
export function freshState(scenario: any): any;
/** Open P&L in integer pence. */
export function unrealised(state: any, script: Record<string, number>, t: string): number;
export function applyAction(state: any, action: string, t: string, script: Record<string, number>): any;
/** Final realised P&L in integer pence. Equal logs on different scripts return equal integers. */
export function replay(scenario: any, log: Array<{ act: string; t: string }>, script: Record<string, number>): number;
export function decisionScore(log: Array<{ points?: number; pts?: number }>): number;
export function scoreRun(scenario: any, log: any[], opts?: { primaryScript?: string }):
  { decisionScore: number; maxScore: number; pnl: Record<string, number>; primaryScript: string; lucky: boolean; robbed: boolean };

// ── engine ───────────────────────────────────────────────────────────────────
export const SCORING_VERSION: string;
export function provenance(opts?: {
  timestamp?: string; commitSha?: string; bankVersion?: string; normVersion?: string; scenarioVersion?: string;
}): object;

export const scoring: any;
export const norms: any;
export const calibration: any;
export const sim: any;
