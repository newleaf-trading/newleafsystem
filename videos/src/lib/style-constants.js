'use strict';

/**
 * style-constants.js — one place for the brand look + transition/continuity
 * numbers used by normalise.js and assemble.js.
 */

// Brand "Forest Green" in the various forms ffmpeg wants.
const BRAND_GREEN_HEX = '0B2D23';
const BRAND_GREEN_FF = '0x0B2D23'; // pad/fade color= form
const BRAND_GREEN_CSS = '#0B2D23';

/**
 * Subtle unified brand grade (~15% strength): a gentle contrast S-curve, a lift
 * of greens/golds, and a touch of warmth in the mids. Applied to ALL clips in
 * normalise EXCEPT screencaps (UI colour must stay accurate). Kept mild so it
 * unifies without stylising.
 */
const BRAND_GRADE_VF = [
  'eq=contrast=1.045:saturation=1.06:gamma_g=1.03:gamma_r=1.01',
  'colorbalance=rs=0.02:gs=0.03:bs=-0.02:rm=0.015:gm=0.02:bm=-0.01:gh=0.015',
  'curves=all=0/0 0.25/0.235 0.75/0.775 1/1',
].join(',');

/**
 * Brand logo "bug" composited top-left on avatar (presenter) scenes during
 * normalise. Path is relative to the videos/ project root. Disable per-episode
 * with `manifest.avatar_logo = false`.
 */
const BRAND_LOGO = {
  file: 'assets/brand/newleaf-logo.png',
  height_px: 116, // rendered height inside the 1080p frame
  margin_x: 56,
  margin_y: 48,
  opacity: 1,
};

// Transition durations (seconds).
const CROSSFADE_SAME_S = 0.3; // scene→scene, same type
const DIP_S = 0.4; // type-change: dip to brand green and up
const STING_S = 0.8; // optional act-change sting

// Audio continuity.
const AUDIO_LEAD_MS = 400; // J-cut: next narration leads its visual cut
const MICROFADE_S = 0.03; // 30ms head/tail fades kill segment clicks
const MUSIC_FADE_S = 1.5; // bed fade in/out at episode start/end
const MUSIC_VOLUME_DB = -22; // default bed level under narration
const SEGMENT_RMS_DB = -20; // per-segment loudness target before final loudnorm

/** Default transition for a boundary given the two scene types. */
function defaultTransition(prevType, nextType) {
  return prevType === nextType ? 'crossfade' : 'dip';
}

// --- Backdrops -------------------------------------------------------------
const DEFAULT_BACKDROP = { type: 'color', value: BRAND_GREEN_CSS };

/** Resolve a scene's backdrop: scene override → episode default → brand green. */
function resolveBackdrop(manifest, scene) {
  return (scene && scene.backdrop) || (manifest && manifest.backdrop) || DEFAULT_BACKDROP;
}

/** A stable string key for a backdrop (staleness hashing). */
function backdropKey(bd) {
  const b = bd || DEFAULT_BACKDROP;
  return `${b.type}:${b.value || ''}`;
}

/** CSS `background` value for a backdrop (graphics templating). */
function backdropToCss(bd) {
  const b = bd || DEFAULT_BACKDROP;
  if (b.type === 'gradient') return b.value; // a full CSS gradient string
  if (b.type === 'image') return `#0B2D23 center/cover no-repeat`; // image injected as data URI by provider
  return b.value || BRAND_GREEN_CSS; // color
}

/** ffmpeg color for a backdrop's fill (screencap pad); null if image. */
function backdropToFfColor(bd) {
  const b = bd || DEFAULT_BACKDROP;
  if (b.type === 'color') return '0x' + String(b.value).replace('#', '');
  return BRAND_GREEN_FF; // gradient/image fall back to green pad; image composited separately
}

module.exports = {
  BRAND_GREEN_HEX,
  BRAND_GREEN_FF,
  BRAND_GREEN_CSS,
  BRAND_GRADE_VF,
  BRAND_LOGO,
  CROSSFADE_SAME_S,
  DIP_S,
  STING_S,
  AUDIO_LEAD_MS,
  MICROFADE_S,
  MUSIC_FADE_S,
  MUSIC_VOLUME_DB,
  SEGMENT_RMS_DB,
  defaultTransition,
  DEFAULT_BACKDROP,
  resolveBackdrop,
  backdropKey,
  backdropToCss,
  backdropToFfColor,
};
