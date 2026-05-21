import { useMemo } from 'react';
import { formatStrategy } from '../utils/formatters';

export function StrategyFilter({ selectedStrategy, onStrategyChange, tiles = [] }) {
  // Build strategy list dynamically from tiles
  const strategies = useMemo(() => {
    const seen = new Set();
    const list = [{ id: 'all', label: 'All' }];

    tiles.forEach(tile => {
      if (!tile.strategy) return;
      const normalised = tile.strategy.toLowerCase().replace(/_/g, ' ');
      if (!seen.has(normalised)) {
        seen.add(normalised);
        list.push({ id: normalised, label: formatStrategy(tile.strategy) });
      }
    });

    return list;
  }, [tiles]);

  return (
    <div className="filter-wrap">
      <span className="filter-label">Filter:</span>
      {strategies.map((strategy) => (
        <button
          key={strategy.id}
          className={`filter-chip ${selectedStrategy === strategy.id ? 'active' : ''}`}
          onClick={() => onStrategyChange(strategy.id)}
        >
          {strategy.label}
        </button>
      ))}
    </div>
  );
}
