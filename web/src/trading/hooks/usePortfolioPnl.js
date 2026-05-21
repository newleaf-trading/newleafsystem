/**
 * usePortfolioPnl — Live P&L calculation for portfolio positions.
 *
 * Subscribes to PriceContext for underlying prices, fetches R2 option chain
 * data, and calculates live unrealized P&L for each portfolio item using
 * the 3-tier approach in pnlCalculator.js.
 *
 * Returns enriched portfolio items with live P&L and strategy status.
 * Optionally writes back to Firestore (throttled).
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { fetchR2Report } from '../api/r2Api';
import { calculatePositionPnl, getStrategyStatus } from '../utils/pnlCalculator';

export function usePortfolioPnl(portfolioItems, tiles) {
  const [r2Data, setR2Data] = useState({});        // { SYMBOL: { optionChain, spot } }
  const [spotPrices, setSpotPrices] = useState({}); // { SYMBOL: price }

  // Get unique symbols from active portfolio items
  const activeItems = useMemo(() =>
    (portfolioItems || []).filter(p => p.status !== 'closed'),
    [portfolioItems]
  );

  const symbols = useMemo(() =>
    [...new Set(activeItems.map(p => p.symbol).filter(Boolean))],
    [activeItems]
  );

  // Fetch R2 reports + spot prices for all portfolio symbols
  const fetchPriceData = useCallback(async () => {
    if (symbols.length === 0) return;

    const newR2 = {};
    const newSpots = {};

    await Promise.allSettled(symbols.map(async (sym) => {
      try {
        const report = await fetchR2Report(sym);
        newR2[sym] = {
          optionChain: report.optionChain || [],
          spot: report.snapshot?.price || report.price || 0,
          iv: report.gammaData?.ivData || null,
        };
        newSpots[sym] = report.snapshot?.price || report.price || 0;
      } catch (err) {
        console.warn(`[usePortfolioPnl] R2 fetch failed for ${sym}:`, err.message);
      }
    }));

    setR2Data(prev => ({ ...prev, ...newR2 }));
    setSpotPrices(prev => ({ ...prev, ...newSpots }));
  }, [symbols]);

  // Fetch on mount and every 60s
  useEffect(() => {
    fetchPriceData();
    const interval = setInterval(fetchPriceData, 60_000);
    return () => clearInterval(interval);
  }, [fetchPriceData]);

  // Calculate P&L for all items
  const enrichedItems = useMemo(() => {
    return (portfolioItems || []).map(item => {
      if (item.status === 'closed') {
        return {
          ...item,
          livePnl: item.realizedPnl || item.unrealizedPnl || 0,
          pnlMethod: 'closed',
          strategyStatus: { status: 'Closed', severity: 'none', suggestion: '', urgency: 'none', details: {} },
        };
      }

      const sym = item.symbol;
      const tile = tiles?.find(t => t.id === (item.tileId || item.id)) || {};
      const currentSpot = spotPrices[sym] || tile.underlyingPrice || 0;
      const r2Chain = r2Data[sym]?.optionChain || null;

      // Merge tile data into item for calculation
      const calcItem = { ...item, tile };
      const pnlResult = calculatePositionPnl(calcItem, currentSpot, r2Chain);
      const strategyStatus = getStrategyStatus(calcItem, currentSpot, pnlResult);

      return {
        ...item,
        livePnl: pnlResult.unrealizedPnl,
        currentNetValue: pnlResult.currentNetValue,
        pnlMethod: pnlResult.method,
        legDetails: pnlResult.legDetails,
        currentSpot,
        strategyStatus,
      };
    });
  }, [portfolioItems, tiles, spotPrices, r2Data]);

  // Summary stats
  const summary = useMemo(() => {
    const active = enrichedItems.filter(i => i.status !== 'closed');
    const closed = enrichedItems.filter(i => i.status === 'closed');
    const totalUnrealized = active.reduce((s, i) => s + ((i.livePnl || 0) * (i.quantity || 1)), 0);
    const totalRealized = closed.reduce((s, i) => s + ((i.realizedPnl || i.livePnl || 0) * (i.quantity || 1)), 0);
    const criticalCount = active.filter(i => i.strategyStatus?.urgency === 'critical').length;
    const takeProfitCount = active.filter(i => i.strategyStatus?.status === 'Take Profit').length;

    return {
      totalUnrealized: Math.round(totalUnrealized * 100) / 100,
      totalRealized: Math.round(totalRealized * 100) / 100,
      totalPnl: Math.round((totalUnrealized + totalRealized) * 100) / 100,
      activeCount: active.length,
      closedCount: closed.length,
      criticalCount,
      takeProfitCount,
    };
  }, [enrichedItems]);

  return { enrichedItems, summary, spotPrices, refetch: fetchPriceData };
}
