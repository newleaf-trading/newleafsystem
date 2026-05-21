import '../../styles/ai-analysis-light.css';

/**
 * WhyThisStrategyCard - AI-powered explanation of strategy selection
 * Generates dynamic reasoning based on gamma walls, RSI, volume, and market conditions
 * Dark theme with premium gold accents
 */
export function WhyThisStrategyCard({ tile, analysis, gammaData }) {
  if (!tile) return null;

  const { strategy, symbol, direction } = tile;

  // Extract key data points
  const rsi = analysis?.technicalIndicators?.rsi?.value;
  const rsiSignal = analysis?.technicalIndicators?.rsi?.signal;
  const maSignal = analysis?.technicalIndicators?.movingAverages?.signal;
  const ivRank = analysis?.technicalIndicators?.impliedVolatility?.ivRank;

  // Gamma wall data (if available)
  const putWall = gammaData?.put_wall;
  const callWall = gammaData?.call_wall;
  const spot = gammaData?.spot;
  const bandWidth = gammaData?.band_width_pct;
  const positionInBand = gammaData?.position_in_band_pct;

  // Generate dynamic reasoning bullets
  const generateReasons = () => {
    const reasons = [];
    const dir = direction?.toLowerCase() || '';
    const strat = strategy?.toLowerCase() || '';

    // Gamma wall reasoning
    if (putWall && callWall && spot) {
      if (spot < (putWall + callWall) / 2) {
        reasons.push(`Price is approaching the call wall ($${callWall.toFixed(2)}), acting as resistance`);
      } else {
        reasons.push(`Price is near the put wall ($${putWall.toFixed(2)}), providing downside support`);
      }

      if (bandWidth && bandWidth < 8) {
        reasons.push(`Gamma positioning suggests limited ${dir === 'bearish' ? 'upside' : dir === 'bullish' ? 'downside' : ''} movement over the next 0-60 days`);
      } else if (bandWidth && bandWidth > 12) {
        reasons.push(`Band width of ${bandWidth.toFixed(1)}% shows moderate volatility, suitable for premium collection`);
      } else if (bandWidth) {
        reasons.push(`Band width of ${bandWidth.toFixed(1)}% shows moderate volatility, suitable for premium collection`);
      }
    }

    // RSI reasoning
    if (rsi) {
      if (rsi > 70) {
        reasons.push(`RSI at ${rsi.toFixed(1)} indicates overbought conditions with potential pullback`);
      } else if (rsi < 30) {
        reasons.push(`RSI at ${rsi.toFixed(1)} shows oversold conditions, suggesting potential bounce`);
      } else if (rsi > 45 && rsi < 55) {
        reasons.push(`RSI at ${rsi.toFixed(1)} indicates neutral momentum with no strong breakout signals`);
      }
    }

    // Moving average reasoning
    if (maSignal === 'bullish') {
      reasons.push('Bullish trend alignment supports upside strategies');
    } else if (maSignal === 'bearish') {
      reasons.push('Bearish trend pattern favors downside positioning');
    } else if (maSignal === 'neutral') {
      reasons.push('Sideways trend supports range-bound strategies');
    }

    // IV reasoning
    if (ivRank) {
      if (ivRank > 70) {
        reasons.push(`High IV rank (${ivRank}) makes premium selling attractive`);
      } else if (ivRank < 30) {
        reasons.push(`Low IV rank (${ivRank}) suggests favorable conditions for buying options`);
      }
    }

    // Advanced: OI and gamma details
    if (gammaData) {
      const isAdvanced = typeof window !== 'undefined' && document.body.classList.contains('advanced-mode');
      if (isAdvanced) {
        if (callWall && spot) {
          reasons.push(`Net gamma exposure concentration near $${callWall.toFixed(2)} creates strong resistance zone`);
        }
        if (callWall) {
          reasons.push(`Open interest build-up at higher strikes ($${callWall.toFixed(2)}+) suggests seller dominance`);
        }
      }
    }

    // Fallback if no reasons generated
    if (reasons.length === 0) {
      reasons.push(`${strategy} aligns with current ${direction || 'neutral'} market conditions`);
      reasons.push('Risk-reward profile is favorable for this setup');
    }

    return reasons;
  };

  const reasons = generateReasons();

  // Generate conclusion text
  const getConclusion = () => {
    const strat = strategy?.toLowerCase() || '';

    if (strat.includes('bear call')) {
      return `💡 This makes a Bear Call Spread suitable to collect premium in a controlled downside environment while limiting risk at higher strikes.`;
    } else if (strat.includes('bull put')) {
      return `💡 This makes a Bull Put Spread ideal for collecting premium while maintaining bullish bias with defined risk.`;
    } else if (strat.includes('iron condor')) {
      return `💡 This makes an Iron Condor optimal for capturing theta decay in a range-bound market with defined profit zones.`;
    } else if (strat.includes('butterfly')) {
      return `💡 This makes a Butterfly appropriate for profiting from minimal price movement with limited capital at risk.`;
    } else {
      return `💡 This makes ${strategy} a suitable strategy for current market conditions with favorable risk-reward dynamics.`;
    }
  };

  return (
    <div className="ai-card">
      <div className="ai-card-header">
        <span className="card-icon">🎯</span>
        <span>WHY THIS STRATEGY?</span>
      </div>

      {reasons.map((reason, idx) => (
        <div key={idx} className="ai-bullet">
          {reason}
        </div>
      ))}

      {/* Advanced bullets */}
      {gammaData && (
        <>
          <div className="ai-bullet advanced-only">
            Net gamma exposure concentration near ${callWall?.toFixed(2) || 'N/A'} creates strong resistance zone
          </div>
          <div className="ai-bullet advanced-only">
            Open interest build-up at higher strikes suggests seller dominance
          </div>
        </>
      )}

      <div className="ai-conclusion">
        <strong>{getConclusion()}</strong>
      </div>
    </div>
  );
}

export default WhyThisStrategyCard;
