import { useState, useEffect, useMemo } from 'react';
import { collection, query, getDocs, orderBy } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { usePortfolio } from '../hooks/usePortfolio';
import { usePortfolioPnl } from '../hooks/usePortfolioPnl';
import { usePortfolioSettings } from '../hooks/usePortfolioSettings';
import { useAuth } from '../../shared/hooks/useAuth';
import { calculateMetrics } from '../utils/optionsCalc';
import { formatStrategy } from '../utils/formatters';
import { KpiCard, AppTable, StatusPill } from '../components/ui';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { Button } from '../../shared/components/ui/Button';
import '../styles/newleaf-system.css';

export function PerformancePageNew({ tiles }) {
  const { portfolioItems, updatePortfolioItem } = usePortfolio();
  const { enrichedItems: livePortfolio } = usePortfolioPnl(portfolioItems, tiles);
  const { settings } = usePortfolioSettings();
  const { user } = useAuth();
  const [pnlHistory, setPnlHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [closingId, setClosingId] = useState(null);
  const [confirmClose, setConfirmClose] = useState(null);

  // Load P&L history snapshots
  useEffect(() => {
    if (!user) return;
    const loadHistory = async () => {
      try {
        const ref = collection(db, 'users', user.uid, 'pnlHistory');
        const q = query(ref, orderBy('date', 'asc'));
        const snap = await getDocs(q);
        const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setPnlHistory(docs);
      } catch (err) {
        console.error('Error loading P&L history:', err);
      } finally {
        setHistoryLoading(false);
      }
    };
    loadHistory();
  }, [user]);

  // Separate active vs closed positions
  const { activePositions, closedPositions } = useMemo(() => {
    const active = [];
    const closed = [];
    portfolioItems.forEach(item => {
      if (item.status === 'closed') {
        closed.push(item);
      } else {
        active.push(item);
      }
    });
    closed.sort((a, b) => {
      const dateA = a.closedAt?.toDate?.() || new Date(a.closedAt || 0);
      const dateB = b.closedAt?.toDate?.() || new Date(b.closedAt || 0);
      return dateB - dateA;
    });
    return { activePositions: active, closedPositions: closed };
  }, [portfolioItems]);

  // Compute all stats from REAL data
  const stats = useMemo(() => {
    const totalCapital = settings?.totalCapital || 100000;

    const joined = activePositions.map(pi => {
      const tile = tiles.find(t => t.id === pi.tileId);
      return { ...pi, tile };
    }).filter(i => i.tile);

    const totalUnrealizedPnl = activePositions.reduce((sum, p) => {
      const live = livePortfolio.find(lp => lp.id === p.id);
      return sum + (((live?.livePnl || p.unrealizedPnl || 0)) * (p.quantity || 1));
    }, 0);

    const totalRealizedPnl = closedPositions.reduce((sum, p) => {
      return sum + ((p.unrealizedPnl || p.realizedPnl || 0) * (p.quantity || 1));
    }, 0);

    const totalPnl = totalUnrealizedPnl + totalRealizedPnl;
    const totalReturnPct = totalCapital > 0 ? (totalPnl / totalCapital) * 100 : 0;

    const closedWithPnl = closedPositions.filter(p => (p.unrealizedPnl || p.realizedPnl || 0) !== 0);
    const winners = closedWithPnl.filter(p => (p.unrealizedPnl || p.realizedPnl || 0) > 0);
    const winRate = closedWithPnl.length > 0
      ? Math.round((winners.length / closedWithPnl.length) * 100)
      : null;
    const winCount = winners.length;
    const totalTrades = closedWithPnl.length;

    let capitalDeployed = 0;
    joined.forEach(item => {
      const metrics = calculateMetrics(item.tile);
      const maxLoss = item.tile.technical?.maxLoss || item.tile.maxLoss || metrics.maxLoss || 0;
      capitalDeployed += Math.abs(maxLoss) * (item.quantity || 1);
    });

    const monthlyReturns = [];
    if (pnlHistory.length >= 2) {
      for (let i = 1; i < pnlHistory.length; i++) {
        const prevPnl = pnlHistory[i - 1].totalPnl || 0;
        const currPnl = pnlHistory[i].totalPnl || 0;
        const diff = currPnl - prevPnl;
        const pct = totalCapital > 0 ? (diff / totalCapital) * 100 : 0;
        const date = pnlHistory[i].date;
        const [y, m] = date.split('-');
        const monthLabel = new Date(parseInt(y), parseInt(m) - 1).toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
        monthlyReturns.push({ label: monthLabel, val: parseFloat(pct.toFixed(1)), date, pnlDiff: diff });
      }
    }

    const activeMonths = monthlyReturns.filter(m => m.val !== 0);
    const avgMonthly = activeMonths.length > 0
      ? (activeMonths.reduce((s, m) => s + m.val, 0) / activeMonths.length)
      : 0;
    const bestMonth = monthlyReturns.length > 0
      ? monthlyReturns.reduce((best, m) => m.val > best.val ? m : best, monthlyReturns[0])
      : null;

    const allocations = [];
    const COLORS = ['#0B2D23', '#1a5e44', '#C9A96E', '#a8893a', '#2d8a64', '#3ba876', '#dcc88a'];
    let totalRisk = 0;
    joined.forEach(item => {
      const metrics = calculateMetrics(item.tile);
      const cost = Math.abs(item.tile.technical?.maxLoss || item.tile.maxLoss || metrics.maxLoss || 0);
      totalRisk += cost * (item.quantity || 1);
    });
    joined.forEach((item, i) => {
      const metrics = calculateMetrics(item.tile);
      const cost = Math.abs(item.tile.technical?.maxLoss || item.tile.maxLoss || metrics.maxLoss || 0) * (item.quantity || 1);
      const pct = totalRisk > 0 ? Math.round((cost / totalRisk) * 100) : 0;
      allocations.push({
        name: item.tile.symbol + ' ' + formatStrategy(item.tile.strategy),
        pct,
        color: COLORS[i % COLORS.length],
      });
    });

    return {
      totalPnl,
      totalReturnPct,
      totalUnrealizedPnl,
      totalRealizedPnl,
      avgMonthly,
      bestMonth,
      winRate,
      winCount,
      totalTrades,
      capitalDeployed,
      totalCapital,
      activeCount: joined.length,
      allocations,
      monthlyReturns,
    };
  }, [portfolioItems, activePositions, closedPositions, tiles, settings, pnlHistory]);

  // Build growth chart from P&L history + current live state
  const growthChart = useMemo(() => {
    const totalCapital = settings?.totalCapital || 100000;
    const livePnl = stats.totalPnl || 0;
    const today = new Date().toISOString().split('T')[0];

    const points = pnlHistory.map(snap => ({
      date: snap.date,
      value: totalCapital + (snap.totalPnl || 0),
      pnl: snap.totalPnl || 0,
    }));

    const lastSnap = points[points.length - 1];
    if (!lastSnap || lastSnap.date !== today || Math.abs(lastSnap.pnl - livePnl) > 1) {
      points.push({ date: today, value: totalCapital + livePnl, pnl: livePnl });
    }

    if (points.length > 0 && points[0].pnl !== 0) {
      points.unshift({ date: 'start', value: totalCapital, pnl: 0 });
    }

    return points.length >= 2 ? points : null;
  }, [pnlHistory, settings, stats.totalPnl]);

  // SVG growth chart path builder
  const growthSvg = useMemo(() => {
    if (!growthChart || growthChart.length < 2) return null;
    const values = growthChart.map(p => p.value);
    const minVal = Math.min(...values) * 0.998;
    const maxVal = Math.max(...values) * 1.002;
    const range = maxVal - minVal || 1;
    const w = 600, h = 240;

    const pts = growthChart.map((p, i) => ({
      x: (i / (growthChart.length - 1)) * w,
      y: h - ((p.value - minVal) / range) * h,
    }));

    let linePath = 'M' + pts[0].x + ',' + pts[0].y;
    for (let i = 1; i < pts.length; i++) {
      const cp1x = pts[i - 1].x + (pts[i].x - pts[i - 1].x) / 3;
      const cp2x = pts[i].x - (pts[i].x - pts[i - 1].x) / 3;
      linePath += ' C' + cp1x + ',' + pts[i - 1].y + ' ' + cp2x + ',' + pts[i].y + ' ' + pts[i].x + ',' + pts[i].y;
    }
    const areaPath = linePath + ' L' + w + ',' + h + ' L0,' + h + ' Z';

    const yLabels = [];
    for (let i = 0; i <= 4; i++) {
      const val = minVal + (range * (4 - i)) / 4;
      yLabels.push(val >= 1000 ? '$' + (val / 1000).toFixed(0) + 'K' : '$' + val.toFixed(0));
    }

    const xLabels = growthChart
      .filter((_, i) => i % Math.max(1, Math.floor(growthChart.length / 6)) === 0 || i === growthChart.length - 1)
      .map(p => {
        if (p.date === 'start') return 'Start';
        const parts = p.date.split('-');
        return parseInt(parts[1]) + '/' + parseInt(parts[2]);
      });

    const lastPt = pts[pts.length - 1];
    return { linePath, areaPath, yLabels, xLabels, lastPt };
  }, [growthChart]);

  // Build SVG pie chart segments
  const circumference = 2 * Math.PI * 70;
  const pieSegments = [];
  let dashOffset = 0;
  stats.allocations.forEach((a, i) => {
    const dashLen = (a.pct / 100) * circumference;
    pieSegments.push(
      <circle key={i} cx="100" cy="100" r="70" fill="none"
        stroke={a.color} strokeWidth="28"
        strokeDasharray={dashLen + ' ' + (circumference - dashLen)}
        strokeDashoffset={-dashOffset}
        transform="rotate(-90 100 100)"
      />
    );
    dashOffset += dashLen;
  });

  const formatPnl = (val) => {
    const abs = Math.abs(val);
    const sign = val >= 0 ? '+' : '-';
    return sign + '$' + abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  const handleClosePosition = async (pos) => {
    setClosingId(pos.id);
    try {
      await updatePortfolioItem(pos.tileId || pos.id, {
        status: 'closed',
        realizedPnl: pos.unrealizedPnl || 0,
        closedAt: new Date(),
        closedReason: 'manual',
      });
      setConfirmClose(null);
    } catch (err) {
      console.error('Error closing position:', err);
    } finally {
      setClosingId(null);
    }
  };

  // Helper: get live data for a row
  const getLive = (row) => livePortfolio.find(lp => lp.id === row.id) || row;

  // Columns for Active Positions Table
  const activeColumns = [
    { header: 'Ticker', key: 'symbol', render: (row) => <strong>{row.symbol}</strong> },
    { header: 'Strategy', key: 'strategy', render: (row) => <span style={{ fontFamily: 'var(--mono)', color: 'var(--nl-primary-green)' }}>{formatStrategy(row.strategy || '')}</span> },
    { header: 'Entry Credit', key: 'entryNetCredit', render: (row) => {
      const entry = Math.abs(row.entryNetCredit || 0);
      return <span style={{ fontFamily: 'var(--mono)' }}>{entry > 0 ? '$' + entry.toFixed(0) : '—'}</span>;
    }},
    { header: 'P&L', key: 'pnl', render: (row) => {
      const live = getLive(row);
      const pnl = (live.livePnl || live.unrealizedPnl || 0) * (row.quantity || 1);
      return (
        <span style={{
          fontFamily: 'var(--mono)',
          fontWeight: '600',
          color: pnl > 0 ? 'var(--nl-success)' : pnl < 0 ? 'var(--nl-danger)' : 'var(--nl-muted-text)',
        }}>
          {pnl !== 0 ? formatPnl(pnl) : '$0'}
        </span>
      );
    }},
    { header: 'Return', key: 'return', render: (row) => {
      const live = getLive(row);
      const pnl = (live.livePnl || live.unrealizedPnl || 0) * (row.quantity || 1);
      const entry = Math.abs(row.entryNetCredit || 0);
      const returnPct = entry > 0 ? (pnl / entry) * 100 : 0;
      return (
        <span style={{
          fontFamily: 'var(--mono)',
          color: returnPct > 0 ? 'var(--nl-success)' : returnPct < 0 ? 'var(--nl-danger)' : 'var(--nl-muted-text)',
        }}>
          {returnPct !== 0 ? (returnPct >= 0 ? '+' : '') + returnPct.toFixed(1) + '%' : '—'}
        </span>
      );
    }},
    { header: 'Status', key: 'status', align: 'center', render: (row) => {
      const live = getLive(row);
      const ss = live.strategyStatus;
      if (ss) {
        const statusMap = { critical: 'danger', high: 'warning', medium: 'warning', low: 'healthy', none: 'healthy' };
        return <StatusPill status={statusMap[ss.urgency] || 'healthy'} label={ss.status} />;
      }
      return <StatusPill status="healthy" label="Healthy" />;
    }},
    { header: 'Action', key: 'suggestion', render: (row) => {
      const live = getLive(row);
      const ss = live.strategyStatus;
      if (ss?.suggestion) {
        return (
          <span style={{ fontSize: '10px', color: 'var(--nl-muted-text)', lineHeight: 1.4, display: 'block', maxWidth: 200 }}>
            {ss.suggestion.length > 80 ? ss.suggestion.slice(0, 80) + '...' : ss.suggestion}
          </span>
        );
      }
      return <span style={{ fontSize: '10px', color: 'var(--nl-muted-text)' }}>No action needed</span>;
    }},
    { header: 'Action', key: 'action', align: 'center', render: (row) => (
      <Button variant="ghost" size="sm" onClick={() => setConfirmClose(row)} disabled={closingId === row.id}>
        {closingId === row.id ? 'Closing...' : 'Close'}
      </Button>
    )},
  ];

  // Columns for Closed Positions Table
  const closedColumns = [
    { header: 'Ticker', key: 'symbol', render: (row) => <strong>{row.symbol}</strong> },
    { header: 'Strategy', key: 'strategy', render: (row) => <span style={{ fontFamily: 'var(--mono)', color: 'var(--nl-primary-green)' }}>{formatStrategy(row.strategy || '')}</span> },
    { header: 'Entry Credit', key: 'entryNetCredit', render: (row) => {
      const entry = Math.abs(row.entryNetCredit || 0);
      return <span style={{ fontFamily: 'var(--mono)' }}>{entry > 0 ? '$' + entry.toFixed(0) : '—'}</span>;
    }},
    { header: 'P&L', key: 'pnl', render: (row) => {
      const pnl = (row.unrealizedPnl || row.realizedPnl || 0) * (row.quantity || 1);
      return (
        <span style={{
          fontFamily: 'var(--mono)',
          fontWeight: '600',
          color: pnl > 0 ? 'var(--nl-success)' : pnl < 0 ? 'var(--nl-danger)' : 'var(--nl-muted-text)',
        }}>
          {pnl !== 0 ? formatPnl(pnl) : '$0'}
        </span>
      );
    }},
    { header: 'Return', key: 'return', render: (row) => {
      const pnl = (row.unrealizedPnl || row.realizedPnl || 0) * (row.quantity || 1);
      const entry = Math.abs(row.entryNetCredit || 0);
      const returnPct = entry > 0 ? (pnl / entry) * 100 : 0;
      return (
        <span style={{
          fontFamily: 'var(--mono)',
          color: returnPct > 0 ? 'var(--nl-success)' : returnPct < 0 ? 'var(--nl-danger)' : 'var(--nl-muted-text)',
        }}>
          {returnPct !== 0 ? (returnPct >= 0 ? '+' : '') + returnPct.toFixed(1) + '%' : '—'}
        </span>
      );
    }},
    { header: 'Reason', key: 'closedReason', render: (row) => {
      const reason = row.closedReason === 'tile_removed' ? 'Tile removed'
        : row.closedReason === 'expired' ? 'Expired'
        : row.closedReason === 'manual' ? 'Manual close'
        : row.closedReason || '—';
      return <span style={{ fontSize: '10px', color: 'var(--nl-muted-text)' }}>{reason}</span>;
    }},
    { header: 'Closed', key: 'closedAt', render: (row) => {
      const closedDate = row.closedAt?.toDate?.() || (row.closedAt ? new Date(row.closedAt) : null);
      const dateStr = closedDate
        ? closedDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
        : '—';
      return <span style={{ color: 'var(--nl-muted-text)', fontSize: '11px' }}>{dateStr}</span>;
    }},
  ];

  return (
    <div className="nl-page">
      <div className="nl-page-header">
        <div>
          <div style={{
            fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: '.16em',
            textTransform: 'uppercase', color: '#C8A85A', marginBottom: 8,
          }}>
            Track Record
          </div>
          <h1 className="nl-page-title">Performance</h1>
          <p className="nl-page-subtitle">
            Track portfolio growth, returns, and trade history with clean, investor-grade reporting.
          </p>
        </div>
      </div>

      {/* Top Stats */}
      <div className="nl-perf-kpis nl-mb-md">
        <KpiCard
          label="Total P&L"
          value={formatPnl(stats.totalPnl)}
          subtitle={`${stats.totalReturnPct >= 0 ? '+' : ''}${stats.totalReturnPct.toFixed(1)}% of portfolio`}
        />
        <KpiCard
          label="Unrealized"
          value={formatPnl(stats.totalUnrealizedPnl)}
          subtitle={`${activePositions.length} active position${activePositions.length !== 1 ? 's' : ''}`}
        />
        <KpiCard
          label="Realized"
          value={formatPnl(stats.totalRealizedPnl)}
          subtitle={`${closedPositions.length} closed trade${closedPositions.length !== 1 ? 's' : ''}`}
        />
        <KpiCard
          label="Win Rate"
          value={stats.winRate !== null ? stats.winRate + '%' : '—'}
          subtitle={stats.totalTrades > 0 ? `${stats.winCount} of ${stats.totalTrades} trades` : 'No closed trades yet'}
        />
      </div>

      {/* Growth Chart + Monthly Returns */}
      <div className="nl-perf-layout nl-mb-md">
        <div className="nl-card">
          <div className="nl-card-header">
            <h3 className="nl-card-title">Portfolio Growth</h3>
            <div style={{ fontSize: '12px', color: 'var(--nl-muted-text)', fontWeight: '800' }}>
              ${(stats.totalCapital / 1000).toFixed(0)}K starting capital
              {pnlHistory.length > 0 && ` — ${pnlHistory.length} snapshot${pnlHistory.length !== 1 ? 's' : ''}`}
            </div>
          </div>

          {growthSvg ? (
            <div className="nl-chart-container" style={{ marginLeft: 54, position: 'relative' }}>
              <div style={{ position: 'absolute', left: -54, top: 0, bottom: 0, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                {growthSvg.yLabels.map((label, i) => (
                  <span key={i} style={{ fontSize: '10px', color: 'var(--nl-muted-text)' }}>{label}</span>
                ))}
              </div>
              <div style={{ width: '100%', height: 240 }}>
                <svg viewBox="0 0 600 240" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
                  <defs>
                    <linearGradient id="gg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={stats.totalPnl >= 0 ? '#0B2D23' : '#dc2626'} stopOpacity="0.12"/>
                      <stop offset="100%" stopColor={stats.totalPnl >= 0 ? '#0B2D23' : '#dc2626'} stopOpacity="0"/>
                    </linearGradient>
                  </defs>
                  <line x1="0" y1="120" x2="600" y2="120" stroke="rgba(17,24,39,0.10)" strokeWidth="1" strokeDasharray="4,3"/>
                  <path d={growthSvg.areaPath} fill="url(#gg)"/>
                  <path d={growthSvg.linePath} fill="none"
                    stroke={stats.totalPnl >= 0 ? '#0B2D23' : '#dc2626'} strokeWidth="2.5"/>
                </svg>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8 }}>
                {growthSvg.xLabels.map((m, i) => (
                  <span key={i} style={{ fontSize: '10px', color: 'var(--nl-muted-text)' }}>{m}</span>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--nl-muted-text)', fontSize: '13px' }}>
              <div style={{ fontSize: '32px', marginBottom: '8px' }}>📈</div>
              <p style={{ marginBottom: '4px', fontWeight: '600', color: 'var(--nl-text)' }}>No snapshots yet</p>
              <p style={{ fontSize: '12px' }}>
                Go to Admin → P&L Chart tab → Record Today's Snapshot to start tracking growth over time
              </p>
            </div>
          )}
        </div>

        <div className="nl-card">
          <div className="nl-card-header">
            <h3 className="nl-card-title">Monthly Returns</h3>
            {stats.bestMonth && (
              <div style={{ fontSize: '11px', fontWeight: '900', color: 'var(--nl-success)' }}>
                Best: +{stats.bestMonth.val.toFixed(1)}%
              </div>
            )}
          </div>

          {stats.monthlyReturns.length > 0 ? (
            <>
              <div className="nl-month-tiles">
                {stats.monthlyReturns.slice(-6).map((m, i) => (
                  <div key={i} className="nl-month-tile">
                    <div className="nl-month-label">{m.label}</div>
                    <div className={`nl-month-value ${m.val < 0 ? 'negative' : m.val > 0 ? 'positive' : ''}`}>
                      {m.val === 0 ? '—' : (m.val > 0 ? '+' : '') + m.val.toFixed(1) + '%'}
                    </div>
                  </div>
                ))}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '12px', fontSize: '11px', color: 'var(--nl-muted-text)' }}>
                <span>Avg: <strong style={{ color: stats.avgMonthly >= 0 ? 'var(--nl-success)' : 'var(--nl-danger)' }}>
                  {(stats.avgMonthly >= 0 ? '+' : '') + stats.avgMonthly.toFixed(1) + '%'}
                </strong></span>
              </div>
            </>
          ) : (
            <div style={{ padding: '30px 16px', textAlign: 'center', color: 'var(--nl-muted-text)', fontSize: '13px' }}>
              <div style={{ fontSize: '28px', marginBottom: '8px' }}>📊</div>
              <p style={{ fontWeight: '600', color: 'var(--nl-text)', marginBottom: '4px' }}>No monthly data yet</p>
              <p style={{ fontSize: '12px' }}>
                Record P&L snapshots over time to see monthly return breakdowns
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Active Positions */}
      {activePositions.length > 0 && (
        <div className="nl-card nl-mb-md">
          <div className="nl-card-header">
            <h3 className="nl-card-title">📈 Active Positions</h3>
            <span style={{ fontSize: '11px', color: 'var(--nl-muted-text)', fontFamily: 'var(--mono)' }}>
              {activePositions.length} position{activePositions.length !== 1 ? 's' : ''}
              {' · Unrealized: '}
              <span style={{ color: stats.totalUnrealizedPnl >= 0 ? 'var(--nl-success)' : 'var(--nl-danger)', fontWeight: 600 }}>
                {formatPnl(stats.totalUnrealizedPnl)}
              </span>
            </span>
          </div>
          <AppTable columns={activeColumns} data={activePositions} />
        </div>
      )}

      {/* Closed Trades History */}
      <div className="nl-card nl-mb-md">
        <div className="nl-card-header">
          <h3 className="nl-card-title">📋 Closed Trades History</h3>
          <span style={{ fontSize: '11px', color: 'var(--nl-muted-text)', fontFamily: 'var(--mono)' }}>
            {closedPositions.length} trade{closedPositions.length !== 1 ? 's' : ''}
            {stats.totalRealizedPnl !== 0 && (
              <> · Total: <span style={{ color: stats.totalRealizedPnl >= 0 ? 'var(--nl-success)' : 'var(--nl-danger)', fontWeight: 600 }}>
                {formatPnl(stats.totalRealizedPnl)}
              </span></>
            )}
          </span>
        </div>
        {closedPositions.length > 0 ? (
          <AppTable columns={closedColumns} data={closedPositions} />
        ) : (
          <EmptyState
            icon="&#128230;"
            title="No closed trades yet"
            message="When you close positions, they'll appear here with their final P&L."
          />
        )}
      </div>

      {/* Close Confirmation Dialog */}
      {confirmClose && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center',
          zIndex: 1000,
        }} onClick={() => setConfirmClose(null)}>
          <div style={{
            background: 'white', borderRadius: 12, padding: '24px 28px', maxWidth: 400, width: '90%',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
          }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 8px', fontSize: 16, color: 'var(--nl-text)' }}>Close Position?</h3>
            <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--nl-muted-text)', lineHeight: 1.5 }}>
              {'Close '}
              <strong>{confirmClose.symbol + ' ' + formatStrategy(confirmClose.strategy || '')}</strong>
              {' and lock in the current P&L of '}
              <strong style={{ color: (confirmClose.unrealizedPnl || 0) >= 0 ? 'var(--nl-success)' : 'var(--nl-danger)' }}>
                {formatPnl((confirmClose.unrealizedPnl || 0) * (confirmClose.quantity || 1))}
              </strong>
              {'?'}
            </p>
            <p style={{ margin: '0 0 20px', fontSize: 11, color: 'var(--nl-muted-text)' }}>
              This will move the position to Closed Trades History with today's date.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <Button variant="ghost" onClick={() => setConfirmClose(null)}>Cancel</Button>
              <Button variant="danger" onClick={() => handleClosePosition(confirmClose)} loading={closingId === confirmClose.id}>
                {closingId === confirmClose.id ? 'Closing...' : 'Close Position'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
