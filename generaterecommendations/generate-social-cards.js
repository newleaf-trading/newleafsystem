#!/usr/bin/env node
/**
 * generate-social-cards.js
 *
 * Renders social media card images from enriched pick JSON using Puppeteer.
 * Produces LinkedIn (1200x627), Twitter (1200x675), Instagram (1080x1080) PNGs.
 *
 * Usage:
 *   node generate-social-cards.js                        # current week, all picks
 *   node generate-social-cards.js --week 2026-W20        # specific week
 *   node generate-social-cards.js --symbol BABA          # single pick
 *   node generate-social-cards.js --platform linkedin    # one platform only
 */

import puppeteer from 'puppeteer';
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ── CLI args ────────────────────────────────────────────────────────────────
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
const SYMBOL_FILTER = getFlag('symbol')?.toUpperCase();
const PLATFORM_FILTER = getFlag('platform');

// ── Platforms ───────────────────────────────────────────────────────────────
const PLATFORMS = [
  { name: 'linkedin',  width: 1200, height: 627,  template: 'linkedin-card.html' },
  { name: 'twitter',   width: 1200, height: 675,  template: 'twitter-card.html' },
  { name: 'instagram', width: 1080, height: 1080, template: 'instagram-card.html' },
];

// ── Template rendering ──────────────────────────────────────────────────────
function buildTemplateData(pick) {
  const fmtPrice = n => Number(n).toFixed(2);
  const sentimentScore = pick.sentiment?.composite?.score ?? pick.sentiment?.score ?? 50;
  const sentimentLabel = pick.sentiment?.composite?.label ?? pick.sentiment?.label ?? 'neutral';
  const sentimentClass = sentimentLabel.toLowerCase();

  // Build legs HTML for LinkedIn
  const legsHtml = pick.legs.map(leg => {
    const cls = leg.action === 'BUY' ? 'leg-buy' : 'leg-sell';
    return `<span class="leg ${cls}">${leg.action} ${leg.type} $${leg.strike}</span>`;
  }).join('<span class="leg-sep">|</span>');

  // Build legs text for Twitter
  const legsText = pick.legs.map(leg =>
    `${leg.action} ${leg.type} $${leg.strike}`
  ).join(' | ');

  // Build leg chips for Instagram
  const legsChipsHtml = pick.legs.map(leg => {
    const cls = leg.action === 'BUY' ? 'buy' : 'sell';
    return `<span class="leg-chip ${cls}">${leg.action} ${leg.type} $${leg.strike}</span>`;
  }).join('');

  const directionLabel = {
    bullish: 'Bullish',
    bearish: 'Bearish',
    neutral: 'Neutral'
  }[pick.direction?.toLowerCase()] || 'Neutral';

  return {
    '{{SYMBOL}}': pick.symbol,
    '{{STRATEGY}}': pick.strategy,
    '{{DIRECTION}}': pick.direction?.toLowerCase() || 'neutral',
    '{{DIRECTION_LABEL}}': directionLabel,
    '{{SPOT_PRICE}}': fmtPrice(pick.spotPrice),
    '{{NET_CREDIT}}': fmtPrice(pick.netCredit),
    '{{MAX_PROFIT}}': fmtPrice(pick.maxProfit),
    '{{MAX_LOSS}}': fmtPrice(pick.maxLoss),
    '{{POP}}': String(pick.oddsOfProfit || 0),
    '{{RR}}': Number(pick.rewardRisk || 0).toFixed(2),
    '{{DTE}}': String(pick.dte || 0),
    '{{EXPIRY}}': pick.expiry || '',
    '{{SENTIMENT_SCORE}}': String(sentimentScore),
    '{{SENTIMENT_LABEL}}': sentimentLabel.charAt(0).toUpperCase() + sentimentLabel.slice(1),
    '{{SENTIMENT_CLASS}}': sentimentClass,
    '{{LEGS_HTML}}': legsHtml,
    '{{LEGS_TEXT}}': legsText,
    '{{LEGS_CHIPS_HTML}}': legsChipsHtml,
  };
}

function renderTemplate(templatePath, data) {
  let html = readFileSync(templatePath, 'utf-8');
  for (const [placeholder, value] of Object.entries(data)) {
    html = html.replaceAll(placeholder, value);
  }
  return html;
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  const enrichedDir = resolve(__dirname, 'output', WEEK_ID, 'enriched');
  const socialDir = resolve(__dirname, 'output', WEEK_ID, 'social');

  if (!existsSync(enrichedDir)) {
    console.error(`  No enriched picks found for ${WEEK_ID}`);
    console.error(`  Expected: ${enrichedDir}`);
    process.exit(1);
  }

  mkdirSync(socialDir, { recursive: true });

  // Load enriched picks
  const files = readdirSync(enrichedDir).filter(f => f.endsWith('.json'));
  let picks = files.map(f => JSON.parse(readFileSync(resolve(enrichedDir, f), 'utf-8')));

  if (SYMBOL_FILTER) {
    picks = picks.filter(p => p.symbol === SYMBOL_FILTER);
  }

  if (picks.length === 0) {
    console.error('  No picks found matching criteria.');
    process.exit(1);
  }

  const platforms = PLATFORM_FILTER
    ? PLATFORMS.filter(p => p.name === PLATFORM_FILTER)
    : PLATFORMS;

  console.log(`\n  ══════════════════════════════════════════════════════════`);
  console.log(`  🎨 Social Card Generator`);
  console.log(`  ══════════════════════════════════════════════════════════`);
  console.log(`  Week:      ${WEEK_ID}`);
  console.log(`  Picks:     ${picks.length}`);
  console.log(`  Platforms: ${platforms.map(p => p.name).join(', ')}`);
  console.log(`  Output:    ${socialDir}`);
  console.log('');

  const browser = await puppeteer.launch({ headless: true });

  for (const pick of picks) {
    const data = buildTemplateData(pick);

    for (const platform of platforms) {
      const templatePath = resolve(__dirname, 'templates', 'social', platform.template);
      const html = renderTemplate(templatePath, data);

      const page = await browser.newPage();
      await page.setViewport({ width: platform.width, height: platform.height, deviceScaleFactor: 2 });
      await page.setContent(html, { waitUntil: 'networkidle0' });

      const filename = `${pick.symbol}-${platform.name}.png`;
      const outputPath = resolve(socialDir, filename);
      await page.screenshot({ path: outputPath, type: 'png' });
      await page.close();

      console.log(`    ✅ ${filename} (${platform.width}x${platform.height})`);
    }
  }

  await browser.close();

  console.log('');
  console.log(`  ──────────────────────────────────────────`);
  console.log(`  ✅ Generated ${picks.length * platforms.length} social cards`);
  console.log(`  📁 ${socialDir}`);
  console.log(`  ──────────────────────────────────────────\n`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
