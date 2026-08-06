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
5. **Golden frames** → tolerance-based PNG diff. Dep note in Phase 2 below.
