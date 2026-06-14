/**
 * tileSchema.js — Canonical tile schema + validation.
 *
 * One definition for producers (publish paths) and consumers (Invest surfaces).
 * validateTile rejects any tile that would produce fabricated numbers on Discover.
 *
 * @module tileSchema
 */

// ═══════════════════════════════════════════════════════════════
// Canonical Tile shape (JSDoc)
// ═══════════════════════════════════════════════════════════════

/**
 * @typedef {object} CanonicalTile
 * @property {string}  id
 * @property {string}  symbol
 * @property {string}  strategy
 * @property {Array<{action:string, type:string, strike:number, premium:number, expiry?:string, delta?:number, theta?:number}>} legs
 * @property {number}  maxProfit          — per-contract $, positive
 * @property {number}  maxLoss            — per-contract $, positive magnitude
 * @property {number|null} oddsOfProfit   — 0-100 or null when uncomputable. NEVER a fabricated fallback.
 * @property {number}  underlyingPrice    — spot at generation
 * @property {string}  expiry             — ISO date (or per-leg expiries for calendars)
 * @property {[number,number]|undefined} breakevens — [lower, upper] or absent. NEVER [].
 * @property {string}  source             — provenance identifier
 * @property {boolean} isActive
 * @property {number}  [sortOrder]
 * @property {object}  [greeks]
 * @property {object}  [provenance]       — { model, prompt, source, verifyJobId, verifyVerdict, verifyConfidence, generatedAt, commitSha }
 * @property {*}       [createdAt]        — Firestore Timestamp
 */

/**
 * @typedef {object} ScannerSignal
 * @property {string}  id
 * @property {string}  symbol
 * @property {string}  strategy
 * @property {string}  [direction]
 * @property {number}  [opportunityScore]
 * @property {number}  [price]            — spot at scan time
 * @property {object}  [gammaData]
 * @property {string}  source             — 'pipeline-scanner'
 * @property {boolean} isActive
 * @property {*}       [createdAt]
 */

// ═══════════════════════════════════════════════════════════════
// validateTile — rejects non-conforming tiles
// ═══════════════════════════════════════════════════════════════

/**
 * Validate a tile against the canonical schema.
 * Returns { valid: true } or { valid: false, reason: string }.
 *
 * Rules:
 *   1. id, symbol, strategy must be present non-empty strings
 *   2. legs[] must have ≥ 2 entries
 *   3. At least one leg must have a non-zero premium (priced gate)
 *   4. maxProfit > 0 and maxLoss > 0
 *   5. expiry present (top-level or per-leg)
 *   6. underlyingPrice > 0
 *   7. source must be present
 *   8. isActive must be boolean
 *   9. oddsOfProfit must be a number OR null — never undefined (forces explicit choice)
 *  10. breakevens must be [lower, upper] (2 elements) or absent — never []
 *
 * @param {object} tile
 * @returns {{ valid: boolean, reason?: string }}
 */
export function validateTile(tile) {
  if (!tile) return fail('tile is null/undefined');

  // 1. Identity
  if (!nonEmpty(tile.id)) return fail('missing id');
  if (!nonEmpty(tile.symbol)) return fail('missing symbol');
  if (!nonEmpty(tile.strategy)) return fail('missing strategy');

  // 2. Legs
  if (!Array.isArray(tile.legs) || tile.legs.length < 2) {
    return fail(`legs must have ≥ 2 entries, got ${tile.legs?.length ?? 0}`);
  }

  // 3. Priced gate — at least one leg with non-zero premium
  const hasPricing = tile.legs.some(l => (l.premium || l.entryPrice || 0) !== 0);
  if (!hasPricing) return fail('all leg premiums are 0 — unpriced candidate');

  // 4. P&L
  if (!(tile.maxProfit > 0)) return fail(`maxProfit must be > 0, got ${tile.maxProfit}`);
  if (!(tile.maxLoss > 0)) return fail(`maxLoss must be > 0, got ${tile.maxLoss}`);

  // 5. Expiry — top-level or per-leg
  const hasTopExpiry = nonEmpty(tile.expiry);
  const hasLegExpiry = tile.legs.some(l => nonEmpty(l.expiry));
  if (!hasTopExpiry && !hasLegExpiry) return fail('missing expiry (top-level and per-leg)');

  // 6. Spot
  if (!(tile.underlyingPrice > 0)) return fail(`underlyingPrice must be > 0, got ${tile.underlyingPrice}`);

  // 7. Source
  if (!nonEmpty(tile.source)) return fail('missing source');

  // 8. isActive
  if (typeof tile.isActive !== 'boolean') return fail(`isActive must be boolean, got ${typeof tile.isActive}`);

  // 9. oddsOfProfit: number or null, never undefined
  if (tile.oddsOfProfit !== null && typeof tile.oddsOfProfit !== 'number') {
    return fail(`oddsOfProfit must be number or null, got ${typeof tile.oddsOfProfit}`);
  }

  // 10. breakevens: [lower, upper] or absent — never []
  if (tile.breakevens !== undefined && tile.breakevens !== null) {
    if (!Array.isArray(tile.breakevens) || tile.breakevens.length !== 2) {
      return fail(`breakevens must be [lower, upper] or absent, got length ${tile.breakevens?.length}`);
    }
  }

  // 11. Reject generic 'confidence' field (write-side only — prevents the overloading from returning)
  // Legacy tiles in Firestore still carry it; this rule prevents NEW writes from using it.
  if (tile.confidence !== undefined) {
    return fail('generic "confidence" field is deprecated — use verdictConfidence, wallConfidence, or oddsOfProfit');
  }

  return { valid: true };
}

// ═══════════════════════════════════════════════════════════════
// Cruft fields — must NOT appear on canonical tiles
// ═══════════════════════════════════════════════════════════════

export const CRUFT_FIELDS = [
  'ticker',          // duplicate of symbol
  'expirationDate',  // duplicate of expiry
  'tradeType',       // duplicate of strategy
  'pnlPercent',      // always 0, never read
  'entryCredit',     // duplicate of netCredit
];

/**
 * Check that a tile has no cruft fields.
 * @param {object} tile
 * @returns {string[]} — list of cruft field names found (empty = clean)
 */
export function findCruft(tile) {
  return CRUFT_FIELDS.filter(f => tile[f] !== undefined);
}

// ═══════════════════════════════════════════════════════════════
// Publish gate — one function, used at write (CJS copy) and read (this ESM)
// ═══════════════════════════════════════════════════════════════

const POP_FLOOR = 65;
const VERDICT_FLOOR = 65;

/**
 * Apply the publish gate. Three branches:
 *   1. verdictConfidence present and ≥ VERDICT_FLOOR → PASS (verified)
 *   2. verdictConfidence present and < VERDICT_FLOOR → REJECT (adversary flagged it)
 *   3. verdictConfidence absent → PASS iff oddsOfProfit ≥ POP_FLOOR
 *
 * @param {object} tile
 * @returns {{ pass: boolean, reason?: string, tier: 'verified' | 'priced' }}
 */
export function applyPublishGate(tile) {
  const vc = tile.verdictConfidence;
  const pop = tile.oddsOfProfit;

  if (vc != null) {
    if (vc >= VERDICT_FLOOR) {
      return { pass: true, tier: 'verified' };
    }
    return { pass: false, reason: `adversarial verdict ${vc} < ${VERDICT_FLOOR} threshold`, tier: 'priced' };
  }

  // No verdict — gate on PoP
  if ((pop || 0) >= POP_FLOOR) {
    return { pass: true, tier: 'priced' };
  }
  return { pass: false, reason: `PoP ${pop ?? 'null'} < ${POP_FLOOR}% floor (no verdict)`, tier: 'priced' };
}

/**
 * Derive the tile's tier at read time. Never stored.
 * @param {object} tile
 * @returns {'verified' | 'priced'}
 */
export function deriveTier(tile) {
  return (tile.verdictConfidence != null && tile.verdictConfidence >= VERDICT_FLOOR)
    ? 'verified'
    : 'priced';
}

export { POP_FLOOR, VERDICT_FLOOR };

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function nonEmpty(v) {
  return typeof v === 'string' && v.length > 0;
}

function fail(reason) {
  return { valid: false, reason };
}
