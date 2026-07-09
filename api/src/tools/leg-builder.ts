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
import { validateStrategy } from '../shared/validate.js';

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

  // Hard directional constraint: 'down' => strike at or below target, 'up' => at or above.
  // A directional wing snapped to the WRONG side silently changes the structure (this is the
  // BWB-collapse bug: a far lower wing pulled up to the nearest liquid strike turns an
  // asymmetric BWB into a symmetric fly). Only relax the side if NO strike exists there.
  const EPS = 1e-9;
  let sided = typed;
  if (direction === 'down') sided = typed.filter(c => c.strike <= target + EPS);
  else if (direction === 'up') sided = typed.filter(c => c.strike >= target - EPS);
  if (sided.length === 0) sided = typed;

  // Prefer liquid (bid > 0), then closest to target.
  const liquid = sided.filter(c => c.bid > 0);
  const pool = liquid.length > 0 ? liquid : sided;
  return pool.slice().sort((a, b) => Math.abs(a.strike - target) - Math.abs(b.strike - target))[0] ?? null;
}

/**
 * Pick the "broken" (deliberately wider) wing of a broken-wing butterfly.
 * Guarantees the wing is strictly wider than the near wing — its entire reason for
 * existing — or returns null so the builder fails closed instead of emitting a
 * symmetric fly mislabelled as a BWB.
 *
 * @param side     'below' for a put BWB (wide lower wing), 'above' for a call BWB.
 * @param minWidth the near-wing width; the broken wing must strictly exceed it.
 * @param ideal    the engine's intended strike — among eligible strikes we pick the closest.
 */
export function pickBrokenWing(
  contracts: OptionContract[], optionType: 'call' | 'put',
  body: number, minWidth: number, ideal: number, side: 'below' | 'above',
): OptionContract | null {
  const EPS = 1e-9;
  const eligible = contracts.filter(c =>
    c.type === optionType &&
    (side === 'below' ? c.strike < body - minWidth - EPS : c.strike > body + minWidth + EPS)
  );
  if (eligible.length === 0) return null;
  const liquid = eligible.filter(c => c.bid > 0);
  const pool = liquid.length > 0 ? liquid : eligible;
  return pool.slice().sort((a, b) => Math.abs(a.strike - ideal) - Math.abs(b.strike - ideal))[0] ?? null;
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

function buildBullCallSpread(input: LegBuilderInput): LegBuilderResult {
  // Bullish DEBIT: BUY a call near ATM, SELL a call higher (toward the call wall).
  const { contracts, spot, gammaWalls } = input;
  const warnings: string[] = [];
  const ww = wingWidth(spot);

  const longCall = snapToChain(spot, contracts, 'call', 'nearest');
  if (!longCall) return empty('No call contracts available for bull call spread');
  const target = (gammaWalls.callWall && gammaWalls.callWall > longCall.strike) ? gammaWalls.callWall : longCall.strike + ww;
  let shortCall = snapToChain(target, contracts, 'call', 'up');
  if (!shortCall || shortCall.strike <= longCall.strike) {
    const inc = detectStrikeIncrement(contracts, 'call', spot);
    shortCall = snapToChain(longCall.strike + inc * 2, contracts, 'call', 'up');
    if (!shortCall || shortCall.strike <= longCall.strike) return empty('Cannot place short call above long call');
    warnings.push(`Short call adjusted to $${shortCall.strike}`);
  }
  return {
    legs: [
      { type: 'call', side: 'long',  strike: longCall.strike,  qty: 1 },
      { type: 'call', side: 'short', strike: shortCall.strike, qty: 1 },
    ],
    meta: { wingWidth: ww, anchors: [{ strike: longCall.strike, level: 'spot' }], warnings },
  };
}

function buildBearPutSpread(input: LegBuilderInput): LegBuilderResult {
  // Bearish DEBIT: BUY a put near ATM, SELL a put lower (toward the put wall).
  const { contracts, spot, gammaWalls } = input;
  const warnings: string[] = [];
  const ww = wingWidth(spot);

  const longPut = snapToChain(spot, contracts, 'put', 'nearest');
  if (!longPut) return empty('No put contracts available for bear put spread');
  const target = (gammaWalls.putWall && gammaWalls.putWall < longPut.strike) ? gammaWalls.putWall : longPut.strike - ww;
  let shortPut = snapToChain(target, contracts, 'put', 'down');
  if (!shortPut || shortPut.strike >= longPut.strike) {
    const inc = detectStrikeIncrement(contracts, 'put', spot);
    shortPut = snapToChain(longPut.strike - inc * 2, contracts, 'put', 'down');
    if (!shortPut || shortPut.strike >= longPut.strike) return empty('Cannot place short put below long put');
    warnings.push(`Short put adjusted to $${shortPut.strike}`);
  }
  return {
    legs: [
      { type: 'put', side: 'long',  strike: longPut.strike,  qty: 1 },
      { type: 'put', side: 'short', strike: shortPut.strike, qty: 1 },
    ],
    meta: { wingWidth: ww, anchors: [{ strike: longPut.strike, level: 'spot' }], warnings },
  };
}

function buildBrokenWingButterfly(input: LegBuilderInput): LegBuilderResult {
  const { contracts, spot, bwbStrikes } = input;
  const ww = wingWidth(spot);

  if (!bwbStrikes) return empty('No BWB strikes provided by strategy engine');

  if (bwbStrikes.direction === 'put') {
    // Put BWB: body short ×2, near wing ABOVE body, broken (wider) wing BELOW body.
    const upper = bwbStrikes.longPutUpper;   // near wing (above body)
    const body  = bwbStrikes.shortPut;
    const lower = bwbStrikes.longPutLower;    // broken wing (below body), engine's ideal
    if (!upper || !body || !lower) return empty('Incomplete put BWB strikes');

    const snapBody  = snapToChain(body,  contracts, 'put', 'nearest');
    const snapUpper = snapToChain(upper, contracts, 'put', 'up');
    if (!snapBody || !snapUpper) return empty('Cannot snap BWB put body/near-wing to chain');
    if (snapUpper.strike <= snapBody.strike) return empty('BWB put near wing did not land above body');

    const nearWidth = snapUpper.strike - snapBody.strike;
    // Broken wing must be STRICTLY wider than the near wing, or it is not a BWB at all.
    const snapLower = pickBrokenWing(contracts, 'put', snapBody.strike, nearWidth, lower, 'below');
    if (!snapLower) return empty('No strike available to form a wider (broken) lower wing — not a valid BWB');

    return {
      legs: [
        { type: 'put', side: 'long',  strike: snapUpper.strike, qty: 1 },
        { type: 'put', side: 'short', strike: snapBody.strike,  qty: 2 },
        { type: 'put', side: 'long',  strike: snapLower.strike, qty: 1 },
      ],
      meta: { wingWidth: ww, anchors: [{ strike: snapBody.strike, level: 'put_wall' }], warnings: [] },
    };
  }

  // Call BWB: body short ×2, near wing BELOW body, broken (wider) wing ABOVE body.
  const lower = bwbStrikes.longCallLower;   // near wing (below body)
  const body  = bwbStrikes.shortCall;
  const upper = bwbStrikes.longCallUpper;    // broken wing (above body), engine's ideal
  if (!lower || !body || !upper) return empty('Incomplete call BWB strikes');

  const snapBody  = snapToChain(body,  contracts, 'call', 'nearest');
  const snapLower = snapToChain(lower, contracts, 'call', 'down');
  if (!snapBody || !snapLower) return empty('Cannot snap BWB call body/near-wing to chain');
  if (snapLower.strike >= snapBody.strike) return empty('BWB call near wing did not land below body');

  const nearWidth = snapBody.strike - snapLower.strike;
  const snapUpper = pickBrokenWing(contracts, 'call', snapBody.strike, nearWidth, upper, 'above');
  if (!snapUpper) return empty('No strike available to form a wider (broken) upper wing — not a valid BWB');

  return {
    legs: [
      { type: 'call', side: 'long',  strike: snapLower.strike, qty: 1 },
      { type: 'call', side: 'short', strike: snapBody.strike,  qty: 2 },
      { type: 'call', side: 'long',  strike: snapUpper.strike, qty: 1 },
    ],
    meta: { wingWidth: ww, anchors: [{ strike: snapBody.strike, level: 'call_wall' }], warnings: [] },
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

function buildCalendarSpread(_input: LegBuilderInput): LegBuilderResult {
  // A calendar is short front-month + long back-month at the SAME strike — it REQUIRES two
  // expiries. The /api/recommend path fetches a single expiry, so both legs would land on the
  // identical contract → a self-cancelling null position that still passes `legs.length >= 2`.
  // Fail closed until a back-month chain is plumbed through (BuiltLeg has no expiry field today).
  // Better an honest NO_TRADE than a recommended trade with zero exposure.
  return empty('Calendar spread needs a second (back-month) expiry — not available in this path');
}

// ── Main Entry ──────────────────────────────────────────────────────────────

const BUILDERS: Record<string, (input: LegBuilderInput) => LegBuilderResult> = {
  iron_condor:           buildIronCondor,
  iron_butterfly:        buildIronButterfly,
  bull_put_spread:       buildBullPutSpread,
  bear_call_spread:      buildBearCallSpread,
  bull_call_spread:      buildBullCallSpread,
  bear_put_spread:       buildBearPutSpread,
  broken_wing_butterfly: buildBrokenWingButterfly,
  long_straddle:         buildLongStraddle,
  long_strangle:         buildLongStrangle,
  calendar_spread:       buildCalendarSpread,
};

/** Strategies whose topology is checked by validateStrategy (calendar/diagonal are multi-expiry). */
const TOPOLOGY_VALIDATED = new Set([
  'iron_condor', 'iron_butterfly', 'broken_wing_butterfly',
  'bull_put_spread', 'bear_call_spread', 'bull_call_spread', 'bear_put_spread',
  'long_straddle', 'long_strangle',
]);

export function buildLegs(input: LegBuilderInput): LegBuilderResult {
  const builder = BUILDERS[input.strategy];
  if (!builder) {
    return empty(`Unknown strategy: ${input.strategy}`);
  }

  const result = builder(input);
  if (result.legs.length === 0) return result; // builder already failed closed

  // Fail closed: the legs MUST pass topology validation, else emit nothing. A mislabelled
  // structure (e.g. a symmetric fly returned as a broken_wing_butterfly) has a different risk
  // profile than its label promises — shipping it is worse than NO_TRADE.
  if (TOPOLOGY_VALIDATED.has(input.strategy)) {
    const v = validateStrategy(input.strategy, result.legs.map(l => ({
      action: l.side === 'short' ? 'SELL' : 'BUY',
      type: l.type.toUpperCase(),
      strike: l.strike,
      qty: l.qty,
    })));
    if (!v.valid) {
      return empty(`Built ${input.strategy} failed validation (${v.actual}): ${v.errors.join('; ')}`);
    }
  }

  // Sparse chain warning
  const range = input.spot * 0.15;
  const nearCount = input.contracts.filter(
    c => c.strike >= input.spot - range && c.strike <= input.spot + range
  ).length;
  if (nearCount < 10) {
    result.meta.warnings.push(`Sparse chain: only ${nearCount} contracts within 15% of spot`);
  }

  return result;
}
