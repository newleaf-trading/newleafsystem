#!/usr/bin/env node
/**
 * funnel-price.cjs — Rank-then-price funnel.
 *
 * scanner_signals (unpriced) → rank → select top 2N → price off live chain
 * → validate → quality bar → write top N to tiles.
 *
 * Reuses publish-pick's pricing path (pricing-engine.cjs).
 * Skips signals that can't be priced (no chain, illiquid, no builder).
 * Never fabricates premiums or PoP.
 *
 * Usage:
 *   node funnel-price.cjs              # live run
 *   node funnel-price.cjs --dry-run    # rank + price but don't write
 *   node funnel-price.cjs --n 20       # override N
 */
'use strict';

require('dotenv').config();
const admin = require('firebase-admin');
const { randomUUID } = require('crypto');
const path = require('path');
const fs = require('fs');

const { rankSignals, qualitySelect } = require('./funnel-rank.cjs');
const {
  buildStrategy, validateTileForWrite, normalizeBuildResult, SUPPORTED_STRATEGIES,
  applyPublishGate, POP_FLOOR,
} = require('./pricing-engine.cjs');

// ── Config ──────────────────────────────────────────────────────────────────
const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'pipeline', 'config.json'), 'utf8'));
const ALPACA = 'https://data.alpaca.markets';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const N = parseInt(args.find((_, i, a) => a[i - 1] === '--n') || '15', 10);

const FUNNEL_SOURCE = 'funnel-priced';
const MIN_DTE = 21;

const log = msg => console.log(`  ${msg}`);

// ── Firebase ────────────────────────────────────────────────────────────────
admin.initializeApp({
  projectId: 'newleaf-trading',
  credential: admin.credential.cert(path.join(__dirname, '..', 'pipeline', 'serviceAccountKey.json')),
});
const db = admin.firestore();
db.settings({ databaseId: 'newleafdb' });

// ── Alpaca helpers ──────────────────────────────────────────────────────────
async function alpacaGet(url) {
  const res = await fetch(url, {
    headers: {
      'APCA-API-KEY-ID': config.alpaca.apiKey,
      'APCA-API-SECRET-KEY': config.alpaca.secretKey,
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(12000),
  });
  if (!res.ok) throw new Error(`Alpaca ${res.status}: ${url}`);
  return res.json();
}

async function getSpotPrice(symbol) {
  const d = await alpacaGet(`${ALPACA}/v2/stocks/${symbol}/snapshot`);
  const t = d.latestTrade || {}, q = d.latestQuote || {}, b = d.dailyBar || {}, p = d.prevDailyBar || {};
  const price = t.p || q.ap || b.c || 0, prevClose = p.c || 0;
  return { price, change: price - prevClose, changePercent: prevClose ? ((price - prevClose) / prevClose) * 100 : 0 };
}

async function getOptionChain(symbol, expiry) {
  const url = `${ALPACA}/v1beta1/options/snapshots/${symbol}?expiration_date_gte=${expiry}&expiration_date_lte=${expiry}&feed=indicative&limit=1000`;
  const d = await alpacaGet(url).catch(() => ({ snapshots: {} }));
  const results = [];
  for (const [occ, snap] of Object.entries(d.snapshots || {})) {
    const m = occ.match(/^([A-Z1-9]+)(\d{6})([CP])(\d{8})$/);
    if (!m) continue;
    const strike = parseInt(m[4], 10) / 1000;
    const type = m[3] === 'C' ? 'call' : 'put';
    const g = snap.greeks || {};
    const q = snap.latestQuote || {};
    const bid = q.bp || 0, ask = q.ap || 0;
    const mid = bid && ask ? (bid + ask) / 2 : bid || ask || 0;
    results.push({ occ, type, strike, delta: g.delta || null, gamma: g.gamma || null, theta: g.theta || null, vega: g.vega || null, iv: g.midIV || snap.impliedVolatility || null, bid, ask, mid, volume: snap.dailyBar?.v || 0, openInterest: snap.openInterest || 0 });
  }
  return results;
}

// ── Expiry selection: next monthly with DTE ≥ 21 ────────────────────────────
function selectExpiry() {
  const now = new Date();
  // Try next 3 months to find a monthly (3rd Friday) with DTE ≥ 21
  for (let monthOffset = 0; monthOffset < 3; monthOffset++) {
    const year = now.getFullYear();
    const month = now.getMonth() + monthOffset;
    const d = new Date(year, month, 1, 12, 0, 0);
    while (d.getDay() !== 5) d.setDate(d.getDate() + 1);
    d.setDate(d.getDate() + 14); // 3rd Friday
    const dte = Math.round((d - now) / 86400000);
    if (dte >= MIN_DTE) {
      const iso = d.toISOString().split('T')[0];
      return { expiry: iso, dte };
    }
  }
  return null; // no suitable expiry found
}

// ── Price one signal ────────────────────────────────────────────────────────
async function priceSignal(signal, expiry) {
  const symbol = signal.symbol;
  const strategyName = signal.strategy;

  // Check builder support
  const code = strategyName.toLowerCase().replace(/[^a-z ]/g, '').trim();
  const supported = SUPPORTED_STRATEGIES.some(s => code.includes(s));
  if (!supported) return { tile: null, reason: `no builder for ${strategyName}` };

  try {
    // Fetch live data
    const snapshot = await getSpotPrice(symbol);
    if (!snapshot.price) return { tile: null, reason: 'no spot price' };

    const chain = await getOptionChain(symbol, expiry);
    const calls = chain.filter(c => c.type === 'call').sort((a, b) => a.strike - b.strike);
    const puts = chain.filter(c => c.type === 'put').sort((a, b) => a.strike - b.strike);

    if (calls.length < 3 || puts.length < 3) return { tile: null, reason: `thin chain: ${calls.length}C/${puts.length}P` };

    // Build strategy
    const result = buildStrategy(strategyName, snapshot.price, calls, puts, expiry);

    // Normalize
    const tileId = randomUUID().replace(/-/g, '').slice(0, 20);
    const tile = normalizeBuildResult(result, {
      tileId,
      symbol,
      spot: snapshot.price,
      source: FUNNEL_SOURCE,
      gammaData: signal.gammaData || {},
      engineSnapshot: null,
    });

    // Add Firestore timestamps (will be set at write time)
    tile.createdAt = admin.firestore.FieldValue.serverTimestamp();
    tile.lastUpdated = admin.firestore.FieldValue.serverTimestamp();

    // Validate
    const v = validateTileForWrite(tile);
    if (!v.valid) return { tile: null, reason: `validation: ${v.reason}` };

    return { tile, reason: null };
  } catch (err) {
    return { tile: null, reason: err.message };
  }
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════╗');
  console.log('║    NewLeaf Funnel: Rank → Price → Publish               ║');
  console.log('╚══════════════════════════════════════════════════════════╝');
  console.log(`  Target N:  ${N}`);
  console.log(`  Min DTE:   ${MIN_DTE}`);
  console.log(`  Dry run:   ${DRY_RUN}`);
  console.log('');

  // 1. Select expiry
  const expiryInfo = selectExpiry();
  if (!expiryInfo) {
    log('❌ No suitable expiry found (need monthly with DTE ≥ 21). Aborting.');
    process.exit(1);
  }
  log(`📅 Expiry: ${expiryInfo.expiry} (${expiryInfo.dte} DTE)`);

  // 2. Read active scanner signals
  log('📡 Reading scanner_signals...');
  const signalSnap = await db.collection('scanner_signals').where('isActive', '==', true).get();
  const signals = signalSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  log(`   ${signals.length} active signals`);

  // 3. Rank and select top 2N buffer
  const { selected, skipped, stats } = rankSignals(signals, { N });
  log(`📊 Ranking: ${stats.total} total → ${stats.filtered} filtered → ${stats.deduped} deduped → ${stats.selected} selected (buffer ${stats.bufferSize})`);
  log(`   Skipped: ${skipped.length} (${skipped.slice(0, 5).map(s => `${s.signal.symbol}: ${s.reason}`).join(', ')}${skipped.length > 5 ? '...' : ''})`);

  // 4. Price each selected signal
  log('');
  log('💰 Pricing selected signals...');
  const pricedTiles = [];
  const priceSkipped = [];

  for (const signal of selected) {
    const { tile, reason } = await priceSignal(signal, expiryInfo.expiry);
    if (tile) {
      pricedTiles.push(tile);
      log(`  ✅ ${signal.symbol} ${signal.strategy}: MP=${tile.maxProfit} ML=${tile.maxLoss} R:R=${tile.rewardRisk?.toFixed(2)} PoP=${tile.oddsOfProfit ?? 'null'}`);
    } else {
      priceSkipped.push({ signal, reason });
      log(`  ⏭  ${signal.symbol} ${signal.strategy}: ${reason}`);
    }
  }

  log(`\n   Priced: ${pricedTiles.length} / ${selected.length}`);
  log(`   Skipped: ${priceSkipped.length}`);

  // 5a. Publish gate (shared applyPublishGate): reject tiles that fail the
  // PoP floor (funnel tiles have no verdict, so the gate checks PoP ≥ 65).
  const gatePassed = [];
  let gateRejected = 0;
  for (const t of pricedTiles) {
    const gate = applyPublishGate(t);
    if (gate.pass) {
      gatePassed.push(t);
    } else {
      gateRejected++;
      log(`  🚫 Gate reject: ${t.symbol} — ${gate.reason}`);
    }
  }
  if (gateRejected > 0) {
    log(`\n🚫 Publish gate: ${gateRejected} rejected, ${gatePassed.length} passed`);
  }
  const popPassed = gatePassed; // alias for downstream compatibility

  // 5b. Quality bar: select best N from PoP-passing set (R:R × 60 + PoP × 40)
  const finalTiles = qualitySelect(popPassed, N);
  log(`\n🏆 Quality bar: ${popPassed.length} passed PoP floor → ${finalTiles.length} selected (top ${N})`);

  if (finalTiles.length === 0) {
    log('❌ No tiles passed the quality bar. Aborting.');
    process.exit(0);
  }

  // 6. Report
  log('');
  log('═══ Funnel Report ═══');
  log(`  Signals ranked:    ${stats.total}`);
  log(`  Buffer priced:     ${pricedTiles.length}`);
  log(`  PoP passed:        ${popPassed.length} (≥${POP_FLOOR}%)`);
  log(`  PoP rejected:      ${gateRejected}`);
  log(`  Quality selected:  ${finalTiles.length}`);
  log(`  Skipped (rank):    ${skipped.length}`);
  log(`  Skipped (price):   ${priceSkipped.length}`);
  log(`  PoP null (no IV):  ${finalTiles.filter(t => t.oddsOfProfit == null).length}`);

  if (DRY_RUN) {
    log('\n📋 DRY RUN — would write these tiles:');
    finalTiles.forEach(t => log(`  ${t.symbol} ${t.strategy} R:R=${t.rewardRisk?.toFixed(2)} PoP=${t.oddsOfProfit ?? 'null'}`));
    log('\n✓ Dry run complete — no data written.');
    return;
  }

  // 7. Deactivate prior funnel tiles ONLY (scoped to source=funnel-priced)
  log('\n📝 Writing to Firestore...');
  log(`  Deactivating prior ${FUNNEL_SOURCE} tiles...`);
  const oldFunnel = await db.collection('tiles')
    .where('source', '==', FUNNEL_SOURCE)
    .where('isActive', '==', true)
    .get();

  if (oldFunnel.size > 0) {
    const batch = db.batch();
    oldFunnel.docs.forEach(doc => batch.update(doc.ref, { isActive: false }));
    await batch.commit();
    log(`  ✅ Deactivated ${oldFunnel.size} prior funnel tiles`);
  } else {
    log('  ✅ No prior funnel tiles to deactivate');
  }

  // ASSERTION: verify we didn't touch non-funnel tiles or scanner_signals
  // (The query was scoped to source=FUNNEL_SOURCE, so this is by construction,
  // but log the confirmation for auditability)
  log(`  ℹ️  Non-funnel tiles: UNTOUCHED (scoped to source='${FUNNEL_SOURCE}')`);
  log(`  ℹ️  scanner_signals: UNTOUCHED`);

  // 8. Write new funnel tiles (strip undefined fields — Firestore rejects them)
  const writeBatch = db.batch();
  for (const tile of finalTiles) {
    const ref = db.collection('tiles').doc(tile.id);
    const clean = JSON.parse(JSON.stringify(tile));
    writeBatch.set(ref, clean);
  }
  await writeBatch.commit();
  log(`  ✅ Wrote ${finalTiles.length} funnel tiles`);

  log('\n✅ Funnel complete.');
}

main().then(() => process.exit(0)).catch(err => {
  console.error('\n❌ Fatal:', err.message);
  console.error(err.stack);
  process.exit(1);
});
