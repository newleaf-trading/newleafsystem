import { useState } from 'react';

/**
 * DeepDiveTabs — Tabbed container for Volume by Strike, Price Range, and Meta.
 * Collapses page height by putting reference data behind tabs.
 */
export default function DeepDiveTabs({ children }) {
  const tabs = ['Volume by Strike', 'Price Range', 'Meta / JSON'];
  const [active, setActive] = useState(0);

  // children should be an array of 3 elements matching tabs
  const panels = Array.isArray(children) ? children : [children];

  return (
    <div className="nl-card" style={{ padding: 0, overflow: 'hidden' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--nl-border)', background: '#fafbfc' }}>
        {tabs.map((label, i) => (
          <button
            key={label}
            onClick={() => setActive(i)}
            style={{
              flex: 1, padding: '12px 16px', fontSize: 12, fontWeight: 700,
              textTransform: 'uppercase', letterSpacing: '0.06em', cursor: 'pointer',
              border: 'none', borderBottom: active === i ? '2.5px solid #0B2D23' : '2.5px solid transparent',
              background: 'transparent',
              color: active === i ? '#0B2D23' : 'var(--nl-muted-text)',
              transition: 'all 0.15s',
            }}
          >
            {label}
          </button>
        ))}
      </div>
      {/* Active panel */}
      <div style={{ padding: '16px' }}>
        {panels[active] || <div style={{ color: 'var(--nl-muted-text)', fontSize: 13, padding: 20, textAlign: 'center' }}>No data available</div>}
      </div>
    </div>
  );
}
