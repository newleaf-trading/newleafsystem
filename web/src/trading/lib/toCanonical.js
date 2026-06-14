/**
 * toCanonical.js — Firestore read-boundary adapter.
 *
 * Converts raw Firestore position/tile documents (which store per-contract
 * dollars) into the CanonicalPosition shape (total dollars).
 *
 * This is the ONLY place where per-contract × qty multiplication happens.
 * After toCanonical, every consumer sees total-dollar fields and never
 * needs to know about the storage unit.
 *
 * @module toCanonical
 */

/**
 * Normalize a Firestore position doc + optional live data into a
 * CanonicalPosition that derivePosition() can consume.
 *
 * @param {object} doc — raw Firestore document (from usePortfolio)
 *   Expected fields: id, symbol, strategyType, status, quantity,
 *   maxProfit (per-contract $), maxLoss (per-contract $),
 *   daysToExpiry, entryDate, entryNetCredit (per-contract $),
 *   probability, breakevens, legs[], expiry,
 *   currentUnderlyingPrice, entrySpot
 *
 * @param {object} [live] — optional live-enrichment data
 *   @param {number} [live.pnlPerContract] — live unrealized P&L per contract
 *   @param {number} [live.spot]           — current underlying price
 *   @param {number} [live.dte]            — current DTE (may differ from stored)
 *   @param {Leg[]}  [live.legs]           — legs with currentPrice filled in
 *
 * @returns {import('./derivePosition').CanonicalPosition}
 */
export function toCanonical(doc, live = null) {
  const qty = doc.quantity || 1;
  const maxProfitPc = Math.abs(doc.maxProfit || 0);
  const maxLossPc = Math.abs(doc.maxLoss || 0);

  // ── Status normalization ──
  // Firestore uses 'active'; canonical uses 'open'.
  let status = doc.status || 'candidate';
  if (status === 'active') status = 'open';

  // ── Per-contract → total (the ONE place this happens) ──
  const maxProfitTotal = maxProfitPc * qty;
  const maxLossTotal = maxLossPc * qty;

  // ── P&L: convert per-contract to total ──
  // Candidates have no P&L. Closed positions use realizedPnl.
  // Open positions use live data if available.
  let pnlTotal;
  if (status === 'candidate') {
    pnlTotal = undefined;
  } else if (status === 'closed') {
    pnlTotal = doc.realizedPnl != null ? doc.realizedPnl * qty : 0;
  } else if (live?.pnlPerContract != null) {
    pnlTotal = live.pnlPerContract * qty;
  } else {
    // Open but no live data yet — leave undefined so views show loading,
    // not a stale zero.
    pnlTotal = undefined;
  }

  // ── pnlPrevClose: from doc if Phase 4 has written it (total $),
  //    otherwise undefined → daily will be null → views hide "today" ──
  const pnlPrevClose = doc.pnlPrevClose ?? undefined;

  // ── DTE: prefer live (freshest), fall back to stored ──
  const dte = live?.dte ?? doc.daysToExpiry ?? doc.dte ?? 0;

  // ── Spot ──
  const spot = live?.spot ?? doc.currentUnderlyingPrice ?? doc.entrySpot ?? 0;

  // ── Legs normalization ──
  // Firestore stores action/type in UPPERCASE ("SELL", "CALL").
  // Canonical uses lowercase ("sell", "call") — normalize here so
  // every downstream consumer can use simple === checks.
  const rawLegs = live?.legs ?? doc.legs ?? [];
  const legs = rawLegs.map(l => ({
    action: (l.action || '').toLowerCase(),
    type: (l.type || '').toLowerCase(),
    strike: l.strike || 0,
    entryPrice: l.entryPremium ?? l.premium ?? l.entryPrice ?? 0,
    currentPrice: l.currentPrice ?? undefined,
    delta: l.delta || 0,
    theta: l.theta || 0,
  }));

  return {
    id: doc.id,
    symbol: doc.symbol || '',
    name: doc.name,
    strategy: doc.strategyType || doc.strategy || 'unknown',
    status,
    qty,
    dte,
    spot,
    spotPrevClose: doc.spotPrevClose,
    maxProfitTotal,
    maxLossTotal,
    entryDate: doc.entryDate,
    entryCreditPerContract: doc.entryNetCredit != null
      ? Math.abs(doc.entryNetCredit)
      : undefined,
    pnlTotal,
    pnlPrevClose,
    probability: normalizeProb(doc.probability || doc.oddsOfProfit || 0),
    breakevens: validBE(doc.breakevens) || computeBreakevens(legs, maxProfitPc),
    legs: legs.length > 0 ? legs : undefined,
    // Short strikes for centeredness (deriveCentering)
    ...extractShortStrikes(legs),
    // Freshness fields
    zoneLow: (validBE(doc.breakevens) || computeBreakevens(legs, maxProfitPc))?.[0] ?? null,
    zoneHigh: (validBE(doc.breakevens) || computeBreakevens(legs, maxProfitPc))?.[1] ?? null,
    spotAtGeneration: doc.entrySpot || doc.currentUnderlyingPrice || 0,
    generatedAt: doc.entryDate || null,
    expiry: doc.expiry || legs?.[0]?.expiry || null,
  };
}

/**
 * Normalize a tile document (strategy candidate, not yet entered) into a
 * CanonicalPosition with status='candidate'.
 *
 * @param {object} tile — raw tile document from Firestore
 * @param {number} [qty=1] — contract sizing (from the sizing stepper)
 * @returns {import('./derivePosition').CanonicalPosition}
 */
export function tileToCanonical(tile, qty = 1) {
  const maxProfitPc = Math.abs(tile.maxProfit || 0);
  const maxLossPc = Math.abs(tile.maxLoss || 0);

  const legs = (tile.legs || []).map(l => ({
    action: (l.action || '').toLowerCase(),
    type: (l.type || '').toLowerCase(),
    strike: l.strike || 0,
    entryPrice: l.premium || 0,
    delta: l.delta || 0,
    theta: l.theta || 0,
  }));

  const breakevens = validBE(tile.breakevens) || computeBreakevens(legs, maxProfitPc);

  return {
    id: tile.id,
    symbol: tile.symbol || '',
    name: tile.name,
    strategy: tile.strategy || tile.strategyType || 'unknown',
    status: 'candidate',
    qty,
    dte: tile.daysToExpiry || 0,
    spot: tile.underlyingPrice || 0,
    expiry: tile.expiry || null,
    maxProfitTotal: maxProfitPc * qty,
    maxLossTotal: maxLossPc * qty,
    probability: normalizeProb(tile.oddsOfProfit || tile.probOfProfit || tile.probability || 0),
    breakevens,
    legs: legs.length > 0 ? legs : undefined,
    // Short strikes for centeredness (deriveCentering)
    ...extractShortStrikes(legs),
    // Freshness fields — used by deriveCandidate()
    zoneLow: breakevens?.[0] ?? null,
    zoneHigh: breakevens?.[1] ?? null,
    spotAtGeneration: tile.underlyingPrice || 0,
    generatedAt: tile.createdAt?.toDate?.()?.toISOString?.()
      || (tile.createdAt?.seconds ? new Date(tile.createdAt.seconds * 1000).toISOString() : null),
  };
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

/** Treat empty or single-element breakevens arrays as no breakevens. */
function validBE(be) {
  return Array.isArray(be) && be.length >= 2 ? be : undefined;
}

/**
 * Normalize probability to 0..1 scale.
 * Firestore tiles store it as 0-100 (e.g., 74), canonical expects 0-1 (0.74).
 */
function normalizeProb(p) {
  if (p == null || p === 0) return 0;
  return p > 1 ? p / 100 : p;
}

/**
 * Extract the inner short put and short call strikes from normalized legs.
 * Used by deriveCentering to compute the design center (midpoint of the
 * max-profit plateau). Returns { shortPut, shortCall } or nulls.
 */
/**
 * Extract the short strikes that define the max-profit plateau.
 * For condors: short put + short call.
 * For put BWB/spread (no short call): use the short put as one bound
 *   and the nearest long put as the other → deriveCentering treats them
 *   as the plateau edges.
 * For call BWB/spread (no short put): mirror logic with calls.
 */
function extractShortStrikes(legs) {
  if (!legs || legs.length === 0) return { shortPut: null, shortCall: null };
  const shortPuts = legs.filter(l => l.action === 'sell' && l.type === 'put').map(l => l.strike);
  const shortCalls = legs.filter(l => l.action === 'sell' && l.type === 'call').map(l => l.strike);

  // Both sides → condor
  if (shortPuts.length > 0 && shortCalls.length > 0) {
    return { shortPut: Math.max(...shortPuts), shortCall: Math.min(...shortCalls) };
  }

  // Put-only (BWB/spread): use the short put and the highest-strike long put
  // as the two edges of the plateau for centeredness
  if (shortPuts.length > 0) {
    const longPuts = legs.filter(l => l.action === 'buy' && l.type === 'put').map(l => l.strike);
    const highLong = longPuts.length > 0 ? Math.max(...longPuts) : null;
    const sp = Math.max(...shortPuts);
    // Treat the short put as "shortPut" and the high long as "shortCall" for centering
    return { shortPut: Math.min(sp, highLong ?? sp), shortCall: Math.max(sp, highLong ?? sp) };
  }

  // Call-only (BWB/spread): mirror
  if (shortCalls.length > 0) {
    const longCalls = legs.filter(l => l.action === 'buy' && l.type === 'call').map(l => l.strike);
    const lowLong = longCalls.length > 0 ? Math.min(...longCalls) : null;
    const sc = Math.min(...shortCalls);
    return { shortPut: Math.min(sc, lowLong ?? sc), shortCall: Math.max(sc, lowLong ?? sc) };
  }

  return { shortPut: null, shortCall: null };
}

/**
 * Compute breakevens from legs. Handles:
 *   - Iron condor (short put + short call): lower BE = shortPut - credit, upper = shortCall + credit
 *   - Put BWB / put spread (short puts only): zone = [longPut, shortPut]
 *   - Call BWB / call spread (short calls only): zone = [shortCall, longCall]
 *   - Any structure with only one side
 */
function computeBreakevens(legs, maxProfitPc) {
  if (!legs || legs.length < 2) return undefined;

  const shortPut = legs.find(l => l.action === 'sell' && l.type === 'put');
  const shortCall = legs.find(l => l.action === 'sell' && l.type === 'call');
  const longPut = legs.find(l => l.action === 'buy' && l.type === 'put');
  const longCall = legs.find(l => l.action === 'buy' && l.type === 'call');

  // Iron condor: both sides
  if (shortPut && shortCall) {
    let netCredit = 0;
    for (const l of legs) {
      netCredit += l.action === 'sell' ? (l.entryPrice || 0) : -(l.entryPrice || 0);
    }
    const lower = shortPut.strike - netCredit;
    const upper = shortCall.strike + netCredit;
    return lower > 0 && upper > 0 ? [+lower.toFixed(2), +upper.toFixed(2)] : undefined;
  }

  // Put-only (BWB / put spread): profit zone between short put and highest long put
  // Adjusted by net credit/debit for true zero-crossings
  if (shortPut && !shortCall) {
    const allLongPuts = legs.filter(l => l.action === 'buy' && l.type === 'put').map(l => l.strike);
    const upperLong = allLongPuts.length > 0 ? Math.max(...allLongPuts) : null;
    if (!upperLong) return undefined;
    let netCredit = 0;
    for (const l of legs) {
      netCredit += l.action === 'sell' ? (l.entryPrice || 0) : -(l.entryPrice || 0);
    }
    // Zero-crossings: short put adjusted down by credit, upper long adjusted down by debit
    const lower = shortPut.strike - Math.abs(netCredit);
    const upper = upperLong + (netCredit < 0 ? netCredit : 0); // debit narrows upper
    const sorted = [Math.min(lower, upper), Math.max(lower, upper)];
    // If net credit is 0 (unpriced), raw strikes are the best we have
    if (netCredit === 0) return [shortPut.strike, upperLong];
    return sorted[0] > 0 && sorted[1] > 0 ? [+sorted[0].toFixed(2), +sorted[1].toFixed(2)] : [shortPut.strike, upperLong];
  }

  // Call-only (BWB / call spread): mirror logic
  if (shortCall && !shortPut) {
    const allLongCalls = legs.filter(l => l.action === 'buy' && l.type === 'call').map(l => l.strike);
    const lowerLong = allLongCalls.length > 0 ? Math.min(...allLongCalls) : null;
    if (!lowerLong) return undefined;
    let netCredit = 0;
    for (const l of legs) {
      netCredit += l.action === 'sell' ? (l.entryPrice || 0) : -(l.entryPrice || 0);
    }
    const lower = lowerLong - (netCredit < 0 ? Math.abs(netCredit) : 0);
    const upper = shortCall.strike + Math.abs(netCredit);
    const sorted = [Math.min(lower, upper), Math.max(lower, upper)];
    if (netCredit === 0) return [lowerLong, shortCall.strike];
    return sorted[0] > 0 && sorted[1] > 0 ? [+sorted[0].toFixed(2), +sorted[1].toFixed(2)] : [lowerLong, shortCall.strike];
  }

  // Single long put or call with no matching short — can't compute
  if (longPut || longCall) return undefined;

  return undefined;
}
