'use strict';
/**
 * jobStatus.cjs — per-job success/failure tracking for the scheduler.
 * ─────────────────────────────────────────────────────────────────────────────
 * Every scheduled job records its outcome here (ok / failed / duration / error).
 * Persisted locally and uploaded to R2 (pipeline-status/jobs.json) so a workbench
 * page can show a live status table. The scheduler's monitor uses ranOkToday()/
 * ranOkThisWeek() to detect a missed daily/weekly job and re-run it.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const fs = require('fs');
const path = require('path');
let cfg = null; try { cfg = require('../config.json'); } catch (_) { /* no config in some contexts */ }

const LOCAL = path.join(__dirname, '..', '.jobs-status.json');

function read() {
  try { return JSON.parse(fs.readFileSync(LOCAL, 'utf8')); } catch (_) { return { updatedAt: null, jobs: {} }; }
}

function etDate() { return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); } // YYYY-MM-DD ET

function isoWeek() {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const wk = 1 + Math.round(((d - jan4) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(wk).padStart(2, '0')}`;
}

async function uploadR2(data) {
  if (!cfg || !cfg.r2 || !cfg.r2.accessKeyId) return;
  try {
    const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
    const client = new S3Client({ region: 'auto', endpoint: cfg.r2.endpoint, credentials: { accessKeyId: cfg.r2.accessKeyId, secretAccessKey: cfg.r2.secretAccessKey } });
    await client.send(new PutObjectCommand({
      Bucket: cfg.r2.bucket, Key: 'pipeline-status/jobs.json',
      Body: JSON.stringify(data), ContentType: 'application/json', CacheControl: 'public, max-age=60',
    }));
  } catch (e) { console.error('[jobStatus] R2 upload failed:', e.message); }
}

/** Record a job outcome. result = { ok, durationSec?, error?, meta? } */
async function record(name, result) {
  const data = read();
  data.jobs = data.jobs || {};
  const prev = data.jobs[name] || {};
  const nowISO = new Date().toISOString();
  const ok = !!result.ok;
  data.jobs[name] = {
    name,
    lastRun: nowISO, lastRunET: etDate(), lastRunWeek: isoWeek(),
    ok,
    durationSec: result.durationSec != null ? result.durationSec : null,
    error: ok ? null : (result.error || 'failed'),
    lastOk: ok ? nowISO : (prev.lastOk || null),
    lastOkET: ok ? etDate() : (prev.lastOkET || null),
    lastOkWeek: ok ? isoWeek() : (prev.lastOkWeek || null),
    lastFail: ok ? (prev.lastFail || null) : nowISO,
    consecutiveFails: ok ? 0 : ((prev.consecutiveFails || 0) + 1),
    meta: result.meta != null ? result.meta : (prev.meta || null),
  };
  data.updatedAt = nowISO;
  try { fs.writeFileSync(LOCAL, JSON.stringify(data)); } catch (_) {}
  await uploadR2(data);
  return data.jobs[name];
}

const ranOkToday = (name) => { const j = read().jobs[name]; return !!(j && j.lastOkET === etDate()); };
const ranOkThisWeek = (name) => { const j = read().jobs[name]; return !!(j && j.lastOkWeek === isoWeek()); };

module.exports = { record, read, ranOkToday, ranOkThisWeek, etDate, isoWeek };
