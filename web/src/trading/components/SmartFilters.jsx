export function SmartFilters({
  sortBy,
  onSortChange,
  riskLevel,
  onRiskLevelChange,
  minReturn,
  onMinReturnChange,
  resultCount,
  hasActiveFilters,
  onClearFilters
}) {
  return (
    <div className="smart-filters">
      <div className="smart-filters-container">
        {/* Sort Dropdown */}
        <div className="filter-group">
          <label className="filter-group-label">Sort by:</label>
          <select
            className="filter-select"
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
          >
            <option value="highest-return">Highest Return</option>
            <option value="best-odds">Best Odds</option>
            <option value="lowest-risk">Lowest Risk</option>
            <option value="best-reward-risk">Best Reward:Risk</option>
            <option value="highest-theta">Highest Theta</option>
            <option value="nearest-expiry">Nearest Expiry</option>
          </select>
        </div>

        {/* Risk Level Pills */}
        <div className="filter-group">
          <label className="filter-group-label">Risk:</label>
          <div className="filter-pills">
            <button
              className={`filter-pill ${riskLevel === 'all' ? 'active' : ''}`}
              onClick={() => onRiskLevelChange('all')}
            >
              All
            </button>
            <button
              className={`filter-pill ${riskLevel === 'conservative' ? 'active' : ''}`}
              onClick={() => onRiskLevelChange('conservative')}
            >
              Conservative
            </button>
            <button
              className={`filter-pill ${riskLevel === 'moderate' ? 'active' : ''}`}
              onClick={() => onRiskLevelChange('moderate')}
            >
              Moderate
            </button>
            <button
              className={`filter-pill ${riskLevel === 'aggressive' ? 'active' : ''}`}
              onClick={() => onRiskLevelChange('aggressive')}
            >
              Aggressive
            </button>
          </div>
        </div>

        {/* Min Return Dropdown */}
        <div className="filter-group">
          <label className="filter-group-label">Min Return:</label>
          <select
            className="filter-select"
            value={minReturn}
            onChange={(e) => onMinReturnChange(Number(e.target.value))}
          >
            <option value={0}>0%</option>
            <option value={20}>20%</option>
            <option value={40}>40%</option>
            <option value={60}>60%</option>
            <option value={80}>80%</option>
          </select>
        </div>

        {/* Results Count */}
        <div className="filter-results">
          <span className="results-count">{resultCount} results</span>
          {hasActiveFilters && (
            <button className="clear-filters" onClick={onClearFilters}>
              Clear filters
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
