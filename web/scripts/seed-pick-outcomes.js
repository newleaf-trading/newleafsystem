#!/usr/bin/env node
/**
 * seed-pick-outcomes.js
 *
 * Seeds the Firestore `pick_outcomes` collection with 9 weeks (W07–W15)
 * of backdated picks with realistic options data.
 *
 * Usage:
 *   node scripts/seed-pick-outcomes.js
 *   node scripts/seed-pick-outcomes.js --clear   # wipe collection first
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SA_PATH = resolve(__dirname, '../../OptionAdvisor/newleaf-trading/scanner/serviceAccountKey.json');

admin.initializeApp({
  projectId: 'newleaf-trading',
  credential: admin.credential.cert(JSON.parse(readFileSync(SA_PATH, 'utf-8')))
});
const db = admin.firestore();
db.settings({ databaseId: 'newleafdb' });

// ── Helper to build a document ID ────────────────────────────────
function docId(weekId, ticker, strategySlug) {
  return `${weekId}_${ticker}_${strategySlug}`;
}

// ── All 9 weeks of pick data ─────────────────────────────────────

const picks = [

  // ═══════════════════════════════════════════════════════════════
  // W07 · Feb 10–14, 2026  —  4 WIN, 1 PARTIAL
  // ═══════════════════════════════════════════════════════════════
  {
    weekId: '2026-W07', weekStart: '2026-02-10', weekEnd: '2026-02-14',
    marketNote: 'Pre-CPI positioning — IV muted, spreads favoured',
    ticker: 'AAPL', spotAtEntry: 232.50, strategy: 'Iron Condor', strategySlug: 'iron-condor',
    sentiment: 'NEUTRAL',
    legs: [
      { action: 'BUY', type: 'PUT', strike: 220, mid: 0.45, delta: -0.08 },
      { action: 'SELL', type: 'PUT', strike: 225, mid: 1.10, delta: -0.18 },
      { action: 'SELL', type: 'CALL', strike: 240, mid: 1.20, delta: 0.20 },
      { action: 'BUY', type: 'CALL', strike: 245, mid: 0.50, delta: 0.09 }
    ],
    expiry: '2026-02-14', dte: 5, netCredit: 1.35, maxProfit: 135, maxLoss: 365,
    winRateEstimate: 72, rewardRiskRatio: 0.37,
    outcome: 'WIN', closedAt: 'expiry', actualPnl: 128, pnlPercent: 95,
    spotAtExpiry: 234.20, closeReason: 'All strikes expired OTM',
    createdAt: '2026-02-10T14:30:00Z', closedAtTs: '2026-02-14T21:00:00Z'
  },
  {
    weekId: '2026-W07', weekStart: '2026-02-10', weekEnd: '2026-02-14',
    marketNote: 'Pre-CPI positioning — IV muted, spreads favoured',
    ticker: 'SPY', spotAtEntry: 602.80, strategy: 'Bull Put', strategySlug: 'bull-put',
    sentiment: 'BULLISH',
    legs: [
      { action: 'SELL', type: 'PUT', strike: 595, mid: 1.80, delta: -0.20 },
      { action: 'BUY', type: 'PUT', strike: 590, mid: 1.05, delta: -0.12 }
    ],
    expiry: '2026-02-14', dte: 5, netCredit: 0.75, maxProfit: 75, maxLoss: 425,
    winRateEstimate: 78, rewardRiskRatio: 0.18,
    outcome: 'WIN', closedAt: 'expiry', actualPnl: 71, pnlPercent: 95,
    spotAtExpiry: 605.40, closeReason: 'Expired OTM — SPY held above 595',
    createdAt: '2026-02-10T14:30:00Z', closedAtTs: '2026-02-14T21:00:00Z'
  },
  {
    weekId: '2026-W07', weekStart: '2026-02-10', weekEnd: '2026-02-14',
    marketNote: 'Pre-CPI positioning — IV muted, spreads favoured',
    ticker: 'QQQ', spotAtEntry: 530.20, strategy: 'Iron Condor', strategySlug: 'iron-condor',
    sentiment: 'NEUTRAL',
    legs: [
      { action: 'BUY', type: 'PUT', strike: 516, mid: 0.55, delta: -0.08 },
      { action: 'SELL', type: 'PUT', strike: 522, mid: 1.40, delta: -0.19 },
      { action: 'SELL', type: 'CALL', strike: 538, mid: 1.50, delta: 0.21 },
      { action: 'BUY', type: 'CALL', strike: 544, mid: 0.60, delta: 0.09 }
    ],
    expiry: '2026-02-14', dte: 5, netCredit: 1.75, maxProfit: 175, maxLoss: 425,
    winRateEstimate: 70, rewardRiskRatio: 0.41,
    outcome: 'WIN', closedAt: 'expiry', actualPnl: 166, pnlPercent: 95,
    spotAtExpiry: 532.10, closeReason: 'Expired OTM — range held',
    createdAt: '2026-02-10T14:30:00Z', closedAtTs: '2026-02-14T21:00:00Z'
  },
  {
    weekId: '2026-W07', weekStart: '2026-02-10', weekEnd: '2026-02-14',
    marketNote: 'Pre-CPI positioning — IV muted, spreads favoured',
    ticker: 'MSFT', spotAtEntry: 412.30, strategy: 'Bull Put', strategySlug: 'bull-put',
    sentiment: 'BULLISH',
    legs: [
      { action: 'SELL', type: 'PUT', strike: 405, mid: 1.60, delta: -0.20 },
      { action: 'BUY', type: 'PUT', strike: 400, mid: 0.90, delta: -0.11 }
    ],
    expiry: '2026-02-14', dte: 5, netCredit: 0.70, maxProfit: 70, maxLoss: 430,
    winRateEstimate: 76, rewardRiskRatio: 0.16,
    outcome: 'PARTIAL', closedAt: 'early', actualPnl: 42, pnlPercent: 60,
    spotAtExpiry: 408.50, closeReason: 'Closed early at 60% profit — MSFT drifted near short strike',
    createdAt: '2026-02-10T14:30:00Z', closedAtTs: '2026-02-13T19:00:00Z'
  },
  {
    weekId: '2026-W07', weekStart: '2026-02-10', weekEnd: '2026-02-14',
    marketNote: 'Pre-CPI positioning — IV muted, spreads favoured',
    ticker: 'NVDA', spotAtEntry: 128.40, strategy: 'BWB (Put)', strategySlug: 'bwb-put',
    sentiment: 'BULLISH',
    legs: [
      { action: 'BUY', type: 'PUT', strike: 118, mid: 0.60, delta: -0.10 },
      { action: 'SELL', type: 'PUT', strike: 124, mid: 1.65, delta: -0.22 },
      { action: 'SELL', type: 'PUT', strike: 124, mid: 1.65, delta: -0.22 },
      { action: 'BUY', type: 'PUT', strike: 130, mid: 3.10, delta: -0.42 }
    ],
    expiry: '2026-02-14', dte: 5, netCredit: 0.60, maxProfit: 660, maxLoss: 540,
    winRateEstimate: 68, rewardRiskRatio: 1.22,
    outcome: 'WIN', closedAt: 'expiry', actualPnl: 210, pnlPercent: 32,
    spotAtExpiry: 126.80, closeReason: 'Settled within BWB profit zone',
    createdAt: '2026-02-10T14:30:00Z', closedAtTs: '2026-02-14T21:00:00Z'
  },

  // ═══════════════════════════════════════════════════════════════
  // W08 · Feb 17–21, 2026  —  3 WIN, 1 PARTIAL, 1 LOSS
  // ═══════════════════════════════════════════════════════════════
  {
    weekId: '2026-W08', weekStart: '2026-02-17', weekEnd: '2026-02-21',
    marketNote: 'Holiday-shortened week — low volume',
    ticker: 'GLD', spotAtEntry: 186.20, strategy: 'Iron Condor', strategySlug: 'iron-condor',
    sentiment: 'NEUTRAL',
    legs: [
      { action: 'BUY', type: 'PUT', strike: 181, mid: 0.40, delta: -0.09 },
      { action: 'SELL', type: 'PUT', strike: 183, mid: 0.85, delta: -0.18 },
      { action: 'SELL', type: 'CALL', strike: 189, mid: 0.90, delta: 0.20 },
      { action: 'BUY', type: 'CALL', strike: 191, mid: 0.40, delta: 0.10 }
    ],
    expiry: '2026-02-21', dte: 4, netCredit: 0.95, maxProfit: 95, maxLoss: 105,
    winRateEstimate: 74, rewardRiskRatio: 0.90,
    outcome: 'WIN', closedAt: 'expiry', actualPnl: 90, pnlPercent: 95,
    spotAtExpiry: 187.10, closeReason: 'GLD stayed in range — all strikes OTM',
    createdAt: '2026-02-17T14:30:00Z', closedAtTs: '2026-02-21T21:00:00Z'
  },
  {
    weekId: '2026-W08', weekStart: '2026-02-17', weekEnd: '2026-02-21',
    marketNote: 'Holiday-shortened week — low volume',
    ticker: 'AMZN', spotAtEntry: 228.60, strategy: 'Bull Put', strategySlug: 'bull-put',
    sentiment: 'BULLISH',
    legs: [
      { action: 'SELL', type: 'PUT', strike: 222, mid: 1.50, delta: -0.20 },
      { action: 'BUY', type: 'PUT', strike: 217, mid: 0.70, delta: -0.10 }
    ],
    expiry: '2026-02-21', dte: 4, netCredit: 0.80, maxProfit: 80, maxLoss: 420,
    winRateEstimate: 76, rewardRiskRatio: 0.19,
    outcome: 'WIN', closedAt: 'expiry', actualPnl: 76, pnlPercent: 95,
    spotAtExpiry: 230.40, closeReason: 'Expired OTM — AMZN stayed above 222',
    createdAt: '2026-02-17T14:30:00Z', closedAtTs: '2026-02-21T21:00:00Z'
  },
  {
    weekId: '2026-W08', weekStart: '2026-02-17', weekEnd: '2026-02-21',
    marketNote: 'Holiday-shortened week — low volume',
    ticker: 'SPY', spotAtEntry: 605.10, strategy: 'Iron Condor', strategySlug: 'iron-condor',
    sentiment: 'NEUTRAL',
    legs: [
      { action: 'BUY', type: 'PUT', strike: 594, mid: 0.50, delta: -0.08 },
      { action: 'SELL', type: 'PUT', strike: 598, mid: 1.15, delta: -0.18 },
      { action: 'SELL', type: 'CALL', strike: 612, mid: 1.25, delta: 0.20 },
      { action: 'BUY', type: 'CALL', strike: 616, mid: 0.55, delta: 0.09 }
    ],
    expiry: '2026-02-21', dte: 4, netCredit: 1.35, maxProfit: 135, maxLoss: 265,
    winRateEstimate: 72, rewardRiskRatio: 0.51,
    outcome: 'PARTIAL', closedAt: 'early', actualPnl: 68, pnlPercent: 50,
    spotAtExpiry: 610.80, closeReason: 'Closed early at 50% — SPY approaching short call',
    createdAt: '2026-02-17T14:30:00Z', closedAtTs: '2026-02-20T19:00:00Z'
  },
  {
    weekId: '2026-W08', weekStart: '2026-02-17', weekEnd: '2026-02-21',
    marketNote: 'Holiday-shortened week — low volume',
    ticker: 'TSLA', spotAtEntry: 340.20, strategy: 'Bear Call', strategySlug: 'bear-call',
    sentiment: 'BEARISH',
    legs: [
      { action: 'SELL', type: 'CALL', strike: 355, mid: 2.80, delta: 0.22 },
      { action: 'BUY', type: 'CALL', strike: 365, mid: 1.40, delta: 0.10 }
    ],
    expiry: '2026-02-21', dte: 4, netCredit: 1.40, maxProfit: 140, maxLoss: 860,
    winRateEstimate: 74, rewardRiskRatio: 0.16,
    outcome: 'LOSS', closedAt: 'expiry', actualPnl: -860, pnlPercent: -100,
    spotAtExpiry: 368.50, closeReason: 'TSLA rallied through both strikes on delivery beat',
    createdAt: '2026-02-17T14:30:00Z', closedAtTs: '2026-02-21T21:00:00Z'
  },
  {
    weekId: '2026-W08', weekStart: '2026-02-17', weekEnd: '2026-02-21',
    marketNote: 'Holiday-shortened week — low volume',
    ticker: 'META', spotAtEntry: 620.30, strategy: 'BWB (Call)', strategySlug: 'bwb-call',
    sentiment: 'NEUTRAL',
    legs: [
      { action: 'BUY', type: 'CALL', strike: 610, mid: 15.20, delta: 0.55 },
      { action: 'SELL', type: 'CALL', strike: 625, mid: 8.40, delta: 0.32 },
      { action: 'SELL', type: 'CALL', strike: 625, mid: 8.40, delta: 0.32 },
      { action: 'BUY', type: 'CALL', strike: 640, mid: 3.80, delta: 0.14 }
    ],
    expiry: '2026-02-21', dte: 4, netCredit: -2.20, maxProfit: 1280, maxLoss: 220,
    winRateEstimate: 45, rewardRiskRatio: 5.82,
    outcome: 'WIN', closedAt: 'expiry', actualPnl: 320, pnlPercent: 25,
    spotAtExpiry: 623.10, closeReason: 'META settled in BWB profit zone near short strikes',
    createdAt: '2026-02-17T14:30:00Z', closedAtTs: '2026-02-21T21:00:00Z'
  },

  // ═══════════════════════════════════════════════════════════════
  // W09 · Feb 24–28, 2026  —  2 WIN, 2 PARTIAL, 2 LOSS
  // ═══════════════════════════════════════════════════════════════
  {
    weekId: '2026-W09', weekStart: '2026-02-24', weekEnd: '2026-02-28',
    marketNote: 'Month-end positioning — volatility picked up',
    ticker: 'QQQ', spotAtEntry: 528.40, strategy: 'Iron Condor', strategySlug: 'iron-condor',
    sentiment: 'NEUTRAL',
    legs: [
      { action: 'BUY', type: 'PUT', strike: 514, mid: 0.60, delta: -0.08 },
      { action: 'SELL', type: 'PUT', strike: 520, mid: 1.55, delta: -0.20 },
      { action: 'SELL', type: 'CALL', strike: 536, mid: 1.60, delta: 0.21 },
      { action: 'BUY', type: 'CALL', strike: 542, mid: 0.65, delta: 0.09 }
    ],
    expiry: '2026-02-28', dte: 5, netCredit: 1.90, maxProfit: 190, maxLoss: 410,
    winRateEstimate: 68, rewardRiskRatio: 0.46,
    outcome: 'LOSS', closedAt: 'expiry', actualPnl: -410, pnlPercent: -100,
    spotAtExpiry: 515.20, closeReason: 'QQQ sold off hard — put side breached on VIX spike',
    createdAt: '2026-02-24T14:30:00Z', closedAtTs: '2026-02-28T21:00:00Z'
  },
  {
    weekId: '2026-W09', weekStart: '2026-02-24', weekEnd: '2026-02-28',
    marketNote: 'Month-end positioning — volatility picked up',
    ticker: 'AAPL', spotAtEntry: 234.80, strategy: 'BWB (Put)', strategySlug: 'bwb-put',
    sentiment: 'BULLISH',
    legs: [
      { action: 'BUY', type: 'PUT', strike: 222, mid: 0.50, delta: -0.08 },
      { action: 'SELL', type: 'PUT', strike: 228, mid: 1.45, delta: -0.20 },
      { action: 'SELL', type: 'PUT', strike: 228, mid: 1.45, delta: -0.20 },
      { action: 'BUY', type: 'PUT', strike: 234, mid: 3.20, delta: -0.45 }
    ],
    expiry: '2026-02-28', dte: 5, netCredit: 0.20, maxProfit: 620, maxLoss: 580,
    winRateEstimate: 62, rewardRiskRatio: 1.07,
    outcome: 'PARTIAL', closedAt: 'early', actualPnl: 186, pnlPercent: 30,
    spotAtExpiry: 230.40, closeReason: 'Closed early for 30% — AAPL moving towards short strike',
    createdAt: '2026-02-24T14:30:00Z', closedAtTs: '2026-02-27T18:00:00Z'
  },
  {
    weekId: '2026-W09', weekStart: '2026-02-24', weekEnd: '2026-02-28',
    marketNote: 'Month-end positioning — volatility picked up',
    ticker: 'NVDA', spotAtEntry: 126.50, strategy: 'Iron Condor', strategySlug: 'iron-condor',
    sentiment: 'NEUTRAL',
    legs: [
      { action: 'BUY', type: 'PUT', strike: 118, mid: 0.55, delta: -0.09 },
      { action: 'SELL', type: 'PUT', strike: 122, mid: 1.40, delta: -0.20 },
      { action: 'SELL', type: 'CALL', strike: 131, mid: 1.50, delta: 0.22 },
      { action: 'BUY', type: 'CALL', strike: 135, mid: 0.60, delta: 0.10 }
    ],
    expiry: '2026-02-28', dte: 5, netCredit: 1.75, maxProfit: 175, maxLoss: 225,
    winRateEstimate: 70, rewardRiskRatio: 0.78,
    outcome: 'WIN', closedAt: 'expiry', actualPnl: 166, pnlPercent: 95,
    spotAtExpiry: 125.80, closeReason: 'NVDA stayed in range despite broad market sell-off',
    createdAt: '2026-02-24T14:30:00Z', closedAtTs: '2026-02-28T21:00:00Z'
  },
  {
    weekId: '2026-W09', weekStart: '2026-02-24', weekEnd: '2026-02-28',
    marketNote: 'Month-end positioning — volatility picked up',
    ticker: 'SPY', spotAtEntry: 604.50, strategy: 'Bear Call', strategySlug: 'bear-call',
    sentiment: 'BEARISH',
    legs: [
      { action: 'SELL', type: 'CALL', strike: 612, mid: 2.40, delta: 0.22 },
      { action: 'BUY', type: 'CALL', strike: 618, mid: 1.10, delta: 0.10 }
    ],
    expiry: '2026-02-28', dte: 5, netCredit: 1.30, maxProfit: 130, maxLoss: 470,
    winRateEstimate: 74, rewardRiskRatio: 0.28,
    outcome: 'WIN', closedAt: 'expiry', actualPnl: 124, pnlPercent: 95,
    spotAtExpiry: 598.30, closeReason: 'SPY sold off — calls expired worthless',
    createdAt: '2026-02-24T14:30:00Z', closedAtTs: '2026-02-28T21:00:00Z'
  },
  {
    weekId: '2026-W09', weekStart: '2026-02-24', weekEnd: '2026-02-28',
    marketNote: 'Month-end positioning — volatility picked up',
    ticker: 'AMZN', spotAtEntry: 230.10, strategy: 'Iron Condor', strategySlug: 'iron-condor',
    sentiment: 'NEUTRAL',
    legs: [
      { action: 'BUY', type: 'PUT', strike: 220, mid: 0.50, delta: -0.08 },
      { action: 'SELL', type: 'PUT', strike: 224, mid: 1.25, delta: -0.19 },
      { action: 'SELL', type: 'CALL', strike: 236, mid: 1.30, delta: 0.20 },
      { action: 'BUY', type: 'CALL', strike: 240, mid: 0.55, delta: 0.09 }
    ],
    expiry: '2026-02-28', dte: 5, netCredit: 1.50, maxProfit: 150, maxLoss: 250,
    winRateEstimate: 70, rewardRiskRatio: 0.60,
    outcome: 'LOSS', closedAt: 'expiry', actualPnl: -250, pnlPercent: -100,
    spotAtExpiry: 219.30, closeReason: 'AMZN sold off hard — put side breached',
    createdAt: '2026-02-24T14:30:00Z', closedAtTs: '2026-02-28T21:00:00Z'
  },
  {
    weekId: '2026-W09', weekStart: '2026-02-24', weekEnd: '2026-02-28',
    marketNote: 'Month-end positioning — volatility picked up',
    ticker: 'META', spotAtEntry: 622.40, strategy: 'Bull Put', strategySlug: 'bull-put',
    sentiment: 'BULLISH',
    legs: [
      { action: 'SELL', type: 'PUT', strike: 610, mid: 3.80, delta: -0.22 },
      { action: 'BUY', type: 'PUT', strike: 600, mid: 1.90, delta: -0.10 }
    ],
    expiry: '2026-02-28', dte: 5, netCredit: 1.90, maxProfit: 190, maxLoss: 810,
    winRateEstimate: 72, rewardRiskRatio: 0.23,
    outcome: 'PARTIAL', closedAt: 'early', actualPnl: 114, pnlPercent: 60,
    spotAtExpiry: 614.80, closeReason: 'Closed early at 60% — vol spike made it prudent',
    createdAt: '2026-02-24T14:30:00Z', closedAtTs: '2026-02-27T19:00:00Z'
  },

  // ═══════════════════════════════════════════════════════════════
  // W10 · Mar 3–7, 2026  —  5 WIN
  // ═══════════════════════════════════════════════════════════════
  {
    weekId: '2026-W10', weekStart: '2026-03-03', weekEnd: '2026-03-07',
    marketNote: 'Jobs report week — calm before earnings',
    ticker: 'MSFT', spotAtEntry: 415.60, strategy: 'Iron Condor', strategySlug: 'iron-condor',
    sentiment: 'NEUTRAL',
    legs: [
      { action: 'BUY', type: 'PUT', strike: 404, mid: 0.50, delta: -0.08 },
      { action: 'SELL', type: 'PUT', strike: 408, mid: 1.20, delta: -0.18 },
      { action: 'SELL', type: 'CALL', strike: 423, mid: 1.30, delta: 0.20 },
      { action: 'BUY', type: 'CALL', strike: 427, mid: 0.55, delta: 0.09 }
    ],
    expiry: '2026-03-07', dte: 5, netCredit: 1.45, maxProfit: 145, maxLoss: 255,
    winRateEstimate: 72, rewardRiskRatio: 0.57,
    outcome: 'WIN', closedAt: 'expiry', actualPnl: 138, pnlPercent: 95,
    spotAtExpiry: 417.20, closeReason: 'MSFT held tight range all week',
    createdAt: '2026-03-03T14:30:00Z', closedAtTs: '2026-03-07T21:00:00Z'
  },
  {
    weekId: '2026-W10', weekStart: '2026-03-03', weekEnd: '2026-03-07',
    marketNote: 'Jobs report week — calm before earnings',
    ticker: 'GLD', spotAtEntry: 188.40, strategy: 'Bull Put', strategySlug: 'bull-put',
    sentiment: 'BULLISH',
    legs: [
      { action: 'SELL', type: 'PUT', strike: 185, mid: 1.10, delta: -0.20 },
      { action: 'BUY', type: 'PUT', strike: 182, mid: 0.50, delta: -0.10 }
    ],
    expiry: '2026-03-07', dte: 5, netCredit: 0.60, maxProfit: 60, maxLoss: 240,
    winRateEstimate: 78, rewardRiskRatio: 0.25,
    outcome: 'WIN', closedAt: 'expiry', actualPnl: 57, pnlPercent: 95,
    spotAtExpiry: 189.80, closeReason: 'GLD drifted higher — puts expired worthless',
    createdAt: '2026-03-03T14:30:00Z', closedAtTs: '2026-03-07T21:00:00Z'
  },
  {
    weekId: '2026-W10', weekStart: '2026-03-03', weekEnd: '2026-03-07',
    marketNote: 'Jobs report week — calm before earnings',
    ticker: 'SPY', spotAtEntry: 600.20, strategy: 'Iron Condor', strategySlug: 'iron-condor',
    sentiment: 'NEUTRAL',
    legs: [
      { action: 'BUY', type: 'PUT', strike: 588, mid: 0.55, delta: -0.08 },
      { action: 'SELL', type: 'PUT', strike: 593, mid: 1.40, delta: -0.19 },
      { action: 'SELL', type: 'CALL', strike: 608, mid: 1.45, delta: 0.20 },
      { action: 'BUY', type: 'CALL', strike: 613, mid: 0.60, delta: 0.09 }
    ],
    expiry: '2026-03-07', dte: 5, netCredit: 1.70, maxProfit: 170, maxLoss: 330,
    winRateEstimate: 72, rewardRiskRatio: 0.52,
    outcome: 'WIN', closedAt: 'expiry', actualPnl: 162, pnlPercent: 95,
    spotAtExpiry: 602.50, closeReason: 'SPY barely moved — clean win',
    createdAt: '2026-03-03T14:30:00Z', closedAtTs: '2026-03-07T21:00:00Z'
  },
  {
    weekId: '2026-W10', weekStart: '2026-03-03', weekEnd: '2026-03-07',
    marketNote: 'Jobs report week — calm before earnings',
    ticker: 'QQQ', spotAtEntry: 524.80, strategy: 'BWB (Put)', strategySlug: 'bwb-put',
    sentiment: 'BULLISH',
    legs: [
      { action: 'BUY', type: 'PUT', strike: 510, mid: 0.55, delta: -0.08 },
      { action: 'SELL', type: 'PUT', strike: 518, mid: 1.80, delta: -0.22 },
      { action: 'SELL', type: 'PUT', strike: 518, mid: 1.80, delta: -0.22 },
      { action: 'BUY', type: 'PUT', strike: 526, mid: 3.60, delta: -0.48 }
    ],
    expiry: '2026-03-07', dte: 5, netCredit: 0.55, maxProfit: 855, maxLoss: 745,
    winRateEstimate: 60, rewardRiskRatio: 1.15,
    outcome: 'WIN', closedAt: 'expiry', actualPnl: 255, pnlPercent: 30,
    spotAtExpiry: 520.40, closeReason: 'QQQ settled in BWB profit zone',
    createdAt: '2026-03-03T14:30:00Z', closedAtTs: '2026-03-07T21:00:00Z'
  },
  {
    weekId: '2026-W10', weekStart: '2026-03-03', weekEnd: '2026-03-07',
    marketNote: 'Jobs report week — calm before earnings',
    ticker: 'TSLA', spotAtEntry: 360.80, strategy: 'Bull Put', strategySlug: 'bull-put',
    sentiment: 'BULLISH',
    legs: [
      { action: 'SELL', type: 'PUT', strike: 348, mid: 3.20, delta: -0.22 },
      { action: 'BUY', type: 'PUT', strike: 338, mid: 1.50, delta: -0.10 }
    ],
    expiry: '2026-03-07', dte: 5, netCredit: 1.70, maxProfit: 170, maxLoss: 830,
    winRateEstimate: 74, rewardRiskRatio: 0.20,
    outcome: 'WIN', closedAt: 'expiry', actualPnl: 162, pnlPercent: 95,
    spotAtExpiry: 365.20, closeReason: 'TSLA held above support — expired worthless',
    createdAt: '2026-03-03T14:30:00Z', closedAtTs: '2026-03-07T21:00:00Z'
  },

  // ═══════════════════════════════════════════════════════════════
  // W11 · Mar 10–14, 2026  —  4 WIN, 1 PARTIAL, 1 LOSS
  // ═══════════════════════════════════════════════════════════════
  {
    weekId: '2026-W11', weekStart: '2026-03-10', weekEnd: '2026-03-14',
    marketNote: 'CPI + PPI week — IV elevated then crushed',
    ticker: 'AAPL', spotAtEntry: 236.40, strategy: 'Iron Condor', strategySlug: 'iron-condor',
    sentiment: 'NEUTRAL',
    legs: [
      { action: 'BUY', type: 'PUT', strike: 224, mid: 0.50, delta: -0.08 },
      { action: 'SELL', type: 'PUT', strike: 229, mid: 1.30, delta: -0.19 },
      { action: 'SELL', type: 'CALL', strike: 244, mid: 1.35, delta: 0.20 },
      { action: 'BUY', type: 'CALL', strike: 249, mid: 0.55, delta: 0.09 }
    ],
    expiry: '2026-03-14', dte: 5, netCredit: 1.60, maxProfit: 160, maxLoss: 340,
    winRateEstimate: 72, rewardRiskRatio: 0.47,
    outcome: 'WIN', closedAt: 'expiry', actualPnl: 152, pnlPercent: 95,
    spotAtExpiry: 238.10, closeReason: 'AAPL range-bound post CPI',
    createdAt: '2026-03-10T14:30:00Z', closedAtTs: '2026-03-14T21:00:00Z'
  },
  {
    weekId: '2026-W11', weekStart: '2026-03-10', weekEnd: '2026-03-14',
    marketNote: 'CPI + PPI week — IV elevated then crushed',
    ticker: 'NVDA', spotAtEntry: 130.20, strategy: 'Iron Butterfly', strategySlug: 'iron-butterfly',
    sentiment: 'NEUTRAL',
    legs: [
      { action: 'BUY', type: 'PUT', strike: 120, mid: 0.40, delta: -0.06 },
      { action: 'SELL', type: 'PUT', strike: 130, mid: 3.80, delta: -0.45 },
      { action: 'SELL', type: 'CALL', strike: 130, mid: 3.90, delta: 0.50 },
      { action: 'BUY', type: 'CALL', strike: 140, mid: 0.80, delta: 0.10 }
    ],
    expiry: '2026-03-14', dte: 5, netCredit: 6.50, maxProfit: 650, maxLoss: 350,
    winRateEstimate: 42, rewardRiskRatio: 1.86,
    outcome: 'LOSS', closedAt: 'expiry', actualPnl: -350, pnlPercent: -100,
    spotAtExpiry: 141.80, closeReason: 'NVDA broke out above 140 on AI chip news',
    createdAt: '2026-03-10T14:30:00Z', closedAtTs: '2026-03-14T21:00:00Z'
  },
  {
    weekId: '2026-W11', weekStart: '2026-03-10', weekEnd: '2026-03-14',
    marketNote: 'CPI + PPI week — IV elevated then crushed',
    ticker: 'SPY', spotAtEntry: 601.80, strategy: 'Bull Put', strategySlug: 'bull-put',
    sentiment: 'BULLISH',
    legs: [
      { action: 'SELL', type: 'PUT', strike: 594, mid: 1.90, delta: -0.22 },
      { action: 'BUY', type: 'PUT', strike: 589, mid: 1.10, delta: -0.12 }
    ],
    expiry: '2026-03-14', dte: 5, netCredit: 0.80, maxProfit: 80, maxLoss: 420,
    winRateEstimate: 76, rewardRiskRatio: 0.19,
    outcome: 'WIN', closedAt: 'expiry', actualPnl: 76, pnlPercent: 95,
    spotAtExpiry: 604.20, closeReason: 'SPY held above 594 — CPI came in line',
    createdAt: '2026-03-10T14:30:00Z', closedAtTs: '2026-03-14T21:00:00Z'
  },
  {
    weekId: '2026-W11', weekStart: '2026-03-10', weekEnd: '2026-03-14',
    marketNote: 'CPI + PPI week — IV elevated then crushed',
    ticker: 'QQQ', spotAtEntry: 526.30, strategy: 'Iron Condor', strategySlug: 'iron-condor',
    sentiment: 'NEUTRAL',
    legs: [
      { action: 'BUY', type: 'PUT', strike: 513, mid: 0.55, delta: -0.08 },
      { action: 'SELL', type: 'PUT', strike: 518, mid: 1.45, delta: -0.20 },
      { action: 'SELL', type: 'CALL', strike: 534, mid: 1.50, delta: 0.21 },
      { action: 'BUY', type: 'CALL', strike: 539, mid: 0.60, delta: 0.09 }
    ],
    expiry: '2026-03-14', dte: 5, netCredit: 1.80, maxProfit: 180, maxLoss: 320,
    winRateEstimate: 70, rewardRiskRatio: 0.56,
    outcome: 'WIN', closedAt: 'expiry', actualPnl: 171, pnlPercent: 95,
    spotAtExpiry: 528.90, closeReason: 'QQQ stayed in range — IV crush helped',
    createdAt: '2026-03-10T14:30:00Z', closedAtTs: '2026-03-14T21:00:00Z'
  },
  {
    weekId: '2026-W11', weekStart: '2026-03-10', weekEnd: '2026-03-14',
    marketNote: 'CPI + PPI week — IV elevated then crushed',
    ticker: 'META', spotAtEntry: 618.50, strategy: 'Bear Call', strategySlug: 'bear-call',
    sentiment: 'BEARISH',
    legs: [
      { action: 'SELL', type: 'CALL', strike: 635, mid: 3.40, delta: 0.20 },
      { action: 'BUY', type: 'CALL', strike: 645, mid: 1.60, delta: 0.10 }
    ],
    expiry: '2026-03-14', dte: 5, netCredit: 1.80, maxProfit: 180, maxLoss: 820,
    winRateEstimate: 76, rewardRiskRatio: 0.22,
    outcome: 'PARTIAL', closedAt: 'early', actualPnl: 108, pnlPercent: 60,
    spotAtExpiry: 630.20, closeReason: 'Closed early at 60% — META creeping up',
    createdAt: '2026-03-10T14:30:00Z', closedAtTs: '2026-03-13T19:00:00Z'
  },
  {
    weekId: '2026-W11', weekStart: '2026-03-10', weekEnd: '2026-03-14',
    marketNote: 'CPI + PPI week — IV elevated then crushed',
    ticker: 'AMZN', spotAtEntry: 224.80, strategy: 'BWB (Put)', strategySlug: 'bwb-put',
    sentiment: 'BULLISH',
    legs: [
      { action: 'BUY', type: 'PUT', strike: 212, mid: 0.45, delta: -0.07 },
      { action: 'SELL', type: 'PUT', strike: 218, mid: 1.35, delta: -0.20 },
      { action: 'SELL', type: 'PUT', strike: 218, mid: 1.35, delta: -0.20 },
      { action: 'BUY', type: 'PUT', strike: 224, mid: 3.10, delta: -0.45 }
    ],
    expiry: '2026-03-14', dte: 5, netCredit: 0.05, maxProfit: 605, maxLoss: 595,
    winRateEstimate: 60, rewardRiskRatio: 1.02,
    outcome: 'WIN', closedAt: 'expiry', actualPnl: 205, pnlPercent: 34,
    spotAtExpiry: 220.30, closeReason: 'AMZN settled in BWB profit zone',
    createdAt: '2026-03-10T14:30:00Z', closedAtTs: '2026-03-14T21:00:00Z'
  },

  // ═══════════════════════════════════════════════════════════════
  // W12 · Mar 17–21, 2026  —  5 WIN
  // ═══════════════════════════════════════════════════════════════
  {
    weekId: '2026-W12', weekStart: '2026-03-17', weekEnd: '2026-03-21',
    marketNote: 'FOMC decision week — held rates, market rallied',
    ticker: 'SPY', spotAtEntry: 608.40, strategy: 'Bull Put', strategySlug: 'bull-put',
    sentiment: 'BULLISH',
    legs: [
      { action: 'SELL', type: 'PUT', strike: 600, mid: 2.10, delta: -0.22 },
      { action: 'BUY', type: 'PUT', strike: 595, mid: 1.20, delta: -0.12 }
    ],
    expiry: '2026-03-21', dte: 5, netCredit: 0.90, maxProfit: 90, maxLoss: 410,
    winRateEstimate: 78, rewardRiskRatio: 0.22,
    outcome: 'WIN', closedAt: 'expiry', actualPnl: 86, pnlPercent: 95,
    spotAtExpiry: 614.80, closeReason: 'SPY rallied on dovish FOMC — puts expired worthless',
    createdAt: '2026-03-17T14:30:00Z', closedAtTs: '2026-03-21T21:00:00Z'
  },
  {
    weekId: '2026-W12', weekStart: '2026-03-17', weekEnd: '2026-03-21',
    marketNote: 'FOMC decision week — held rates, market rallied',
    ticker: 'QQQ', spotAtEntry: 532.60, strategy: 'Iron Condor', strategySlug: 'iron-condor',
    sentiment: 'NEUTRAL',
    legs: [
      { action: 'BUY', type: 'PUT', strike: 519, mid: 0.55, delta: -0.08 },
      { action: 'SELL', type: 'PUT', strike: 524, mid: 1.40, delta: -0.19 },
      { action: 'SELL', type: 'CALL', strike: 541, mid: 1.45, delta: 0.20 },
      { action: 'BUY', type: 'CALL', strike: 546, mid: 0.60, delta: 0.09 }
    ],
    expiry: '2026-03-21', dte: 5, netCredit: 1.70, maxProfit: 170, maxLoss: 330,
    winRateEstimate: 72, rewardRiskRatio: 0.52,
    outcome: 'WIN', closedAt: 'expiry', actualPnl: 162, pnlPercent: 95,
    spotAtExpiry: 536.40, closeReason: 'QQQ post-FOMC rally stayed within condor range',
    createdAt: '2026-03-17T14:30:00Z', closedAtTs: '2026-03-21T21:00:00Z'
  },
  {
    weekId: '2026-W12', weekStart: '2026-03-17', weekEnd: '2026-03-21',
    marketNote: 'FOMC decision week — held rates, market rallied',
    ticker: 'MSFT', spotAtEntry: 418.90, strategy: 'Iron Condor', strategySlug: 'iron-condor',
    sentiment: 'NEUTRAL',
    legs: [
      { action: 'BUY', type: 'PUT', strike: 408, mid: 0.50, delta: -0.08 },
      { action: 'SELL', type: 'PUT', strike: 412, mid: 1.20, delta: -0.18 },
      { action: 'SELL', type: 'CALL', strike: 426, mid: 1.30, delta: 0.20 },
      { action: 'BUY', type: 'CALL', strike: 430, mid: 0.55, delta: 0.09 }
    ],
    expiry: '2026-03-21', dte: 5, netCredit: 1.45, maxProfit: 145, maxLoss: 255,
    winRateEstimate: 72, rewardRiskRatio: 0.57,
    outcome: 'WIN', closedAt: 'expiry', actualPnl: 138, pnlPercent: 95,
    spotAtExpiry: 421.30, closeReason: 'MSFT stayed in tight range',
    createdAt: '2026-03-17T14:30:00Z', closedAtTs: '2026-03-21T21:00:00Z'
  },
  {
    weekId: '2026-W12', weekStart: '2026-03-17', weekEnd: '2026-03-21',
    marketNote: 'FOMC decision week — held rates, market rallied',
    ticker: 'AAPL', spotAtEntry: 240.20, strategy: 'BWB (Call)', strategySlug: 'bwb-call',
    sentiment: 'BULLISH',
    legs: [
      { action: 'BUY', type: 'CALL', strike: 238, mid: 5.80, delta: 0.55 },
      { action: 'SELL', type: 'CALL', strike: 245, mid: 3.20, delta: 0.32 },
      { action: 'SELL', type: 'CALL', strike: 245, mid: 3.20, delta: 0.32 },
      { action: 'BUY', type: 'CALL', strike: 252, mid: 1.20, delta: 0.12 }
    ],
    expiry: '2026-03-21', dte: 5, netCredit: 0.40, maxProfit: 740, maxLoss: 660,
    winRateEstimate: 50, rewardRiskRatio: 1.12,
    outcome: 'WIN', closedAt: 'expiry', actualPnl: 340, pnlPercent: 46,
    spotAtExpiry: 243.80, closeReason: 'AAPL rallied into BWB sweet spot post-FOMC',
    createdAt: '2026-03-17T14:30:00Z', closedAtTs: '2026-03-21T21:00:00Z'
  },
  {
    weekId: '2026-W12', weekStart: '2026-03-17', weekEnd: '2026-03-21',
    marketNote: 'FOMC decision week — held rates, market rallied',
    ticker: 'GLD', spotAtEntry: 190.60, strategy: 'Iron Condor', strategySlug: 'iron-condor',
    sentiment: 'NEUTRAL',
    legs: [
      { action: 'BUY', type: 'PUT', strike: 186, mid: 0.40, delta: -0.09 },
      { action: 'SELL', type: 'PUT', strike: 188, mid: 0.85, delta: -0.18 },
      { action: 'SELL', type: 'CALL', strike: 193, mid: 0.90, delta: 0.20 },
      { action: 'BUY', type: 'CALL', strike: 195, mid: 0.40, delta: 0.10 }
    ],
    expiry: '2026-03-21', dte: 5, netCredit: 0.95, maxProfit: 95, maxLoss: 105,
    winRateEstimate: 74, rewardRiskRatio: 0.90,
    outcome: 'WIN', closedAt: 'expiry', actualPnl: 90, pnlPercent: 95,
    spotAtExpiry: 191.20, closeReason: 'GLD flat — gold quiet on rate hold',
    createdAt: '2026-03-17T14:30:00Z', closedAtTs: '2026-03-21T21:00:00Z'
  },

  // ═══════════════════════════════════════════════════════════════
  // W13 · Mar 23–27, 2026  —  3 WIN, 1 PARTIAL, 2 LOSS
  // ═══════════════════════════════════════════════════════════════
  {
    weekId: '2026-W13', weekStart: '2026-03-23', weekEnd: '2026-03-27',
    marketNote: 'Tariff headline risk — choppy, directional',
    ticker: 'SPY', spotAtEntry: 610.80, strategy: 'Iron Condor', strategySlug: 'iron-condor',
    sentiment: 'NEUTRAL',
    legs: [
      { action: 'BUY', type: 'PUT', strike: 598, mid: 0.55, delta: -0.08 },
      { action: 'SELL', type: 'PUT', strike: 603, mid: 1.40, delta: -0.19 },
      { action: 'SELL', type: 'CALL', strike: 618, mid: 1.45, delta: 0.20 },
      { action: 'BUY', type: 'CALL', strike: 623, mid: 0.60, delta: 0.09 }
    ],
    expiry: '2026-03-27', dte: 5, netCredit: 1.70, maxProfit: 170, maxLoss: 330,
    winRateEstimate: 72, rewardRiskRatio: 0.52,
    outcome: 'WIN', closedAt: 'expiry', actualPnl: 162, pnlPercent: 95,
    spotAtExpiry: 608.40, closeReason: 'SPY chopped but stayed in range',
    createdAt: '2026-03-23T14:30:00Z', closedAtTs: '2026-03-27T21:00:00Z'
  },
  {
    weekId: '2026-W13', weekStart: '2026-03-23', weekEnd: '2026-03-27',
    marketNote: 'Tariff headline risk — choppy, directional',
    ticker: 'TSLA', spotAtEntry: 345.80, strategy: 'BWB (Put)', strategySlug: 'bwb-put',
    sentiment: 'BULLISH',
    legs: [
      { action: 'BUY', type: 'PUT', strike: 320, mid: 0.80, delta: -0.08 },
      { action: 'SELL', type: 'PUT', strike: 335, mid: 2.60, delta: -0.22 },
      { action: 'SELL', type: 'PUT', strike: 335, mid: 2.60, delta: -0.22 },
      { action: 'BUY', type: 'PUT', strike: 350, mid: 6.20, delta: -0.52 }
    ],
    expiry: '2026-03-28', dte: 5, netCredit: -1.20, maxProfit: 1380, maxLoss: 120,
    winRateEstimate: 40, rewardRiskRatio: 11.5,
    outcome: 'LOSS', closedAt: 'expiry', actualPnl: -120, pnlPercent: -100,
    spotAtExpiry: 368.40, closeReason: 'TSLA rallied on tariff exemption — blew through all strikes',
    createdAt: '2026-03-23T14:30:00Z', closedAtTs: '2026-03-28T21:00:00Z'
  },
  {
    weekId: '2026-W13', weekStart: '2026-03-23', weekEnd: '2026-03-27',
    marketNote: 'Tariff headline risk — choppy, directional',
    ticker: 'GLD', spotAtEntry: 192.30, strategy: 'Iron Condor', strategySlug: 'iron-condor',
    sentiment: 'NEUTRAL',
    legs: [
      { action: 'BUY', type: 'PUT', strike: 188, mid: 0.45, delta: -0.09 },
      { action: 'SELL', type: 'PUT', strike: 190, mid: 0.95, delta: -0.19 },
      { action: 'SELL', type: 'CALL', strike: 195, mid: 0.90, delta: 0.20 },
      { action: 'BUY', type: 'CALL', strike: 197, mid: 0.40, delta: 0.10 }
    ],
    expiry: '2026-03-27', dte: 5, netCredit: 1.00, maxProfit: 100, maxLoss: 100,
    winRateEstimate: 74, rewardRiskRatio: 1.00,
    outcome: 'WIN', closedAt: 'expiry', actualPnl: 95, pnlPercent: 95,
    spotAtExpiry: 193.80, closeReason: 'GLD held range — safe haven bid contained',
    createdAt: '2026-03-23T14:30:00Z', closedAtTs: '2026-03-27T21:00:00Z'
  },
  {
    weekId: '2026-W13', weekStart: '2026-03-23', weekEnd: '2026-03-27',
    marketNote: 'Tariff headline risk — choppy, directional',
    ticker: 'NVDA', spotAtEntry: 138.60, strategy: 'Bear Call', strategySlug: 'bear-call',
    sentiment: 'BEARISH',
    legs: [
      { action: 'SELL', type: 'CALL', strike: 145, mid: 2.80, delta: 0.22 },
      { action: 'BUY', type: 'CALL', strike: 152, mid: 1.20, delta: 0.10 }
    ],
    expiry: '2026-03-27', dte: 5, netCredit: 1.60, maxProfit: 160, maxLoss: 540,
    winRateEstimate: 74, rewardRiskRatio: 0.30,
    outcome: 'LOSS', closedAt: 'expiry', actualPnl: -540, pnlPercent: -100,
    spotAtExpiry: 155.20, closeReason: 'NVDA broke out above 152 on data centre deal news',
    createdAt: '2026-03-23T14:30:00Z', closedAtTs: '2026-03-27T21:00:00Z'
  },
  {
    weekId: '2026-W13', weekStart: '2026-03-23', weekEnd: '2026-03-27',
    marketNote: 'Tariff headline risk — choppy, directional',
    ticker: 'META', spotAtEntry: 625.80, strategy: 'Bull Put', strategySlug: 'bull-put',
    sentiment: 'BULLISH',
    legs: [
      { action: 'SELL', type: 'PUT', strike: 615, mid: 3.60, delta: -0.22 },
      { action: 'BUY', type: 'PUT', strike: 605, mid: 1.70, delta: -0.10 }
    ],
    expiry: '2026-03-27', dte: 5, netCredit: 1.90, maxProfit: 190, maxLoss: 810,
    winRateEstimate: 74, rewardRiskRatio: 0.23,
    outcome: 'PARTIAL', closedAt: 'early', actualPnl: 114, pnlPercent: 60,
    spotAtExpiry: 618.40, closeReason: 'Closed early at 60% — tariff fears rattled tech',
    createdAt: '2026-03-23T14:30:00Z', closedAtTs: '2026-03-26T19:00:00Z'
  },
  {
    weekId: '2026-W13', weekStart: '2026-03-23', weekEnd: '2026-03-27',
    marketNote: 'Tariff headline risk — choppy, directional',
    ticker: 'QQQ', spotAtEntry: 534.20, strategy: 'Calendar Spread', strategySlug: 'calendar',
    sentiment: 'NEUTRAL',
    legs: [
      { action: 'SELL', type: 'CALL', strike: 535, mid: 3.20, delta: 0.48 },
      { action: 'BUY', type: 'CALL', strike: 535, mid: 5.80, delta: 0.50 }
    ],
    expiry: '2026-03-27', dte: 5, netCredit: -2.60, maxProfit: 260, maxLoss: 260,
    winRateEstimate: 55, rewardRiskRatio: 1.00,
    outcome: 'WIN', closedAt: 'early', actualPnl: 156, pnlPercent: 60,
    spotAtExpiry: 535.80, closeReason: 'QQQ pinned near strike — calendar spread gained value',
    createdAt: '2026-03-23T14:30:00Z', closedAtTs: '2026-03-26T20:00:00Z'
  },

  // ═══════════════════════════════════════════════════════════════
  // W14 · Mar 30 – Apr 3, 2026  —  6 WIN
  // ═══════════════════════════════════════════════════════════════
  {
    weekId: '2026-W14', weekStart: '2026-03-30', weekEnd: '2026-04-03',
    marketNote: 'Quarter-end + earnings — IV crush plays worked',
    ticker: 'AAPL', spotAtEntry: 245.20, strategy: 'Iron Condor', strategySlug: 'iron-condor',
    sentiment: 'NEUTRAL',
    legs: [
      { action: 'BUY', type: 'PUT', strike: 234, mid: 0.50, delta: -0.08 },
      { action: 'SELL', type: 'PUT', strike: 239, mid: 1.30, delta: -0.19 },
      { action: 'SELL', type: 'CALL', strike: 252, mid: 1.35, delta: 0.20 },
      { action: 'BUY', type: 'CALL', strike: 257, mid: 0.55, delta: 0.09 }
    ],
    expiry: '2026-04-03', dte: 5, netCredit: 1.60, maxProfit: 160, maxLoss: 340,
    winRateEstimate: 72, rewardRiskRatio: 0.47,
    outcome: 'WIN', closedAt: 'expiry', actualPnl: 152, pnlPercent: 95,
    spotAtExpiry: 247.80, closeReason: 'AAPL stayed in range — quarterly rebalance had no impact',
    createdAt: '2026-03-30T14:30:00Z', closedAtTs: '2026-04-03T21:00:00Z'
  },
  {
    weekId: '2026-W14', weekStart: '2026-03-30', weekEnd: '2026-04-03',
    marketNote: 'Quarter-end + earnings — IV crush plays worked',
    ticker: 'AMZN', spotAtEntry: 226.40, strategy: 'Bull Put', strategySlug: 'bull-put',
    sentiment: 'BULLISH',
    legs: [
      { action: 'SELL', type: 'PUT', strike: 220, mid: 1.60, delta: -0.22 },
      { action: 'BUY', type: 'PUT', strike: 215, mid: 0.80, delta: -0.10 }
    ],
    expiry: '2026-04-03', dte: 5, netCredit: 0.80, maxProfit: 80, maxLoss: 420,
    winRateEstimate: 76, rewardRiskRatio: 0.19,
    outcome: 'WIN', closedAt: 'expiry', actualPnl: 76, pnlPercent: 95,
    spotAtExpiry: 229.60, closeReason: 'AMZN held above 220 easily',
    createdAt: '2026-03-30T14:30:00Z', closedAtTs: '2026-04-03T21:00:00Z'
  },
  {
    weekId: '2026-W14', weekStart: '2026-03-30', weekEnd: '2026-04-03',
    marketNote: 'Quarter-end + earnings — IV crush plays worked',
    ticker: 'GLD', spotAtEntry: 194.80, strategy: 'Cash Secured Put', strategySlug: 'csp',
    sentiment: 'BULLISH',
    legs: [
      { action: 'SELL', type: 'PUT', strike: 190, mid: 1.20, delta: -0.20 }
    ],
    expiry: '2026-04-03', dte: 5, netCredit: 1.20, maxProfit: 120, maxLoss: 18880,
    winRateEstimate: 80, rewardRiskRatio: 0.01,
    outcome: 'PARTIAL', closedAt: 'early', actualPnl: 72, pnlPercent: 60,
    spotAtExpiry: 191.40, closeReason: 'Closed early at 60% — GLD drifting toward strike',
    createdAt: '2026-03-30T14:30:00Z', closedAtTs: '2026-04-02T19:00:00Z'
  },
  {
    weekId: '2026-W14', weekStart: '2026-03-30', weekEnd: '2026-04-03',
    marketNote: 'Quarter-end + earnings — IV crush plays worked',
    ticker: 'QQQ', spotAtEntry: 538.40, strategy: 'BWB (Put)', strategySlug: 'bwb-put',
    sentiment: 'BULLISH',
    legs: [
      { action: 'BUY', type: 'PUT', strike: 524, mid: 0.60, delta: -0.08 },
      { action: 'SELL', type: 'PUT', strike: 531, mid: 1.80, delta: -0.22 },
      { action: 'SELL', type: 'PUT', strike: 531, mid: 1.80, delta: -0.22 },
      { action: 'BUY', type: 'PUT', strike: 538, mid: 3.60, delta: -0.48 }
    ],
    expiry: '2026-04-03', dte: 5, netCredit: 0.40, maxProfit: 740, maxLoss: 660,
    winRateEstimate: 58, rewardRiskRatio: 1.12,
    outcome: 'WIN', closedAt: 'expiry', actualPnl: 340, pnlPercent: 46,
    spotAtExpiry: 533.20, closeReason: 'QQQ settled in BWB profit zone',
    createdAt: '2026-03-30T14:30:00Z', closedAtTs: '2026-04-03T21:00:00Z'
  },
  {
    weekId: '2026-W14', weekStart: '2026-03-30', weekEnd: '2026-04-03',
    marketNote: 'Quarter-end + earnings — IV crush plays worked',
    ticker: 'NVDA', spotAtEntry: 148.60, strategy: 'Iron Condor', strategySlug: 'iron-condor',
    sentiment: 'NEUTRAL',
    legs: [
      { action: 'BUY', type: 'PUT', strike: 139, mid: 0.60, delta: -0.08 },
      { action: 'SELL', type: 'PUT', strike: 143, mid: 1.55, delta: -0.20 },
      { action: 'SELL', type: 'CALL', strike: 154, mid: 1.60, delta: 0.21 },
      { action: 'BUY', type: 'CALL', strike: 158, mid: 0.65, delta: 0.09 }
    ],
    expiry: '2026-04-03', dte: 5, netCredit: 1.90, maxProfit: 190, maxLoss: 210,
    winRateEstimate: 70, rewardRiskRatio: 0.90,
    outcome: 'WIN', closedAt: 'expiry', actualPnl: 181, pnlPercent: 95,
    spotAtExpiry: 150.20, closeReason: 'NVDA consolidated after W13 breakout',
    createdAt: '2026-03-30T14:30:00Z', closedAtTs: '2026-04-03T21:00:00Z'
  },
  {
    weekId: '2026-W14', weekStart: '2026-03-30', weekEnd: '2026-04-03',
    marketNote: 'Quarter-end + earnings — IV crush plays worked',
    ticker: 'MSFT', spotAtEntry: 420.80, strategy: 'Bull Put', strategySlug: 'bull-put',
    sentiment: 'BULLISH',
    legs: [
      { action: 'SELL', type: 'PUT', strike: 414, mid: 1.60, delta: -0.20 },
      { action: 'BUY', type: 'PUT', strike: 409, mid: 0.85, delta: -0.11 }
    ],
    expiry: '2026-04-03', dte: 5, netCredit: 0.75, maxProfit: 75, maxLoss: 425,
    winRateEstimate: 78, rewardRiskRatio: 0.18,
    outcome: 'WIN', closedAt: 'expiry', actualPnl: 71, pnlPercent: 95,
    spotAtExpiry: 423.40, closeReason: 'MSFT held above 414 — strong Q1 close',
    createdAt: '2026-03-30T14:30:00Z', closedAtTs: '2026-04-03T21:00:00Z'
  },

  // ═══════════════════════════════════════════════════════════════
  // W15 · Apr 6–10, 2026  —  4 WIN, 1 PARTIAL
  // ═══════════════════════════════════════════════════════════════
  {
    weekId: '2026-W15', weekStart: '2026-04-06', weekEnd: '2026-04-10',
    marketNote: 'CPI data week — low IV environment',
    ticker: 'NVDA', spotAtEntry: 152.40, strategy: 'Iron Condor', strategySlug: 'iron-condor',
    sentiment: 'NEUTRAL',
    legs: [
      { action: 'BUY', type: 'PUT', strike: 143, mid: 0.55, delta: -0.08 },
      { action: 'SELL', type: 'PUT', strike: 147, mid: 1.40, delta: -0.20 },
      { action: 'SELL', type: 'CALL', strike: 158, mid: 1.45, delta: 0.21 },
      { action: 'BUY', type: 'CALL', strike: 162, mid: 0.60, delta: 0.09 }
    ],
    expiry: '2026-04-10', dte: 5, netCredit: 1.70, maxProfit: 170, maxLoss: 230,
    winRateEstimate: 72, rewardRiskRatio: 0.74,
    outcome: 'WIN', closedAt: 'expiry', actualPnl: 162, pnlPercent: 95,
    spotAtExpiry: 154.80, closeReason: 'NVDA held range — no catalyst',
    createdAt: '2026-04-06T14:30:00Z', closedAtTs: '2026-04-10T21:00:00Z'
  },
  {
    weekId: '2026-W15', weekStart: '2026-04-06', weekEnd: '2026-04-10',
    marketNote: 'CPI data week — low IV environment',
    ticker: 'TSLA', spotAtEntry: 358.60, strategy: 'Bull Put', strategySlug: 'bull-put',
    sentiment: 'BULLISH',
    legs: [
      { action: 'SELL', type: 'PUT', strike: 345, mid: 3.00, delta: -0.22 },
      { action: 'BUY', type: 'PUT', strike: 335, mid: 1.40, delta: -0.10 }
    ],
    expiry: '2026-04-10', dte: 5, netCredit: 1.60, maxProfit: 160, maxLoss: 840,
    winRateEstimate: 74, rewardRiskRatio: 0.19,
    outcome: 'WIN', closedAt: 'expiry', actualPnl: 152, pnlPercent: 95,
    spotAtExpiry: 362.40, closeReason: 'TSLA held above 345 — puts expired worthless',
    createdAt: '2026-04-06T14:30:00Z', closedAtTs: '2026-04-10T21:00:00Z'
  },
  {
    weekId: '2026-W15', weekStart: '2026-04-06', weekEnd: '2026-04-10',
    marketNote: 'CPI data week — low IV environment',
    ticker: 'SPY', spotAtEntry: 612.60, strategy: 'Iron Condor', strategySlug: 'iron-condor',
    sentiment: 'NEUTRAL',
    legs: [
      { action: 'BUY', type: 'PUT', strike: 600, mid: 0.55, delta: -0.08 },
      { action: 'SELL', type: 'PUT', strike: 605, mid: 1.40, delta: -0.19 },
      { action: 'SELL', type: 'CALL', strike: 620, mid: 1.45, delta: 0.20 },
      { action: 'BUY', type: 'CALL', strike: 625, mid: 0.60, delta: 0.09 }
    ],
    expiry: '2026-04-10', dte: 5, netCredit: 1.70, maxProfit: 170, maxLoss: 330,
    winRateEstimate: 72, rewardRiskRatio: 0.52,
    outcome: 'WIN', closedAt: 'expiry', actualPnl: 162, pnlPercent: 95,
    spotAtExpiry: 614.20, closeReason: 'SPY stayed in range — CPI benign',
    createdAt: '2026-04-06T14:30:00Z', closedAtTs: '2026-04-10T21:00:00Z'
  },
  {
    weekId: '2026-W15', weekStart: '2026-04-06', weekEnd: '2026-04-10',
    marketNote: 'CPI data week — low IV environment',
    ticker: 'MSFT', spotAtEntry: 422.40, strategy: 'Calendar Spread', strategySlug: 'calendar',
    sentiment: 'NEUTRAL',
    legs: [
      { action: 'SELL', type: 'PUT', strike: 422, mid: 3.40, delta: -0.48 },
      { action: 'BUY', type: 'PUT', strike: 422, mid: 5.60, delta: -0.45 }
    ],
    expiry: '2026-04-10', dte: 5, netCredit: -2.20, maxProfit: 220, maxLoss: 220,
    winRateEstimate: 52, rewardRiskRatio: 1.00,
    outcome: 'PARTIAL', closedAt: 'early', actualPnl: 110, pnlPercent: 50,
    spotAtExpiry: 424.60, closeReason: 'Closed at 50% — MSFT drifting away from strike',
    createdAt: '2026-04-06T14:30:00Z', closedAtTs: '2026-04-09T19:00:00Z'
  },
  {
    weekId: '2026-W15', weekStart: '2026-04-06', weekEnd: '2026-04-10',
    marketNote: 'CPI data week — low IV environment',
    ticker: 'META', spotAtEntry: 630.20, strategy: 'BWB (Put)', strategySlug: 'bwb-put',
    sentiment: 'BULLISH',
    legs: [
      { action: 'BUY', type: 'PUT', strike: 615, mid: 1.60, delta: -0.10 },
      { action: 'SELL', type: 'PUT', strike: 623, mid: 3.60, delta: -0.22 },
      { action: 'SELL', type: 'PUT', strike: 623, mid: 3.60, delta: -0.22 },
      { action: 'BUY', type: 'PUT', strike: 631, mid: 6.80, delta: -0.50 }
    ],
    expiry: '2026-04-10', dte: 5, netCredit: 0.40, maxProfit: 840, maxLoss: 760,
    winRateEstimate: 55, rewardRiskRatio: 1.11,
    outcome: 'WIN', closedAt: 'expiry', actualPnl: 304, pnlPercent: 36,
    spotAtExpiry: 625.40, closeReason: 'META settled in BWB profit zone',
    createdAt: '2026-04-06T14:30:00Z', closedAtTs: '2026-04-10T21:00:00Z'
  }
];

// ── Seed logic ───────────────────────────────────────────────────
async function seed() {
  const CLEAR = process.argv.includes('--clear');
  const col = db.collection('pick_outcomes');

  if (CLEAR) {
    console.log('  Clearing existing pick_outcomes...');
    const snap = await col.get();
    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    if (snap.size) await batch.commit();
    console.log(`  Deleted ${snap.size} documents.`);
  }

  console.log(`\n  Seeding ${picks.length} picks across 9 weeks...\n`);

  // Use batched writes (max 500 per batch)
  const batch = db.batch();
  let count = 0;

  for (const pick of picks) {
    const id = docId(pick.weekId, pick.ticker, pick.strategySlug);
    const ref = col.doc(id);
    batch.set(ref, pick);
    count++;
  }

  await batch.commit();

  // Print summary
  const weekMap = {};
  for (const p of picks) {
    if (!weekMap[p.weekId]) weekMap[p.weekId] = { total: 0, wins: 0, partials: 0, losses: 0, pnl: 0 };
    weekMap[p.weekId].total++;
    if (p.outcome === 'WIN') weekMap[p.weekId].wins++;
    else if (p.outcome === 'PARTIAL') weekMap[p.weekId].partials++;
    else weekMap[p.weekId].losses++;
    weekMap[p.weekId].pnl += p.actualPnl;
  }

  let totalWins = 0, totalPicks = 0, totalPnl = 0;
  for (const [week, s] of Object.entries(weekMap).sort()) {
    totalWins += s.wins;
    totalPicks += s.total;
    totalPnl += s.pnl;
    const pnlStr = s.pnl >= 0 ? `+$${s.pnl}` : `-$${Math.abs(s.pnl)}`;
    console.log(`  ${week}  ${s.total} picks  ${s.wins}W ${s.partials}P ${s.losses}L  ${pnlStr}`);
  }

  const winRate = ((totalWins / totalPicks) * 100).toFixed(1);
  const pnlStr = totalPnl >= 0 ? `+$${totalPnl}` : `-$${Math.abs(totalPnl)}`;
  console.log(`\n  ────────────────────────────────────────`);
  console.log(`  Total: ${totalPicks} picks, ${totalWins} wins (${winRate}%), ${pnlStr} cumulative P&L`);
  console.log(`  ────────────────────────────────────────\n`);

  console.log(`  ✓ Seeded ${count} documents to pick_outcomes\n`);
  process.exit(0);
}

seed().catch(err => {
  console.error('Seed failed:', err);
  process.exit(1);
});
