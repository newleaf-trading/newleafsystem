# 🍃 "Become the Insurance Company" — Series Brand Bible
*The single source of truth for every episode. If Episode 10 doesn't feel like Episode 1, this document failed.*

> **🔒 DESIGN LANGUAGE FROZEN — v1.0 (locked after Ep1 Act 1 review).**
> Fonts, palette, the Gold Shield, chart styles, and layout are **locked**. From Ep 2
> on, viewers should recognize the symbols without relearning them. Change the *content*,
> never the *grammar*. Any change to a core symbol is a versioned, deliberate decision.

> **📖 Companion doc — `DOCUMENTARY_STYLE_GUIDE.md` (v1.0).** This Bible owns the **visual
> grammar** (palette, fonts, symbols, chart/layout). The Style Guide owns the **storytelling,
> educational, and production philosophy** (open with a question · commit before the reveal ·
> pay it off in the finale · black cold opens only as a deliberate device · silence as a tool ·
> a new beat every 5–8s). Read both before writing or building any episode.

> **🎨 BRAND SOURCE OF TRUTH & THE SOCIAL PIPELINE.** The product/social video pipeline
> (thumbnails, intros, outros, captions — see `videos/docs/YOUTUBE-INSTAGRAM-PIPELINE.md`)
> derives every colour and font from the **website** via `videos/remotion/src/brand-tokens.js`
> (generated from `web/src/shared/styles/tokens.css`; regenerate with
> `node videos/scripts/sync-brand-tokens.mjs`). This series palette below is a **deliberate,
> known divergence** — a warmer, film-grade sub-brand: series `forest #16271C` / `gold #B68F3E` /
> `cream #F2ECDD` vs the site's `#0B2D23` / `#C9A96E` / `#F7F5F0`. That's fine *inside* an episode,
> but **on any surface shared with the social pipeline (a thumbnail, the standard intro/outro,
> burned-in captions), the site tokens win.** Don't silently drift the two together; converging
> them is a versioned decision, not a default.
>
> **Two legibility laws (universal — apply to this series too):**
> 1. **Playfair/serif display is a high-contrast Didone** — its hairlines vanish when small.
>    Never set the display face below **40px** in any video surface; below that, the body sans
>    takes over. Thumbnail headlines: **900 weight, ≥64px**.
> 2. **Gold is a *surface*, never text on a light background** (gold-on-cream ≈ 2:1 contrast,
>    illegible). Use gold as a pill/shield fill with forest text; text on cream is forest (~13.7:1).

---

## 1. Mission
Teach ordinary people that **successful options trading isn't about predicting the future — it's about understanding, pricing, and managing risk.** We are building a *cinematic universe around risk*, not a trading-tips channel.

**North-star reaction:** "Now I finally understand *why* this exists."

## 2. Audience
- Complete beginners. Has never bought an option. Possibly owns an index fund (our "Sarah").
- Smart but not financial. Watches Vox, Veritasium, Kurzgesagt, Johnny Harris.
- Emotionally motivated by *protecting what they've built*, not by "getting rich."
- **Rule:** never use a jargon word before its plain-English idea has been felt.

## 3. Tone of voice
- Documentary narrator: calm, warm, curious. Never a hype-y "trader bro."
- Short sentences. One idea per breath. Rhetorical questions to hand the viewer the thought.
- Honest > sensational: we say **"stay profitable,"** never "get rich"; **"pricing & surviving risk,"** never "easy money" or "always wins."
- Every episode reinforces the thesis: *who carries the risk?*

## 4. The recurring symbol system ⭐ (the heart of the brand)
By Episode 8 the viewer should read these instantly, no caption needed. **Never repurpose a symbol for a different meaning.**

| Symbol | Meaning | Component |
|---|---|---|
| 🛡️ **Gold Shield** | protection / an option position | `<GoldShield/>` |
| 🔴 **Risk Blob** | risk being transferred | `<RiskBlob/>` |
| 🪙 **Premium Coin** | payment for protection | `<PremiumCoin/>` |
| 🧩 **Four Questions** | the decision framework (protect what / how long / what price / what cost) | `<FourQuestions/>` |
| 🏛️ **Insurance Company** | disciplined, priced, reserved risk management (the ideal) | skyscraper motif |
| 🛋️ **Couch Trader** | the product copied without the business (the cautionary tale) | `trader` cutout |
| 🍃 **NewLeaf** | mastery of risk; the Shield's final form | logo morph |

**Signature line (say it, or echo it, in every episode):** *"They copy the product without copying the business."*
**Series closer motif:** *"Investors predict. Insurance companies prepare. Which will you become?"*

## 5. Color palette (`NL.color`, in `src/newleaf-remotion-kit.jsx`)
| Token | Hex | Use |
|---|---|---|
| `forest` | `#16271C` | primary ink / text / dark UI |
| `forest2/3` | `#1E3326` / `#27412F` | depth, gridlines, card interiors |
| `gold` | `#B68F3E` | **the Shield, highlights, the hero accent** |
| `goldLight` | `#E7D9AE` | soft gold, secondary |
| `cream` | `#F2ECDD` | **paper background** |
| `card` | `#FBF8F0` | cards, chart surfaces |
| `terracotta` | `#BC5B43` | **risk / danger / loss / the Risk Blob** |
| `teal` | `#3E7C6A` | **protection / positive / gains** |
| `blue` | `#3E6E8C` | **neutral / balanced / delta-zero** |

**Semantic law:** teal = good/positive · terracotta = risk/negative · blue = neutral · gold = the brand/shield/protection-as-product. Do not drift these.

## 6. Typography (`NL.font`)
- **Fraunces** (`display`) — headlines, emotional lines, the serif "documentary" voice.
- **Anton** (`condensed`) — big punchy Vox-style uppercase impact headers (used sparingly).
- **Archivo Black** (`black`) — numbers, stats, titles, labels, symbol captions.
- **DM Sans** (`body`) — supporting copy, sub-lines.
- **Space Mono** (`mono`) — tickers, tiny data, compliance.
- Highlighter swipe (gold) reserved for the single most important phrase on screen.

## 7. Illustration style
- **Flat paper-collage.** Cream paper + faint grid + film grain + soft vignette (`PaperBackground`).
- **People = halftone photographic cutouts** with a colored offset "marker" stroke (`HalftoneCutout`). B&W, high-contrast, editorial. Generated on plain gray, background-removed. Offset stroke color carries meaning (gold = protected, terracotta = at-risk).
- **Objects/icons = simple flat vector** (shield, coin, car, house, wheat, plane, oil, knife).
- **No photorealistic backgrounds.** The world is paper.

## 8. Character cast (halftone cutouts in `public/cutouts/`)
| Role | Asset | Notes |
|---|---|---|
| **Sarah** (hero, 50s, index-fund investor) | `sarah.png` | warm, relatable; the emotional throughline |
| Retiree (68) | `retiree.png` | "needs it" buyer |
| Insurance actuary (35) | `actuary.png` | disciplined risk management |
| Young professional / analyst | `analyst.png` (reuse) | "paid in stock" buyer / the pro |
| Couch trader | `trader.png` (reuse) | copies the product, not the business |
| Charging bull | `bull.png` (reuse) | the market |
| Tesla | `tesla.png` (reuse) | the example asset |
| Narrator silhouette | SVG (built) | neutral guide |

**Character rule:** everyone lives on the same plain-gray → halftone treatment, so the cast always feels like one world.

## 9. Animation language
- **Motion is deterministic** (`useCurrentFrame`) — no wall-clock animation. Everything re-renders identically.
- **Entrances "pop"** (spring, slight overshoot) — elements punch in, they don't fade.
- **The Risk transfer is sacred:** the Risk Blob physically *travels* from one party to another. Hold the beat.
- **The Shield** forms from gold particles → *clicks* into place → can pulse, block a falling line (clang), fuse with others, and finally **morph into the NewLeaf leaf.**
- **Charts draw on** left→right (never appear instantly); callouts pop at the peak.
- **Numbers count up** (never cut to a final value).
- **Silence is a tool** — cut music under the biggest reveals.

## 10. Camera rules
- Default: locked, stable "explainer anchor" shots.
- **Push in (3–8%)** only to signal *this is the important moment.*
- **Pull back** to reveal *scale* (one → millions).
- **The one 180° POV turn** is reserved for the series' emotional pivot: buyer → *becoming* the insurance company. Use it rarely; it means something.

## 11. Music & sound
- One evolving ambient bed (warm piano + soft pulse) that **adds a layer per act**, so the argument feels like it compounds.
- **Drop the bed to silence** on the two biggest reveals per episode.
- SFX vocabulary: coin *clink* (premium), airy *whoosh* (risk transfer), shield *clang* (protection holds), seatbelt *click* (safety), padlock *click* (locking a price), ink *stamp* (naming/contract), dry *ukulele* (the couch-trader comic beat).
- No music under the couch-trader joke — let it feel small and quiet.

## 12. Transitions
- Objects *become* the next scene (contract → paper plane → market; shield → time-warp → 1973).
- Hard cuts on punchlines and montage beats.
- Fade to black only on the final logo.

## 13. Episode format
1. Cold open = a **human** (Sarah-class character), not a concept.
2. A "why does this exist?" **History Minute** where relevant.
3. Concepts build so **every minute answers one question and opens the next.**
4. Introduce the **jargon word only after the idea is felt.**
5. Close on the **philosophy** + the recurring symbols + the NewLeaf morph + a next-episode *idea* (not just a jargon tease).

## 14. Production pipeline (per episode)
Script (locked) → generate "Alice" VO per scene (ElevenLabs, British female) → measure clip lengths → build scenes in the auto-timed `SCENES` list reusing this kit → verify scenes via stills → single clean background render. **Never run two renders to the same file at once.**

---
*Living document. Update this before you update the episodes.*
