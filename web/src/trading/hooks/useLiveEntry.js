/**
 * useLiveEntry — fetches live Alpaca option chains for a batch of tiles
 * and matches each leg to its current bid/ask/mid.
 *
 * Returns enriched data for the EntryConfirmModal.
 */

import { useState, useCallback } from 'react';
import { fetchLiveChain, matchOptionLeg } from '../api/r2Api';

/**
 * Match a tile's legs against a live option chain.
 * @param {Object} tile
 * @param {Array} chain — from fetchLiveChain
 * @returns {{ legs: Array, netCredit: number, hasPricing: boolean }}
 *   legs[].liveMid/liveBid/liveAsk are per-share
 *   netCredit is per-contract $
 */
function matchLegs(tile, chain) {
  const tileLegs = tile.legs || [];
  const expiry = tile.expiry;
  let netCredit = 0;
  let hasPricing = false;

  const legs = tileLegs.map((leg, i) => {
    const type = (leg.type || '').toLowerCase();
    const strike = leg.strike;

    // Find matching contract in chain
    const match = chain?.find(c =>
      Number(c.strike) === Number(strike) && c.type === type
    ) || null;

    const liveMid = match?.mid ?? null;
    const liveBid = match?.bid ?? null;
    const liveAsk = match?.ask ?? null;
    const liveIv = match?.iv ?? null;
    const liveDelta = match?.delta ?? null;

    const scanPremium = leg.premium ?? 0; // per-share from pipeline
    const bestPremium = liveMid ?? scanPremium;

    if (liveMid != null) hasPricing = true;

    if (leg.action === 'sell') netCredit += bestPremium;
    else netCredit -= bestPremium;

    return {
      legIndex: i,
      type: leg.type,
      action: leg.action,
      strike,
      expiry: leg.expiry || expiry,
      scanPremium,   // per-share (from R2/pipeline)
      liveMid,       // per-share (from Alpaca)
      liveBid,       // per-share
      liveAsk,       // per-share
      liveIv,
      liveDelta,
      // The price that will be used for entry
      mid: liveMid ?? scanPremium,
      iv: liveIv ?? leg.iv ?? null,
      delta: liveDelta ?? leg.delta ?? null,
    };
  });

  return {
    legs,
    netCredit: parseFloat((netCredit * 100).toFixed(2)), // per-contract $
    hasPricing,
  };
}

export function useLiveEntry() {
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState(null); // Map<tileId, { tile, legs, netCredit, hasPricing }>
  const [error, setError] = useState(null);

  /**
   * Fetch live prices for a batch of tiles.
   * @param {Array} tiles — tiles to price
   */
  const fetchPrices = useCallback(async (tiles) => {
    if (!tiles || tiles.length === 0) return;
    setLoading(true);
    setError(null);

    try {
      // Dedupe by symbol+expiry to avoid redundant fetches
      const chainMap = new Map(); // symbol:expiry → chain
      const fetchJobs = [];
      for (const tile of tiles) {
        const key = `${tile.symbol}:${tile.expiry}`;
        if (!chainMap.has(key) && tile.symbol && tile.expiry) {
          const job = fetchLiveChain(tile.symbol, tile.expiry)
            .then(chain => chainMap.set(key, chain))
            .catch(() => chainMap.set(key, null));
          fetchJobs.push(job);
        }
      }
      await Promise.all(fetchJobs);

      // Match legs for each tile
      const result = new Map();
      for (const tile of tiles) {
        const key = `${tile.symbol}:${tile.expiry}`;
        const chain = chainMap.get(key) || null;
        const matched = matchLegs(tile, chain);
        result.set(tile.id, { tile, ...matched });
      }

      setEntries(result);
    } catch (err) {
      console.error('[useLiveEntry] Failed:', err);
      setError('Failed to fetch live prices. You can still execute with scan prices.');
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, entries, error, fetchPrices };
}
