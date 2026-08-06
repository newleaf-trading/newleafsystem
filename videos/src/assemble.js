'use strict';

/**
 * assemble.js — STEP 5. Stitch the final MP4 with continuity:
 *
 *  Video: type-aware transitions (straight cut / 0.3s crossfade for same-type
 *  scene boundaries; 0.4s dip-to-brand-green for type changes; optional 0.8s
 *  gold-sweep sting), per-boundary overridable in the manifest.
 *
 *  Audio: NO hard-silence gaps — narration is placed on the timeline with
 *  J-cuts (each scene's narration LEADS its visual cut by audio_lead_ms). Each
 *  segment gets 30ms micro-fades + is levelled to a common RMS before mixing.
 *  A continuous, sidechain-ducked music bed runs 0→end with 1.5s fades. One
 *  final loudnorm on the mix.
 *
 * Built in three ffmpeg stages (video / audio / mux) for robustness, then the
 * optional compliance overlay pass.
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const hyperframes = require('./providers/hyperframes');
const { loadManifest, saveManifest } = require('./lib/manifest');
const { episodeStateHash } = require('./lib/staleness');
const { runFfmpeg, probeDuration, ensureFfmpeg } = require('./lib/util');
const S = require('./lib/style-constants');

const ROOT = path.join(__dirname, '..');
const COMPLIANCE_TEXT_DEFAULT = 'Educational content — not financial advice';

function finalFileFor(epDir, episode) {
  return path.join(epDir, 'final', `${episode}.mp4`);
}

/** Mean volume (dB) of an audio file via ffmpeg volumedetect. */
function meanVolumeDb(file) {
  try {
    const out = execFileSync('ffmpeg', ['-hide_banner', '-i', file, '-af', 'volumedetect', '-f', 'null', '-'], {
      encoding: 'utf-8',
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    return -70; // shouldn't reach — volumedetect prints to stderr
  } catch (e) {
    const m = /mean_volume:\s*(-?\d+(\.\d+)?)\s*dB/.exec(e.stderr || '');
    return m ? parseFloat(m[1]) : -70;
  }
}

/** Resolve the music bed file from manifest.music or a legacy episode music.mp3. */
function resolveMusic(epDir, manifest) {
  const m = manifest.music;
  if (m === null) return null; // explicitly disabled
  if (m && m.file) {
    for (const cand of [path.join(ROOT, 'assets', 'music', m.file), path.join(epDir, m.file), m.file]) {
      if (fs.existsSync(cand)) return { file: cand, volume_db: m.volume_db != null ? m.volume_db : S.MUSIC_VOLUME_DB };
    }
    console.log(`  ⚠ music bed "${m.file}" not found — assembling without it`);
    return null;
  }
  const legacy = path.join(epDir, 'music.mp3');
  return fs.existsSync(legacy) ? { file: legacy, volume_db: S.MUSIC_VOLUME_DB } : null;
}

/** Transition {type, dur} for the boundary leading INTO clip i (i>=1). */
function transitionInto(scene, prevType) {
  const type = scene.transition || S.defaultTransition(prevType, scene.type);
  const dur = { cut: 0, crossfade: S.CROSSFADE_SAME_S, dip: S.DIP_S, sting: S.STING_S }[type] ?? S.DIP_S;
  return { type, dur };
}

/** Per-clip video start times + total, given transitions. */
function computeTimeline(clips) {
  const starts = [0];
  let running = clips[0].dur;
  for (let i = 1; i < clips.length; i++) {
    const t = clips[i].trans;
    if (t.type === 'crossfade') {
      starts[i] = +(running - t.dur).toFixed(3);
      running = running + clips[i].dur - t.dur;
    } else {
      starts[i] = +running.toFixed(3);
      running += clips[i].dur;
    }
  }
  return { starts, total: +running.toFixed(3) };
}

// ---------------------------------------------------------------------------
// Video stage
// ---------------------------------------------------------------------------
async function buildVideo(clips, outAbs) {
  const inputs = [];
  clips.forEach((c) => inputs.push('-i', c.abs));
  const parts = [];
  const D2 = (S.DIP_S / 2).toFixed(3);

  // Uniform normalisation applied to every clip and every intermediate so that
  // mixing concat (dips/cuts) and xfade (crossfades) doesn't trip ffmpeg's
  // "reinitializing filters" (timebase/SAR/format must stay identical).
  const NORM = 'fps=30,setsar=1,settb=AVTB,format=yuv420p';

  // Per-clip head/tail dip fades (fade to/from brand green).
  clips.forEach((c, i) => {
    const chain = [];
    if (i > 0 && c.trans.type === 'dip') chain.push(`fade=t=in:st=0:d=${D2}:color=${S.BRAND_GREEN_FF}`);
    if (i < clips.length - 1 && clips[i + 1].trans.type === 'dip') {
      chain.push(`fade=t=out:st=${(c.dur - S.DIP_S / 2).toFixed(3)}:d=${D2}:color=${S.BRAND_GREEN_FF}`);
    }
    chain.push(NORM);
    parts.push(`[${i}:v]${chain.join(',')}[c${i}]`);
  });

  // Combine pairwise: xfade for crossfade, concat for cut/dip/sting; renormalise
  // the composite after each step.
  let prev = 'c0';
  let running = clips[0].dur;
  for (let i = 1; i < clips.length; i++) {
    const t = clips[i].trans;
    const raw = `x${i}`;
    const out = `v${i}`;
    if (t.type === 'crossfade') {
      parts.push(`[${prev}][c${i}]xfade=transition=fade:duration=${t.dur}:offset=${(running - t.dur).toFixed(3)}[${raw}]`);
      running = running + clips[i].dur - t.dur;
    } else {
      parts.push(`[${prev}][c${i}]concat=n=2:v=1:a=0[${raw}]`);
      running += clips[i].dur;
    }
    parts.push(`[${raw}]${NORM}[${out}]`);
    prev = out;
  }
  const lastLabel = clips.length === 1 ? 'c0' : prev;

  const args = ['-y', ...inputs, '-filter_complex', parts.join(';'), '-map', `[${lastLabel}]`,
    '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30', '-an', '-movflags', '+faststart', outAbs];
  await runFfmpeg(args, { label: 'assemble video' });
}

// ---------------------------------------------------------------------------
// Audio stage (J-cuts + conditioning + music bed)
// ---------------------------------------------------------------------------
async function buildAudio(segScenes, starts, total, music, outAbs) {
  const inputs = [];
  const parts = [];
  const MF = S.MICROFADE_S.toFixed(3);

  segScenes.forEach((seg, j) => {
    inputs.push('-i', seg.file);
    const gainDb = Math.max(-12, Math.min(12, S.SEGMENT_RMS_DB - seg.mean));
    const tailStart = Math.max(0, seg.dur - S.MICROFADE_S).toFixed(3);
    const delayMs = Math.round(seg.audioStart * 1000);
    parts.push(
      `[${j}:a]aformat=sample_rates=44100:channel_layouts=stereo,` +
        `afade=t=in:d=${MF},afade=t=out:st=${tailStart}:d=${MF},` +
        `volume=${gainDb.toFixed(2)}dB,adelay=${delayMs}|${delayMs}[a${j}]`
    );
  });
  const mixLabels = segScenes.map((_, j) => `[a${j}]`).join('');
  parts.push(`${mixLabels}amix=inputs=${segScenes.length}:duration=longest:normalize=0,atrim=0:${total},apad=whole_dur=${total}[narr]`);

  let audioOut = 'narr';
  if (music) {
    const musIdx = segScenes.length;
    // Loop the bed to cover the whole episode, but BOUND the looped input with
    // an input-side -t so ffmpeg can't run forever (an unbounded -stream_loop -1
    // feeding apad/amix does not always terminate on the output -t alone).
    inputs.push('-stream_loop', '-1', '-t', total.toFixed(3), '-i', music.file);
    parts.push(
      `[${musIdx}:a]aformat=sample_rates=44100:channel_layouts=stereo,` +
        `volume=${music.volume_db}dB,atrim=0:${total},` +
        `afade=t=in:d=${S.MUSIC_FADE_S},afade=t=out:st=${(total - S.MUSIC_FADE_S).toFixed(3)}:d=${S.MUSIC_FADE_S}[bed]`
    );
    parts.push(`[narr]asplit=2[narrMain][narrSc]`);
    parts.push(`[bed][narrSc]sidechaincompress=threshold=0.03:ratio=8:attack=5:release=250[duck]`);
    parts.push(`[narrMain][duck]amix=inputs=2:duration=first:normalize=0[mixed]`);
    audioOut = 'mixed';
  }
  // Integrated-loudness target. Default -16 (unchanged). Social masters want -14
  // (YouTube/IG normalise to ~-14 LUFS) — set LOUDNESS_LUFS=-14 for those runs, or
  // apply scripts/loudnorm-social.mjs to an already-rendered file.
  const lufs = Number(process.env.LOUDNESS_LUFS) || -16;
  parts.push(`[${audioOut}]loudnorm=I=${lufs}:TP=-1.5:LRA=11[aout]`);

  const args = ['-y', ...inputs, '-filter_complex', parts.join(';'), '-map', '[aout]',
    '-t', String(total), '-c:a', 'pcm_s16le', outAbs];
  await runFfmpeg(args, { label: 'assemble audio' });
}

// ---------------------------------------------------------------------------
async function runAssemble(epDir, { force = false } = {}) {
  ensureFfmpeg();
  const manifest = loadManifest(epDir);
  const episode = manifest.episode;

  // Clips in scene order that exist on disk, each with its scene + transition.
  const clips = [];
  let prevType = null;
  for (const scene of manifest.scenes) {
    if (!scene.clip.normalised_file) continue;
    const abs = path.join(epDir, scene.clip.normalised_file);
    if (!fs.existsSync(abs)) { console.log(`  ⚠ Scene ${scene.id} normalised_file missing — skipping`); continue; }
    const dur = probeDuration(abs);
    const trans = clips.length === 0 ? { type: 'cut', dur: 0 } : transitionInto(scene, prevType);
    clips.push({ scene, abs, dur, trans });
    prevType = scene.type;
  }
  if (clips.length === 0) throw new Error('No normalised clips found — run normalise first.');

  const outAbs = finalFileFor(epDir, episode);
  if (fs.existsSync(outAbs) && !force) {
    console.log(`  ↻ ${path.relative(epDir, outAbs)} already exists — use --force to rebuild`);
    return manifest;
  }
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });

  const { starts, total } = computeTimeline(clips);
  console.log(`  ▶ Transitions: ${clips.map((c, i) => (i ? c.trans.type : 'start')).join(' → ')}`);

  // Audio segments (all narrated scenes, placed by J-cut against the video timeline).
  const startById = new Map(clips.map((c, i) => [c.scene.id, starts[i]]));
  const segScenes = [];
  manifest.scenes.forEach((scene) => {
    if (!scene.audio.file) return;
    const file = path.join(epDir, scene.audio.file);
    if (!fs.existsSync(file)) return;
    const lead = (scene.audio_lead_ms != null ? scene.audio_lead_ms : S.AUDIO_LEAD_MS) / 1000;
    const vStart = startById.has(scene.id) ? startById.get(scene.id) : 0;
    const isFirst = segScenes.length === 0;
    const audioStart = isFirst ? 0 : Math.max(0, +(vStart - lead).toFixed(3));
    segScenes.push({ file, dur: probeDuration(file), mean: meanVolumeDb(file), audioStart });
  });
  if (segScenes.length === 0) throw new Error('No per-scene audio — run the voice step first.');

  const music = resolveMusic(epDir, manifest);
  console.log(`  ${music ? '♪ music bed: ' + path.basename(music.file) + ` @ ${music.volume_db}dB (ducked)` : '(no music bed)'}`);

  // Stage 1+2: video and audio to temp files.
  const tmpV = path.join(epDir, 'final', `.${episode}.v.mp4`);
  const tmpA = path.join(epDir, 'final', `.${episode}.a.wav`);
  console.log(`  ▶ Building video (${clips.length} clips, ~${total.toFixed(1)}s) + J-cut audio (lead ${S.AUDIO_LEAD_MS}ms)`);
  await buildVideo(clips, tmpV);
  await buildAudio(segScenes, starts, total, music, tmpA);

  // Stage 3: mux.
  await runFfmpeg(['-y', '-i', tmpV, '-i', tmpA, '-map', '0:v', '-map', '1:a',
    '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', '-shortest', outAbs], { label: 'mux' });
  fs.unlinkSync(tmpV); fs.unlinkSync(tmpA);

  // Optional compliance overlay (unchanged).
  if (manifest.compliance_overlay) {
    const finalDur = probeDuration(outAbs);
    const text = manifest.compliance_text || COMPLIANCE_TEXT_DEFAULT;
    const overlayMov = path.join(epDir, '.hyperframes', 'compliance-overlay.mov');
    console.log(`  ⚖ Compositing compliance overlay …`);
    await hyperframes.renderOverlay({ epDir, durationS: finalDur, text, destPath: overlayMov, aspect: manifest.aspect });
    const tmpOut = `${outAbs}.overlay.mp4`;
    await runFfmpeg(['-y', '-i', outAbs, '-i', overlayMov, '-filter_complex', '[0:v][1:v]overlay=0:0[v]',
      '-map', '[v]', '-map', '0:a', '-c:v', 'libx264', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', tmpOut], { label: 'compliance overlay' });
    fs.renameSync(tmpOut, outAbs);
    console.log('  ✓ Compliance overlay applied');
  }

  manifest.final.file = path.relative(epDir, outAbs);
  manifest.final.status = 'done';
  manifest.final.duration_s = +probeDuration(outAbs).toFixed(3);
  manifest.final.built_at = new Date().toISOString();
  const breakdown = {};
  for (const s of manifest.scenes) if (s.clip.cost_usd) breakdown[s.provider] = +((breakdown[s.provider] || 0) + s.clip.cost_usd).toFixed(2);
  manifest.final.cost_breakdown = breakdown;
  manifest.final.built_hash = episodeStateHash(manifest);
  saveManifest(epDir, manifest);
  console.log(`  ✓ Final video → ${manifest.final.file} (~${total.toFixed(1)}s)`);
  return manifest;
}

module.exports = { runAssemble, computeTimeline, transitionInto };
