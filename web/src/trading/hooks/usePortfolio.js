/**
 * usePortfolio — manages user positions (self-contained, no tile dependency).
 *
 * Collection: users/{uid}/positions/{posId}
 *
 * Each position stores ALL data needed to render and calculate P&L:
 *   - symbol, strategyType, legs[] with entry premiums
 *   - maxProfit, maxLoss, probability (copied from tile at entry)
 *   - expiry, entryDate, entrySpot, entryNetCredit
 *
 * Auto-expiry: on load, any active position past expiry is auto-closed
 * with P&L booked at intrinsic value.
 *
 * Units: premiums are per-share, entryNetCredit/realizedPnl are per-contract ($).
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, updateDoc, serverTimestamp, increment } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../shared/hooks/useAuth';
import { pnlAtPrice } from '../utils/pnlCalculator';

// ── Hook ─────────────────────────────────────────────────────────────────────

export function usePortfolio() {
  const { user } = useAuth();
  const [portfolioItems, setPortfolioItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const autoExpiredRef = useRef(new Set()); // track already-processed to avoid loops

  // ── Real-time listener ───
  useEffect(() => {
    if (!user) {
      setPortfolioItems([]);
      setLoading(false);
      return;
    }

    const positionsRef = collection(db, 'users', user.uid, 'positions');
    const q = query(positionsRef);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setPortfolioItems(items);
        setLoading(false);
        setError(null);
      },
      (err) => {
        console.error('[usePortfolio] Listener error:', err);
        setError(err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // ── Auto-expiry: close expired positions on load ───
  useEffect(() => {
    if (!user || loading || portfolioItems.length === 0) return;

    const now = new Date();
    const expiredActive = portfolioItems.filter(p => {
      if (p.status !== 'active') return false;
      if (autoExpiredRef.current.has(p.id)) return false;
      if (!p.expiry) return false;
      const expiryDate = new Date(p.expiry + 'T16:00:00');
      return expiryDate < now;
    });

    if (expiredActive.length === 0) return;

    const autoClose = async () => {
      for (const pos of expiredActive) {
        autoExpiredRef.current.add(pos.id);
        const spot = pos.currentUnderlyingPrice || pos.entrySpot || 0;
        const pnl = pnlAtPrice(pos.legs || [], spot);

        try {
          // Close the position
          const posRef = doc(db, 'users', user.uid, 'positions', pos.id);
          await updateDoc(posRef, {
            status: 'closed',
            closeReason: 'expired',
            closedAt: new Date().toISOString(),
            realizedPnl: pnl,
            updatedAt: serverTimestamp(),
          });

          // Update cumulative P&L on settings doc
          const settingsRef = doc(db, 'users', user.uid, 'portfolioSettings', 'config');
          await updateDoc(settingsRef, {
            cumulativePnl: increment(pnl * (pos.quantity || 1)),
            totalTrades: increment(1),
            ...(pnl >= 0 ? { wins: increment(1) } : { losses: increment(1) }),
          }).catch(() => {
            // Settings doc might not exist yet — create with setDoc
            setDoc(settingsRef, {
              cumulativePnl: pnl * (pos.quantity || 1),
              totalTrades: 1,
              wins: pnl >= 0 ? 1 : 0,
              losses: pnl < 0 ? 1 : 0,
            }, { merge: true });
          });

          console.log(`[usePortfolio] Auto-closed expired position ${pos.symbol} ${pos.strategyType}: $${pnl}`);
        } catch (err) {
          console.error(`[usePortfolio] Failed to auto-close ${pos.id}:`, err);
        }
      }
    };

    autoClose();
  }, [user, loading, portfolioItems]);

  // ── Add position (self-contained) ───
  const addPosition = useCallback(async (tile, liveLegPrices = null) => {
    if (!user || !tile?.id) throw new Error('User and tile required');

    const tileLegs = tile.legs || [];
    let netCredit = 0;
    const legs = tileLegs.map((leg, i) => {
      // Use live prices if available, otherwise fall back to tile premiums
      const livePrice = liveLegPrices?.[i];
      const premium = livePrice?.mid ?? leg.premium ?? 0;
      const iv = livePrice?.iv ?? leg.iv ?? null;

      if (leg.action === 'sell') netCredit += premium;
      else netCredit -= premium;

      return {
        legIndex: i,
        type: leg.type,
        action: leg.action,
        strike: leg.strike || 0,
        expiry: leg.expiry || tile.expiry || null,
        entryPremium: premium,    // per-share
        entryIv: iv,
        delta: livePrice?.delta ?? leg.delta ?? null,
      };
    });

    const positionId = tile.id; // use tile ID as position ID for easy linking
    const posRef = doc(db, 'users', user.uid, 'positions', positionId);

    await setDoc(posRef, {
      // ─── Identity ───
      tileId: tile.id,
      symbol: tile.symbol,
      strategyType: tile.strategy || tile.strategyType || 'unknown',

      // ─── Legs (self-contained, all entry data) ───
      legs,

      // ─── Entry pricing (per-contract $) ───
      entryNetCredit: parseFloat((netCredit * 100).toFixed(2)),
      entryDate: new Date().toISOString().split('T')[0],
      entrySpot: tile.underlyingPrice || 0,

      // ─── Strategy metrics (copied from tile — self-contained) ───
      maxProfit: tile.maxProfit || 0,
      maxLoss: tile.maxLoss || 0,
      probability: tile.oddsOfProfit || tile.probOfProfit || tile.probability || 0,
      daysToExpiry: tile.daysToExpiry || 0,
      expiry: tile.expiry || null,

      // ─── Position state ───
      status: 'active',
      quantity: 1,
      realizedPnl: 0,
      currentUnderlyingPrice: tile.underlyingPrice || 0,

      // ─── Timestamps ───
      addedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return positionId;
  }, [user]);

  // ── Close position (manual or adjustment) ───
  const closePosition = useCallback(async (posId, realizedPnl, reason = 'manual') => {
    if (!user) return;

    const pos = portfolioItems.find(p => p.id === posId);
    const qty = pos?.quantity || 1;
    const totalPnl = realizedPnl * qty;

    // Close the position
    const posRef = doc(db, 'users', user.uid, 'positions', posId);
    await updateDoc(posRef, {
      status: 'closed',
      closeReason: reason,
      closedAt: new Date().toISOString(),
      realizedPnl,
      updatedAt: serverTimestamp(),
    });

    // Update cumulative P&L
    const settingsRef = doc(db, 'users', user.uid, 'portfolioSettings', 'config');
    await setDoc(settingsRef, {
      cumulativePnl: increment(totalPnl),
      totalTrades: increment(1),
      ...(totalPnl >= 0 ? { wins: increment(1) } : { losses: increment(1) }),
    }, { merge: true });
  }, [user, portfolioItems]);

  // ── Update quantity ───
  const updateQuantity = useCallback(async (posId, newQuantity) => {
    if (!user) return;
    const posRef = doc(db, 'users', user.uid, 'positions', posId);
    await updateDoc(posRef, { quantity: newQuantity, updatedAt: serverTimestamp() });
  }, [user]);

  // ── Update arbitrary fields ───
  const updatePosition = useCallback(async (posId, fields) => {
    if (!user) return;
    const posRef = doc(db, 'users', user.uid, 'positions', posId);
    await updateDoc(posRef, { ...fields, updatedAt: serverTimestamp() });
  }, [user]);

  // ── Check if position exists ───
  const isInPortfolio = useCallback((tileId) => {
    return portfolioItems.some(item => item.tileId === tileId || item.id === tileId);
  }, [portfolioItems]);

  // ── Derived data ───
  const activePositions = portfolioItems.filter(p => p.status === 'active');
  const closedPositions = portfolioItems.filter(p => p.status === 'closed');

  return {
    portfolioItems,
    activePositions,
    closedPositions,
    loading,
    error,
    addPosition,
    closePosition,
    updateQuantity,
    updatePosition,
    isInPortfolio,
    // Legacy compat (used by existing pages until they're rewritten)
    addToPortfolio: addPosition,
    removeFromPortfolio: async (id) => { if (user) await deleteDoc(doc(db, 'users', user.uid, 'positions', id)); },
    updateStatus: async (id, status) => { if (user) await updateDoc(doc(db, 'users', user.uid, 'positions', id), { status, updatedAt: serverTimestamp() }); },
    updatePortfolioItem: async (id, fields) => updatePosition(id, fields),
  };
}
