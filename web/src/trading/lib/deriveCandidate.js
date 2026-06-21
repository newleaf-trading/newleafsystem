/**
 * deriveCandidate.js — Freshness classification for stored candidates.
 *
 * Classifies a candidate against the live market without re-pricing.
 * POP, R:R, and credit are NEVER recomputed from spot — that would
 * fabricate a number. They are flagged stale when the candidate isn't fresh.
 * Re-pricing is a re-generate, owned by generaterecommendations/.
 *
 * @module deriveCandidate
 */

// ═══════════════════════════════════════════════════════════════
// Tunable policy — how close to the edge counts as "drifted"
// ═══════════════════════════════════════════════════════════════

export const FRESHNESS = {
  /** Position within 0..1 profit zone that counts as "near edge" */
  driftBand: 0.20,
  /** Spot move since structuring that forces at least a drift, even if still inside */
  driftMovePct: 0.02,
};

// ═══════════════════════════════════════════════════════════════
// deriveCandidate
// ═══════════════════════════════════════════════════════════════

/**
 * @typedef {'fresh' | 'drifted' | 'breached' | 'expired'} Freshness
 */

/**
 * Classify a stored candidate against the live market.
 *
 * @param {object} c — canonical candidate fields
 *   @param {string}  c.symbol
 *   @param {number}  [c.zoneLow]           — lower breakeven (null = open on that side)
 *   @param {number}  [c.zoneHigh]          — upper breakeven (null = open on that side)
 *   @param {number}  [c.spotAtGeneration]  — underlying price when structured
 *   @param {string}  [c.expiry]            — ISO date "YYYY-MM-DD"
 *   @param {string}  [c.generatedAt]       — ISO timestamp of generation
 *   @param {number}  [c.pop]               — probability of profit (0-1), passed through untouched
 *   @param {number}  [c.rewardRisk]        — R:R ratio, passed through untouched
 *   @param {number}  [c.maxProfitTotal]
 *   @param {number}  [c.maxLossTotal]
 *
 * @param {number} liveSpot — current underlying price
 * @param {Date|string} [today=new Date()] — for DTE computation
 * @param {object} [policy=FRESHNESS]
 *
 * @returns {{
 *   freshness: Freshness,
 *   liveDte: number,
 *   pos: number,          — normalized position in profit zone (0=lower BE, 1=upper BE)
 *   movePct: number,      — |spot move| since structuring as decimal
 *   takeable: boolean,    — only true when fresh
 *   popStale: boolean,
 *   pricingStale: boolean,
 *   asOf: string|null,    — generatedAt timestamp for "as of" qualifier
 * }}
 */
export function deriveCandidate(c, liveSpot, today = new Date(), policy = FRESHNESS) {
  const liveDte = computeLiveDte(c.expiry, today);

  // Priced = every leg has a non-zero premium (same tripwire as publish guards)
  const legs = c.legs || [];
  const priced = legs.length > 0 && legs.some(l => (l.entryPrice || l.premium || 0) !== 0);

  // Expired — nothing to evaluate
  if (liveDte <= 0) {
    return {
      freshness: 'expired',
      liveDte,
      priced,
      pos: NaN,
      movePct: 0,
      takeable: false,
      popStale: true,
      pricingStale: true,
      asOf: c.generatedAt || null,
    };
  }

  // Normalized position in the profit zone: 0 = lower BE, 1 = upper BE
  // null/undefined bound = open on that side (single-sided structures) → never breached there
  const low = c.zoneLow ?? -Infinity;
  const high = c.zoneHigh ?? Infinity;

  let pos;
  if (low === -Infinity && high === Infinity) {
    pos = 0.5; // no bounds → always centered
  } else if (low === -Infinity) {
    pos = liveSpot < high ? 0.5 : 1.1; // only upper bound
  } else if (high === Infinity) {
    pos = liveSpot > low ? 0.5 : -0.1; // only lower bound
  } else {
    pos = high !== low ? (liveSpot - low) / (high - low) : 0.5;
  }

  // Classify freshness
  let freshness;
  if (liveSpot <= low || liveSpot >= high) {
    freshness = 'breached';
  } else if (pos < policy.driftBand || pos > 1 - policy.driftBand) {
    freshness = 'drifted';
  } else {
    freshness = 'fresh';
  }

  // A large move since structuring is at least a drift, even if still nominally inside
  const movePct = c.spotAtGeneration && c.spotAtGeneration > 0
    ? Math.abs(liveSpot - c.spotAtGeneration) / c.spotAtGeneration
    : 0;
  if (freshness === 'fresh' && movePct >= policy.driftMovePct) {
    freshness = 'drifted';
  }

  const stale = freshness !== 'fresh' || !priced;

  // Centering — from short strikes, not spot or breakevens
  const centering = deriveCentering(c, liveSpot);

  return {
    freshness,
    liveDte,
    priced,
    pos,
    movePct,
    takeable: freshness === 'fresh' && priced,
    popStale: stale,
    pricingStale: stale,
    asOf: c.generatedAt || null,
    ...centering,
  };
}

// ═══════════════════════════════════════════════════════════════
// deriveCentering — from the structure's design center
// ═══════════════════════════════════════════════════════════════

export const CENTER = { band: 0.2 };

/**
 * Centering from the midpoint of the SHORT strikes (the max-profit plateau).
 * Not spotAtGeneration, not breakeven midpoint. For asymmetric structures
 * the design center is deliberately offset — this respects that.
 *
 * @param {object} c — must have shortPut, shortCall (from toCanonical)
 * @param {number} liveSpot
 * @returns {{ idealEntry:number|null, offset:number, centeredness:number,
 *             distanceUsd:number, distancePct:number, side:string }}
 */
export function deriveCentering(c, liveSpot) {
  const sp = c.shortPut;
  const sc = c.shortCall;
  if (sp == null || sc == null || sp <= 0 || sc <= 0) {
    return { idealEntry: null, offset: 0, centeredness: 1, distanceUsd: 0, distancePct: 0, side: 'centered' };
  }
  const center = (sp + sc) / 2;
  const halfWidth = (sc - sp) / 2;
  const offset = halfWidth > 0 ? (liveSpot - center) / halfWidth : 0;
  const centeredness = Math.max(0, 1 - Math.abs(offset));
  const distanceUsd = liveSpot - center;
  const distancePct = center > 0 ? distanceUsd / center : 0;
  const side = Math.abs(offset) < CENTER.band ? 'centered' : (offset > 0 ? 'calls' : 'puts');
  return { idealEntry: center, offset, centeredness, distanceUsd, distancePct, side };
}

// ═══════════════════════════════════════════════════════════════
// computeLiveDte — always from expiry, never from stored field
// ═══════════════════════════════════════════════════════════════

/**
 * Compute DTE live from expiry date. Never use stored daysToExpiry.
 *
 * @param {string|null} expiry — ISO date "YYYY-MM-DD"
 * @param {Date|string} [today=new Date()]
 * @returns {number} — days to expiry, 0 if expired or missing
 */
export function computeLiveDte(expiry, today = new Date()) {
  if (!expiry) return 0;
  const exp = new Date(expiry + 'T16:00:00'); // market close
  const now = typeof today === 'string' ? new Date(today) : today;
  return Math.max(0, Math.round((exp - now) / 86400000));
}
