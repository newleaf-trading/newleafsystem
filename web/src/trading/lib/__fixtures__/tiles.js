/**
 * Test fixtures for tile schema validation and Invest read paths.
 *
 * Four Group-A reject cases + valid canonical tile + scanner signal +
 * drifted BWB + calendar (two expiries).
 */

/** Valid canonical tile — should pass validateTile */
export const VALID_TILE = {
  id: 'tile-valid-001',
  symbol: 'UBER',
  strategy: 'iron_condor',
  legs: [
    { action: 'SELL', type: 'PUT', strike: 65, premium: 1.50, expiry: '2026-06-19', delta: 0.22, theta: 0.08 },
    { action: 'BUY', type: 'PUT', strike: 60, premium: 0.55, expiry: '2026-06-19', delta: 0.12, theta: -0.05 },
    { action: 'SELL', type: 'CALL', strike: 80, premium: 1.80, expiry: '2026-06-19', delta: -0.25, theta: 0.09 },
    { action: 'BUY', type: 'CALL', strike: 85, premium: 0.70, expiry: '2026-06-19', delta: -0.14, theta: -0.06 },
  ],
  maxProfit: 205,
  maxLoss: 295,
  oddsOfProfit: 72,
  underlyingPrice: 70.40,
  expiry: '2026-06-19',
  breakevens: [63.45, 81.55],
  source: 'publish-pick',
  isActive: true,
  sortOrder: -Date.now(),
  createdAt: { seconds: 1748600000, nanoseconds: 0 },
};

/** Valid tile with oddsOfProfit: null (uncomputable PoP) — should PASS */
export const VALID_TILE_NULL_POP = {
  ...VALID_TILE,
  id: 'tile-null-pop',
  oddsOfProfit: null,
};

// ═══════════════════════════════════════════════════════════════
// Group A reject fixtures
// ═══════════════════════════════════════════════════════════════

/** Reject case 1: all leg premiums 0 (unpriced) */
export const REJECT_UNPRICED = {
  ...VALID_TILE,
  id: 'reject-unpriced',
  legs: VALID_TILE.legs.map(l => ({ ...l, premium: 0 })),
};

/** Reject case 2: breakevens is [] (empty array, not absent) */
export const REJECT_EMPTY_BREAKEVENS = {
  ...VALID_TILE,
  id: 'reject-empty-be',
  breakevens: [],
};

/** Reject case 3: missing required field (no legs) */
export const REJECT_NO_LEGS = {
  ...VALID_TILE,
  id: 'reject-no-legs',
  legs: undefined,
};

/** Reject case 3b: missing maxProfit */
export const REJECT_NO_MAX_PROFIT = {
  ...VALID_TILE,
  id: 'reject-no-mp',
  maxProfit: 0,
};

/** Reject case 4: fewer than 2 legs */
export const REJECT_ONE_LEG = {
  ...VALID_TILE,
  id: 'reject-one-leg',
  legs: [VALID_TILE.legs[0]],
};

/** Reject case 5: missing source */
export const REJECT_NO_SOURCE = {
  ...VALID_TILE,
  id: 'reject-no-source',
  source: undefined,
};

/** Reject case 6: oddsOfProfit is undefined (must be number or null) */
export const REJECT_POP_UNDEFINED = {
  ...VALID_TILE,
  id: 'reject-pop-undef',
  oddsOfProfit: undefined,
};

// ═══════════════════════════════════════════════════════════════
// Scanner signal fixture (should NOT pass validateTile)
// ═══════════════════════════════════════════════════════════════

export const SCANNER_SIGNAL = {
  id: 'UBER_iron_condor_1748600000',
  symbol: 'UBER',
  strategy: 'Iron Condor',
  direction: 'neutral',
  opportunityScore: 78,
  price: 70.40,
  gammaData: { analysis: { confidence_score: 0.72 } },
  source: 'pipeline-scanner',
  isActive: true,
  sortOrder: 22,
};

// ═══════════════════════════════════════════════════════════════
// Drifted BWB fixture (for cross-surface consistency test)
// ═══════════════════════════════════════════════════════════════

export const DRIFTED_BWB = {
  id: 'crm-bwb-drift',
  symbol: 'CRM',
  strategy: 'broken_wing_butterfly',
  legs: [
    { action: 'BUY', type: 'PUT', strike: 160, premium: 2.10, expiry: '2026-06-26' },
    { action: 'SELL', type: 'PUT', strike: 175, premium: 4.50, expiry: '2026-06-26' },
    { action: 'SELL', type: 'PUT', strike: 175, premium: 4.50, expiry: '2026-06-26' },
    { action: 'BUY', type: 'PUT', strike: 200, premium: 8.20, expiry: '2026-06-26' },
  ],
  maxProfit: 130,
  maxLoss: 370,
  oddsOfProfit: null,
  underlyingPrice: 179.28, // near lower edge of zone → should drift
  expiry: '2026-06-26',
  source: 'publish-pick',
  isActive: true,
  createdAt: { seconds: 1748500000, nanoseconds: 0 },
};

// ═══════════════════════════════════════════════════════════════
// Calendar spread fixture (two expiries)
// ═══════════════════════════════════════════════════════════════

export const CALENDAR_SPREAD = {
  id: 'spy-calendar',
  symbol: 'SPY',
  strategy: 'calendar_spread',
  legs: [
    { action: 'SELL', type: 'CALL', strike: 530, premium: 3.20, expiry: '2026-06-06' }, // front leg
    { action: 'BUY', type: 'CALL', strike: 530, premium: 5.80, expiry: '2026-07-18' },  // back leg
  ],
  maxProfit: 260,
  maxLoss: 260,
  oddsOfProfit: null,
  underlyingPrice: 530,
  expiry: '2026-06-06', // front leg is authoritative for DTE
  source: 'publish-pick',
  isActive: true,
  createdAt: { seconds: 1748600000, nanoseconds: 0 },
};

// ═══════════════════════════════════════════════════════════════
// Strategy-builder tile (named fields, no generic confidence)
// ═══════════════════════════════════════════════════════════════

/** Strategy-builder tile — has wallConfidence, no verdictConfidence, real PoP */
export const STRATEGY_BUILDER_TILE = {
  id: 'sb-aapl-ic',
  symbol: 'AAPL',
  strategy: 'Iron Condor',
  legs: [
    { action: 'SELL', type: 'PUT', strike: 290, premium: 2.50, expiry: '2026-07-18' },
    { action: 'BUY', type: 'PUT', strike: 280, premium: 1.20, expiry: '2026-07-18' },
    { action: 'SELL', type: 'CALL', strike: 330, premium: 1.80, expiry: '2026-07-18' },
    { action: 'BUY', type: 'CALL', strike: 340, premium: 0.90, expiry: '2026-07-18' },
  ],
  maxProfit: 220,
  maxLoss: 780,
  oddsOfProfit: 87,          // real PoP from calcPoP — passes the ≥65 gate
  verdictConfidence: null,    // strategy-builder has no adversarial verdict
  wallConfidence: 0.31,       // 0-1 scale, from gammaData.confidence_score
  underlyingPrice: 311.35,
  expiry: '2026-07-18',
  breakevens: [287.8, 332.2],
  source: 'strategy-builder',
  isActive: true,
};

// ═══════════════════════════════════════════════════════════════
// Cruft tile (has fields that should be pruned)
// ═══════════════════════════════════════════════════════════════

export const TILE_WITH_CRUFT = {
  ...VALID_TILE,
  id: 'tile-cruft',
  ticker: 'UBER',            // cruft: duplicate of symbol
  expirationDate: '2026-06-19', // cruft: duplicate of expiry
  tradeType: 'iron_condor',   // cruft: duplicate of strategy
  pnlPercent: 0,              // cruft: always 0
  entryCredit: 205,           // cruft: duplicate of netCredit
};
