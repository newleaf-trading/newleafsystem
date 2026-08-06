#!/usr/bin/env node
/**
 * render-thumb.mjs — render on-brand thumbnails as Remotion stills.
 *
 * Renders N variants × {YouTube 1280x720, Instagram 1080x1350} from the
 * Thumbnail composition. Copy is a MANUAL field (its job is to hook, not to be
 * deterministic — spec §3/§11): pass a --config JSON of variants, or fall back to
 * the built-in TIQ set below.
 *
 * Usage:
 *   node scripts/render-thumb.mjs                         # TIQ default set
 *   node scripts/render-thumb.mjs --out out/x --config v.json
 *
 * --config JSON shape: { "episode":"tiq", "variants":[{ "id":"a", "props":{...Thumbnail props} }, ...] }
 */
import { execFileSync } from 'node:child_process';
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REMOTION = resolve(__dirname, '..', 'remotion');

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : def;
}

// Built-in TIQ variant set (3 angles). Override with --config.
const TIQ = {
  episode: 'tiq',
  variants: [
    { id: 'a', props: { variant: 'a', kicker: 'Trading IQ', title: 'Know your\nnumber.', verdict: { label: '4-min test', kind: 'neutral' } } },
    { id: 'b', props: { variant: 'b', kicker: 'Trading IQ', title: 'How certain —\nand wrong?', verdict: { label: 'Take the test', kind: 'risk' } } },
    { id: 'c', props: { variant: 'c', kicker: 'Trading IQ', title: 'Find your\nweakest axis.', ticker: 'TIQ', verdict: { label: '5 dimensions', kind: 'buy' } } },
  ],
};

const SIZES = [
  { comp: 'ThumbnailYT', tag: 'yt-1280x720' },
  { comp: 'ThumbnailIG', tag: 'ig-1080x1350' },
];

function main() {
  const configPath = arg('config');
  const cfg = configPath ? JSON.parse(readFileSync(configPath, 'utf8')) : TIQ;
  const outDir = resolve(REMOTION, arg('out', join('out', 'tiq-assets', 'thumbs')));
  mkdirSync(outDir, { recursive: true });
  const tmpDir = resolve(REMOTION, 'out', '.thumb-props');
  mkdirSync(tmpDir, { recursive: true });

  const made = [];
  for (const v of cfg.variants) {
    for (const size of SIZES) {
      const propsFile = join(tmpDir, `${cfg.episode}-${v.id}-${size.tag}.json`);
      writeFileSync(propsFile, JSON.stringify(v.props));
      const outFile = join(outDir, `${cfg.episode}-thumb-${size.tag}-v${v.id}.png`);
      process.stdout.write(`  ▶ ${size.comp} v${v.id} → ${outFile}\n`);
      execFileSync('npx', ['remotion', 'still', size.comp, outFile, `--props=${propsFile}`],
        { cwd: REMOTION, stdio: ['ignore', 'ignore', 'inherit'] });
      made.push(outFile);
    }
  }
  console.log(`\n✓ ${made.length} thumbnails → ${outDir}`);
  made.forEach((f) => console.log('   ' + f));
}

main();
