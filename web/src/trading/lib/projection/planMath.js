/**
 * planMath — adapter between the Plan-of-Record data model and the projection engine.
 *
 * Architecture rule (same as engine.js): CODE COMPUTES EVERY NUMBER. There is NO
 * second copy of the projection maths here — every derived figure routes through
 * engine.js so the workbench (operator) and /invest/projection (investor) surfaces
 * compute byte-for-byte identical numbers.
 *
 * Unit convention: planTemplate rate fields are stored as FRACTIONS (0..1), matching
 * the engine's state shape directly — winRateTarget 0.62, avgWin 0.012, etc. — so the
 * mapping is a pass-through with no scaling drift.
 *
 * planTemplate shape (operator-owned):
 *   { winRateTarget, avgWin, avgLoss, tradesPerWeek, riskCapPct, portfolioMaxLossPct }
 */
import { evPerTrade as engineEvPerTrade } from './engine';

const WEEKS_PER_YEAR = 52;

/** Map a plan template + investor capital into the engine's state shape. */
export function templateToState(template, capital, years = 1) {
  return {
    cap: capital,
    yrs: years,
    tpy: Math.round(template.tradesPerWeek * WEEKS_PER_YEAR),
    wr: template.winRateTarget,
    aw: template.avgWin,
    al: template.avgLoss,
    capPct: template.riskCapPct,
  };
}

/**
 * Deterministic expected value per trade for a template, via the shared engine.
 * Equals winRate*avgWin − (1−winRate)*min(avgLoss, riskCapPct). Used to stamp the
 * template's `evPerTrade` at publish so it can never drift from what the chart draws.
 */
export function deriveEvPerTrade(template) {
  return engineEvPerTrade({
    wr: template.winRateTarget,
    aw: template.avgWin,
    al: template.avgLoss,
    capPct: template.riskCapPct,
  });
}

/** Scale the template's percentage envelope into real dollars at the given capital. */
export function dollarEnvelope(template, capital) {
  return {
    riskCapDollar: template.riskCapPct * capital,
    maxLossDollar: template.portfolioMaxLossPct * capital,
  };
}

/**
 * Build the FROZEN planOfRecord snapshot committed by an investor.
 *
 * CRITICAL: this copies template fields by value at commit time. The returned object
 * holds NO reference to `template` — later editing or retiring the template must never
 * mutate a committed plan (enforced by planMath.test.js). `createdAt` is intentionally
 * omitted here; the caller stamps it with Firestore serverTimestamp() at write time.
 */
export function buildPlanOfRecord({ template, capital, planName, startDateISO }) {
  const env = dollarEnvelope(template, capital);
  return {
    planName,
    templateId: template.id,
    templateVersion: template.version,
    capital,
    riskCapDollar: env.riskCapDollar,
    maxLossDollar: env.maxLossDollar,
    tradesPerWeek: template.tradesPerWeek,
    evPerTrade: deriveEvPerTrade(template),
    // Frozen engine assumptions — copied so the adherence band (seeded MC) is
    // reproducible from the snapshot alone, without a live join to the template.
    winRate: template.winRateTarget,
    avgWin: template.avgWin,
    avgLoss: template.avgLoss,
    riskCapPct: template.riskCapPct,
    startDate: startDateISO,
    status: 'active',
    provenance: { source: 'invest-projection' },
  };
}

/** Default plan name: "{template name} — {Month Year}" (investor can override). */
export function defaultPlanName(template, date) {
  const month = date.toLocaleString('en-US', { month: 'long', year: 'numeric' });
  return `${template.name} — ${month}`;
}

/** Whole weeks since a plan's startDate, 1-indexed (Week 1 on the start day). */
export function weekOf(startDate, now = Date.now()) {
  if (!startDate) return 1;
  const start = new Date(startDate);
  if (Number.isNaN(start.getTime())) return 1;
  const days = Math.floor((now - start.getTime()) / 86_400_000);
  return Math.max(1, Math.floor(days / 7) + 1);
}
