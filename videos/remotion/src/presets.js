// presets.js — render presets + safe areas + a native feed reframe.
// All four social surfaces render NATIVELY from these dims (never a crop-upscale
// of a 16:9 master). See videos/docs/YOUTUBE-INSTAGRAM-PIPELINE.md §2.
import React from 'react';
import { AbsoluteFill, OffthreadVideo, staticFile, Img } from 'remotion';
import { C, F } from './NewLeafBrand.jsx';

export const PRESETS = {
  landscape: { id: 'landscape', width: 1920, height: 1080, ratio: '16:9' }, // YouTube long-form
  feed:      { id: 'feed',      width: 1080, height: 1350, ratio: '4:5'  }, // Instagram Feed
  vertical:  { id: 'vertical',  width: 1080, height: 1920, ratio: '9:16' }, // Reels + YT Shorts
  square:    { id: 'square',    width: 1080, height: 1080, ratio: '1:1'  }, // IG grid fallback
};

// Safe-area reserves (px) per surface — the platform chrome to keep content clear
// of. Pinned numbers (spec §2.1), not "clear the UI".
export const SAFE = {
  vertical:  { top: 120, bottom: 340, left: 0,  right: 200 }, // caption+audio bottom, action rail right
  feed:      { top: 0,   bottom: 100, left: 0,  right: 0   },
  landscape: { top: 0,   bottom: 0,   left: 0,  right: 0   }, // outro CTA kept out of lower-right in-comp
  square:    { top: 0,   bottom: 60,  left: 0,  right: 0   },
};

/** Absolute box inset by the surface's safe-area reserves. */
export const SafeArea = ({ ratio = 'landscape', children, style }) => {
  const s = SAFE[ratio] || SAFE.landscape;
  return (
    <div style={{ position: 'absolute', top: s.top, bottom: s.bottom, left: s.left, right: s.right, ...style }}>
      {children}
    </div>
  );
};

/**
 * FeedReframe — native 4:5 (or 1:1) framing of a 16:9 source film. The video is
 * scaled to the full width and centered on a brand-ink canvas (no crop, no
 * stretch); a kicker+title lockup sits in the top band and the logo bug + an
 * optional caption slot in the bottom band. This is the honest reframe: the
 * source is untouched, the extra height is brand surface.
 */
export const FeedReframe = ({ src, title, kicker = 'NewLeaf', ratio = 'feed' }) => {
  const p = PRESETS[ratio] || PRESETS.feed;
  const videoH = Math.round((p.width * 9) / 16); // 16:9 scaled to full width
  return (
    <AbsoluteFill style={{ backgroundColor: C.ink }}>
      {/* centered source film */}
      <div style={{ position: 'absolute', top: (p.height - videoH) / 2, left: 0, width: p.width, height: videoH }}>
        <OffthreadVideo src={staticFile(src)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>

      {/* top lockup band */}
      <div style={{ position: 'absolute', top: 46, left: 56, right: 56 }}>
        <div style={{ fontFamily: F.mono, fontSize: 24, letterSpacing: 6, color: C.gold, textTransform: 'uppercase' }}>
          {kicker}
        </div>
        {title && (
          <div style={{ fontFamily: F.disp, fontSize: 60, fontWeight: 400, color: C.cream, lineHeight: 1.02, marginTop: 12, letterSpacing: '-0.01em', whiteSpace: 'pre-line' }}>
            {title}
          </div>
        )}
      </div>

      {/* bottom logo bug */}
      <div style={{ position: 'absolute', bottom: 40, left: 56, display: 'flex', alignItems: 'center', gap: 12 }}>
        <Img src={staticFile('logos/newleaf-logo.png')} style={{ width: 44, height: 44, borderRadius: 10 }} />
        <div style={{ fontFamily: F.disp, fontSize: 30, lineHeight: 1 }}>
          <span style={{ color: C.cream, fontWeight: 600 }}>NewLeaf</span>
          <span style={{ color: C.gold, fontWeight: 600, fontStyle: 'italic', marginLeft: 6 }}>System</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};
