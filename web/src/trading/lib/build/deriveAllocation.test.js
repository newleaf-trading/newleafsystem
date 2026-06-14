import { describe, it, expect } from 'vitest';
import { deriveAllocation, buildExecutionBatch, autoAllocateEqual } from './deriveAllocation';

// ═══════════════════════════════════════════════════════════════
// Fixtures (from mock 06)
// ═══════════════════════════════════════════════════════════════

const BUDGET = 23100;

const HELD = [
  { id: 'abnb', symbol: 'ABNB', strategy: 'iron_condor', committedRisk: 5676, qty: 44, pnlTotal: 176, closing: false },
  { id: 'bidu', symbol: 'BIDU', strategy: 'iron_condor', committedRisk: 5616, qty: 13, pnlTotal: -611, closing: false },
  { id: 'amzn', symbol: 'AMZN', strategy: 'iron_condor', committedRisk: 5496, qty: 4, pnlTotal: 196, closing: false },
];

const CANDIDATES = [
  { id: 'baba', symbol: 'BABA', strategy: 'iron_condor', riskPerContract: 593, qty: 5, removed: false },
  { id: 'adbe', symbol: 'ADBE', strategy: 'iron_condor', riskPerContract: 276, qty: 11, removed: false },
];

// ═══════════════════════════════════════════════════════════════
// deriveAllocation
// ═══════════════════════════════════════════════════════════════

describe('deriveAllocation', () => {
  it('committed excludes closing positions', () => {
    const held = HELD.map((h, i) => ({ ...h, closing: i === 0 })); // ABNB closing
    const r = deriveAllocation({ riskBudget: BUDGET, held, candidates: CANDIDATES });

    // ABNB (5676) is closing, so committed = BIDU (5616) + AMZN (5496) = 11112
    expect(r.committed).toBe(11112);
  });

  it('closing raises available by committedRisk', () => {
    const base = deriveAllocation({ riskBudget: BUDGET, held: HELD, candidates: CANDIDATES });
    const withClose = deriveAllocation({
      riskBudget: BUDGET,
      held: HELD.map((h, i) => ({ ...h, closing: i === 0 })),
      candidates: CANDIDATES,
    });

    // Closing ABNB frees 5676
    expect(withClose.available - base.available).toBe(5676);
  });

  it('realizedFromCloses sums closing pnlTotal', () => {
    const held = [
      { ...HELD[0], closing: true },  // ABNB: pnl +176
      { ...HELD[1], closing: true },  // BIDU: pnl -611
      HELD[2],                         // AMZN: not closing
    ];
    const r = deriveAllocation({ riskBudget: BUDGET, held, candidates: [] });
    expect(r.realizedFromCloses).toBe(176 + -611); // = -435
  });

  it('removing a candidate drops it from allocating and openCount', () => {
    const base = deriveAllocation({ riskBudget: BUDGET, held: HELD, candidates: CANDIDATES });
    const withRemove = deriveAllocation({
      riskBudget: BUDGET, held: HELD,
      candidates: CANDIDATES.map((c, i) => ({ ...c, removed: i === 0 })), // BABA removed
    });

    // BABA was 593 * 5 = 2965
    expect(base.allocating - withRemove.allocating).toBe(2965);
    expect(base.openCount - withRemove.openCount).toBe(1);
  });

  it('over-allocation yields positive overBudget', () => {
    const bigCandidates = [
      { id: 'big', symbol: 'BIG', strategy: 'x', riskPerContract: 10000, qty: 2, removed: false },
    ];
    const r = deriveAllocation({ riskBudget: BUDGET, held: HELD, candidates: bigCandidates });

    // Available = 23100 - 16788 = 6312. Allocating = 20000. Over = 13688
    expect(r.overBudget).toBeGreaterThan(0);
    expect(r.unallocated).toBeLessThan(0);
  });

  it('never produces NaN with zero budget', () => {
    const r = deriveAllocation({ riskBudget: 0, held: [], candidates: [] });
    expect(isFinite(r.committed)).toBe(true);
    expect(isFinite(r.available)).toBe(true);
    expect(isFinite(r.unallocated)).toBe(true);
    expect(r.bar.committed).toBe(0);
  });

  it('bar segments sum to ~100% when fully allocated', () => {
    const r = deriveAllocation({ riskBudget: BUDGET, held: HELD, candidates: CANDIDATES });
    const total = r.bar.committed + r.bar.allocating + r.bar.unallocated;
    expect(total).toBeCloseTo(100, 0);
  });

  it('held rows get pctOfBudget', () => {
    const r = deriveAllocation({ riskBudget: BUDGET, held: HELD, candidates: [] });
    // ABNB: 5676 / 23100 * 100 ≈ 24.6%
    expect(r.rows.held[0].pctOfBudget).toBeCloseTo(24.6, 0);
  });

  it('candidate rows get pctOfAvailable', () => {
    const r = deriveAllocation({ riskBudget: BUDGET, held: HELD, candidates: CANDIDATES });
    // Available = 6312. BABA: 593*5=2965 → 2965/6312*100 ≈ 47%
    expect(r.rows.candidates[0].pctOfAvailable).toBeCloseTo(47, 0);
  });
});

// ═══════════════════════════════════════════════════════════════
// buildExecutionBatch
// ═══════════════════════════════════════════════════════════════

describe('buildExecutionBatch', () => {
  it('produces close orders for closing held + open orders for active candidates', () => {
    const held = [{ ...HELD[0], closing: true }, HELD[1], HELD[2]];
    const batch = buildExecutionBatch({ held, candidates: CANDIDATES });

    const closes = batch.filter(o => o.action === 'close');
    const opens = batch.filter(o => o.action === 'open');

    expect(closes).toHaveLength(1);
    expect(closes[0].symbol).toBe('ABNB');
    expect(closes[0].qty).toBe(44);
    expect(closes[0].realizedPnl).toBe(176);

    expect(opens).toHaveLength(2);
    expect(opens[0].symbol).toBe('BABA');
    expect(opens[1].symbol).toBe('ADBE');
  });

  it('excludes removed candidates', () => {
    const cands = [{ ...CANDIDATES[0], removed: true }, CANDIDATES[1]];
    const batch = buildExecutionBatch({ held: HELD, candidates: cands });
    const opens = batch.filter(o => o.action === 'open');
    expect(opens).toHaveLength(1);
    expect(opens[0].symbol).toBe('ADBE');
  });

  it('excludes candidates with qty=0', () => {
    const cands = [{ ...CANDIDATES[0], qty: 0 }, CANDIDATES[1]];
    const batch = buildExecutionBatch({ held: HELD, candidates: cands });
    const opens = batch.filter(o => o.action === 'open');
    expect(opens).toHaveLength(1);
  });

  it('closes come before opens in the batch', () => {
    const held = [{ ...HELD[0], closing: true }];
    const batch = buildExecutionBatch({ held, candidates: CANDIDATES });
    expect(batch[0].action).toBe('close');
    expect(batch[1].action).toBe('open');
  });

  it('uses closeQty when provided (partial close ready)', () => {
    const held = [{ ...HELD[0], closing: true, closeQty: 10 }];
    const batch = buildExecutionBatch({ held, candidates: [] });
    expect(batch[0].qty).toBe(10);
  });
});

// ═══════════════════════════════════════════════════════════════
// autoAllocateEqual
// ═══════════════════════════════════════════════════════════════

describe('autoAllocateEqual', () => {
  it('splits available equally across active candidates', () => {
    const available = 6312;
    const result = autoAllocateEqual(available, CANDIDATES);
    // BABA: floor(3156 / 593) = 5, ADBE: floor(3156 / 276) = 11
    expect(result['baba']).toBe(5);
    expect(result['adbe']).toBe(11);
  });

  it('excludes removed candidates from the split', () => {
    const cands = [{ ...CANDIDATES[0], removed: true }, CANDIDATES[1]];
    const result = autoAllocateEqual(6312, cands);
    // Only ADBE gets the full 6312: floor(6312 / 276) = 22
    expect(result['baba']).toBeUndefined();
    expect(result['adbe']).toBe(22);
  });

  it('never touches held rows (returns empty for empty candidates)', () => {
    const result = autoAllocateEqual(6312, []);
    expect(Object.keys(result)).toHaveLength(0);
  });

  it('returns 0 qty when riskPerContract is 0', () => {
    const cands = [{ id: 'x', symbol: 'X', strategy: 'y', riskPerContract: 0, qty: 1, removed: false }];
    const result = autoAllocateEqual(6312, cands);
    expect(result['x']).toBe(0);
  });
});
