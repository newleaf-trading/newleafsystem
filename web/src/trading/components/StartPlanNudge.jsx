/**
 * StartPlanNudge — actionable "begin your plan" nudge shown when the investor has
 * an active plan but hasn't taken any trades this plan-week.
 *
 * Forward-looking only: shows this week's cadence progress (0 of ~N) and a CTA to
 * find setups. It deliberately NEVER frames trades as owed or a catch-up debt
 * ("cadence is a metronome, not a debt"). Self-gates on the shared adherence model;
 * renders nothing in reconcile/none or once a trade has been taken this week.
 *
 * tone: 'light' (cream pages) | 'onDark' (Home's green Active Plan card).
 */
import { Link } from 'react-router-dom';
import { useAdherence } from '../hooks/useAdherence';
import styles from './AdherenceCard.module.css';

export function StartPlanNudge({ tone = 'light' }) {
  const { a, plan, loading } = useAdherence();

  if (loading || !plan || !a) return null;
  if (a.phase === 'reconcile' || a.phase === 'none') return null; // reconcile first
  if (a.tradesTakenThisWeek > 0) return null; // already started this week

  const target = Math.round(a.tradesPerWeek);
  const unit = target === 1 ? 'trade' : 'trades';

  return (
    <div className={`${styles.nudge} ${tone === 'onDark' ? styles.nudgeDark : ''}`}>
      <div className={styles.nudgeText}>
        <span className={styles.nudgeTitle}>Start your plan this week</span>
        <span className={styles.nudgeSub}>
          Your plan runs ~{target} {unit}/week — you’ve taken {a.tradesTakenThisWeek} this week.
          Take your first qualified setup; a short week isn’t a miss.
        </span>
      </div>
      <Link to="/invest/discover" className={styles.nudgeCta}>Find setups →</Link>
    </div>
  );
}
