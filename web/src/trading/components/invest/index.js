/**
 * Invest component kit — barrel export.
 *
 * Both detail views (DefendPage, DecidePage) and the list views
 * (PositionsPage, DashboardPage, PerformancePageNew) import from here.
 */

export { RiskGauge } from './RiskGauge';
export { MetricCard } from './MetricCard';
export { ReviewBadge } from './ReviewBadge';
export { LegsTable } from './LegsTable';
export { PayoffChart } from './PayoffChart';
export { MoneyBreakdown } from './MoneyBreakdown';
export { DteChip } from './DteChip';

// Re-export styles for direct className access (chips, badges, etc.)
export { default as investStyles } from './invest.module.css';
