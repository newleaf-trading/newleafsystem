/**
 * StrategyRouter — route /invest/strategy/:id to the right page.
 *
 * Open position → DefendPage (mock 03)
 * Candidate     → DecidePage (mock 05, not yet built — falls back to StrategyDetailPage)
 * Unknown       → StrategyDetailPage (legacy)
 *
 * This component sits at the route level and handles data loading +
 * canonical normalization, so DefendPage/DecidePage receive a clean
 * CanonicalPosition and never touch Firestore directly.
 *
 * Loading states:
 *   1. Portfolio resolving  → "Loading position…"
 *   2. Owned, live data resolving (loading=true) → "Loading live data…"
 *   3. Owned, live data resolved → DefendPage
 *   4. Owned, live data failed (no tile / deactivated) → terminal "Position data unavailable"
 *   5. Not owned → StrategyDetailPage (legacy)
 */

import { useParams, useNavigate } from 'react-router-dom';
import { useMemo, useCallback } from 'react';
import { usePortfolio } from '../hooks/usePortfolio';
import { useShortlist } from '../hooks/useShortlist';
import { usePositionLiveData } from '../hooks/usePositionLiveData';
import { toCanonical, tileToCanonical } from '../lib/toCanonical';
import { DefendPage } from './DefendPage';
import { DecidePage } from './DecidePage';
import { StrategyDetailPage } from './StrategyDetailPage';

function LoadingState({ message }) {
  return (
    <div style={{
      textAlign: 'center', padding: 60, color: '#6b7280',
      fontFamily: "'DM Sans', sans-serif", fontSize: 14,
    }}>
      {message}
    </div>
  );
}

export function StrategyRouter({ tiles, onOpenChat }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { portfolioItems, loading: portfolioLoading } = usePortfolio();
  const { addToShortlist } = useShortlist();

  const tile = tiles?.find(t => t.id === id);
  const portfolioItem = portfolioItems.find(p => p.tileId === id || p.id === id) || null;
  const isOwned = !!portfolioItem && portfolioItem.status === 'active';

  const handleTake = useCallback(async () => {
    if (!tile) {
      alert('Tile not found — cannot add to build.');
      return;
    }
    try {
      await addToShortlist(tile);
      navigate('/invest/build');
    } catch (err) {
      console.error('[handleTake] Failed:', err);
      alert('Failed to add to build: ' + err.message);
    }
  }, [tile, addToShortlist, navigate]);

  // Always call the hook (React rules). Pass tile for both owned AND candidate
  // so we get live spot price for candidates too.
  const liveData = usePositionLiveData(
    tile || null,
    isOwned ? portfolioItem : null,
  );

  // Build canonical position for DefendPage — only after live data has resolved
  const canonical = useMemo(() => {
    if (!isOwned || !portfolioItem) return null;
    // Don't build canonical while live data is still loading — prevents $0 flash
    if (liveData.loading) return null;

    // Pass pnlPerContract as null only if it's the hook's uninitialised default
    // (method=none means no real calculation happened — e.g. tile deactivated, no chain)
    const hasPnl = liveData.pnlResult?.method !== 'none';

    return toCanonical(portfolioItem, {
      pnlPerContract: hasPnl ? liveData.pnlPerContract : null,
      spot: liveData.currentSpot || undefined,
      dte: liveData.dte ?? undefined,
      legs: liveData.legDetails?.map((ld, i) => {
        const origLeg = portfolioItem.legs?.[i];
        return origLeg ? {
          ...origLeg,
          currentPrice: ld?.currentPrice ?? ld?.currentPremium ?? undefined,
        } : null;
      }).filter(Boolean) ?? undefined,
    });
  }, [isOwned, portfolioItem, liveData]);

  // ── Routing waterfall ──

  // 1. Portfolio still resolving
  if (portfolioLoading) {
    return <LoadingState message="Loading position…" />;
  }

  // 2–4. Owned position
  if (isOwned) {
    // 2. Live data still loading
    if (liveData.loading) {
      return <LoadingState message="Loading live data…" />;
    }

    // 3. Live data resolved with real P&L → DefendPage
    if (canonical && canonical.pnlTotal != null) {
      return <DefendPage position={canonical} onOpenChat={onOpenChat} />;
    }

    // 4. Live data resolved but no usable P&L (tile deactivated, no chain match,
    //    or markets never ran for this symbol). Terminal state, not a spinner.
    return (
      <div style={{
        textAlign: 'center', padding: 60, color: '#6b7280',
        fontFamily: "'DM Sans', sans-serif", fontSize: 14,
        maxWidth: 480, margin: '0 auto', lineHeight: 1.6,
      }}>
        <div style={{ fontSize: 28, marginBottom: 12 }}>📊</div>
        <b style={{ color: '#172033' }}>Position data unavailable</b>
        <p style={{ marginTop: 8 }}>
          Live pricing could not be loaded for {portfolioItem?.symbol || 'this position'}.
          This can happen outside market hours or if the strategy tile is no longer active.
          Data will refresh automatically when markets reopen.
        </p>
      </div>
    );
  }

  // 5. Not owned — candidate or browse
  if (tile) {
    const candidate = tileToCanonical(tile);
    // Override with live spot if available (tile.underlyingPrice is stale published-time price)
    if (liveData.currentSpot > 0) {
      candidate.spot = liveData.currentSpot;
    }
    // Pass published date from tile
    const publishedAt = tile.createdAt?.toDate?.() || (tile.createdAt?.seconds ? new Date(tile.createdAt.seconds * 1000) : null);
    candidate.publishedAt = publishedAt?.toISOString?.() || null;
    candidate.publishedSpot = tile.publishedSpotPrice || tile.underlyingPrice || 0;
    return <DecidePage position={candidate} onTake={handleTake} onOpenChat={onOpenChat} />;
  }

  // 6. Tile not found — fallback to legacy
  return <StrategyDetailPage tiles={tiles} onOpenChat={onOpenChat} />;
}
