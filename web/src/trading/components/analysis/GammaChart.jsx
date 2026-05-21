import { useState, useRef, useEffect, useMemo } from 'react';
import Highcharts from 'highcharts';

/**
 * GammaChart — Highcharts bar chart showing gamma exposure by strike.
 * Computes GEX from option chain (uses volume×gamma when OI is zero).
 */
export default function GammaChart({ data, optionChain }) {
  const [mode, setMode] = useState('net'); // net | call | put
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  // Build strike-level GEX data from option chain
  const strikeData = useMemo(() => {
    const chain = optionChain || [];
    const spot = data?.spot || 0;
    if (chain.length === 0 || !spot) {
      // Fallback to top_strikes
      return (data?.top_strikes || []).sort((a, b) => a.strike - b.strike);
    }

    const byStrike = {};
    for (const c of chain) {
      if (Math.abs(c.strike - spot) / spot > 0.05) continue;
      const k = c.strike;
      if (!byStrike[k]) byStrike[k] = { strike: k, callGex: 0, putGex: 0, netGex: 0 };
      const gamma = c.gamma || 0;
      // Use OI if available, otherwise use volume as proxy
      const size = (c.openInterest || 0) > 0 ? c.openInterest : (c.volume || 0);
      const gex = gamma * size * spot * spot * 0.01;
      if (c.type === 'call') {
        byStrike[k].callGex += gex;
      } else {
        byStrike[k].putGex -= gex; // Put GEX is negative
      }
      byStrike[k].netGex = byStrike[k].callGex + byStrike[k].putGex;
    }

    return Object.values(byStrike)
      .filter(s => Math.abs(s.netGex) > 0 || Math.abs(s.callGex) > 0 || Math.abs(s.putGex) > 0)
      .sort((a, b) => a.strike - b.strike);
  }, [data, optionChain]);

  useEffect(() => {
    if (!containerRef.current || strikeData.length === 0) return;

    const { spot, put_wall, call_wall, center } = data || {};
    const sorted = strikeData;
    const categories = sorted.map(s => `$${s.strike}`);

    const getValues = () => {
      if (mode === 'call') return sorted.map(s => s.callGex || 0);
      if (mode === 'put') return sorted.map(s => s.putGex || 0);
      return sorted.map(s => s.netGex || 0);
    };
    const values = getValues();
    const colors = values.map(v => v >= 0 ? '#22c55e' : '#ef4444');

    const findIdx = (price) => {
      if (!price) return null;
      let best = 0, bestDist = Infinity;
      sorted.forEach((s, i) => { const d = Math.abs(s.strike - price); if (d < bestDist) { bestDist = d; best = i; } });
      return best;
    };

    const plotLines = [
      put_wall && { value: findIdx(put_wall), color: '#ef4444', width: 2, dashStyle: 'Dash', label: { text: `Put $${put_wall}`, style: { color: '#ef4444', fontWeight: '700', fontSize: '10px' } }, zIndex: 5 },
      call_wall && { value: findIdx(call_wall), color: '#22c55e', width: 2, dashStyle: 'Dash', label: { text: `Call $${call_wall}`, style: { color: '#22c55e', fontWeight: '700', fontSize: '10px' } }, zIndex: 5 },
      center && { value: findIdx(center), color: '#3b82f6', width: 1.5, dashStyle: 'ShortDot', zIndex: 4 },
      spot && { value: findIdx(spot), color: '#0B2D23', width: 2.5, dashStyle: 'Solid', label: { text: `Spot`, style: { color: '#0B2D23', fontWeight: '800', fontSize: '10px' } }, zIndex: 6 },
    ].filter(Boolean);

    chartRef.current = Highcharts.chart(containerRef.current, {
      chart: { type: 'column', height: 380, style: { fontFamily: 'inherit' }, backgroundColor: 'transparent', spacingBottom: 12 },
      title: { text: null },
      credits: { enabled: false },
      legend: { enabled: false },
      xAxis: {
        categories,
        crosshair: true,
        lineColor: '#e2e8f0',
        tickColor: '#e2e8f0',
        labels: { rotation: -45, style: { color: '#64748b', fontSize: '10px', fontWeight: '600' } },
        plotLines,
      },
      yAxis: {
        title: { text: null },
        gridLineColor: '#f1f5f9',
        labels: {
          style: { color: '#94a3b8', fontSize: '10px' },
          formatter() {
            const abs = Math.abs(this.value);
            if (abs >= 1e6) return (this.value / 1e6).toFixed(1) + 'M';
            if (abs >= 1e3) return (this.value / 1e3).toFixed(0) + 'K';
            return Highcharts.numberFormat(this.value, 0);
          },
        },
        plotLines: [{ value: 0, color: '#94a3b8', width: 1, zIndex: 2 }],
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: 'transparent',
        borderRadius: 8,
        style: { color: '#fff', fontSize: '12px' },
        formatter() {
          const s = sorted[this.point.index];
          const fmt = (v) => {
            const abs = Math.abs(v);
            if (abs >= 1e6) return (v / 1e6).toFixed(2) + 'M';
            if (abs >= 1e3) return (v / 1e3).toFixed(1) + 'K';
            return v.toFixed(0);
          };
          return `<b>${this.x}</b><br/>` +
            `Call GEX: <span style="color:#22c55e"><b>${fmt(s.callGex)}</b></span><br/>` +
            `Put GEX: <span style="color:#ef4444"><b>${fmt(s.putGex)}</b></span><br/>` +
            `Net GEX: <b>${fmt(s.netGex)}</b>`;
        },
      },
      plotOptions: {
        column: {
          borderRadius: 3, borderWidth: 0,
          colorByPoint: mode === 'net',
          groupPadding: 0.05, pointPadding: 0.05,
        },
      },
      series: [{
        name: mode === 'net' ? 'Net GEX' : mode === 'call' ? 'Call GEX' : 'Put GEX',
        data: values.map((v, i) => ({
          y: v,
          color: mode === 'net' ? colors[i] : mode === 'call' ? '#22c55e' : '#ef4444',
        })),
      }],
    });

    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [data, strikeData, mode]);

  if (strikeData.length === 0) {
    return (
      <div className="nl-card" style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>
        No gamma exposure data available
      </div>
    );
  }

  const hasOI = (optionChain || []).some(c => (c.openInterest || 0) > 0);

  const modes = [
    { key: 'net', label: 'Net GEX' },
    { key: 'call', label: 'Call GEX' },
    { key: 'put', label: 'Put GEX' },
  ];

  return (
    <div className="nl-card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
        <h3 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--nl-muted-text)', fontWeight: '700', margin: 0 }}>
          Gamma Exposure by Strike
        </h3>
        <div style={{ display: 'flex', gap: '4px' }}>
          {modes.map(m => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                border: mode === m.key ? '1.5px solid #0B2D23' : '1.5px solid #e2e8f0',
                background: mode === m.key ? '#0B2D23' : '#fff',
                color: mode === m.key ? '#fff' : '#64748b',
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>
      {!hasOI && (
        <div style={{ fontSize: 11, color: '#94a3b8', marginBottom: 4 }}>
          Using volume × gamma as proxy (OI data unavailable)
        </div>
      )}
      <div ref={containerRef} />
    </div>
  );
}
