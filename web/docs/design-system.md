# NewLeaf Design System — Current State

_Auto-extracted from code on 2026-04-18. Source of truth is the code, not this document._

**Frontend subtree:** `src/` (primarily `src/trading/`, `src/picks/`, `src/shared/`)

**Styling approach:** Tailwind CSS v4 + custom CSS files + JS design tokens. Three layers:
1. `src/trading/styles/tokens.js` — JS design token objects + CSS variable generator
2. `src/trading/styles/newleaf-system.css` — CSS custom properties + component classes (NL design system)
3. `src/trading/styles/app.css` — legacy/extended CSS with its own `:root` tokens
4. `src/trading/styles/landing-v7.css` — landing page design with separate token set
5. `src/trading/styles/nl-nav.css` — nav-specific styles
6. `src/trading/styles/redesign.css` — redesigned page components
7. `src/trading/styles/global.css` — Tailwind imports + animation keyframes
8. `tailwind.config.js` — Tailwind theme extensions (font families, leaf colour scale)

**Entry point CSS chain:** `global.css` → imports `newleaf-system.css`; `app.css` is loaded separately.

---

## Colour

### Brand Colours

| Name | Value | Defined In | Usage |
|------|-------|-----------|-------|
| Primary Green (Forest) | `#0B2D23` | `tokens.js:9`, `newleaf-system.css:11`, `app.css:8` | Nav background, primary buttons, hero backgrounds, card accents |
| Soft Gold | `#C9A96E` | `tokens.js:10`, `newleaf-system.css:12`, `app.css:9` | Nav wordmark accent, CTA buttons, insight labels, border accents |
| Brand Dark (Charcoal) | `#1A1F2E` | `app.css:10` | Referenced as `--brand-dark`, minimal usage |
| Brand Light (Mint Wash) | `#E8F5F0` | `app.css:11` | Referenced as `--brand-light`, mapped to `--leaf-50` |

### Semantic Colours — NL Token System

| Name | Base | Light (10%) | Border (20%) | Defined In |
|------|------|-------------|--------------|-----------|
| Success | `#0B7A52` | `rgba(11,122,82,0.10)` | `rgba(11,122,82,0.20)` | `tokens.js:19-21` |
| Warning | `#B7791F` | `rgba(183,121,31,0.10)` | `rgba(183,121,31,0.20)` | `tokens.js:23-25` |
| Danger | `#C94F4F` | `rgba(201,79,79,0.10)` | `rgba(201,79,79,0.20)` | `tokens.js:27-29` |
| Info | `#2563EB` | `rgba(37,99,235,0.10)` | `rgba(37,99,235,0.20)` | `tokens.js:31-33` |

### Semantic Colours — app.css System (different values)

| Name | Value | Background | Defined In |
|------|-------|-----------|-----------|
| Profit | `#059669` | `#ecfdf5` | `app.css:50-51` |
| Loss | `#dc2626` | `#fef2f2` | `app.css:52-53` |
| Warn | `#d97706` | `#fff7ed` | `app.css:54-55` |

### Semantic Colours — Landing Page System (yet another set)

| Name | Variable | Value | Defined In |
|------|----------|-------|-----------|
| OK / Success | `--ok` | `#2d7d4f` | `landing-v7.css:20` |
| Purple accent | `--q` | `#7c3aed` | `landing-v7.css:23` |
| Amber accent | `--w` | `#d97706` | `landing-v7.css:23` |
| Teal accent | `--t` | `#0d9488` | `landing-v7.css:23` |
| Red accent | `--d` | `#dc2626` | `landing-v7.css:24` |

### Accent Colours (app.css)

| Name | Variable | Value | Defined In |
|------|----------|-------|-----------|
| Blue | `--blue` | `#2563eb` | `app.css:58` |
| Amber | `--amber` | `#d97706` | `app.css:59` |
| Purple | `--purple` | `#7c3aed` | `app.css:60` |
| Cyan | `--cyan` | `#0891b2` | `app.css:61` |

### Gray Scale (app.css:37-48)

| Token | Value | Usage |
|-------|-------|-------|
| `--gray-50` | `#f9fafb` | Card backgrounds, hover states |
| `--gray-100` | `#f3f4f6` | Toggle backgrounds, borders |
| `--gray-200` | `#e5e7eb` | Primary border colour, dividers |
| `--gray-300` | `#d1d5db` | Hover borders |
| `--gray-400` | `#9ca3af` | Muted text, inactive nav, footer |
| `--gray-500` | `#6b7280` | Secondary text, labels |
| `--gray-600` | `#4b5563` | Body text, filter labels |
| `--gray-700` | `#374151` | Dark text, active nav |
| `--gray-800` | `#1f2937` | Risk bar backgrounds |
| `--gray-900` | `#111827` | Primary text colour |

### Leaf Green Scale (app.css:13-24, CSS custom properties)

| Token | Value |
|-------|-------|
| `--leaf-50` | `#e8f5f0` |
| `--leaf-100` | `#d1ebe1` |
| `--leaf-200` | `#a3d7c3` |
| `--leaf-300` | `#75c3a5` |
| `--leaf-400` | `#47af87` |
| `--leaf-500` | `#1a7a56` |
| `--leaf-600` | `#0B2D23` |
| `--leaf-700` | `#0B2D23` |
| `--leaf-800` | `#0a2b1f` |
| `--leaf-900` | `#061a13` |

### Gold Scale (app.css:26-35)

| Token | Value |
|-------|-------|
| `--gold-50` | `#fdf8ed` |
| `--gold-100` | `#f5ecd0` |
| `--gold-200` | `#e8d9a3` |
| `--gold-300` | `#dcc88a` |
| `--gold-400` | `#C9A96E` |
| `--gold-500` | `#C9A96E` |
| `--gold-600` | `#a8893a` |
| `--gold-700` | `#88701e` |
| `--gold-800` | `#685510` |

### Surface Colours

| Surface | Value | Source |
|---------|-------|--------|
| Page background (app) | `#F7F8FA` | `tokens.js:11`, `newleaf-system.css:13` |
| Page background (landing) | `#F7F4EE` | `landing-v7.css:13`, `index.html:25` |
| Page background (app.css body) | `#ffffff` | `app.css:91` via `var(--white)` |
| Card background | `#FFFFFF` | `tokens.js:17`, `newleaf-system.css:18` |
| Elevated card background | `rgba(247,248,250,0.65)` | `newleaf-system.css:369`, `ui.css:173` |
| Nav background (authenticated) | `#0B2D23` | `nl-nav.css:10` |
| Nav background (legacy) | `#ffffff` | `app.css:98` |
| Dark sections (landing) | `#04120c` → `#0b2d23` gradient | `landing-v7.css:139-145` |

### Text Colours

| Role | Value | Source |
|------|-------|--------|
| Primary text | `#111827` | `tokens.js:12`, `app.css:47` |
| Primary text (landing) | `#0B0F14` | `landing-v7.css:16`, `index.html:26` |
| Muted text | `rgba(17,24,39,0.68)` | `tokens.js:13` |
| Muted text 2 | `rgba(17,24,39,0.55)` | `tokens.js:14` |
| Inverse (on dark) | `#fff` | Used inline across hero/banner components |
| Disabled text | `rgba(17,24,39,0.40)` | `landing-v7.css:18` as `--dim` |

### Border Colours

| Role | Value | Source |
|------|-------|--------|
| Default border (NL system) | `rgba(17,24,39,0.10)` | `tokens.js:15`, `newleaf-system.css:17` |
| Default border (app.css) | `var(--gray-200)` = `#e5e7eb` | `app.css:99` |
| Hover border | `rgba(34,197,94,0.3)` | `newleaf-system.css:222` |
| Focus ring | `rgba(21,128,61,0.1)` | `app.css:1482` |

### Strategy Theme Colours (`src/trading/utils/strategyThemes.js`)

| Strategy | Primary | Light BG | Dark Text | Gradient |
|----------|---------|----------|-----------|----------|
| Bull Call Spread | `#2563eb` | `#eff6ff` | `#1d4ed8` | `#2563eb` → `#60a5fa` |
| Bull Put Spread | `#7c3aed` | `#f5f3ff` | `#6d28d9` | `#7c3aed` → `#a78bfa` |
| Iron Condor | `#ea580c` | `#fff7ed` | `#c2410c` | `#ea580c` → `#fb923c` |
| Covered Call | `#0891b2` | `#ecfeff` | `#0e7490` | `#0891b2` → `#22d3ee` |
| Bear Put Spread | `#e11d48` | `#fff1f2` | `#be123c` | `#e11d48` → `#fb7185` |
| Calendar Spread | `#9333ea` | `#faf5ff` | `#7e22ce` | `#9333ea` → `#c084fc` |
| Diagonal Spread | `#059669` | `#ecfdf5` | `#047857` | `#059669` → `#34d399` |
| Collar | `#0891b2` | `#ecfeff` | `#0e7490` | `#0891b2` → `#22d3ee` |
| Butterfly | `#db2777` | `#fdf2f8` | `#be185d` | `#db2777` → `#f472b6` |

These are applied via CSS theme classes (e.g., `.theme-bull-call`) in `app.css:1005-1051` and `app.css:1237-1298` and via JS in `strategyThemes.js:36-118`.

### AI Analysis Theme — Light (`src/trading/styles/ai-analysis-light.css:6-25`)

| Variable | Value | Purpose |
|----------|-------|---------|
| `--ai-primary-gold` | `#C9A96E` | Gold accent |
| `--ai-text-primary` | `#0B0F14` | Primary text |
| `--ai-text-secondary` | `#3d3d35` | Secondary text |
| `--ai-text-muted` | `#6b6b60` | Muted text |
| `--ai-success` | `#1D9E75` | Success green |
| `--ai-danger` | `#E24B4A` | Danger red |
| `--ai-warning` | `#d97706` | Warning amber |
| `--ai-info` | `#1a5ca0` | Info blue |
| `--ai-primary-green` | `#0B2D23` | Primary green |
| `--ai-border` | `rgba(15,61,46,0.12)` | Borders |
| `--ai-surface` | `#fff` | Card background |

### AI Analysis Theme — Dark (`src/trading/styles/ai-enhanced-dark.css:9-34`)

| Variable | Value | Purpose |
|----------|-------|---------|
| `--ai-dark-bg` | `linear-gradient(135deg, #0a0a0a, #1a1a2e)` | Page background |
| `--ai-card-bg` | `linear-gradient(135deg, #1a1a2e, #16213e)` | Card background |
| `--ai-text-primary` | `#e0e0e0` | Primary text (inverted) |
| `--ai-text-muted` | `#999` | Muted text |
| `--ai-success` | `#4ade80` | Success green (brighter for dark) |
| `--ai-danger` | `#ef4444` | Danger red |
| `--ai-warning` | `#fbbf24` | Warning amber |
| `--ai-info` | `#3b82f6` | Info blue |
| `--ai-border` | `rgba(201,169,110,0.3)` | Gold-tinted border |
| `--ai-surface` | `rgba(255,255,255,0.05)` | Transparent surface |

Note: The AI light and dark themes define the same variable names with different values — a proper light/dark mode implementation. However, both are loaded via `:root`, so the last-loaded file wins.

### Notable Inline Hex Values in Components

| Colour | Files | Purpose |
|--------|-------|---------|
| `#0B2D23` | `LoginPage.jsx:60`, `Navbar.jsx:42`, `global.css:86` | Logo SVG fill, CTA hover |
| `#C9A96E` | `LoginPage.jsx:61`, `Navbar.jsx:43`, `nl-nav.css:54` | Logo SVG stroke, gold accents |
| `#6b7280` | `ui/index.jsx:93` | Inline muted text |
| `#5dba8e` | `nl-nav.css:224` | Live indicator dot |
| `#b89556` | `nl-nav.css:180` | Gold CTA hover state |
| `#d4b468` | `landing-v7.css:133,214` | Gold button hover |
| `#ea580c` | `global.css:77`, `app.css:560` | View hint text, orange accent |
| `#94a3b8` | `PnLChart.jsx:29` | Empty chart text |

---

## Typography

### Font Families

| Role | Family | Loaded From | CSS Variable | Used In |
|------|--------|------------|--------------|---------|
| Display / Headlines | Playfair Display | `index.html:16` (Google Fonts) | `--serif`, `--fd` | Hero h1, portfolio titles, stat values, detail ticker |
| Body / UI | Inter | `index.html:16` (Google Fonts) | `--sans`, `--ff`, `--fm` | Body text, nav links, labels, buttons |
| Numeric / Data | Space Mono | `index.html:16` (Google Fonts) | N/A (loaded but not referenced by variable) | Not explicitly used via variable |

Tailwind config (`tailwind.config.js:24-27`) defines a different set that does not match loaded fonts:

| Role | Tailwind Family |
|------|----------------|
| `font-sans` | Instrument Sans |
| `font-serif` | Fraunces |
| `font-mono` | IBM Plex Mono |

The `--mono` variable in `app.css:78` maps to Inter (not a monospace font) with intent to use `tabular-nums` feature. In `newleaf-system.css:238`, it falls back: `var(--mono, 'IBM Plex Mono', monospace)`.

### Font Size Scale

Responsive clamp sizes are used in several places:
- `clamp(44px, 5.2vw, 64px)` — Landing hero h1 (`landing-v7.css:190`)
- `clamp(30px, 3.5vw, 44px)` — Landing section h2 (`landing-v7.css:336`)
- `clamp(30px, 4vw, 44px)` — Trading layout h1 (`TradingLayout.jsx:60`)
- `clamp(24px, 3.5vw, 36px)` — Picks page headers (`PicksPage.jsx:85`)
- `clamp(20px, 2.5vw, 28px)` — Summary card values (`SummaryCards.jsx:18`)

| Token / Class | Size | Weight | Usage | Source |
|---------------|------|--------|-------|--------|
| Landing h1 | `clamp(44px, 5.2vw, 64px)` | 900 | Hero headline | `landing-v7.css:190` |
| Landing h2 | `clamp(30px, 3.5vw, 44px)` | 900 | Section headings | `landing-v7.css:336` |
| `pageH1` | `28px` | 900 | Page titles | `tokens.js:62`, `newleaf-system.css:69` |
| Hero ticker | `36px` | 900 | Strategy hero ticker symbol | `ui.css:342` |
| Hero stat primary | `24px` | 900 | Primary stat in hero | `ui.css:397` |
| `stat-value` | `2.25rem` (36px) | 300 | Portfolio stat values | `app.css:2037` |
| `metric-value` | `2rem` (32px) | 300 | Metric card values | `app.css:1768` |
| `gauge-value-large` | `2rem` (32px) | 900 | Risk gauge values | `newleaf-system.css:846` |
| `.cc-amount` | `2rem` (32px) | 700 | Card return amount | `app.css:848` |
| `hm-val` | `30px` | 900 | Hero metric value | `landing-v7.css:229` |
| `detail-ticker` | `3rem` (48px) | 300 | Detail page ticker | `app.css:1609` |
| `portfolio-title` | `3rem` (48px) | 300 | Portfolio page title | `app.css:1973` |
| `sectionH2` | `20px` | 900 | Section headings | `tokens.js:68` |
| `nl-hero-stat-value` | `20px` | 900 | Hero stat values | `ui.css:389` |
| `nl-nav-wordmark` | `20px` | 600 | Nav brand name | `nl-nav.css:47` |
| `sectionH3` | `18px` | 900 | Sub-section headings | `tokens.js:73` |
| `.nl-stat-tile-value` | `18px` | 900 | Stat tile values | `ui.css:429` |
| `nl-kpi-value` | `22px` | 900 | KPI card values | `ui.css:29` |
| `nl-card-title` | `16px` | 900 | Card titles | `newleaf-system.css:145` |
| `.section-heading` | `1.125rem` (18px) | 900 | Section headings | `newleaf-system.css:763` |
| `hero-sub` | `16px` | 400 | Hero subtitle | `landing-v7.css:199` |
| `body` | `14px` | 500 | Default body text | `tokens.js:88` |
| `nl-hero-ticker` | `36px` | 900 | Hero ticker | `ui.css:342` |
| `nl-hero-company` | `22px` | 700 | Hero company name | `ui.css:351` |
| `.nl-metric-value.primary` | `17px` | 900 | Primary metric value | `ui.css:202` |
| `nl-metric-value` | `14px` | 900 | Metric value | `ui.css:196` |
| `nl-ticker-info h4` | `14px` | 900 | Card ticker heading | `ui.css:133` |
| `nl-page-subtitle` | `13px` | 600 | Page subtitle | `newleaf-system.css:79` |
| `confirm-title` | `1.5rem` (24px) | 700 | Modal title | `newleaf-system.css:693` |
| `bodySmall` | `12px` | 500 | Small body text | `tokens.js:93` |
| `metaLabel` | `11px` | 900 | Meta labels (uppercase) | `tokens.js:80` |
| `.nl-kpi-label` | `11px` | 900 | KPI labels | `ui.css:20` |
| `.nl-metric-label` | `10px` | 900 | Metric labels | `ui.css:186` |
| `.nl-hero-stat-label` | `10px` | 900 | Hero stat labels | `ui.css:381` |
| `.sec-kicker` | `10px` | 700 | Landing section kickers | `landing-v7.css:329` |
| `.hero-pill` | `10.5px` | 700 | Landing hero pill | `landing-v7.css:174` |
| `.brand-tag` | `9.5px` | 600 | Landing brand tag | `landing-v7.css:102` |
| `.sc-badge` | `9px` | 700 | Landing stage card badge | `landing-v7.css:636` |
| `.pf-added-label` | `0.625rem` (10px) | 900 | Portfolio "added" label | `newleaf-system.css:293` |
| `.pf-stat-label` | `0.625rem` (10px) | 900 | Stat label | `newleaf-system.css:376` |

### Font Weights

| Weight | Usage | Examples |
|--------|-------|---------|
| 300 | Serif display text (light) | `detail-ticker`, `portfolio-title`, `metric-value`, `empty-title`, `risk-level` |
| 400 | Body text, hero-sub | `hero-sub` (`landing-v7.css:199`) |
| 500 | Standard body, nav links | `body` token, `.nav-link`, `.filter-select` |
| 600 | Labels, buttons, badges | `.nav-link.active`, `.brand-sub`, `btn-primary`, `.pf-card-badge` |
| 650 | KPI subtitles | `.nl-kpi-subtitle` (`ui.css:39`) |
| 700 | Headings, stat values, brands | `.cc-symbol`, `.pf-stat-value`, `.section-heading`, `.brand-name` |
| 800 | Buttons, filter labels | `.nl-btn`, `.nl-seg-tab`, `.nl-confidence`, `btn-nav-cta` |
| 900 | Primary headings, titles, labels | All `pageH1`, `sectionH2`, `sectionH3`, `metaLabel`, KPI values, card titles |

### Line Heights

| Value | Usage | Source |
|-------|-------|--------|
| `0.97` | Landing hero h1 | `landing-v7.css:192` |
| `1` | Numeric display values | `landing-v7.css:231` |
| `1.06` | Landing h2 | `landing-v7.css:338` |
| `1.1` | Stage card verb | `landing-v7.css:660` |
| `1.2` | `pageH1` token | `tokens.js:65` |
| `1.3` | `sectionH2` token | `tokens.js:71` |
| `1.4` | Nav toggle button, `sectionH3` | `tokens.js:77`, `app.css:268` |
| `1.5` | Body text, small body | `tokens.js:94`, `app.css:94` |
| `1.6` | Body token, subtitles, descriptions | `tokens.js:90`, `newleaf-system.css:81` |
| `1.65` | Landing descriptions | `landing-v7.css:527` |
| `1.68` | Pipe description | `landing-v7.css:410` |
| `1.7` | AI text (serif italic) | `app.css:656` |
| `1.72` | Landing card descriptions | `landing-v7.css:472` |
| `1.78` | Hero sub, section sub | `landing-v7.css:201`, `landing-v7.css:342` |

### Letter Spacing

| Value | Usage | Source |
|-------|-------|--------|
| `-2.5px` | Landing hero h1 | `landing-v7.css:193` |
| `-1.5px` | Landing h2 | `landing-v7.css:338` |
| `-1px` | Hero metric values | `landing-v7.css:231` |
| `-0.6px` | `pageH1` | `tokens.js:64`, `newleaf-system.css:70` |
| `-0.5px` | Stage card verb | `landing-v7.css:663` |
| `-0.3px` | KPI values | `ui.css:31` |
| `-0.2px` | `sectionH2`, card titles | `tokens.js:69`, `newleaf-system.css:147` |
| `-0.1px` | `sectionH3` | `tokens.js:76` |
| `-0.02em` | Card symbol | `app.css:767` |
| `-0.03em` | Return amount | `app.css:849` |
| `-0.005em` | Nav wordmark | `nl-nav.css:49` |
| `0.01em` | View hint | `app.css:561` |
| `0.02em` | Strategy badge | `app.css:802` |
| `0.04em` | Live indicator | `nl-nav.css:217` |
| `0.05em` | AI label, stat labels | `app.css:647`, `app.css:875` |
| `0.06em` | Insight label | `app.css:959` |
| `0.08em` | Filter labels, CTA | `newleaf-system.css:1045`, `nl-nav.css:167` |
| `0.1em` | Nav pill, hero pill | `nl-nav.css:119`, `landing-v7.css:175` |
| `0.12em` | Nav links, stat labels | `nl-nav.css:81`, `newleaf-system.css:293` |
| `0.14em` | `metaLabel` token, metric labels | `tokens.js:83`, `ui.css:21` |
| `0.16em` | Brand tag | `landing-v7.css:103` |
| `0.18em` | Stage card badge | `landing-v7.css:637` |
| `0.2em` | Section kicker | `landing-v7.css:330` |

### Text Transform Patterns

`text-transform: uppercase` is applied extensively to:
- All `metaLabel` tokens (`tokens.js:84`)
- KPI labels (`.nl-kpi-label`, `ui.css:22`)
- Metric labels (`.nl-metric-label`, `ui.css:189`)
- Strategy tags (`.nl-strat-tag`, `ui.css:149`)
- Nav links (`.nl-nav-link`, `nl-nav.css:82`)
- Section labels (`.section-label`, `redesign.css:183`)
- Filter labels (`.nl-filter-label`, `newleaf-system.css:1046`)
- Table headers (`.nl-app-table th`, `ui.css:504`)
- All stat labels across pages
- Landing page kickers, badges, brand tags

`text-transform: capitalize` is used on:
- Status pills (`.nl-status-pill`, `ui.css:475`)

---

## Spacing

### Token Scale (`tokens.js:98-106`)

| Token | Value |
|-------|-------|
| `xs` | `4px` |
| `sm` | `8px` |
| `md` | `12px` |
| `lg` | `16px` |
| `xl` | `20px` |
| `2xl` | `24px` |
| `3xl` | `32px` |

### Utility Classes (`newleaf-system.css:645-667`)

| Class | Value |
|-------|-------|
| `.nl-mb-sm` | `margin-bottom: 8px` |
| `.nl-mb-md` | `margin-bottom: 12px` |
| `.nl-mb-lg` | `margin-bottom: 16px` |
| `.nl-mt-sm` | `margin-top: 8px` |
| `.nl-mt-md` | `margin-top: 12px` |
| `.nl-mt-lg` | `margin-top: 16px` |

### Common Spacing Values in Use

| Value | Frequency / Usage |
|-------|------------------|
| `4px` | Small gaps, badge inner spacing |
| `6px` | Margins between label and value |
| `8px` | Icon gaps, small padding, tab gaps |
| `10px` | Metric box padding, month tile gaps |
| `12px` | Grid gaps, card padding (NL system), margins |
| `14px` | Card padding (NL system), grid gaps, hero stat padding |
| `16px` | Card padding, page margins, section gaps |
| `20px` | Grid gap (tile-grid), filter panel padding |
| `24px` | Hero padding, card body padding, section margins |
| `28px` | Page body padding (redesign), app-card padding |
| `32px` | Large gaps (3xl token) |
| `40px` | Hero gap |
| `52px` | CTA box padding (landing) |
| `1rem` | General spacing unit |
| `1.5rem` | Card padding, section margins |
| `2rem` | Nav padding, page padding |

### Container Widths

| Context | Max Width | Source |
|---------|----------|--------|
| NL page | `1280px` | `newleaf-system.css:56` |
| Page body (redesign) | `1300px` | `redesign.css:179` |
| Nav container | `1400px` | `app.css:108` |
| Home content wrapper | `1400px` | `app.css:551` |
| Portfolio container | `1400px` | `app.css:1963` |
| Card grid | `1400px` | `app.css:706` |
| Position grid | `1400px` | `newleaf-system.css:192` |
| Detail container | `1200px` | `app.css:1546` |
| Landing page wrap | `1160px` | `landing-v7.css:67` |

### Breakpoints

| Width | Usage | Source |
|-------|-------|--------|
| `640px` | Grid collapse to 1-col for nl-grid-4, portfolio-stats | `newleaf-system.css:119`, `app.css:2013` |
| `768px` | Mobile breakpoint: nav links hide, cards 1-col, metric grids 2-col | `global.css:21`, `app.css:304`, `redesign.css:165` |
| `860px` | Nav mobile breakpoint (nl-nav) | `nl-nav.css:267` |
| `1024px` | Grid collapse: nl-grid-2/3 to 1-col, risk gauges, portfolio stats | `newleaf-system.css:108`, `app.css:2007` |
| `1100px` | Portfolio KPI/layout collapse, perf layout | `newleaf-system.css:168,181`, `newleaf-system.css:554` |
| `1200px` | Card grid 3→2 col, position grid 3→2 | `global.css:15`, `app.css:710` |

### Grid Patterns

```css
/* 3-column card grid */
.card-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1.5rem;
}
/* Source: app.css:701-708 */

/* NL system grids */
.nl-grid-2 { grid-template-columns: repeat(2, 1fr); gap: 14px; }
.nl-grid-3 { grid-template-columns: repeat(3, 1fr); gap: 14px; }
.nl-grid-4 { grid-template-columns: repeat(4, 1fr); gap: 12px; }
/* Source: newleaf-system.css:88-106 */

/* Portfolio layout (sidebar + content) */
.nl-portfolio-layout {
  grid-template-columns: 320px 1fr;
  gap: 14px;
}
/* Source: newleaf-system.css:173-178 */

/* Performance layout */
.nl-perf-layout {
  grid-template-columns: 1.35fr 0.65fr;
  gap: 14px;
}
/* Source: newleaf-system.css:559-565 */

/* Landing hero */
.hero-inner {
  grid-template-columns: 1fr 490px;
  gap: 40px;
}
/* Source: landing-v7.css:158-165 */

/* Landing pipeline */
.pipeline {
  grid-template-columns: 1fr 28px 1fr 28px 1fr 28px 1fr;
}
/* Source: landing-v7.css:354 */

/* Auto-fit filter grid */
.nl-filter-grid {
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}
/* Source: newleaf-system.css:1019-1022 */

/* Strategy metrics 4-col */
.nl-strat-metrics {
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
}
/* Source: ui.css:159-163 */
```

---

## Elevation

### Border Radii

#### Token System (`tokens.js:43-49`, `newleaf-system.css:42-48`)

| Token | Value | Usage |
|-------|-------|-------|
| `--nl-radius-sm` | `14px` | Buttons (nl-btn), metric boxes |
| `--nl-radius-md` | `16px` | Confirm dialog, stat tiles, month tiles |
| `--nl-radius-lg` | `18px` | App card (landing) |
| `--nl-radius-xl` | `22px` | Cards, banners, chart containers, table wraps |
| `--nl-radius-pill` | `999px` | Pills, filter chips, segmented tabs |

#### Other Radii in Use

| Value | Usage | Source |
|-------|-------|--------|
| `3px` | Probability bar track | `app.css:896` |
| `4px` | Nav pill, nav CTA | `nl-nav.css:114,163` |
| `0.25rem` (4px) | Bookmark, expiry badge, pro badge | `app.css:1064`, `app.css:1651` |
| `6px` | Strategy badge, nav view toggle | `app.css:804`, `app.css:252` |
| `0.375rem` (6px) | Status select, contract btn | `newleaf-system.css:255,329` |
| `8px` | Card bookmark, hamburger btn | `app.css:774`, `redesign.css:97` |
| `0.5rem` (8px) | Toggle, leg card, filters, stats | `app.css:518`, `app.css:1685` |
| `9px` | Landing nav logo | `landing-v7.css:87` |
| `10px` | Landing nav button | `landing-v7.css:119` |
| `12px` | Ticker badge, landing primary btn | `ui.css:122`, `landing-v7.css:209` |
| `0.75rem` (12px) | Pro card, portfolio card, AI analysis | `app.css:1080`, `app.css:2132` |
| `1rem` (16px) | Client card | `app.css:728` |
| `13px` | AC icon | `landing-v7.css:452` |
| `14px` | Metric box, nl-btn, stage card | `ui.css:175`, `ui.css:591` |
| `16px` | Month tile, stat-tile | `newleaf-system.css:602` |
| `18px` | App card (landing), stage card | `landing-v7.css:614` |
| `20px` | Filter btn, nav voice btn | `redesign.css:196,47` |
| `22px` | All NL cards (nl-card, strategy-card, etc.) | Multiple |
| `9999px` | All pill shapes | `newleaf-system.css:584`, `app.css:244` |

### Box Shadows

#### Token System (`tokens.js:52-57`, `newleaf-system.css:37-40`)

| Token | Value | Usage |
|-------|-------|-------|
| `--nl-shadow-sm` | `0 4px 12px rgba(17,24,39,0.06)` | Small elevation |
| `--nl-shadow-md` | `0 10px 24px rgba(17,24,39,0.08)` | Filter panel, hero |
| `--nl-shadow-lg` | `0 18px 44px rgba(17,24,39,0.10)` | Banners, large cards |
| `--nl-shadow-card` | `0 10px 20px rgba(17,24,39,0.06)` | Standard card shadow |

#### Landing Page Shadows (`landing-v7.css:34-36`)

| Token | Value |
|-------|-------|
| `--s1` | `0 4px 14px rgba(11,15,20,0.05)` |
| `--s2` | `0 12px 36px rgba(11,15,20,0.10)` |
| `--s3` | `0 24px 60px rgba(11,15,20,0.13)` |

#### Other Shadows

| Value | Usage | Source |
|-------|-------|--------|
| `0 1px 2px rgba(0,0,0,0.08)` | Nav toggle active | `app.css:279` |
| `0 1px 3px rgba(0,0,0,0.05)` | Pro card | `app.css:1082` |
| `0 1px 3px rgba(0,0,0,0.1)` | AI icon box, toggle active | `app.css:628`, `app.css:546` |
| `0 2px 12px rgba(0,0,0,0.12)` | Authenticated nav | `nl-nav.css:21` |
| `0 4px 12px rgba(21,128,61,0.08)` | Portfolio card hover | `newleaf-system.css:223` |
| `0 8px 24px rgba(201,169,110,0.28)` | Landing primary btn | `landing-v7.css:213` |
| `0 10px 30px rgba(0,0,0,0.08)` | Pro card hover | `app.css:1088` |
| `0 12px 40px rgba(0,0,0,0.08)` | Client card hover | `app.css:738` |
| `0 14px 26px rgba(11,45,35,0.14)` | Primary button | `ui.css:623` |
| `0 14px 28px rgba(17,24,39,0.10)` | Strategy card hover | `ui.css:100` |
| `0 20px 60px rgba(0,0,0,0.3)` | Confirm dialog | `newleaf-system.css:689` |
| `0 32px 80px rgba(4,18,12,0.32)` | Landing CTA box | `landing-v7.css:769` |
| `0 -4px 12px rgba(0,0,0,0.05)` | Detail sticky action bar | `app.css:1929` |
| `-8px 0 30px rgba(0,0,0,0.12)` | Mobile menu drawer | `redesign.css:122` |

### Borders

| Pattern | Value | Source |
|---------|-------|--------|
| Standard card border | `1px solid var(--nl-border)` = `rgba(17,24,39,0.10)` | `newleaf-system.css:130` |
| Standard card border (app.css) | `1px solid var(--gray-200)` = `#e5e7eb` | `app.css:726` |
| Strategy card top accent | `3px solid [strategy-color]` | `app.css:486-503` |
| App card left accent | `3px` left border via `::before` pseudo | `landing-v7.css:428-435` |
| AI insight left accent | `4px solid var(--leaf-600)` | `app.css:1913` |
| AI bar left accent | `4px solid var(--brand-accent)` | `app.css:617` |
| Colour bar at top | `4px` height div | `app.css:741-745` |
| Nav active underline | `2px solid` bottom border | `app.css:149`, `nl-nav.css:90` |
| Divider | `1px solid var(--nl-border)` or `1px solid var(--gray-100/200)` | Multiple |

### Gradients

| Gradient | Usage | Source |
|----------|-------|--------|
| `linear-gradient(90deg, #10b981, #34d399)` | Probability fill (normal/profit) | `newleaf-system.css:421,872` |
| `linear-gradient(90deg, #ef4444, #f87171)` | Gauge fill (high/danger) | `newleaf-system.css:877` |
| `linear-gradient(90deg, [strategy-colors])` | Strategy-specific prob bars | `app.css:1010-1011,1287-1291` |
| `linear-gradient(135deg, var(--nl-primary-green), rgba(201,169,110,0.80))` | Range slider thumb | `newleaf-system.css:1080` |
| `linear-gradient(135deg, rgba(11,45,35,0.95), rgba(11,45,35,0.88))` + radial | Strategy hero | `ui.css:268-269` |
| `linear-gradient(135deg, rgba(11,45,35,0.10), rgba(201,169,110,0.12))` | Primary metric box | `ui.css:180` |
| `linear-gradient(135deg, #C9A96E, #b89556)` | Nav avatar | `nl-nav.css:255` |
| `linear-gradient(180deg, rgba(11,122,82,0.14), rgba(255,255,255,0.86))` | "Ready to activate" card | `newleaf-system.css:506` |
| `linear-gradient(180deg, rgba(201,79,79,0.12), #fff)` | KpiCard softRed variant | `ui/index.jsx:18` |
| `linear-gradient(180deg, rgba(37,99,235,0.12), #fff)` | KpiCard softBlue variant | `ui/index.jsx:21` |
| `linear-gradient(180deg, rgba(11,122,82,0.12), #fff)` | KpiCard softGreen variant | `ui/index.jsx:24` |
| `radial-gradient(900px 420px at 20% 0%, rgba(11,45,35,0.12), transparent 60%)` + linear | Chart container background | `newleaf-system.css:577-578` |
| `radial-gradient(…) + linear-gradient(145deg, #04120c…)` | Landing hero background | `landing-v7.css:139-145` |
| Banner: `radial-gradient(…, rgba(201,169,110,0.20)) + linear-gradient(90deg, rgba(11,45,35,0.95), rgba(11,45,35,0.80))` | Banner component | `ui.css:534-535` |
| CTA box gradient | `linear-gradient(135deg, #04120c, var(--g), #1a5940)` | `landing-v7.css:765` |
| Brand story section | `linear-gradient(180deg, #020d08, #051510, #071a12)` | `landing-v7.css:554` |

### Opacity Patterns

| Value | Usage |
|-------|-------|
| `0.4` | Disabled buttons | `newleaf-system.css:349` |
| `0.5` | Overlay backdrop | `newleaf-system.css:679` |
| `0.6` | Closed market dot | `redesign.css:72` |
| `0.65` | Stat background | `newleaf-system.css:369` |
| `0.72` | Stage card background | `landing-v7.css:609` |

### Backdrop Blur

| Value | Usage | Source |
|-------|-------|--------|
| `blur(2px)` | Mobile menu overlay | `redesign.css:113` |
| `blur(16px)` | Stage card | `landing-v7.css:610` |
| `blur(18px)` | Landing nav | `landing-v7.css:75` |

---

## Components

### Buttons

#### `Button` component (`src/trading/components/ui/index.jsx:253-259`)

**Props:** `variant` (`'primary'` | `'ghost'`), `size` (`'sm'` | `'md'` | `'lg'`), `children`, `className`, spread `...props`

**Variants:**
- **Primary** (`.nl-btn-primary`): `bg: #0B2D23`, `color: #fff`, shadow: `0 14px 26px rgba(11,45,35,0.14)`
- **Ghost** (`.nl-btn-ghost`): `bg: rgba(255,255,255,0.72)`, border: `1px solid var(--nl-border)`, `color: rgba(17,24,39,0.84)`

**Sizes:** sm: `8px 12px / 12px`, md: `10px 14px / 13px`, lg: `12px 18px / 14px`

**States:** Hover (primary darkens to `#0a2b1f`, ghost goes white), Active (translateY 1px)

```jsx
<Button variant="primary" size="md">Add to Portfolio</Button>
<Button variant="ghost" size="sm">Cancel</Button>
```

**CSS:** `ui.css:585-637`

#### Other Button Patterns

| Class | Visual | Source |
|-------|--------|--------|
| `.nl-add-btn.primary` | Forest green, white text, rounded 14px | `ui.css:436-454` |
| `.nl-add-btn.added` | Light green bg, green text | `ui.css:456-460` |
| `.cc-cta` | Full-width, forest green bg, no border-radius | `app.css:976-999` |
| `.pc-cta` | Full-width, white bg, border-top, green text | `app.css:1215-1235` |
| `.btn-primary` (app.css) | `var(--leaf-700)` bg, white, 0.5rem radius | `app.css:1563-1577` |
| `.btn-primary` (landing) | Gold bg, dark text, 12px radius, gold shadow | `landing-v7.css:208-214` |
| `.btn-secondary` (landing) | Transparent, white border, white text | `landing-v7.css:216-224` |
| `.nl-nav-cta` | Gold bg, dark text, 4px radius, uppercase | `nl-nav.css:158-184` |
| `.nl-nav-pill` | Gold border, gold text, outline style | `nl-nav.css:111-136` |
| `.nl-nav-ghost` | Transparent, white text, uppercase | `nl-nav.css:187-206` |
| `.filter-chip` | Pill (9999px), 1px gray border | `app.css:582-603` |
| `.filter-pill` | Pill (9999px), 1px gray border | `app.css:1490-1511` |
| `.filter-btn` | 20px radius, 1px gray border | `redesign.css:196-200` |
| `.action-btn` | White bg, gray border, 0.5rem radius | `app.css:1931-1959` |
| `.action-btn.active` | Leaf-700 bg, white text | `app.css:1951-1958` |
| `.pf-view-btn` | Light green bg, green border, green text | `newleaf-system.css:448-463` |
| `.pf-remove-btn` | White bg, muted border, icon only | `newleaf-system.css:465-482` |
| `.contract-btn` | 32x32 square, bordered, +/- | `newleaf-system.css:326-351` |
| `.nl-filter-reset` | Pill, danger-tinted border/bg | `newleaf-system.css:1003-1017` |
| `.confirm-btn.cancel` | Gray bg, dark text | `newleaf-system.css:722-729` |
| `.confirm-btn.confirm` | Danger red bg, white text | `newleaf-system.css:731-738` |
| `.btn-cta-gold` | Gold bg, dark text, 12px radius | `landing-v7.css:788-795` |
| `.btn-cta-ghost` | Transparent, white border | `landing-v7.css:796-799` |

### Cards

#### `KpiCard` (`src/trading/components/ui/index.jsx:14-35`)

**Props:** `label`, `value`, `subtitle`, `variant` (`'default'` | `'softRed'` | `'softBlue'` | `'softGreen'`), `className`

```jsx
<KpiCard
  label="TOTAL P&L"
  value="$2,450"
  subtitle="Last 30 days"
  variant="softGreen"
/>
```

**CSS:** `.nl-kpi-card` (`ui.css:9-41`) — white bg, 22px radius, card shadow, 14px padding

#### `StrategyCard` (`src/trading/components/ui/index.jsx:60-154`)

**Props:** `symbol`, `companyName`, `strategy`, `dte`, `metrics[]`, `riskLevel`, `confidence`, `onAdd`, `isAdded`, `onClick`, `children`, `className`

```jsx
<StrategyCard
  symbol="AAPL"
  companyName="Apple Inc."
  strategy="Iron Condor"
  dte={21}
  metrics={[
    { label: 'R:R', value: '3.2:1', primary: true },
    { label: 'Max Profit', value: '$450', positive: true },
  ]}
  riskLevel={35}
  confidence="High"
  onAdd={() => addToPortfolio(tile)}
/>
```

**CSS:** `.nl-strategy-card` (`ui.css:86-263`) — white bg, 22px radius, card shadow, hover: translateY(-2px)

#### `StrategyHero` (`src/trading/components/ui/index.jsx:264-333`)

**Props:** `symbol`, `companyName`, `strategy`, `dte`, `spotPrice`, `publishedAt`, `stats[]`, `onBack`, `className`

Dark gradient hero with large ticker, strategy tag, and stat tiles. Uses gold accents for primary stat.

**CSS:** `.nl-strategy-hero` (`ui.css:267-399`)

#### Client Card (`.client-card`, `app.css:724-1002`)

Strategy tile card used on Discover page. Features: colour bar top, symbol, strategy badge, return values, probability bar, AI insight block, full-width CTA. Themed per strategy via `.theme-*` classes.

#### Pro Card (`.pro-card`, `app.css:1076-1235`)

Professional view card. Features: 3px top border, ticker, strategy, metrics rows with dot indicators, pills, CTA. Themed per strategy.

#### Portfolio Card (`.portfolio-card`, `newleaf-system.css:209-482`)

Position card in portfolio. Features: themed top border, ticker (mono font), strategy badge, status select, contract controls (+/- buttons), stats grid, probability bar, view/remove buttons.

#### Scenario Card (`.scenario-card`, `newleaf-system.css:913-972`)

Risk scenario display with bull/flat/bear variants using tinted backgrounds and borders.

#### App Card (landing) (`.app-card`, `landing-v7.css:419-489`)

Feature card on landing page. Left colour accent bar via `::before`, tinted top via `::after`, icon, badge, name, description, feature list, link.

#### Stage Card (landing) (`.stage-card`, `landing-v7.css:608-694`)

Brand story section card. Dark glassmorphism style with backdrop blur, coloured top bar, staggered entrance animation.

### Inputs

#### Text Input (inline styles, `LoginPage.jsx:258-261`)

```jsx
<input style={{
  width: '100%',
  padding: '14px 16px',
  background: '#FFFFFF',
  border: '1px solid #E5E7EB',
  borderRadius: '12px',
  fontSize: '15px',
  color: '#111827',
}} />
```

No shared Input component exists — inputs are styled inline or via page-specific CSS classes.

#### Select (`.filter-select`, `app.css:1463-1483`)

```css
.filter-select {
  padding: 0.5rem 1rem;
  border: 1px solid var(--gray-200);
  border-radius: 0.5rem;
  font-size: 0.875rem;
}
```

Focus: `border-color: var(--leaf-500)`, `box-shadow: 0 0 0 3px rgba(21,128,61,0.1)`

#### Status Select (`.pf-status-select`, `newleaf-system.css:252-279`)

Dropdown with status-dependent colours:
- `.status-watching`: amber bg/text/border
- `.status-entered`: green bg/text/border
- `.status-closed`: gray bg/text/border

#### Range Input (`.nl-range-input`, `newleaf-system.css:1063-1121`)

Custom-styled range slider with gradient thumb (`linear-gradient(135deg, var(--nl-primary-green), rgba(201,169,110,0.80))`), white border, shadow. Hover scales thumb to 1.1.

### Badges and Pills

#### `StatusPill` (`src/trading/components/ui/index.jsx:159-198`)

**Props:** `status` (`'healthy'` | `'warning'` | `'critical'` | `'neutral'`), `label`, `dot` (boolean), `className`

```jsx
<StatusPill status="healthy" label="Active" />
<StatusPill status="warning" label="Monitor" />
<StatusPill status="critical" label="At Risk" />
```

Each status maps to token colours for text, background, and border. Renders a 7px dot indicator.

**CSS:** `.nl-status-pill` (`ui.css:465-483`)

#### Strategy Tag (`.nl-strat-tag`, `ui.css:145-156`)

Uppercase, 10px, 900 weight, pill radius, gold-tinted border/bg by default. Overridden per strategy via inline styles from `getStrategyTheme()`.

#### Card Badge (`.pf-card-badge`, `newleaf-system.css:242-250`)

Pill shape, 12px, 600 weight. Colour themed per strategy via `.theme-*` classes.

#### Pro Badge (`.pc-badge`, `app.css:1092-1104`)

Uppercase, 12px, 700 weight, gold-50 bg, gold text, 4px radius.

#### Tab Badge (`.tab-badge`, `app.css:2085-2094`)

Gray pill counter, turns green when parent tab is active.

#### Banner Badge (`.nl-banner-badge`, `ui.css:570-580`)

Uppercase, 11px, 900 weight, white-tinted bg/border on dark background.

### Tabs and Segmented Controls

#### `SegmentedTabs` (`src/trading/components/ui/index.jsx:40-55`)

**Props:** `tabs` (array of `{value, label, count?}`), `activeTab`, `onChange`, `className`

```jsx
<SegmentedTabs
  tabs={[
    { value: 'all', label: 'All', count: 12 },
    { value: 'active', label: 'Active', count: 8 },
  ]}
  activeTab="all"
  onChange={setActiveTab}
/>
```

Pill-shaped buttons with optional count badge. Active state: green-tinted background and border.

**CSS:** `.nl-segmented-tabs` (`ui.css:44-81`)

#### Portfolio Tabs (`.portfolio-tabs`, `app.css:2052-2094`)

Underline-style tabs. Active tab has green bottom border (`var(--leaf-700)`) and colour.

#### Nav View Toggle (`.nav-view-toggle`, `app.css:247-279`)

Segmented control in nav bar. Gray-100 background, 6px radius container. Active button has white bg, leaf-700 text, small shadow.

### Tables

#### `AppTable` (`src/trading/components/ui/index.jsx:203-230`)

**Props:** `columns` (array of `{header, key?, align?, render?}`), `data`, `className`

```jsx
<AppTable
  columns={[
    { header: 'Symbol', key: 'symbol' },
    { header: 'P&L', key: 'pnl', align: 'right', render: (row) => <span>{row.pnl}</span> },
  ]}
  data={rows}
/>
```

**CSS:** `.nl-app-table` (`ui.css:487-525`) — white bg, 22px radius wrap, header: gray-50 bg, 11px uppercase labels, row hover: light gray bg

#### Allocation Table (`.allocation-table`, `newleaf-system.css:777-803`)

Full-width, collapsed borders. Headers: gray-50 bg, 11px uppercase. Uses mono font for amount columns.

### Navigation

#### Authenticated Nav — `AppHeader` (`src/trading/components/AppHeader.jsx`)

Uses `.nl-nav` classes from `nl-nav.css`. Dark green background (`#0B2D23`), 64px height, sticky. Gold wordmark accent, uppercase nav links (12px, 0.12em spacing), gold active/hover underline. Gold CTA pill button, market status indicator with pulsing dot.

```jsx
<nav className="nl-nav">
  <a className="nl-nav-brand">
    <img src="/logo-icon.png" width="36" height="36" />
    <span className="nl-nav-wordmark">NewLeaf <em>Trading</em></span>
  </a>
  <ul className="nl-nav-links">
    <li><Link className="nl-nav-link active">Home</Link></li>
  </ul>
</nav>
```

#### Legacy Nav — `Navbar` (`src/trading/components/Navbar.jsx`)

Uses `.nav` classes from `app.css:97-236`. White background, sticky. SVG leaf logo, standard nav links, user avatar circle. Completely different visual treatment from AppHeader.

#### Bottom Nav — `BottomNav` (`src/trading/components/layout/BottomNav.jsx`)

Mobile-only bottom navigation using lucide-react icons. 5 items: Home, Discover, Portfolio, Performance, Learn. Icon size 20px, strokeWidth varies (2.5 active, 1.8 inactive).

#### Redesigned Top Nav (`.topnav`, `redesign.css:8-175`)

White bg, 54px height, hamburger menu on mobile. Includes voice button, market indicator, avatar. Mobile: slide-out drawer menu from right.

### Modals, Drawers, Popovers

#### Confirm Dialog (`newleaf-system.css:672-738`)

Fixed overlay with centered card. `rgba(0,0,0,0.5)` backdrop, white card, 16px radius, heavy shadow. Cancel (gray) and Confirm (danger red) buttons.

```css
.confirm-dialog {
  background: white;
  border-radius: var(--nl-radius-md);
  padding: 2rem;
  max-width: 400px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}
```

#### AI Chat Drawer (`src/trading/components/AIChatDrawer.jsx`)

Slide-in panel from right side. Styled inline. Contains suggestion chips (emoji + text), message list, text input with voice button. Body overflow hidden when open.

#### Onboarding Modal (`src/trading/components/OnboardingModal.jsx`)

Full-screen overlay for portfolio setup. Styled via `.onboarding-*` CSS classes. Contains capital input, risk profile cards (with emoji icons), goal selection grid.

#### Mobile Menu Drawer (`redesign.css:110-175`)

Fixed position, 280px wide, right-aligned. White background, slide animation (`translateX(100%→0)`). Contains user info header, nav links, sign out button. Overlay backdrop with `blur(2px)`.

### Toasts and Alerts

No dedicated toast/notification component exists. Error states are rendered inline:

```jsx
/* LoginPage.jsx:207-211 */
<div style={{
  border: '1px solid #dc2626',
  color: '#dc2626',
  /* ... */
}}>
  {error}
</div>
```

#### AI Analysis Card (`app.css:1909-1915`)

Used as an inline alert/callout:
```css
.ai-analysis-card {
  background: var(--leaf-50);
  border: 1px solid var(--leaf-200);
  border-left: 4px solid var(--leaf-600);
  border-radius: 0.75rem;
  padding: 1.5rem;
}
```

### Progress Indicators

#### Risk/Probability Bar (`ui.css:216-257`)

Horizontal track with animated fill. Track: 8px height, gray bg, pill radius, 1px border. Fill: strategy-coloured or semantic-coloured.

```css
.nl-risk-track {
  height: 8px;
  border-radius: var(--nl-radius-pill);
  background: rgba(17,24,39,0.08);
}
.nl-risk-fill {
  transition: width 0.3s ease;
}
```

#### Probability Bar — Portfolio Card (`newleaf-system.css:407-425`)

6px track height (thinner), strategy-themed gradient fills.

#### Gauge Bar (`newleaf-system.css:858-881`)

0.5rem (8px) track, `linear-gradient(90deg, #10b981, #34d399)` for normal, `#ef4444→#f87171` for high.

#### Ring Progress (`newleaf-system.css:514-541`)

84x84 circle, 3px border, inner ring via `::after` pseudo-element with partial border colouring. Used for "ready to activate" state.

#### Loading Spinner (`app.css:1401-1431`)

Emoji/icon rotated via CSS animation:
```css
.loading-spinner {
  font-size: 4rem;
  animation: spin 2s linear infinite;
}
```

#### Page Skeleton (`src/App.jsx:12-24`)

Inline div-based skeleton with green-tinted backgrounds:
```jsx
<div style={{ height: 12, width: 120, background: 'rgba(15,61,46,.06)', borderRadius: 4 }} />
<div style={{ height: 28, width: 320, background: 'rgba(15,61,46,.08)', borderRadius: 6 }} />
```

### Banner (`src/trading/components/ui/index.jsx:235-248`)

**Props:** `icon`, `title`, `description`, `badge`, `className`

```jsx
<Banner
  icon="🎯"
  title="Weekly Scan Complete"
  description="12 new strategies identified"
  badge="LIVE"
/>
```

Dark gradient background with gold radial accent. White text.

**CSS:** `.nl-banner` (`ui.css:530-580`)

### Charts and Data Viz

#### Libraries

| Library | Usage | Source Files |
|---------|-------|-------------|
| **Recharts** | PieChart, BarChart, LineChart, AreaChart, ComposedChart | `PortfolioPage.jsx`, `AdminPage.jsx`, `MonthlyPage.jsx`, `PositionDetail.jsx`, `PickAnalysisPage.jsx` |
| **Highcharts** | Payoff diagrams, price charts, gamma charts, strike heatmaps | `PayoffDiagramCard.jsx`, `PriceChart.jsx`, `GammaChart.jsx`, `StrikeHeatmap.jsx` |
| **Pure SVG** | P&L at-expiration chart | `PnLChart.jsx` |

#### P&L Chart (`src/trading/components/PnLChart.jsx`)

Pure SVG implementation. 800x320 dimensions. Profit area fill: green gradient, loss area: red gradient. Zero line reference. Custom tooltip on hover.

#### Chart Container (`newleaf-system.css:573-581`)

```css
.nl-chart-container {
  height: 320px;
  border-radius: var(--nl-radius-xl);
  border: 1px solid var(--nl-border);
  background: radial-gradient(900px 420px at 20% 0%, rgba(11,45,35,0.12), transparent 60%),
              linear-gradient(180deg, rgba(17,24,39,0.02), rgba(17,24,39,0.06));
}
```

### AI Analysis Cards (`src/trading/styles/ai-analysis-light.css`, `ai-enhanced-dark.css`)

The analysis page uses a separate card system (`.ai-card`) with its own design tokens:

```css
/* ai-analysis-light.css:28-35 */
.ai-card {
  background: var(--ai-surface);
  border: 1px solid var(--ai-border);
  border-radius: 14px;
  padding: 24px;
  box-shadow: var(--ai-shadow);
}
```

**Variants:**
- `.ai-warning-card` — Red-tinted left border (`ai-analysis-light.css:54-60`)
- `.ai-card-header` — Space Mono font, 11px, uppercase, green text (`ai-analysis-light.css:37-48`)

The dark theme version uses gradient backgrounds and gold-tinted borders (`ai-enhanced-dark.css:37-47`).

### Footer (`src/trading/components/Footer.jsx`)

Simple two-column layout: disclaimer text (left) + links (right). White bg, top border. Links: gray-400, hover: leaf-700.

**CSS:** `.footer` (`app.css:1320-1358`)

---

## Iconography

### Icon Library

**Primary:** `lucide-react` — used across all authenticated pages.

### Icons in Use

| Icon | From | Used In |
|------|------|---------|
| `Home`, `Compass`, `Briefcase`, `TrendingUp`, `BookOpen` | lucide-react | `BottomNav.jsx:2` |
| `ArrowRight`, `Bookmark` | lucide-react | `LotteryCard.jsx:1` |
| `ExternalLink`, `Bookmark` | lucide-react | `TechnicalCard.jsx:1`, `StrategyCard.jsx:1` |
| `BrainCircuit` | lucide-react | `AIInsightBar.jsx:2` |
| `Mic`, `MicOff`, `X`, `Volume2` | lucide-react | `VoiceAssistant.jsx:2` |
| `Trash2`, `Edit2` | lucide-react | `PortfolioPage.jsx:3` |
| `ArrowLeft`, `Bookmark`, `Copy`, `Share2`, `Brain`, `TrendingUp`, `Clock`, `Shield`, `AlertTriangle`, `Calendar`, `Zap`, `CheckCircle`, `Lightbulb` | lucide-react | `PositionDetail.jsx:4` |
| `Hammer` | lucide-react | `AnalysisPage.jsx:3` |
| `ArrowUp`, `ArrowDown` | lucide-react | `LiveTradeExampleCard.jsx:2` |

### Icon Sizes

| Size | Context |
|------|---------|
| `13×13` | Nav pill icon (`AppHeader.jsx:94`) |
| `14×14` | Nav voice button (`redesign.css:58`) |
| `20×20` (size prop) | Bottom nav icons (`BottomNav.jsx:28`) |
| `22×22` | Insight icon (`app.css:940-941`) |
| `24×24` | AI icon (`app.css:631-632`) |
| `26×26` | Topnav logo SVG (`redesign.css:25`) |
| `28×28` | Navbar leaf SVG (`Navbar.jsx:41`) |
| `36×36` | AppHeader logo (`AppHeader.jsx:59`) |
| `48×48` | Login page logo (`LoginPage.jsx:59`) |

### Emoji as Icons

Emoji characters are used extensively as decorative/functional icons:

| Emoji | Usage | Source |
|-------|-------|--------|
| `✦` | AI button indicator | `Navbar.jsx:81` |
| `🛡️` | Conservative risk profile | `OnboardingModal.jsx:25` |
| `⚖️` | Moderate risk profile | `OnboardingModal.jsx:30` |
| `🚀` | Aggressive risk profile | `OnboardingModal.jsx:35` |
| `💰` `📈` `📚` | Goal options | `OnboardingModal.jsx:46-49` |
| `📊` `🔧` `⚡` `🏆` | Chat suggestion chips | `AIChatDrawer.jsx:8-11` |
| `✓` | Checkmark in feature lists | `landing-v7.css:475` (CSS `content`) |
| `›` | Chevron in feature lists | `landing-v7.css:687` (CSS `content`) |

### Colour Treatment

Icons are generally **monochrome**, coloured via `color` / CSS `color` inheritance or explicit `stroke` props. Strategy-themed sections colour icons to match the strategy's primary colour (`app.css:1253-1258`).

---

## Motion

### Transitions

| Duration | Easing | Usage | Source |
|----------|--------|-------|--------|
| `0.08s ease` | Button press (transform, shadow, background) | `ui.css:594` |
| `0.12s` | Landing nav links, buttons | `landing-v7.css:113,124` |
| `0.13s` | Landing CTA gold | `landing-v7.css:794` |
| `0.15s ease` | NL buttons, filter reset, contract buttons, back button | `ui.css:64`, `newleaf-system.css:337,458` |
| `0.18s` | NL nav links/buttons, app card | `nl-nav.css:97,175`, `landing-v7.css:425` |
| `0.2s ease` | Most hover effects: nav links, toggles, selects, filters, bookmarks | `app.css:149,266,532,592,781` |
| `0.25s ease` | Client card hover | `app.css:731` |
| `0.3s ease` | Card hover (lottery, technical), portfolio card, risk fill | `global.css:59,66`, `newleaf-system.css:218,256` |
| `0.5s ease` | Risk bar fill width, probability bar fill | `app.css:693`, `newleaf-system.css:868` |
| `0.6s ease` | Prob fill width | `app.css:903` |

### Keyframe Animations

| Name | Duration | Easing | Behaviour | Source |
|------|----------|--------|-----------|--------|
| `fadeIn` | Implicit | — | `opacity 0→1`, `translateY 20px→0` | `global.css:37-46` |
| `spin` | `2s` | linear, infinite | `rotate(0→360deg)` | `global.css:48-55`, `app.css:1416-1423` |
| `pulse` | `2s` | cubic-bezier(0.4,0,0.6,1), infinite | `scale(1→1.5)`, `opacity(0.75→0)` | `app.css:193-202` |
| `nlPulse` | `2s` | infinite | `box-shadow` expansion `2px→6px` | `nl-nav.css:229-232` |
| `navPulse` | `2s` | infinite | `opacity 1→0.35→1` | `redesign.css:74` |
| `navVoiceShimmer` | `3s` | ease, infinite | `translateX(-100%→100%)` shimmer | `redesign.css:64` |
| `ticker` | `34s` | linear, infinite | `translateX(0→-50%)` marquee | `landing-v7.css:320-323` |
| `stage-in` | `0.8-0.9s` | ease-out, forwards | `opacity 0→1`, `translateY 18→0`, staggered delays | `landing-v7.css:696-704` |
| `grow-up` | `1-1.1s` | ease-out, both | `scaleY(0→1)` plant growth | `landing-v7.css:712-715` |
| `twinkle` | `4s` | ease-in-out, infinite | `opacity 1→0.2→1` | `landing-v7.css:738-741` |
| `glint` | `2.5s` | ease-in-out, infinite | `opacity+scale pulse (1→1.5)` | `landing-v7.css:744-751` |
| `seed-breathe` | `3s` | ease-in-out, infinite | `opacity 0.35→0.55`, radius change | `landing-v7.css:718-724` |
| `flow-cw` | `10s` | linear, infinite | `stroke-dashoffset` ring rotation | `landing-v7.css:272-275` |
| `dash-flow` | `1.8s` | linear, infinite | `stroke-dashoffset 14→0` arrow flow | `landing-v7.css:377-380` |
| `hub-glow` | `3s` | ease-in-out, infinite | `opacity 0.25→0.55` pulse | `landing-v7.css:280-283` |
| `ring-pulse` | `2.2s` | ease-out, infinite | SVG `r 10→20`, `opacity 0.4→0` | `landing-v7.css:754-758` |
| `slotPop` | — | — | Interactive pop effect | `redesign.css` |
| `orbFloat` | — | — | `scale(1→1.04)` + `rotate(0→3deg)` | `redesign.css` |
| `chatBounce` | — | — | Chat entry animation | `redesign.css` |
| `micPulse` | — | — | Mic button recording pulse | `redesign.css` |
| `listenWave` | — | — | Voice listening wave | `redesign.css` |
| `voiceFadeIn` | — | — | Voice assistant fade in | `app.css` |
| `voiceSlideUp` | — | — | Voice assistant slide up | `app.css` |
| `orbPulse` | — | — | Voice orb breathing | `app.css` |

### Hover Micro-interactions

| Effect | Target | Source |
|--------|--------|--------|
| `translateY(-2px)` | Strategy cards, lottery/technical cards, pro cards, app cards | `ui.css:99`, `global.css:63,69`, `app.css:1089` |
| `translateY(-3px)` | Stage cards (landing) | `landing-v7.css:619` |
| `translateY(-4px)` | Client cards | `app.css:737` |
| `translateY(-1px)` | CTA buttons, nav CTA | `nl-nav.css:182`, `redesign.css:55` |
| `translateY(1px)` | Button active (press down) | `ui.css:600` |
| `scale(1.1)` | Range slider thumb hover | `newleaf-system.css:1088` |
| `brightness(1.1)` | cc-cta hover | `app.css:993` |
| `brightness(1.18)` + `drop-shadow` | Landing diagram segments | `landing-v7.css:261-265` |
| `gap` expansion (8px→12px) | CTA arrows | `app.css:994` |
| `gap` expansion (5px→9px) | App card links | `landing-v7.css:489` |
| `filter: brightness(1.1)` + `gap: 12px` | Card CTA hover | `app.css:993-994` |
| `translateX(3px)` | CTA arrow SVG | `app.css:1001-1002` |
| `animation-play-state: paused` | Ticker strip on hover | `landing-v7.css:311` |

### Loading Patterns

1. **Full-page spinner**: Centered 4rem emoji + `spin` animation + light text (`app.css:1401-1431`)
2. **Page skeleton**: Inline divs with green-tinted backgrounds simulating content blocks (`App.jsx:12-24`)
3. **Component loading text**: Inline "Loading..." or "No data" messages
4. **Button loading**: `disabled` state with `loading` flag preventing double-submit

---

## Page Patterns

### Page Structure

**Authenticated pages** follow this structure:
```
AppHeader (nl-nav, 64px, sticky, dark green)
└── main content
    └── .nl-page (max-width 1280px, 22px top padding, 60px bottom)
        ├── .nl-page-header (title + subtitle + optional controls)
        └── page body (grids, cards, sections)
```

Alternative (redesign):
```
TopNav (topnav, 54px, sticky, white)
└── .page-body (max-width 1300px, 28px 32px padding)
```

**Landing page** follows:
```
nav (sticky, dark, glassmorphic)
└── .hero (dark gradient, grid: copy + diagram)
└── .strip (ticker marquee)
└── sections (80px vertical padding each)
└── .cta-box (dark gradient CTA)
└── footer
```

### Hero Sections

#### Strategy Hero (`ui.css:267-399`)
Dark gradient (`rgba(11,45,35,0.95)→0.88`) with gold radial accent. Large ticker (36px 900wt), strategy tag pill, stat tiles with primary variant in gold.

#### Landing Hero (`landing-v7.css:138-255`)
Multi-stop dark gradient with grid overlay. Two-column layout: copy (headline, sub, CTAs, metrics) + SVG diagram. Hero pill with pulsing dot. Clamp-sized headline (44-64px).

### Empty States (`app.css:1360-1399`)

```
.empty-state
├── .empty-icon (4rem emoji)
├── .empty-title (1.875rem, weight 300)
├── .empty-message (1.125rem, gray-400)
└── .empty-code (optional, leaf-50 bg code block)
```

Min-height: 60vh, centered.

Portfolio empty state: 6rem vertical padding, centered, with SVG illustration.

### Error States (`app.css:1553-1558`)

```
.detail-error
├── h2 (1.875rem, weight 700)
└── .btn-primary (back button)
```

Centered text, 4rem vertical padding. PnLChart has inline fallback: `padding: 40, textAlign: center, color: #94a3b8`.

### Loading States

1. **Full-page** (`app.css:1401-1431`): `min-height: 100vh`, white bg, centered spinner + text
2. **Skeleton** (`App.jsx:12-24`): Structural divs with `rgba(15,61,46,0.04-0.08)` backgrounds
3. **Suspense fallback**: `<PageSkeleton />` wrapper used for lazy-loaded routes

---

## Inconsistencies Flagged

1. **Font family triple-definition**: Three completely different font stacks are defined but only one set is loaded. `index.html` loads Playfair Display + Inter + Space Mono. `tailwind.config.js` references Instrument Sans + Fraunces + IBM Plex Mono (never loaded). `app.css :root` defines `--serif`=Playfair Display, `--sans`=Inter, `--mono`=Inter (not a monospace font). The Tailwind font families are unreachable.

2. **Leaf colour scale conflict**: CSS custom properties (`app.css:13-24`) define `--leaf-50` through `--leaf-900` as a custom forest green scale (e.g., `--leaf-600: #0B2D23`). `tailwind.config.js:10-20` defines a completely different `leaf` colour scale using standard Tailwind greens (e.g., `leaf-600: #16a34a`). Classes like `bg-leaf-600` resolve differently from `var(--leaf-600)`.

3. **Three page background colours**: `tokens.js` / `newleaf-system.css` use `#F7F8FA`. `landing-v7.css` / `index.html` use `#F7F4EE`. `app.css` body uses `var(--white)` = `#ffffff`. Three different backgrounds on the same site.

4. **Three semantic colour systems**: (a) `tokens.js`: success=`#0B7A52`, warn=`#B7791F`, danger=`#C94F4F`. (b) `app.css`: profit=`#059669`, loss=`#dc2626`, warn=`#d97706`. (c) `landing-v7.css`: ok=`#2d7d4f`. All represent "green=good, red=bad" with different hex values.

5. **Mono font variable points to non-mono font**: `--mono` in `app.css:78` is `'Inter', -apple-system, sans-serif` — a sans-serif font used for its `tabular-nums` feature, not actually monospace. `newleaf-system.css:238` uses `var(--mono, 'IBM Plex Mono', monospace)` as fallback, which would resolve to Inter.

6. **Multiple nav implementations**: At least 4 separate navigation components exist with different visual styles: (a) `Navbar.jsx` — white bg, SVG logo, gray links. (b) `AppHeader.jsx` — dark green bg, PNG logo, gold accents. (c) `TopNav` (redesign) — white bg, different layout, hamburger menu. (d) `LandingNav` — dark/glassmorphic. They use separate CSS class namespaces (`.nav-*`, `.nl-nav-*`, `.topnav-*`).

7. **16+ distinct button patterns**: Buttons are implemented as separate CSS classes with no shared base across the legacy (`app.css`) and NL system (`ui.css`) codebases. Examples: `.nl-btn-primary`, `.btn-primary` (app.css, different from landing `.btn-primary`), `.cc-cta`, `.pc-cta`, `.nl-nav-cta`, `.btn-cta-gold`, `.filter-chip`, `.action-btn`, etc. The `.btn-primary` class itself is defined differently in `app.css:1563` and `landing-v7.css:208`.

8. **Duplicate portfolio card class definitions**: `.pf-card-badge`, `.pf-status-select`, `.pf-card-added`, `.pf-added-label`, `.pf-stats-grid`, `.pf-stat`, `.pf-stat-label`, `.pf-stat-value`, `.pf-prob-track`, `.pf-prob-fill`, `.portfolio-card` are all defined in BOTH `newleaf-system.css` and `app.css` with different values (e.g., `.pf-stat` padding `0.625rem` vs `0.75rem`, `.pf-stat-label` colour `var(--nl-muted-text-2)` vs `var(--gray-500)`).

9. **Border radius divergence**: The NL token system's smallest radius is 14px (`--nl-radius-sm`), but extensive parts of the app use 4-12px radii (`0.25rem`, `0.375rem`, `0.5rem`, `0.75rem`). The token system radii appear designed for the NL cards but are not used by legacy components.

10. **Three shadow systems**: (a) NL tokens: `--nl-shadow-sm/md/lg/card`. (b) `app.css`: ad-hoc `rgba(0,0,0,…)` shadows. (c) Landing page: `--s1/--s2/--s3`. Each uses different base colours (`rgba(17,24,39,…)` vs `rgba(0,0,0,…)` vs `rgba(11,15,20,…)`).

11. **No shared Input component**: Text inputs are styled via inline styles in `LoginPage.jsx` and `OnboardingModal.jsx` with hardcoded hex values. Select elements use different CSS classes (`.filter-select`, `.pf-status-select`). No reusable `Input` component exists.

12. **No toast/notification system**: Error messages are rendered inline with hardcoded styles. No global toast, snackbar, or notification component exists.

13. **Inconsistent card radius values**: NL cards use `22px` (`--nl-radius-xl`). Client cards use `1rem` (16px). Pro cards use `0.75rem` (12px). Leg cards and metric cards use `0.5rem` (8px). Landing app cards use `18px` (`--r3`).

14. **Gold-400 and Gold-500 are identical**: Both `--gold-400` and `--gold-500` resolve to `#C9A96E` (`app.css:30-31`).

15. **leaf-600 and leaf-700 are identical**: Both `--leaf-600` and `--leaf-700` resolve to `#0B2D23` (`app.css:21-22`), which is also the brand primary colour.
