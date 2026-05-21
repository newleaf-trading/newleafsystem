import { useMarketState } from '../hooks/useMarketState';
import { BrainCircuit } from 'lucide-react';

export function AIInsightBar() {
  const { marketState, loading } = useMarketState();

  if (loading || !marketState) {
    return null;
  }

  const formatLastScan = (timestamp) => {
    if (!timestamp) return 'Never';
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Generate market insight based on data
  const getMarketInsight = () => {
    const count = marketState.activeTileCount || 0;
    const symbols = marketState.symbols || [];

    if (count === 0) {
      return "Market conditions remain volatile with limited opportunities matching our risk-adjusted return criteria. Maintaining defensive posture recommended.";
    }

    if (count >= 3) {
      return `We've identified ${count} high-conviction opportunities across ${symbols.length} symbols exhibiting favorable technical setups. Market structure suggests defined ranges with asymmetric risk-reward profiles. Prioritize positions with optimal delta-neutral probability and theta decay characteristics.`;
    }

    return `Conservative market environment with ${count} qualifying setups in ${symbols.join(', ')}. Selective positioning advised with strict risk management protocols.`;
  };

  return (
    <div className="ai-bar">
      {/* Market Insight */}
      <div className="ai-main">
        <div className="ai-icon-box">
          <BrainCircuit className="ai-icon" strokeWidth={1.5} />
        </div>
        <div className="ai-content">
          <div className="ai-label">Market Strategy Update</div>
          <p className="ai-text">"{getMarketInsight()}"</p>
        </div>
      </div>

      {/* Market Risk Level */}
      <div className="risk-box">
        <div className="risk-label">Market Risk Level</div>
        <div className="risk-level">Moderate</div>
        <div className="risk-bar">
          <div className="risk-fill"></div>
        </div>
        <div className="risk-time">Updated: {formatLastScan(marketState.lastScanTime)}</div>
      </div>
    </div>
  );
}
