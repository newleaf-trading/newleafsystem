import { describe, it, expect } from 'vitest';
import {
  evPerTrade,
  cappedLoss,
  expectedCurve,
  monteCarlo,
  percentilesAtTrade,
  dollarTranslation,
  pickStructure,
  simulate,
  BASE_STATE,
} from './engine';

describe('evPerTrade', () => {
  it('base case = 62% × 1.2% − 38% × 1.0% = 0.00364', () => {
    expect(evPerTrade(BASE_STATE)).toBeCloseTo(0.00364, 6);
  });

  it('uses the capped loss when avg loss exceeds the cap', () => {
    const s = { ...BASE_STATE, al: 0.03, capPct: 0.01 };
    expect(cappedLoss(s)).toBe(0.01);
    expect(evPerTrade(s)).toBeCloseTo(0.62 * 0.012 - 0.38 * 0.01, 6);
  });
});

describe('expectedCurve', () => {
  it('has length total+1 and starts at starting capital', () => {
    const c = expectedCurve(BASE_STATE);
    expect(c).toHaveLength(BASE_STATE.tpy * BASE_STATE.yrs + 1);
    expect(c[0]).toBe(BASE_STATE.cap);
  });

  it('endpoint equals cap × (1+ev)^totalTrades', () => {
    const total = BASE_STATE.tpy * BASE_STATE.yrs;
    const expected = BASE_STATE.cap * Math.pow(1 + evPerTrade(BASE_STATE), total);
    expect(expectedCurve(BASE_STATE)[total]).toBeCloseTo(expected, 4);
  });
});

describe('monteCarlo (seeded)', () => {
  it('percentiles are ordered p10 ≤ p50 ≤ p90 at every band point', () => {
    const { band, p10, p50, p90 } = monteCarlo(BASE_STATE);
    for (const b of band) {
      expect(b.p10).toBeLessThanOrEqual(b.p50);
      expect(b.p50).toBeLessThanOrEqual(b.p90);
    }
    expect(p10).toBeLessThanOrEqual(p50);
    expect(p50).toBeLessThanOrEqual(p90);
  });

  it('losing-path risk is 0 for the positive-edge base case', () => {
    expect(monteCarlo(BASE_STATE).losingRisk).toBe(0);
  });

  it('is deterministic — identical inputs yield identical output', () => {
    expect(monteCarlo(BASE_STATE)).toEqual(monteCarlo(BASE_STATE));
    expect(simulate(BASE_STATE).band).toEqual(simulate(BASE_STATE).band);
  });

  it('changing an input changes the seeded result (no frozen output)', () => {
    const a = monteCarlo(BASE_STATE);
    const b = monteCarlo({ ...BASE_STATE, wr: 0.55 });
    expect(a.p50).not.toBe(b.p50);
  });
});

describe('percentilesAtTrade', () => {
  it('orders p10 ≤ p50 ≤ p90', () => {
    const b = percentilesAtTrade(BASE_STATE, 60);
    expect(b.p10).toBeLessThanOrEqual(b.p50);
    expect(b.p50).toBeLessThanOrEqual(b.p90);
  });
  it('at trade index 0 every percentile equals starting capital', () => {
    const b = percentilesAtTrade(BASE_STATE, 0);
    expect(b).toEqual({ p10: BASE_STATE.cap, p50: BASE_STATE.cap, p90: BASE_STATE.cap });
  });
  it('is deterministic for identical inputs', () => {
    expect(percentilesAtTrade(BASE_STATE, 40)).toEqual(percentilesAtTrade(BASE_STATE, 40));
  });
});

describe('dollarTranslation', () => {
  it('$250k at 1% cap → $2,500 risk per trade', () => {
    expect(dollarTranslation({ cap: 250000, capPct: 0.01, aw: 0.012, al: 0.01 }).riskPerTrade).toBe(2500);
  });

  it('$250k at 2% cap → $5,000 risk per trade', () => {
    expect(dollarTranslation({ cap: 250000, capPct: 0.02, aw: 0.012, al: 0.01 }).riskPerTrade).toBe(5000);
  });
});

describe('pickStructure thresholds', () => {
  it('rr < 1.4 → Iron Condor', () => {
    expect(pickStructure(1.39).key).toBe('IRON_CONDOR');
  });
  it('1.4 ≤ rr < 1.9 → Iron Butterfly', () => {
    expect(pickStructure(1.4).key).toBe('IRON_BUTTERFLY');
    expect(pickStructure(1.6).key).toBe('IRON_BUTTERFLY');
  });
  it('rr ≥ 1.9 → Bull-Call Spread', () => {
    expect(pickStructure(1.9).key).toBe('BULL_CALL');
    expect(pickStructure(2.0).key).toBe('BULL_CALL');
  });
});

describe('simulate (base preset acceptance)', () => {
  const sim = simulate(BASE_STATE);
  it('expected final lands in the ~$152k–$156k band (prototype within rounding)', () => {
    expect(Math.round(sim.finalExpected / 1000)).toBeGreaterThanOrEqual(152);
    expect(Math.round(sim.finalExpected / 1000)).toBeLessThanOrEqual(156);
  });
  it('selects an Iron Condor at the base 1.2:1 reward:risk', () => {
    expect(sim.rr).toBeCloseTo(1.2, 6);
    expect(sim.structure.key).toBe('IRON_CONDOR');
  });
});
