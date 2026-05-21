import { useMemo, useEffect, useRef } from 'react';
import { doc, collection, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../shared/hooks/useAuth';
import { usePortfolio } from './usePortfolio';
import { evaluate, buildMarketData, VERDICT } from '../utils/verdictEngine';

/**
 * Returns the current verdict for a portfolio position.
 *
 * Evaluates using the verdict engine (pure functions, brief §9)
 * and writes state transitions to Firestore for back-testing.
 *
 * @param {string} positionId — portfolio item ID (same as tileId)
 * @param {object} tile — tile object (passed to avoid re-fetching)
 * @param {object} liveData — from usePositionLiveData (passed to avoid duplicate R2 calls)
 * @returns {{ state: string, reason: string, recommendedAction: string|null }}
 */
export function useVerdict(positionId, tile = null, liveData = null) {
  const { user } = useAuth();
  const { portfolioItems } = usePortfolio();
  const portfolioItem = portfolioItems.find(p => p.tileId === positionId) || null;

  // If no tile or liveData passed, we can't evaluate — return ON_TRACK default
  const canEvaluate = tile && liveData && portfolioItem && portfolioItem.status === 'active';

  const verdict = useMemo(() => {
    if (!canEvaluate) {
      return {
        state: VERDICT.ON_TRACK,
        reason: 'Position is within expected parameters.',
        recommendedAction: null,
      };
    }

    const position = {
      ...portfolioItem,
      strategy: portfolioItem.strategy || tile.strategy,
      legs: tile.legs || [],
      expiry: portfolioItem.expiry || tile.expiry,
      entryIvRank: portfolioItem.entryIvRank ?? null,
      earningsAtEntry: portfolioItem.earningsAtEntry ?? false,
    };

    const marketData = buildMarketData(liveData, tile, portfolioItem);

    return evaluate(position, marketData);
  }, [
    canEvaluate,
    portfolioItem?.tileId,
    portfolioItem?.status,
    portfolioItem?.strategy,
    portfolioItem?.entryIvRank,
    liveData?.currentSpot,
    liveData?.dte,
    liveData?.profitCapturePct,
    liveData?.pnlPerContract,
    liveData?.liveGreeks?.net?.delta,
    tile?.legs,
    tile?.strategy,
  ]);

  // ─── sessionsBreached counter ───
  // Increments each time useVerdict evaluates while strike is breached.
  // Resets to 0 when no longer breached. Stored on the portfolio document.
  const prevBreachedRef = useRef(null);
  useEffect(() => {
    if (!user || !positionId || !canEvaluate || !liveData) return;

    const marketData = buildMarketData(liveData, tile, portfolioItem);
    const currentlyBreached = marketData.isBreached;
    const currentCount = portfolioItem?.sessionsBreached || 0;

    // Skip if breach state hasn't changed since last eval
    if (prevBreachedRef.current === currentlyBreached) return;
    prevBreachedRef.current = currentlyBreached;

    const newCount = currentlyBreached ? currentCount + 1 : 0;
    if (newCount !== currentCount) {
      const posDocRef = doc(db, 'users', user.uid, 'portfolio', positionId);
      updateDoc(posDocRef, { sessionsBreached: newCount }).catch(err => {
        console.warn('[useVerdict] Failed to update sessionsBreached:', err.message);
      });
    }
  }, [user, positionId, canEvaluate, liveData?.currentSpot, portfolioItem?.sessionsBreached]);

  // ─── Write verdict transitions to Firestore (for back-testing per brief §9) ───
  const prevStateRef = useRef(null);
  useEffect(() => {
    if (!user || !positionId || !canEvaluate) return;
    if (prevStateRef.current === verdict.state) return; // no transition

    const prevState = prevStateRef.current;
    prevStateRef.current = verdict.state;

    // Skip the initial null → first-state transition (not a real change)
    if (prevState === null) return;

    const writeTransition = async () => {
      try {
        const historyRef = collection(db, 'users', user.uid, 'portfolio', positionId, 'verdictHistory');
        await addDoc(historyRef, {
          fromState: prevState,
          toState: verdict.state,
          reason: verdict.reason,
          recommendedAction: verdict.recommendedAction,
          spotPrice: liveData?.currentSpot || 0,
          dte: liveData?.dte ?? null,
          profitCapturePct: liveData?.profitCapturePct ?? 0,
          evaluatedAt: serverTimestamp(),
        });
      } catch (err) {
        console.warn('[useVerdict] Failed to write verdict transition:', err.message);
      }
    };

    writeTransition();
  }, [user, positionId, verdict.state, canEvaluate]);

  return verdict;
}

/**
 * Verdict state constants — used across Defend surfaces.
 * Evaluation order: first match wins (EXIT > ACTION_NEEDED > TAKE_PROFIT > MONITOR > ON_TRACK).
 */
export const VERDICT_STATES = {
  EXIT: 'EXIT',
  ACTION_NEEDED: 'ACTION_NEEDED',
  TAKE_PROFIT: 'TAKE_PROFIT',
  MONITOR: 'MONITOR',
  ON_TRACK: 'ON_TRACK',
};

/**
 * Verdict display config — colour and label for each state.
 * Colours follow the brief §8 guardrail: colour encodes state, not decoration.
 */
export const VERDICT_CONFIG = {
  ON_TRACK: { label: 'On track', color: '#0B7A52', bg: 'rgba(11,122,82,0.10)', border: 'rgba(11,122,82,0.20)' },
  TAKE_PROFIT: { label: 'Take profit', color: '#0B7A52', bg: 'rgba(11,122,82,0.10)', border: 'rgba(11,122,82,0.20)' },
  MONITOR: { label: 'Monitor', color: '#B7791F', bg: 'rgba(183,121,31,0.10)', border: 'rgba(183,121,31,0.20)' },
  ACTION_NEEDED: { label: 'Action needed', color: '#ea580c', bg: 'rgba(234,88,12,0.10)', border: 'rgba(234,88,12,0.20)' },
  EXIT: { label: 'Exit', color: '#C94F4F', bg: 'rgba(201,79,79,0.10)', border: 'rgba(201,79,79,0.20)' },
};
