/**
 * PositionsPageNew — positions list with decision cards (mock 02).
 *
 * Each position row shows: symbol, review badge, DTE chip, total P&L,
 * daily P&L, inline risk gauge, chips (per-contract, captured, risk used,
 * why flagged), one-line recommendation, and a close button.
 *
 * All metrics from derivePosition(). No P&L recomputation.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { usePortfolio } from '../hooks/usePortfolio';
import { usePortfolioSettings } from '../hooks/usePortfolioSettings';
import { usePositionLiveData } from '../hooks/usePositionLiveData';
import { toCanonical } from '../lib/toCanonical';
import { derivePosition, recommendation } from '../lib/derivePosition';
import { signedUsd, usd } from '../lib/money';
import { formatStrategy } from '../utils/formatters';
import { StartPlanNudge } from '../components/StartPlanNudge';
import {
  RiskGauge,
  MetricCard,
  ReviewBadge,
  DteChip,
  investStyles as s,
} from '../components/invest';

import './PositionsPageNew.css';

/** Row that loads its own live data and reports derived position up */
function PositionRow({ portfolioItem, tile, onDerived, onClose }) {
  const liveData = usePositionLiveData(tile, portfolioItem);
  const hasPnl = !liveData.loading && liveData.pnlResult?.method !== 'none';

  const canonical = useMemo(() => {
    if (!portfolioItem) return null;
    return toCanonical(portfolioItem, {
      pnlPerContract: hasPnl ? liveData.pnlPerContract : null,
      spot: liveData.currentSpot || undefined,
      dte: liveData.dte ?? undefined,
    });
  }, [portfolioItem, liveData, hasPnl]);

  const d = useMemo(() => {
    if (!canonical || canonical.pnlTotal == null) return null;
    return derivePosition(canonical);
  }, [canonical]);

  // Report derived data up for summary aggregation
  useEffect(() => {
    if (d && portfolioItem?.id) onDerived(portfolioItem.id, d);
  }, [d, portfolioItem?.id, onDerived]);

  if (!d) {
    return (
      <div className="pn-row pn-loading">
        <span className="pn-sym">{portfolioItem?.symbol || '—'}</span>
        <span style={{ color: '#6b7280', fontSize: 13 }}>Loading live data…</span>
      </div>
    );
  }

  const rec = recommendation(d);
  const strategyLabel = formatStrategy(d.strategy);
  const pnlClass = d.pnlTotal >= 0 ? 'dp-pos' : 'dp-neg';

  const handleClose = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm(`Close ${d.symbol} ${strategyLabel}?\n\nCurrent P&L: ${signedUsd(d.pnlTotal)} (${signedUsd(d.perContract)}/contract)\n\nThis will book the P&L and move the position to closed.`)) {
      onClose(portfolioItem.id, d.perContract);
    }
  };

  return (
    <Link to={`/invest/strategy/${portfolioItem.tileId || portfolioItem.id}`} className="pn-row">
      <div className="pn-rtop">
        <div>
          <div className="pn-title">
            <span className="pn-sym">{d.symbol}</span>
            <ReviewBadge review={d.review} />
            <DteChip dte={d.dte} />
          </div>
          <div className="pn-strat">{strategyLabel} &middot; {d.qty} contracts</div>
        </div>
        <div className="pn-rpnl">
          <div className={`pn-rpnl-val ${pnlClass}`}>{signedUsd(d.pnlTotal)}</div>
          {d.daily != null && <small className={d.daily >= 0 ? 'dp-pos' : 'dp-neg'}>{signedUsd(d.daily)} today</small>}
        </div>
      </div>

      <div className="pn-gauge">
        <RiskGauge maxLossTotal={d.maxLossTotal} maxProfitTotal={d.maxProfitTotal} pnlTotal={d.pnlTotal} nowPct={d.nowPct} qty={d.qty} inline showEnds />
      </div>

      <div className="pn-rbot">
        <div className="pn-chips">
          <span className={s.chip}>Per contract<b className={pnlClass}>{signedUsd(d.perContract)} &times; {d.qty}</b></span>
          <span className={s.chip}>Captured<b className={d.profitCapturedPct >= 0 ? 'dp-pos' : 'dp-neg'}>{Math.round(d.profitCapturedPct)}%</b></span>
          <span className={s.chip}>Risk used<b>{Math.round(d.lossUsedPct)}%</b></span>
          {d.flagged && d.review === 'loss' && <span className={s.chipWhy}>Why flagged<b>{d.breached ? 'Breached' : `${Math.round(d.lossUsedPct)}% loss`} &middot; {d.dte} DTE</b></span>}
          {d.flagged && d.review === 'time' && <span className={s.chipWhy}>Why flagged<b>{d.dte} DTE + low capture</b></span>}
          {d.flagged && d.review === 'profit' && <span className={s.chipWhyGood}>Why flagged<b>{Math.round(d.profitCapturedPct)}% captured &middot; {d.dte} DTE</b></span>}
        </div>
        <div className="pn-row-actions">
          <button className="pn-close-btn" onClick={handleClose}>Close trade</button>
          <Link to={`/invest/strategy/${portfolioItem.tileId || portfolioItem.id}`} className="pn-review-btn" onClick={(e) => e.stopPropagation()}>
            {d.review === 'profit' ? 'Take profit?' : 'Review'}
          </Link>
        </div>
      </div>

      <div className="pn-rec"><span className="pn-rec-arrow">&rarr;</span> {rec}</div>
    </Link>
  );
}

export function PositionsPageNew({ tiles, onOpenChat }) {
  const { activePositions, closePosition, loading } = usePortfolio();
  const { settings } = usePortfolioSettings();

  // Collect derived data from each row for summary aggregation
  const [derivedMap, setDerivedMap] = useState({});
  const handleDerived = useCallback((id, d) => {
    setDerivedMap(prev => {
      if (prev[id] === d) return prev;
      return { ...prev, [id]: d };
    });
  }, []);

  const handleClose = useCallback(async (posId, pnlPerContract) => {
    try {
      await closePosition(posId, pnlPerContract, 'manual');
    } catch (err) {
      console.error('Failed to close position:', err);
      alert('Failed to close position: ' + err.message);
    }
  }, [closePosition]);

  // Sort by DTE (soonest first)
  const sorted = useMemo(() =>
    [...activePositions].sort((a, b) => (a.daysToExpiry || 999) - (b.daysToExpiry || 999)),
    [activePositions]
  );

  const totalContracts = activePositions.reduce((s, p) => s + (p.quantity || 1), 0);

  // Aggregate summary from derived positions
  const summary = useMemo(() => {
    const entries = Object.values(derivedMap);
    if (entries.length === 0) return null;
    let openPnl = 0, dailyPnl = 0, hasDailyData = false, maxLoss = 0, maxProfit = 0;
    for (const d of entries) {
      openPnl += d.pnlTotal;
      if (d.daily != null) { dailyPnl += d.daily; hasDailyData = true; }
      maxLoss += d.maxLossTotal;
      maxProfit += d.maxProfitTotal;
    }
    return { openPnl, dailyPnl, hasDailyData, maxLoss, maxProfit, loaded: entries.length };
  }, [derivedMap]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60, color: '#6b7280' }}>Loading positions…</div>;
  }

  const allLoaded = summary && summary.loaded === activePositions.length;

  return (
    <div className="pn-wrap">
      {/* Stepper */}
      <div className="pn-stepper">
        <div className="pn-step"><span className="pn-step-o" /><small>Discover</small></div><div className="pn-seg" />
        <div className="pn-step"><span className="pn-step-o" /><small>Decide</small></div><div className="pn-seg" />
        <div className="pn-step"><span className="pn-step-o" /><small>Build</small></div><div className="pn-seg" />
        <div className="pn-step"><span className="pn-step-o" /><small>Execute</small></div><div className="pn-seg" />
        <div className="pn-step pn-done"><span className="pn-step-o">{activePositions.length}</span><small>Defend</small></div>
      </div>

      <div className="pn-ph">
        <div>
          <span className={s.eyebrow}>Defend &middot; positions flagged</span>
          <h1 className="pn-title-main">Positions</h1>
          <p className="pn-sub">Active positions sorted by urgency. The marker shows where each trade sits between max loss and max profit.</p>
        </div>
      </div>

      <div className="pn-summary-metrics">
        <MetricCard label="Positions" value={String(activePositions.length)} sub={`${totalContracts} contracts`} />
        <MetricCard
          label="Open P&L"
          value={allLoaded ? signedUsd(summary.openPnl) : '…'}
          valueClass={allLoaded ? (summary.openPnl >= 0 ? 'dp-pos' : 'dp-neg') : ''}
          sub={allLoaded ? `unrealised, ${activePositions.length} positions` : 'loading…'}
        />
        <MetricCard
          label="Today's P&L"
          value={allLoaded && summary.hasDailyData ? signedUsd(summary.dailyPnl) : '—'}
          valueClass={allLoaded && summary.hasDailyData ? (summary.dailyPnl >= 0 ? 'dp-pos' : 'dp-neg') : ''}
          sub={allLoaded && summary.hasDailyData ? `across ${activePositions.length} positions` : 'no prior-session data'}
        />
        <MetricCard
          label="Portfolio max loss"
          value={allLoaded ? usd(summary.maxLoss) : '…'}
          sub={allLoaded ? 'total downside if all lose' : 'loading…'}
        />
        <MetricCard
          label="Max profit available"
          value={allLoaded ? signedUsd(summary.maxProfit) : '…'}
          valueClass={allLoaded ? 'dp-pos' : ''}
        />
      </div>

      {sorted.length === 0 ? (
        <>
          <StartPlanNudge tone="light" />
          <div style={{ textAlign: 'center', padding: 60, color: '#6b7280', fontSize: 14 }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>&#128737;</div>
            No active positions. <Link to="/invest/discover" style={{ color: '#0f4a36', fontWeight: 500 }}>Discover strategies</Link>
          </div>
        </>
      ) : (
        sorted.map(item => (
          <PositionRow
            key={item.id}
            portfolioItem={item}
            tile={tiles?.find(t => t.id === (item.tileId || item.id))}
            onDerived={handleDerived}
            onClose={handleClose}
          />
        ))
      )}

      <div style={{ height: 48 }} />
    </div>
  );
}
