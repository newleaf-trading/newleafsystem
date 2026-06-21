import { describe, it, expect } from 'vitest';
import {
  capitalReconciliation,
  planRelativeClosed,
  elapsedWeeks,
  computeAdherence,
  narrateAdherence,
} from './adherence';

// Plan committed at $100k, ~2.31 trades/week, edge ≈ 0.00364/trade, started 2026-01-01.
const PLAN = {
  capital: 100000,
  startDate: '2026-01-01',
  tradesPerWeek: 2.31,
  evPerTrade: 0.62 * 0.012 - 0.38 * 0.01,
  winRate: 0.62,
  avgWin: 0.012,
  avgLoss: 0.01,
  riskCapPct: 0.01,
};

const closed = (closedAt, realizedPnl, quantity = 1, entryDate = closedAt) => ({
  status: 'closed',
  closedAt,
  realizedPnl,
  quantity,
  entryDate,
});

const NOW = new Date('2026-04-01T00:00:00Z').getTime(); // ~13 weeks after start

describe('capitalReconciliation', () => {
  it('matches within tolerance, flags mismatch otherwise', () => {
    expect(capitalReconciliation(PLAN, 100000).matched).toBe(true);
    expect(capitalReconciliation(PLAN, 210000).matched).toBe(false);
  });
});

describe('planRelativeClosed — startDate anchoring', () => {
  it('excludes trades closed before startDate from count and realised P&L', () => {
    const positions = [
      closed('2025-12-15T00:00:00Z', 999, 1), // PRE-PLAN — must be ignored
      closed('2026-01-05T00:00:00Z', 100, 2), // 200
      closed('2026-02-10T00:00:00Z', -50, 1), // -50
    ];
    const r = planRelativeClosed(positions, PLAN.startDate);
    expect(r.actualTrades).toBe(2);
    expect(r.realisedPnl).toBe(150);
  });
});

describe('elapsedWeeks', () => {
  it('never negative; ~13 weeks at NOW', () => {
    expect(elapsedWeeks(PLAN.startDate, new Date('2025-06-01').getTime())).toBe(0);
    expect(Math.round(elapsedWeeks(PLAN.startDate, NOW))).toBe(13);
  });
});

describe('computeAdherence — capital guard', () => {
  it('plan.capital != account.capital → phase reconcile, no band', () => {
    const a = computeAdherence({ plan: PLAN, accountCapital: 210000, closedPositions: [], now: NOW });
    expect(a.phase).toBe('reconcile');
    expect(a.band).toBeUndefined();
    expect(a.cadenceGap).toBeUndefined();
  });
});

describe('computeAdherence — cold-start', () => {
  it('< 5 plan-trades → phase coldstart, no attribution', () => {
    const positions = [
      closed('2026-01-05T00:00:00Z', 100),
      closed('2026-01-12T00:00:00Z', 120),
      closed('2026-01-20T00:00:00Z', -40),
    ];
    const a = computeAdherence({ plan: PLAN, accountCapital: 100000, closedPositions: positions, now: NOW });
    expect(a.phase).toBe('coldstart');
    expect(a.cadenceGap).toBeUndefined();
    expect(a.band).toBeUndefined();
  });

  it('< 1 elapsed week → coldstart even with trades', () => {
    const soon = new Date('2026-01-03T00:00:00Z').getTime();
    const positions = Array.from({ length: 6 }, (_, i) => closed(`2026-01-0${i + 1}T00:00:00Z`, 10));
    const a = computeAdherence({ plan: PLAN, accountCapital: 100000, closedPositions: positions, now: soon });
    expect(a.phase).toBe('coldstart');
  });
});

describe('computeAdherence — active attribution', () => {
  const positions = Array.from({ length: 8 }, (_, i) =>
    closed(`2026-0${1 + (i % 3)}-1${i}T00:00:00Z`, i % 2 === 0 ? 300 : -120, 1)
  );
  const a = computeAdherence({ plan: PLAN, accountCapital: 100000, closedPositions: positions, now: NOW });

  it('enters active phase with >=5 trades and >=1 week', () => {
    expect(a.phase).toBe('active');
    expect(a.actualTrades).toBe(8);
  });

  it('attribution identity: cadenceGap + edgeGap === expectedCapital − actualCapital', () => {
    expect(a.cadenceGap + a.edgeGap).toBeCloseTo(a.expectedCapital - a.actualCapital, 6);
  });

  it('signed contributions sum to netVsExpected (drift bars)', () => {
    expect(a.cadenceContribution + a.edgeContribution).toBeCloseTo(a.netVsExpected, 6);
    expect(a.netVsExpected).toBeCloseTo(a.actualCapital - a.expectedCapital, 6);
    expect(a.cadenceContribution).toBeCloseTo(-a.cadenceGap, 6);
  });

  it('band percentiles are ordered p10 ≤ p50 ≤ p90', () => {
    expect(a.band.p10).toBeLessThanOrEqual(a.band.p50);
    expect(a.band.p50).toBeLessThanOrEqual(a.band.p90);
  });

  it('actualCapital is startCapital rebased by realised P&L', () => {
    expect(a.actualCapital).toBe(PLAN.capital + a.realisedPnl);
  });
});

describe('narrateAdherence — deterministic, no figures generated', () => {
  it('reconcile / coldstart / active levers + fixed footer', () => {
    expect(narrateAdherence({ phase: 'reconcile' }).verdict).toMatch(/re-commit/i);

    const cold = narrateAdherence({ phase: 'coldstart', weekNumber: 1, tradesPerWeek: 2.31, tradesTakenThisWeek: 0 });
    expect(cold.verdict).toBe('Week 1 — plan just set. 0 of ~2 qualified setups this week. Start when you’re ready.');

    const onEdge = narrateAdherence({ phase: 'active', realisedEdge: 0.01, ev: 0.003 });
    expect(onEdge.verdict).toMatch(/pace, not risk/);

    const belowEdge = narrateAdherence({ phase: 'active', realisedEdge: 0.001, ev: 0.003 });
    expect(belowEdge.verdict).toMatch(/check the edge/);

    expect(onEdge.footer).toBe('Cadence is a metronome, not a debt.');
  });

  it('never renders trades-owed / catch-up phrasing', () => {
    const all = ['reconcile', 'coldstart', 'active'].map((phase) =>
      narrateAdherence({ phase, weekNumber: 1, tradesPerWeek: 2, tradesTakenThisWeek: 0, realisedEdge: 0.01, ev: 0.003 }).verdict
    );
    for (const v of all) {
      expect(v).not.toMatch(/owe|catch up|catch-up|place \d+ more/i);
    }
  });
});
