import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { usePortfolio } from '../hooks/usePortfolio';
import { usePortfolioPnl } from '../hooks/usePortfolioPnl';
import { usePortfolioSettings } from '../hooks/usePortfolioSettings';
import { useShortlist } from '../hooks/useShortlist';
import { usePositionLiveData } from '../hooks/usePositionLiveData';
import { useVerdict, VERDICT_STATES, VERDICT_CONFIG } from '../hooks/useVerdict';
import { calculateMetrics } from '../utils/optionsCalc';
import { formatStrategy } from '../utils/formatters';
import { LifecycleHero } from '../components/LifecycleHero';
import { Card, StatCard } from '../../shared/components/ui/Card';
import { VerdictBadge } from '../../shared/components/ui/VerdictBadge';
import { PnlDisplay } from '../../shared/components/ui/PnlDisplay';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { Button } from '../../shared/components/ui/Button';
import styles from './DashboardPage.module.css';

const fmt = (v) => {
  if (v == null || isNaN(v)) return '--';
  return '$' + Math.round(v).toLocaleString();
};

/**
 * /trading — Home dashboard.
 * "What needs my attention today?"
 */
export function DashboardPage({ user, tiles, onOpenChat }) {
  const navigate = useNavigate();
  const { portfolioItems } = usePortfolio();
  const { enrichedItems: livePortfolio } = usePortfolioPnl(portfolioItems, tiles);
  const { settings } = usePortfolioSettings();
  const { isShortlisted } = useShortlist();

  // ─── Performance stats ───
  const perf = useMemo(() => {
    const totalCapital = settings?.totalCapital || 0;
    const active = livePortfolio.filter(p => p.status !== 'closed' && tiles.some(t => t.id === p.tileId));
    const closed = portfolioItems.filter(p => p.status === 'closed');

    let totalPnl = 0;
    let capitalDeployed = 0;
    active.forEach(item => {
      const tile = tiles.find(t => t.id === item.tileId);
      if (!tile) return;
      const metrics = calculateMetrics(tile);
      const cost = tile.maxLoss || tile.technical?.maxLoss || metrics.maxLoss;
      capitalDeployed += cost * (item.quantity || 1);
      totalPnl += (item.livePnl || item.unrealizedPnl || 0) * (item.quantity || 1);
    });

    const closedWithPnl = closed.filter(p => (p.realizedPnl || 0) !== 0);
    const winners = closedWithPnl.filter(p => (p.realizedPnl || 0) > 0);
    const winRate = closedWithPnl.length > 0 ? Math.round((winners.length / closedWithPnl.length) * 100) : null;

    return {
      totalPnl,
      totalPnlPct: totalCapital > 0 ? ((totalPnl / totalCapital) * 100).toFixed(1) : '0.0',
      capitalDeployed,
      deployedPct: totalCapital > 0 ? Math.round((capitalDeployed / totalCapital) * 100) : 0,
      activeCount: active.length,
      winRate, winCount: winners.length,
      totalTrades: closedWithPnl.length,
      totalCapital,
    };
  }, [livePortfolio, portfolioItems, tiles, settings]);

  // ─── New in Discover ───
  const newOpps = useMemo(() => {
    const ownedIds = new Set(portfolioItems.map(p => p.tileId));
    return tiles
      .filter(t => !ownedIds.has(t.id) && !isShortlisted(t.id))
      .filter(t => t.maxProfit > 0 || t.returnOnCapital > 0 || (t.legs && t.legs.length > 0))
      .sort((a, b) => {
        const aTime = a.publishedAt?.toDate?.() || a.createdAt?.toDate?.() || new Date(0);
        const bTime = b.publishedAt?.toDate?.() || b.createdAt?.toDate?.() || new Date(0);
        return bTime - aTime;
      })
      .slice(0, 3);
  }, [tiles, portfolioItems, isShortlisted]);

  // ─── Active positions ───
  const now = new Date();
  const activePositions = portfolioItems.filter(p => {
    if (p.status !== 'active') return false;
    const tile = tiles?.find(t => t.id === p.tileId);
    if (!tile) return false;
    const expiry = p.expiry || tile.expiry;
    if (expiry && new Date(expiry + 'T16:00:00') < now) return false;
    return true;
  });
  const hasPositions = activePositions.length > 0;

  const [exitsFlaggedCount, setExitsFlaggedCount] = useState(0);

  return (
    <div className={styles.page}>
      <LifecycleHero
        user={user}
        counts={{ discover: newOpps.length, exitsFlagged: exitsFlaggedCount, active: activePositions.length }}
        capitalDeployedPct={perf.deployedPct}
        marketStatus="closed"
      />

      {/* 1. URGENT POSITIONS */}
      {hasPositions ? (
        <div className={styles.defendSection}>
          <div className={styles.eyebrow}>Defend &middot; Positions flagged</div>
          <div style={{ marginBottom: 24 }}>
            {activePositions.map(item => {
              const tile = tiles.find(t => t.id === item.tileId);
              return tile ? <UrgentPositionCard key={item.tileId} item={item} tile={tile} navigate={navigate} /> : null;
            })}
          </div>
          <CalmSummary activePositions={activePositions} tiles={tiles} navigate={navigate} onUrgentCountChange={setExitsFlaggedCount} />
        </div>
      ) : (
        <EmptyState
          icon="&#127793;"
          title="Ready to start"
          message="Browse curated strategies, size a portfolio, and track your positions — all in one place."
          actionLabel="Discover strategies"
          onAction={() => navigate('/invest/discover')}
        />
      )}

      {/* 2. TWO-COLUMN: Discover + Performance */}
      <div className={styles.twoCol}>
        {/* Left: New in Discover */}
        <div>
          <div className={styles.eyebrow}>Discover &middot; New in research</div>
          {newOpps.length > 0 ? (
            <div className={styles.oppList}>
              {newOpps.map(tile => {
                const roc = tile.returnOnCapital || tile.technical?.returnOnCapital || tile.technical?.roi;
                const maxP = tile.maxProfit ?? tile.lottery?.maxWin ?? tile.technical?.maxProfit;
                const maxL = tile.maxLoss ?? tile.lottery?.ticketCost ?? tile.technical?.maxLoss;
                const computed = roc || (maxL > 0 ? Math.round((maxP / maxL) * 100) : 0);

                return (
                  <Card key={tile.id} onClick={() => navigate(`/invest/strategy/${tile.id}`)} padding="sm" className={styles.oppCard}>
                    <div>
                      <div className={styles.oppSymbol}>{tile.symbol}</div>
                      <div className={styles.oppMeta}>{formatStrategy(tile.strategy)} &middot; {tile.daysToExpiry || '--'} DTE</div>
                    </div>
                    {computed > 0 ? (
                      <div className={styles.oppRoc}>{computed}% ROC</div>
                    ) : (
                      <div className={styles.oppMeta}>{tile.daysToExpiry || '--'} DTE</div>
                    )}
                  </Card>
                );
              })}
              <Button variant="secondary" onClick={() => navigate('/invest/discover')}>View all strategies</Button>
            </div>
          ) : (
            <Card padding="md" style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 13, color: 'var(--nl-text-dim)' }}>No new strategies available right now.</p>
            </Card>
          )}
        </div>

        {/* Right: Performance Snapshot */}
        <div>
          <div className={styles.eyebrow}>Performance &middot; This month</div>
          <div className={styles.perfList}>
            <StatCard
              label="This Month P&L"
              value={perf.totalPnl !== 0 ? `${perf.totalPnl >= 0 ? '+' : ''}${fmt(perf.totalPnl)}` : '--'}
              sub={perf.totalCapital > 0 ? `${perf.totalPnl >= 0 ? '+' : ''}${perf.totalPnlPct}% return` : null}
              color={perf.totalPnl > 0 ? 'var(--nl-profit)' : perf.totalPnl < 0 ? 'var(--nl-loss)' : undefined}
            />
            <StatCard
              label="Win Rate"
              value={perf.winRate != null ? `${perf.winRate}%` : '--'}
              sub={perf.totalTrades > 0 ? `${perf.winCount} / ${perf.totalTrades} trades` : null}
            />
            <StatCard
              label="Capital Deployed"
              value={perf.capitalDeployed > 0 ? fmt(perf.capitalDeployed) : '--'}
              sub={perf.totalCapital > 0 ? `${perf.deployedPct}% of ${fmt(perf.totalCapital)}` : null}
            />
            {perf.totalPnl === 0 && perf.activeCount === 0 && perf.totalTrades === 0 && (
              <div className={styles.perfHint}>Your first month's data will populate here.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Urgent position card — renders only EXIT / ACTION_NEEDED
// ═══════════════════════════════════════════════════════════════

function UrgentPositionCard({ item, tile, navigate }) {
  const liveData = usePositionLiveData(tile, item);
  const verdict = useVerdict(item.tileId, tile, liveData);
  const cfg = VERDICT_CONFIG[verdict.state];
  const isUrgent = verdict.state === VERDICT_STATES.EXIT || verdict.state === VERDICT_STATES.ACTION_NEEDED;
  const pnl = liveData.pnlTotal || (item.unrealizedPnl || 0) * (item.quantity || 1);

  if (!isUrgent) return null;

  return (
    <Card
      className={styles.urgentCard}
      padding="sm"
      style={{
        borderLeftColor: cfg.color,
        background: verdict.state === VERDICT_STATES.EXIT ? 'rgba(201,79,79,0.04)' : 'rgba(234,88,12,0.04)',
      }}
    >
      <div className={styles.urgentRow}>
        <div className={styles.urgentLeft}>
          <VerdictBadge state={verdict.state} />
          <span style={{ fontWeight: 700, fontSize: 15, color: 'var(--nl-text)' }}>{item.symbol}</span>
          <span style={{ fontSize: 12, color: 'var(--nl-text-dim)' }}>{formatStrategy(item.strategy)}</span>
          <span className={styles.urgentReason}>{verdict.reason}</span>
        </div>
        <div className={styles.urgentRight}>
          <PnlDisplay value={pnl} size="sm" />
          <Button
            variant={verdict.state === VERDICT_STATES.EXIT ? 'danger' : 'primary'}
            size="sm"
            onClick={() => navigate(`/invest/strategy/${item.tileId}`)}
          >
            {verdict.state === VERDICT_STATES.EXIT ? 'Close now' : 'Review'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ═══════════════════════════════════════════════════════════════
// Calm summary — aggregates verdicts
// ═══════════════════════════════════════════════════════════════

function CalmSummary({ activePositions, tiles, navigate, onUrgentCountChange }) {
  const [verdictCounts, setVerdictCounts] = useState({ urgent: 0 });
  const total = activePositions.length;

  useEffect(() => {
    if (onUrgentCountChange) onUrgentCountChange(verdictCounts.urgent);
  }, [verdictCounts.urgent, onUrgentCountChange]);

  if (total === 0) return null;

  const urgentCount = verdictCounts.urgent;
  const nonUrgentCount = total - urgentCount;
  const allOnTrack = urgentCount === 0;

  return (
    <>
      <div style={{ display: 'none' }}>
        {activePositions.map(item => {
          const tile = tiles.find(t => t.id === item.tileId);
          if (!tile) return null;
          return (
            <VerdictProbe key={item.tileId} item={item} tile={tile} onVerdict={(isUrgent) => {
              setVerdictCounts(prev => {
                const newUrgent = isUrgent ? prev.urgent + 1 : prev.urgent;
                return prev.urgent === newUrgent ? prev : { ...prev, urgent: newUrgent };
              });
            }} />
          );
        })}
      </div>

      <div className={`${styles.calmBar} ${allOnTrack ? styles.calmBarOk : styles.calmBarNeutral}`}>
        <span style={{ fontSize: 14 }}>{allOnTrack ? '\u2705' : '\u2139\uFE0F'}</span>
        <span className={`${styles.calmText} ${allOnTrack ? styles.calmTextOk : styles.calmTextNeutral}`}>
          {allOnTrack
            ? `All ${total} position${total !== 1 ? 's' : ''} on track`
            : `${nonUrgentCount} other position${nonUrgentCount !== 1 ? 's' : ''} on track`}
        </span>
        <button className={styles.viewAllLink} onClick={() => navigate('/invest/positions')}>View all</button>
      </div>
    </>
  );
}

function VerdictProbe({ item, tile, onVerdict }) {
  const liveData = usePositionLiveData(tile, item);
  const verdict = useVerdict(item.tileId, tile, liveData);
  const isUrgent = verdict.state === VERDICT_STATES.EXIT || verdict.state === VERDICT_STATES.ACTION_NEEDED;

  useEffect(() => { onVerdict(isUrgent); }, [isUrgent]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}
