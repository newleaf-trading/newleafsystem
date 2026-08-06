// AUTO-GENERATED from web/src/shared/styles/tokens.css — DO NOT EDIT BY HAND.
// Regenerate:  node videos/scripts/sync-brand-tokens.mjs
// Drift guard: node videos/scripts/sync-brand-tokens.mjs --check  (release blocker)
//
// The NewLeaf brand's single source of truth is the website's tokens.css.
// The Remotion video kit derives from THIS file so it can never drift again.

/** Site-derived brand tokens (colours, fonts, radii). */
export const NL = {
  green: '#0B2D23',
  gold: '#C9A96E',
  bg: '#F7F5F0',
  text: '#111827',
  textMuted: '#6b7280',
  textDim: '#9ca3af',
  card: '#FFFFFF',
  border: 'rgba(17, 24, 39, 0.10)',
  profit: '#0B7A52',
  profitBg: 'rgba(11, 122, 82, 0.06)',
  profitBorder: 'rgba(11, 122, 82, 0.15)',
  loss: '#C94F4F',
  lossBg: 'rgba(201, 79, 79, 0.06)',
  lossBorder: 'rgba(201, 79, 79, 0.15)',
  warn: '#B7791F',
  warnBg: 'rgba(183, 121, 31, 0.06)',
  warnBorder: 'rgba(183, 121, 31, 0.15)',
  action: '#ea580c',
  actionBg: 'rgba(234, 88, 12, 0.06)',
  actionBorder: 'rgba(234, 88, 12, 0.15)',
  fontDisplay: 'Playfair Display',
  fontMono: 'Space Mono',
  fontBody: 'Inter',
  spaceXs: 4,
  spaceSm: 8,
  spaceMd: 14,
  spaceLg: 20,
  spaceXl: 32,
  radius: 14,
  radiusSm: 8,
  radiusLg: 18,
  radiusPill: 999,
  shadowSm: '0 1px 3px rgba(17, 24, 39, 0.04)',
  shadowMd: '0 4px 12px rgba(17, 24, 39, 0.06)',
  shadowLg: '0 8px 24px rgba(17, 24, 39, 0.10)',
};

/** Deliberate video-only variants — declared in the generator, not the site. */
export const NL_VIDEO = {
  ink: '#07110C',
  minDisplaySize: 40,
  fontDisplayVideoWeight: 900,
  thumbHeadlineMin: 64,
  goldIsSurfaceOnly: true,
  loudnessLufs: -14,
};
