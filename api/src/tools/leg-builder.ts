/**
 * leg-builder.ts — Deterministic option leg construction
 * ─────────────────────────────────────────────────────────────────────────────
 * Pure functions. No I/O, no LLM calls. Given a strategy name + chain data +
 * gamma walls, builds structurally correct legs snapped to real strikes.
 *
 * The LLM's job is judgment (which strategy fits this regime?).
 * This module's job is mechanical construction (given iron_condor, build it).
 * ─────────────────────────────────────────────────────────────────────────────
 */

import type { OptionContract } from './alpaca.js';

// ── Types ───────────────────────────────────────────────────────────────────

export interface BuiltLeg {
  type: 'call' | 'put';
  side: 'long' | 'short';
  strike: number;
  qty: number;
}

export interface LegBuilderInput {
  strategy: string;
  contracts: OptionContract[];
  spot: number;
  gammaWalls: { putWall: number | null; callWall: number | null };
  direction: 'bullish' | 'bearish' | 'neutral';
  dte: number;
  bwbStrikes?: {
    direction: 'put' | 'call';
    longPutUpper?: number; shortPut?: number; longPutLower?: number;
    longCallLower?: number; shortCall?: number; longCallUpper?: number;
  };
}

export interface LegBuilderResult {
  legs: BuiltLeg[];
  meta: {
    wingWidth: number;
    anchors: Array<{ strike: number; level: string }>;
    warnings: string[];
  };
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Target wing width based on stock price tier. */
export function wingWidth(spot: number): number {
  if (spot < 25)  return 1;
  if (spot < 50)  return 2.5;
  if (spot < 100) return 5;
  if (spot < 250) return 5;
  if (spot < 500) return 10;
  return 25;
}

/** Median strike spacing for a given option type near spot. */
export function detectStrikeIncrement(
  contracts: OptionContract[], optionType: 'call' | 'put', spot: number
): number {
  const range = spot * 0.10;
  const strikes = contracts
    .filter(c => c.type === optionType && c.strike >= spot - range && c.strike <= spot + range)
    .map(c => c.strike)
    .sort((a, b) => a - b);

  if (strikes.length < 2) return wingWidth(spot);

  const diffs: number[] = [];
  for (let i = 1; i < strikes.length; i++) {
    const d = +(strikes[i] - strikes[i - 1]).toFixed(4);
    if (d > 0) diffs.push(d);
  }
  if (diffs.length === 0) return wingWidth(spot);

  diffs.sort((a, b) => a - b);
  return diffs[Math.floor(diffs.length / 2)]; // median
}

/**
 * Snap a target price to the nearest real strike in the chain.
 * Prefers strikes with bid > 0 (liquid). Falls back to any strike
 * if nothing liquid is within 3 strike increments.
 *
 * @param direction 'down' prefers the strike at or below target, 'up' at or above, 'nearest' closest.
 */
export function snapToChain(
  target: number,
  contracts: OptionContract[],
  optionType: 'call' | 'put',
  direction: 'nearest' | 'down' | 'up' = 'nearest',
): OptionContract | null {
  const typed = contracts.filter(c => c.type === optionType);
  if (typed.length === 0) return null;

  const liquid = typed.filter(c => c.bid > 0);
  const pool = liquid.length > 0 ? liquid : typed;

  // Sort by distance, with direction bias
  const scored = pool.map(c => {
    let dist = Math.abs(c.strike - target);
    // Penalize wrong-direction strikes slightly
    if (direction === 'down' && c.strike > target) dist += 0.001;
    if (direction === 'up'   && c.strike < target) dist += 0.001;
    return { contract: c, dist };
  }).sort((a, b) => a.dist - b.dist);

  // If we used the liquid pool and the best match is too far, try the full pool
  if (liquid.length > 0 && scored.length > 0) {
    const inc = detectStrikeIncrement(contracts, optionType, target);
    if (scored[0].dist > inc * 3) {
      // Fall back to full pool
      const allScored = typed.map(c => ({
        contract: c,
        dist: Math.abs(c.strike - target) + (direction === 'down' && c.strike > target ? 0.001 : 0)
                                           + (direction === 'up' && c.strike < target ? 0.001 : 0),
      })).sort((a, b) => a.dist - b.dist);
      return allScored[0]?.contract ?? null;
    }
  }

  return scored[0]?.contract ?? null;
}

/**
 * Nearest ATM strike that has both a call and put available.
 * Prefers strikes where both sides have bid > 0.
 */
export function nearestATM(contracts: OptionContract[], spot: number): number | null {
  const strikeSet = new Set(contracts.map(c => c.strike));
  const strikes = [...strikeSet].sort((a, b) => Math.abs(a - spot) - Math.abs(b - spot));

  // First pass: both call + put with bid > 0
  for (const s of strikes) {
    const call = contracts.find(c => c.strike === s && c.type === 'call' && c.bid > 0);
    const put  = contracts.find(c => c.strike === s && c.type === 'put'  && c.bid > 0);
    if (call && put) return s;
  }

  // Second pass: both call + put exist (regardless of bid)
  for (const s of strikes) {
    const hasCall = contracts.some(c => c.strike === s && c.type === 'call');
    const hasPut  = contracts.some(c => c.strike === s && c.type === 'put');
    if (hasCall && hasPut) return s;
  }

  // Last resort: nearest strike of any kind
  return strikes[0] ?? null;
}

// ── Strategy Builders ───────────────────────────────────────────────────────

function empty(warning: string): LegBuilderResult {
  return { legs: [], meta: { wingWidth: 0, anchors: [], warnings: [warning] } };
}

function buildIronCondor(input: LegBuilderInput): LegBuilderResult {
  const { contracts, spot, gammaWalls } = input;
  const warnings: string[] = [];
  const ww = wingWidth(spot);
  const putWall = gammaWalls.putWall ?? spot * 0.95;
  const callWall = gammaWalls.callWall ?? spot * 1.05;

  if (putWall >= callWall) return empty('Put wall >= call wall — condor not viable');

  const shortPut  = snapToChain(putWall,  contracts, 'put',  'nearest');
  const shortCall = snapToChain(callWall, contracts, 'call', 'nearest');
  if (!shortPut || !shortCall) return empty('No contracts available for condor short strikes');

  // Ensure shorts don't cross
  if (shortPut.strike >= shortCall.strike) {
    return empty(`Short strikes crossed after snap: put $${shortPut.strike} >= call $${shortCall.strike}`);
  }

  const longPut  = snapToChain(shortPut.strike - ww,  contracts, 'put',  'down');
  const longCall = snapToChain(shortCall.strike + ww, contracts, 'call', 'up');
  if (!longPut || !longCall) return empty('No contracts available for condor wing strikes');

  // Ensure long strikes are actually outside shorts
  if (longPut.strike >= shortPut.strike) {
    // Try next strike down
    const inc = detectStrikeIncrement(contracts, 'put', spot);
    const retry = snapToChain(shortPut.strike - inc * 2, contracts, 'put', 'down');
    if (!retry || retry.strike >= shortPut.strike) return empty('Cannot place long put below short put');
    warnings.push(`Long put adjusted: $${longPut.strike} → $${retry.strike}`);
    longPut.strike = retry.strike; longPut.bid = retry.bid; longPut.ask = retry.ask;
  }
  if (longCall.strike <= shortCall.strike) {
    const inc = detectStrikeIncrement(contracts, 'call', spot);
    const retry = snapToChain(shortCall.strike + inc * 2, contracts, 'call', 'up');
    if (!retry || retry.strike <= shortCall.strike) return empty('Cannot place long call above short call');
    warnings.push(`Long call adjusted: $${longCall.strike} → $${retry.strike}`);
    longCall.strike = retry.strike; longCall.bid = retry.bid; longCall.ask = retry.ask;
  }

  return {
    legs: [
      { type: 'put',  side: 'long',  strike: longPut.strike,   qty: 1 },
      { type: 'put',  side: 'short', strike: shortPut.strike,  qty: 1 },
      { type: 'call', side: 'short', strike: shortCall.strike, qty: 1 },
      { type: 'call', side: 'long',  strike: longCall.strike,  qty: 1 },
    ],
    meta: {
      wingWidth: ww,
      anchors: [
        { strike: shortPut.strike,  level: 'put_wall' },
        { strike: shortCall.strike, level: 'call_wall' },
      ],
      warnings,
    },
  };
}

function buildIronButterfly(input: LegBuilderInput): LegBuilderResult {
  const { contracts, spot } = input;
  const warnings: string[] = [];
  const ww = wingWidth(spot);

  const body = nearestATM(contracts, spot);
  if (body === null) return empty('No ATM strike available for butterfly body');

  const longPut  = snapToChain(body - ww, contracts, 'put',  'down');
  const longCall = snapToChain(body + ww, contracts, 'call', 'up');
  if (!longPut || !longCall) return empty('No contracts available for butterfly wings');

  // Ensure wings are outside body
  if (longPut.strike >= body) {
    const inc = detectStrikeIncrement(contracts, 'put', spot);
    const retry = snapToChain(body - inc * 2, contracts, 'put', 'down');
    if (!retry || retry.strike >= body) return empty('Cannot place long put below butterfly body');
    warnings.push(`Long put adjusted to $${retry.strike}`);
    return buildResult(retry.strike);
  }
  if (longCall.strike <= body) {
    const inc = detectStrikeIncrement(contracts, 'call', spot);
    const retry = snapToChain(body + inc * 2, contracts, 'call', 'up');
    if (!retry || retry.strike <= body) return empty('Cannot place long call above butterfly body');
    warnings.push(`Long call adjusted to $${retry.strike}`);
    return buildResult(undefined, retry.strike);
  }

  return buildResult();

  function buildResult(overridePut?: number, overrideCall?: number) {
    return {
      legs: [
        { type: 'put'  as const, side: 'long'  as const, strike: overridePut ?? longPut!.strike, qty: 1 },
        { type: 'put'  as const, side: 'short' as const, strike: body!,                          qty: 1 },
        { type: 'call' as const, side: 'short' as const, strike: body!,                          qty: 1 },
        { type: 'call' as const, side: 'long'  as const, strike: overrideCall ?? longCall!.strike, qty: 1 },
      ],
      meta: { wingWidth: ww, anchors: [{ strike: body!, level: 'spot' }], warnings },
    };
  }
}

function buildBullPutSpread(input: LegBuilderInput): LegBuilderResult {
  const { contracts, spot, gammaWalls } = input;
  const warnings: string[] = [];
  const ww = wingWidth(spot);
  const putWall = gammaWalls.putWall ?? spot * 0.95;

  const shortPut = snapToChain(putWall, contracts, 'put', 'nearest');
  if (!shortPut) return empty('No put contracts available near put wall');

  let longPut = snapToChain(shortPut.strike - ww, contracts, 'put', 'down');
  if (!longPut || longPut.strike >= shortPut.strike) {
    const inc = detectStrikeIncrement(contracts, 'put', spot);
    longPut = snapToChain(shortPut.strike - inc * 2, contracts, 'put', 'down');
    if (!longPut || longPut.strike >= shortPut.strike) return empty('Cannot place long put below short put');
    warnings.push(`Long put adjusted to $${longPut.strike}`);
  }

  return {
    legs: [
      { type: 'put', side: 'long',  strike: longPut.strike,  qty: 1 },
      { type: 'put', side: 'short', strike: shortPut.strike, qty: 1 },
    ],
    meta: {
      wingWidth: ww,
      anchors: [{ strike: shortPut.strike, level: 'put_wall' }],
      warnings,
    },
  };
}

function buildBearCallSpread(input: LegBuilderInput): LegBuilderResult {
  const { contracts, spot, gammaWalls } = input;
  const warnings: string[] = [];
  const ww = wingWidth(spot);
  const callWall = gammaWalls.callWall ?? spot * 1.05;

  const shortCall = snapToChain(callWall, contracts, 'call', 'nearest');
  if (!shortCall) return empty('No call contracts available near call wall');

  let longCall = snapToChain(shortCall.strike + ww, contracts, 'call', 'up');
  if (!longCall || longCall.strike <= shortCall.strike) {
    const inc = detectStrikeIncrement(contracts, 'call', spot);
    longCall = snapToChain(shortCall.strike + inc * 2, contracts, 'call', 'up');
    if (!longCall || longCall.strike <= shortCall.strike) return empty('Cannot place long call above short call');
    warnings.push(`Long call adjusted to $${longCall.strike}`);
  }

  return {
    legs: [
      { type: 'call', side: 'short', strike: shortCall.strike, qty: 1 },
      { type: 'call', side: 'long',  strike: longCall.strike,  qty: 1 },
    ],
    meta: {
      wingWidth: ww,
      anchors: [{ strike: shortCall.strike, level: 'call_wall' }],
      warnings,
    },
  };
}

function buildBrokenWingButterfly(input: LegBuilderInput): LegBuilderResult {
  const { contracts, spot, bwbStrikes } = input;
  const warnings: string[] = [];
  const ww = wingWidth(spot);

  if (!bwbStrikes) return empty('No BWB strikes provided by strategy engine');

  if (bwbStrikes.direction === 'put') {
    const upper = bwbStrikes.longPutUpper;
    const body  = bwbStrikes.shortPut;
    const lower = bwbStrikes.longPutLower;
    if (!upper || !body || !lower) return empty('Incomplete put BWB strikes');

    const snapUpper = snapToChain(upper, contracts, 'put', 'up');
    const snapBody  = snapToChain(body,  contracts, 'put', 'nearest');
    const snapLower = snapToChain(lower, contracts, 'put', 'down');
    if (!snapUpper || !snapBody || !snapLower) return empty('Cannot snap BWB put strikes to chain');

    // Ensure ordering: lower < body < upper
    if (snapLower.strike >= snapBody.strike || snapBody.strike >= snapUpper.strike) {
      return empty(`BWB put ordering violated: $${snapLower.strike} / $${snapBody.strike} / $${snapUpper.strike}`);
    }

    // Ensure asymmetric wings
    const lowerWidth = snapBody.strike - snapLower.strike;
    const upperWidth = snapUpper.strike - snapBody.strike;
    if (lowerWidth === upperWidth) {
      // Widen the broken wing (lower for put BWB) by one increment
      const inc = detectStrikeIncrement(contracts, 'put', spot);
      const wider = snapToChain(snapLower.strike - inc, contracts, 'put', 'down');
      if (wider && wider.strike < snapBody.strike) {
        warnings.push(`BWB wings symmetric — widened lower from $${snapLower.strike} to $${wider.strike}`);
        snapLower.strike = wider.strike;
      } else {
        warnings.push('BWB wings symmetric — could not widen, proceeding anyway');
      }
    }

    return {
      legs: [
        { type: 'put', side: 'long',  strike: snapUpper.strike, qty: 1 },
        { type: 'put', side: 'short', strike: snapBody.strike,  qty: 2 },
        { type: 'put', side: 'long',  strike: snapLower.strike, qty: 1 },
      ],
      meta: {
        wingWidth: ww,
        anchors: [{ strike: snapBody.strike, level: 'put_wall' }],
        warnings,
      },
    };
  }

  // Call BWB
  const lower = bwbStrikes.longCallLower;
  const body  = bwbStrikes.shortCall;
  const upper = bwbStrikes.longCallUpper;
  if (!lower || !body || !upper) return empty('Incomplete call BWB strikes');

  const snapLower = snapToChain(lower, contracts, 'call', 'down');
  const snapBody  = snapToChain(body,  contracts, 'call', 'nearest');
  const snapUpper = snapToChain(upper, contracts, 'call', 'up');
  if (!snapLower || !snapBody || !snapUpper) return empty('Cannot snap BWB call strikes to chain');

  if (snapLower.strike >= snapBody.strike || snapBody.strike >= snapUpper.strike) {
    return empty(`BWB call ordering violated: $${snapLower.strike} / $${snapBody.strike} / $${snapUpper.strike}`);
  }

  const lowerWidth = snapBody.strike - snapLower.strike;
  const upperWidth = snapUpper.strike - snapBody.strike;
  if (lowerWidth === upperWidth) {
    const inc = detectStrikeIncrement(contracts, 'call', spot);
    const wider = snapToChain(snapUpper.strike + inc, contracts, 'call', 'up');
    if (wider && wider.strike > snapBody.strike) {
      warnings.push(`BWB wings symmetric — widened upper from $${snapUpper.strike} to $${wider.strike}`);
      snapUpper.strike = wider.strike;
    } else {
      warnings.push('BWB wings symmetric — could not widen, proceeding anyway');
    }
  }

  return {
    legs: [
      { type: 'call', side: 'long',  strike: snapLower.strike, qty: 1 },
      { type: 'call', side: 'short', strike: snapBody.strike,  qty: 2 },
      { type: 'call', side: 'long',  strike: snapUpper.strike, qty: 1 },
    ],
    meta: {
      wingWidth: ww,
      anchors: [{ strike: snapBody.strike, level: 'call_wall' }],
      warnings,
    },
  };
}

function buildLongStraddle(input: LegBuilderInput): LegBuilderResult {
  const { contracts, spot } = input;
  const atm = nearestATM(contracts, spot);
  if (atm === null) return empty('No ATM strike available for straddle');

  return {
    legs: [
      { type: 'put',  side: 'long', strike: atm, qty: 1 },
      { type: 'call', side: 'long', strike: atm, qty: 1 },
    ],
    meta: { wingWidth: 0, anchors: [{ strike: atm, level: 'spot' }], warnings: [] },
  };
}

function buildLongStrangle(input: LegBuilderInput): LegBuilderResult {
  const { contracts, spot, gammaWalls } = input;
  const putTarget  = gammaWalls.putWall  ?? spot * 0.95;
  const callTarget = gammaWalls.callWall ?? spot * 1.05;

  const longPut  = snapToChain(putTarget,  contracts, 'put',  'down');
  const longCall = snapToChain(callTarget, contracts, 'call', 'up');
  if (!longPut || !longCall) return empty('No contracts available for strangle');
  if (longPut.strike >= longCall.strike) return empty('Strangle put >= call after snap');

  return {
    legs: [
      { type: 'put',  side: 'long', strike: longPut.strike,  qty: 1 },
      { type: 'call', side: 'long', strike: longCall.strike, qty: 1 },
    ],
    meta: {
      wingWidth: 0,
      anchors: [
        { strike: longPut.strike,  level: 'put_wall' },
        { strike: longCall.strike, level: 'call_wall' },
      ],
      warnings: [],
    },
  };
}

function buildCalendarSpread(input: LegBuilderInput): LegBuilderResult {
  const { contracts, spot } = input;
  const atm = nearestATM(contracts, spot);
  if (atm === null) return empty('No ATM strike available for calendar');

  return {
    legs: [
      { type: 'call', side: 'short', strike: atm, qty: 1 },
      { type: 'call', side: 'long',  strike: atm, qty: 1 },
    ],
    meta: {
      wingWidth: 0,
      anchors: [{ strike: atm, level: 'spot' }],
      warnings: ['Calendar spread: front/back expiry distinction must be handled by caller'],
    },
  };
}

// ── Main Entry ──────────────────────────────────────────────────────────────

const BUILDERS: Record<string, (input: LegBuilderInput) => LegBuilderResult> = {
  iron_condor:           buildIronCondor,
  iron_butterfly:        buildIronButterfly,
  bull_put_spread:       buildBullPutSpread,
  bear_call_spread:      buildBearCallSpread,
  broken_wing_butterfly: buildBrokenWingButterfly,
  long_straddle:         buildLongStraddle,
  long_strangle:         buildLongStrangle,
  calendar_spread:       buildCalendarSpread,
};

export function buildLegs(input: LegBuilderInput): LegBuilderResult {
  const builder = BUILDERS[input.strategy];
  if (!builder) {
    return empty(`Unknown strategy: ${input.strategy}`);
  }

  const result = builder(input);

  // Sparse chain warning
  if (result.legs.length > 0) {
    const range = input.spot * 0.15;
    const nearCount = input.contracts.filter(
      c => c.strike >= input.spot - range && c.strike <= input.spot + range
    ).length;
    if (nearCount < 10) {
      result.meta.warnings.push(`Sparse chain: only ${nearCount} contracts within 15% of spot`);
    }
  }

  return result;
}
