/**
 * /track-record — 90-day historical recommendation transparency page.
 *
 * Every trade recommended on Discover, with outcomes, adjustments, and
 * aggregate statistics. Filters update everything in real time.
 */
import { useState, useMemo, useEffect, useRef } from 'react';
import Highcharts from 'highcharts';
import { TRADES, DATA_SOURCE, DATA_DISCLOSURE } from './tradeData';
import PageSEO from '../../shared/components/PageSEO';

const NAV_ITEMS = [
  { label: 'How We Pick', href: '/how-we-pick' },
  { label: 'How We Manage', href: '/how-we-manage' },
  { label: 'How We Recommend', href: '/how-we-recommend' },
  { label: 'Track Record', href: '/track-record', active: true },
];

const OUTCOME_COLOURS = { WIN: '#0B7A52', PARTIAL: '#B7791F', LOSS: '#C94F4F' };

export function TrackRecordPage() {
  const [outcomeFilter, setOutcomeFilter] = useState('all');
  const [strategyFilter, setStrategyFilter] = useState('all');
  const [dateRange, setDateRange] = useState(90);
  const [selectedTrade, setSelectedTrade] = useState(null);

  // Filter trades
  const filtered = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - dateRange);
    const cutoffStr = cutoff.toISOString().split('T')[0];

    return TRADES.filter(t => {
      if (t.entryDate < cutoffStr) return false;
      if (outcomeFilter !== 'all' && t.outcome !== outcomeFilter) return false;
      if (strategyFilter !== 'all' && t.strategyKey !== strategyFilter) return false;
      return true;
    });
  }, [outcomeFilter, strategyFilter, dateRange]);

  // Compute summary stats from filtered data
  const stats = useMemo(() => {
    const total = filtered.length;
    const wins = filtered.filter(t => t.outcome === 'WIN').length;
    const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
    const avgRoc = total > 0 ? Math.round(filtered.reduce((s, t) => s + t.returnOnCapital, 0) / total * 10) / 10 : 0;
    const pnls = filtered.map(t => t.actualPnl);
    const worstLoss = pnls.length > 0 ? Math.min(...pnls) : 0;
    const bestWin = pnls.length > 0 ? Math.max(...pnls) : 0;
    return { total, wins, winRate, avgRoc, worstLoss, bestWin };
  }, [filtered]);

  // Unique strategies for filter
  const strategies = useMemo(() => {
    const unique = [...new Set(TRADES.map(t => t.strategyKey))];
    return unique.map(key => ({ key, label: TRADES.find(t => t.strategyKey === key)?.strategy || key }));
  }, []);

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", background: '#F7F4EE', color: '#0B0F14', minHeight: '100vh' }}>
      <PageSEO
        title="Track Record — NewLeaf Picks Performance"
        description="View NewLeaf System's verified options picks performance including win rate, cumulative P&L, strategy breakdown, and weekly performance history."
        path="/track-record"
      />
      <style>{`
        html { scrollbar-color: rgba(15,61,46,0.30) transparent; scrollbar-width: thin; }
        ::-webkit-scrollbar { width: 10px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(15,61,46,0.30); border-radius: 5px; }
      `}</style>

      {/* Mini-nav removed — main Nav provides navigation via "How it works" dropdown */}

      {/* ─── Hero ─── */}
      <section style={{ maxWidth: 800, margin: '0 auto', padding: '120px 2rem 40px', textAlign: 'center' }}>
        <h1 style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 400, lineHeight: 1.1,
          letterSpacing: '-1.5px', color: '#0B2D23', marginBottom: 16,
        }}>
          Every trade we've recommended
        </h1>
        <p style={{
          fontFamily: "'Playfair Display', Georgia, serif",
          fontSize: 'clamp(16px, 2vw, 20px)', fontStyle: 'italic',
          color: '#C9A96E', marginBottom: 32,
        }}>
          Last {dateRange} days. Every winner. Every loser.
        </p>
        <p style={{ fontSize: 15, lineHeight: 1.75, color: '#6b6b60', maxWidth: 580, margin: '0 auto' }}>
          We believe in radical transparency. Every recommendation that landed on Discover in the last {dateRange} days
          is listed here, with its entry price, adjustments (if any), and final outcome. Filter by outcome or strategy.
          We're not showing you an average — we're showing you every trade.
        </p>
      </section>

      {/* Synthetic data disclosure */}
      {DATA_SOURCE === 'synthetic' && (
        <div style={{ maxWidth: 800, margin: '0 auto 20px', padding: '0 2rem', textAlign: 'center' }}>
          <div style={{
            display: 'inline-block', padding: '8px 16px', borderRadius: 8,
            background: 'rgba(201,169,110,0.10)', border: '1px solid rgba(201,169,110,0.20)',
            fontSize: 12, color: '#B7791F', fontWeight: 600,
          }}>
            {DATA_DISCLOSURE}
          </div>
        </div>
      )}

      {/* ─── Summary stats ─── */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '0 2rem 40px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14 }}>
          <StatCard label="Total Recommendations" value={stats.total} />
          <StatCard label="Win Rate" value={`${stats.winRate}%`} color="#0B2D23" />
          <StatCard label="Avg Return on Capital" value={`${stats.avgRoc}%`} color={stats.avgRoc >= 0 ? '#0B7A52' : '#C94F4F'} />
          <StatCard label="Worst Single Loss" value={`$${stats.worstLoss}`} color="#C94F4F" />
          <StatCard label="Best Single Win" value={`+$${stats.bestWin}`} color="#0B7A52" />
        </div>
      </section>

      {/* ─── Filter bar ─── */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '0 2rem 20px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
          padding: '12px 16px', background: '#fff', borderRadius: 12,
          border: '1px solid rgba(17,24,39,0.08)',
        }}>
          {/* Outcome */}
          <FilterGroup label="Outcome">
            {[
              { key: 'all', label: 'All' },
              { key: 'WIN', label: 'Profitable' },
              { key: 'PARTIAL', label: 'Break-even' },
              { key: 'LOSS', label: 'Loss' },
            ].map(opt => (
              <FilterChip key={opt.key} active={outcomeFilter === opt.key} onClick={() => setOutcomeFilter(opt.key)}>
                {opt.label}
              </FilterChip>
            ))}
          </FilterGroup>

          <div style={{ width: 1, height: 24, background: 'rgba(17,24,39,0.08)' }} />

          {/* Strategy */}
          <FilterGroup label="Strategy">
            <select
              value={strategyFilter}
              onChange={(e) => setStrategyFilter(e.target.value)}
              style={{
                padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(17,24,39,0.12)',
                fontSize: 12, fontWeight: 600, background: '#fff', color: '#0B2D23',
              }}
            >
              <option value="all">All strategies</option>
              {strategies.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
            </select>
          </FilterGroup>

          <div style={{ width: 1, height: 24, background: 'rgba(17,24,39,0.08)' }} />

          {/* Date range */}
          <FilterGroup label="Period">
            {[30, 60, 90].map(d => (
              <FilterChip key={d} active={dateRange === d} onClick={() => setDateRange(d)}>
                {d}d
              </FilterChip>
            ))}
          </FilterGroup>
        </div>
      </section>

      {/* ─── Timeline ─── */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '0 2rem 30px' }}>
        <div style={{
          background: '#fff', borderRadius: 14, padding: '20px 16px',
          border: '1px solid rgba(17,24,39,0.08)', position: 'relative', minHeight: 100,
        }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 14 }}>
            Timeline — {filtered.length} trades
          </div>
          <div style={{ position: 'relative', height: 60 }}>
            {/* Date axis */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, background: 'rgba(17,24,39,0.08)' }} />

            {/* Trade dots */}
            {filtered.map(trade => {
              const startDate = new Date();
              startDate.setDate(startDate.getDate() - dateRange);
              const entryMs = new Date(trade.entryDate).getTime();
              const rangeMs = dateRange * 86400000;
              const pct = Math.max(0, Math.min(100, ((entryMs - startDate.getTime()) / rangeMs) * 100));

              return (
                <button
                  key={trade.id}
                  onClick={() => setSelectedTrade(trade)}
                  title={`${trade.ticker} ${trade.strategy} — ${trade.outcome === 'WIN' ? '+' : ''}$${trade.actualPnl}`}
                  style={{
                    position: 'absolute', left: `${pct}%`, bottom: 10 + Math.random() * 30,
                    width: 8, height: 8, borderRadius: '50%', border: 'none', padding: 0,
                    background: OUTCOME_COLOURS[trade.outcome] || '#9ca3af',
                    cursor: 'pointer', transform: 'translateX(-50%)',
                    opacity: 0.7, transition: 'opacity 0.15s, transform 0.15s',
                  }}
                  onMouseEnter={e => { e.target.style.opacity = '1'; e.target.style.transform = 'translateX(-50%) scale(1.5)'; }}
                  onMouseLeave={e => { e.target.style.opacity = '0.7'; e.target.style.transform = 'translateX(-50%)'; }}
                  aria-label={`${trade.ticker} ${trade.strategy}`}
                />
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── Distribution histogram ─── */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '0 2rem 30px' }}>
        <DistributionChart trades={filtered} />
      </section>

      {/* ─── Detail panel (slide-in from right) ─── */}
      {selectedTrade && (
        <DetailPanel trade={selectedTrade} onClose={() => setSelectedTrade(null)} />
      )}

      {/* ─── CTA ─── */}
      <section style={{ maxWidth: 600, margin: '0 auto', padding: '40px 2rem 60px', textAlign: 'center' }}>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/how-we-pick" style={{
            padding: '14px 28px', borderRadius: 10,
            background: 'rgba(11,45,35,0.06)', border: '1px solid rgba(11,45,35,0.12)',
            fontSize: 14, fontWeight: 600, color: '#0B2D23', textDecoration: 'none',
          }}>
            Back to how we pick &rarr;
          </a>
          <a href="/invest" style={{
            padding: '14px 28px', borderRadius: 10,
            background: '#C9A96E', color: '#0B2D23',
            fontSize: 14, fontWeight: 700, textDecoration: 'none',
            boxShadow: '0 4px 16px rgba(201,169,110,0.25)',
          }}>
            Ready to see today's trades &rarr;
          </a>
        </div>
      </section>

      {/* ─── Disclosure ─── */}
      <footer style={{ maxWidth: 700, margin: '0 auto', padding: '0 2rem 60px', textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.7 }}>
          Track record shows recommendations that appeared on Discover in the last {dateRange} days.
          Outcomes include any adjustments taken. Hypothetical returns assume the recommendation was followed
          exactly — actual user returns depend on execution timing, position sizing, and personal circumstances.
          Past performance does not indicate future performance.
        </p>
      </footer>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Sub-components
// ═══════════════════════════════════════════════════════════════

function StatCard({ label, value, color = '#0B2D23' }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid rgba(17,24,39,0.08)', borderRadius: 14, padding: 16, textAlign: 'center',
    }}>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 32, fontWeight: 700, color, marginBottom: 4 }}>
        {value}
      </div>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9ca3af' }}>
        {label}
      </div>
    </div>
  );
}

function FilterGroup({ label, children }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9ca3af', marginRight: 4 }}>
        {label}
      </span>
      {children}
    </div>
  );
}

function FilterChip({ active, onClick, children }) {
  return (
    <button onClick={onClick} style={{
      padding: '4px 12px', borderRadius: 20, border: 'none',
      fontSize: 12, fontWeight: 600, cursor: 'pointer',
      background: active ? '#0B2D23' : 'rgba(17,24,39,0.04)',
      color: active ? '#fff' : '#6b7280',
      transition: 'all 0.15s',
    }}>
      {children}
    </button>
  );
}

function DistributionChart({ trades }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Bucket returns into 5% bands from -50% to +50%
    const buckets = {};
    for (let i = -50; i <= 50; i += 5) buckets[i] = 0;
    trades.forEach(t => {
      const bucket = Math.round(t.returnOnCapital / 5) * 5;
      const clamped = Math.max(-50, Math.min(50, bucket));
      buckets[clamped] = (buckets[clamped] || 0) + 1;
    });

    const categories = Object.keys(buckets).map(Number).sort((a, b) => a - b);
    const data = categories.map(k => ({
      y: buckets[k],
      color: k >= 0 ? 'rgba(11,122,82,0.6)' : 'rgba(201,79,79,0.6)',
    }));

    if (chartRef.current) chartRef.current.destroy();

    chartRef.current = Highcharts.chart(containerRef.current, {
      chart: { type: 'column', backgroundColor: 'transparent', height: 220, style: { fontFamily: "'Inter', sans-serif" } },
      title: { text: null },
      credits: { enabled: false },
      legend: { enabled: false },
      xAxis: {
        categories: categories.map(k => `${k}%`),
        labels: { style: { fontSize: '10px', color: '#9ca3af' } },
        lineColor: 'rgba(17,24,39,0.08)',
        plotLines: [{ value: categories.indexOf(0), color: '#0B2D23', width: 1.5, dashStyle: 'Dash', zIndex: 5 }],
      },
      yAxis: {
        title: { text: null },
        labels: { style: { fontSize: '10px', color: '#9ca3af' } },
        gridLineColor: 'rgba(17,24,39,0.04)',
      },
      tooltip: {
        backgroundColor: '#0B2D23', borderRadius: 8, style: { color: '#fff', fontSize: '12px' },
        formatter: function () { return `<b>${this.x} return</b><br/>${this.y} trades`; },
      },
      plotOptions: { column: { borderRadius: 3, borderWidth: 0, pointPadding: 0.05 } },
      series: [{ data }],
    });

    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [trades]);

  return (
    <div style={{
      background: '#fff', borderRadius: 14, padding: '16px 16px 8px',
      border: '1px solid rgba(17,24,39,0.08)',
    }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 8 }}>
        Return distribution
      </div>
      <div ref={containerRef} />
    </div>
  );
}

function DetailPanel({ trade, onClose }) {
  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.3)', zIndex: 200,
      }} />
      {/* Panel */}
      <div style={{
        position: 'fixed', top: 0, right: 0, bottom: 0, width: 420, maxWidth: '90vw',
        background: '#fff', zIndex: 201, overflowY: 'auto',
        boxShadow: '-8px 0 30px rgba(0,0,0,0.1)',
        padding: '32px 24px',
        animation: 'slideInRight 0.25s ease',
      }}>
        <style>{`@keyframes slideInRight { from { transform: translateX(100%); } to { transform: translateX(0); } }`}</style>

        <button onClick={onClose} style={{
          position: 'absolute', top: 16, right: 16, background: 'none', border: 'none',
          fontSize: 20, color: '#9ca3af', cursor: 'pointer',
        }}>
          &times;
        </button>

        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 24, fontWeight: 700, color: '#0B2D23', marginBottom: 4 }}>
          {trade.ticker}
        </div>
        <div style={{ fontSize: 14, color: '#6b7280', marginBottom: 16 }}>
          {trade.strategy} &middot; {trade.sentiment}
        </div>

        {/* Outcome badge */}
        <div style={{
          display: 'inline-block', padding: '6px 14px', borderRadius: 20, marginBottom: 20,
          background: trade.outcome === 'WIN' ? 'rgba(11,122,82,0.10)' : trade.outcome === 'LOSS' ? 'rgba(201,79,79,0.10)' : 'rgba(183,121,31,0.10)',
          color: OUTCOME_COLOURS[trade.outcome],
          fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700,
        }}>
          {trade.outcome} &middot; {trade.actualPnl >= 0 ? '+' : ''}${trade.actualPnl}
        </div>

        {/* Details grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
          <DetailTile label="Entry Date" value={trade.entryDate} />
          <DetailTile label="Exit Date" value={trade.exitDate} />
          <DetailTile label="Spot at Entry" value={`$${trade.spotAtEntry.toFixed(2)}`} />
          <DetailTile label="Spot at Expiry" value={`$${trade.spotAtExpiry.toFixed(2)}`} />
          <DetailTile label="Net Credit" value={`$${trade.netCredit.toFixed(2)}`} />
          <DetailTile label="ROC" value={`${trade.returnOnCapital}%`} />
          <DetailTile label="DTE" value={`${trade.dte} days`} />
          <DetailTile label="Exit Reason" value={trade.exitReason} />
        </div>

        {/* Strikes */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 8 }}>
            Strikes
          </div>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#374151', lineHeight: 2 }}>
            Long Put: ${trade.strikes.longPut} &middot; Short Put: ${trade.strikes.shortPut}<br/>
            Short Call: ${trade.strikes.shortCall} &middot; Long Call: ${trade.strikes.longCall}
          </div>
        </div>

        {/* Verdict history */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 8 }}>
            Verdict history
          </div>
          {trade.verdictHistory.map((v, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: v.verdict === 'ON_TRACK' || v.verdict === 'TAKE_PROFIT' ? '#0B7A52' : v.verdict === 'MONITOR' ? '#B7791F' : v.verdict === 'ACTION_NEEDED' ? '#ea580c' : '#C94F4F',
              }} />
              <span style={{ fontSize: 12, color: '#374151' }}>
                Day {v.day}: <strong>{v.verdict.replace('_', ' ')}</strong>
              </span>
            </div>
          ))}
        </div>

        {/* Adjustments */}
        {trade.adjustments.length > 0 && (
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 8 }}>
              Adjustments
            </div>
            {trade.adjustments.map((a, i) => (
              <div key={i} style={{ fontSize: 12, color: '#374151', marginBottom: 4 }}>
                Day {a.day}: {a.type.replace(/_/g, ' ')}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

function DetailTile({ label, value }) {
  return (
    <div style={{ background: 'rgba(247,248,250,0.65)', borderRadius: 8, padding: 8 }}>
      <div style={{ fontSize: 8, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(17,24,39,0.4)', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{value}</div>
    </div>
  );
}
