// Thumbnail.jsx — prop-driven, on-brand thumbnails rendered as Remotion stills.
// Two sizes (YouTube 1280x720, Instagram 1080x1350) × 3 variants. Everything
// derives from brand-tokens via NewLeafBrand's C/F. See pipeline spec §3.
//
// LEGIBILITY LAWS ENFORCED HERE (NL_VIDEO):
//  • headline is Playfair 900, never below NL_VIDEO.thumbHeadlineMin (64px @720)
//  • gold is a SURFACE (kicker pill fill), never text on the light background
import React from 'react';
import { AbsoluteFill, Img, staticFile, useVideoConfig } from 'remotion';
import { loadFont as loadPlayfair } from '@remotion/google-fonts/PlayfairDisplay';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { C, F } from './NewLeafBrand.jsx';
import { NL, NL_VIDEO } from './brand-tokens.js';

// Thumbnails need the heavy display weight (Playfair has no 300; 900 survives
// feed-scale compression) and a heavy sans for badges.
loadPlayfair('normal', { weights: ['700', '900'], subsets: ['latin'] });
loadInter('normal', { weights: ['600', '800'], subsets: ['latin'] });

const VERDICT_COLORS = {
  buy:     { fg: NL.profit, bg: 'rgba(11,122,82,0.14)' },
  risk:    { fg: NL.loss,   bg: 'rgba(201,79,79,0.14)' },
  neutral: { fg: NL.warn,   bg: 'rgba(183,121,31,0.14)' },
};

// variant → surface treatment (light vs dark, kicker fill)
const VARIANTS = {
  a: { dark: false, kickerBg: C.gold,   kickerFg: C.forest }, // headline-led, light
  b: { dark: true,  kickerBg: C.gold,   kickerFg: C.forest }, // verdict-led, dark
  c: { dark: false, kickerBg: C.forest, kickerFg: C.gold   }, // ticker-led, light w/ forest pill
};

export const Thumbnail = ({
  title = 'Know your\nnumber.',
  kicker = 'TIQ',
  ticker,
  verdict,        // { label, kind:'buy'|'risk'|'neutral' }
  agentArt,       // optional image path in public/
  variant = 'a',
}) => {
  const { width, height } = useVideoConfig();
  const v = VARIANTS[variant] || VARIANTS.a;

  // Scale headline to the frame width but never below the legibility floor.
  const headlineSize = Math.max(NL_VIDEO.thumbHeadlineMin, Math.round(width * 0.075));
  const bg = v.dark ? C.ink : NL.bg;
  const headlineColor = v.dark ? C.cream : C.forest; // gold is NEVER the headline
  const pad = Math.round(width * 0.05);

  const vc = verdict ? (VERDICT_COLORS[verdict.kind] || VERDICT_COLORS.neutral) : null;

  return (
    <AbsoluteFill style={{ backgroundColor: bg, padding: pad, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
      {/* soft brand medallion glow, top-right */}
      <div style={{
        position: 'absolute', right: -width * 0.06, top: -width * 0.05,
        width: width * 0.34, height: width * 0.34, borderRadius: '50%',
        background: `radial-gradient(circle at 30% 30%, ${v.dark ? 'rgba(201,169,110,0.22)' : 'rgba(11,45,35,0.14)'}, transparent 70%)`,
      }} />
      {agentArt && (
        <Img src={staticFile(agentArt)} style={{
          position: 'absolute', right: -width * 0.04, bottom: -width * 0.04,
          width: width * 0.42, height: width * 0.42, borderRadius: '50%',
          opacity: 0.9, objectFit: 'cover',
        }} />
      )}

      {/* kicker pill (gold is a SURFACE here) */}
      <div style={{ position: 'relative', zIndex: 2 }}>
        <span style={{
          fontFamily: F.mono, fontSize: Math.round(width * 0.017), fontWeight: 700,
          letterSpacing: '0.08em', textTransform: 'uppercase',
          background: v.kickerBg, color: v.kickerFg,
          padding: `${Math.round(width * 0.006)}px ${Math.round(width * 0.014)}px`, borderRadius: 999,
        }}>{kicker}</span>
      </div>

      {/* headline — Playfair 900, forest/cream, never gold, never small */}
      <div style={{
        position: 'relative', zIndex: 2,
        fontFamily: F.disp, fontWeight: 900, fontSize: headlineSize, lineHeight: 0.98,
        letterSpacing: '-0.02em', color: headlineColor, whiteSpace: 'pre-line',
        maxWidth: agentArt ? '72%' : '90%',
      }}>{title}</div>

      {/* footer chips */}
      <div style={{ position: 'relative', zIndex: 2, display: 'flex', alignItems: 'center', gap: Math.round(width * 0.01) }}>
        {ticker && (
          <span style={{
            fontFamily: F.mono, fontWeight: 700, fontSize: Math.round(width * 0.018),
            background: v.dark ? C.gold : C.forest, color: v.dark ? C.forest : C.bg,
            padding: `${Math.round(width * 0.005)}px ${Math.round(width * 0.012)}px`, borderRadius: 10,
          }}>{ticker}</span>
        )}
        {verdict && (
          <span style={{
            fontFamily: F.body, fontWeight: 800, fontSize: Math.round(width * 0.015),
            letterSpacing: '0.05em', textTransform: 'uppercase',
            background: vc.bg, color: vc.fg,
            padding: `${Math.round(width * 0.005)}px ${Math.round(width * 0.012)}px`, borderRadius: 999,
          }}>{verdict.label}</span>
        )}
      </div>

      {/* logo bug, bottom-left corner (over footer row on the far left) */}
      <div style={{ position: 'absolute', left: pad, bottom: Math.round(pad * 0.55), display: 'flex', alignItems: 'center', gap: 8, opacity: 0.9, zIndex: 1 }}>
        <Img src={staticFile('logos/newleaf-logo.png')} style={{ width: Math.round(width * 0.028), height: Math.round(width * 0.028), borderRadius: 8 }} />
      </div>
    </AbsoluteFill>
  );
};
