import LiveLegsTable from '../analysis/LiveLegsTable';
import { cardBase, metaLabel, sectionH3 } from './shared';

export function PositionTab({ tile, liveData }) {
  return (
    <div>
      <h3 style={sectionH3}>Position Legs — Entry vs Current</h3>
      <LiveLegsTable tile={tile} liveData={liveData} />

      {liveData.liveGreeks && (
        <div style={{ marginTop: 24 }}>
          <h3 style={sectionH3}>
            Net Greeks
            {liveData.currentSpot > 0 && (
              <span style={{ fontSize: 11, fontWeight: 400, color: '#9ca3af', marginLeft: 8 }}>
                (live at ${liveData.currentSpot.toFixed(2)})
              </span>
            )}
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
            {[
              { label: 'Delta', value: (liveData.liveGreeks.net?.delta || 0).toFixed(3), desc: 'Directional exposure' },
              { label: 'Theta', value: `$${(liveData.liveGreeks.net?.theta || 0).toFixed(2)}`, desc: 'Daily time decay' },
              { label: 'Vega', value: (liveData.liveGreeks.net?.vega || 0).toFixed(3), desc: 'Volatility sensitivity' },
              { label: 'Gamma', value: (liveData.liveGreeks.net?.gamma || 0).toFixed(4), desc: 'Delta acceleration' },
            ].map((g, i) => (
              <div key={i} style={cardBase}>
                <div style={metaLabel}>{g.label}</div>
                <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 2 }}>{g.value}</div>
                <div style={{ fontSize: 11, color: '#9ca3af' }}>{g.desc}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
