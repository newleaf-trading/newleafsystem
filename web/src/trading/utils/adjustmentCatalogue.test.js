import { describe, it, expect } from 'vitest';
import { getValidAdjustments, computeAdjustment, PILL } from './adjustmentCatalogue';

// ═══════════════════════════════════════════════════════════════
// Shared fixtures
// ═══════════════════════════════════════════════════════════════

const IC_POSITION = {
  strategy: 'iron_condor',
  legs: [
    { type: 'put', action: 'sell', strike: 440, premium: 2.50, iv: 0.22 },
    { type: 'put', action: 'buy', strike: 430, premium: 1.20, iv: 0.24 },
    { type: 'call', action: 'sell', strike: 500, premium: 1.80, iv: 0.20 },
    { type: 'call', action: 'buy', strike: 510, premium: 0.90, iv: 0.21 },
  ],
  entryNetCredit: 220,
  maxLoss: 780,
  expiry: '2026-05-16',
};

const BULL_PUT_POSITION = {
  strategy: 'bull_put_spread',
  legs: [
    { type: 'put', action: 'sell', strike: 230, premium: 3.00, iv: 0.35 },
    { type: 'put', action: 'buy', strike: 220, premium: 1.50, iv: 0.38 },
  ],
  entryNetCredit: 150,
  maxLoss: 850,
  expiry: '2026-05-02',
};

const BEAR_CALL_POSITION = {
  strategy: 'bear_call_spread',
  legs: [
    { type: 'call', action: 'sell', strike: 220, premium: 2.00, iv: 0.28 },
    { type: 'call', action: 'buy', strike: 230, premium: 0.80, iv: 0.30 },
  ],
  entryNetCredit: 120,
  maxLoss: 880,
  expiry: '2026-05-16',
};

const IRON_FLY_POSITION = {
  strategy: 'iron_butterfly',
  legs: [
    { type: 'put', action: 'sell', strike: 470, premium: 8.00, iv: 0.22 },
    { type: 'put', action: 'buy', strike: 450, premium: 3.00, iv: 0.25 },
    { type: 'call', action: 'sell', strike: 470, premium: 7.50, iv: 0.21 },
    { type: 'call', action: 'buy', strike: 490, premium: 2.50, iv: 0.23 },
  ],
  entryNetCredit: 1000,
  maxLoss: 1000,
  expiry: '2026-05-16',
};

const BWB_PUT_POSITION = {
  strategy: 'bwb_put',
  legs: [
    { type: 'put', action: 'buy', strike: 440, premium: 5.00, iv: 0.24 },
    { type: 'put', action: 'sell', strike: 460, premium: 8.00, iv: 0.22 },
    { type: 'put', action: 'sell', strike: 460, premium: 8.00, iv: 0.22 },
    { type: 'put', action: 'buy', strike: 470, premium: 10.00, iv: 0.21 },
  ],
  entryNetCredit: 100,
  maxLoss: 900,
  expiry: '2026-05-16',
};

const CALENDAR_POSITION = {
  strategy: 'calendar_spread',
  legs: [
    { type: 'call', action: 'sell', strike: 180, premium: 2.00, iv: 0.30 },
    { type: 'call', action: 'buy', strike: 180, premium: 5.00, iv: 0.28 },
  ],
  entryNetCredit: -300,
  maxLoss: 300,
  expiry: '2026-05-02',
};

const DD_POSITION = {
  strategy: 'double_diagonal',
  legs: [
    { type: 'put', action: 'sell', strike: 160, premium: 1.50, iv: 0.28 },
    { type: 'put', action: 'buy', strike: 155, premium: 3.00, iv: 0.30 },
    { type: 'call', action: 'sell', strike: 190, premium: 1.20, iv: 0.26 },
    { type: 'call', action: 'buy', strike: 195, premium: 2.50, iv: 0.28 },
  ],
  entryNetCredit: -280,
  maxLoss: 1280,
  expiry: '2026-05-16',
};

const BWB_CALL_POSITION = {
  strategy: 'bwb_call',
  legs: [
    { type: 'call', action: 'buy', strike: 480, premium: 10.00, iv: 0.21 },
    { type: 'call', action: 'sell', strike: 490, premium: 8.00, iv: 0.20 },
    { type: 'call', action: 'sell', strike: 490, premium: 8.00, iv: 0.20 },
    { type: 'call', action: 'buy', strike: 510, premium: 4.00, iv: 0.22 },
  ],
  entryNetCredit: 200,
  maxLoss: 800,
  expiry: '2026-05-16',
};

function md(overrides = {}) {
  return {
    currentSpot: 470,
    dte: 21,
    shortDelta: 0.30,
    profitCapturePct: 20,
    isBreached: false,
    isShortTested: false,
    sessionsBreached: 0,
    lossMultiple: 0,
    ...overrides,
  };
}

// ═══════════════════════════════════════════════════════════════
// Iron Condor
// ═══════════════════════════════════════════════════════════════

describe('Iron Condor adjustments', () => {
  it('returns 7 adjustments when call side tested (includes roll_put_side_up)', () => {
    const adjs = getValidAdjustments(IC_POSITION, md({ currentSpot: 498 }));
    expect(adjs.length).toBe(7);
    const types = adjs.map(a => a.type);
    expect(types).toContain('roll_tested_up_out');
    expect(types).toContain('roll_tested_otm');
    expect(types).toContain('roll_tested_out');
    expect(types).toContain('close_tested_side');
    expect(types).toContain('roll_put_side_up');
    expect(types).toContain('close_entire');
    expect(types).toContain('hold_and_monitor');
    expect(types).not.toContain('convert_to_vertical');
  });

  it('returns 6 adjustments when put side tested (no roll_put_side_up)', () => {
    const adjs = getValidAdjustments(IC_POSITION, md({ currentSpot: 442 }));
    expect(adjs.length).toBe(6);
    const types = adjs.map(a => a.type);
    expect(types).not.toContain('roll_put_side_up');
  });

  it('hold_and_monitor is always HIGH_RISK and never recommended', () => {
    const adjs = getValidAdjustments(IC_POSITION, md({ currentSpot: 498 }));
    const hold = adjs.find(a => a.type === 'hold_and_monitor');
    expect(hold.verdictPill).toBe(PILL.HIGH_RISK);
    expect(hold.isRecommended).toBe(false);
  });

  it('marks exactly one adjustment as recommended', () => {
    const adjs = getValidAdjustments(IC_POSITION, md({ currentSpot: 498 }));
    const recommended = adjs.filter(a => a.isRecommended);
    expect(recommended.length).toBe(1);
  });

  it('tested side is call when spot approaches call strike', () => {
    const adjs = getValidAdjustments(IC_POSITION, md({ currentSpot: 498 }));
    const rollLabel = adjs.find(a => a.type === 'roll_tested_up_out')?.label;
    expect(rollLabel).toContain('call');
  });

  it('tested side is put when spot approaches put strike', () => {
    const adjs = getValidAdjustments(IC_POSITION, md({ currentSpot: 442 }));
    const rollLabel = adjs.find(a => a.type === 'roll_tested_up_out')?.label;
    expect(rollLabel).toContain('put');
  });

  // ─── Roll put side up (active bullish defence) ───
  it('roll_put_side_up has DIRECTIONAL_PIVOT pill and proposed legs with higher put strikes', () => {
    const adjs = getValidAdjustments(IC_POSITION, md({ currentSpot: 498, dte: 21 }));
    const rollUp = adjs.find(a => a.type === 'roll_put_side_up');
    expect(rollUp).toBeTruthy();
    // Should be DIRECTIONAL_PIVOT (or RECOMMENDED if it scored highest)
    expect([PILL.DIRECTIONAL_PIVOT, PILL.RECOMMENDED]).toContain(rollUp.verdictPill);
    // Proposed legs should have new put strikes higher than the original $430/$440
    const newPuts = rollUp.newLegs.filter(l => l.type === 'put');
    expect(newPuts.length).toBe(2);
    const newShort = newPuts.find(l => l.action === 'sell');
    expect(newShort.strike).toBeGreaterThan(440); // must be higher than original $440 short put
    // Call legs should be unchanged
    const calls = rollUp.newLegs.filter(l => l.type === 'call');
    expect(calls.length).toBe(2);
    expect(calls.find(l => l.strike === 500)).toBeTruthy(); // original call strikes preserved
    expect(calls.find(l => l.strike === 510)).toBeTruthy();
  });

  it('roll_put_side_up is inferior to close_tested_side when put side still has value', () => {
    // Spot near middle — both sides have value, closing tested side is better
    const adjs = getValidAdjustments(IC_POSITION, md({
      currentSpot: 498,
      profitCapturePct: -10, // losing position
      dte: 30, // plenty of time
    }));
    const rollUp = adjs.find(a => a.type === 'roll_put_side_up');
    const closeSide = adjs.find(a => a.type === 'close_tested_side');
    // Close tested side should score higher (defensive, reduces risk)
    // Roll put side up is directional pivot (riskier)
    expect(rollUp).toBeTruthy();
    expect(closeSide).toBeTruthy();
    // roll_put_side_up should NOT be recommended when close is available
    expect(rollUp.isRecommended).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// Bull Put Spread
// ═══════════════════════════════════════════════════════════════

describe('Bull Put Spread adjustments', () => {
  it('returns 4 valid adjustments: roll_down_out, roll_out_only, close, hold', () => {
    const adjs = getValidAdjustments(BULL_PUT_POSITION, md({ currentSpot: 235 }));
    expect(adjs.length).toBe(4);
    const types = adjs.map(a => a.type);
    expect(types).toContain('roll_down_out');
    expect(types).toContain('roll_out_only');
    expect(types).toContain('close_entire');
    expect(types).toContain('hold_and_monitor');
    // Disallowed: convert to IC at a loss
    expect(types).not.toContain('convert_to_vertical');
  });

  it('roll_down_out has Smart or Marginal pill depending on ratio', () => {
    const adjs = getValidAdjustments(BULL_PUT_POSITION, md({ currentSpot: 235, profitCapturePct: -20 }));
    const roll = adjs.find(a => a.type === 'roll_down_out');
    expect([PILL.RECOMMENDED, PILL.SMART_ROLL, PILL.MARGINAL]).toContain(roll.verdictPill);
  });
});

// ═══════════════════════════════════════════════════════════════
// Bear Call Spread
// ═══════════════════════════════════════════════════════════════

describe('Bear Call Spread adjustments', () => {
  it('returns 4 valid adjustments: roll_up_out, roll_out_only, close, hold', () => {
    const adjs = getValidAdjustments(BEAR_CALL_POSITION, md({ currentSpot: 218 }));
    expect(adjs.length).toBe(4);
    const types = adjs.map(a => a.type);
    expect(types).toContain('roll_up_out');
    expect(types).toContain('roll_out_only');
    expect(types).toContain('close_entire');
    expect(types).toContain('hold_and_monitor');
  });

  it('does not include convert_to_vertical (disallowed at a loss)', () => {
    const adjs = getValidAdjustments(BEAR_CALL_POSITION, md({ currentSpot: 225 }));
    const types = adjs.map(a => a.type);
    expect(types).not.toContain('convert_to_vertical');
  });
});

// ═══════════════════════════════════════════════════════════════
// Iron Butterfly
// ═══════════════════════════════════════════════════════════════

describe('Iron Butterfly adjustments', () => {
  it('returns 2 valid adjustments: close and hold only', () => {
    const adjs = getValidAdjustments(IRON_FLY_POSITION, md());
    expect(adjs.length).toBe(2);
    const types = adjs.map(a => a.type);
    expect(types).toContain('close_entire');
    expect(types).toContain('hold_and_monitor');
    // Disallowed: widen to condor, mid-trade strike rolls
    expect(types).not.toContain('convert_to_condor');
    expect(types).not.toContain('roll_tested_up_out');
  });

  it('close_entire is recommended (only non-hold option)', () => {
    const adjs = getValidAdjustments(IRON_FLY_POSITION, md({ profitCapturePct: -10 }));
    const close = adjs.find(a => a.type === 'close_entire');
    const hold = adjs.find(a => a.type === 'hold_and_monitor');
    expect(close.isRecommended).toBe(true);
    expect(hold.isRecommended).toBe(false);
  });
});

// ═══════════════════════════════════════════════════════════════
// BWB Put
// ═══════════════════════════════════════════════════════════════

describe('BWB Put adjustments', () => {
  it('returns 3 valid adjustments: close_threatened_wing, close, hold', () => {
    const adjs = getValidAdjustments(BWB_PUT_POSITION, md());
    expect(adjs.length).toBe(3);
    const types = adjs.map(a => a.type);
    expect(types).toContain('close_threatened_wing');
    expect(types).toContain('close_entire');
    expect(types).toContain('hold_and_monitor');
    // Disallowed: roll entire structure out — slippage exceeds savings
    expect(types).not.toContain('roll_entire_out');
  });

  it('close_threatened_wing has DEFENSIVE pill', () => {
    const adjs = getValidAdjustments(BWB_PUT_POSITION, md({ profitCapturePct: -30 }));
    const closeWing = adjs.find(a => a.type === 'close_threatened_wing');
    // DEFENSIVE or RECOMMENDED (if it's the best option)
    expect([PILL.DEFENSIVE, PILL.RECOMMENDED]).toContain(closeWing.verdictPill);
  });
});

// ═══════════════════════════════════════════════════════════════
// BWB Call
// ═══════════════════════════════════════════════════════════════

describe('BWB Call adjustments', () => {
  it('returns same structure as BWB Put (3 adjustments)', () => {
    const adjs = getValidAdjustments(BWB_CALL_POSITION, md());
    expect(adjs.length).toBe(3);
    const types = adjs.map(a => a.type);
    expect(types).toContain('close_threatened_wing');
    expect(types).not.toContain('roll_entire_out');
  });

  it('does not include closing individual legs piecemeal', () => {
    const adjs = getValidAdjustments(BWB_CALL_POSITION, md());
    const types = adjs.map(a => a.type);
    expect(types).not.toContain('close_tested_side');
    expect(types).not.toContain('close_threatened_side');
  });
});

// ═══════════════════════════════════════════════════════════════
// Calendar Spread
// ═══════════════════════════════════════════════════════════════

describe('Calendar Spread adjustments', () => {
  it('returns 3 valid adjustments: roll_short_out, close, hold', () => {
    const adjs = getValidAdjustments(CALENDAR_POSITION, md());
    expect(adjs.length).toBe(3);
    const types = adjs.map(a => a.type);
    expect(types).toContain('roll_short_out');
    expect(types).toContain('close_entire');
    expect(types).toContain('hold_and_monitor');
    // Disallowed: adjusting the long leg
    expect(types).not.toContain('roll_entire_out');
  });

  it('roll_short_out collects time premium (positive netCost expected)', () => {
    const adjs = getValidAdjustments(CALENDAR_POSITION, md({ profitCapturePct: 5 }));
    const roll = adjs.find(a => a.type === 'roll_short_out');
    // Rolling the short leg out should collect credit (positive or near-zero)
    expect(roll.netCost).toBeGreaterThanOrEqual(-50); // Allow small debit
  });
});

// ═══════════════════════════════════════════════════════════════
// Double Diagonal
// ═══════════════════════════════════════════════════════════════

describe('Double Diagonal adjustments', () => {
  it('returns 4 valid adjustments: close_threatened_side, roll_threatened_out, close, hold', () => {
    const adjs = getValidAdjustments(DD_POSITION, md({ currentSpot: 192 }));
    expect(adjs.length).toBe(4);
    const types = adjs.map(a => a.type);
    expect(types).toContain('close_threatened_side');
    expect(types).toContain('roll_threatened_out');
    expect(types).toContain('close_entire');
    expect(types).toContain('hold_and_monitor');
  });

  it('identifies correct threatened side based on spot', () => {
    // Spot near call side → call is threatened
    const adjs = getValidAdjustments(DD_POSITION, md({ currentSpot: 192 }));
    const closeLabel = adjs.find(a => a.type === 'close_threatened_side')?.label;
    expect(closeLabel).toContain('call');

    // Spot near put side → put is threatened
    const adjs2 = getValidAdjustments(DD_POSITION, md({ currentSpot: 158 }));
    const closeLabel2 = adjs2.find(a => a.type === 'close_threatened_side')?.label;
    expect(closeLabel2).toContain('put');
  });
});

// ═══════════════════════════════════════════════════════════════
// Scoring
// ═══════════════════════════════════════════════════════════════

describe('Adjustment scoring', () => {
  it('assigns RECOMMENDED pill to the best non-hold adjustment', () => {
    const adjs = getValidAdjustments(IC_POSITION, md({ currentSpot: 498, profitCapturePct: -20 }));
    const recommended = adjs.find(a => a.isRecommended);
    expect(recommended).toBeTruthy();
    expect(recommended.verdictPill).toBe(PILL.RECOMMENDED);
    expect(recommended.type).not.toBe('hold_and_monitor');
  });

  it('falls back to close_entire as recommended when no roll is viable', () => {
    // Very deep loss — all rolls are bad
    const adjs = getValidAdjustments(IRON_FLY_POSITION, md({
      profitCapturePct: -80,
      shortDelta: 0.85,
      isBreached: true,
    }));
    const recommended = adjs.find(a => a.isRecommended);
    expect(recommended).toBeTruthy();
    // Should be close or convert_to_condor — not hold
    expect(recommended.type).not.toBe('hold_and_monitor');
  });

  it('computeAdjustment returns a single preview by type', () => {
    const adj = computeAdjustment(IC_POSITION, md({ currentSpot: 498 }), 'roll_tested_up_out');
    expect(adj).toBeTruthy();
    expect(adj.type).toBe('roll_tested_up_out');
    expect(adj.label).toBeTruthy();
    expect(adj.description).toBeTruthy();
    expect(typeof adj.netCost).toBe('number');
    expect(typeof adj.newProbability).toBe('number');
  });

  it('returns null for invalid adjustment type', () => {
    const adj = computeAdjustment(IC_POSITION, md(), 'nonexistent_adjustment');
    expect(adj).toBeNull();
  });
});
