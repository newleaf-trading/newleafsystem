import { useState, useEffect } from 'react';
import { StrategyFilter } from '../components/StrategyFilter';
import { SmartFilters } from '../components/SmartFilters';
import { AIInsightBar } from '../components/AIInsightBar';
import { TileGrid } from '../components/TileGrid';

export function HomePage({ tiles, view }) {
  const [selectedStrategy, setSelectedStrategy] = useState('all');
  const [sortBy, setSortBy] = useState('highest-return');
  const [riskLevel, setRiskLevel] = useState('all');
  const [minReturn, setMinReturn] = useState(0);

  // Reset strategy filter when switching to Client view
  useEffect(() => {
    if (view === 'lottery') setSelectedStrategy('all');
  }, [view]);

  // Filter and sort tiles
  let filteredTiles = tiles.filter(tile => {
    // Hide tiles with no data
    const hasData = tile.lottery?.maxWin > 0 || tile.technical?.maxLoss > 0;
    if (!hasData) return false;

    // Strategy filter (normalise underscores to spaces for comparison)
    if (selectedStrategy !== 'all' && (tile.strategy || '').toLowerCase().replace(/_/g, ' ') !== selectedStrategy) {
      return false;
    }

    // Risk level filter
    if (riskLevel !== 'all') {
      const prob = tile.lottery?.oddsOfProfit || tile.technical?.probability || 0;
      if (riskLevel === 'conservative' && prob < 80) return false;
      if (riskLevel === 'moderate' && (prob < 65 || prob >= 80)) return false;
      if (riskLevel === 'aggressive' && prob >= 65) return false;
    }

    // Min return filter
    const returnOnCapital = tile.technical?.returnOnCapital || tile.technical?.roi || 0;
    if (returnOnCapital < minReturn) return false;

    return true;
  });

  // Sort tiles
  filteredTiles = [...filteredTiles].sort((a, b) => {
    switch (sortBy) {
      case 'highest-return':
        return (b.technical?.returnOnCapital || 0) - (a.technical?.returnOnCapital || 0);
      case 'best-odds':
        return (b.lottery?.oddsOfProfit || b.technical?.probability || 0) -
               (a.lottery?.oddsOfProfit || a.technical?.probability || 0);
      case 'lowest-risk':
        return (a.technical?.maxLoss || 0) - (b.technical?.maxLoss || 0);
      case 'best-reward-risk':
        return (b.lottery?.rewardRisk || 0) - (a.lottery?.rewardRisk || 0);
      case 'highest-theta':
        return (b.greeks?.netTheta || 0) - (a.greeks?.netTheta || 0);
      case 'nearest-expiry':
        return (a.daysToExpiry || 999) - (b.daysToExpiry || 999);
      default:
        return 0;
    }
  });

  const hasActiveFilters = selectedStrategy !== 'all' || riskLevel !== 'all' || minReturn > 0;

  const clearFilters = () => {
    setSelectedStrategy('all');
    setRiskLevel('all');
    setMinReturn(0);
  };

  return (
    <>
      <div className="home-content-wrap">
        <AIInsightBar />
      </div>

      {view === 'pro' && (
        <StrategyFilter
          selectedStrategy={selectedStrategy}
          onStrategyChange={setSelectedStrategy}
          tiles={tiles}
        />
      )}
      <SmartFilters
        sortBy={sortBy}
        onSortChange={setSortBy}
        riskLevel={riskLevel}
        onRiskLevelChange={setRiskLevel}
        minReturn={minReturn}
        onMinReturnChange={setMinReturn}
        resultCount={filteredTiles.length}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
      />

      {/* View hint hidden for demo */}

      <div className="home-content-wrap">
        {filteredTiles.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📊</div>
            <h2 className="empty-title">No Opportunities Match Your Filters</h2>
            <p className="empty-message">
              Try adjusting your filters or clearing them to see more opportunities.
            </p>
            <button onClick={clearFilters} className="empty-code" style={{ cursor: 'pointer', border: 'none' }}>
              Clear All Filters
            </button>
          </div>
        ) : (
          <TileGrid tiles={filteredTiles} view={view} />
        )}
      </div>
    </>
  );
}
