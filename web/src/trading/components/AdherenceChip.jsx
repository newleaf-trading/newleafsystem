/**
 * AdherenceChip — a small phase-aware status pill linking to the PLANS adherence
 * view. Lives near the top of /invest/performance so the page stays a clean track
 * record while still surfacing "are you on track?" at a glance.
 *
 * Same model as the full card (useAdherence); purely presentational, no math.
 * Reconcile links to the Re-commit action; other phases link to the PLANS detail.
 */
import { Link } from 'react-router-dom';
import { useAdherence } from '../hooks/useAdherence';
import styles from './AdherenceCard.module.css';

const PLANS_DETAIL = '/invest/plans/active';

export function AdherenceChip() {
  const { a, plan, loading } = useAdherence();

  if (loading || !plan || !a) return null;

  let label, tone, to;
  switch (a.phase) {
    case 'reconcile':
      label = 'Plan needs reconciling';
      tone = styles.chipWarn;
      to = '/invest/projection';
      break;
    case 'coldstart':
      label = `Week ${a.weekNumber} · baseline`;
      tone = styles.chipNeutral;
      to = PLANS_DETAIL;
      break;
    default: // active
      if (!a.edgeAhead) { label = 'Edge below plan'; tone = styles.chipBehind; }
      else if (a.behindCadence) { label = 'Behind on cadence'; tone = styles.chipBehind; }
      else { label = 'On track'; tone = styles.chipOk; }
      to = PLANS_DETAIL;
  }

  return (
    <Link to={to} className={`${styles.chip} ${tone}`}>
      <span className={styles.chipDot} />
      <span className={styles.chipLabel}>Plan adherence — {label}</span>
      <span className={styles.chipArrow}>▸</span>
    </Link>
  );
}
