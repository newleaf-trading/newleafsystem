#!/usr/bin/env node
/**
 * publish-pick.js — The Core Pipeline Script
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Single command to publish one pick: fetch live data, build strategy, create
 * tile, run Claude analysis, generate all outputs.
 *
 * Usage:
 *   node pipeline/publish-pick.js NVDA --strategy "iron condor" --expiry 2026-04-25
 *   node pipeline/publish-pick.js AAPL --strategy "iron butterfly" --expiry 2026-05-02
 *   node pipeline/publish-pick.js SPY --strategy "bull put spread" --expiry 2026-04-25
 *   node pipeline/publish-pick.js NVDA --strategy "iron condor" --expiry 2026-04-25 --dry-run
 *   node pipeline/publish-pick.js NVDA --strategy "iron condor" --expiry 2026-04-25 --pdf
 *
 * What it does (for ONE pick):
 *   1. Fetch LIVE spot price from Alpaca
 *   2. Fetch LIVE option chain from Alpaca for the specified expiry
 *   3. Fetch gamma wall context from R2 (latest.json)
 *   4. Auto-select strikes using strategy-specific logic
 *   5. Build legs, calculate P&L (maxProfit, maxLoss, Greeks, breakevens)
 *   6. Create fresh tile in Firestore tiles/{id}
 *   7. Run Claude CLI analysis → enriched-pick.json + Firestore analyses/{id}
 *   8. Generate PDF report (with --pdf)
 *   9. Append video script segment
 *  10. Add to weeklyPicks/{weekId}
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const admin      = require('firebase-admin');
const fs         = require('fs');
const path       = require('path');
const { randomUUID } = require('crypto');
const { fetchSentiment, computeModifier, buildSentimentContext } = require('./sentiment-fetch.cjs');
const { fetchIndicators, buildIndicatorsContext, validateIndicatorsInResponse } = require('./indicators-fetch.cjs');
const { callLLM, DEFAULT_MODEL } = require('./llm-call.cjs');
const provenance = require('./firestore-helpers.cjs');
const CONFIG = require('./config.cjs');

const PROMPT_SEMVER = 'publish-pick-v3.2';

// ── Config ──────────────────────────────────────────────────────────────────
const ALPACA    = 'https://data.alpaca.markets';
const R2_BASE   = CONFIG.r2.publicBaseUrl;

const keyPath   = path.resolve(CONFIG.firebase.serviceAccountPath);
if (fs.existsSync(keyPath)) {
  admin.initializeApp({ credential: admin.credential.cert(require(keyPath)) });
} else {
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
}
const db = admin.firestore();
db.settings({ databaseId: CONFIG.firebase.databaseId });

// ── CLI Args ────────────────────────────────────────────────────────────────
const args      = process.argv.slice(2);
const SYMBOL    = args.find(a => !a.startsWith('--'))?.toUpperCase();
const DRY_RUN   = args.includes('--dry-run');
const GEN_PDF   = args.includes('--pdf');

function getFlag(name) {
  const idx = args.indexOf('--' + name);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : null;
}

const STRATEGY  = getFlag('strategy');
const EXPIRY    = getFlag('expiry');  // YYYY-MM-DD

if (!SYMBOL || !STRATEGY || !EXPIRY) {
  console.log(`
  Usage: node pipeline/publish-pick.js <SYMBOL> --strategy "<name>" --expiry <YYYY-MM-DD>

  Examples:
    node pipeline/publish-pick.js NVDA --strategy "iron condor" --expiry 2026-04-25
    node pipeline/publish-pick.js AAPL --strategy "iron butterfly" --expiry 2026-05-02
    node pipeline/publish-pick.js SPY --strategy "bull put spread" --expiry 2026-04-25 --pdf
  `);
  process.exit(1);
}

// ── Helpers ──────────────────────────────────────────────────────────────────
const log  = (...a) => console.log(...a);
const sep  = () => log('─'.repeat(65));
const fmtP = n => n != null ? `$${Number(n).toFixed(2)}` : 'N/A';
const sleep = ms => new Promise(r => setTimeout(r, ms));

function getISOWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

// ── Alpaca API ──────────────────────────────────────────────────────────────
const HDRS = {
  'APCA-API-KEY-ID': CONFIG.alpaca.apiKey,
  'APCA-API-SECRET-KEY': CONFIG.alpaca.secretKey,
  'Accept': 'application/json',
};

async function alpacaGet(url) {
  for (let i = 0; i <= 2; i++) {
    try {
      const res = await fetch(url, { headers: HDRS, signal: AbortSignal.timeout(15000) });
      if (res.status === 429) { await sleep(1000 * (i + 1)); continue; }
      if (!res.ok) { const t = await res.text().catch(() => ''); throw new Error(`HTTP ${res.status}: ${t.slice(0, 120)}`); }
      return await res.json();
    } catch (err) { if (i === 2) throw err; await sleep(500); }
  }
}

async function getSpotPrice(symbol) {
  const d = await alpacaGet(`${ALPACA}/v2/stocks/${symbol}/snapshot`);
  const t = d.latestTrade || {}, q = d.latestQuote || {}, b = d.dailyBar || {}, p = d.prevDailyBar || {};
  const price = t.p || q.ap || b.c || 0;
  const prevClose = p.c || 0;
  return { price, change: price - prevClose, changePercent: prevClose ? ((price - prevClose) / prevClose) * 100 : 0 };
}

async function getOptionChain(symbol, expiry) {
  // Use gte/lte range to match exact expiry (Alpaca requires this format for some dates)
  const url = `${ALPACA}/v1beta1/options/snapshots/${symbol}?expiration_date_gte=${expiry}&expiration_date_lte=${expiry}&feed=indicative&limit=1000`;
  const d = await alpacaGet(url).catch(() => ({ snapshots: {} }));
  const contracts = [];
  for (const [occ, snap] of Object.entries(d.snapshots || {})) {
    const m = occ.match(/^([A-Z1-9]+)(\d{6})([CP])(\d{8})$/);
    if (!m) continue;
    const g = snap.greeks || {}, q = snap.latestQuote || {}, db = snap.dailyBar || {};
    const bid = q.bp ?? 0, ask = q.ap ?? 0;
    contracts.push({
      occ, type: m[3] === 'C' ? 'call' : 'put',
      strike: parseInt(m[4], 10) / 1000,
      delta: g.delta ?? null, gamma: g.gamma ?? null,
      theta: g.theta ?? null, vega: g.vega ?? null,
      iv: g.midIV ?? snap.impliedVolatility ?? null,
      bid, ask, mid: bid && ask ? (bid + ask) / 2 : bid || ask,
      volume: db.v ?? 0, openInterest: 0,
    });
  }
  return contracts;
}

// ── Gamma context from R2 ──────────────────────────────────────────────────
async function getGammaContext(symbol) {
  try {
    const res = await fetch(`${R2_BASE}/reports/${symbol}/latest.json`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const report = await res.json();
    return report.gammaData?.analysis || null;
  } catch { return null; }
}

// ── Strategy builders ────────────────────────────────────────────────────────
function findClosest(contracts, target) {
  if (!contracts.length) return null;
  return contracts.reduce((best, c) => Math.abs(c.strike - target) < Math.abs(best.strike - target) ? c : best);
}

function erf(x) {
  const sign = x >= 0 ? 1 : -1; x = Math.abs(x);
  const t = 1.0 / (1.0 + 0.3275911 * x);
  const y = 1.0 - (((((1.061405429 * t + -1.453152027) * t) + 1.421413741) * t + -0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
  return sign * y;
}

function calcPoP(lower, upper, spot, iv, dte) {
  if (!iv || !dte) return 0.5;
  const sigma = spot * iv * Math.sqrt(dte / 365);
  const zL = (lower - spot) / sigma, zU = (upper - spot) / sigma;
  return 0.5 * (1 + erf(zU / Math.sqrt(2))) - 0.5 * (1 + erf(zL / Math.sqrt(2)));
}

function buildIronCondor(spot, calls, puts, expiry) {
  const dte = Math.round((new Date(expiry) - new Date()) / 86400000);
  const wing = Math.max(5, Math.round(spot * 0.05));

  const shortPut  = findClosest(puts, spot * 0.90);
  const shortCall = findClosest(calls, spot * 1.10);
  const longPut   = findClosest(puts, shortPut.strike - wing);
  const longCall  = findClosest(calls, shortCall.strike + wing);

  if (!shortPut || !shortCall || !longPut || !longCall) throw new Error('Could not find all 4 legs');
  if (longPut.strike >= shortPut.strike || longCall.strike <= shortCall.strike) throw new Error('Invalid strike structure');

  const credit = (shortPut.mid - longPut.mid) + (shortCall.mid - longCall.mid);
  if (credit <= 0) throw new Error(`Negative credit: ${credit.toFixed(2)}`);

  const maxProfit = credit * 100;
  const maxLoss = (Math.max(shortPut.strike - longPut.strike, longCall.strike - shortCall.strike) - credit) * 100;
  const lowerBE = shortPut.strike - credit, upperBE = shortCall.strike + credit;
  const iv = shortPut.iv || shortCall.iv || 0.3;
  const pop = calcPoP(lowerBE, upperBE, spot, iv, dte);

  return {
    strategy: 'Iron Condor', direction: 'neutral', expiry, dte,
    legs: [
      { action: 'BUY',  type: 'PUT',  strike: longPut.strike,   premium: longPut.mid,   delta: longPut.delta,   theta: longPut.theta,   vega: longPut.vega,   iv: longPut.iv },
      { action: 'SELL', type: 'PUT',  strike: shortPut.strike,  premium: shortPut.mid,  delta: shortPut.delta,  theta: shortPut.theta,  vega: shortPut.vega,  iv: shortPut.iv },
      { action: 'SELL', type: 'CALL', strike: shortCall.strike, premium: shortCall.mid, delta: shortCall.delta, theta: shortCall.theta, vega: shortCall.vega, iv: shortCall.iv },
      { action: 'BUY',  type: 'CALL', strike: longCall.strike,  premium: longCall.mid,  delta: longCall.delta,  theta: longCall.theta,  vega: longCall.vega,  iv: longCall.iv },
    ],
    netCredit: credit, maxProfit, maxLoss,
    rewardRisk: maxProfit / maxLoss,
    oddsOfProfit: Math.round(pop * 100),
    breakevens: { lower: lowerBE, upper: upperBE },
    greeks: {
      netDelta: (shortPut.delta||0) + (shortCall.delta||0) - (longPut.delta||0) - (longCall.delta||0),
      netTheta: ((shortPut.theta||0) + (shortCall.theta||0) - (longPut.theta||0) - (longCall.theta||0)),
      netVega:  ((shortPut.vega||0) + (shortCall.vega||0) - (longPut.vega||0) - (longCall.vega||0)),
      netGamma: ((shortPut.gamma||0) + (shortCall.gamma||0) - (longPut.gamma||0) - (longCall.gamma||0)),
    },
  };
}

function buildIronButterfly(spot, calls, puts, expiry) {
  const dte = Math.round((new Date(expiry) - new Date()) / 86400000);
  const wing = Math.max(5, Math.round(spot * 0.05));

  const shortPut  = findClosest(puts, spot);
  const shortCall = findClosest(calls, spot);
  const longPut   = findClosest(puts, spot - wing);
  const longCall  = findClosest(calls, spot + wing);

  if (!shortPut || !shortCall || !longPut || !longCall) throw new Error('Could not find all 4 legs');

  const credit = (shortPut.mid - longPut.mid) + (shortCall.mid - longCall.mid);
  if (credit <= 0) throw new Error(`Negative credit: ${credit.toFixed(2)}`);

  const maxProfit = credit * 100;
  const maxLoss = (wing - credit) * 100;
  const lowerBE = shortPut.strike - credit, upperBE = shortCall.strike + credit;
  const iv = shortPut.iv || shortCall.iv || 0.3;
  const pop = calcPoP(lowerBE, upperBE, spot, iv, dte);

  return {
    strategy: 'Iron Butterfly', direction: 'neutral', expiry, dte,
    legs: [
      { action: 'BUY',  type: 'PUT',  strike: longPut.strike,   premium: longPut.mid,   delta: longPut.delta,   theta: longPut.theta,   vega: longPut.vega,   iv: longPut.iv },
      { action: 'SELL', type: 'PUT',  strike: shortPut.strike,  premium: shortPut.mid,  delta: shortPut.delta,  theta: shortPut.theta,  vega: shortPut.vega,  iv: shortPut.iv },
      { action: 'SELL', type: 'CALL', strike: shortCall.strike, premium: shortCall.mid, delta: shortCall.delta, theta: shortCall.theta, vega: shortCall.vega, iv: shortCall.iv },
      { action: 'BUY',  type: 'CALL', strike: longCall.strike,  premium: longCall.mid,  delta: longCall.delta,  theta: longCall.theta,  vega: longCall.vega,  iv: longCall.iv },
    ],
    netCredit: credit, maxProfit, maxLoss,
    rewardRisk: maxProfit / maxLoss,
    oddsOfProfit: Math.round(pop * 100),
    breakevens: { lower: lowerBE, upper: upperBE },
    greeks: {
      netDelta: (shortPut.delta||0) + (shortCall.delta||0) - (longPut.delta||0) - (longCall.delta||0),
      netTheta: ((shortPut.theta||0) + (shortCall.theta||0) - (longPut.theta||0) - (longCall.theta||0)),
      netVega:  ((shortPut.vega||0) + (shortCall.vega||0) - (longPut.vega||0) - (longCall.vega||0)),
      netGamma: ((shortPut.gamma||0) + (shortCall.gamma||0) - (longPut.gamma||0) - (longCall.gamma||0)),
    },
  };
}

function buildBullPutSpread(spot, puts, expiry) {
  const dte = Math.round((new Date(expiry) - new Date()) / 86400000);
  const wing = Math.max(5, Math.round(spot * 0.05));

  const shortPut = findClosest(puts, spot * 0.95);
  const longPut  = findClosest(puts, shortPut.strike - wing);

  if (!shortPut || !longPut) throw new Error('Could not find spread legs');
  if (longPut.strike >= shortPut.strike) throw new Error('Invalid strike structure');

  const credit = shortPut.mid - longPut.mid;
  if (credit <= 0) throw new Error(`Negative credit: ${credit.toFixed(2)}`);

  const width = shortPut.strike - longPut.strike;
  const maxProfit = credit * 100;
  const maxLoss = (width - credit) * 100;
  const breakeven = shortPut.strike - credit;
  const iv = shortPut.iv || 0.3;
  const pop = 0.5 * (1 + erf((spot - breakeven) / (spot * iv * Math.sqrt(dte / 365)) / Math.sqrt(2)));

  return {
    strategy: 'Bull Put Spread', direction: 'bullish', expiry, dte,
    legs: [
      { action: 'BUY',  type: 'PUT', strike: longPut.strike,  premium: longPut.mid,  delta: longPut.delta,  theta: longPut.theta,  vega: longPut.vega,  iv: longPut.iv },
      { action: 'SELL', type: 'PUT', strike: shortPut.strike, premium: shortPut.mid, delta: shortPut.delta, theta: shortPut.theta, vega: shortPut.vega, iv: shortPut.iv },
    ],
    netCredit: credit, maxProfit, maxLoss,
    rewardRisk: maxProfit / maxLoss,
    oddsOfProfit: Math.round(pop * 100),
    breakevens: { lower: breakeven, upper: null },
    greeks: {
      netDelta: (shortPut.delta||0) - (longPut.delta||0),
      netTheta: (shortPut.theta||0) - (longPut.theta||0),
      netVega:  (shortPut.vega||0) - (longPut.vega||0),
      netGamma: (shortPut.gamma||0) - (longPut.gamma||0),
    },
  };
}

function buildBearCallSpread(spot, calls, expiry) {
  const dte = Math.round((new Date(expiry) - new Date()) / 86400000);
  const wing = Math.max(5, Math.round(spot * 0.05));

  const shortCall = findClosest(calls, spot * 1.05);
  const longCall  = findClosest(calls, shortCall.strike + wing);

  if (!shortCall || !longCall) throw new Error('Could not find spread legs');
  if (longCall.strike <= shortCall.strike) throw new Error('Invalid strike structure');

  const credit = shortCall.mid - longCall.mid;
  if (credit <= 0) throw new Error(`Negative credit: ${credit.toFixed(2)}`);

  const width = longCall.strike - shortCall.strike;
  const maxProfit = credit * 100;
  const maxLoss = (width - credit) * 100;
  const breakeven = shortCall.strike + credit;
  const iv = shortCall.iv || 0.3;
  const pop = 0.5 * (1 + erf((breakeven - spot) / (spot * iv * Math.sqrt(dte / 365)) / Math.sqrt(2)));

  return {
    strategy: 'Bear Call Spread', direction: 'bearish', expiry, dte,
    legs: [
      { action: 'SELL', type: 'CALL', strike: shortCall.strike, premium: shortCall.mid, delta: shortCall.delta, theta: shortCall.theta, vega: shortCall.vega, iv: shortCall.iv },
      { action: 'BUY',  type: 'CALL', strike: longCall.strike,  premium: longCall.mid,  delta: longCall.delta,  theta: longCall.theta,  vega: longCall.vega,  iv: longCall.iv },
    ],
    netCredit: credit, maxProfit, maxLoss,
    rewardRisk: maxProfit / maxLoss,
    oddsOfProfit: Math.round(pop * 100),
    breakevens: { lower: null, upper: breakeven },
    greeks: {
      netDelta: (shortCall.delta||0) - (longCall.delta||0),
      netTheta: (shortCall.theta||0) - (longCall.theta||0),
      netVega:  (shortCall.vega||0) - (longCall.vega||0),
      netGamma: (shortCall.gamma||0) - (longCall.gamma||0),
    },
  };
}

// Strategy router
function buildStrategy(strategyName, spot, calls, puts, expiry) {
  const name = strategyName.toLowerCase().replace(/[^a-z ]/g, '').trim();
  if (name.includes('iron condor'))      return buildIronCondor(spot, calls, puts, expiry);
  if (name.includes('iron butterfly'))   return buildIronButterfly(spot, calls, puts, expiry);
  if (name.includes('bull put'))         return buildBullPutSpread(spot, puts, expiry);
  if (name.includes('bear call'))        return buildBearCallSpread(spot, calls, expiry);
  // Default: iron condor
  log(`  ⚠ Unknown strategy "${strategyName}", defaulting to Iron Condor`);
  return buildIronCondor(spot, calls, puts, expiry);
}

// ── Claude CLI ──────────────────────────────────────────────────────────────
// Reuses the prompt + call logic from analyse-tiles.cjs
function buildClaudePrompt(tile, indicators) {
  const legs = (tile.legs || []).map(l =>
    `  ${l.action} ${l.type} $${l.strike} @ mid=${fmtP(l.premium)} | delta=${l.delta ?? 'N/A'} theta=${l.theta ?? 'N/A'} vega=${l.vega ?? 'N/A'}`
  ).join('\n');

  const gammaCtx = tile.gammaData ? `
GAMMA WALL CONTEXT:
  Put Wall:       ${fmtP(tile.gammaData.put_wall)}
  Call Wall:      ${fmtP(tile.gammaData.call_wall)}
  Gamma Flip:     ${fmtP(tile.gammaData.gamma_flip)}
  Confidence:     ${tile.gammaData.confidence_score ? (tile.gammaData.confidence_score * 100).toFixed(0) + '%' : 'N/A'}` : '';

  const indicatorsCtx = buildIndicatorsContext(indicators);

  return `You are a professional options analyst for NewLeaf Trading.
Generate a complete deep analysis JSON document for the tile below.

TILE DATA:
  Symbol:      ${tile.symbol}
  Strategy:    ${tile.strategy}
  Direction:   ${tile.direction}
  Spot Price:  ${fmtP(tile.spotPrice)}
  Expiry:      ${tile.expiry}
  DTE:         ${tile.dte} days
  Net Credit:  ${fmtP(tile.netCredit)} per share (${fmtP((tile.netCredit || 0) * 100)}/contract)
  Max Profit:  ${fmtP(tile.maxProfit)}
  Max Loss:    ${fmtP(tile.maxLoss)}
  R:R:         ${tile.rewardRisk?.toFixed(2) ?? 'N/A'}x
  PoP:         ${tile.oddsOfProfit ?? 'N/A'}%

LEGS:
${legs}
${gammaCtx}

NET GREEKS:
  Delta: ${tile.greeks?.netDelta ?? 'N/A'}  Theta: ${tile.greeks?.netTheta ?? 'N/A'}
  Vega:  ${tile.greeks?.netVega ?? 'N/A'}   Gamma: ${tile.greeks?.netGamma ?? 'N/A'}
${indicatorsCtx}

OUTPUT INSTRUCTIONS:
Return ONLY a valid JSON object (no markdown, no backticks).
The JSON must have these exact top-level keys:
{
  "strategyRationale": { "whyThisStrategy": "...", "whyTheseStrikes": "...", "whyThisExpiry": "...", "alternativesConsidered": [{"strategy":"...","reason":"..."}] },
  "technicalIndicators": { "rsi": {"value":<EXACT rsi14 from GROUND TRUTH>,"signal":"...","description":"..."}, "bollingerBands": {"upper":<EXACT upper from GROUND TRUTH>,"middle":<EXACT middle from GROUND TRUTH>,"lower":<EXACT lower from GROUND TRUTH>,"width":<EXACT width from GROUND TRUTH>,"signal":"...","description":"..."}, "macd": {"macdLine":<EXACT line from GROUND TRUTH>,"signalLine":<EXACT signal from GROUND TRUTH>,"histogram":<EXACT histogram from GROUND TRUTH>,"signal":"...","description":"..."}, "movingAverages": {"sma20":<EXACT SMA20 from GROUND TRUTH>,"sma50":<EXACT SMA50 from GROUND TRUTH>,"sma100":<EXACT SMA100 from GROUND TRUTH>,"signal":"...","description":""}, "impliedVolatility": {"currentIV":0,"ivRank":0,"ivPercentile":0,"historicalVol30":0,"description":"..."}, "supportResistance": {"support":[{"level":0,"strength":"...","description":"..."}],"resistance":[{"level":0,"strength":"...","description":"..."}]} },
  "thetaDecaySchedule": { "description": "...", "dailyDecay": [{"daysToExpiry":0,"dailyTheta":0,"cumulativeTheta":0}], "earlyCloseRecommendation": "..." },
  "riskAnalysis": { "maxPainScenario": "...", "earningsRisk": "...", "dividendRisk": "...", "eventRisk": "...", "managementPlan": "..." }
}
For rsi, bollingerBands, macd, and movingAverages: use the EXACT numeric values from GROUND TRUTH TECHNICAL INDICATORS above. Write your own signal and description text interpreting those values.
impliedVolatility and supportResistance: generate your best estimates (these are not yet computed server-side — TODO).
Be specific to ${tile.symbol} and ${tile.strategy}. Use actual spot price ${fmtP(tile.spotPrice)}, strikes, and metrics. Return ONLY JSON.`;
}

async function callAnalysisLLM(prompt) {
  return callLLM(prompt, {
    system: 'You are a professional options analyst for NewLeaf Trading. Return ONLY valid JSON.',
    model: DEFAULT_MODEL,
    maxTokens: 4000,
  });
}

function extractJSON(raw) {
  let cleaned = raw.replace(/^```json\s*/m, '').replace(/^```\s*/m, '').replace(/```\s*$/m, '').trim();
  const start = cleaned.indexOf('{'), end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1) throw new Error('No JSON in Claude output');
  return JSON.parse(cleaned.slice(start, end + 1));
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  provenance.initProvenance();
  const weekId = getISOWeek();
  log('');
  log('  ═══════════════════════════════════════════════════════════');
  log('  🍃 NewLeaf — Publish Pick');
  log('  ═══════════════════════════════════════════════════════════');
  log(`  Symbol:    ${SYMBOL}`);
  log(`  Strategy:  ${STRATEGY}`);
  log(`  Expiry:    ${EXPIRY}`);
  log(`  Week:      ${weekId}`);
  log(`  Mode:      ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  log('');

  // ── Step 1: Fetch live spot price ──────────────────────────────────────
  log('  📡 Fetching live spot price from Alpaca...');
  const snapshot = await getSpotPrice(SYMBOL);
  log(`     ${SYMBOL} = ${fmtP(snapshot.price)} (${snapshot.changePercent >= 0 ? '+' : ''}${snapshot.changePercent.toFixed(2)}%)`);

  // ── Step 2: Fetch live option chain ───────────────────────────────────
  log(`  📡 Fetching option chain for ${EXPIRY}...`);
  const chain = await getOptionChain(SYMBOL, EXPIRY);
  const calls = chain.filter(c => c.type === 'call').sort((a, b) => a.strike - b.strike);
  const puts  = chain.filter(c => c.type === 'put').sort((a, b) => a.strike - b.strike);
  log(`     ${calls.length} calls, ${puts.length} puts loaded`);

  if (calls.length < 3 || puts.length < 3) {
    log('  ❌ Not enough contracts for this expiry. Try a different date.');
    process.exit(1);
  }

  // ── Step 3: Fetch gamma walls from R2 ──────────────────────────────────
  log('  📡 Fetching gamma walls from R2...');
  const gammaData = await getGammaContext(SYMBOL);
  if (gammaData) {
    log(`     Put wall: ${fmtP(gammaData.put_wall)}  Call wall: ${fmtP(gammaData.call_wall)}`);
  } else {
    log('     ⚠ No gamma data available (will proceed without)');
  }

  // ── Step 4: Build strategy ─────────────────────────────────────────────
  log(`  🔧 Building ${STRATEGY} strategy...`);
  const result = buildStrategy(STRATEGY, snapshot.price, calls, puts, EXPIRY);
  log(`     Legs: ${result.legs.map(l => `${l.action} ${l.type} $${l.strike}`).join(' | ')}`);
  log(`     Credit: ${fmtP(result.netCredit)}/share  Max Profit: ${fmtP(result.maxProfit)}  Max Loss: ${fmtP(result.maxLoss)}`);
  log(`     R:R: ${result.rewardRisk.toFixed(2)}x  PoP: ${result.oddsOfProfit}%`);

  // ── Step 5: Build tile ─────────────────────────────────────────────────
  const tileId = randomUUID().replace(/-/g, '').slice(0, 20);
  const tile = {
    id: tileId,
    symbol: SYMBOL,
    strategy: result.strategy,
    direction: result.direction,
    publishedSpotPrice: snapshot.price,
    underlyingPrice: snapshot.price,
    currentPrice: snapshot.price,
    price: snapshot.price,
    priceChange: snapshot.change,
    expiry: result.expiry,
    dte: result.dte,
    legs: result.legs,
    greeks: result.greeks,
    gammaData: gammaData || {},
    maxProfit: result.maxProfit,
    maxLoss: result.maxLoss,
    netCredit: result.netCredit,
    rewardRisk: result.rewardRisk,
    oddsOfProfit: result.oddsOfProfit,
    breakevens: result.breakevens,
    source: 'publish-pick',
    isActive: true,
    sortOrder: Date.now(),
    confidence: result.oddsOfProfit || 50,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (DRY_RUN) {
    log('');
    log('  📋 DRY RUN — tile preview:');
    log(JSON.stringify(tile, null, 2).split('\n').map(l => '     ' + l).join('\n'));
    log('');
    log('  DRY RUN complete. Remove --dry-run to publish.');
    process.exit(0);
  }

  // ── Step 6: Fetch sentiment ─────────────────────────────────────────────
  log('  🧠 Fetching sentiment via Claude web search...');
  const sentiment = await fetchSentiment(SYMBOL);
  const sentMod = sentiment ? computeModifier(sentiment, tile.direction || 'neutral') : { action: 'none', points: 0, flags: [] };
  if (sentiment) {
    tile.sentiment = {
      score: sentiment.score,
      label: sentiment.label,
      summary: sentiment.summary,
      keyDrivers: sentiment.keyDrivers,
      modifier: sentMod.points,
      flags: sentMod.flags,
      updatedAt: sentiment.updatedAt,
    };
    log(`     Sentiment: ${sentiment.label} ${sentiment.score} (modifier: ${sentMod.points > 0 ? '+' : ''}${sentMod.points})`);
  } else {
    log('     Sentiment: unavailable (proceeding without)');
  }

  // ── Step 7: Write tile to Firestore ─────────────────────────────────────
  log('  📝 Writing tile to Firestore...');
  const tileProvenanceOpts = { modelUsed: 'n/a', promptVersion: 'n/a', analysisSource: 'publish-pick' };
  await provenance.writeTileWithProvenance(db, tileId, tile, tileProvenanceOpts);
  log(`     tiles/${tileId} ✅`);

  // ── Step 8: Fetch computed indicators ────────────────────────────────────
  log('  📊 Fetching computed indicators from API...');
  const indicators = await fetchIndicators(SYMBOL);
  log(`     RSI=${indicators.rsi14} MACD=${indicators.macdLine.toFixed(3)} SMA20=${indicators.sma20}`);

  // ── Step 9: LLM analysis ─────────────────────────────────────────────
  log(`  🤖 Running LLM analysis (${DEFAULT_MODEL}, 30-60s)...`);
  const enrichedTile = { ...tile, spotPrice: snapshot.price };
  const sentimentCtx = buildSentimentContext(sentiment);
  const prompt = buildClaudePrompt(enrichedTile, indicators) + (sentimentCtx ? '\n' + sentimentCtx : '');
  const raw = await callAnalysisLLM(prompt);
  const analysis = extractJSON(raw);

  // Validate required sections
  for (const key of ['strategyRationale', 'technicalIndicators', 'thetaDecaySchedule', 'riskAnalysis']) {
    if (!analysis[key]) throw new Error(`Claude missing: ${key}`);
  }

  // Validate LLM echoed back ground-truth indicator values
  validateIndicatorsInResponse(analysis, indicators);
  log('     Analysis validated ✅');

  // Push to Firestore analyses/ with provenance
  const analysisOpts = {
    modelUsed: DEFAULT_MODEL,
    promptVersion: provenance.computePromptVersion(PROMPT_SEMVER, prompt),
    analysisSource: 'publish-pick',
  };
  await provenance.writeAnalysisWithProvenance(db, tileId, {
    ...analysis,
    _sentiment: sentiment || null,
    _generatedAt: admin.firestore.FieldValue.serverTimestamp(),
    _tileId: tileId, _symbol: SYMBOL, _strategy: result.strategy,
  }, analysisOpts);
  log(`     analyses/${tileId} ✅`);

  // ── Step 8: Save enriched-pick.json ────────────────────────────────────
  const weekDir = path.join(__dirname, 'output', weekId);
  const enrichedDir = path.join(weekDir, 'enriched');
  fs.mkdirSync(enrichedDir, { recursive: true });

  const slug = `${SYMBOL}-${result.strategy.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const enrichedPick = {
    tileId, symbol: SYMBOL, companyName: SYMBOL,
    strategy: result.strategy, direction: result.direction,
    spotPrice: snapshot.price, expiry: result.expiry, dte: result.dte,
    legs: result.legs, greeks: result.greeks, gammaData: gammaData || {},
    maxProfit: result.maxProfit, maxLoss: result.maxLoss,
    netCredit: result.netCredit, rewardRisk: result.rewardRisk,
    oddsOfProfit: result.oddsOfProfit,
    thesis: analysis.strategyRationale?.whyThisStrategy || '',
    keyLevels: {
      putWall: gammaData?.put_wall, callWall: gammaData?.call_wall,
      support: (analysis.technicalIndicators?.supportResistance?.support || []).map(s => s.level),
      resistance: (analysis.technicalIndicators?.supportResistance?.resistance || []).map(r => r.level),
    },
    ivContext: {
      currentIV: analysis.technicalIndicators?.impliedVolatility?.currentIV,
      ivRank: analysis.technicalIndicators?.impliedVolatility?.ivRank,
      signal: analysis.technicalIndicators?.impliedVolatility?.description,
    },
    riskSummary: analysis.riskAnalysis?.maxPainScenario || '',
    exitPlan: {
      profitTarget: analysis.thetaDecaySchedule?.earlyCloseRecommendation || '',
      managementPlan: analysis.riskAnalysis?.managementPlan || '',
    },
    sentiment: sentiment || null,
    analysis,
    weekId, generatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(path.join(enrichedDir, `${slug}.json`), JSON.stringify(enrichedPick, null, 2));
  log(`     enriched/${slug}.json ✅`);

  // ── Step 9: Add to weeklyPicks ─────────────────────────────────────────
  log('  📋 Adding to weeklyPicks...');
  const weekRef = db.collection('weeklyPicks').doc(weekId);
  const weekDoc = await weekRef.get();

  const pickSummary = {
    tileId, symbol: SYMBOL, strategy: result.strategy,
    direction: result.direction, price: snapshot.price,
    maxProfit: result.maxProfit, maxLoss: result.maxLoss,
    rewardRisk: result.rewardRisk, oddsOfProfit: result.oddsOfProfit,
    expiry: result.expiry, dte: result.dte,
    thesis: enrichedPick.thesis,
    ivContext: enrichedPick.ivContext,
  };

  const weekOpts = { modelUsed: 'n/a', promptVersion: 'n/a', analysisSource: 'publish-pick' };

  if (weekDoc.exists) {
    // Append to existing week
    await provenance.writeWeeklyPicksWithProvenance(db, weekId, {
      tileIds: admin.firestore.FieldValue.arrayUnion(tileId),
      picks: admin.firestore.FieldValue.arrayUnion(pickSummary),
      tileCount: admin.firestore.FieldValue.increment(1),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    }, weekOpts, 'update');
    log(`     Appended to weeklyPicks/${weekId} ✅`);
  } else {
    // Create new week
    const now = new Date();
    const monday = new Date(now); monday.setDate(now.getDate() - (now.getDay() || 7) + 1);
    const friday = new Date(monday); friday.setDate(monday.getDate() + 4);
    const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    await provenance.writeWeeklyPicksWithProvenance(db, weekId, {
      weekId, status: 'current',
      dateRange: `${fmt(monday)} — ${fmt(friday)}`,
      publishedAt: admin.firestore.FieldValue.serverTimestamp(),
      theme: 'Options strategies selected by NewLeaf scoring engine',
      tileIds: [tileId], tileCount: 1, picks: [pickSummary],
    }, weekOpts, 'set');
    log(`     Created weeklyPicks/${weekId} ✅`);
  }

  // ── Step 10: Generate PDF (optional) ────────────────────────────────────
  if (GEN_PDF) {
    log('  📄 Generating PDF...');
    try {
      const { execSync } = require('child_process');
      const dataFile = path.join(enrichedDir, `${slug}.json`);
      const pdfDir = path.join(weekDir, 'pdf');
      fs.mkdirSync(pdfDir, { recursive: true });
      const pdfFile = path.join(pdfDir, `${slug}.pdf`);

      // Build report data from enriched pick
      execSync(`python3 ${path.join(__dirname, 'build-enriched-report-data.py')} "${dataFile}" /tmp/nl-report-data.json`, { stdio: 'pipe' });
      execSync(`python3 ${path.join(__dirname, 'generate-report.py')} /tmp/nl-report-data.json "${pdfFile}"`, { cwd: __dirname, stdio: 'pipe', timeout: 30000 });
      log(`     ${slug}.pdf ✅`);
    } catch (err) {
      log(`     ⚠ PDF generation failed: ${err.message}`);
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────
  log('');
  sep();
  log(`  ✅ PICK PUBLISHED: ${SYMBOL} ${result.strategy}`);
  sep();
  log(`  Tile:      tiles/${tileId}`);
  log(`  Analysis:  analyses/${tileId}`);
  log(`  Week:      weeklyPicks/${weekId}`);
  log(`  Enriched:  pipeline/output/${weekId}/enriched/${slug}.json`);
  log(`  Spot:      ${fmtP(snapshot.price)}  Credit: ${fmtP(result.netCredit)}  R:R: ${result.rewardRisk.toFixed(2)}x`);
  log(`  Max Profit: ${fmtP(result.maxProfit)}  Max Loss: ${fmtP(result.maxLoss)}  PoP: ${result.oddsOfProfit}%`);
  log('');
  log(`  The pick is now live in the React app at /trading/position/${tileId}`);
  log(`  and visible on /picks/ for the current week.`);

  // ── Step 11: Write publication tracking record ─────────────────────────
  log('  📋 Writing publication record...');
  const pubRecord = {
    tileId,
    symbol: SYMBOL,
    strategy: result.strategy,
    weekId,
    spotPrice: snapshot.price,
    maxProfit: result.maxProfit,
    maxLoss: result.maxLoss,
    rewardRisk: result.rewardRisk,
    oddsOfProfit: result.oddsOfProfit,
    netCredit: result.netCredit,
    expiry: result.expiry,
    dte: result.dte,
    thesis: analysis.strategyRationale?.whyThisStrategy || '',
    channels: {
      picks:     { status: 'complete', url: `https://newleafsystem.com/picks/analysis/${SYMBOL.toLowerCase()}`, updatedAt: new Date().toISOString() },
      invest:    { status: 'complete', url: `https://newleafsystem.com/invest/position/${tileId}`, updatedAt: new Date().toISOString() },
      pdf:       { status: 'tbd', url: null, updatedAt: null },
      youtube:   { status: 'tbd', url: null, updatedAt: null },
      linkedin:  { status: 'tbd', url: null, updatedAt: null },
      twitter:   { status: 'tbd', url: null, updatedAt: null },
      instagram: { status: 'tbd', url: null, updatedAt: null },
      email:     { status: 'tbd', url: null, updatedAt: null },
    },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  await db.collection('publications').doc(tileId).set(pubRecord);
  log(`     publications/${tileId} ✅`);
  sep();
  log('');
}

main().catch(err => {
  console.error(`\n  ❌ Fatal error: ${err.message}\n`);
  if (process.env.VERBOSE) console.error(err.stack);
  process.exit(1);
});
