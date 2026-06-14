import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortfolio } from '../hooks/usePortfolio';
import { useVerdict, VERDICT_STATES, VERDICT_CONFIG } from '../hooks/useVerdict';
import { usePositionLiveData } from '../hooks/usePositionLiveData';
import { formatStrategy } from '../utils/formatters';
import { PhaseHeader } from '../components/PhaseHeader';
import { SentimentBadge } from '../components/SentimentBadge';
import { useVerdictExplanation } from '../hooks/useVerdictExplanation';
import { Card } from '../../shared/components/ui/Card';
import { VerdictBadge } from '../../shared/components/ui/VerdictBadge';
import { PnlDisplay } from '../../shared/components/ui/PnlDisplay';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { Button } from '../../shared/components/ui/Button';
import styles from './PositionsPage.module.css';

/**
 * /trading/positions — Defend phase. Active positions with verdicts.
 *
 * Sorted by DTE (soonest expiry first), then symbol.
 * Card view: verdict pill, symbol, strategy, P&L, and AI explain CTA.
 * Table view: portfolio-style tabular summary with all key metrics.
 */

function getDte(item, tile) {
  const expiry = item?.expiry || tile?.expiry;
  if (!expiry) return 999;
  return Math.max(0, Math.round((new Date(expiry + 'T16:00:00') - new Date()) / 86400000));
}

function getDaysHeld(item) {
  const entry = item?.entryDate || item?.addedAt;
  if (!entry) return '—';
  const entryDate = typeof entry === 'string' ? new Date(entry) : entry.toDate ? entry.toDate() : new Date(entry);
  return Math.max(0, Math.round((new Date() - entryDate) / 86400000));
}

function PositionCard({ item, tile, navigate }) {
  const liveData = usePositionLiveData(tile, item);
  const verdict = useVerdict(item.tileId, tile, liveData);
  const { explanation, loading: aiLoading, error, fetchExplanation } = useVerdictExplanation();
  const cfg = VERDICT_CONFIG[verdict.state];
  const qty = item.quantity || 1;
  const pnl = liveData.pnlTotal || (item.unrealizedPnl || 0) * qty;
  const dte = getDte(item, tile);
  const maxProfit = (item.maxProfit || tile?.maxProfit || 0) * qty;
  const maxLoss = (item.maxLoss || tile?.maxLoss || 0) * qty;
  const entryCredit = Math.abs(item.entryNetCredit || 0);
  const pctOfMax = maxProfit > 0 ? Math.round((pnl / maxProfit) * 100) : null;
  // Progress: 0% = max loss, 50% = breakeven, 100% = max profit
  const progressPct = (maxProfit + maxLoss) > 0
    ? Math.min(100, Math.max(0, Math.round(((pnl + maxLoss) / (maxProfit + maxLoss)) * 100)))
    : 50;
  const progressColor = pnl > 0 ? 'var(--nl-success)' : pnl < 0 ? 'var(--nl-danger)' : 'var(--nl-muted-text)';

  return (
    <Card
      onClick={() => navigate(`/invest/strategy/${item.tileId}`)}
      className={styles.posCard}
      style={{ '--accent-color': cfg.color }}
    >
      <div className={styles.cardTop}>
        <div>
          <div className={styles.badges}>
            <VerdictBadge state={verdict.state} />
            {tile?.sentiment && <SentimentBadge sentiment={tile.sentiment} />}
          </div>
          <div className={styles.symbol}>{item.symbol}</div>
          <div className={styles.meta}>
            {formatStrategy(item.strategy)} &middot; {dte} DTE &middot; {qty} contract{qty !== 1 ? 's' : ''}
          </div>
        </div>
        <div className={styles.pnlCol}>
          <PnlDisplay value={pnl} size="md" />
          <div className={styles.contracts}>
            {pctOfMax !== null ? `${pctOfMax}% of max profit` : '—'}
          </div>
        </div>
      </div>

      {/* Risk / Reward bar */}
      <div style={{ margin: '10px 0 6px', padding: '0 2px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontFamily: 'var(--mono, monospace)', color: 'var(--nl-muted-text)', marginBottom: 4 }}>
          <span>Risk: ${maxLoss > 0 ? maxLoss.toLocaleString() : '—'}</span>
          <span>Entry: ${entryCredit.toFixed(0)}/c</span>
          <span>Max: ${maxProfit > 0 ? maxProfit.toLocaleString() : '—'}</span>
        </div>
        <div style={{ height: 6, background: '#eee', borderRadius: 3, position: 'relative', overflow: 'hidden' }}>
          <div style={{
            position: 'absolute', top: 0, left: 0, height: '100%',
            width: `${progressPct}%`, borderRadius: 3,
            background: progressColor, opacity: 0.7, transition: 'width 0.3s',
          }} />
        </div>
      </div>

      <div className={styles.reason}>{verdict.reason}</div>

      <div className={styles.aiSection}>
        {explanation ? (
          <div className={styles.aiExplanation}>
            <span className={styles.aiBadge}>AI</span>
            {explanation}
          </div>
        ) : (
          <>
            <Button
              variant="primary"
              size="sm"
              loading={aiLoading}
              onClick={e => {
                e.preventDefault();
                e.stopPropagation();
                fetchExplanation({
                  ticker: item.symbol,
                  strategy: item.strategy,
                  verdictState: verdict.state,
                  verdictReason: verdict.reason,
                  marketData: { pnl, dte: tile?.daysToExpiry },
                  position: { legs: item.legs },
                });
              }}
            >
              AI explain
            </Button>
            {error && <div className={styles.aiError}>{error}</div>}
          </>
        )}
      </div>
    </Card>
  );
}

/* ─── Table Row (one per position) ─── */
function PositionRow({ item, tile, navigate }) {
  const liveData = usePositionLiveData(tile, item);
  const verdict = useVerdict(item.tileId, tile, liveData);
  const cfg = VERDICT_CONFIG[verdict.state];
  const qty = item.quantity || 1;
  const pnl = liveData.pnlTotal || (item.unrealizedPnl || 0) * qty;
  const dte = getDte(item, tile);
  const daysHeld = getDaysHeld(item);
  const riskPerContract = item.maxLoss || tile?.maxLoss || 0;
  const maxProfit = (item.maxProfit || tile?.maxProfit || 0) * qty;
  const maxLoss = riskPerContract * qty;
  const pctOfMax = maxProfit > 0 ? Math.round((pnl / maxProfit) * 100) : null;
  const pnlColor = pnl > 0 ? '#0B7A52' : pnl < 0 ? '#C94F4F' : '#6b7280';

  return (
    <tr
      onClick={() => navigate(`/invest/strategy/${item.tileId}`)}
      className={styles.tableRow}
    >
      <td className={styles.cellSymbol}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>{item.symbol}</div>
        <div style={{ fontSize: 11, color: 'var(--nl-text-muted)' }}>{formatStrategy(item.strategy)}</div>
      </td>
      <td className={styles.cellMono}>{qty}</td>
      <td className={styles.cellMono}>{item.entryDate || '—'}</td>
      <td className={styles.cellMono}>{daysHeld}</td>
      <td className={styles.cellMono}>{dte}</td>
      <td className={styles.cellMono}>${riskPerContract > 0 ? Math.round(riskPerContract).toLocaleString() : '—'}</td>
      <td className={styles.cellMono}>${maxLoss > 0 ? Math.round(maxLoss).toLocaleString() : '—'}</td>
      <td className={styles.cellMono}>${maxProfit > 0 ? Math.round(maxProfit).toLocaleString() : '—'}</td>
      <td className={styles.cellMono} style={{ color: pnlColor, fontWeight: 700 }}>
        {pnl >= 0 ? '+' : '-'}${Math.abs(Math.round(pnl)).toLocaleString()}
      </td>
      <td className={styles.cellMono} style={{ color: pnlColor }}>
        {pctOfMax !== null ? `${pctOfMax}%` : '—'}
      </td>
      <td>
        <span className={styles.actionBadge} style={{ background: cfg.bg, color: cfg.color, borderColor: cfg.border }}>
          {cfg.label}
        </span>
      </td>
    </tr>
  );
}

/* ─── Portfolio Summary Bar ─── */
function PortfolioSummaryBar({ activePositions, tiles }) {
  // Collect P&L from all positions — rendered as a simple aggregate
  // We can't use hooks here (not per-item), so compute from item data
  const totalMaxRisk = activePositions.reduce((sum, item) => {
    const tile = tiles?.find(t => t.id === item.tileId);
    const qty = item.quantity || 1;
    return sum + (item.maxLoss || tile?.maxLoss || 0) * qty;
  }, 0);
  const totalMaxProfit = activePositions.reduce((sum, item) => {
    const tile = tiles?.find(t => t.id === item.tileId);
    const qty = item.quantity || 1;
    return sum + (item.maxProfit || tile?.maxProfit || 0) * qty;
  }, 0);
  const totalContracts = activePositions.reduce((sum, item) => sum + (item.quantity || 1), 0);

  return (
    <div className={styles.summaryBar}>
      <div className={styles.summaryItem}>
        <div className={styles.summaryLabel}>Positions</div>
        <div className={styles.summaryValue}>{activePositions.length}</div>
      </div>
      <div className={styles.summaryItem}>
        <div className={styles.summaryLabel}>Total Contracts</div>
        <div className={styles.summaryValue}>{totalContracts}</div>
      </div>
      <div className={styles.summaryItem}>
        <div className={styles.summaryLabel}>Total Max Risk</div>
        <div className={styles.summaryValue}>${totalMaxRisk.toLocaleString()}</div>
      </div>
      <div className={styles.summaryItem}>
        <div className={styles.summaryLabel}>Total Max Profit</div>
        <div className={styles.summaryValue}>${totalMaxProfit.toLocaleString()}</div>
      </div>
    </div>
  );
}

export function PositionsPage({ tiles, onOpenChat }) {
  const navigate = useNavigate();
  const { portfolioItems, loading } = usePortfolio();
  const [viewMode, setViewMode] = useState('table');

  const now = new Date();
  const activePositions = portfolioItems
    .filter(item => {
      if (item.status !== 'active') return false;
      const tile = tiles?.find(t => t.id === item.tileId);
      if (!tile) return false;
      const expiry = item.expiry || tile.expiry;
      if (expiry) {
        const expiryDate = new Date(expiry + 'T16:00:00');
        if (expiryDate < now) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const tileA = tiles?.find(t => t.id === a.tileId);
      const tileB = tiles?.find(t => t.id === b.tileId);
      const dteA = getDte(a, tileA);
      const dteB = getDte(b, tileB);
      return dteA - dteB || (a.symbol || '').localeCompare(b.symbol || '');
    });

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <PhaseHeader
          currentPhase="defend"
          title="Positions"
          subtitle="Active positions sorted by urgency. Verdict-driven actions."
          activeCount={activePositions.length || null}
        />
        <div className={styles.headerActions}>
          {activePositions.length > 0 && (
            <div className={styles.viewToggle}>
              <button
                className={`${styles.toggleBtn} ${viewMode === 'table' ? styles.toggleActive : ''}`}
                onClick={() => setViewMode('table')}
                title="Table view"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M0 2h16v2H0V2zm0 4h16v2H0V6zm0 4h16v2H0v-2zm0 4h16v2H0v-2z"/></svg>
              </button>
              <button
                className={`${styles.toggleBtn} ${viewMode === 'cards' ? styles.toggleActive : ''}`}
                onClick={() => setViewMode('cards')}
                title="Card view"
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor"><path d="M0 1h7v6H0V1zm9 0h7v6H9V1zM0 9h7v6H0V9zm9 0h7v6H9V9z"/></svg>
              </button>
            </div>
          )}
          {onOpenChat && activePositions.length > 0 && (
            <button
              className={styles.askAi}
              onClick={() => onOpenChat('Review my active positions. Any that need attention?')}
            >
              <span style={{ fontSize: 14 }}>&#9889;</span> Ask AI
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className={styles.loading}>Loading positions...</div>
      ) : activePositions.length === 0 ? (
        <EmptyState
          icon="&#128203;"
          title="No active positions"
          message="Build a portfolio from Discover to start tracking positions here."
          actionLabel="Go to Discover"
          onAction={() => navigate('/invest/discover')}
        />
      ) : viewMode === 'table' ? (
        <>
          <PortfolioSummaryBar activePositions={activePositions} tiles={tiles} />
          <div className={styles.tableWrap}>
            <table className={styles.posTable}>
              <thead>
                <tr>
                  <th className={styles.thLeft}>Symbol</th>
                  <th>Qty</th>
                  <th>Entry</th>
                  <th>Held</th>
                  <th>DTE</th>
                  <th>Risk/C</th>
                  <th>Total Risk</th>
                  <th>Max Profit</th>
                  <th>P&L</th>
                  <th>% of Max</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {activePositions.map(item => (
                  <PositionRow
                    key={item.id}
                    item={item}
                    tile={tiles?.find(t => t.id === item.tileId)}
                    navigate={navigate}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <div className={styles.list}>
          {activePositions.map(item => (
            <PositionCard
              key={item.id}
              item={item}
              tile={tiles?.find(t => t.id === item.tileId)}
              navigate={navigate}
            />
          ))}
        </div>
      )}
    </div>
  );
}
