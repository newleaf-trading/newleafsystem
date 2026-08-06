#!/usr/bin/env node
/**
 * loudnorm-social.mjs — normalise a rendered mp4 to -14 LUFS for YouTube/Instagram.
 *
 * Both platforms normalise to ~-14 LUFS; masters that land hot (e.g. -9) get pulled
 * down and quiet passages sit oddly. This applies one ffmpeg loudnorm pass (video
 * copied, audio re-encoded) and logs the measured in/out. Use on Remotion renders
 * that bypass the pipeline's assemble step.
 *
 * Usage: node scripts/loudnorm-social.mjs <in.mp4> [<in2.mp4> ...]
 *        → writes <name>-14lufs.mp4 next to each input.
 */
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { extname } from 'node:path';

const LUFS = -14, TP = -1.5, LRA = 11;
const inputs = process.argv.slice(2).filter((a) => !a.startsWith('--'));

if (!inputs.length) { console.error('usage: loudnorm-social.mjs <in.mp4> [...]'); process.exit(2); }

function measure(file) {
  // ffmpeg prints measured integrated loudness to stderr with -af loudnorm print_format
  try {
    const out = execFileSync('ffmpeg', ['-hide_banner', '-i', file, '-af', 'loudnorm=print_format=summary', '-f', 'null', '-'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return out;
  } catch (e) {
    const s = String(e.stderr || '');
    const m = s.match(/Input Integrated:\s*(-?[0-9.]+)/);
    return m ? `Input Integrated: ${m[1]} LUFS` : '(unmeasured)';
  }
}

for (const inp of inputs) {
  if (!existsSync(inp)) { console.error(`  ✗ missing: ${inp}`); continue; }
  const out = inp.replace(new RegExp(`${extname(inp)}$`), '-14lufs.mp4');
  const before = (measure(inp).match(/Input Integrated:\s*(-?[0-9.]+)/) || [])[1] || '?';
  process.stdout.write(`  ▶ ${inp}  (in ${before} LUFS) → ${out}\n`);
  execFileSync('ffmpeg', ['-y', '-i', inp,
    '-af', `loudnorm=I=${LUFS}:TP=${TP}:LRA=${LRA}`,
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', out],
    { stdio: ['ignore', 'ignore', 'inherit'] });
  console.log(`  ✓ ${out}  (target ${LUFS} LUFS)`);
}
