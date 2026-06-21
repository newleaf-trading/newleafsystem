'use strict';

/**
 * shared/trend/trend-template.cjs — Deterministic SEPA-style Trend Template (v0)
 *
 * An OVERLAY that judges existing reaction-engine candidates. It does NOT
 * generate candidates. Given a symbol's EOD bars and a benchmark's EOD bars,
 * it emits a verdict (`aligned` | `neutral` | `conflicted`) describing whether
 * the prevailing trend backs the short side of the suggested structure.
 *
 *   - `aligned`    : up-template largely passes → endorse (small additive bonus)
 *   - `conflicted` : support sitting in a downtrend (falling-knife) → demote (multiplier)
 *   - `neutral`    : no trend opinion → leave the candidate unchanged
 *                    (unless a VCP base is tightening — imminent expansion suppresses premium)
 *
 * Pure, side-effect-free. No network, no I/O, no clock reads inside the math
 * (`asOf` is passed in, or defaults to the last bar's own date). Moving-average
 * math is reused from `shared/indicators/` — never re-implemented here.
 *
 * The module NEVER imports shared/reaction/score.cjs (A4): to measure overlap
 * with that engine's approach-velocity guard, the caller passes in a
 * `velocityGuardFired` boolean and this module emits `overlap` + records it in
 * provenance. Phase 3 decides whether to suppress one penalty when both fire.
 */

const { sma } = require('../indicators/index.js');

// ─────────────────────────────────────────────────────────────────────────────
// DEFAULT_CONFIG — every threshold lives here so the Phase-3 backtest can tune
// them in one place. Multipliers below are STARTING POINTS, not validated edges.
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_CONFIG = {
  // — Moving averages —
  smaFast: 50,             // short trend MA (Minervini stack top)
  smaMid: 150,             // mid trend MA
  smaSlow: 200,            // long trend MA (stack bottom)
  ma200RisingLookback: 20, // bars back to test whether SMA200 is sloping up (~1 month)

  // — 52-week structure —
  lookback52w: 252,        // trailing bars for the 1y high/low (US trading year)
  off52wLowPct: 0.25,      // close must be ≥25% above the 1y low (off the floor)
  near52wHighPct: 0.25,    // close must be within 25% of the 1y high (leadership)

  // — Relative strength vs benchmark —
  rsWindow: 63,            // ~3 months: window for symbol-return vs benchmark-return
  rsSlopeLookback: 21,     // ~1 month: RS line must be higher now than this many bars ago

  // — VCP (volatility contraction pattern) —
  vcpBaseLookback: 60,     // bars defining "the most recent base"
  vcpSwingWindow: 3,       // bars on each side that qualify a local swing high/low
  vcpMinContractions: 2,   // need at least this many successive pullbacks
  vcpContractionRatio: 0.8,// each pullback depth ≤ 80% of the prior one (contracting)
  vcpVolumeDryRatio: 0.9,  // 2nd-half avg volume ≤ 90% of 1st-half (drying up)

  // — Score weights (sum = 100). maStack is the spine, RS is the confirmation.
  //   A3: VCP is intentionally NOT a weight. It is a neutral-only premium
  //   suppressor, not a trend-strength signal, so the six GATING checks
  //   re-normalize to 100 after dropping the old vcpActive weight. —
  weights: {
    maStack: 26,           // the trend stack is the single strongest signal
    rsPositive: 21,        // outperforming the market and rising
    priceAboveStack: 16,   // price actually riding above the stack
    ma200Rising: 16,       // long-term slope up
    near52wHigh: 11,       // proximity to highs (leadership)
    off52wLow: 10,         // clearly off the lows (not a falling knife)
  },

  // — Verdict → setupQuality adjustment. PLACEHOLDERS until the Phase-3 backtest. —
  conflictMultiplier: 0.6,    // A2: conflicted → SQ *= this. Multiplicative so the
                              //     highest-SQ knives (the most dangerous) are punished hardest.
  alignBonus: 5,              // aligned → SQ += this. Additive; endorsement shouldn't inflate.
  vcpNeutralMultiplier: 0.85, // A3: neutral + vcpActive → SQ *= this. A tightening base under a
                              //     neutral verdict means imminent expansion — the worst entry
                              //     for short premium. Aligned/conflicted are unaffected by VCP.

  // — Misc —
  minBars: 200,            // below this we can't form the stack → forced `neutral`
  benchmarkSymbol: 'SPY',  // label only; series is always passed in as benchmarkBars
};

// ─────────────────────────────────────────────────────────────────────────────
// Small pure helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Tolerant accessors (match reaction engine's `b.x ?? b.shortKey`). */
function closeOf(b) { return b.close ?? b.c; }
function highOf(b) { return b.high ?? b.h; }
function lowOf(b) { return b.low ?? b.l; }
function volOf(b) { return b.volume ?? b.v ?? 0; }

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
function avg(arr) { return arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0; }
function trailingMin(arr, n) { return Math.min(...arr.slice(-n)); }
function trailingMax(arr, n) { return Math.max(-Infinity, ...arr.slice(-n)); }

/**
 * Relative strength of the symbol vs the benchmark.
 * RS line = symbolClose / benchmarkClose (aligned from the end).
 * - positive: symbol's return over rsWindow exceeds the benchmark's AND RS rising
 * - negative: symbol underperforms AND RS line falling
 */
function computeRS(symCloses, benchCloses, cfg) {
  const k = Math.min(symCloses.length, benchCloses.length);
  if (k < cfg.rsWindow + 1) {
    return { ratio: null, line: null, positive: false, negative: false, rising: false, falling: false };
  }
  const s = symCloses.slice(-k);
  const b = benchCloses.slice(-k);
  const line = s.map((v, i) => v / b[i]);

  const last = k - 1;
  const symRet = s[last] / s[last - cfg.rsWindow] - 1;
  const benchRet = b[last] / b[last - cfg.rsWindow] - 1;
  const ratio = (1 + symRet) / (1 + benchRet) - 1; // >0 → symbol led

  const slopeIdx = last - cfg.rsSlopeLookback;
  const rising = slopeIdx >= 0 ? line[last] > line[slopeIdx] : false;
  const falling = slopeIdx >= 0 ? line[last] < line[slopeIdx] : false;

  return {
    ratio,
    line: line[last],
    positive: ratio > 0 && rising,
    negative: ratio < 0 && falling,
    rising,
    falling,
  };
}

/**
 * Deterministic VCP detection over the most recent base.
 * Active when successive peak→trough pullbacks are contracting AND volume is
 * drying up from the first half of the base to the second.
 */
function computeVCP(bars, cfg) {
  const base = bars.slice(-cfg.vcpBaseLookback);
  if (base.length < cfg.vcpSwingWindow * 2 + 1) return false;

  const w = cfg.vcpSwingWindow;
  const highs = base.map(highOf);
  const lows = base.map(lowOf);

  // Mark local swing highs / lows (extreme within ±w window).
  const swings = [];
  for (let i = w; i < base.length - w; i++) {
    const winHi = Math.max(...highs.slice(i - w, i + w + 1));
    const winLo = Math.min(...lows.slice(i - w, i + w + 1));
    if (highs[i] === winHi) swings.push({ type: 'H', price: highs[i] });
    else if (lows[i] === winLo) swings.push({ type: 'L', price: lows[i] });
  }

  // Walk H→L transitions, measuring pullback depth (peak→trough).
  const depths = [];
  for (let i = 0; i < swings.length - 1; i++) {
    if (swings[i].type === 'H' && swings[i + 1].type === 'L') {
      const peak = swings[i].price;
      const trough = swings[i + 1].price;
      if (peak > 0) depths.push((peak - trough) / peak);
    }
  }
  if (depths.length < cfg.vcpMinContractions) return false;

  // Each successive pullback must be tighter than the previous one.
  for (let i = 1; i < depths.length; i++) {
    if (depths[i] > depths[i - 1] * cfg.vcpContractionRatio) return false;
  }

  // Volume drying: 2nd-half average must be lower than 1st-half.
  const half = Math.floor(base.length / 2);
  const vols = base.map(volOf);
  const firstAvg = avg(vols.slice(0, half));
  const secondAvg = avg(vols.slice(half));
  if (!(firstAvg > 0)) return false;
  return secondAvg <= firstAvg * cfg.vcpVolumeDryRatio;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {Object}   args
 * @param {Bar[]}    args.bars                ascending symbol bars { date, open, high, low, close, volume }
 * @param {Bar[]}    args.benchmarkBars       ascending benchmark bars (e.g. SPY)
 * @param {Object}   [args.config]            partial overrides merged over DEFAULT_CONFIG
 * @param {string}   [args.asOf]              ISO date; defaults to the last bar's date (NOT the clock)
 * @param {string}   [args.benchmarkSymbol]   label override for provenance
 * @param {boolean}  [args.velocityGuardFired] A4: did score.cjs's approach-velocity guard fire for this symbol?
 * @returns {TrendVerdict}
 */
function computeTrendTemplate({ bars, benchmarkBars, config, asOf, benchmarkSymbol, velocityGuardFired } = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...(config || {}) };
  cfg.weights = { ...DEFAULT_CONFIG.weights, ...(config && config.weights) };

  const safeBars = Array.isArray(bars) ? bars : [];
  const benchSafe = Array.isArray(benchmarkBars) ? benchmarkBars : [];
  const benchLabel = benchmarkSymbol || cfg.benchmarkSymbol;
  const resolvedAsOf = asOf || (safeBars.length ? (safeBars[safeBars.length - 1].date ?? null) : null);

  // Read-only projections — never mutate the caller's arrays.
  const closes = safeBars.map(closeOf);
  const benchCloses = benchSafe.map(closeOf);
  const close = closes.length ? closes[closes.length - 1] : null;

  const rs = computeRS(closes, benchCloses, cfg);
  const vcpActive = computeVCP(safeBars, cfg);

  // Insufficient history → no trend opinion (still a well-formed verdict).
  if (safeBars.length < cfg.minBars || close == null) {
    return finalize({
      checks: { maStack: false, priceAboveStack: false, ma200Rising: false, off52wLow: false, near52wHigh: false, rsPositive: false },
      down: emptyDown(), rs, vcpActive, trendScore: 0, verdict: 'neutral', velocityGuardFired, cfg,
      provenance: prov(safeBars.length, benchLabel, resolvedAsOf, velocityGuardFired, 'insufficient_bars'),
    });
  }

  // ── Moving averages (reused from shared/indicators) ──
  const ma50 = sma(closes, cfg.smaFast);
  const ma150 = sma(closes, cfg.smaMid);
  const ma200 = sma(closes, cfg.smaSlow);
  const ma200Prev = sma(closes.slice(0, -cfg.ma200RisingLookback), cfg.smaSlow);

  // ── 52-week structure ──
  const lo52 = trailingMin(closes, cfg.lookback52w);
  const hi52 = trailingMax(closes, cfg.lookback52w);

  // ── Up-template checks (the spec's six gating booleans) ──
  const checks = {
    maStack: ma50 > ma150 && ma150 > ma200,
    priceAboveStack: close > ma50 && close > ma200,
    ma200Rising: ma200 > ma200Prev,
    off52wLow: close >= lo52 * (1 + cfg.off52wLowPct),
    near52wHigh: close >= hi52 * (1 - cfg.near52wHighPct),
    rsPositive: rs.positive,
  };

  // ── Down-template (inverse) — four core members for the `conflicted` verdict ──
  const down = {
    maStackDown: ma50 < ma150 && ma150 < ma200,
    priceBelow200: close < ma200,
    rsNegative: rs.negative,
    ma200Falling: ma200 < ma200Prev,
    near52wLow: close <= lo52 * (1 + cfg.off52wLowPct), // informational
  };

  // ── Weighted trend score (0-100) — six gating checks, VCP excluded (A3) ──
  const W = cfg.weights;
  let trendScore = 0;
  if (checks.maStack) trendScore += W.maStack;
  if (checks.rsPositive) trendScore += W.rsPositive;
  if (checks.priceAboveStack) trendScore += W.priceAboveStack;
  if (checks.ma200Rising) trendScore += W.ma200Rising;
  if (checks.near52wHigh) trendScore += W.near52wHigh;
  if (checks.off52wLow) trendScore += W.off52wLow;
  trendScore = clamp(Math.round(trendScore), 0, 100);

  // ── Verdict boundaries (A1: asymmetric — endorsement expensive, demotion eager) ──
  // aligned    : ALL FOUR up-core checks hold.
  // conflicted : ANY THREE of four down-core checks — fires before SMA200 rolls over.
  // neutral    : everything else.
  const upCore = checks.maStack && checks.priceAboveStack && checks.ma200Rising && checks.rsPositive;
  const downCoreCount = [down.maStackDown, down.priceBelow200, down.rsNegative, down.ma200Falling].filter(Boolean).length;
  let verdict = 'neutral';
  if (upCore) verdict = 'aligned';
  else if (downCoreCount >= 3) verdict = 'conflicted';

  return finalize({
    checks, down, rs, vcpActive, trendScore, verdict, velocityGuardFired, cfg,
    provenance: prov(safeBars.length, benchLabel, resolvedAsOf, velocityGuardFired, null),
  });
}

function emptyDown() {
  return { maStackDown: false, priceBelow200: false, rsNegative: false, ma200Falling: false, near52wLow: false };
}

function prov(barsUsed, benchmarkSymbol, asOf, velocityGuardFired, note) {
  const p = { source: 'shared/trend v0', barsUsed, benchmarkSymbol, asOf, velocityGuardFired: !!velocityGuardFired };
  if (note) p.note = note;
  return p;
}

/**
 * Attach the config-driven setupQuality adjuster + overlap flag, return the verdict.
 * `adjustedSetupQuality` is a pure closure over (verdict, vcpActive, cfg) — no global state.
 *
 *   conflicted          -> originalSQ * conflictMultiplier
 *   aligned             -> originalSQ + alignBonus
 *   neutral & vcpActive -> originalSQ * vcpNeutralMultiplier
 *   neutral             -> originalSQ
 *   then clamp 0..100   (NOT rounded — multiplicative results can be fractional)
 */
function finalize({ checks, down, rs, vcpActive, trendScore, verdict, velocityGuardFired, cfg, provenance }) {
  const adjustedSetupQuality = (originalSQ) => {
    const sq = Number(originalSQ);
    if (!Number.isFinite(sq)) return originalSQ;
    let adj = sq;
    if (verdict === 'conflicted') adj = sq * cfg.conflictMultiplier;
    else if (verdict === 'aligned') adj = sq + cfg.alignBonus;
    else if (vcpActive) adj = sq * cfg.vcpNeutralMultiplier; // neutral + VCP only
    return clamp(adj, 0, 100);
  };

  // A4: overlap with score.cjs's approach-velocity guard (Phase 2 only measures).
  const overlap = verdict === 'conflicted' && velocityGuardFired === true;

  return {
    trendScore,
    verdict,
    checks,
    down,
    rs,
    vcpActive,
    overlap,
    adjustedSetupQuality,
    provenance,
  };
}

module.exports = { computeTrendTemplate, DEFAULT_CONFIG };
