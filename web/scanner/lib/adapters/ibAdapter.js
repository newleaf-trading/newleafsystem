/**
 * Interactive Brokers adapter for options chain fetching
 * Uses IB Gateway MCP server
 * @module ibAdapter
 */

const { calculateBlackScholesGreeks, formatDateIB } = require('../optionsHelpers');

// Import IB MCP tools (these will be available when tool is loaded)
let ibTools = null;

/**
 * Initialize IB adapter with MCP tools
 * @param {Object} tools - IB MCP tools object
 */
function initialize(tools) {
  ibTools = tools;
}

/**
 * Check if IB Gateway is available and authenticated
 * @returns {Promise<boolean>}
 */
async function isAvailable() {
  if (!ibTools || !ibTools.check_session) {
    return false;
  }
  
  try {
    await ibTools.check_session();
    return true;
  } catch (error) {
    console.log('IB Gateway not available:', error.message);
    return false;
  }
}

/**
 * Fetch option contract from IB Gateway
 * @param {string} symbol - Underlying symbol
 * @param {string} expiry - Expiration date (YYYY-MM-DD)
 * @param {number} strike - Strike price
 * @param {string} right - 'C' for call, 'P' for put
 * @returns {Promise<Object>} Contract data with bid, ask, Greeks, OI
 */
async function fetchOptionContract(symbol, expiry, strike, right) {
  if (!ibTools) {
    throw new Error('IB adapter not initialized');
  }
  
  // Convert expiry date to IB format (YYYYMMDD)
  const expiryDate = new Date(expiry);
  const expiryIB = formatDateIB(expiryDate);
  
  try {
    // Use IB MCP get_option_quote tool
    const quote = await ibTools.get_option_quote({
      symbol,
      expiry: expiryIB,
      strike,
      right
    });
    
    // IB returns data in specific format, extract what we need
    return {
      bid: quote.bid || 0,
      ask: quote.ask || 0,
      last: quote.last || 0,
      volume: quote.volume || 0,
      oi: quote.openInterest || 0,
      iv: quote.impliedVolatility || 0,
      greeks: {
        delta: quote.delta || 0,
        gamma: quote.gamma || 0,
        theta: quote.theta || 0,
        vega: quote.vega || 0
      }
    };
  } catch (error) {
    console.error(`IB fetch failed for ${symbol} ${expiry} ${strike}${right}:`, error.message);
    throw error;
  }
}

/**
 * Fetch full options chain from IB Gateway
 * @param {string} symbol - Underlying symbol
 * @param {string} expiry - Expiration date (YYYY-MM-DD)
 * @param {Array<number>} strikes - Array of strike prices
 * @returns {Promise<Array>} Array of strike data with call + put
 */
async function fetchOptionsChain(symbol, expiry, strikes) {
  if (!ibTools) {
    throw new Error('IB adapter not initialized');
  }
  
  const expiryDate = new Date(expiry);
  const expiryIB = formatDateIB(expiryDate);
  
  try {
    // Use IB's get_options_chain for efficiency (single call)
    const chain = await ibTools.get_options_chain({
      symbol,
      expiry: expiryIB,
      right: 'BOTH' // Get both calls and puts
    });
    
    // Map IB response to our format
    const strikeData = strikes.map(strike => {
      const callData = chain.calls?.find(c => c.strike === strike);
      const putData = chain.puts?.find(p => p.strike === strike);
      
      return {
        strike,
        call: callData ? {
          bid: callData.bid || 0,
          ask: callData.ask || 0,
          mid: (callData.bid + callData.ask) / 2,
          last: callData.last || 0,
          volume: callData.volume || 0,
          openInterest: callData.openInterest || 0,
          iv: callData.impliedVolatility || 0,
          delta: callData.delta || 0,
          gamma: callData.gamma || 0,
          theta: callData.theta || 0,
          vega: callData.vega || 0
        } : null,
        put: putData ? {
          bid: putData.bid || 0,
          ask: putData.ask || 0,
          mid: (putData.bid + putData.ask) / 2,
          last: putData.last || 0,
          volume: putData.volume || 0,
          openInterest: putData.openInterest || 0,
          iv: putData.impliedVolatility || 0,
          delta: putData.delta || 0,
          gamma: putData.gamma || 0,
          theta: putData.theta || 0,
          vega: putData.vega || 0
        } : null
      };
    });
    
    return strikeData.filter(s => s.call || s.put); // Remove strikes with no data
    
  } catch (error) {
    console.error(`IB chain fetch failed for ${symbol} ${expiry}:`, error.message);
    throw error;
  }
}

module.exports = {
  initialize,
  isAvailable,
  fetchOptionContract,
  fetchOptionsChain
};
