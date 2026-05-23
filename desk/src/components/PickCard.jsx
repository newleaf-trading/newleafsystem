import { Link } from 'react-router-dom';
import { CopyButton } from './CopyButton';
import { ChannelStatus } from './ChannelStatus';

export function PickCard({ pick, onChannelUpdate }) {
  const { tile, analysis, assets, hasAnalysis, channels } = pick;

  const symbol = tile.symbol || '';
  const strategy = tile.strategy || '';
  const spot = tile.underlyingPrice || tile.currentPrice || tile.price || 0;
  const maxProfit = tile.maxProfit || 0;
  const maxLoss = tile.maxLoss || 0;
  const rr = tile.rewardRisk || 0;
  const pop = tile.oddsOfProfit || tile.probOfProfit || 0;
  const dte = tile.dte || tile.daysToExpiry || 0;

  const ti = analysis?.technicalIndicators;
  const rsi = ti?.rsi?.value;
  const macd = ti?.macd;
  const sentiment = tile.sentiment || analysis?._sentiment || null;
  const sentScore = sentiment?.composite?.score ?? sentiment?.score ?? null;
  const sentLabel = sentiment?.composite?.label ?? sentiment?.label ?? null;

  return (
    <div className="dk-pick-card">
      <div className="dk-pick-card-header">
        <div>
          <span className="dk-pick-symbol">{symbol}</span>
          <span className="dk-pick-price"> ${spot.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="dk-pick-strategy">{strategy}</span>
          <span style={{ fontSize: 11, color: '#6b7280' }}>{dte} DTE</span>
        </div>
      </div>

      <div className="dk-pick-card-body">
        {/* Metrics */}
        <div className="dk-pick-metrics">
          <div className="dk-metric">
            <div className="dk-metric-label">Max Profit</div>
            <div className="dk-metric-value green">${maxProfit.toFixed(0)}</div>
          </div>
          <div className="dk-metric">
            <div className="dk-metric-label">Max Loss</div>
            <div className="dk-metric-value red">${maxLoss.toFixed(0)}</div>
          </div>
          <div className="dk-metric">
            <div className="dk-metric-label">R:R</div>
            <div className="dk-metric-value">{rr.toFixed(2)}x</div>
          </div>
          <div className="dk-metric">
            <div className="dk-metric-label">PoP</div>
            <div className="dk-metric-value">{pop}%</div>
          </div>
        </div>

        {/* Indicators row */}
        {ti && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 10, fontSize: 11, color: '#6b7280' }}>
            {rsi != null && <span>RSI: <strong>{rsi}</strong></span>}
            {macd && <span>MACD: <strong>{macd.macdLine}</strong></span>}
            {sentScore != null && <span>Sent: <strong style={{ color: sentLabel === 'bullish' ? '#16a34a' : sentLabel === 'bearish' ? '#dc2626' : '#6b7280' }}>{sentLabel} {sentScore}</strong></span>}
          </div>
        )}

        {/* Channel Status */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#6b7280', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.5 }}>
            Publishing Status
          </div>
          <ChannelStatus
            channels={channels}
            compact={true}
            onStatusChange={onChannelUpdate ? (ch, st) => onChannelUpdate(pick.tileId, ch, st) : null}
          />
        </div>

        {/* Action */}
        <div style={{ textAlign: 'center' }}>
          <Link to={`/pick/${pick.tileId}`} className="dk-btn dk-btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>
            Open Detail
          </Link>
        </div>
      </div>
    </div>
  );
}
