#!/usr/bin/env node
/**
 * trend-backtest.cjs — Phase 3 forward-test OUTCOME LABELLER (Task 3).
 *
 * Reads accrued candidate snapshots (pipeline/reports/trend-candidates/*.json) and, for
 * candidates whose managed window has MATURED (≥21 trading days past signalDate), labels the
 * underlying-path outcome (breach / MAE / held) from Alpaca bars. Re-runnable: fills outcomes
 * as windows mature, never re-labels a matured one differently.
 *
 * The powered study (cohort comparison, setupQuality bands, train/holdout multiplier sweep,
 * vcpNeutralMultiplier move-magnitude study, overlap dedup) is DEFERRED — stubbed to report
 * "n too low — accruing" until real outcomes exist. Building it against n≈6 invites rework.
 *
 * No lookahead: template inputs are strictly ≤ signalDate (set at snapshot time); outcome
 * inputs are strictly > signalDate (enforced here by postSignalWindow + the leakage test).
 *
 * Price basis: pipeline priceHistory uses Alpaca `adjustment=split`, so setupQuality and the
 * support zone are split-adjusted. Outcome bars are fetched with the SAME `adjustment=split`
 * convention — a strike on one basis tested against bars on another manufactures false breaches.
 *
 * Usage:
 *   node trend-backtest.cjs                 # label matured candidates, write outcomes back
 *   node trend-backtest.cjs --dry-run       # compute, write nothing
 *   node trend-backtest.cjs --asof 2026-08-01   # maturity reference date (default: today)
 *   node trend-backtest.cjs --verify-basis  # confirm split-adjustment convention on a dividend name
 */
'use strict';

const path = require('path');
const fs = require('fs');

const CAND_DIR = path.join(__dirname, '..', 'pipeline', 'reports', 'trend-candidates');
const MATURITY_TRADING_DAYS = 21;
const WINDOW_MAX_TRADING_DAYS = 21;   // managed window cap (min(to-expiry, 21 DTE) → 21 here; expiry not tracked)
const WINDOW_MIN_TRADING_DAYS = 5;    // DTE≥5 floor: too-short windows are not labelled

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers (exported for the leakage test — no I/O, no clock)
// ─────────────────────────────────────────────────────────────────────────────

/** Trading days (Mon-Fri) strictly AFTER signalDate, up to and including asOf. Holiday-naive (documented). */
function tradingDaysElapsed(signalDate, asOfDate) {
  const start = new Date(signalDate + 'T00:00:00Z');
  const end = new Date(asOfDate + 'T00:00:00Z');
  let n = 0;
  const d = new Date(start);
  d.setUTCDate(d.getUTCDate() + 1);
  while (d <= end) {
    const dow = d.getUTCDay();
    if (dow >= 1 && dow <= 5) n++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return n;
}

/** Template window: bars with date ≤ signalDate (strictly pre/at-signal). */
function preSignalBars(bars, signalDate) {
  return bars.filter(b => b.date <= signalDate);
}

/**
 * Outcome window: bars STRICTLY after signalDate, capped at maxTradingDays.
 * Returns null if fewer than minTradingDays bars exist (DTE≥5 floor → don't label).
 */
function postSignalWindow(bars, signalDate, opts = {}) {
  const max = opts.maxTradingDays ?? WINDOW_MAX_TRADING_DAYS;
  const min = opts.minTradingDays ?? WINDOW_MIN_TRADING_DAYS;
  const after = bars.filter(b => b.date > signalDate).sort((a, b) => (a.date < b.date ? -1 : 1));
  if (after.length < min) return null;
  return after.slice(0, max);
}

/**
 * Label the underlying-path outcome for a bull-put-at-support candidate.
 * @param {{shortStrike:number, atrAtSignal:number}} candidate
 * @param {Array<{date,low,high,close}>} windowBars  MUST be post-signal only (from postSignalWindow)
 * breached = any window low < shortStrike. MAE = max excursion past strike, in ATR units.
 */
function labelOutcome(candidate, windowBars) {
  const strike = candidate.shortStrike;
  const atr = candidate.atrAtSignal;
  if (strike == null || !windowBars || !windowBars.length) return null;
  let lowestLow = Infinity, maxExcursion = 0;
  for (const b of windowBars) {
    lowestLow = Math.min(lowestLow, b.low);
    if (b.low < strike) maxExcursion = Math.max(maxExcursion, strike - b.low);
  }
  const breached = lowestLow < strike;
  const maeAtr = atr > 0 ? +(maxExcursion / atr).toFixed(3) : null;
  return {
    breached, held: !breached, maeAtr,
    lowestLow: +lowestLow.toFixed(2), shortStrike: strike,
    windowStart: windowBars[0].date, windowEnd: windowBars[windowBars.length - 1].date,
    barsUsed: windowBars.length, priceBasis: 'split-adjusted',
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// I/O (only in main path; never imported by tests)
// ─────────────────────────────────────────────────────────────────────────────
function alpacaCreds() {
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'pipeline', 'config.json'), 'utf8'));
  return { id: cfg.alpaca.apiKey, secret: cfg.alpaca.secretKey };
}

async function fetchAlpacaBars(symbol, startDate, endDate, adjustment = 'split') {
  const { id, secret } = alpacaCreds();
  const url = `https://data.alpaca.markets/v2/stocks/${symbol}/bars?timeframe=1Day&start=${startDate}&end=${endDate}&limit=500&adjustment=${adjustment}`;
  const res = await fetch(url, { headers: { 'APCA-API-KEY-ID': id, 'APCA-API-SECRET-KEY': secret, Accept: 'application/json' }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Alpaca ${res.status} for ${symbol}`);
  const d = await res.json();
  return (d.bars || []).map(b => ({ date: (b.t || '').split('T')[0], open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v }));
}

function addDays(dateStr, n) { const d = new Date(dateStr + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().split('T')[0]; }
function todayISO() { return new Date().toISOString().split('T')[0]; }

// ─────────────────────────────────────────────────────────────────────────────
// Deferred analyses — stubbed until n is real (do NOT compute against n≈6)
// ─────────────────────────────────────────────────────────────────────────────
const MIN_N_FOR_STUDY = 100; // bull-put conflicted needed before any multiplier is proposed
function deferredReport(maturedByCohort) {
  const lines = [
    ['Cohort comparison (breach rate by verdict)', maturedByCohort.conflicted + maturedByCohort.aligned + maturedByCohort.neutral],
    ['Per-setupQuality-band breakdown', maturedByCohort.conflicted],
    ['conflictMultiplier train/holdout sweep', maturedByCohort.bullPutConflicted],
    ['vcpNeutralMultiplier move-magnitude study', maturedByCohort.neutralVcp],
    ['Overlap dedup decision', maturedByCohort.overlap],
  ];
  console.log('\n  Deferred studies (n too low — accruing):');
  for (const [name, n] of lines) {
    console.log(`    • ${name}: n=${n}${n >= MIN_N_FOR_STUDY ? '  ← ENOUGH — ready to run' : `  (need ≥${MIN_N_FOR_STUDY})`}`);
  }
}

async function verifyBasis() {
  // A dividend name: split vs all-adjusted closes diverge historically, proving adjustment matters.
  const sym = 'ABBV';
  const end = todayISO(), start = addDays(end, -120);
  const [split, all] = await Promise.all([fetchAlpacaBars(sym, start, end, 'split'), fetchAlpacaBars(sym, start, end, 'all')]);
  const oldest = split[0]?.date;
  const sC = split[0]?.close, aC = all.find(b => b.date === oldest)?.close;
  console.log(`\n  Price-basis verification (${sym}, oldest bar ${oldest}):`);
  console.log(`    adjustment=split close: ${sC}`);
  console.log(`    adjustment=all   close: ${aC}`);
  console.log(`    → ${sC === aC ? 'identical here (no recent ex-div in window)' : 'DIFFER — adjustment convention is material'}`);
  console.log(`    Convention chosen: split-adjusted (matches pipeline priceHistory adjustment=split).`);
}

async function main() {
  const args = process.argv.slice(2);
  const DRY = args.includes('--dry-run');
  const asOf = (args.indexOf('--asof') >= 0 && args[args.indexOf('--asof') + 1]) || todayISO();
  if (args.includes('--verify-basis')) { await verifyBasis(); return; }

  if (!fs.existsSync(CAND_DIR)) { console.log('No candidate snapshots yet — run trend-candidate-snapshot.cjs first.'); return; }
  const files = fs.readdirSync(CAND_DIR).filter(f => /^\d{4}-W\d{2}\.json$/.test(f));

  let total = 0, immature = 0, labelled = 0, alreadyLabelled = 0, skippedShort = 0;
  const maturedByCohort = { aligned: 0, neutral: 0, conflicted: 0, bullPutConflicted: 0, neutralVcp: 0, overlap: 0 };

  for (const f of files) {
    const fp = path.join(CAND_DIR, f);
    const doc = JSON.parse(fs.readFileSync(fp, 'utf8'));
    let changed = false;
    for (const r of doc.records) {
      total++;
      if (r.outcome) { alreadyLabelled++; continue; }
      if (!r.signalDate) { continue; }
      if (tradingDaysElapsed(r.signalDate, asOf) < MATURITY_TRADING_DAYS) { immature++; continue; }

      // matured — count cohorts, then label from Alpaca
      maturedByCohort[r.verdict] = (maturedByCohort[r.verdict] || 0) + 1;
      if (r.cohortBullPutAtSupport && r.verdict === 'conflicted') maturedByCohort.bullPutConflicted++;
      if (r.verdict === 'neutral' && r.vcpActive) maturedByCohort.neutralVcp++;
      if (r.overlap) maturedByCohort.overlap++;

      let bars;
      try { bars = await fetchAlpacaBars(r.symbol, r.signalDate, addDays(r.signalDate, 45)); }
      catch (e) { console.error(`  ${r.symbol}: fetch failed — ${e.message}`); continue; }
      const window = postSignalWindow(bars, r.signalDate);
      if (!window) { skippedShort++; continue; } // DTE<5 floor
      r.outcome = labelOutcome(r, window);
      r.outcome.labeledAt = asOf;
      labelled++; changed = true;
    }
    if (changed && !DRY) {
      fs.writeFileSync(fp, JSON.stringify(doc, null, 2));
    }
  }

  console.log(`\n  ═══ Trend Outcome Labeller (asOf ${asOf}) ═══`);
  console.log(`  snapshots: ${files.length} · candidates: ${total}`);
  console.log(`  immature (<${MATURITY_TRADING_DAYS} trading days): ${immature} · already labelled: ${alreadyLabelled}`);
  console.log(`  newly labelled: ${labelled}${DRY ? ' (dry-run, not written)' : ''} · skipped (window<${WINDOW_MIN_TRADING_DAYS}d): ${skippedShort}`);
  deferredReport(maturedByCohort);
  console.log('');
}

if (require.main === module) {
  main().catch(e => { console.error('Error:', e.message); process.exit(1); });
}

module.exports = { tradingDaysElapsed, preSignalBars, postSignalWindow, labelOutcome };
