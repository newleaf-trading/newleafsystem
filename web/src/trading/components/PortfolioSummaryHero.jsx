import styles from './PortfolioSummaryHero.module.css';

const fmt = (v) => {
  if (v == null || isNaN(v)) return '--';
  return '$' + Math.abs(Math.round(v)).toLocaleString();
};

const fmtSign = (v) => {
  if (v == null || isNaN(v)) return '--';
  const sign = v >= 0 ? '+' : '-';
  return sign + '$' + Math.abs(Math.round(v)).toLocaleString();
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function getDateStr() {
  return new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export function PortfolioSummaryHero({
  user,
  portfolioValue,
  capital,
  openPnl,
  realisedPnl,
  totalPnlPct,
  activeCount,
  closedCount,
  winRate,
  winCount,
  capitalDeployed,
  riskBudget,
  onAddFunds,
  onWithdraw,
}) {
  const totalPnl = (openPnl || 0) + (realisedPnl || 0);
  const deployedPct = riskBudget > 0 ? Math.round((capitalDeployed / riskBudget) * 100) : 0;
  const displayName = user?.displayName?.split(' ')[0] || '';

  return (
    <div className={styles.hero}>
      <div className={styles.greeting}>
        {getGreeting()}{displayName ? `, ${displayName}` : ''} — {getDateStr()}
      </div>

      <div className={styles.valueRow}>
        <div>
          <div className={styles.valueLabel}>Portfolio Value</div>
          <div className={styles.valueAmount}>{fmt(portfolioValue)}</div>
        </div>
        <div className={styles.valueMeta}>
          <span className={totalPnl >= 0 ? styles.pnlPos : styles.pnlNeg}>
            {fmtSign(openPnl)} open
          </span>
          <span className={styles.dot}>&middot;</span>
          <span className={totalPnl >= 0 ? styles.pnlPos : styles.pnlNeg}>
            {totalPnlPct}% all-time
          </span>
        </div>
      </div>

      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Capital</div>
          <div className={styles.statValue}>{fmt(capital)}</div>
          <div className={styles.statSub}>configured</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Open P&L</div>
          <div className={`${styles.statValue} ${openPnl >= 0 ? styles.green : styles.red}`}>
            {fmtSign(openPnl)}
          </div>
          <div className={styles.statSub}>{activeCount} active position{activeCount !== 1 ? 's' : ''}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Realised</div>
          <div className={`${styles.statValue} ${realisedPnl >= 0 ? styles.green : styles.red}`}>
            {fmtSign(realisedPnl)}
          </div>
          <div className={styles.statSub}>{closedCount} closed trade{closedCount !== 1 ? 's' : ''}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statLabel}>Win Rate</div>
          <div className={styles.statValue}>{winRate != null ? winRate + '%' : '--'}</div>
          <div className={styles.statSub}>{winCount != null ? `${winCount} of ${closedCount}` : '--'}</div>
        </div>
      </div>

      <div className={styles.riskRow}>
        <span className={styles.riskLabel}>
          Risk: {deployedPct}% deployed ({fmt(capitalDeployed)} / {fmt(riskBudget)})
        </span>
        <div className={styles.riskBar}>
          <div
            className={styles.riskFill}
            style={{
              width: `${Math.min(100, deployedPct)}%`,
              background: deployedPct > 90 ? 'var(--nl-red, #B5483A)' : deployedPct > 70 ? 'var(--nl-gold, #C8A85A)' : 'var(--nl-green, #2E7D5B)',
            }}
          />
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.actionBtn} onClick={onAddFunds}>Add Funds</button>
        <button className={styles.actionBtnSec} onClick={onWithdraw}>Withdraw</button>
      </div>
    </div>
  );
}
