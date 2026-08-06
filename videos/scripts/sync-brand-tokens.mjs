#!/usr/bin/env node
/**
 * sync-brand-tokens.mjs — the single source of truth bridge.
 *
 * The NewLeaf brand lives in ONE place: web/src/shared/styles/tokens.css.
 * This script parses its `--nl-*` custom properties and emits a plain-JS module
 * the Remotion video kit imports (videos/remotion/src/brand-tokens.js), so video
 * colours/fonts DERIVE from the site and can never drift again.
 *
 * Usage:
 *   node scripts/sync-brand-tokens.mjs            # (re)generate brand-tokens.js
 *   node scripts/sync-brand-tokens.mjs --check    # exit 1 if the file is stale
 *
 * The --check mode is a RELEASE BLOCKER, modelled on the TIQ sync.js drift guard:
 * if someone edits tokens.css but doesn't regenerate, CI/pre-deploy fails loudly
 * instead of shipping off-brand video.
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, '..', '..');
const TOKENS_CSS = resolve(REPO_ROOT, 'web/src/shared/styles/tokens.css');
const OUT_FILE = resolve(REPO_ROOT, 'videos/remotion/src/brand-tokens.js');

// ── deliberate VIDEO-ONLY constants ─────────────────────────────────────────
// These are NOT in tokens.css — they are declared here on purpose (§1.3 of the
// pipeline spec) so the "video variant" of the brand is explicit, not drift.
// Regenerated verbatim each run so --check stays stable.
const NL_VIDEO = {
  // ink is a darker-than-green backdrop used for intro/outro fills.
  ink: '#07110C',
  // Playfair is a high-contrast Didone: its hairlines vanish when small.
  // Never use the display face below minDisplaySize — Inter takes over there.
  minDisplaySize: 40, // px
  // Thumbnail headlines must be big AND heavy to survive feed-scale compression.
  fontDisplayVideoWeight: 900,
  thumbHeadlineMin: 64, // px at 1280x720
  // Gold #C9A96E on cream is ~2:1 contrast — illegible as text. Gold is a
  // SURFACE (pill fill with forest text), never text on a light background.
  goldIsSurfaceOnly: true,
  // Loudness target for social masters (YouTube/IG normalise to ~-14 LUFS).
  loudnessLufs: -14,
};

/** `--nl-text-muted` → `textMuted`, `--nl-font-display` → `fontDisplay`. */
function camel(prop) {
  return prop
    .replace(/^--nl-/, '')
    .split('-')
    .map((part, i) => (i === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('');
}

/** Pull the first font family out of a CSS font stack, unquoted. */
function firstFamily(value) {
  const first = value.split(',')[0].trim();
  return first.replace(/^['"]|['"]$/g, '');
}

/** Parse every `--nl-*: value;` declaration from tokens.css, in source order. */
function parseTokens(css) {
  const out = {};
  const re = /(--nl-[a-z0-9-]+)\s*:\s*([^;]+);/gi;
  let m;
  while ((m = re.exec(css))) {
    const key = camel(m[1]);
    const raw = m[2].trim();
    if (key.startsWith('font')) {
      out[key] = firstFamily(raw); // 'Playfair Display' (not the whole stack)
    } else if (/^\d+px$/.test(raw)) {
      out[key] = Number(raw.replace('px', '')); // radius: 14
    } else {
      out[key] = raw; // hex, rgba(), etc. kept verbatim
    }
  }
  return out;
}

/** Serialise an object literal deterministically (stable key order = insertion). */
function serialise(obj, indent = '  ') {
  const lines = Object.entries(obj).map(([k, v]) => {
    const val = typeof v === 'number' ? String(v) : typeof v === 'boolean' ? String(v) : `'${v}'`;
    return `${indent}${k}: ${val},`;
  });
  return `{\n${lines.join('\n')}\n}`;
}

function render(nl) {
  return `// AUTO-GENERATED from web/src/shared/styles/tokens.css — DO NOT EDIT BY HAND.
// Regenerate:  node videos/scripts/sync-brand-tokens.mjs
// Drift guard: node videos/scripts/sync-brand-tokens.mjs --check  (release blocker)
//
// The NewLeaf brand's single source of truth is the website's tokens.css.
// The Remotion video kit derives from THIS file so it can never drift again.

/** Site-derived brand tokens (colours, fonts, radii). */
export const NL = ${serialise(nl)};

/** Deliberate video-only variants — declared in the generator, not the site. */
export const NL_VIDEO = ${serialise(NL_VIDEO)};
`;
}

// ── main ─────────────────────────────────────────────────────────────────────
function main() {
  if (!existsSync(TOKENS_CSS)) {
    console.error(`✗ brand source not found: ${TOKENS_CSS}`);
    process.exit(2);
  }
  const css = readFileSync(TOKENS_CSS, 'utf8');
  const nl = parseTokens(css);
  if (!nl.green || !nl.gold) {
    console.error('✗ tokens.css parsed but missing --nl-green / --nl-gold — aborting.');
    process.exit(2);
  }
  const next = render(nl);
  const check = process.argv.includes('--check');
  const current = existsSync(OUT_FILE) ? readFileSync(OUT_FILE, 'utf8') : null;

  if (check) {
    if (current === next) {
      console.log('✓ brand-tokens.js is in sync with tokens.css');
      process.exit(0);
    }
    console.error('✗ brand-tokens.js is STALE vs tokens.css.');
    console.error('  Run: node videos/scripts/sync-brand-tokens.mjs');
    process.exit(1);
  }

  if (current === next) {
    console.log('✓ brand-tokens.js already up to date (no change).');
    return;
  }
  writeFileSync(OUT_FILE, next);
  console.log(`✓ wrote ${OUT_FILE}`);
  console.log(`  green=${nl.green} gold=${nl.gold} display=${nl.fontDisplay} body=${nl.fontBody}`);
}

main();
