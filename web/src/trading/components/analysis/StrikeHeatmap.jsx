import { useRef, useEffect, useMemo } from 'react';
import Highcharts from 'highcharts';

/**
 * StrikeHeatmap — Highcharts bar chart showing volume + OI by strike.
 * Uses option chain data aggregated by strike for near-money strikes.
 */
export default function StrikeHeatmap({ data, optionChain }) {
  const containerRef = useRef(null);
  const chartRef = useRef(null);

  // Aggregate option chain by strike (near spot only)
  const strikeData = useMemo(() => {
    const chain = optionChain || [];
    if (chain.length === 0 && data?.top_strikes?.length > 0) {
      // Fallback to top_strikes if no option chain
      return data.top_strikes
        .map(s => ({ strike: s.strike, callVol: s.callVolume || 0, putVol: s.putVolume || 0, callOi: s.callOi || 0, putOi: s.putOi || 0 }))
        .filter(s => s.callVol > 0 || s.putVol > 0 || s.callOi > 0 || s.putOi > 0)
        .sort((a, b) => a.strike - b.strike);
    }

    const spot = data?.spot || 0;
    const byStrike = {};

    for (const c of chain) {
      // Only show strikes within 5% of spot
      if (spot && (Math.abs(c.strike - spot) / spot) > 0.05) continue;

      const k = c.strike;
      if (!byStrike[k]) byStrike[k] = { strike: k, callVol: 0, putVol: 0, callOi: 0, putOi: 0 };
      if (c.type === 'call') {
        byStrike[k].callVol += c.volume || 0;
        byStrike[k].callOi += c.openInterest || 0;
      } else {
        byStrike[k].putVol += c.volume || 0;
        byStrike[k].putOi += c.openInterest || 0;
      }
    }

    return Object.values(byStrike)
      .filter(s => s.callVol > 0 || s.putVol > 0 || s.callOi > 0 || s.putOi > 0)
      .sort((a, b) => a.strike - b.strike);
  }, [data, optionChain]);

  useEffect(() => {
    if (!containerRef.current || strikeData.length === 0) return;

    const { spot, put_wall, call_wall } = data || {};
    const categories = strikeData.map(s => `$${s.strike}`);

    // Find indices for reference lines
    const findIdx = (price) => {
      if (!price) return null;
      let best = 0, bestDist = Infinity;
      strikeData.forEach((s, i) => { const d = Math.abs(s.strike - price); if (d < bestDist) { bestDist = d; best = i; } });
      return best;
    };

    const plotLines = [
      spot && { value: findIdx(spot), color: '#0B2D23', width: 2, dashStyle: 'Solid', label: { text: `Spot`, style: { color: '#0B2D23', fontWeight: '800', fontSize: '10px' } }, zIndex: 5 },
      put_wall && { value: findIdx(put_wall), color: '#ef4444', width: 1.5, dashStyle: 'Dash', label: { text: `Put Wall`, style: { color: '#ef4444', fontWeight: '700', fontSize: '10px' } }, zIndex: 4 },
      call_wall && { value: findIdx(call_wall), color: '#22c55e', width: 1.5, dashStyle: 'Dash', label: { text: `Call Wall`, style: { color: '#22c55e', fontWeight: '700', fontSize: '10px' } }, zIndex: 4 },
    ].filter(Boolean);

    chartRef.current = Highcharts.chart(containerRef.current, {
      chart: { type: 'bar', height: Math.max(320, strikeData.length * 22), style: { fontFamily: 'inherit' }, backgroundColor: 'transparent' },
      title: { text: null },
      credits: { enabled: false },
      xAxis: {
        categories,
        crosshair: true,
        lineColor: '#e2e8f0',
        labels: { style: { color: '#64748b', fontSize: '11px', fontWeight: '600' } },
        plotLines,
      },
      yAxis: {
        min: 0,
        title: { text: null },
        gridLineColor: '#f1f5f9',
        labels: { style: { color: '#94a3b8', fontSize: '10px' }, formatter() { return Highcharts.numberFormat(this.value, 0, '.', ','); } },
      },
      tooltip: {
        shared: true,
        backgroundColor: 'rgba(15, 23, 42, 0.95)',
        borderColor: 'transparent',
        borderRadius: 8,
        style: { color: '#fff', fontSize: '12px' },
        headerFormat: '<b>{point.key}</b><br/>',
        pointFormat: '<span style="color:{series.color}">\u25CF</span> {series.name}: <b>{point.y:,.0f}</b><br/>',
      },
      plotOptions: {
        bar: {
          borderRadius: 2,
          borderWidth: 0,
          groupPadding: 0.08,
          pointPadding: 0.02,
        },
      },
      legend: {
        align: 'right', verticalAlign: 'top', floating: true, y: -8,
        itemStyle: { color: '#64748b', fontWeight: '600', fontSize: '11px' },
      },
      series: [
        { name: 'Call Volume', data: strikeData.map(s => s.callVol), color: '#22c55e' },
        { name: 'Put Volume', data: strikeData.map(s => s.putVol), color: '#ef4444' },
      ],
    });

    return () => { if (chartRef.current) chartRef.current.destroy(); };
  }, [data, strikeData]);

  if (strikeData.length === 0) {
    return (
      <div className="nl-card" style={{ padding: 24, textAlign: 'center', color: '#94a3b8' }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Volume by Strike</div>
        <div style={{ fontSize: 12 }}>No volume data available for near-money strikes</div>
      </div>
    );
  }

  return (
    <div className="nl-card" style={{ padding: '20px' }}>
      <h3 style={{ fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--nl-muted-text)', fontWeight: '700', margin: '0 0 4px' }}>
        Volume by Strike
      </h3>
      <div ref={containerRef} />
    </div>
  );
}
