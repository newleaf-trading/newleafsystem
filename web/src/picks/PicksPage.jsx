import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { collection, query, where, getDocs, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import PageSEO from '../shared/components/PageSEO';
import { usePicksNarrative } from './hooks/usePicksNarrative';

export default function PicksPage() {
  const [week, setWeek] = useState(null);
  const [perf, setPerf] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Get most recent weeklyPicks document
        const [weekSnap, outcomeSnap] = await Promise.all([
          getDocs(query(collection(db, 'weeklyPicks'), orderBy('weekId', 'desc'), limit(1))),
          getDocs(collection(db, 'pick_outcomes')),
        ]);
        if (!weekSnap.empty) {
          setWeek({ id: weekSnap.docs[0].id, ...weekSnap.docs[0].data() });
        }
        // Build performance summary
        if (!outcomeSnap.empty) {
          const all = outcomeSnap.docs.map(d => d.data());
          const total = all.length;
          const wins = all.filter(p => p.outcome === 'WIN').length;
          const pnl = all.reduce((s, p) => s + (p.actualPnl || 0), 0);
          // Best week
          const weekMap = {};
          for (const p of all) {
            if (!weekMap[p.weekId]) weekMap[p.weekId] = { total: 0, wins: 0 };
            weekMap[p.weekId].total++;
            if (p.outcome === 'WIN') weekMap[p.weekId].wins++;
          }
          let bestWeek = null, bestRate = 0;
          for (const [wk, s] of Object.entries(weekMap)) {
            const rate = s.wins / s.total;
            if (rate > bestRate) { bestRate = rate; bestWeek = wk; }
          }
          setPerf({
            winRate: total ? Math.round((wins / total) * 100) : 0,
            total, wins, pnl,
            weeksTracked: Object.keys(weekMap).length,
            bestWeek, bestWeekWins: weekMap[bestWeek]?.wins, bestWeekTotal: weekMap[bestWeek]?.total,
            bestWeekRate: Math.round(bestRate * 100),
          });
        }
      } catch (err) {
        console.error('Error loading picks:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  // Enrich picks with sentiment from tiles if missing (hooks must be before early returns)
  const [enrichedPicks, setEnrichedPicks] = useState([]);
  const weekId = week?.id;
  useEffect(() => {
    if (!week?.picks) return;
    const enrich = async () => {
      const enriched = await Promise.all(week.picks.map(async (pick) => {
        if (pick.sentiment) return pick;
        if (!pick.tileId) return pick;
        try {
          const tileSnap = await getDoc(doc(db, 'tiles', pick.tileId));
          if (tileSnap.exists() && tileSnap.data().sentiment) {
            return { ...pick, sentiment: tileSnap.data().sentiment };
          }
        } catch {}
        return pick;
      }));
      setEnrichedPicks(enriched);
    };
    enrich();
  }, [weekId]);
  const picks = enrichedPicks.length > 0 ? enrichedPicks : (week?.picks || []);

  const { narrative, marketBias, keyThemes, loading: narrativeLoading, fetchNarrative } = usePicksNarrative();

  useEffect(() => {
    if (week?.picks?.length && week.id) {
      fetchNarrative({ picks: week.picks, weekId: week.id, theme: week.theme });
    }
  }, [week?.id]);

  if (loading) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '60px 2rem', textAlign: 'center' }}>
        <div style={{ fontSize: 13, color: '#6b6b60', fontFamily: "'Space Mono', monospace" }}>Loading picks...</div>
      </div>
    );
  }

  if (!week) {
    return (
      <div style={{ maxWidth: 960, margin: '0 auto', padding: '60px 2rem', textAlign: 'center' }}>
        <h2 style={{ fontFamily: "'Playfair Display', serif", color: '#0B2D23' }}>No picks available yet</h2>
        <p style={{ color: '#6b6b60', marginTop: 8 }}>Check back soon for this week's options strategies.</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '32px 2rem 60px' }}>
      <PageSEO title="This Week's Picks — NewLeaf Options Recommendations" description="View this week's AI-curated options trade recommendations. Each pick is scored across implied volatility, gamma positioning, and technical analysis with full entry/exit rules." path="/picks" />
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{
          fontFamily: "'Space Mono', monospace", fontSize: 10,
          letterSpacing: '.14em', textTransform: 'uppercase', color: '#C9A96E', marginBottom: 8,
        }}>
          Picks Performance
        </div>
        <h1 style={{ fontFamily: "'Playfair Display', serif", fontSize: 'clamp(24px, 3.5vw, 36px)', fontWeight: 400, color: '#0B2D23', lineHeight: 1.15 }}>
          This Week's <em style={{ fontStyle: 'italic', color: '#C9A96E' }}>Picks</em>
        </h1>
        <p style={{ fontSize: 13, color: '#6b6b60', marginTop: 6 }}>
          {week.dateRange} · {picks.length} strategies curated by the NewLeaf scoring engine
        </p>
      </div>



      {/* Performance summary strip */}
      {perf && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 24 }}>
          <SummaryCard label="All-Time Win Rate" value={`${perf.winRate}%`} sub={`${perf.wins} of ${perf.total} closed picks`} valueColor="#1D9E75" />
          <SummaryCard label="Total Picks Closed" value={perf.total} sub={`across ${perf.weeksTracked} weeks`} />
          <SummaryCard label="Cumulative P&L" value={`${perf.pnl >= 0 ? '+' : ''}$${Math.abs(perf.pnl).toLocaleString()}`} sub="1 contract per pick" valueColor={perf.pnl >= 0 ? '#1D9E75' : '#E24B4A'} />
          <SummaryCard label="Best Week" value={perf.bestWeek?.replace('2026-', '')} sub={`${perf.bestWeekWins}/${perf.bestWeekTotal} wins · ${perf.bestWeekRate}%`} />
        </div>
      )}

      {/* Theme banner */}
      {week.theme && (
        <div style={{
          padding: '14px 24px', background: '#0B2D23', borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, marginBottom: 24,
        }}>
          <span style={{ fontSize: 13, color: 'rgba(255,255,255,.7)' }}>📊 {week.theme}</span>
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 10, color: '#C9A96E', letterSpacing: '.06em', whiteSpace: 'nowrap' }}>
            {week.weekId}
          </span>
        </div>
      )}

      {/* AI Narrative */}
      <div style={{
        background: '#fff', borderRadius: 8,
        borderTop: '1px solid rgba(15,61,46,.12)',
        borderRight: '1px solid rgba(15,61,46,.12)',
        borderBottom: '1px solid rgba(15,61,46,.12)',
        borderLeft: '4px solid #0F9E78',
        padding: '20px 24px', marginBottom: 24,
        fontFamily: "'Inter', sans-serif",
      }}>
        {!narrative && !narrativeLoading && (
          <button
            onClick={() => fetchNarrative({ picks: week.picks, weekId: week.id, theme: week.theme })}
            style={{
              fontFamily: "'Space Mono', monospace", fontSize: 11, letterSpacing: '.06em',
              padding: '8px 20px', borderRadius: 6,
              background: '#0B2D23', color: '#fff', border: 'none', cursor: 'pointer',
              transition: 'opacity .15s',
            }}
            onMouseOver={e => e.currentTarget.style.opacity = '0.85'}
            onMouseOut={e => e.currentTarget.style.opacity = '1'}
          >
            Generate AI Narrative
          </button>
        )}
        {narrativeLoading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{
              display: 'inline-block', width: 14, height: 14, border: '2px solid #0F9E78',
              borderTopColor: 'transparent', borderRadius: '50%',
              animation: 'nlSpin .8s linear infinite',
            }} />
            <span style={{ fontSize: 12, color: '#6b6b60' }}>Generating narrative...</span>
            <style>{`@keyframes nlSpin { to { transform: rotate(360deg) } }`}</style>
          </div>
        )}
        {narrative && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <span style={{
                fontFamily: "'Space Mono', monospace", fontSize: 9, letterSpacing: '.08em',
                textTransform: 'uppercase', fontWeight: 700,
                padding: '3px 12px', borderRadius: 20,
                background: marketBias === 'bullish' ? 'rgba(29,158,117,.12)' : marketBias === 'bearish' ? 'rgba(226,75,74,.12)' : 'rgba(201,169,110,.15)',
                color: marketBias === 'bullish' ? '#1D9E75' : marketBias === 'bearish' ? '#E24B4A' : '#A17C3B',
                border: `1px solid ${marketBias === 'bullish' ? 'rgba(29,158,117,.25)' : marketBias === 'bearish' ? 'rgba(226,75,74,.25)' : 'rgba(201,169,110,.3)'}`,
              }}>
                {marketBias || 'neutral'}
              </span>
              <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, letterSpacing: '.06em', color: '#6b6b60', textTransform: 'uppercase' }}>
                Market Bias
              </span>
            </div>
            <p style={{ fontSize: 13.5, lineHeight: 1.7, color: '#3d3d35', margin: 0 }}>
              {narrative}
            </p>
            {keyThemes.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 14 }}>
                {keyThemes.map((theme, i) => (
                  <span key={i} style={{
                    fontFamily: "'Space Mono', monospace", fontSize: 9, letterSpacing: '.04em',
                    padding: '4px 12px', borderRadius: 20,
                    background: '#f5f5f0', color: '#3d3d35', border: '1px solid rgba(15,61,46,.1)',
                  }}>
                    {theme}
                  </span>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Picks grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {picks.map((pick, i) => (
          <div key={i} style={{
            background: '#fff', border: '1px solid rgba(15,61,46,.12)',
            borderRadius: 12, padding: 22, transition: 'all .2s',
          }}>
            {/* Header: symbol + price + direction badge */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 18, fontWeight: 700, color: '#0B2D23' }}>
                  {pick.symbol}
                </span>
                {pick.price != null && (
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#6b6b60' }}>
                    ${typeof pick.price === 'number' ? pick.price.toFixed(2) : pick.price}
                  </span>
                )}
                {pick.ivContext?.ivRank != null && (
                  <span style={{
                    fontFamily: "'Space Mono', monospace", fontSize: 8, letterSpacing: '.06em',
                    padding: '2px 8px', borderRadius: 12, fontWeight: 700,
                    background: pick.ivContext.ivRank > 50 ? '#E1F5EE' : pick.ivContext.ivRank > 30 ? '#FAEEDA' : '#f5f5f0',
                    color: pick.ivContext.ivRank > 50 ? '#0F6E56' : pick.ivContext.ivRank > 30 ? '#854F0B' : '#6b6b60',
                  }}>
                    IV {pick.ivContext.ivRank}
                  </span>
                )}
                {pick.sentiment && (
                  <span style={{
                    fontFamily: "'Space Mono', monospace", fontSize: 8, letterSpacing: '.06em',
                    padding: '2px 8px', borderRadius: 12, fontWeight: 700,
                    display: 'inline-flex', alignItems: 'center', gap: 4,
                    background: pick.sentiment.label === 'bullish' ? 'rgba(29,158,117,.1)' : pick.sentiment.label === 'bearish' ? 'rgba(226,75,74,.1)' : 'rgba(156,163,175,.1)',
                    color: pick.sentiment.label === 'bullish' ? '#1D9E75' : pick.sentiment.label === 'bearish' ? '#E24B4A' : '#6b7280',
                    border: `1px solid ${pick.sentiment.label === 'bullish' ? 'rgba(29,158,117,.2)' : pick.sentiment.label === 'bearish' ? 'rgba(226,75,74,.2)' : 'rgba(156,163,175,.2)'}`,
                  }}>
                    <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'currentColor' }} />
                    {pick.sentiment.score} {pick.sentiment.activeEngines ? `(${pick.sentiment.activeEngines} AI)` : ''}
                  </span>
                )}
              </div>
              <span style={{
                fontFamily: "'Space Mono', monospace", fontSize: 9, letterSpacing: '.08em',
                textTransform: 'uppercase', padding: '3px 10px', border: '1px solid',
                borderRadius: 20, fontWeight: 700,
                color: pick.direction === 'BULLISH' || pick.direction === 'bullish' ? '#1D9E75' : pick.direction === 'BEARISH' || pick.direction === 'bearish' ? '#E24B4A' : '#C9A96E',
              }}>
                {pick.direction?.toUpperCase()}
              </span>
            </div>

            {/* Strategy name */}
            <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, color: '#0B2D23', marginBottom: 14 }}>
              {pick.strategy}
            </div>

            {/* Key metrics — matching old layout */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginBottom: 14 }}>
              <div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 8, letterSpacing: '.08em', textTransform: 'uppercase', color: '#6b6b60' }}>Reward : Risk</div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, color: '#3d3d35' }}>
                  {typeof pick.rewardRisk === 'number' ? pick.rewardRisk.toFixed(2) : pick.rewardRisk}×
                </div>
              </div>
              <div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 8, letterSpacing: '.08em', textTransform: 'uppercase', color: '#6b6b60' }}>Win Rate</div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, color: '#3d3d35' }}>
                  {pick.oddsOfProfit != null ? `${pick.oddsOfProfit}%` : '-'}
                </div>
              </div>
              <div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 8, letterSpacing: '.08em', textTransform: 'uppercase', color: '#6b6b60' }}>Max Profit</div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, color: '#3d3d35' }}>
                  ${typeof pick.maxProfit === 'number' ? pick.maxProfit.toFixed(2).replace(/\.00$/, '') : pick.maxProfit}
                </div>
              </div>
              <div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 8, letterSpacing: '.08em', textTransform: 'uppercase', color: '#6b6b60' }}>Expiry</div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, color: '#3d3d35' }}>
                  {pick.expiry || '-'}
                </div>
              </div>
            </div>

            {/* View full analysis link */}
            <div style={{ paddingTop: 10, borderTop: '1px solid rgba(15,61,46,.08)' }}>
              <Link to={`/picks/analysis/${pick.symbol?.toLowerCase()}`} style={{
                fontFamily: "'Space Mono', monospace", fontSize: 10, letterSpacing: '.06em',
                color: '#0B2D23', textDecoration: 'none', fontWeight: 600,
              }}>
                View full analysis →
              </Link>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, sub, valueColor }) {
  return (
    <div style={{ background: '#fff', border: '1px solid rgba(15,61,46,.12)', borderRadius: 12, padding: '16px 18px' }}>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 9, letterSpacing: '.1em', textTransform: 'uppercase', color: '#6b6b60', marginBottom: 6 }}>
        {label}
      </div>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 22, fontWeight: 700, color: valueColor || '#0B0F14' }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontFamily: "'Inter', sans-serif", fontSize: 11, color: '#6b6b60', marginTop: 2 }}>
          {sub}
        </div>
      )}
    </div>
  );
}
