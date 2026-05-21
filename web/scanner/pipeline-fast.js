#!/usr/bin/env node
/**
 * pipeline-fast.js — Fast Pipeline (Alpaca ONLY)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Purpose: Fast price/IV/Greeks updates using ONLY Alpaca API
 * Schedule: Every 15 minutes (market hours 9:30am-4pm ET)
 * Speed: ~22 seconds for 108 symbols (5 parallel)
 *
 * Data Sources:
 *   ✅ Alpaca Stock Bars  → price, volume, OHLC
 *   ✅ Alpaca Option Quotes → bid/ask, IV, Greeks
 *   ❌ Yahoo Service → NOT USED (no OI data)
 *
 * Outputs:
 *   ✅ reports/{symbol}/latest.json       → Always current (OI = null)
 *   ✅ reports/{symbol}/{timestamp}.json  → Timestamped snapshot
 *   ✅ reports/{symbol}/history/iv.json   → IV time series
 *   ❌ reports/{symbol}/{date}.json       → NOT written (OI pipeline writes this)
 *   ❌ history/premium.json, walls.json   → NOT written (daily only)
 *
 * Key Differences from Full Pipeline:
 *   • Uses next Friday expiry ONLY (not 8 expiries)
 *   • NO Open Interest data (OI fields = null)
 *   • Gamma walls use volume-based proxy
 *   • Does NOT save daily snapshot (preserves OI-enriched version)
 *   • Runs 5 parallel workers (fast)
 *
 * Usage:
 *   node pipeline-fast.js --watchlist
 *   node pipeline-fast.js AAPL TSLA NVDA
 *   node pipeline-fast.js --watchlist --no-upload
 *
 * Cron:
 *   Every 15 min during market hours (9am-4pm ET, Mon-Fri)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

// Force intraday mode by injecting --intraday flag
if (!process.argv.includes('--intraday')) {
  process.argv.push('--intraday');
}

// Set concurrency to 5 for fast parallel execution
if (!process.argv.some(arg => arg.startsWith('--concurrency'))) {
  process.argv.push('--concurrency=5');
}

console.log('\n  🚀 FAST PIPELINE (Alpaca ONLY - No Yahoo/OI)\n');
console.log('  ────────────────────────────────────────────');
console.log('  Mode:        Intraday (forced)');
console.log('  Concurrency: 5 parallel');
console.log('  Data source: Alpaca only');
console.log('  OI data:     null (enriched by daily pipeline)');
console.log('  ────────────────────────────────────────────\n');

// Run existing pipeline in intraday mode
require('./newleaf-pipeline.js');
