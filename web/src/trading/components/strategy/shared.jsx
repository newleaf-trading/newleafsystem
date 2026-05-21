/**
 * Shared sub-components and style constants for StrategyDetailPage tabs.
 */

import { formatStrategy } from '../../utils/formatters';

// ── Style constants ─────────────────────────────────────────────────────────

export const cardBase = {
  background: '#fff', border: '1px solid rgba(17,24,39,0.10)',
  borderRadius: 16, padding: 14,
};

export const metaLabel = {
  fontSize: 10, fontWeight: 900, letterSpacing: '.14em',
  textTransform: 'uppercase', color: 'rgba(17,24,39,0.55)', marginBottom: 6,
};

export const sectionH3 = {
  fontSize: 16, fontWeight: 900, letterSpacing: '-0.2px',
  color: '#111827', marginBottom: 12,
};

export const thStyle = {
  padding: '10px 12px', fontSize: 10, fontWeight: 900,
  letterSpacing: '.12em', textTransform: 'uppercase',
  color: 'rgba(17,24,39,0.55)', textAlign: 'left',
  borderBottom: '1px solid rgba(17,24,39,0.08)',
};

export const tdStyle = {
  padding: '10px 12px', fontSize: 13,
};

export const placeholder = {
  padding: '40px 0', textAlign: 'center', color: '#9ca3af', fontSize: 14,
};

export const btnPrimary = {
  padding: '10px 20px', background: '#0B2D23', color: '#fff',
  border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600,
};

export const btnGold = {
  padding: '12px 24px', background: '#C9A96E', color: '#0B2D23',
  border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer',
  boxShadow: '0 8px 24px rgba(201,169,110,0.28)',
};

export const btnGhost = {
  padding: '12px 24px', background: 'rgba(255,255,255,0.10)',
  color: '#fff', border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer',
};

export const btnDanger = {
  padding: '12px 24px', background: '#C94F4F', color: '#fff',
  border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer',
  boxShadow: '0 8px 24px rgba(201,79,79,0.28)',
};

export const btnBack = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 13, fontWeight: 600, color: '#6b7280', padding: 0,
};

export const fmt = (v) => {
  if (!v || isNaN(v)) return '$0';
  return '$' + Math.round(v).toLocaleString();
};

// ── Shared sub-components ───────────────────────────────────────────────────

export function VitalTile({ label, value, positive, negative, primary }) {
  let valueColor = '#111827';
  if (positive) valueColor = '#0B7A52';
  if (negative) valueColor = '#C94F4F';

  return (
    <div style={{
      ...cardBase,
      ...(primary ? {
        background: 'linear-gradient(135deg, rgba(11,45,35,0.08), rgba(201,169,110,0.08))',
        borderColor: 'rgba(11,45,35,0.18)',
      } : {}),
    }}>
      <div style={metaLabel}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 900, letterSpacing: '-0.3px', color: valueColor }}>
        {value}
      </div>
    </div>
  );
}

export function ChangeTile({ label, entry, current, pctChange }) {
  return (
    <div style={cardBase}>
      <div style={metaLabel}>{label}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <div>
          <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 2 }}>Entry</div>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#6b7280' }}>{entry}</div>
        </div>
        <div style={{ fontSize: 16, color: '#d1d5db' }}>&rarr;</div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 10, color: '#9ca3af', marginBottom: 2 }}>Now</div>
          <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, color: '#111827' }}>{current}</div>
        </div>
      </div>
      {pctChange !== undefined && pctChange !== 0 && (
        <div style={{
          marginTop: 4, fontSize: 11, fontWeight: 600, textAlign: 'right',
          color: pctChange > 0 ? '#0B7A52' : '#C94F4F',
        }}>
          {pctChange > 0 ? '+' : ''}{pctChange.toFixed(1)}%
        </div>
      )}
    </div>
  );
}

export function TechTile({ label, value, signal, desc }) {
  const signalColor = {
    bullish: '#0B7A52', bearish: '#C94F4F', neutral: '#B7791F',
    overbought: '#C94F4F', oversold: '#0B7A52',
  }[signal] || '#6b7280';

  return (
    <div style={cardBase}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <span style={metaLabel}>{label}</span>
        {signal && (
          <span style={{ fontSize: 10, fontWeight: 700, color: signalColor, textTransform: 'capitalize' }}>
            {signal.replace('_', ' ')}
          </span>
        )}
      </div>
      <div style={{ fontSize: 18, fontWeight: 700, color: '#111827', marginBottom: 4 }}>{value}</div>
      {desc && <div style={{ fontSize: 11, color: '#9ca3af', lineHeight: 1.5 }}>{desc}</div>}
    </div>
  );
}
