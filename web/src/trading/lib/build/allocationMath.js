/**
 * Portfolio allocation math — pure functions.
 *
 * Ported from PortfolioPageRefactored.jsx (lines 370-502).
 * Adapted for shortlisted (pre-entry) strategies instead of owned positions.
 *
 * All functions take data in, return numbers. No React, no Firestore, no side effects.
 */

import { WIN_TAKE_PCT, LOSS_TAKE_PCT, DEFAULT_MAX_DRAWDOWN } from './evConstants';

/**
 * Compute summary statistics for a set of strategies.
 *
 * @param {object[]} strategies — [{maxProfit, maxLoss, probability, quantity}]
 * @param {number} totalCapital — user's total capital
 * @param {number} maxDrawdown — fraction (0.10 = 10%)
 * @returns {object} summary stats
 */
export function computeSummaryStats(strategies, totalCapital, maxDrawdown = DEFAULT_MAX_DRAWDOWN) {
  let totalMaxRisk = 0;
  let totalPotentialReturn = 0;
  let totalExpectedProfit = 0;
  let totalProbSum = 0;

  strategies.forEach(s => {
    const qty = s.quantity || 1;
    const maxProfit = (s.maxProfit || 0) * qty;
    const maxLoss = (s.maxLoss || 0) * qty;
    const prob = normaliseProb(s.probability);

    totalMaxRisk += maxLoss;
    totalPotentialReturn += maxProfit;
    totalExpectedProfit += computeExpectedProfit(prob, maxProfit, maxLoss);
    totalProbSum += prob;
  });

  const count = strategies.length;
  const avgWinRate = count > 0 ? (totalProbSum / count) * 100 : 0;
  const expectedWinners = totalProbSum;
  const riskBudget = totalCapital * maxDrawdown;

  return {
    totalMaxRisk,
    totalPotentialReturn,
    totalExpectedProfit: Math.round(totalExpectedProfit),
    avgWinRate,
    expectedWinners,
    riskBudget,
    count,
  };
}

/**
 * Compute expected profit for a single strategy.
 * EV = (prob × maxProfit × WIN_TAKE_PCT) - ((1-prob) × maxLoss × LOSS_TAKE_PCT)
 *
 * @param {number} prob — probability as decimal (0-1)
 * @param {number} maxProfit — in dollars (already × quantity)
 * @param {number} maxLoss — in dollars (already × quantity)
 * @returns {number} expected profit in dollars
 */
export function computeExpectedProfit(prob, maxProfit, maxLoss) {
  return (prob * maxProfit * WIN_TAKE_PCT) - ((1 - prob) * maxLoss * LOSS_TAKE_PCT);
}

/**
 * Format the scenario text from expectedWinners count.
 * e.g. 3.04 winners out of 4 → "~3 of 4 win"
 *
 * @param {number} expectedWinners — sum of probabilities (e.g. 3.04)
 * @param {number} totalCount — number of strategies
 * @returns {string}
 */
export function formatScenarioText(expectedWinners, totalCount) {
  if (totalCount === 0) return 'No strategies';
  return `~${Math.round(expectedWinners)} of ${totalCount} win`;
}

/**
 * Compute fund allocation for each strategy.
 *
 * @param {object[]} strategies — [{id, maxLoss, quantity}]
 * @param {number} riskBudget — total risk budget in dollars
 * @param {boolean} autoAllocate — if true, split equally
 * @param {object} customAllocations — {id: amount} overrides
 * @returns {{ strategies: object[], allocatedAmount: number, unallocated: number, allocationPct: number, isOverBudget: boolean }}
 */
export function computeAllocation(strategies, riskBudget, autoAllocate = false, customAllocations = {}) {
  const count = strategies.length;
  if (count === 0) {
    return { strategies: [], allocatedAmount: 0, unallocated: riskBudget, allocationPct: 0, isOverBudget: false };
  }

  const enriched = strategies.map(s => {
    const riskPerContract = s.maxLoss || 0;
    let allocationAmount;

    if (autoAllocate) {
      allocationAmount = riskBudget / count;
    } else {
      allocationAmount = customAllocations[s.id] || (riskBudget / count);
    }

    const contracts = riskPerContract > 0 ? Math.max(1, Math.floor(allocationAmount / riskPerContract)) : 1;
    const actualRisk = contracts * riskPerContract;
    const allocationPct = riskBudget > 0 ? (allocationAmount / riskBudget) * 100 : 0;

    return {
      ...s,
      riskPerContract,
      allocationAmount,
      actualRisk,
      contracts,
      allocationPct,
    };
  });

  const allocatedAmount = enriched.reduce((sum, s) => sum + s.actualRisk, 0);
  const unallocated = riskBudget - allocatedAmount;
  const allocationPct = riskBudget > 0 ? (allocatedAmount / riskBudget) * 100 : 0;

  return {
    strategies: enriched,
    allocatedAmount,
    unallocated,
    allocationPct,
    isOverBudget: allocatedAmount > riskBudget,
  };
}

/**
 * Normalise a probability value to a decimal 0-1.
 * Handles: percentages (0-100), decimals (0-1), out-of-range, missing values.
 */
export function normaliseProb(raw) {
  if (!raw && raw !== 0) return 0.5; // default 50% if missing
  let p = raw;
  if (p > 0 && p <= 1) p = p; // already decimal
  else if (p > 1 && p <= 100) p = p / 100; // percentage
  else p = Math.max(0, Math.min(1, p / 100));
  return Math.max(0, Math.min(1, p));
}
