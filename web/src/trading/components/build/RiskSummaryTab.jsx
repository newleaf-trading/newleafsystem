/**
 * RiskSummaryTab — risk gauges, bar chart, scenario analysis.
 * Ported from PortfolioPageRefactored.jsx risk view.
 */
import { useRef, useEffect } from 'react';
import Highcharts from 'highcharts';
import { formatStrategy } from '../../utils/formatters';
import { getChartColor } from '../../utils/strategyThemes';

const fmt = (v) => {
  if (v == null || isNaN(v)) return '--';
  const prefix = v >= 0 ? '+' : '';
  return prefix + '$' + Math.abs(Math.round(v)).toLocaleString();
};

export function RiskSummaryTab({ stats, scenarios, riskReward, totalCapital }) {
  const riskPct = totalCapital > 0 ? ((stats.totalMaxRisk / totalCapital) * 100).toFixed(1) : '0';
  const roiPct = stats.totalMaxRisk > 0 ? ((stats.totalPotentialReturn / stats.totalMaxRisk) * 100).toFixed(0) : '0';

  return (
    <div>
      {/* Risk gauges */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 24 }}>
        <GaugeCard title="Portfolio Risk Score" value={`${riskPct}%`} sub="of total capital at risk"
          fill={parseFloat(riskPct)} danger={parseFloat(riskPct) > 15} />
        <GaugeCard title="Win Rate Average" value={`${(stats.avgWinRate || 0).toFixed(1)}%`} sub="probability of profit"
          fill={stats.avgWinRate || 0} />
        <GaugeCard title="Return Potential" value={`${roiPct}%`} sub="potential ROI"
          fill={Math.min(parseFloat(roiPct), 100)} profit />
      </div>

      {/* Risk & Reward bar chart */}
      {riskReward.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid rgba(17,24,39,0.08)', borderRadius: 14, padding: 20, marginBottom: 24 }}>
          <h3 style={headingStyle}>Risk & Reward by Strategy</h3>
          <BarChart data={riskReward} />
        </div>
      )}

      {/* Scenario analysis */}
      <div style={{ background: '#fff', border: '1px solid rgba(17,24,39,0.08)', borderRadius: 14, padding: 20 }}>
        <h3 style={headingStyle}>Projected Outcomes if Executed Today</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14, marginBottom: 16 }}>
          {scenarios.map((s, i) => {
            const isPositive = s.return >= 0;
            const emoji = s.scenario.includes('Bull') ? '📈' : s.scenario.includes('Bear') ? '📉' : '➡️';
            const bgClass = s.scenario.includes('Bull') ? 'rgba(34,197,94,0.05)' : s.scenario.includes('Bear') ? 'rgba(239,68,68,0.05)' : 'rgba(59,130,246,0.05)';
            const borderClass = s.scenario.includes('Bull') ? 'rgba(34,197,94,0.2)' : s.scenario.includes('Bear') ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.2)';

            return (
              <div key={i} style={{
                background: bgClass, border: `1px solid ${borderClass}`,
                borderRadius: 12, padding: 20, textAlign: 'center',
              }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>{emoji}</div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#6b7280', marginBottom: 8 }}>{s.scenario}</div>
                <div style={{
                  fontFamily: "'Space Mono', monospace", fontSize: 22, fontWeight: 700,
                  color: isPositive ? '#0B7A52' : '#C94F4F', marginBottom: 4,
                }}>
                  {fmt(s.return)}
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>Estimated P&L</div>
              </div>
            );
          })}
        </div>
        <p style={{ fontSize: 11, color: '#9ca3af', fontStyle: 'italic', lineHeight: 1.5 }}>
          * Scenario estimates are simplified projections based on strategy characteristics and do not account for volatility changes, early assignment, or other market dynamics.
        </p>
      </div>
    </div>
  );
}

function GaugeCard({ title, value, sub, fill, danger, profit }) {
  const barColor = danger ? 'linear-gradient(90deg, #ef4444, #f87171)' : profit ? 'linear-gradient(90deg, #10b981, #34d399)' : 'linear-gradient(90deg, #10b981, #34d399)';

  return (
    <div style={{ background: '#fff', border: '1px solid rgba(17,24,39,0.08)', borderRadius: 14, padding: 20 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: '#6b7280', marginBottom: 8 }}>{title}</div>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 28, fontWeight: 700, color: '#111827', marginBottom: 6 }}>{value}</div>
      <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 12 }}>{sub}</div>
      <div style={{ height: 6, background: 'rgba(17,24,39,0.06)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{ height: '100%', borderRadius: 999, width: `${Math.min(fill, 100)}%`, background: barColor, transition: 'width 0.3s' }} />
      </div>
    </div>
  );
}

function BarChart({ data }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;
    if (chartRef.current) chartRef.current.destroy();

    chartRef.current = Highcharts.chart(containerRef.current, {
      chart: { type: 'bar', backgroundColor: 'transparent', height: 250, style: { fontFamily: "'Inter', sans-serif" } },
      title: { text: null },
      credits: { enabled: false },
      xAxis: {
        categories: data.map(d => formatStrategy(d.name)),
        labels: { style: { fontSize: '11px', color: '#6b7280' } },
      },
      yAxis: {
        title: { text: null },
        labels: { formatter: function() { return '$' + (this.value / 1000).toFixed(0) + 'k'; }, style: { fontSize: '10px', color: '#9ca3af' } },
      },
      tooltip: {
        backgroundColor: '#0B2D23', borderRadius: 8, style: { color: '#fff', fontSize: '12px' },
        formatter: function() { return `<b>${this.series.name}</b>: $${this.y.toLocaleString()}`; },
      },
      plotOptions: { bar: { borderRadius: 3, borderWidth: 0 } },
      legend: { itemStyle: { fontSize: '11px', color: '#6b7280' } },
      series: [
        { name: 'Max Profit', data: data.map(d => d.profit), color: '#10b981' },
        { name: 'Max Risk', data: data.map(d => d.risk), color: '#ef4444' },
      ],
    });

    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [data]);

  return <div ref={containerRef} />;
}

const headingStyle = {
  fontSize: 14, fontWeight: 700, letterSpacing: '-0.2px',
  color: '#111827', marginBottom: 16,
};
