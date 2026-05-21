/**
 * useRealtimePrice - Hook for real-time price updates
 * Subscribes to price updates through the centralized PriceContext
 */

import { useEffect, useState, useMemo } from 'react';
import { usePriceContext } from '../contexts/PriceContext';

/**
 * Subscribe to real-time price updates for a single symbol
 * @param {string} symbol - Stock symbol to track
 * @returns {Object} - Price data and loading state
 */
export function useRealtimePrice(symbol) {
  const { subscribe, unsubscribe, getPrice, lastUpdate, marketStatus } = usePriceContext();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Subscribe to symbol on mount, unsubscribe on unmount
  useEffect(() => {
    if (!symbol) return;

    const upperSymbol = symbol.toUpperCase();
    console.log('[useRealtimePrice] Mounting for symbol:', upperSymbol);
    subscribe(upperSymbol);

    return () => {
      console.log('[useRealtimePrice] Unmounting for symbol:', upperSymbol);
      unsubscribe(upperSymbol);
    };
  }, [symbol, subscribe, unsubscribe]);

  // Get current price data
  const priceData = useMemo(() => {
    if (!symbol) return null;
    return getPrice(symbol.toUpperCase());
  }, [symbol, getPrice, lastUpdate]);

  // Update loading state
  useEffect(() => {
    if (priceData) {
      setIsLoading(false);
      setError(null);
    } else if (symbol) {
      setIsLoading(true);
    }
  }, [priceData, symbol]);

  // Calculate time since last update
  const lastUpdatedSeconds = useMemo(() => {
    if (!lastUpdate) return null;
    return Math.floor((Date.now() - lastUpdate.getTime()) / 1000);
  }, [lastUpdate]);

  return {
    price: priceData?.price || 0,
    change: priceData?.change || 0,
    changePercent: priceData?.changePercent || 0,
    volume: priceData?.volume || 0,
    marketCap: priceData?.marketCap || 0,
    fiftyTwoWeekHigh: priceData?.fiftyTwoWeekHigh || 0,
    fiftyTwoWeekLow: priceData?.fiftyTwoWeekLow || 0,
    previousClose: priceData?.previousClose || 0,
    open: priceData?.open || 0,
    dayHigh: priceData?.dayHigh || 0,
    dayLow: priceData?.dayLow || 0,
    isLoading,
    error,
    lastUpdated: lastUpdate,
    lastUpdatedSeconds,
    marketStatus,
    hasData: !!priceData,
  };
}

/**
 * Subscribe to real-time price updates for multiple symbols
 * @param {string[]} symbols - Array of stock symbols to track
 * @returns {Object} - Map of symbol to price data
 */
export function useRealtimePrices(symbols = []) {
  const { subscribe, unsubscribe, getPrice, lastUpdate, marketStatus } = usePriceContext();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  // Subscribe to symbols on mount, unsubscribe on unmount
  useEffect(() => {
    if (!symbols || symbols.length === 0) return;

    const upperSymbols = symbols.map(s => s.toUpperCase());
    upperSymbols.forEach(symbol => subscribe(symbol));

    return () => {
      upperSymbols.forEach(symbol => unsubscribe(symbol));
    };
  }, [symbols.join(','), subscribe, unsubscribe]); // Join to compare array by value

  // Get current price data for all symbols
  const pricesMap = useMemo(() => {
    if (!symbols || symbols.length === 0) return {};

    const map = {};
    symbols.forEach(symbol => {
      const upperSymbol = symbol.toUpperCase();
      const priceData = getPrice(upperSymbol);
      if (priceData) {
        map[upperSymbol] = priceData;
      }
    });

    return map;
  }, [symbols, getPrice, lastUpdate]);

  // Update loading state
  useEffect(() => {
    if (symbols.length === 0) {
      setIsLoading(false);
      return;
    }

    const hasAllPrices = symbols.every(symbol => pricesMap[symbol.toUpperCase()]);
    setIsLoading(!hasAllPrices);

    if (hasAllPrices) {
      setError(null);
    }
  }, [pricesMap, symbols]);

  // Calculate time since last update
  const lastUpdatedSeconds = useMemo(() => {
    if (!lastUpdate) return null;
    return Math.floor((Date.now() - lastUpdate.getTime()) / 1000);
  }, [lastUpdate]);

  return {
    prices: pricesMap,
    isLoading,
    error,
    lastUpdated: lastUpdate,
    lastUpdatedSeconds,
    marketStatus,
    count: Object.keys(pricesMap).length,
  };
}
