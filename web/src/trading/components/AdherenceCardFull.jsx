/**
 * AdherenceCardFull — the full plan-adherence card (verdict, KPIs, drift
 * attribution, metronome, equity band) for all phases (reconcile / coldstart /
 * active). Lives on the PLANS active-plan detail. Layout ports the approved mock
 * (design/prototypes/adherence-tracker.html).
 *
 * READ-ONLY. All figures come from useAdherence() → computeAdherence (unchanged);
 * narration is the deterministic template. No LLM, no model-generated numbers, and
 * never a trades-owed / catch-up prompt.
 */
import { Link } from 'react-router-dom';
import { useAdherence } from '../hooks/useAdherence';
import { usd, signedUsd } from '../lib/money';
import styles from './AdherenceCard.module.css';

const pctStr = (frac) => (frac == null ? '—' : (frac * 100).toFixed(2) + '%');
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export function AdherenceCardFull({ previewData = null }) {
  const { a, plan, narration, qualifiedAvailable, deployedRisk, loading } = useAdherence(previewData);

  if (loading) return null;

  // ── No plan ──
  if (!plan) {
    return (
      <section className={styles.card}>
        <span className={styles.eyebrow}>Plan adherence</span>
        <div className={styles.empty}>
          <span className={styles.t}>No active plan to track against yet.</span>
          <Link to="/invest/projection" className={styles.cta}>Choose your plan →</Link>
        </div>
      </section>
    );
  }

  const Header = (
    <div className={styles.head}>
      <div>
        <span className={styles.eyebrow}>Plan adherence</span>
        <h1>Are you on track?</h1>
      </div>
      <div className={styles.week}>Week<b>{a.weekNumber} of 52</b>since plan set</div>
    </div>
  );

  const Footer = (
    <>
      <div className={styles.rule}>
        <span className={styles.ic}>◷</span>
        <p>
          <b>{narration.footer}</b> You don’t repay a slow week by doubling up next week — that’s how the
          risk cap gets breached. Resume pace and let the edge compound.
        </p>
      </div>
      <p className={styles.disclaim}>Educational only · Not financial advice · Gaps are computed from your plan of record and closed trades.</p>
    </>
  );

  if (a.phase === 'reconcile') {
    return (
      <section className={styles.card}>
        {Header}
        <div className={styles.banner}>
          <span className={styles.bannerText}>
            Plan basis <b className={styles.num}>{usd(a.reconciliation.planCapital)}</b> ≠ account{' '}
            <b className={styles.num}>{usd(a.reconciliation.accountCapital)}</b>. {narration.verdict}
          </span>
          <Link to="/invest/projection" className={styles.bannerCta}>Re-commit</Link>
        </div>
        {Footer}
      </section>
    );
  }

  if (a.phase === 'coldstart') {
    return (
      <section className={styles.card}>
        {Header}
        <div className={styles.verdict}>
          <span className={styles.dot} />
          <p>{narration.verdict}</p>
        </div>
        {Footer}
      </section>
    );
  }

  // ── active ──
  const expectedRounded = Math.round(a.expectedTrades);
  const cadenceBehind = a.cadenceRatio < 1;

  const maxMag = Math.max(Math.abs(a.cadenceContribution), Math.abs(a.edgeContribution), 1);
  const widthOf = (v) => clamp((Math.abs(v) / maxMag) * 50, 2, 50);

  const { p10, p50, p90 } = a.band;
  const axisLo = Math.min(p10, a.actualCapital);
  const axisHi = Math.max(p90, a.actualCapital);
  const pad = (axisHi - axisLo) * 0.08 || 1;
  const lo = axisLo - pad, hi = axisHi + pad;
  const posOf = (v) => clamp(((v - lo) / (hi - lo)) * 100, 0, 100);

  const targetSlots = clamp(Math.round(a.tradesPerWeek), 1, 8);
  const taken = clamp(a.tradesTakenThisWeek, 0, targetSlots);

  const DriftRow = ({ topLabel, detail, value }) => {
    const neg = value < 0;
    return (
      <div className={styles.brow}>
        <div className={styles.lbl}><b>{topLabel}</b>{detail}</div>
        <div className={styles.track}>
          <div className={`${styles.bar} ${neg ? styles.barNeg : styles.barPos}`} style={{ width: `${widthOf(value)}%` }}>
            {signedUsd(value)}
          </div>
        </div>
      </div>
    );
  };

  return (
    <section className={styles.card}>
      {Header}

      <div className={styles.verdict}>
        <span className={styles.dot} />
        <p>{narration.verdict}</p>
      </div>

      <div className={styles.kpis}>
        <div className={styles.kpi}>
          <span className={styles.k}>Cadence</span>
          <div className={`${styles.v} ${styles.num}`}>{a.actualTrades} / {expectedRounded}</div>
          <span className={`${styles.tag} ${cadenceBehind ? styles.behind : styles.ahead}`}>
            {Math.round(a.cadenceRatio * 100)}% · {cadenceBehind ? 'behind' : 'on pace'}
          </span>
          <div className={styles.sub}>Trades placed vs plan pace of {Math.round(a.tradesPerWeek)}/week.</div>
        </div>
        <div className={styles.kpi}>
          <span className={styles.k}>Realised edge</span>
          <div className={`${styles.v} ${styles.num}`}>{pctStr(a.realisedEdge)}</div>
          <span className={`${styles.tag} ${a.edgeAhead ? styles.ahead : styles.behind}`}>vs {pctStr(a.ev)} plan</span>
          <div className={styles.sub}>Per-trade growth over {a.actualTrades} closed trades.</div>
        </div>
        <div className={styles.kpi}>
          <span className={styles.k}>Risk deployed</span>
          <div className={`${styles.v} ${styles.num}`}>{usd(deployedRisk)} / {usd(plan.maxLossDollar)}</div>
          <span className={`${styles.tag} ${styles.clear}`}>
            {deployedRisk === 0 ? 'clear' : `${Math.round((deployedRisk / plan.maxLossDollar) * 100)}% used`}
            {plan.riskCapDollar > 0 ? ` · ~${Math.max(0, Math.floor((plan.maxLossDollar - deployedRisk) / plan.riskCapDollar))} ideas` : ''}
          </span>
          <div className={styles.sub}>Room before portfolio max loss.</div>
        </div>
      </div>

      <div className={styles.attr}>
        <div className={styles.attrTop}>
          <h2>Why you’re {usd(Math.abs(a.netVsExpected))} {a.netVsExpected < 0 ? 'behind' : 'ahead of'} plan</h2>
          <span className={styles.net}>net <b className={a.netVsExpected < 0 ? styles.netBehind : styles.netAhead}>{signedUsd(a.netVsExpected)}</b> vs expected</span>
        </div>
        <div className={styles.bars}>
          <div className={styles.centerLine} />
          <div className={styles.centerCap}>plan / expected</div>
          <DriftRow
            topLabel={a.cadenceContribution < 0 ? 'Cadence drag' : 'Cadence credit'}
            detail={`${a.actualTrades} trades, not ${expectedRounded}`}
            value={a.cadenceContribution}
          />
          <DriftRow
            topLabel={a.edgeContribution >= 0 ? 'Edge surplus' : 'Edge drag'}
            detail={`${pctStr(a.realisedEdge)} vs ${pctStr(a.ev)}`}
            value={a.edgeContribution}
          />
          <div className={styles.scale}><span>behind plan</span><span>plan</span><span>ahead of plan</span></div>
        </div>
      </div>

      <div className={styles.duo}>
        <div className={styles.mini}>
          <div className={styles.cap}>This week</div>
          <h3>Qualified setups</h3>
          <div className={styles.metro}>
            {Array.from({ length: targetSlots }, (_, i) => (
              <div key={i} className={`${styles.slot} ${i < taken ? styles.slotOn : ''}`}>{i < taken ? '✓' : i + 1}</div>
            ))}
          </div>
          <p>
            <b>{taken} of {targetSlots}</b> taken this week. A short week isn’t a miss — don’t force the rest.
            {qualifiedAvailable == null ? ' (Scanner quality-log not live yet.)' : ` ${qualifiedAvailable} cleared the bar market-wide.`}
          </p>
        </div>
        <div className={styles.mini}>
          <div className={styles.cap}>Equity vs band</div>
          <h3>Where you sit today</h3>
          <div className={styles.band}>
            <div className={styles.strip} />
            <div className={styles.fill} style={{ left: `${posOf(p10)}%`, right: `${100 - posOf(p90)}%` }} />
            <div className={styles.median} style={{ left: `${posOf(p50)}%` }} />
            <div className={styles.you} style={{ left: `${posOf(a.actualCapital)}%` }} />
            <div className={styles.youlab} style={{ left: `${posOf(a.actualCapital)}%` }}>you</div>
          </div>
          <div className={styles.bandscale}><span>{usd(p10)}</span><span>median {usd(p50)}</span><span>{usd(p90)}</span></div>
          <p style={{ marginTop: 8 }}>
            {a.actualCapital >= p10 && a.actualCapital <= p90
              ? 'Inside the 10th–90th band.'
              : a.actualCapital < p10
                ? 'Below the 10th percentile — check the edge.'
                : 'Above the 90th percentile — running hot.'}{' '}
            {a.actualCapital < p50 ? 'Just below the expected line.' : 'At or above the expected line.'}
          </p>
        </div>
      </div>

      {Footer}
    </section>
  );
}
