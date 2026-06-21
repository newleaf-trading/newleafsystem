/**
 * deriveAllocation.js — Pure budget/batch math for the Build page.
 *
 * Mirrors the derivePosition discipline: one function computes everything,
 * no page recomputes. The held/new split is strict:
 *   - Held (status:'open'): locked qty, closable to free budget
 *   - New  (status:'candidate'): sizable against available budget, removable
 *
 * @module deriveAllocation
 */

// ═══════════════════════════════════════════════════════════════
// deriveAllocation
// ═══════════════════════════════════════════════════════════════

/**
 * @typedef {object} HeldItem
 * @property {string}  id
 * @property {string}  symbol
 * @property {string}  strategy
 * @property {number}  committedRisk  — maxLossTotal (total $, already deployed)
 * @property {number}  qty
 * @property {number}  [pnlTotal]     — current unrealized P&L (for realized-on-close display)
 * @property {boolean} closing        — user toggled "close" on this row
 * @property {number}  [closeQty]     — defaults to full qty; partial close is data-ready
 */

/**
 * @typedef {object} CandidateItem
 * @property {string}  id
 * @property {string}  symbol
 * @property {string}  strategy
 * @property {number}  riskPerContract — maxLoss per contract (single unit)
 * @property {number}  qty            — user-selected contract count
 * @property {boolean} removed        — user clicked ✕ Remove
 */

/**
 * Compute all budget/batch metrics from current Build state.
 *
 * @param {object} input
 * @param {number}          input.riskBudget  — total risk budget ($)
 * @param {HeldItem[]}      input.held
 * @param {CandidateItem[]} input.candidates
 */
export function deriveAllocation({ riskBudget, held, candidates }) {
  const budget = riskBudget || 0;

  const closing = held.filter(h => h.closing);
  const activeHeld = held.filter(h => !h.closing);

  const committed = sum(activeHeld, h => h.committedRisk);
  const freed = sum(closing, h => h.committedRisk);
  const realizedFromCloses = sum(closing, h => h.pnlTotal ?? 0);

  const available = budget - committed;

  const activeNew = candidates.filter(c => !c.removed);
  const allocating = sum(activeNew, c => c.riskPerContract * c.qty);
  const unallocated = available - allocating;

  const openCount = activeNew.filter(c => c.qty > 0).length;
  const closeCount = closing.length;
  const overBudget = unallocated < 0 ? -unallocated : 0;

  // Per-row enrichment
  const heldRows = held.map(h => ({
    ...h,
    pctOfBudget: budget > 0 ? (h.committedRisk / budget) * 100 : 0,
  }));

  const candidateRows = activeNew.map(c => {
    const amount = c.riskPerContract * c.qty;
    return {
      ...c,
      amount,
      pctOfAvailable: available > 0 ? (amount / available) * 100 : 0,
    };
  });

  // Bar segments (percentage of total budget)
  const barCommitted = budget > 0 ? (committed / budget) * 100 : 0;
  const barAllocating = budget > 0 ? (allocating / budget) * 100 : 0;
  const barUnallocated = budget > 0 ? (Math.max(0, unallocated) / budget) * 100 : 0;

  return {
    budget,
    committed,
    freed,
    available,
    allocating,
    unallocated,
    realizedFromCloses,
    openCount,
    closeCount,
    overBudget,
    rows: { held: heldRows, candidates: candidateRows },
    bar: { committed: barCommitted, allocating: barAllocating, unallocated: barUnallocated },
  };
}

// ═══════════════════════════════════════════════════════════════
// buildExecutionBatch
// ═══════════════════════════════════════════════════════════════

/**
 * Turn current Build state into broker orders for execution.
 *
 * @param {object} input
 * @param {HeldItem[]}      input.held
 * @param {CandidateItem[]} input.candidates
 * @returns {Array<{action:'open'|'close', symbol:string, strategy?:string, id?:string, qty:number, realizedPnl?:number}>}
 */
export function buildExecutionBatch({ held, candidates }) {
  const closes = held
    .filter(h => h.closing)
    .map(h => ({
      action: 'close',
      symbol: h.symbol,
      id: h.id,
      qty: h.closeQty ?? h.qty,
      realizedPnl: h.pnlTotal ?? 0,
    }));

  const opens = candidates
    .filter(c => !c.removed && c.qty > 0)
    .map(c => ({
      action: 'open',
      symbol: c.symbol,
      strategy: c.strategy,
      id: c.id,
      qty: c.qty,
    }));

  // Closes first (frees budget), then opens
  return [...closes, ...opens];
}

// ═══════════════════════════════════════════════════════════════
// autoAllocateEqual — split available across active candidates
// ═══════════════════════════════════════════════════════════════

/**
 * Compute equal-split quantities for active candidates.
 * Never touches held rows.
 *
 * @param {number} available — available budget ($)
 * @param {CandidateItem[]} candidates
 * @returns {Object<string, number>} — { [id]: qty }
 */
export function autoAllocateEqual(available, candidates) {
  const active = candidates.filter(c => !c.removed);
  if (active.length === 0) return {};

  const share = available / active.length;
  const result = {};
  for (const c of active) {
    result[c.id] = c.riskPerContract > 0 ? Math.floor(share / c.riskPerContract) : 0;
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function sum(arr, fn) {
  let total = 0;
  for (const item of arr) total += fn(item) || 0;
  return total;
}
