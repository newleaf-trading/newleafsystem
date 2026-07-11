'use strict';
/**
 * reaction-gate.cjs — pipeline adapter over the SHARED reaction gate.
 * ─────────────────────────────────────────────────────────────────────────────
 * Delegates to shared/reaction/gate.cjs — the SAME code the API and movement-range
 * use — so the reports can never disagree with them. Keeps the original function
 * names so newleaf-pipeline.js doesn't change.
 *
 * Pipeline behaviour: PROMOTE a neutral gamma pick to the aligned directional spread
 * when the shared gate says so. On a falling-knife veto it keeps the gamma pick (the
 * NO_TRADE semantics live in the decision layer / API, not the raw report).
 * ─────────────────────────────────────────────────────────────────────────────
 */
const R = require('../shared/reaction/index.cjs');

/** Build the shared reaction gate result from a report's own data. */
function computeReactionRails(report) {
  const t = report.technicalData || {}, g = report.gammaData || {}, s = report.snapshot || {};
  const candles = (t.priceHistory || []).map(b => ({
    date: (b.t || '').split('T')[0], open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v || 0,
  }));
  const atmIv = g.ivData?.atmIv || 0;
  const rv = (t.realizedVol30d || 0) * 100;
  return R.computeReactionGate({
    spot: s.price, candles,
    putWall: g.analysis?.put_wall, callWall: g.analysis?.call_wall,
    sma50: t.sma50, sma100: t.sma100, sma200: t.sma200,
    bbLower: t.bb?.lower, bbUpper: t.bb?.upper,
    atrPct: t.atrPct || 0.02, adx: t.adx14,
    ivRv: (rv > 0 && atmIv > 0) ? atmIv / rv : 0,
    gammaConfidence: g.analysis?.confidence_score || 0,
    rsi: t.rsi, isQualityName: !!report.isQualityName,
  });
}

/** Promote a neutral gamma pick when the shared gate returns a directional spread. */
function applyReactionGate(gammaStrategyCode, gate) {
  const act = R.applyReactionGate(gammaStrategyCode, gate);
  if (!act || act.veto || !act.strategy) return null;  // veto / no promotion → keep gamma pick
  return { strategy: act.strategy, direction: act.direction, note: act.note };
}

module.exports = { computeReactionRails, applyReactionGate };
