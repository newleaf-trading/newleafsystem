import { PayoffChart } from '../PayoffChart';
import { getStrategyTheme } from '../../utils/strategyThemes';
import { cardBase, metaLabel, sectionH3, fmt } from './shared';

export function ManageChartTab({ tile, spotPrice, maxProfit, maxLoss, metrics, liveData, strategy }) {
  return (
    <div>
      <h3 style={sectionH3}>P&L at Expiration</h3>
      <div style={{ ...cardBase, padding: 0, overflow: 'hidden', minHeight: 320 }}>
        <PayoffChart legs={tile.legs || []} spotPrice={spotPrice} height={280} accentColor={getStrategyTheme(strategy || tile.strategy).primary} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 16 }}>
        <div style={cardBase}>
          <div style={metaLabel}>Entry Price</div>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 16, fontWeight: 700, color: '#111827' }}>${liveData.entrySpot > 0 ? liveData.entrySpot.toFixed(2) : '--'}</div>
        </div>
        <div style={cardBase}>
          <div style={metaLabel}>Current Price</div>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 16, fontWeight: 700, color: '#111827' }}>${spotPrice > 0 ? spotPrice.toFixed(2) : '--'}</div>
        </div>
        <div style={cardBase}>
          <div style={metaLabel}>Price Move</div>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 16, fontWeight: 700, color: liveData.priceMove >= 0 ? '#0B7A52' : '#C94F4F' }}>
            {liveData.priceMove >= 0 ? '+' : ''}{liveData.priceMove.toFixed(1)}%
          </div>
        </div>
        <div style={cardBase}>
          <div style={metaLabel}>Breakevens</div>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 14, fontWeight: 700, color: '#111827' }}>
            {(metrics.breakevens || []).map(b => `$${b.toFixed(0)}`).join(' / ') || '--'}
          </div>
        </div>
      </div>

      {liveData.riskScenarios.length > 0 && (
        <div style={{ marginTop: 24 }}>
          <h3 style={sectionH3}>Risk Scenarios</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
            {liveData.riskScenarios.map((s, i) => (
              <div key={i} style={{ ...cardBase, borderTop: `3px solid ${i === 0 ? '#0B7A52' : i === 1 ? '#9ca3af' : '#C94F4F'}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ ...metaLabel, marginBottom: 0 }}>{s.label}</span>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, color: '#6b7280' }}>{s.pct}</span>
                </div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 20, fontWeight: 700, color: s.pnl >= 0 ? '#0B7A52' : '#C94F4F', marginBottom: 4 }}>
                  {s.pnl >= 0 ? '+' : ''}{fmt(s.pnl)}
                </div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>{s.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
