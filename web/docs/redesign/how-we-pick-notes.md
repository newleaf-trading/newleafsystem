# /how-we-pick — Scrollytelling Marketing Page

_Built 2026-04-19. Phase 1 of 4 visualisation pages._

## What was built

A public marketing page at `/how-we-pick` that tells the story of how NewLeaf filters 11,342 tickers down to 3 daily recommendations through an 8-stage scrollytelling animation.

### Architecture

```
src/marketing/how-we-pick/
├── HowWePickPage.jsx      — page layout, hero, captions, CTA, stage data
├── DotField.jsx            — Canvas particle system (11k dots, 8 layout functions)
└── ScrollOrchestration.jsx — GSAP ScrollTrigger (pinning, counter animation)
```

### Components

**HowWePickPage** — route `/how-we-pick`, no auth required. Hero, 8 caption sections (each `data-stage` attribute), sticky mini-nav, CTA section.

**DotField** — Canvas 2D renderer. 11,342 dots on desktop, 3,000 on mobile. Per-frame animation loop interpolating dots toward target positions with staggered delays (5-15ms per dot). 8 layout functions:
- `layoutGrid` — initial full grid
- `layoutHistogram` — IV rank distribution (bins)
- `layoutCalendarGrid` — 7-column calendar
- `layoutPriceLine` — diagonal price chart scatter
- `layoutStrikeLadder` — vertical strike levels
- `layoutFunnel` — wide-top narrow-bottom funnel
- `layoutCards` — three card positions at bottom

**ScrollOrchestration** — GSAP ScrollTrigger. Each caption section triggers a stage transition when it crosses the viewport center. Counter animates between values using `expo.out` easing (0.8s duration).

### Dependencies added

| Package | Version | Purpose |
|---|---|---|
| `gsap` | ^3.15.0 | Scroll-driven timelines, counter easing |
| `d3-scale` | ^4.0.2 | Layout computation (scaleLinear) |
| `d3-selection` | ^3.0.0 | Available for future use |
| `d3-transition` | ^3.0.1 | Available for future use |

GSAP and D3 are isolated to the `src/marketing/` directory. They are not used anywhere in the trading app.

### Routing

- Route: `/how-we-pick` in `App.jsx` (standalone, no PublicLayout wrapper)
- Firebase rewrite added to `firebase.json`
- Lazy-loaded via `React.lazy()`

## Accessibility

- **`prefers-reduced-motion`**: detected via `matchMedia`. When active, the page renders all 8 stages as a static vertical sequence with no animation — each stage shows its final count and caption.
- **Screen readers**: all captions are DOM text, not canvas-rendered. The counter's current value is in DOM text. Canvas has `aria-hidden="true"`.
- **Keyboard nav**: not yet implemented (deferred to polish pass).

## Mobile

- Dot count reduced to 3,000 (from 11,342) for Canvas performance. The counter still shows the real numbers.
- Responsive sizing: dot field scales to `min(window.width - 40, 900)` wide.
- Labels use 7px font on mobile (vs 9px desktop).

## Known issues

1. **GSAP ScrollTrigger pinning** is not yet implemented — the current version uses `position: sticky` CSS for the dot field and `ScrollTrigger.create()` for stage detection based on caption scroll position. Full GSAP pinning with `pin: true` would give smoother control but adds complexity. The current approach works for the MVP.

2. **Dot stagger delay** uses a random per-dot delay (0-15 frames). This creates a sweep-like motion but is not precisely sequenced left-to-right or top-to-bottom. A proper stagger sequence (e.g., radial from center, or left-to-right wave) would improve readability.

3. **Stage layouts** are approximations. The histogram (stage 2) uses random IV rank assignment rather than a realistic distribution. The calendar grid (stage 3) doesn't show actual calendar days. The scoring funnel (stage 6) is geometric, not data-driven. These are visually correct (they communicate the concept) but not precise.

4. **Final stage (three tiles)** currently shows three large dots, not actual Discover-style tile cards. Rendering React components on Canvas is not possible — the tiles would need to be DOM-overlaid. Deferred.

5. **Counter animation** can desync with dot transitions if the user scrolls very fast. The counter uses GSAP timing (0.8s) while dots use per-frame lerp (variable). In practice this is rarely noticeable.

## What's deferred

### Phase 2-4 (other visualisation pages)

| Page | Route | Status |
|---|---|---|
| How We Recommend | `/how-we-recommend` | Not started |
| How We Manage | `/how-we-manage` | Not started |
| Track Record | `/track-record` | Not started |

### Polish items for this page

- Arrow key stage advancement
- Proper GSAP pinning with `pin: true`
- Left-to-right or radial stagger sequencing
- DOM-overlaid tile cards for final stage
- Performance profiling on actual iPhone 12
- Mobile Safari URL bar resize handling
