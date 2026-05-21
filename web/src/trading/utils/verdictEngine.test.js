import { describe, it, expect } from 'vitest';
import { evaluate, VERDICT } from './verdictEngine';

// ═══════════════════════════════════════════════════════════════
// Test fixtures — based on real positions (QQQ, ADBE, HON)
// ═══════════════════════════════════════════════════════════════

const QQQ_IRON_CONDOR = {
  strategy: 'iron_condor',
  legs: [
    { type: 'put', action: 'sell', strike: 440, premium: 2.50, iv: 22 },
    { type: 'put', action: 'buy', strike: 430, premium: 1.20, iv: 24 },
    { type: 'call', action: 'sell', strike: 500, premium: 1.80, iv: 20 },
    { type: 'call', action: 'buy', strike: 510, premium: 0.90, iv: 21 },
  ],
  entryNetCredit: 220, // $2.20 × 100 = $220
  entryIvRank: 45,
  expiry: '2026-05-16',
};

const ADBE_BULL_PUT = {
  strategy: 'bull_put_spread',
  legs: [
    { type: 'put', action: 'sell', strike: 230, premium: 3.00, iv: 35 },
    { type: 'put', action: 'buy', strike: 220, premium: 1.50, iv: 38 },
  ],
  entryNetCredit: 150,
  entryIvRank: 55,
  expiry: '2026-05-02',
};

const HON_BEAR_CALL = {
  strategy: 'bear_call_spread',
  legs: [
    { type: 'call', action: 'sell', strike: 220, premium: 2.00, iv: 28 },
    { type: 'call', action: 'buy', strike: 230, premium: 0.80, iv: 30 },
  ],
  entryNetCredit: 120,
  entryIvRank: 40,
  expiry: '2026-05-16',
};

// ═══════════════════════════════════════════════════════════════
// Iron Condor tests
// ═══════════════════════════════════════════════════════════════

describe('Iron Condor verdict', () => {
  it('returns ON_TRACK when within parameters', () => {
    const result = evaluate(QQQ_IRON_CONDOR, {
      currentSpot: 470,
      dte: 28,
      shortDelta: 0.15,
      profitCapturePct: 30,
      isBreached: false,
      isShortTested: false,
      sessionsBreached: 0,
      lossMultiple: 0,
    });
    expect(result.state).toBe(VERDICT.ON_TRACK);
  });

  it('returns TAKE_PROFIT at ≥50% captured', () => {
    const result = evaluate(QQQ_IRON_CONDOR, {
      currentSpot: 470,
      dte: 15,
      shortDelta: 0.12,
      profitCapturePct: 55,
      isBreached: false,
      isShortTested: false,
      sessionsBreached: 0,
      lossMultiple: 0,
    });
    expect(result.state).toBe(VERDICT.TAKE_PROFIT);
    expect(result.reason).toContain('55%');
  });

  it('returns MONITOR when short delta approaches threshold', () => {
    const result = evaluate(QQQ_IRON_CONDOR, {
      currentSpot: 495,
      dte: 28,
      shortDelta: 0.28,
      profitCapturePct: 20,
      isBreached: false,
      isShortTested: false,
      sessionsBreached: 0,
      lossMultiple: 0,
    });
    expect(result.state).toBe(VERDICT.MONITOR);
  });

  it('returns ACTION_NEEDED when short delta ≥ 0.35', () => {
    const result = evaluate(QQQ_IRON_CONDOR, {
      currentSpot: 498,
      dte: 28, // > 21 DTE to avoid override stacking
      shortDelta: 0.38,
      profitCapturePct: 10,
      isBreached: false,
      isShortTested: false,
      sessionsBreached: 0,
      lossMultiple: 0,
    });
    expect(result.state).toBe(VERDICT.ACTION_NEEDED);
    expect(result.recommendedAction).toContain('Roll tested side');
  });

  it('returns EXIT when strike breached for 2 sessions', () => {
    const result = evaluate(QQQ_IRON_CONDOR, {
      currentSpot: 505,
      dte: 14,
      shortDelta: 0.65,
      profitCapturePct: -50,
      isBreached: true,
      isShortTested: true,
      sessionsBreached: 2,
      lossMultiple: 0.8,
    });
    expect(result.state).toBe(VERDICT.EXIT);
  });

  it('returns EXIT when loss ≥ 1.5× credit', () => {
    const result = evaluate(QQQ_IRON_CONDOR, {
      currentSpot: 510,
      dte: 10,
      shortDelta: 0.70,
      profitCapturePct: -150,
      isBreached: false, // Not breached — test loss multiple alone
      isShortTested: false,
      sessionsBreached: 0,
      lossMultiple: 1.6,
    });
    expect(result.state).toBe(VERDICT.EXIT);
    expect(result.reason).toContain('1.6×');
  });
});

// ═══════════════════════════════════════════════════════════════
// Bull Put Spread tests
// ═══════════════════════════════════════════════════════════════

describe('Bull Put Spread verdict', () => {
  it('returns ON_TRACK when well outside thresholds', () => {
    const result = evaluate(ADBE_BULL_PUT, {
      currentSpot: 260,
      dte: 30, // well above 21 DTE
      shortDelta: 0.10,
      profitCapturePct: 30,
      isBreached: false,
      isShortTested: false,
      sessionsBreached: 0,
      lossMultiple: 0,
    });
    expect(result.state).toBe(VERDICT.ON_TRACK);
  });

  it('escalates to ACTION_NEEDED at 14 DTE with <50% captured (21-DTE rule)', () => {
    const result = evaluate(ADBE_BULL_PUT, {
      currentSpot: 250,
      dte: 14,
      shortDelta: 0.10,
      profitCapturePct: 40,
      isBreached: false,
      isShortTested: false,
      sessionsBreached: 0,
      lossMultiple: 0,
    });
    // Per-strategy: dte <= 21 → MONITOR. 21-DTE override: <50% captured → escalate MONITOR → ACTION_NEEDED
    expect(result.state).toBe(VERDICT.ACTION_NEEDED);
    expect(result.reason).toContain('21-DTE');
  });

  it('returns TAKE_PROFIT at ≥50% captured', () => {
    const result = evaluate(ADBE_BULL_PUT, {
      currentSpot: 260,
      dte: 7,
      shortDelta: 0.05,
      profitCapturePct: 65,
      isBreached: false,
      isShortTested: false,
      sessionsBreached: 0,
      lossMultiple: 0,
    });
    expect(result.state).toBe(VERDICT.TAKE_PROFIT);
  });

  it('returns EXIT when short put breached', () => {
    const result = evaluate(ADBE_BULL_PUT, {
      currentSpot: 225,
      dte: 10,
      shortDelta: 0.60,
      profitCapturePct: -80,
      isBreached: true,
      isShortTested: true,
      sessionsBreached: 1,
      lossMultiple: 0.9,
    });
    expect(result.state).toBe(VERDICT.EXIT);
    expect(result.reason).toContain('breached');
  });

  it('returns ACTION_NEEDED when short delta ≥ 0.35', () => {
    const result = evaluate(ADBE_BULL_PUT, {
      currentSpot: 235,
      dte: 25,
      shortDelta: 0.37,
      profitCapturePct: 15,
      isBreached: false,
      isShortTested: false,
      sessionsBreached: 0,
      lossMultiple: 0,
    });
    expect(result.state).toBe(VERDICT.ACTION_NEEDED);
    expect(result.recommendedAction).toContain('Roll down');
  });
});

// ═══════════════════════════════════════════════════════════════
// Bear Call Spread tests
// ═══════════════════════════════════════════════════════════════

describe('Bear Call Spread verdict', () => {
  it('returns ON_TRACK when price below short call', () => {
    const result = evaluate(HON_BEAR_CALL, {
      currentSpot: 210,
      dte: 28,
      shortDelta: 0.18,
      profitCapturePct: 35,
      isBreached: false,
      isShortTested: false,
      sessionsBreached: 0,
      lossMultiple: 0,
    });
    expect(result.state).toBe(VERDICT.ON_TRACK);
  });

  it('returns EXIT when short call breached', () => {
    const result = evaluate(HON_BEAR_CALL, {
      currentSpot: 225,
      dte: 14,
      shortDelta: 0.70,
      profitCapturePct: -100,
      isBreached: true,
      isShortTested: true,
      sessionsBreached: 2,
      lossMultiple: 1.2,
    });
    expect(result.state).toBe(VERDICT.EXIT);
    expect(result.reason).toContain('breached');
  });

  it('returns TAKE_PROFIT at ≥50% captured', () => {
    const result = evaluate(HON_BEAR_CALL, {
      currentSpot: 205,
      dte: 21,
      shortDelta: 0.08,
      profitCapturePct: 60,
      isBreached: false,
      isShortTested: false,
      sessionsBreached: 0,
      lossMultiple: 0,
    });
    expect(result.state).toBe(VERDICT.TAKE_PROFIT);
  });
});

// ═══════════════════════════════════════════════════════════════
// Universal overrides
// ═══════════════════════════════════════════════════════════════

describe('Universal overrides', () => {
  it('21-DTE rule escalates MONITOR → ACTION_NEEDED at 18 DTE with <50% captured', () => {
    const result = evaluate(QQQ_IRON_CONDOR, {
      currentSpot: 470,
      dte: 18,
      shortDelta: 0.15,
      profitCapturePct: 30,
      isBreached: false,
      isShortTested: false,
      sessionsBreached: 0,
      lossMultiple: 0,
    });
    // Per-strategy: dte <= 21 → MONITOR. 21-DTE override: <50% captured → MONITOR → ACTION_NEEDED.
    expect(result.state).toBe(VERDICT.ACTION_NEEDED);
    expect(result.reason).toContain('21-DTE');
  });

  it('21-DTE rule does NOT escalate when ≥50% captured', () => {
    const result = evaluate(QQQ_IRON_CONDOR, {
      currentSpot: 470,
      dte: 18,
      shortDelta: 0.12,
      profitCapturePct: 55,
      isBreached: false,
      isShortTested: false,
      sessionsBreached: 0,
      lossMultiple: 0,
    });
    expect(result.state).toBe(VERDICT.TAKE_PROFIT);
  });

  it('vol regime shift sets minimum MONITOR', () => {
    const result = evaluate(
      { ...QQQ_IRON_CONDOR, entryIvRank: 20 },
      {
        currentSpot: 470,
        dte: 35,
        shortDelta: 0.12,
        profitCapturePct: 25,
        isBreached: false,
        isShortTested: false,
        sessionsBreached: 0,
        lossMultiple: 0,
        currentIvRank: 60, // +40 points from entry 20
      },
    );
    expect(result.state).toBe(VERDICT.MONITOR);
    expect(result.reason).toContain('Vol regime shift');
  });

  it('earnings proximity escalates one level', () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 5);
    const earningsDate = tomorrow.toISOString().split('T')[0];

    const result = evaluate(
      { ...ADBE_BULL_PUT, earningsAtEntry: false },
      {
        currentSpot: 260,
        dte: 30, // above 21 DTE to isolate earnings override
        shortDelta: 0.10,
        profitCapturePct: 30,
        isBreached: false,
        isShortTested: false,
        sessionsBreached: 0,
        lossMultiple: 0,
        nextEarningsDate: earningsDate,
      },
    );
    // Base: ON_TRACK. Earnings escalates → MONITOR.
    expect(result.state).toBe(VERDICT.MONITOR);
    expect(result.reason).toContain('Earnings');
  });
});

// ═══════════════════════════════════════════════════════════════
// Calendar Spread tests
// ═══════════════════════════════════════════════════════════════

describe('Calendar Spread verdict', () => {
  const CALENDAR = {
    strategy: 'calendar_spread',
    legs: [
      { type: 'call', action: 'sell', strike: 180, premium: 2.00 },
      { type: 'call', action: 'buy', strike: 180, premium: 5.00 },
    ],
    entryNetCredit: -300,
    entryIvRank: 35,
    expiry: '2026-05-02',
  };

  it('returns ON_TRACK when price near short strike', () => {
    const result = evaluate(CALENDAR, {
      currentSpot: 180,
      dte: 14,
      shortDelta: 0.50,
      profitCapturePct: 10,
      priceDistSD: 0.3,
      ivCrush: false,
    });
    expect(result.state).toBe(VERDICT.ON_TRACK);
  });

  it('returns TAKE_PROFIT at ≥25% of debit captured', () => {
    const result = evaluate(CALENDAR, {
      currentSpot: 180,
      dte: 7,
      shortDelta: 0.50,
      profitCapturePct: 30,
      priceDistSD: 0.2,
      ivCrush: false,
    });
    expect(result.state).toBe(VERDICT.TAKE_PROFIT);
  });

  it('returns EXIT on IV crush', () => {
    const result = evaluate(CALENDAR, {
      currentSpot: 178,
      dte: 10,
      shortDelta: 0.48,
      profitCapturePct: -20,
      priceDistSD: 0.5,
      ivCrush: true,
    });
    expect(result.state).toBe(VERDICT.EXIT);
    expect(result.reason).toContain('IV crush');
  });
});

// ═══════════════════════════════════════════════════════════════
// Double Diagonal tests
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// Iron Butterfly tests
// ═══════════════════════════════════════════════════════════════

describe('Iron Butterfly verdict', () => {
  const IRON_FLY = {
    strategy: 'iron_butterfly',
    legs: [
      { type: 'put', action: 'sell', strike: 470, premium: 8.00, iv: 22 },
      { type: 'put', action: 'buy', strike: 450, premium: 3.00, iv: 25 },
      { type: 'call', action: 'sell', strike: 470, premium: 7.50, iv: 21 },
      { type: 'call', action: 'buy', strike: 490, premium: 2.50, iv: 23 },
    ],
    entryNetCredit: 1000,
    entryIvRank: 50,
    expiry: '2026-05-16',
  };

  it('returns ON_TRACK when within parameters', () => {
    const result = evaluate(IRON_FLY, {
      currentSpot: 470,
      dte: 28,
      shortDelta: 0.18,
      profitCapturePct: 10,
      isBreached: false,
      isShortTested: false,
      sessionsBreached: 0,
      lossMultiple: 0,
    });
    expect(result.state).toBe(VERDICT.ON_TRACK);
  });

  it('returns TAKE_PROFIT at ≥25% captured (lower than condor)', () => {
    const result = evaluate(IRON_FLY, {
      currentSpot: 470,
      dte: 28, // above 21 DTE to avoid override stacking
      shortDelta: 0.15,
      profitCapturePct: 28,
      isBreached: false,
      isShortTested: false,
      sessionsBreached: 0,
      lossMultiple: 0,
    });
    expect(result.state).toBe(VERDICT.TAKE_PROFIT);
    expect(result.reason).toContain('28%');
  });

  it('returns EXIT when breached or loss ≥ 1× credit', () => {
    const result = evaluate(IRON_FLY, {
      currentSpot: 495,
      dte: 10,
      shortDelta: 0.80,
      profitCapturePct: -100,
      isBreached: true,
      isShortTested: true,
      sessionsBreached: 2,
      lossMultiple: 1.1,
    });
    expect(result.state).toBe(VERDICT.EXIT);
    expect(result.recommendedAction).toContain('adjustments rarely pay');
  });
});

// ═══════════════════════════════════════════════════════════════
// BWB Put tests
// ═══════════════════════════════════════════════════════════════

describe('BWB Put verdict', () => {
  const BWB_PUT = {
    strategy: 'bwb_put',
    legs: [
      { type: 'put', action: 'buy', strike: 440, premium: 5.00, iv: 24 },
      { type: 'put', action: 'sell', strike: 460, premium: 8.00, iv: 22 },
      { type: 'put', action: 'sell', strike: 460, premium: 8.00, iv: 22 },
      { type: 'put', action: 'buy', strike: 470, premium: 10.00, iv: 21 },
    ],
    entryNetCredit: 100,
    entryIvRank: 45,
    expiry: '2026-05-16',
  };

  it('returns ON_TRACK when price above short strikes and outside 1 SD', () => {
    const result = evaluate(BWB_PUT, {
      currentSpot: 480,
      dte: 28,
      shortDelta: 0.15,
      profitCapturePct: 15,
      priceDistSD: 1.5, // > 1 SD to avoid MONITOR trigger
      priceAtBrokenWing: false,
      priceBeyondBrokenWing: false,
      debitToCreditFlip: false,
    });
    expect(result.state).toBe(VERDICT.ON_TRACK);
  });

  it('returns TAKE_PROFIT at ≥25% captured', () => {
    const result = evaluate(BWB_PUT, {
      currentSpot: 462,
      dte: 14,
      shortDelta: 0.45,
      profitCapturePct: 30,
      priceDistSD: 0.3,
      priceAtBrokenWing: false,
      priceBeyondBrokenWing: false,
      debitToCreditFlip: false,
    });
    expect(result.state).toBe(VERDICT.TAKE_PROFIT);
  });

  it('returns EXIT when price beyond broken wing', () => {
    const result = evaluate(BWB_PUT, {
      currentSpot: 435,
      dte: 7,
      shortDelta: 0.90,
      profitCapturePct: -80,
      priceDistSD: 2.5,
      priceAtBrokenWing: false,
      priceBeyondBrokenWing: true,
      debitToCreditFlip: false,
    });
    expect(result.state).toBe(VERDICT.EXIT);
    expect(result.reason).toContain('beyond broken wing');
  });
});

// ═══════════════════════════════════════════════════════════════
// BWB Call tests
// ═══════════════════════════════════════════════════════════════

describe('BWB Call verdict', () => {
  const BWB_CALL = {
    strategy: 'bwb_call',
    legs: [
      { type: 'call', action: 'buy', strike: 480, premium: 10.00, iv: 21 },
      { type: 'call', action: 'sell', strike: 490, premium: 8.00, iv: 20 },
      { type: 'call', action: 'sell', strike: 490, premium: 8.00, iv: 20 },
      { type: 'call', action: 'buy', strike: 510, premium: 4.00, iv: 22 },
    ],
    entryNetCredit: 200,
    entryIvRank: 40,
    expiry: '2026-05-16',
  };

  it('returns ON_TRACK when price below short strikes and outside 1 SD', () => {
    const result = evaluate(BWB_CALL, {
      currentSpot: 475,
      dte: 28,
      shortDelta: 0.20,
      profitCapturePct: 10,
      priceDistSD: 1.5, // > 1 SD to avoid MONITOR trigger
      priceAtBrokenWing: false,
      priceBeyondBrokenWing: false,
      debitToCreditFlip: false,
    });
    expect(result.state).toBe(VERDICT.ON_TRACK);
  });

  it('returns TAKE_PROFIT on debit-to-credit flip', () => {
    const result = evaluate(BWB_CALL, {
      currentSpot: 490,
      dte: 14,
      shortDelta: 0.50,
      profitCapturePct: 20,
      priceDistSD: 0.1,
      priceAtBrokenWing: false,
      priceBeyondBrokenWing: false,
      debitToCreditFlip: true,
    });
    expect(result.state).toBe(VERDICT.TAKE_PROFIT);
    expect(result.reason).toContain('credit flip');
  });

  it('returns ACTION_NEEDED when price at broken wing', () => {
    const result = evaluate(BWB_CALL, {
      currentSpot: 508,
      dte: 10,
      shortDelta: 0.75,
      profitCapturePct: -40,
      priceDistSD: 1.5,
      priceAtBrokenWing: true,
      priceBeyondBrokenWing: false,
      debitToCreditFlip: false,
    });
    expect(result.state).toBe(VERDICT.ACTION_NEEDED);
    expect(result.reason).toContain('broken wing');
  });
});

// ═══════════════════════════════════════════════════════════════
// Double Diagonal tests
// ═══════════════════════════════════════════════════════════════

describe('Double Diagonal verdict', () => {
  const DD = {
    strategy: 'double_diagonal',
    legs: [
      { type: 'put', action: 'sell', strike: 160, premium: 1.50 },
      { type: 'put', action: 'buy', strike: 155, premium: 3.00 },
      { type: 'call', action: 'sell', strike: 190, premium: 1.20 },
      { type: 'call', action: 'buy', strike: 195, premium: 2.50 },
    ],
    entryNetCredit: -280,
    entryIvRank: 42,
    expiry: '2026-05-16',
  };

  it('returns ON_TRACK when within range', () => {
    const result = evaluate(DD, {
      currentSpot: 175,
      dte: 28,
      shortDelta: 0.20,
      profitCapturePct: 5,
      priceAtNearWing: false,
      priceBeyondNearWing: false,
      vegaFlip: false,
      deepItm: false,
    });
    expect(result.state).toBe(VERDICT.ON_TRACK);
  });

  it('returns TAKE_PROFIT at ≥20% of debit', () => {
    const result = evaluate(DD, {
      currentSpot: 175,
      dte: 14,
      shortDelta: 0.25,
      profitCapturePct: 22,
      priceAtNearWing: false,
      priceBeyondNearWing: false,
      vegaFlip: false,
      deepItm: false,
    });
    expect(result.state).toBe(VERDICT.TAKE_PROFIT);
  });

  it('returns EXIT when deep ITM', () => {
    const result = evaluate(DD, {
      currentSpot: 145,
      dte: 7,
      shortDelta: 0.85,
      profitCapturePct: -80,
      priceAtNearWing: false,
      priceBeyondNearWing: true,
      vegaFlip: false,
      deepItm: true,
    });
    expect(result.state).toBe(VERDICT.EXIT);
  });
});
