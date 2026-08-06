#!/usr/bin/env node
/**
 * golden-frame.mjs — visual regression for the brand comps.
 *
 * `--check` (the token drift guard) catches a stale brand-tokens.js, but NOT a
 * font that failed to load and silently fell back to a system serif — that passes
 * every token check and ships wrong. This renders one reference frame per comp and
 * compares it to a committed golden PNG via ffmpeg SSIM (no extra npm deps).
 *
 * Usage:
 *   node scripts/golden-frame.mjs --update   # (re)baseline goldens
 *   node scripts/golden-frame.mjs            # compare; exit 1 on regression
 *
 * SSIM threshold 0.985: a font fallback or colour drift tanks SSIM well below this;
 * codec noise stays above it.
 */
import { execFileSync, execSync } from 'node:child_process';
import { mkdirSync, existsSync, copyFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REMOTION = resolve(__dirname, '..', 'remotion');
const GOLDEN_DIR = resolve(REMOTION, 'goldens');
const TMP = resolve(REMOTION, 'out', '.golden-tmp');
const THRESHOLD = 0.985;

// Representative brand surfaces. Frame chosen where type is on screen.
const TARGETS = [
  { name: 'intro',      comp: 'IntroOnly',   frame: 60, props: { title: 'Know your number.', sub: 'Before you place the trade.' } },
  { name: 'outro',      comp: 'OutroOnly',   frame: 90 },
  { name: 'thumb-yt',   comp: 'ThumbnailYT', frame: 0,  props: { variant: 'b', kicker: 'Trading IQ', title: 'How certain —\nand wrong?' } },
  { name: 'thumb-ig',   comp: 'ThumbnailIG', frame: 0,  props: { variant: 'a', kicker: 'Trading IQ', title: 'Know your\nnumber.' } },
];

function renderStill(t, outPath) {
  const args = ['remotion', 'still', t.comp, outPath, `--frame=${t.frame}`];
  if (t.props) args.push(`--props=${JSON.stringify(t.props)}`);
  execFileSync('npx', args, { cwd: REMOTION, stdio: ['ignore', 'ignore', 'pipe'] });
}

/** SSIM "All" score between two PNGs. ffmpeg writes ssim to stderr, so redirect
 *  2>&1 and parse the combined stream. */
function ssimSafe(a, b) {
  const out = execSync(`ffmpeg -hide_banner -i "${a}" -i "${b}" -lavfi ssim -f null - 2>&1`, { encoding: 'utf8' });
  const m = out.match(/All:([0-9.]+)/);
  return m ? Number(m[1]) : NaN;
}

function main() {
  const update = process.argv.includes('--update');
  mkdirSync(GOLDEN_DIR, { recursive: true });
  mkdirSync(TMP, { recursive: true });
  let failed = 0, baselined = 0;

  for (const t of TARGETS) {
    const golden = join(GOLDEN_DIR, `${t.name}.png`);
    const current = join(TMP, `${t.name}.png`);
    renderStill(t, current);

    if (update || !existsSync(golden)) {
      copyFileSync(current, golden);
      console.log(`  ⦿ baselined ${t.name}`);
      baselined++;
      continue;
    }
    const score = ssimSafe(current, golden);
    if (!(score >= THRESHOLD)) {
      console.error(`  ✗ ${t.name}: SSIM ${score} < ${THRESHOLD} — visual regression (font fallback? colour drift?)`);
      failed++;
    } else {
      console.log(`  ✓ ${t.name}: SSIM ${score.toFixed(4)}`);
    }
  }
  rmSync(TMP, { recursive: true, force: true });

  if (baselined) console.log(`\nBaselined ${baselined} golden(s). Commit videos/remotion/goldens/.`);
  if (failed) { console.error(`\n✗ ${failed} comp(s) regressed.`); process.exit(1); }
  console.log('\n✓ all brand comps match their goldens.');
}

main();
