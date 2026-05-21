import { useRef, useEffect } from 'react';
import Highcharts from 'highcharts';

/**
 * PriceChart — Highcharts OHLC/line chart with gamma wall overlays.
 * Shows real price history from R2 data with put wall, call wall, center, and gamma flip lines.
 */
export default function PriceChart({ data, technicalData }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !data) return;

    const { spot, put_wall, call_wall, center, gamma_flip } = data;
    const history = technicalData?.priceHistory || [];

    // If no price history, show a simple spot-level chart
    const hasHistory = history.length > 0;

    // Build series data from price history
    const priceData = hasHistory
      ? history.map(bar => [new Date(bar.date).getTime(), bar.price]).filter(d => d[1])
      : [[Date.now(), spot]];

    // Last 60 trading days for a clean view
    const recentData = priceData.slice(-60);

    const plotLines = [
      put_wall && { value: put_wall, color: '#ef4444', width: 2, dashStyle: 'Dash', label: { text: `Put Wall $${put_wall}`, style: { color: '#ef4444', fontWeight: '700', fontSize: '11px' }, align: 'right', x: -8 }, zIndex: 3 },
      call_wall && { value: call_wall, color: '#22c55e', width: 2, dashStyle: 'Dash', label: { text: `Call Wall $${call_wall}`, style: { color: '#22c55e', fontWeight: '700', fontSize: '11px' }, align: 'right', x: -8 }, zIndex: 3 },
      center && { value: center, color: '#3b82f6', width: 2, dashStyle: 'ShortDot', label: { text: `Center $${center}`, style: { color: '#3b82f6', fontWeight: '700', fontSize: '11px' }, align: 'right', x: -8 }, zIndex: 3 },
      gamma_flip && { value: gamma_flip, color: '#8b5cf6', width: 1.5, dashStyle: 'Dot', label: { text: `Flip $${gamma_flip?.toFixed(0)}`, style: { color: '#8b5cf6', fontWeight: '600', fontSize: '10px' }, align: 'right', x: -8 }, zIndex: 3 },
      spot && { value: spot, color: '#0B2D23', width: 2.5, dashStyle: 'Solid', label: { text: `Spot $${spot.toFixed(2)}`, style: { color: '#0B2D23', fontWeight: '800', fontSize: '12px' }, align: 'left', x: 8 }, zIndex: 5 },
    ].filter(Boolean);

    // Determine Y-axis range from gamma levels
    const levels = [spot, put_wall, call_wall, center, gamma_flip].filter(Boolean);
    const allPrices = [...recentData.map(d => d[1]), ...levels];
    const yMin = Math.min(...allPrices) * 0.995;
    const yMax = Math.max(...allPrices) * 1.005;

    // Plot band between put wall and call wall (gamma band)
    const plotBands = (put_wall && call_wall) ? [{
      from: put_wall,
      to: call_wall,
      color: 'rgba(59, 130, 246, 0.06)',
      label: { text: 'Gamma Band', style: { color: '#94a3b8', fontSize: '10px' }, align: 'center' },
    }] : [];

    chartRef.current = Highcharts.chart(containerRef.current, {
      chart: {
        type: 'area',
        height: 320,
        style: { fontFamily: 'inherit' },
        backgroundColor: 'transparent',
        spacingTop: 16,
        spacingBottom: 8,
      },
      title: { text: null },
      credits: { enabled: false },
      legend: { enabled: false },
      xAxis: {
        type: hasHistory ? 'datetime' : 'linear',
        visible: hasHistory,
        lineColor: '#e2e8f0',
        tickColor: '#e2e8f0',
        labels: { style: { color: '#94a3b8', fontSize: '10px' } },
      },
      yAxis: {
        title: { text: null },
        min: yMin,
        max: yMax,
        gridLineColor: '#f1f5f9',
        labels: {
          format: '${value:.0f}',
          style: { color: '#94a3b8', fontSize: '10px' },
        },
        plotLines,
        plotBands,
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: 'transparent',
        borderRadius: 8,
        style: { color: '#fff', fontSize: '12px' },
        headerFormat: '<span style="font-size:10px;color:#94a3b8">{point.key:%b %d, %Y}</span><br/>',
        pointFormat: '<b style="font-size:14px">${point.y:.2f}</b>',
        shadow: { color: 'rgba(0,0,0,0.2)', offsetX: 0, offsetY: 4, opacity: 0.3, width: 12 },
      },
      plotOptions: {
        area: {
          fillColor: {
            linearGradient: { x1: 0, y1: 0, x2: 0, y2: 1 },
            stops: [
              [0, 'rgba(11, 45, 35, 0.15)'],
              [1, 'rgba(11, 45, 35, 0.01)'],
            ],
          },
          lineWidth: 2.5,
          lineColor: '#0B2D23',
          marker: { enabled: false, radius: 3, symbol: 'circle' },
          states: { hover: { lineWidth: 3 } },
          threshold: null,
        },
      },
      series: [{
        name: 'Price',
        data: recentData,
        color: '#0B2D23',
      }],
    });

    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [data, technicalData]);

  if (!data) return null;

  return (
    <div className="nl-card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px', flexWrap: 'wrap', gap: '8px' }}>
        <h3 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--nl-muted-text)', fontWeight: '700', margin: 0 }}>
          Price Chart with Gamma Overlays
        </h3>
        <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', fontSize: '11px', fontWeight: 600 }}>
          <span style={{ color: '#ef4444' }}>&#9644; Put Wall</span>
          <span style={{ color: '#22c55e' }}>&#9644; Call Wall</span>
          <span style={{ color: '#3b82f6' }}>&#8226; Center</span>
          <span style={{ color: '#8b5cf6' }}>&#8226; Flip</span>
          <span style={{ color: '#0B2D23', fontWeight: 800 }}>&#9644; Spot ${data.spot?.toFixed(2)}</span>
        </div>
      </div>
      <div ref={containerRef} />
    </div>
  );
}
