/**
 * DefendPage — open position detail (mock 03).
 *
 * Renders when /invest/strategy/:id resolves to an open position.
 * Every metric comes from derivePosition(). No P&L recomputation.
 *
 * Layout (top → bottom):
 *   1. Breadcrumb
 *   2. Hero grid: dark hero (badges, title, spot, total P&L, breakdown, verdict, actions)
 *                 + decision summary card
 *   3. Metric cards (5-col)
 *   4. Outcome range gauge (Total ↔ Per-contract toggle)
 *   5. Lower grid: legs table + greeks | why-flagged + position math + timeline
 */

import { Link } from 'react-router-dom';
import { derivePosition, recommendation } from '../lib/derivePosition';
import { signedUsd, usd, pct, signedPct } from '../lib/money';
import { formatStrategy } from '../utils/formatters';
import {
  RiskGauge,
  MetricCard,
  ReviewBadge,
  LegsTable,
  MoneyBreakdown,
  DteChip,
  investStyles as s,
} from '../components/invest';

import './DefendPage.css';

/**
 * @param {object} props
 * @param {import('../lib/derivePosition').CanonicalPosition} props.position — already canonical
 * @param {Function} [props.onOpenChat]
 */
export function DefendPage({ position, onOpenChat }) {
  const d = derivePosition(position);
  const rec = recommendation(d);
  const strategyLabel = formatStrategy(d.strategy);
  const pnlClass = d.pnlTotal >= 0 ? 'dp-pos' : 'dp-neg';

  return (
    <div className="dp-wrap">
      {/* ── Breadcrumb ── */}
      <div className="dp-breadcrumb">
        &larr; <Link to="/invest/defend">Defend</Link>
        <span className="dp-sep">/</span>{d.symbol}
        <span className="dp-sep">/</span>{strategyLabel}
      </div>

      {/* ══════════════ Hero grid ══════════════ */}
      <div className="dp-hero-grid">
        {/* ── Left: dark hero ── */}
        <div className="dp-hero-dark">
          <div className="dp-hero-row">
            <div>
              <div className="dp-badges">
                <ReviewBadge review={d.review} />
                <span className={`${s.badge} ${s.badgeStrat}`}>{strategyLabel}</span>
                <span className={`${s.badge} ${s.badgeNeutral}`}>{d.qty} contracts</span>
                <span className={`${s.badge} ${s.badgeNeutral}`}>{d.dte} DTE</span>
              </div>
              <h1 className="dp-hero-title">{d.symbol} {strategyLabel}</h1>
              <div className="dp-hero-meta">
                Entered {d.entryDate || '—'} &middot; {d.qty} contracts &middot; {d.dte} days remaining
              </div>
              {d.spot > 0 && (
                <div className="dp-spot">
                  <span className="dp-spot-dot" />
                  <b>${d.spot.toFixed(2)}</b>
                  <span className="dp-spot-delay">~15 min delay</span>
                </div>
              )}
            </div>

            <div className="dp-pnl-block">
              <div className="dp-pnl-cap">Total position P&L</div>
              <div className={`dp-pnl-big ${pnlClass}`}>{signedUsd(d.pnlTotal)}</div>
              <div className="dp-pnl-impact">Total since entry &middot; the real position impact</div>
              {d.daily != null && (
                <div className="dp-pnl-daily">
                  Today <b className={d.daily >= 0 ? 'dp-pos' : 'dp-neg'}>{signedUsd(d.daily)}</b>
                  <span className="dp-pnl-daily-pc">
                    &middot; {signedUsd(d.dailyPerContract)}/contract
                  </span>
                </div>
              )}
              <MoneyBreakdown
                perContract={d.perContract}
                qty={d.qty}
                total={d.pnlTotal}
                dark
              />
            </div>
          </div>

          <div className="dp-verdict">
            {d.review === 'time' && `Position is in ${d.pnlTotal >= 0 ? 'modest profit' : 'a loss'}, but time risk is high. The trade has only ${d.dte} DTE remaining and is entering the gamma-risk zone with just ${Math.round(d.profitCapturedPct)}% of the credit captured.`}
            {d.review === 'loss' && `Position is under pressure with ${Math.round(d.lossUsedPct)}% of max loss used.${d.breached ? ' Price has moved outside the breakeven range.' : ''} ${d.dte} DTE remaining to defend.`}
            {d.review === 'profit' && `Position has captured ${Math.round(d.profitCapturedPct)}% of max profit. Consider harvesting — the remaining ${usd(d.maxProfitLeft)} of upside comes with ${d.dte} DTE of risk.`}
            {!d.review && `Position is on track — ${Math.round(d.profitCapturedPct)}% captured with ${d.dte} DTE remaining.`}
          </div>

          <div className="dp-actions">
            <button className="dp-btn dp-btn-primary">Review adjustments</button>
            <button className="dp-btn dp-btn-ghost">Hold &amp; monitor</button>
            {onOpenChat && (
              <button className="dp-btn dp-btn-ai" onClick={() => onOpenChat(`Analyze my ${d.symbol} ${strategyLabel} position`)}>
                &#9889; Ask AI
              </button>
            )}
          </div>
        </div>

        {/* ── Right: decision summary ── */}
        <div className="dp-summary">
          <div className="dp-summary-top">
            <span className={s.eyebrow}>Decision summary</span>
            <ReviewBadge review={d.review} />
          </div>
          <h2 className="dp-summary-title">What should I understand?</h2>
          <p className="dp-summary-lede">
            You are {d.pnlTotal >= 0 ? 'up' : 'down'}{' '}
            <span className={pnlClass}>{usd(Math.abs(d.pnlTotal))}</span> — that&apos;s{' '}
            <span className={pnlClass}>{signedUsd(d.perContract)}</span> per contract across {d.qty}.
            Only <span className="dp-pos">{Math.round(d.profitCapturedPct)}%</span> of max profit,
            and <b>{Math.round(d.lossUsedPct)}%</b> of max loss used.
            {d.review === 'time' && ' Flagged for time, not loss.'}
            {d.review === 'loss' && ' Flagged for loss.'}
            {d.review === 'profit' && ' Flagged for profit-take.'}
          </p>

          {d.review === 'time' && (
            <div className="dp-callout">
              The loss isn&apos;t the problem — there isn&apos;t one yet. The trade is flagged because
              only {d.dte} days remain and price moves get harder to manage this close to expiry.
            </div>
          )}
          {d.review === 'loss' && (
            <div className="dp-callout dp-callout-loss">
              The position is losing ground. {d.breached ? 'Price has breached a breakeven — ' : ''}
              Review whether the remaining {d.dte} DTE gives enough time to recover.
            </div>
          )}
          {d.review === 'profit' && (
            <div className="dp-callout dp-callout-profit">
              The position is well into profit territory. The question is whether to harvest now
              or let it run with the risk of giving back gains.
            </div>
          )}

          <div className="dp-srow">
            <span className="dp-srow-k">Current P&L</span>
            <span className={`dp-srow-v ${pnlClass}`}>{signedUsd(d.pnlTotal)} {d.pnlTotal >= 0 ? 'profit' : 'loss'}</span>
          </div>
          <div className="dp-srow">
            <span className="dp-srow-k">Remaining downside from here</span>
            <span className="dp-srow-v">{usd(d.remainingDownside)} until max loss</span>
          </div>
          <div className="dp-srow">
            <span className="dp-srow-k">Max profit left</span>
            <span className="dp-srow-v">{usd(d.maxProfitLeft)} remaining</span>
          </div>
          <div className="dp-srow">
            <span className="dp-srow-k">Recommended next step</span>
            <span className="dp-srow-v" style={{ fontFamily: "'DM Sans', sans-serif" }}>
              {d.review === 'time' && 'Review close or roll'}
              {d.review === 'loss' && 'Review adjustment'}
              {d.review === 'profit' && 'Consider taking profit'}
              {!d.review && 'Hold & monitor'}
            </span>
          </div>
        </div>
      </div>

      {/* ══════════════ Metric cards ══════════════ */}
      <div className="dp-metrics">
        <MetricCard
          label="Total P&L"
          value={signedUsd(d.pnlTotal)}
          valueClass={pnlClass}
          sub={`${d.pnlTotal >= 0 ? 'profit' : 'loss'} since entry · ${signedUsd(d.perContract)} × ${d.qty}`}
        />
        {d.daily != null ? (
          <MetricCard
            label="Today's P&L"
            value={signedUsd(d.daily)}
            valueClass={d.daily >= 0 ? 'dp-pos' : 'dp-neg'}
            sub={`${signedUsd(d.dailyPerContract)}/contract`}
          />
        ) : (
          <MetricCard label="Today's P&L" value="—" sub="No prior-session snapshot" />
        )}
        <MetricCard
          label="Profit captured"
          value={`${Math.round(d.profitCapturedPct)}%`}
          valueClass={d.profitCapturedPct >= 0 ? 'dp-pos' : 'dp-neg'}
          sub={`${signedUsd(d.pnlTotal)} of ${usd(d.maxProfitTotal)} max profit`}
        />
        <MetricCard
          label="Loss used"
          value={`${Math.round(d.lossUsedPct)}%`}
          sub={`${usd(d.lossUsedPct > 0 ? Math.abs(d.pnlTotal) : 0)} of ${usd(d.maxLossTotal)} max loss`}
        />
        <MetricCard
          label="Time state"
          value={`${d.dte} DTE`}
          valueClass={d.dte <= 7 ? 'dp-neg' : d.dte <= 21 ? '' : 'dp-pos'}
          sub={d.dte <= 7 ? 'gamma risk · review close or roll' : d.dte <= 21 ? 'approaching management zone' : 'comfortable time remaining'}
        />
      </div>

      {/* ══════════════ Outcome range gauge ══════════════ */}
      <div className="dp-card dp-gauge-card">
        <div className="dp-gauge-head">
          <div>
            <span className={s.eyebrow}>Outcome range</span>
            <h3 className="dp-section-title">Total position view</h3>
          </div>
        </div>
        <div style={{ marginTop: 26 }}>
          <RiskGauge
            maxLossTotal={d.maxLossTotal}
            maxProfitTotal={d.maxProfitTotal}
            pnlTotal={d.pnlTotal}
            nowPct={d.nowPct}
            qty={d.qty}
            showToggle
            showLabel
            showEnds
          />
        </div>
        <div className="dp-ctx-grid">
          <div className="dp-ctx">
            <h4>Loss context</h4>
            <p>
              You&apos;re {signedUsd(d.pnlTotal)}. You&apos;d have to give back {usd(d.remainingDownside)} to
              reach max loss, and {usd(d.maxProfitLeft)} of profit is still on the table.
            </p>
          </div>
          <div className="dp-ctx">
            <h4>Time context</h4>
            <p>
              {d.dte <= 7
                ? `Only ${d.dte} days remain, so small price moves can create larger P&L swings near expiry.`
                : d.dte <= 21
                  ? `${d.dte} days remain — entering the management zone where time decay accelerates.`
                  : `${d.dte} days remain — comfortable time for the trade to work.`}
            </p>
          </div>
          <div className="dp-ctx">
            <h4>Decision context</h4>
            <p>
              {d.review === 'time' && `Review a close or roll because time risk is high — not because the current P&L is dangerous.`}
              {d.review === 'loss' && `Review an adjustment — the loss is building and needs attention before it widens further.`}
              {d.review === 'profit' && `Consider harvesting profit — the remaining upside may not justify the risk of holding.`}
              {!d.review && `No action needed. The trade is within expected parameters.`}
            </p>
          </div>
        </div>
      </div>

      {/* ══════════════ Lower grid: legs + sidebar ══════════════ */}
      <div className="dp-lower">
        {/* ── Left: legs table ── */}
        <div className="dp-card dp-legs-card">
          <h3 className="dp-section-title">Position legs — entry vs current</h3>
          <LegsTable
            legs={d.legs}
            status={d.status}
            qty={d.qty}
            entryCreditPerContract={d.entryCreditPerContract}
            expiry={d.legs?.[0]?.expiry}
            dte={d.dte}
            canonicalPerContract={d.perContract}
          />
        </div>

        {/* ── Right: sidebar rail ── */}
        <div className="dp-rail">
          {/* Why flagged */}
          <div className="dp-card dp-rail-card">
            <span className={s.eyebrow}>Health</span>
            <h3 className="dp-section-title">Why flagged?</h3>
            <div className="dp-ring">
              <p>{rec}</p>
            </div>
          </div>

          {/* Position math */}
          <div className="dp-card dp-rail-card">
            <span className={s.eyebrow}>Breakdown</span>
            <h3 className="dp-section-title">Position math</h3>
            <div className="dp-srow">
              <span className="dp-srow-k">Per-contract P&L</span>
              <span className={`dp-srow-v ${pnlClass}`}>{signedUsd(d.perContract)}</span>
            </div>
            <div className="dp-srow">
              <span className="dp-srow-k">Contracts</span>
              <span className="dp-srow-v">{d.qty}</span>
            </div>
            <div className="dp-srow">
              <span className="dp-srow-k">Total P&L</span>
              <span className={`dp-srow-v ${pnlClass}`}>{signedUsd(d.pnlTotal)}</span>
            </div>
            {d.daily != null && (
              <div className="dp-srow">
                <span className="dp-srow-k">Today&apos;s P&L</span>
                <span className={`dp-srow-v ${d.daily >= 0 ? 'dp-pos' : 'dp-neg'}`}>{signedUsd(d.daily)}</span>
              </div>
            )}
            <div className="dp-srow">
              <span className="dp-srow-k">Max profit</span>
              <span className="dp-srow-v">{usd(d.maxProfitTotal)}</span>
            </div>
            <div className="dp-srow">
              <span className="dp-srow-k">Max loss</span>
              <span className="dp-srow-v">{usd(d.maxLossTotal)}</span>
            </div>
          </div>

          {/* Timeline */}
          <div className="dp-card dp-rail-card dp-timeline">
            <span className={s.eyebrow}>Timeline</span>
            <h3 className="dp-section-title">What changed?</h3>
            <div className="dp-ti">
              <span className="dp-tdot" style={{ background: 'var(--inv-profit)' }} />
              <div>
                <small>Position opened</small>
                <p>Opened {d.qty} {d.symbol} {strategyLabel.toLowerCase()}s{d.entryCreditPerContract ? ` at ${usd(d.entryCreditPerContract)} credit per contract` : ''}.</p>
              </div>
            </div>
            <div className="dp-ti">
              <span className="dp-tdot" style={{ background: d.pnlTotal >= 0 ? 'var(--inv-profit)' : 'var(--inv-loss)' }} />
              <div>
                <small>Current state</small>
                <p>
                  Unrealised P&L is {signedUsd(d.pnlTotal)} total
                  {d.daily != null && `, ${d.daily >= 0 ? 'up' : 'down'} ${signedUsd(d.daily)} today`}.
                  {d.flagged
                    ? ` Only ${d.dte} days remain, so the trade needs review.`
                    : ` ${d.dte} days remain — on track.`}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: 48 }} />
    </div>
  );
}
