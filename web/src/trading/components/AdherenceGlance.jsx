/**
 * AdherenceGlance — the compact one-liner shown inside Home's Active Plan card.
 * Same model as the full card (useAdherence); no new computation. Behaviour
 * unchanged from the prior compact variant.
 */
import { Link } from 'react-router-dom';
import { useAdherence } from '../hooks/useAdherence';
import { signedUsd } from '../lib/money';
import styles from './AdherenceCard.module.css';

const pctStr = (frac) => (frac == null ? '—' : (frac * 100).toFixed(2) + '%');

export function AdherenceGlance() {
  const { a, plan, narration, loading } = useAdherence();

  if (loading || !plan) return null;

  if (a.phase === 'reconcile') {
    return (
      <div className={styles.compact}>
        <div className={styles.compactBanner}>
          {narration.verdict} <Link to="/invest/projection" className={styles.compactLink}>Re-commit →</Link>
        </div>
      </div>
    );
  }

  if (a.phase === 'coldstart') {
    return <div className={styles.compact}><div className={styles.compactVerdict}>{narration.verdict}</div></div>;
  }

  return (
    <div className={styles.compact}>
      <div className={styles.compactVerdict}>{narration.verdict}</div>
      <div className={styles.compactChips}>
        <span>Cadence <b>{a.actualTrades}/{Math.round(a.expectedTrades)}</b></span>
        <span>Realised edge <b>{pctStr(a.realisedEdge)}</b></span>
        <span>Net vs plan <b>{signedUsd(a.netVsExpected)}</b></span>
      </div>
    </div>
  );
}
