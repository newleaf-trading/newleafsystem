/**
 * ActivePlanDetailPage (/invest/plans/active) — the active plan's home: identity +
 * $ envelope (ActivePlanCard) followed by the full plan-adherence card. This is
 * where forward-looking steering lives; Performance stays a clean track record.
 *
 * Dev-only preview: ?adherence=preview drives AdherenceCardFull with a labelled
 * SAMPLE fixture so the active layout can be reviewed before live data reaches the
 * active phase. Gated behind import.meta.env.DEV — a no-op in production builds.
 */
import { Link, useSearchParams } from 'react-router-dom';
import { ActivePlanCard } from '../components/ActivePlanCard';
import { AdherenceCardFull } from '../components/AdherenceCardFull';
import { PlanAlignmentPanel } from '../components/PlanAlignmentPanel';

// SAMPLE figures for the dev preview only (never reachable in a production build).
const PREVIEW_PLAN = { capital: 210000, maxLossDollar: 21000, riskCapDollar: 2100, tradesPerWeek: 5 };
const PREVIEW_ADHERENCE = {
  phase: 'active', weekNumber: 8, tradesPerWeek: 5, actualTrades: 17, expectedTrades: 40,
  startCapital: 210000, ev: 0.0028, realisedEdge: 0.0059, edgeAhead: true, behindCadence: true,
  cadenceRatio: 0.425, expectedCapital: 235000, paceAdjusted: 220390, actualCapital: 232090,
  realisedPnl: 22090, cadenceGap: 14610, edgeGap: -11700, netVsExpected: -2910,
  cadenceContribution: -14610, edgeContribution: 11700,
  band: { p10: 222000, p50: 235000, p90: 249000 }, tradesTakenThisWeek: 2,
  reconciliation: { matched: true, planCapital: 210000, accountCapital: 210000 },
};

export function ActivePlanDetailPage() {
  const [searchParams] = useSearchParams();
  const preview = import.meta.env.DEV && searchParams.get('adherence') === 'preview';

  return (
    <div style={{ maxWidth: 920, margin: '0 auto', padding: '24px 20px 60px' }}>
      <div style={{ marginBottom: 14 }}>
        <Link to="/invest/plans" style={{ font: '700 11px/1 "Space Mono", monospace', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--nl-text-muted)', textDecoration: 'none' }}>
          ← All plans
        </Link>
      </div>

      <ActivePlanCard showAdherence={false} />

      <div style={{ marginTop: 16 }}><PlanAlignmentPanel /></div>

      {preview && (
        <div style={{ font: '700 11px/1 "Space Mono", monospace', letterSpacing: '0.08em', textTransform: 'uppercase', color: '#B68F3E', margin: '16px 0 8px' }}>
          Preview · sample data (active phase) — dev only
        </div>
      )}
      <div style={{ marginTop: 16 }}>
        <AdherenceCardFull showNudge={false} previewData={preview ? { plan: PREVIEW_PLAN, adherence: PREVIEW_ADHERENCE } : null} />
      </div>
    </div>
  );
}
