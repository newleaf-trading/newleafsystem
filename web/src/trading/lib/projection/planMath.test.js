import { describe, it, expect } from 'vitest';
import { evPerTrade } from './engine';
import {
  templateToState,
  deriveEvPerTrade,
  dollarEnvelope,
  buildPlanOfRecord,
  defaultPlanName,
  weekOf,
} from './planMath';

/** A representative published template (rate fields as fractions). */
const TEMPLATE = {
  id: 'tmpl_base',
  name: 'Base Cadence',
  version: 1,
  winRateTarget: 0.62,
  avgWin: 0.012,
  avgLoss: 0.01,
  tradesPerWeek: 2.4,
  riskCapPct: 0.01,
  portfolioMaxLossPct: 0.2,
};

describe('templateToState', () => {
  it('maps rate fields straight through and derives tpy from trades/week', () => {
    const s = templateToState(TEMPLATE, 100000, 1);
    expect(s).toEqual({
      cap: 100000,
      yrs: 1,
      tpy: Math.round(2.4 * 52), // 125
      wr: 0.62,
      aw: 0.012,
      al: 0.01,
      capPct: 0.01,
    });
  });
});

describe('deriveEvPerTrade', () => {
  it('equals the spec formula winRate*avgWin − (1−winRate)*min(avgLoss, riskCapPct)', () => {
    expect(deriveEvPerTrade(TEMPLATE)).toBeCloseTo(0.62 * 0.012 - 0.38 * 0.01, 9);
  });

  it('matches engine.evPerTrade exactly (single source of truth)', () => {
    const viaEngine = evPerTrade(templateToState(TEMPLATE, 100000));
    expect(deriveEvPerTrade(TEMPLATE)).toBe(viaEngine);
  });

  it('uses the capped loss when avgLoss exceeds the riskCapPct', () => {
    const t = { ...TEMPLATE, avgLoss: 0.03, riskCapPct: 0.01 };
    expect(deriveEvPerTrade(t)).toBeCloseTo(0.62 * 0.012 - 0.38 * 0.01, 9);
  });
});

describe('dollarEnvelope', () => {
  it('scales linearly with capital', () => {
    expect(dollarEnvelope(TEMPLATE, 100000)).toEqual({
      riskCapDollar: 1000, // 1% of 100k
      maxLossDollar: 20000, // 20% of 100k
    });
    expect(dollarEnvelope(TEMPLATE, 250000)).toEqual({
      riskCapDollar: 2500,
      maxLossDollar: 50000,
    });
  });
});

describe('buildPlanOfRecord', () => {
  it('copies template fields by value into a frozen snapshot', () => {
    const por = buildPlanOfRecord({
      template: TEMPLATE,
      capital: 100000,
      planName: 'My Plan',
      startDateISO: '2026-06-14',
    });
    expect(por).toMatchObject({
      planName: 'My Plan',
      templateId: 'tmpl_base',
      templateVersion: 1,
      capital: 100000,
      riskCapDollar: 1000,
      maxLossDollar: 20000,
      tradesPerWeek: 2.4,
      startDate: '2026-06-14',
      status: 'active',
      provenance: { source: 'invest-projection' },
    });
    expect(por.evPerTrade).toBeCloseTo(0.62 * 0.012 - 0.38 * 0.01, 9);
  });

  it('freezes the engine assumptions (winRate/avgWin/avgLoss/riskCapPct) into the snapshot', () => {
    const por = buildPlanOfRecord({ template: TEMPLATE, capital: 100000, planName: 'X', startDateISO: '2026-06-14' });
    expect(por).toMatchObject({ winRate: 0.62, avgWin: 0.012, avgLoss: 0.01, riskCapPct: 0.01 });
  });

  it('SNAPSHOT IMMUTABILITY: mutating/retiring the source template never changes a committed plan', () => {
    const template = { ...TEMPLATE };
    const por = buildPlanOfRecord({
      template,
      capital: 100000,
      planName: 'Locked',
      startDateISO: '2026-06-14',
    });
    const before = JSON.parse(JSON.stringify(por));

    // Operator later edits the assumptions and retires the template.
    template.winRateTarget = 0.5;
    template.avgWin = 0.05;
    template.riskCapPct = 0.02;
    template.portfolioMaxLossPct = 0.4;
    template.version = 2;
    template.status = 'retired';

    expect(por).toEqual(before);
    expect(por.evPerTrade).toBeCloseTo(0.62 * 0.012 - 0.38 * 0.01, 9);
    expect(por.riskCapDollar).toBe(1000);
    expect(por.templateVersion).toBe(1);
  });
});

describe('defaultPlanName', () => {
  it('formats as "{name} — {Month Year}"', () => {
    expect(defaultPlanName(TEMPLATE, new Date('2026-06-14T00:00:00Z'))).toBe('Base Cadence — June 2026');
  });
});

describe('weekOf', () => {
  const start = '2026-06-01';
  const day = (iso) => new Date(iso + 'T12:00:00Z').getTime();
  it('is Week 1 on the start day', () => {
    expect(weekOf(start, day('2026-06-01'))).toBe(1);
  });
  it('stays Week 1 through day 6, becomes Week 2 on day 7', () => {
    expect(weekOf(start, day('2026-06-07'))).toBe(1);
    expect(weekOf(start, day('2026-06-08'))).toBe(2);
  });
  it('never returns below 1, and tolerates bad input', () => {
    expect(weekOf(start, day('2026-05-01'))).toBe(1); // before start
    expect(weekOf(null)).toBe(1);
    expect(weekOf('not-a-date')).toBe(1);
  });
});
