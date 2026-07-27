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
 * All P&L is computed from a scripted mark table. No model calls anywhere.
 */

const CONTRACT_MULTIPLIER = 100;

function simCloneLots(lots) { return lots.map(l => ({ n: l.n, credit: l.credit })); }

/** Fresh state for a scenario: the opening position, flat cash, empty log. */
function freshState(scenario) {
  return {
    lots: simCloneLots(scenario.opening_position || []),
    cash: 0,
    breaks: [],
    log: []
  };
}

/** Open P&L of the current position at time key `t` on a given script. */
function unrealised(state, script, t) {
  const mark = script[t];
  return state.lots.reduce((a, l) => a + (l.credit - mark) * CONTRACT_MULTIPLIER * l.n, 0);
}

/**
 * Apply one action at time `t` against `script`. PURE — returns a new state,
 * never mutates the input. Actions match the reference prototype:
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
      s.cash += (l.credit - mark) * CONTRACT_MULTIPLIER * 2;
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
 * Replay a decision log against any script and return the final realised P&L.
 * This is the counterfactual: run the identical log against SCRIPT_A (what
 * happened) and SCRIPT_B (the other Wednesday). PURE — the log is not consumed.
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
 * Score a completed run. Computes the decision score, the maximum, and P&L on
 * every script in the scenario, then flags the two teaching cases:
 *   lucky  — low decision score but a positive outcome on the script that
 *            happened ("rescued, not right").
 *   robbed — high decision score but a worse outcome than an alternate script
 *            ("good decisions, worse outcome").
 * Confidence/pace are computed separately by calibration.js.
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

module.exports = {
  CONTRACT_MULTIPLIER,
  freshState,
  unrealised,
  applyAction,
  replay,
  decisionScore,
  scoreRun
};
