#!/usr/bin/env node
/**
 * newleaf compare — Options strategy comparison CLI.
 *
 * Usage:
 *   node compare.cjs --ticker AAPL --spot 214 \
 *     --strategy "iron_condor:shortWidth=10,wing=10,net=4" \
 *     --strategy "iron_butterfly:wing=10,net=7" \
 *     --target 400
 *
 *   node compare.cjs --ticker AAPL --live \
 *     --strategy "iron_condor:shortWidth=10,wing=10"
 *
 *   node compare.cjs --ticker AAPL --spot 214 --strategy "iron_condor:shortWidth=10,wing=10,net=4" --json
 */
'use strict';

const path = require('path');
const fs = require('fs');
const { buildLegs, payoff, analyse, bandWidth, PRESETS } = require(path.join(__dirname, '..', 'shared', 'strategies'));

// ── CLI parsing ─────────────────────────────────────────────────────────────

const args = process.argv.slice(2);

function getFlag(name) {
  const idx = args.indexOf('--' + name);
  return idx >= 0 && args[idx + 1] ? args[idx + 1] : null;
}

function getAllFlags(name) {
  const results = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--' + name && args[i + 1]) {
      results.push(args[i + 1]);
    }
  }
  return results;
}

const TICKER = getFlag('ticker');
const SPOT_ARG = getFlag('spot');
const TARGET = parseFloat(getFlag('target') || '400');
const LIVE = args.includes('--live');
const JSON_OUT = args.includes('--json');

const strategyArgs = getAllFlags('strategy');

if (!TICKER || strategyArgs.length === 0) {
  console.log('Usage: node compare.cjs --ticker SYM [--spot N] --strategy "type:k=v,k=v" [--strategy ...] [--target N] [--live] [--json]');
  console.log('');
  console.log('Available strategies:', Object.keys(PRESETS).join(', '));
  console.log('');
  console.log('Example:');
  console.log('  node compare.cjs --ticker XYZ --spot 214 \\');
  console.log('    --strategy "iron_condor:shortWidth=10,wing=10,net=4" \\');
  console.log('    --strategy "iron_butterfly:wing=10,net=7"');
  process.exit(1);
}

// ── Parse strategy specs ────────────────────────────────────────────────────

function parseStrategySpec(spec) {
  const [typePart, paramsPart] = spec.split(':');
  const type = typePart.trim();
  const params = {};
  if (paramsPart) {
    for (const pair of paramsPart.split(',')) {
      const [k, v] = pair.split('=');
      if (k && v) params[k.trim()] = parseFloat(v.trim());
    }
  }
  return { type, params };
}

// ── Alpaca fetch (only used with --live) ─────────────────────────────────────

async function fetchSpot(symbol) {
  const config = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'pipeline', 'config.json'), 'utf8'));
  const ALPACA = 'https://data.alpaca.markets';
  const res = await fetch(`${ALPACA}/v2/stocks/${symbol}/snapshot`, {
    headers: {
      'APCA-API-KEY-ID': config.alpaca.apiKey,
      'APCA-API-SECRET-KEY': config.alpaca.secretKey,
      'Accept': 'application/json',
    },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Alpaca ${res.status}`);
  const d = await res.json();
  return d.latestTrade?.p || d.latestQuote?.ap || d.dailyBar?.c || 0;
}

// ── ASCII sparkline ─────────────────────────────────────────────────────────

function sparkline(pnls, width) {
  width = width || 60;
  const min = Math.min(...pnls);
  const max = Math.max(...pnls);
  const range = max - min || 1;
  const step = Math.ceil(pnls.length / width);
  const chars = '▁▂▃▄▅▆▇█';
  let line = '';
  for (let i = 0; i < pnls.length; i += step) {
    const v = pnls[i];
    const idx = Math.min(chars.length - 1, Math.floor(((v - min) / range) * (chars.length - 1)));
    line += chars[idx];
  }
  return line;
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  // Resolve spot price
  let spot;
  if (SPOT_ARG) {
    spot = parseFloat(SPOT_ARG);
  } else {
    try {
      spot = await fetchSpot(TICKER);
    } catch (e) {
      console.error(`Could not fetch spot for ${TICKER}: ${e.message}`);
      process.exit(1);
    }
  }

  if (!spot || spot <= 0) {
    console.error('Invalid spot price:', spot);
    process.exit(1);
  }

  // Build strategies
  const strategies = strategyArgs.map(spec => {
    const { type, params } = parseStrategySpec(spec);
    const legs = buildLegs(type, spot, params);
    return { name: type, legs, params };
  });

  // Analyse
  const results = analyse(strategies, spot);

  // Band width
  for (const r of results) {
    const strat = strategies.find(s => s.name === r.name);
    r.band = bandWidth(strat.legs, spot, TARGET);
  }

  // JSON output
  if (JSON_OUT) {
    const out = results.map(r => ({
      name: r.name,
      maxProfit: r.maxProfit,
      maxLoss: r.maxLoss,
      breakevens: r.breakevens,
      profitZoneWidth: r.profitZoneWidth,
      rewardRisk: r.rewardRisk,
      uncappedProfit: r.uncappedProfit,
      uncappedLoss: r.uncappedLoss,
      band: r.band,
    }));
    console.log(JSON.stringify({ ticker: TICKER, spot, target: TARGET, strategies: out }, null, 2));
    return;
  }

  // ── Terminal output ──
  console.log('');
  console.log(`  ═══ NewLeaf Strategy Comparison ═══`);
  console.log(`  Ticker: ${TICKER}  Spot: $${spot.toFixed(2)}  Target: $${TARGET}`);
  console.log('');

  // ASCII payoff overlay
  console.log('  Payoff at expiration:');
  for (const r of results) {
    const pnls = r.grid.map(p => p.pnl);
    const line = sparkline(pnls);
    const tag = r.name.padEnd(20);
    console.log(`  ${tag} ${line}`);
  }
  console.log('');

  // Table
  const hdr = ['Strategy', 'Net', 'Max Profit', 'Max Loss', 'R:R', 'Breakevens', 'PZ Width', `≥$${TARGET} Band`];
  const rows = results.map(r => {
    const strat = strategies.find(s => s.name === r.name);
    const net = strat.params.net != null ? `$${strat.params.net}` : '—';
    const be = r.breakevens.map(b => `$${b}`).join(' / ') || '—';
    const band = r.band ? `$${r.band.lo}–$${r.band.hi} (${r.band.width.toFixed(0)}w)` : 'none';
    return [
      r.name,
      net,
      `$${r.maxProfit.toFixed(0)}`,
      `$${r.maxLoss.toFixed(0)}`,
      r.rewardRisk === Infinity ? '∞' : `${r.rewardRisk.toFixed(2)}x`,
      be,
      `$${r.profitZoneWidth.toFixed(0)}`,
      band,
    ];
  });

  // Compute column widths
  const widths = hdr.map((h, i) => Math.max(h.length, ...rows.map(r => r[i].length)));
  const sep = widths.map(w => '─'.repeat(w + 2)).join('┼');

  console.log('  ' + hdr.map((h, i) => h.padEnd(widths[i])).join(' │ '));
  console.log('  ' + sep);
  for (const row of rows) {
    console.log('  ' + row.map((c, i) => c.padEnd(widths[i])).join(' │ '));
  }

  // Uncapped warnings
  for (const r of results) {
    if (r.uncappedProfit) console.log(`  ⚠ ${r.name}: uncapped profit (no max)"`);
    if (r.uncappedLoss) console.log(`  ⚠ ${r.name}: uncapped loss (no floor)"`);
  }

  console.log('');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
