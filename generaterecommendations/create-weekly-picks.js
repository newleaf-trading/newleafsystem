#!/usr/bin/env node
/**
 * create-weekly-picks.js
 *
 * Bundles this week's published tiles into a weeklyPicks document in Firestore.
 * React app serves the /picks route dynamically from Firestore data.
 *
 * Usage:
 *   node create-weekly-picks.js                    # current week
 *   node create-weekly-picks.js --week 2026-W16    # specific week
 *   node create-weekly-picks.js --theme "IV elevated — premium selling favoured"
 *   node create-weekly-picks.js --dry-run           # preview without writing
 *
 * What it does:
 *   1. Reads active tiles from Firestore (published this week)
 *   2. Creates/updates weeklyPicks/{weekId} document
 *   3. Generates PDF reports for each pick (calls generate-report.py)
 *   4. Generates video scripts for each pick (calls generate-script.py)
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import { config as loadEnv } from 'dotenv';

loadEnv();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Config ───────────────────────────────────────────────────────────────────
const SA_PATH = resolve(__dirname, process.env.GOOGLE_APPLICATION_CREDENTIALS || './serviceAccountKey.json');
const DRY_RUN = process.argv.includes('--dry-run');
const GENERATE_PDF = process.argv.includes('--pdf');
const GENERATE_VIDEO = process.argv.includes('--video');

function getFlag(name) {
  const idx = process.argv.indexOf('--' + name);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : null;
}

// ISO week calculation
function getISOWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function getWeekDateRange(weekId) {
  const [year, wStr] = weekId.split('-W');
  const jan1 = new Date(Date.UTC(parseInt(year), 0, 1));
  const dayOfWeek = jan1.getUTCDay() || 7;
  const mondayOfWeek1 = new Date(jan1);
  mondayOfWeek1.setUTCDate(jan1.getUTCDate() + (1 - dayOfWeek));
  const monday = new Date(mondayOfWeek1);
  monday.setUTCDate(mondayOfWeek1.getUTCDate() + (parseInt(wStr) - 1) * 7);
  const friday = new Date(monday);
  friday.setUTCDate(monday.getUTCDate() + 4);
  const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return { monday, friday, label: `${fmt(monday)} — ${fmt(friday)}` };
}

// ── Firebase ─────────────────────────────────────────────────────────────────
admin.initializeApp({
  projectId: 'newleaf-trading',
  credential: admin.credential.cert(JSON.parse(readFileSync(SA_PATH, 'utf-8')))
});
const db = admin.firestore();
db.settings({ databaseId: 'newleafdb' });

// ── Main ─────────────────────────────────────────────────────────────────────
async function createWeeklyPicks() {
  const weekId = getFlag('week') || getISOWeek();
  const theme = getFlag('theme') || 'Options strategies selected by NewLeaf scoring engine';
  const { monday, friday, label: dateRange } = getWeekDateRange(weekId);

  console.log(`\n  📋 CREATE WEEKLY PICKS — ${weekId}`);
  console.log(`  ────────────────────────────────────────`);
  console.log(`  Week:   ${dateRange}`);
  console.log(`  Theme:  ${theme}`);
  console.log(`  Mode:   ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`  ────────────────────────────────────────\n`);

  // Step 1: Get active tiles from Firestore
  console.log('  Fetching active tiles...');
  const snap = await db.collection('tiles')
    .where('isActive', '==', true)
    .get();

  // Filter to tiles published this week (or sourced from strategy-builder)
  const allTiles = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Prefer strategy-builder tiles (manually curated), fall back to all active
  let picks = allTiles.filter(t => t.source === 'strategy-builder');
  if (picks.length === 0) {
    // Use top-scoring tiles from any source
    picks = allTiles
      .filter(t => t.maxProfit > 0 && t.legs && t.legs.length > 0)
      .sort((a, b) => (b.rewardRisk || 0) - (a.rewardRisk || 0))
      .slice(0, 8);
  }

  console.log(`  Found ${allTiles.length} active tiles, ${picks.length} selected for picks\n`);

  if (picks.length === 0) {
    console.log('  ⚠️  No picks available. Publish tiles from strategy-builder first.\n');
    process.exit(0);
  }

  // Show picks
  picks.forEach((t, i) => {
    const rr = t.rewardRisk ? t.rewardRisk.toFixed(2) + '×' : '—';
    const pop = t.oddsOfProfit ? t.oddsOfProfit + '%' : '—';
    console.log(`  ${i + 1}. ${(t.symbol || '').padEnd(6)} ${(t.strategy || '').padEnd(22)} R:R ${rr.padEnd(8)} PoP ${pop}`);
  });

  // Step 2: Create weeklyPicks document
  const weekDoc = {
    weekId,
    dateRange,
    publishedAt: admin.firestore.FieldValue.serverTimestamp(),
    theme,
    status: 'current',
    tileIds: picks.map(t => t.id),
    tileCount: picks.length,
    picks: picks.map(t => ({
      tileId: t.id,
      symbol: t.symbol,
      strategy: t.strategy,
      strategyCode: t.strategyCode,
      direction: t.direction,
      price: t.price || t.underlyingPrice,
      maxProfit: t.maxProfit,
      maxLoss: t.maxLoss,
      rewardRisk: t.rewardRisk,
      oddsOfProfit: t.oddsOfProfit,
      expiry: t.expiry,
      dte: t.dte,
      confidence: t.confidence
    }))
  };

  if (!DRY_RUN) {
    // Mark previous weeks as 'past'
    const prevWeeks = await db.collection('weeklyPicks')
      .where('status', '==', 'current')
      .get();
    const batch = db.batch();
    prevWeeks.docs.forEach(doc => {
      if (doc.id !== weekId) {
        batch.update(doc.ref, { status: 'past' });
      }
    });
    batch.set(db.collection('weeklyPicks').doc(weekId), weekDoc);
    await batch.commit();
    console.log(`\n  ✓ weeklyPicks/${weekId} written to Firestore (no HTML — React app serves picks dynamically)`);
  } else {
    console.log(`\n  [DRY RUN] Would write weeklyPicks/${weekId} to Firestore`);
  }

  // Step 3: Optionally generate PDFs + video scripts
  if (GENERATE_PDF) {
    console.log('\n  Generating PDF reports...');
    for (const pick of picks) {
      try {
        execSync(`python3 generate-report.py ${pick.symbol}`, { cwd: __dirname, stdio: 'pipe' });
        console.log(`  ✓ ${pick.symbol} PDF`);
      } catch (e) {
        console.log(`  ✗ ${pick.symbol} PDF failed: ${e.message}`);
      }
    }
  }

  if (GENERATE_VIDEO) {
    console.log('\n  Generating video scripts...');
    for (const pick of picks) {
      try {
        execSync(`python3 generate-script.py ${pick.symbol}`, { cwd: __dirname, stdio: 'pipe' });
        console.log(`  ✓ ${pick.symbol} video script`);
      } catch (e) {
        console.log(`  ✗ ${pick.symbol} video script failed: ${e.message}`);
      }
    }
  }

  console.log(`\n  ────────────────────────────────────────`);
  console.log(`  ✅ Weekly picks created — ${picks.length} recommendations`);
  console.log(`  ────────────────────────────────────────\n`);
}

// ── Run ──────────────────────────────────────────────────────────────────────
createWeeklyPicks()
  .then(() => process.exit(0))
  .catch(err => { console.error('Fatal:', err); process.exit(1); });
