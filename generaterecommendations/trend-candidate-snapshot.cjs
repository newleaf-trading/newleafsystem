#!/usr/bin/env node
/**
 * trend-candidate-snapshot.cjs — Phase 3 forward-test instrumentation (additive, read-only on the pipeline).
 *
 * Persists, per symbol per run, a faithful reaction-engine `setupQuality` + the
 * trend verdict/overlap, so Phase 3's validation backtest can run as a FORWARD
 * study once post-signal outcomes accumulate. (No historical setupQuality is
 * persisted anywhere, and reconstructing it from EOD breaches the consistency
 * bar — so we accumulate it going forward instead.)
 *
 * setupQuality is assembled by MIRRORING the canonical production orchestration
 * in web/workbench/movement-range.html:409-425 exactly — same calls, same param
 * wiring — so the persisted score cannot drift from what the scanner shows.
 *
 * Reads:  pipeline/reports/{SYMBOL}/latest.json  (technicals, gamma walls+OI, priceHistory)
 * Writes: pipeline/reports/trend-candidates/{ISO-WEEK}.json  (local; --upload pushes to R2, OFF by default)
 *
 * Does NOT modify DEFAULT_CONFIG, the trend module, the live pipeline daemon,
 * the selector, Firestore, or UI.
 *
 * Usage:
 *   node trend-candidate-snapshot.cjs            # snapshot all reports → this ISO week's file
 *   node trend-candidate-snapshot.cjs --dry-run  # compute + print cohort summary, write nothing
 */
'use strict';

const path = require('path');
const fs = require('fs');
const R = require(path.join(__dirname, '..', 'shared', 'reaction', 'index.cjs'));
const { computeTrendTemplate } = require(path.join(__dirname, '..', 'shared', 'trend', 'trend-template.cjs'));

const args = process.argv.slice(2);
const DRY = args.includes('--dry-run');
const BENCHMARK = 'SPY';
const REPORTS_DIR = path.join(__dirname, '..', 'pipeline', 'reports');
const OUT_DIR = path.join(REPORTS_DIR, 'trend-candidates');

// ── ISO-8601 week key (e.g. 2026-W25), matching the premium-snapshot convention ──
function isoWeek(dateStr) {
  const d = new Date(dateStr + 'T00:00:00Z');
  const day = (d.getUTCDay() + 6) % 7;            // Mon=0
  d.setUTCDate(d.getUTCDate() - day + 3);          // nearest Thursday
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const week = 1 + Math.round(((d - firstThu) / 86400000 - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function readReport(sym) {
  try { return JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, sym, 'latest.json'), 'utf8')); }
  catch { return null; }
}

// Extract ATM implied vol from the report's option chain; 0 if unavailable
// (mirrors movement-range: ivRv = atmIv/rv when both present, else 0).
function atmIvFrom(report, spot) {
  const oc = report.optionChain;
  if (!oc) return 0;
  const rows = Array.isArray(oc) ? oc : Object.values(oc);
  let best = null, bestDist = Infinity;
  for (const c of rows) {
    if (!c || typeof c !== 'object') continue;
    const strike = c.strike ?? c.strikePrice;
    const iv = c.iv ?? c.impliedVolatility ?? (c.greeks && c.greeks.iv);
    if (strike == null || iv == null) continue;
    const dist = Math.abs(strike - spot);
    if (dist < bestDist) { bestDist = dist; best = +iv; }
  }
  if (best == null) return 0;
  return best > 3 ? best / 100 : best; // normalize percent → decimal if needed
}

/** Normalize report priceHistory {t,o,h,l,c,v} → engine bar shape (mirrors movement-range.html:393). */
function normalizeBars(priceHistory) {
  return (priceHistory || []).map(b => ({ date: (b.t || '').split('T')[0], open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v || 0 }));
}

/** Build the movement-range `d` input from a pipeline report. */
function toD(sym, report) {
  const t = report.technicalData || {};
  const g = (report.gammaData && report.gammaData.analysis) || {};
  const bars = normalizeBars(t.priceHistory);
  if (bars.length < 60) return null;
  const spot = bars[bars.length - 1].close;
  const totalOI = (g.topStrikes || []).reduce((s, k) => s + (k.call_oi || 0) + (k.put_oi || 0), 0);
  return {
    symbol: sym, price: spot,
    putWall: g.put_wall, callWall: g.call_wall,
    sma50: t.sma50, sma100: t.sma100, sma200: t.sma200,
    bb: t.bb, atrPct: t.atrPct, adx: t.adx14, rv: t.realizedVol30d,
    atmIv: atmIvFrom(report, spot),
    totalOI, oiAvailable: totalOI > 0,
    earningsDate: report.earningsDate || null,
    gammaConf: g.confidence_score ?? g.gex_confidence ?? 0,
    bars,
  };
}

/** Faithful setupQuality — mirrors movement-range.html:409-425 exactly. */
function reactionQuality(d) {
  const levels = R.gatherLevels(d.price, { putWall: d.putWall, callWall: d.callWall, sma50: d.sma50, sma100: d.sma100, sma200: d.sma200, bbLower: d.bb?.lower, bbUpper: d.bb?.upper, bars: d.bars });
  const { supportZones, resistanceZones } = R.clusterLevels(d.price, levels, d.atrPct);
  const sStats = supportZones.map(z => R.analyzeZone(d.bars, z, 'support'));
  const rStats = resistanceZones.map(z => R.analyzeZone(d.bars, z, 'resistance'));
  const { nearestSupport: nearS, nearestResistance: nearR } = R.nearestScoreableZones(d.price, sStats, rStats);
  let containment = 0;
  if (nearS && nearR && nearS.zone.hi < nearR.zone.lo) containment = R.computeContainment(d.bars, nearS.zone, nearR.zone, 45);
  const { regime, confidence, trendIntoZone } = R.classifyRegime(d.price, nearS, nearR, containment, d.adx, d.atrPct, { candles: d.bars });
  const ivRv = d.rv > 0 && d.atmIv > 0 ? d.atmIv / d.rv : 0;
  const fwd = nearS?.touches?.length ? R.forwardReturns(d.bars, nearS.touches, [5], 'support') : {};
  let distPct = 99;
  if (nearS && !nearS.untested) distPct = Math.min(distPct, ((d.price - nearS.zone.hi) / d.price) * 100);
  if (nearR && !nearR.untested) distPct = Math.min(distPct, ((nearR.zone.lo - d.price) / d.price) * 100);
  const bandCentre = nearS && nearR && nearS.zone.hi < nearR.zone.lo ? (nearS.zone.hi + nearR.zone.lo) / 2 : null;
  const biasResult = R.mapBias({ regime, supportScore: nearS?.score || 0, resistanceScore: nearR?.score || 0, supportTested: nearS ? !nearS.untested : false, resistanceTested: nearR ? !nearR.untested : false, ivRv, spot: d.price, supportLo: nearS?.zone?.lo || null, resistanceHi: nearR?.zone?.hi || null, bandCentre, gammaConfidence: d.gammaConf, containment, adx: d.adx, trendIntoZone });
  const bias = biasResult.bias;
  const quality = R.setupQuality({ symbol: d.symbol, spot: d.price, zoneScore: Math.max(nearS?.score || 0, nearR?.score || 0), ivRv, regimeConfidence: confidence, distancePct: Math.abs(distPct), topStrikesOI: d.totalOI, oiDataAvailable: d.oiAvailable, median5d: fwd.median5d || 0, earningsDate: d.earningsDate, untested: (nearS?.untested !== false && nearR?.untested !== false), regime, supportZoneScore: nearS?.score || 0, resistanceZoneScore: nearR?.score || 0, strategyBias: bias });
  return { quality, bias, regime, ivRv, distPct: Math.abs(distPct), nearS, nearR };
}

function main() {
  const benchReport = readReport(BENCHMARK);
  const benchBars = normalizeBars(benchReport?.technicalData?.priceHistory);
  if (!benchBars.length) { console.error(`No ${BENCHMARK} report — cannot compute relative strength.`); process.exit(1); }

  const symbols = fs.existsSync(REPORTS_DIR)
    ? fs.readdirSync(REPORTS_DIR).filter(f => fs.statSync(path.join(REPORTS_DIR, f)).isDirectory() && f !== 'trend-candidates')
    : [];

  const records = [];
  const skipped = [];
  for (const sym of symbols) {
    const report = readReport(sym);
    if (!report) { skipped.push([sym, 'no report']); continue; }
    const d = toD(sym, report);
    if (!d) { skipped.push([sym, 'thin/absent priceHistory']); continue; }

    let rq;
    try { rq = reactionQuality(d); } catch (e) { skipped.push([sym, 'assembly error: ' + e.message]); continue; }

    // Velocity guard — score.cjs's rule (|3-bar net move| > 3×ATR), computed standalone (A4).
    const bars = d.bars;
    const move3 = bars.length >= 4 ? bars[bars.length - 1].close / bars[bars.length - 4].close - 1 : 0;
    const velocityGuardFired = d.atrPct > 0 && Math.abs(move3) > 3 * d.atrPct;

    const trend = computeTrendTemplate({ bars, benchmarkBars: benchBars, benchmarkSymbol: BENCHMARK, velocityGuardFired });

    const signalDate = (report.meta && report.meta.date) || null;
    records.push({
      symbol: sym,
      signalDate,
      asOf: report.meta && report.meta.generatedAt,
      spot: +d.price.toFixed(2),
      setupQuality: rq.quality.total,
      setupQualityExclusion: rq.quality.exclusionReason || null,
      suggestedStrategy: rq.bias,                                   // reaction mapBias (canonical)
      pipelineStrategy: report.scoring?.strategy?.code || null,     // cross-ref only
      regime: rq.regime,
      ivRv: +rq.ivRv.toFixed(3),
      supportZone: rq.nearS ? { lo: rq.nearS.zone.lo, hi: rq.nearS.zone.hi, score: rq.nearS.score } : null,
      shortStrike: rq.nearS?.zone?.lo ?? ((report.gammaData && report.gammaData.analysis && report.gammaData.analysis.put_wall) || null),
      verdict: trend.verdict,
      trendScore: trend.trendScore,
      checks: trend.checks,
      down: trend.down,
      vcpActive: trend.vcpActive,
      velocityGuardFired,
      overlap: trend.overlap,
      adjustedSetupQuality: trend.adjustedSetupQuality(rq.quality.total),
      cohortBullPutAtSupport: /bull_put/.test(rq.bias),
      // outcome fields populated LATER by the forward-test harness (no lookahead here):
      outcome: null,
      provenance: { engine: 'shared/trend v0 + reaction', barsUsed: bars.length, benchmark: BENCHMARK, dataSource: 'pipeline/reports' },
    });
  }

  // ── Cohort summary ──
  const week = records.length ? isoWeek(records[0].signalDate || new Date().toISOString().split('T')[0]) : 'unknown';
  const by = v => records.filter(r => r.verdict === v);
  const bullPut = records.filter(r => r.cohortBullPutAtSupport);
  const summary = {
    week, universe: symbols.length, scored: records.length, skipped: skipped.length,
    cohorts: { aligned: by('aligned').length, neutral: by('neutral').length, conflicted: by('conflicted').length },
    bullPutAtSupport: bullPut.length,
    conflictedBullPut: bullPut.filter(r => r.verdict === 'conflicted').length,
    overlapCount: records.filter(r => r.overlap).length,
  };

  console.log(`\n  ═══ Trend Candidate Snapshot — ${week} ═══`);
  console.log(`  universe ${summary.universe} · scored ${summary.scored} · skipped ${summary.skipped}`);
  console.log(`  verdicts: aligned ${summary.cohorts.aligned} · neutral ${summary.cohorts.neutral} · conflicted ${summary.cohorts.conflicted}`);
  console.log(`  bull-put-at-support cohort: ${summary.bullPutAtSupport}  (conflicted within it: ${summary.conflictedBullPut})`);
  console.log(`  overlap (conflicted + velocity guard): ${summary.overlapCount}`);
  if (skipped.length) console.log(`  skipped: ${skipped.slice(0, 8).map(s => s[0]).join(', ')}${skipped.length > 8 ? ' …' : ''}`);

  if (DRY) { console.log('\n  --dry-run: nothing written.\n'); return; }

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const outPath = path.join(OUT_DIR, `${week}.json`);
  let existing = {};
  try { existing = JSON.parse(fs.readFileSync(outPath, 'utf8')).records?.reduce((m, r) => (m[r.symbol] = r, m), {}) || {}; } catch { /* new file */ }
  for (const r of records) existing[r.symbol] = r; // append-safe: latest wins per symbol
  const out = { week, generatedAt: (records[0] && records[0].asOf) || null, summary, records: Object.values(existing) };
  fs.writeFileSync(outPath, JSON.stringify(out, null, 2));
  console.log(`\n  wrote ${out.records.length} candidates → ${path.relative(path.join(__dirname, '..'), outPath)}\n`);
}

main();
