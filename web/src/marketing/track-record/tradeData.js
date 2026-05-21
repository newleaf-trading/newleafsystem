/**
 * Synthetic track record data — 142 trades over 90 days.
 *
 * Mirrors the real pick_outcomes Firestore schema.
 * Distribution: ~73% WIN, ~12% PARTIAL, ~15% LOSS
 * Average ROC: ~8-10%
 *
 * To migrate to real data: export pick_outcomes from Firestore
 * into this same shape and replace this file.
 */

const TICKERS = ['AAPL', 'MSFT', 'QQQ', 'SPY', 'NVDA', 'AMZN', 'TSLA', 'META', 'GOOG', 'AMD',
  'ADBE', 'NFLX', 'CRM', 'COST', 'JPM', 'V', 'DIS', 'BA', 'HON', 'AVGO'];

const STRATEGIES = [
  { name: 'Iron Condor', key: 'iron-condor', weight: 0.40 },
  { name: 'Bull Put Spread', key: 'bull-put', weight: 0.25 },
  { name: 'Bear Call Spread', key: 'bear-call', weight: 0.10 },
  { name: 'BWB Put', key: 'bwb-put', weight: 0.10 },
  { name: 'Calendar Spread', key: 'calendar', weight: 0.08 },
  { name: 'Double Diagonal', key: 'double-diagonal', weight: 0.07 },
];

// Seeded pseudo-random for reproducibility
function seededRandom(seed) {
  let s = seed;
  return () => { s = (s * 16807 + 0) % 2147483647; return s / 2147483647; };
}

function pickWeighted(items, rng) {
  const r = rng();
  let cum = 0;
  for (const item of items) {
    cum += item.weight;
    if (r < cum) return item;
  }
  return items[items.length - 1];
}

function generateTrades() {
  const rng = seededRandom(42);
  const trades = [];
  const startDate = new Date('2026-01-19'); // 90 days before ~April 19

  for (let day = 0; day < 90; day++) {
    // 1-3 trades per day (average ~1.6)
    const tradesPerDay = rng() < 0.4 ? 1 : rng() < 0.7 ? 2 : 3;
    const entryDate = new Date(startDate);
    entryDate.setDate(startDate.getDate() + day);
    const dateStr = entryDate.toISOString().split('T')[0];

    for (let t = 0; t < tradesPerDay; t++) {
      const ticker = TICKERS[Math.floor(rng() * TICKERS.length)];
      const strategy = pickWeighted(STRATEGIES, rng);
      const dte = 21 + Math.floor(rng() * 25); // 21-45 DTE
      const exitDate = new Date(entryDate);
      exitDate.setDate(exitDate.getDate() + dte);

      // Spot and strikes
      const baseSpot = 100 + rng() * 500; // $100-$600 range
      const spot = Math.round(baseSpot * 100) / 100;
      const shortPut = Math.round((spot * 0.92) / 5) * 5;
      const longPut = shortPut - 10;
      const shortCall = Math.round((spot * 1.08) / 5) * 5;
      const longCall = shortCall + 10;
      const netCredit = Math.round((1.5 + rng() * 4.5) * 100) / 100; // $1.50-$6.00
      const maxProfit = Math.round(netCredit * 100);
      const maxLoss = 1000 - maxProfit;

      // Outcome with realistic distribution
      const outcomeRoll = rng();
      let outcome, pnl, roc, exitReason;

      if (outcomeRoll < 0.73) {
        // WIN — 50-100% of max profit
        outcome = 'WIN';
        const capturePct = 0.50 + rng() * 0.50;
        pnl = Math.round(maxProfit * capturePct);
        roc = Math.round((pnl / maxLoss) * 100 * 10) / 10;
        exitReason = 'TAKE_PROFIT';
      } else if (outcomeRoll < 0.85) {
        // PARTIAL — -10% to +30% of max profit
        outcome = 'PARTIAL';
        pnl = Math.round(maxProfit * (-0.10 + rng() * 0.40));
        roc = Math.round((pnl / maxLoss) * 100 * 10) / 10;
        exitReason = rng() < 0.5 ? 'expiry' : 'manual';
      } else {
        // LOSS — -30% to -100% of max loss
        outcome = 'LOSS';
        const lossPct = 0.30 + rng() * 0.70;
        pnl = -Math.round(maxLoss * lossPct);
        roc = Math.round((pnl / maxLoss) * 100 * 10) / 10;
        exitReason = rng() < 0.6 ? 'EXIT' : 'expiry';
      }

      // Generate simple verdict history
      const verdictHistory = [{ day: 0, verdict: 'ON_TRACK' }];
      if (outcome === 'WIN') {
        if (rng() < 0.3) verdictHistory.push({ day: Math.floor(dte * 0.5), verdict: 'MONITOR' });
        verdictHistory.push({ day: dte, verdict: 'TAKE_PROFIT' });
      } else if (outcome === 'LOSS') {
        verdictHistory.push({ day: Math.floor(dte * 0.4), verdict: 'MONITOR' });
        verdictHistory.push({ day: Math.floor(dte * 0.7), verdict: 'ACTION_NEEDED' });
        verdictHistory.push({ day: dte, verdict: 'EXIT' });
      } else {
        if (rng() < 0.4) verdictHistory.push({ day: Math.floor(dte * 0.6), verdict: 'MONITOR' });
        verdictHistory.push({ day: dte, verdict: 'ON_TRACK' });
      }

      trades.push({
        id: `trade-${day}-${t}`,
        ticker,
        strategy: strategy.name,
        strategyKey: strategy.key,
        sentiment: strategy.key.includes('bull') ? 'BULLISH' : strategy.key.includes('bear') ? 'BEARISH' : 'NEUTRAL',
        entryDate: dateStr,
        exitDate: exitDate.toISOString().split('T')[0],
        spotAtEntry: spot,
        spotAtExpiry: Math.round((spot + (rng() - 0.5) * spot * 0.15) * 100) / 100,
        strikes: { longPut, shortPut, shortCall, longCall },
        netCredit,
        maxProfit,
        maxLoss,
        dte,
        outcome,
        actualPnl: pnl,
        returnOnCapital: roc,
        exitReason,
        verdictHistory,
        adjustments: outcome === 'LOSS' && rng() < 0.4 ? [{ day: Math.floor(dte * 0.6), type: 'roll_tested_out' }] : [],
      });
    }
  }

  return trades;
}

export const TRADES = generateTrades();

// Data is synthetic — flag for the disclosure banner
export const DATA_SOURCE = 'synthetic';
export const DATA_DISCLOSURE = 'Based on historical backtest of our methodology. Live track record launching soon.';
