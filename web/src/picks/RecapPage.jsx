import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import PageSEO from '../shared/components/PageSEO';

export default function RecapPage() {
  const [weeks, setWeeks] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDocs(collection(db, 'pick_outcomes'));
        const all = snap.docs.map(d => d.data());

        // Build weeks
        const weekMap = {};
        for (const p of all) {
          if (!weekMap[p.weekId]) weekMap[p.weekId] = {
            weekId: p.weekId, weekStart: p.weekStart, weekEnd: p.weekEnd,
            marketNote: p.marketNote, picks: [],
          };
          weekMap[p.weekId].picks.push(p);
        }

        const weeksArr = Object.values(weekMap)
          .sort((a, b) => b.weekId.localeCompare(a.weekId))
          .map(w => {
            const wins = w.picks.filter(p => p.outcome === 'WIN').length;
            const partials = w.picks.filter(p => p.outcome === 'PARTIAL').length;
            const losses = w.picks.filter(p => p.outcome === 'LOSS').length;
            const netPnl = w.picks.reduce((s, p) => s + (p.actualPnl || 0), 0);
            return {
              ...w,
              weekStats: { total: w.picks.length, wins, partials, losses, netPnl, winRate: Math.round((wins / w.picks.length) * 100) },
            };
          });

        // Summary
        const totalPicks = all.length;
        const totalWins = all.filter(p => p.outcome === 'WIN').length;
        const totalPnl = all.reduce((s, p) => s + (p.actualPnl || 0), 0);

        setSummary({
          totalPicks,
          totalWins,
          winRate: totalPicks ? Math.round((totalWins / totalPicks) * 100) : 0,
          totalPnl,
          weeksTracked: weeksArr.length,
        });

        setWeeks(weeksArr);
      } catch (err) {
        console.error('Error loading recap:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '60px 2rem', textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: '#6b6b60', fontFamily: "'Space Mono', monospace" }}>Loading recap...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 2rem 60px' }}>
      <PageSEO title="Weekly Recap — Picks Performance Review" description="Review closed options picks with detailed P&L breakdown, win/loss analysis, and strategy performance metrics from NewLeaf System's weekly recommendations." path="/picks/recap" />
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          fontFamily: "'Space Mono', monospace", fontSize: 10,
          letterSpacing: '.14em', textTransform: 'uppercase', color: '#C9A96E', marginBottom: 8,
        }}>Performance Recap</div>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 400, color: '#0B2D23' }}>
          Weekly <em style={{ fontStyle: 'italic', color: '#C9A96E' }}>Recap</em>
        </h1>
      </div>

      {/* Sub-navigation */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(15,61,46,.12)', marginBottom: 28 }}>
        <Link to="/picks" style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 600, color: '#6b6b60', textDecoration: 'none', padding: '12px 20px', borderBottom: '2px solid transparent' }}>This Week</Link>
        <Link to="/picks/recap" style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 600, color: '#0B2D23', textDecoration: 'none', padding: '12px 20px', borderBottom: '2px solid #0B2D23' }}>Recap</Link>
        <Link to="/picks/monthly" style={{ fontFamily: "'Inter', sans-serif", fontSize: 13, fontWeight: 600, color: '#6b6b60', textDecoration: 'none', padding: '12px 20px', borderBottom: '2px solid transparent' }}>Monthly</Link>
      </div>

      {/* Summary strip */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 28 }}>
          <StatCard label="Win Rate" value={`${summary.winRate}%`} sub={`${summary.totalWins} / ${summary.totalPicks}`} />
          <StatCard label="Total P&L" value={`$${summary.totalPnl.toLocaleString()}`} isPositive={summary.totalPnl >= 0} />
          <StatCard label="Total Picks" value={summary.totalPicks} />
          <StatCard label="Weeks Tracked" value={summary.weeksTracked} />
        </div>
      )}

      {/* Week-by-week results */}
      {weeks.map(w => (
        <div key={w.weekId} style={{
          background: '#fff', border: '1px solid rgba(15,61,46,.12)',
          borderRadius: 12, padding: 22, marginBottom: 16,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <Link to={`/picks/${w.weekId}`} style={{
                fontFamily: "'Space Mono', monospace", fontSize: 16, fontWeight: 700,
                color: '#0B2D23', textDecoration: 'none',
              }}>
                {w.weekId}
              </Link>
              <div style={{ fontSize: 12, color: '#6b6b60', marginTop: 2 }}>{w.weekStart} — {w.weekEnd}</div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{
                fontFamily: "'Space Mono', monospace", fontSize: 18, fontWeight: 700,
                color: w.weekStats.netPnl >= 0 ? '#1D9E75' : '#E24B4A',
              }}>
                {w.weekStats.netPnl >= 0 ? '+' : ''}${w.weekStats.netPnl.toLocaleString()}
              </div>
              <div style={{ fontSize: 11, color: '#6b6b60' }}>
                {w.weekStats.winRate}% win rate &middot; {w.weekStats.total} picks
              </div>
            </div>
          </div>

          {/* Individual picks */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 8 }}>
            {w.picks.map((p, i) => (
              <div key={i} style={{
                padding: '8px 12px', borderRadius: 8,
                background: p.outcome === 'WIN' ? '#E1F5EE' : p.outcome === 'PARTIAL' ? '#FAEEDA' : p.outcome === 'LOSS' ? '#FCEBEB' : '#f5f5f0',
                fontSize: 12,
              }}>
                <strong>{p.ticker}</strong> &middot; {p.strategy}
                <div style={{ fontSize: 11, color: '#3d3d35', marginTop: 2 }}>
                  {p.outcome || 'PENDING'} {p.actualPnl != null ? `$${p.actualPnl}` : ''}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatCard({ label, value, sub, isPositive }) {
  return (
    <div style={{ background: '#fff', border: '1px solid rgba(15,61,46,.12)', borderRadius: 12, padding: 18 }}>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: '#6b6b60', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{
        fontFamily: "'Space Mono', monospace", fontSize: 22, fontWeight: 700,
        color: isPositive === true ? '#1D9E75' : isPositive === false ? '#E24B4A' : '#0B0F14',
      }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11, color: '#6b6b60', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
