/**
 * PortfolioMixTab — donut chart + strategy breakdown table.
 * Ported from PortfolioPageRefactored.jsx allocation view.
 */
import { useRef, useEffect } from 'react';
import Highcharts from 'highcharts';
import { formatStrategy } from '../../utils/formatters';
import { getChartColor } from '../../utils/strategyThemes';

const fmt = (v) => '$' + Math.round(v || 0).toLocaleString();

export function PortfolioMixTab({ allocationByStrategy, totalRisk }) {
  if (allocationByStrategy.length === 0) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
        No strategies to display. Add strategies from Discover to see your portfolio mix.
      </div>
    );
  }

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      {/* Donut chart */}
      <div style={{ background: '#fff', border: '1px solid rgba(17,24,39,0.08)', borderRadius: 14, padding: 20 }}>
        <h3 style={headingStyle}>Portfolio Allocation by Strategy</h3>
        <DonutChart data={allocationByStrategy} />
      </div>

      {/* Strategy breakdown table */}
      <div style={{ background: '#fff', border: '1px solid rgba(17,24,39,0.08)', borderRadius: 14, padding: 20 }}>
        <h3 style={headingStyle}>Strategy Breakdown</h3>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(17,24,39,0.08)' }}>
              {['Strategy', 'Positions', 'Amount', '% of Portfolio'].map(h => (
                <th key={h} style={{
                  padding: '8px 10px', fontSize: 10, fontWeight: 700,
                  letterSpacing: '.1em', textTransform: 'uppercase',
                  color: 'rgba(17,24,39,0.45)', textAlign: h === 'Strategy' ? 'left' : 'right',
                }}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {allocationByStrategy.map((item, i) => {
              const pct = totalRisk > 0 ? ((item.value / totalRisk) * 100).toFixed(1) : '0';
              return (
                <tr key={i} style={{ borderBottom: '1px solid rgba(17,24,39,0.04)' }}>
                  <td style={{ padding: '10px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 10, height: 10, borderRadius: '50%', background: getChartColor(item.name), display: 'inline-block' }} />
                    {formatStrategy(item.name)}
                  </td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>{item.count}</td>
                  <td style={{ padding: '10px', textAlign: 'right', fontFamily: "'Space Mono', monospace", fontWeight: 600 }}>
                    {fmt(item.value)}
                  </td>
                  <td style={{ padding: '10px', textAlign: 'right' }}>{pct}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DonutChart({ data }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    if (chartRef.current) chartRef.current.destroy();

    chartRef.current = Highcharts.chart(containerRef.current, {
      chart: { type: 'pie', backgroundColor: 'transparent', height: 260, style: { fontFamily: "'Inter', sans-serif" } },
      title: { text: null },
      credits: { enabled: false },
      tooltip: {
        pointFormat: '<b>{point.percentage:.1f}%</b> — ${point.y:,.0f}',
        backgroundColor: '#0B2D23', borderRadius: 8, style: { color: '#fff', fontSize: '12px' },
      },
      plotOptions: {
        pie: {
          innerSize: '55%',
          dataLabels: { enabled: false },
          borderWidth: 0,
        },
      },
      series: [{
        data: data.map(d => ({
          name: formatStrategy(d.name),
          y: d.value,
          color: getChartColor(d.name),
        })),
      }],
    });

    return () => { if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; } };
  }, [data]);

  return <div ref={containerRef} />;
}

const headingStyle = {
  fontSize: 14, fontWeight: 700, letterSpacing: '-0.2px',
  color: '#111827', marginBottom: 16,
};
