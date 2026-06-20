#!/usr/bin/env node
/**
 * weekly-premium-snapshot.js — Canonical Weekly Premium Snapshot Writer
 * ─────────────────────────────────────────────────────────────────────
 * Sole writer for the canonical weekly premium snapshot. Runs every Friday
 * at 4:30pm ET via cron in pipeline/index.js.
 *
 * Reads latest pipeline reports for all 111 watchlist symbols and writes:
 *   1. watchlist/premium-snapshots/{isoYear}-W{isoWeek}.json  (one per week, idempotent)
 *   2. watchlist/premium-series/{SYMBOL}.json                 (per-symbol time series)
 *
 * Usage:
 *   node weekly-premium-snapshot.js              # auto-detect current ISO week
 *   node weekly-premium-snapshot.js --week 2026-W22   # override week
 *   node weekly-premium-snapshot.js --dry-run         # no R2 upload
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const PIPELINE_DIR = path.resolve(__dirname, '..', 'pipeline');

// Resolve @aws-sdk/client-s3 from pipeline's node_modules
const pipelineRequire = createRequire(path.join(PIPELINE_DIR, 'index.js'));
const { S3Client, PutObjectCommand } = pipelineRequire('@aws-sdk/client-s3');
const REPORTS_DIR = path.join(PIPELINE_DIR, 'reports');
const CONFIG_PATH = path.join(PIPELINE_DIR, 'config.json');

// ── ISO week helpers ─────────────────────────────────────────────────────────

function getISOWeek(date = new Date()) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // Thursday of current week determines the ISO year
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d - jan4) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
  return { year: d.getFullYear(), week: weekNum };
}

function isoWeekString(date = new Date()) {
  const { year, week } = getISOWeek(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}

// ── Date helpers ─────────────────────────────────────────────────────────────

function calcDTE(isoDate) {
  const exp = new Date(isoDate); exp.setHours(0, 0, 0, 0);
  const now = new Date();        now.setHours(0, 0, 0, 0);
  return Math.round((exp - now) / 86400000);
}

function annualize(pct, dte) {
  if (!pct || !dte || dte <= 0) return null;
  return +(pct * (365 / dte)).toFixed(1);
}

// ── R2 helpers ───────────────────────────────────────────────────────────────

function makeR2Client(cfg) {
  return new S3Client({
    region: 'auto',
    endpoint: cfg.r2.endpoint,
    credentials: {
      accessKeyId: cfg.r2.accessKeyId,
      secretAccessKey: cfg.r2.secretAccessKey,
    },
  });
}

async function uploadToR2(client, bucket, key, body) {
  await client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: typeof body === 'string' ? body : JSON.stringify(body),
    ContentType: 'application/json',
    CacheControl: 'public, max-age=300',
  }));
  console.log(`  [R2] uploaded: ${key}`);
}

async function readFromR2(cfg, key) {
  try {
    const url = `${cfg.r2.publicBaseUrl}/${key}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

// ── Extract premium data for one symbol ──────────────────────────────────────

function extractSymbolData(symbol) {
  const latestPath = path.join(REPORTS_DIR, symbol, 'latest.json');
  if (!fs.existsSync(latestPath)) return null;

  try {
    const report = JSON.parse(fs.readFileSync(latestPath, 'utf8'));
    const spot = report.snapshot?.price;
    const atmIv = report.gammaData?.ivData?.atmIv;
    if (!spot) return null;

    // Read premium history for latest weekly + monthly entries
    const premHistPath = path.join(REPORTS_DIR, symbol, 'history', 'premium.json');
    let weeklyEntry = null, monthlyEntry = null;

    if (fs.existsSync(premHistPath)) {
      const premHist = JSON.parse(fs.readFileSync(premHistPath, 'utf8'));
      // Get latest of each type, excluding DTE=0 entries
      for (let i = premHist.length - 1; i >= 0; i--) {
        const e = premHist[i];
        if (!weeklyEntry && e.expiryType === 'weekly' && calcDTE(e.expiry) >= 1) {
          weeklyEntry = e;
        }
        if (!monthlyEntry && e.expiryType === 'monthly' && calcDTE(e.expiry) >= 1) {
          monthlyEntry = e;
        }
        if (weeklyEntry && monthlyEntry) break;
      }
    }

    const result = {
      stockPrice: +spot.toFixed(2),
      iv: atmIv ? +atmIv.toFixed(1) : null,
    };

    if (weeklyEntry) {
      const dte = calcDTE(weeklyEntry.expiry);
      result.weekly = {
        expiry: weeklyEntry.expiry,
        dte,
        callMid: weeklyEntry.callMid,
        callPct: +weeklyEntry.callPct.toFixed(3),
        putMid: weeklyEntry.putMid,
        putPct: +weeklyEntry.putPct.toFixed(3),
        callPctAnnual: annualize(weeklyEntry.callPct, dte),
        putPctAnnual: annualize(weeklyEntry.putPct, dte),
      };
    }

    if (monthlyEntry) {
      const dte = calcDTE(monthlyEntry.expiry);
      result.monthly = {
        expiry: monthlyEntry.expiry,
        dte,
        callMid: monthlyEntry.callMid,
        callPct: +monthlyEntry.callPct.toFixed(3),
        putMid: monthlyEntry.putMid,
        putPct: +monthlyEntry.putPct.toFixed(3),
        callPctAnnual: annualize(monthlyEntry.callPct, dte),
        putPctAnnual: annualize(monthlyEntry.putPct, dte),
      };
    }

    return result;
  } catch (err) {
    console.warn(`  [${symbol}] Error reading report: ${err.message}`);
    return null;
  }
}

// ── Update per-symbol time series ────────────────────────────────────────────

async function updateSymbolSeries(cfg, client, symbol, weekStr, symData) {
  const key = `watchlist/premium-series/${symbol}.json`;
  const existing = await readFromR2(cfg, key);
  const points = existing?.points || [];

  // Build this week's data point
  const point = {
    isoWeek: weekStr,
    stockPrice: symData.stockPrice,
    iv: symData.iv,
    weeklyCallPct: symData.weekly?.callPct ?? null,
    weeklyPutPct: symData.weekly?.putPct ?? null,
    monthlyCallPct: symData.monthly?.callPct ?? null,
    monthlyPutPct: symData.monthly?.putPct ?? null,
  };

  // Upsert: replace if same week exists, else append
  const idx = points.findIndex(p => p.isoWeek === weekStr);
  if (idx >= 0) {
    points[idx] = point;
  } else {
    points.push(point);
  }

  // Keep last 52 weeks
  const trimmed = points.slice(-52);

  const series = { symbol, updatedAt: new Date().toISOString(), points: trimmed };
  await uploadToR2(client, cfg.r2.bucket, key, series);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const weekOverride = args.find((_, i, a) => a[i - 1] === '--week');
  const weekStr = weekOverride || isoWeekString();

  console.log(`\n╔══════════════════════════════════════════════════════════╗`);
  console.log(`║    Canonical Weekly Premium Snapshot                     ║`);
  console.log(`╚══════════════════════════════════════════════════════════╝`);
  console.log(`  ISO week:  ${weekStr}`);
  console.log(`  Dry run:   ${dryRun}`);
  console.log(`  Time:      ${new Date().toISOString()}`);
  console.log('');

  // Load pipeline config
  const cfg = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  const watchlist = cfg.watchlist || [];
  console.log(`  Watchlist: ${watchlist.length} symbols`);

  // Extract premium data for all symbols
  const symbols = {};
  let okCount = 0;

  for (const sym of watchlist) {
    const data = extractSymbolData(sym);
    if (data) {
      symbols[sym] = data;
      okCount++;
    }
  }

  console.log(`  Extracted: ${okCount}/${watchlist.length} symbols`);
  if (okCount === 0) {
    console.error('\n  No data extracted — aborting.');
    process.exit(1);
  }

  // Build canonical snapshot
  const snapshot = {
    isoWeek: weekStr,
    capturedAt: new Date().toISOString(),
    symbolCount: okCount,
    symbols,
  };

  const snapshotKey = `watchlist/premium-snapshots/${weekStr}.json`;
  const snapshotJson = JSON.stringify(snapshot, null, 2);

  console.log(`\n  Snapshot key: ${snapshotKey}`);
  console.log(`  Payload:      ${(snapshotJson.length / 1024).toFixed(1)} KB`);

  if (dryRun) {
    console.log('\n  [DRY RUN] Skipping R2 upload.');
    // Write locally for inspection
    const localDir = path.join(REPORTS_DIR, 'watchlist');
    fs.mkdirSync(localDir, { recursive: true });
    fs.writeFileSync(path.join(localDir, `${weekStr}.json`), snapshotJson);
    console.log(`  Saved locally: reports/watchlist/${weekStr}.json`);
    return;
  }

  if (!cfg.r2?.accountId) {
    console.error('\n  No R2 credentials in config.json — aborting.');
    process.exit(1);
  }

  const client = makeR2Client(cfg);

  // 1. Upload canonical snapshot
  await uploadToR2(client, cfg.r2.bucket, snapshotKey, snapshotJson);

  // 2. Update per-symbol time series (batch to avoid R2 rate limits)
  console.log(`\n  Updating per-symbol series...`);
  const batchSize = 10;
  const syms = Object.keys(symbols);
  for (let i = 0; i < syms.length; i += batchSize) {
    const batch = syms.slice(i, i + batchSize);
    await Promise.all(
      batch.map(sym => updateSymbolSeries(cfg, client, sym, weekStr, symbols[sym]))
    );
    if (i + batchSize < syms.length) {
      process.stdout.write(`  ${i + batchSize}/${syms.length}...`);
    }
  }

  console.log(`\n\n  Done. ${okCount} symbols captured for ${weekStr}.`);
}

main().catch(err => {
  console.error('\nFATAL:', err.message);
  console.error(err.stack);
  process.exit(1);
});
