import { usePortfolio } from './usePortfolio';
import { useShortlist } from './useShortlist';

/**
 * Returns the ownership state of a strategy for the current user.
 *
 * @param {string} strategyId — tile ID
 * @returns {'unowned' | 'shortlisted' | 'owned'}
 */
export function usePositionState(strategyId) {
  const { isInPortfolio } = usePortfolio();
  const { isShortlisted } = useShortlist();

  if (!strategyId) return 'unowned';
  if (isInPortfolio(strategyId)) return 'owned';
  if (isShortlisted(strategyId)) return 'shortlisted';
  return 'unowned';
}
