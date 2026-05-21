/**
 * PriceContext - Centralized price management
 * Manages all price subscriptions, deduplicates requests, and provides real-time updates
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { getWatchlistPrices, getMarketStatus, getPollingInterval } from '../utils/marketApi';

const PriceContext = createContext(null);

export function PriceProvider({ children }) {
  const [prices, setPrices] = useState({}); // symbol -> price data
  const [subscriptions, setSubscriptions] = useState(new Set()); // active symbol subscriptions
  const [isPolling, setIsPolling] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [marketStatus, setMarketStatus] = useState(getMarketStatus());
  const pollIntervalRef = useRef(null);
  const isVisibleRef = useRef(true);

  /**
   * Update market status
   */
  useEffect(() => {
    const updateMarketStatus = () => {
      setMarketStatus(getMarketStatus());
    };

    // Update market status every minute
    const statusInterval = setInterval(updateMarketStatus, 60000);
    return () => clearInterval(statusInterval);
  }, []);

  /**
   * Handle visibility change - pause polling when tab is hidden
   */
  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = !document.hidden;

      if (isVisibleRef.current && subscriptions.size > 0) {
        // Tab became visible - resume polling immediately
        fetchPrices();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [subscriptions]);

  /**
   * Fetch prices for all subscribed symbols
   */
  const fetchPrices = useCallback(async () => {
    if (subscriptions.size === 0 || !isVisibleRef.current) {
      console.log('[PriceContext] Skipping fetch:', {
        subscriptions: subscriptions.size,
        isVisible: isVisibleRef.current
      });
      return;
    }

    try {
      const symbols = Array.from(subscriptions);
      console.log('[PriceContext] Fetching prices for symbols:', symbols);

      const newPrices = await getWatchlistPrices(symbols);
      console.log('[PriceContext] Received prices:', newPrices);

      setPrices(prevPrices => {
        const updated = {
          ...prevPrices,
          ...newPrices,
        };
        console.log('[PriceContext] Updated prices:', updated);
        return updated;
      });

      setLastUpdate(new Date());
    } catch (error) {
      console.error('[PriceContext] Error fetching prices:', error);
    }
  }, [subscriptions]);

  /**
   * Start polling
   */
  useEffect(() => {
    if (subscriptions.size === 0) {
      setIsPolling(false);
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
      return;
    }

    setIsPolling(true);

    // Fetch immediately
    fetchPrices();

    // Set up polling interval
    const interval = getPollingInterval();
    pollIntervalRef.current = setInterval(fetchPrices, interval);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [subscriptions, fetchPrices]);

  /**
   * Update polling interval when market status changes
   */
  useEffect(() => {
    if (pollIntervalRef.current && subscriptions.size > 0) {
      clearInterval(pollIntervalRef.current);
      const interval = getPollingInterval();
      pollIntervalRef.current = setInterval(fetchPrices, interval);
    }
  }, [marketStatus, fetchPrices, subscriptions]);

  /**
   * Subscribe to a symbol
   */
  const subscribe = useCallback((symbol) => {
    if (!symbol) return;

    const upperSymbol = symbol.toUpperCase();
    console.log('[PriceContext] Subscribing to:', upperSymbol);

    setSubscriptions(prev => {
      const newSet = new Set(prev);
      newSet.add(upperSymbol);
      console.log('[PriceContext] Active subscriptions:', Array.from(newSet));
      return newSet;
    });
  }, []);

  /**
   * Unsubscribe from a symbol
   */
  const unsubscribe = useCallback((symbol) => {
    if (!symbol) return;

    const upperSymbol = symbol.toUpperCase();
    console.log('[PriceContext] Unsubscribing from:', upperSymbol);

    setSubscriptions(prev => {
      const newSet = new Set(prev);
      newSet.delete(upperSymbol);
      console.log('[PriceContext] Active subscriptions:', Array.from(newSet));
      return newSet;
    });
  }, []);

  /**
   * Get price for a specific symbol
   */
  const getPrice = useCallback((symbol) => {
    if (!symbol) return null;
    return prices[symbol.toUpperCase()] || null;
  }, [prices]);

  /**
   * Manually refresh all prices
   */
  const refresh = useCallback(() => {
    fetchPrices();
  }, [fetchPrices]);

  const value = {
    prices,
    subscribe,
    unsubscribe,
    getPrice,
    refresh,
    isPolling,
    lastUpdate,
    marketStatus,
    subscriptionCount: subscriptions.size,
  };

  return (
    <PriceContext.Provider value={value}>
      {children}
    </PriceContext.Provider>
  );
}

/**
 * Hook to use the price context
 */
export function usePriceContext() {
  const context = useContext(PriceContext);
  if (!context) {
    throw new Error('usePriceContext must be used within a PriceProvider');
  }
  return context;
}
