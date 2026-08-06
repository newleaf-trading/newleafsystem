// NewLeafBrand.jsx — shared tokens + reusable intro/outro/lower-third.
// Converted from the delivered NewLeafBrand.tsx to plain JSX to match this
// project (JS/JSX, no tsconfig). Fonts are loaded via @remotion/google-fonts
// (already a dependency) so the families below actually render instead of
// falling back to a system serif.
import React, { useState, useEffect } from 'react';
import {
  AbsoluteFill, Sequence, Img, Video, Audio, staticFile,
  interpolate, spring, useCurrentFrame, useVideoConfig, Easing,
  delayRender, continueRender,
} from 'remotion';
import { loadFont as loadPlayfair } from '@remotion/google-fonts/PlayfairDisplay';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadSpaceMono } from '@remotion/google-fonts/SpaceMono';
import { NL, NL_VIDEO } from './brand-tokens.js';

// Fonts match the WEBSITE (Playfair Display + Inter), loaded via
// @remotion/google-fonts so they actually render in headless renders instead of
// falling back to a system serif. Playfair has no 300 weight — its lightest is
// 400 — so display headlines use 400 (the site's light display weight) + 600.
const playfair = loadPlayfair('normal', { weights: ['400', '600'], subsets: ['latin'] });
loadPlayfair('italic', { weights: ['600'], subsets: ['latin'] }); // the "System" wordmark
const inter = loadInter('normal', { weights: ['300', '400', '600'], subsets: ['latin'] });
const spaceMono = loadSpaceMono('normal', { weights: ['400'], subsets: ['latin'] });

/* ─────────── brand — DERIVED from the site's tokens (brand-tokens.js) ───────────
 * Do NOT hand-pick hexes here. Edit web/src/shared/styles/tokens.css and run
 * `node videos/scripts/sync-brand-tokens.mjs`. See the pipeline spec §1. */
export const C = {
  ink:    NL_VIDEO.ink,   // #07110C — darker-than-green intro/outro backdrop
  forest: NL.green,       // #0B2D23 — brand forest green
  cream:  NL.bg,          // #F7F5F0 — paper background
  gold:   NL.gold,        // #C9A96E — accent (SURFACE only, never text on light)
  sage:   '#8FB39B',      // secondary muted green (video-only)
  green:  NL.profit,      // #0B7A52 — positive / gain
  red:    NL.loss,        // #C94F4F — negative / loss
  muted:  NL.textMuted,   // #6b7280
};
export const F = {
  disp: `${playfair.fontFamily}, Georgia, serif`,
  body: `${inter.fontFamily}, system-ui, sans-serif`,
  mono: `${spaceMono.fontFamily}, monospace`,
};

/* fade helper: in over `a` frames, out over `b` before the end */
const fade = (f, dur, a = 12, b = 12) =>
  Math.min(
    interpolate(f, [0, a], [0, 1], { extrapolateRight: 'clamp' }),
    interpolate(f, [dur - b, dur], [1, 0], { extrapolateLeft: 'clamp' })
  );

/* ═══════════════ INTRO — 4s ═══════════════ */
export const Intro = ({ eyebrow = 'NEWLEAF SYSTEM', title, sub }) => {
  const f = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();

  const rise = (delay) =>
    spring({ frame: f - delay, fps, config: { damping: 200, mass: 0.6 } });

  // hairline that draws across under the title
  const rule = interpolate(f, [22, 48], [0, 1], {
    extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic),
  });

  const out = interpolate(f, [durationInFrames - 14, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
  });

  return (
    <AbsoluteFill style={{ backgroundColor: C.ink, opacity: out }}>
      {/* agent medallion, low and large, bleeding off the right edge */}
      <Img
        src={staticFile('agents/oracle-256.jpg')}
        style={{
          position: 'absolute', right: -180, top: 180,
          width: 720, height: 720, borderRadius: '50%',
          opacity: interpolate(f, [0, 40], [0, 0.30], { extrapolateRight: 'clamp' }),
          filter: 'blur(1px)',
        }}
      />

      <AbsoluteFill style={{ justifyContent: 'center', padding: '0 120px' }}>
        <div style={{
          fontFamily: F.mono, fontSize: 22, letterSpacing: 8, color: C.gold,
          opacity: rise(0), transform: `translateY(${(1 - rise(0)) * 14}px)`,
          marginBottom: 26,
        }}>
          {eyebrow}
        </div>

        <div style={{
          fontFamily: F.disp, fontSize: 92, lineHeight: 1.04, color: C.cream,
          fontWeight: 400, letterSpacing: '-0.02em', maxWidth: 1250,
          opacity: rise(8), transform: `translateY(${(1 - rise(8)) * 22}px)`,
          whiteSpace: 'pre-line',
        }}>
          {title}
        </div>

        <div style={{
          height: 1, background: C.gold, marginTop: 40,
          width: `${rule * 260}px`, opacity: 0.85,
        }} />

        {sub && (
          <div style={{
            fontFamily: F.body, fontSize: 34, color: '#B4AFA1', fontWeight: 300,
            marginTop: 34, maxWidth: 1000, lineHeight: 1.45,
            opacity: rise(26), transform: `translateY(${(1 - rise(26)) * 14}px)`,
          }}>
            {sub}
          </div>
        )}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/* ═══════════ CONTEXT INTRO — multi-screen problem→solution setup ═══════════ */
// One beat = one screen. Each beat fades in/out and plays its own VO clip.
const IntroBeat = ({ beat }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const o = fade(f, beat.dur, 12, 12);
  const rise = (d) => spring({ frame: f - d, fps, config: { damping: 200, mass: 0.6 } });
  const pad = { justifyContent: 'center', padding: '0 120px' };

  let body = null;
  if (beat.kind === 'text') {
    body = (
      <AbsoluteFill style={pad}>
        {beat.eyebrow && (
          <div style={{ fontFamily: F.mono, fontSize: 22, letterSpacing: 8, color: C.gold, marginBottom: 24, opacity: rise(0) }}>
            {beat.eyebrow}
          </div>
        )}
        <div style={{
          fontFamily: F.disp, fontSize: 88, lineHeight: 1.05, color: C.cream, fontWeight: 400,
          letterSpacing: '-0.02em', maxWidth: 1300, whiteSpace: 'pre-line',
          opacity: rise(6), transform: `translateY(${(1 - rise(6)) * 20}px)`,
        }}>
          {beat.headline}
        </div>
      </AbsoluteFill>
    );
  } else if (beat.kind === 'checklist') {
    body = (
      <AbsoluteFill style={pad}>
        <div style={{ fontFamily: F.disp, fontSize: 64, color: C.cream, fontWeight: 400, marginBottom: 40, opacity: rise(0) }}>
          {beat.headline}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '18px 60px', maxWidth: 1300 }}>
          {beat.items.map((it, i) => {
            const s = rise(10 + i * 8);
            return (
              <div key={it} style={{ display: 'flex', alignItems: 'center', gap: 18, opacity: s, transform: `translateX(${(1 - s) * 18}px)` }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 6, border: `2px solid ${C.gold}`,
                  color: C.gold, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: F.body, fontSize: 20, fontWeight: 600,
                }}>✓</div>
                <div style={{ fontFamily: F.body, fontSize: 34, color: '#D9D5C7', fontWeight: 300 }}>{it}</div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    );
  } else if (beat.kind === 'bignum') {
    const count = Math.round(interpolate(f, [8, 46], [0, Number(beat.number)], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }));
    body = (
      <AbsoluteFill style={pad}>
        {beat.eyebrow && (
          <div style={{ fontFamily: F.mono, fontSize: 22, letterSpacing: 8, color: C.gold, marginBottom: 8, opacity: rise(0) }}>
            {beat.eyebrow}
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 34, opacity: rise(4) }}>
          <div style={{ fontFamily: F.disp, fontSize: 300, lineHeight: 0.9, color: C.gold, fontWeight: 400 }}>{count}</div>
          <div style={{ fontFamily: F.body, fontSize: 46, color: C.cream, fontWeight: 300, maxWidth: 460 }}>{beat.label}</div>
        </div>
      </AbsoluteFill>
    );
  } else if (beat.kind === 'pillars') {
    body = (
      <AbsoluteFill style={pad}>
        <div style={{ fontFamily: F.disp, fontSize: 64, color: C.cream, fontWeight: 400, marginBottom: 48, opacity: rise(0) }}>
          {beat.headline}
        </div>
        <div style={{ display: 'flex', gap: 40 }}>
          {beat.pillars.map((p, i) => {
            const s = rise(12 + i * 10);
            return (
              <div key={p} style={{
                flex: 1, maxWidth: 380, borderTop: `2px solid ${C.gold}`, paddingTop: 22,
                opacity: s, transform: `translateY(${(1 - s) * 20}px)`,
              }}>
                <div style={{ fontFamily: F.mono, fontSize: 20, letterSpacing: 3, color: C.gold, marginBottom: 12 }}>
                  {String(i + 1).padStart(2, '0')}
                </div>
                <div style={{ fontFamily: F.body, fontSize: 34, color: C.cream, fontWeight: 300, lineHeight: 1.25 }}>{p}</div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    );
  } else if (beat.kind === 'agents') {
    const dots = Array.from({ length: beat.count }, (_, i) => i);
    body = (
      <AbsoluteFill style={pad}>
        <div style={{ fontFamily: F.disp, fontSize: 66, color: C.cream, fontWeight: 400, maxWidth: 1200, marginBottom: 52, opacity: rise(0) }}>
          {beat.headline}
        </div>
        <div style={{ display: 'flex', gap: 26 }}>
          {dots.map((i) => {
            const s = rise(14 + i * 6);
            return (
              <div key={i} style={{
                width: 92, height: 92, borderRadius: '50%',
                border: `2px solid ${C.gold}`, background: 'rgba(201,165,78,.10)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontFamily: F.mono, fontSize: 30, color: C.gold,
                opacity: s * 0.95, transform: `translateY(${(1 - s) * 22}px)`,
              }}>{i + 1}</div>
            );
          })}
        </div>
      </AbsoluteFill>
    );
  }

  return (
    <AbsoluteFill style={{ backgroundColor: C.ink, opacity: o }}>
      <Img
        src={staticFile('agents/oracle-256.jpg')}
        style={{ position: 'absolute', right: -180, top: 180, width: 720, height: 720, borderRadius: '50%', opacity: 0.10, filter: 'blur(1px)' }}
      />
      {body}
    </AbsoluteFill>
  );
};

export const ContextIntro = ({ beats = [] }) => {
  let at = 0;
  return (
    <AbsoluteFill style={{ backgroundColor: C.ink }}>
      {beats.map((beat, i) => {
        const from = at;
        at += beat.dur;
        return (
          <Sequence key={i} from={from} durationInFrames={beat.dur}>
            <IntroBeat beat={beat} />
            {beat.vo && (
              <Sequence from={10}>
                <Audio src={staticFile(beat.vo)} />
              </Sequence>
            )}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

/* ═══════════════ OUTRO — 6s ═══════════════ */
export const Outro = ({
  headline = 'Try it on a ticker you actually trade.',
  cta = 'Join NewLeaf free',
  url = 'newleafsystem.com',
  note = 'No card. Bring your own watchlist.',
}) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const rise = (d) =>
    spring({ frame: f - d, fps, config: { damping: 200, mass: 0.6 } });

  // the four analysts drift in as a row of coins
  const agents = ['atlas', 'sigma', 'vega', 'pulse'];

  return (
    <AbsoluteFill style={{ backgroundColor: C.ink }}>
      <AbsoluteFill style={{ justifyContent: 'center', padding: '0 120px' }}>
        <div style={{
          fontFamily: F.disp, fontSize: 78, lineHeight: 1.08, color: C.cream,
          fontWeight: 400, letterSpacing: '-0.02em', maxWidth: 1150,
          opacity: rise(0), transform: `translateY(${(1 - rise(0)) * 20}px)`,
          whiteSpace: 'pre-line',
        }}>
          {headline}
        </div>

        {/* CTA pill */}
        <div style={{
          marginTop: 56, display: 'flex', alignItems: 'center', gap: 28,
          opacity: rise(14), transform: `translateY(${(1 - rise(14)) * 16}px)`,
        }}>
          <div style={{
            fontFamily: F.mono, fontSize: 26, letterSpacing: 3,
            color: C.ink, background: C.gold,
            padding: '22px 42px', borderRadius: 4, textTransform: 'uppercase',
          }}>
            {cta}
          </div>
          <div style={{ fontFamily: F.body, fontSize: 28, color: '#B4AFA1' }}>
            {note}
          </div>
        </div>

        <div style={{
          fontFamily: F.mono, fontSize: 30, letterSpacing: 5, color: C.gold,
          marginTop: 64, opacity: rise(26),
        }}>
          {url}
        </div>
      </AbsoluteFill>

      {/* agent coins along the bottom */}
      <div style={{
        position: 'absolute', bottom: 70, right: 120,
        display: 'flex', gap: 20,
      }}>
        {agents.map((a, i) => {
          const s = rise(30 + i * 5);
          return (
            <Img
              key={a}
              src={staticFile(`agents/${a}-128.jpg`)}
              style={{
                width: 84, height: 84, borderRadius: '50%',
                border: `1px solid rgba(201,165,78,.45)`,
                opacity: s * 0.9, transform: `translateY(${(1 - s) * 20}px)`,
              }}
            />
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/* ═══════════ LOWER THIRD — overlay on screen capture ═══════════ */
export const LowerThird = ({ label, detail, hue = C.gold }) => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const o = fade(f, durationInFrames, 10, 12);
  const slide = interpolate(f, [0, 14], [26, 0], {
    extrapolateRight: 'clamp', easing: Easing.out(Easing.cubic),
  });

  return (
    <AbsoluteFill>
      <div style={{
        position: 'absolute', left: 90, bottom: 110,
        opacity: o, transform: `translateX(${slide}px)`,
        background: 'rgba(7,17,12,.86)',
        borderLeft: `2px solid ${hue}`,
        padding: '22px 34px', borderRadius: 3,
        backdropFilter: 'blur(6px)',
      }}>
        <div style={{
          fontFamily: F.mono, fontSize: 20, letterSpacing: 4,
          color: hue, textTransform: 'uppercase',
        }}>
          {label}
        </div>
        {detail && (
          <div style={{
            fontFamily: F.body, fontSize: 30, color: C.cream,
            marginTop: 8, fontWeight: 300,
          }}>
            {detail}
          </div>
        )}
      </div>
    </AbsoluteFill>
  );
};

/* ═══════════ CAPTURE — guarded <Video> ═══════════
 * If the recording file is missing (or fails to load) the preview must not
 * crash: onError swaps in a neutral placeholder instead. */
const CapturePlaceholder = ({ file }) => (
  <AbsoluteFill style={{
    backgroundColor: C.forest, alignItems: 'center', justifyContent: 'center',
  }}>
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontFamily: F.mono, fontSize: 22, letterSpacing: 4, color: C.gold }}>
        SCREEN RECORDING
      </div>
      <div style={{ fontFamily: F.body, fontSize: 26, color: C.cream, marginTop: 14, opacity: 0.8 }}>
        drop your capture at{'\n'}
        <span style={{ fontFamily: F.mono, fontSize: 22 }}>public/{file}</span>
      </div>
    </div>
  </AbsoluteFill>
);

// Probe the capture with a HEAD request before mounting <Video>. A bare <Video>
// pointed at a missing file registers a delayRender() that 404s and times out
// the whole render — so we gate on existence and fall back to a placeholder.
// Works in headless render (not just the browser) because the probe is held by
// its own delayRender() until the fetch resolves.
const SafeCapture = ({ file, muted = false }) => {
  const [status, setStatus] = useState('checking'); // checking | ok | missing
  const [handle] = useState(() => delayRender(`probe capture ${file}`));

  useEffect(() => {
    let alive = true;
    fetch(staticFile(file), { method: 'HEAD' })
      .then((r) => { if (alive) setStatus(r.ok ? 'ok' : 'missing'); })
      .catch(() => { if (alive) setStatus('missing'); })
      .finally(() => continueRender(handle));
    return () => { alive = false; };
  }, [file, handle]);

  if (status !== 'ok') return <CapturePlaceholder file={file} />;
  return (
    <Video
      src={staticFile(file)}
      // when a replacement VO is layered on top, silence the recording's own audio
      volume={muted ? 0 : 1}
      onError={() => setStatus('missing')}
      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
    />
  );
};

/* ═══════════ LOGO BUG — persistent NewLeaf lockup on every frame ═══════════ */
// Clean "NewLeaf System" lockup rebuilt in type (no tagline) to match the brand
// header: leaf icon + Fraunces "NewLeaf" (cream) + Fraunces italic "System" (gold).
const LogoBug = ({ icon = 'logos/newleaf-logo.png', size = 52, bottom = 24, left = 80 }) => {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, 15], [0, 0.97], { extrapolateRight: 'clamp' });
  return (
    <div style={{
      position: 'absolute', bottom, left, display: 'flex', alignItems: 'center', gap: 14,
      opacity: o, filter: 'drop-shadow(0 2px 8px rgba(0,0,0,.6))',
    }}>
      <Img src={staticFile(icon)} style={{ width: size, height: size, borderRadius: 12 }} />
      <div style={{ fontFamily: F.disp, fontSize: size * 0.62, letterSpacing: '-0.01em', lineHeight: 1 }}>
        <span style={{ color: C.cream, fontWeight: 600 }}>NewLeaf</span>
        <span style={{ color: C.gold, fontWeight: 600, fontStyle: 'italic', marginLeft: 6 }}>System</span>
      </div>
    </div>
  );
};

/* ═══════════ FULL VIDEO — intro + capture + outro ═══════════ */
export const FeatureVideo = ({
  capture, introTitle, introSub, outroHeadline, outroCta, outroUrl, outroNote,
  chapters = [], introLen = 120, captureLen, outroLen = 180,
  introBeats = [],                 // when set, a multi-screen context intro replaces the single title
  voSegments = [],                 // [{ from: frames, file: 'vo/...mp3' }] laid over the capture
  outroVo,                         // optional VO clip for the outro
}) => {
  const XF = 15; // crossfade overlap
  const revoiced = voSegments.length > 0;

  return (
    <AbsoluteFill style={{ backgroundColor: C.ink }}>
      <Sequence durationInFrames={introLen}>
        {introBeats.length > 0
          ? <ContextIntro beats={introBeats} />
          : <Intro title={introTitle} sub={introSub} />}
      </Sequence>

      <Sequence from={introLen - XF} durationInFrames={captureLen + XF}>
        <AbsoluteFill style={{ backgroundColor: C.cream }}>
          {/* mute the recording's own audio when a replacement VO is supplied */}
          <SafeCapture file={capture} muted={revoiced} />
        </AbsoluteFill>
        {/* female voiceover, each clip anchored to its original timestamp */}
        {voSegments.map((v, i) => (
          <Sequence key={`vo${i}`} from={v.from}>
            <Audio src={staticFile(v.file)} />
          </Sequence>
        ))}
        {chapters.map((c, i) => (
          <Sequence key={i} from={c.at} durationInFrames={c.len}>
            <LowerThird label={c.label} detail={c.detail} hue={c.hue} />
          </Sequence>
        ))}
      </Sequence>

      <Sequence from={introLen - XF + captureLen} durationInFrames={outroLen}>
        <Outro headline={outroHeadline} cta={outroCta} url={outroUrl} note={outroNote} />
        {outroVo && (
          <Sequence from={12}>
            <Audio src={staticFile(outroVo)} />
          </Sequence>
        )}
      </Sequence>

      {/* persistent brand mark — bottom-left, above every sequence (intro/capture/outro) */}
      <LogoBug />
    </AbsoluteFill>
  );
};
