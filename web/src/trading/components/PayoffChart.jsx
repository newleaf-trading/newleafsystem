/**
 * PayoffChart — strike ruler + P&L curve using Highcharts.
 *
 * Two zones on a single chart sharing the x-axis (strike price):
 *   Top: strike ruler with coloured leg markers
 *   Bottom: P&L at expiration — solid primary curve + optional grey dashed comparison
 *
 * Props:
 *   legs: [{action, type, strike, premium, quantity}]       — primary curve (coloured solid)
 *   comparisonLegs: [{...}]                                  — reference curve (grey dashed)
 *   spotPrice: number
 *   height: number (default 260)
 *   accentColor: string — colour for the primary curve (default '#0F6E56')
 */
import { useRef, useEffect, useMemo } from 'react';
import Highcharts from 'highcharts';
import { samplePayoff, detectBreakevens } from '../utils/payoffMath';

// Colours per spec
const COL_PUT_FILL = '#0F6E56';
const COL_PUT_BORDER = '#0F6E56';
const COL_CALL_FILL = '#791F1F';
const COL_CALL_BORDER = '#791F1F';
const COL_SPOT = '#BA7517';
const COL_REFERENCE = '#B4B2A9';
const COL_PROFIT_FILL = 'rgba(151,196,89,0.20)';
const COL_LOSS_FILL = 'rgba(247,193,193,0.15)';
const RULER_Y = 0; // scatter series pinned to y=0 on a hidden y-axis

export function PayoffChart({
  legs = [],
  comparisonLegs = [],
  spotPrice = 0,
  height = 260,
  accentColor = '#0F6E56',
}) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  // Compute payoff curves
  const primaryData = useMemo(() => samplePayoff(legs, spotPrice), [legs, spotPrice]);
  const compData = useMemo(() =>
    comparisonLegs.length > 0 ? samplePayoff(comparisonLegs, spotPrice) : [],
    [comparisonLegs, spotPrice]
  );
  const breakevens = useMemo(() => detectBreakevens(primaryData), [primaryData]);

  // Build strike marker data for the ruler
  const rulerMarkers = useMemo(() =>
    legs.filter(l => l.strike > 0).map(leg => {
      const isCall = (leg.type || '').toLowerCase() === 'call';
      const isSell = (leg.action || '').toLowerCase() === 'sell';
      const fillColor = isSell
        ? (isCall ? COL_CALL_FILL : COL_PUT_FILL)
        : '#FFFFFF';
      const borderColor = isCall ? COL_CALL_BORDER : COL_PUT_BORDER;
      const label = `${isSell ? 'S' : 'B'} ${isCall ? 'C' : 'P'} $${leg.strike}`;

      return {
        x: leg.strike,
        y: RULER_Y,
        marker: {
          symbol: 'circle',
          radius: isSell ? 8 : 6.5,
          fillColor,
          lineColor: borderColor,
          lineWidth: isSell ? 0 : 2.5,
        },
        dataLabels: {
          enabled: true,
          format: label,
          y: -18,
          style: { fontSize: '11px', fontWeight: '600', color: '#6b6e74', fontFamily: "'Inter', sans-serif", textOutline: 'none' },
        },
      };
    }),
    [legs]
  );

  // X-axis plot lines: spot + breakevens
  const xPlotLines = useMemo(() => {
    const lines = [];
    if (spotPrice > 0) {
      lines.push({
        value: spotPrice, color: COL_SPOT, width: 1.75, dashStyle: 'Dash', zIndex: 5,
        label: {
          text: '$' + spotPrice.toFixed(0),
          align: 'center', verticalAlign: 'top', y: -6,
          style: { color: COL_SPOT, fontWeight: '700', fontSize: '12px', fontFamily: "'Inter', sans-serif" },
        },
      });
    }
    breakevens.forEach(be => {
      lines.push({
        value: be, color: 'rgba(180,175,165,.55)', width: 1, dashStyle: 'ShortDot', zIndex: 3,
        label: {
          text: 'BE $' + be.toFixed(0),
          align: 'center', y: 16,
          style: { color: '#6b6e74', fontSize: '10px', fontWeight: '600', fontFamily: "'Inter', sans-serif" },
        },
      });
    });
    return lines;
  }, [spotPrice, breakevens]);

  // Create / update chart
  useEffect(() => {
    if (!containerRef.current || primaryData.length === 0) {
      if (chartRef.current) { chartRef.current.destroy(); chartRef.current = null; }
      return;
    }

    const series = [];

    // 1. Comparison curve (grey dashed) — render first so primary overlays
    if (compData.length > 0) {
      series.push({
        id: 'comparison',
        name: 'Current position',
        type: 'line',
        data: compData,
        color: COL_REFERENCE,
        dashStyle: 'Dash',
        lineWidth: 1.5,
        opacity: 0.6,
        marker: { enabled: false },
        enableMouseTracking: false,
        zIndex: 1,
        yAxis: 0,
      });
    }

    // 2. Primary payoff curve (solid, coloured fills)
    series.push({
      id: 'primary',
      name: 'P&L',
      type: 'area',
      data: primaryData,
      color: accentColor,
      negativeColor: '#b03030',
      fillColor: COL_PROFIT_FILL,
      negativeFillColor: COL_LOSS_FILL,
      lineWidth: 2.5,
      marker: { enabled: false },
      zIndex: 2,
      yAxis: 0,
      threshold: 0,
    });

    // 3. Strike ruler markers (scatter on secondary y-axis pinned to top)
    if (rulerMarkers.length > 0) {
      series.push({
        id: 'ruler',
        name: 'Strikes',
        type: 'scatter',
        data: rulerMarkers,
        enableMouseTracking: false,
        zIndex: 10,
        yAxis: 1,
        showInLegend: false,
      });
    }

    const totalHeight = height + 70; // extra space for ruler above

    if (chartRef.current) {
      // Update existing chart
      const chart = chartRef.current;
      chart.xAxis[0].update({ plotLines: xPlotLines }, false);

      // Update series data with animation
      const animConfig = { duration: 300, easing: 'easeInOutCubic' };
      series.forEach(s => {
        const existing = chart.get(s.id);
        if (existing) {
          existing.setData(s.data, false, animConfig);
        } else {
          chart.addSeries(s, false);
        }
      });
      chart.redraw(true);
    } else {
      // Create new chart
      chartRef.current = Highcharts.chart(containerRef.current, {
        chart: {
          backgroundColor: 'transparent',
          style: { fontFamily: "'Inter', sans-serif" },
          spacing: [8, 16, 8, 8],
          height: totalHeight,
          animation: { duration: 300 },
        },
        title: { text: null },
        credits: { enabled: false },
        legend: { enabled: false },
        tooltip: {
          backgroundColor: '#0B2D23',
          borderColor: '#1a5c44',
          borderRadius: 8,
          shadow: false,
          style: { color: '#fff', fontSize: '12px', fontFamily: "'Space Mono', monospace" },
          formatter: function () {
            const pnl = this.y;
            const color = pnl > 0 ? '#5dba8e' : pnl < 0 ? '#ff6b6b' : '#94a3b8';
            return `<span style="font-size:10px;color:#C9A96E">At $${this.x.toFixed(2)}</span><br/>`
              + `<span style="font-size:15px;font-weight:800;color:${color}">${pnl >= 0 ? '+' : ''}$${Math.round(pnl).toLocaleString()}</span>`;
          },
          useHTML: true,
        },
        xAxis: {
          title: { text: null },
          labels: {
            formatter: function () { return '$' + this.value.toFixed(0); },
            style: { fontSize: '11px', fontWeight: '600', color: '#9ea1a8', fontFamily: "'Inter', sans-serif" },
          },
          gridLineWidth: 0,
          lineColor: '#e5e1d4',
          tickColor: '#e5e1d4',
          plotLines: xPlotLines,
        },
        yAxis: [
          // Primary: P&L axis
          {
            title: { text: null },
            labels: {
              formatter: function () {
                const v = this.value;
                if (Math.abs(v) >= 1000) return (v >= 0 ? '+$' : '-$') + (Math.abs(v) / 1000).toFixed(Math.abs(v) >= 10000 ? 0 : 1) + 'k';
                return '$' + (v >= 0 ? '+' : '') + Math.round(v);
              },
              style: { fontSize: '11px', fontWeight: '600', color: '#9ea1a8', fontFamily: "'Inter', sans-serif" },
            },
            gridLineColor: 'rgba(229,225,212,.6)',
            gridLineWidth: 0.5,
            plotLines: [{ value: 0, color: 'rgba(120,120,120,.5)', width: 1, dashStyle: 'Dash', zIndex: 3 }],
            height: '75%',
            top: '25%',
          },
          // Secondary: ruler axis (hidden, pinned to top band)
          {
            title: { text: null },
            labels: { enabled: false },
            gridLineWidth: 0,
            min: -1,
            max: 1,
            height: '20%',
            top: '0%',
            offset: 0,
          },
        ],
        plotOptions: {
          area: {
            threshold: 0,
            marker: { enabled: false },
            lineJoin: 'round',
            states: { hover: { lineWidth: 3 } },
          },
          series: {
            animation: { duration: 300 },
          },
        },
        responsive: {
          rules: [{
            condition: { maxWidth: 500 },
            chartOptions: {
              chart: { height: 240 },
            },
          }],
        },
        series,
      });
    }

    return () => {
      // Cleanup on unmount only — don't destroy on every re-render
    };
  }, [primaryData, compData, rulerMarkers, xPlotLines, height, accentColor]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
        chartRef.current = null;
      }
    };
  }, []);

  if (!spotPrice || legs.length === 0) {
    return (
      <div style={{
        height: height + 70, display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#9ca3af', fontSize: 13,
        background: '#fff', borderRadius: 14, border: '1px solid rgba(17,24,39,0.08)',
      }}>
        Select an adjustment to preview payoff
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 16 }}>
      <div ref={containerRef} />
    </div>
  );
}
