#!/usr/bin/env node
'use strict';

/**
 * refresh-event-calendar.js — Pull earnings + ex-div dates from Yahoo (via Cloud Function)
 * ─────────────────────────────────────────────────────────────────────────────
 * Uses the Yahoo Cloud Function's /api/events/{SYMBOL} endpoint (yfinance).
 * One call per symbol, batched/throttled. No FMP dependency.
 *
 * FMP dividends-calendar (bulk) is optionally used as a supplement for ex-div
 * dates when FMP_API_KEY is set, since yfinance ex-div coverage is spotty.
 *
 * Writes:
 *   1. web/scanner/event-calendar.json  (new format with provenance)
 *   2. web/workbench/event-calendar.json (workbench copy — Movement & Range reads this)
 *   3. web/scanner/earnings-calendar.json (backward compat)
 *   4. pipeline/earnings-calendar.json  (pipeline copy)
 *   5. web/workbench/earnings-calendar.json (workbench copy)
 *
 * Usage: node scripts/refresh-event-calendar.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(ROOT, 'pipeline', 'config.json');
const EVENT_CAL_PATH = path.join(ROOT, 'web', 'scanner', 'event-calendar.json');
const OLD_EARN_PATH = path.join(ROOT, 'web', 'scanner', 'earnings-calendar.json');
const PIPELINE_EARN_PATH = path.join(ROOT, 'pipeline', 'earnings-calendar.json');
const WORKBENCH_EARN_PATH = path.join(ROOT, 'web', 'workbench', 'earnings-calendar.json');
// The workbench Movement & Range page prefers the new-format event-calendar.json; keep it fresh too.
const WORKBENCH_EVENT_PATH = path.join(ROOT, 'web', 'workbench', 'event-calendar.json');

const { atomicWriteMultiSync } = require(path.join(ROOT, 'shared', 'lib', 'atomicWrite.cjs'));
const DRY_RUN = process.argv.includes('--dry-run');

async function main() {
  console.log(`\n╔══════════════════════════════════════════════════════════╗`);
  console.log(`║    Event Calendar Refresh (Yahoo + FMP ex-div)           ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝`);
  console.log(`  Time:     ${new Date().toISOString()}`);
  console.log(`  Dry run:  ${DRY_RUN}`);

  const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const watchlist = [...(config.watchlist || [])];
  const YAHOO_SVC = config.yahoosvc?.url || 'https://yahoo-options-svc-m2cty2vxuq-uc.a.run.app';
  const today = new Date().toISOString().split('T')[0];

  console.log(`  Watchlist: ${watchlist.length} symbols`);
  console.log(`  Yahoo svc: ${YAHOO_SVC}`);

  // ── Yahoo: per-symbol earnings + ex-div ──
  console.log('\n  Fetching from Yahoo (per-symbol)...');
  const symbols = {};
  let earningsFound = 0, exDivFound = 0, failed = 0;
  const batchSize = 5; // Cloud Function scales to multiple instances

  for (let i = 0; i < watchlist.length; i += batchSize) {
    const batch = watchlist.slice(i, i + batchSize);
    const results = await Promise.allSettled(batch.map(async (sym) => {
      // 3-attempt retry with 2s/4s/8s backoff
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const res = await fetch(`${YAHOO_SVC}/api/events/${sym}`, { signal: AbortSignal.timeout(30000) });
          if (!res.ok && res.status >= 500) throw new Error(`${res.status}`);
          if (!res.ok) return { symbol: sym, earningsDate: null, exDividendDate: null };
          return await res.json();
        } catch (err) {
          if (attempt < 2) { await new Promise(r => setTimeout(r, (2 ** (attempt + 1)) * 1000)); continue; }
          return { symbol: sym, earningsDate: null, exDividendDate: null, error: err.message };
        }
      }
    }));

    for (const r of results) {
      if (r.status !== 'fulfilled') { failed++; continue; }
      const data = r.value;
      const sym = data.symbol;
      if (data.error) { failed++; }

      const earnings = data.earningsDate && data.earningsDate >= today ? data.earningsDate : null;
      const exDiv = data.exDividendDate && data.exDividendDate >= today ? data.exDividendDate : null;

      symbols[sym] = {
        earnings, earningsSource: earnings ? 'yahoo' : null, earningsFetchedAt: earnings ? today : null,
        exDiv, exDivSource: exDiv ? 'yahoo' : null, exDivFetchedAt: exDiv ? today : null,
      };
      if (earnings) earningsFound++;
      if (exDiv) exDivFound++;
    }

    process.stdout.write(`  ${Math.min(i + batchSize, watchlist.length)}/${watchlist.length}...`);
    if (i + batchSize < watchlist.length) await new Promise(r => setTimeout(r, 400));
  }

  console.log(`\n  Yahoo: ${earningsFound} earnings, ${exDivFound} ex-div, ${failed} failed`);

  // ── Optional FMP supplement for ex-div (bulk, if key available) ──
  let FMP_KEY = process.env.FMP_API_KEY;
  if (!FMP_KEY) { try { FMP_KEY = config.fmpApiKey; } catch {} }

  if (FMP_KEY) {
    console.log('\n  FMP ex-div supplement...');
    try {
      const futureDate = new Date(Date.now() + 90 * 86400000).toISOString().split('T')[0];
      const url = `https://financialmodelingprep.com/stable/dividends-calendar?from=${today}&to=${futureDate}&apikey=${FMP_KEY}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
      if (res.ok) {
        const divs = await res.json();
        let fmpAdded = 0;
        for (const d of divs) {
          const sym = d.symbol;
          if (!symbols[sym]) continue;
          if (!symbols[sym].exDiv && d.date >= today) {
            symbols[sym].exDiv = d.date;
            symbols[sym].exDivSource = 'fmp';
            symbols[sym].exDivFetchedAt = today;
            exDivFound++;
            fmpAdded++;
          }
        }
        console.log(`  FMP added ${fmpAdded} ex-div dates`);
      }
    } catch (err) { console.warn(`  FMP ex-div failed: ${err.message}`); }
  }

  console.log(`\n  Total: ${earningsFound} earnings, ${exDivFound} ex-div out of ${watchlist.length}`);

  // Show samples
  const samples = Object.entries(symbols).filter(([, d]) => d.earnings).slice(0, 8);
  if (samples.length) { console.log('\n  Samples:'); samples.forEach(([s, d]) => console.log(`    ${s.padEnd(6)} earn: ${d.earnings} (${d.earningsSource})${d.exDiv ? '  exDiv: ' + d.exDiv : ''}`)); }

  // ── Write files ──
  const eventCalendar = {
    _lastUpdated: today,
    _source: 'Yahoo Cloud Function (yfinance) + FMP ex-div supplement',
    _symbolCount: watchlist.length,
    _earningsCount: earningsFound,
    _exDivCount: exDivFound,
    symbols,
  };

  const oldEarningsCal = {
    _comment: 'Earnings dates. Auto-generated by refresh-event-calendar.js',
    _lastUpdated: today,
    symbols: {},
  };
  for (const [sym, data] of Object.entries(symbols)) {
    oldEarningsCal.symbols[sym] = data.earnings || null;
  }

  if (DRY_RUN) { console.log('\n  [DRY RUN] Skipping writes.'); return; }

  const eventJson = JSON.stringify(eventCalendar, null, 2);
  const oldJson = JSON.stringify(oldEarningsCal, null, 2);

  // Atomic multi-write: all 5 files written to .tmp first, then renamed
  try {
    atomicWriteMultiSync([
      { path: EVENT_CAL_PATH, content: eventJson },
      { path: WORKBENCH_EVENT_PATH, content: eventJson },
      { path: OLD_EARN_PATH, content: oldJson },
      { path: PIPELINE_EARN_PATH, content: oldJson },
      { path: WORKBENCH_EARN_PATH, content: oldJson },
    ], { validateJson: true });
    console.log(`\n  Written atomically: 5 files (${(eventJson.length / 1024).toFixed(1)} KB)`);
  } catch (err) {
    console.error(`\n  ATOMIC WRITE FAILED: ${err.message} — old files preserved`);
    process.exit(1);
  }

  // Publish to R2 so consumers (Movement & Range) get the fresh calendar with NO hosting
  // deploy — same delivery path as the per-symbol reports. This is what stops the calendar
  // drifting stale on the live site between deploys. Retried; logged loudly if it can't.
  const uploader = path.join(ROOT, 'pipeline', 'upload-to-r2.js');
  const uploads = [
    ['../web/scanner/event-calendar.json', 'reports/event-calendar.json'],
    ['../web/scanner/earnings-calendar.json', 'reports/earnings-calendar.json'],
  ];
  for (const [local, key] of uploads) {
    let ok = false;
    for (let attempt = 1; attempt <= 3 && !ok; attempt++) {
      try { execFileSync('node', [uploader, local, key], { stdio: 'inherit' }); ok = true; }
      catch (e) { console.error(`  R2 upload ${key} attempt ${attempt} failed: ${e.message}`); }
    }
    if (!ok) console.error(`  ⚠️  R2 upload FAILED for ${key} — live calendar will be stale until next run`);
  }

  console.log('\n  Done.');
}

main().catch(err => { console.error('\nFATAL:', err.message); process.exit(1); });
