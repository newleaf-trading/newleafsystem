#!/usr/bin/env node
/**
 * save-watchlist-snapshot.js
 *
 * Saves premium watchlist snapshot to R2
 * Usage: node save-watchlist-snapshot.js [weekly|monthly] [date-override]
 *
 * Reads latest.json for all watchlist symbols, extracts premium data,
 * appends to reports/watchlist-snapshots.json in R2
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');

const REPORTS_DIR = path.join(__dirname, 'reports');
const SNAPSHOTS_FILE = 'watchlist-snapshots.json';

async function loadConfig() {
  const configPath = path.join(__dirname, 'config.json');
  return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

async function readR2Snapshots(cfg) {
  if (!cfg.r2?.publicBaseUrl) {
    console.log('[R2] No R2 config, using empty snapshots');
    return { updatedAt: new Date().toISOString(), snapshots: [] };
  }

  try {
    const url = `${cfg.r2.publicBaseUrl}/reports/${SNAPSHOTS_FILE}`;
    console.log(`[R2] Fetching existing snapshots from: ${url}`);

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!res.ok) {
      if (res.status === 404) {
        console.log('[R2] No existing snapshots found, creating new');
        return { updatedAt: new Date().toISOString(), snapshots: [] };
      }
      throw new Error(`HTTP ${res.status}`);
    }

    const data = await res.json();
    console.log(`[R2] Loaded ${data.snapshots?.length || 0} existing snapshots`);
    return data;
  } catch (err) {
    console.warn('[R2] Failed to load existing snapshots:', err.message);
    return { updatedAt: new Date().toISOString(), snapshots: [] };
  }
}

function getNextFriday() {
  const now = new Date();
  const day = now.getDay();
  let daysToAdd;

  if (day === 5) daysToAdd = 7;
  else if (day === 6) daysToAdd = 6;
  else daysToAdd = (5 - day);

  const nextFri = new Date(now);
  nextFri.setDate(now.getDate() + daysToAdd);

  const y = nextFri.getFullYear();
  const m = String(nextFri.getMonth() + 1).padStart(2, '0');
  const d = String(nextFri.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function getThirdFriday(offsetMonths = 0) {
  const now = new Date();
  let year = now.getFullYear();
  let month = now.getMonth() + offsetMonths;

  if (month > 11) {
    year += Math.floor(month / 12);
    month = month % 12;
  }

  let date = new Date(year, month, 1, 12, 0, 0);
  let fridayCount = 0;

  while (fridayCount < 3) {
    if (date.getDay() === 5) {
      fridayCount++;
      if (fridayCount === 3) break;
    }
    date.setDate(date.getDate() + 1);
  }

  // If the 3rd Friday has already passed, use next month
  if (offsetMonths === 0 && date < now) {
    return getThirdFriday(1); // Recursive call with next month
  }

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

async function extractPremiumData(symbol, expiry) {
  const latestPath = path.join(REPORTS_DIR, symbol, 'latest.json');

  if (!fs.existsSync(latestPath)) {
    console.warn(`[${symbol}] latest.json not found`);
    return null;
  }

  try {
    const report = JSON.parse(fs.readFileSync(latestPath, 'utf8'));

    // Extract basic data
    const spot = report.snapshot?.price;
    const iv = report.gammaData?.ivData?.atmIv;

    if (!spot || !iv) {
      console.warn(`[${symbol}] Missing spot=${spot} or iv=${iv}`);
      return null;
    }

    // Try to find ATM strike from gamma analysis
    const topStrikes = report.gammaData?.analysis?.topStrikes || [];
    const atmStrike = topStrikes
      .sort((a, b) => Math.abs(a.strike - spot) - Math.abs(b.strike - spot))[0]?.strike
      || Math.round(spot);

    // Check if we have premium history for this expiry
    const premiumHistoryPath = path.join(REPORTS_DIR, symbol, 'history', 'premium.json');
    let callMid = null, putMid = null, callPct = null, putPct = null;

    if (fs.existsSync(premiumHistoryPath)) {
      const premiumHistory = JSON.parse(fs.readFileSync(premiumHistoryPath, 'utf8'));
      const match = premiumHistory.find(p => p.expiry === expiry);

      if (match) {
        callMid = match.callMid;
        putMid = match.putMid;
        callPct = match.callPct;
        putPct = match.putPct;
      }
    }

    return {
      stockPrice: spot,
      atmStrike,
      callMid,
      putMid,
      callPct,
      putPct,
      iv,
      changePercent: report.snapshot?.changePercent || null
    };
  } catch (err) {
    console.error(`[${symbol}] Error reading latest.json:`, err.message);
    return null;
  }
}

async function uploadToR2(cfg, key, body) {
  if (!cfg.r2?.accountId) {
    console.log('[R2] No R2 credentials, skipping upload');
    return false;
  }

  try {
    const client = new S3Client({
      region: 'auto',
      endpoint: cfg.r2.endpoint,
      credentials: {
        accessKeyId: cfg.r2.accessKeyId,
        secretAccessKey: cfg.r2.secretAccessKey
      }
    });

    await client.send(new PutObjectCommand({
      Bucket: cfg.r2.bucket,
      Key: key,
      Body: typeof body === 'string' ? body : JSON.stringify(body),
      ContentType: 'application/json',
      CacheControl: 'public, max-age=300'
    }));

    console.log(`[R2] ✓ Uploaded: ${key}`);
    return true;
  } catch (err) {
    console.error(`[R2] Upload failed for ${key}:`, err.message);
    return false;
  }
}

async function saveSnapshot(expiryType = 'weekly', dateOverride = null) {
  console.log(`\n=== Watchlist Snapshot Generator ===`);
  console.log(`Expiry Type: ${expiryType}`);

  const cfg = await loadConfig();
  const date = dateOverride || new Date().toISOString().split('T')[0];

  // FIXED: Discover actual expiry from premium.json filtered by expiryType
  // This ensures we use the same expiry that the pipeline generated
  let discoveredExpiry = null;

  // Try multiple symbols to find one with the desired expiryType in premium history
  const sampleSymbols = ['AAPL', 'MSFT', 'NVDA', ...cfg.watchlist.slice(0, 10)];

  for (const sampleSymbol of sampleSymbols) {
    const premiumHistoryPath = path.join(REPORTS_DIR, sampleSymbol, 'history', 'premium.json');

    if (fs.existsSync(premiumHistoryPath)) {
      try {
        const premiumHistory = JSON.parse(fs.readFileSync(premiumHistoryPath, 'utf8'));
        if (premiumHistory.length > 0) {
          // Filter by expiryType and get the latest entry
          const matchingEntries = premiumHistory.filter(p => p.expiryType === expiryType);
          if (matchingEntries.length > 0) {
            discoveredExpiry = matchingEntries[matchingEntries.length - 1].expiry;
            console.log(`[Expiry] Discovered ${expiryType} expiry from ${sampleSymbol}: ${discoveredExpiry}`);
            break; // Found it, stop searching
          }
        }
      } catch (err) {
        // Continue to next symbol
      }
    }
  }

  if (!discoveredExpiry) {
    console.warn(`[Expiry] No ${expiryType} entries found in premium history, will use calculation`);
  }

  // Fallback to calculation if discovery fails
  const expiry = discoveredExpiry || (expiryType === 'weekly' ? getNextFriday() : getThirdFriday());

  console.log(`Date: ${date}`);
  console.log(`Expiry: ${expiry}`);
  console.log(`Symbols: ${cfg.watchlist.length}`);

  // Extract premium data for all symbols
  const tickers = {};
  let successCount = 0;

  for (const symbol of cfg.watchlist) {
    const data = await extractPremiumData(symbol, expiry);
    if (data) {
      tickers[symbol] = data;
      successCount++;
    }
  }

  console.log(`\nExtracted: ${successCount}/${cfg.watchlist.length} symbols`);

  if (successCount === 0) {
    console.error('No data extracted, aborting');
    process.exit(1);
  }

  // Read existing snapshots from R2
  const existing = await readR2Snapshots(cfg);

  // Create new snapshot
  const newSnapshot = {
    date,
    savedAt: new Date().toISOString(),
    expiryType,
    expiry,
    count: successCount,
    tickers
  };

  // Append and dedupe (keep last 90 days)
  const updated = {
    updatedAt: new Date().toISOString(),
    snapshots: [
      ...existing.snapshots.filter(s => !(s.date === date && s.expiryType === expiryType)),
      newSnapshot
    ].slice(-90)
  };

  console.log(`\nTotal snapshots: ${updated.snapshots.length} (last 90 days)`);

  // Save locally
  const localPath = path.join(REPORTS_DIR, SNAPSHOTS_FILE);
  fs.writeFileSync(localPath, JSON.stringify(updated, null, 2));
  console.log(`✓ Saved locally: ${localPath}`);

  // Upload to R2
  const uploaded = await uploadToR2(cfg, `reports/${SNAPSHOTS_FILE}`, updated);

  if (uploaded) {
    console.log(`\n✅ Snapshot saved successfully`);
    console.log(`   Date: ${date}`);
    console.log(`   Type: ${expiryType}`);
    console.log(`   Expiry: ${expiry}`);
    console.log(`   Tickers: ${successCount}`);
  } else {
    console.log(`\n⚠️  Snapshot saved locally only (R2 upload failed)`);
  }
}

// CLI
const expiryType = process.argv[2] || 'weekly';
const dateOverride = process.argv[3] || null;

if (!['weekly', 'monthly'].includes(expiryType)) {
  console.error('Usage: node save-watchlist-snapshot.js [weekly|monthly] [YYYY-MM-DD]');
  process.exit(1);
}

saveSnapshot(expiryType, dateOverride).catch(err => {
  console.error('\n❌ Failed:', err.message);
  console.error(err.stack);
  process.exit(1);
});
