import { describe, it, expect } from 'vitest';
import { toCanonical, tileToCanonical } from './toCanonical';
import { derivePosition } from './derivePosition';

// ═══════════════════════════════════════════════════════════════
// Fixtures — mirrors actual Firestore document shape
// ═══════════════════════════════════════════════════════════════

const ABNB_DOC = {
  id: '00a5ada792504af3a86c',
  symbol: 'ABNB',
  strategyType: 'iron_condor',
  status: 'active',
  quantity: 44,
  maxProfit: 71,       // per-contract
  maxLoss: 129,        // per-contract
  daysToExpiry: 7,
  entryDate: '2026-05-28',
  entryNetCredit: 318, // per-contract ($3.18/share × 100)
  entrySpot: 134.50,
  probability: 0.65,
  legs: [
    { legIndex: 0, type: 'CALL', action: 'SELL', strike: 138, entryPremium: 1.35, entryIv: 0.34, delta: 0.317 },
    { legIndex: 1, type: 'CALL', action: 'BUY',  strike: 140, entryPremium: 0.92, entryIv: 0.35, delta: 0.231 },
    { legIndex: 2, type: 'PUT',  action: 'SELL', strike: 126, entryPremium: 0.53, entryIv: 0.40, delta: -0.128 },
    { legIndex: 3, type: 'PUT',  action: 'BUY',  strike: 124, entryPremium: 0.38, entryIv: 0.36, delta: -0.199 },
  ],
};

const LIVE_DATA = {
  pnlPerContract: 4,
  spot: 133.31,
  dte: 7,
};

// ═══════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════

describe('toCanonical', () => {
  it('normalizes leg action/type to lowercase', () => {
    const c = toCanonical(ABNB_DOC, LIVE_DATA);
    expect(c.legs[0].action).toBe('sell');
    expect(c.legs[0].type).toBe('call');
    expect(c.legs[2].action).toBe('sell');
    expect(c.legs[2].type).toBe('put');
    expect(c.legs[1].action).toBe('buy');
    expect(c.legs[3].action).toBe('buy');
  });

  it('converts per-contract to total dollars', () => {
    const c = toCanonical(ABNB_DOC, LIVE_DATA);
    expect(c.maxProfitTotal).toBe(71 * 44);
    expect(c.maxLossTotal).toBe(129 * 44);
    expect(c.pnlTotal).toBe(4 * 44);
  });

  it('normalizes status active → open', () => {
    const c = toCanonical(ABNB_DOC, LIVE_DATA);
    expect(c.status).toBe('open');
  });

  it('maps entryPremium to entryPrice', () => {
    const c = toCanonical(ABNB_DOC, LIVE_DATA);
    expect(c.legs[0].entryPrice).toBe(1.35);
    expect(c.legs[3].entryPrice).toBe(0.38);
  });

  it('iron condor leg types: 2 calls + 2 puts', () => {
    const c = toCanonical(ABNB_DOC, LIVE_DATA);
    const calls = c.legs.filter(l => l.type === 'call');
    const puts = c.legs.filter(l => l.type === 'put');
    expect(calls).toHaveLength(2);
    expect(puts).toHaveLength(2);
  });

  it('iron condor leg actions: 2 sells + 2 buys', () => {
    const c = toCanonical(ABNB_DOC, LIVE_DATA);
    const sells = c.legs.filter(l => l.action === 'sell');
    const buys = c.legs.filter(l => l.action === 'buy');
    expect(sells).toHaveLength(2);
    expect(buys).toHaveLength(2);
  });

  it('legs P&L reconciles with derivePosition.perContract', () => {
    const c = toCanonical(ABNB_DOC, {
      ...LIVE_DATA,
      legs: ABNB_DOC.legs.map(l => ({
        ...l,
        // Simulate current prices that produce +$4/contract net
        currentPrice: l.action === 'SELL'
          ? l.entryPremium - 0.02  // sold legs: now cheaper → profit
          : l.entryPremium - 0.01, // bought legs: now cheaper → loss
      })),
    });

    const d = derivePosition(c);

    // Compute Σ leg P&L per contract the same way LegsTable does
    let legSum = 0;
    for (const leg of c.legs) {
      const sign = leg.action === 'sell' ? 1 : -1;
      legSum += sign * (leg.entryPrice - leg.currentPrice) * 100;
    }

    // Both should be close (within rounding tolerance)
    expect(Math.abs(legSum - d.perContract)).toBeLessThan(2);
  });
});

describe('tileToCanonical', () => {
  it('normalizes tile leg action/type to lowercase', () => {
    const tile = {
      id: 'tile1', symbol: 'ADBE', strategy: 'iron_condor',
      maxProfit: 224, maxLoss: 276, daysToExpiry: 28,
      underlyingPrice: 259.21,
      legs: [
        { action: 'SELL', type: 'CALL', strike: 270, premium: 1.95, delta: -0.24 },
        { action: 'BUY',  type: 'CALL', strike: 275, premium: 0.83, delta: 0.13 },
      ],
    };
    const c = tileToCanonical(tile, 10);
    expect(c.legs[0].action).toBe('sell');
    expect(c.legs[0].type).toBe('call');
    expect(c.legs[1].action).toBe('buy');
    expect(c.status).toBe('candidate');
  });

  it('normalizes probability from 0-100 to 0-1', () => {
    const tile = { id: 't1', symbol: 'QQQ', strategy: 'iron_condor', oddsOfProfit: 74, maxProfit: 100, maxLoss: 200 };
    const c = tileToCanonical(tile);
    expect(c.probability).toBe(0.74);
  });

  it('leaves probability at 0-1 scale if already normalized', () => {
    const tile = { id: 't2', symbol: 'SPY', strategy: 'iron_condor', probability: 0.65, maxProfit: 100, maxLoss: 200 };
    const c = tileToCanonical(tile);
    expect(c.probability).toBe(0.65);
  });

  it('computes breakevens from iron condor legs when not on tile', () => {
    const tile = {
      id: 't3', symbol: 'QQQ', strategy: 'iron_condor',
      maxProfit: 404, maxLoss: 597, underlyingPrice: 612,
      legs: [
        { action: 'SELL', type: 'CALL', strike: 640, premium: 2.80 },
        { action: 'BUY',  type: 'CALL', strike: 650, premium: 1.03 },
        { action: 'SELL', type: 'PUT',  strike: 590, premium: 2.10 },
        { action: 'BUY',  type: 'PUT',  strike: 580, premium: 0.83 },
      ],
    };
    const c = tileToCanonical(tile);
    expect(c.breakevens).toBeDefined();
    expect(c.breakevens).toHaveLength(2);
    // net credit = 2.80 - 1.03 + 2.10 - 0.83 = 3.04
    // lower BE = 590 - 3.04 = 586.96, upper BE = 640 + 3.04 = 643.04
    expect(c.breakevens[0]).toBeCloseTo(586.96, 1);
    expect(c.breakevens[1]).toBeCloseTo(643.04, 1);
  });
});
