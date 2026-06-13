'use strict';
/**
 * manifest-builder.cjs — authoritative manifest construction.
 * ─────────────────────────────────────────────────────────────────────────────
 * The manifest used to be maintained by a racy per-symbol read-modify-write
 * (upsertManifest) that dropped symbols under concurrency. This builds the whole
 * manifest in ONE atomic pass from the local reports directory — the source of
 * truth — so it always reflects exactly the reports that exist. No race possible.
 * ─────────────────────────────────────────────────────────────────────────────
 */
const fs = require('fs');
const path = require('path');

const TIER_LABEL = { mega: 'Mega Cap', large: 'Large Cap', mid: 'Mid Cap', small: 'Small Cap', etf: 'ETF/Index' };
const TIER_OQ = { mega: 5, large: 5, mid: 4, small: 3, etf: 5 };

/** Build one manifest row from a report + company metadata. */
function buildRow(sym, rep, meta, base) {
  const m = (meta && meta[sym]) || {};
  const tier = m.marketCapTier || null;
  const sc = rep.scoring || {};
  const strat = sc.strategy || {};
  return {
    symbol: sym,
    sector: m.sector || null,
    marketCapTier: tier,
    marketCapLabel: tier ? (TIER_LABEL[tier] || tier) : null,
    optionsQuality: tier ? (TIER_OQ[tier] || 3) : 3,
    hasOptions: sc.hasOptions != null ? sc.hasOptions : !!rep.gammaData,
    opportunityScore: sc.opportunityScore != null ? sc.opportunityScore : 0,
    direction: sc.direction || null,
    strategy: strat.name || null,
    strategyCode: strat.code || null,
    strategyIcon: strat.icon || null,
    price: rep.snapshot ? rep.snapshot.price : null,
    changePercent: rep.snapshot ? rep.snapshot.changePercent : null,
    iv: rep.gammaData && rep.gammaData.ivData ? rep.gammaData.ivData.atmIv : null,
    url: `${base}/reports/${sym}/latest.json`,
    date: rep.meta ? (rep.meta.generatedAt || rep.meta.asOf || null) : null,
  };
}

/**
 * Rebuild the manifest from every reports/<SYM>/latest.json present locally.
 * Reading the directory (not a watchlist list) makes it self-correcting: the
 * manifest reflects exactly the reports on disk, whatever they are.
 */
function buildFromLocalDir(reportsDir, meta, base) {
  let dirs = [];
  try {
    dirs = fs.readdirSync(reportsDir, { withFileTypes: true })
      .filter(d => d.isDirectory()).map(d => d.name);
  } catch (_) { /* no reports dir */ }

  const rows = [];
  for (const sym of dirs) {
    try {
      const rep = JSON.parse(fs.readFileSync(path.join(reportsDir, sym, 'latest.json'), 'utf8'));
      if (rep && rep.scoring) rows.push(buildRow(sym, rep, meta, base));
    } catch (_) { /* missing/partial report — skip */ }
  }
  rows.sort((a, b) => (b.opportunityScore || 0) - (a.opportunityScore || 0));
  return {
    updatedAt: new Date().toISOString(),
    totalReports: rows.length,
    reports: rows,
    symbols: rows.map(r => r.symbol),
    count: rows.length,
  };
}

module.exports = { buildRow, buildFromLocalDir };
