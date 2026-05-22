#!/usr/bin/env node
/**
 * generate-social-copy.js
 *
 * Uses Claude CLI to generate platform-specific social media captions
 * from enriched pick data.
 *
 * Usage:
 *   node generate-social-copy.js                    # current week, all picks
 *   node generate-social-copy.js --week 2026-W20    # specific week
 *   node generate-social-copy.js --symbol BABA      # single pick
 */

import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { callLLM, DEFAULT_MODEL } = require('./llm-call.cjs');
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
const SYMBOL_FILTER = getFlag('symbol')?.toUpperCase();

function extractJSON(raw) {
  const match = raw.match(/```json\s*([\s\S]*?)```/) || raw.match(/(\{[\s\S]*\})/);
  if (match) {
    try { return JSON.parse(match[1].trim()); } catch {}
  }
  try { return JSON.parse(raw); } catch {}
  return null;
}

async function generateCopyForPick(pick) {
  const fmtPrice = n => Number(n).toFixed(2);
  const sentimentScore = pick.sentiment?.composite?.score ?? pick.sentiment?.score ?? 50;
  const sentimentLabel = pick.sentiment?.composite?.label ?? pick.sentiment?.label ?? 'neutral';

  const legsText = pick.legs.map(l => `${l.action} ${l.type} $${l.strike}`).join(' / ');

  const prompt = `Generate social media posts for this options trade recommendation. Return ONLY valid JSON.

TRADE DATA:
- Symbol: $${pick.symbol} (${pick.companyName || pick.symbol})
- Strategy: ${pick.strategy}
- Direction: ${pick.direction}
- Spot Price: $${fmtPrice(pick.spotPrice)}
- Legs: ${legsText}
- Net Credit: $${fmtPrice(pick.netCredit)} per share
- Max Profit: $${fmtPrice(pick.maxProfit)}
- Max Loss: $${fmtPrice(pick.maxLoss)}
- Probability of Profit: ${pick.oddsOfProfit}%
- R:R Ratio: ${Number(pick.rewardRisk).toFixed(2)}x
- DTE: ${pick.dte} days (expires ${pick.expiry})
- AI Sentiment: ${sentimentLabel} (${sentimentScore}/100)
- Thesis: ${pick.analysis?.strategyRationale?.whyThisStrategy || 'N/A'}

Generate JSON with exactly these keys:
{
  "linkedin": "Professional LinkedIn post (150-200 words). Data-driven tone. Mention the strategy, key metrics, and why it works. No emojis. End with a call-to-action to visit newleafsystem.com/picks",
  "twitter": ["Tweet 1 (under 280 chars, punchy, use $TICKER cashtag)", "Tweet 2 (under 280 chars, explain the setup)", "Tweet 3 (under 280 chars, risk/CTA)"],
  "instagram": "Engaging Instagram caption (80-120 words). Include key metrics. End with 10-15 relevant hashtags like #options #trading #ironcondor #theta etc."
}`;

  let raw;
  try {
    raw = await callLLM(prompt, {
      system: 'You are a social media marketing expert for a financial technology company. Return ONLY valid JSON.',
      model: DEFAULT_MODEL,
      maxTokens: 2000,
    });
  } catch (err) {
    console.error(`    ⚠ LLM failed for ${pick.symbol}:`, err.message?.slice(0, 200));
    return null;
  }

  return extractJSON(raw);
}

async function main() {
  const enrichedDir = resolve(__dirname, 'output', WEEK_ID, 'enriched');
  const copyDir = resolve(__dirname, 'output', WEEK_ID, 'copy');

  if (!existsSync(enrichedDir)) {
    console.error(`  No enriched picks found for ${WEEK_ID}`);
    process.exit(1);
  }

  mkdirSync(copyDir, { recursive: true });

  const files = readdirSync(enrichedDir).filter(f => f.endsWith('.json'));
  let picks = files.map(f => JSON.parse(readFileSync(resolve(enrichedDir, f), 'utf-8')));

  if (SYMBOL_FILTER) {
    picks = picks.filter(p => p.symbol === SYMBOL_FILTER);
  }

  console.log(`\n  ══════════════════════════════════════════════════════════`);
  console.log(`  ✍️  Social Copy Generator (Claude)`);
  console.log(`  ══════════════════════════════════════════════════════════`);
  console.log(`  Week:   ${WEEK_ID}`);
  console.log(`  Picks:  ${picks.length}`);
  console.log('');

  for (const pick of picks) {
    process.stdout.write(`    → ${pick.symbol} ${pick.strategy}...`);

    const copy = await generateCopyForPick(pick);

    if (copy) {
      const filename = `${pick.symbol}-social-copy.json`;
      writeFileSync(resolve(copyDir, filename), JSON.stringify(copy, null, 2));
      console.log(` ✅`);
    } else {
      console.log(` ❌ (failed)`);
    }
  }

  console.log('');
  console.log(`  ──────────────────────────────────────────`);
  console.log(`  📁 ${copyDir}`);
  console.log(`  ──────────────────────────────────────────\n`);
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
