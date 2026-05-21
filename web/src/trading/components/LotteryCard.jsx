import { ArrowRight, Bookmark } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usePortfolio } from '../hooks/usePortfolio';
import { formatStrategy } from '../utils/formatters';
import { useMemo } from 'react';
import { calculateMetrics } from '../utils/optionsCalc';
import { getThemeClass } from '../utils/strategyThemes';

export function LotteryCard({ tile }) {
  const navigate = useNavigate();
  const { addToPortfolio, removeFromPortfolio, isInPortfolio } = usePortfolio();
  const { lottery = {}, technical = {}, symbol, strategy, daysToExpiry, aiInsight } = tile;

  // Calculate metrics from legs
  const metrics = useMemo(() => calculateMetrics(tile), [tile]);

  // Data mapping with fallbacks
  const maxWin = tile.maxProfit ?? lottery.maxWin ?? technical.maxProfit ?? metrics.maxProfit;
  const ticketCost = tile.maxLoss ?? lottery.ticketCost ?? technical.maxLoss ?? technical.margin ?? metrics.maxLoss;
  const odds = tile.oddsOfProfit ?? tile.probOfProfit ?? lottery.oddsOfProfit ?? lottery.odds ?? technical.probOfProfit ?? technical.probability ?? 0;
  const returnOnCapital = tile.returnOnCapital ?? technical.returnOnCapital ?? technical.roi ?? (ticketCost > 0 ? (maxWin / ticketCost * 100) : 0);
  const protectionText = aiInsight || lottery.profitZoneDesc || "Risk-defined structure limits maximum exposure while maintaining upside participation.";

  if (maxWin === 0 && ticketCost === 0) return null;

  const formatCurrency = (value) => {
    if (!value || isNaN(value)) return '$0';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(Math.abs(value));
  };

  const formatPercent = (value) => {
    if (!value || isNaN(value)) return '+0%';
    return `+${value.toFixed(0)}%`;
  };

  const oddsPercent = isNaN(odds) ? 0 : odds.toFixed(0);
  const riskPercent = isNaN(odds) ? 0 : (100 - odds).toFixed(0);
  const themeClass = getThemeClass(strategy);

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

  return (
    <div className={`client-card ${themeClass}`} onClick={handleCardClick}>
      {/* Strategy color bar */}
      <div className="cc-color-bar"></div>

      {/* Card body */}
      <div className="cc-body">
        {/* Header */}
        <div className="cc-head">
          <div className="cc-symbol">{symbol}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              className="cc-bookmark"
              onClick={handleTogglePortfolio}
              aria-label={isInPortfolio(tile.id) ? 'Remove from portfolio' : 'Add to portfolio'}
            >
              <Bookmark
                size={16}
                fill={isInPortfolio(tile.id) ? 'currentColor' : 'none'}
                strokeWidth={2}
              />
            </button>
          </div>
        </div>

        {/* Strategy badge */}
        <div className="cc-strategy-badge">
          <span className="cc-strategy-dot"></span>
          {formatStrategy(strategy)}
        </div>

        <div className="cc-duration">{daysToExpiry} days duration</div>

        {/* Targeted Return */}
        <div className="cc-return">
          <div className="cc-return-label">Targeted Return</div>
          <div className="cc-return-values">
            <div className="cc-amount">{formatCurrency(maxWin)}</div>
            {returnOnCapital > 0 && (
              <div className="cc-percent">{formatPercent(returnOnCapital)}</div>
            )}
          </div>
        </div>

        {/* Stats Grid */}
        <div className="cc-stats">
          <div className="cc-stat">
            <div className="cc-stat-label">Investment Cost</div>
            <div className="cc-stat-value">{formatCurrency(ticketCost)}</div>
          </div>
          <div className="cc-stat">
            <div className="cc-stat-label">Success Probability</div>
            <div className="cc-stat-value">{oddsPercent}%</div>
          </div>
        </div>

        {/* Probability Bar */}
        {odds > 0 && (
          <div className="cc-prob-bar">
            <div className="cc-prob-track">
              <div className="cc-prob-fill" style={{ width: `${oddsPercent}%` }}></div>
            </div>
            <div className="cc-prob-labels">
              <span className="cc-prob-risk">{riskPercent}% risk</span>
              <span className="cc-prob-success">{oddsPercent}% probability</span>
            </div>
          </div>
        )}

        {/* AI Insight */}
        <div className="cc-insight">
          <div className="cc-insight-header">
            <div className="cc-insight-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M12 2a7 7 0 0 1 7 7c0 2.38-1.19 4.47-3 5.74V17a1 1 0 0 1-1 1H9a1 1 0 0 1-1-1v-2.26C6.19 13.47 5 11.38 5 9a7 7 0 0 1 7-7z"/>
                <path d="M9 21h6M10 17v4M14 17v4"/>
              </svg>
            </div>
            <span className="cc-insight-label">AI Insight</span>
          </div>
          <p className="cc-insight-text">"{protectionText}"</p>
        </div>
      </div>

      {/* CTA — flush bottom */}
      <div className="cc-cta">
        View Complete Analysis
        <ArrowRight style={{ width: '16px', height: '16px' }} strokeWidth={2.5} />
      </div>
    </div>
  );
}
