import "../../styles/ai-analysis-light.css";
import { ArrowUp, ArrowDown } from 'lucide-react';

/**
 * LiveTradeExampleCard - Shows actual trade setup with real strikes and legs
 * Dark theme with Space Mono typography
 */
export function LiveTradeExampleCard({ tile, currentPrice }) {
  if (!tile || !tile.legs || tile.legs.length === 0) return null;

  const { strategy, symbol, legs } = tile;

  // Calculate net credit/debit
  const calculateNetPremium = () => {
    let net = 0;
    legs.forEach(leg => {
      if (leg.premium) {
        const premium = leg.premium;
        const isSell = leg.action?.toLowerCase() === 'sell';
        net += isSell ? premium : -premium;
      }
    });
    return net;
  };

  const netPremium = calculateNetPremium();

  return (
    <div className="ai-card">
      <div className="ai-card-header">
        <span className="card-icon">📝</span>
        <span>LIVE TRADE EXAMPLE</span>
      </div>

      <p style={{ marginBottom: '16px', fontSize: '14px', color: 'var(--ai-text-primary)' }}>
        Based on current {symbol} price of <strong style={{ color: 'var(--ai-primary-gold)' }}>${currentPrice?.toFixed(2) || 'N/A'}</strong>:
      </p>

      <table className="ai-table">
        <thead>
          <tr>
            <th>Leg</th>
            <th>Strike</th>
            <th>Type</th>
            <th>Action</th>
            <th>Premium</th>
          </tr>
        </thead>
        <tbody>
          {legs.map((leg, idx) => {
            const isSell = leg.action?.toLowerCase() === 'sell';
            const isCall = leg.type?.toLowerCase() === 'call';
            return (
              <tr key={idx}>
                <td style={{ fontWeight: '600' }}>{idx + 1}</td>
                <td style={{ fontWeight: '700', fontSize: '15px' }}>${leg.strike}</td>
                <td style={{
                  color: isCall ? 'var(--ai-info)' : '#ec4899',
                  fontWeight: '600'
                }}>
                  {leg.type?.toUpperCase()}
                </td>
                <td>
                  <span className={isSell ? 'ai-action-sell' : 'ai-action-buy'}>
                    {isSell ? <ArrowDown size={14} /> : <ArrowUp size={14} />}
                    {leg.action?.toUpperCase() || 'BUY'}
                  </span>
                </td>
                <td style={{
                  color: isSell ? 'var(--ai-success)' : 'var(--ai-danger)',
                  fontWeight: '700'
                }}>
                  {leg.premium ? (
                    isSell ? `+$${leg.premium.toFixed(2)}` : `-$${leg.premium.toFixed(2)}`
                  ) : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {netPremium !== 0 && (
        <div style={{
          background: 'var(--ai-accent-bg)',
          padding: '14px 18px',
          borderRadius: '8px',
          marginTop: '20px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <strong style={{ fontSize: '14px', color: 'var(--ai-text-primary)' }}>
              Net {netPremium > 0 ? 'Credit' : 'Debit'}:
            </strong>
            <span style={{
              color: netPremium > 0 ? 'var(--ai-success)' : 'var(--ai-danger)',
              fontSize: '20px',
              fontWeight: '900',
              fontFamily: "'Space Mono', monospace"
            }}>
              ${Math.abs(netPremium).toFixed(2)}
            </span>
          </div>
          <div style={{
            fontSize: '12px',
            color: 'var(--ai-text-muted)',
            marginTop: '6px'
          }}>
            (${Math.abs(netPremium * 100).toFixed(0)} per contract)
          </div>
        </div>
      )}
    </div>
  );
}

export default LiveTradeExampleCard;
