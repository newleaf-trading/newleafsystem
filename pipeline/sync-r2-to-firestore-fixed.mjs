#!/usr/bin/env node
/**
 * sync-r2-to-firestore.js (FIXED v3 structure)
 *
 * Syncs latest NewLeaf Pro v3 data from R2 to Firestore.
 *
 * IMPORTANT: Writes to `scanner_signals` collection, NOT `tiles`.
 * Scanner signals are pre-pricing signals — symbol, strategy, direction,
 * score, gamma data — not tradeable candidates. The `tiles` collection
 * is reserved for priced candidates written by publish-pick, discover-publish,
 * or strategy-builder.
 *
 * The deactivation sweep targets `scanner_signals` only — it must NEVER
 * touch `tiles` (doing so would deactivate priced candidates and empty Discover).
 *
 * Usage:
 *   node sync-r2-to-firestore-fixed.mjs --dry-run
 *   node sync-r2-to-firestore-fixed.mjs
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Config
const config = JSON.parse(readFileSync(resolve(__dirname, 'config.json'), 'utf-8'));
const R2_BASE_URL = config.r2.publicBaseUrl;
const DRY_RUN = process.argv.includes('--dry-run');

// The collection this script writes to — NEVER 'tiles'
const SIGNAL_COLLECTION = 'scanner_signals';

// Initialize Firebase Admin
admin.initializeApp({
  projectId: 'newleaf-trading',
  credential: admin.credential.cert(resolve(__dirname, 'serviceAccountKey.json'))
});

const db = admin.firestore();
// ignoreUndefinedProperties: a report occasionally has an undefined field (e.g. `strategy`)
// which previously crashed the whole sync ("Cannot use undefined as a Firestore value"),
// leaving Firestore tiles stale until a manual rerun. Skip undefined fields instead.
db.settings({ databaseId: 'newleafdb', ignoreUndefinedProperties: true });

/**
 * Fetch JSON from R2
 */
async function fetchR2Json(path) {
  const url = `${R2_BASE_URL}/${path}`;
  const response = await axios.get(url);
  return response.data;
}

/**
 * Transform v3 report (latest.json) to ScannerSignal shape.
 * This is NOT a tile — no legs, no pricing, no breakevens.
 */
function transformToSignal(report) {
  const {
    meta,
    snapshot,
    scoring,
    gammaData
  } = report;

  const { opportunityScore, direction, strategy } = scoring;
  const { name: strategyName, code: strategyCode, icon: strategyIcon } = strategy;
  const { price, changePercent } = snapshot;
  const iv = gammaData?.ivData?.atmIv || 0;

  return {
    id: `${meta.symbol}_${strategyCode}_${Date.now()}`,
    symbol: meta.symbol,

    // Strategy
    strategy: strategyName,
    strategyCode,
    strategyIcon,
    direction,

    // Scores
    opportunityScore: Math.round(opportunityScore),

    // Price at scan time
    price: parseFloat(price),
    priceChange: parseFloat(changePercent),
    iv: parseFloat(iv),

    // Gamma data
    gammaData: gammaData ? {
      analysis: gammaData.analysis || {},
      confidence: {
        overall: gammaData.analysis?.confidence_score || 0.5,
        oi: gammaData.analysis?.oi_confidence || 0,
        delta: gammaData.analysis?.delta_confidence || 0,
        volume: gammaData.analysis?.volume_confidence || 0
      },
      strikes: gammaData.analysis?.topStrikes || [],
      metadata: {
        oiEnrichedAt: meta.oiEnrichedAt,
        oiCoverage: meta.oiConfidence || 0,
        oiFreshness: meta.oiFreshness,
        dataQuality: meta.oiConfidence >= 0.8 ? 'excellent' :
                     meta.oiConfidence >= 0.6 ? 'good' :
                     meta.oiConfidence >= 0.4 ? 'fair' : 'poor'
      }
    } : null,

    // Provenance
    source: 'pipeline-scanner',
    date: meta.date,
    isActive: true,
    sortOrder: 100 - opportunityScore,
    lastUpdated: admin.firestore.Timestamp.now()
  };
}

/**
 * Main sync function
 */
async function syncR2ToFirestore() {
  console.log('🔄 NewLeaf Pro v3: R2 → Firestore Sync');
  console.log(`   Collection: ${SIGNAL_COLLECTION} (NOT tiles)`);
  console.log('━'.repeat(60));

  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No data will be written\n');
  }

  try {
    const watchlist = config.watchlist;
    console.log(`\n📋 Using watchlist from config: ${watchlist.length} symbols`);

    // Fetch individual reports and transform to signals
    console.log('\n🔄 Fetching reports from R2...');
    const signals = [];
    let successCount = 0;
    let failureCount = 0;

    for (const symbol of watchlist) {
      try {
        const report = await fetchR2Json(`reports/${symbol}/latest.json`);
        const signal = transformToSignal(report);
        signals.push(signal);
        successCount++;

        console.log(`  ✓ ${symbol}: ${signal.strategy} (score: ${signal.opportunityScore}, OI: ${(signal.gammaData?.confidence?.oi * 100 || 0).toFixed(0)}%)`);
      } catch (error) {
        failureCount++;
        console.error(`  ✗ ${symbol}: ${error.message}`);
      }
    }

    console.log(`\n✓ Transformed ${signals.length} signals (${successCount} ok, ${failureCount} failed)`);

    if (DRY_RUN) {
      console.log('\n📊 DRY RUN SUMMARY:');
      console.log(`  Would write ${signals.length} signals to ${SIGNAL_COLLECTION}`);
      console.log(`  Would deactivate old signals in ${SIGNAL_COLLECTION}`);
      console.log(`  tiles collection: UNTOUCHED`);
      console.log(`\n  Top 5 opportunities:`);
      signals
        .sort((a, b) => b.opportunityScore - a.opportunityScore)
        .slice(0, 5)
        .forEach((t, i) => {
          const oiConf = (t.gammaData?.confidence?.oi * 100 || 0).toFixed(0);
          console.log(`    ${i + 1}. ${t.symbol}: ${t.opportunityScore} (${t.strategy}, OI: ${oiConf}%)`);
        });
      console.log('\n✓ Dry run complete - no data written');
      return;
    }

    // Write to Firestore
    console.log('\n📝 Writing to Firestore...');

    // Deactivate old SIGNALS (never tiles!)
    console.log(`  Deactivating old signals in ${SIGNAL_COLLECTION}...`);
    const oldSignals = await db.collection(SIGNAL_COLLECTION).where('isActive', '==', true).get();
    if (oldSignals.size > 0) {
      const deactivateBatch = db.batch();
      oldSignals.docs.forEach(doc => {
        deactivateBatch.update(doc.ref, { isActive: false });
      });
      await deactivateBatch.commit();
      console.log(`  ✓ Deactivated ${oldSignals.size} old signals`);
    } else {
      console.log('  ✓ No old signals to deactivate');
    }

    // Write new signals in batches
    const batchSize = 500;
    for (let i = 0; i < signals.length; i += batchSize) {
      const batch = db.batch();
      const batchSignals = signals.slice(i, i + batchSize);

      batchSignals.forEach(signal => {
        const ref = db.collection(SIGNAL_COLLECTION).doc(signal.id);
        batch.set(ref, signal);
      });

      await batch.commit();
      console.log(`  ✓ Wrote batch ${Math.floor(i / batchSize) + 1} (${batchSignals.length} signals)`);
    }

    // Update market state
    console.log('\n📊 Updating market state...');
    await db.collection('marketState').doc('current').set({
      lastScanTime: admin.firestore.Timestamp.now(),
      scanSource: 'newleaf-alpaca-r2-sync',
      pipelineVersion: 'v3',
      activeSignalCount: signals.length,
      symbols: signals.map(t => t.symbol),
      lastUpdated: admin.firestore.Timestamp.now()
    }, { merge: true });

    console.log('✓ Market state updated');

    // Summary
    console.log('\n' + '━'.repeat(60));
    console.log('✅ SYNC COMPLETE');
    console.log('━'.repeat(60));
    console.log(`📊 Total signals written: ${signals.length} (to ${SIGNAL_COLLECTION})`);
    console.log(`📋 tiles collection: UNTOUCHED`);
    console.log(`📅 Data date: ${signals[0]?.date || 'N/A'}`);
    const topSignal = signals.sort((a, b) => b.opportunityScore - a.opportunityScore)[0];
    console.log(`🏆 Top opportunity: ${topSignal?.symbol} (${topSignal?.opportunityScore}, ${topSignal?.strategy})`);
    console.log('━'.repeat(60));

  } catch (error) {
    console.error('\n❌ Sync failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run
syncR2ToFirestore()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
