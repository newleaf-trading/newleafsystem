import { ExternalLink, Bookmark } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePortfolio } from '../hooks/usePortfolio';
import { useMemo } from 'react';
import { calculateMetrics } from '../utils/optionsCalc';
import { getThemeClass } from '../utils/strategyThemes';
import { SentimentBadge } from './SentimentBadge';

export function TechnicalCard({ tile }) {
  const navigate = useNavigate();
  const { addToPortfolio, removeFromPortfolio, isInPortfolio } = usePortfolio();
  const { technical = {}, symbol, strategy, daysToExpiry, legs = [], greeks = {} } = tile;

  // Calculate metrics from legs
  const metrics = useMemo(() => calculateMetrics(tile), [tile]);

  // Data mapping with fallbacks - use calculated metrics if tile properties are missing
  const probability = tile.oddsOfProfit ?? tile.probOfProfit ?? technical.probOfProfit ?? technical.probability ?? 0;
  const maxProfit = tile.maxProfit ?? technical.maxProfit ?? metrics.maxProfit;
  const maxLoss = tile.maxLoss ?? technical.maxLoss ?? metrics.maxLoss;
  const roi = tile.returnOnCapital ?? technical.returnOnCapital ?? technical.roi ?? (maxLoss > 0 ? (maxProfit / maxLoss * 100) : 0);
  const theta = greeks.netTheta || technical.theta || 0;

  // Skip rendering if no meaningful data
  if (probability === 0 && roi === 0 && maxLoss === 0) {
    return null;
  }

  const formatCurrency = (value) => {
    if (!value || isNaN(value)) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(Math.abs(value));
  };

  const formatPercent = (value) => {
    if (!value || isNaN(value)) return '0%';
    return `${value.toFixed(1)}%`;
  };

  // Format strategy type
  const getStrategyType = (strat) => {
    if (strat === 'iron condor') return 'NEUTRAL';
    if (strat === 'bull put spread') return 'BULLISH';
    if (strat === 'covered call') return 'INCOME';
    return 'DIRECTIONAL';
  };

  // Format legs info
  const getLegsInfo = () => {
    if (!legs || legs.length === 0) return '4 LEGS';
    const strikes = legs.map(l => l.strike).join('/');
    return `${legs.length} LEGS • ${strikes}`;
  };

  const handleTogglePortfolio = async (e) => {
    e.stopPropagation();
    try {
      if (isInPortfolio(tile.id)) {
        await removeFromPortfolio(tile.id);
      } else {
        await addToPortfolio(tile);
      }
    } catch (err) {
      console.error('Error toggling portfolio:', err);
    }
  };

  const handleCardClick = () => {
    navigate(`/invest/position/${tile.id}`);
  };

  const themeClass = getThemeClass(strategy);

  return (
    <div className={`pro-card ${themeClass}`} onClick={handleCardClick}>
      {/* Badge */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div className="pc-badge">High Conviction</div>
          {tile.sentiment && <SentimentBadge sentiment={tile.sentiment} />}
        </div>
        <button
          className="card-bookmark"
          onClick={handleTogglePortfolio}
          aria-label={isInPortfolio(tile.id) ? 'Remove from portfolio' : 'Add to portfolio'}
        >
          <Bookmark
            size={20}
            fill={isInPortfolio(tile.id) ? 'currentColor' : 'none'}
            strokeWidth={2}
          />
        </button>
      </div>

      {/* Header */}
      <div className="pc-head">
        <h3 className="pc-ticker">{symbol}</h3>
        <div className="pc-days">{daysToExpiry}d</div>
      </div>

      {/* Strategy */}
      <div className="pc-strategy">
        {getStrategyType(strategy)} • {getLegsInfo()}
      </div>

      {/* Metrics */}
      <div className="pc-metrics">
        <div className="pc-metric">
          <div className="pc-metric-left">
            <div className="pc-dot green"></div>
            <span className="pc-metric-label">Delta Neutral Prob</span>
          </div>
          <span className="pc-metric-value">{formatPercent(probability)}</span>
        </div>

        <div className="pc-metric">
          <div className="pc-metric-left">
            <div className="pc-dot amber"></div>
            <span className="pc-metric-label">Return / Margin</span>
          </div>
          <span className="pc-metric-value">{roi > 0 ? roi.toFixed(1) : 0}%</span>
        </div>

        <div className="pc-metric">
          <div className="pc-metric-left">
            <div className="pc-dot red"></div>
            <span className="pc-metric-label">Max Risk Exposure</span>
          </div>
          <span className="pc-metric-value loss">{formatCurrency(maxLoss)}</span>
        </div>

        <div className="pc-metric">
          <div className="pc-metric-left">
            <div className="pc-dot green"></div>
            <span className="pc-metric-label">Daily Theta Accrual</span>
          </div>
          <span className="pc-metric-value profit">
            {theta > 0 ? `+$${theta.toFixed(0)}/day` : '$0/day'}
          </span>
        </div>
      </div>

      {/* Feature pills */}
      <div className="pc-pills">
        <span className="pc-pill">Defined Risk</span>
        <span className="pc-pill">Range Bound</span>
        <span className="pc-pill">Theta+</span>
      </div>

      {/* CTA */}
      <div className="pc-cta">
        Analyze Position
        <ExternalLink style={{ width: '16px', height: '16px' }} strokeWidth={2} />
      </div>
    </div>
  );
}
