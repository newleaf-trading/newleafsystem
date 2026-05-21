import { useState, useEffect } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../firebase/config';

/**
 * Real-time market state listener
 * @returns {Object} { marketState, loading, error }
 */
export function useMarketState() {
  const [marketState, setMarketState] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    try {
      const marketStateRef = doc(db, 'marketState', 'current');

      const unsubscribe = onSnapshot(
        marketStateRef,
        (snapshot) => {
          if (snapshot.exists()) {
            setMarketState({
              id: snapshot.id,
              ...snapshot.data()
            });
          } else {
            setMarketState(null);
          }
          setLoading(false);
          setError(null);
        },
        (err) => {
          console.error('Error fetching market state:', err);
          setError(err.message);
          setLoading(false);
        }
      );

      return () => unsubscribe();

    } catch (err) {
      console.error('Error setting up market state listener:', err);
      setError(err.message);
      setLoading(false);
    }
  }, []);

  return { marketState, loading, error };
}
