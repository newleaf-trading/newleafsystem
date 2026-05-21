#!/usr/bin/env node
/**
 * sync-r2-to-firestore.js (FIXED v3 structure)
 * 
 * Syncs latest NewLeaf Pro v3 data from R2 to Firestore
 * - Fetches manifest.json from R2
 * - Fetches individual symbol reports (latest.json)
 * - Transforms v3 structure to tile format
 * - Deactivates old tiles
 * - Pushes new tiles to Firestore
 * 
 * Usage:
 *   node sync-r2-to-firestore-fixed.js --dry-run
 *   node sync-r2-to-firestore-fixed.js
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

// Initialize Firebase Admin
admin.initializeApp({
  projectId: 'newleaf-trading',
  credential: admin.credential.cert(resolve(__dirname, 'serviceAccountKey.json'))
});

const db = admin.firestore();
db.settings({ databaseId: 'newleafdb' });

/**
 * Fetch JSON from R2
 */
async function fetchR2Json(path) {
  const url = `${R2_BASE_URL}/${path}`;
  const response = await axios.get(url);
  return response.data;
}

/**
 * Transform v3 report (latest.json) to tile format
 * Handles the actual v3 structure where data is nested under 'scoring'
 */
function transformToTile(report) {
  const {
    meta,
    snapshot,
    scoring,
    gammaData
  } = report;

  // Extract from nested scoring object
  const { opportunityScore, direction, strategy } = scoring;
  const { name: strategyName, code: strategyCode, icon: strategyIcon } = strategy;

  // Price data from snapshot
  const { price, changePercent } = snapshot;

  // IV data
  const iv = gammaData?.ivData?.atmIv || 0;

  const tile = {
    id: `${meta.symbol}_${strategyCode}_${Date.now()}`,
    symbol: meta.symbol,
    company: meta.symbol, // Could enhance with company name lookup
    
    // Strategy info
    strategy: strategyName,
    strategyCode,
    strategyIcon,
    direction,
    
    // Scores & metrics
    opportunityScore: Math.round(opportunityScore),
    
    // Price data
    price: parseFloat(price),
    priceChange: parseFloat(changePercent),
    iv: parseFloat(iv),
    
    // NEW v3: Gamma data with confidence breakdown
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
    
    // Metadata
    date: meta.date,
    dataSource: 'newleaf-alpaca-r2',
    pipelineVersion: 'v3',
    isActive: true,
    sortOrder: 100 - opportunityScore, // Higher scores first
    lastUpdated: admin.firestore.Timestamp.now()
  };

  return tile;
}

/**
 * Main sync function
 */
async function syncR2ToFirestore() {
  console.log('🔄 NewLeaf Pro v3: R2 → Firestore Sync (FIXED)');
  console.log('━'.repeat(60));
  
  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No data will be written\n');
  }

  try {
    // Get list of symbols from config (authoritative source)
    const watchlist = config.watchlist;
    console.log(`\n📋 Using watchlist from config: ${watchlist.length} symbols`);
    console.log(`   (Ignoring accumulated manifest)`);

    // Fetch individual reports and transform to tiles
    console.log('\n🔄 Fetching reports from R2...');
    const tiles = [];
    let successCount = 0;
    let failureCount = 0;
    
    for (const symbol of watchlist) {
      try {
        const report = await fetchR2Json(`reports/${symbol}/latest.json`);
        const tile = transformToTile(report);
        tiles.push(tile);
        successCount++;
        
        console.log(`  ✓ ${symbol}: ${tile.strategy} (score: ${tile.opportunityScore}, OI: ${(tile.gammaData?.confidence?.oi * 100 || 0).toFixed(0)}%)`);
      } catch (error) {
        failureCount++;
        console.error(`  ✗ ${symbol}: ${error.message}`);
      }
    }

    console.log(`\n✓ Transformed ${tiles.length} tiles (${successCount} ok, ${failureCount} failed)`);

    if (DRY_RUN) {
      console.log('\n📊 DRY RUN SUMMARY:');
      console.log(`  Would write ${tiles.length} tiles to Firestore`);
      console.log(`  Would deactivate all existing active tiles`);
      console.log(`\n  Top 5 opportunities:`);
      tiles
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
    
    // First, deactivate ALL existing tiles
    console.log('  Deactivating old tiles...');
    const oldTilesSnapshot = await db.collection('tiles').where('isActive', '==', true).get();
    const deactivateBatch = db.batch();
    
    oldTilesSnapshot.docs.forEach(doc => {
      deactivateBatch.update(doc.ref, { isActive: false });
    });
    
    await deactivateBatch.commit();
    console.log(`  ✓ Deactivated ${oldTilesSnapshot.size} old tiles`);

    // Write new tiles in batches (Firestore limit: 500 writes per batch)
    const batchSize = 500;
    for (let i = 0; i < tiles.length; i += batchSize) {
      const batch = db.batch();
      const batchTiles = tiles.slice(i, i + batchSize);
      
      batchTiles.forEach(tile => {
        const tileRef = db.collection('tiles').doc(tile.id);
        batch.set(tileRef, tile);
      });
      
      await batch.commit();
      console.log(`  ✓ Wrote batch ${Math.floor(i / batchSize) + 1} (${batchTiles.length} tiles)`);
    }

    // Update market state
    console.log('\n📊 Updating market state...');
    await db.collection('marketState').doc('current').set({
      lastScanTime: admin.firestore.Timestamp.now(),
      scanSource: 'newleaf-alpaca-r2-sync',
      pipelineVersion: 'v3',
      activeTileCount: tiles.length,
      symbols: tiles.map(t => t.symbol),
      lastUpdated: admin.firestore.Timestamp.now()
    }, { merge: true });

    console.log('✓ Market state updated');

    // Summary
    console.log('\n' + '━'.repeat(60));
    console.log('✅ SYNC COMPLETE');
    console.log('━'.repeat(60));
    console.log(`📊 Total tiles written: ${tiles.length}`);
    console.log(`📅 Data date: ${tiles[0]?.date || 'N/A'}`);
    const topTile = tiles.sort((a, b) => b.opportunityScore - a.opportunityScore)[0];
    console.log(`🏆 Top opportunity: ${topTile?.symbol} (${topTile?.opportunityScore}, ${topTile?.strategy})`);
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
