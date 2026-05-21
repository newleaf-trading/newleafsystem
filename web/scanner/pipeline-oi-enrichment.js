#!/usr/bin/env node
/**
 * pipeline-oi-enrichment.js — OI Enrichment Pipeline (Yahoo ONLY)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Purpose: Enrich existing reports with Open Interest data from Yahoo
 * Schedule: Once daily at 9:32am ET
 * Speed: ~270 seconds for 108 symbols (sequential, Yahoo thread limit)
 *
 * Data Sources:
 *   ❌ Alpaca → NOT USED (loads existing latest.json instead)
 *   ✅ Yahoo Service :5300 → Open Interest (T-1 data)
 *
 * Workflow:
 *   1. Load existing latest.json for each symbol (from fast pipeline)
 *   2. Fetch OI data from Yahoo service
 *   3. Merge OI into option chains
 *   4. Recalculate gamma walls (now accurate with OI)
 *   5. Calculate OI delta (position changes vs yesterday)
 *   6. Update opportunity score (with OI confidence boost)
 *   7. Save daily snapshot + history files
 *
 * Outputs:
 *   ✅ reports/{symbol}/latest.json             → Updated with OI
 *   ✅ reports/{symbol}/{date}.json             → Daily snapshot (OI-rich)
 *   ✅ reports/{symbol}/history/premium.json    → Appended
 *   ✅ reports/{symbol}/history/walls.json      → Appended
 *   ✅ reports/{symbol}/history/oi-{date}.json  → OI baseline for tomorrow
 *
 * Key Differences from Fast Pipeline:
 *   • Does NOT fetch price data (uses existing)
 *   • DOES fetch OI from Yahoo
 *   • Recalculates gamma walls with real OI
 *   • Saves daily snapshot {date}.json
 *   • Appends to history files
 *   • Runs sequentially (Yahoo thread limit)
 *
 * Requirements:
 *   • Yahoo service must be running (localhost:5300)
 *   • latest.json must exist for each symbol (from fast pipeline)
 *
 * Usage:
 *   node pipeline-oi-enrichment.js --watchlist
 *   node pipeline-oi-enrichment.js AAPL TSLA NVDA
 *   node pipeline-oi-enrichment.js --watchlist --no-upload
 *
 * Cron:
 *   Once daily at 9:32am ET (Mon-Fri)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

// Force daily mode by injecting --daily flag
if (!process.argv.includes('--daily')) {
  process.argv.push('--daily');
}

// Force concurrency=1 for Yahoo service (thread limit)
if (!process.argv.some(arg => arg.startsWith('--concurrency'))) {
  process.argv.push('--concurrency=1');
}

console.log('\n  📊 OI ENRICHMENT PIPELINE (Yahoo ONLY)\n');
console.log('  ────────────────────────────────────────────');
console.log('  Mode:        Daily (forced)');
console.log('  Concurrency: 1 (Yahoo thread limit)');
console.log('  Data source: Yahoo service :5300');
console.log('  OI data:     T-1 (yesterday close)');
console.log('  ────────────────────────────────────────────\n');

// Run existing pipeline in daily mode
require('./newleaf-pipeline.js');
