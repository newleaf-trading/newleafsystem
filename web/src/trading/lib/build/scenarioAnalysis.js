/**
 * Scenario analysis — pure functions for Bull/Flat/Bear projections.
 *
 * Ported from PortfolioPageRefactored.jsx (lines 552-597).
 * Adapted for pre-entry strategies: current P&L is zero, projections
 * estimate outcomes if the user executes the shortlisted trades today.
 */

/**
 * Compute Bull/Flat/Bear scenario projections for a set of strategies.
 *
 * @param {object[]} strategies — [{strategy, maxProfit, maxLoss, quantity}]
 * @returns {{ scenario: string, return: number }[]}
 */
export function computeScenarios(strategies) {
  let bullCase = 0;
  let flatCase = 0;
  let bearCase = 0;

  strategies.forEach(item => {
    const qty = item.quantity || 1;
    const maxProfit = (item.maxProfit || 0) * qty;
    const maxLoss = (item.maxLoss || 0) * qty;
    const strategy = (item.strategy || '').toLowerCase();

    if (strategy.includes('call') && !strategy.includes('spread') && !strategy.includes('condor')) {
      // Long call or covered call
      bullCase += maxProfit * 0.8;
      flatCase -= maxLoss * 0.3;
      bearCase -= maxLoss;
    } else if (strategy.includes('put') && !strategy.includes('spread') && !strategy.includes('condor')) {
      // Long put or cash-secured put
      bullCase -= maxLoss;
      flatCase -= maxLoss * 0.3;
      bearCase += maxProfit * 0.8;
    } else if (strategy.includes('iron condor') || strategy.includes('iron butterfly')) {
      // Neutral strategies — best in flat markets
      bullCase -= maxLoss * 0.5;
      flatCase += maxProfit * 0.9;
      bearCase -= maxLoss * 0.5;
    } else if (strategy.includes('spread')) {
      // Directional spreads
      bullCase += maxProfit * 0.4;
      flatCase += maxProfit * 0.2;
      bearCase -= maxLoss * 0.6;
    } else {
      // Default: slightly bullish bias
      bullCase += maxProfit * 0.3;
      flatCase += maxProfit * 0.5;
      bearCase -= maxLoss * 0.4;
    }
  });

  return [
    { scenario: 'Bull Market', return: Math.round(bullCase) },
    { scenario: 'Flat Market', return: Math.round(flatCase) },
    { scenario: 'Bear Market', return: Math.round(bearCase) },
  ];
}

/**
 * Compute allocation data grouped by strategy type (for PieChart).
 *
 * @param {object[]} strategies — [{strategy, maxLoss, quantity}]
 * @returns {{ name: string, value: number, count: number }[]}
 */
export function computeAllocationByStrategy(strategies) {
  const byStrategy = {};

  strategies.forEach(item => {
    const strategyName = item.strategy || 'Unknown';
    const qty = item.quantity || 1;
    const risk = (item.maxLoss || 0) * qty;

    if (!byStrategy[strategyName]) {
      byStrategy[strategyName] = { name: strategyName, value: 0, count: 0 };
    }
    byStrategy[strategyName].value += risk;
    byStrategy[strategyName].count += 1;
  });

  return Object.values(byStrategy).sort((a, b) => b.value - a.value);
}

/**
 * Compute risk vs reward breakdown by strategy (for BarChart).
 *
 * @param {object[]} strategies — [{strategy, maxProfit, maxLoss, quantity}]
 * @returns {{ name: string, profit: number, risk: number }[]}
 */
export function computeRiskRewardBreakdown(strategies) {
  const byStrategy = {};

  strategies.forEach(item => {
    const strategyName = item.strategy || 'Unknown';
    const qty = item.quantity || 1;
    const profit = (item.maxProfit || 0) * qty;
    const risk = (item.maxLoss || 0) * qty;

    if (!byStrategy[strategyName]) {
      byStrategy[strategyName] = { name: strategyName, profit: 0, risk: 0 };
    }
    byStrategy[strategyName].profit += profit;
    byStrategy[strategyName].risk += risk;
  });

  return Object.values(byStrategy);
}
