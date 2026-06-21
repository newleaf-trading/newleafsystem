'use strict';

/**
 * shared/strategies/validate.js
 *
 * Topology validation for LLM-returned option structures. Runs BEFORE the
 * engine prices anything (buildLegs/payoff/analyse). Catches the failure mode
 * seen in the model eval: a structure labelled one thing but built as another
 * (e.g. "broken_wing_butterfly" returned as a 4-leg condor, or a 1-short/2-long
 * net-long structure that is not a butterfly at all).
 *
 * If `index.js` uses ESM, convert the exports at the bottom to `export`.
 * Strategy keys here must match the engine's preset keys — adjust if yours differ.
 */

const TYPES = ['CALL', 'PUT'];
const ACTIONS = ['BUY', 'SELL'];

/** Canonical leg templates — shared source of truth with the prompt. */
const TEMPLATES = {
  iron_condor:           'SELL put, BUY lower put, SELL call, BUY higher call (Klp<Ksp<Ksc<Klc)',
  iron_butterfly:        'SELL put + SELL call at body, BUY put below, BUY call above',
  broken_wing_butterfly: 'single type: BUY 1 @A, SELL 2 @B, BUY 1 @C, A<B<C, unequal wings',
  bull_put_spread:       'SELL put, BUY lower put',
  bear_call_spread:      'SELL call, BUY higher call',
  long_straddle:         'BUY call + BUY put at same strike',
  long_strangle:         'BUY OTM call (high) + BUY OTM put (low)',
};

function normLeg(leg) {
  return {
    action: String(leg.action == null ? '' : leg.action).toUpperCase(),
    type: String(leg.type == null ? (leg.kind == null ? '' : leg.kind) : leg.type).toUpperCase(),
    strike: Number(leg.strike),
    qty: Math.round(Math.abs(Number(leg.qty == null ? 1 : leg.qty))),
  };
}

function basicErrors(legs) {
  const e = [];
  if (!Array.isArray(legs) || legs.length === 0) { e.push('legs must be a non-empty array'); return e; }
  legs.forEach((l, i) => {
    if (!ACTIONS.includes(l.action)) e.push(`leg ${i}: action must be BUY or SELL`);
    if (!TYPES.includes(l.type)) e.push(`leg ${i}: type must be CALL or PUT`);
    if (!isFinite(l.strike) || l.strike <= 0) e.push(`leg ${i}: strike must be a positive number`);
    if (!Number.isInteger(l.qty) || l.qty <= 0) e.push(`leg ${i}: qty must be a positive integer`);
  });
  return e;
}

function roles(legs) {
  return {
    shortPut: legs.find(l => l.action === 'SELL' && l.type === 'PUT'),
    longPut: legs.find(l => l.action === 'BUY' && l.type === 'PUT'),
    shortCall: legs.find(l => l.action === 'SELL' && l.type === 'CALL'),
    longCall: legs.find(l => l.action === 'BUY' && l.type === 'CALL'),
  };
}

/** Net long(+)/short(-) contracts per strike. */
function netByStrike(legs) {
  const m = new Map();
  for (const l of legs) m.set(l.strike, (m.get(l.strike) || 0) + (l.action === 'BUY' ? l.qty : -l.qty));
  return m;
}

const VALIDATORS = {
  iron_condor(legs) {
    const e = [];
    const { shortPut, longPut, shortCall, longCall } = roles(legs);
    if (legs.length !== 4) e.push(`iron_condor needs 4 legs, got ${legs.length}`);
    if (!shortPut || !longPut || !shortCall || !longCall) {
      e.push('iron_condor needs SELL put, BUY put, SELL call, BUY call');
      return e;
    }
    if (!(longPut.strike < shortPut.strike)) e.push('long put must be below short put');
    if (!(shortCall.strike < longCall.strike)) e.push('short call must be below long call');
    if (!(shortPut.strike < shortCall.strike)) e.push('short put must be below short call');
    if (shortPut.strike === shortCall.strike) e.push('shorts share a strike — that is an iron butterfly');
    return e;
  },

  iron_butterfly(legs) {
    const e = [];
    const { shortPut, longPut, shortCall, longCall } = roles(legs);
    if (legs.length !== 4 || !shortPut || !longPut || !shortCall || !longCall) {
      e.push('iron_butterfly needs SELL put + SELL call at body, BUY put + BUY call wings');
      return e;
    }
    if (shortPut.strike !== shortCall.strike) e.push('short put and short call must share the body strike');
    if (!(longPut.strike < shortPut.strike)) e.push('long put must be below the body');
    if (!(longCall.strike > shortCall.strike)) e.push('long call must be above the body');
    return e;
  },

  broken_wing_butterfly(legs) {
    const e = [];
    if (new Set(legs.map(l => l.type)).size !== 1) {
      e.push('broken_wing_butterfly must be a single option type (mixed puts+calls is a condor)');
      return e;
    }
    const net = netByStrike(legs);
    const strikes = [...net.keys()].sort((a, b) => a - b);
    if (strikes.length !== 3) { e.push(`needs exactly 3 distinct strikes, got ${strikes.length}`); return e; }
    const [A, B, C] = strikes;
    const a = net.get(A), b = net.get(B), c = net.get(C);
    if (!(a > 0 && c > 0)) e.push('outer strikes must be long (BUY)');
    if (!(b < 0)) e.push('body (middle strike) must be short (SELL)');
    const totalBuy = legs.reduce((s, l) => s + (l.action === 'BUY' ? l.qty : 0), 0);
    const totalSell = legs.reduce((s, l) => s + (l.action === 'SELL' ? l.qty : 0), 0);
    if (totalBuy !== totalSell)
      e.push(`unbalanced: ${totalBuy} long vs ${totalSell} short contracts — a 1-short/2-long structure is a backspread, not a BWB`);
    if (a > 0 && c > 0 && b < 0 && Math.abs(b) !== a + c)
      e.push('ratio must be 1-2-1 (body short qty equals total wing long qty)');
    if (C - B === B - A) e.push('wings are equal — that is a symmetric butterfly, not broken-wing');
    return e;
  },

  bull_put_spread(legs) {
    const e = [];
    const { shortPut, longPut } = roles(legs);
    if (legs.length !== 2 || legs.some(l => l.type !== 'PUT')) e.push('bull_put_spread needs 2 PUT legs');
    if (!shortPut || !longPut) e.push('needs 1 SELL put and 1 BUY put');
    else if (!(shortPut.strike > longPut.strike)) e.push('short put must be above long put (sell higher, buy lower)');
    return e;
  },

  bear_call_spread(legs) {
    const e = [];
    const { shortCall, longCall } = roles(legs);
    if (legs.length !== 2 || legs.some(l => l.type !== 'CALL')) e.push('bear_call_spread needs 2 CALL legs');
    if (!shortCall || !longCall) e.push('needs 1 SELL call and 1 BUY call');
    else if (!(shortCall.strike < longCall.strike)) e.push('short call must be below long call (sell lower, buy higher)');
    return e;
  },

  bull_call_spread(legs) {
    const e = [];
    const { longCall, shortCall } = roles(legs);
    if (legs.length !== 2 || legs.some(l => l.type !== 'CALL')) e.push('bull_call_spread needs 2 CALL legs');
    if (!longCall || !shortCall) e.push('needs 1 BUY call and 1 SELL call');
    else if (!(longCall.strike < shortCall.strike)) e.push('long call must be below short call (buy lower, sell higher)');
    return e;
  },

  bear_put_spread(legs) {
    const e = [];
    const { longPut, shortPut } = roles(legs);
    if (legs.length !== 2 || legs.some(l => l.type !== 'PUT')) e.push('bear_put_spread needs 2 PUT legs');
    if (!longPut || !shortPut) e.push('needs 1 BUY put and 1 SELL put');
    else if (!(longPut.strike > shortPut.strike)) e.push('long put must be above short put (buy higher, sell lower)');
    return e;
  },

  long_straddle(legs) {
    const e = [];
    const { longCall, longPut } = roles(legs);
    if (legs.length !== 2 || !longCall || !longPut) e.push('long_straddle needs BUY call + BUY put');
    else if (longCall.strike !== longPut.strike) e.push('straddle legs must share a strike (use a strangle for split strikes)');
    return e;
  },

  long_strangle(legs) {
    const e = [];
    const { longCall, longPut } = roles(legs);
    if (legs.length !== 2 || !longCall || !longPut) e.push('long_strangle needs BUY call + BUY put');
    else if (!(longCall.strike > longPut.strike)) e.push('call strike must be above put strike (both OTM)');
    return e;
  },
};

/** Best-guess of what the legs actually form, independent of the label. */
function classifyLegs(legs) {
  if (!legs.length) return 'unknown';
  const puts = legs.filter(l => l.type === 'PUT');
  const calls = legs.filter(l => l.type === 'CALL');
  const { shortPut, longPut, shortCall, longCall } = roles(legs);

  if (puts.length && calls.length) {
    if (shortPut && longPut && shortCall && longCall)
      return shortPut.strike === shortCall.strike ? 'iron_butterfly' : 'iron_condor';
    if (legs.length === 2 && legs.every(l => l.action === 'BUY'))
      return calls[0].strike === puts[0].strike ? 'long_straddle' : 'long_strangle';
    return 'unknown';
  }

  const net = netByStrike(legs);
  const strikes = [...net.keys()].sort((a, b) => a - b);
  if (strikes.length === 2) {
    const lo = net.get(strikes[0]), hi = net.get(strikes[1]);
    if (puts.length) return (lo > 0 && hi < 0) ? 'bull_put_spread' : (lo < 0 && hi > 0) ? 'bear_put_spread' : 'vertical';
    return (lo < 0 && hi > 0) ? 'bear_call_spread' : (lo > 0 && hi < 0) ? 'bull_call_spread' : 'vertical';
  }
  if (strikes.length === 3) {
    const [A, B, C] = strikes;
    if (net.get(A) > 0 && net.get(C) > 0 && net.get(B) < 0)
      return (C - B === B - A) ? 'butterfly' : 'broken_wing_butterfly';
  }
  return 'unknown';
}

/**
 * Validate a declared strategy against its returned legs.
 * @returns {{valid:boolean, declared:string, actual:string, matchesLabel:boolean, errors:string[]}}
 */
function validateStrategy(strategy, rawLegs) {
  const legs = (rawLegs || []).map(normLeg);
  const errors = basicErrors(legs);
  const actual = classifyLegs(legs);
  const v = VALIDATORS[strategy];

  if (!v) errors.push(`unknown strategy "${strategy}"`);
  else if (errors.length === 0) errors.push(...v(legs));

  const matchesLabel = actual === strategy;
  if (errors.length === 0 && !matchesLabel && actual !== 'unknown')
    errors.push(`declared "${strategy}" but legs form a ${actual}`);

  return { valid: errors.length === 0, declared: strategy, actual, matchesLabel, errors };
}

export { validateStrategy, classifyLegs, TEMPLATES };
