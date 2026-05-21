#!/usr/bin/env node
/**
 * pipeline-watchlist.js — Watchlist Pipeline (No API calls)
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * Purpose: Generate watchlist snapshots and manifest after data updates
 * Schedule: After OI enrichment completes (9:35am ET daily)
 * Speed: ~5 seconds (no API calls, just file processing)
 *
 * Data Sources:
 *   ❌ Alpaca → NOT USED
 *   ❌ Yahoo → NOT USED
 *   ✅ Local reports/{symbol}/latest.json → Read only
 *
 * Workflow:
 *   1. Generate weekly watchlist snapshot
 *   2. Generate monthly watchlist snapshot
 *   3. Regenerate manifest.json
 *   4. Upload to R2 (if enabled)
 *
 * Outputs:
 *   ✅ reports/watchlist-snapshots.json  → Weekly + monthly premium data
 *   ✅ manifest.json                     → Updated symbol list
 *
 * Usage:
 *   node pipeline-watchlist.js
 *   node pipeline-watchlist.js --no-upload
 *
 * Cron:
 *   Once daily at 9:35am ET (Mon-Fri, after OI enrichment)
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

'use strict';

const { execSync } = require('child_process');
const path = require('path');

console.log('\n  📋 WATCHLIST PIPELINE (No API Calls)\n');
console.log('  ────────────────────────────────────────────');
console.log('  Mode:        Post-processing');
console.log('  Data source: Local reports/ only');
console.log('  Tasks:       Snapshots + manifest');
console.log('  ────────────────────────────────────────────\n');

const startTime = Date.now();
let tasksCompleted = 0;
let tasksFailed = 0;

// Helper to run command and log result
function runTask(description, command) {
  console.log(`[Task ${tasksCompleted + 1}] ${description}...`);
  try {
    const output = execSync(command, {
      cwd: __dirname,
      encoding: 'utf8',
      stdio: 'pipe'
    });
    console.log(`  ✓ ${description} completed\n`);
    tasksCompleted++;
    return true;
  } catch (error) {
    console.error(`  ✗ ${description} FAILED:`);
    console.error(`    ${error.message}\n`);
    tasksFailed++;
    return false;
  }
}

// Task 1: Generate weekly watchlist snapshot
runTask(
  'Generate weekly watchlist snapshot',
  `"${process.execPath}" save-watchlist-snapshot.js weekly`
);

// Task 2: Generate monthly watchlist snapshot
runTask(
  'Generate monthly watchlist snapshot',
  `"${process.execPath}" save-watchlist-snapshot.js monthly`
);

// Task 3: Regenerate manifest
runTask(
  'Regenerate manifest.json',
  `"${process.execPath}" regenerate-manifest.mjs`
);

// Task 4: Upload to R2 (if not disabled)
if (!process.argv.includes('--no-upload')) {
  console.log('[Task 4] Uploading watchlist files to R2...');
  try {
    // Upload watchlist snapshots
    execSync(`"${process.execPath}" upload-to-r2.js reports/watchlist-snapshots.json`, {
      cwd: __dirname,
      encoding: 'utf8',
      stdio: 'pipe'
    });

    // Upload manifest (located in reports/)
    execSync(`"${process.execPath}" upload-to-r2.js reports/manifest.json`, {
      cwd: __dirname,
      encoding: 'utf8',
      stdio: 'pipe'
    });

    console.log('  ✓ R2 upload completed\n');
    tasksCompleted++;
  } catch (error) {
    console.error('  ✗ R2 upload FAILED (non-fatal):');
    console.error(`    ${error.message}\n`);
    // Don't increment tasksFailed - R2 upload is optional
  }
} else {
  console.log('[Task 4] R2 upload skipped (--no-upload flag)\n');
}

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

console.log('  ────────────────────────────────────────────');
console.log(`  Tasks completed: ${tasksCompleted}`);
if (tasksFailed > 0) {
  console.log(`  Tasks failed:    ${tasksFailed}`);
}
console.log(`  Total time:      ${elapsed}s`);
console.log('  ────────────────────────────────────────────\n');

// Exit with error code if any critical tasks failed
// (R2 upload failure doesn't count)
if (tasksFailed > 0) {
  console.error('⚠️  Some tasks failed. Check logs above.\n');
  process.exit(1);
} else {
  console.log('✅ All watchlist tasks completed successfully.\n');
  process.exit(0);
}
