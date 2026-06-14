/**
 * DashboardPageNew — Invest home / lifecycle + decision summary (mock 01).
 *
 * Layout: hero (lifecycle nodes), decision summary strip, flagged rows,
 * discover column + performance cards column.
 *
 * All P&L from derivePosition(). No recomputation.
 */

import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../shared/hooks/useAuth';
import { usePortfolio } from '../hooks/usePortfolio';
import { usePortfolioSettings } from '../hooks/usePortfolioSettings';
import { usePortfolioPnl } from '../hooks/usePortfolioPnl';
import { PortfolioSummaryHero } from '../components/PortfolioSummaryHero';
import { ActivePlanCard } from '../components/ActivePlanCard';
import { AddFundsModal } from '../components/AddFundsModal';
import { usePositionLiveData } from '../hooks/usePositionLiveData';
import { toCanonical } from '../lib/toCanonical';
import { derivePosition, recommendation } from '../lib/derivePosition';
import { signedUsd, usd } from '../lib/money';
import { formatStrategy } from '../utils/formatters';
import {
  ReviewBadge,
  investStyles as s,
} from '../components/invest';

import './DashboardPageNew.css';

/** Single flagged position row */
function FlaggedRow({ item, tile }) {
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

  if (!canonical || canonical.pnlTotal == null) return null;

  const d = derivePosition(canonical);
  if (!d.flagged) return null;

  const rec = recommendation(d);
  const pnlClass = d.pnlTotal >= 0 ? 'dp-pos' : 'dp-neg';
  const flagClass = d.review === 'profit' ? 'dh-flag dh-flag-good' : d.review === 'time' ? 'dh-flag dh-flag-time' : 'dh-flag';

  return (
    <div className={flagClass}>
      <ReviewBadge review={d.review} />
      <span className="dh-flag-sym">{d.symbol}</span>
      <div className="dh-flag-ctx">
        <span className="dh-flag-f"><b className={pnlClass}>{signedUsd(d.pnlTotal)}</b> total <span style={{ color: '#6b7280' }}>&middot; {signedUsd(d.perContract)} &times; {d.qty}</span></span>
        <span className="dh-flag-f">{Math.round(d.profitCapturedPct)}% captured</span>
        <span className={`dh-flag-f ${d.review === 'loss' ? 'dh-flag-loss' : d.review === 'time' ? 'dh-flag-amber' : 'dh-flag-green'}`}>
          {d.dte} DTE &middot; {d.review === 'time' ? 'profitable but low capture' : d.review === 'loss' ? 'under pressure' : 'consider harvest'}
        </span>
      </div>
      <Link to={`/invest/strategy/${item.tileId || item.id}`} className="dh-flag-rv">Review</Link>
    </div>
  );
}

export function DashboardPageNew({ user, tiles, onOpenChat }) {
  const { activePositions, closedPositions, portfolioItems, loading } = usePortfolio();
  const { settings, updateSettings } = usePortfolioSettings();
  const { enrichedItems: livePortfolio } = usePortfolioPnl(portfolioItems, tiles);
  const navigate = useNavigate();
  const [showAddFunds, setShowAddFunds] = useState(false);
  const [fundsMode, setFundsMode] = useState('add');

  const now = new Date();
  const greeting = now.getHours() < 12 ? 'Good morning' : now.getHours() < 18 ? 'Good afternoon' : 'Good evening';
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  const displayName = user?.displayName?.split(' ')[0] || user?.email?.split('@')[0] || '';

  // Discover: new tiles not in portfolio
  const newTiles = useMemo(() => {
    const ownedIds = new Set(activePositions.map(p => p.tileId || p.id));
    return (tiles || []).filter(t => t.isActive && !ownedIds.has(t.id)).slice(0, 3);
  }, [tiles, activePositions]);

  // Closed stats
  const closedStats = useMemo(() => {
    const total = closedPositions.length;
    let realised = 0, wins = 0;
    for (const p of closedPositions) {
      const pnl = (p.realizedPnl || 0) * (p.quantity || 1);
      realised += pnl;
      if (pnl > 0) wins++;
    }
    return { total, realised, wins, winRate: total > 0 ? Math.round((wins / total) * 100) : 0 };
  }, [closedPositions]);

  const totalCapital = settings?.totalCapital || 0;

  // Portfolio hero stats from live P&L
  const perf = useMemo(() => {
    const active = livePortfolio.filter(p => p.status !== 'closed');
    let unrealizedPnl = 0;
    let capitalDeployed = 0;
    active.forEach(item => {
      unrealizedPnl += (item.livePnl || 0) * (item.quantity || 1);
      capitalDeployed += (item.maxLoss || 0) * (item.quantity || 1);
    });
    const totalPnl = unrealizedPnl + closedStats.realised;
    const totalPnlPct = totalCapital > 0 ? ((totalPnl / totalCapital) * 100).toFixed(1) : '0.0';
    return { unrealizedPnl, capitalDeployed, totalPnl, totalPnlPct };
  }, [livePortfolio, closedStats, totalCapital]);

  const showPortfolioHero = activePositions.length > 0 || totalCapital > 0;

  if (loading) {
    return <div style={{ textAlign: 'center', padding: 60, color: '#6b7280' }}>Loading…</div>;
  }

  return (
    <div className="dh-wrap">
      {/* ══════════════ Hero ══════════════ */}
      {showPortfolioHero ? (
        <PortfolioSummaryHero
          user={user}
          portfolioValue={totalCapital + perf.totalPnl}
          capital={totalCapital}
          openPnl={perf.unrealizedPnl}
          realisedPnl={closedStats.realised}
          totalPnlPct={perf.totalPnlPct}
          activeCount={activePositions.length}
          closedCount={closedStats.total}
          winRate={closedStats.total > 0 ? closedStats.winRate : null}
          winCount={closedStats.wins}
          capitalDeployed={perf.capitalDeployed}
          riskBudget={totalCapital * 0.10}
          onAddFunds={() => { setFundsMode('add'); setShowAddFunds(true); }}
          onWithdraw={() => { setFundsMode('withdraw'); setShowAddFunds(true); }}
        />
      ) : (
        <div className="dh-hero">
          <div className="dh-greet">{greeting}, {displayName} — {dateStr}</div>
          <span className={s.eyebrow} style={{ marginTop: 8, display: 'block' }}>The options lifecycle</span>
          <h1 className="dh-hero-title">From signal to <i>safeguard</i>.</h1>
          <p className="dh-lede">NewLeaf carries every options trade through five disciplined stages. No gaps between research and risk.</p>

          <div className="dh-flow">
            <div className="dh-node"><div className="dh-circ">&#128269;{newTiles.length > 0 && <span className="dh-badge-g">{newTiles.length}</span>}</div><h4>Discover</h4><small>{newTiles.length} new setups</small></div>
            <div className="dh-fline" />
            <div className="dh-node"><div className="dh-circ">&#8866;</div><h4>Decide</h4><small>Probability &amp; fit</small></div>
            <div className="dh-fline" />
            <div className="dh-node"><div className="dh-circ">&#9636;</div><h4>Build</h4><small>Strategy &amp; legs</small></div>
            <div className="dh-fline" />
            <div className="dh-node"><div className="dh-circ">&#9889;</div><h4>Execute</h4><small>Fill with edge</small></div>
            <div className="dh-fline" />
            <div className="dh-node dh-node-last"><div className="dh-circ">&#128737;{activePositions.length > 0 && <span className="dh-badge-r">{activePositions.length}</span>}</div><h4>Defend</h4><small>{activePositions.length} active</small></div>
          </div>

          <div className="dh-herofoot">
            <div className="dh-herofoot-stats">
              {activePositions.length} active positions
              {totalCapital > 0 && <> &middot; capital deployed</>}
            </div>
            <div className="dh-herofoot-btns">
              <button className="dh-hbtn dh-hbtn-dark" onClick={() => navigate('/invest/positions')}>Review exits &rarr;</button>
              <button className="dh-hbtn" onClick={() => navigate('/invest/discover')}>Discover ideas</button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════ Active Plan of Record ══════════════ */}
      <ActivePlanCard />

      {showAddFunds && (
        <AddFundsModal
          currentCapital={totalCapital}
          mode={fundsMode}
          onSave={(newTotal) => updateSettings({ totalCapital: newTotal })}
          onClose={() => setShowAddFunds(false)}
        />
      )}

      {/* ══════════════ Flagged rows ══════════════ */}
      <div className="dh-sech">Defend &middot; positions flagged</div>
      {activePositions.map(item => (
        <FlaggedRow key={item.id} item={item} tile={tiles?.find(t => t.id === (item.tileId || item.id))} />
      ))}
      {activePositions.length === 0 && (
        <div className="dh-ontrack">
          <span>No active positions yet.</span>
          <Link to="/invest/discover" style={{ fontWeight: 500, color: '#0f4a36' }}>Discover strategies</Link>
        </div>
      )}

      {/* ══════════════ Two-column: Discover + Performance ══════════════ */}
      <div className="dh-twocol">
        <div>
          <div className="dh-sech">Discover &middot; new in research</div>
          <div className="dh-disc">
            {newTiles.map(t => (
              <Link to={`/invest/strategy/${t.id}`} key={t.id} className="dh-disc-item">
                <div className="dh-disc-name">{t.symbol}<small>{formatStrategy(t.strategy)} &middot; {t.daysToExpiry} DTE</small></div>
                {t.returnOnCapital > 0 && <div className="dh-disc-roc">{t.returnOnCapital}% ROC</div>}
              </Link>
            ))}
            {newTiles.length === 0 && <div style={{ padding: 20, color: '#6b7280', fontSize: 13, textAlign: 'center' }}>No new setups</div>}
          </div>
          <Link to="/invest/discover" className="dh-viewall">View all strategies</Link>
        </div>

        <div className="dh-perfcards">
          <div className="dh-sech">Performance &middot; overall</div>
          <div className="dh-pc">
            <div className="dh-pc-lbl">Realised P&L</div>
            <div className={`dh-pc-val ${closedStats.realised >= 0 ? 'dp-pos' : 'dp-neg'}`}>{signedUsd(closedStats.realised)}</div>
            <div className="dh-pc-sub">{closedStats.total} closed trades</div>
          </div>
          <div className="dh-pc">
            <div className="dh-pc-lbl">Win rate</div>
            <div className="dh-pc-val">{closedStats.total > 0 ? `${closedStats.winRate}%` : '—'}</div>
            <div className="dh-pc-sub">{closedStats.wins} / {closedStats.total} trades</div>
          </div>
          {totalCapital > 0 && (
            <div className="dh-pc">
              <div className="dh-pc-lbl">Capital</div>
              <div className="dh-pc-val">{usd(totalCapital)}</div>
              <div className="dh-pc-sub">configured</div>
            </div>
          )}
        </div>
      </div>

      <div style={{ height: 48 }} />
    </div>
  );
}
