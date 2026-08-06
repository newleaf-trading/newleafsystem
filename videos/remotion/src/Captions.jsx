// Captions.jsx — burned-in captions for muted-autoplay surfaces (Reels/Shorts).
// Driven by a cue list [{ t: startSec, d: durSec, text }] (per-episode
// captions.json, produced from the pipeline `voice`/transcribe step). Styled from
// tokens; sits ABOVE the vertical safe area so platform chrome never covers it.
// See pipeline spec §5.
import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate } from 'remotion';
import { C, F } from './NewLeafBrand.jsx';
import { SAFE } from './presets.js';

export const Captions = ({ cues = [], ratio = 'vertical', maxWidthPct = 0.82 }) => {
  const frame = useCurrentFrame();
  const { fps, width } = useVideoConfig();
  const t = frame / fps;

  const active = cues.find((c) => t >= c.t && t < c.t + c.d);
  if (!active) return null;

  // fade each cue in/out over 6 frames
  const localStart = active.t * fps;
  const localEnd = (active.t + active.d) * fps;
  const o = Math.min(
    interpolate(frame, [localStart, localStart + 6], [0, 1], { extrapolateRight: 'clamp' }),
    interpolate(frame, [localEnd - 6, localEnd], [1, 0], { extrapolateLeft: 'clamp' })
  );

  const s = SAFE[ratio] || SAFE.vertical;
  const bottom = (s.bottom || 100) - 40; // rest just inside the reserved band

  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{
        position: 'absolute', bottom, left: '50%', transform: 'translateX(-50%)',
        maxWidth: width * maxWidthPct, opacity: o,
        background: 'rgba(7,17,12,0.78)', backdropFilter: 'blur(4px)',
        border: `1px solid rgba(201,169,110,0.35)`, borderRadius: 14,
        padding: '14px 22px', textAlign: 'center',
      }}>
        <span style={{
          fontFamily: F.body, fontWeight: 700, fontSize: Math.round(width * 0.042),
          color: C.cream, lineHeight: 1.2, letterSpacing: '-0.01em',
        }}>{active.text}</span>
      </div>
    </AbsoluteFill>
  );
};
