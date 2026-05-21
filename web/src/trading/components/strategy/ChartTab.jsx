import { PayoffChart } from '../PayoffChart';
import { getStrategyTheme } from '../../utils/strategyThemes';
import { cardBase, metaLabel, sectionH3, fmt } from './shared';

export function ChartTab({ tile, spotPrice, maxProfit, maxLoss, metrics, strategy }) {
  return (
    <div>
      <h3 style={sectionH3}>P&L at Expiration</h3>
      <div style={{ ...cardBase, padding: 0, overflow: 'hidden', minHeight: 320 }}>
        <PayoffChart legs={tile.legs || []} spotPrice={spotPrice} height={280} accentColor={getStrategyTheme(strategy || tile.strategy).primary} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 16 }}>
        <div style={cardBase}>
          <div style={metaLabel}>Max Profit</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#0B7A52' }}>{fmt(maxProfit)}</div>
        </div>
        <div style={cardBase}>
          <div style={metaLabel}>Max Loss</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#C94F4F' }}>{fmt(maxLoss)}</div>
        </div>
        <div style={cardBase}>
          <div style={metaLabel}>Breakevens</div>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 14, fontWeight: 700, color: '#111827' }}>
            {(metrics.breakevens || []).map(b => `$${b.toFixed(0)}`).join(' / ') || '--'}
          </div>
        </div>
      </div>
    </div>
  );
}
