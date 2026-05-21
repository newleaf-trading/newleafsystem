import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';

export default function WeekViewerPage() {
  const { weekId } = useParams();
  const [picks, setPicks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!weekId) return;
    (async () => {
      try {
        const snap = await getDocs(
          query(collection(db, 'pick_outcomes'), where('weekId', '==', weekId))
        );
        setPicks(snap.docs.map(d => d.data()));
      } catch (err) {
        console.error('Error loading week:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, [weekId]);

  if (loading) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '60px 2rem', textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: '#6b6b60', fontFamily: "'Space Mono', monospace" }}>Loading week {weekId}...</div>
      </div>
    );
  }

  const wins = picks.filter(p => p.outcome === 'WIN').length;
  const losses = picks.filter(p => p.outcome === 'LOSS').length;
  const partials = picks.filter(p => p.outcome === 'PARTIAL').length;
  const netPnl = picks.reduce((s, p) => s + (p.actualPnl || 0), 0);
  const winRate = picks.length ? Math.round((wins / picks.length) * 100) : 0;
  const dateRange = picks.length ? `${picks[0].weekStart} — ${picks[0].weekEnd}` : '';

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 2rem 60px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Link to="/picks/recap" style={{ fontSize: 12, color: '#C9A96E', textDecoration: 'none', fontWeight: 600 }}>
          &larr; Back to Recap
        </Link>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 400, color: '#0B2D23', marginTop: 8 }}>
          Week {weekId}
        </h1>
        <p style={{ fontSize: 13, color: '#6b6b60', marginTop: 6 }}>{dateRange}</p>
        {picks[0]?.marketNote && (
          <p style={{ fontSize: 13, color: '#3d3d35', marginTop: 4, fontStyle: 'italic' }}>{picks[0].marketNote}</p>
        )}
      </div>

      {/* Summary strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
        <SummaryCard label="Win Rate" value={`${winRate}%`} sub={`${wins}W / ${losses}L / ${partials}P`} />
        <SummaryCard label="Net P&L" value={`${netPnl >= 0 ? '+' : ''}$${netPnl.toLocaleString()}`} isPositive={netPnl >= 0} />
        <SummaryCard label="Total Picks" value={picks.length} />
        <SummaryCard label="Wins" value={wins} />
      </div>

      {/* Picks grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {picks.map((p, i) => (
          <div key={i} style={{
            background: '#fff', border: '1px solid rgba(15,61,46,.12)',
            borderRadius: 12, padding: 22,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 18, fontWeight: 700, color: '#0B2D23' }}>
                {p.ticker}
              </span>
              {p.outcome && (
                <span style={{
                  fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 700,
                  padding: '4px 12px', borderRadius: 20,
                  background: p.outcome === 'WIN' ? '#E1F5EE' : p.outcome === 'PARTIAL' ? '#FAEEDA' : '#FCEBEB',
                  color: p.outcome === 'WIN' ? '#0F6E56' : p.outcome === 'PARTIAL' ? '#854F0B' : '#A32D2D',
                }}>
                  {p.outcome}
                </span>
              )}
            </div>
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, color: '#0B2D23', marginBottom: 6 }}>
              {p.strategy}
            </div>
            <div style={{
              fontFamily: "'Space Mono', monospace", fontSize: 9, letterSpacing: '.08em',
              textTransform: 'uppercase', color: p.sentiment === 'BULLISH' ? '#1D9E75' : p.sentiment === 'BEARISH' ? '#E24B4A' : '#C9A96E',
              marginBottom: 12,
            }}>
              {p.sentiment}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, fontSize: 12 }}>
              <div><span style={{ color: '#6b6b60' }}>Entry:</span> <strong>${p.spotAtEntry?.toFixed(2)}</strong></div>
              <div><span style={{ color: '#6b6b60' }}>Expiry:</span> <strong>${p.spotAtExpiry?.toFixed(2)}</strong></div>
              <div><span style={{ color: '#6b6b60' }}>Credit:</span> <strong>${p.netCredit?.toFixed(2)}</strong></div>
              <div>
                <span style={{ color: '#6b6b60' }}>P&L:</span>{' '}
                <strong style={{ color: (p.actualPnl || 0) >= 0 ? '#1D9E75' : '#E24B4A' }}>
                  {(p.actualPnl || 0) >= 0 ? '+' : ''}${p.actualPnl?.toFixed(0) || '0'}
                </strong>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, sub, isPositive }) {
  return (
    <div style={{ background: '#fff', border: '1px solid rgba(15,61,46,.12)', borderRadius: 12, padding: '16px 18px' }}>
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
