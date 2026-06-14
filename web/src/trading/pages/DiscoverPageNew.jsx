import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortfolio } from '../hooks/usePortfolio';
import { useShortlist } from '../hooks/useShortlist';
import { useMarketState } from '../hooks/useMarketState';
import { formatStrategy } from '../utils/formatters';
import { calculateMetrics } from '../utils/optionsCalc';
import { deriveCandidate, computeLiveDte } from '../lib/deriveCandidate';
import { tileToCanonical } from '../lib/toCanonical';
import { applyPublishGate, deriveTier } from '../lib/tileSchema';
import { SegmentedTabs, StrategyCard } from '../components/ui';
import { ReviewBadge } from '../components/invest';
import { PhaseHeader } from '../components/PhaseHeader';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { Button } from '../../shared/components/ui/Button';
import styles from './DiscoverPage.module.css';
import '../styles/newleaf-system.css';

const COMPANY_NAMES = {
  AMZN: 'Amazon', AAPL: 'Apple', SPY: 'S&P 500 ETF', MSFT: 'Microsoft',
  NVDA: 'Nvidia', GOOGL: 'Alphabet', GOOG: 'Alphabet', META: 'Meta',
  TSLA: 'Tesla', NFLX: 'Netflix', QQQ: 'Nasdaq 100', IWM: 'Russell 2000',
  AMD: 'AMD', DIS: 'Disney', JPM: 'JPMorgan', V: 'Visa', MA: 'Mastercard',
  BA: 'Boeing', COST: 'Costco', CRM: 'Salesforce', AVGO: 'Broadcom',
  BABA: 'Alibaba', ADBE: 'Adobe', U: 'Unity', ORCL: 'Oracle',
};

function getMarketPulse(tiles, marketState) {
  const strategies = tiles.map(t => (t.strategy || '').toLowerCase().replace(/_/g, ' '));
  const hasCondors = strategies.some(s => s.includes('iron condor'));
  const hasCovered = strategies.some(s => s.includes('covered'));
  const hasSpreads = strategies.some(s => s.includes('spread'));
  const vix = marketState?.vix;
  const vixText = vix ? `VIX at ${vix.toFixed(1)} — ` : '';

  if (vix && vix < 18) {
    return { headline: 'Low Volatility Environment', detail: `${vixText}Ideal conditions for iron condors and covered calls. Wide ranges, high probability of profit.` };
  }
  if (vix && vix >= 18 && vix < 25) {
    return { headline: 'Moderate Volatility', detail: `${vixText}Good premiums available. Consider spreads and selective condors with wider strikes.` };
  }
  if (vix && vix >= 25) {
    return { headline: 'Elevated Volatility', detail: `${vixText}High premiums but increased risk. Focus on defined-risk spreads with smaller position sizes.` };
  }
  if (hasCondors && hasCovered) {
    return { headline: 'Low Volatility Environment', detail: 'Ideal conditions for iron condors and covered calls. Wide ranges, high probability of profit.' };
  }
  if (hasSpreads && !hasCondors) {
    return { headline: 'Directional Bias Detected', detail: 'Market favoring directional spreads. Consider bull put and call spreads for defined-risk trades.' };
  }
  return { headline: 'Strategies Updated', detail: `${tiles.length} strategies available — sorted by return on capital.` };
}

const STRATEGY_FILTER_MAP = {
  'iron condors': t => (t.strategy || '').toLowerCase().replace(/_/g, ' ').includes('iron condor'),
  'diagonals': t => (t.strategy || '').toLowerCase().replace(/_/g, ' ').includes('diagonal'),
  'calendars': t => (t.strategy || '').toLowerCase().replace(/_/g, ' ').includes('calendar'),
  'butterflies': t => (t.strategy || '').toLowerCase().replace(/_/g, ' ').includes('butterfly'),
  'collars': t => (t.strategy || '').toLowerCase().replace(/_/g, ' ').includes('collar'),
  'volatility': t => { const s = (t.strategy || '').toLowerCase().replace(/_/g, ' '); return s.includes('straddle') || s.includes('strangle'); },
  'spreads': t => { const s = (t.strategy || '').toLowerCase().replace(/_/g, ' '); return s.includes('spread') && !s.includes('iron condor'); },
  'covered': t => (t.strategy || '').toLowerCase().replace(/_/g, ' ').includes('covered'),
};

const DEFAULT_FILTERS = {
  rewardRiskMin: -10, rewardRiskMax: 10,
  riskLevelMin: 0, riskLevelMax: 100,
  dteMin: 0, dteMax: 90,
};

export function DiscoverPageNew({ tiles }) {
  const navigate = useNavigate();
  const { isInPortfolio } = usePortfolio();
  const { addToShortlist, isShortlisted } = useShortlist();
  const { marketState } = useMarketState();
  const [filter, setFilter] = useState('all');
  const [showFilters, setShowFilters] = useState(true);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  const strategyTypes = useMemo(() => {
    const types = new Set();
    tiles.forEach(t => {
      const s = (t.strategy || '').toLowerCase().replace(/_/g, ' ');
      if (s.includes('iron condor')) types.add('iron condors');
      else if (s.includes('diagonal')) types.add('diagonals');
      else if (s.includes('calendar')) types.add('calendars');
      else if (s.includes('butterfly')) types.add('butterflies');
      else if (s.includes('collar')) types.add('collars');
      else if (s.includes('spread')) types.add('spreads');
      else if (s.includes('covered')) types.add('covered');
      else if (s.includes('straddle') || s.includes('strangle')) types.add('volatility');
      else types.add('other');
    });
    return ['all', ...Array.from(types)];
  }, [tiles]);

  const filteredTiles = useMemo(() => {
    const uniqueTilesMap = new Map();
    tiles.forEach(t => {
      if (!t.id) return;
      const existing = uniqueTilesMap.get(t.id);
      if (!existing || (t.returnOnCapital || 0) > (existing.returnOnCapital || 0)) {
        uniqueTilesMap.set(t.id, t);
      }
    });

    let result = Array.from(uniqueTilesMap.values()).filter(t => {
      if (isInPortfolio(t.id)) return false;
      return (
        t.lottery?.maxWin > 0 || t.technical?.maxLoss > 0 || t.maxProfit > 0 ||
        t.maxLoss > 0 || (t.legs && t.legs.length > 0) ||
        t.technical?.maxProfit > 0 || t.returnOnCapital > 0
      );
    });

    // Strategy type filter
    const filterFn = STRATEGY_FILTER_MAP[filter];
    if (filterFn) result = result.filter(filterFn);

    // Advanced filters
    result = result.filter(t => {
      const metrics = calculateMetrics(t);
      const maxProfit = t.maxProfit ?? t.lottery?.maxWin ?? t.technical?.maxProfit ?? metrics.maxProfit;
      const maxLoss = t.maxLoss ?? t.technical?.maxLoss ?? t.lottery?.ticketCost ?? metrics.maxLoss;
      let rewardRisk = maxLoss > 0 ? maxProfit / maxLoss : maxProfit > 0 ? 999 : 0;
      const probProfit = t.oddsOfProfit || t.probOfProfit || t.lottery?.oddsOfProfit || t.technical?.probability || 0;
      const riskLevel = Math.min(Math.max(100 - probProfit, 0), 100);
      const dte = computeLiveDte(t.expiry);

      // Filter out expired candidates
      if (dte <= 0) return false;

      return (
        rewardRisk >= filters.rewardRiskMin && rewardRisk <= filters.rewardRiskMax &&
        riskLevel >= filters.riskLevelMin && riskLevel <= filters.riskLevelMax &&
        dte >= filters.dteMin && dte <= filters.dteMax
      );
    });

    // Classify freshness + centeredness per tile, drop breached/expired/unpriced/gate-failed
    const classified = result.map(t => {
      const c = tileToCanonical(t);
      const liveSpot = t.underlyingPrice || 0;
      const fc = deriveCandidate(c, liveSpot);
      // Read-time publish gate (belt-and-suspenders for legacy tiles)
      // Uses verdictConfidence/oddsOfProfit from canonical, not generic confidence
      const gate = applyPublishGate({ verdictConfidence: t.verdictConfidence ?? null, oddsOfProfit: c.probability != null ? c.probability * 100 : null });
      const tier = deriveTier({ verdictConfidence: t.verdictConfidence ?? null });
      return { tile: t, fc, canonical: c, gate, tier };
    }).filter(({ fc, gate }) =>
      fc.priced &&
      fc.freshness !== 'breached' &&
      fc.freshness !== 'expired' &&
      gate.pass
    );

    // Sort by |offset| ascending — most centered first
    classified.sort((a, b) => Math.abs(a.fc.offset) - Math.abs(b.fc.offset));

    return classified;
  }, [tiles, filter, isInPortfolio, filters]);

  const pulse = useMemo(() => getMarketPulse(filteredTiles, marketState), [filteredTiles, marketState]);

  const formatCurr = (v) => {
    if (!v || isNaN(v)) return '$0';
    if (v >= 1000) return '$' + (v / 1000).toFixed(1) + 'k';
    return '$' + Math.round(v).toLocaleString();
  };

  const tabs = strategyTypes.map(type => ({
    value: type,
    label: type === 'all' ? 'All' :
           type === 'iron condors' ? 'Iron Condors' :
           type === 'diagonals' ? 'Diagonals' :
           type === 'calendars' ? 'Calendars' :
           type === 'butterflies' ? 'Butterflies' :
           type === 'collars' ? 'Collars' :
           type === 'volatility' ? 'Volatility' :
           type.charAt(0).toUpperCase() + type.slice(1),
  }));

  const hasActiveFilters =
    filters.rewardRiskMin !== DEFAULT_FILTERS.rewardRiskMin ||
    filters.rewardRiskMax !== DEFAULT_FILTERS.rewardRiskMax ||
    filters.riskLevelMin !== DEFAULT_FILTERS.riskLevelMin ||
    filters.riskLevelMax !== DEFAULT_FILTERS.riskLevelMax ||
    filters.dteMin !== DEFAULT_FILTERS.dteMin ||
    filters.dteMax !== DEFAULT_FILTERS.dteMax;

  const updateFilter = (key, value) => setFilters(prev => ({ ...prev, [key]: value }));

  return (
    <div className="nl-page">
      <PhaseHeader
        currentPhase="discover"
        title="Discover Strategies"
        activeCount={filteredTiles.length || null}
        compact
      />

      {/* Tabs + filter toggle */}
      <div className="nl-page-header" style={{ marginTop: -8 }}>
        <div />
        <div className={styles.filterRow}>
          <SegmentedTabs tabs={tabs} activeTab={filter} onChange={setFilter} />
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`${styles.filterToggle} ${showFilters ? styles.filterToggleActive : styles.filterToggleInactive}`}
          >
            Filters
            {hasActiveFilters && <span className={styles.filterDot} />}
          </button>
        </div>
      </div>

      {/* Advanced Filter Panel */}
      {showFilters && (
        <div className="nl-filter-panel">
          <div className="nl-filter-header">
            <h3>Advanced Filters</h3>
            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={() => setFilters(DEFAULT_FILTERS)}>
                Reset All
              </Button>
            )}
          </div>

          <div className="nl-filter-grid">
            <div className="nl-filter-group">
              <label className="nl-filter-label">
                Reward:Risk Ratio
                <span className="nl-filter-value">
                  {filters.rewardRiskMin.toFixed(1)}x - {filters.rewardRiskMax.toFixed(1)}x
                </span>
              </label>
              <div className="nl-dual-slider">
                <input type="range" min="-10" max="10" step="0.1" value={filters.rewardRiskMin}
                  onChange={e => updateFilter('rewardRiskMin', parseFloat(e.target.value))} className="nl-range-input" />
                <input type="range" min="-10" max="10" step="0.1" value={filters.rewardRiskMax}
                  onChange={e => updateFilter('rewardRiskMax', parseFloat(e.target.value))} className="nl-range-input" />
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--nl-muted-text-2)', marginTop: 4 }}>
                <span>Complex strategies (negative R:R)</span>
                <span>High R:R strategies</span>
              </div>
            </div>

            <div className="nl-filter-group">
              <label className="nl-filter-label">
                Risk Level
                <span className="nl-filter-value">{filters.riskLevelMin}% - {filters.riskLevelMax}%</span>
              </label>
              <div className="nl-dual-slider">
                <input type="range" min="0" max="100" step="5" value={filters.riskLevelMin}
                  onChange={e => updateFilter('riskLevelMin', parseInt(e.target.value))} className="nl-range-input" />
                <input type="range" min="0" max="100" step="5" value={filters.riskLevelMax}
                  onChange={e => updateFilter('riskLevelMax', parseInt(e.target.value))} className="nl-range-input" />
              </div>
            </div>

            <div className="nl-filter-group">
              <label className="nl-filter-label">
                Days to Expiry (DTE)
                <span className="nl-filter-value">{filters.dteMin} - {filters.dteMax} days</span>
              </label>
              <div className="nl-dual-slider">
                <input type="range" min="0" max="90" step="1" value={filters.dteMin}
                  onChange={e => updateFilter('dteMin', parseInt(e.target.value))} className="nl-range-input" />
                <input type="range" min="0" max="90" step="1" value={filters.dteMax}
                  onChange={e => updateFilter('dteMax', parseInt(e.target.value))} className="nl-range-input" />
              </div>
            </div>
          </div>

          <div className="nl-filter-footer">
            <div className="nl-filter-result-count">
              Showing <strong>{filteredTiles.length}</strong> {filteredTiles.length === 1 ? 'strategy' : 'strategies'}
            </div>
          </div>
        </div>
      )}

      {/* Market Pulse — count synced to post-filter */}
      <div className={styles.pulse}>
        <span className={styles.pulseIcon}>&#128225;</span>
        <span className={styles.pulseHeadline}>{pulse.headline}</span>
        <span className={styles.pulseCount}>
          &middot; {filteredTiles.length} {filteredTiles.length === 1 ? 'strategy' : 'strategies'} available
        </span>
      </div>

      {/* Strategy Cards Grid */}
      {filteredTiles.length === 0 ? (
        <EmptyState
          icon="&#128269;"
          title="No strategies match this filter"
          message="Try selecting a different filter above, or check back when new strategies are generated."
          actionLabel={hasActiveFilters ? 'Reset Filters' : undefined}
          onAction={hasActiveFilters ? () => setFilters(DEFAULT_FILTERS) : undefined}
        />
      ) : (
        <div className="nl-grid-2">
          {filteredTiles.map(({ tile, fc, tier }) => {
            const metrics = calculateMetrics(tile);
            const maxProfit = tile.maxProfit ?? tile.lottery?.maxWin ?? tile.technical?.maxProfit ?? metrics.maxProfit;
            const maxLoss = tile.maxLoss ?? tile.technical?.maxLoss ?? tile.lottery?.ticketCost ?? metrics.maxLoss;
            const probProfit = tile.oddsOfProfit || tile.probOfProfit || tile.lottery?.oddsOfProfit || tile.technical?.probability || 0;
            const dte = fc.liveDte;

            let rewardRiskDisplay = '--';
            if (maxLoss > 0) {
              rewardRiskDisplay = `${(maxProfit / maxLoss).toFixed(2)}x`;
            } else if (maxProfit > 0) {
              rewardRiskDisplay = '\u221E';
            }

            const riskFillWidth = Math.min(Math.max(100 - probProfit, 10), 90);
            const saved = isShortlisted(tile.id);

            // Centeredness chip text
            const centerChip = fc.side === 'centered'
              ? 'centered'
              : `${Math.round(Math.abs(fc.distancePct) * 100)}% toward ${fc.side}`;

            // Rail color by freshness
            const railColor = fc.freshness === 'fresh' ? '#16835f' : fc.freshness === 'drifted' ? '#bd7c19' : '#6b7280';

            const strategyMetrics = [
              { label: 'Reward:Risk', value: rewardRiskDisplay, positive: true, primary: true },
              { label: 'Max Profit', value: formatCurr(maxProfit), positive: true },
              { label: 'Max Loss', value: formatCurr(maxLoss), negative: true },
              { label: 'Probability', value: probProfit.toFixed(0) + '%' + (fc.popStale ? '*' : '') },
            ];

            return (
              <div key={tile.id} style={{ borderLeft: `3px solid ${railColor}`, borderRadius: '0 12px 12px 0', position: 'relative' }}>
                {/* Freshness badge + tier badge + centeredness chip */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '8px 12px 0', flexWrap: 'wrap' }}>
                  <ReviewBadge freshness={fc.freshness} />
                  {tier === 'verified' && (
                    <span style={{
                      fontFamily: "'Space Mono', monospace", fontSize: 9, letterSpacing: '.08em',
                      textTransform: 'uppercase', padding: '3px 8px', borderRadius: 6, fontWeight: 600,
                      background: '#e7f1ec', color: '#0f4a36', border: '0.5px solid #c3e4d6',
                    }}>
                      ✓ Reviewed
                    </span>
                  )}
                  <span style={{
                    fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: '.06em',
                    padding: '3px 8px', borderRadius: 6, fontWeight: 600,
                    background: fc.side === 'centered' ? '#edf8f3' : '#fff7e8',
                    color: fc.side === 'centered' ? '#0d6347' : '#bd7c19',
                  }}>
                    {centerChip}
                  </span>
                </div>
                <StrategyCard
                  symbol={tile.symbol}
                  companyName={COMPANY_NAMES[tile.symbol]}
                  strategy={formatStrategy(tile.strategy)}
                  dte={dte}
                  metrics={strategyMetrics}
                  riskLevel={riskFillWidth}
                  onTakeTrade={() => navigate(`/invest/build?add=${tile.id}`)}
                  onSaveForLater={() => { if (!saved) addToShortlist(tile); }}
                  isSaved={saved}
                  onClick={() => navigate(`/invest/strategy/${tile.id}`)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
