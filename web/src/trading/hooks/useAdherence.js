/**
 * useAdherence — single source of the plan-adherence model for all renderers
 * (AdherenceCardFull, AdherenceGlance, AdherenceChip). Orchestrates the data
 * hooks and the (unchanged) deterministic math in lib/projection/adherence.js.
 *
 * No computation lives in the renderers — they consume what this returns.
 *
 * previewData (dev-only, see the PLANS detail route) bypasses the live hooks with
 * a clearly-labelled SAMPLE model so the active layout can be reviewed before live
 * data reaches the active phase.
 */
import { useMemo } from 'react';
import { usePlanOfRecord } from './usePlanOfRecord';
import { usePortfolioSettings } from './usePortfolioSettings';
import { usePortfolio } from './usePortfolio';
import { useWeeklyQualifiedSetups } from './useWeeklyQualifiedSetups';
import { computeAdherence, narrateAdherence } from '../lib/projection/adherence';

export function useAdherence(previewData = null) {
  const planHook = usePlanOfRecord();
  const { settings } = usePortfolioSettings();
  const { closedPositions, activePositions, loading: portLoading } = usePortfolio();
  const { count: qualifiedAvailableLive } = useWeeklyQualifiedSetups();

  const accountCapital = settings?.totalCapital ?? null;

  const computed = useMemo(
    () => (planHook.plan ? computeAdherence({ plan: planHook.plan, accountCapital, closedPositions }) : null),
    [planHook.plan, accountCapital, closedPositions]
  );

  const liveDeployedRisk = useMemo(
    () => (activePositions || []).reduce((s, p) => s + Math.abs(p.maxLoss || 0) * (p.quantity || 1), 0),
    [activePositions]
  );

  const plan = previewData ? previewData.plan : planHook.plan;
  const a = previewData ? previewData.adherence : computed;
  const qualifiedAvailable = previewData ? previewData.qualifiedAvailable ?? null : qualifiedAvailableLive;
  const deployedRisk = previewData ? previewData.deployedRisk ?? 0 : liveDeployedRisk;
  const narration = useMemo(() => narrateAdherence(a), [a]);
  const loading = !previewData && (planHook.loading || portLoading);

  return { a, plan, narration, qualifiedAvailable, deployedRisk, loading };
}
