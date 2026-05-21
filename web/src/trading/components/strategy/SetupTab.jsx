import { cardBase, metaLabel, sectionH3, thStyle, tdStyle, fmt } from './shared';

export function SetupTab({ tile, legs, netCredit, isCredit, metrics, spotPrice, strikeComparison, onCompareStrikes }) {
  const breakevens = metrics.breakevens || [];
  const { alternatives = [], reasoning = '', loading: strikeLoading = false, error: strikeError = null } = strikeComparison || {};

  return (
    <div>
      {/* Legs table */}
      <div style={{ marginBottom: 24 }}>
        <h3 style={sectionH3}>Position Legs</h3>
        <div style={{ border: '1px solid rgba(17,24,39,0.10)', borderRadius: 16, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'rgba(247,248,250,0.75)' }}>
                {['Action', 'Type', 'Strike', 'Expiry', 'Premium', 'Delta'].map(h => (
                  <th key={h} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {legs.map((leg, i) => (
                <tr key={i} style={{ borderBottom: '1px solid rgba(17,24,39,0.06)' }}>
                  <td style={tdStyle}>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                      fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                      background: leg.action === 'sell' ? 'rgba(201,79,79,0.10)' : 'rgba(11,122,82,0.10)',
                      color: leg.action === 'sell' ? '#C94F4F' : '#0B7A52',
                    }}>
                      {leg.action}
                    </span>
                  </td>
                  <td style={tdStyle}>{(leg.type || '').toUpperCase()}</td>
                  <td style={{ ...tdStyle, fontFamily: "'Space Mono', monospace", fontWeight: 700 }}>${leg.strike}</td>
                  <td style={tdStyle}>{leg.expiry || '--'}</td>
                  <td style={{ ...tdStyle, fontFamily: "'Space Mono', monospace" }}>{leg.premium ? `$${leg.premium.toFixed(2)}` : '--'}</td>
                  <td style={{ ...tdStyle, fontFamily: "'Space Mono', monospace" }}>{leg.delta ? leg.delta.toFixed(2) : '--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Strike Comparison */}
      <div style={{ marginBottom: 24 }}>
        {alternatives.length === 0 && !strikeLoading && (
          <button
            onClick={onCompareStrikes}
            disabled={strikeLoading}
            style={{
              padding: '10px 20px', background: 'rgba(11,45,35,0.06)', color: '#0B2D23',
              border: '1px solid rgba(11,45,35,0.18)', borderRadius: 10, fontSize: 13,
              fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(11,45,35,0.12)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(11,45,35,0.06)'; }}
          >
            <span style={{ fontSize: 15 }}>&#x2696;</span> Compare Alternative Strikes
          </button>
        )}
        {strikeLoading && (
          <div style={{ padding: '20px 0', display: 'flex', alignItems: 'center', gap: 10, color: '#6b7280', fontSize: 13 }}>
            <span style={{
              display: 'inline-block', width: 16, height: 16, border: '2px solid rgba(11,45,35,0.2)',
              borderTopColor: '#0B2D23', borderRadius: '50%',
              animation: 'strikeCompSpin 0.8s linear infinite',
            }} />
            Analyzing alternative strikes...
            <style>{`@keyframes strikeCompSpin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}
        {strikeError && (
          <div style={{
            padding: '10px 14px', background: 'rgba(201,79,79,0.06)', border: '1px solid rgba(201,79,79,0.15)',
            borderRadius: 10, fontSize: 13, color: '#C94F4F', marginBottom: 12,
          }}>
            Failed to load alternatives: {strikeError}
          </div>
        )}
        {alternatives.length > 0 && (
          <div>
            <h3 style={sectionH3}>Alternative Strike Selections</h3>
            {reasoning && <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.6, marginBottom: 16 }}>{reasoning}</p>}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
              {alternatives.slice(0, 3).map((alt, i) => {
                const isRecommended = alt.recommended || alt.isRecommended;
                return (
                  <div key={i} style={{
                    background: '#fff',
                    border: isRecommended ? '2px solid rgba(11,122,82,0.45)' : '1px solid rgba(17,24,39,0.10)',
                    borderRadius: 16, padding: 16, position: 'relative',
                    boxShadow: isRecommended ? '0 4px 16px rgba(11,122,82,0.10)' : 'none',
                  }}>
                    {isRecommended && (
                      <div style={{
                        position: 'absolute', top: -1, left: 20, padding: '2px 10px',
                        background: '#0B7A52', color: '#fff', fontSize: 9, fontWeight: 800,
                        letterSpacing: '.1em', textTransform: 'uppercase', borderRadius: '0 0 6px 6px',
                      }}>
                        Recommended
                      </div>
                    )}
                    <div style={{ fontSize: 14, fontWeight: 700, color: '#0B2D23', marginBottom: 8, marginTop: isRecommended ? 6 : 0 }}>
                      {alt.name || `Alternative ${i + 1}`}
                    </div>
                    {alt.legsDiff && (
                      <div style={{ fontSize: 12, color: '#374151', lineHeight: 1.6, marginBottom: 10, padding: '8px 10px', background: 'rgba(247,248,250,0.75)', borderRadius: 8 }}>
                        {Array.isArray(alt.legsDiff) ? alt.legsDiff.map((d, j) => <div key={j}>{d}</div>) : <span>{alt.legsDiff}</span>}
                      </div>
                    )}
                    {alt.tradeoff && <p style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5, marginBottom: 10 }}>{alt.tradeoff}</p>}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {alt.pop != null && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                          <span style={{ color: '#9ca3af', fontWeight: 600 }}>PoP</span>
                          <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, color: '#0B2D23' }}>{typeof alt.pop === 'number' ? `${alt.pop.toFixed(0)}%` : alt.pop}</span>
                        </div>
                      )}
                      {alt.maxProfit != null && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                          <span style={{ color: '#9ca3af', fontWeight: 600 }}>Max Profit</span>
                          <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, color: '#0B7A52' }}>{typeof alt.maxProfit === 'number' ? fmt(alt.maxProfit) : alt.maxProfit}</span>
                        </div>
                      )}
                      {alt.maxLoss != null && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                          <span style={{ color: '#9ca3af', fontWeight: 600 }}>Max Loss</span>
                          <span style={{ fontFamily: "'Space Mono', monospace", fontWeight: 700, color: '#C94F4F' }}>{typeof alt.maxLoss === 'number' ? fmt(alt.maxLoss) : alt.maxLoss}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Net credit/debit + profit zone */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div style={{
          ...cardBase,
          background: isCredit ? 'rgba(11,122,82,0.06)' : 'rgba(201,79,79,0.06)',
          borderColor: isCredit ? 'rgba(11,122,82,0.15)' : 'rgba(201,79,79,0.15)',
        }}>
          <div style={metaLabel}>Net {isCredit ? 'Credit' : 'Debit'}</div>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 22, fontWeight: 700, color: isCredit ? '#0B7A52' : '#C94F4F' }}>
            ${Math.abs(netCredit * 100).toFixed(0)}
          </div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>per contract ({isCredit ? 'received' : 'paid'})</div>
        </div>
        <div style={cardBase}>
          <div style={metaLabel}>Profit Zone</div>
          {breakevens.length > 0 ? (
            <>
              <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 16, fontWeight: 700, color: '#111827' }}>
                {breakevens.length === 2 ? `$${breakevens[0].toFixed(0)} – $${breakevens[1].toFixed(0)}` : breakevens.length === 1 ? `Above $${breakevens[0].toFixed(0)}` : '--'}
              </div>
              {spotPrice > 0 && <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>Current: ${spotPrice.toFixed(2)}</div>}
            </>
          ) : (
            <div style={{ fontSize: 14, color: '#9ca3af' }}>Breakeven data not available</div>
          )}
        </div>
      </div>
    </div>
  );
}
