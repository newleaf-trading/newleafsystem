import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';

/**
 * Real-time Firestore listener for active tiles
 * @returns {Object} { tiles, loading, error }
 */
export function useTiles() {
  const [tiles, setTiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      // Query active tiles ordered by sortOrder
      const tilesRef = collection(db, 'tiles');
      const q = query(
        tilesRef,
        where('isActive', '==', true)
      );

      // Set up real-time listener
      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const tilesData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));

          setTiles(tilesData);
          setLoading(false);
          setError(null);
        },
        (err) => {
          console.error('Error fetching tiles:', err);
          setError(err.message);
          setLoading(false);
        }
      );

      // Cleanup listener on unmount
      return () => unsubscribe();

    } catch (err) {
      console.error('Error setting up tiles listener:', err);
      setError(err.message);
      setLoading(false);
    }
  }, []);

  return { tiles, loading, error };
}
