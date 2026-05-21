/**
 * Main options chain fetching module
 * Handles data source fallback: IB Gateway → Yahoo (placeholder for now)
 * @module optionsChain
 */

const {
  getKeyExpiries,
  getStrikesAroundSpot,
  calculateBlackScholesGreeks
} = require('./optionsHelpers');
const ibAdapter = require('./adapters/ibAdapter');

/**
 * Fetch complete options chain for a symbol
 * @param {string} symbol - Stock symbol (e.g., 'META', 'JNJ', 'SPY')
 * @param {number} spotPrice - Current stock price
 * @param {Object} options - Optional configuration
 * @param {number} options.numExpiries - Number of expiries to fetch (default: 3)
 * @param {number} options.numStrikes - Number of strikes above/below ATM (default: 10)
 * @param {Array<string>} options.dataSourcePriority - Data source priority (default: ['ib'])
 * @returns {Promise<Object>} Options chain data
 */
async function fetchOptionsChain(symbol, spotPrice, options = {}) {
  const {
    numExpiries = 3,
    numStrikes = 10,
    dataSourcePriority = ['ib'] // For now, only IB implemented
  } = options;
  
  console.log(`[fetchOptionsChain] Starting fetch for ${symbol} at $${spotPrice}`);
  
  // Step 1: Get key expiries
  const expiries = getKeyExpiries();
  const selectedExpiries = expiries.slice(0, numExpiries);
  
  console.log(`[fetchOptionsChain] Expiries:`, selectedExpiries.map(e => `${e.date} (${e.dte} DTE)`));
  
  // Step 2: Get strikes around spot
  const strikes = getStrikesAroundSpot(spotPrice, symbol, numStrikes);
  
  console.log(`[fetchOptionsChain] Strikes: ${strikes.length} strikes from $${strikes[0]} to $${strikes[strikes.length - 1]}`);
  
  // Step 3: Try data sources in priority order
  let dataSource = null;
  let chainData = null;
  
  for (const source of dataSourcePriority) {
    try {
      if (source === 'ib') {
        // Check if IB is available
        const ibAvailable = await ibAdapter.isAvailable();
        if (!ibAvailable) {
          console.log('[fetchOptionsChain] IB Gateway not available, skipping...');
          continue;
        }
        
        console.log('[fetchOptionsChain] Using IB Gateway as data source');
        dataSource = 'ib';
        
        // Fetch chain for each expiry
        chainData = await fetchFromIB(symbol, selectedExpiries, strikes, spotPrice);
        break; // Success!
      }
      
      // TODO: Implement Alpaca adapter
      // TODO: Implement Yahoo adapter
      
    } catch (error) {
      console.error(`[fetchOptionsChain] ${source} failed:`, error.message);
      continue; // Try next source
    }
  }
  
  if (!chainData) {
    throw new Error(`Failed to fetch options chain for ${symbol}: all data sources failed`);
  }
  
  // Step 4: Return formatted result
  return {
    fetchedAt: new Date().toISOString(),
    source: dataSource,
    expiries: chainData
  };
}

/**
 * Fetch options chain from IB Gateway
 * @private
 */
async function fetchFromIB(symbol, expiries, strikes, spotPrice) {
  const chainData = [];
  
  for (const expiry of expiries) {
    console.log(`[IB] Fetching ${expiry.date} (${expiry.dte} DTE)...`);
    
    try {
      const strikeData = await ibAdapter.fetchOptionsChain(symbol, expiry.date, strikes);
      
      // Fill in missing Greeks with Black-Scholes if needed
      const filledStrikeData = strikeData.map(s => {
        const result = { strike: s.strike };
        
        // Process call
        if (s.call) {
          result.call = { ...s.call };
          
          // If Greeks are missing or zero, calculate with Black-Scholes
          if (!s.call.delta || s.call.delta === 0) {
            const greeks = calculateBlackScholesGreeks(
              spotPrice,
              s.strike,
              expiry.date,
              s.call.iv || 0.25, // Default IV if missing
              'C'
            );
            result.call = { ...result.call, ...greeks };
          }
        }
        
        // Process put
        if (s.put) {
          result.put = { ...s.put };
          
          // If Greeks are missing or zero, calculate with Black-Scholes
          if (!s.put.delta || s.put.delta === 0) {
            const greeks = calculateBlackScholesGreeks(
              spotPrice,
              s.strike,
              expiry.date,
              s.put.iv || 0.25, // Default IV if missing
              'P'
            );
            result.put = { ...result.put, ...greeks };
          }
        }
        
        return result;
      });
      
      chainData.push({
        date: expiry.date,
        dte: expiry.dte,
        type: expiry.type,
        strikes: filledStrikeData
      });
      
      console.log(`[IB] ✓ Fetched ${filledStrikeData.length} strikes for ${expiry.date}`);
      
    } catch (error) {
      console.error(`[IB] Failed to fetch ${expiry.date}:`, error.message);
      // Continue with other expiries
    }
  }
  
  return chainData;
}

module.exports = {
  fetchOptionsChain
};
