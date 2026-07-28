// Renders a raw SVG string full-bleed — used to preview the live TIQ question
// visuals (web/workbench/public/js/tiqVisuals.js) as PNG stills.
import React from 'react';
import { AbsoluteFill } from 'remotion';

export const SvgFrame = ({ svg = '' }) => (
  <AbsoluteFill
    style={{ backgroundColor: '#16271C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
  >
    <div style={{ width: '100%' }} dangerouslySetInnerHTML={{ __html: svg }} />
  </AbsoluteFill>
);
