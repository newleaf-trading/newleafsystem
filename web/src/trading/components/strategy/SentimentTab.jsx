export function SentimentTab({ sentiment, analysis }) {
  if (!sentiment) {
    return (
      <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af' }}>
        No sentiment data available for this tile.
      </div>
    );
  }

  const sent = analysis?._sentiment || sentiment;
  const label = sent.label || 'neutral';
  const color = label === 'bullish' ? '#1D9E75' : label === 'bearish' ? '#E24B4A' : '#6b7280';
  const modPts = sent.modifier?.points ?? sentiment.modifier ?? 0;
  const flags = sent.modifier?.flags || sentiment.flags || [];

  return (
    <div style={{
      background: `${color}06`, border: `1px solid ${color}18`,
      borderRadius: 14, padding: 24,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 36, fontWeight: 700, color }}>
          {sent.score}
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 700,
              letterSpacing: '.06em', textTransform: 'uppercase',
              background: `${color}12`, color, border: `1px solid ${color}25`,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
              {label}
            </span>
            {modPts !== 0 && (
              <span style={{ fontSize: 11, color: '#6b7280' }}>
                {modPts > 0 ? '+' : ''}{modPts} modifier
              </span>
            )}
          </div>
          {sent.summary && (
            <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, marginTop: 8 }}>
              {sent.summary}
            </p>
          )}
        </div>
      </div>

      {/* Key Drivers */}
      {sent.keyDrivers?.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{
            fontSize: 10, fontWeight: 900, letterSpacing: '.14em', textTransform: 'uppercase',
            color: 'rgba(17,24,39,0.55)', marginBottom: 10,
          }}>
            Key Drivers
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {sent.keyDrivers.map((d, i) => (
              <div key={i} style={{
                display: 'flex', gap: 8, alignItems: 'flex-start',
                padding: '8px 12px', background: '#fff', borderRadius: 10,
                border: '1px solid rgba(17,24,39,0.06)',
              }}>
                <span style={{
                  flexShrink: 0, width: 20, height: 20, borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700,
                  background: d.impact === 'positive' ? 'rgba(29,158,117,0.12)' : d.impact === 'negative' ? 'rgba(226,75,74,0.12)' : 'rgba(217,119,6,0.12)',
                  color: d.impact === 'positive' ? '#1D9E75' : d.impact === 'negative' ? '#E24B4A' : '#d97706',
                }}>
                  {d.impact === 'positive' ? '+' : d.impact === 'negative' ? '-' : '~'}
                </span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{d.factor}</div>
                  {d.detail && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{d.detail}</div>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Flags */}
      {flags.length > 0 && (
        <div>
          <div style={{
            fontSize: 10, fontWeight: 900, letterSpacing: '.14em', textTransform: 'uppercase',
            color: 'rgba(17,24,39,0.55)', marginBottom: 8,
          }}>
            Flags
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {flags.map((f, i) => (
              <span key={i} style={{
                padding: '3px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700,
                letterSpacing: '.06em', textTransform: 'uppercase',
                background: f === 'caution' ? 'rgba(217,119,6,0.10)' : f === 'suppress' ? 'rgba(201,79,79,0.10)' : 'rgba(107,114,128,0.10)',
                color: f === 'caution' ? '#d97706' : f === 'suppress' ? '#C94F4F' : '#6b7280',
                border: `1px solid ${f === 'caution' ? 'rgba(217,119,6,0.20)' : f === 'suppress' ? 'rgba(201,79,79,0.20)' : 'rgba(107,114,128,0.20)'}`,
              }}>
                {f}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
