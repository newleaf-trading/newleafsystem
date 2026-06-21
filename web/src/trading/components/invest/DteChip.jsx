/**
 * DteChip — color-coded DTE badge.
 *   ≤7 DTE  → hot (red)
 *   ≤21 DTE → warm (amber)
 *   >21 DTE → cool (green)
 */

import styles from './invest.module.css';

export function DteChip({ dte }) {
  if (dte == null) return null;
  const cls = dte <= 7 ? styles.dteHot : dte <= 21 ? styles.dteWarm : styles.dteCool;
  return <span className={`${styles.dteChip} ${cls}`}>{dte} DTE</span>;
}
