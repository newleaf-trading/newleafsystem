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
 * Build enriched pick JSON — the full format used by the PDF pipeline
 * and matching the structure at output/{week}/enriched/{SYM}-iron-condor.json
 */
export function buildPdfData(pick) {
  const { tileId, tile, analysis } = pick;
  const symbol = tile.symbol || '';
  const sentiment = tile.sentiment || analysis?._sentiment || null;
  const rationale = analysis?.strategyRationale;
  const ti = analysis?.technicalIndicators;

  return {
    tileId,
    symbol,
    companyName: tile.companyName || symbol,
    strategy: tile.strategy || '',
    direction: tile.direction || 'neutral',
    spotPrice: tile.underlyingPrice || tile.currentPrice || tile.price || 0,
    expiry: tile.expiry || tile.expirationDate || '',
    dte: tile.dte || tile.daysToExpiry || 0,
    legs: tile.legs || [],
    greeks: tile.greeks || {},
    gammaData: tile.gammaData || {},
    maxProfit: tile.maxProfit || 0,
    maxLoss: tile.maxLoss || 0,
    netCredit: tile.netCredit || 0,
    rewardRisk: tile.rewardRisk || 0,
    oddsOfProfit: tile.oddsOfProfit || tile.probOfProfit || 0,
    thesis: rationale?.whyThisStrategy || '',
    keyLevels: {
      putWall: tile.gammaData?.put_wall || null,
      callWall: tile.gammaData?.call_wall || null,
      support: (ti?.supportResistance?.support || []).map(s => s.level),
      resistance: (ti?.supportResistance?.resistance || []).map(r => r.level),
    },
    ivContext: {
      currentIV: ti?.impliedVolatility?.currentIV || null,
      ivRank: ti?.impliedVolatility?.ivRank || null,
      signal: ti?.impliedVolatility?.description || null,
    },
    riskSummary: analysis?.riskAnalysis?.maxPainScenario || '',
    exitPlan: {
      profitTarget: analysis?.thetaDecaySchedule?.earlyCloseRecommendation || '',
      managementPlan: analysis?.riskAnalysis?.managementPlan || '',
    },
    sentiment: sentiment || null,
    analysis: analysis || null,
    generatedAt: new Date().toISOString(),
  };
}
