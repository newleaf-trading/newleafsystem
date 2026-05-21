import '../../styles/ai-analysis-light.css';

/**
 * StrategyRisksCard - Explains when the strategy fails with clear warnings
 * Dark theme with warning styling
 */
export function StrategyRisksCard({ tile, analysis, gammaData }) {
  if (!tile) return null;

  const { strategy, symbol, direction } = tile;

  // Extract key data
  const putWall = gammaData?.put_wall;
  const callWall = gammaData?.call_wall;
  const ivRank = analysis?.technicalIndicators?.impliedVolatility?.ivRank;
  const rsi = analysis?.technicalIndicators?.rsi?.value;

  // Generate risk scenarios
  const generateRisks = () => {
    const risks = [];
    const strat = strategy?.toLowerCase() || '';

    if (strat.includes('bear call')) {
      risks.push({
        title: 'Break above call wall',
        description: `Strong momentum through $${callWall?.toFixed(2) || '220'} invalidates resistance thesis`,
        advanced: false,
      });
      risks.push({
        title: 'Volume spike',
        description: 'Sudden surge in volume (>50M) could signal institutional accumulation',
        advanced: false,
      });
      risks.push({
        title: 'OI build-up at higher strikes',
        description: `Increasing open interest above $${callWall?.toFixed(2) || '220'} suggests bullish positioning`,
        advanced: false,
      });
      risks.push({
        title: 'Volatility expansion',
        description: 'IV spike above 60% compresses time value and accelerates losses',
        advanced: false,
      });
      risks.push({
        title: 'Gamma flip',
        description: 'Shift from negative to positive gamma could accelerate upside moves',
        advanced: true,
      });
      risks.push({
        title: 'Technical breakdown',
        description: `Loss of key support levels below put wall ($${putWall?.toFixed(2) || '200'}) invalidates range thesis`,
        advanced: true,
      });
    } else if (strat.includes('bull put')) {
      risks.push({
        title: 'Break below put wall',
        description: `Sharp decline through $${putWall?.toFixed(2) || '200'} breaches support`,
        advanced: false,
      });
      risks.push({
        title: 'Market selloff',
        description: 'Broader market correction could drag down the underlying',
        advanced: false,
      });
      risks.push({
        title: 'Negative catalyst',
        description: 'Unexpected negative news or earnings miss triggers sharp decline',
        advanced: false,
      });
    } else if (strat.includes('iron condor')) {
      risks.push({
        title: 'Breakout beyond wings',
        description: `Movement beyond $${putWall?.toFixed(2) || '200'} or $${callWall?.toFixed(2) || '220'} threatens both sides`,
        advanced: false,
      });
      risks.push({
        title: 'Volatility spike',
        description: 'Sudden IV expansion threatens profit zone',
        advanced: false,
      });
      risks.push({
        title: 'Event risk',
        description: 'Earnings or macro events cause unexpected large moves',
        advanced: false,
      });
    } else {
      risks.push({
        title: 'Adverse price movement',
        description: `If ${symbol} moves against the ${direction || 'neutral'} thesis`,
        advanced: false,
      });
      risks.push({
        title: 'Time decay erosion',
        description: 'For long options, theta decay reduces value daily',
        advanced: false,
      });
    }

    return risks;
  };

  const risks = generateRisks();

  return (
    <div className="ai-card ai-warning-card">
      <div className="ai-card-header">
        <span className="card-icon">⚠️</span>
        <span>WHEN THIS STRATEGY FAILS</span>
      </div>

      {risks.map((risk, idx) => (
        <div
          key={idx}
          className={`ai-bullet ${risk.advanced ? 'advanced-only' : ''}`}
        >
          <strong>{risk.title}:</strong> {risk.description}
        </div>
      ))}

      {/* Exit Signal — calculated from actual short strikes */}
      <ExitSignal tile={tile} analysis={analysis} />
    </div>
  );
}

function ExitSignal({ tile, analysis }) {
  const legs = tile?.legs || [];
  const symbol = tile?.symbol || '';
  const strat = (tile?.strategy || '').toLowerCase();

  // Find short strikes
  const shortCall = legs.find(l => l.action?.toLowerCase() === 'sell' && l.type?.toLowerCase() === 'call');
  const shortPut = legs.find(l => l.action?.toLowerCase() === 'sell' && l.type?.toLowerCase() === 'put');

  // Use Claude analysis managementPlan if available
  const mgmtPlan = analysis?.riskAnalysis?.managementPlan;
  if (mgmtPlan && mgmtPlan.length > 20) {
    return (
      <div style={{ marginTop: 24, padding: '14px 18px', background: 'rgba(239,68,68,.1)', borderRadius: 8, fontWeight: 600, fontSize: 14, color: 'var(--ai-text-primary)' }}>
        <strong style={{ color: 'var(--ai-danger)' }}>⚡ Exit Signal:</strong> {mgmtPlan}
      </div>
    );
  }

  // Calculate exit signals from actual strikes
  let signal = '';
  if (strat.includes('iron condor') || strat.includes('iron butterfly')) {
    const callExit = shortCall ? (shortCall.strike * 1.02).toFixed(2) : null;
    const putExit = shortPut ? (shortPut.strike * 0.98).toFixed(2) : null;
    if (callExit && putExit) {
      signal = `Close if ${symbol} closes above $${callExit} (2% above short call $${shortCall.strike}) or below $${putExit} (2% below short put $${shortPut.strike}) for 2 consecutive days.`;
    }
  } else if (strat.includes('bear call') || strat.includes('call spread')) {
    if (shortCall) {
      const exit = (shortCall.strike * 1.02).toFixed(2);
      signal = `Close if ${symbol} closes above $${exit} (2% above short call $${shortCall.strike}) for 2 consecutive days.`;
    }
  } else if (strat.includes('bull put') || strat.includes('put spread')) {
    if (shortPut) {
      const exit = (shortPut.strike * 0.98).toFixed(2);
      signal = `Close if ${symbol} closes below $${exit} (2% below short put $${shortPut.strike}) for 2 consecutive days.`;
    }
  } else if (strat.includes('bwb')) {
    // BWB has 2 short legs typically
    const shorts = legs.filter(l => l.action?.toLowerCase() === 'sell');
    if (shorts.length > 0) {
      const maxShort = Math.max(...shorts.map(l => l.strike));
      const minShort = Math.min(...shorts.map(l => l.strike));
      signal = `Close if ${symbol} moves beyond $${(maxShort * 1.02).toFixed(2)} or below $${(minShort * 0.98).toFixed(2)} for 2 consecutive days.`;
    }
  }

  if (!signal) {
    signal = `Monitor ${symbol} relative to short strikes. Close if the underlying breaches by more than 2% for 2 consecutive sessions.`;
  }

  return (
    <div style={{ marginTop: 24, padding: '14px 18px', background: 'rgba(239,68,68,.1)', borderRadius: 8, fontWeight: 600, fontSize: 14, color: 'var(--ai-text-primary)' }}>
      <strong style={{ color: 'var(--ai-danger)' }}>⚡ Exit Signal:</strong> {signal}
    </div>
  );
}

export default StrategyRisksCard;
