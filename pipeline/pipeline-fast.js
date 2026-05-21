#!/usr/bin/env node
/**
 * pipeline-fast.js — Fast Pipeline (Alpaca ONLY)
 *
 * Purpose: Fast price/IV/Greeks updates using ONLY Alpaca API
 * Schedule: Every 15 minutes (market hours 9:30am-4pm ET)
 *
 * Data Sources:
 *   Alpaca Stock Bars  -> price, volume, OHLC
 *   Alpaca Option Quotes -> bid/ask, IV, Greeks
 *   NO Yahoo/OI data
 *
 * Usage:
 *   node pipeline-fast.js --watchlist
 *   node pipeline-fast.js AAPL TSLA NVDA
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

console.log('\n  FAST PIPELINE (Alpaca ONLY - No Yahoo/OI)\n');
console.log('  Mode:        Intraday (forced)');
console.log('  Concurrency: 5 parallel');
console.log('  Data source: Alpaca only');
console.log('  OI data:     null (enriched by daily pipeline)\n');

// Run existing pipeline in intraday mode
require('./newleaf-pipeline.js');
