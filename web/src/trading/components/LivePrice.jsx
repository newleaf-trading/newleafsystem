/**
 * LivePrice Component - Display live-updating stock prices
 * Shows current price, change, and percentage with real-time updates
 */

import { useEffect, useState } from 'react';
import { useRealtimePrice } from '../hooks/useRealtimePrice';

/**
 * LivePrice Component
 * @param {Object} props
 * @param {string} props.symbol - Stock symbol
 * @param {boolean} props.showChange - Show price change
 * @param {boolean} props.showPercent - Show percentage change
 * @param {string} props.size - Size variant ('sm', 'md', 'lg')
 * @param {boolean} props.showMarketStatus - Show market status indicator
 * @param {string} props.className - Additional CSS classes
 */
export function LivePrice({
  symbol,
  showChange = true,
  showPercent = true,
  size = 'md',
  showMarketStatus = false,
  className = '',
}) {
  const {
    price,
    change,
    changePercent,
    isLoading,
    error,
    lastUpdatedSeconds,
    marketStatus,
    hasData,
  } = useRealtimePrice(symbol);

  const [isPulsing, setIsPulsing] = useState(false);
  const [prevPrice, setPrevPrice] = useState(price);

  // DEBUG: Log component state
  useEffect(() => {
    console.log(`[LivePrice] ${symbol}:`, {
      price,
      change,
      changePercent,
      isLoading,
      hasData,
      error,
      lastUpdatedSeconds,
      marketStatus: marketStatus?.label,
    });
  }, [symbol, price, change, changePercent, isLoading, hasData, error, lastUpdatedSeconds, marketStatus]);

  // Trigger pulse animation when price changes
  useEffect(() => {
    if (hasData && price !== prevPrice && prevPrice !== 0) {
      setIsPulsing(true);
      const timeout = setTimeout(() => setIsPulsing(false), 500);
      return () => clearTimeout(timeout);
    }
    setPrevPrice(price);
  }, [price, prevPrice, hasData]);

  // Size classes
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-2xl font-semibold',
  };

  // Change color
  const isPositive = change >= 0;
  const changeColor = isPositive ? 'text-green-600' : 'text-red-600';

  // Loading skeleton
  if (isLoading || !hasData) {
    return (
      <div className={`inline-flex items-center gap-2 ${className}`}>
        <div className={`animate-pulse bg-gray-200 rounded h-6 w-20 ${sizeClasses[size]}`}></div>
        {showChange && (
          <div className="animate-pulse bg-gray-200 rounded h-5 w-16"></div>
        )}
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className={`inline-flex items-center gap-2 text-red-600 ${sizeClasses[size]} ${className}`}>
        <span>Error</span>
        <button
          onClick={() => window.location.reload()}
          className="text-xs underline hover:no-underline"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      {/* Market Status Indicator */}
      {showMarketStatus && (
        <span
          className="text-xs mr-1"
          title={`${marketStatus.label} - Last updated ${lastUpdatedSeconds}s ago`}
        >
          {marketStatus.emoji}
        </span>
      )}

      {/* Price */}
      <span
        className={`
          ${sizeClasses[size]}
          ${isPulsing ? 'animate-pulse-subtle' : ''}
          transition-all duration-300
          font-semibold
        `}
      >
        ${price.toFixed(2)}
      </span>

      {/* Change and Percent */}
      {(showChange || showPercent) && (
        <span
          className={`
            inline-flex items-center gap-1.5 text-xs font-medium
            ${changeColor}
          `}
        >
          {showChange && (
            <span>
              {isPositive ? '+$' : '-$'}{Math.abs(change).toFixed(2)}
            </span>
          )}
          {showChange && showPercent && <span className="opacity-40 mx-0.5">•</span>}
          {showPercent && (
            <span>
              {isPositive ? '+' : ''}{changePercent.toFixed(2)}%
            </span>
          )}
        </span>
      )}

      {/* Last Updated Tooltip */}
      {lastUpdatedSeconds !== null && (
        <span
          className="text-xs text-gray-400 cursor-help"
          title={`Last updated ${lastUpdatedSeconds} seconds ago`}
        >
          •
        </span>
      )}

      {/* Delayed Data Disclaimer */}
      {size === 'lg' && (
        <span className="text-xs text-gray-400 ml-2">
          ~15 min delay
        </span>
      )}
    </div>
  );
}

/**
 * Skeleton loader for LivePrice
 */
export function LivePriceSkeleton({ size = 'md', showChange = true, className = '' }) {
  const sizeClasses = {
    sm: 'h-4 w-16',
    md: 'h-6 w-20',
    lg: 'h-8 w-24',
  };

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <div className={`animate-pulse bg-gray-200 rounded ${sizeClasses[size]}`}></div>
      {showChange && (
        <div className="animate-pulse bg-gray-200 rounded h-5 w-16"></div>
      )}
    </div>
  );
}

/**
 * Compact price display without change indicators
 */
export function LivePriceCompact({ symbol, className = '' }) {
  return (
    <LivePrice
      symbol={symbol}
      showChange={false}
      showPercent={false}
      size="sm"
      className={className}
    />
  );
}

/**
 * Large prominent price display with market status
 */
export function LivePriceLarge({ symbol, className = '' }) {
  return (
    <LivePrice
      symbol={symbol}
      showChange={true}
      showPercent={true}
      size="lg"
      showMarketStatus={true}
      className={className}
    />
  );
}
