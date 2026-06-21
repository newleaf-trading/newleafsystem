'use strict';

const fs   = require('fs');
const path = require('path');

const REPORTS_DIR = path.join(__dirname, 'reports');

/**
 * Save ATM contracts snapshot for the strategy builder.
 * Groups flat contract array into { spot, expiries: [{ expiry, dte, contracts }] }
 * and writes to reports/{symbol}/contracts/atm-latest.json (local + R2).
 */
async function saveATMContracts(symbol, allContracts, spot, date, cfg) {
  if (!allContracts || !allContracts.length) return;

  // Group by expiry
  const expiryMap = {};
  for (const c of allContracts) {
    const key = c.expiry;
    if (!key) continue;
    if (!expiryMap[key]) expiryMap[key] = { expiry: key, dte: c.dte || 0, contracts: [] };
    expiryMap[key].contracts.push({
      strike:  c.strike,
      type:    c.type,
      bid:     c.bid    || 0,
      ask:     c.ask    || 0,
      mid:     c.mid    || +((( c.bid || 0) + (c.ask || 0)) / 2).toFixed(3),
      last:    c.last   || 0,
      iv:      c.iv     || 0,
      delta:   c.delta  || null,
      gamma:   c.gamma  || null,
      theta:   c.theta  || null,
      vega:    c.vega   || null,
      oi:      c.openInterest || c.oi || 0,
      volume:  c.volume || 0,
    });
  }

  const expiries = Object.values(expiryMap).sort((a, b) => a.dte - b.dte);
  if (!expiries.length) return;

  // ATM range: strikes within 5% of spot
  const atmRange = spot > 0 ? { lo: +(spot * 0.95).toFixed(2), hi: +(spot * 1.05).toFixed(2) } : null;
  const allStrikes = allContracts.map(c => c.strike);
  const strikeRange = { min: Math.min(...allStrikes), max: Math.max(...allStrikes) };

  const payload = {
    date,
    symbol,
    spot,
    atmRange,
    strikeRange,
    expiries,
    metadata: {
      totalContracts: allContracts.length,
      expiryCount: expiries.length,
      generatedAt: new Date().toISOString(),
    },
  };

  const body = JSON.stringify(payload);

  // Save locally
  const contractsDir = path.join(REPORTS_DIR, symbol, 'contracts');
  fs.mkdirSync(contractsDir, { recursive: true });
  fs.writeFileSync(path.join(contractsDir, 'atm-latest.json'), body);

  // Upload to R2
  if (cfg?.r2?.accountId) {
    const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
    const client = new S3Client({
      region: 'auto',
      endpoint: cfg.r2.endpoint,
      credentials: { accessKeyId: cfg.r2.accessKeyId, secretAccessKey: cfg.r2.secretAccessKey },
    });
    await client.send(new PutObjectCommand({
      Bucket: cfg.r2.bucket,
      Key: `reports/${symbol}/contracts/atm-latest.json`,
      Body: body,
      ContentType: 'application/json',
      CacheControl: 'public, max-age=300',
    }));
  }
}

module.exports = { saveATMContracts };
