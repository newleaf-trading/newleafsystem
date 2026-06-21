import { useState, useCallback } from 'react';

const API_URL = 'https://us-central1-newleaf-trading.cloudfunctions.net/api';
const API_KEY = import.meta.env.VITE_NL_API_KEY;

/**
 * Hook to fetch earnings/dividend/event risk alerts for a position.
 * Manual trigger via fetchRisk().
 */
export function useEventRisk() {
  const [alerts, setAlerts] = useState([]);
  const [ivCrushRisk, setIvCrushRisk] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchRisk = useCallback(async ({ ticker, expiry, strategy, legs, entryIvRank }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/event-risk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
        body: JSON.stringify({ ticker, expiry, strategy, legs, entryIvRank, modelMode: 'budget-qwq' }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAlerts(data.alerts || []);
      setIvCrushRisk(data.ivCrushRisk || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { alerts, ivCrushRisk, loading, error, fetchRisk };
}
