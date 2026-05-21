import { ExternalLink, Bookmark } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

/**
 * Strategy Card Component - Matches NewLeaf TechnicalCard design
 * Displays gamma wall strategy with metrics
 */
export function StrategyCard({ ticker, spot, data, onBookmark, isBookmarked }) {
  const navigate = useNavigate();

  if (!data) return null;

  const {
    put_wall,
    call_wall,
    gamma_flip,
    center,
    band_width_pct,
    position_in_band_pct,
    confidence_score,
    condor_allowed,
    decision,
  } = data;

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
    return `${Math.abs(value).toFixed(1)}%`;
  };

  const getStrategyType = () => {
    if (condor_allowed) return 'IRON CONDOR';
    if (position_in_band_pct < 40) return 'NEAR PUT WALL';
    if (position_in_band_pct > 60) return 'NEAR CALL WALL';
    return 'NEUTRAL RANGE';
  };

  const getBadgeText = () => {
    if (confidence_score >= 0.75) return 'High Conviction';
    if (confidence_score >= 0.60) return 'Moderate Setup';
    return 'Low Confidence';
  };

  const getThemeClass = () => {
    if (condor_allowed) return 'theme-iron-condor';
    return 'theme-bull-call';
  };

  const handleCardClick = () => {
    navigate(`/invest/gamma/${ticker}`);
  };

  const handleBookmarkClick = (e) => {
    e.stopPropagation();
    if (onBookmark) {
      onBookmark({ ticker, spot, data });
    }
  };

  return (
    <div className={`pro-card ${getThemeClass()}`} onClick={handleCardClick}>
      {/* Badge & Bookmark */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div className="pc-badge">{getBadgeText()}</div>
        <button
          className="card-bookmark"
          onClick={handleBookmarkClick}
          aria-label={isBookmarked ? 'Remove bookmark' : 'Add bookmark'}
        >
          <Bookmark
            size={20}
            fill={isBookmarked ? 'currentColor' : 'none'}
            strokeWidth={2}
          />
        </button>
      </div>

      {/* Header */}
      <div className="pc-head">
        <h3 className="pc-ticker">{ticker}</h3>
        <div className="pc-days">${spot?.toFixed(2)}</div>
      </div>

      {/* Strategy */}
      <div className="pc-strategy">
        {getStrategyType()} • GAMMA ANALYSIS
      </div>

      {/* Metrics */}
      <div className="pc-metrics">
        <div className="pc-metric">
          <div className="pc-metric-left">
            <div className="pc-dot green"></div>
            <span className="pc-metric-label">Confidence Score</span>
          </div>
          <span className="pc-metric-value">{formatPercent(confidence_score * 100)}</span>
        </div>

        <div className="pc-metric">
          <div className="pc-metric-left">
            <div className="pc-dot amber"></div>
            <span className="pc-metric-label">Band Width</span>
          </div>
          <span className="pc-metric-value">{formatPercent(band_width_pct)}</span>
        </div>

        <div className="pc-metric">
          <div className="pc-metric-left">
            <div className="pc-dot red"></div>
            <span className="pc-metric-label">Put Wall</span>
          </div>
          <span className="pc-metric-value">{formatCurrency(put_wall)}</span>
        </div>

        <div className="pc-metric">
          <div className="pc-metric-left">
            <div className="pc-dot green"></div>
            <span className="pc-metric-label">Call Wall</span>
          </div>
          <span className="pc-metric-value profit">{formatCurrency(call_wall)}</span>
        </div>

        {gamma_flip && (
          <div className="pc-metric">
            <div className="pc-metric-left">
              <div className="pc-dot amber"></div>
              <span className="pc-metric-label">Gamma Flip</span>
            </div>
            <span className="pc-metric-value">{formatCurrency(gamma_flip)}</span>
          </div>
        )}
      </div>

      {/* Feature pills */}
      <div className="pc-pills">
        {condor_allowed && <span className="pc-pill">Condor Approved</span>}
        <span className="pc-pill">Gamma Walls</span>
        {decision?.suggestedStrikes && <span className="pc-pill">Has Strikes</span>}
      </div>

      {/* CTA */}
      <div className="pc-cta">
        View Gamma Analysis
        <ExternalLink style={{ width: '16px', height: '16px' }} strokeWidth={2} />
      </div>
    </div>
  );
}
