import '../../styles/ai-analysis-light.css';

/**
 * ProfitLossMetricsCard - P&L summary using actual tile data
 */
export function ProfitLossMetricsCard({ maxProfit, maxLoss, breakevens, currentPrice, tile }) {
  const formatCurrency = (value) => {
    if (!value || isNaN(value)) return '$0';
    return (value < 0 ? '-' : '') + '$' + Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 0 });
  };

  const symbol = tile?.symbol || '';
  const legs = tile?.legs || [];

  // Find short strikes for condition text
  const shortPut = legs.find(l => l.action?.toLowerCase() === 'sell' && l.type?.toLowerCase() === 'put');
  const shortCall = legs.find(l => l.action?.toLowerCase() === 'sell' && l.type?.toLowerCase() === 'call');
  const strat = (tile?.strategy || '').toLowerCase();

  // Generate condition text from actual strikes
  let profitCondition = '', lossCondition = '';
  if (strat.includes('iron condor') || strat.includes('iron butterfly')) {
    profitCondition = shortPut && shortCall ? `If ${symbol} stays between $${shortPut.strike} and $${shortCall.strike}` : `If ${symbol} stays in range`;
    lossCondition = shortPut && shortCall ? `If ${symbol} moves below $${shortPut.strike} or above $${shortCall.strike}` : `If ${symbol} breaks range`;
  } else if (strat.includes('bull put') || strat.includes('put spread')) {
    profitCondition = shortPut ? `If ${symbol} stays above $${shortPut.strike}` : `If ${symbol} stays above short strike`;
    lossCondition = shortPut ? `If ${symbol} drops below $${shortPut.strike}` : `If ${symbol} drops`;
  } else if (strat.includes('bear call') || strat.includes('call spread')) {
    profitCondition = shortCall ? `If ${symbol} stays below $${shortCall.strike}` : `If ${symbol} stays below short strike`;
    lossCondition = shortCall ? `If ${symbol} rises above $${shortCall.strike}` : `If ${symbol} rises`;
  } else if (strat.includes('bwb')) {
    const shorts = legs.filter(l => l.action?.toLowerCase() === 'sell');
    if (shorts.length > 0) {
      const minS = Math.min(...shorts.map(l => l.strike));
      const maxS = Math.max(...shorts.map(l => l.strike));
      profitCondition = `If ${symbol} stays near $${minS}–$${maxS}`;
      lossCondition = `If ${symbol} moves sharply away`;
    }
  } else {
    profitCondition = `At expiration if favorable`;
    lossCondition = `At expiration if unfavorable`;
  }

  const getBreakevenInfo = () => {
    if (!breakevens || breakevens.length === 0) return null;
    const sorted = [...breakevens].sort((a, b) => a - b);
    if (sorted.length === 1) {
      const distPct = currentPrice ? ((sorted[0] / currentPrice - 1) * 100).toFixed(1) : null;
      return { value: `$${sorted[0].toFixed(2)}`, subtitle: distPct ? `${distPct}% from current` : '' };
    }
    return { value: `$${sorted[0].toFixed(0)} – $${sorted[sorted.length - 1].toFixed(0)}`, subtitle: 'Profit range' };
  };
  const breakevenInfo = getBreakevenInfo();

  return (
    <div className="ai-card">
      <div className="ai-card-header">
        <span className="card-icon">💰</span>
        <span>PROFIT & LOSS PROFILE</span>
      </div>

      <div className="ai-pnl-grid">
        <div className="ai-pnl-card">
          <div className="ai-pnl-label">Max Profit</div>
          <div className="ai-pnl-value positive">{formatCurrency(maxProfit)}</div>
          <div className="ai-pnl-subtitle">{profitCondition}</div>
        </div>
        <div className="ai-pnl-card">
          <div className="ai-pnl-label">Max Loss</div>
          <div className="ai-pnl-value negative">{formatCurrency(maxLoss)}</div>
          <div className="ai-pnl-subtitle">{lossCondition}</div>
        </div>
        {breakevenInfo && (
          <div className="ai-pnl-card">
            <div className="ai-pnl-label">Breakeven</div>
            <div className="ai-pnl-value">{breakevenInfo.value}</div>
            <div className="ai-pnl-subtitle">{breakevenInfo.subtitle}</div>
          </div>
        )}
      </div>

      <div className="advanced-only" style={{ marginTop: 20, padding: '14px 18px', background: 'var(--ai-accent-bg)', borderRadius: 8 }}>
        <div style={{ marginBottom: 10 }}>
          <strong style={{ fontSize: 14, color: 'var(--ai-text-primary)' }}>Risk/Reward Ratio: </strong>
          <span style={{ fontSize: 14, color: 'var(--ai-primary-gold)', fontWeight: 700 }}>
            1:{maxLoss > 0 ? (maxProfit / maxLoss).toFixed(2) : '—'}
          </span>{' '}
          <span style={{ fontSize: 13, color: 'var(--ai-text-muted)' }}>
            (Risk ${Math.abs(maxLoss)} to make ${Math.abs(maxProfit)})
          </span>
        </div>
        <div style={{ fontSize: 13, color: 'var(--ai-text-muted)' }}>
          Probability of Profit: ~{tile?.oddsOfProfit || (maxProfit > 0 && maxLoss > 0 ? Math.round((maxLoss / (maxProfit + maxLoss)) * 100) : '—')}% (based on IV and gamma walls)
        </div>
      </div>
    </div>
  );
}

export default ProfitLossMetricsCard;
