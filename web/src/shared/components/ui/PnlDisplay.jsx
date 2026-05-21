import styles from './PnlDisplay.module.css';

/**
 * Formatted P&L display with automatic color.
 * @param {number} value — dollar amount
 * @param {string} size — 'sm' | 'md' | 'lg'
 * @param {boolean} showSign — show +/- prefix
 */
export function PnlDisplay({ value, size = 'md', showSign = true }) {
  if (value == null || isNaN(value)) {
    return <span className={`${styles.pnl} ${styles[size]} ${styles.neutral}`}>--</span>;
  }

  const isPositive = value > 0;
  const isNegative = value < 0;
  const colorClass = isPositive ? styles.profit : isNegative ? styles.loss : styles.neutral;
  const prefix = showSign && isPositive ? '+' : '';
  const formatted = `${prefix}$${Math.abs(Math.round(value)).toLocaleString()}`;

  return <span className={`${styles.pnl} ${styles[size]} ${colorClass}`}>{formatted}</span>;
}
