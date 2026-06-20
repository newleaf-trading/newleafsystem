#!/usr/bin/env node
/**
 * newleaf trend <SYMBOL> — read-only SEPA trend-template analysis (Phase 2).
 *
 * The CLI sibling of Discover Pro: it FETCHES (the I/O boundary lives here, never
 * in the pure module), COMPUTES the deterministic trend verdict via
 * shared/trend/trend-template.cjs, and PRINTS. It writes nothing — no Firestore,
 * no selector, no generaterecommendations side effects.
 *
 * Usage:
 *   node trend.cjs NFLX
 *   node trend.cjs TLT --benchmark SPY --sq 72
 *   node trend.cjs SPGI --json
 *   node trend.cjs NFLX --narrate
 *
 * Data: Alpaca daily bars (split-adjusted OHLCV), ~540d sliced locally. Alpaca is
 *       universe-wide (key auth, no per-symbol 402s like FMP) and shares one price
 *       basis with the pipeline reports + the labeller's outcome bars.
 *
 * Setup quality: the REAL reaction-engine setupQuality needs IV/OI/zone touches
 *       an EOD feed cannot supply — that wiring is Phase 4 (selector integration).
 *       Phase 2 computes the approach-velocity guard for real (so `overlap` is
 *       genuine) and takes the *original* SQ via --sq to show the adjustment.
 */
'use strict';

const path = require('path');
const fs = require('fs');
const { computeTrendTemplate, DEFAULT_CONFIG } = require(path.join(__dirname, '..', 'shared', 'trend', 'trend-template.cjs'));
const { sma } = require(path.join(__dirname, '..', 'shared', 'indicators', 'index.js'));

// ── CLI parsing ──────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
function getFlag(name, def = null) {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
}
const FLAG_VALUES = new Set(['--benchmark', '--sq', '--bars', '--benchmark-bars']);
const SYMBOL = (args.find(a => !a.startsWith('--') && !FLAG_VALUES.has(args[args.indexOf(a) - 1])) || '').toUpperCase();
const BENCHMARK = (getFlag('benchmark', 'SPY')).toUpperCase();
const BARS_FILE = getFlag('bars');               // local JSON OHLC array → bypass Alpaca (Phase 3 / offline)
const BENCH_BARS_FILE = getFlag('benchmark-bars');
const ORIGINAL_SQ = parseFloat(getFlag('sq', '70'));
const JSON_OUT = args.includes('--json');
const NARRATE = args.includes('--narrate');
const SLICE = 320; // > 252 (52w) + 200 + 20 lookback

if (!SYMBOL) {
  console.log('Usage: node trend.cjs <SYMBOL> [--benchmark SPY] [--sq 0-100] [--json] [--narrate]');
  process.exit(1);
}

// ── Alpaca fetch (the I/O boundary) ──────────────────────────────────────────
// Universe-wide (key auth, no per-symbol 402s like FMP), and split-adjusted to match
// pipeline priceHistory + the labeller's outcome bars (one price basis everywhere).
function alpacaCreds() {
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'pipeline', 'config.json'), 'utf8'));
  if (!cfg.alpaca || !cfg.alpaca.apiKey) throw new Error('pipeline/config.json alpaca.apiKey not set');
  return { id: cfg.alpaca.apiKey, secret: cfg.alpaca.secretKey };
}

async function fetchEod(symbol) {
  const { id, secret } = alpacaCreds();
  const end = new Date().toISOString().split('T')[0];
  const startD = new Date(); startD.setDate(startD.getDate() - 540); // ~370 trading bars > SLICE
  const start = startD.toISOString().split('T')[0];
  const url = `https://data.alpaca.markets/v2/stocks/${encodeURIComponent(symbol)}/bars`
    + `?timeframe=1Day&start=${start}&end=${end}&limit=500&adjustment=split`;
  const res = await fetch(url, { headers: { 'APCA-API-KEY-ID': id, 'APCA-API-SECRET-KEY': secret, Accept: 'application/json' }, signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`Alpaca ${res.status} for ${symbol}`);
  const data = await res.json();
  const bars = (data.bars || [])
    .map(b => ({ date: (b.t || '').split('T')[0], open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v }))
    .filter(b => b.close != null && b.date);
  bars.sort((a, b) => (a.date < b.date ? -1 : 1)); // ascending
  return bars.slice(-SLICE);
}

// ── Approach-velocity guard (mirrors shared/reaction/score.cjs:181-187) ──────
// score.cjs caps SQ at 64 when |3-bar net move| > 3×ATR. We reproduce the trip
// condition from bars so the module's `overlap` instrumentation is real.
function atr(bars, period = 14) {
  if (bars.length < period + 1) return null;
  const tr = [];
  for (let i = 1; i < bars.length; i++) {
    const h = bars[i].high, l = bars[i].low, pc = bars[i - 1].close;
    tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  return tr.slice(-period).reduce((a, b) => a + b, 0) / period;
}
function approachMove3bar(bars) {
  if (bars.length < 4) return 0;
  const n = bars.length - 1;
  return bars[n].close / bars[n - 3].close - 1; // 3-bar net move (decimal)
}

// ── Narration (LLM narrates, never decides) ──────────────────────────────────
function templatedSentence(symbol, r) {
  switch (r.verdict) {
    case 'aligned':
      return `${symbol}: the trend backs the short side — the moving-average stack is rising, price is leading, and relative strength is positive. The setup is endorsed.`;
    case 'conflicted':
      return `${symbol}: support is sitting in a downtrend — the stack is inverted and relative strength is negative, so the setup is demoted as a possible falling knife.`;
    default:
      return r.vcpActive
        ? `${symbol}: no directional trend, but a tightening base points to an imminent expansion, so short premium is discounted.`
        : `${symbol}: no trend opinion — the setup is left unchanged.`;
  }
}

function validateNarration(text, r) {
  if (!text || /\d/.test(text)) return false; // forbid any digit
  const t = text.toLowerCase();
  const forbidden = {
    aligned: ['bearish', 'downtrend', 'falling knife', 'demote', 'conflicted', 'avoid', 'weak'],
    conflicted: ['bullish', 'uptrend', 'endorse', 'aligned', 'strong trend', 'leading'],
    neutral: ['bullish', 'bearish', 'uptrend', 'downtrend'],
  }[r.verdict] || [];
  return !forbidden.some(w => t.includes(w));
}

async function narrate(symbol, r) {
  const groundTruth = {
    verdict: r.verdict, checks: r.checks, vcpActive: r.vcpActive, overlap: r.overlap,
    rsPositive: r.checks.rsPositive, rsNegative: r.down.rsNegative,
  };
  const system = 'You narrate a FIXED, pre-computed trend verdict for an options setup. '
    + 'The verdict and checks below are AUTHORITATIVE GROUND TRUTH — do not recompute, dispute, or extend them. '
    + 'Write exactly ONE sentence describing the verdict in plain language. '
    + 'Do NOT output any number, digit, price, percentage, strike, or strategy name. '
    + 'Do NOT name a direction that contradicts the verdict (aligned=supportive, conflicted=hostile/falling-knife, neutral=no opinion).';
  const user = `Ground truth: ${JSON.stringify(groundTruth)}\nSymbol: ${symbol}\nWrite the one-sentence narration.`;

  const baseURL = (process.env.QWEN_PROXY_URL || 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1').replace(/\/$/, '');
  const key = process.env.DASHSCOPE_API_KEY;
  try {
    if (!key && !process.env.QWEN_PROXY_URL) throw new Error('no DASHSCOPE_API_KEY / QWEN_PROXY_URL');
    const res = await fetch(`${baseURL}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${(key || 'mock').trim()}` },
      body: JSON.stringify({
        model: 'qwen-flash', // FAST tier — single low-judgment description, NOT qwen3-max / Fable
        temperature: 0.3,
        max_tokens: 120,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
      signal: AbortSignal.timeout(20000),
    });
    if (!res.ok) throw new Error(`qwen ${res.status}`);
    const j = await res.json();
    const text = (j.choices?.[0]?.message?.content || '').trim();
    if (validateNarration(text, r)) return { text, source: 'qwen-flash' };
    return { text: templatedSentence(symbol, r), source: 'templated-fallback' };
  } catch {
    return { text: templatedSentence(symbol, r), source: 'templated-fallback' };
  }
}

// ── Output ───────────────────────────────────────────────────────────────────
function pf(b) { return b ? 'PASS' : 'fail'; }
function pct(x) { return (x * 100).toFixed(1) + '%'; }

function loadBars(file) {
  const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
  return rows.map(r => ({ date: r.date, open: r.open, high: r.high, low: r.low, close: r.close, volume: r.volume }))
    .filter(b => b.close != null).sort((a, b) => (a.date < b.date ? -1 : 1)).slice(-SLICE);
}

async function main() {
  const [bars, benchBars] = await Promise.all([
    BARS_FILE ? loadBars(BARS_FILE) : fetchEod(SYMBOL),
    BENCH_BARS_FILE ? loadBars(BENCH_BARS_FILE) : fetchEod(BENCHMARK),
  ]);
  if (bars.length < DEFAULT_CONFIG.minBars) {
    console.error(`Only ${bars.length} bars for ${SYMBOL} (need ≥ ${DEFAULT_CONFIG.minBars}).`);
    process.exit(1);
  }

  const closes = bars.map(b => b.close);
  const spot = closes[closes.length - 1];
  const a = atr(bars);
  const atrPct = a != null ? a / spot : null;
  const move3 = approachMove3bar(bars);
  const velocityGuardFired = atrPct != null && Math.abs(move3) > 3 * atrPct;

  const r = computeTrendTemplate({ bars, benchmarkBars: benchBars, benchmarkSymbol: BENCHMARK, velocityGuardFired });

  const ma50 = sma(closes, 50), ma150 = sma(closes, 150), ma200 = sma(closes, 200);
  const lo52 = Math.min(...closes.slice(-252)), hi52 = Math.max(...closes.slice(-252));
  const adjusted = r.adjustedSetupQuality(ORIGINAL_SQ);

  let narration = null;
  if (NARRATE) narration = await narrate(SYMBOL, r);

  if (JSON_OUT) {
    console.log(JSON.stringify({
      symbol: SYMBOL, asOf: r.provenance.asOf, spot,
      sma: { ma50, ma150, ma200 },
      rs: r.rs,
      pos52w: { aboveLowPct: spot / lo52 - 1, belowHighPct: 1 - spot / hi52, lo52, hi52 },
      checks: r.checks, down: r.down,
      verdict: r.verdict, trendScore: r.trendScore, vcpActive: r.vcpActive,
      velocityGuardFired, overlap: r.overlap,
      setupQuality: { original: ORIGINAL_SQ, adjusted },
      narration,
      provenance: r.provenance,
    }, null, 2));
    return;
  }

  const W = 14;
  const row = (k, v) => console.log(`  ${k.padEnd(W)} ${v}`);
  console.log('');
  console.log(`  ═══ NewLeaf Trend Template — ${SYMBOL} ═══`);
  row('spot', `$${spot.toFixed(2)}`);
  row('SMA 50/150/200', `${ma50.toFixed(2)} / ${ma150.toFixed(2)} / ${ma200.toFixed(2)}`);
  row(`RS vs ${BENCHMARK}`, `${(r.rs.ratio * 100).toFixed(1)}%  (${r.rs.rising ? 'rising' : r.rs.falling ? 'falling' : 'flat'})`);
  row('52w position', `${pct(spot / lo52 - 1)} above low · ${pct(1 - spot / hi52)} below high`);
  console.log('');
  console.log('  Checks:');
  for (const k of ['maStack', 'priceAboveStack', 'ma200Rising', 'off52wLow', 'near52wHigh', 'rsPositive']) {
    console.log(`    ${pf(r.checks[k])}  ${k}`);
  }
  console.log('');
  row('VERDICT', r.verdict.toUpperCase() + `  (trendScore ${r.trendScore})`);
  row('setupQuality', `${ORIGINAL_SQ} → ${adjusted}  (${r.verdict})`);
  row('VCP active', r.vcpActive ? 'yes' : 'no');
  row('velocity guard', velocityGuardFired ? 'FIRED' : 'no');
  row('overlap', r.overlap ? 'YES — trend + velocity both flag (Phase 3 dedupes)' : 'no');
  console.log('');
  if (narration) {
    row('narration', `(${narration.source})`);
    console.log(`    ${narration.text}`);
    console.log('');
  }
  console.log(`  provenance: ${r.provenance.source} · ${r.provenance.barsUsed} bars · benchmark ${r.provenance.benchmarkSymbol} · asOf ${r.provenance.asOf}`);
  console.log('');
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
