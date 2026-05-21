/**
 * usePositionLiveData — single data source for PositionDetail page.
 * Fetches live option chain from newleaf-api (Alpaca), falls back to R2 data.
 * Calculates live P&L, Greeks, risk scenarios, and status.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import { fetchR2Report, fetchLiveChain } from '../api/r2Api';
import { calculatePositionPnl, getStrategyStatus, recalculateGreeks, pnlAtPrice } from '../utils/pnlCalculator';

export function usePositionLiveData(tile, portfolioItem) {
  const [r2Data, setR2Data] = useState(null);
  const [liveChain, setLiveChain] = useState(null);
  const [loading, setLoading] = useState(true);

  const symbol = tile?.symbol;
  const expiry = portfolioItem?.expiry || tile?.expiry;
  const quantity = portfolioItem?.quantity || 1;
  const maxProfit = tile?.maxProfit || 0;
  const maxLoss = tile?.maxLoss || 0;
  const legs = portfolioItem?.legs || tile?.legs || [];

  // Fetch live chain from newleaf-api + R2 data (for spot price fallback)
  const fetchData = useCallback(async () => {
    if (!symbol) return;
    try {
      const [report, chain] = await Promise.allSettled([
        fetchR2Report(symbol),
        expiry ? fetchLiveChain(symbol, expiry) : Promise.resolve(null),
      ]);
      if (report.status === 'fulfilled') setR2Data(report.value);
      if (chain.status === 'fulfilled' && chain.value) setLiveChain(chain.value);
    } catch (err) {
      console.warn('[usePositionLiveData] Fetch failed:', err.message);
    } finally {
      setLoading(false);
    }
  }, [symbol, expiry]);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Current spot price
  const currentSpot = useMemo(() =>
    r2Data?.snapshot?.price || r2Data?.price || tile?.underlyingPrice || 0,
    [r2Data, tile]
  );

  // Entry price
  const entrySpot = portfolioItem?.entryUnderlyingPrice || tile?.publishedSpotPrice || tile?.underlyingPrice || 0;

  // Best available option chain: live (Alpaca) → R2 (pipeline)
  const optionChain = liveChain || r2Data?.optionChain || null;

  // Live P&L
  const pnlResult = useMemo(() => {
    if (!portfolioItem || !currentSpot) return { unrealizedPnl: 0, rawPnl: 0, currentNetValue: 0, entryNetCredit: 0, method: 'none', legDetails: [] };
    return calculatePositionPnl({ ...portfolioItem, tile }, currentSpot, optionChain);
  }, [portfolioItem, tile, currentSpot, optionChain]);

  // Strategy status
  const strategyStatus = useMemo(() => {
    if (!portfolioItem || !currentSpot) return { status: 'Unknown', severity: 'none', suggestion: '', urgency: 'none', details: {} };
    return getStrategyStatus({ ...portfolioItem, tile }, currentSpot, pnlResult);
  }, [portfolioItem, tile, currentSpot, pnlResult]);

  // Live Greeks — prefer API greeks when available
  const liveGreeks = useMemo(() => {
    if (!currentSpot || legs.length === 0) return { net: { delta: 0, gamma: 0, theta: 0, vega: 0 }, perLeg: [] };

    // If we have live chain with greeks, use them directly
    if (liveChain && expiry) {
      let netDelta = 0, netGamma = 0, netTheta = 0, netVega = 0;
      const perLeg = [];

      for (const leg of legs) {
        const type = (leg.type || '').toLowerCase();
        const action = (leg.action || '').toLowerCase();
        const mult = action === 'sell' ? -1 : 1;

        const match = liveChain.find(c =>
          Number(c.strike) === Number(leg.strike) && c.type === type
        );

        if (match && match.delta != null) {
          const d = match.delta * mult;
          const g = (match.gamma || 0) * mult;
          const t = (match.theta || 0) * mult;
          const v = (match.vega || 0) * mult;
          netDelta += d; netGamma += g; netTheta += t; netVega += v;
          perLeg.push({ delta: +d.toFixed(4), gamma: +g.toFixed(4), theta: +t.toFixed(4), vega: +v.toFixed(4) });
        } else {
          perLeg.push({ delta: 0, gamma: 0, theta: 0, vega: 0 });
        }
      }

      return {
        net: { delta: +netDelta.toFixed(4), gamma: +netGamma.toFixed(4), theta: +netTheta.toFixed(4), vega: +netVega.toFixed(4) },
        perLeg,
      };
    }

    // Fallback: BS-estimated greeks
    return recalculateGreeks(legs, currentSpot, expiry);
  }, [legs, currentSpot, expiry, liveChain]);

  // Per-contract and total P&L
  const pnlPerContract = pnlResult.unrealizedPnl;
  const pnlTotal = pnlPerContract * quantity;

  // Progress: map P&L onto -maxLoss ↔ +maxProfit scale (0% = max loss, 100% = max profit)
  const progressPct = useMemo(() => {
    if (!maxLoss && !maxProfit) return 50;
    const range = maxLoss + maxProfit;
    if (range === 0) return 50;
    return Math.max(0, Math.min(100, ((pnlPerContract + maxLoss) / range) * 100));
  }, [pnlPerContract, maxLoss, maxProfit]);

  // Profit capture percentage
  const profitCapturePct = useMemo(() => {
    if (pnlPerContract >= 0 && maxProfit > 0) return Math.round((pnlPerContract / maxProfit) * 100);
    if (pnlPerContract < 0 && maxLoss > 0) return -Math.round((Math.abs(pnlPerContract) / maxLoss) * 100);
    return 0;
  }, [pnlPerContract, maxProfit, maxLoss]);

  // Risk scenarios at current spot
  const riskScenarios = useMemo(() => {
    if (!currentSpot || legs.length === 0) return [];
    return [
      { label: 'Bullish +10%', pct: '+10%', price: currentSpot * 1.1, pnl: pnlAtPrice(legs, currentSpot * 1.1), desc: `If ${symbol} rises 10%` },
      { label: 'No Move', pct: '0%', price: currentSpot, pnl: pnlAtPrice(legs, currentSpot), desc: `If ${symbol} stays flat` },
      { label: 'Bearish -10%', pct: '-10%', price: currentSpot * 0.9, pnl: pnlAtPrice(legs, currentSpot * 0.9), desc: `If ${symbol} falls 10%` },
    ];
  }, [currentSpot, legs, symbol]);

  // DTE
  const dte = useMemo(() => {
    if (!expiry) return null;
    return Math.max(0, Math.round((new Date(expiry + 'T16:00:00') - new Date()) / 86400000));
  }, [expiry]);

  // Price move since entry
  const priceMove = currentSpot && entrySpot ? ((currentSpot - entrySpot) / entrySpot * 100) : 0;

  return {
    loading,
    currentSpot,
    entrySpot,
    priceMove,
    dte,
    quantity,
    maxProfit,
    maxLoss,
    pnlResult,
    pnlPerContract,
    pnlTotal,
    progressPct,
    profitCapturePct,
    strategyStatus,
    liveGreeks,
    riskScenarios,
    legDetails: pnlResult.legDetails,
    r2Chain: optionChain,
    refetch: fetchData,
  };
}
