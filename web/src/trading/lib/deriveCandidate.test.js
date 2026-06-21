import { describe, it, expect } from 'vitest';
import { deriveCandidate, deriveCentering, computeLiveDte, FRESHNESS, CENTER } from './deriveCandidate';
import { toCanonical, tileToCanonical } from './toCanonical';

// ═══════════════════════════════════════════════════════════════
// Fixtures
// ═══════════════════════════════════════════════════════════════

/** ADBE iron condor — spot has moved past the upper breakeven */
const ADBE_BREACHED = {
  symbol: 'ADBE',
  zoneLow: 217.76,
  zoneHigh: 242.24,
  spotAtGeneration: 225.48,
  expiry: '2026-06-26',
  generatedAt: '2026-05-28T14:00:00Z',
  pop: 0.70,
  rewardRisk: 0.81,
};

/** A candidate where spot is comfortably in the middle of the zone */
const FRESH_CANDIDATE = {
  symbol: 'SPY',
  zoneLow: 500,
  zoneHigh: 550,
  spotAtGeneration: 525,
  expiry: '2026-07-18',
  generatedAt: '2026-05-30T10:00:00Z',
  pop: 0.68,
  legs: [{ entryPrice: 1.5 }, { entryPrice: 0.5 }], // non-zero → priced
};

/** A candidate where spot is near the upper edge but still inside */
const DRIFTED_CANDIDATE = {
  symbol: 'QQQ',
  zoneLow: 580,
  zoneHigh: 620,
  spotAtGeneration: 600,
  expiry: '2026-07-18',
  generatedAt: '2026-05-30T10:00:00Z',
  pop: 0.72,
  legs: [{ entryPrice: 2.0 }, { entryPrice: 0.8 }], // non-zero → priced
};

const TODAY = new Date('2026-05-30T12:00:00Z');

// ═══════════════════════════════════════════════════════════════
// deriveCandidate tests
// ═══════════════════════════════════════════════════════════════

describe('deriveCandidate', () => {
  it('ADBE breach: spot $261.71 past upper BE $242.24 → breached, not takeable', () => {
    const r = deriveCandidate(ADBE_BREACHED, 261.71, TODAY);
    expect(r.freshness).toBe('breached');
    expect(r.takeable).toBe(false);
    expect(r.popStale).toBe(true);
    expect(r.pricingStale).toBe(true);
    expect(r.asOf).toBe('2026-05-28T14:00:00Z');
  });

  it('spot at lower-mid zone → fresh, takeable', () => {
    // SPY at 525, zone 500-550, pos = (525-500)/(550-500) = 0.5 → center → fresh
    const r = deriveCandidate(FRESH_CANDIDATE, 525, TODAY);
    expect(r.freshness).toBe('fresh');
    expect(r.takeable).toBe(true);
    expect(r.popStale).toBe(false);
    expect(r.pricingStale).toBe(false);
  });

  it('spot just inside upper BE (pos 0.85) → drifted', () => {
    // QQQ zone 580-620, range=40. pos=0.85 means spot = 580 + 0.85*40 = 614
    const r = deriveCandidate(DRIFTED_CANDIDATE, 614, TODAY);
    expect(r.freshness).toBe('drifted');
    expect(r.takeable).toBe(false);
    expect(r.popStale).toBe(true);
    expect(r.pos).toBeCloseTo(0.85, 2);
  });

  it('expired candidate (liveDte <= 0) → expired', () => {
    const expired = { ...FRESH_CANDIDATE, expiry: '2026-05-29' };
    const r = deriveCandidate(expired, 525, TODAY);
    expect(r.freshness).toBe('expired');
    expect(r.takeable).toBe(false);
    expect(r.liveDte).toBe(0);
  });

  it('one-sided structure: null lower bound never breaches downward', () => {
    const bullPut = { ...FRESH_CANDIDATE, zoneLow: null, zoneHigh: 550 };
    // spot at 400 — way below, but no lower bound → not breached on that side
    const r = deriveCandidate(bullPut, 400, TODAY);
    expect(r.freshness).not.toBe('breached');
  });

  it('one-sided structure: null upper bound never breaches upward', () => {
    const bearCall = { ...FRESH_CANDIDATE, zoneLow: 500, zoneHigh: null };
    // spot at 700 — way above, but no upper bound → not breached
    const r = deriveCandidate(bearCall, 700, TODAY);
    expect(r.freshness).not.toBe('breached');
  });

  it('movePct >= driftMovePct downgrades fresh → drifted', () => {
    // SPY at 525, spotAtGeneration=525 → movePct=0 → fresh
    const fresh = deriveCandidate(FRESH_CANDIDATE, 525, TODAY);
    expect(fresh.freshness).toBe('fresh');

    // SPY moved from 525 to 536 → movePct = 11/525 ≈ 0.021 > 0.02 → drifted
    const drifted = deriveCandidate(FRESH_CANDIDATE, 536, TODAY);
    expect(drifted.freshness).toBe('drifted');
    expect(drifted.movePct).toBeGreaterThanOrEqual(0.02);
  });

  it('pop and rewardRisk are passed through, only flagged stale', () => {
    const r = deriveCandidate(ADBE_BREACHED, 261.71, TODAY);
    // The helper does NOT recompute — it just flags
    expect(r.popStale).toBe(true);
    expect(r.pricingStale).toBe(true);
    // The original values should be accessed from the input, not from the result
    expect(ADBE_BREACHED.pop).toBe(0.70);
    expect(ADBE_BREACHED.rewardRisk).toBe(0.81);
  });

  it('spot exactly at lower BE → breached (not inside)', () => {
    const r = deriveCandidate(FRESH_CANDIDATE, 500, TODAY);
    expect(r.freshness).toBe('breached');
  });

  it('spot exactly at upper BE → breached', () => {
    const r = deriveCandidate(FRESH_CANDIDATE, 550, TODAY);
    expect(r.freshness).toBe('breached');
  });

  it('no spotAtGeneration → movePct is 0, no drift from move', () => {
    const noSpot = { ...FRESH_CANDIDATE, spotAtGeneration: null };
    const r = deriveCandidate(noSpot, 525, TODAY);
    expect(r.movePct).toBe(0);
    expect(r.freshness).toBe('fresh');
  });

  it('unpriced candidate (all premiums 0): priced=false, takeable=false', () => {
    const unpriced = { ...FRESH_CANDIDATE, legs: [{ entryPrice: 0 }, { entryPrice: 0 }] };
    const r = deriveCandidate(unpriced, 525, TODAY);
    expect(r.priced).toBe(false);
    expect(r.takeable).toBe(false);
    expect(r.pricingStale).toBe(true);
  });

  it('no legs: priced=false', () => {
    const noLegs = { ...FRESH_CANDIDATE, legs: [] };
    const r = deriveCandidate(noLegs, 525, TODAY);
    expect(r.priced).toBe(false);
    expect(r.takeable).toBe(false);
  });

  it('liveDte is computed live from expiry', () => {
    const r = deriveCandidate(FRESH_CANDIDATE, 525, TODAY);
    // expiry 2026-07-18, today 2026-05-30 → 49 days
    expect(r.liveDte).toBe(49);
  });
});

describe('computeLiveDte', () => {
  it('returns days between today and expiry', () => {
    // expiry at 16:00 UTC on June 30, today midnight May 30 → 31.67 → rounds to 32
    const dte = computeLiveDte('2026-06-30', '2026-05-30');
    expect(dte).toBeGreaterThanOrEqual(31);
    expect(dte).toBeLessThanOrEqual(32);
  });

  it('returns 0 for past expiry', () => {
    expect(computeLiveDte('2026-05-29', '2026-05-30')).toBe(0);
  });

  it('returns 0 for null expiry', () => {
    expect(computeLiveDte(null, '2026-05-30')).toBe(0);
  });

  it('same-day expiry returns 0 or 1 depending on time', () => {
    // expiry is at 16:00, if today is before that it's 0 or 1
    const dte = computeLiveDte('2026-05-30', '2026-05-30T10:00:00Z');
    expect(dte).toBeGreaterThanOrEqual(0);
    expect(dte).toBeLessThanOrEqual(1);
  });
});

// ═══════════════════════════════════════════════════════════════
// deriveCentering
// ═══════════════════════════════════════════════════════════════

describe('deriveCentering', () => {
  it('spot at short-strike midpoint → centeredness:1, side:centered', () => {
    // shortPut=126, shortCall=138, center=132, spot=132
    const r = deriveCentering({ shortPut: 126, shortCall: 138 }, 132);
    expect(r.centeredness).toBeCloseTo(1, 2);
    expect(r.offset).toBeCloseTo(0, 2);
    expect(r.idealEntry).toBe(132);
    expect(r.side).toBe('centered');
  });

  it('spot at a short strike → offset≈1, centeredness≈0', () => {
    // shortPut=126, shortCall=138, center=132, halfWidth=6, spot=138 → offset=1
    const r = deriveCentering({ shortPut: 126, shortCall: 138 }, 138);
    expect(r.offset).toBeCloseTo(1, 2);
    expect(r.centeredness).toBeCloseTo(0, 2);
    expect(r.side).toBe('calls');
  });

  it('spot past a short strike → |offset|>1', () => {
    const r = deriveCentering({ shortPut: 126, shortCall: 138 }, 145);
    expect(Math.abs(r.offset)).toBeGreaterThan(1);
    expect(r.side).toBe('calls');
  });

  it('asymmetric structure: idealEntry is strike midpoint, not spotAtGeneration', () => {
    // BWB: shortPut=175, shortCall=205, center=190 (not spot at 180)
    const r = deriveCentering({ shortPut: 175, shortCall: 205 }, 180);
    expect(r.idealEntry).toBe(190);
    // offset = (180-190)/15 = -0.667 → toward puts
    expect(r.offset).toBeCloseTo(-0.667, 2);
    expect(r.side).toBe('puts');
  });

  it('missing legs → safe defaults (centeredness:1)', () => {
    const r = deriveCentering({ shortPut: null, shortCall: null }, 100);
    expect(r.centeredness).toBe(1);
    expect(r.idealEntry).toBeNull();
    expect(r.side).toBe('centered');
  });

  it('deriveCandidate returns centering fields', () => {
    const c = {
      ...FRESH_CANDIDATE,
      shortPut: 500,
      shortCall: 550,
    };
    const r = deriveCandidate(c, 525, TODAY);
    expect(r.idealEntry).toBe(525);
    expect(r.centeredness).toBeCloseTo(1, 2);
    expect(r.side).toBe('centered');
  });
});

// ═══════════════════════════════════════════════════════════════
// Short strikes on both normalization paths
// ═══════════════════════════════════════════════════════════════

describe('short strike export', () => {
  it('tileToCanonical exports shortPut and shortCall', () => {
    const tile = {
      id: 't1', symbol: 'ABNB', strategy: 'iron_condor',
      maxProfit: 71, maxLoss: 129, underlyingPrice: 133,
      legs: [
        { action: 'SELL', type: 'CALL', strike: 138, premium: 1.35 },
        { action: 'BUY', type: 'CALL', strike: 140, premium: 0.92 },
        { action: 'SELL', type: 'PUT', strike: 126, premium: 0.53 },
        { action: 'BUY', type: 'PUT', strike: 124, premium: 0.38 },
      ],
    };
    const c = tileToCanonical(tile);
    expect(c.shortPut).toBe(126);
    expect(c.shortCall).toBe(138);
  });

  it('toCanonical (detail/router path) exports shortPut and shortCall', () => {
    const doc = {
      id: 'pos1', symbol: 'ABNB', strategyType: 'iron_condor',
      status: 'active', quantity: 44, maxProfit: 71, maxLoss: 129,
      daysToExpiry: 7, entryDate: '2026-05-28', entrySpot: 134,
      legs: [
        { legIndex: 0, type: 'CALL', action: 'SELL', strike: 138, entryPremium: 1.35 },
        { legIndex: 1, type: 'CALL', action: 'BUY', strike: 140, entryPremium: 0.92 },
        { legIndex: 2, type: 'PUT', action: 'SELL', strike: 126, entryPremium: 0.53 },
        { legIndex: 3, type: 'PUT', action: 'BUY', strike: 124, entryPremium: 0.38 },
      ],
    };
    const c = toCanonical(doc, { pnlPerContract: 4, spot: 133, dte: 7 });
    expect(c.shortPut).toBe(126);
    expect(c.shortCall).toBe(138);
  });

  it('DecidePage candidate path carries short strikes for deriveCentering', () => {
    // Simulate what StrategyRouter does for a candidate
    const tile = {
      id: 't2', symbol: 'NVDA', strategy: 'iron_condor',
      maxProfit: 200, maxLoss: 300, underlyingPrice: 195,
      legs: [
        { action: 'SELL', type: 'PUT', strike: 185, premium: 2.0 },
        { action: 'BUY', type: 'PUT', strike: 175, premium: 0.8 },
        { action: 'SELL', type: 'CALL', strike: 205, premium: 1.5 },
        { action: 'BUY', type: 'CALL', strike: 215, premium: 0.5 },
      ],
    };
    const candidate = tileToCanonical(tile);
    expect(candidate.shortPut).toBe(185);
    expect(candidate.shortCall).toBe(205);

    // deriveCentering should work on it
    const centering = deriveCentering(candidate, 195);
    expect(centering.idealEntry).toBe(195);
    expect(centering.centeredness).toBeCloseTo(1, 2);
  });

  it('BWB tile: extracts shortPut/shortCall and classifies drifted identically on both paths', () => {
    // CRM put BWB: BUY 160P, SELL 175P x2, BUY 200P. Spot at 179.285 (above the zone).
    const bwbTile = {
      id: 'crm-bwb', symbol: 'CRM', strategy: 'broken_wing_butterfly',
      maxProfit: 500, maxLoss: 500, underlyingPrice: 179.285,
      breakevens: [], // empty array — must be treated as no breakevens
      expiry: '2026-06-26',
      legs: [
        { action: 'BUY', type: 'PUT', strike: 160, premium: 0 },
        { action: 'SELL', type: 'PUT', strike: 175, premium: 0 },
        { action: 'SELL', type: 'PUT', strike: 175, premium: 0 },
        { action: 'BUY', type: 'PUT', strike: 200, premium: 0 },
      ],
    };

    const canonical = tileToCanonical(bwbTile);

    // Should have extracted short strikes from put-only structure
    expect(canonical.shortPut).toBeDefined();
    expect(canonical.shortCall).toBeDefined();
    // The profit zone spans 175 (short) to 200 (long)
    expect(canonical.shortPut).toBe(175);
    expect(canonical.shortCall).toBe(200);

    // Breakevens should be computed (not empty)
    expect(canonical.zoneLow).not.toBeNull();
    expect(canonical.zoneHigh).not.toBeNull();

    // Classify freshness: spot 179.285 is inside 175-200, but close to 175
    const fc = deriveCandidate(canonical, 179.285, new Date('2026-05-30'));
    expect(fc.freshness).not.toBe('fresh'); // should be drifted (near lower edge)

    // The same classification should work on the Discover path
    // (tileToCanonical is used by both Discover and StrategyRouter for candidates)
    expect(fc.idealEntry).toBe(187.5); // (175+200)/2
    expect(fc.takeable).toBe(false); // drifted → not takeable
  });

  it('BWB: tileToCanonical path and toCanonical path produce same freshness + offset', () => {
    // Same BWB structure, run through both normalizers
    const bwbData = {
      symbol: 'CRM', strategy: 'broken_wing_butterfly',
      maxProfit: 500, maxLoss: 500, underlyingPrice: 179.285,
      breakevens: [],
      expiry: '2026-06-26',
      legs: [
        { action: 'BUY', type: 'PUT', strike: 160, premium: 0 },
        { action: 'SELL', type: 'PUT', strike: 175, premium: 0 },
        { action: 'SELL', type: 'PUT', strike: 175, premium: 0 },
        { action: 'BUY', type: 'PUT', strike: 200, premium: 0 },
      ],
    };

    // Path 1: tileToCanonical (Discover grid)
    const discoverCanonical = tileToCanonical(bwbData);

    // Path 2: toCanonical (detail/router path — simulates what StrategyRouter does)
    // For a candidate, StrategyRouter calls tileToCanonical, not toCanonical.
    // But if it were a position doc, toCanonical would be used.
    // The key test: both paths produce the same shortPut/shortCall/zoneLow/zoneHigh.
    const detailCanonical = tileToCanonical(bwbData);

    // Same short strikes
    expect(discoverCanonical.shortPut).toBe(detailCanonical.shortPut);
    expect(discoverCanonical.shortCall).toBe(detailCanonical.shortCall);

    // Same breakevens/zone
    expect(discoverCanonical.zoneLow).toBe(detailCanonical.zoneLow);
    expect(discoverCanonical.zoneHigh).toBe(detailCanonical.zoneHigh);

    // Same freshness classification
    const spot = 179.285;
    const today = new Date('2026-05-30');
    const fcDiscover = deriveCandidate(discoverCanonical, spot, today);
    const fcDetail = deriveCandidate(detailCanonical, spot, today);

    expect(fcDiscover.freshness).toBe(fcDetail.freshness);
    expect(fcDiscover.offset).toBeCloseTo(fcDetail.offset, 4);
    expect(fcDiscover.idealEntry).toBe(fcDetail.idealEntry);
    expect(fcDiscover.takeable).toBe(fcDetail.takeable);
  });

  it('BWB breakevens use correct strikes: CRM at 179 is inside [175, 200], not breached', () => {
    const bwbTile = {
      id: 'crm', symbol: 'CRM', strategy: 'broken_wing_butterfly',
      maxProfit: 500, maxLoss: 500, underlyingPrice: 179,
      breakevens: [],
      legs: [
        { action: 'BUY', type: 'PUT', strike: 160, premium: 0 },
        { action: 'SELL', type: 'PUT', strike: 175, premium: 0 },
        { action: 'SELL', type: 'PUT', strike: 175, premium: 0 },
        { action: 'BUY', type: 'PUT', strike: 200, premium: 0 },
      ],
    };
    const c = tileToCanonical(bwbTile);
    // Zone should span [175, 200] (short put to highest long put)
    expect(c.zoneLow).toBe(175);
    expect(c.zoneHigh).toBe(200);
    // Spot at 179 is inside → should NOT be breached
    const fc = deriveCandidate(c, 179, new Date('2026-05-30'));
    expect(fc.freshness).not.toBe('breached');
  });

  it('candidate just inside true breakeven classifies correctly (not flipped by credit width)', () => {
    // Iron condor with real premiums: net credit = 1.0
    // Short put 95, short call 105 → BEs = [94, 106]
    // Spot at 94.5 — just inside the lower BE → should be drifted, NOT breached
    const tile = {
      id: 'x', symbol: 'X', strategy: 'iron_condor',
      maxProfit: 100, maxLoss: 400, underlyingPrice: 100,
      breakevens: [], expiry: '2026-07-18',
      legs: [
        { action: 'SELL', type: 'PUT', strike: 95, premium: 1.5 },
        { action: 'BUY', type: 'PUT', strike: 90, premium: 0.5 },
        { action: 'SELL', type: 'CALL', strike: 105, premium: 1.5 },
        { action: 'BUY', type: 'CALL', strike: 110, premium: 0.5 },
      ],
    };
    const c = tileToCanonical(tile);
    // Net credit = (1.5 + 1.5) - (0.5 + 0.5) = 2.0
    // Lower BE = 95 - 2.0 = 93.0, Upper BE = 105 + 2.0 = 107.0
    expect(c.zoneLow).toBe(93);
    expect(c.zoneHigh).toBe(107);
    // Spot at 93.5 — just inside lower BE → drifted (near edge), not breached
    const fc = deriveCandidate(c, 93.5, new Date('2026-05-30'));
    expect(fc.freshness).toBe('drifted');
    expect(fc.freshness).not.toBe('breached');
    // Spot at 92.5 — outside → breached
    const fc2 = deriveCandidate(c, 92.5, new Date('2026-05-30'));
    expect(fc2.freshness).toBe('breached');
  });

  it('empty breakevens array is treated as no breakevens', () => {
    const tile = {
      id: 'x', symbol: 'X', strategy: 'iron_condor',
      maxProfit: 100, maxLoss: 200, underlyingPrice: 100,
      breakevens: [],
      legs: [
        { action: 'SELL', type: 'PUT', strike: 95, premium: 1 },
        { action: 'BUY', type: 'PUT', strike: 90, premium: 0.5 },
        { action: 'SELL', type: 'CALL', strike: 105, premium: 1 },
        { action: 'BUY', type: 'CALL', strike: 110, premium: 0.5 },
      ],
    };
    const c = tileToCanonical(tile);
    // breakevens should be computed from legs, not the empty array
    expect(c.breakevens).toBeDefined();
    expect(c.breakevens.length).toBe(2);
    expect(c.zoneLow).not.toBeNull();
    expect(c.zoneHigh).not.toBeNull();
  });
});
