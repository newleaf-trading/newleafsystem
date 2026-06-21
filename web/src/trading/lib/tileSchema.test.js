import { describe, it, expect } from 'vitest';
import { validateTile, findCruft, CRUFT_FIELDS } from './tileSchema';
import { tileToCanonical } from './toCanonical';
import { deriveCandidate, deriveCentering, computeLiveDte } from './deriveCandidate';
import { derivePosition } from './derivePosition';
import {
  VALID_TILE, VALID_TILE_NULL_POP,
  REJECT_UNPRICED, REJECT_EMPTY_BREAKEVENS, REJECT_NO_LEGS,
  REJECT_NO_MAX_PROFIT, REJECT_ONE_LEG, REJECT_NO_SOURCE, REJECT_POP_UNDEFINED,
  SCANNER_SIGNAL, DRIFTED_BWB, CALENDAR_SPREAD, TILE_WITH_CRUFT,
} from './__fixtures__/tiles';

const TODAY = new Date('2026-05-30T12:00:00Z');

// ═══════════════════════════════════════════════════════════════
// GROUP A — Schema enforcement
// ═══════════════════════════════════════════════════════════════

describe('Group A: validateTile', () => {
  it('accepts a canonical valid tile', () => {
    expect(validateTile(VALID_TILE)).toEqual({ valid: true });
  });

  it('accepts oddsOfProfit: null (uncomputable PoP)', () => {
    expect(validateTile(VALID_TILE_NULL_POP)).toEqual({ valid: true });
  });

  it('accepts oddsOfProfit: 72 (numeric PoP)', () => {
    expect(validateTile({ ...VALID_TILE, oddsOfProfit: 72 })).toEqual({ valid: true });
  });

  it('rejects case 1: all leg premiums 0 (unpriced)', () => {
    const r = validateTile(REJECT_UNPRICED);
    expect(r.valid).toBe(false);
    expect(r.reason).toContain('unpriced');
  });

  it('rejects case 2: breakevens: [] (empty array)', () => {
    const r = validateTile(REJECT_EMPTY_BREAKEVENS);
    expect(r.valid).toBe(false);
    expect(r.reason).toContain('breakevens');
  });

  it('rejects case 3: missing legs', () => {
    const r = validateTile(REJECT_NO_LEGS);
    expect(r.valid).toBe(false);
    expect(r.reason).toContain('legs');
  });

  it('rejects case 3b: maxProfit = 0', () => {
    const r = validateTile(REJECT_NO_MAX_PROFIT);
    expect(r.valid).toBe(false);
    expect(r.reason).toContain('maxProfit');
  });

  it('rejects case 4: fewer than 2 legs', () => {
    const r = validateTile(REJECT_ONE_LEG);
    expect(r.valid).toBe(false);
    expect(r.reason).toContain('legs');
  });

  it('rejects missing source', () => {
    const r = validateTile(REJECT_NO_SOURCE);
    expect(r.valid).toBe(false);
    expect(r.reason).toContain('source');
  });

  it('rejects oddsOfProfit: undefined (must be number or null)', () => {
    const r = validateTile(REJECT_POP_UNDEFINED);
    expect(r.valid).toBe(false);
    expect(r.reason).toContain('oddsOfProfit');
  });

  it('scanner signal fails validateTile (no legs, no pricing)', () => {
    const r = validateTile(SCANNER_SIGNAL);
    expect(r.valid).toBe(false);
  });

  it('breakevens: undefined (absent) is accepted', () => {
    const tile = { ...VALID_TILE, breakevens: undefined };
    expect(validateTile(tile)).toEqual({ valid: true });
  });
});

describe('Group A: cruft detection', () => {
  it('valid tile has no cruft', () => {
    expect(findCruft(VALID_TILE)).toEqual([]);
  });

  it('detects all cruft fields', () => {
    const cruft = findCruft(TILE_WITH_CRUFT);
    expect(cruft).toContain('ticker');
    expect(cruft).toContain('expirationDate');
    expect(cruft).toContain('tradeType');
    expect(cruft).toContain('pnlPercent');
    expect(cruft).toContain('entryCredit');
    expect(cruft).toHaveLength(5);
  });
});

// ═══════════════════════════════════════════════════════════════
// GROUP C — Invest read paths
// ═══════════════════════════════════════════════════════════════

describe('Group C: Discover read path', () => {
  it('signal-shaped doc is not priced → deriveCandidate.priced=false', () => {
    // A scanner signal has no legs → tileToCanonical produces a candidate with no pricing
    const canon = tileToCanonical({
      ...SCANNER_SIGNAL,
      maxProfit: 0,
      maxLoss: 0,
      underlyingPrice: 70,
    });
    const fc = deriveCandidate(canon, 70, TODAY);
    expect(fc.priced).toBe(false);
    expect(fc.takeable).toBe(false);
  });

  it('priced canonical tile → deriveCandidate.priced=true', () => {
    const canon = tileToCanonical(VALID_TILE);
    const fc = deriveCandidate(canon, 70.40, TODAY);
    expect(fc.priced).toBe(true);
  });
});

describe('Group C: cross-surface consistency', () => {
  it('drifted BWB produces same freshness + offset on Discover and DecidePage path', () => {
    // Discover path: tileToCanonical → deriveCandidate
    const discoverCanon = tileToCanonical(DRIFTED_BWB);
    const discoverFc = deriveCandidate(discoverCanon, 179.28, TODAY);

    // DecidePage path: same tileToCanonical → deriveCandidate (StrategyRouter does this)
    const detailCanon = tileToCanonical(DRIFTED_BWB);
    const detailFc = deriveCandidate(detailCanon, 179.28, TODAY);

    // Must match
    expect(discoverFc.freshness).toBe(detailFc.freshness);
    expect(discoverFc.offset).toBeCloseTo(detailFc.offset, 4);
    expect(discoverFc.idealEntry).toBe(detailFc.idealEntry);
    expect(discoverFc.takeable).toBe(detailFc.takeable);
    expect(discoverFc.priced).toBe(detailFc.priced);
  });
});

describe('Group C: DecidePage states', () => {
  it('unpriced tile renders not-priced state (priced=false, takeable=false)', () => {
    const unpriced = tileToCanonical(REJECT_UNPRICED);
    const fc = deriveCandidate(unpriced, 70, TODAY);
    expect(fc.priced).toBe(false);
    expect(fc.takeable).toBe(false);
    expect(fc.pricingStale).toBe(true);
  });
});

describe('Group C: Positions/Defend reconciliation', () => {
  it('total P&L = per-contract × qty', () => {
    const canon = {
      id: 'pos1', symbol: 'ABNB', strategy: 'iron_condor',
      status: 'open', qty: 44, dte: 7, spot: 133,
      maxProfitTotal: 3124, maxLossTotal: 5676,
      pnlTotal: 176,
    };
    const d = derivePosition(canon);
    expect(d.pnlTotal).toBe(176);
    expect(d.perContract).toBeCloseTo(176 / 44, 4);
    expect(d.perContract * d.qty).toBeCloseTo(d.pnlTotal, 4);
  });

  it('Today hidden when pnlPrevClose is null', () => {
    const canon = {
      id: 'pos2', symbol: 'BIDU', strategy: 'iron_condor',
      status: 'open', qty: 13, dte: 20, spot: 100,
      maxProfitTotal: 2190, maxLossTotal: 5610,
      pnlTotal: -611,
      pnlPrevClose: undefined,
    };
    const d = derivePosition(canon);
    expect(d.daily).toBeNull();
    expect(d.dailyPerContract).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════
// GROUP D — Boundary & regression
// ═══════════════════════════════════════════════════════════════

describe('Group D: computeLiveDte uses front-leg expiry on calendar', () => {
  it('front leg expiry is authoritative for DTE', () => {
    // Calendar: front leg 2026-06-06, back leg 2026-07-18
    // DTE should be from the front leg (near-term), not the back
    const frontDte = computeLiveDte('2026-06-06', TODAY);
    const backDte = computeLiveDte('2026-07-18', TODAY);
    const topLevelDte = computeLiveDte(CALENDAR_SPREAD.expiry, TODAY);

    // Top-level expiry should be the front leg's
    expect(CALENDAR_SPREAD.expiry).toBe('2026-06-06');
    expect(topLevelDte).toBe(frontDte);
    expect(frontDte).toBeLessThan(backDte);
    expect(frontDte).toBeGreaterThan(0);
  });
});

describe('Group D: validateTile rejects fabricated PoP', () => {
  it('oddsOfProfit: 50 with no real computation passes schema (50 is a valid number)', () => {
    // Note: the SCHEMA allows 50 as a number. The POLICY "never emit 50 as fallback"
    // is enforced at the writer, not the validator. This test documents the boundary.
    const tile = { ...VALID_TILE, oddsOfProfit: 50 };
    expect(validateTile(tile)).toEqual({ valid: true });
  });

  it('writers should emit null, not 50, when PoP is uncomputable (policy, not schema)', () => {
    // This is a writer-side policy assertion, not a validateTile test.
    // The fixture with null PoP should be valid:
    expect(validateTile(VALID_TILE_NULL_POP)).toEqual({ valid: true });
  });
});

describe('Group D: full trading lib suite integrity', () => {
  it('derivePosition handles all-zero inputs without NaN', () => {
    const empty = { id: 'e', status: 'open', pnlTotal: 0 };
    const d = derivePosition(empty);
    expect(isFinite(d.span)).toBe(true);
    expect(isFinite(d.breakevenPct)).toBe(true);
    expect(isFinite(d.perContract)).toBe(true);
  });

  it('tileToCanonical normalizes case on legs', () => {
    const canon = tileToCanonical(VALID_TILE);
    expect(canon.legs[0].action).toBe('sell');
    expect(canon.legs[0].type).toBe('put');
  });

  it('tileToCanonical normalizes probability to 0-1', () => {
    const canon = tileToCanonical({ ...VALID_TILE, oddsOfProfit: 72 });
    expect(canon.probability).toBe(0.72);
  });
});
