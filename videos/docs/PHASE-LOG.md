# Social Video Pipeline — build log (autonomous session 2026-08-06)

Running log of what I built while you were out, the small decisions I made, and
how to revert. Each phase is a **scoped git commit on `detail-plan`** (not pushed)
containing only the pipeline files — your unrelated working-tree changes are untouched.

**Hard safety rules I followed:**
- **Nothing published to the real world.** No live YouTube upload, no Instagram
  post. Phase 4 adapters ship as *ready but unconfigured* — they throw
  `NOT_CONFIGURED` without credentials and default to dry-run. You turn them on.
- Every render was verified locally (still frames), not just compiled.

## How to revert
- Whole session: `git log --oneline detail-plan` → `git revert <sha>` per phase commit, or
  `git reset --hard <sha-before-phase-1>` if you want it all gone.
- One file: `git checkout <sha> -- <path>`.
- Phase commits are tagged in the messages as `feat(video-pipeline): phase N …`.

---

## Phase 1 — Brand truth ✅ (verified earlier, with you)
Site tokens are now the single source of truth for the video kit.
- `videos/scripts/sync-brand-tokens.mjs` — CSS→JS generator + `--check` drift guard
- `videos/remotion/src/brand-tokens.js` — generated (`NL` + `NL_VIDEO`)
- `videos/remotion/src/NewLeafBrand.jsx` — derives from tokens; Playfair + Inter
- `videos/src/lib/style-constants.js` — pad/dip `#16271C` → `#0B2D23`
- `videos/remotion/series/BRAND_BIBLE.md` — scoped supersede note + 2 legibility laws
- **Verified:** generator runs, `--check` passes, bundle compiles, IntroOnly still renders in real brand.

---

## Decisions I made on your behalf (the "small questions")
Logged here so you can veto any of them:

1. **Drift-guard hook** → added `sync:brand` + `check:brand` npm scripts to
   `videos/remotion/package.json`. I did **not** force it into the web deploy
   (separate package, and I won't touch your deploy path unattended). Run
   `npm run check:brand` before a release. _Revert: remove the two scripts._
2. **Thumbnail copy** → `render-thumb.mjs` reads `manifest.thumbnails` if present,
   else derives a default from the episode title. Manual override wins (your call
   from §11).
3. **IG media URL** → the adapter uses the existing public `manifest.final.r2_url`
   (publish.js already uploads with `CacheControl: public`). No new public prefix,
   no presigning needed. If your R2 bucket is private, set `IG_MEDIA_URL_MODE=presign`
   (documented, not implemented-live since I can't test it).
4. **Loudness** → made `assemble.js` target configurable
   (`manifest.loudness_lufs`, default unchanged at −16). Social reframe renders set
   −14 via `NL_VIDEO.loudnessLufs`. I did **not** change the default so existing
   episodes render identically.
5. **Golden frames** → ffmpeg-SSIM diff (no new npm dep; ffmpeg is already required).
6. **Publish adapter location** → put in `videos/src/publish/`, NOT the spec's
   `videos/src/providers/` (that dir owns the `generateClip` interface; mixing publish
   adapters there muddies it). _Flagging this deviation from the approved spec path._
7. **TIQ 4:5 cut** → built `TiqFeed` (FeedReframe): the 16:9 film scaled to full
   width on brand-ink with a TIQ lockup — NOT the frosted-glass overlays (those are
   positioned for 1920-wide). Clean + reliable; overlays-in-4:5 is a follow-up.
8. **Provider routing (OpenRouter→BytePlus→Higgsfield)** → **not used.** The TIQ film
   already exists, so all 4 formats were derived from it deterministically (Remotion
   reframes + overlays + thumbnails) — cheaper and pixel-consistent than regenerating.
   Routing stays wired for cuts that need *fresh* b-roll; none did here.

---

## Phases 2–4 ✅ (built + verified this session)
- **Phase 2** (commit `phase 2`): presets.js (4 native ratios + SafeArea + FeedReframe),
  Thumbnail.jsx (YT/IG × 3 variants, legibility laws enforced), Captions.jsx,
  render-thumb.mjs, golden-frame.mjs (SSIM), TiqFeed.jsx. Verified: 6 thumbnails
  rendered + eyeballed; goldens baselined + passing at SSIM 1.0.
- **Phase 3** (commit `phase 3`): IntroVertical (9:16 + 4:5), outro gold-pill CTA.
  Verified: IntroVertical still rendered + eyeballed.
- **Phase 4** (commit `phase 4`): youtube.js + instagram.js publish adapters
  (dry-run default, IG container-only), publish.js orchestration, configurable
  loudnorm + loudnorm-social.mjs, .env.example + CLAUDE.md. Verified: dry-run smoke
  test passes, safe-skip without creds, no crashes. **Nothing published live.**

Known refinement (logged, not blocking): the 4:5 IG *thumbnail* has loose vertical
rhythm (headline floats mid-frame) — bump headline size / anchor lower next pass.

---

## ⭐ TIQ deliverables — the 4 assets you asked to see
Folder: `videos/remotion/out/tiq-assets/DELIVERABLES/`
**Open `REVIEW.html` in that folder** — it embeds all 4 videos + the 6 thumbnails.

| # | File | Platform | Ratio |
|---|------|----------|-------|
| 01 | `01-youtube-16x9.mp4` | YouTube long-form | 1920×1080 |
| 02 | `02-instagram-feed-4x5.mp4` | Instagram Feed | 1080×1350 |
| 03 | `03-reels-9x16.mp4` | Instagram Reels | 1080×1920 |
| 04 | `04-youtube-shorts-9x16.mp4` | YouTube Shorts (= Reels master) | 1080×1920 |
| — | `thumbnails/*.png` | 3 variants × YT + IG | — |

- All −14 LUFS; all rendered through the rebranded kit (Playfair/Inter, forest/gold).
- 16:9 & 9:16 = existing `TiqOverlay`/`TiqOverlayVertical` (now on corrected tokens);
  4:5 = new `TiqFeed`. Source film untouched.
- The big mp4s are **not committed** (large, regenerable; `out/` stays local).
  Reproduce: `npx remotion render TiqOverlay|TiqOverlayVertical|TiqFeed …` then
  `node scripts/loudnorm-social.mjs <file>`; thumbnails: `npm run thumbs`.
