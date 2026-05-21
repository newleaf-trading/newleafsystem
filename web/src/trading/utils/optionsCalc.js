/**
 * Calculate all derived values from tile legs data.
 * All monetary values returned are PER CONTRACT (×100 multiplier applied).
 */

// Net premium received (positive) or paid (negative) per share
export const getNetPremium = (legs) => {
  if (!legs || !legs.length) return 0;
  return legs
    .filter(l => l.type !== 'stock')
    .reduce((sum, leg) => {
      // sell = receive premium (positive), buy = pay premium (negative)
      return sum + (leg.action === 'sell' ? leg.premium : -leg.premium);
    }, 0);
};

// Get the underlying/stock price from legs or tile
export const getUnderlyingPrice = (tile) => {
  if (tile.currentPrice) return tile.currentPrice;
  if (tile.underlyingPrice) return tile.underlyingPrice;
  if (tile.price) return tile.price;
  const legs = tile.legs || [];
  // Check for stock leg
  const stockLeg = legs.find(l => l.type === 'stock');
  if (stockLeg) return stockLeg.strike || stockLeg.premium;
  // For spreads, estimate from strikes
  const strikes = legs.map(l => l.strike).filter(Boolean);
  if (strikes.length > 0) {
    return (Math.min(...strikes) + Math.max(...strikes)) / 2;
  }
  return 0;
};

// Calculate max profit, max loss, breakevens based on strategy
export const calculateMetrics = (tile) => {
  const legs = tile.legs || [];
  const strategy = (tile.strategy || '').toLowerCase();
  const netPremium = getNetPremium(legs);
  const netPremiumDollars = netPremium * 100;

  if (strategy.includes('iron_condor')) {
    const putSell = legs.find(l => l.type === 'put' && l.action === 'sell');
    const putBuy = legs.find(l => l.type === 'put' && l.action === 'buy');
    const callSell = legs.find(l => l.type === 'call' && l.action === 'sell');
    const callBuy = legs.find(l => l.type === 'call' && l.action === 'buy');

    const putSpreadWidth = putSell && putBuy ? putSell.strike - putBuy.strike : 10;
    const callSpreadWidth = callBuy && callSell ? callBuy.strike - callSell.strike : 10;
    const maxSpreadWidth = Math.max(putSpreadWidth, callSpreadWidth);

    const maxProfit = netPremiumDollars;
    const maxLoss = (maxSpreadWidth * 100) - netPremiumDollars;
    const lowerBreakeven = putSell ? putSell.strike - netPremium : 0;
    const upperBreakeven = callSell ? callSell.strike + netPremium : 0;

    return { maxProfit, maxLoss, breakevens: [lowerBreakeven, upperBreakeven] };
  }

  if (strategy.includes('bull_call')) {
    const longCall = legs.find(l => l.type === 'call' && l.action === 'buy');
    const shortCall = legs.find(l => l.type === 'call' && l.action === 'sell');

    const spreadWidth = shortCall && longCall ? shortCall.strike - longCall.strike : 10;
    const debit = Math.abs(netPremium); // net premium is negative for debit spreads

    const maxLoss = debit * 100;
    const maxProfit = (spreadWidth * 100) - maxLoss;
    const breakeven = longCall ? longCall.strike + debit : 0;

    return { maxProfit, maxLoss, breakevens: [breakeven] };
  }

  if (strategy.includes('bull_put')) {
    const shortPut = legs.find(l => l.type === 'put' && l.action === 'sell');
    const longPut = legs.find(l => l.type === 'put' && l.action === 'buy');

    const spreadWidth = shortPut && longPut ? shortPut.strike - longPut.strike : 10;

    const maxProfit = netPremiumDollars;
    const maxLoss = (spreadWidth * 100) - netPremiumDollars;
    const breakeven = shortPut ? shortPut.strike - netPremium : 0;

    return { maxProfit, maxLoss, breakevens: [breakeven] };
  }

  if (strategy.includes('covered_call')) {
    const stockLeg = legs.find(l => l.type === 'stock');
    const shortCall = legs.find(l => l.type === 'call' && l.action === 'sell');
    const longPut = legs.find(l => l.type === 'put' && l.action === 'buy');

    const stockPrice = stockLeg ? stockLeg.strike : getUnderlyingPrice(tile);
    const callPremium = shortCall ? shortCall.premium : 0;
    const putCost = longPut ? longPut.premium : 0;
    const netOptionPremium = callPremium - putCost; // net credit from options

    const maxProfit = shortCall
      ? ((shortCall.strike - stockPrice) + netOptionPremium) * 100
      : netOptionPremium * 100;

    const maxLoss = longPut
      ? ((stockPrice - longPut.strike) - netOptionPremium) * 100
      : (stockPrice - netOptionPremium) * 100;

    const breakeven = stockPrice - netOptionPremium;

    return { maxProfit, maxLoss, breakevens: [breakeven] };
  }

  // Fallback
  return { maxProfit: Math.abs(netPremiumDollars), maxLoss: Math.abs(netPremiumDollars), breakevens: [] };
};

// Generate P&L data points for the chart
export const generatePnLData = (tile) => {
  const legs = tile.legs || [];
  const strategy = (tile.strategy || '').toLowerCase();
  const underlyingPrice = getUnderlyingPrice(tile);

  // Determine price range
  const strikes = legs.map(l => l.strike).filter(Boolean);
  const minStrike = Math.min(...strikes);
  const maxStrike = Math.max(...strikes);
  const range = maxStrike - minStrike;
  const padding = Math.max(range * 0.5, underlyingPrice * 0.15);
  const startPrice = Math.max(0, minStrike - padding);
  const endPrice = maxStrike + padding;
  const step = (endPrice - startPrice) / 100;

  const data = [];

  for (let price = startPrice; price <= endPrice; price += step) {
    let pnl = 0;

    if (strategy.includes('covered_call')) {
      const stockLeg = legs.find(l => l.type === 'stock');
      const stockPrice = stockLeg ? stockLeg.strike : underlyingPrice;

      // Stock P&L
      pnl = (price - stockPrice) * 100;

      // Option legs P&L
      legs.filter(l => l.type !== 'stock').forEach(leg => {
        const intrinsic = leg.type === 'call'
          ? Math.max(0, price - leg.strike)
          : Math.max(0, leg.strike - price);

        if (leg.action === 'buy') {
          pnl += (intrinsic - leg.premium) * 100;
        } else {
          pnl += (leg.premium - intrinsic) * 100;
        }
      });
    } else {
      // For all other strategies (no stock leg)
      legs.forEach(leg => {
        if (leg.type === 'stock') return;

        const intrinsic = leg.type === 'call'
          ? Math.max(0, price - leg.strike)
          : Math.max(0, leg.strike - price);

        if (leg.action === 'buy') {
          pnl += (intrinsic - leg.premium) * 100;
        } else {
          pnl += (leg.premium - intrinsic) * 100;
        }
      });
    }

    data.push({
      price: Math.round(price * 100) / 100,
      pnl: Math.round(pnl * 100) / 100
    });
  }

  return data;
};

// Format strategy name for display
export const formatStrategy = (strategy) => {
  if (!strategy) return '';
  return strategy
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
};
