import { describe, it, expect } from 'vitest';
import { computeScenarios, computeAllocationByStrategy, computeRiskRewardBreakdown } from './scenarioAnalysis';

describe('computeScenarios', () => {
  it('iron condor benefits most from flat market', () => {
    const strategies = [
      { strategy: 'Iron Condor', maxProfit: 300, maxLoss: 700, quantity: 1 },
    ];

    const results = computeScenarios(strategies);
    const flat = results.find(r => r.scenario === 'Flat Market');
    const bull = results.find(r => r.scenario === 'Bull Market');
    const bear = results.find(r => r.scenario === 'Bear Market');

    // Flat should be the best case for iron condor
    expect(flat.return).toBeGreaterThan(0);
    expect(flat.return).toBeGreaterThan(bull.return);
    expect(flat.return).toBeGreaterThan(bear.return);
  });

  it('spreads benefit from bull market', () => {
    const strategies = [
      { strategy: 'Bull Put Spread', maxProfit: 200, maxLoss: 800, quantity: 2 },
    ];

    const results = computeScenarios(strategies);
    const bull = results.find(r => r.scenario === 'Bull Market');
    expect(bull.return).toBeGreaterThan(0);
  });

  it('returns all zeros for empty strategies', () => {
    const results = computeScenarios([]);
    expect(results).toHaveLength(3);
    results.forEach(r => expect(r.return).toBe(0));
  });
});

describe('computeAllocationByStrategy', () => {
  it('groups by strategy type and sums risk', () => {
    const strategies = [
      { strategy: 'Iron Condor', maxLoss: 700, quantity: 1 },
      { strategy: 'Iron Condor', maxLoss: 600, quantity: 2 },
      { strategy: 'Bull Put Spread', maxLoss: 800, quantity: 1 },
    ];

    const result = computeAllocationByStrategy(strategies);
    const ic = result.find(r => r.name === 'Iron Condor');
    const bps = result.find(r => r.name === 'Bull Put Spread');

    expect(ic.count).toBe(2);
    expect(ic.value).toBe(700 + 1200); // 700×1 + 600×2
    expect(bps.count).toBe(1);
    expect(bps.value).toBe(800);
  });
});

describe('computeRiskRewardBreakdown', () => {
  it('computes profit and risk per strategy type', () => {
    const strategies = [
      { strategy: 'Iron Condor', maxProfit: 300, maxLoss: 700, quantity: 1 },
      { strategy: 'Iron Condor', maxProfit: 250, maxLoss: 750, quantity: 1 },
    ];

    const result = computeRiskRewardBreakdown(strategies);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Iron Condor');
    expect(result[0].profit).toBe(550);
    expect(result[0].risk).toBe(1450);
  });
});
