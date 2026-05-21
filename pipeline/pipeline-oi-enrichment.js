#!/usr/bin/env node
/**
 * pipeline-oi-enrichment.js — OI Enrichment Pipeline (Nasdaq API)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Purpose: Enrich existing reports with Open Interest data from Nasdaq
 * Schedule: Once daily at 9:32am ET
 *
 * Data Sources:
 *   ✅ Nasdaq API → Open Interest, Volume per strike/expiry
 *   ❌ Alpaca → NOT USED (loads existing latest.json instead)
 *
 * Workflow:
 *   1. Load existing latest.json for each symbol (from fast pipeline)
 *   2. Fetch OI data from Nasdaq API
 *   3. Merge OI into option chains
 *   4. Recalculate gamma walls (now accurate with OI)
 *   5. Calculate OI delta (position changes vs yesterday)
 *   6. Update opportunity score (with OI confidence boost)
 *   7. Save daily snapshot + history files
 *
 * Usage:
 *   node pipeline-oi-enrichment.js --watchlist
 *   node pipeline-oi-enrichment.js AAPL TSLA NVDA
 *   node pipeline-oi-enrichment.js --watchlist --no-upload
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

// Force daily mode
if (!process.argv.includes('--daily')) {
  process.argv.push('--daily');
}

// Concurrency=2 (Nasdaq handles parallel requests better than Nasdaq)
if (!process.argv.some(arg => arg.startsWith('--concurrency'))) {
  process.argv.push('--concurrency=2');
}

console.log('\n  📊 OI ENRICHMENT PIPELINE (Nasdaq API)\n');
console.log('  ────────────────────────────────────────────');
console.log('  Mode:        Daily (forced)');
console.log('  Concurrency: 2');
console.log('  Data source: Nasdaq Option Chain API');
console.log('  OI data:     T-1 (previous close)');
console.log('  ────────────────────────────────────────────\n');

// Run existing pipeline in daily mode
require('./newleaf-pipeline.js');
