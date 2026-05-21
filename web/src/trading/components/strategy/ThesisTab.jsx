import { formatStrategy } from '../../utils/formatters';
import { sectionH3, placeholder, TechTile } from './shared';

export function ThesisTab({ analysis, analysisLoading, strategy }) {
  if (analysisLoading) return <div style={placeholder}>Loading analysis...</div>;
  if (!analysis?.strategyRationale) return <div style={placeholder}>Deep analysis not yet available for this strategy. Analysis is generated during market scans.</div>;

  const { whyThisStrategy, whyTheseStrikes, whyThisExpiry, alternativesConsidered } = analysis.strategyRationale;
  const ti = analysis.technicalIndicators;

  return (
    <div>
      {[
        { title: `Why ${formatStrategy(strategy)}?`, text: whyThisStrategy },
        { title: 'Why these strikes?', text: whyTheseStrikes },
        { title: 'Why this expiry?', text: whyThisExpiry },
      ].filter(b => b.text).map((block, i) => (
        <div key={i} style={{ marginBottom: 20 }}>
          <h3 style={sectionH3}>{block.title}</h3>
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.7 }}>{block.text}</p>
        </div>
      ))}

      {alternativesConsidered?.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={sectionH3}>Alternatives Considered</h3>
          {alternativesConsidered.map((alt, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 6, fontSize: 13 }}>
              <span style={{ color: '#C94F4F', fontWeight: 700 }}>&times;</span>
              <span style={{ fontWeight: 600 }}>{alt.strategy}</span>
              <span style={{ color: '#6b7280' }}>— {alt.reason}</span>
            </div>
          ))}
        </div>
      )}

      {ti && (
        <div style={{ marginTop: 24 }}>
          <h3 style={sectionH3}>Technical Context</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 }}>
            {ti.rsi && <TechTile label="RSI" value={ti.rsi.value.toFixed(1)} signal={ti.rsi.signal} desc={ti.rsi.description} />}
            {ti.impliedVolatility && <TechTile label="IV Rank" value={`${(ti.impliedVolatility.ivRank || 0).toFixed(0)}%`} desc={ti.impliedVolatility.description} />}
            {ti.movingAverages && <TechTile label="Trend" value={ti.movingAverages.signal?.replace('_', ' ') || 'N/A'} desc={ti.movingAverages.description} />}
            {ti.bollingerBands && <TechTile label="BB Width" value={ti.bollingerBands.width?.toFixed(2) || '--'} signal={ti.bollingerBands.signal} desc={ti.bollingerBands.description} />}
          </div>
        </div>
      )}
    </div>
  );
}
