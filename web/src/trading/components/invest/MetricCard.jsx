/**
 * MetricCard — eyebrow label + mono value + sub-line.
 *
 * Props:
 *   label: string          — "Total P&L"
 *   value: string          — "+$176" (pre-formatted)
 *   sub?: string           — "profit since entry · +$4 × 44"
 *   valueClass?: string    — extra class for value (e.g. styles.pos)
 *   className?: string
 *   style?: object
 */

import styles from './invest.module.css';

export function MetricCard({ label, value, sub, valueClass = '', className = '', style }) {
  return (
    <div className={`${styles.metricCard} ${className}`} style={style}>
      <div className={styles.metricLabel}>{label}</div>
      <div className={`${styles.metricValue} ${valueClass}`}>{value}</div>
      {sub && <div className={styles.metricSub}>{sub}</div>}
    </div>
  );
}
