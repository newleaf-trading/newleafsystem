#!/usr/bin/env node
/**
 * close-week.js
 *
 * Friday routine: close out the week's picks, calculate actual P&L,
 * and update Firestore with review data (React app serves the review page).
 *
 * Usage:
 *   node close-week.js                    # current week
 *   node close-week.js --week 2026-W16
 *   node close-week.js --dry-run
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { config as loadEnv } from 'dotenv';

loadEnv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SA_PATH = resolve(__dirname, process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccountKey.json');
const DRY_RUN = process.argv.includes('--dry-run');

function getFlag(name) {
  const idx = process.argv.indexOf('--' + name);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : null;
}

function getISOWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

admin.initializeApp({
  projectId: 'newleaf-trading',
  credential: admin.credential.cert(JSON.parse(readFileSync(SA_PATH, 'utf-8')))
});
const db = admin.firestore();
db.settings({ databaseId: 'newleafdb' });

async function closeWeek() {
  const weekId = getFlag('week') || getISOWeek();

  console.log(`\n  📊 CLOSE WEEK — ${weekId}`);
  console.log(`  ────────────────────────────────────────`);
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`  ────────────────────────────────────────\n`);

  // Get the weeklyPicks doc
  const weekDoc = await db.collection('weeklyPicks').doc(weekId).get();
  if (!weekDoc.exists) {
    console.log(`  ⚠️  No weeklyPicks/${weekId} found. Run create-weekly-picks.js first.\n`);
    process.exit(1);
  }

  const weekData = weekDoc.data();
  const tileIds = weekData.tileIds || [];
  console.log(`  Found ${tileIds.length} picks for ${weekId}\n`);

  // Fetch each tile and compute results
  const results = [];
  let totalPnl = 0;
  let wins = 0;
  let losses = 0;

  for (const tileId of tileIds) {
    const tileDoc = await db.collection('tiles').doc(tileId).get();
    if (!tileDoc.exists) {
      console.log(`  ⚠️  Tile ${tileId} not found, skipping`);
      continue;
    }
    const tile = tileDoc.data();

    // Calculate P&L based on current status
    // For now: use maxProfit as the "target" and estimate based on DTE
    // In production: fetch live prices and compare entry vs current
    const status = tile.status || (tile.isActive ? 'active' : 'closed');
    const actualPnl = tile.actualPnl || 0;
    const result = {
      tileId,
      symbol: tile.symbol,
      strategy: tile.strategy,
      direction: tile.direction,
      entryCredit: tile.netCredit || tile.entryCredit || 0,
      maxProfit: tile.maxProfit || 0,
      maxLoss: tile.maxLoss || 0,
      actualPnl,
      status,
      expiry: tile.expiry
    };

    if (actualPnl > 0) wins++;
    else if (actualPnl < 0) losses++;
    totalPnl += actualPnl;
    results.push(result);

    console.log(`  ${actualPnl >= 0 ? '✓' : '✗'} ${tile.symbol.padEnd(6)} ${(tile.strategy || '').padEnd(22)} P&L: $${actualPnl.toFixed(2)}  [${status}]`);
  }

  const winRate = results.length > 0 ? `${wins}/${results.length}` : '0/0';

  // Build review object
  const review = {
    totalPnl: Math.round(totalPnl * 100) / 100,
    winRate,
    wins,
    losses,
    neutral: results.length - wins - losses,
    results,
    closedAt: admin.firestore.FieldValue.serverTimestamp(),
    summary: `Week ${weekId}: ${results.length} trades, ${winRate} wins, $${totalPnl.toFixed(2)} total P&L`
  };

  if (!DRY_RUN) {
    // Update weeklyPicks doc with review + mark as past
    await db.collection('weeklyPicks').doc(weekId).update({
      status: 'past',
      review,
      closedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Deactivate the tiles
    const batch = db.batch();
    for (const tileId of tileIds) {
      batch.update(db.collection('tiles').doc(tileId), {
        isActive: false,
        status: 'closed',
        closedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    await batch.commit();
    console.log(`\n  ✓ Tiles deactivated, weeklyPicks/${weekId} marked as past (no HTML — React app serves review dynamically)`);
  }

  console.log(`\n  ────────────────────────────────────────`);
  console.log(`  ✅ Week ${weekId} closed`);
  console.log(`  📊 ${results.length} trades · ${winRate} wins · $${totalPnl.toFixed(2)} P&L`);
  console.log(`  ────────────────────────────────────────\n`);
}

closeWeek()
  .then(() => process.exit(0))
  .catch(err => { console.error('Fatal:', err); process.exit(1); });
