#!/usr/bin/env node
/**
 * process-wip-picks.cjs — Process WIP Recommendations from AI Discover
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * Pulls recommendations with status='wip' from Firestore, enriches them with
 * sentiment, Claude analysis, gamma data, generates PDF, and publishes as full
 * picks to tiles/, analyses/, and weeklyPicks/.
 *
 * Usage:
 *   node process-wip-picks.cjs                  # Process all WIP recommendations
 *   node process-wip-picks.cjs --dry-run        # Preview without publishing
 *   node process-wip-picks.cjs --id <recId>     # Process a specific recommendation
 *
 * ═══════════════════════════════════════════════════════════════════════════════
 */

const admin      = require('firebase-admin');
const fs         = require('fs');
const path       = require('path');
const { randomUUID } = require('crypto');
const { fetchSentiment, computeModifier, buildSentimentContext } = require('./sentiment-fetch.cjs');
const { callLLM, DEFAULT_MODEL } = require('./llm-call.cjs');
const CONFIG     = require('./config.cjs');

// ── Firebase ────────────────────────────────────────────────────────────────
const ALPACA  = 'https://data.alpaca.markets';
const R2_BASE = CONFIG.r2.publicBaseUrl;

const keyPath = path.resolve(CONFIG.firebase.serviceAccountPath);
if (fs.existsSync(keyPath)) {
  admin.initializeApp({ credential: admin.credential.cert(require(keyPath)) });
} else {
  admin.initializeApp({ credential: admin.credential.applicationDefault() });
}
const db = admin.firestore();
db.settings({ databaseId: CONFIG.firebase.databaseId });

// ── CLI Args ────────────────────────────────────────────────────────────────
const args    = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const SPECIFIC_ID = (() => {
  const idx = args.indexOf('--id');
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : null;
})();

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
  const url = `${ALPACA}/v1beta1/options/snapshots/${symbol}?expiration_date_gte=${expiry}&expiration_date_lte=${expiry}&feed=indicative&limit=1000`;
  const d = await alpacaGet(url).catch(() => ({ snapshots: {} }));
  const contracts = [];
  for (const [occ, snap] of Object.entries(d.snapshots || {})) {
    const m = occ.match(/^([A-Z1-9]+)(\d{6})([CP])(\d{8})$/);
    if (!m) continue;
    const g = snap.greeks || {}, q = snap.latestQuote || {};
    const bid = q.bp ?? 0, ask = q.ap ?? 0;
    contracts.push({
      occ, type: m[3] === 'C' ? 'call' : 'put',
      strike: parseInt(m[4], 10) / 1000,
      delta: g.delta ?? null, gamma: g.gamma ?? null,
      theta: g.theta ?? null, vega: g.vega ?? null,
      iv: g.midIV ?? snap.impliedVolatility ?? null,
      bid, ask, mid: bid && ask ? (bid + ask) / 2 : bid || ask,
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

// ── Match legs to live chain ───────────────────────────────────────────────
function matchLegsToChain(recLegs, chain) {
  return recLegs.map(leg => {
    const type = leg.type.toLowerCase();
    const candidates = chain.filter(c => c.type === type);
    if (!candidates.length) return leg;
    const match = candidates.find(c => c.strike === leg.strike)
      || candidates.reduce((best, c) => Math.abs(c.strike - leg.strike) < Math.abs(best.strike - leg.strike) ? c : best);

    return {
      action: leg.action, type: leg.type, strike: match.strike,
      premium: match.mid || leg.premium || 0,
      expiry: leg.expiry || '', quantity: 1,
      bid: match.bid || 0, ask: match.ask || 0, mid: match.mid || leg.mid || 0,
      delta: match.delta || 0, gamma: match.gamma || 0,
      theta: match.theta || 0, vega: match.vega || 0,
      iv: match.iv || leg.iv || 0
    };
  });
}

// ── Claude CLI ──────────────────────────────────────────────────────────────
function buildClaudePrompt(tile) {
  const legs = (tile.legs || []).map(l =>
    `  ${l.action} ${l.type} $${l.strike} @ mid=${fmtP(l.premium)} | delta=${l.delta ?? 'N/A'} theta=${l.theta ?? 'N/A'} vega=${l.vega ?? 'N/A'}`
  ).join('\n');

  const gammaCtx = tile.gammaData ? `
GAMMA WALL CONTEXT:
  Put Wall:       ${fmtP(tile.gammaData.put_wall)}
  Call Wall:      ${fmtP(tile.gammaData.call_wall)}
  Gamma Flip:     ${fmtP(tile.gammaData.gamma_flip)}
  Confidence:     ${tile.gammaData.confidence_score ? (tile.gammaData.confidence_score * 100).toFixed(0) + '%' : 'N/A'}` : '';

  const verdictCtx = tile.discoverVerdict ? `
AI DISCOVER VERDICT:
  Verdict:     ${tile.discoverVerdict.word} (confidence: ${tile.discoverVerdict.confidence}%)
  Summary:     ${tile.discoverVerdict.summary}` : '';

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

LEGS:
${legs}
${gammaCtx}
${verdictCtx}

NET GREEKS:
  Delta: ${tile.greeks?.netDelta ?? 'N/A'}  Theta: ${tile.greeks?.netTheta ?? 'N/A'}
  Vega:  ${tile.greeks?.netVega ?? 'N/A'}   Gamma: ${tile.greeks?.netGamma ?? 'N/A'}

OUTPUT INSTRUCTIONS:
Return ONLY a valid JSON object (no markdown, no backticks).
The JSON must have these exact top-level keys:
{
  "strategyRationale": { "whyThisStrategy": "...", "whyTheseStrikes": "...", "whyThisExpiry": "...", "alternativesConsidered": [{"strategy":"...","reason":"..."}] },
  "technicalIndicators": { "rsi": {"value":0,"signal":"...","description":"..."}, "bollingerBands": {"upper":0,"middle":0,"lower":0,"width":0,"signal":"...","description":"..."}, "macd": {"macdLine":0,"signalLine":0,"histogram":0,"signal":"...","description":"..."}, "movingAverages": {"sma20":0,"sma50":0,"sma100":0,"signal":"...","description":""}, "impliedVolatility": {"currentIV":0,"ivRank":0,"ivPercentile":0,"historicalVol30":0,"description":"..."}, "supportResistance": {"support":[{"level":0,"strength":"...","description":"..."}],"resistance":[{"level":0,"strength":"...","description":"..."}]} },
  "thetaDecaySchedule": { "description": "...", "dailyDecay": [{"daysToExpiry":0,"dailyTheta":0,"cumulativeTheta":0}], "earlyCloseRecommendation": "..." },
  "riskAnalysis": { "maxPainScenario": "...", "earningsRisk": "...", "dividendRisk": "...", "eventRisk": "...", "managementPlan": "..." }
}
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
// Process a single recommendation
// ═══════════════════════════════════════════════════════════════════════════

async function processRecommendation(recId, rec) {
  const SYMBOL   = rec.symbol;
  const STRATEGY = rec.strategy;
  const EXPIRY   = rec.expiry;
  const weekId   = getISOWeek();

  log('');
  sep();
  log(`  Processing: ${SYMBOL} ${STRATEGY} (${EXPIRY})`);
  log(`  Rec ID:     ${recId}`);
  log(`  Submitted:  ${rec.publishedBy || 'unknown'}`);
  sep();

  // Mark as processing
  await db.collection('recommendations').doc(recId).update({
    status: 'processing',
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  // ── Step 1: Refresh spot price ──────────────────────────────────────────
  log('  📡 Fetching live spot price...');
  const snapshot = await getSpotPrice(SYMBOL);
  log(`     ${SYMBOL} = ${fmtP(snapshot.price)} (${snapshot.changePercent >= 0 ? '+' : ''}${snapshot.changePercent.toFixed(2)}%)`);

  // ── Step 2: Refresh option chain ────────────────────────────────────────
  log(`  📡 Fetching option chain for ${EXPIRY}...`);
  const chain = await getOptionChain(SYMBOL, EXPIRY);
  log(`     ${chain.filter(c => c.type === 'call').length} calls, ${chain.filter(c => c.type === 'put').length} puts`);

  let legs = rec.legs || [];
  if (chain.length >= 3) {
    legs = matchLegsToChain(legs, chain);
    log('     Legs matched to live chain ✅');
  } else {
    log('     ⚠ Thin chain — using original premiums');
    legs = legs.map(l => ({
      action: l.action, type: l.type, strike: l.strike,
      premium: l.premium || l.mid || 0, mid: l.mid || l.premium || 0,
      bid: 0, ask: 0, delta: 0, gamma: 0, theta: 0, vega: 0,
      iv: l.iv || 0, expiry: EXPIRY, quantity: 1
    }));
  }

  // Recompute P&L
  let netCredit = 0;
  legs.forEach(l => { netCredit += l.action === 'SELL' ? l.mid : -l.mid; });
  const maxProfit = Math.abs(netCredit * 100);
  const strikes = legs.map(l => l.strike);
  const lo = Math.min(...strikes) - 30, hi = Math.max(...strikes) + 30;
  let maxLoss = 0;
  for (let i = 0; i <= 500; i++) {
    const price = lo + (hi - lo) * i / 500;
    let pnl = netCredit * 100;
    legs.forEach(l => {
      const val = l.type.toUpperCase() === 'CALL' ? Math.max(0, price - l.strike) : Math.max(0, l.strike - price);
      pnl += (l.action === 'BUY' ? val : -val) * 100;
    });
    if (pnl < -maxLoss) maxLoss = Math.abs(pnl);
  }
  const rewardRisk = maxLoss > 0 ? maxProfit / maxLoss : 0;

  // Aggregate greeks
  const greeks = legs.reduce((acc, l) => {
    const sign = l.action === 'SELL' ? -1 : 1;
    acc.netDelta += sign * (l.delta || 0);
    acc.netGamma += sign * (l.gamma || 0);
    acc.netTheta += sign * (l.theta || 0);
    acc.netVega  += sign * (l.vega  || 0);
    return acc;
  }, { netDelta: 0, netGamma: 0, netTheta: 0, netVega: 0 });
  Object.keys(greeks).forEach(k => greeks[k] = parseFloat(greeks[k].toFixed(4)));

  log(`     Credit: ${fmtP(netCredit)}/share  Max Profit: ${fmtP(maxProfit)}  Max Loss: ${fmtP(maxLoss)}`);
  log(`     R:R: ${rewardRisk.toFixed(2)}x`);

  // ── Step 3: Gamma walls ─────────────────────────────────────────────────
  log('  📡 Fetching gamma walls from R2...');
  const gammaData = await getGammaContext(SYMBOL);
  if (gammaData) log(`     Put wall: ${fmtP(gammaData.put_wall)}  Call wall: ${fmtP(gammaData.call_wall)}`);
  else log('     ⚠ No gamma data available');

  // ── Step 4: Sentiment ───────────────────────────────────────────────────
  log('  🧠 Fetching sentiment...');
  const sentiment = await fetchSentiment(SYMBOL);
  const sentMod = sentiment ? computeModifier(sentiment, rec.direction || 'neutral') : { action: 'none', points: 0, flags: [] };
  if (sentiment) log(`     Sentiment: ${sentiment.label} ${sentiment.score} (modifier: ${sentMod.points > 0 ? '+' : ''}${sentMod.points})`);
  else log('     Sentiment: unavailable');

  // ── Step 5: Build tile ──────────────────────────────────────────────────
  const dte = Math.round((new Date(EXPIRY + 'T16:00:00').getTime() - Date.now()) / 86400000);
  const tileId = randomUUID().replace(/-/g, '').slice(0, 20);
  const oddsOfProfit = rec.verdict?.confidence || 50;

  const tile = {
    id: tileId, symbol: SYMBOL, ticker: SYMBOL,
    strategy: STRATEGY, tradeType: STRATEGY,
    direction: rec.direction || 'neutral',
    publishedSpotPrice: snapshot.price,
    underlyingPrice: snapshot.price, currentPrice: snapshot.price, price: snapshot.price,
    priceChange: snapshot.change,
    expiry: EXPIRY, expirationDate: EXPIRY, dte, daysToExpiry: dte,
    legs, greeks, gammaData: gammaData || {},
    maxProfit, maxLoss, entryCredit: netCredit * 100, netCredit, pnlPercent: 0,
    rewardRisk: parseFloat(rewardRisk.toFixed(2)),
    oddsOfProfit, probOfProfit: oddsOfProfit,
    breakevens: rec.breakevens || { lower: null, upper: null },
    confidenceScore: oddsOfProfit, confidence: oddsOfProfit,
    sentiment: sentiment ? {
      score: sentiment.score, label: sentiment.label,
      summary: sentiment.summary, keyDrivers: sentiment.keyDrivers,
      modifier: sentMod.points, flags: sentMod.flags,
      updatedAt: sentiment.updatedAt,
    } : null,
    aiInsight: rec.verdict?.summary || '',
    qualityGatePassed: rewardRisk >= 1.0,
    source: 'ai-discover', sourceRecommendationId: recId,
    publishedBy: rec.publishedBy || 'pipeline',
    isActive: true, sortOrder: -Date.now(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (DRY_RUN) {
    log('\n  📋 DRY RUN — tile preview:');
    const preview = { ...tile }; delete preview.legs;
    log(JSON.stringify(preview, null, 2).split('\n').map(l => '     ' + l).join('\n'));
    return;
  }

  // ── Step 6: Write tile ──────────────────────────────────────────────────
  log('  📝 Writing tile to Firestore...');
  await db.collection('tiles').doc(tileId).set(tile);
  log(`     tiles/${tileId} ✅`);

  // ── Step 7: LLM analysis ─────────────────────────────────────────────
  log(`  🤖 Running LLM analysis (${DEFAULT_MODEL}, 30-60s)...`);
  const enrichedTile = { ...tile, spotPrice: snapshot.price, discoverVerdict: rec.verdict || null };
  const sentimentCtx = buildSentimentContext(sentiment);
  const prompt = buildClaudePrompt(enrichedTile) + (sentimentCtx ? '\n' + sentimentCtx : '');
  const raw = await callAnalysisLLM(prompt);
  const analysis = extractJSON(raw);

  for (const key of ['strategyRationale', 'technicalIndicators', 'thetaDecaySchedule', 'riskAnalysis']) {
    if (!analysis[key]) throw new Error(`Claude missing: ${key}`);
  }
  log('     Analysis validated ✅');

  await db.collection('analyses').doc(tileId).set({
    ...analysis,
    _sentiment: sentiment || null,
    _discoverVerdict: rec.verdict || null,
    _discoverEvidence: rec.evidence || null,
    _generatedAt: admin.firestore.FieldValue.serverTimestamp(),
    _tileId: tileId, _symbol: SYMBOL, _strategy: STRATEGY,
    _sourceRecommendationId: recId,
  });
  log(`     analyses/${tileId} ✅`);

  // ── Step 8: Save enriched pick ──────────────────────────────────────────
  const weekDir = path.join(__dirname, 'output', weekId);
  const enrichedDir = path.join(weekDir, 'enriched');
  fs.mkdirSync(enrichedDir, { recursive: true });

  const slug = `${SYMBOL}-${STRATEGY.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
  const enrichedPick = {
    tileId, symbol: SYMBOL, strategy: STRATEGY, direction: rec.direction,
    spotPrice: snapshot.price, expiry: EXPIRY, dte,
    legs, greeks, gammaData: gammaData || {},
    maxProfit, maxLoss, netCredit, rewardRisk: parseFloat(rewardRisk.toFixed(2)),
    oddsOfProfit,
    thesis: analysis.strategyRationale?.whyThisStrategy || rec.verdict?.summary || '',
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
    sentiment: sentiment || null, analysis,
    discoverVerdict: rec.verdict || null,
    weekId, generatedAt: new Date().toISOString(),
  };

  fs.writeFileSync(path.join(enrichedDir, `${slug}.json`), JSON.stringify(enrichedPick, null, 2));
  log(`     enriched/${slug}.json ✅`);

  // ── Step 9: PDF generation ──────────────────────────────────────────────
  log('  📄 Generating PDF...');
  try {
    const dataFile = path.join(enrichedDir, `${slug}.json`);
    const pdfDir = path.join(weekDir, 'pdf');
    fs.mkdirSync(pdfDir, { recursive: true });
    const pdfFile = path.join(pdfDir, `${slug}.pdf`);
    const buildScript = path.join(__dirname, 'build-enriched-report-data.py');
    const genScript   = path.join(__dirname, 'generate-report.py');

    execSync(`python3 "${buildScript}" "${dataFile}" /tmp/nl-report-data.json`, { stdio: 'pipe' });
    execSync(`python3 "${genScript}" /tmp/nl-report-data.json "${pdfFile}"`, { cwd: __dirname, stdio: 'pipe', timeout: 30000 });
    log(`     ${slug}.pdf ✅`);

    // Upload to R2
    try {
      const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
      const r2cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'newleaf-pipeline', 'config.json'), 'utf-8')).r2;
      const r2 = new S3Client({
        region: 'auto', endpoint: r2cfg.endpoint,
        credentials: { accessKeyId: r2cfg.accessKeyId, secretAccessKey: r2cfg.secretAccessKey }
      });
      const pdfBody = fs.readFileSync(pdfFile);
      const date = new Date().toISOString().split('T')[0];
      await r2.send(new PutObjectCommand({
        Bucket: r2cfg.bucket, Key: `reports/pdf/${SYMBOL}/${slug}-latest.pdf`,
        Body: pdfBody, ContentType: 'application/pdf', CacheControl: 'public, max-age=300'
      }));
      await r2.send(new PutObjectCommand({
        Bucket: r2cfg.bucket, Key: `reports/pdf/${SYMBOL}/${slug}-${date}.pdf`,
        Body: pdfBody, ContentType: 'application/pdf', CacheControl: 'public, max-age=86400'
      }));
      log(`     R2: reports/pdf/${SYMBOL}/${slug}-latest.pdf ✅`);
    } catch (r2err) {
      log(`     ⚠ R2 upload failed: ${r2err.message}`);
    }
  } catch (err) {
    log(`     ⚠ PDF generation failed: ${err.message}`);
  }

  // ── Step 10: Add to weeklyPicks ─────────────────────────────────────────
  log('  📋 Adding to weeklyPicks...');
  const weekRef = db.collection('weeklyPicks').doc(weekId);
  const weekDoc = await weekRef.get();

  const pickSummary = {
    tileId, symbol: SYMBOL, strategy: STRATEGY,
    direction: rec.direction || 'neutral', price: snapshot.price,
    maxProfit, maxLoss, rewardRisk: parseFloat(rewardRisk.toFixed(2)),
    oddsOfProfit, expiry: EXPIRY, dte,
    thesis: enrichedPick.thesis, ivContext: enrichedPick.ivContext,
  };

  if (weekDoc.exists) {
    await weekRef.update({
      tileIds: admin.firestore.FieldValue.arrayUnion(tileId),
      picks: admin.firestore.FieldValue.arrayUnion(pickSummary),
      tileCount: admin.firestore.FieldValue.increment(1),
      lastUpdated: admin.firestore.FieldValue.serverTimestamp(),
    });
    log(`     Appended to weeklyPicks/${weekId} ✅`);
  } else {
    const now = new Date();
    const monday = new Date(now); monday.setDate(now.getDate() - (now.getDay() || 7) + 1);
    const friday = new Date(monday); friday.setDate(monday.getDate() + 4);
    const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    await weekRef.set({
      weekId, status: 'current',
      dateRange: `${fmt(monday)} — ${fmt(friday)}`,
      publishedAt: admin.firestore.FieldValue.serverTimestamp(),
      theme: 'Options strategies selected by NewLeaf AI Discover',
      tileIds: [tileId], tileCount: 1, picks: [pickSummary],
    });
    log(`     Created weeklyPicks/${weekId} ✅`);
  }

  // ── Step 11: Send email notification ────────────────────────────────────
  if (CONFIG.email?.smtp?.user) {
    log('  📧 Sending email notification...');
    try {
      const nodemailer = require('nodemailer');
      const transporter = nodemailer.createTransport({
        host: CONFIG.email.smtp.host, port: CONFIG.email.smtp.port,
        auth: { user: CONFIG.email.smtp.user, pass: CONFIG.email.smtp.pass }
      });
      await transporter.sendMail({
        from: CONFIG.email.from,
        to: CONFIG.email.recipients.join(', '),
        subject: `🍃 NewLeaf Pick: ${SYMBOL} ${STRATEGY} (${rec.direction})`,
        html: `<h2>New Pick Published: ${SYMBOL} ${STRATEGY}</h2>
<p><strong>Direction:</strong> ${rec.direction} | <strong>Expiry:</strong> ${EXPIRY} | <strong>DTE:</strong> ${dte}</p>
<p><strong>Credit:</strong> ${fmtP(netCredit)}/share | <strong>Max Profit:</strong> ${fmtP(maxProfit)} | <strong>Max Loss:</strong> ${fmtP(maxLoss)}</p>
<p><strong>R:R:</strong> ${rewardRisk.toFixed(2)}x | <strong>Confidence:</strong> ${oddsOfProfit}%</p>
<p><strong>Thesis:</strong> ${enrichedPick.thesis}</p>
<p><strong>Sentiment:</strong> ${sentiment ? `${sentiment.label} (${sentiment.score})` : 'N/A'}</p>
<hr>
<p>Tile: tiles/${tileId}<br>Source: AI Discover → process-wip-picks</p>
<p><a href="https://newleafsystem.web.app/picks/">View on Picks</a> |
   <a href="${R2_BASE}/reports/pdf/${SYMBOL}/${slug}-latest.pdf">Download PDF</a></p>`
      });
      log('     Email sent ✅');
    } catch (emailErr) {
      log(`     ⚠ Email failed: ${emailErr.message}`);
    }
  }

  // ── Step 12: Update recommendation ──────────────────────────────────────
  await db.collection('recommendations').doc(recId).update({
    status: 'complete', tileId,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  log('');
  sep();
  log(`  ✅ PUBLISHED: ${SYMBOL} ${STRATEGY}`);
  sep();
  log(`  Tile:      tiles/${tileId}`);
  log(`  Analysis:  analyses/${tileId}`);
  log(`  Week:      weeklyPicks/${weekId}`);
  log(`  PDF:       reports/pdf/${SYMBOL}/${slug}-latest.pdf`);
  log(`  Rec:       recommendations/${recId} → complete`);
  sep();

  return tileId;
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  log('');
  log('  ═══════════════════════════════════════════════════════════');
  log('  🍃 NewLeaf — Process WIP Recommendations');
  log('  ═══════════════════════════════════════════════════════════');
  log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  log('');

  if (SPECIFIC_ID) {
    const doc = await db.collection('recommendations').doc(SPECIFIC_ID).get();
    if (!doc.exists) { log(`  ❌ Recommendation ${SPECIFIC_ID} not found`); process.exit(1); }
    const data = doc.data();
    log(`  Targeting: ${data.symbol} ${data.strategy} (status: ${data.status})`);
    try {
      await processRecommendation(SPECIFIC_ID, data);
    } catch (err) {
      log(`  ❌ Failed: ${err.message}`);
      await db.collection('recommendations').doc(SPECIFIC_ID).update({
        status: 'failed', error: err.message,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    return;
  }

  const snap = await db.collection('recommendations')
    .where('status', '==', 'wip')
    .orderBy('createdAt', 'asc').get();

  if (snap.empty) {
    log('  No WIP recommendations found.');
    log('  Submit from AI Discover → Publish to Picks.');
    process.exit(0);
  }

  log(`  Found ${snap.size} WIP recommendation(s)\n`);
  let processed = 0, failed = 0;

  for (const doc of snap.docs) {
    try {
      await processRecommendation(doc.id, doc.data());
      processed++;
    } catch (err) {
      log(`  ❌ Failed ${doc.data().symbol}: ${err.message}`);
      failed++;
      await db.collection('recommendations').doc(doc.id).update({
        status: 'failed', error: err.message,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    if (snap.size > 1) await sleep(2000);
  }

  log(`\n  🏁 Done: ${processed} published, ${failed} failed (of ${snap.size} total)\n`);
}

main().catch(err => {
  console.error(`\n  ❌ Fatal error: ${err.message}\n`);
  if (process.env.VERBOSE) console.error(err.stack);
  process.exit(1);
});
