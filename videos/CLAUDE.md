# Video production pipeline — workflow & routing rules

Turns a markdown script into a finished MP4 using AI generation APIs. Node.js
22, plain CommonJS JavaScript, no framework, no web server, CLI only.

## Architecture principle

**Deterministic code owns all numbers, timings, file paths, and state.** LLM /
generation output is used only for scene visuals and narration audio.
`episodes/<ep>/manifest.json` is the **single source of truth** for an episode:
every step reads it, mutates it, and writes it back **atomically** (temp file +
rename). Every step is **idempotent and resumable** — re-running skips work
already marked `done` unless `--force`.

## The step chain

```
segment → voice → generate → normalise → assemble → publish
```

| Step        | Does                                                                                  | Reads / Writes in manifest |
|-------------|---------------------------------------------------------------------------------------|----------------------------|
| `segment`   | Parse `script.md` → scenes; apply routing rules. **No LLM.**                           | creates scenes[]           |
| `voice`     | TTS (see `TTS_PROVIDER`): **per-scene** audio with request stitching + staleness; re-records only stale scenes | audio.* (file/duration/text_hash/status) |
| `generate`  | Per scene → provider adapter; async submit/poll/download raw clips                     | clip.*                     |
| `normalise` | ffmpeg → 1920x1080, 30fps, h264/yuv420p, CRF 18, audio stripped, trimmed to VO length | clip.normalised_file       |
| `assemble`  | ffmpeg → 0.4s xfade concat, VO overlay, optional ducked music, loudnorm, optional compliance overlay | final.file        |
| `publish`   | Upload final MP4 to R2 (S3 API); then social distribution (dry-run by default)         | final.r2_url, distribution.* |

## Social distribution (publish step)

After the R2 upload, `publish` runs the social adapters **iff `manifest.distribution`
is present**. Everything is **DRY-RUN unless `SOCIAL_PUBLISH=1`**; Instagram never
auto-releases (container-only) unless `distribution.instagram.publish=true`. Adapters
live in `src/publish/` (not `providers/` — those own the `generateClip` interface).
Full detail: `docs/YOUTUBE-INSTAGRAM-PIPELINE.md`. Manifest shape:

```jsonc
"distribution": {
  "youtube":   { "privacy": "unlisted", "title": "...", "tags": [...], "thumbnail": "thumbnails/yt.png", "srt": "captions.srt", "short": false },
  "instagram": { "kind": "reel", "caption": "...", "cover": "thumbnails/ig.png", "publish": false }
}
```

- **YouTube** (`src/publish/youtube.js`): Data API v3, quota ≈1600 units/upload
  (~6/day). ⚠ unaudited API projects force uploads to `private` — verify first.
  Live upload needs `npm i googleapis`.
- **Instagram** (`src/publish/instagram.js`): Graph API, Business/Creator + FB Page.
  Fetches the video from the public `final.r2_url`; container-only by default.
- **Brand + formats** are owned by the Remotion kit: `brand-tokens.js` (generated from
  the website's `tokens.css` via `scripts/sync-brand-tokens.mjs --check`), `presets.js`
  (4 native ratios + safe areas), `Thumbnail.jsx`, `Captions.jsx`. Thumbnails:
  `scripts/render-thumb.mjs`; visual regression: `scripts/golden-frame.mjs`.
- **Loudness**: assemble targets −16 LUFS (`LOUDNESS_LUFS` to override); social masters
  use −14 via `scripts/loudnorm-social.mjs`.

## CLI usage

```
node pipeline.js --episode ep01-alesia \
  [--step segment|voice|generate|normalise|assemble|publish|all] \
  [--scene N] [--quality draft|final] [--force] [--yes]
```

Defaults: `--step all --quality draft`.

- `--scene N` restricts `generate` / `normalise` to one scene id.
- `--force` redoes work even if marked done.
- `--yes` auto-confirms the cost prompt for runs projected over the threshold.

## Routing rules

`segment` sets each scene's `provider` deterministically from its type and
visual prompt:

| Situation                                          | Provider                              |
|----------------------------------------------------|---------------------------------------|
| Wide shots / no faces (cinematic)                  | `seedance-fast` (draft) / `seedance-pro` (final) |
| Realistic face **close-up** (cinematic)            | `kling`                               |
| Same character across **3+ consecutive** shots     | `kling`                               |
| Graphics / charts                                  | `hyperframes` (local render)          |
| Presenter                                          | `heygen`                              |
| Screen recording (`screencap`)                     | `screencap` (window extract, VO replaces source audio) |

Detection is heuristic and deterministic:
- Face close-up = the `> visual:` prompt matches a close-up term **and** a
  face/person term.
- Character continuity = 3+ consecutive cinematic scenes each carrying the same
  `> character:` directive.
- A `> provider: <name>` directive is a hard override (recorded in
  `provider_override`).

## Scene editor (localhost:3200)

`npm run editor` (or `node src/server.js`) launches a HeyGen-style scene-centric
editor. It is a thin layer over the **same** pipeline functions and
`manifest.json` — every edit goes through the atomic `saveManifest`, so the CLI
and the editor are fully interchangeable. Left = script blocks (narration, live
word-count→duration, per-scene audio play + record, status dot); center =
preview + "play from here" animatic; bottom = duration-proportional timeline;
right = contextual inspector with per-scene generate/reroll + cost. Batch header:
record-all-stale / generate-all / assemble, each with a cost confirm.

## Continuity (transitions, grade, music)

Constants live in `src/lib/style-constants.js`.
- **Unified grade:** `normalise` applies a subtle brand grade (~15%) to all
  clips EXCEPT screencaps (their colour must stay accurate).
- **Type-aware transitions** (per boundary, overridable via scene `transition`
  = `cut|crossfade|dip|sting`): same-type → 0.3s crossfade (or cut for shots);
  type-change → **0.4s dip to brand green** `#16271C` (chapter punctuation);
  optional 0.8s gold-sweep **sting** (`src/templates/graphics/sting.html`).
- **J-cut audio:** no hard-silence gaps — each scene's narration LEADS its
  visual cut by `audio_lead_ms` (default 400; per-scene override). Each segment
  gets 30ms micro-fades + is levelled to a common RMS before the final loudnorm.
- **Music bed:** `manifest.music = {file, volume_db:-22}` (null disables); beds
  live in `assets/music/`. Runs continuously, sidechain-ducked under narration,
  1.5s fades at start/end.
- **Avatar background:** brand green via the HeyGen `background` param
  (`HEYGEN_BG_COLOR`); web-render path documented in
  `docs/heygen-web-checklist.md`.

## Audio architecture (per-scene)

- `voice` renders **one audio segment per scene** via the TTS provider, passing
  adjacent scenes' text as `previous_text`/`next_text` (ElevenLabs request
  stitching) so separate renders flow like one take.
- Each scene stores `audio.text_hash` (hash of the narration it was rendered
  from). If the current narration hashes differently → **stale** → re-record
  only that scene. Reordering scenes changes stitching context → marks audio
  stale.
- `assemble` builds the master by concatenating per-scene segments with a
  `manifest.gap_ms` silence gap (default 150ms), then applies loudnorm on the
  final mix. Per-scene audio is also the HeyGen avatar lip-sync input.

## Screencap scenes (user screen recordings)

Put recordings in `episodes/<ep>/sources/` and reference them:

```
## Scene N [screencap: SB.mov @ 00:32-01:10]
Narration text as usual (the master VO replaces the recording's own audio).
```

- The `@ IN-OUT` range (timecodes `MM:SS`, `HH:MM:SS`, or seconds) selects a
  window; omit it for the whole file. `segment` validates the file exists and
  the range is within its duration (ffprobe), writing
  `"source": { "file": "sources/SB.mov", "in_s": 32.0, "out_s": 70.0 }`.
- `generate` extracts the window (no API, $0). `normalise` does the work:
  - **Always strips the recording's audio** (mic/clicks/system sound) — VO wins.
  - **Fits duration to narration** by `ratio = window_dur / narration_dur`:
    `0.75–1.35` → retime with `setpts` (screen content tolerates it invisibly);
    `> 1.35` → trim the tail to narration + warn; `< 0.75` → hold last frame with
    a subtle 2% zoom for the remainder + **loud** warning (split the scene).
  - **Aspect:** scale to fit within 1920×1080 (never stretch), pad with brand
    green `#16271C` (`SCREENCAP_PAD_COLOR`). **Capture at 16:9 where possible** to
    avoid pillar/letter-boxing (this source is 3550×1916 ≈ 1.85:1 → thin green
    bars top/bottom).
  - **Optional punch-in:** per-scene manifest `"zoom": {"x":0.5,"y":0.3,"scale":1.4}`
    crops into a screen region before padding (UI demos often need this to stay
    legible at 1080p). Never upscale/sharpen — screen text survives the downscale
    better untouched.

## Script format

```
## Scene 1 [avatar]
Narration text (the spoken voiceover for this scene).

## Scene 2 [cinematic]
Narration text.
> visual: the generation prompt for this shot
> character: NameOfCharacter      (optional, drives continuity routing)
> provider: kling                 (optional, hard override)

## Scene 3 [graphics]
Narration text. (Visual rendered separately in hyperframes.)
```

## Cost table

| Provider        | Rate            |
|-----------------|-----------------|
| `seedance-fast` | ~$0.05 / 5s     |
| `seedance-pro`  | ~$0.15 / 5s     |
| `kling`         | ~$0.40 / 5s     |
| `heygen`        | credits (est. ~$0.10/s, planning only) |
| `hyperframes`   | out of pipeline |

`generate` prints a per-clip and running cost summary. **Any run projected over
$10 requires confirmation** (`--yes` to auto-confirm). Rates live in
`src/lib/util.js` (`COST_PER_SECOND`) and must stay in sync with this table.

## Rules

- **Never regenerate an approved scene without `--force`** (at the same quality).
- **Everything drafts on `seedance-fast`.** Pro/Kling renders happen only for
  **approved** scenes on `--quality final`.
- On `--quality final`, only scenes with `approved: true` are rendered; a scene
  approved but still at draft quality is re-rendered on the pro model (the
  `clip.quality` field tracks which tier produced the current clip — this is an
  extension beyond the base schema).
- Seedance face rejection → scene marked `rejected_faces` and auto-rerouted to
  Kling; if `KLING_API_KEY` is unset it fails cleanly with instructions (never
  silently).
- Graphics scenes are rendered by the built-in **HyperFrames provider**
  (`src/providers/hyperframes.js`) at the scene's exact narration duration — no
  manual step. Templates live in `src/templates/graphics/`.
- **HyperFrames: local fonts only.** Templates must bundle fonts as local
  base64 `@font-face` — never a webfont `@import` (those can fail silently in
  headless render, leaving text invisible).
- **Compliance overlay:** set manifest `"compliance_overlay": true` (optional
  `"compliance_text"`) and `assemble` composites a persistent Space Mono
  lower-third (bottom-right, translucent) across the whole episode, rendered as
  an alpha MOV via the HyperFrames `compliance-overlay` template.
- **HyperFrames: HTML string-templating, never runtime `--variables`.** The
  provider substitutes duration/title/numbers into a temp copy of the template
  HTML before rendering. Runtime `getVariables()` proved unreliable, and baking
  values into the HTML keeps deterministic code in control of every number.
  Corollary: never set composition text via `textContent` at runtime.

## Typical workflow

1. Draft the `script.md` (separately, with Claude or by hand).
2. `--step segment` → review routing.
3. `--step voice` → TTS + timing.
4. `--step generate` → draft clips on seedance-fast (cheap).
5. Review; set `approved: true` on the keepers in `manifest.json`.
6. `--step generate --quality final` → pro/kling renders of approved scenes only.
7. `--step normalise` → `--step assemble` → `--step publish`.

(Or `--step all` to run the whole chain in draft.)

## Providers & keys

See `.env.example`. Adapters live in `src/providers/` and all implement:

```
async generateClip({ prompt, durationS, quality, audioFile, destPath }) -> { filePath, costUsd }
async healthCheck() -> bool
```

- `seedance.js` — BytePlus ModelArk (Ark v3), async task submit/poll/download.
- `kling.js` — stub; throws `NOT_CONFIGURED` until `KLING_API_KEY` + real
  endpoints are wired in.
- `heygen.js` — HeyGen v2 avatar video from **uploaded audio** (lip-sync to the
  master VO). (HeyGen standalone TTS is gated on some accounts.)
- `tts.js` — pluggable voiceover TTS (`TTS_PROVIDER` = elevenlabs | openai |
  heygen). Used by the `voice` step; outputs mp3 per scene.
- `hyperframes.js` — local graphics renderer (HeyGen HyperFrames, HTML+GSAP,
  headless Chrome). Renders `graphics` scenes from templates in
  `src/templates/graphics/`. Requires Node 22+ for the render subprocess (the
  provider auto-locates an nvm Node 22+; override with `HYPERFRAMES_NODE_BIN`).

Endpoint/payload assumptions are noted in each adapter's header comment — smoke
-test them once against a live account before a large run.

## Requirements

- `ffmpeg` **and** `ffprobe` on PATH (checked at startup). Install: `brew install
  ffmpeg` / `apt-get install ffmpeg`.
- `npm install` (for `@aws-sdk/client-s3`, only needed by `publish`).
- Never commit `.env`. `clips/`, `audio/`, `final/` are gitignored (regenerable).
