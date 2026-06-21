import { useState, useCallback, useRef } from 'react';

const API_URL = 'https://us-central1-newleaf-trading.cloudfunctions.net/api';
const API_KEY = import.meta.env.VITE_NL_API_KEY;

/**
 * Hook to fetch AI-generated weekly picks narrative.
 * Caches by weekId to avoid re-fetching.
 */
export function usePicksNarrative() {
  const [narrative, setNarrative] = useState(null);
  const [marketBias, setMarketBias] = useState(null);
  const [keyThemes, setKeyThemes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const cache = useRef({});

  const fetchNarrative = useCallback(async ({ picks, weekId, theme }) => {
    if (cache.current[weekId]) {
      const c = cache.current[weekId];
      setNarrative(c.narrative);
      setMarketBias(c.marketBias);
      setKeyThemes(c.keyThemes);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/picks-narrative`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
        body: JSON.stringify({ picks, weekId, theme, modelMode: 'budget-qwq' }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      cache.current[weekId] = data;
      setNarrative(data.narrative);
      setMarketBias(data.marketBias);
      setKeyThemes(data.keyThemes || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { narrative, marketBias, keyThemes, loading, error, fetchNarrative };
}
