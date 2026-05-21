import { useState, useCallback } from 'react';

const API_URL = 'https://us-central1-newleaf-trading.cloudfunctions.net/api';
const API_KEY = 'nl_31ee32be43bd4f07a3520ae15c4b3162';

/**
 * Hook to fetch AI-powered adjustment recommendations for a position.
 * Manual trigger via fetchAdjust().
 */
export function useAIAdjust() {
  const [adjustments, setAdjustments] = useState([]);
  const [marketContext, setMarketContext] = useState('');
  const [urgency, setUrgency] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAdjust = useCallback(async ({
    ticker, strategy, legs, entryNetCredit, currentSpot, dte,
    pnlPerContract, profitCapturePct, liveGreeks, verdictState, verdictReason, chain,
  }) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
        body: JSON.stringify({
          ticker, strategy, legs, entryNetCredit, currentSpot, dte,
          pnlPerContract, profitCapturePct, liveGreeks, verdictState, verdictReason, chain,
          modelMode: 'budget-qwq',
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setAdjustments(data.adjustments || []);
      setMarketContext(data.marketContext || '');
      setUrgency(data.urgency || 'monitor');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { adjustments, marketContext, urgency, loading, error, fetchAdjust };
}
