#!/usr/bin/env node
/**
 * trend-report.cjs — human-readable viewer for the universe trend snapshot.
 *
 * Reads the latest pipeline/reports/trend-candidates/{ISO-week}.json (written by
 * trend-candidate-snapshot.cjs) and prints a sortable per-symbol table so you can
 * eyeball whether the filter behaves: conflicted = downtrends/falling-knives,
 * aligned = clean uptrends. Read-only — computes nothing, writes nothing.
 *
 * Usage:
 *   node trend-candidate-snapshot.cjs            # (re)compute the snapshot first
 *   node trend-report.cjs                        # summary + top of each verdict
 *   node trend-report.cjs --verdict conflicted   # only one verdict
 *   node trend-report.cjs --cohort bullput       # only bull-put-at-support candidates
 *   node trend-report.cjs --limit 50             # rows per verdict (default 15; --all = no cap)
 *   node trend-report.cjs --csv > trend.csv      # machine-readable
 */
'use strict';

const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
const getFlag = (n, d) => { const i = args.indexOf('--' + n); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const ONLY_VERDICT = getFlag('verdict');
const COHORT = args.includes('--cohort') ? (getFlag('cohort') || 'bullput') : null;
const LIMIT = args.includes('--all') ? Infinity : parseInt(getFlag('limit', '15'), 10);
const CSV = args.includes('--csv');

const DIR = path.join(__dirname, '..', 'pipeline', 'reports', 'trend-candidates');
if (!fs.existsSync(DIR)) { console.error('No snapshots — run: node generaterecommendations/trend-candidate-snapshot.cjs'); process.exit(1); }
const files = fs.readdirSync(DIR).filter(f => /^\d{4}-W\d{2}\.json$/.test(f)).sort();
if (!files.length) { console.error('No snapshot files — run: node generaterecommendations/trend-candidate-snapshot.cjs'); process.exit(1); }
const doc = JSON.parse(fs.readFileSync(path.join(DIR, files[files.length - 1]), 'utf8'));

let records = doc.records;
if (COHORT === 'bullput') records = records.filter(r => r.cohortBullPutAtSupport);
if (ONLY_VERDICT) records = records.filter(r => r.verdict === ONLY_VERDICT);

// Sort by setupQuality desc within a verdict — for conflicted, the highest-SQ ones are the
// most dangerous knives the engine "loved" and the filter demotes (the saves worth checking).
const fmtRs = r => (r.checks && r.checks.rsPositive) ? 'RS+' : ((r.down && r.down.rsNegative) ? 'RS−' : 'RS·');
const fmtAdj = v => (+v).toFixed(1).replace(/\.0$/, '');
const passUp = r => ['maStack', 'priceAboveStack', 'ma200Rising', 'rsPositive'].filter(k => r.checks[k]).length;

if (CSV) {
  console.log('symbol,verdict,spot,setupQuality,adjustedSetupQuality,trendScore,rsRatioPct,velocityGuardFired,overlap,suggestedStrategy,bullPutAtSupport');
  for (const r of records.sort((a, b) => b.setupQuality - a.setupQuality)) {
    console.log([r.symbol, r.verdict, r.spot, r.setupQuality, r.adjustedSetupQuality, r.trendScore,
      (r.rs && r.rs.ratio != null ? (r.rs.ratio * 100).toFixed(1) : ''), r.velocityGuardFired, r.overlap,
      r.suggestedStrategy, r.cohortBullPutAtSupport].join(','));
  }
  process.exit(0);
}

const s = doc.summary || {};
console.log(`\n  ═══ Trend Filter — universe report (${doc.week}) ═══`);
console.log(`  scored ${s.scored} · aligned ${s.cohorts?.aligned} · neutral ${s.cohorts?.neutral} · conflicted ${s.cohorts?.conflicted}`);
console.log(`  bull-put-at-support ${s.bullPutAtSupport} (conflicted ${s.conflictedBullPut}) · overlap ${s.overlapCount} · scoringHash ${s.scoringHash}`);
if (COHORT) console.log(`  filter: cohort=${COHORT}`);

function printGroup(verdict, label) {
  const rows = records.filter(r => r.verdict === verdict).sort((a, b) => b.setupQuality - a.setupQuality);
  if (!rows.length) return;
  console.log(`\n  ${label} — ${rows.length} (showing ${Math.min(rows.length, LIMIT)}), sorted by setupQuality↓`);
  console.log(`    ${'SYM'.padEnd(6)} ${'spot'.padStart(8)}  ${'SQ→adj'.padEnd(9)} ${'trend'.padStart(5)} ${'RS'.padStart(5)}  ${'up4'.padStart(3)}  flags`);
  for (const r of rows.slice(0, LIMIT)) {
    const flags = [r.vcpActive ? 'vcp' : '', r.velocityGuardFired ? 'vel' : '', r.overlap ? 'OVERLAP' : '', r.cohortBullPutAtSupport ? 'bull-put' : ''].filter(Boolean).join(' ');
    console.log(`    ${r.symbol.padEnd(6)} ${('$' + r.spot).padStart(8)}  ${`${r.setupQuality}→${fmtAdj(r.adjustedSetupQuality)}`.padEnd(9)} ${String(r.trendScore).padStart(5)} ${fmtRs(r).padStart(5)}  ${String(passUp(r) + '/4').padStart(3)}  ${flags}`);
  }
}

if (ONLY_VERDICT) printGroup(ONLY_VERDICT, ONLY_VERDICT.toUpperCase());
else {
  printGroup('conflicted', 'CONFLICTED (falling-knife demotions)');
  printGroup('aligned', 'ALIGNED (endorsed)');
  printGroup('neutral', 'NEUTRAL');
}
console.log('');
