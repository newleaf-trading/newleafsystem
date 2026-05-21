/**
 * Synthetic 45-day ADBE Iron Condor lifecycle for the /how-we-manage demo.
 *
 * Designed to hit specific verdict transitions:
 *   Days 0-15:  ON_TRACK     — ADBE drifts up mildly, theta collecting
 *   Days 16-24: MONITOR      — ADBE approaches short call, delta ≥ 0.25
 *   Days 25-31: MONITOR      — ADBE pulls back slightly, stays in amber zone
 *   Day 32:     ACTION_NEEDED — ADBE gaps to $544, delta crosses 0.35
 *   Days 33-38: ACTION_NEEDED → MONITOR — elevated but stabilising after adjustment
 *   Day 39-44:  MONITOR → ON_TRACK — position recovers
 *   Day 45:     TAKE_PROFIT   — 50% max profit captured
 *
 * Each session contains the data needed to call evaluate() from verdictEngine.js.
 * This file is the single source of truth for the demo — swap it for real data later.
 *
 * @typedef {object} DemoSession
 * @property {number} day — 0-45
 * @property {number} spot — ADBE price
 * @property {number} shortDelta — absolute value of the tested short leg's delta
 * @property {number} dte — days to expiry
 * @property {number} pnl — unrealized P&L per contract in dollars
 * @property {number} profitCapturePct — % of max profit captured (0-100)
 * @property {number} ivRank — current IV rank (0-100)
 * @property {string} caption — narrator text for this session (null = interpolate)
 */

// ─── Position definition (constant throughout the demo) ───

export const DEMO_POSITION = {
  strategy: 'iron_condor',
  symbol: 'ADBE',
  legs: [
    { action: 'buy',  type: 'put',  strike: 500, premium: 1.80, iv: 0.28, expiry: '2026-06-06' },
    { action: 'sell', type: 'put',  strike: 510, premium: 3.20, iv: 0.26, expiry: '2026-06-06' },
    { action: 'sell', type: 'call', strike: 540, premium: 4.50, iv: 0.24, expiry: '2026-06-06' },
    { action: 'buy',  type: 'call', strike: 550, premium: 2.10, iv: 0.22, expiry: '2026-06-06' },
  ],
  entryNetCredit: 380, // $3.80 per share × 100 = $380 per contract
  entrySpot: 525,
  entryIvRank: 42,
  expiry: '2026-06-06',
  maxProfit: 380, // net credit received
  maxLoss: 620,   // spread width ($10 × 100) minus credit ($380)
};

// ─── 45-day session data ───

export const DEMO_SESSIONS = [
  // Days 0-5: Quiet start. ON_TRACK.
  { day: 0,  spot: 525.00, shortDelta: 0.12, dte: 45, pnl: 0,    profitCapturePct: 0,  ivRank: 42, caption: "You've just entered. ADBE is at $525, sitting between your short strikes. The position is collecting theta decay. Nothing to do." },
  { day: 1,  spot: 525.50, shortDelta: 0.12, dte: 44, pnl: 8,    profitCapturePct: 2,  ivRank: 41, caption: null },
  { day: 2,  spot: 526.20, shortDelta: 0.13, dte: 43, pnl: 15,   profitCapturePct: 4,  ivRank: 41, caption: null },
  { day: 3,  spot: 524.80, shortDelta: 0.11, dte: 42, pnl: 22,   profitCapturePct: 6,  ivRank: 40, caption: null },
  { day: 4,  spot: 526.50, shortDelta: 0.13, dte: 41, pnl: 30,   profitCapturePct: 8,  ivRank: 40, caption: null },
  { day: 5,  spot: 527.00, shortDelta: 0.14, dte: 40, pnl: 38,   profitCapturePct: 10, ivRank: 39, caption: "Five days in. Theta is working. ADBE is drifting slowly upward but well within the profit zone. The system sees nothing to worry about." },

  // Days 6-15: Slow drift up. Still ON_TRACK.
  { day: 6,  spot: 528.00, shortDelta: 0.15, dte: 39, pnl: 44,   profitCapturePct: 12, ivRank: 39, caption: null },
  { day: 7,  spot: 529.50, shortDelta: 0.16, dte: 38, pnl: 50,   profitCapturePct: 13, ivRank: 38, caption: null },
  { day: 8,  spot: 530.00, shortDelta: 0.16, dte: 37, pnl: 55,   profitCapturePct: 14, ivRank: 38, caption: null },
  { day: 9,  spot: 529.00, shortDelta: 0.15, dte: 36, pnl: 60,   profitCapturePct: 16, ivRank: 37, caption: null },
  { day: 10, spot: 531.00, shortDelta: 0.17, dte: 35, pnl: 65,   profitCapturePct: 17, ivRank: 37, caption: "Day 10. Position is 17% toward its target. Theta decay is doing its job. The call side is starting to feel the approach, but delta is still well under the 0.25 threshold." },
  { day: 11, spot: 532.00, shortDelta: 0.18, dte: 34, pnl: 68,   profitCapturePct: 18, ivRank: 36, caption: null },
  { day: 12, spot: 533.50, shortDelta: 0.19, dte: 33, pnl: 70,   profitCapturePct: 18, ivRank: 36, caption: null },
  { day: 13, spot: 534.00, shortDelta: 0.20, dte: 32, pnl: 72,   profitCapturePct: 19, ivRank: 35, caption: null },
  { day: 14, spot: 533.00, shortDelta: 0.19, dte: 31, pnl: 78,   profitCapturePct: 21, ivRank: 35, caption: null },
  { day: 15, spot: 535.00, shortDelta: 0.21, dte: 30, pnl: 82,   profitCapturePct: 22, ivRank: 34, caption: "Halfway through the first month. ADBE has drifted to $535. Short delta is 0.21 — approaching the 0.25 watch line. Not there yet." },

  // Days 16-24: ADBE drifts up. MONITOR triggers at delta 0.25.
  { day: 16, spot: 533.00, shortDelta: 0.25, dte: 29, pnl: 72,   profitCapturePct: 19, ivRank: 35, caption: null },
  { day: 17, spot: 533.50, shortDelta: 0.26, dte: 28, pnl: 68,   profitCapturePct: 18, ivRank: 36, caption: null },
  { day: 18, spot: 534.00, shortDelta: 0.26, dte: 27, pnl: 62,   profitCapturePct: 16, ivRank: 37, caption: "ADBE reaches $534. Short call delta hits 0.26 — above the 0.25 threshold. The system escalates to MONITOR. No action needed yet, but it's paying closer attention now." },
  { day: 19, spot: 533.00, shortDelta: 0.25, dte: 26, pnl: 65,   profitCapturePct: 17, ivRank: 36, caption: null },
  { day: 20, spot: 534.50, shortDelta: 0.27, dte: 25, pnl: 58,   profitCapturePct: 15, ivRank: 37, caption: null },
  { day: 21, spot: 534.00, shortDelta: 0.26, dte: 24, pnl: 60,   profitCapturePct: 16, ivRank: 37, caption: "Still in MONITOR. ADBE is oscillating around $534. Delta at 0.26. The system holds — the 0.35 threshold for ACTION_NEEDED hasn't been touched." },
  { day: 22, spot: 535.00, shortDelta: 0.28, dte: 23, pnl: 52,   profitCapturePct: 14, ivRank: 38, caption: null },
  { day: 23, spot: 534.00, shortDelta: 0.26, dte: 22, pnl: 55,   profitCapturePct: 14, ivRank: 37, caption: null },
  { day: 24, spot: 533.00, shortDelta: 0.25, dte: 21, pnl: 60,   profitCapturePct: 16, ivRank: 36, caption: "Day 24. Delta at 0.25. The 21-DTE rule is now active: any short-premium position at 21 DTE or below with less than 50% profit gets extra scrutiny." },

  // Days 25-31: ADBE drifts slightly, stays in MONITOR. Slow build toward the gap.
  { day: 25, spot: 532.00, shortDelta: 0.25, dte: 20, pnl: 65,   profitCapturePct: 17, ivRank: 35, caption: null },
  { day: 26, spot: 533.00, shortDelta: 0.26, dte: 19, pnl: 62,   profitCapturePct: 16, ivRank: 35, caption: null },
  { day: 27, spot: 534.00, shortDelta: 0.27, dte: 18, pnl: 58,   profitCapturePct: 15, ivRank: 36, caption: null },
  { day: 28, spot: 535.00, shortDelta: 0.28, dte: 17, pnl: 50,   profitCapturePct: 13, ivRank: 37, caption: null },
  { day: 29, spot: 534.00, shortDelta: 0.27, dte: 16, pnl: 55,   profitCapturePct: 14, ivRank: 36, caption: "Day 29. ADBE drifting around $534. Delta at 0.27. Still in MONITOR. The system is watching closely but hasn't crossed the 0.35 line." },
  { day: 30, spot: 535.00, shortDelta: 0.29, dte: 15, pnl: 48,   profitCapturePct: 13, ivRank: 38, caption: null },
  { day: 31, spot: 536.00, shortDelta: 0.31, dte: 14, pnl: 40,   profitCapturePct: 11, ivRank: 39, caption: "ADBE at $536. Delta climbing to 0.31. Getting closer to the ACTION_NEEDED line but not there yet." },

  // Day 32: The moment. ACTION_NEEDED fires.
  { day: 32, spot: 544.00, shortDelta: 0.42, dte: 13, pnl: -47,  profitCapturePct: -12, ivRank: 48, caption: "ADBE gaps to $544 on a sector catalyst. Short call delta jumps to 0.42 — well past the 0.35 threshold. The system fires ACTION_NEEDED and immediately prepares adjustment recommendations. The top recommendation: roll the call side further OTM and out to next week." },

  // Days 33-38: Post-adjustment, position stabilises. MONITOR.
  { day: 33, spot: 543.00, shortDelta: 0.38, dte: 12, pnl: -35,  profitCapturePct: -9,  ivRank: 46, caption: "The adjustment has been flagged. If the trader rolls the call side out, the new position has a wider profit zone and more time. Meanwhile, ADBE has eased slightly from the gap high." },
  { day: 34, spot: 541.50, shortDelta: 0.34, dte: 11, pnl: -20,  profitCapturePct: -5,  ivRank: 44, caption: null },
  { day: 35, spot: 540.00, shortDelta: 0.30, dte: 10, pnl: -8,   profitCapturePct: -2,  ivRank: 42, caption: "ADBE pulls back to $540. Delta drops to 0.30 — back below the ACTION_NEEDED threshold. The system de-escalates to MONITOR." },
  { day: 36, spot: 538.00, shortDelta: 0.26, dte: 9,  pnl: 25,   profitCapturePct: 7,  ivRank: 40, caption: null },
  { day: 37, spot: 536.50, shortDelta: 0.23, dte: 8,  pnl: 55,   profitCapturePct: 14, ivRank: 38, caption: null },
  { day: 38, spot: 535.00, shortDelta: 0.20, dte: 7,  pnl: 85,   profitCapturePct: 22, ivRank: 36, caption: "Day 38. ADBE has retreated to $535. The crisis has passed. Position is back in profit — $85 per contract. Theta decay is accelerating with only 7 days left." },

  // Days 39-44: Recovery. Position reaches 50% profit target.
  { day: 39, spot: 533.00, shortDelta: 0.17, dte: 6,  pnl: 120,  profitCapturePct: 32, ivRank: 34, caption: null },
  { day: 40, spot: 531.00, shortDelta: 0.14, dte: 5,  pnl: 148,  profitCapturePct: 39, ivRank: 32, caption: null },
  { day: 41, spot: 530.00, shortDelta: 0.12, dte: 4,  pnl: 165,  profitCapturePct: 43, ivRank: 31, caption: "Day 41. Position at 43% of max profit. Close but hasn't hit the 50% target yet. Three trading days left." },
  { day: 42, spot: 528.00, shortDelta: 0.09, dte: 3,  pnl: 185,  profitCapturePct: 49, ivRank: 30, caption: null },
  { day: 43, spot: 527.00, shortDelta: 0.07, dte: 2,  pnl: 192,  profitCapturePct: 51, ivRank: 29, caption: "The position crosses 50% of maximum profit. The system fires TAKE_PROFIT — time to close and lock in the gain. That's $192 per contract, earned over 43 sessions of systematic monitoring." },
  { day: 44, spot: 526.50, shortDelta: 0.06, dte: 1,  pnl: 195,  profitCapturePct: 51, ivRank: 28, caption: null },

  // Day 45: Final day. Position closed at target.
  { day: 45, spot: 526.00, shortDelta: 0.05, dte: 0,  pnl: 198,  profitCapturePct: 52, ivRank: 28, caption: "Closed. The system watched this position for 45 sessions. It flagged MONITOR when delta approached threshold. It fired ACTION_NEEDED when the gap happened. It recommended the right adjustment at the right time. And it told you when to take profit. This happens for every position, every session, until expiry." },
];

/**
 * Build marketData object for evaluate() from a demo session.
 */
export function sessionToMarketData(session) {
  return {
    currentSpot: session.spot,
    dte: session.dte,
    shortDelta: session.shortDelta,
    profitCapturePct: session.profitCapturePct,
    isBreached: session.spot >= 540, // short call strike
    isShortTested: Math.abs(session.spot - 540) <= 2, // within $2 of short call strike
    sessionsBreached: 0,
    // lossMultiple: |loss| / entry credit (both in dollars per contract)
    lossMultiple: session.pnl < 0 ? Math.abs(session.pnl) / DEMO_POSITION.maxProfit : 0,
    currentIvRank: session.ivRank,
    nextEarningsDate: null,
    priceDistSD: 0,
    ivCrush: false,
    priceAtBrokenWing: false,
    priceBeyondBrokenWing: false,
    debitToCreditFlip: false,
    priceAtNearWing: false,
    priceBeyondNearWing: false,
    vegaFlip: false,
    deepItm: false,
  };
}

/**
 * Get the interpolated caption for a given session.
 * Returns the session's own caption, or the most recent non-null caption.
 */
export function getCaptionForSession(sessionIndex) {
  for (let i = sessionIndex; i >= 0; i--) {
    if (DEMO_SESSIONS[i].caption) return DEMO_SESSIONS[i].caption;
  }
  return DEMO_SESSIONS[0].caption;
}
