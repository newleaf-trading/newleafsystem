import { useState, useCallback } from 'react';

const API_URL = 'https://us-central1-newleaf-trading.cloudfunctions.net/api';
const API_KEY = 'nl_31ee32be43bd4f07a3520ae15c4b3162';

/**
 * Hook to fetch AI strike comparison alternatives.
 * Manual trigger via fetchComparison().
 */
export function useStrikeComparison() {
  const [alternatives, setAlternatives] = useState([]);
  const [reasoning, setReasoning] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchComparison = useCallback(async ({ ticker, expiry, currentLegs, spot, chain, strategy }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/strike-compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
        body: JSON.stringify({ ticker, expiry, currentLegs, spot, chain, strategy, modelMode: 'budget-qwq' }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAlternatives(data.alternatives || []);
      setReasoning(data.reasoning || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { alternatives, reasoning, loading, error, fetchComparison };
}
