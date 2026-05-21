/**
 * Alpaca Options Chain Fetcher - extends existing newleaf-pipeline.js patterns
 * Uses Alpaca Data API for complete options chain with Greeks
 * @module alpacaOptionsChain
 */

'use strict';

const ALPACA_DATA = 'https://data.alpaca.markets';

/**
 * Build Alpaca headers from config
 * @param {Object} cfg - Config object with alpaca.apiKey and alpaca.secretKey
 * @returns {Object} Headers for Alpaca API
 */
function buildAlpacaHeaders(cfg) {
  return {
    'APCA-API-KEY-ID': cfg.alpaca.apiKey,
    'APCA-API-SECRET-KEY': cfg.alpaca.secretKey,
    'Accept': 'application/json'
  };
}

/**
 * Generic Alpaca GET request with retries
 * @private
 */
async function alpacaGet(url, headers, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { 
        headers, 
        signal: AbortSignal.timeout(15000) 
      });
      
      if (res.status === 429) { 
        await sleep(1000 * (i + 1)); 
        continue; 
      }
      
      if (!res.ok) { 
        const text = await res.text().catch(() => ''); 
        throw new Error(`HTTP ${res.status}: ${text.slice(0, 80)}`); 
      }
      
      return await res.json();
    } catch (err) { 
      if (i === retries) throw err; 
      await sleep(500); 
    }
  }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Calculate days to expiration
 * @private
 */
function calcDTE(isoDate) {
  const exp = new Date(isoDate);
  exp.setHours(0, 0, 0, 0);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((exp - now) / 86400000);
}

/**
 * Get next Friday (weekly expiry)
 * @private
 */
function getNextFriday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  d.setDate(d.getDate() + (day <= 5 ? (5 - day) || 7 : 6));
  return d.toISOString().split('T')[0];
}

/**
 * Get third Friday of current/next month (monthly expiry)
 * @private
 */
function getThirdFriday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // Start with first day of current month
  let d = new Date(year, month, 1);
  d.setHours(0, 0, 0, 0);

  // Find first Friday
  while (d.getDay() !== 5) {
    d.setDate(d.getDate() + 1);
  }

  // Third Friday is 14 days after first Friday
  d.setDate(d.getDate() + 14);

  // If third Friday is in the past, get next month's third Friday
  now.setHours(0, 0, 0, 0);
  if (d <= now) {
    d = new Date(year, month + 1, 1);
    while (d.getDay() !== 5) {
      d.setDate(d.getDate() + 1);
    }
    d.setDate(d.getDate() + 14);
  }

  return d.toISOString().split('T')[0];
}

/**
 * Get 45 DTE expiry (approximate)
 * @private
 */
function get45DTEExpiry() {
  const d = new Date();
  d.setDate(d.getDate() + 45);
  // Find next Friday
  while (d.getDay() !== 5) {
    d.setDate(d.getDate() + 1);
  }
  return d.toISOString().split('T')[0];
}

/**
 * Get 3 key option expiries (weekly, monthly, 45 DTE)
 * @returns {Array<{date: string, dte: number, type: string}>}
 */
function getKeyExpiries() {
  const expiries = [];
  
  // Next Friday (weekly)
  const weeklyDate = getNextFriday();
  const weeklyDTE = calcDTE(weeklyDate);
  if (weeklyDTE > 0 && weeklyDTE <= 7) {
    expiries.push({
      date: weeklyDate,
      dte: weeklyDTE,
      type: 'weekly'
    });
  }
  
  // Monthly (3rd Friday)
  const monthlyDate = getThirdFriday();
  const monthlyDTE = calcDTE(monthlyDate);
  expiries.push({
    date: monthlyDate,
    dte: monthlyDTE,
    type: 'monthly'
  });
  
  // 45 DTE
  const dte45Date = get45DTEExpiry();
  const dte45 = calcDTE(dte45Date);
  expiries.push({
    date: dte45Date,
    dte: dte45,
    type: 'monthly'
  });
  
  return expiries;
}

/**
 * Fetch options chain for a single expiry from Alpaca
 * (Uses existing newleaf-pipeline.js pattern)
 * 
 * @param {string} symbol - Stock symbol
 * @param {string} isoExpiry - ISO date (YYYY-MM-DD)
 * @param {Object} headers - Alpaca headers
 * @returns {Promise<Array>} Array of option contracts
 */
async function getAlpacaChainForExpiry(symbol, isoExpiry, headers) {
  const url = `${ALPACA_DATA}/v1beta1/options/snapshots/${symbol}?expiration_date=${isoExpiry}&feed=indicative&limit=1000`;
  
  const data = await alpacaGet(url, headers).catch(() => ({ snapshots: {} }));
  
  const contracts = [];
  
  for (const [occ, snap] of Object.entries(data.snapshots || {})) {
    // Parse OCC symbol: AAPL260417C00250000
    const match = occ.match(/^([A-Z1-9]+)(\d{6})([CP])(\d{8})$/);
    if (!match) continue;
    
    const greeks = snap.greeks || {};
    const quote = snap.latestQuote || {};
    const dailyBar = snap.dailyBar || {};
    
    contracts.push({
      occ,
      type: match[3] === 'C' ? 'call' : 'put',
      strike: parseInt(match[4], 10) / 1000,
      gamma: greeks.gamma ?? null,
      delta: greeks.delta ?? null,
      theta: greeks.theta ?? null,
      vega: greeks.vega ?? null,
      iv: greeks.midIV ?? snap.impliedVolatility ?? null,
      bid: quote.bp ?? 0,
      ask: quote.ap ?? 0,
      mid: quote.bp && quote.ap ? (quote.bp + quote.ap) / 2 : 0,
      last: snap.latestTrade?.p ?? 0,
      volume: dailyBar.v ?? 0,
      openInterest: 0 // Alpaca returns 0, use Yahoo for OI
    });
  }
  
  return contracts;
}

/**
 * Fetch complete options chain (3 expiries) from Alpaca
 * 
 * @param {string} symbol - Stock symbol
 * @param {Object} cfg - Config object with Alpaca credentials
 * @returns {Promise<Object>} Options chain with 3 expiries
 */
async function fetchOptionsChain(symbol, cfg) {
  const headers = buildAlpacaHeaders(cfg);
  const expiries = getKeyExpiries();
  
  const chainData = [];
  
  for (const expiry of expiries) {
    console.log(`[Alpaca] Fetching ${symbol} ${expiry.date} (${expiry.dte} DTE)...`);
    
    try {
      const contracts = await getAlpacaChainForExpiry(symbol, expiry.date, headers);
      
      // Group by strike
      const strikeMap = {};
      for (const contract of contracts) {
        if (!strikeMap[contract.strike]) {
          strikeMap[contract.strike] = { strike: contract.strike };
        }
        
        if (contract.type === 'call') {
          strikeMap[contract.strike].call = {
            bid: contract.bid,
            ask: contract.ask,
            mid: contract.mid,
            last: contract.last,
            volume: contract.volume,
            openInterest: contract.openInterest,
            iv: contract.iv,
            delta: contract.delta,
            gamma: contract.gamma,
            theta: contract.theta,
            vega: contract.vega
          };
        } else {
          strikeMap[contract.strike].put = {
            bid: contract.bid,
            ask: contract.ask,
            mid: contract.mid,
            last: contract.last,
            volume: contract.volume,
            openInterest: contract.openInterest,
            iv: contract.iv,
            delta: contract.delta,
            gamma: contract.gamma,
            theta: contract.theta,
            vega: contract.vega
          };
        }
      }
      
      // Convert to array and sort by strike
      const strikes = Object.values(strikeMap)
        .filter(s => s.call || s.put)
        .sort((a, b) => a.strike - b.strike);
      
      chainData.push({
        date: expiry.date,
        dte: expiry.dte,
        type: expiry.type,
        strikes
      });
      
      console.log(`[Alpaca] ✓ ${strikes.length} strikes for ${expiry.date}`);
      
    } catch (error) {
      console.error(`[Alpaca] Failed to fetch ${expiry.date}:`, error.message);
      // Continue with other expiries
    }
  }
  
  return {
    fetchedAt: new Date().toISOString(),
    source: 'alpaca',
    expiries: chainData
  };
}

module.exports = {
  fetchOptionsChain,
  getAlpacaChainForExpiry,
  getKeyExpiries,
  buildAlpacaHeaders
};
