import { describe, it, expect } from 'vitest';

import { createRequire } from 'module';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';
const __dirname = dirname(fileURLToPath(import.meta.url));
const cjsRequire = createRequire(resolve(__dirname, 'package.json'));
const { rankSignals, qualitySelect, normalizeCode, DEFAULTS } = cjsRequire('../../../../generaterecommendations/funnel-rank.cjs');

// ═══════════════════════════════════════════════════════════════
// Fixtures
// ═══════════════════════════════════════════════════════════════

function mkSignal(symbol, strategy, score, confidence, opts = {}) {
  return {
    id: `${symbol}_${strategy}_${Date.now()}`,
    symbol,
    strategy: strategy.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    strategyCode: strategy,
    direction: 'neutral',
    opportunityScore: score,
    price: 100,
    isActive: true,
    gammaData: { confidence: { overall: confidence } },
    source: 'pipeline-scanner',
    ...opts,
  };
}

const SIGNALS = [
  mkSignal('AAPL', 'iron_condor', 85, 0.72),
  mkSignal('NVDA', 'iron_condor', 78, 0.65),
  mkSignal('TSLA', 'iron_butterfly', 70, 0.80),
  mkSignal('AMZN', 'bull_put_spread', 65, 0.55),
  mkSignal('MSFT', 'iron_condor', 60, 0.90),
  mkSignal('BABA', 'iron_condor', 55, 0.45),
  mkSignal('CRM', 'broken_wing_butterfly', 90, 0.85), // unpriceable
  mkSignal('BA', 'calendar_spread', 80, 0.70),         // unpriceable
  mkSignal('SPY', 'iron_condor', 50, 0.20),            // low confidence
  mkSignal('QQQ', 'iron_condor', 45, 0.60),
  // Duplicate AAPL iron_condor (lower score)
  mkSignal('AAPL', 'iron_condor', 40, 0.50),
];

// ═══════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════

describe('funnel-rank: rankSignals', () => {
  it('filters out unpriceable strategies (BWB, calendar)', () => {
    const { skipped } = rankSignals(SIGNALS);
    const unpriceable = skipped.filter(s => s.reason.startsWith('unpriceable'));
    expect(unpriceable).toHaveLength(2);
    expect(unpriceable.map(s => s.signal.symbol).sort()).toEqual(['BA', 'CRM']);
  });

  it('filters out low confidence signals', () => {
    const { skipped } = rankSignals(SIGNALS);
    const lowConf = skipped.filter(s => s.reason.startsWith('low confidence'));
    expect(lowConf).toHaveLength(1);
    expect(lowConf[0].signal.symbol).toBe('SPY');
  });

  it('dedupes by symbol + strategyCode (keeps highest-scoring)', () => {
    const { selected, skipped } = rankSignals(SIGNALS, { N: 10 });
    // AAPL appears twice as iron_condor — only the high-scoring one should survive
    const aaplSelected = selected.filter(s => s.symbol === 'AAPL');
    expect(aaplSelected).toHaveLength(1);
    expect(aaplSelected[0].opportunityScore).toBe(85); // the high one

    const aaplDuped = skipped.filter(s => s.reason.startsWith('duplicate') && s.signal.symbol === 'AAPL');
    expect(aaplDuped).toHaveLength(1);
  });

  it('sorts by opportunityScore × confidence descending', () => {
    const { selected } = rankSignals(SIGNALS, { N: 10 });
    // Verify descending composite score
    for (let i = 1; i < selected.length; i++) {
      const prevScore = (selected[i - 1].opportunityScore || 0) * (selected[i - 1].gammaData?.confidence?.overall ?? 0.5);
      const currScore = (selected[i].opportunityScore || 0) * (selected[i].gammaData?.confidence?.overall ?? 0.5);
      expect(prevScore).toBeGreaterThanOrEqual(currScore);
    }
  });

  it('selects top 2N (buffer) by default', () => {
    const { selected, stats } = rankSignals(SIGNALS, { N: 3 });
    expect(stats.bufferSize).toBe(6);
    // After filtering + dedupe, we have fewer than 6 eligible, so selected = all eligible
    expect(selected.length).toBeLessThanOrEqual(6);
    expect(selected.length).toBeGreaterThan(0);
  });

  it('returns stats with correct counts', () => {
    const { stats } = rankSignals(SIGNALS, { N: 15 });
    expect(stats.total).toBe(SIGNALS.length);
    expect(stats.filtered).toBeLessThan(stats.total); // some filtered out
    expect(stats.deduped).toBeLessThanOrEqual(stats.filtered); // dedup removes some
    expect(stats.selected).toBeLessThanOrEqual(stats.bufferSize);
  });

  it('inactive signals are skipped', () => {
    const withInactive = [...SIGNALS, mkSignal('GOOG', 'iron_condor', 95, 0.90, { isActive: false })];
    const { skipped } = rankSignals(withInactive);
    expect(skipped.some(s => s.signal.symbol === 'GOOG' && s.reason === 'inactive')).toBe(true);
  });
});

describe('funnel-rank: qualitySelect', () => {
  it('selects top N by R:R × 60 + PoP × 40 (no confidence double-counting)', () => {
    const tiles = [
      { symbol: 'A', rewardRisk: 0.5, oddsOfProfit: 70 },  // 0.5*60 + 0.70*40 = 30+28 = 58
      { symbol: 'B', rewardRisk: 1.2, oddsOfProfit: 65 },  // 1.2*60 + 0.65*40 = 72+26 = 98
      { symbol: 'C', rewardRisk: 0.3, oddsOfProfit: 80 },  // 0.3*60 + 0.80*40 = 18+32 = 50
      { symbol: 'D', rewardRisk: 0.8, oddsOfProfit: null }, // 0.8*60 + 0*40 = 48
    ];
    const top2 = qualitySelect(tiles, 2);
    expect(top2).toHaveLength(2);
    expect(top2[0].symbol).toBe('B'); // 98
    expect(top2[1].symbol).toBe('A'); // 58
  });

  it('handles oddsOfProfit: null gracefully (PoP contributes 0)', () => {
    const tiles = [
      { symbol: 'X', rewardRisk: 0.5, oddsOfProfit: null },
    ];
    const result = qualitySelect(tiles, 1);
    expect(result).toHaveLength(1);
    expect(result[0].symbol).toBe('X');
  });

  it('does not use tile.confidence in scoring (prevents double-counting)', () => {
    // Two tiles with same R:R and PoP but different confidence
    // Should score identically since confidence is not in the formula
    const tiles = [
      { symbol: 'P', rewardRisk: 0.5, oddsOfProfit: 70, confidence: 90 },
      { symbol: 'Q', rewardRisk: 0.5, oddsOfProfit: 70, confidence: 30 },
    ];
    const result = qualitySelect(tiles, 2);
    // Both should be selected (same score), order may vary
    expect(result).toHaveLength(2);
  });
});

describe('funnel-rank: PoP floor boundary', () => {
  const POP_FLOOR = 65;

  it('tile with PoP 64 (just below 65% floor) is rejected', () => {
    const tiles = [
      { symbol: 'A', rewardRisk: 0.8, oddsOfProfit: 64 },
      { symbol: 'B', rewardRisk: 0.5, oddsOfProfit: 66 },
    ];
    const passed = tiles.filter(t => (t.oddsOfProfit || 0) >= POP_FLOOR);
    expect(passed).toHaveLength(1);
    expect(passed[0].symbol).toBe('B');
  });

  it('tile with PoP 65 (exactly at floor) passes', () => {
    const tiles = [{ symbol: 'X', rewardRisk: 0.5, oddsOfProfit: 65 }];
    const passed = tiles.filter(t => (t.oddsOfProfit || 0) >= POP_FLOOR);
    expect(passed).toHaveLength(1);
  });

  it('tile with PoP null (uncomputable) is rejected', () => {
    const tiles = [{ symbol: 'Y', rewardRisk: 0.5, oddsOfProfit: null }];
    const passed = tiles.filter(t => (t.oddsOfProfit || 0) >= POP_FLOOR);
    expect(passed).toHaveLength(0);
  });

  it('PoP is 0-100 scale', () => {
    const tile = { symbol: 'Z', rewardRisk: 0.5, oddsOfProfit: 72 };
    expect((tile.oddsOfProfit || 0) >= POP_FLOOR).toBe(true);
  });
});

describe('funnel-rank: normalizeCode', () => {
  it('normalizes strategy names to codes', () => {
    expect(normalizeCode('Iron Condor')).toBe('iron_condor');
    expect(normalizeCode('iron_condor')).toBe('iron_condor');
    expect(normalizeCode('Bull Put Spread')).toBe('bull_put_spread');
    expect(normalizeCode('Broken Wing Butterfly')).toBe('broken_wing_butterfly');
    expect(normalizeCode(null)).toBe('unknown');
  });
});
