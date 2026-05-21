#!/usr/bin/env node
/**
 * Upload a single file to R2
 * Usage: node upload-to-r2.js <local-path> [r2-key]
 *   local-path: path relative to scanner dir (e.g. reports/watchlist-snapshots.json)
 *   r2-key:     optional R2 key (defaults to local-path)
 */

const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

const CONFIG_FILE = path.join(__dirname, 'config.json');

const localPath = process.argv[2];
if (!localPath) {
  console.error('Usage: node upload-to-r2.js <local-path> [r2-key]');
  process.exit(1);
}

const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));

const r2Client = new S3Client({
  region: 'auto',
  endpoint: config.r2.endpoint,
  credentials: {
    accessKeyId: config.r2.accessKeyId,
    secretAccessKey: config.r2.secretAccessKey
  }
});

const fullPath = path.resolve(__dirname, localPath);
if (!fs.existsSync(fullPath)) {
  console.error(`File not found: ${fullPath}`);
  process.exit(1);
}

const r2Key = process.argv[3] || localPath;
const content = fs.readFileSync(fullPath);

async function upload() {
  await r2Client.send(new PutObjectCommand({
    Bucket: config.r2.bucket,
    Key: r2Key,
    Body: content,
    ContentType: 'application/json',
    CacheControl: 'public, max-age=300'
  }));
  console.log(`  ✓ Uploaded ${localPath} → R2:${r2Key}`);
}

upload().catch(err => {
  console.error(`Failed to upload ${localPath}:`, err.message);
  process.exit(1);
});
