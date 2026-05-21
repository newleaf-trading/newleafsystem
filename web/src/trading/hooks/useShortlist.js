import { useState, useEffect, useCallback } from 'react';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../shared/hooks/useAuth';

/**
 * Manages the user's shortlist — strategies saved for later but not yet in portfolio.
 * Collection: users/:uid/shortlist/:tileId
 *
 * "Take this trade" on a strategy detail page routes to /trading/build with the tile pre-loaded.
 * "Save for later" adds to this shortlist without routing.
 * "Execute" in Build moves the record from shortlist → portfolio.
 */
export function useShortlist() {
  const { user } = useAuth();
  const [shortlistItems, setShortlistItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setShortlistItems([]);
      setLoading(false);
      return;
    }

    const shortlistRef = collection(db, 'users', user.uid, 'shortlist');
    const q = query(shortlistRef);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        setShortlistItems(items);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching shortlist:', err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user]);

  const addToShortlist = useCallback(async (tile) => {
    if (!user || !tile?.id) return;

    const docRef = doc(db, 'users', user.uid, 'shortlist', tile.id);
    await setDoc(docRef, {
      tileId: tile.id,
      symbol: tile.symbol,
      strategy: tile.strategy,
      addedAt: serverTimestamp(),
    });
  }, [user]);

  const removeFromShortlist = useCallback(async (tileId) => {
    if (!user) return;

    const docRef = doc(db, 'users', user.uid, 'shortlist', tileId);
    await deleteDoc(docRef);
  }, [user]);

  const isShortlisted = (tileId) => {
    return shortlistItems.some(item => item.tileId === tileId);
  };

  return {
    shortlistItems,
    loading,
    addToShortlist,
    removeFromShortlist,
    isShortlisted,
  };
}
