# Migration Plan: Merge newleaf-trading + newleaf-workbench into newleafsystem

## Context

Currently there are 3 separate repos:
- **newleafsystem** (`/Users/manish/dev/newleafsystem/`) — Firebase hosting + pipelines + scanner
- **newleaf-trading** (`/Users/manish/dev/OptionAdvisor/newleaf-trading/`) — React investor app (25 pages, 65 components)
- **newleaf-workbench** (`/Users/manish/dev/OptionAdvisor/newleaf-workbench/`) — React analyst tool (8 pages, 7 components)

Both React apps share the same Firebase project (`newleaf-trading`) and Firestore DB (`newleafdb`). The goal is **one React app, one build, one deploy** — all inside `newleafsystem`.

**What stays untouched:**
- `pipeline/` — weekly picks generation scripts
- `scanner/` — market data scanner + cron jobs
- `scripts/` — utility scripts
- `dist/quant/`, `dist/desk/` — existing pre-built apps (left as-is)

**What gets migrated into React (no longer standalone HTML):**
- `dist/picks/recap/index.html` → React `RecapPage` component
- `dist/picks/index.html` → React `PicksPage` component
- `dist/picks/monthly/index.html` → React `MonthlyPage` component
- `dist/picks/week-viewer.html` → React `WeekViewerPage` component
- Navigation → shared `Nav` component used across all sections

**Pipeline changes:**
- `pipeline/create-weekly-picks.js` — stops generating static HTML, only writes Firestore data
- R2 report uploads — unchanged (React analysis pages fetch from R2 via `/r2/` proxy)

---

## Picks Data Flow (Post-Migration)

```
WEEKLY PIPELINE (unchanged)                    REACT APP (new)
┌───────────────────────────┐                  ┌──────────────────────────┐
│ create-weekly-picks.js    │                  │ /picks/                  │
│  1. Read tiles from       │    Firestore     │   PicksPage.jsx          │
│     Firestore             │──→ weeklyPicks/ ←──  reads current week     │
│  2. Write weeklyPicks/    │    collection    │                          │
│     {weekId} document     │                  │ /picks/:weekId           │
│  3. NO HTML generation    │                  │   WeekViewerPage.jsx     │
│                           │                  │   reads any week by ID   │
├───────────────────────────┤                  │                          │
│ close-week.js             │                  │ /picks/recap             │
│  1. Calculate P&L         │──→ pick_outcomes ←──  RecapPage.jsx         │
│  2. Write pick_outcomes   │    collection    │   reads all outcomes     │
│  3. NO HTML generation    │                  │                          │
├───────────────────────────┤                  │ /picks/monthly           │
│ generate-analysis-pages   │                  │   MonthlyPage.jsx        │
│  1. Fetch R2 report data  │──→ R2 bucket  ←──   reads pick_outcomes +  │
│  2. NO HTML generation    │    (reports/)    │   R2 data via /r2/ proxy │
├───────────────────────────┤                  └──────────────────────────┘
│ update-pick-outcomes.js   │
│  1. Fetch closing prices  │──→ pick_outcomes
│  2. Classify WIN/LOSS     │    (updates)
│  3. Runs daily via cron   │
└───────────────────────────┘

Data sources:
  Firestore weeklyPicks/{weekId}  →  picks, theme, dateRange, tileIds, status
  Firestore pick_outcomes         →  ticker, strategy, P&L, outcome, legs
  Firestore tiles                 →  live tile data (scores, strategies)
  R2 reports/{SYMBOL}/latest.json →  gamma, technical analysis data
```

**Key point:** No new HTML pages are created each week. The pipeline writes data to Firestore, and the React pages read it dynamically. Adding picks for a new week is just running `node pipeline/create-weekly-picks.js` — the React app picks it up automatically.

---

## Target Architecture

### Source Structure

```
newleafsystem/
├── src/
│   ├── main.jsx                        # Single entry point
│   ├── App.jsx                         # Unified router (trading + workbench)
│   ├── firebase/
│   │   ├── config.js                   # Shared Firebase init (SDK 12.9)
│   │   └── index.js                    # Barrel export
│   ├── shared/
│   │   ├── components/
│   │   │   └── Nav.jsx                 # Shared navigation (replaces AppHeader + SystemNav)
│   │   └── hooks/
│   │       └── useAuth.js              # Trading's useAuth (Google + email/password)
│   ├── trading/                        # ── Investor App ──────────────────
│   │   ├── TradingLayout.jsx           # AppHeader + Footer + PriceProvider
│   │   ├── TradingPublicRoutes.jsx     # Strategy skill pages (no auth)
│   │   ├── components/                 # 65 components
│   │   ├── pages/                      # 25 pages
│   │   ├── hooks/                      # 9 hooks (minus useAuth → shared)
│   │   ├── utils/                      # 9 utility modules
│   │   ├── api/                        # 2 API modules
│   │   ├── contexts/                   # PriceContext
│   │   └── styles/                     # 10 CSS files (Tailwind + custom)
│   ├── picks/                          # ── Picks Pages (migrated from static HTML) ──
│   │   ├── PicksPage.jsx              # /picks — current week picks
│   │   ├── RecapPage.jsx              # /picks/recap — weekly performance recap
│   │   ├── MonthlyPage.jsx            # /picks/monthly — monthly ledger + heatmap
│   │   └── WeekViewerPage.jsx         # /picks/:weekId — dynamic week viewer
│   └── workbench/                      # ── Analyst Tool ──────────────────
│       ├── WorkbenchLayout.jsx         # Sidebar + TopBar (uses shared Nav)
│       ├── components/                 # 7 components
│       ├── pages/                      # 8 pages
│       ├── hooks/                      # 4 hooks
│       ├── utils/                      # 3 utility modules
│       ├── api/                        # 7 API modules
│       └── styles/                     # 2 CSS files (scoped under .wb-root)
├── index.html                          # Vite SPA shell
├── vite.config.js                      # emptyOutDir: false (protects dist/picks/)
├── tailwind.config.js
├── postcss.config.js
├── .env                                # VITE_API_BASE_URL, VITE_ADMIN_EMAILS
├── package.json                        # All deps merged
├── firebase.json                       # Updated rewrites
├── server.cjs                          # Updated with SPA fallback + API proxy
├── pipeline/                           # Unchanged
├── scanner/                            # Unchanged
├── scripts/                            # + clean-spa.js build helper
└── dist/                               # Build output
    ├── index.html                      # Vite SPA (replaces old static landing)
    ├── assets/                         # Vite JS/CSS bundles
    ├── picks/                          # Pipeline-generated (PRESERVED)
    ├── quant/                          # Existing pre-built (UNTOUCHED)
    └── desk/                           # Existing pre-built (UNTOUCHED)
```

### Route Map

```
ROUTE                                    PAGE                    ACCESS
─────────────────────────────────────────────────────────────────────────
/                                        → Redirect to /trading  Public
                                         
/trading/                                LandingPage (unauth)    Public
                                         Dashboard (auth)        Auth
/trading/discover                        DiscoverPage            Auth
/trading/portfolio                       PortfolioPage           Auth
/trading/performance                     PerformancePage         Auth
/trading/analysis                        AnalysisPage            Auth
/trading/analysis/:ticker                AnalysisPage            Auth
/trading/position/:tileId                PositionDetail          Auth
/trading/learn                           LearnPage               Auth
/trading/admin                           AdminPage               Auth
/trading/strategies/iron-condor          IronCondorSkill         Public
/trading/strategies/double-diagonal      DoubleDiagonalSkill     Public
/trading/strategies/bull-put-spread      BullPutSpreadSkill      Public
/trading/strategies/bear-put-spread      BearPutSpreadSkill      Public
/trading/strategies/covered-call         CoveredCallSkill        Public
/trading/strategies/calendar-spread      CalendarSpreadSkill     Public
/trading/strategies/straddle-strangle    StraddleStrangleSkill   Public
/trading/strategies/butterfly            ButterflySkill          Public
/trading/strategies/collar               CollarSkill             Public
/trading/strategies/jade-lizard          JadeLizardSkill         Public

/picks/                                  PicksPage               Public
/picks/recap                             RecapPage               Public
/picks/monthly                           MonthlyPage             Public
/picks/:weekId                           WeekViewerPage          Public

/workbench/                              ScannerPage             Admin
/workbench/analysis                      WB AnalysisPage         Admin
/workbench/analysis/:ticker              WB AnalysisPage         Admin
/workbench/tiles                         TilesPage               Admin
/workbench/trade-builder                 TradeBuilderPage        Admin
/workbench/trade-builder/:ticker         TradeBuilderPage        Admin
/workbench/bulk-scan                     BulkScanPage            Admin
/workbench/updater                       UpdaterPage             Admin
/workbench/settings                      SettingsPage            Admin
/workbench/tools/ib-price-tester         IBPriceTesterPage       Admin

/picks/*                                 Pipeline-generated      Public
/quant/*                                 Existing pre-built      Auth
/desk/*                                  Existing pre-built      Auth
```

### Shared Nav Component

One `src/shared/components/Nav.jsx` replaces both `AppHeader` (trading) and `SystemNav` (workbench):
- Brand logo + "NewLeaf System" wordmark
- Section links: **Trading** | **Picks** | **Workbench** (Workbench visible only to admins)
- Active section highlighted based on current route prefix (`/trading`, `/picks`, `/workbench`)
- Auth state: Sign In button or user avatar + sign out
- Responsive (hamburger on mobile)

### Layout Architecture

```
┌─────────────────────────────────────────────────────────┐
│ BrowserRouter (no basename)                              │
│                                                          │
│  /trading/strategies/* ─→ No wrapper (public pages)      │
│                                                          │
│  /trading/* ─→ TradingLayout                             │
│    ┌──────────────────────────────────────┐              │
│    │ SharedNav (active: Trading)          │              │
│    │ ┌──────────────────────────────────┐ │              │
│    │ │ PriceProvider                    │ │              │
│    │ │   <Outlet /> (page content)      │ │              │
│    │ └──────────────────────────────────┘ │              │
│    │ Footer                               │              │
│    │ VoiceAssistant + AIChatDrawer        │              │
│    └──────────────────────────────────────┘              │
│                                                          │
│  /picks/* ─→ PicksLayout (public)                        │
│    ┌──────────────────────────────────────┐              │
│    │ SharedNav (active: Picks)            │              │
│    │ ┌──────────────────────────────────┐ │              │
│    │ │ <Outlet /> (page content)        │ │              │
│    │ └──────────────────────────────────┘ │              │
│    │ Footer                               │              │
│    └──────────────────────────────────────┘              │
│                                                          │
│  /workbench/* ─→ WorkbenchLayout (admin-gated)           │
│    ┌──────────────────────────────────────┐              │
│    │ SharedNav (active: Workbench)        │              │
│    │ ┌────────┬───────────────────────┐   │              │
│    │ │Sidebar │ TopBar                │   │              │
│    │ │        │ ┌───────────────────┐ │   │              │
│    │ │        │ │ <Outlet />        │ │   │              │
│    │ │        │ │ (page content)    │ │   │              │
│    │ │        │ └───────────────────┘ │   │              │
│    │ └────────┴───────────────────────┘   │              │
│    └──────────────────────────────────────┘              │
└─────────────────────────────────────────────────────────┘
```

### Auth Model

| Layer | Unauthenticated | Authenticated | Admin |
|-------|----------------|---------------|-------|
| `/trading/strategies/*` | Shows page | Shows page | Shows page |
| `/trading/*` | Shows LandingPage | Shows app | Shows app |
| `/picks/*` | Shows page | Shows page | Shows page |
| `/workbench/*` | Shows login screen | Shows "Access Denied" | Shows workbench |

- **Shared `useAuth` hook** (from trading) handles Firebase Auth state
- **Admin check**: `VITE_ADMIN_EMAILS` env var, checked in WorkbenchLayout
- Current admin emails: `manishsaraan@gmail.com`, `manish28june@gmail.com`

---

## Implementation Steps

### Step 1: Scaffold Build System

**Files to create/modify:**

| File | Action | Purpose |
|------|--------|---------|
| `package.json` | Modify | Add React, Vite, Tailwind, Firebase 12.9, and all deps |
| `vite.config.js` | Create | Vite config with `emptyOutDir: false`, path aliases, dev proxies |
| `tailwind.config.js` | Create | Copy from trading app |
| `postcss.config.js` | Create | Copy from trading app |
| `index.html` | Create | Vite SPA shell at project root |
| `.env` | Create | `VITE_API_BASE_URL=`, `VITE_ADMIN_EMAILS=...` |
| `scripts/clean-spa.js` | Create | Pre-build: removes old `dist/trading/`, `dist/workbench/`, `dist/assets/` |

**Merged dependencies:**
```
Production:
  firebase-admin ^12.0.0  (existing — for pipeline/server)
  axios          ^1.13.6
  firebase       ^12.9.0  (trading version, replaces workbench's 10.8)
  lucide-react   ^0.564.0
  react          ^18.3.1
  react-dom      ^18.3.1
  react-router-dom ^6.30.3
  recharts       ^2.15.4

Dev:
  @tailwindcss/postcss ^4.1.18
  @vitejs/plugin-react ^4.2.1
  autoprefixer   ^10.4.24
  postcss        ^8.5.6
  tailwindcss    ^4.1.18
  vite           ^5.1.0
```

**Vite config highlights:**
- `build.emptyOutDir: false` — protects `dist/picks/`, `dist/quant/`, `dist/desk/`
- `server.proxy`: `/api` → `:4000`, `/health` → `:4000` (for workbench)
- Path aliases: `@trading`, `@workbench`, `@shared`

---

### Step 2: Copy Source Files

**From newleaf-trading (`/Users/manish/dev/OptionAdvisor/newleaf-trading/src/`):**
```
src/components/   →  src/trading/components/
src/pages/        →  src/trading/pages/
src/hooks/        →  src/trading/hooks/        (minus useAuth.js)
src/utils/        →  src/trading/utils/
src/api/          →  src/trading/api/
src/contexts/     →  src/trading/contexts/
src/styles/       →  src/trading/styles/
src/firebase/     →  src/firebase/             (SHARED, not under trading/)
src/hooks/useAuth.js → src/shared/hooks/useAuth.js
```

**From newleaf-workbench (`/Users/manish/dev/OptionAdvisor/newleaf-workbench/src/`):**
```
src/components/   →  src/workbench/components/
src/pages/        →  src/workbench/pages/
src/hooks/        →  src/workbench/hooks/
src/utils/        →  src/workbench/utils/
src/api/          →  src/workbench/api/
src/styles/       →  src/workbench/styles/
```

**NOT copied** (replaced by new shared files):
- Trading: `src/main.jsx`, `src/App.jsx`
- Workbench: `src/main.jsx`, `src/App.jsx`, `src/firebase.js`

---

### Step 3: Fix Import Paths (~30 files)

| Import pattern (old) | New path | Affected files |
|----------------------|----------|---------------|
| `../firebase/config` | `../../firebase/config` | Trading hooks, contexts, pages |
| `../firebase` | `../../firebase/config` | Workbench hooks, pages |
| `../hooks/useAuth` | `../../shared/hooks/useAuth` | Trading components/pages |
| `import.meta.env.VITE_API_URL` | `import.meta.env.VITE_API_BASE_URL` | Workbench API modules |

Also fix hardcoded API URLs:
- `trading/api/analysisApi.js`: `http://localhost:4000` → `import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000'`
- `trading/api/tilesApi.js`: same fix

---

### Step 4: Create Entry Points

**`src/main.jsx`** — Single entry point
- Renders `<BrowserRouter><App /></BrowserRouter>`
- Imports all CSS files from both apps

**`src/App.jsx`** — Unified router
```jsx
<Routes>
  <Route path="/" element={<Navigate to="/trading" />} />
  
  {/* Public strategy pages — no auth, no layout */}
  <Route path="/trading/strategies/*" element={<TradingPublicRoutes />} />
  
  {/* Trading app — auth-gated with TradingLayout */}
  <Route path="/trading/*" element={<TradingLayout />}>
    <Route index element={<DashboardPage />} />
    <Route path="discover" element={<DiscoverPage />} />
    <Route path="portfolio" element={<PortfolioPage />} />
    <Route path="performance" element={<PerformancePage />} />
    <Route path="analysis" element={<AnalysisPage />} />
    <Route path="analysis/:ticker" element={<AnalysisPage />} />
    <Route path="position/:tileId" element={<PositionDetail />} />
    <Route path="learn" element={<LearnPage />} />
    <Route path="admin" element={<AdminPage />} />
  </Route>
  
  {/* Picks — public with PicksLayout */}
  <Route path="/picks/*" element={<PicksLayout />}>
    <Route index element={<PicksPage />} />
    <Route path="recap" element={<RecapPage />} />
    <Route path="monthly" element={<MonthlyPage />} />
    <Route path=":weekId" element={<WeekViewerPage />} />
  </Route>
  
  {/* Workbench — admin-gated with WorkbenchLayout */}
  <Route path="/workbench/*" element={<WorkbenchLayout />}>
    <Route index element={<ScannerPage />} />
    <Route path="analysis" element={<WBAnalysisPage />} />
    <Route path="analysis/:ticker" element={<WBAnalysisPage />} />
    <Route path="tiles" element={<TilesPage />} />
    <Route path="trade-builder" element={<TradeBuilderPage />} />
    <Route path="trade-builder/:ticker" element={<TradeBuilderPage />} />
    <Route path="bulk-scan" element={<BulkScanPage />} />
    <Route path="updater" element={<UpdaterPage />} />
    <Route path="settings" element={<SettingsPage />} />
    <Route path="tools/ib-price-tester" element={<IBPriceTesterPage />} />
  </Route>
</Routes>
```

**`src/shared/components/Nav.jsx`** — Shared navigation bar
- Used by all three layouts (trading, picks, workbench)
- Shows: brand, section links (Trading/Picks/Workbench), auth state
- Workbench link only visible to admin users

**`src/trading/TradingLayout.jsx`** — Extracted from trading App.jsx
- Auth check → shows LandingPage if not logged in
- Renders: SharedNav + PriceProvider + `<Outlet />` + Footer + VoiceAssistant + AIChatDrawer

**`src/picks/PicksLayout.jsx`** — New layout for picks pages
- Public (no auth required)
- Renders: SharedNav + `<Outlet />` + Footer

**`src/workbench/WorkbenchLayout.jsx`** — Extracted from workbench App.jsx
- Auth check → LoginScreen if not logged in, DeniedScreen if not admin
- Renders: `<div className="wb-root">` + SharedNav + Sidebar + TopBar + `<Outlet />`

---

### Step 5: Fix CSS Scoping

**Problem:** Workbench CSS has global `body { ... }` and `* { margin:0 }` resets that would conflict with trading styles.

**Solution:** Scope workbench CSS under `.wb-root` class:

| File | Change |
|------|--------|
| `src/workbench/styles/app.css` | `body { ... }` → `.wb-root { ... }` |
| `src/workbench/styles/app.css` | Remove `* { margin:0; padding:0 }` (Tailwind handles this) |
| `src/workbench/styles/system-nav-patch.css` | Remove `body`/`#root` overrides |
| `src/workbench/WorkbenchLayout.jsx` | Wrap outermost div with `className="wb-root"` |

---

### Step 6: Fix Link/Navigate Paths (~40 updates)

**Trading app — prefix all internal routes with `/trading`:**
```
<Link to="/">           →  <Link to="/trading">
<Link to="/discover">   →  <Link to="/trading/discover">
<Link to="/portfolio">  →  <Link to="/trading/portfolio">
navigate('/')           →  navigate('/trading')
navigate('/analysis/X') →  navigate('/trading/analysis/X')
```

**Workbench app — prefix all internal routes with `/workbench`:**
```
<Link to="/">            →  <Link to="/workbench">
<Link to="/analysis">    →  <Link to="/workbench/analysis">
<Link to="/tiles">       →  <Link to="/workbench/tiles">
navigate('/analysis/X')  →  navigate('/workbench/analysis/X')
```

**Cross-app links (in nav bars):**
```
AppHeader:    <a href="/workbench/">  →  <Link to="/workbench">
SystemNav:    external https://newleaf-trading.web.app  →  <Link to="/trading">
```

---

### Step 7: Update Hosting Config

**firebase.json — updated rewrites:**
```json
{
  "rewrites": [
    { "source": "/trading/**", "destination": "/index.html" },
    { "source": "/picks/**", "destination": "/index.html" },
    { "source": "/workbench/**", "destination": "/index.html" },
    { "source": "/quant/**", "destination": "/quant/index.html" },
    { "source": "/desk/**", "destination": "/desk/index.html" },
    { "source": "**", "destination": "/index.html" }
  ]
}
```

Note: `/picks/20**-W**` rewrite to `week-viewer.html` is removed — React Router handles all `/picks/*` routes now.

**server.cjs — add SPA fallback + API proxy:**
```js
// Before static file serving, add:

// SPA fallback for React Router paths
const SPA_PREFIXES = ['/trading/', '/workbench/', '/picks/'];
if (SPA_PREFIXES.some(p => url.pathname.startsWith(p))) {
  const candidate = path.join(DIST, url.pathname);
  // Only serve SPA if no static file exists at this path
  if (!fs.existsSync(candidate) || fs.statSync(candidate).isDirectory()) {
    const spaIndex = path.join(DIST, 'index.html');
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(fs.readFileSync(spaIndex));
    return;
  }
}

// API proxy to api-gateway (for workbench)
if (url.pathname.startsWith('/api/') || url.pathname === '/health') {
  // proxy to localhost:4000
}
```

---

### Step 8: Simplify Pipeline Scripts

The pipeline scripts stop generating HTML — they only write data to Firestore.

**`pipeline/create-weekly-picks.js`:**
- Remove `generatePicksHTML()`, `generateWeekPageHTML()`, `picksPageShell()`, `pickCardHTML()`
- Remove all `writeFileSync` calls that write to `dist/picks/`
- Keep: Firestore reads (tiles), Firestore writes (weeklyPicks/{weekId}), PDF/video generation
- The script becomes: read tiles → write weeklyPicks document → done

**`pipeline/close-week.js`:**
- Remove `generateReviewHTML()` and its `writeFileSync` to `dist/picks/review/`
- Keep: Firestore reads (weeklyPicks), P&L calculation, Firestore writes (pick_outcomes, weeklyPicks update)

**`pipeline/generate-analysis-pages.js`:**
- Remove HTML generation to `dist/picks/analysis/{SYMBOL}/`
- Keep: R2 report data fetching (React analysis pages will read from R2 directly)
- OR: convert to just uploading analysis data to Firestore/R2 for React to consume

**`package.json` scripts — update:**
```json
"picks:create": "node pipeline/create-weekly-picks.js",    // unchanged command
"picks:close": "node pipeline/close-week.js",              // unchanged command
"picks:preview": "node pipeline/create-weekly-picks.js --dry-run"
```
No script changes needed — the pipeline commands stay the same, just the scripts do less (no HTML output).

**Delete old static picks files after migration:**
- `dist/picks/index.html`
- `dist/picks/recap/index.html`
- `dist/picks/monthly/index.html`
- `dist/picks/week-viewer.html`
- `dist/picks/review/` (if exists)
- `dist/picks/2026-W*/` (week archive pages — React handles these now)
- Keep `dist/picks/analysis/` temporarily until React analysis pages are ready

---

### Step 9: Test & Cleanup

**Verification checklist:**
- [ ] `npm run dev` → `/trading/` shows landing page
- [ ] `npm run dev` → sign in → dashboard loads, all nav links work
- [ ] `npm run dev` → `/workbench/` shows login screen
- [ ] `npm run dev` → admin sign in → scanner loads, sidebar links work
- [ ] `npm run dev` → `/trading/strategies/iron-condor` loads without auth
- [ ] `npm run dev` → `/picks/` shows current week picks from Firestore
- [ ] `npm run dev` → `/picks/recap` shows performance recap from Firestore
- [ ] `npm run dev` → `/picks/2026-W16` shows week archive from Firestore
- [ ] `npm run build` → `dist/index.html` exists
- [ ] `npm run build` → `dist/assets/` has JS/CSS bundles
- [ ] `npm run build` → `dist/quant/` is UNTOUCHED
- [ ] `node server.cjs` → `localhost:3000/trading/` works
- [ ] `node server.cjs` → `localhost:3000/workbench/` works
- [ ] `node server.cjs` → `localhost:3000/picks/` works
- [ ] `node pipeline/create-weekly-picks.js --dry-run` → still works (no HTML output)
- [ ] `firebase deploy` → production routing verified
- [ ] Shared Nav appears on all sections with correct active state

**Cleanup:**
- Update `.gitignore`: add `dist/assets/`, `.env`, `dist-backup/`
- Remove old `dist/trading/` and `dist/workbench/` directories
- Remove old `dist/picks/` static HTML files (React handles these now)
- Backup old static `dist/index.html` (replaced by Vite SPA shell)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| CSS bleed between apps | Visual glitches | `.wb-root` scoping; only one layout renders at a time |
| `dist/picks/` accidentally deleted | Picks pages gone | `emptyOutDir: false` in Vite + `clean-spa.js` only deletes known dirs |
| Firebase SDK 10.8 → 12.9 | Workbench breaks | Low risk — only stable APIs used (Firestore, Auth). Same import paths. |
| Workbench API calls fail | Scanner broken | Vite dev proxy + server.cjs proxy both forward to `:4000` |
| Component name conflicts | Build errors | Resolved by `src/trading/` and `src/workbench/` directory separation |

---

## File Counts

| Category | Files | Notes |
|----------|-------|-------|
| Copy from trading | ~96 | components(65) + pages(25) + hooks(9) + utils(9) + api(2) + contexts(1) + styles(10) - duplicates |
| Copy from workbench | ~31 | components(7) + pages(8) + hooks(4) + utils(3) + api(7) + styles(2) |
| New files to create | ~12 | main.jsx, App.jsx, firebase/*, shared/*, layouts, configs, build helper |
| Files to modify (imports) | ~30 | Firebase/auth import path updates |
| Files to modify (links) | ~40 | Route prefix updates |
| Existing files to modify | 3 | package.json, firebase.json, server.cjs |

**Total: ~127 source files copied, ~12 new files, ~70 files modified for imports/links, 3 existing files updated.**
