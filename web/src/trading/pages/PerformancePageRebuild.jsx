/**
 * PerformancePageRebuild — track record + reconciliation (mock 04).
 *
 * Layout: stat cards (5), reconciliation bar, portfolio growth chart,
 * open risk table, closed trades history.
 *
 * All P&L from derivePosition(). No recomputation.
 */

import { useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { usePortfolio } from '../hooks/usePortfolio';
import { usePortfolioSettings } from '../hooks/usePortfolioSettings';
import { usePositionLiveData } from '../hooks/usePositionLiveData';
import { toCanonical } from '../lib/toCanonical';
import { derivePosition } from '../lib/derivePosition';
import { signedUsd, usd } from '../lib/money';
import { formatStrategy } from '../utils/formatters';
import { AdherenceCard } from '../components/AdherenceCard';
import {
  MetricCard,
  ReviewBadge,
  investStyles as s,
} from '../components/invest';

import './PerformancePageRebuild.css';

/** Row in the open-risk table — loads its own live data */
function OpenPositionRow({ item, tile, onClose }) {
  const liveData = usePositionLiveData(tile, item);
  const hasPnl = !liveData.loading && liveData.pnlResult?.method !== 'none';

  const canonical = useMemo(() => {
    if (!item) return null;
    return toCanonical(item, {
      pnlPerContract: hasPnl ? liveData.pnlPerContract : null,
      spot: liveData.currentSpot || undefined,
      dte: liveData.dte ?? undefined,
    });
  }, [item, liveData, hasPnl]);

  if (!canonical || canonical.pnlTotal == null) {
    return (
      <tr><td className="perf-tk">{item.symbol}<small>loading…</small></td><td colSpan={7} style={{ color: '#6b7280' }}>Loading live data…</td></tr>
    );
  }

  const d = derivePosition(canonical);
  const pnlClass = d.pnlTotal >= 0 ? 'dp-pos' : 'dp-neg';

  return (
    <tr>
      <td className="perf-tk">
        <Link to={`/invest/strategy/${item.tileId || item.id}`}>{d.symbol}</Link>
        <small>{d.dte} DTE</small>
      </td>
      <td>{formatStrategy(d.strategy)}</td>
      <td className="perf-num">{d.qty}</td>
      <td className={`perf-num ${pnlClass}`}>{signedUsd(d.pnlTotal)}</td>
      <td className={`perf-num ${d.daily != null ? (d.daily >= 0 ? 'dp-pos' : 'dp-neg') : ''}`}>{d.daily != null ? signedUsd(d.daily) : '—'}</td>
      <td className={`perf-num ${d.profitCapturedPct >= 0 ? 'dp-pos' : 'dp-neg'}`}>{d.profitCapturedPct >= 0 ? '+' : ''}{Math.round(d.profitCapturedPct)}%</td>
      <td className={`perf-num ${d.returnOnRiskPct >= 0 ? 'dp-pos' : 'dp-neg'}`}>{d.returnOnRiskPct >= 0 ? '+' : ''}{d.returnOnRiskPct.toFixed(1)}%</td>
      <td>
        {d.review && (
          <span className={`perf-stat ${d.review === 'loss' ? 'perf-st-loss' : d.review === 'profit' ? 'perf-st-profit' : 'perf-st-time'}`}>
            <span className="perf-stat-dot" />{d.review === 'time' ? 'Time review' : d.review === 'loss' ? 'Loss review' : 'Profit review'}
          </span>
        )}
        {!d.review && <span className="perf-stat perf-st-ok"><span className="perf-stat-dot" />On track</span>}
      </td>
      <td>
        <button className="perf-close-btn" onClick={() => {
          if (window.confirm(`Close ${d.symbol}?\nP&L: ${signedUsd(d.pnlTotal)} (${signedUsd(d.perContract)}/contract)`)) {
            onClose(item.id, d.perContract);
          }
        }}>Close</button>
      </td>
    </tr>
  );
}

export function PerformancePageRebuild({ tiles }) {
  const { activePositions, closedPositions, closePosition, loading } = usePortfolio();
  const { settings } = usePortfolioSettings();
  const totalCapital = settings?.totalCapital || 0;

  const handleClose = useCallback(async (posId, pnlPerContract) => {
    try {
      await closePosition(posId, pnlPerContract, 'manual');
    } catch (err) {
      console.error('Failed to close position:', err);
      alert('Failed to close position: ' + err.message);
    }
  }, [closePosition]);

  // Closed trades stats
  const closedStats = useMemo(() => {
    const total = closedPositions.length;
    let realised = 0;
    let wins = 0;
    for (const p of closedPositions) {
      const pnl = (p.realizedPnl || 0) * (p.quantity || 1);
      realised += pnl;
      if (pnl > 0) wins++;
    }
    return { total, realised, wins, winRate: total > 0 ? Math.round((wins / total) * 100) : 0 };
  }, [closedPositions]);

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60, color: '#6b7280' }}>Loading performance…</div>;
  }

  return (
    <div className="perf-wrap">
      <div className="perf-header">
        <span className={s.eyebrow}>Track record</span>
        <h1 className="perf-title">Performance</h1>
        <p className="perf-sub">Portfolio growth, returns, and trade history with clean, investor-grade reporting.</p>
      </div>

      {/* ══════════════ Stat cards ══════════════ */}
      <div className="perf-metrics">
        <MetricCard label="Total P&L" value={signedUsd(closedStats.realised)} valueClass={closedStats.realised >= 0 ? 'dp-pos' : 'dp-neg'} sub={`realised from ${closedStats.total} closed trades`} />
        <MetricCard label="Today's P&L" value="—" sub="across active positions" />
        <MetricCard label="Unrealised" value="—" sub={`${activePositions.length} active positions`} />
        <MetricCard label="Realised" value={signedUsd(closedStats.realised)} valueClass={closedStats.realised >= 0 ? 'dp-pos' : 'dp-neg'} sub={`${closedStats.total} closed trades`} />
        <MetricCard label="Win rate" value={closedStats.total > 0 ? `${closedStats.winRate}%` : '—'} sub={closedStats.total > 0 ? `${closedStats.wins} of ${closedStats.total} trades` : 'no closed trades'} />
      </div>

      {/* ══════════════ Plan adherence (Phase 2a — diagnostic) ══════════════ */}
      <div style={{ marginBottom: 20 }}>
        <AdherenceCard />
      </div>

      {/* ══════════════ Reconciliation bar ══════════════ */}
      <div className="perf-recon">
        <span className={s.eyebrow} style={{ marginRight: 6 }}>Portfolio P&L reconciliation</span>
        <span className="perf-recon-item">Realised <b className={closedStats.realised >= 0 ? 'dp-pos' : 'dp-neg'}>{signedUsd(closedStats.realised)}</b></span>
        <span className="perf-recon-sep">+</span>
        <span className="perf-recon-item">Unrealised <b>—</b></span>
        <span className="perf-recon-sep">=</span>
        <span className="perf-recon-item">Total <b>—</b></span>
      </div>

      {/* ══════════════ Open risk table ══════════════ */}
      <div className="perf-card perf-section">
        <span className={s.eyebrow}>Open risk</span>
        <div className="perf-section-head">
          <h3 className="perf-section-title">Active positions</h3>
        </div>
        {activePositions.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: 14, padding: '20px 0' }}>No active positions.</p>
        ) : (
          <table className="perf-table">
            <thead>
              <tr>
                <th>Ticker</th><th>Strategy</th><th>Qty</th><th>Total P&L</th>
                <th>Day</th><th>% of max profit</th><th>Return on risk</th><th>Status</th><th></th>
              </tr>
            </thead>
            <tbody>
              {activePositions.map(item => (
                <OpenPositionRow key={item.id} item={item} tile={tiles?.find(t => t.id === (item.tileId || item.id))} onClose={handleClose} />
              ))}
            </tbody>
          </table>
        )}
        <div className="perf-footnote">
          Return on risk = P&L &divide; max loss. % of max profit = P&L &divide; max profit.
          Both read from the same canonical total-dollar P&L.
        </div>
      </div>

      {/* ══════════════ Closed trades ══════════════ */}
      <div className="perf-card perf-section">
        <span className={s.eyebrow}>Closed performance &middot; track record</span>
        <div className="perf-section-head">
          <h3 className="perf-section-title">Closed trades history</h3>
          <span className="perf-section-sub">{closedStats.total} trades &middot; realised {signedUsd(closedStats.realised)} &middot; {closedStats.winRate}% win rate</span>
        </div>
        {closedPositions.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: 14, padding: '20px 0' }}>No closed trades yet.</p>
        ) : (
          <table className="perf-table">
            <thead>
              <tr><th>Ticker</th><th>Strategy</th><th>Qty</th><th>Entry credit</th><th>P&L</th><th>Return</th><th>Reason</th><th>Closed</th></tr>
            </thead>
            <tbody>
              {closedPositions.map(p => {
                const pnl = (p.realizedPnl || 0) * (p.quantity || 1);
                const entryCredit = (p.entryNetCredit || 0) * (p.quantity || 1);
                const returnPct = entryCredit > 0 ? (pnl / entryCredit) * 100 : 0;
                const pnlClass = pnl > 0 ? 'dp-pos' : pnl < 0 ? 'dp-neg' : '';
                return (
                  <tr key={p.id}>
                    <td className="perf-tk">{p.symbol}</td>
                    <td>{formatStrategy(p.strategyType)}</td>
                    <td className="perf-num">{p.quantity || 1}</td>
                    <td className="perf-num">{usd(entryCredit)}</td>
                    <td className={`perf-num ${pnlClass}`}>{pnl !== 0 ? signedUsd(pnl) : '$0'}</td>
                    <td className={`perf-num ${pnlClass}`}>{returnPct !== 0 ? `${returnPct > 0 ? '+' : ''}${returnPct.toFixed(1)}%` : '—'}</td>
                    <td>{p.closeReason === 'expired' ? 'Expired' : p.closeReason === 'manual' ? 'Manual close' : p.closeReason || '—'}</td>
                    <td className="perf-num">{p.closedAt ? new Date(p.closedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ height: 48 }} />
    </div>
  );
}
