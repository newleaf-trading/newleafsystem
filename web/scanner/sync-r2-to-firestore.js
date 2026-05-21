#!/usr/bin/env node
/**
 * sync-r2-to-firestore.js
 * 
 * Syncs latest NewLeaf Pro v3 data from R2 to Firestore
 * - Fetches manifest.json from R2
 * - Fetches individual symbol reports
 * - Transforms to tile format
 * - Pushes to Firestore tiles collection
 * 
 * Usage:
 *   node sync-r2-to-firestore.js
 *   node sync-r2-to-firestore.js --dry-run  # Preview without writing
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
  credential: admin.credential.cert(resolve(__dirname, '../../newleaf-trading/scanner/serviceAccountKey.json'))
});

const db = admin.firestore();
db.settings({ databaseId: 'newleafdb' });

/**
 * Fetch JSON from R2
 */
async function fetchR2Json(path) {
  const url = `${R2_BASE_URL}/${path}`;
  console.log(`  Fetching: ${url}`);
  const response = await axios.get(url);
  return response.data;
}

/**
 * Transform v3 report to tile format
 */
function transformToTile(report, symbol) {
  const {
    opportunityScore,
    direction,
    strategy,
    strategyCode,
    price,
    changePercent,
    iv,
    gammaData,
    date
  } = report;

  // Map strategy codes to icons
  const strategyIcons = {
    'iron_condor': '🦋',
    'bull_put_spread': '📈',
    'bear_call_spread': '📉',
    'bull_call_spread': '📈',
    'bear_put_spread': '📉',
    'calendar_spread': '📅',
    'diagonal_spread': '📐',
    'covered_call': '🛡️',
    'iron_butterfly': '🦋',
    'straddle': '⚖️',
    'strangle': '⚖️'
  };

  const tile = {
    id: `${symbol}_${strategyCode}_${Date.now()}`,
    symbol,
    company: symbol, // You can enhance this with a company name lookup
    
    // Strategy info
    strategy: strategy.replace(/_/g, ' '),
    strategyCode,
    strategyIcon: strategyIcons[strategyCode] || '📊',
    direction,
    
    // Scores & metrics
    opportunityScore: Math.round(opportunityScore),
    
    // Price data
    price: parseFloat(price),
    priceChange: parseFloat(changePercent),
    iv: parseFloat(iv),
    
    // Gamma data (NEW v3 structure)
    gammaData: gammaData ? {
      analysis: gammaData.analysis || {},
      confidence: gammaData.confidence || {
        overall: 0.5,
        oi: 0,
        delta: 0,
        volume: 0
      },
      strikes: gammaData.strikes || [],
      metadata: gammaData.metadata || {}
    } : null,
    
    // Metadata
    date,
    dataSource: 'newleaf-alpaca-r2',
    pipelineVersion: 'v3',
    isActive: true,
    sortOrder: 100 - opportunityScore, // Higher scores appear first
    lastUpdated: admin.firestore.Timestamp.now()
  };

  return tile;
}

/**
 * Main sync function
 */
async function syncR2ToFirestore() {
  console.log('🔄 NewLeaf Pro v3: R2 → Firestore Sync');
  console.log('━'.repeat(60));
  
  if (DRY_RUN) {
    console.log('🔍 DRY RUN MODE - No data will be written\n');
  }

  try {
    // Step 1: Fetch manifest from R2
    console.log('\n📥 Step 1: Fetching manifest from R2...');
    const manifest = await fetchR2Json('reports/manifest.json');
    console.log(`✓ Found ${manifest.reports.length} reports`);
    console.log(`✓ Updated at: ${manifest.updatedAt}`);

    // Step 2: Fetch individual reports and transform to tiles
    console.log('\n🔄 Step 2: Fetching reports and transforming to tiles...');
    const tiles = [];
    
    for (const report of manifest.reports) {
      try {
        // Fetch full report with gamma data
        const fullReport = await fetchR2Json(`reports/${report.symbol}/latest.json`);
        const tile = transformToTile(fullReport, report.symbol);
        tiles.push(tile);
        
        console.log(`  ✓ ${report.symbol}: ${tile.strategy} (score: ${tile.opportunityScore})`);
      } catch (error) {
        console.error(`  ✗ ${report.symbol}: ${error.message}`);
      }
    }

    console.log(`\n✓ Transformed ${tiles.length} tiles`);

    if (DRY_RUN) {
      console.log('\n📊 DRY RUN SUMMARY:');
      console.log(`  Would write ${tiles.length} tiles to Firestore`);
      console.log(`  Top 5 opportunities:`);
      tiles.slice(0, 5).forEach((t, i) => {
        console.log(`    ${i + 1}. ${t.symbol}: ${t.opportunityScore} (${t.strategy})`);
      });
      console.log('\n✓ Dry run complete - no data written');
      return;
    }

    // Step 3: Write to Firestore
    console.log('\n📝 Step 3: Writing to Firestore...');
    
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

    // Step 4: Update market state
    console.log('\n📊 Step 4: Updating market state...');
    await db.collection('marketState').doc('current').set({
      lastScanTime: admin.firestore.Timestamp.now(),
      scanSource: 'newleaf-alpaca-r2-sync',
      pipelineVersion: 'v3',
      activeTileCount: tiles.length,
      symbols: tiles.map(t => t.symbol),
      lastUpdated: admin.firestore.Timestamp.now(),
      r2ManifestUpdatedAt: manifest.updatedAt
    }, { merge: true });

    console.log('✓ Market state updated');

    // Summary
    console.log('\n' + '━'.repeat(60));
    console.log('✅ SYNC COMPLETE');
    console.log('━'.repeat(60));
    console.log(`📊 Total tiles written: ${tiles.length}`);
    console.log(`📅 Data date: ${tiles[0]?.date || 'N/A'}`);
    console.log(`🏆 Top opportunity: ${tiles[0]?.symbol} (${tiles[0]?.opportunityScore})`);
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
