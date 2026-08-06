# YouTube + Instagram publishing pipeline — spec

Status: **DRAFT for review (rev 2)** · Owner: Manish · Last updated: 2026-08-05

Goal: publish NewLeaf videos to **YouTube (16:9 long-form + Shorts)** and
**Instagram (Feed 4:5 + Reels 9:16)** with **on-brand thumbnails, intros,
outros, and burned-in captions** that match newleaf.com exactly — from one
command, with no manual color/font fiddling and no brand drift.

> **rev 2** incorporates review feedback: Playfair legibility floor, gold-as-
> surface-only contrast rule, native reframe (not crop), numeric safe areas,
> YouTube quota + audit-gate constraints, IG public-URL race, and three new
> must-haves — burned-in captions, loudness normalization, and golden-frame
> visual regression. Captions moved into Phase 2 (an IG deliverable isn't
> shippable without them).

---

## 0. The problem this fixes

Three different "NewLeaf" palettes exist today, and **none match the website**.
Note: the **Fraunces / DM Sans / `#0F2E1E` green** set that's felt like "the
brand" is itself a *drifted* source, not the site.

| Source | Forest green | Gold | Headline | Body |
|---|---|---|---|---|
| **Website** (`web/src/shared/styles/tokens.css`) — source of truth | `#0B2D23` | `#C9A96E` | Playfair Display | Inter |
| `videos/remotion/src/NewLeafBrand.jsx` (`C`) | `#0F2E1E` | `#C9A54E` | Fraunces | DM Sans |
| `videos/remotion/series/BRAND_BIBLE.md` | `#16271C` | `#B68F3E` | Fraunces / Anton | Archivo Black |
| `videos/src/lib/style-constants.js` (screencap pad / dip) | `#16271C` | — | — | — |

**Phase 1 makes the website the single source of truth and everything else
derive from it.**

---

## 1. Brand token single source of truth

**Decision:** `web/src/shared/styles/tokens.css` stays canonical. We add a
**generator** that parses its `:root{}` block and emits a JS module the video kit
imports. No hand-maintained second copy → cannot drift.

### 1.1 New file: `videos/scripts/sync-brand-tokens.mjs`
- Reads `web/src/shared/styles/tokens.css`, extracts every `--nl-*` property, and
  writes `videos/remotion/src/brand-tokens.js`:
  ```js
  // AUTO-GENERATED from web/src/shared/styles/tokens.css — do not edit by hand.
  export const NL = {
    green: '#0B2D23', gold: '#C9A96E', bg: '#F7F5F0',
    text: '#111827', textMuted: '#6b7280', card: '#FFFFFF',
    profit: '#0B7A52', loss: '#C94F4F', warn: '#B7791F', action: '#ea580c',
    radius: 14, radiusLg: 18, radiusPill: 999,
    fontDisplay: 'Playfair Display', fontBody: 'Inter', fontMono: 'Space Mono',
  };

  // Deliberate VIDEO variants — declared here, not left to per-comp judgement.
  // Rationale in §1.3. These are brand rules, not drift.
  export const NL_VIDEO = {
    fontDisplayVideoWeight: 900,  // Playfair thins out; only 900 survives compression
    minDisplaySize: 40,           // px — below this Playfair is banned; Inter takes over
    thumbHeadlineMin: 64,         // px at 1280×720 — floor for YT thumbnail headline
    goldIsSurfaceOnly: true,      // gold = fill/pill, NEVER text on a light bg (§1.3)
  };
  ```
- `--check` flag exits non-zero if `brand-tokens.js` is stale vs the CSS. Wire as
  a **release blocker** the same way the TIQ `sync.js` drift guard works.

### 1.2 Rewire `NewLeafBrand.jsx`
- `C` derives from `NL`; extra video-only shades become **documented derivations**:
  | Video token | New value | Derivation |
  |---|---|---|
  | `forest` | `#0B2D23` | = `NL.green` (was `#0F2E1E`) |
  | `gold` | `#C9A96E` | = `NL.gold` (was `#C9A54E`) |
  | `cream` | `#F7F5F0` | = `NL.bg` (was `#F5F3EC`) |
  | `ink` | `#07110C` | darkest intro bg — keep; documented as `green` darkened |
  | `green` (positive) | `#0B7A52` | = `NL.profit` (was `#6BBE93`) |
  | `red` (negative) | `#C94F4F` | = `NL.loss` (was `#C96F5E`) |
- Fonts switch Fraunces/DM Sans → **Playfair Display / Inter** via
  `@remotion/google-fonts/PlayfairDisplay` + `/Inter`. `Space Mono` already matches.
- `videos/src/lib/style-constants.js` pad/dip `#16271C` → `#0B2D23`.
- `series/BRAND_BIBLE.md`: colors superseded by `brand-tokens.js`; bible keeps
  only the **semantic law** (teal=good, terracotta=risk, blue=neutral, gold=brand)
  and symbol system — plus the two legibility laws below.

### 1.3 Typography & contrast laws (NEW — the rules that prevent illegible output)
These are not per-comp judgement calls. They live in `brand-tokens.js` constants
and in the bible:

1. **Playfair is a high-contrast Didone — its hairlines vanish when small.** It
   looks great at 44–64px on a desktop viewport; at ~200px sidebar-thumbnail
   width the horizontals turn to grey mush. Therefore:
   - Playfair is **never used below `minDisplaySize` (40px)** in any video surface.
     Below that, Inter (700/800) takes over.
   - Thumbnail headlines are pinned to **Playfair 900, ≥ `thumbHeadlineMin`
     (64px at 1280×720)**.
2. **Gold `#C9A96E` on cream `#F7F5F0` is ~2:1 contrast — it fails as text.** It is
   a **surface** (pill fill with forest text, as the site does), *never a text
   color on a light background*. Text on cream is **forest `#0B2D23` (~13.7:1)**.
   Encoded as `goldIsSurfaceOnly` and enforced in the golden-frame check (§9).

---

## 2. Render preset matrix — native reframe, not crop

One composition, four **natively rendered** deliverables. **We do not crop a
16:9 master** (an 810×1080 crop upscaled to 1080×1350 is soft, and IG's re-encode
punishes it further). Each preset renders natively; `useVideoConfig()` drives
layout. Costs render time, not quality. Presets centralized in
`videos/remotion/src/presets.js`:

| Preset | Dimensions | Ratio | Used for | Base comp today |
|---|---|---|---|---|
| `landscape` | 1920×1080 | 16:9 | YouTube long-form | `FeatureVideo` ✅ |
| `feed` | 1080×1350 | 4:5 | Instagram Feed post | native reframe |
| `vertical` | 1080×1920 | 9:16 | Reels + YouTube Shorts | `OutroVertical`, `TiqOverlayVertical` ✅ |
| `square` (optional) | 1080×1080 | 1:1 | IG grid fallback | native reframe |

### 2.1 Numeric safe areas (NEW — pinned in `presets.js`, not "clear the UI")
Every comp lays content inside `<SafeArea ratio>` using these reserves so nothing
guesses:

| Surface | Reserve |
|---|---|
| **Reels 9:16** | bottom **~340px** (caption + audio), right **~200px** (action rail), top **~120px** |
| **Feed 4:5** | bottom **~100px**, minimal top |
| **YT 16:9** | end screens occupy the last 20s — keep the outro CTA **out of the lower-right and the right third** |

- Logo bug repositions per ratio (bottom-left landscape; top-left vertical to
  clear IG chrome).
- Verticals get an `IntroVertical` (3–4s, centered lockup, **no** right-bleed
  medallion — it crops badly at 9:16).

---

## 3. Thumbnail system

Prop-driven Remotion stills off the same tokens.

### 3.1 `videos/remotion/src/Thumbnail.jsx`
- Props: `{ title, kicker, ticker, agentArt, ratio, verdict, variant }`.
- Registered comps: `ThumbnailYT` (1280×720), `ThumbnailIG` (1080×1350).
- Layout: cream `#F7F5F0` bg; headline **Playfair 900, ≥64px, forest `#0B2D23`**
  (never gold — §1.3); **gold kicker as a pill with forest text**, not gold words
  on cream; optional ticker chip + agent medallion; logo bug. Verdict badge uses
  profit/loss semantic colors.
- 3 auto-size headline tiers (clamp logic mirrors the site).
- **`variant` prop renders 3 thumbnails per ratio** (e.g. headline-led /
  ticker-led / verdict-led). It's free render time and thumbnail choice moves CTR
  more than anything else here — pick the winner by eye.

### 3.2 `videos/scripts/render-thumb.mjs`
- `node scripts/render-thumb.mjs --episode <ep> --ratio yt|ig [--variant N]` →
  `npx remotion still` → `episodes/<ep>/thumbnails/<ratio>-v<N>.png`, path
  recorded in `manifest.thumbnails.{yt,ig}`.

---

## 4. Intro / outro standardization

- **Intro:** re-render against corrected tokens; add `IntroVertical` (9:16) and a
  4:5 variant. Keep the 4s landscape intro.
- **Outro:** 6s CTA reusing the **site's gold pill button** (`radiusPill`, gold
  fill, forest text) + real domain. Landscape outro keeps its CTA out of the YT
  end-screen zone (§2.1). `OutroVertical` rebranded to matched tokens.
- Lower-thirds / logo bug: repoint colors/fonts only.

---

## 5. Captions (NEW — Phase 2, not optional for Instagram)

Reels are watched **muted by default**; burned-in captions are the single largest
completion-rate factor. Without them the IG deliverable underperforms for a reason
that has nothing to do with branding — so this ships *with* the formats, not after.

- **`videos/remotion/src/Captions.jsx`** — driven by a per-episode
  `episodes/<ep>/captions.json` (word-level timings sourced from the
  HeyGen/script/`voice` step, which already has per-scene text + durations).
- Styled from tokens (Inter, forest text on a translucent cream/forest chip),
  positioned **above the Reels bottom safe area** (§2.1). High-legibility, not
  Playfair.
- **Same source emits a YouTube `.srt`** (sidecar upload) so long-form gets soft
  captions while verticals get burned-in ones.

---

## 6. Audio: loudness normalization (NEW)

Both platforms normalize to roughly **−14 LUFS**. Masters that land at −9 get
pulled down and quiet passages sit oddly. Add **one `ffmpeg loudnorm` pass to
−14 LUFS in the render/assemble step, logged** (the pipeline already does a final
loudnorm in `assemble` — retarget it to −14 for social masters and log the
measured in/out).

---

## 7. Publishing adapters

Extend the manifest-driven `publish` step; R2 stays the archival store and, for
IG, the fetch origin. New manifest block:

```jsonc
"distribution": {
  "youtube":   { "privacy": "unlisted", "title": "...", "description": "...", "tags": [...], "thumbnail": "thumbnails/yt-v2.png", "short": false, "srt": "captions.srt" },
  "instagram": { "kind": "reel", "caption": "...", "cover": "thumbnails/ig-v1.png", "publish": false }
}
```

### 7.1 `videos/src/providers/youtube.js`
- Data API v3 resumable upload (OAuth2 refresh token in `.env`). Sets
  title/description/tags/privacy; uploads thumbnail via `thumbnails.set` + `.srt`
  via `captions.insert`. `short:true` (vertical ≤60s) appends `#Shorts`.
  Idempotent via `manifest.distribution.youtube.video_id`.
- **Quota (cost in first):** an upload is **1600 units against the default
  10,000/day** → **~6 videos/day**. Log remaining budget; warn, never silently drop.
- **⚠️ Verify BEFORE building this:** historically, **unaudited API projects have
  uploads forced to `private`** regardless of the `privacyStatus` sent, until the
  project passes YouTube's compliance audit. If still current, it **materially
  changes Phase 4's value** — check first, not after writing the adapter.

### 7.2 `videos/src/providers/instagram.js`
- Graph API (IG **Business/Creator** account + linked Facebook Page +
  long-lived token). Flow: create media container **from a public R2 URL** →
  poll (can run **minutes**) → publish. Supports `reel` (9:16) + `feed` (4:5).
- **Public-URL race (decide + document):** the Graph API fetches the video from
  R2 itself and polling is slow, so a short-expiry presigned URL will **race and
  fail**. Either serve from a **public prefix** (`public/social/…`, accepting the
  master is world-fetchable) **or presign with ≥1h TTL**. This is a small
  security-posture decision — make it deliberately.
- **Do NOT auto-publish initially.** The adapter **creates the container and
  stops** (`publish:false`) so a human eyeballs the cover + caption before the
  publish call. Reels are unforgiving of a bad first frame and **the cover can't
  be swapped after posting**. Flip `publish:true` per episode when trusted.
- IG can't post to personal accounts and can't easily carousel video — Reels +
  single Feed video only.

### 7.3 `publish` step wiring
- Order: R2 upload (existing) → `youtube` (if configured) → `instagram`
  (container-only). Each writes ids/URLs back, skipped when done unless `--force`.

---

## 8. File-by-file work breakdown

| # | File | Action |
|---|---|---|
| 1 | `videos/scripts/sync-brand-tokens.mjs` | **new** — CSS→JS generator + `--check` drift guard |
| 2 | `videos/remotion/src/brand-tokens.js` | **new (generated)** — incl. `NL_VIDEO` legibility constants |
| 3 | `videos/remotion/src/NewLeafBrand.jsx` | edit — `C`/`F` derive from `NL`; Playfair/Inter |
| 4 | `videos/src/lib/style-constants.js` | edit — pad/dip `#16271C` → `#0B2D23` |
| 5 | `videos/remotion/series/BRAND_BIBLE.md` | edit — supersede colors; add the two legibility laws |
| 6 | `videos/remotion/src/presets.js` | **new** — 4 native presets + `SafeArea` w/ numeric reserves |
| 7 | `videos/remotion/src/Thumbnail.jsx` | **new** — `ThumbnailYT`/`ThumbnailIG` + `variant` (×3) |
| 8 | `videos/remotion/src/Captions.jsx` | **new** — burned-in captions from `captions.json` |
| 9 | `videos/remotion/src/Root.jsx` | edit — register thumbnails, vertical intro, captions |
| 10 | `videos/scripts/render-thumb.mjs` | **new** — still render CLI → manifest (variants) |
| 11 | `videos/scripts/golden-frame.mjs` | **new** — render 1 ref frame/comp, diff vs golden PNG |
| 12 | `videos/src/providers/youtube.js` | **new** — Data API v3 (quota-aware; audit-gate checked) |
| 13 | `videos/src/providers/instagram.js` | **new** — Graph API container-only reel/feed |
| 14 | `videos/src/publish.js` | edit — social adapters + loudnorm retarget; idempotent |
| 15 | `videos/CLAUDE.md` | edit — `distribution` block, captions, thumbnail step |
| 16 | `videos/.env.example` | edit — YT + IG credentials |

---

## 9. Visual regression — golden frames (NEW)

`--check` catches a stale `brand-tokens.js`, but **not a font that failed to load
and silently fell back to a system serif** — that passes every token check and
ships wrong. So: **`golden-frame.mjs` renders one reference frame per composition
to a golden PNG and diffs on each build.** Cheap, and the same determinism
discipline as the TIQ drift guard. It also asserts the two §1.3 legibility laws
(no Playfair below the floor; no gold text on cream).

---

## 10. Sequencing

- **Phase 1 — Brand truth** (#1–5). Unblocks everything; visually corrects every
  existing video. ~½ day. Ship + eyeball a re-rendered intro against the site.
- **Phase 2 — Presets + thumbnails + captions + golden frames** (#6–11). One-command
  on-brand thumbnails, native reframes with real safe areas, **and burned-in
  captions** — because without captions the IG format isn't actually shippable.
  Loudnorm retarget lands here too. ~1.5 days.
- **Phase 3 — Intro/outro per ratio** (part of #3/#6/#9). Vertical + 4:5 variants.
- **Phase 4 — Publish adapters** (#12–16). YouTube first (simpler auth) — but
  **verify the audit gate before writing it**. Instagram container-only, manual
  publish. **Start the IG Business/Creator + Facebook Page linkage TODAY, in
  parallel** — it's admin work with an approval lag and zero code, and it's the
  thing that will otherwise block Phase 4 in three weeks.

---

## 11. Decisions locked / still open

**Locked from review:**
- Native reframe, never crop (§2).
- Playfair ≥40px floor / thumbnails 900 ≥64px; gold is surface-only (§1.3).
- Captions are a Phase-2 deliverable, not a follow-up (§5).
- Loudnorm to −14 LUFS (§6).
- Golden-frame regression alongside `--check` (§9).
- IG: container-only, manual publish first (§7.2).
- Thumbnails: **manual `manifest.thumbnails` field with a script-derived default
  pre-populated** — the headline's job is to hook, and that's the one string where
  determinism isn't the goal (§3).
- Publish mode: **unlisted-first** (and possibly forced by the YT audit gate).

**Still open — Manish:**
1. **YT audit gate** — is the target API project already audited (uploads honor
   `privacyStatus`)? Determines whether Phase 4 YT is auto-publish-capable or
   thumbnail-only.
2. **IG account** — confirm Business/Creator + Facebook Page linkage is started.
3. **R2 exposure for IG** — public `public/social/` prefix, or presign ≥1h? (Small
   security-posture call.)
4. **YT channel / OAuth** — do we have client credentials, or thumbnails-only for
   YT until we do?
