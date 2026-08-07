// ThumbnailReel.jsx — full-bleed 9:16 cover for Reels / Shorts.
// A still frame from the video is the hero; brand furniture (kicker pill, Playfair
// headline, forest scrim, logo bug) sits over it. Same legibility laws as
// Thumbnail.jsx: headline is Playfair 900 cream, gold is a SURFACE (kicker fill),
// never headline text. Copy is a MANUAL hook field (spec §3/§11).
//
// Layout respects the 9:16 safe area: text stays out of the bottom ~14% (IG
// caption / progress bar) and off the right rail (like/comment/share icons).
import React from 'react';
import { AbsoluteFill, Img, staticFile, useVideoConfig } from 'remotion';
import { loadFont as loadPlayfair } from '@remotion/google-fonts/PlayfairDisplay';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { C, F } from './NewLeafBrand.jsx';
import { NL_VIDEO } from './brand-tokens.js';

loadPlayfair('normal', { weights: ['700', '900'], subsets: ['latin'] });
loadInter('normal', { weights: ['600', '800'], subsets: ['latin'] });

export const ThumbnailReel = ({
  bg = 'covers/host.png',      // full-bleed hero frame in public/
  kicker = 'Trading IQ',
  title = 'Know your\nnumber.',
  sub,                          // optional one-liner under the headline
  focus = '50% 30%',            // object-position so the face survives the crop
}) => {
  const { width, height } = useVideoConfig();

  // Headline scales to frame but never below the 9:16 legibility floor.
  const headlineSize = Math.max(NL_VIDEO.thumbHeadlineMin, Math.round(width * 0.115));
  const pad = Math.round(width * 0.06);
  const bottomSafe = Math.round(height * 0.14); // keep clear of IG caption / progress bar

  return (
    <AbsoluteFill style={{ backgroundColor: C.ink }}>
      {/* hero frame */}
      <Img src={staticFile(bg)} style={{
        position: 'absolute', width: '100%', height: '100%',
        objectFit: 'cover', objectPosition: focus,
      }} />

      {/* top scrim — lifts the kicker off busy frames */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: '26%',
        background: 'linear-gradient(to bottom, rgba(4,18,12,0.72), transparent)',
      }} />

      {/* bottom forest scrim — anchors the headline, brand-tinted */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: '58%',
        background: `linear-gradient(to top, ${C.forest} 8%, rgba(11,45,35,0.86) 34%, transparent 100%)`,
      }} />

      {/* kicker pill — gold surface, top-left */}
      <div style={{ position: 'absolute', top: pad, left: pad }}>
        <span style={{
          fontFamily: F.mono, fontSize: Math.round(width * 0.026), fontWeight: 700,
          letterSpacing: '0.10em', textTransform: 'uppercase',
          background: C.gold, color: C.forest,
          padding: `${Math.round(width * 0.012)}px ${Math.round(width * 0.026)}px`, borderRadius: 999,
        }}>{kicker}</span>
      </div>

      {/* headline block — bottom, above the safe area */}
      <div style={{
        position: 'absolute', left: pad, right: pad, bottom: bottomSafe,
      }}>
        <div style={{
          fontFamily: F.disp, fontWeight: 900, fontSize: headlineSize, lineHeight: 0.98,
          letterSpacing: '-0.02em', color: C.cream, whiteSpace: 'pre-line',
          textShadow: '0 4px 30px rgba(0,0,0,0.45)',
        }}>{title}</div>

        {sub && (
          <div style={{
            marginTop: Math.round(width * 0.03), maxWidth: '86%',
            fontFamily: F.body, fontWeight: 600, fontSize: Math.round(width * 0.036),
            lineHeight: 1.25, color: 'rgba(247,245,240,0.9)',
          }}>{sub}</div>
        )}

        {/* logo bug */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: Math.round(width * 0.04), opacity: 0.95 }}>
          <Img src={staticFile('logos/newleaf-logo.png')} style={{ width: Math.round(width * 0.05), height: Math.round(width * 0.05), borderRadius: 10 }} />
          <span style={{ fontFamily: F.body, fontWeight: 800, fontSize: Math.round(width * 0.03), color: C.cream, letterSpacing: '0.01em' }}>
            NewLeaf System
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
