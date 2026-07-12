#!/usr/bin/env node
/**
 * sync-manifest.cjs — Authoritative manifest reconciliation.
 *
 * Rebuilds reports/manifest.json from the LOCAL reports dir (the source of
 * truth — every reports/<SYM>/latest.json) and uploads it to R2. Idempotent
 * and cheap (local read + one upload). Run on a short cron so that if any
 * partial pipeline run leaves a stale/short manifest on R2 (the 110-vs-297
 * bug), it is corrected within one interval.
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { buildFromLocalDir } = require('./manifest-builder.cjs');

const REPORTS_DIR = path.join(__dirname, 'reports');
const MANIFEST_PATH = path.join(REPORTS_DIR, 'manifest.json');

let cfg = {};
try { cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8')); } catch (_) {}
const base = cfg.r2?.publicBaseUrl || (cfg.r2?.accountId ? `https://${cfg.r2.accountId}.r2.dev` : '');

let meta = {};
try { meta = JSON.parse(fs.readFileSync(path.join(__dirname, 'company-metadata.json'), 'utf8')); } catch (_) {}

const m = buildFromLocalDir(REPORTS_DIR, meta, base);
if (!m.count) { console.error('[sync-manifest] no local reports found — refusing to upload an empty manifest'); process.exit(1); }

// Only re-upload if R2 is actually behind local (avoids needless writes).
(async () => {
  let r2Count = null;
  if (base) {
    try {
      const res = await fetch(`${base}/reports/manifest.json?cb=${Date.now()}`, { signal: AbortSignal.timeout(8000) });
      if (res.ok) r2Count = (await res.json()).reports?.length ?? null;
    } catch (_) {}
  }
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(m));
  if (r2Count !== null && r2Count >= m.count) {
    console.log(`[sync-manifest] R2 already current (${r2Count} >= ${m.count}) — no upload needed`);
    return;
  }
  execSync(`"${process.execPath}" upload-to-r2.js reports/manifest.json reports/manifest.json`, { cwd: __dirname, stdio: 'inherit' });
  console.log(`[sync-manifest] ✓ manifest reconciled → R2 (${r2Count ?? '?'} → ${m.count} reports)`);
})();
