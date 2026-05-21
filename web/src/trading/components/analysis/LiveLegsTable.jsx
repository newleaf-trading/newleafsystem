/**
 * LiveLegsTable — entry vs current premium, per-leg P&L, live Greeks.
 * Replaces LiveTradeExampleCard + Strategy Legs section.
 */
import '../../styles/ai-analysis-light.css';

const mono = "'Space Mono', monospace";

export default function LiveLegsTable({ tile, liveData }) {
  if (!tile || !liveData) return null;

  const { legDetails, liveGreeks, currentSpot, pnlPerContract, pnlResult } = liveData;
  const legs = tile.legs || [];
  const expiry = tile.expiry || '';
  const symbol = tile.symbol || '';

  if (legs.length === 0) return null;

  const entryCredit = Math.abs(liveData.pnlResult.entryNetCredit || tile.netCredit * 100 || 0);

  return (
    <div className="ai-card ai-full-width">
      <div className="ai-card-header">
        <span className="card-icon">📋</span>
        <span>STRATEGY LEGS — {symbol} {tile.strategy}</span>
      </div>

      <div style={{ padding: '0 20px', fontSize: 12, color: '#6b6b60', marginBottom: 16 }}>
        Expiry: {expiry} · {liveData.dte != null ? `${liveData.dte} DTE` : ''} · Entry credit: ${(entryCredit / 100).toFixed(2)}/share (${entryCredit.toFixed(0)}/contract)
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: "'Inter', sans-serif", fontSize: 13 }}>
          <thead>
            <tr style={{ borderBottom: '2px solid rgba(15,61,46,.12)' }}>
              <th style={thStyle}>Action</th>
              <th style={thStyle}>Strike</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Entry</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Current</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Leg P&L</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Delta</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>Theta</th>
            </tr>
          </thead>
          <tbody>
            {legs.map((leg, i) => {
              const detail = legDetails?.[i] || {};
              const greeks = liveGreeks?.perLeg?.[i] || {};
              const type = (leg.type || '').toUpperCase();
              const action = (leg.action || '').toUpperCase();
              const entryPrem = detail.entryPremium ?? leg.premium ?? 0;
              const currentPrem = detail.currentPremium;
              const legPnl = detail.legPnl || 0;
              const isBuy = action === 'BUY';

              return (
                <tr key={i} style={{ borderBottom: '1px solid rgba(15,61,46,.06)' }}>
                  <td style={tdStyle}>
                    <span style={{
                      fontFamily: mono, fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                      background: isBuy ? '#E1F5EE' : '#FEE2E2',
                      color: isBuy ? '#0F6E56' : '#B91C1C',
                    }}>{action}</span>
                  </td>
                  <td style={tdStyle}>
                    <strong>${leg.strike}</strong>
                    <span style={{ color: type === 'CALL' ? '#E24B4A' : '#1D9E75', marginLeft: 6, fontSize: 11 }}>{type}</span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontFamily: mono }}>
                    ${entryPrem.toFixed(2)}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontFamily: mono, color: currentPrem != null ? (currentPrem > entryPrem ? '#E24B4A' : '#1D9E75') : '#6b6b60' }}>
                    {currentPrem != null ? `$${currentPrem.toFixed(2)}` : '—'}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontFamily: mono, fontWeight: 600, color: legPnl > 0 ? '#1D9E75' : legPnl < 0 ? '#E24B4A' : '#6b6b60' }}>
                    {legPnl !== 0 ? `${legPnl >= 0 ? '+' : ''}$${legPnl.toFixed(0)}` : '—'}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontFamily: mono, fontSize: 11, color: '#6b6b60' }}>
                    {greeks.delta?.toFixed(3) || '—'}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontFamily: mono, fontSize: 11, color: '#6b6b60' }}>
                    {greeks.theta?.toFixed(3) || '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Net row */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 20px', borderTop: '2px solid rgba(15,61,46,.12)',
        fontWeight: 700, fontSize: 14,
      }}>
        <div style={{ display: 'flex', gap: 20 }}>
          <span>Net P&L per contract</span>
          <span style={{ fontFamily: mono, fontSize: 11, color: '#6b6b60', fontWeight: 600 }}>
            Δ {liveGreeks?.net?.delta?.toFixed(3)} · Θ {liveGreeks?.net?.theta?.toFixed(3)} · V {liveGreeks?.net?.vega?.toFixed(3)}
          </span>
        </div>
        <span style={{
          fontFamily: mono, fontSize: 16,
          color: pnlPerContract >= 0 ? '#1D9E75' : '#E24B4A',
        }}>
          {pnlPerContract >= 0 ? '+' : ''}${pnlPerContract.toFixed(0)}
        </span>
      </div>

      {/* Method badge */}
      <div style={{ padding: '8px 20px 14px', fontSize: 10, color: '#6b6b60' }}>
        Pricing: {pnlResult.method === 'live' ? '● Live option prices' : pnlResult.method === 'estimated' ? '● Black-Scholes estimate' : '● Intrinsic (at expiry)'}
        {currentSpot > 0 && ` · Spot $${currentSpot.toFixed(2)}`}
      </div>
    </div>
  );
}

const thStyle = { padding: '8px 12px', textAlign: 'left', fontFamily: "'Space Mono', monospace", fontSize: 9, letterSpacing: '.08em', textTransform: 'uppercase', color: '#6b6b60', fontWeight: 600 };
const tdStyle = { padding: '10px 12px' };
