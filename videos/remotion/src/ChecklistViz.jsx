// ------------------------------------------------------------
// TIQ question visual: the pre-trade checklist.
// For questions like "your checklist has eight rules, tonight seven pass" —
// show the actual checklist so the decision is concrete, not abstract.
// Deterministic: the numbers ARE the question. Renders as a still.
// ------------------------------------------------------------
import React from 'react';
import { AbsoluteFill } from 'remotion';
import { NL } from './newleaf-remotion-kit.jsx';

const DEFAULT_ITEMS = [
  { label: 'Trend aligned with the entry', pass: true },
  { label: 'Price above the defended wall', pass: true },
  { label: 'IV rank inside the target band', pass: true },
  { label: 'Earnings clear of expiry', pass: true },
  { label: 'Spread liquid, fills tight', pass: true },
  { label: 'Position size within the risk limit', pass: true },
  { label: 'Exit plan written before entry', pass: false },
  { label: 'Not correlated to open risk', pass: true },
];

export const ChecklistViz = ({
  title = "Tonight's setup",
  items = DEFAULT_ITEMS,
}) => {
  const pass = items.filter((i) => i.pass).length;

  return (
    <AbsoluteFill
      style={{
        backgroundColor: NL.color.forest,
        backgroundImage: `radial-gradient(ellipse at 50% 32%, ${NL.color.forest3} 0%, ${NL.color.forest} 82%)`,
        padding: '90px 150px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          fontFamily: NL.font.mono,
          fontSize: 32,
          letterSpacing: 6,
          textTransform: 'uppercase',
          color: NL.color.gold,
        }}
      >
        Your system · {pass} of {items.length} rules pass
      </div>
      <div
        style={{
          fontFamily: NL.font.display,
          fontWeight: 600,
          fontSize: 78,
          color: NL.color.cream,
          margin: '16px 0 46px',
          letterSpacing: '-0.01em',
        }}
      >
        {title}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {items.map((it, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 30,
              backgroundColor: NL.color.forest2,
              border: `1px solid ${it.pass ? NL.color.forest3 : NL.color.terracotta}`,
              borderRadius: 16,
              padding: '20px 34px',
            }}
          >
            <div
              style={{
                width: 52,
                height: 52,
                borderRadius: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 34,
                fontWeight: 700,
                flexShrink: 0,
                backgroundColor: it.pass ? NL.color.teal : 'transparent',
                border: it.pass ? 'none' : `3px solid ${NL.color.terracotta}`,
                color: it.pass ? NL.color.forest : NL.color.terracotta,
              }}
            >
              {it.pass ? '✓' : '✕'}
            </div>
            <div
              style={{
                fontFamily: NL.font.body,
                fontSize: 36,
                color: it.pass ? NL.color.cream : '#98A79C',
              }}
            >
              {it.label}
            </div>
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};
