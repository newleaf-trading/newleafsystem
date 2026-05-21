#!/usr/bin/env node
/**
 * generate-content.js — Content Orchestrator
 *
 * Generates ALL content assets for a week's picks in one command:
 *   - PDF reports (WeasyPrint)
 *   - Social cards (Puppeteer → PNG)
 *   - Social copy (Claude → JSON)
 *   - picks.json + video-script.md (existing)
 *
 * Usage:
 *   node generate-content.js                    # all content, current week
 *   node generate-content.js --week 2026-W20    # specific week
 *   node generate-content.js --social-only      # cards + copy only
 *   node generate-content.js --video-only       # video script only
 *   node generate-content.js --pdf-only         # PDFs only
 *   node generate-content.js --cards-only       # social cards only
 *   node generate-content.js --copy-only        # social copy only
 */

import { execSync } from 'child_process';
import { existsSync, readdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

const WEEK_ID = getFlag('week') || getISOWeek();
const SOCIAL_ONLY = process.argv.includes('--social-only');
const VIDEO_ONLY = process.argv.includes('--video-only');
const PDF_ONLY = process.argv.includes('--pdf-only');
const CARDS_ONLY = process.argv.includes('--cards-only');
const COPY_ONLY = process.argv.includes('--copy-only');
const RUN_ALL = !SOCIAL_ONLY && !VIDEO_ONLY && !PDF_ONLY && !CARDS_ONLY && !COPY_ONLY;

function run(cmd, label) {
  console.log(`\n  ▶ ${label}`);
  console.log(`  ${'─'.repeat(50)}`);
  try {
    execSync(cmd, { cwd: __dirname, stdio: 'inherit' });
    return true;
  } catch (err) {
    console.error(`  ⚠ ${label} failed (exit code ${err.status})`);
    return false;
  }
}

async function main() {
  const enrichedDir = resolve(__dirname, 'output', WEEK_ID, 'enriched');

  if (!existsSync(enrichedDir)) {
    console.error(`\n  ❌ No enriched picks found for ${WEEK_ID}`);
    console.error(`     Run 'npm run publish' first to create picks.\n`);
    process.exit(1);
  }

  const pickCount = readdirSync(enrichedDir).filter(f => f.endsWith('.json')).length;

  console.log(`\n  ╔══════════════════════════════════════════════════════════╗`);
  console.log(`  ║         NewLeaf Content Engine                           ║`);
  console.log(`  ╠══════════════════════════════════════════════════════════╣`);
  console.log(`  ║  Week:   ${WEEK_ID.padEnd(46)}║`);
  console.log(`  ║  Picks:  ${String(pickCount).padEnd(46)}║`);
  console.log(`  ╚══════════════════════════════════════════════════════════╝`);

  const weekFlag = `--week ${WEEK_ID}`;
  let steps = 0;
  let success = 0;

  // 1. PDF reports
  if (RUN_ALL || PDF_ONLY) {
    steps++;
    if (run(`node generate-outputs.js --pdf`, 'PDF Reports + Archive')) success++;
  }

  // 2. Social cards (Puppeteer)
  if (RUN_ALL || SOCIAL_ONLY || CARDS_ONLY) {
    steps++;
    if (run(`node generate-social-cards.js ${weekFlag}`, 'Social Media Cards')) success++;
  }

  // 3. Social copy (Claude)
  if (RUN_ALL || SOCIAL_ONLY || COPY_ONLY) {
    steps++;
    if (run(`node generate-social-copy.js ${weekFlag}`, 'Social Media Copy (Claude)')) success++;
  }

  // 4. Video script (part of generate-outputs, already done if RUN_ALL)
  if (VIDEO_ONLY) {
    steps++;
    if (run(`node generate-outputs.js`, 'Video Script + Archive')) success++;
  }

  // Summary
  console.log(`\n  ══════════════════════════════════════════════════════════`);
  console.log(`  ✅ Content generation complete: ${success}/${steps} steps succeeded`);
  console.log(`  ══════════════════════════════════════════════════════════`);
  console.log(`\n  📁 Output directory: output/${WEEK_ID}/`);

  const outputDir = resolve(__dirname, 'output', WEEK_ID);
  const dirs = ['enriched', 'pdf', 'social', 'copy'];
  for (const d of dirs) {
    const p = resolve(outputDir, d);
    if (existsSync(p)) {
      const count = readdirSync(p).filter(f => !f.startsWith('.')).length;
      console.log(`     ${d.padEnd(12)} ${count} file(s)`);
    }
  }
  console.log('');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
