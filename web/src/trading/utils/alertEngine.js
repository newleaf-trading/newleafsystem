/**
 * Alert Engine v2 — evaluates portfolio positions against configurable thresholds
 * and returns typed, prioritized alerts for each position.
 *
 * KEY DESIGN: Two data tiers with separate gating:
 *
 * P&L-BASED ALERTS (fire when we have pricing data from simulate or IB):
 *   1. take_profit     — P&L exceeds profit target % of max credit
 *   6. time_loss       — Low DTE AND losing
 *   NEW: losing        — P&L below loss threshold (general losing alert)
 *
 * GREEKS-BASED ALERTS (fire ONLY when we have live underlying price/delta from IB):
 *   2. iron_fly_convert — Iron condor nearing edge, suggest conversion
 *   3. breakeven_breach — Stock beyond breakeven
 *   4. delta_breach     — Short strike delta exceeds threshold
 *   5. pop_drop         — Probability of profit below target
 *
 * Priority: take_profit → iron_fly → breakeven → delta → pop_drop → losing → time_loss → on_track
 */

// Default thresholds — overridden by Firestore config/alertThresholds
export const DEFAULT_ALERT_CONFIG = {
  take_profit: {
    enabled: true,
    threshold: 50,       // % of max credit captured
    label: 'Profit Target Reached',
    action: 'take_profit',
    icon: '🎯',
    severity: 'success',
  },
  iron_fly_convert: {
    enabled: true,
    threshold: 70,       // % of distance from center to short strike
    label: 'Consider Iron Fly Conversion',
    action: 'convert_iron_fly',
    icon: '🦋',
    severity: 'info',
  },
  breakeven_breach: {
    enabled: true,
    threshold: 0,        // 0 = exactly at breakeven
    label: 'Breakeven Breached',
    action: 'close_or_roll',
    icon: '🚨',
    severity: 'danger',
  },
  delta_breach: {
    enabled: true,
    threshold: 0.30,     // absolute delta of short strike
    label: 'Short Strike Delta Breach',
    action: 'review_adjustment',
    icon: '⚡',
    severity: 'warning',
  },
  pop_drop: {
    enabled: true,
    threshold: 60,       // current PoP %
    label: 'Probability Below Target',
    action: 'review_position',
    icon: '📉',
    severity: 'warning',
  },
  time_loss: {
    enabled: true,
    threshold: 10,       // DTE threshold (only fires if also losing)
    label: 'Expiring Soon & Losing',
    action: 'urgent_review',
    icon: '⏰',
    severity: 'danger',
  },
};

/**
 * Evaluate a single position and return the highest-priority alert.
 */
export function evaluatePosition(item, config = DEFAULT_ALERT_CONFIG) {
  const tile = item.tile || {};
  const strategy = (tile.strategy || '').toLowerCase();
  const isIronCondor = strategy.includes('iron_condor') || strategy.includes('iron condor') || strategy.includes('ironcondor');
  const legs = tile.legs || [];
  const quantity = item.quantity || 1;

  // ── P&L data (available after simulate or IB price updates) ──
  const pnl = (item.unrealizedPnl || 0) * quantity;
  const entryCredit = Math.abs(item.entryNetCredit || 0);
  const returnPct = entryCredit > 0 ? (pnl / entryCredit) * 100 : 0;
  const dte = tile.daysToExpiry || 30;

  // ── Guard: No pricing data at all → silent ──
  const hasLivePricing = item.lastPriceUpdate || item.currentNetValue !== 0 || pnl !== 0;
  if (!hasLivePricing) {
    return {
      type: 'on_track',
      label: 'Awaiting Market Data',
      icon: '⏳',
      severity: 'success',
      action: 'none',
      message: `${tile.symbol} — no live pricing yet. Alerts will activate once market data is received.`,
      details: {},
    };
  }

  // ── Greeks data: do we have LIVE underlying price from IB? ──
  // If currentUnderlyingPrice on the portfolio item has been updated
  // and differs from entryUnderlyingPrice, we have real Greeks data.
  // tile.underlyingPrice is the ENTRY price — not useful for monitoring.
  const liveUnderlying = item.currentUnderlyingPrice || 0;
  const entryUnderlying = item.entryUnderlyingPrice || tile.underlyingPrice || 0;
  const hasLiveGreeks = liveUnderlying > 0 && Math.abs(liveUnderlying - entryUnderlying) > 0.01;
  const currentPrice = hasLiveGreeks ? liveUnderlying : 0;

  // Iron condor leg data
  let putSellStrike = 0, putBuyStrike = 0, callSellStrike = 0, callBuyStrike = 0;
  let centerPrice = 0;

  if (isIronCondor && legs.length >= 4) {
    const putSell = legs.find(l => l.type === 'put' && l.action === 'sell');
    const putBuy = legs.find(l => l.type === 'put' && l.action === 'buy');
    const callSell = legs.find(l => l.type === 'call' && l.action === 'sell');
    const callBuy = legs.find(l => l.type === 'call' && l.action === 'buy');

    if (putSell) putSellStrike = putSell.strike;
    if (putBuy) putBuyStrike = putBuy.strike;
    if (callSell) callSellStrike = callSell.strike;
    if (callBuy) callBuyStrike = callBuy.strike;
    centerPrice = (putSellStrike + callSellStrike) / 2;
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 1. TAKE PROFIT (P&L-based) — Check FIRST
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const tpConfig = config.take_profit;
  if (tpConfig?.enabled && pnl > 0 && returnPct >= (tpConfig.threshold || 50)) {
    return {
      type: 'take_profit',
      label: tpConfig.label || 'Profit Target Reached',
      icon: tpConfig.icon || '🎯',
      severity: 'success',
      action: 'take_profit',
      message: `${tile.symbol} has captured ${returnPct.toFixed(0)}% of max credit (+${formatDollar(pnl)}). Consider closing to lock in profit.`,
      details: { returnPct: returnPct.toFixed(1), pnl, threshold: tpConfig.threshold },
    };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 2. IRON FLY CONVERSION (Greeks-based — needs live underlying price)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const ifConfig = config.iron_fly_convert;
  if (ifConfig?.enabled && isIronCondor && hasLiveGreeks && putSellStrike > 0 && callSellStrike > 0) {
    const edgeThreshold = (ifConfig.threshold || 70) / 100;

    const putSideDistance = centerPrice - putSellStrike;
    const putSideTravel = putSideDistance > 0 ? (centerPrice - currentPrice) / putSideDistance : 0;
    const nearingPutSide = putSideTravel >= edgeThreshold && currentPrice <= putSellStrike * 1.02;

    const callSideDistance = callSellStrike - centerPrice;
    const callSideTravel = callSideDistance > 0 ? (currentPrice - centerPrice) / callSideDistance : 0;
    const nearingCallSide = callSideTravel >= edgeThreshold && currentPrice >= callSellStrike * 0.98;

    if (nearingPutSide || nearingCallSide) {
      const testedSide = nearingPutSide ? 'put' : 'call';
      const untestedSide = testedSide === 'put' ? 'call' : 'put';
      const untestedSellStrike = testedSide === 'put' ? callSellStrike : putSellStrike;
      const untestedBuyStrike = testedSide === 'put' ? callBuyStrike : putBuyStrike;

      return {
        type: 'iron_fly_convert',
        label: ifConfig.label || 'Consider Iron Fly Conversion',
        icon: ifConfig.icon || '🦋',
        severity: 'info',
        action: 'convert_iron_fly',
        message: `${tile.symbol} is nearing the ${testedSide} side ($${testedSide === 'put' ? putSellStrike : callSellStrike}). Consider moving the ${untestedSide} spread closer to collect additional credit — converting into an iron fly.`,
        details: {
          testedSide, untestedSide, currentPrice, untestedSellStrike,
          untestedBuyStrike, putSellStrike, callSellStrike,
          suggestedNewStrike: testedSide === 'put' ? putSellStrike : callSellStrike,
        },
      };
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 3. BREAKEVEN BREACH (Greeks-based — needs live underlying price)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const bbConfig = config.breakeven_breach;
  if (bbConfig?.enabled && isIronCondor && hasLiveGreeks) {
    const netCredit = entryCredit / 100;
    const lowerBE = putSellStrike - netCredit;
    const upperBE = callSellStrike + netCredit;

    if (currentPrice < lowerBE || currentPrice > upperBE) {
      const breachedSide = currentPrice < lowerBE ? 'downside' : 'upside';
      return {
        type: 'breakeven_breach',
        label: bbConfig.label || 'Breakeven Breached',
        icon: bbConfig.icon || '🚨',
        severity: 'danger',
        action: 'close_or_roll',
        message: `${tile.symbol} has breached the ${breachedSide} breakeven ($${breachedSide === 'downside' ? lowerBE.toFixed(2) : upperBE.toFixed(2)}). Consider closing or rolling.`,
        details: { lowerBE, upperBE, currentPrice, breachedSide },
      };
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 4. DELTA BREACH (Greeks-based — needs CURRENT deltas from IB, NOT entry deltas)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const dbConfig = config.delta_breach;
  if (dbConfig?.enabled && isIronCondor) {
    // Only use deltas if they come from a live source (portfolio legs with currentDelta)
    // tile.legs[].delta are ENTRY deltas — NOT current and should NOT trigger alerts
    const portfolioLegs = item.legs || [];
    const portfolioPutSell = portfolioLegs.find(l => l.type === 'put' && l.action === 'sell');
    const portfolioCallSell = portfolioLegs.find(l => l.type === 'call' && l.action === 'sell');

    const livePutDelta = Math.abs(portfolioPutSell?.currentDelta || 0);
    const liveCallDelta = Math.abs(portfolioCallSell?.currentDelta || 0);
    const hasLiveDeltas = livePutDelta > 0 || liveCallDelta > 0;

    if (hasLiveDeltas) {
      const deltaThreshold = dbConfig.threshold || 0.30;
      if (livePutDelta > deltaThreshold || liveCallDelta > deltaThreshold) {
        const testedSide = livePutDelta > liveCallDelta ? 'put' : 'call';
        const testedDelta = testedSide === 'put' ? livePutDelta : liveCallDelta;
        return {
          type: 'delta_breach',
          label: dbConfig.label || 'Short Strike Delta Breach',
          icon: dbConfig.icon || '⚡',
          severity: 'warning',
          action: 'review_adjustment',
          message: `${tile.symbol} short ${testedSide} delta is ${testedDelta.toFixed(2)} (threshold: ${deltaThreshold}). The ${testedSide} side is being tested. Consider rolling to widen your safety margin.`,
          details: { testedSide, testedDelta, deltaThreshold },
        };
      }
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 5. POP DROP (Greeks-based — needs updated probability)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const pdConfig = config.pop_drop;
  if (pdConfig?.enabled) {
    // Only check PoP if it's been updated from entry value
    // item.currentPoP would come from IB; tile value is stale
    const livePoP = item.currentPoP || 0;
    if (livePoP > 0 && livePoP < (pdConfig.threshold || 60)) {
      return {
        type: 'pop_drop',
        label: pdConfig.label || 'Probability Below Target',
        icon: pdConfig.icon || '📉',
        severity: 'warning',
        action: 'review_position',
        message: `${tile.symbol} probability of profit has dropped to ${livePoP.toFixed(0)}% (target: ${pdConfig.threshold || 60}%). Consider adjusting.`,
        details: { currentPoP: livePoP, threshold: pdConfig.threshold },
      };
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 6. LOSING POSITION (P&L-based) — losing beyond 25% of entry credit
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (pnl < 0 && entryCredit > 0) {
    const lossPct = Math.abs(returnPct);

    // Severe loss: > 100% of entry credit (losing more than you collected)
    if (lossPct >= 100) {
      return {
        type: 'severe_loss',
        label: 'Significant Loss',
        icon: '🔴',
        severity: 'danger',
        action: 'close_or_roll',
        message: `${tile.symbol} is down ${formatDollar(pnl)} (${lossPct.toFixed(0)}% of entry credit). Loss exceeds original premium collected. Consider closing to limit further damage.`,
        details: { pnl, lossPct: lossPct.toFixed(1), entryCredit },
      };
    }

    // Moderate loss: > 50% of entry credit
    if (lossPct >= 50) {
      return {
        type: 'moderate_loss',
        label: 'Position Losing',
        icon: '🟠',
        severity: 'warning',
        action: 'review_position',
        message: `${tile.symbol} is down ${formatDollar(pnl)} (${lossPct.toFixed(0)}% of entry credit). Monitor closely${dte <= 14 ? ` — only ${dte} days to expiry` : ''}.`,
        details: { pnl, lossPct: lossPct.toFixed(1), entryCredit, dte },
      };
    }
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 7. TIME + LOSS (P&L-based)
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  const tlConfig = config.time_loss;
  if (tlConfig?.enabled && dte <= (tlConfig.threshold || 10) && pnl < 0) {
    return {
      type: 'time_loss',
      label: tlConfig.label || 'Expiring Soon & Losing',
      icon: tlConfig.icon || '⏰',
      severity: 'danger',
      action: 'urgent_review',
      message: `${tile.symbol} has only ${dte} days to expiry and is down ${formatDollar(pnl)}. Limited time to recover — consider closing.`,
      details: { dte, pnl, threshold: tlConfig.threshold },
    };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 8. SMALL PROFIT (P&L-based) — profitable but below target
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (pnl > 0 && returnPct > 0 && returnPct < (tpConfig?.threshold || 50)) {
    return {
      type: 'on_track',
      label: 'On Track — Profitable',
      icon: '✅',
      severity: 'success',
      action: 'none',
      message: `${tile.symbol} is up ${formatDollar(pnl)} (${returnPct.toFixed(0)}% of max credit). Approaching target of ${tpConfig?.threshold || 50}%.`,
      details: { pnl, returnPct: returnPct.toFixed(1) },
    };
  }

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  // 9. ON TRACK — no issues
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  return {
    type: 'on_track',
    label: 'On Track',
    icon: '✅',
    severity: 'success',
    action: 'none',
    message: `${tile.symbol} is performing within expected parameters.`,
    details: {},
  };
}

/**
 * Evaluate all positions and return an array of alerts (excluding on_track).
 */
export function evaluatePortfolio(portfolioWithTiles, config = DEFAULT_ALERT_CONFIG) {
  return portfolioWithTiles
    .filter(item => item.status !== 'closed')
    .map(item => ({
      ...evaluatePosition(item, config),
      item,
    }))
    .filter(alert => alert.type !== 'on_track');
}

/**
 * Get the severity CSS class for an alert.
 */
export function getAlertSeverityClass(severity) {
  switch (severity) {
    case 'success': return 'alert-success';
    case 'info': return 'alert-info';
    case 'warning': return 'alert-warning';
    case 'danger': return 'alert-danger';
    default: return '';
  }
}

/**
 * Get the CTA button text for an alert action.
 */
export function getAlertButtonText(action) {
  switch (action) {
    case 'take_profit': return 'Close for Profit';
    case 'convert_iron_fly': return 'Review Conversion';
    case 'close_or_roll': return 'Close or Roll';
    case 'review_adjustment': return 'Review Adjustment';
    case 'review_position': return 'Review Position';
    case 'urgent_review': return 'Urgent: Review Now';
    default: return 'Review';
  }
}

function formatDollar(val) {
  const abs = Math.abs(val);
  const prefix = val >= 0 ? '+' : '-';
  return `${prefix}$${abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}
