import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import PageSEO from '../shared/components/PageSEO';

const MONTH_NAMES = { '01':'Jan','02':'Feb','03':'Mar','04':'Apr','05':'May','06':'Jun','07':'Jul','08':'Aug','09':'Sep','10':'Oct','11':'Nov','12':'Dec' };

function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return d.getUTCFullYear() + '-W' + String(weekNo).padStart(2, '0');
}

function fmtPnl(v) { return (v >= 0 ? '+' : '') + '$' + Math.abs(v).toLocaleString(); }

export default function MonthlyPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('heatmap'); // 'heatmap' | 'table'

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'pick_outcomes'));
        const all = snap.docs.map(d => d.data());

        // Build weeks
        const weekMap = {};
        for (const p of all) {
          if (!weekMap[p.weekId]) weekMap[p.weekId] = { weekId: p.weekId, weekStart: p.weekStart, weekEnd: p.weekEnd, picks: [] };
          weekMap[p.weekId].picks.push(p);
        }
        const weeks = Object.values(weekMap).sort((a, b) => a.weekId.localeCompare(b.weekId)).map(w => {
          const wins = w.picks.filter(p => p.outcome === 'WIN').length;
          const netPnl = w.picks.reduce((s, p) => s + (p.actualPnl || 0), 0);
          return { ...w, weekStats: { total: w.picks.length, wins, netPnl, winRate: Math.round((wins / w.picks.length) * 100) } };
        });

        // Cumulative P&L for chart
        let cumPnl = 0;
        const chartPoints = weeks.map(w => {
          cumPnl += w.weekStats.netPnl;
          return { label: w.weekId.replace('2026-', ''), cumPnl, weekId: w.weekId };
        });

        // Build months
        const monthGroupMap = {};
        for (const p of all) {
          const m = p.weekStart?.slice(0, 7);
          if (!m) continue;
          if (!monthGroupMap[m]) monthGroupMap[m] = { month: m, weeks: {} };
          if (!monthGroupMap[m].weeks[p.weekId]) monthGroupMap[m].weeks[p.weekId] = { weekId: p.weekId, weekStart: p.weekStart, picks: [] };
          monthGroupMap[m].weeks[p.weekId].picks.push(p);
        }
        const months = Object.values(monthGroupMap).sort((a, b) => a.month.localeCompare(b.month)).map(m => {
          const weeksArr = Object.values(m.weeks).sort((a, b) => a.weekId.localeCompare(b.weekId));
          const allPicks = weeksArr.flatMap(w => w.picks);
          const wins = allPicks.filter(p => p.outcome === 'WIN').length;
          const netPnl = allPicks.reduce((s, p) => s + (p.actualPnl || 0), 0);
          return {
            month: m.month,
            weeks: weeksArr.map(w => {
              const ww = w.picks.filter(p => p.outcome === 'WIN').length;
              return { weekId: w.weekId, total: w.picks.length, wins: ww, winRate: Math.round((ww / w.picks.length) * 100) };
            }),
            monthStats: { totalPicks: allPicks.length, wins, netPnl, winRate: Math.round((wins / allPicks.length) * 100) },
          };
        });

        // MTD
        const curMonth = new Date().toISOString().slice(0, 7);
        const mtdMonth = months.find(m => m.month === curMonth);
        const mtdPnl = mtdMonth ? mtdMonth.monthStats.netPnl : 0;

        // Best month
        let bestMonth = months[0];
        for (const m of months) { if (m.monthStats.netPnl > (bestMonth?.monthStats.netPnl || -Infinity)) bestMonth = m; }

        // Top strategy
        const stratMap = {};
        for (const w of weeks) {
          for (const p of w.picks) {
            if (!stratMap[p.strategy]) stratMap[p.strategy] = { wins: 0, total: 0 };
            stratMap[p.strategy].total++;
            if (p.outcome === 'WIN') stratMap[p.strategy].wins++;
          }
        }
        let topStrat = 'Iron Condor', topRate = 0;
        for (const [s, d] of Object.entries(stratMap)) {
          const rate = d.total >= 3 ? d.wins / d.total : 0;
          if (rate > topRate) { topRate = rate; topStrat = s; }
        }

        // Heatmap data
        const heatMonths = {};
        for (const w of weeks) {
          const m = w.weekStart?.slice(0, 7);
          if (!m) continue;
          if (!heatMonths[m]) heatMonths[m] = [];
          heatMonths[m].push(w);
        }

        setData({ chartPoints, totalPnl: cumPnl, mtdPnl, bestMonth, topStrat, heatMonths, curMonth });
      } catch (err) {
        console.error('Error loading monthly:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '60px 2rem', textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: '#6b6b60', fontFamily: "'Space Mono', monospace" }}>Loading monthly view...</div>
      </div>
    );
  }

  if (!data) return null;

  const { chartPoints, totalPnl, mtdPnl, bestMonth, topStrat, heatMonths, curMonth } = data;
  const liveWeek = getISOWeek(new Date());
  const bestMonthLabel = bestMonth ? new Date(bestMonth.month + '-15').toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '--';
  const curMonthLabel = new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 2rem 60px' }}>
      <PageSEO title="Monthly Performance — NewLeaf Picks Track Record" description="Monthly performance summary of NewLeaf System's options picks including cumulative returns, strategy breakdown, and win rate trends." path="/picks/monthly" />
      {/* Header */}
      <div style={{ marginBottom: 8 }}>
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: '.14em', textTransform: 'uppercase', color: '#C9A96E', marginBottom: 8 }}>
          Picks Performance
        </div>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 400, color: '#0B2D23' }}>
          Monthly <em style={{ fontStyle: 'italic', color: '#C9A96E' }}>Ledger</em>
        </h1>
      </div>

      {/* Sub-nav */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(15,61,46,.12)', marginBottom: 28 }}>
        <Link to="/picks" style={tabStyle(false)}>This week</Link>
        <Link to="/picks/recap" style={tabStyle(false)}>Weekly recap</Link>
        <Link to="/picks/monthly" style={tabStyle(true)}>Monthly ledger</Link>
      </div>

      {/* Equity curve */}
      <div style={{ background: '#fff', border: '1px solid rgba(15,61,46,.12)', borderRadius: 12, padding: '22px 24px', marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 13, color: '#6b6b60' }}>Cumulative P&L &mdash; 1 contract per pick</span>
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 24, fontWeight: 700, color: totalPnl >= 0 ? '#1D9E75' : '#E24B4A' }}>
            {fmtPnl(totalPnl)}
          </span>
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartPoints} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <defs>
              <linearGradient id="pnlGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1D9E75" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#1D9E75" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e8e6e1" />
            <XAxis dataKey="label" tick={{ fontFamily: "'Space Mono', monospace", fontSize: 9, fill: '#6b6b60' }} />
            <YAxis tick={{ fontFamily: "'Space Mono', monospace", fontSize: 9, fill: '#6b6b60' }} tickFormatter={v => `$${v}`} />
            <Tooltip formatter={(v) => [`$${v.toLocaleString()}`, 'Cumulative P&L']} labelStyle={{ fontWeight: 700 }} />
            <Area type="monotone" dataKey="cumPnl" stroke="#1D9E75" strokeWidth={2.5} fill="url(#pnlGrad)" dot={{ r: 3.5, fill: '#1D9E75', stroke: '#fff', strokeWidth: 1.5 }} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 32 }}>
        <StatCard label={curMonthLabel} value={fmtPnl(mtdPnl)} sub="month to date" valueColor={mtdPnl >= 0 ? '#1D9E75' : '#E24B4A'} />
        <StatCard label="Best Month" value={bestMonthLabel} sub={bestMonth ? `${fmtPnl(bestMonth.monthStats.netPnl)} · ${bestMonth.monthStats.winRate}% win rate` : ''} valueColor="#0B0F14" />
        <StatCard label="Strategy Breakdown" value={topStrat} sub="top performer this quarter" valueColor="#0B0F14" />
      </div>

      {/* Heatmap / Table toggle */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: '.1em', textTransform: 'uppercase', color: '#6b6b60' }}>
            Performance {viewMode === 'heatmap' ? 'Heatmap' : 'Table'} &mdash; By Week
          </div>
          <div style={{ display: 'flex', gap: 0 }}>
            <button onClick={() => setViewMode('heatmap')} style={toggleBtnStyle(viewMode === 'heatmap', 'left')}>Heatmap</button>
            <button onClick={() => setViewMode('table')} style={toggleBtnStyle(viewMode === 'table', 'right')}>Table</button>
          </div>
        </div>
        {viewMode === 'heatmap' ? (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '60px repeat(5, 1fr)', gap: 6 }}>
              <div />
              {[1,2,3,4,5].map(n => (
                <div key={n} style={{ textAlign: 'center', fontFamily: "'Space Mono', monospace", fontSize: 10, color: '#6b6b60', fontWeight: 700, padding: '6px 0' }}>W{n}</div>
              ))}
              {Object.keys(heatMonths).sort().map(m => {
                const mLabel = MONTH_NAMES[m.slice(5, 7)] || m;
                const mWeeks = heatMonths[m];
                return [
                  <div key={`${m}-label`} style={{ fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 700, color: '#0B0F14', display: 'flex', alignItems: 'center' }}>{mLabel}</div>,
                  ...[0,1,2,3,4].map(col => {
                    const w = mWeeks[col];
                    if (!w) {
                      if (col === mWeeks.length && m === curMonth) return <HeatCell key={`${m}-${col}`} text="Live" tier="live" />;
                      return <HeatCell key={`${m}-${col}`} text="--" tier="empty" />;
                    }
                    const wr = w.weekStats.winRate;
                    const tier = w.weekId === liveWeek ? 'live' : wr >= 80 ? 'tier-1' : wr >= 60 ? 'tier-2' : wr >= 40 ? 'tier-3' : 'tier-4';
                    return <HeatCell key={`${m}-${col}`} text={`${w.weekStats.wins}/${w.weekStats.total}`} tier={tier} href={`/picks/${w.weekId}`} />;
                  }),
                ];
              })}
            </div>
            <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
              <LegendItem color="#9FE1CB" label="80-100%" />
              <LegendItem color="#C0DD97" label="60-79%" />
              <LegendItem color="#FAC775" label="40-59%" />
              <LegendItem color="#F7C1C1" label="Under 40%" />
            </div>
          </>
        ) : (
          /* Table view */
          <div style={{ background: '#fff', border: '1px solid rgba(15,61,46,.12)', borderRadius: 12, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#0B2D23' }}>
                  <th style={thStyle}>Month</th>
                  <th style={thStyle}>Week</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Picks</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Wins</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Win Rate</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>P&L</th>
                </tr>
              </thead>
              <tbody>
                {Object.keys(heatMonths).sort().map(m => {
                  const mLabel = MONTH_NAMES[m.slice(5, 7)] || m;
                  const mWeeks = heatMonths[m];
                  const mPnl = mWeeks.reduce((s, w) => s + w.weekStats.netPnl, 0);
                  const mWins = mWeeks.reduce((s, w) => s + w.weekStats.wins, 0);
                  const mTotal = mWeeks.reduce((s, w) => s + w.weekStats.total, 0);
                  return [
                    ...mWeeks.map((w, i) => (
                      <tr key={w.weekId} style={{ borderBottom: '1px solid rgba(15,61,46,.06)' }}>
                        {i === 0 && <td rowSpan={mWeeks.length + 1} style={{ padding: '10px 14px', fontWeight: 700, verticalAlign: 'top', borderRight: '1px solid rgba(15,61,46,.06)' }}>{mLabel}</td>}
                        <td style={{ padding: '10px 14px' }}>
                          <Link to={`/picks/${w.weekId}`} style={{ color: '#0B2D23', textDecoration: 'none', fontWeight: 600 }}>{w.weekId}</Link>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>{w.weekStats.total}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>{w.weekStats.wins}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>{w.weekStats.winRate}%</td>
                        <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: "'Space Mono', monospace", fontWeight: 700, color: w.weekStats.netPnl >= 0 ? '#1D9E75' : '#E24B4A' }}>
                          {fmtPnl(w.weekStats.netPnl)}
                        </td>
                      </tr>
                    )),
                    <tr key={`${m}-total`} style={{ background: 'rgba(15,61,46,.03)', borderBottom: '2px solid rgba(15,61,46,.12)' }}>
                      <td style={{ padding: '10px 14px', fontWeight: 700, fontSize: 11, textTransform: 'uppercase', color: '#6b6b60' }}>Month Total</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700 }}>{mTotal}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700 }}>{mWins}</td>
                      <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700 }}>{mTotal ? Math.round((mWins / mTotal) * 100) : 0}%</td>
                      <td style={{ padding: '10px 14px', textAlign: 'right', fontFamily: "'Space Mono', monospace", fontWeight: 700, color: mPnl >= 0 ? '#1D9E75' : '#E24B4A' }}>
                        {fmtPnl(mPnl)}
                      </td>
                    </tr>,
                  ];
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function toggleBtnStyle(active, side) {
  return {
    fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: '.08em', textTransform: 'uppercase',
    padding: '8px 16px', border: '1px solid rgba(15,61,46,.12)', cursor: 'pointer', transition: 'all .15s',
    color: active ? '#fff' : '#6b6b60',
    background: active ? '#0B2D23' : '#fff',
    borderColor: active ? '#0B2D23' : 'rgba(15,61,46,.12)',
    borderRadius: side === 'left' ? '6px 0 0 6px' : '0 6px 6px 0',
  };
}

const thStyle = {
  padding: '12px 14px', textAlign: 'left',
  fontFamily: "'Space Mono', monospace", fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase',
  color: '#C9A96E', fontWeight: 700, whiteSpace: 'nowrap',
};

function tabStyle(active) {
  return {
    fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 600,
    color: active ? '#0B2D23' : '#6b6b60', textDecoration: 'none',
    padding: '12px 20px', borderBottom: active ? '2px solid #0B2D23' : '2px solid transparent',
  };
}

function StatCard({ label, value, sub, valueColor }) {
  return (
    <div style={{ background: '#fff', border: '1px solid rgba(15,61,46,.12)', borderRadius: 12, padding: 22 }}>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: '#6b6b60', marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 24, fontWeight: 700, color: valueColor, marginBottom: 4 }}>{value}</div>
      <div style={{ fontSize: 12, color: '#6b6b60' }}>{sub}</div>
    </div>
  );
}

const HEAT_COLORS = {
  'tier-1': '#9FE1CB', 'tier-2': '#C0DD97', 'tier-3': '#FAC775', 'tier-4': '#F7C1C1',
  'live': '#0B2D23', 'empty': 'transparent',
};

function HeatCell({ text, tier, href }) {
  const bg = HEAT_COLORS[tier] || 'transparent';
  const color = tier === 'live' ? '#fff' : tier === 'empty' ? '#ccc' : '#0B0F14';
  const style = {
    background: bg, color, borderRadius: 8, padding: '10px 0', textAlign: 'center',
    fontFamily: "'Space Mono', monospace", fontSize: 12, fontWeight: 600,
    cursor: href ? 'pointer' : 'default',
    border: tier === 'empty' ? '1px solid #e8e6e1' : 'none',
  };
  if (href) {
    return <Link to={href} style={{ ...style, textDecoration: 'none' }}>{text}</Link>;
  }
  return <div style={style}>{text}</div>;
}

function LegendItem({ color, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#6b6b60' }}>
      <div style={{ width: 10, height: 10, borderRadius: 3, background: color }} />
      {label}
    </div>
  );
}
