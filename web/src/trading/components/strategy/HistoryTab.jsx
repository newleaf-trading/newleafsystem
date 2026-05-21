import { formatStrategy } from '../../utils/formatters';
import { cardBase, metaLabel, sectionH3, placeholder, fmt } from './shared';

export function HistoryTab({ portfolioItem, liveData, symbol, strategy }) {
  const entry = portfolioItem || {};
  const entryDate = entry.entryDate || entry.addedAt?.toDate?.()?.toLocaleDateString('en-US') || '--';
  const entryCredit = Math.abs(entry.entryNetCredit || 0);

  return (
    <div>
      <h3 style={sectionH3}>Position Timeline</h3>

      <div style={{ position: 'relative', paddingLeft: 24 }}>
        <div style={{ position: 'absolute', left: 7, top: 8, bottom: 0, width: 2, background: 'rgba(17,24,39,0.08)' }} />

        {/* Entry event */}
        <div style={{ position: 'relative', marginBottom: 20 }}>
          <div style={{
            position: 'absolute', left: -20, top: 6, width: 10, height: 10,
            borderRadius: '50%', background: '#0B7A52', border: '2px solid #fff',
            boxShadow: '0 0 0 2px rgba(11,122,82,0.2)',
          }} />
          <div style={cardBase}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ ...metaLabel, marginBottom: 0 }}>Position Opened</span>
              <span style={{ fontSize: 12, color: '#6b7280' }}>{entryDate}</span>
            </div>
            <div style={{ fontSize: 14, color: '#111827', lineHeight: 1.6 }}>
              Entered {formatStrategy(strategy)} on {symbol} at ${liveData.entrySpot > 0 ? liveData.entrySpot.toFixed(2) : '--'}.
              {entryCredit > 0 && ` Net credit received: $${(entryCredit / 100).toFixed(2)}/share ($${entryCredit.toFixed(0)}/contract).`}
              {' '}Quantity: {entry.quantity || 1} contract{(entry.quantity || 1) !== 1 ? 's' : ''}.
            </div>
          </div>
        </div>

        {/* Current state */}
        <div style={{ position: 'relative' }}>
          <div style={{
            position: 'absolute', left: -20, top: 6, width: 10, height: 10,
            borderRadius: '50%',
            background: liveData.pnlPerContract >= 0 ? '#0B7A52' : '#C94F4F',
            border: '2px solid #fff',
            boxShadow: `0 0 0 2px ${liveData.pnlPerContract >= 0 ? 'rgba(11,122,82,0.2)' : 'rgba(201,79,79,0.2)'}`,
          }} />
          <div style={cardBase}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ ...metaLabel, marginBottom: 0 }}>Current State</span>
              <span style={{ fontSize: 12, color: '#6b7280' }}>{liveData.dte != null ? `${liveData.dte} days remaining` : '--'}</span>
            </div>
            <div style={{ fontSize: 14, color: '#111827', lineHeight: 1.6 }}>
              Unrealized P&L: {liveData.pnlPerContract >= 0 ? '+' : ''}{fmt(liveData.pnlPerContract)}/contract.
              Spot at ${liveData.currentSpot > 0 ? liveData.currentSpot.toFixed(2) : '--'}
              {' '}({liveData.priceMove >= 0 ? '+' : ''}{liveData.priceMove.toFixed(1)}% from entry).
            </div>
          </div>
        </div>
      </div>

      <div style={{ ...placeholder, paddingTop: 24 }}>
        <p style={{ fontSize: 12, color: '#9ca3af' }}>
          Prior adjustments and P&L path chart will be populated when adjustment history is tracked (Phase 6).
        </p>
      </div>
    </div>
  );
}
