/**
 * MoneyBreakdown — "+$4 per contract × 44 contracts = +$176 total"
 *
 * Props:
 *   perContract: number
 *   qty: number
 *   total: number
 *   dark?: boolean    — light text on dark hero background
 */

import { signedUsd } from '../../lib/money';
import styles from './invest.module.css';

export function MoneyBreakdown({ perContract, qty, total, dark = false }) {
  const cls = dark ? styles.breakdown : styles.breakdownLight;
  const totalClass = total >= 0 ? styles.pos : styles.neg;

  return (
    <div className={cls}>
      <b>{signedUsd(perContract)}</b> per contract<br />
      &times; <b>{qty}</b> contracts<br />
      = <b className={totalClass}>{signedUsd(total)}</b> total
    </div>
  );
}
