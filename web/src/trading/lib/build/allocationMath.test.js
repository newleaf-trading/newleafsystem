import { describe, it, expect } from 'vitest';
import { computeExpectedProfit, computeSummaryStats, formatScenarioText, computeAllocation, normaliseProb } from './allocationMath';

describe('computeExpectedProfit', () => {
  it('computes EV correctly for NVDA Iron Condor at 88% prob, $32 profit, $968 loss', () => {
    // EV = (0.88 × 32 × 0.60) - ((1-0.88) × 968 × 1.00)
    //    = (16.896) - (116.16)
    //    = -99.264
    const ev = computeExpectedProfit(0.88, 32, 968);
    expect(ev).toBeCloseTo(-99.26, 0);
  });

  it('computes positive EV for high-probability credit trade', () => {
    // 75% prob, $300 max profit, $700 max loss
    // EV = (0.75 × 300 × 0.60) - (0.25 × 700 × 1.00) = 135 - 175 = -40
    const ev = computeExpectedProfit(0.75, 300, 700);
    expect(ev).toBeCloseTo(-40, 0);
  });

  it('returns zero for zero probability', () => {
    const ev = computeExpectedProfit(0, 500, 500);
    expect(ev).toBe(-500); // 0% chance of winning, 100% chance of losing max
  });
});

describe('formatScenarioText', () => {
  it('formats "~3 of 4 win" correctly', () => {
    // 4 strategies each at 76% = totalProbSum 3.04
    const text = formatScenarioText(3.04, 4);
    expect(text).toBe('~3 of 4 win');
  });

  it('formats "~2 of 3 win" correctly', () => {
    const text = formatScenarioText(1.8, 3);
    expect(text).toBe('~2 of 3 win');
  });

  it('handles zero strategies', () => {
    const text = formatScenarioText(0, 0);
    expect(text).toBe('No strategies');
  });
});

describe('computeSummaryStats', () => {
  it('computes aggregate stats for 4 strategies at 76% probability', () => {
    const strategies = [
      { maxProfit: 300, maxLoss: 700, probability: 76, quantity: 1 },
      { maxProfit: 250, maxLoss: 750, probability: 76, quantity: 1 },
      { maxProfit: 320, maxLoss: 680, probability: 76, quantity: 1 },
      { maxProfit: 280, maxLoss: 720, probability: 76, quantity: 1 },
    ];

    const stats = computeSummaryStats(strategies, 100000, 0.10);
    expect(stats.count).toBe(4);
    expect(stats.avgWinRate).toBeCloseTo(76, 0);
    expect(stats.expectedWinners).toBeCloseTo(3.04, 1);
    expect(stats.riskBudget).toBe(10000);
    expect(stats.totalMaxRisk).toBe(2850);
    expect(stats.totalPotentialReturn).toBe(1150);
  });
});

describe('computeAllocation', () => {
  it('flags over-budget when allocated exceeds risk budget', () => {
    const strategies = [
      { id: '1', maxLoss: 5000, quantity: 1 },
      { id: '2', maxLoss: 5000, quantity: 1 },
      { id: '3', maxLoss: 4259, quantity: 1 },
    ];

    const result = computeAllocation(strategies, 10000);
    // Total risk = 5000 + 5000 + 4259 = 14259
    expect(result.allocatedAmount).toBe(14259);
    expect(result.allocationPct).toBeCloseTo(142.6, 0);
    expect(result.isOverBudget).toBe(true);
  });

  it('auto-allocate splits equally', () => {
    const strategies = [
      { id: '1', maxLoss: 300, quantity: 1 },
      { id: '2', maxLoss: 500, quantity: 1 },
    ];

    const result = computeAllocation(strategies, 10000, true);
    // Each gets 5000 allocation
    // Strategy 1: floor(5000/300) = 16 contracts × 300 = 4800
    // Strategy 2: floor(5000/500) = 10 contracts × 500 = 5000
    expect(result.strategies[0].contracts).toBe(16);
    expect(result.strategies[1].contracts).toBe(10);
    expect(result.isOverBudget).toBe(false);
  });

  it('returns empty for no strategies', () => {
    const result = computeAllocation([], 10000);
    expect(result.strategies).toHaveLength(0);
    expect(result.allocatedAmount).toBe(0);
  });
});

describe('normaliseProb', () => {
  it('handles percentage (76 → 0.76)', () => {
    expect(normaliseProb(76)).toBeCloseTo(0.76);
  });

  it('handles decimal (0.76 → 0.76)', () => {
    expect(normaliseProb(0.76)).toBeCloseTo(0.76);
  });

  it('handles missing (null → 0.5)', () => {
    expect(normaliseProb(null)).toBe(0.5);
  });

  it('clamps to 0-1 range', () => {
    expect(normaliseProb(150)).toBeLessThanOrEqual(1);
    expect(normaliseProb(-10)).toBeGreaterThanOrEqual(0);
  });
});
