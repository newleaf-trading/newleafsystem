#!/usr/bin/env node
/**
 * trend-enrich-reports.cjs — Phase 4a (shadow display), pipeline side.
 *
 * Computes the deterministic trend verdict per symbol using the REAL
 * shared/trend/trend-template.cjs module (single source of truth — no browser
 * port, no drift) and attaches an ADDITIVE `trend` field to each report's
 * latest.json. The workbench reads report.trend and renders it as an advisory
 * column. Recomputes NOTHING else — setupQuality is the scanner's, computed
 * client-side; this only adds the verdict + the multipliers needed for the
 * "would become NN" preview.
 *
 * Verdict is fresh (from the report's own Alpaca priceHistory), not the weekly
 * snapshot. Writes locally; --upload (OFF by default) would push to R2 — not
 * done here (Phase 4a is build-only, do not deploy).
 *
 * Usage:
 *   node trend-enrich-reports.cjs            # attach report.trend to all local reports
 *   node trend-enrich-reports.cjs --dry-run  # compute + summarize, write nothing
 */
'use strict';

const path = require('path');
const fs = require('fs');
const { computeTrendTemplate, DEFAULT_CONFIG } = require(path.join(__dirname, '..', 'shared', 'trend', 'trend-template.cjs'));

const REPORTS_DIR = path.join(__dirname, '..', 'pipeline', 'reports');
const BENCHMARK = 'SPY';
const DRY = process.argv.includes('--dry-run');

// Multipliers travel WITH the verdict so the browser's "would become NN" preview
// uses the .cjs config values, not hardcoded constants (keeps the preview drift-free).
const MULTIPLIERS = {
  conflictMultiplier: DEFAULT_CONFIG.conflictMultiplier,
  alignBonus: DEFAULT_CONFIG.alignBonus,
  vcpNeutralMultiplier: DEFAULT_CONFIG.vcpNeutralMultiplier,
};

function normalizeBars(priceHistory) {
  return (priceHistory || []).map(b => ({ date: (b.t || '').split('T')[0], open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v || 0 }));
}

function readReport(sym) {
  try { return JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, sym, 'latest.json'), 'utf8')); } catch { return null; }
}

const UPLOAD = process.argv.includes('--upload');

// Re-upload the FULL enriched report (preserves OI + every other field, adds report.trend).
// Resolves the S3 SDK + R2 creds from the pipeline dir, where the pipeline already uses them.
function makeUploader() {
  const { createRequire } = require('module');
  const pipeReq = createRequire(path.join(__dirname, '..', 'pipeline', 'index.js'));
  const { S3Client, PutObjectCommand } = pipeReq('@aws-sdk/client-s3');
  const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'pipeline', 'config.json'), 'utf8')).r2;
  const client = new S3Client({ region: 'auto', endpoint: cfg.endpoint, credentials: { accessKeyId: cfg.accessKeyId, secretAccessKey: cfg.secretAccessKey } });
  return (key, body) => client.send(new PutObjectCommand({ Bucket: cfg.bucket, Key: key, Body: body, ContentType: 'application/json', CacheControl: 'public, max-age=300' }));
}

async function main() {
  const benchBars = normalizeBars(readReport(BENCHMARK)?.technicalData?.priceHistory);
  if (!benchBars.length) { console.error(`No ${BENCHMARK} report — cannot compute relative strength.`); process.exit(1); }

  const symbols = fs.existsSync(REPORTS_DIR)
    ? fs.readdirSync(REPORTS_DIR).filter(f => { try { return fs.statSync(path.join(REPORTS_DIR, f)).isDirectory() && f !== 'trend-candidates'; } catch { return false; } })
    : [];

  let enriched = 0, skipped = 0;
  const tally = { aligned: 0, neutral: 0, conflicted: 0 };
  const toUpload = [];
  for (const sym of symbols) {
    const fp = path.join(REPORTS_DIR, sym, 'latest.json');
    const report = readReport(sym);
    if (!report) { skipped++; continue; }
    const bars = normalizeBars(report.technicalData?.priceHistory);
    if (bars.length < DEFAULT_CONFIG.minBars) { skipped++; continue; }

    const atrPct = report.technicalData?.atrPct;
    const move3 = bars.length >= 4 ? bars[bars.length - 1].close / bars[bars.length - 4].close - 1 : 0;
    const velocityGuardFired = atrPct > 0 && Math.abs(move3) > 3 * atrPct;

    const t = computeTrendTemplate({ bars, benchmarkBars: benchBars, benchmarkSymbol: BENCHMARK, velocityGuardFired });
    tally[t.verdict] = (tally[t.verdict] || 0) + 1;

    // ADDITIVE field only — never touches scoring, gammaData, or anything the scanner ranks on.
    report.trend = {
      verdict: t.verdict,
      checks: t.checks,
      down: t.down,
      vcpActive: t.vcpActive,
      velocityGuardFired,
      overlap: t.overlap,
      trendScore: t.trendScore,
      multipliers: MULTIPLIERS,                 // for the muted "would become NN" preview
      source: 'shared/trend v0',
      advisory: 'SHADOW · ADVISORY · UNVALIDATED',
      asOf: report.meta?.date || null,
    };

    if (!DRY) fs.writeFileSync(fp, JSON.stringify(report, null, 2));
    if (UPLOAD && !DRY) toUpload.push({ key: `reports/${sym}/latest.json`, body: JSON.stringify(report) });
    enriched++;
  }

  console.log(`\n  Trend report enrichment${DRY ? ' (dry-run)' : ''}: ${enriched} enriched · ${skipped} skipped`);
  console.log(`  verdicts: aligned ${tally.aligned} · neutral ${tally.neutral} · conflicted ${tally.conflicted}`);
  console.log(`  attached field: report.trend (additive, advisory) · multipliers ${JSON.stringify(MULTIPLIERS)}`);
  if (UPLOAD && !DRY && toUpload.length) {
    const put = makeUploader();
    console.log(`  uploading ${toUpload.length} enriched reports to R2 (preserves OI + all fields, adds report.trend)...`);
    let done = 0, failed = 0; const BATCH = 8;
    for (let i = 0; i < toUpload.length; i += BATCH) {
      const res = await Promise.allSettled(toUpload.slice(i, i + BATCH).map(u => put(u.key, u.body)));
      done += res.filter(r => r.status === 'fulfilled').length;
      failed += res.filter(r => r.status === 'rejected').length;
    }
    console.log(`  ✓ R2 upload: ${done} ok, ${failed} failed\n`);
  } else if (!DRY) {
    console.log(`  ⚠ local only — pass --upload to push report.trend to R2\n`);
  }
}

main().catch(e => { console.error('Error:', e.message); process.exit(1); });
