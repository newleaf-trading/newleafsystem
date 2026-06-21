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

// ── Gamma context + engine snapshot from R2 ──────────────────────────────────
async function getR2Report(symbol) {
  try {
    const res = await fetch(`${R2_BASE}/reports/${symbol}/latest.json`, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

function getGammaContext(report) {
  return report?.gammaData?.analysis || null;
}

function buildEngineSnapshot(report) {
  if (!report?.scoring || !report?.gammaData) return null;
  const s = report.scoring;
  const a = report.gammaData.analysis;
  const t = report.technicalData;
  return {
    // What the engine decided
    strategy: s.strategy?.code || null,
    direction: s.direction || null,
    score: s.opportunityScore || null,
    pillars: s.pillars || null,

    // Gate values that produced the decision
    gates: {
      condorGate: report.gammaData.condorGate?.condorAllowed || false,
      bwbEligible: s.strategy?.code === 'broken_wing_butterfly',
      directionalBlocked: (t?.trendEngine?.strength === 'weak' &&
        t?.trendEngine?.direction !== 'neutral'),
      calendarEligible: s.strategy?.code === 'calendar_spread',
    },

    // Confidence components
    confidence: {
      blended: a?.confidence_score ?? null,
      oi: a?.oi_confidence ?? null,
      gex: a?.gex_confidence ?? null,
      delta: a?.delta_confidence ?? null,
      volume: a?.volume_confidence ?? null,
    },

    // Trend state
    trend: {
      direction: t?.trendEngine?.direction || null,
      strength: t?.trendEngine?.strength || null,
      adx: t?.adx14 ?? null,
      rsi: t?.rsi ?? null,
      trendScore: t?.trendEngine?.score ?? null,
    },

    // Vol state
    vol: {
      atmIv: report.gammaData.ivData?.atmIv ?? null,
      realizedVol30d: t?.realizedVol30d ?? null,
      ivRvRatio: (report.gammaData.ivData?.atmIv && t?.realizedVol30d)
        ? +(report.gammaData.ivData.atmIv / (t.realizedVol30d * 100)).toFixed(2)
        : null,
      regime: t?.volatilityEngine?.regime || null,
    },

    // Walls
    walls: {
      putWall: a?.put_wall ?? null,
      callWall: a?.call_wall ?? null,
      bandWidth: a?.band_width_pct ?? null,
    },

    // Metadata
    snapshotDate: report.meta?.date || null,
    pipelineVersion: report.meta?.generatedBy || null,
  };
}

// ── Shared pricing + validation (one set of builders for all writers) ────────
const {
  buildStrategy, buildIronCondor, buildIronButterfly,
  buildBullPutSpread, buildBearCallSpread,
  calcPoP, erf, findClosest,
  validateTileForWrite, normalizeBuildResult, SUPPORTED_STRATEGIES,
  applyPublishGate,
} = require('./pricing-engine.cjs');

// NOTE: All builder functions (buildIronCondor, buildIronButterfly, etc.),
// calcPoP, erf, findClosest, and buildStrategy are now imported from
// pricing-engine.cjs — the single source of truth for pricing logic.
// The inline copies have been removed to prevent drift.

// All builder functions, calcPoP, erf, findClosest, buildStrategy, and
// SUPPORTED_STRATEGIES are imported from pricing-engine.cjs above.
// The inline copies have been deleted to prevent drift.

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

  // ── Step 3: Fetch gamma walls + engine snapshot from R2 ──────────────────
  log('  📡 Fetching report from R2...');
  const r2Report = await getR2Report(SYMBOL);
  const gammaData = getGammaContext(r2Report);
  const engineSnapshot = buildEngineSnapshot(r2Report);
  if (gammaData) {
    log(`     Put wall: ${fmtP(gammaData.put_wall)}  Call wall: ${fmtP(gammaData.call_wall)}`);
  } else {
    log('     ⚠ No gamma data available (will proceed without)');
  }
  if (engineSnapshot) {
    log(`     Engine: ${engineSnapshot.strategy} | ${engineSnapshot.direction} | score ${engineSnapshot.score}`);
    if (engineSnapshot.strategy !== STRATEGY.toLowerCase().replace(/[^a-z_]/g, '_').replace(/ /g, '_')) {
      log(`     ⚠ NOTE: Publishing "${STRATEGY}" but engine recommended "${engineSnapshot.strategy}" — override logged.`);
    }
  } else {
    log('     ⚠ No engine snapshot (R2 report missing or stale)');
  }

  // ── Step 4: Build strategy ─────────────────────────────────────────────
  log(`  🔧 Building ${STRATEGY} strategy...`);
  const result = buildStrategy(STRATEGY, snapshot.price, calls, puts, EXPIRY);
  log(`     Legs: ${result.legs.map(l => `${l.action} ${l.type} $${l.strike}`).join(' | ')}`);
  log(`     Credit: ${fmtP(result.netCredit)}/share  Max Profit: ${fmtP(result.maxProfit)}  Max Loss: ${fmtP(result.maxLoss)}`);
  log(`     R:R: ${result.rewardRisk.toFixed(2)}x  PoP: ${result.oddsOfProfit}%`);

  // ── Step 4b: Validate tile (canonical schema enforcement) ──────────────
  const tileId = randomUUID().replace(/-/g, '').slice(0, 20);

  // PoP: null when not computable, never a fabricated fallback
  const computedPoP = result.oddsOfProfit;
  const oddsOfProfit = (typeof computedPoP === 'number' && computedPoP > 0) ? computedPoP : null;

  // Breakevens: valid [lower, upper] or undefined — never []
  const rawBE = result.breakevens;
  const breakevens = (Array.isArray(rawBE) && rawBE.length === 2) ? rawBE
    : (rawBE?.lower && rawBE?.upper) ? [rawBE.lower, rawBE.upper]
    : undefined;

  const tile = {
    id: tileId,
    symbol: SYMBOL,
    strategy: result.strategy,
    direction: result.direction,

    // Spot
    publishedSpotPrice: snapshot.price,
    underlyingPrice: snapshot.price,

    // Structure
    expiry: result.expiry,
    daysToExpiry: result.dte,
    legs: result.legs,
    greeks: result.greeks,

    // P&L (per-contract $)
    maxProfit: result.maxProfit,
    maxLoss: result.maxLoss,
    netCredit: result.netCredit,
    rewardRisk: result.rewardRisk,
    oddsOfProfit,
    breakevens,

    // Context
    gammaData: gammaData || {},
    // Named confidence fields only — no generic 'confidence'
    verdictConfidence: null,  // publish-pick has no adversarial verdict
    wallConfidence: null,     // set from gamma data if available
    aiInsight: null, // populated by LLM analysis step
    engineSnapshot: engineSnapshot || null,

    // Provenance (nested)
    provenance: {
      source: 'publish-pick',
      generatedAt: new Date().toISOString(),
      model: null,
      commitSha: null,
    },

    // Lifecycle
    source: 'publish-pick',
    isActive: true,
    sortOrder: Date.now(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
  };

  // Validate — refuse non-conforming tiles (mirrors validateTile rules)
  if (!Array.isArray(result.legs) || result.legs.length < 2) {
    log(`  ❌ Legs must have ≥ 2 entries, got ${result.legs?.length ?? 0}. Aborting.`);
    process.exit(1);
  }
  const hasPricing = result.legs.some(l => (l.premium || 0) !== 0);
  if (!hasPricing) {
    log('  ❌ All leg premiums are $0 — option chain returned no prices. Aborting.');
    process.exit(1);
  }
  if (!(tile.maxProfit > 0) || !(tile.maxLoss > 0)) {
    log(`  ❌ Invalid P&L: maxProfit=${tile.maxProfit}, maxLoss=${tile.maxLoss}. Aborting.`);
    process.exit(1);
  }
  if (!tile.expiry) {
    log('  ❌ Missing expiry. Aborting.');
    process.exit(1);
  }
  if (!(tile.underlyingPrice > 0)) {
    log(`  ❌ Missing underlyingPrice. Aborting.`);
    process.exit(1);
  }

  // Publish gate — reject if PoP below floor (publish-pick has no verdict)
  const gate = applyPublishGate(tile);
  if (!gate.pass) {
    log(`  ❌ Publish gate rejected: ${gate.reason}. Aborting.`);
    process.exit(1);
  }
  log(`  ✓ Publish gate: ${gate.tier}`);

  if (DRY_RUN) {
    log('');
    log('  📋 DRY RUN — tile preview:');
    log(JSON.stringify(tile, null, 2).split('\n').map(l => '     ' + l).join('\n'));
    log('');
    log('  DRY RUN complete. Remove --dry-run to publish.');
    process.exit(0);
  }

  // ── Step 6: Fetch sentiment (optional — non-fatal on failure) ───────────
  log('  🧠 Fetching sentiment via Claude web search...');
  let sentiment = null;
  try {
    sentiment = await fetchSentiment(SYMBOL);
  } catch (sentErr) {
    log(`  ⚠ Sentiment fetch failed: ${sentErr.message} — continuing without sentiment`);
  }
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

  // ── Step 7b: Write recommendation_log (Layer 1 outcome tracking) ────────
  // Separate collection for analytics — survives tile deletion.
  // Captures the engine's decision state at publish time.
  const recLog = {
    tileId,
    symbol: SYMBOL,
    publishedStrategy: result.strategy,
    publishedDirection: result.direction,
    engineSnapshot: engineSnapshot || null,
    override: engineSnapshot && engineSnapshot.strategy !== result.strategy.toLowerCase().replace(/\s+/g, '_'),
    entry: {
      spotAtEntry: snapshot.price,
      expiry: result.expiry,
      dte: result.dte,
      netCredit: result.netCredit,
      maxProfit: result.maxProfit,
      maxLoss: result.maxLoss,
      rewardRisk: result.rewardRisk,
      oddsOfProfit: result.oddsOfProfit,
      breakevens: result.breakevens,
      legs: result.legs.map(l => ({ action: l.action, type: l.type, strike: l.strike, mid: l.premium, iv: l.iv })),
    },
    weekId,
    publishedAt: admin.firestore.FieldValue.serverTimestamp(),
    // Outcome fields — populated by update-pick-outcomes.js after expiry
    outcome: null,           // WIN | LOSS | PARTIAL
    actualPnl: null,
    spotAtExpiry: null,
    thesisScore: null,       // Layer 2: strategy-specific scoring (future)
  };
  await db.collection('recommendation_log').doc(tileId).set(recLog);
  log(`     recommendation_log/${tileId} ✅`);

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
