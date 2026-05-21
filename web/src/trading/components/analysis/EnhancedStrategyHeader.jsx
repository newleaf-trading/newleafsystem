import '../../styles/ai-analysis-light.css';

/**
 * EnhancedStrategyHeader - Premium strategy display with confidence score
 * Dark theme with Fraunces serif typography for strategy name
 */
export function EnhancedStrategyHeader({ tile, analysis, gammaData }) {
  if (!tile) return null;

  const { strategy, direction, symbol } = tile;

  // Calculate confidence score
  const calculateConfidence = () => {
    let score = 50;

    if (gammaData) {
      const { confidence_score, condor_allowed, position_in_band_pct } = gammaData;
      if (confidence_score) score += confidence_score * 30;
      if (condor_allowed && strategy?.toLowerCase().includes('condor')) score += 15;
      if (position_in_band_pct >= 40 && position_in_band_pct <= 60) score += 10;
    }

    if (analysis?.technicalIndicators) {
      const { rsi, movingAverages, impliedVolatility } = analysis.technicalIndicators;
      if (rsi) {
        if ((direction?.toLowerCase().includes('bearish') && rsi.value > 60) ||
            (direction?.toLowerCase().includes('bullish') && rsi.value < 40)) {
          score += 10;
        }
      }
      if (movingAverages) {
        if ((direction?.toLowerCase().includes('bearish') && movingAverages.signal === 'bearish') ||
            (direction?.toLowerCase().includes('bullish') && movingAverages.signal === 'bullish')) {
          score += 10;
        }
      }
      if (impliedVolatility && strategy?.toLowerCase().includes('spread') && impliedVolatility.ivRank > 50) {
        score += 5;
      }
    }

    return Math.min(Math.max(Math.round(score), 0), 100);
  };

  const confidence = calculateConfidence();

  // Get strategy tags
  const getTags = () => {
    const tags = [];
    const strat = strategy?.toLowerCase() || '';
    const dir = direction?.toLowerCase() || '';

    if (dir.includes('bear')) {
      tags.push('📉 Bearish');
    } else if (dir.includes('bull')) {
      tags.push('📈 Bullish');
    } else {
      tags.push('↔️ Neutral');
    }

    if (strat.includes('spread')) {
      tags.push('📊 Range-bound');
    }
    if (strat.includes('premium') || strat.includes('spread') || strat.includes('condor')) {
      tags.push('💰 Premium Collection');
    }

    return tags;
  };

  const tags = getTags();

  return (
    <div className="ai-card">
      <div className="ai-card-header">
        <span className="card-icon">💡</span>
        <span>RECOMMENDED STRATEGY</span>
        <span className="ai-confidence-badge">{confidence}% Confidence</span>
      </div>

      <h2 className="ai-title-serif" style={{
        fontSize: '32px',
        marginBottom: '12px',
        lineHeight: '1.2'
      }}>
        {direction && `${direction === 'bearish' ? '📉' : direction === 'bullish' ? '📈' : '↔️'} `}
        {strategy}
      </h2>

      <div style={{
        fontSize: '14px',
        color: 'var(--ai-text-muted)',
        marginBottom: '16px',
        fontStyle: 'italic'
      }}>
        Collect premium while limiting risk in a resistance-biased environment
      </div>

      <div className="ai-strategy-tags">
        {tags.map((tag, idx) => (
          <span key={idx} className="ai-strategy-tag">{tag}</span>
        ))}
      </div>

      <div style={{
        marginTop: '20px',
        padding: '16px 20px',
        background: 'var(--ai-accent-bg)',
        borderRadius: '8px'
      }}>
        <strong style={{ fontSize: '14px', color: 'var(--ai-text-primary)' }}>
          Key Features:
        </strong>
        <ul style={{
          margin: '12px 0 0 20px',
          lineHeight: '1.8',
          fontSize: '14px',
          color: 'var(--ai-text-primary)'
        }}>
          <li>Bearish trend identified</li>
          <li>Call wall acts as resistance</li>
          <li>Defined risk, defined reward</li>
          <li>Premium income in downtrend</li>
        </ul>
      </div>
    </div>
  );
}

export default EnhancedStrategyHeader;
