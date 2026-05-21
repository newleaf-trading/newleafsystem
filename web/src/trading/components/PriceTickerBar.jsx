/**
 * PriceTickerBar Component - Scrolling ticker bar showing live prices
 * Displays prices for all symbols in user's portfolio/watchlist
 */

import { useRealtimePrices } from '../hooks/useRealtimePrice';

/**
 * PriceTickerBar Component
 * @param {Object} props
 * @param {string[]} props.symbols - Array of stock symbols to display
 * @param {boolean} props.autoScroll - Enable auto-scrolling animation
 * @param {string} props.className - Additional CSS classes
 */
export function PriceTickerBar({ symbols = [], autoScroll = false, className = '' }) {
  const { prices, isLoading, marketStatus } = useRealtimePrices(symbols);

  if (symbols.length === 0) {
    return null;
  }

  return (
    <div className={`bg-gray-900 text-white py-2 overflow-hidden ${className}`}>
      <div className={`flex items-center gap-6 px-4 ${autoScroll ? 'animate-scroll' : ''}`}>
        {/* Market Status */}
        <div className="flex items-center gap-2 px-3 py-1 bg-gray-800 rounded">
          <span className="text-xs font-medium">{marketStatus.emoji} {marketStatus.label}</span>
        </div>

        {/* Ticker Items */}
        {isLoading && symbols.length > 0 ? (
          // Loading skeletons
          symbols.map((symbol) => (
            <div key={symbol} className="flex items-center gap-2">
              <div className="animate-pulse bg-gray-700 rounded h-4 w-12"></div>
              <div className="animate-pulse bg-gray-700 rounded h-4 w-16"></div>
            </div>
          ))
        ) : (
          // Live prices
          symbols.map((symbol) => {
            const upperSymbol = symbol.toUpperCase();
            const priceData = prices[upperSymbol];

            if (!priceData) {
              return (
                <div key={symbol} className="flex items-center gap-2 text-gray-400">
                  <span className="text-sm font-medium">{upperSymbol}</span>
                  <span className="text-xs">—</span>
                </div>
              );
            }

            const isPositive = priceData.change >= 0;
            const changeColor = isPositive ? 'text-green-400' : 'text-red-400';

            return (
              <div key={symbol} className="flex items-center gap-2 whitespace-nowrap">
                <span className="text-sm font-semibold">{upperSymbol}</span>
                <span className="text-sm">${priceData.price.toFixed(2)}</span>
                <span className={`text-xs ${changeColor}`}>
                  {isPositive ? '+' : ''}{priceData.changePercent.toFixed(2)}%
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/**
 * Minimal ticker bar for page headers
 */
export function PriceTickerBarCompact({ symbols = [], className = '' }) {
  const { prices, isLoading } = useRealtimePrices(symbols);

  if (symbols.length === 0 || isLoading) {
    return null;
  }

  return (
    <div className={`flex items-center gap-4 text-sm ${className}`}>
      {symbols.slice(0, 5).map((symbol) => {
        const upperSymbol = symbol.toUpperCase();
        const priceData = prices[upperSymbol];

        if (!priceData) return null;

        const isPositive = priceData.change >= 0;
        const changeColor = isPositive ? 'text-green-600' : 'text-red-600';

        return (
          <div key={symbol} className="flex items-center gap-1.5">
            <span className="font-medium text-gray-700">{upperSymbol}</span>
            <span className="text-gray-900">${priceData.price.toFixed(2)}</span>
            <span className={`text-xs ${changeColor}`}>
              {isPositive ? '+' : ''}{priceData.changePercent.toFixed(2)}%
            </span>
          </div>
        );
      })}
    </div>
  );
}
