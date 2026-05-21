/**
 * Reusable UI Components for NewLeaf System
 * Institutional-grade design system components
 */

import { tokens } from '../../styles/tokens';
import { getStrategyTheme } from '../../utils/strategyThemes';
import { LivePriceLarge, LivePriceCompact } from '../LivePrice';
import './ui.css';

// ===============================
// KPI Card Component
// ===============================
export function KpiCard({ label, value, subtitle, variant = 'default', className = '' }) {
  const variantStyles = {
    default: {},
    softRed: {
      background: 'linear-gradient(180deg, rgba(201,79,79,0.12), #fff)',
    },
    softBlue: {
      background: 'linear-gradient(180deg, rgba(37,99,235,0.12), #fff)',
    },
    softGreen: {
      background: 'linear-gradient(180deg, rgba(11,122,82,0.12), #fff)',
    },
  };

  return (
    <div className={`nl-kpi-card ${className}`} style={variantStyles[variant]}>
      <div className="nl-kpi-label">{label}</div>
      <div className="nl-kpi-value">{value}</div>
      {subtitle && <div className="nl-kpi-subtitle">{subtitle}</div>}
    </div>
  );
}

// ===============================
// Segmented Tabs Component
// ===============================
export function SegmentedTabs({ tabs, activeTab, onChange, className = '' }) {
  return (
    <div className={`nl-segmented-tabs ${className}`}>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          className={`nl-seg-tab ${activeTab === tab.value ? 'active' : ''}`}
          onClick={() => onChange(tab.value)}
        >
          {tab.label}
          {tab.count !== undefined && <span className="nl-tab-count">{tab.count}</span>}
        </button>
      ))}
    </div>
  );
}

// ===============================
// Strategy Card Component
// ===============================
export function StrategyCard({
  symbol,
  companyName,
  strategy,
  dte,
  metrics = [],
  riskLevel = 50,
  confidence,
  onAdd,
  isAdded = false,
  onClick,
  children,
  className = '',
  // Phase 3 — new CTA pattern for Discover page
  onTakeTrade,      // "Take this trade" → routes to Build
  onSaveForLater,   // "Save for later" → adds to shortlist
  isSaved = false,  // whether already in shortlist
}) {
  const getRiskColor = (risk) => {
    if (risk < 30) return tokens.colors.success;
    if (risk < 60) return tokens.colors.warn;
    return tokens.colors.danger;
  };

  // Get strategy theme for color coding
  const theme = getStrategyTheme(strategy);

  return (
    <div className={`nl-strategy-card ${className}`} onClick={onClick}>
      <div className="nl-strat-header">
        <div className="nl-strat-ticker-row">
          <div className="nl-ticker-badge">{symbol}</div>
          <div className="nl-ticker-info">
            <h4>{companyName || symbol}</h4>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
              <LivePriceCompact symbol={symbol} />
              <span style={{ color: '#6b7280', fontSize: '13px' }}>· {dte} DTE</span>
            </div>
          </div>
        </div>
        <span
          className="nl-strat-tag"
          style={{
            borderColor: `${theme.primary}60`,
            background: theme.light,
            color: theme.dark,
          }}
        >
          {strategy}
        </span>
      </div>

      <div className="nl-strat-metrics">
        {metrics.map((metric, idx) => (
          <div key={idx} className={`nl-metric-box ${metric.primary ? 'primary' : ''}`}>
            <div className="nl-metric-label">{metric.label}</div>
            <div className={`nl-metric-value ${metric.positive ? 'positive' : metric.negative ? 'negative' : ''} ${metric.primary ? 'primary' : ''}`}>
              {metric.value}
            </div>
          </div>
        ))}
      </div>

      {riskLevel !== undefined && (
        <div className="nl-risk-bar-wrap">
          <div className="nl-risk-label-row">
            <span className="nl-risk-label">Risk Level</span>
          </div>
          <div className="nl-risk-track">
            <div
              className="nl-risk-fill"
              style={{
                width: `${riskLevel}%`,
                background: getRiskColor(riskLevel),
              }}
            />
          </div>
        </div>
      )}

      {children}

      {/* Phase 3 CTA pattern: Take this trade + Save for later */}
      {onTakeTrade && (
        <div className="nl-strat-footer" style={{ gap: '8px' }}>
          <button
            className="nl-add-btn primary"
            onClick={(e) => { e.stopPropagation(); onTakeTrade(); }}
          >
            Take this trade
          </button>
          {onSaveForLater && (
            <button
              className="nl-add-btn added"
              onClick={(e) => { e.stopPropagation(); onSaveForLater(); }}
              style={{ fontSize: '12px' }}
            >
              {isSaved ? '✓ Saved' : 'Save for later'}
            </button>
          )}
        </div>
      )}

      {/* Legacy CTA — kept for other consumers (PortfolioPageRefactored, etc.) */}
      {!onTakeTrade && onAdd && (
        <div className="nl-strat-footer">
          <button
            className={`nl-add-btn ${isAdded ? 'added' : 'primary'}`}
            onClick={(e) => {
              e.stopPropagation();
              onAdd();
            }}
          >
            {isAdded ? '✓ Added' : '+ Add to Portfolio'}
          </button>
        </div>
      )}
    </div>
  );
}

// ===============================
// Status Pill Component
// ===============================
export function StatusPill({ status = 'healthy', label, dot = true, className = '' }) {
  const statusConfig = {
    healthy: {
      color: tokens.colors.success,
      bg: tokens.colors.successLight,
      border: tokens.colors.successBorder,
    },
    warning: {
      color: tokens.colors.warn,
      bg: tokens.colors.warnLight,
      border: tokens.colors.warnBorder,
    },
    critical: {
      color: tokens.colors.danger,
      bg: tokens.colors.dangerLight,
      border: tokens.colors.dangerBorder,
    },
    neutral: {
      color: tokens.colors.mutedText,
      bg: 'rgba(17, 24, 39, 0.06)',
      border: tokens.colors.border,
    },
  };

  const config = statusConfig[status] || statusConfig.neutral;

  return (
    <span
      className={`nl-status-pill ${className}`}
      style={{
        color: config.color,
        background: config.bg,
        border: `1px solid ${config.border}`,
      }}
    >
      {dot && <span className="nl-status-dot" style={{ background: config.color }} />}
      {label || status}
    </span>
  );
}

// ===============================
// App Table Component
// ===============================
export function AppTable({ columns, data, className = '' }) {
  return (
    <div className="nl-table-wrap">
      <table className={`nl-app-table ${className}`}>
        <thead>
          <tr>
            {columns.map((col, idx) => (
              <th key={idx} style={{ textAlign: col.align || 'left' }}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, rowIdx) => (
            <tr key={rowIdx}>
              {columns.map((col, colIdx) => (
                <td key={colIdx} style={{ textAlign: col.align || 'left' }}>
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ===============================
// Banner Component
// ===============================
export function Banner({ icon, title, description, badge, className = '' }) {
  return (
    <div className={`nl-banner ${className}`}>
      <div className="nl-banner-content">
        {icon && <div className="nl-banner-icon">{icon}</div>}
        <div className="nl-banner-text">
          <h3>{title}</h3>
          {description && <p>{description}</p>}
        </div>
      </div>
      {badge && <div className="nl-banner-badge">{badge}</div>}
    </div>
  );
}

// ===============================
// Button Component
// ===============================
export function Button({ variant = 'primary', size = 'md', children, className = '', ...props }) {
  return (
    <button className={`nl-btn nl-btn-${variant} nl-btn-${size} ${className}`} {...props}>
      {children}
    </button>
  );
}

// ===============================
// Strategy Hero Component
// ===============================
export function StrategyHero({
  symbol,
  companyName,
  strategy,
  dte,
  spotPrice,
  publishedAt,
  stats = [],
  onBack,
  className = '',
}) {
  const formatDate = (timestamp) => {
    if (!timestamp) return null;
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const options = { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' };
    return `Published ${date.toLocaleDateString('en-US', options)} UTC`;
  };

  // Get strategy theme for color coding
  const theme = getStrategyTheme(strategy);

  return (
    <div className={`nl-strategy-hero ${className}`}>
      <div className="nl-hero-header">
        {onBack && (
          <button className="nl-hero-back" onClick={onBack}>
            ← Back to Discover
          </button>
        )}
        <div className="nl-hero-meta">
          <span
            className="nl-hero-tag"
            style={{
              borderColor: `${theme.primary}80`,
              background: `${theme.primary}38`,
            }}
          >
            {strategy}
          </span>
          {/* Live Price Display */}
          <span className="nl-hero-spot">
            <LivePriceLarge symbol={symbol} />
          </span>
          {dte !== undefined && <span className="nl-hero-dte">{dte} DTE</span>}
          {publishedAt && <span className="nl-hero-published">{formatDate(publishedAt)}</span>}
        </div>
      </div>

      <div className="nl-hero-title">
        <h1>
          <span className="nl-hero-ticker">{symbol}</span>
          {companyName && <span className="nl-hero-company">{companyName}</span>}
        </h1>
      </div>

      {stats.length > 0 && (
        <div className="nl-hero-stats">
          {stats.map((stat, idx) => (
            <div key={idx} className={`nl-hero-stat ${stat.primary ? 'primary' : ''}`}>
              <div className="nl-hero-stat-label">{stat.label}</div>
              <div className={`nl-hero-stat-value ${stat.positive ? 'positive' : stat.negative ? 'negative' : ''}`}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===============================
// StatTile Component
// ===============================
export function StatTile({ label, value, variant = 'default', className = '' }) {
  const variantStyles = {
    default: {},
    primary: {
      background: 'linear-gradient(135deg, rgba(11, 45, 35, 0.10), rgba(201, 169, 110, 0.12))',
      borderColor: 'rgba(11, 45, 35, 0.22)',
    },
    success: {
      background: 'rgba(11, 122, 82, 0.10)',
      borderColor: 'rgba(11, 122, 82, 0.20)',
    },
    danger: {
      background: 'rgba(201, 79, 79, 0.10)',
      borderColor: 'rgba(201, 79, 79, 0.20)',
    },
  };

  return (
    <div className={`nl-stat-tile ${className}`} style={variantStyles[variant]}>
      <div className="nl-stat-tile-label">{label}</div>
      <div className="nl-stat-tile-value">{value}</div>
    </div>
  );
}
