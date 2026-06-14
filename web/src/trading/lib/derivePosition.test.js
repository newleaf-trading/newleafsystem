import { describe, it, expect } from 'vitest';
import { derivePosition, recommendation, REVIEW } from './derivePosition';

// ═══════════════════════════════════════════════════════════════
// Test fixtures — from the UX mocks (total-dollar canonical)
// ═══════════════════════════════════════════════════════════════

/** ABNB: modest profit, 7 DTE, low capture → time review */
const ABNB = {
  id: 'abnb-ic',
  symbol: 'ABNB',
  strategy: 'iron_condor',
  status: 'open',
  qty: 44,
  dte: 7,
  spot: 133.31,
  maxProfitTotal: 3124,
  maxLossTotal: 5676,
  pnlTotal: 176,
  pnlPrevClose: 150,
  entryDate: '2026-05-28',
};

/** BIDU: losing, 20 DTE, 11% max loss used → loss review */
const BIDU = {
  id: 'bidu-ic',
  symbol: 'BIDU',
  strategy: 'iron_condor',
  status: 'open',
  qty: 13,
  dte: 20,
  spot: 100,
  maxProfitTotal: 2190,
  maxLossTotal: 5610,
  pnlTotal: -611,
  entryDate: '2026-05-10',
};

/** AMZN: good profit, 39% captured → profit review */
const AMZN = {
  id: 'amzn-ic',
  symbol: 'AMZN',
  strategy: 'iron_condor',
  status: 'open',
  qty: 4,
  dte: 14,
  spot: 200,
  maxProfitTotal: 506,
  maxLossTotal: 5494,
  pnlTotal: 196,
  entryDate: '2026-05-15',
};

/** ADBE: candidate, no entry yet */
const ADBE_CANDIDATE = {
  id: 'adbe-ic',
  symbol: 'ADBE',
  strategy: 'iron_condor',
  status: 'candidate',
  qty: 10,
  dte: 28,
  spot: 259.21,
  maxProfitTotal: 2240,
  maxLossTotal: 2760,
  probability: 0.70,
  breakevens: [245.76, 272.24],
};

// ═══════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════

describe('derivePosition', () => {
  describe('ABNB — time review', () => {
    const d = derivePosition(ABNB);

    it('perContract = pnlTotal / qty', () => {
      expect(d.perContract).toBe(4);
    });

    it('daily = pnlTotal − pnlPrevClose', () => {
      expect(d.daily).toBe(26);
    });

    it('dailyPerContract', () => {
      expect(d.dailyPerContract).toBeCloseTo(26 / 44, 4);
    });

    it('profitCapturedPct ≈ 5.6%', () => {
      expect(d.profitCapturedPct).toBeCloseTo(5.633, 0);
    });

    it('lossUsedPct = 0 (position is profitable)', () => {
      expect(d.lossUsedPct).toBe(0);
    });

    it('remainingDownside = maxLoss + pnl', () => {
      expect(d.remainingDownside).toBe(5852);
    });

    it('maxProfitLeft = maxProfit − pnl', () => {
      expect(d.maxProfitLeft).toBe(2948);
    });

    it('review = time (7 DTE ≤ 21, profitable, low capture)', () => {
      expect(d.review).toBe('time');
      expect(d.flagged).toBe(true);
    });

    it('isOpen = true', () => {
      expect(d.isOpen).toBe(true);
    });

    it('nowPct is in the profit zone', () => {
      // (176 + 5676) / (5676 + 3124) * 100 ≈ 66.5%
      expect(d.nowPct).toBeCloseTo(66.5, 0);
    });
  });

  describe('BIDU — loss review', () => {
    const d = derivePosition(BIDU);

    it('perContract = −47', () => {
      expect(d.perContract).toBeCloseTo(-47, 0);
    });

    it('lossUsedPct ≈ 10.9%', () => {
      expect(d.lossUsedPct).toBeCloseTo(10.9, 0);
    });

    it('returnOnRiskPct ≈ −10.9%', () => {
      expect(d.returnOnRiskPct).toBeCloseTo(-10.9, 0);
    });

    it('review = loss, flagged (lossUsed > 8%)', () => {
      expect(d.review).toBe('loss');
      expect(d.flagged).toBe(true);
    });

    it('daily is null when pnlPrevClose is absent', () => {
      expect(d.daily).toBeNull();
      expect(d.dailyPerContract).toBeNull();
    });
  });

  describe('AMZN — profit review', () => {
    const d = derivePosition(AMZN);

    it('profitCapturedPct ≈ 38.7%', () => {
      expect(d.profitCapturedPct).toBeCloseTo(38.7, 0);
    });

    it('review = profit (38.7% > 35% threshold)', () => {
      expect(d.review).toBe('profit');
      expect(d.flagged).toBe(true);
    });
  });

  describe('ADBE — candidate (no entry)', () => {
    const d = derivePosition(ADBE_CANDIDATE);

    it('isOpen = false', () => {
      expect(d.isOpen).toBe(false);
    });

    it('nowPct = null (no position marker on gauge)', () => {
      expect(d.nowPct).toBeNull();
    });

    it('daily = null', () => {
      expect(d.daily).toBeNull();
    });

    it('review = null, not flagged', () => {
      expect(d.review).toBeNull();
      expect(d.flagged).toBe(false);
    });

    it('breakevenPct and rewardRisk still compute', () => {
      // breakevenPct = 2760 / (2760 + 2240) * 100 = 55.2%
      expect(d.breakevenPct).toBeCloseTo(55.2, 0);
      // rewardRisk = 2240 / 2760 ≈ 0.8116
      expect(d.rewardRisk).toBeCloseTo(0.81, 1);
    });
  });
});

describe('recommendation', () => {
  it('time review text mentions DTE and capture', () => {
    const d = derivePosition(ABNB);
    const text = recommendation(d);
    expect(text).toContain('7 DTE');
    expect(text).toContain('6%');
    expect(text).toContain('closing or rolling');
  });

  it('loss review text mentions loss% and DTE', () => {
    const d = derivePosition(BIDU);
    const text = recommendation(d);
    expect(text).toContain('11%');
    expect(text).toContain('20 DTE');
    expect(text).toContain('adjustment');
  });

  it('profit review text mentions captured%', () => {
    const d = derivePosition(AMZN);
    const text = recommendation(d);
    expect(text).toContain('39%');
    expect(text).toContain('profit');
  });

  it('on-track message for no review', () => {
    const d = derivePosition(ADBE_CANDIDATE);
    const text = recommendation(d);
    expect(text).toContain('On track');
  });
});

describe('REVIEW thresholds', () => {
  it('reconciled from verdictEngine: 21 DTE, 35% profit, 8% loss', () => {
    expect(REVIEW.timeDteThreshold).toBe(21);
    expect(REVIEW.profitTakePct).toBe(35);
    expect(REVIEW.lossReviewPct).toBe(8);
  });
});

describe('edge cases', () => {
  it('loss below threshold: review=loss but flagged=false', () => {
    const shallow = { ...BIDU, pnlTotal: -100 };
    // lossUsed = 100/5610 ≈ 1.8% < 8%, no breakevens → not breached
    const d = derivePosition(shallow);
    expect(d.review).toBe('loss');
    expect(d.flagged).toBe(false);
  });

  it('breached but small loss: still flagged via breach detection', () => {
    // Condor with breakevens at 126–138, spot at 139 (above upper breakeven).
    // P&L is only −$20 (0.35% of maxLoss) — well below the 8% threshold.
    // Without breach detection this would be review=loss, flagged=false.
    const breachedCondor = {
      ...ABNB,
      pnlTotal: -20,
      spot: 139,
      breakevens: [126, 138],
      dte: 30,
    };
    const d = derivePosition(breachedCondor);
    expect(d.review).toBe('loss');
    expect(d.flagged).toBe(true);
    expect(d.breached).toBe(true);
  });

  it('breached while still profitable: flagged as loss review', () => {
    // Spot just crossed upper breakeven but P&L is still slightly positive
    // from theta collected. Breach should still trigger loss review + flag.
    const breachedProfit = {
      ...ABNB,
      pnlTotal: 50,
      spot: 139,
      breakevens: [126, 138],
      dte: 30,
    };
    const d = derivePosition(breachedProfit);
    expect(d.review).toBe('loss');
    expect(d.flagged).toBe(true);
    expect(d.breached).toBe(true);
  });

  it('no breakevens: breach is false, loss flagging uses pct only', () => {
    const noBE = { ...BIDU, breakevens: undefined, pnlTotal: -100 };
    const d = derivePosition(noBE);
    expect(d.breached).toBe(false);
    expect(d.flagged).toBe(false); // 1.8% < 8%
  });

  it('open position with pnlTotal=0: not flagged for loss or profit', () => {
    const flat = { ...ABNB, pnlTotal: 0, dte: 30, breakevens: undefined };
    const d = derivePosition(flat);
    // pnl >= 0, not breached → not loss. profitCaptured=0 → not profit. dte=30 → not time.
    expect(d.review).toBeNull();
    expect(d.flagged).toBe(false);
  });

  it('qty=0 does not divide by zero', () => {
    const zero = { ...ABNB, qty: 0 };
    const d = derivePosition(zero);
    expect(d.perContract).toBe(0);
    expect(isFinite(d.perContract)).toBe(true);
  });

  it('maxLossTotal=undefined produces no NaN', () => {
    const noLoss = { ...ABNB, maxLossTotal: undefined };
    const d = derivePosition(noLoss);
    expect(isFinite(d.breakevenPct)).toBe(true);
    expect(isFinite(d.rewardRisk)).toBe(true);
    expect(isFinite(d.remainingDownside)).toBe(true);
    expect(isFinite(d.lossUsedPct)).toBe(true);
    expect(isFinite(d.returnOnRiskPct)).toBe(true);
    expect(d.maxLossTotal).toBe(0);
  });

  it('maxProfitTotal=undefined produces no NaN', () => {
    const noProfit = { ...ABNB, maxProfitTotal: undefined };
    const d = derivePosition(noProfit);
    expect(isFinite(d.breakevenPct)).toBe(true);
    expect(isFinite(d.profitCapturedPct)).toBe(true);
    expect(isFinite(d.maxProfitLeft)).toBe(true);
    expect(d.maxProfitTotal).toBe(0);
  });

  it('all fields undefined produces no NaN', () => {
    const empty = { id: 'empty', status: 'open', pnlTotal: 0 };
    const d = derivePosition(empty);
    const numericFields = [
      d.span, d.breakevenPct, d.rewardRisk, d.pnlTotal, d.perContract,
      d.profitCapturedPct, d.lossUsedPct, d.remainingDownside,
      d.maxProfitLeft, d.returnOnRiskPct, d.dte, d.spot, d.qty,
    ];
    for (const v of numericFields) {
      expect(isFinite(v)).toBe(true);
    }
    // daily/dailyPerContract are null (no pnlPrevClose), not NaN
    expect(d.daily).toBeNull();
    expect(d.dailyPerContract).toBeNull();
    expect(d.nowPct).toBeNull(); // span is 0 → null, not NaN
  });

  it('spot=undefined does not NaN breach detection', () => {
    const noSpot = { ...ABNB, spot: undefined, breakevens: [126, 138] };
    const d = derivePosition(noSpot);
    expect(d.breached).toBe(false);
    expect(d.spot).toBe(0);
  });

  it('dte=undefined coerces to 0 but does NOT trigger time review', () => {
    const noDte = { ...ABNB, dte: undefined };
    const d = derivePosition(noDte);
    expect(d.dte).toBe(0);
    // Missing dte is not a real "0 days left" — don't flag
    expect(d.review).toBeNull();
    expect(d.flagged).toBe(false);
  });

  it('dte=0 (real expiry-day value) triggers time review', () => {
    const expiryDay = { ...ABNB, dte: 0 };
    const d = derivePosition(expiryDay);
    expect(d.dte).toBe(0);
    expect(d.review).toBe('time');
    expect(d.flagged).toBe(true);
  });
});
