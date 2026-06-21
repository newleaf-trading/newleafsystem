/**
 * PlanAlignmentPanel — "what it takes to stay on plan THIS WEEK" on the active-plan
 * detail. Forward-looking only: shows this week's setups vs target, weekly risk
 * budget (cadence × per-idea) vs what's deployed, and per-idea sizing — then frames
 * the remaining capacity as opportunity ("when they appear"), never as a debt owed
 * or a "place N more to catch up" prompt. Honors "cadence is a metronome, not a debt."
 *
 * Read-only. Numbers from the shared adherence model; renders nothing in
 * reconcile/none (reconcile is resolved first via the card banner).
 */
import { Link } from 'react-router-dom';
import { useAdherence } from '../hooks/useAdherence';
import { usd } from '../lib/money';
import styles from './AdherenceCard.module.css';

const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export function PlanAlignmentPanel() {
  const { a, plan, deployedRisk, accountCapital, loading } = useAdherence();

  if (loading || !plan || !a) return null;
  if (a.phase === 'reconcile' || a.phase === 'none') return null;

  const perIdea = Math.round((accountCapital || 0) * (plan.riskCapPct || 0));
  const target = Math.max(1, Math.round(plan.tradesPerWeek || 0));
  const weeklyBudget = target * perIdea;
  const taken = clamp(a.tradesTakenThisWeek, 0, target);
  const remaining = Math.max(0, target - taken);
  const deployed = Math.round(deployedRisk || 0);
  const roomDollar = Math.max(0, weeklyBudget - deployed);
  const onPace = remaining === 0;

  return (
    <section className={styles.card}>
      <span className={styles.eyebrow}>This week · align with your plan</span>
      <h2 style={{ fontFamily: 'var(--ad-serif)', fontSize: 18, fontWeight: 600, margin: '4px 0 14px' }}>
        {onPace ? 'You’re on pace this week' : 'What it takes to stay on plan this week'}
      </h2>

      <div className={styles.kpis}>
        <div className={styles.kpi}>
          <span className={styles.k}>Setups this week</span>
          <div className={`${styles.v} ${styles.num}`}>{taken} / {target}</div>
          <div className={styles.metro} style={{ marginTop: 8 }}>
            {Array.from({ length: target }, (_, i) => (
              <div key={i} className={`${styles.slot} ${i < taken ? styles.slotOn : ''}`}>{i < taken ? '✓' : i + 1}</div>
            ))}
          </div>
          <div className={styles.sub}>{onPace ? 'Cadence met for the week.' : `Room for ~${remaining} more when they clear quality.`}</div>
        </div>

        <div className={styles.kpi}>
          <span className={styles.k}>Weekly risk budget</span>
          <div className={`${styles.v} ${styles.num}`}>{usd(deployed)} / {usd(weeklyBudget)}</div>
          <span className={`${styles.tag} ${roomDollar > 0 ? styles.clear : styles.ahead}`}>
            {roomDollar > 0 ? `${usd(roomDollar)} unused` : 'fully deployed'}
          </span>
          <div className={styles.sub}>Cadence × per-idea risk — what the plan deploys each week.</div>
        </div>

        <div className={styles.kpi}>
          <span className={styles.k}>Each idea</span>
          <div className={`${styles.v} ${styles.num}`}>~{usd(perIdea)}</div>
          <div className={styles.sub}>Plan sizes each idea to {plan.riskCapPct ? `${(plan.riskCapPct * 100).toFixed(1)}%` : '—'} of capital. Size new trades to match.</div>
        </div>
      </div>

      <p style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--ad-ink-soft)', margin: '4px 0 14px' }}>
        {onPace ? (
          <>You’ve taken this week’s {target} setups and deployed {usd(deployed)} of your {usd(weeklyBudget)} budget. Let them work — no need to add.</>
        ) : (
          <>Open ~{remaining} more qualified {remaining === 1 ? 'setup' : 'setups'} at ~{usd(perIdea)} each <b>when they appear</b> to deploy this week’s {usd(weeklyBudget)} budget. A short week isn’t a miss — don’t force them.</>
        )}
      </p>

      {!onPace && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Link to="/invest/discover" className={styles.nudgeCta}>Find setups →</Link>
          <Link to="/invest/build" className={styles.bannerCta}>Size your batch →</Link>
        </div>
      )}

      <p className={styles.disclaim} style={{ textAlign: 'left', marginTop: 14 }}>
        Cadence is a metronome, not a debt — this is this week only, not a backlog to repay.
      </p>
    </section>
  );
}
