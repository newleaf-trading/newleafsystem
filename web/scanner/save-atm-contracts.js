/**
 * save-atm-contracts.js — Extract and save ATM contracts (±25%) to R2
 * ─────────────────────────────────────────────────────────────────────────────
 * Usage: Called by newleaf-pipeline.js during daily runs
 * 
 * Saves contracts in ATM region (±25% from spot) for strategy builder
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

// ── Constants ─────────────────────────────────────────────────────────────────
const ATM_RANGE = 0.25; // ±25% from spot

// ── Load Config ───────────────────────────────────────────────────────────────
function loadConfig() {
  const CONFIG_FILE = path.join(__dirname, 'config.json');
  if (!fs.existsSync(CONFIG_FILE)) {
    throw new Error(`config.json not found at ${CONFIG_FILE}`);
  }
  return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
}

// ── Create R2 Client ──────────────────────────────────────────────────────────
function createR2Client(config) {
  return new S3Client({
    region: 'auto',
    endpoint: config.r2.endpoint,
    credentials: {
      accessKeyId: config.r2.accessKeyId,
      secretAccessKey: config.r2.secretAccessKey
    }
  });
}

// ── Upload to R2 ──────────────────────────────────────────────────────────────
async function uploadToR2(r2Client, bucket, key, content) {
  await r2Client.send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: content,
    ContentType: 'application/json',
    CacheControl: 'public, max-age=300'
  }));
}

// ── Extract ATM Contracts ─────────────────────────────────────────────────────
function extractATMContracts(allContracts, spot) {
  // Filter to ATM region (±25%)
  const atmContracts = allContracts.filter(c => {
    const distanceFromSpot = Math.abs(c.strike - spot) / spot;
    return distanceFromSpot <= ATM_RANGE;
  });
  
  return atmContracts;
}

// ── Group Contracts by Expiry ─────────────────────────────────────────────────
function groupByExpiry(contracts) {
  const grouped = {};
  
  for (const c of contracts) {
    if (!grouped[c.expiry]) {
      grouped[c.expiry] = {
        expiry: c.expiry,
        dte: c.dte,
        contracts: []
      };
    }
    
    grouped[c.expiry].contracts.push({
      strike: c.strike,
      type: c.type,
      bid: c.bid || 0,
      ask: c.ask || 0,
      mid: c.mid || (c.bid + c.ask) / 2,
      last: c.last || 0,
      iv: c.iv || 0,
      delta: c.delta || 0,
      gamma: c.gamma || 0,
      theta: c.theta || 0,
      vega: c.vega || 0,
      oi: c.openInterest || 0,
      volume: c.volume || 0
    });
  }
  
  return Object.values(grouped);
}

// ── Save ATM Contracts ────────────────────────────────────────────────────────
async function saveATMContracts(symbol, allContracts, spot, date) {
  const config = loadConfig();
  const r2Client = createR2Client(config);
  
  // Filter to ATM region
  const atmContracts = extractATMContracts(allContracts, spot);
  
  if (!atmContracts.length) {
    console.log(`  ⚠️  No ATM contracts found for ${symbol}`);
    return;
  }
  
  // Group by expiry
  const expiries = groupByExpiry(atmContracts);
  
  // Build data structure
  const data = {
    date,
    symbol,
    spot: +spot.toFixed(2),
    atmRange: ATM_RANGE,
    strikeRange: {
      min: +(spot * (1 - ATM_RANGE)).toFixed(2),
      max: +(spot * (1 + ATM_RANGE)).toFixed(2)
    },
    expiries: expiries.sort((a, b) => a.dte - b.dte),
    metadata: {
      fetchedAt: new Date().toISOString(),
      dataSource: 'IB Gateway + Yahoo OI',
      contractCount: atmContracts.length
    }
  };
  
  // Save to local file
  const REPORTS_DIR = path.join(__dirname, 'reports');
  const contractsDir = path.join(REPORTS_DIR, symbol, 'contracts');
  fs.mkdirSync(contractsDir, { recursive: true });
  
  const localPath = path.join(contractsDir, `atm-${date}.json`);
  fs.writeFileSync(localPath, JSON.stringify(data, null, 2));

  // Also save as "latest" locally
  const localLatestPath = path.join(contractsDir, 'atm-latest.json');
  fs.writeFileSync(localLatestPath, JSON.stringify(data, null, 2));

  // Upload to R2
  const r2Key = `reports/${symbol}/contracts/atm-${date}.json`;
  await uploadToR2(r2Client, config.r2.bucket, r2Key, JSON.stringify(data));

  // Also save as "latest" on R2
  const latestKey = `reports/${symbol}/contracts/atm-latest.json`;
  await uploadToR2(r2Client, config.r2.bucket, latestKey, JSON.stringify(data));
  
  console.log(`  ✓ Saved ATM contracts: ${atmContracts.length} (${expiries.length} expiries)`);
  
  return data;
}

module.exports = { saveATMContracts, extractATMContracts };
