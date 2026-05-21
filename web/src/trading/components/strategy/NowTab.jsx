import { VERDICT_STATES } from '../../hooks/useVerdict';
import { cardBase, metaLabel, sectionH3, fmt, ChangeTile } from './shared';

export function NowTab({ liveData, portfolioItem, tile, verdict, symbol, strategy, greeks }) {
  const entry = portfolioItem || {};
  const entrySpot = liveData.entrySpot || entry.entryUnderlyingPrice || 0;
  const currentSpot = liveData.currentSpot || 0;
  const deltas = liveData.liveGreeks?.net || {};
  const entryDelta = greeks.netDelta || 0;
  const entryTheta = greeks.netTheta || 0;

  const showThesisBroken = verdict.state === VERDICT_STATES.MONITOR
    || verdict.state === VERDICT_STATES.ACTION_NEEDED
    || verdict.state === VERDICT_STATES.EXIT;

  return (
    <div>
      <h3 style={sectionH3}>What's Changed Since Entry</h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 24 }}>
        <ChangeTile label="Spot Price" entry={entrySpot > 0 ? `$${entrySpot.toFixed(2)}` : '--'} current={currentSpot > 0 ? `$${currentSpot.toFixed(2)}` : '--'} pctChange={liveData.priceMove} />
        <ChangeTile label="Net Delta" entry={entryDelta.toFixed(3)} current={(deltas.delta || 0).toFixed(3)} pctChange={entryDelta !== 0 ? ((deltas.delta - entryDelta) / Math.abs(entryDelta)) * 100 : 0} />
        <ChangeTile label="Net Theta" entry={`$${entryTheta.toFixed(2)}`} current={`$${(deltas.theta || 0).toFixed(2)}`} />
        <ChangeTile label="P&L Progress" entry="Entry" current={`${liveData.profitCapturePct}%`} pctChange={liveData.profitCapturePct} />
      </div>

      {/* Progress bar */}
      <div style={{ ...cardBase, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ ...metaLabel, marginBottom: 0 }}>P&L Progress</span>
          <span style={{ fontSize: 12, fontWeight: 700, color: liveData.pnlPerContract >= 0 ? '#0B7A52' : '#C94F4F' }}>
            {liveData.profitCapturePct}% of max profit
          </span>
        </div>
        <div style={{ height: 8, background: 'rgba(17,24,39,0.08)', borderRadius: 999, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 999, transition: 'width 0.3s ease',
            width: `${Math.max(0, Math.min(100, liveData.progressPct))}%`,
            background: liveData.pnlPerContract >= 0
              ? 'linear-gradient(90deg, #10b981, #34d399)'
              : 'linear-gradient(90deg, #ef4444, #f87171)',
          }} />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4, fontSize: 10, color: '#9ca3af' }}>
          <span>Max loss ({fmt(liveData.maxLoss)})</span>
          <span>Max profit ({fmt(liveData.maxProfit)})</span>
        </div>
      </div>

      {showThesisBroken && (
        <div style={{ ...cardBase, borderLeft: '3px solid rgba(201,79,79,0.4)', background: 'rgba(201,79,79,0.04)' }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: '#C94F4F', marginBottom: 6 }}>What Broke the Thesis</div>
          <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, margin: 0 }}>{verdict.reason}</p>
        </div>
      )}
    </div>
  );
}
