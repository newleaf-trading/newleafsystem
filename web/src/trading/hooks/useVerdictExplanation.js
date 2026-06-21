import { useState, useCallback, useRef } from 'react';

const API_URL = 'https://us-central1-newleaf-trading.cloudfunctions.net/api';
const API_KEY = import.meta.env.VITE_NL_API_KEY;

/**
 * Hook to fetch AI explanation for a position verdict.
 * Returns { explanation, confidence, loading, error, fetchExplanation }
 * Manual trigger via fetchExplanation() to control API cost.
 */
export function useVerdictExplanation() {
  const [explanation, setExplanation] = useState(null);
  const [confidence, setConfidence] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const cache = useRef({});

  const fetchExplanation = useCallback(async ({ ticker, strategy, verdictState, verdictReason, marketData, position }) => {
    const cacheKey = `${ticker}-${verdictState}`;
    if (cache.current[cacheKey]) {
      setExplanation(cache.current[cacheKey].explanation);
      setConfidence(cache.current[cacheKey].confidence);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/verdict-explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
        body: JSON.stringify({ ticker, strategy, verdictState, verdictReason, marketData, position, modelMode: 'budget-qwq' }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      cache.current[cacheKey] = { explanation: data.explanation, confidence: data.confidence };
      setExplanation(data.explanation);
      setConfidence(data.confidence);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { explanation, confidence, loading, error, fetchExplanation };
}
