import "../../styles/ai-analysis-light.css";
import { useMemo, useRef, useEffect } from 'react';
import Highcharts from 'highcharts';

/**
 * PayoffDiagramCard — single-line chart matching strategy-builder canvas style.
 * Uses Highcharts negativeColor + negativeFillColor for split zones.
 */
export function PayoffDiagramCard({ tile, currentPrice, breakevens, maxProfit, maxLoss }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  const payoffData = useMemo(() => {
    if (!tile?.legs?.length) return [];
    const strikes = tile.legs.map(l => l.strike).filter(Boolean);
    if (strikes.length === 0) return [];

    const minStrike = Math.min(...strikes);
    const maxStrike = Math.max(...strikes);
    const range = maxStrike - minStrike;
    const lo = minStrike - range * 0.5;
    const hi = maxStrike + range * 0.5;
    const step = (hi - lo) / 150;

    const data = [];
    for (let price = lo; price <= hi; price += step) {
      let pnl = 0;
      tile.legs.forEach(leg => {
        const { action, type, strike, premium = 0, quantity = 1 } = leg;
        const isCall = type?.toLowerCase() === 'call';
        const isSell = action?.toLowerCase() === 'sell';
        const intrinsic = isCall ? Math.max(0, price - strike) : Math.max(0, strike - price);
        pnl += isSell ? (premium - intrinsic) * 100 * quantity : (intrinsic - premium) * 100 * quantity;
      });
      data.push([Math.round(price * 100) / 100, Math.round(pnl * 100) / 100]);
    }
    return data;
  }, [tile]);

  const pnlAtCurrent = useMemo(() => {
    if (!currentPrice || payoffData.length === 0) return 0;
    let closest = payoffData[0];
    let minDist = Infinity;
    for (const d of payoffData) {
      if (Math.abs(d[0] - currentPrice) < minDist) { minDist = Math.abs(d[0] - currentPrice); closest = d; }
    }
    return closest[1];
  }, [currentPrice, payoffData]);

  // Detect breakevens from data
  const detectedBE = useMemo(() => {
    const bes = [];
    for (let i = 1; i < payoffData.length; i++) {
      const [, a] = payoffData[i - 1];
      const [, b] = payoffData[i];
      if (a * b <= 0 && a !== b) {
        const x = payoffData[i - 1][0] + (payoffData[i][0] - payoffData[i - 1][0]) * Math.abs(a) / (Math.abs(a) + Math.abs(b));
        bes.push(Math.round(x * 100) / 100);
      }
    }
    return bes;
  }, [payoffData]);

  const beLines = breakevens?.length ? breakevens : detectedBE;

  useEffect(() => {
    if (!containerRef.current || payoffData.length === 0) return;

    const xPlotLines = [];

    // Spot price — gold dashed
    if (currentPrice > 0) {
      xPlotLines.push({
        value: currentPrice, color: '#C9A96E', width: 1.5, dashStyle: 'Dash', zIndex: 5,
        label: {
          text: '$' + currentPrice.toFixed(0),
          align: 'center', verticalAlign: 'top', y: -6,
          style: { color: '#C9A96E', fontWeight: '700', fontSize: '12px', fontFamily: "'Inter', sans-serif" },
        },
      });
    }

    // Breakevens — subtle gray
    beLines.forEach(be => {
      if (be > 0) {
        xPlotLines.push({
          value: be, color: 'rgba(180,175,165,.55)', width: 1, dashStyle: 'ShortDot', zIndex: 3,
          label: {
            text: 'BE $' + be.toFixed(0),
            align: 'center', y: 16,
            style: { color: '#6b6e74', fontSize: '11px', fontWeight: '600', fontFamily: "'Inter', sans-serif" },
          },
        });
      }
    });

    chartRef.current = Highcharts.chart(containerRef.current, {
      chart: {
        type: 'area',
        backgroundColor: 'transparent',
        style: { fontFamily: "'Inter', sans-serif" },
        spacing: [20, 24, 10, 10],
        height: 300,
      },
      title: { text: null },
      credits: { enabled: false },
      legend: {
        align: 'right', verticalAlign: 'top', floating: true, y: -10,
        itemStyle: { fontSize: '11px', fontWeight: '600', color: '#6b6e74' },
        symbolWidth: 18, symbolRadius: 1, itemDistance: 16,
      },
      xAxis: {
        title: { text: 'STOCK PRICE AT EXPIRATION', style: { fontSize: '9px', fontWeight: '700', letterSpacing: '1.5px', color: '#9ea1a8' } },
        labels: {
          formatter: function() { return '$' + this.value.toFixed(0); },
          style: { fontSize: '11px', fontWeight: '600', color: '#9ea1a8', fontFamily: "'Inter', sans-serif" },
        },
        gridLineWidth: 0,
        lineColor: '#e5e1d4',
        tickColor: '#e5e1d4',
        plotLines: xPlotLines,
      },
      yAxis: {
        title: { text: null },
        labels: {
          formatter: function() {
            const v = this.value;
            if (Math.abs(v) >= 1000) return (v >= 0 ? '+$' : '-$') + (Math.abs(v) / 1000).toFixed(Math.abs(v) >= 10000 ? 0 : 1) + 'k';
            return '$' + (v >= 0 ? '+' : '') + Math.round(v);
          },
          style: { fontSize: '11px', fontWeight: '600', color: '#9ea1a8', fontFamily: "'Inter', sans-serif" },
        },
        gridLineColor: 'rgba(229,225,212,.6)',
        gridLineWidth: 0.5,
        plotLines: [{ value: 0, color: 'rgba(120,120,120,.5)', width: 1, dashStyle: 'Dash', zIndex: 3 }],
      },
      tooltip: {
        backgroundColor: '#0B2D23',
        borderColor: '#1a5c44',
        borderRadius: 8,
        shadow: false,
        style: { color: '#fff', fontSize: '12px', fontFamily: "'Space Mono', monospace" },
        formatter: function() {
          const pnl = this.y;
          const color = pnl > 0 ? '#5dba8e' : pnl < 0 ? '#ff6b6b' : '#94a3b8';
          return `<span style="font-size:10px;color:#C9A96E">At $${this.x.toFixed(2)}</span><br/>`
            + `<span style="font-size:15px;font-weight:800;color:${color}">${pnl >= 0 ? '+' : ''}$${pnl.toLocaleString()}</span>`;
        },
        useHTML: true,
      },
      plotOptions: {
        area: {
          threshold: 0,
          marker: { enabled: false },
          lineWidth: 2.5,
          lineJoin: 'round',
          states: { hover: { lineWidth: 3 } },
        },
      },
      series: [
        {
          name: 'P&L',
          data: payoffData,
          color: '#0B2D23',
          negativeColor: '#b03030',
          fillColor: 'rgba(11,45,35,.08)',
          negativeFillColor: 'rgba(176,48,48,.07)',
          zIndex: 2,
          showInLegend: false,
        },
        // Spot marker as scatter on top
        ...(currentPrice > 0 ? [{
          name: 'Spot · BE',
          type: 'scatter',
          data: [[currentPrice, pnlAtCurrent]],
          color: '#C9A96E',
          marker: { radius: 6, lineWidth: 2, lineColor: '#fff', symbol: 'circle' },
          zIndex: 10,
          showInLegend: false,
        }] : []),
      ],
    });

    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [payoffData, currentPrice, pnlAtCurrent, beLines]);

  if (!tile || !currentPrice || payoffData.length === 0) {
    return (
      <div className="nl-card" style={{ padding: '24px' }}>
        <p style={{ color: 'var(--nl-muted-text)', textAlign: 'center' }}>Payoff diagram not available</p>
      </div>
    );
  }

  return (
    <div className="ai-card ai-full-width">
      <div style={{ padding: '18px 24px 0' }}>
        <div style={{ fontFamily: "'Playfair Display', serif", fontSize: 18, color: '#0B2D23' }}>
          P&L at expiration — <em style={{ fontStyle: 'italic' }}>{tile.strategy || ''}</em>
        </div>
      </div>
      <div ref={containerRef} />
    </div>
  );
}

export default PayoffDiagramCard;
