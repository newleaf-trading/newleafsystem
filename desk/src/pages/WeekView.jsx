import { useState } from 'react';
import { useWeeklyPicks, getISOWeek } from '../hooks/useWeeklyPicks';
import { PickCard } from '../components/PickCard';

export function WeekView() {
  const [weekId, setWeekId] = useState(getISOWeek());
  const { picks, weekData, loading, error, reload } = useWeeklyPicks(weekId);

  // Generate recent weeks for navigation
  const weeks = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i * 7);
    weeks.push(getISOWeek(d));
  }
  const uniqueWeeks = [...new Set(weeks)];

  return (
    <div>
      <div className="dk-week-header">
        <h1>Publishing Dashboard</h1>
        <p>Manage picks, assets, and social media content</p>
      </div>

      {/* Week selector */}
      <div className="dk-week-nav">
        {uniqueWeeks.map(w => (
          <button
            key={w}
            className={`dk-week-selector ${w === weekId ? 'active' : ''}`}
            onClick={() => setWeekId(w)}
          >
            {w}
          </button>
        ))}
        <button className="dk-btn dk-btn-sm" onClick={reload} style={{ marginLeft: 8 }}>
          Refresh
        </button>
      </div>

      {/* Stats bar */}
      {weekData && (
        <div style={{
          display: 'flex', gap: 20, marginBottom: 20, padding: '12px 16px',
          background: '#fff', borderRadius: 10, border: '1px solid var(--border)',
          fontSize: 13
        }}>
          <span><strong>{picks.length}</strong> picks</span>
          <span><strong>{picks.filter(p => p.hasAnalysis).length}</strong> with analysis</span>
          <span>Status: <strong>{weekData.status || 'unknown'}</strong></span>
          {weekData.dateRange && <span>{weekData.dateRange}</span>}
        </div>
      )}

      {loading && <div className="dk-loading">Loading picks...</div>}
      {error && <div style={{ color: '#dc2626', fontSize: 13, margin: '12px 0' }}>Error: {error}</div>}

      {!loading && picks.length === 0 && (
        <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af', fontSize: 14 }}>
          No picks published for {weekId}.
        </div>
      )}

      {/* Pick cards grid */}
      <div className="dk-picks-grid">
        {picks.map(pick => (
          <PickCard key={pick.tileId} pick={pick} />
        ))}
      </div>
    </div>
  );
}
