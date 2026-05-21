import { useState, useEffect, useCallback } from 'react';
import { collection, query, getDocs, doc, updateDoc, orderBy, where, serverTimestamp, writeBatch, addDoc, setDoc, getDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../shared/hooks/useAuth';

/**
 * Admin hook — direct Firestore access for admin operations.
 * Requires admin email in Firestore rules.
 */
export function useAdmin() {
  const { user } = useAuth();
  const [tiles, setTiles] = useState([]);
  const [users, setUsers] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [impersonatedUserId, setImpersonatedUserId] = useState(null);
  const [pnlHistory, setPnlHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const isAdmin = !!user;

  // Get current user ID (impersonated or actual)
  const getCurrentUserId = useCallback(() => {
    return impersonatedUserId || user?.uid;
  }, [impersonatedUserId, user]);

  // ── Load all tiles ──
  const loadTiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tilesRef = collection(db, 'tiles');
      const q = query(tilesRef, orderBy('sortOrder', 'asc'));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setTiles(data);
    } catch (err) {
      console.error('Admin loadTiles error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Load all users with portfolios ──
  const loadUsers = useCallback(async () => {
    const currentUserId = getCurrentUserId();
    if (!currentUserId) return;
    setLoading(true);
    setError(null);
    try {
      const portfolioRef = collection(db, 'users', currentUserId, 'portfolio');
      const portfolioSnap = await getDocs(portfolioRef);
      const items = portfolioSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      const currentUser = impersonatedUserId
        ? allUsers.find(u => u.uid === impersonatedUserId)
        : { uid: user.uid, email: user.email, displayName: user.displayName };

      setUsers([{
        uid: currentUserId,
        email: currentUser?.email || 'Unknown',
        displayName: currentUser?.displayName || currentUser?.email || 'Unknown User',
        portfolio: items,
      }]);
    } catch (err) {
      console.error('Admin loadUsers error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [user, getCurrentUserId, impersonatedUserId, allUsers]);

  // ── Update a tile field ──
  const updateTile = useCallback(async (tileId, fields) => {
    try {
      const ref = doc(db, 'tiles', tileId);
      await updateDoc(ref, { ...fields, lastUpdated: serverTimestamp() });
      setTiles(prev => prev.map(t => t.id === tileId ? { ...t, ...fields } : t));
      return true;
    } catch (err) {
      console.error('Admin updateTile error:', err);
      setError(err.message);
      return false;
    }
  }, []);

  // ── Update a specific leg on a TILE (not portfolio) ──
  const updateTileLeg = useCallback(async (tileId, legIndex, legFields) => {
    const tile = tiles.find(t => t.id === tileId);
    if (!tile?.legs) return false;
    try {
      const updatedLegs = tile.legs.map((leg, i) =>
        i === legIndex ? { ...leg, ...legFields } : leg
      );
      const ref = doc(db, 'tiles', tileId);
      await updateDoc(ref, { legs: updatedLegs, lastUpdated: serverTimestamp() });
      setTiles(prev => prev.map(t => t.id === tileId ? { ...t, legs: updatedLegs } : t));
      return true;
    } catch (err) {
      console.error('Admin updateTileLeg error:', err);
      setError(err.message);
      return false;
    }
  }, [tiles]);

  // ── Update a portfolio item for a specific user ──
  const updatePortfolioItem = useCallback(async (userId, tileId, fields) => {
    try {
      const ref = doc(db, 'users', userId, 'portfolio', tileId);
      await updateDoc(ref, { ...fields, updatedAt: serverTimestamp() });
      setUsers(prev => prev.map(u => {
        if (u.uid !== userId) return u;
        return {
          ...u,
          portfolio: u.portfolio.map(p => p.id === tileId ? { ...p, ...fields } : p)
        };
      }));
      return true;
    } catch (err) {
      console.error('Admin updatePortfolioItem error:', err);
      setError(err.message);
      return false;
    }
  }, []);

  // ── Refresh DTE for all tiles ──
  const refreshDTE = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tilesRef = collection(db, 'tiles');
      const q = query(tilesRef, where('isActive', '==', true));
      const snap = await getDocs(q);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const batch = writeBatch(db);
      let updated = 0;

      snap.docs.forEach(docSnap => {
        const data = docSnap.data();
        if (data.expiry) {
          const expiryDate = new Date(data.expiry);
          expiryDate.setHours(0, 0, 0, 0);
          const diffMs = expiryDate - today;
          const newDte = Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
          if (newDte !== data.daysToExpiry) {
            batch.update(docSnap.ref, { daysToExpiry: newDte, lastUpdated: serverTimestamp() });
            updated++;
          }
        }
      });

      if (updated > 0) await batch.commit();
      await loadTiles();
      return { updated, total: snap.size };
    } catch (err) {
      console.error('Admin refreshDTE error:', err);
      setError(err.message);
      return { updated: 0, total: 0 };
    } finally {
      setLoading(false);
    }
  }, [loadTiles]);

  // ── Bulk update expiry date for selected tiles ──
  const bulkUpdateExpiry = useCallback(async (tileIds, newExpiry) => {
    setLoading(true);
    try {
      const batch = writeBatch(db);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const expiryDate = new Date(newExpiry);
      expiryDate.setHours(0, 0, 0, 0);
      const newDte = Math.max(0, Math.ceil((expiryDate - today) / (1000 * 60 * 60 * 24)));

      tileIds.forEach(tileId => {
        const ref = doc(db, 'tiles', tileId);
        batch.update(ref, {
          expiry: newExpiry,
          daysToExpiry: newDte,
          lastUpdated: serverTimestamp(),
        });
      });

      for (const tileId of tileIds) {
        const tile = tiles.find(t => t.id === tileId);
        if (tile?.legs) {
          const updatedLegs = tile.legs.map(l => ({ ...l, expiry: newExpiry }));
          const ref = doc(db, 'tiles', tileId);
          batch.update(ref, { legs: updatedLegs });
        }
      }

      await batch.commit();
      await loadTiles();
      return true;
    } catch (err) {
      console.error('Admin bulkUpdateExpiry error:', err);
      setError(err.message);
      return false;
    } finally {
      setLoading(false);
    }
  }, [tiles, loadTiles]);

  // ── Seed realistic test P&L data for all portfolio positions ──
  const seedTestPnl = useCallback(async () => {
    if (!user) return { updated: 0 };
    setLoading(true);
    setError(null);
    try {
      const portfolioRef = collection(db, 'users', user.uid, 'portfolio');
      const portfolioSnap = await getDocs(portfolioRef);
      const batch = writeBatch(db);

      const testData = {
        'iron_condor': { entryNetCredit: 310, currentNetValue: 140, unrealizedPnl: 170, entryDate: '2025-01-15' },
        'bull_call_spread': { entryNetCredit: -480, currentNetValue: 620, unrealizedPnl: 140, entryDate: '2025-01-20' },
        'bull_put_spread': { entryNetCredit: 250, currentNetValue: 90, unrealizedPnl: 160, entryDate: '2025-01-18' },
        'covered_call_protective_put': { entryNetCredit: 420, currentNetValue: 280, unrealizedPnl: 140, entryDate: '2025-01-10' },
        'bear_put_spread': { entryNetCredit: -350, currentNetValue: 510, unrealizedPnl: 160, entryDate: '2025-01-22' },
      };
      const defaultData = { entryNetCredit: 200, currentNetValue: 80, unrealizedPnl: 120, entryDate: '2025-01-15' };

      let updated = 0;
      portfolioSnap.docs.forEach(docSnap => {
        const data = docSnap.data();
        const strategy = (data.strategy || '').toLowerCase();

        let seed = defaultData;
        for (const [key, val] of Object.entries(testData)) {
          if (strategy.includes(key) || strategy.replace(/_/g, ' ').includes(key.replace(/_/g, ' '))) {
            seed = val;
            break;
          }
        }

        const variance = ((data.symbol || '').charCodeAt(0) % 5) * 15 - 30;
        const pnl = seed.unrealizedPnl + variance;

        batch.update(docSnap.ref, {
          entryNetCredit: seed.entryNetCredit,
          currentNetValue: seed.currentNetValue + variance,
          unrealizedPnl: pnl,
          realizedPnl: 0,
          entryDate: seed.entryDate,
          lastPriceUpdate: new Date().toISOString(),
          updatedAt: serverTimestamp(),
        });
        updated++;
      });

      if (updated > 0) await batch.commit();
      await loadUsers();
      return { updated };
    } catch (err) {
      console.error('Admin seedTestPnl error:', err);
      setError(err.message);
      return { updated: 0 };
    } finally {
      setLoading(false);
    }
  }, [user, loadUsers]);

  // ── Populate legs from tile data ──
  const populateLegs = useCallback(async (userId, tileId) => {
    const tile = tiles.find(t => t.id === tileId);
    if (!tile || !tile.legs?.length) return false;
    try {
      let netCredit = 0;
      const portfolioLegs = tile.legs.map((leg, i) => {
        const premium = leg.premium || 0;
        if (leg.action === 'sell') netCredit += premium;
        else netCredit -= premium;
        return {
          legIndex: i,
          type: leg.type,
          action: leg.action,
          strike: leg.strike || 0,
          expiry: leg.expiry || tile.expiry || null,
          entryPremium: premium,
          currentPremium: 0,
        };
      });
      const ref = doc(db, 'users', userId, 'portfolio', tileId);
      await updateDoc(ref, {
        legs: portfolioLegs,
        entryNetCredit: parseFloat((netCredit * 100).toFixed(2)),
        entryUnderlyingPrice: tile.underlyingPrice || 0,
        expiry: tile.expiry || null,
        entryDate: new Date().toISOString().split('T')[0],
        status: 'active',
        updatedAt: serverTimestamp(),
      });
      setUsers(prev => prev.map(u => {
        if (u.uid !== userId) return u;
        return { ...u, portfolio: u.portfolio.map(p => p.id === tileId ? {
          ...p, legs: portfolioLegs, entryNetCredit: parseFloat((netCredit * 100).toFixed(2)),
          entryUnderlyingPrice: tile.underlyingPrice || 0, expiry: tile.expiry || null, status: 'active',
        } : p) };
      }));
      return true;
    } catch (err) {
      console.error('Admin populateLegs error:', err);
      setError(err.message);
      return false;
    }
  }, [tiles]);

  // ── Populate legs for ALL positions of a user ──
  const populateAllLegs = useCallback(async (userId) => {
    const usr = users.find(u => u.uid === userId);
    if (!usr) return 0;
    let count = 0;
    for (const item of usr.portfolio) {
      const ok = await populateLegs(userId, item.id);
      if (ok) count++;
    }
    return count;
  }, [users, populateLegs]);

  // ── Update a specific leg's currentPremium and recalculate strategy P&L ──
  const updateLegPremium = useCallback(async (userId, tileId, legIndex, currentPremium) => {
    const usr = users.find(u => u.uid === userId);
    const item = usr?.portfolio.find(p => p.id === tileId);
    if (!item?.legs) return false;
    try {
      const updatedLegs = item.legs.map(l =>
        l.legIndex === legIndex ? { ...l, currentPremium: parseFloat(currentPremium) || 0 } : l
      );
      let unrealizedPnl = 0;
      let currentNetCredit = 0;
      updatedLegs.forEach(l => {
        if (l.type === 'stock') return;
        if (l.action === 'sell') {
          unrealizedPnl += (l.entryPremium - (l.currentPremium || 0)) * 100;
          currentNetCredit += (l.currentPremium || 0);
        } else {
          unrealizedPnl += ((l.currentPremium || 0) - l.entryPremium) * 100;
          currentNetCredit -= (l.currentPremium || 0);
        }
      });
      unrealizedPnl = parseFloat(unrealizedPnl.toFixed(2));
      const currentNetValueDollars = parseFloat((-currentNetCredit * 100).toFixed(2));

      const ref = doc(db, 'users', userId, 'portfolio', tileId);
      await updateDoc(ref, {
        legs: updatedLegs,
        currentNetValue: currentNetValueDollars,
        unrealizedPnl,
        lastPriceUpdate: new Date().toISOString(),
        updatedAt: serverTimestamp(),
      });
      setUsers(prev => prev.map(u => {
        if (u.uid !== userId) return u;
        return { ...u, portfolio: u.portfolio.map(p => p.id === tileId ? {
          ...p, legs: updatedLegs, currentNetValue: currentNetValueDollars,
          unrealizedPnl, lastPriceUpdate: new Date().toISOString(),
        } : p) };
      }));
      return true;
    } catch (err) {
      console.error('Admin updateLegPremium error:', err);
      setError(err.message);
      return false;
    }
  }, [users]);

  // ── Recalculate P&L for a position from its legs ──
  const recalcPnl = useCallback(async (userId, tileId) => {
    const usr = users.find(u => u.uid === userId);
    const item = usr?.portfolio.find(p => p.id === tileId);
    if (!item?.legs) return false;
    try {
      let unrealizedPnl = 0, currentNetCredit = 0;
      item.legs.forEach(l => {
        if (l.type === 'stock') return;
        if (l.action === 'sell') {
          unrealizedPnl += (l.entryPremium - (l.currentPremium || 0)) * 100;
          currentNetCredit += (l.currentPremium || 0);
        } else {
          unrealizedPnl += ((l.currentPremium || 0) - l.entryPremium) * 100;
          currentNetCredit -= (l.currentPremium || 0);
        }
      });
      unrealizedPnl = parseFloat(unrealizedPnl.toFixed(2));
      const costToClose = parseFloat((-currentNetCredit * 100).toFixed(2));
      const ref = doc(db, 'users', userId, 'portfolio', tileId);
      await updateDoc(ref, { unrealizedPnl, currentNetValue: costToClose, updatedAt: serverTimestamp() });
      setUsers(prev => prev.map(u => {
        if (u.uid !== userId) return u;
        return { ...u, portfolio: u.portfolio.map(p => p.id === tileId ? {
          ...p, unrealizedPnl, currentNetValue: costToClose,
        } : p) };
      }));
      return true;
    } catch (err) {
      console.error('Admin recalcPnl error:', err);
      setError(err.message);
      return false;
    }
  }, [users]);

  // ══════════════════════════════════════════════════════════
  // NEW: Quick Simulate — generate realistic current premiums
  // ══════════════════════════════════════════════════════════
  const quickSimulate = useCallback(async (userId, tileId, scenario = 'profit') => {
    const usr = users.find(u => u.uid === userId);
    const item = usr?.portfolio.find(p => p.id === tileId);
    if (!item?.legs?.length) return false;

    try {
      const updatedLegs = item.legs.map(leg => {
        let multiplier;
        if (scenario === 'profit') {
          // Premiums decay → good for credit sellers
          multiplier = 0.25 + Math.random() * 0.35; // 25-60% of entry
        } else if (scenario === 'loss') {
          // Premiums spike → bad for credit sellers
          if (leg.type === 'put' && leg.action === 'sell') {
            multiplier = 1.8 + Math.random() * 1.2; // put side tested
          } else if (leg.type === 'put' && leg.action === 'buy') {
            multiplier = 1.5 + Math.random() * 1.0;
          } else {
            multiplier = 0.3 + Math.random() * 0.3; // calls decay
          }
        } else if (scenario === 'breakeven') {
          multiplier = 0.85 + Math.random() * 0.30; // near entry
        } else {
          // 'mixed' — random
          multiplier = 0.2 + Math.random() * 1.6;
        }
        return {
          ...leg,
          currentPremium: parseFloat((leg.entryPremium * multiplier).toFixed(2))
        };
      });

      // Recalculate P&L from legs
      let unrealizedPnl = 0, currentNetCredit = 0;
      updatedLegs.forEach(l => {
        if (l.type === 'stock') return;
        if (l.action === 'sell') {
          unrealizedPnl += (l.entryPremium - (l.currentPremium || 0)) * 100;
          currentNetCredit += (l.currentPremium || 0);
        } else {
          unrealizedPnl += ((l.currentPremium || 0) - l.entryPremium) * 100;
          currentNetCredit -= (l.currentPremium || 0);
        }
      });
      unrealizedPnl = parseFloat(unrealizedPnl.toFixed(2));
      const currentNetValue = parseFloat((-currentNetCredit * 100).toFixed(2));

      const ref = doc(db, 'users', userId, 'portfolio', tileId);
      await updateDoc(ref, {
        legs: updatedLegs,
        currentNetValue,
        unrealizedPnl,
        lastPriceUpdate: new Date().toISOString(),
        updatedAt: serverTimestamp(),
      });

      // Update local state
      setUsers(prev => prev.map(u => {
        if (u.uid !== userId) return u;
        return { ...u, portfolio: u.portfolio.map(p => p.id === tileId ? {
          ...p, legs: updatedLegs, currentNetValue, unrealizedPnl,
          lastPriceUpdate: new Date().toISOString(),
        } : p) };
      }));

      return { unrealizedPnl, currentNetValue };
    } catch (err) {
      console.error('Admin quickSimulate error:', err);
      setError(err.message);
      return false;
    }
  }, [users]);

  // ══════════════════════════════════════════════════════════
  // NEW: Quick Simulate ALL — all positions at once
  // ══════════════════════════════════════════════════════════
  const quickSimulateAll = useCallback(async (userId, scenario = 'profit') => {
    const usr = users.find(u => u.uid === userId);
    if (!usr) return 0;
    let count = 0;
    for (const item of usr.portfolio) {
      if (item.status === 'closed') continue;
      if (!item.legs?.length) continue;
      const ok = await quickSimulate(userId, item.id, scenario);
      if (ok) count++;
    }
    return count;
  }, [users, quickSimulate]);

  // ══════════════════════════════════════════════════════════
  // NEW: Reset to Entry — sets current = entry for all legs (0 P&L)
  // ══════════════════════════════════════════════════════════
  const resetToEntry = useCallback(async (userId, tileId) => {
    const usr = users.find(u => u.uid === userId);
    const item = usr?.portfolio?.find(p => p.id === tileId);
    if (!item?.legs) return false;

    try {
      // Set all currentPremium = entryPremium
      const updatedLegs = item.legs.map(l => ({
        ...l,
        currentPremium: l.entryPremium
      }));

      // With current = entry, unrealizedPnl = 0 and currentNetValue = entryNetCredit
      const ref = doc(db, 'users', userId, 'portfolio', tileId);
      await updateDoc(ref, {
        legs: updatedLegs,
        currentNetValue: item.entryNetCredit || 0,
        unrealizedPnl: 0,
        lastPriceUpdate: new Date().toISOString(),
        updatedAt: serverTimestamp(),
      });

      setUsers(prev => prev.map(u => {
        if (u.uid !== userId) return u;
        return { ...u, portfolio: u.portfolio.map(p => p.id === tileId ? {
          ...p, legs: updatedLegs, currentNetValue: item.entryNetCredit || 0,
          unrealizedPnl: 0, lastPriceUpdate: new Date().toISOString(),
        } : p) };
      }));

      return true;
    } catch (err) {
      console.error('Admin resetToEntry error:', err);
      setError(err.message);
      return false;
    }
  }, [users]);

  // ══════════════════════════════════════════════════════════
  // NEW: Mark orphaned positions as closed
  // ══════════════════════════════════════════════════════════
  const markOrphansAsClosed = useCallback(async (userId) => {
    const usr = users.find(u => u.uid === userId);
    if (!usr) return 0;

    const tileIds = new Set(tiles.map(t => t.id));
    const orphans = usr.portfolio.filter(p => !tileIds.has(p.id) && p.status !== 'closed');

    if (orphans.length === 0) return 0;

    const batch = writeBatch(db);
    orphans.forEach(orphan => {
      const ref = doc(db, 'users', userId, 'portfolio', orphan.id);
      batch.update(ref, {
        status: 'closed',
        closedReason: 'tile_removed',
        closedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    });

    await batch.commit();
    await loadUsers();
    return orphans.length;
  }, [users, tiles, loadUsers]);

  // ══════════════════════════════════════════════════════════
  // NEW: Record P&L snapshot for history tracking
  // ══════════════════════════════════════════════════════════
  const recordPnlSnapshot = useCallback(async (userId) => {
    const usr = users.find(u => u.uid === userId);
    if (!usr) return false;

    const today = new Date().toISOString().split('T')[0];
    const positions = usr.portfolio
      .filter(p => p.status !== 'closed')
      .map(p => ({
        symbol: p.symbol,
        strategy: p.strategy,
        unrealizedPnl: p.unrealizedPnl || 0,
        entryNetCredit: p.entryNetCredit || 0,
        currentNetValue: p.currentNetValue || 0,
        quantity: p.quantity || 1,
      }));

    const totalPnl = positions.reduce((s, p) => s + (p.unrealizedPnl * p.quantity), 0);

    try {
      const ref = doc(db, 'users', userId, 'pnlHistory', today);
      await setDoc(ref, {
        date: today,
        totalPnl: parseFloat(totalPnl.toFixed(2)),
        positionCount: positions.length,
        positions,
        recordedAt: serverTimestamp(),
      });
      return true;
    } catch (err) {
      console.error('Admin recordPnlSnapshot error:', err);
      setError(err.message);
      return false;
    }
  }, [users]);

  // ── Load P&L history ──
  const loadPnlHistory = useCallback(async (userId) => {
    if (!userId) return;
    try {
      const histRef = collection(db, 'users', userId, 'pnlHistory');
      const q = query(histRef, orderBy('date', 'asc'));
      const snap = await getDocs(q);
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setPnlHistory(data);
      return data;
    } catch (err) {
      console.error('Admin loadPnlHistory error:', err);
      // Collection might not exist yet
      setPnlHistory([]);
      return [];
    }
  }, []);

  // ══════════════════════════════════════════════════════════
  // NEW: Reset all P&L to zero
  // ══════════════════════════════════════════════════════════
  const resetAllPnl = useCallback(async (userId) => {
    const usr = users.find(u => u.uid === userId);
    if (!usr) return 0;

    const batch = writeBatch(db);
    let count = 0;

    for (const item of usr.portfolio) {
      const ref = doc(db, 'users', userId, 'portfolio', item.id);
      const resetLegs = (item.legs || []).map(l => ({ ...l, currentPremium: 0 }));
      batch.update(ref, {
        legs: resetLegs,
        currentNetValue: 0,
        unrealizedPnl: 0,
        lastPriceUpdate: new Date().toISOString(),
        updatedAt: serverTimestamp(),
      });
      count++;
    }

    await batch.commit();
    await loadUsers();
    return count;
  }, [users, loadUsers]);

  // ══════════════════════════════════════════════════════════
  // Seed closed trade history with realistic P&L + monthly snapshots
  // ══════════════════════════════════════════════════════════
  const seedClosedTradeHistory = useCallback(async (userId) => {
    const usr = users.find(u => u.uid === userId);
    if (!usr) return { trades: 0, snapshots: 0 };

    const closedItems = usr.portfolio.filter(p => p.status === 'closed');
    if (closedItems.length === 0) return { trades: 0, snapshots: 0 };

    const batch = writeBatch(db);

    // Realistic P&L scenarios for closed trades spread across months
    const tradeHistory = [
      { pnl: 180, month: 7, day: 18, year: 2025, reason: 'expired' },   // Jul - win
      { pnl: 220, month: 7, day: 25, year: 2025, reason: 'manual' },    // Jul - win
      { pnl: -150, month: 8, day: 8, year: 2025, reason: 'manual' },    // Aug - loss
      { pnl: 310, month: 8, day: 22, year: 2025, reason: 'expired' },   // Aug - win
      { pnl: 175, month: 9, day: 12, year: 2025, reason: 'expired' },   // Sep - win
      { pnl: 260, month: 10, day: 5, year: 2025, reason: 'expired' },   // Oct - win
      { pnl: -280, month: 10, day: 20, year: 2025, reason: 'manual' },  // Oct - loss
      { pnl: 340, month: 11, day: 14, year: 2025, reason: 'expired' },  // Nov - win
      { pnl: 195, month: 12, day: 3, year: 2025, reason: 'expired' },   // Dec - win
      { pnl: -120, month: 12, day: 19, year: 2025, reason: 'manual' },  // Dec - loss
      { pnl: 285, month: 1, day: 10, year: 2026, reason: 'expired' },   // Jan - win
    ];

    let tradeCount = 0;
    closedItems.forEach((item, i) => {
      const history = tradeHistory[i % tradeHistory.length];
      const closedDate = new Date(history.year, history.month - 1, history.day);
      const entryDate = new Date(closedDate);
      entryDate.setDate(entryDate.getDate() - 30); // entered ~30 days before close

      const ref = doc(db, 'users', userId, 'portfolio', item.id);
      batch.update(ref, {
        unrealizedPnl: history.pnl,
        realizedPnl: history.pnl,
        entryDate: entryDate.toISOString().split('T')[0],
        closedAt: closedDate,
        closedReason: history.reason,
        updatedAt: serverTimestamp(),
      });
      tradeCount++;
    });

    await batch.commit();

    // Now create monthly P&L snapshots from Jul 2025 to Feb 2026
    const monthlySnapshots = [
      { date: '2025-07-31', totalPnl: 400 },    // Jul: +$400
      { date: '2025-08-31', totalPnl: 560 },    // Aug: +$160 cumulative $560
      { date: '2025-09-30', totalPnl: 735 },    // Sep: +$175 cumulative $735
      { date: '2025-10-31', totalPnl: 715 },    // Oct: -$20 (net) cumulative $715
      { date: '2025-11-30', totalPnl: 1055 },   // Nov: +$340 cumulative $1055
      { date: '2025-12-31', totalPnl: 1130 },   // Dec: +$75 (net) cumulative $1130
      { date: '2026-01-31', totalPnl: 1415 },   // Jan: +$285 cumulative $1415
    ];

    let snapCount = 0;
    for (const snap of monthlySnapshots) {
      const ref = doc(db, 'users', userId, 'pnlHistory', snap.date);
      await setDoc(ref, {
        date: snap.date,
        totalPnl: snap.totalPnl,
        positionCount: 5,
        positions: [],
        recordedAt: serverTimestamp(),
      });
      snapCount++;
    }

    await loadUsers();
    return { trades: tradeCount, snapshots: snapCount };
  }, [users, loadUsers]);

  // ══════════════════════════════════════════════════════════
  // NEW: Delete all strategies/tiles
  // ══════════════════════════════════════════════════════════
  const deleteAllStrategies = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const tilesRef = collection(db, 'tiles');
      const snap = await getDocs(tilesRef);

      const batch = writeBatch(db);
      let count = 0;

      snap.docs.forEach(docSnap => {
        batch.delete(docSnap.ref);
        count++;
      });

      if (count > 0) await batch.commit();
      await loadTiles();
      return count;
    } catch (err) {
      console.error('Admin deleteAllStrategies error:', err);
      setError(err.message);
      return 0;
    } finally {
      setLoading(false);
    }
  }, [loadTiles]);

  // ══════════════════════════════════════════════════════════
  // NEW: Clear all portfolio history and positions for current user
  // ══════════════════════════════════════════════════════════
  const clearAllPortfolioHistory = useCallback(async () => {
    const currentUserId = getCurrentUserId();
    if (!currentUserId) return { portfolio: 0, history: 0 };

    setLoading(true);
    setError(null);
    try {
      // Delete all portfolio items
      const portfolioRef = collection(db, 'users', currentUserId, 'portfolio');
      const portfolioSnap = await getDocs(portfolioRef);

      const batch1 = writeBatch(db);
      let portfolioCount = 0;

      portfolioSnap.docs.forEach(docSnap => {
        batch1.delete(docSnap.ref);
        portfolioCount++;
      });

      if (portfolioCount > 0) await batch1.commit();

      // Delete all pnlHistory items
      const historyRef = collection(db, 'users', currentUserId, 'pnlHistory');
      const historySnap = await getDocs(historyRef);

      const batch2 = writeBatch(db);
      let historyCount = 0;

      historySnap.docs.forEach(docSnap => {
        batch2.delete(docSnap.ref);
        historyCount++;
      });

      if (historyCount > 0) await batch2.commit();

      await loadUsers();
      setPnlHistory([]);

      return { portfolio: portfolioCount, history: historyCount };
    } catch (err) {
      console.error('Admin clearAllPortfolioHistory error:', err);
      setError(err.message);
      return { portfolio: 0, history: 0 };
    } finally {
      setLoading(false);
    }
  }, [getCurrentUserId, loadUsers]);

  // ══════════════════════════════════════════════════════════
  // NEW: Load all users from Firestore
  // Strategy: Check for user profile docs, if none exist, scan portfolios
  // ══════════════════════════════════════════════════════════
  const loadAllUsersFromFirestore = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const usersRef = collection(db, 'users');
      const snap = await getDocs(usersRef);

      console.log('loadAllUsersFromFirestore: found', snap.size, 'user documents');

      if (snap.size === 0) {
        console.warn('No user documents found in Firestore. Users collection may not have profile docs.');
        // Fallback: create a profile doc for the current user if it doesn't exist
        if (user) {
          const userRef = doc(db, 'users', user.uid);
          const userDoc = await getDoc(userRef);
          if (!userDoc.exists()) {
            await setDoc(userRef, {
              email: user.email,
              displayName: user.displayName || user.email?.split('@')[0] || 'User',
              createdAt: serverTimestamp(),
              lastLogin: serverTimestamp(),
            });
            console.log('Created user profile document for', user.email);
          }
          // Reload after creating
          const newSnap = await getDocs(usersRef);
          const usersList = newSnap.docs.map(d => ({
            uid: d.id,
            ...d.data()
          }));
          setAllUsers(usersList);
          return usersList;
        }
        setAllUsers([]);
        return [];
      }

      const usersList = snap.docs.map(d => ({
        uid: d.id,
        ...d.data()
      }));

      console.log('Loaded users:', usersList);
      setAllUsers(usersList);
      return usersList;
    } catch (err) {
      console.error('Admin loadAllUsersFromFirestore error:', err);
      setError(err.message);
      setAllUsers([]);
      return [];
    } finally {
      setLoading(false);
    }
  }, [user]);

  // ══════════════════════════════════════════════════════════
  // NEW: Set impersonated user (or null to reset to self)
  // ══════════════════════════════════════════════════════════
  const setImpersonatedUser = useCallback(async (userId) => {
    setImpersonatedUserId(userId);
    await loadUsers();
  }, [loadUsers]);

  return {
    isAdmin,
    tiles,
    users,
    allUsers,
    impersonatedUserId,
    pnlHistory,
    loading,
    error,
    loadTiles,
    loadUsers,
    updateTile,
    updateTileLeg,
    updatePortfolioItem,
    refreshDTE,
    bulkUpdateExpiry,
    seedTestPnl,
    populateLegs,
    populateAllLegs,
    updateLegPremium,
    recalcPnl,
    quickSimulate,
    quickSimulateAll,
    resetToEntry,
    markOrphansAsClosed,
    recordPnlSnapshot,
    loadPnlHistory,
    resetAllPnl,
    seedClosedTradeHistory,
    deleteAllStrategies,
    clearAllPortfolioHistory,
    loadAllUsersFromFirestore,
    setImpersonatedUser,
  };
}
