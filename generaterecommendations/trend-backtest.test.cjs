'use strict';

/**
 * trend-backtest.test.cjs — MANDATORY leakage guard for the forward-test labeller.
 * Run: node generaterecommendations/trend-backtest.test.cjs
 *
 * Fails on ANY temporal leakage between the pre-signal template window and the
 * post-signal outcome window. Green now, against synthetic fixtures, before real
 * outcomes accrue — this is the guard that keeps the eventual study honest.
 */

const { tradingDaysElapsed, preSignalBars, postSignalWindow, labelOutcome } = require('./trend-backtest.cjs');

let passed = 0, failed = 0;
function assert(c, name) { if (c) { passed++; console.log(`  PASS  ${name}`); } else { failed++; console.error(`  FAIL  ${name}`); } }
function eq(a, b, name) { assert(a === b, `${name} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`); }

// Synthetic series straddling a signal date. Pre-signal has a deliberate BREACH (low 90 < strike 100);
// post-signal HOLDS (all lows ≥ 100). If the windows leak, the pre-signal breach corrupts the outcome.
const SIGNAL = '2026-03-13';
const STRIKE = 100, ATR = 5;
function d(i) { const x = new Date('2026-03-01T00:00:00Z'); x.setUTCDate(x.getUTCDate() + i); return x.toISOString().split('T')[0]; }
const bars = [];
for (let i = 0; i < 13; i++) bars.push({ date: d(i), open: 105, high: 106, low: i === 6 ? 90 : 104, close: 105, volume: 1e6 }); // pre/at-signal: breach on day 6
for (let i = 13; i < 45; i++) bars.push({ date: d(i), open: 108, high: 110, low: 106, close: 108, volume: 1e6 });            // post-signal: holds
// d(12) = 2026-03-13 = SIGNAL (at-signal, belongs to template). d(13)+ are strictly post-signal.

// ── Window boundary integrity ────────────────────────────────────────────────
(() => {
  console.log('\n[1] window boundaries (no cross-contamination)');
  const pre = preSignalBars(bars, SIGNAL);
  const post = postSignalWindow(bars, SIGNAL);
  assert(pre.every(b => b.date <= SIGNAL), 'preSignalBars: every bar ≤ signalDate');
  assert(post.every(b => b.date > SIGNAL), 'postSignalWindow: every bar > signalDate (strict)');
  assert(!post.some(b => b.date === SIGNAL), 'signal-day bar is NOT in the outcome window');
  assert(pre.some(b => b.date === SIGNAL), 'signal-day bar IS in the template window');
})();

// ── The core leakage test: pre-signal breach must NOT label as breached ──────
(() => {
  console.log('\n[2] no lookahead — pre-signal breach excluded from outcome');
  const post = postSignalWindow(bars, SIGNAL);
  const out = labelOutcome({ shortStrike: STRIKE, atrAtSignal: ATR }, post);
  eq(out.held, true, 'outcome = held (post-signal lows all ≥ strike)');
  eq(out.breached, false, 'pre-signal breach (day 6, low 90) did NOT leak into the label');
  eq(out.maeAtr, 0, 'MAE = 0 ATR (no post-signal excursion past strike)');

  // Adversarial: if someone fed the FULL series (leak), it WOULD breach — proving the guard matters.
  const leaked = labelOutcome({ shortStrike: STRIKE, atrAtSignal: ATR }, bars);
  eq(leaked.breached, true, 'control: full (leaked) series breaches — so the window filter is load-bearing');
})();

// ── Post-signal breach IS detected, in ATR units ─────────────────────────────
(() => {
  console.log('\n[3] genuine post-signal breach detected + MAE in ATR');
  const b2 = bars.map(b => ({ ...b }));
  b2[20].low = 88; // a real post-signal breach: 100 - 88 = 12 → 12/5 = 2.4 ATR
  const out = labelOutcome({ shortStrike: STRIKE, atrAtSignal: ATR }, postSignalWindow(b2, SIGNAL));
  eq(out.breached, true, 'post-signal low below strike → breached');
  eq(out.maeAtr, 2.4, 'MAE = 2.4 ATR (12 pts / 5 ATR)');
})();

// ── Maturity + DTE floor ─────────────────────────────────────────────────────
(() => {
  console.log('\n[4] maturity + DTE≥5 floor');
  eq(tradingDaysElapsed('2026-06-19', '2026-06-20'), 0, 'Fri→Sat = 0 trading days (immature)');
  assert(tradingDaysElapsed('2026-06-19', '2026-07-20') >= 21, '~1 month later ≥ 21 trading days (matured)');
  const short = [{ date: '2026-03-14', low: 99, high: 101, close: 100 }, { date: '2026-03-15', low: 99, high: 101, close: 100 }];
  eq(postSignalWindow(short, SIGNAL), null, 'window with <5 post-signal bars → null (not labelled)');
})();

console.log(`\n${'─'.repeat(48)}`);
console.log(`Trend backtest leakage guard: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);
