/**
 * Build export JSONs for HeyGen video and PDF generation.
 */

/**
 * Build HeyGen video script JSON from pick data.
 * This JSON can be sent to HeyGen API to generate a video.
 */
export function buildHeyGenScript(pick) {
  const { tile, analysis } = pick;
  const symbol = tile.symbol || '';
  const strategy = tile.strategy || '';
  const spot = (tile.underlyingPrice || tile.currentPrice || tile.price || 0).toFixed(2);
  const legs = tile.legs || [];
  const rationale = analysis?.strategyRationale;
  const ti = analysis?.technicalIndicators;
  const risk = analysis?.riskAnalysis;
  const theta = analysis?.thetaDecaySchedule;
  const sentiment = tile.sentiment || analysis?._sentiment || null;
  const sentScore = sentiment?.composite?.score ?? sentiment?.score ?? 'N/A';
  const sentLabel = sentiment?.composite?.label ?? sentiment?.label ?? 'neutral';

  const legsText = legs.map(l =>
    `${l.action === 'sell' ? 'Sell' : 'Buy'} the $${l.strike} ${l.type}`
  ).join(', ');

  // Build narration script sections
  const sections = [
    {
      id: 'intro',
      title: 'Introduction',
      narration: `Welcome to this week's NewLeaf trade analysis. Today we're looking at a ${strategy} on ${symbol}, currently trading at $${spot}.`,
      duration: 8,
    },
    {
      id: 'setup',
      title: 'Trade Setup',
      narration: `Here's the setup: ${legsText}. We're collecting a net credit of $${(tile.netCredit || 0).toFixed(2)} per share, giving us a maximum profit of $${(tile.maxProfit || 0).toFixed(0)} and a maximum loss of $${(tile.maxLoss || 0).toFixed(0)}. The probability of profit is ${tile.oddsOfProfit || 0}%.`,
      duration: 15,
    },
    {
      id: 'thesis',
      title: 'Why This Trade',
      narration: rationale?.whyThisStrategy || `This ${strategy} captures premium while the stock trades in a range.`,
      duration: 12,
    },
    {
      id: 'technicals',
      title: 'Technical Analysis',
      narration: ti ? `RSI is at ${ti.rsi?.value || 'N/A'}, suggesting ${ti.rsi?.signal || 'neutral'} momentum. MACD line is at ${ti.macd?.macdLine || 'N/A'} with the signal at ${ti.macd?.signalLine || 'N/A'}. ${ti.macd?.description || ''} Bollinger Bands show the stock trading between $${ti.bollingerBands?.lower || 'N/A'} and $${ti.bollingerBands?.upper || 'N/A'}.` : 'Technical indicators support the trade setup.',
      duration: 15,
    },
    {
      id: 'sentiment',
      title: 'Market Sentiment',
      narration: `Our 4-engine AI sentiment analysis scores ${symbol} at ${sentScore} out of 100 — that's ${sentLabel}. ${sentiment?.summary || ''}`,
      duration: 10,
    },
    {
      id: 'risk',
      title: 'Risk Management',
      narration: risk?.managementPlan || `Manage risk by closing at 50% of max profit or if the stock approaches either short strike.`,
      duration: 12,
    },
    {
      id: 'cta',
      title: 'Call to Action',
      narration: `For the full analysis with exact strike prices, breakevens, and our complete risk assessment, visit newleafsystem.com/picks. This is not financial advice — options involve risk and are not suitable for all investors.`,
      duration: 10,
    },
  ];

  return {
    _format: 'heygen-script-v1',
    _generatedAt: new Date().toISOString(),
    title: `${symbol} ${strategy} — Weekly Trade Analysis`,
    symbol,
    strategy,
    totalDuration: sections.reduce((s, sec) => s + sec.duration, 0),
    sections,
    metadata: {
      spot,
      credit: (tile.netCredit || 0).toFixed(2),
      maxProfit: (tile.maxProfit || 0).toFixed(0),
      maxLoss: (tile.maxLoss || 0).toFixed(0),
      pop: tile.oddsOfProfit || 0,
      rr: (tile.rewardRisk || 0).toFixed(2),
      expiry: tile.expiry || '',
      dte: tile.dte || 0,
    },
  };
}

/**
 * Build PDF report data JSON from pick data.
 * This is the flattened format expected by generate-report.py (v3 template).
 */
export function buildPdfData(pick) {
  const { tile, analysis } = pick;
  const symbol = tile.symbol || '';
  const strategy = tile.strategy || '';
  const spot = tile.underlyingPrice || tile.currentPrice || tile.price || 0;
  const legs = tile.legs || [];
  const rationale = analysis?.strategyRationale;
  const ti = analysis?.technicalIndicators;
  const risk = analysis?.riskAnalysis;
  const theta = analysis?.thetaDecaySchedule;
  const sentiment = tile.sentiment || analysis?._sentiment || null;

  const COMPANY_NAMES = {
    AAPL: 'Apple', MSFT: 'Microsoft', AMZN: 'Amazon', NVDA: 'Nvidia',
    GOOG: 'Alphabet', META: 'Meta', TSLA: 'Tesla', BABA: 'Alibaba',
    BIDU: 'Baidu', GLD: 'SPDR Gold', BA: 'Boeing', CRM: 'Salesforce',
    UBER: 'Uber', ADBE: 'Adobe', AMD: 'AMD', NFLX: 'Netflix',
    JPM: 'JPMorgan', GS: 'Goldman Sachs', COIN: 'Coinbase',
  };

  const sortedLegs = [...legs].sort((a, b) => a.strike - b.strike);
  const puts = sortedLegs.filter(l => l.type === 'put');
  const calls = sortedLegs.filter(l => l.type === 'call');

  return {
    _format: 'pdf-report-data-v3',
    _generatedAt: new Date().toISOString(),
    SYMBOL: symbol,
    COMPANY_NAME: COMPANY_NAMES[symbol] || symbol,
    STRATEGY_NAME: strategy,
    CURRENT_PRICE: `$${spot.toFixed(2)}`,
    EXPIRATION_DATE: tile.expiry || '',
    DAYS_TO_EXPIRY: tile.dte || 0,
    REPORT_DATE: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
    REPORT_TIME: new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZoneName: 'short' }),
    NET_CREDIT: (tile.netCredit || 0).toFixed(2),
    MAX_PROFIT: `$${(tile.maxProfit || 0).toFixed(0)}`,
    MAX_LOSS: `$${(tile.maxLoss || 0).toFixed(0)}`,
    MAX_PROFIT_DESC: `per contract ($${(tile.netCredit || 0).toFixed(2)} credit)`,
    MAX_LOSS_DESC: 'per contract (defined risk)',
    WIN_RATE: tile.oddsOfProfit || 0,
    WIN_RATE_DESC: 'probability of profit',
    RISK_REWARD: `${(tile.rewardRisk || 0).toFixed(2)}:1`,
    RISK_REWARD_DESC: 'premium collected vs. max risk',
    LONG_PUT_STRIKE: puts[0]?.strike || '',
    SHORT_PUT_STRIKE: puts[1]?.strike || puts[0]?.strike || '',
    SHORT_CALL_STRIKE: calls[0]?.strike || '',
    LONG_CALL_STRIKE: calls[1]?.strike || calls[0]?.strike || '',
    TRADE_CONFIG: `${symbol} ${strategy} — ${legs.map(l => `${l.action === 'sell' ? 'Sell' : 'Buy'} $${l.strike}${l.type[0].toUpperCase()}`).join(' / ')} — Exp. ${tile.expiry || 'N/A'}`,
    THESIS_POINTS: rationale ? `<li>${rationale.whyThisStrategy}</li><li>${rationale.whyTheseStrikes || ''}</li><li>${rationale.whyThisExpiry || ''}</li>` : '',
    MARKET_ENVIRONMENT: rationale?.whyThisStrategy || '',
    RSI_VALUE: ti?.rsi?.value || 'N/A',
    IV_VALUE: ti?.impliedVolatility?.currentIV ? `${ti.impliedVolatility.currentIV}%` : 'N/A',
    PUT_GAMMA_WALL: tile.gammaData?.put_wall ? `$${tile.gammaData.put_wall}` : 'N/A',
    CALL_GAMMA_WALL: tile.gammaData?.call_wall ? `$${tile.gammaData.call_wall}` : 'N/A',
    GAMMA_WALL_EXPLANATION: ti?.supportResistance?.support?.[0]?.description || 'Gamma walls provide dealer hedging support.',
  };
}
