/**
 * AdherenceCard — diagnostic read of plan adherence (Phase 2a). Layout ports the
 * approved mock (design: adherence-tracker.html).
 *
 * READ-ONLY. Code computes every figure (computeAdherence); narration is a fixed
 * deterministic template (narrateAdherence) — no LLM, no model-generated numbers.
 * Never renders trades-owed or a "place N more to catch up" prompt.
 *
 * Phases: reconcile (capital mismatch) · coldstart (<1wk or <5 plan-trades) ·
 * active (verdict + KPIs + drift attribution + metronome + equity band).
 * `compact` renders the condensed Home variant.
 */
import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { usePlanOfRecord } from '../hooks/usePlanOfRecord';
import { usePortfolioSettings } from '../hooks/usePortfolioSettings';
import { usePortfolio } from '../hooks/usePortfolio';
import { useWeeklyQualifiedSetups } from '../hooks/useWeeklyQualifiedSetups';
import { computeAdherence, narrateAdherence } from '../lib/projection/adherence';
import { usd, signedUsd } from '../lib/money';
import styles from './AdherenceCard.module.css';

const pctStr = (frac) => (frac == null ? '—' : (frac * 100).toFixed(2) + '%');
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));

export function AdherenceCard({ compact = false }) {
  const { plan, loading: planLoading } = usePlanOfRecord();
  const { settings } = usePortfolioSettings();
  const { closedPositions, activePositions, loading: portLoading } = usePortfolio();
  const { count: qualifiedAvailable } = useWeeklyQualifiedSetups();

  const accountCapital = settings?.totalCapital ?? null;

  const a = useMemo(
    () => (plan ? computeAdherence({ plan, accountCapital, closedPositions }) : null),
    [plan, accountCapital, closedPositions]
  );
  const narration = useMemo(() => narrateAdherence(a), [a]);

  // Risk deployed (diagnostic only — room before the plan's portfolio max loss).
  const deployedRisk = useMemo(
    () => (activePositions || []).reduce((s, p) => s + Math.abs(p.maxLoss || 0) * (p.quantity || 1), 0),
    [activePositions]
  );

  if (planLoading || portLoading) return null;

  // ── No plan ──
  if (!plan) {
    if (compact) return null;
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

  // ── Compact (Home green card) ──
  if (compact) {
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

  // ── Full card ──
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

  // diverging drift bars: scale the larger magnitude to the full half-track (50%).
  const maxMag = Math.max(Math.abs(a.cadenceContribution), Math.abs(a.edgeContribution), 1);
  const widthOf = (v) => clamp((Math.abs(v) / maxMag) * 50, 2, 50);

  // equity-vs-band axis with small padding
  const { p10, p50, p90 } = a.band;
  const axisLo = Math.min(p10, a.actualCapital);
  const axisHi = Math.max(p90, a.actualCapital);
  const pad = (axisHi - axisLo) * 0.08 || 1;
  const lo = axisLo - pad, hi = axisHi + pad;
  const posOf = (v) => clamp(((v - lo) / (hi - lo)) * 100, 0, 100);

  // metronome (honest): target slots = pace, filled = trades taken this plan-week.
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
