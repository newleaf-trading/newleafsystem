/**
 * Helper functions for options chain fetching
 * @module optionsHelpers
 */

/**
 * Get the next Friday from a given date
 */
function getNextFriday(date) {
  const result = new Date(date);
  const dayOfWeek = result.getDay();
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
  result.setDate(result.getDate() + daysUntilFriday);
  return result;
}

/**
 * Get the 3rd Friday of a month (monthly expiry)
 */
function getThirdFriday(year, month) {
  const date = new Date(year, month, 1);
  const dayOfWeek = date.getDay();
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
  const thirdFriday = 1 + daysUntilFriday + 14; // 1st Friday + 2 weeks
  return new Date(year, month, thirdFriday);
}

/**
 * Get key option expiries (weekly, monthly, 45 DTE)
 * @param {Date} today - Starting date (default: now)
 * @returns {Array} Array of expiry objects with date, dte, type
 */
function getKeyExpiries(today = new Date()) {
  const expiries = [];
  
  // Next weekly (if exists and < 7 days away)
  const nextFriday = getNextFriday(today);
  const daysToFriday = Math.round((nextFriday - today) / (1000 * 60 * 60 * 24));
  
  if (daysToFriday > 0 && daysToFriday <= 7) {
    expiries.push({
      date: formatDate(nextFriday),
      dte: daysToFriday,
      type: 'weekly'
    });
  }
  
  // Next monthly (3rd Friday)
  let monthlyExpiry;
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();
  
  // Check if this month's 3rd Friday has passed
  const thisMonthExpiry = getThirdFriday(currentYear, currentMonth);
  if (thisMonthExpiry > today) {
    monthlyExpiry = thisMonthExpiry;
  } else {
    // Use next month's 3rd Friday
    const nextMonth = (currentMonth + 1) % 12;
    const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
    monthlyExpiry = getThirdFriday(nextYear, nextMonth);
  }
  
  const dteMonthly = Math.round((monthlyExpiry - today) / (1000 * 60 * 60 * 24));
  expiries.push({
    date: formatDate(monthlyExpiry),
    dte: dteMonthly,
    type: 'monthly'
  });
  
  // 45 DTE expiry (for theta strategies)
  const dte45 = new Date(today);
  dte45.setDate(dte45.getDate() + 45);
  
  // Find the nearest Friday to 45 DTE
  const dte45Friday = getNextFriday(dte45);
  const actualDte45 = Math.round((dte45Friday - today) / (1000 * 60 * 60 * 24));
  
  expiries.push({
    date: formatDate(dte45Friday),
    dte: actualDte45,
    type: 'monthly'
  });
  
  return expiries;
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Format date as YYYYMMDD for IB API
 */
function formatDateIB(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Get strike interval for a symbol
 * @param {string} symbol - Stock symbol
 * @returns {number} Strike interval (e.g., 2.5 for JNJ, 5 for SPY)
 */
function getStrikeInterval(symbol) {
  // Define known intervals
  const intervals = {
    'JNJ': 2.5,
    'PFE': 2.5,
    'MRK': 2.5,
    'BMY': 2.5,
    'ABBV': 2.5,
    'SPY': 5,
    'QQQ': 5,
    'IWM': 5,
    'META': 5,
    'AAPL': 5,
    'MSFT': 5,
    'GOOGL': 5,
    'AMZN': 5,
    'NVDA': 5,
    'TSLA': 10,
    'SHOP': 2.5,
    'AMD': 2.5
  };
  
  return intervals[symbol] || 5; // Default to $5
}

/**
 * Get strikes around spot price
 * @param {number} spotPrice - Current stock price
 * @param {string} symbol - Stock symbol
 * @param {number} numStrikes - Number of strikes above AND below ATM (default: 10)
 * @returns {Array} Array of strike prices
 */
function getStrikesAroundSpot(spotPrice, symbol, numStrikes = 10) {
  const interval = getStrikeInterval(symbol);
  
  // Find ATM strike (round to nearest interval)
  const atm = Math.round(spotPrice / interval) * interval;
  
  const strikes = [];
  
  // Add strikes below ATM
  for (let i = numStrikes; i >= 1; i--) {
    strikes.push(atm - (i * interval));
  }
  
  // Add ATM
  strikes.push(atm);
  
  // Add strikes above ATM
  for (let i = 1; i <= numStrikes; i++) {
    strikes.push(atm + (i * interval));
  }
  
  return strikes.map(s => parseFloat(s.toFixed(2)));
}

/**
 * Calculate Black-Scholes Greeks
 * @param {number} spotPrice - Current stock price
 * @param {number} strike - Strike price
 * @param {Date|string} expiry - Expiration date
 * @param {number} iv - Implied volatility (as decimal, e.g., 0.25 for 25%)
 * @param {string} right - 'C' for call, 'P' for put
 * @param {number} riskFreeRate - Risk-free rate (default: 0.045 for 4.5%)
 * @returns {Object} Greeks: delta, gamma, theta, vega
 */
function calculateBlackScholesGreeks(spotPrice, strike, expiry, iv, right, riskFreeRate = 0.045) {
  // Convert expiry to Date if string
  const expiryDate = typeof expiry === 'string' ? new Date(expiry) : expiry;
  
  // Calculate time to expiration in years
  const now = new Date();
  const timeToExpiry = (expiryDate - now) / (1000 * 60 * 60 * 24 * 365);
  
  if (timeToExpiry <= 0) {
    return { delta: 0, gamma: 0, theta: 0, vega: 0 };
  }
  
  // Black-Scholes d1 and d2
  const d1 = (Math.log(spotPrice / strike) + (riskFreeRate + (iv * iv) / 2) * timeToExpiry) / 
             (iv * Math.sqrt(timeToExpiry));
  const d2 = d1 - iv * Math.sqrt(timeToExpiry);
  
  // Standard normal CDF approximation
  const normCDF = (x) => {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp(-x * x / 2);
    const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return x > 0 ? 1 - p : p;
  };
  
  // Standard normal PDF
  const normPDF = (x) => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
  
  // Calculate Greeks
  let delta, gamma, theta, vega;
  
  if (right === 'C') {
    // Call delta
    delta = normCDF(d1);
    
    // Call theta (per day)
    theta = (-spotPrice * normPDF(d1) * iv / (2 * Math.sqrt(timeToExpiry)) -
             riskFreeRate * strike * Math.exp(-riskFreeRate * timeToExpiry) * normCDF(d2)) / 365;
  } else {
    // Put delta
    delta = normCDF(d1) - 1;
    
    // Put theta (per day)
    theta = (-spotPrice * normPDF(d1) * iv / (2 * Math.sqrt(timeToExpiry)) +
             riskFreeRate * strike * Math.exp(-riskFreeRate * timeToExpiry) * normCDF(-d2)) / 365;
  }
  
  // Gamma and vega are same for calls and puts
  gamma = normPDF(d1) / (spotPrice * iv * Math.sqrt(timeToExpiry));
  vega = spotPrice * normPDF(d1) * Math.sqrt(timeToExpiry) / 100; // Per 1% change in IV
  
  return {
    delta: parseFloat(delta.toFixed(4)),
    gamma: parseFloat(gamma.toFixed(4)),
    theta: parseFloat(theta.toFixed(4)),
    vega: parseFloat(vega.toFixed(4))
  };
}

module.exports = {
  getKeyExpiries,
  getStrikesAroundSpot,
  getStrikeInterval,
  calculateBlackScholesGreeks,
  formatDate,
  formatDateIB
};
