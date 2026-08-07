#!/usr/bin/env node
/**
 * build-reel-deliverable.mjs — assemble the 9:16 Reels/Shorts deliverable from
 * the purpose-built portrait teaser (NOT a pillar-boxed reframe of the 16:9 film).
 *
 * Pipeline (all local, $0):
 *   1. render IntroVertical + OutroVertical brand bookends (Remotion, 1080x1920)
 *   2. upscale the teaser to 1080x1920 (force-fit 9:16, pad if needed)
 *   3. concat  intro → teaser → outro  (unified 30fps / yuv420p / 48k stereo)
 *   4. loudnorm the master to -14 LUFS (social target; matches loudnorm-social.mjs)
 *   5. write it to BOTH 03-reels-9x16.mp4 and 04-youtube-shorts-9x16.mp4
 *      (Shorts reuses the Reels master).
 *
 * Idempotent: re-running overwrites the two deliverables. Outputs live under the
 * gitignored out/, so this script IS the reproducible source for that swap.
 *
 * Usage:
 *   node scripts/build-reel-deliverable.mjs
 *   node scripts/build-reel-deliverable.mjs --teaser episodes/tiq-teaser/final/tiq-teaser-v3.mp4 \
 *        --out remotion/out/tiq-assets/DELIVERABLES --keep-scratch
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, copyFileSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const VIDEOS = resolve(__dirname, '..');
const REMOTION = join(VIDEOS, 'remotion');

const LUFS = -14, TP = -1.5, LRA = 11;          // social loudness target
const W = 1080, H = 1920, FPS = 30;             // 9:16 deliverable spec
const REELS = '03-reels-9x16.mp4';
const SHORTS = '04-youtube-shorts-9x16.mp4';

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--')
    ? process.argv[i + 1] : def;
}
const flag = (name) => process.argv.includes(`--${name}`);

function run(cmd, args, opts = {}) {
  execFileSync(cmd, args, { stdio: ['ignore', 'ignore', 'inherit'], ...opts });
}

// fit any source into WxH, centre-pad, unify fps/pixel-format
const vfit = (idx, out) =>
  `[${idx}:v]scale=${W}:${H}:force_original_aspect_ratio=decrease,` +
  `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2,setsar=1,fps=${FPS},format=yuv420p[${out}]`;
const afit = (idx, out) => `[${idx}:a]aformat=sample_rates=48000:channel_layouts=stereo[${out}]`;

function main() {
  const teaser = resolve(VIDEOS, arg('teaser', 'episodes/tiq-teaser/final/tiq-teaser-v3.mp4'));
  const outDir = resolve(VIDEOS, arg('out', 'remotion/out/tiq-assets/DELIVERABLES'));
  const scratch = join(REMOTION, 'out', 'tiq-assets', '_reel-build');

  if (!existsSync(teaser)) { console.error(`  ✗ teaser not found: ${teaser}`); process.exit(2); }
  mkdirSync(outDir, { recursive: true });
  mkdirSync(scratch, { recursive: true });

  const intro = join(scratch, 'intro.mp4');
  const outro = join(scratch, 'outro.mp4');
  const master = join(scratch, 'reel-master-14lufs.mp4');
  const concat = join(scratch, 'reel-concat.mp4');

  // 1. brand bookends
  console.log('  ▶ [1/5] rendering IntroVertical + OutroVertical …');
  run('npx', ['remotion', 'render', 'src/index.js', 'IntroVertical', intro, '--log=error'], { cwd: REMOTION });
  run('npx', ['remotion', 'render', 'src/index.js', 'OutroVertical', outro, '--log=error'], { cwd: REMOTION });

  // 2+3. upscale teaser inline + concat intro → teaser → outro
  console.log('  ▶ [2/5] upscaling teaser → 1080×1920  [3/5] concat intro→teaser→outro …');
  const fc = [
    vfit(0, 'v0'), vfit(1, 'v1'), vfit(2, 'v2'),
    afit(0, 'a0'), afit(1, 'a1'), afit(2, 'a2'),
    '[v0][a0][v1][a1][v2][a2]concat=n=3:v=1:a=1[v][a]',
  ].join(';');
  run('ffmpeg', ['-y', '-loglevel', 'error',
    '-i', intro, '-i', teaser, '-i', outro,
    '-filter_complex', fc, '-map', '[v]', '-map', '[a]',
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', concat]);

  // 4. loudnorm to -14 LUFS (video copied, audio re-encoded)
  console.log(`  ▶ [4/5] loudnorm → ${LUFS} LUFS …`);
  run('ffmpeg', ['-y', '-loglevel', 'error', '-i', concat,
    '-af', `loudnorm=I=${LUFS}:TP=${TP}:LRA=${LRA}`,
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', master]);

  // 5. place both deliverables (Shorts reuses the Reels master)
  console.log('  ▶ [5/5] writing deliverables …');
  for (const name of [REELS, SHORTS]) copyFileSync(master, join(outDir, name));

  if (!flag('keep-scratch')) rmSync(scratch, { recursive: true, force: true });

  const dur = execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration',
    '-of', 'default=nw=1:nk=1', join(outDir, REELS)], { encoding: 'utf8' }).trim();
  console.log(`\n✓ 9:16 deliverables built (${W}×${H}, ${Number(dur).toFixed(1)}s, ${LUFS} LUFS):`);
  console.log(`   ${join(outDir, REELS)}`);
  console.log(`   ${join(outDir, SHORTS)}`);
}

main();
