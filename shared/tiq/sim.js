'use strict';

/**
 * NewLeaf TIQ — Decision Simulator engine. Ported from the reference prototype
 * docs/tiq/reference/decision-sim.html; plumbing rewritten, logic preserved.
 *
 * Four commitments, all deliberate (spec-simulator.md §5):
 *   1. The market path is SCRIPTED and never reacts to the user. Fixed path,
 *      variable user state — that is what makes it an assessment and not luck.
 *   2. Scoring is path-dependent: the same action scores differently depending
 *      on the position actually held. (Decision points live in the scenario
 *      nodes and arrive in the decision log; this engine consumes the log.)
 *   3. Decision score and P&L are computed separately, then shown to diverge.
 *   4. The same decision log is replayed against alternate scripts — the
 *      counterfactual. Deterministic and cheap.
 *
 * MONEY IS INTEGER PENCE INTERNALLY. Prices carry two decimals, so a leg's P&L
 * ((credit − mark) × multiplier × contracts) is exact in pence but accumulates
 * float noise in pounds. Every leg is rounded to pence at the moment it is
 * realised (`legPence`), state cash is integer pence, and pounds appear only at
 * the presentation boundary via `toPounds`. This makes path-independence exact
 * by construction: identical decision logs on different scripts return the same
 * integer, not two floats that happen to be close.
 */

const CONTRACT_MULTIPLIER = 100; // option contract multiplier (shares per contract)

/** Price in pounds (2dp) → integer pence. Math.round absorbs float noise (2.30·100). */
function toPence(pounds) { return Math.round(pounds * 100); }

/** Presentation boundary: integer pence → pounds. Call this, and only this, to display. */
function toPounds(pence) { return pence / 100; }

/**
 * Realised/unrealised value of one lot in INTEGER pence, rounded at the price
 * (i.e. at the point of realisation). (creditPence − markPence) is exact for
 * 2dp inputs, so the whole leg is an exact integer.
 */
function legPence(credit, mark, n) {
  return (toPence(credit) - toPence(mark)) * CONTRACT_MULTIPLIER * n;
}

function simCloneLots(lots) { return lots.map(l => ({ n: l.n, credit: l.credit })); }

/** Fresh state for a scenario: the opening position, flat cash (pence), empty log. */
function freshState(scenario) {
  return {
    lots: simCloneLots(scenario.opening_position || []),
    cash: 0, // integer pence
    breaks: [],
    log: []
  };
}

/** Open P&L of the current position at time key `t` on a given script, in integer pence. */
function unrealised(state, script, t) {
  const mark = script[t];
  return state.lots.reduce((a, l) => a + legPence(l.credit, mark, l.n), 0);
}

/**
 * Apply one action at time `t` against `script`. PURE — returns a new state,
 * never mutates the input. Cash is accumulated in integer pence. Actions match
 * the reference prototype:
 *   closeAll, closeTwo, addTwo, addThree, reopen, reopenBig, hold, none.
 * A rich sell/close (addTwo etc.) opens at the current scripted mark.
 */
function applyAction(state, action, t, script) {
  const s = { lots: simCloneLots(state.lots), cash: state.cash, breaks: state.breaks.slice(), log: state.log.slice() };
  const mark = script[t];

  if (action === 'closeAll') {
    s.cash += unrealised(s, script, t);
    s.lots = [];
  } else if (action === 'closeTwo') {
    const l = s.lots[0];
    if (l) {
      s.cash += legPence(l.credit, mark, 2);
      l.n -= 2;
      if (l.n <= 0) s.lots.shift();
    }
  } else if (action === 'addTwo') {
    s.lots.push({ n: 2, credit: mark });
  } else if (action === 'addThree') {
    s.lots.push({ n: 3, credit: mark });
  } else if (action === 'reopen') {
    s.lots.push({ n: 3, credit: mark });
  } else if (action === 'reopenBig') {
    s.lots.push({ n: 6, credit: mark });
  }
  // 'hold' and 'none' change nothing.
  return s;
}

/**
 * Replay a decision log against any script and return the final realised P&L in
 * INTEGER PENCE. This is the counterfactual: run the identical log against
 * SCRIPT_A (what happened) and SCRIPT_B (the other Wednesday). PURE — the log is
 * not consumed, and equal logs on different scripts return equal integers.
 *
 * @param {object} scenario  needs scripts and settle_t
 * @param {object[]} log     [{ act, t }]
 * @param {object} script    mark table, e.g. scenario.scripts.A
 */
function replay(scenario, log, script) {
  let s = freshState(scenario);
  for (const e of log) s = applyAction(s, e.act, e.t, script);
  s.cash += unrealised(s, script, scenario.settle_t);
  return s.cash;
}

/** Total decision points across the log (each decision is scored out of 10). */
function decisionScore(log) {
  return (log || []).reduce((a, e) => a + (Number.isFinite(e.points) ? e.points : (e.pts || 0)), 0);
}

/**
 * Score a completed run. Computes the decision score, the maximum, and P&L (in
 * integer pence) on every script in the scenario, then flags the two teaching
 * cases:
 *   lucky  — low decision score but a positive outcome on the script that
 *            happened ("rescued, not right").
 *   robbed — high decision score but a worse outcome than an alternate script
 *            ("good decisions, worse outcome").
 * P&L is pence; call toPounds() at the presentation boundary. Confidence/pace
 * are computed separately by calibration.js.
 */
function scoreRun(scenario, log, opts = {}) {
  const primary = opts.primaryScript || 'A';
  const nDecisions = (scenario.nodes && scenario.nodes.length) || log.length;
  const maxScore = nDecisions * 10;
  const score = decisionScore(log);

  const pnl = {};
  for (const key of Object.keys(scenario.scripts)) pnl[key] = replay(scenario, log, scenario.scripts[key]);

  const altBest = Math.max(...Object.keys(pnl).filter(k => k !== primary).map(k => pnl[k]), -Infinity);
  const lucky = score <= maxScore * 0.5 && pnl[primary] > 0;
  const robbed = score >= maxScore * 0.7 && Number.isFinite(altBest) && pnl[primary] < altBest;

  return { decisionScore: score, maxScore, pnl, primaryScript: primary, lucky, robbed };
}

/**
 * Distribution stats across many scripts (spec-simulator §5.4: "run the log
 * against 200 scripts rather than two and show the distribution"). All P&L in
 * integer pence; account in pence too. survives = the account is not wiped
 * (accountPence + pnl > 0).
 *   { n, median, worstDecile, survivalShare }
 */
function survivalStats(pnlValues, accountPence) {
  const vals = (pnlValues || []).filter(Number.isFinite).slice().sort((a, b) => a - b);
  const n = vals.length;
  if (!n) return { n: 0, median: 0, worstDecile: 0, survivalShare: 0 };
  const median = n % 2 ? vals[(n - 1) / 2] : Math.round((vals[n / 2 - 1] + vals[n / 2]) / 2);
  const worstDecile = vals[Math.floor(0.1 * (n - 1))]; // 10th-percentile outcome
  const survived = vals.filter(v => accountPence + v > 0).length;
  return { n, median, worstDecile, survivalShare: survived / n };
}

module.exports = {
  CONTRACT_MULTIPLIER,
  toPence,
  toPounds,
  legPence,
  freshState,
  unrealised,
  applyAction,
  replay,
  decisionScore,
  scoreRun,
  survivalStats
};
