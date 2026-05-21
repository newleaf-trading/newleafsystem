#!/usr/bin/env node
/**
 * update-pick-outcomes.js
 *
 * Daily cron job — runs at 6pm ET on weekdays.
 * Checks expired picks that have no outcome yet, fetches closing
 * price from Alpaca, and classifies the result.
 *
 * Usage:
 *   node scripts/update-pick-outcomes.js
 *   node scripts/update-pick-outcomes.js --dry-run
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SA_PATH = resolve(__dirname, '../../OptionAdvisor/newleaf-trading/scanner/serviceAccountKey.json');
const ALPACA_CONFIG = resolve(__dirname, '../pipeline/alpaca-config.json');
const DRY_RUN = process.argv.includes('--dry-run');

admin.initializeApp({
  projectId: 'newleaf-trading',
  credential: admin.credential.cert(JSON.parse(readFileSync(SA_PATH, 'utf-8')))
});
const db = admin.firestore();
db.settings({ databaseId: 'newleafdb' });

// Load Alpaca keys
let alpacaKey, alpacaSecret;
try {
  const cfg = JSON.parse(readFileSync(ALPACA_CONFIG, 'utf-8'));
  alpacaKey = cfg.key || cfg.apiKey || cfg.APCA_API_KEY_ID;
  alpacaSecret = cfg.secret || cfg.apiSecret || cfg.APCA_API_SECRET_KEY;
} catch (e) {
  console.error('  Could not load Alpaca config:', e.message);
  process.exit(1);
}

async function fetchSpotPrice(ticker) {
  const url = `https://data.alpaca.markets/v2/stocks/${ticker}/quotes/latest`;
  const res = await fetch(url, {
    headers: {
      'APCA-API-KEY-ID': alpacaKey,
      'APCA-API-SECRET-KEY': alpacaSecret
    }
  });
  if (!res.ok) throw new Error(`Alpaca ${res.status} for ${ticker}`);
  const data = await res.json();
  // midpoint of bid/ask
  const quote = data.quote;
  return (quote.bp + quote.ap) / 2;
}

function classifyOutcome(pick, spotPrice) {
  // If already marked as early close, keep stored P&L
  if (pick.closedAt === 'early' && pick.actualPnl != null) {
    return { outcome: pick.actualPnl > 0 ? (pick.actualPnl >= pick.maxProfit * 0.85 ? 'WIN' : 'PARTIAL') : 'LOSS' };
  }

  const shortLegs = (pick.legs || []).filter(l => l.action === 'SELL');
  let allOTM = true;

  for (const leg of shortLegs) {
    if (leg.type === 'PUT' && spotPrice <= leg.strike) {
      allOTM = false;
      break;
    }
    if (leg.type === 'CALL' && spotPrice >= leg.strike) {
      allOTM = false;
      break;
    }
  }

  if (allOTM) {
    return {
      outcome: 'WIN',
      actualPnl: Math.round(pick.maxProfit * 0.95),
      pnlPercent: 95,
      closeReason: 'All short strikes expired OTM'
    };
  } else {
    return {
      outcome: 'LOSS',
      actualPnl: -pick.maxLoss,
      pnlPercent: -100,
      closeReason: 'Short strike breached at expiry'
    };
  }
}

async function run() {
  const today = new Date().toISOString().slice(0, 10);
  console.log(`\n  Update Pick Outcomes — ${today}`);
  console.log(`  ${DRY_RUN ? '(DRY RUN)' : ''}\n`);

  // Find all picks with no outcome and expiry <= today
  const snap = await db.collection('pick_outcomes')
    .where('outcome', '==', null)
    .get();

  // Also check docs where outcome field doesn't exist yet
  const snap2 = await db.collection('pick_outcomes').get();
  const openPicks = snap2.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(p => !p.outcome && p.expiry && p.expiry <= today);

  if (!openPicks.length) {
    console.log('  No open picks to close.\n');
    process.exit(0);
  }

  console.log(`  Found ${openPicks.length} open picks to evaluate:\n`);

  for (const pick of openPicks) {
    try {
      const spot = await fetchSpotPrice(pick.ticker);
      const result = classifyOutcome(pick, spot);

      console.log(`  ${pick.weekId} ${pick.ticker} ${pick.strategy}`);
      console.log(`    Spot: $${spot.toFixed(2)} → ${result.outcome} (P&L: ${result.actualPnl})`);

      if (!DRY_RUN) {
        await db.collection('pick_outcomes').doc(pick.id).update({
          outcome: result.outcome,
          actualPnl: result.actualPnl,
          pnlPercent: result.pnlPercent,
          spotAtExpiry: parseFloat(spot.toFixed(2)),
          closeReason: result.closeReason,
          closedAt: 'expiry',
          closedAtTs: new Date().toISOString()
        });
      }
    } catch (err) {
      console.error(`  ERROR ${pick.ticker}: ${err.message}`);
    }
  }

  console.log(`\n  Done.\n`);
  process.exit(0);
}

run().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
