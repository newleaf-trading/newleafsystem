/**
 * leg-builder.test.ts — invariant + property tests for deterministic leg construction.
 *
 * Core promise under test: buildLegs() returns EITHER structurally-valid legs (that pass
 * validateStrategy) OR nothing (empty legs). It must never emit a mislabelled structure —
 * the bug that shipped a symmetric butterfly as a broken_wing_butterfly.
 *
 * Run: npx tsx src/tools/leg-builder.test.ts
 */
import type { OptionContract } from './alpaca.js';
import { buildLegs, type LegBuilderInput } from './leg-builder.js';
import { validateStrategy } from '../shared/validate.js';

let passed = 0, failed = 0;
function ok(cond: boolean, msg: string) { if (cond) { passed++; } else { failed++; console.error('FAIL: ' + msg); } }

/** Build a synthetic chain. `illiquidBelow`/`illiquidAbove` set bid=0 outside a liquid band. */
function mkChain(strikes: number[], opts: { illiquidBelow?: number; illiquidAbove?: number } = {}): OptionContract[] {
  const out: OptionContract[] = [];
  for (const k of strikes) {
    for (const type of ['put', 'call'] as const) {
      const illiquid = (opts.illiquidBelow != null && k < opts.illiquidBelow) ||
                       (opts.illiquidAbove != null && k > opts.illiquidAbove);
      const bid = illiquid ? 0 : 1.0;
      out.push({
        occ: `X${k}${type[0]}`, type, strike: k,
        iv: 0.3, delta: null, gamma: null, theta: null, vega: null,
        bid, ask: bid + 0.1, mid: +(bid + 0.05).toFixed(2), volume: 10,
      });
    }
  }
  return out;
}

function legsAsVal(legs: { side: string; type: string; strike: number; qty: number }[]) {
  return legs.map(l => ({ action: l.side === 'short' ? 'SELL' : 'BUY', type: l.type.toUpperCase(), strike: l.strike, qty: l.qty }));
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. The BWB-collapse regression (ABNB): engine wants 125/115/98 (wider lower wing).
// ─────────────────────────────────────────────────────────────────────────────
const bwbPut = { direction: 'put' as const, longPutUpper: 125, shortPut: 115, longPutLower: 98 };

// (a) $5 chain down to 90, all liquid → a real asymmetric BWB exists.
{
  const chain = mkChain([90, 95, 100, 105, 110, 115, 120, 125, 130, 135]);
  const r = buildLegs({ strategy: 'broken_wing_butterfly', contracts: chain, spot: 132,
    gammaWalls: { putWall: 115, callWall: 133 }, direction: 'neutral', dte: 20, bwbStrikes: bwbPut });
  ok(r.legs.length === 3, 'BWB(a): builds 3 legs on a full chain');
  const strikes = r.legs.map(l => l.strike).sort((x, y) => x - y);
  const [A, B, C] = strikes;
  ok(C - B !== B - A, `BWB(a): wings are ASYMMETRIC (${A}/${B}/${C})`);
  ok(B - A > C - B, `BWB(a): lower (broken) wing is wider (${B - A} vs ${C - B})`);
  ok(validateStrategy('broken_wing_butterfly', legsAsVal(r.legs)).valid, 'BWB(a): passes validateStrategy');
}

// (b) The exact failure case: chain floor at 105, so 125/115/X can only snap symmetric.
//     OLD code shipped 125/115/105 (symmetric). NEW code must fail closed.
{
  const chain = mkChain([105, 110, 115, 120, 125, 130, 135]);
  const r = buildLegs({ strategy: 'broken_wing_butterfly', contracts: chain, spot: 132,
    gammaWalls: { putWall: 115, callWall: 133 }, direction: 'neutral', dte: 20, bwbStrikes: bwbPut });
  ok(r.legs.length === 0, 'BWB(b): fails closed when only a symmetric fly is possible (no 125/115/105)');
}

// (c) Liquidity hole below 105 (bid=0), but strikes exist down to 90 → still builds asymmetric
//     using a wider lower wing (long wing tolerates illiquidity).
{
  const chain = mkChain([90, 95, 100, 105, 110, 115, 120, 125, 130, 135], { illiquidBelow: 105 });
  const r = buildLegs({ strategy: 'broken_wing_butterfly', contracts: chain, spot: 132,
    gammaWalls: { putWall: 115, callWall: 133 }, direction: 'neutral', dte: 20, bwbStrikes: bwbPut });
  ok(r.legs.length === 3, 'BWB(c): builds across a liquidity hole');
  if (r.legs.length === 3) {
    const strikes = r.legs.map(l => l.strike).sort((x, y) => x - y);
    ok(strikes[2] - strikes[1] !== strikes[1] - strikes[0], 'BWB(c): still asymmetric across the hole');
    ok(validateStrategy('broken_wing_butterfly', legsAsVal(r.legs)).valid, 'BWB(c): passes validateStrategy');
  }
}

// (d) Call BWB mirror: wider UPPER wing.
{
  const bwbCall = { direction: 'call' as const, longCallLower: 105, shortCall: 115, longCallUpper: 132 };
  const chain = mkChain([95, 100, 105, 110, 115, 120, 125, 130, 135, 140]);
  const r = buildLegs({ strategy: 'broken_wing_butterfly', contracts: chain, spot: 108,
    gammaWalls: { putWall: 100, callWall: 115 }, direction: 'neutral', dte: 20, bwbStrikes: bwbCall });
  ok(r.legs.length === 3, 'BWB(d): call BWB builds 3 legs');
  if (r.legs.length === 3) {
    const strikes = r.legs.map(l => l.strike).sort((x, y) => x - y);
    ok(strikes[2] - strikes[1] > strikes[1] - strikes[0], 'BWB(d): upper (broken) wing is wider');
    ok(validateStrategy('broken_wing_butterfly', legsAsVal(r.legs)).valid, 'BWB(d): passes validateStrategy');
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Other strategies build valid structures on a normal chain.
// ─────────────────────────────────────────────────────────────────────────────
{
  const chain = mkChain([100, 105, 110, 115, 120, 125, 130, 135, 140, 145, 150, 155, 160]);
  const base = { contracts: chain, spot: 130, gammaWalls: { putWall: 120, callWall: 140 },
    direction: 'neutral' as const, dte: 20 };
  for (const strategy of ['iron_condor', 'iron_butterfly', 'bull_put_spread', 'bear_call_spread', 'bull_call_spread', 'bear_put_spread', 'long_straddle', 'long_strangle']) {
    const dir = /^bull/.test(strategy) ? 'bullish' : /^bear/.test(strategy) ? 'bearish' : 'neutral';
    const r = buildLegs({ ...base, strategy, direction: dir as any });
    ok(r.legs.length > 0, `${strategy}: builds legs on a normal chain`);
    if (r.legs.length > 0) {
      ok(validateStrategy(strategy, legsAsVal(r.legs)).valid, `${strategy}: passes validateStrategy`);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Property test: random chains × every topology strategy ⇒ valid-or-empty, NEVER invalid.
// ─────────────────────────────────────────────────────────────────────────────
{
  // Seeded LCG for reproducibility.
  let seed = 1234567;
  const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)];

  const STRATS = ['iron_condor', 'iron_butterfly', 'broken_wing_butterfly', 'bull_put_spread', 'bear_call_spread', 'long_straddle', 'long_strangle'];
  let invalidEmitted = 0, builtCount = 0, runs = 0;

  for (let i = 0; i < 1500; i++) {
    const spot = 20 + rnd() * 480;
    const inc = pick([0.5, 1, 2.5, 5, 10]);
    const lo = spot * (0.6 + rnd() * 0.2), hi = spot * (1.2 + rnd() * 0.2);
    const strikes: number[] = [];
    for (let k = Math.round(lo / inc) * inc; k <= hi; k += inc) strikes.push(+k.toFixed(2));
    if (strikes.length < 3) continue;
    // Random liquidity hole.
    const opts = rnd() < 0.5 ? { illiquidBelow: pick(strikes) } : {};
    const chain = mkChain(strikes, opts);
    const putWall = +pick(strikes.filter(s => s < spot)) || spot * 0.9;
    const callWall = +pick(strikes.filter(s => s > spot)) || spot * 1.1;

    // Engine-style BWB strikes (put side).
    const body = putWall;
    const upperW = Math.max(inc, Math.round(((spot - body) * 0.6) / inc) * inc);
    const bwbStrikes = { direction: 'put' as const, longPutUpper: body + upperW, shortPut: body, longPutLower: body - upperW * 1.7 };

    const strategy = pick(STRATS);
    const dir = strategy === 'bull_put_spread' ? 'bullish' : strategy === 'bear_call_spread' ? 'bearish' : 'neutral';
    const r = buildLegs({ strategy, contracts: chain, spot, gammaWalls: { putWall, callWall }, direction: dir as any, dte: 20, bwbStrikes });
    runs++;
    if (r.legs.length === 0) continue; // valid fail-closed
    builtCount++;
    const v = validateStrategy(strategy, legsAsVal(r.legs));
    if (!v.valid) {
      invalidEmitted++;
      if (invalidEmitted <= 5) console.error(`  property fail [${strategy}] spot=${spot.toFixed(0)} inc=${inc}: ${v.errors.join('; ')} | legs=${r.legs.map(l => `${l.side[0]}${l.qty}${l.type[0]}${l.strike}`).join(',')}`);
    }
  }
  ok(invalidEmitted === 0, `property: 0 invalid structures emitted over ${runs} runs (built ${builtCount}, invalid ${invalidEmitted})`);
}

// ─────────────────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
