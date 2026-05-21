#!/usr/bin/env node
/**
 * generate-outputs.js — Stage 3 of weekly pipeline
 * ─────────────────────────────────────────────────────────────────────────────
 * Reads enriched-pick.json files (tile + Claude analysis merged) and generates:
 *   1. PDF reports (per pick) — calls generate-report.py with enriched data
 *   2. Video script (per week) — Markdown narration for creative team
 *   3. Pick JSON archive (per week) — machine-readable snapshot
 *
 * Usage:
 *   node pipeline/generate-outputs.js                    # current week
 *   node pipeline/generate-outputs.js --week 2026-W16    # specific week
 *   node pipeline/generate-outputs.js --pdf              # also generate PDFs
 *   node pipeline/generate-outputs.js --no-video         # skip video script
 *
 * Prerequisites:
 *   Run analyse-tiles.cjs first (Stage 2) to generate enriched-pick.json files.
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── Config ──────────────────────────────────────────────────────────────────
const GENERATE_PDF = process.argv.includes('--pdf');
const SKIP_VIDEO = process.argv.includes('--no-video');

function getFlag(name) {
  const idx = process.argv.indexOf('--' + name);
  return idx >= 0 && process.argv[idx + 1] ? process.argv[idx + 1] : null;
}

function getISOWeek(date = new Date()) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

const weekId = getFlag('week') || getISOWeek();
const enrichedDir = resolve(__dirname, 'output', weekId, 'enriched');

// ── Main ────────────────────────────────────────────────────────────────────
console.log('');
console.log('  ══════════════════════════════════════════════════════════');
console.log('  🍃 NewLeaf — Output Generator (Stage 3)');
console.log('  ══════════════════════════════════════════════════════════');
console.log(`  Week:     ${weekId}`);
console.log(`  PDF:      ${GENERATE_PDF ? 'YES' : 'SKIP (use --pdf to enable)'}`);
console.log(`  Video:    ${SKIP_VIDEO ? 'SKIP' : 'YES'}`);
console.log('');

// ── Step 1: Read enriched picks ─────────────────────────────────────────────
if (!existsSync(enrichedDir)) {
  console.error(`  ❌ No enriched picks found at: ${enrichedDir}`);
  console.error('  Run "npm run analyse" first (Stage 2).');
  process.exit(1);
}

const enrichedFiles = readdirSync(enrichedDir).filter(f => f.endsWith('.json'));
if (enrichedFiles.length === 0) {
  console.error('  ❌ No enriched JSON files found. Run analyse-tiles.cjs first.');
  process.exit(1);
}

const picks = enrichedFiles.map(f => {
  const raw = readFileSync(resolve(enrichedDir, f), 'utf-8');
  return JSON.parse(raw);
});

console.log(`  Found ${picks.length} enriched pick(s):`);
picks.forEach((p, i) => {
  console.log(`    ${i + 1}. ${p.symbol} — ${p.strategy} (${p.tileId})`);
});
console.log('');

// ── Step 2: Generate pick JSON archive ──────────────────────────────────────
console.log('  📋 Generating pick JSON archive...');
const weekDir = resolve(__dirname, 'output', weekId);
const picksArchive = {
  weekId,
  generatedAt: new Date().toISOString(),
  pickCount: picks.length,
  picks: picks.map(p => ({
    tileId: p.tileId,
    symbol: p.symbol,
    companyName: p.companyName,
    strategy: p.strategy,
    direction: p.direction,
    spotPrice: p.spotPrice,
    expiry: p.expiry,
    dte: p.dte,
    legs: p.legs,
    greeks: p.greeks,
    maxProfit: p.maxProfit,
    maxLoss: p.maxLoss,
    netCredit: p.netCredit,
    rewardRisk: p.rewardRisk,
    oddsOfProfit: p.oddsOfProfit,
    // Enriched summary fields
    thesis: p.thesis,
    keyLevels: p.keyLevels,
    ivContext: p.ivContext,
    riskSummary: p.riskSummary,
    exitPlan: p.exitPlan,
    // Sentiment (4-engine composite)
    sentiment: p.sentiment ? {
      score: p.sentiment.composite?.score ?? p.sentiment.score,
      label: p.sentiment.composite?.label ?? p.sentiment.label,
      confidence: p.sentiment.composite?.confidence ?? p.sentiment.confidence,
      summary: p.sentiment.summary,
      keyDrivers: (p.sentiment.keyDrivers || []).slice(0, 5),
      materialEvents: p.sentiment.materialEvents || [],
      socialSentiment: p.sentiment.socialSentiment,
      sectorContext: p.sentiment.sectorContext,
      engines: p.sentiment.engines ? Object.fromEntries(
        Object.entries(p.sentiment.engines).map(([k, v]) => [k, { score: v.score, label: v.label, weight: v.weight }])
      ) : null,
      activeEngines: p.sentiment.activeEngines,
      source: p.sentiment.source,
    } : null,
  })),
};

writeFileSync(resolve(weekDir, 'picks.json'), JSON.stringify(picksArchive, null, 2));
console.log(`  ✅ Saved picks.json (${picks.length} picks)\n`);

// ── Step 3: Generate video script ───────────────────────────────────────────
if (!SKIP_VIDEO) {
  console.log('  🎬 Generating video script...');
  const script = generateVideoScript(weekId, picks);
  writeFileSync(resolve(weekDir, 'video-script.md'), script);
  console.log(`  ✅ Saved video-script.md\n`);
}

// ── Step 4: Generate PDFs ───────────────────────────────────────────────────
if (GENERATE_PDF) {
  console.log('  📄 Generating PDF reports...');
  const pdfDir = resolve(weekDir, 'pdf');
  mkdirSync(pdfDir, { recursive: true });

  for (const pick of picks) {
    try {
      const dataFile = resolve(enrichedDir, `${pick.symbol.toLowerCase()}-${(pick.strategy || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.json`);
      const pdfFile = resolve(pdfDir, `${pick.symbol}-${(pick.strategy || '').replace(/\s+/g, '-')}.pdf`);

      console.log(`    → ${pick.symbol} ${pick.strategy}...`);
      execSync(`python3 ${resolve(__dirname, 'generate-report.py')} "${dataFile}" "${pdfFile}"`, {
        cwd: __dirname,
        timeout: 30000,
        stdio: 'pipe',
      });
      console.log(`      ✅ ${basename(pdfFile)}`);
    } catch (err) {
      console.log(`      ❌ PDF failed: ${err.message}`);
    }
  }
  console.log('');
}

// ── Step 5: Summary ─────────────────────────────────────────────────────────
console.log('  ──────────────────────────────────────────');
console.log(`  📁 Output directory: pipeline/output/${weekId}/`);
console.log(`     enriched/    ${enrichedFiles.length} enriched pick JSON(s)`);
console.log(`     picks.json   Week archive (${picks.length} picks)`);
if (!SKIP_VIDEO) console.log('     video-script.md');
if (GENERATE_PDF) console.log(`     pdf/         ${picks.length} PDF report(s)`);
console.log('  ──────────────────────────────────────────');
console.log('');

// ═══════════════════════════════════════════════════════════════════════════
// VIDEO SCRIPT GENERATOR
// ═══════════════════════════════════════════════════════════════════════════

function generateVideoScript(weekId, picks) {
  const fmtPrice = n => n != null ? `$${Number(n).toFixed(2)}` : 'N/A';
  const totalProfit = picks.reduce((s, p) => s + (p.maxProfit || 0), 0);

  let md = `# NewLeaf Weekly Picks — ${weekId}\n\n`;
  md += `**Generated:** ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}\n`;
  md += `**Picks:** ${picks.length} strategies | **Combined Max Profit:** ${fmtPrice(totalProfit)}\n\n`;
  md += `---\n\n`;

  // Opening hook
  md += `## 🎙️ Opening\n\n`;
  md += `> Welcome to this week's NewLeaf options picks. We've selected ${picks.length} strategies across ${[...new Set(picks.map(p => p.symbol))].length} symbols. `;
  const ivPicks = picks.filter(p => p.ivContext?.ivRank);
  if (ivPicks.length > 0) {
    const avgIvRank = Math.round(ivPicks.reduce((s, p) => s + p.ivContext.ivRank, 0) / ivPicks.length);
    md += `Average IV rank is ${avgIvRank}, which ${avgIvRank > 50 ? 'favours premium selling strategies' : 'suggests more directional setups'}. `;
  }
  md += `Let's break down each trade.\n\n`;

  // Per-pick segments
  picks.forEach((pick, i) => {
    const analysis = pick.analysis || {};
    const rationale = analysis.strategyRationale || {};
    const tech = analysis.technicalIndicators || {};
    const risk = analysis.riskAnalysis || {};

    md += `---\n\n`;
    md += `## Pick ${i + 1}: ${pick.symbol} — ${pick.strategy}\n\n`;

    // Strategy rationale
    if (rationale.whyThisStrategy) {
      md += `### Why This Trade\n\n`;
      md += `> ${rationale.whyThisStrategy}\n\n`;
    }

    // Key metrics
    md += `**Setup:** ${pick.direction} | `;
    md += `**Spot:** ${fmtPrice(pick.spotPrice)} | `;
    md += `**Expiry:** ${pick.expiry} (${pick.dte}d) | `;
    md += `**Max Profit:** ${fmtPrice(pick.maxProfit)} | `;
    md += `**Max Loss:** ${fmtPrice(pick.maxLoss)} | `;
    md += `**R:R:** ${pick.rewardRisk}x\n\n`;

    // Strike selection
    if (rationale.whyTheseStrikes) {
      md += `**Strike Logic:** ${rationale.whyTheseStrikes}\n\n`;
    }

    // Market sentiment
    const sent = pick.sentiment;
    if (sent) {
      const sScore = sent.composite?.score ?? sent.score;
      const sLabel = (sent.composite?.label ?? sent.label ?? 'neutral').toUpperCase();
      const engines = sent.activeEngines || (sent.engines ? Object.keys(sent.engines).length : 1);
      md += `### Market Sentiment (${engines} AI Engine${engines > 1 ? 's' : ''})\n\n`;
      md += `> **${sLabel} ${sScore}/100** — ${sent.summary || 'No summary available.'}\n\n`;
      if (sent.keyDrivers?.length > 0) {
        md += `**Key Drivers:**\n`;
        sent.keyDrivers.slice(0, 4).forEach(d => {
          const icon = d.impact === 'positive' ? '▲' : d.impact === 'negative' ? '▼' : '●';
          md += `- ${icon} ${d.factor}${d.source ? ` *(${d.source})*` : ''}\n`;
        });
        md += `\n`;
      }
      if (sent.materialEvents?.length > 0) {
        md += `> ⚠️ **Material Events:** ${sent.materialEvents.join('; ')}\n\n`;
      }
      if (sent.socialSentiment) md += `**Social:** ${sent.socialSentiment}\n\n`;
    }

    // Technical context
    if (tech.rsi?.description || tech.impliedVolatility?.description) {
      md += `### Technical Context\n\n`;
      if (tech.rsi?.description) md += `- **RSI (${tech.rsi.value}):** ${tech.rsi.description}\n`;
      if (tech.impliedVolatility?.description) md += `- **IV Rank (${tech.impliedVolatility.ivRank}):** ${tech.impliedVolatility.description}\n`;
      if (tech.macd?.description) md += `- **MACD:** ${tech.macd.description}\n`;
      md += `\n`;
    }

    // Risk callout
    if (risk.eventRisk || risk.managementPlan) {
      md += `### Risk & Exit\n\n`;
      if (risk.eventRisk) md += `- **Event Risk:** ${risk.eventRisk}\n`;
      if (risk.managementPlan) md += `- **Exit Plan:** ${risk.managementPlan}\n`;
      md += `\n`;
    }
  });

  // Closing
  md += `---\n\n`;
  md += `## 🎙️ Closing\n\n`;
  md += `> That's ${picks.length} picks for week ${weekId}. Full details, live P&L tracking, and strategy analysis at newleafsystem.com/picks. `;
  md += `Remember: defined risk strategies, always know your max loss before entering. See you next week.\n\n`;
  md += `---\n*Script generated by NewLeaf Pipeline. Review and adapt for recording.*\n`;

  return md;
}
