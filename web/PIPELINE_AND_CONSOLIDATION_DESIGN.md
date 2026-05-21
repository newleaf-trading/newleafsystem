# NewLeaf System — Pipeline & Consolidation Design Document

## Table of Contents
1. [Current Architecture Overview](#1-current-architecture-overview)
2. [Pipeline Deep Dive](#2-pipeline-deep-dive)
3. [Publishing Flow](#3-publishing-flow)
4. [Firebase Usage](#4-firebase-usage)
5. [Email System](#5-email-system)
6. [Data Flow Diagram](#6-data-flow-diagram)
7. [Consolidation Analysis — Single App](#7-consolidation-analysis--single-app)
8. [Recommended Architecture](#8-recommended-architecture)
9. [Migration Roadmap](#9-migration-roadmap)

---

## 1. Current Architecture Overview

The system is currently split across **5 separate runtime contexts**:

| Component | Runtime | Location | Trigger |
|-----------|---------|----------|---------|
| React SPA (frontend) | Vite / Browser | `src/` | User visits site |
| Dev Server | Node.js | `server.cjs` | Manual (`node server.cjs`) |
| Scanner Pipelines | Node.js | `scanner/` | Cron (every 15 min + daily) |
| Publish Pipeline | Node.js + Python | `pipeline/` | Manual CLI (`npm run publish`) |
| Email Sender | Node.js | `pipeline/send-weekly-email.js` | Manual / Cron (weekly) |

**External dependencies:**
- Alpaca API — live stock + option data, Greeks
- Yahoo Finance Service — option expirations, open interest (runs on localhost:5300)
- Claude CLI — AI analysis generation
- Grok/xAI API — social sentiment
- Google Gemini API — news sentiment
- Reddit/StockTwits — retail sentiment
- Cloudflare R2 — report storage CDN
- Firebase (Firestore + Auth + Hosting) — database, auth, deployment
- Gmail SMTP — email delivery

---

## 2. Pipeline Deep Dive

### 2.1 Scanner Pipelines (Data Collection)

Three pipelines run on different schedules:

#### Fast Pipeline (every 15 min, market hours)
- **File:** `scanner/pipeline-fast.js` → calls `newleaf-pipeline.js --intraday`
- **Sources:** Alpaca only (no Yahoo, no OI)
- **Speed:** ~22 seconds for 108 symbols, 5 parallel workers
- **Outputs:** `reports/{symbol}/latest.json` → R2 bucket
- **Limitation:** No open interest data; gamma walls use volume proxy

#### Daily Pipeline (9:32am ET, Mon-Fri)
- **Orchestrator:** `scanner/run-daily-catchup.sh` (uses marker files for resilience)
- **Step 1 — OI Enrichment** (`pipeline-oi-enrichment.js`): Fetches Yahoo for all expirations, calculates OI per strike, identifies gamma walls, merges with Alpaca data
- **Step 2 — Watchlist** (`pipeline-watchlist.js`): Full option chains for 145 symbols → R2
- **Step 3 — R2→Firestore Sync** (`sync-r2-to-firestore-fixed.mjs`): Syncs `latest.json` → Firestore `gamma_analysis` collection

#### Cron Schedule (all times ET, Mon-Fri)
```
9:00am-4:00pm   every 15 min    Fast pipeline (Alpaca snapshots)
9:30am-4:00pm   every 15 min    Daily catch-up check
9:32am          once/day        OI enrichment + watchlist
6:00pm          once/day        Pick outcomes update
6:00pm Sunday   once/week       Weekly email send
every 5 min     continuous      Health check
```

### 2.2 Key Scanner Functions (`newleaf-pipeline.js`)
- `getStockSnapshot()` — Alpaca latest trade/quote/bar
- `getStockBars()` — 250 days historical OHLC
- `getAlpacaChain()` — Option snapshots with Greeks
- `getYahooExpiries()` — All expiration dates
- `getYahooOIMap()` — Open interest per strike per expiry
- `analyzeGammaEnhanced()` — Identifies gamma walls, top strikes, confidence
- `saveATMContracts()` — ATM contracts for strategy builder

### 2.3 Sentiment Engine (`scanner/sentiment-engine.js`)
4-engine weighted system:

| Engine | Weight | Source | Method |
|--------|--------|--------|--------|
| Claude | 30% | Financial news, analyst reports | CLI with web search |
| Grok/xAI | 25% | X/Twitter social sentiment | API (`grok-3-mini`) |
| Gemini | 25% | Google News, sector trends | Google AI API |
| Reddit | 20% | WSB, StockTwits retail mood | Scraping/aggregation |

- Output: score (0-100), label (bullish/neutral/bearish), confidence, keyDrivers, materialEvents
- Cache: 6 hours per symbol in `scanner/reports/{SYMBOL}/sentiment.json`
- Skips engines with missing API keys (redistributes weight)

---

## 3. Publishing Flow

### 3.1 Publish a Pick (`pipeline/publish-pick.cjs`)

**Command:** `npm run publish -- NVDA --strategy "iron condor" --expiry 2026-04-25 [--dry-run] [--pdf]`

**10-step workflow:**

```
1. Fetch live spot price         ← Alpaca snapshot API
2. Fetch live option chain       ← Alpaca options API (100+ contracts)
3. Fetch gamma wall context      ← R2 (latest.json)
4. Auto-select strikes           ← Strategy-specific logic
   - Short put ~90% spot (7% OTM)
   - Short call ~110% spot (7% OTM)
   - Long wings at defined distances
5. Build legs                    ← Net credit, max P/L, Greeks, PoP
6. Create tile in Firestore      → tiles/{tileId}
7. Run Claude analysis (30-60s)  ← CLI with tile data as prompt
   Output: strategyRationale, technicalIndicators, thetaDecaySchedule, riskAnalysis
8. Save enriched-pick.json       → pipeline/output/{weekId}/enriched/{slug}.json
9. Generate PDF (optional)       → WeasyPrint (Python)
10. Add to weeklyPicks           → Firestore weeklyPicks/{weekId}
```

**Supported strategies:** Iron Condor, Iron Butterfly, Bull Put Spread, Bear Call Spread

### 3.2 Weekly Picks Lifecycle

```
publish-pick.cjs     → Creates tiles + analyses in Firestore
create-weekly-picks.js → Bundles tiles into weeklyPicks/{weekId} document
                         (npm run picks:preview)
generate-outputs.js   → Generates PDF reports + archives
                         (npm run outputs)
close-week.js         → Calculates actual P&L, writes pick_outcomes
                         (npm run picks:close)
```

### 3.3 Report Generation (Python)

```
pipeline/build-enriched-report-data.py
  → Flattens enriched-pick.json into 300+ template placeholders

pipeline/generate-report.py
  → Loads JSON + HTML template (report-v3.html)
  → Fills {{PLACEHOLDERS}}
  → Renders PDF via WeasyPrint
  → Output: pipeline/output/reports/{SYMBOL}-Iron-Condor-{TIMESTAMP}.pdf
```

---

## 4. Firebase Usage

### 4.1 Configuration
- **Project:** `newleaf-trading`
- **Database:** `newleafdb` (named Firestore database)
- **Auth:** Google Sign-In via `GoogleAuthProvider`
- **Hosting:** `newleafsystem.com` → serves `dist/`

### 4.2 Firestore Collections

| Collection | Doc ID | Purpose |
|-----------|--------|---------|
| `tiles` | UUID | Published trade positions (symbol, strategy, legs, Greeks, gamma, sentiment) |
| `analyses` | Same as tile | Claude deep analysis (rationale, technicals, risk, theta schedule) |
| `weeklyPicks` | `2026-W17` | Weekly bundles of selected picks (tileIds, theme, dateRange) |
| `pick_outcomes` | auto | Closed picks with actual P&L (WIN/LOSS/PARTIAL) |
| `gamma_analysis` | symbol | Real-time gamma wall data (synced from R2) |
| `users` | Firebase UID | Subscribers (email, preferences) |

### 4.3 Hosting Config (`firebase.json`)
- Public dir: `dist`
- SPA rewrites: all dynamic routes → `/index.html`
- Cache: images/fonts (1 week immutable), JS/CSS (1 hour), HTML (no-cache)

### 4.4 Deploy Command
```bash
npm run deploy   # = npm run build && firebase deploy
```

---

## 5. Email System

### 5.1 Setup
- **File:** `pipeline/send-weekly-email.js`
- **Transport:** Nodemailer → Gmail SMTP (port 587)
- **From:** `NewLeaf Invest <marketing@newleafsystem.com>`
- **Credentials:** App password in `scanner/config.json`

### 5.2 Workflow
1. Fetch active tiles from Firestore (`tiles` where `source == 'publish-pick'`)
2. Fetch all subscribers from Firestore (`users` collection)
3. Render HTML from `templates/weekly-email-template.html`
4. Each pick card includes: symbol, strategy, R:R, PoP, max P/L, action links
5. Send: **To** = self, **BCC** = all subscribers (privacy)

### 5.3 Commands
```bash
npm run email:preview    # Save HTML locally + open in browser
npm run email:dry-run    # Show what would happen (no send)
npm run email:send       # Send to all subscribers
```

---

## 6. Data Flow Diagram

```
EXTERNAL SOURCES
┌──────────────────────────────────────────────────────────┐
│  Alpaca API   │  Yahoo Finance  │  Claude/Grok/Gemini    │
│  (prices,     │  (expirations,  │  (sentiment,           │
│   options,    │   open interest)│   analysis)            │
│   Greeks)     │                 │                        │
└──────┬────────┴────────┬────────┴───────────┬────────────┘
       │                 │                    │
       ▼                 ▼                    ▼
┌──────────────────────────────────────────────────────────┐
│  SCANNER PIPELINES (Node.js, cron-driven)                │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────┐ │
│  │ Fast (15min) │  │ Daily (OI)   │  │ Sentiment (6hr) │ │
│  └──────┬──────┘  └──────┬───────┘  └────────┬────────┘ │
└─────────┼────────────────┼────────────────────┼──────────┘
          │                │                    │
          ▼                ▼                    │
┌──────────────────────────────┐                │
│  CLOUDFLARE R2 (CDN)         │                │
│  reports/{symbol}/latest.json│                │
│  reports/{symbol}/history/   │                │
└──────────┬───────────────────┘                │
           │  sync                              │
           ▼                                    ▼
┌──────────────────────────────────────────────────────────┐
│  PUBLISH PIPELINE (manual CLI)                           │
│  publish-pick.cjs                                        │
│  1. Fetch live data (Alpaca)                             │
│  2. Build strategy legs                                  │
│  3. Run Claude analysis                                  │
│  4. Write to Firestore ────────────────────────────┐     │
│  5. Generate PDF (Python)                          │     │
└────────────────────────────────────────────────────┼─────┘
                                                     │
                                                     ▼
┌──────────────────────────────────────────────────────────┐
│  FIRESTORE (newleafdb)                                   │
│  ┌────────┐ ┌──────────┐ ┌─────────────┐ ┌───────────┐  │
│  │ tiles  │ │ analyses │ │ weeklyPicks │ │ outcomes  │  │
│  └────┬───┘ └─────┬────┘ └──────┬──────┘ └─────┬─────┘  │
└───────┼───────────┼─────────────┼───────────────┼────────┘
        │           │             │               │
        ▼           ▼             ▼               ▼
┌───────────────────────────────────┐  ┌───────────────────┐
│  REACT SPA (Browser)              │  │  EMAIL (Weekly)    │
│  /picks         → PicksPage      │  │  send-weekly-email │
│  /picks/{week}  → WeekViewerPage │  │  → Nodemailer      │
│  /picks/recap   → RecapPage      │  │  → Gmail SMTP      │
│  /picks/monthly → MonthlyPage    │  │  → BCC subscribers  │
│  /picks/analysis/{sym}           │  │                     │
│                  → PickAnalysis   │  │  PDF attachments    │
└───────────────────────────────────┘  │  from R2 CDN       │
                                       └───────────────────┘
```

---

## 7. Consolidation Analysis — Single App

### 7.1 Current Pain Points

| Problem | Impact |
|---------|--------|
| **5 separate runtimes** | Must manage Node server, Python scripts, cron jobs, Vite dev, Firebase independently |
| **Mixed languages** | Node.js (pipelines) + Python (reports) — two ecosystems to maintain |
| **Manual CLI workflow** | Publishing a pick requires terminal commands, not UI-driven |
| **Cron on local machine** | Scanner depends on dev machine being awake (macOS sleep issue) |
| **Config scattered** | Credentials in `scanner/config.json`, `.env`, `serviceAccountKey.json`, inline |
| **No admin UI** | All pipeline operations are CLI-only |
| **Yahoo localhost dependency** | OI enrichment requires separate Yahoo service on port 5300 |
| **Email is fire-and-forget** | No tracking, no open rates, no subscriber management UI |

### 7.2 What Needs to Become One App

To consolidate into a **single deployable application**, you need to unify:

#### A. Backend API Server (replace server.cjs + pipeline CLIs)
Currently you have:
- `server.cjs` — static file serving + R2 proxy + performance API
- `pipeline/publish-pick.cjs` — CLI script
- `pipeline/send-weekly-email.js` — CLI script
- `pipeline/create-weekly-picks.js` — CLI script
- `pipeline/close-week.js` — CLI script
- `pipeline/generate-outputs.js` — CLI script

**Consolidation:** One Express/Fastify API server with routes for all operations.

#### B. Scheduled Jobs (replace cron)
Currently: System crontab running shell scripts on local machine.

**Consolidation:** In-process job scheduler (e.g., `node-cron`, Bull queues) or Cloud Functions/Cloud Scheduler.

#### C. Report Generation (replace Python)
Currently: `build-enriched-report-data.py` + `generate-report.py` using WeasyPrint.

**Consolidation:** Either:
- Port to Node.js using Puppeteer (already a dependency) for PDF generation
- Or keep Python as a subprocess called from Node

#### D. Frontend Admin Dashboard (new)
Currently: All pipeline operations are CLI commands.

**Consolidation:** Admin pages in the React SPA for:
- Publishing picks (form-based, not CLI)
- Managing weekly bundles
- Previewing/sending emails
- Viewing pipeline status
- Subscriber management

---

## 8. Recommended Architecture

### Single App: Node.js Monolith with React Frontend

```
newleaf-app/
├── src/                          # React SPA (existing, keep as-is)
│   ├── picks/                    # Public picks pages
│   ├── trading/                  # Landing, learn, strategies
│   ├── marketing/                # Marketing pages
│   ├── admin/                    # NEW: Admin dashboard
│   │   ├── AdminLayout.jsx
│   │   ├── PublishPickPage.jsx   # Form to publish a pick
│   │   ├── WeeklyPicksPage.jsx   # Manage weekly bundles
│   │   ├── EmailPage.jsx         # Preview + send emails
│   │   ├── PipelineStatusPage.jsx# View scanner health
│   │   └── SubscribersPage.jsx   # Manage subscribers
│   └── shared/
│
├── server/                       # NEW: Unified API server
│   ├── index.js                  # Express app entry
│   ├── routes/
│   │   ├── picks.js              # Publish, close, bundle picks
│   │   ├── email.js              # Preview, send, subscriber mgmt
│   │   ├── pipeline.js           # Scanner status, trigger runs
│   │   ├── reports.js            # Generate PDF reports
│   │   └── proxy.js              # R2 proxy, Alpaca proxy
│   ├── services/
│   │   ├── alpaca.js             # Alpaca API client
│   │   ├── strategy-builder.js   # Strike selection, leg building
│   │   ├── claude-analysis.js    # Claude CLI integration
│   │   ├── sentiment.js          # 4-engine sentiment
│   │   ├── email.js              # Nodemailer + templates
│   │   ├── report-generator.js   # PDF via Puppeteer (replace Python)
│   │   └── firebase.js           # Firestore client
│   ├── jobs/
│   │   ├── scheduler.js          # node-cron job runner
│   │   ├── fast-pipeline.js      # 15-min Alpaca snapshots
│   │   ├── daily-pipeline.js     # OI enrichment
│   │   └── weekly-email.js       # Sunday email job
│   └── config.js                 # Unified config (env vars)
│
├── vite.config.js                # Frontend build
├── package.json                  # Single package.json
└── Dockerfile                    # Optional: containerized deploy
```

### 8.1 API Routes

```
# Pick Management
POST   /api/picks/publish          { symbol, strategy, expiry, dryRun }
POST   /api/picks/weekly/create    { weekId, theme, tileIds }
POST   /api/picks/weekly/close     { weekId }
GET    /api/picks/performance/*    (existing, move from server.cjs)

# Email
POST   /api/email/preview          → returns HTML
POST   /api/email/send             → sends to subscribers
GET    /api/email/subscribers       → list
POST   /api/email/subscribers       → add

# Pipeline
GET    /api/pipeline/status         → job health, last run times
POST   /api/pipeline/scan           { symbols } → trigger manual scan
GET    /api/pipeline/logs           → recent logs

# Reports
POST   /api/reports/generate        { tileId, format: pdf|html }
GET    /api/reports/:id             → download

# Proxy (existing)
GET    /r2/*                        → R2 CDN proxy
```

### 8.2 Scheduler (Replace Cron)

```javascript
// server/jobs/scheduler.js
const cron = require('node-cron');

// Fast pipeline: every 15 min, 9am-4pm ET, Mon-Fri
cron.schedule('*/15 13-20 * * 1-5', () => fastPipeline.run());  // UTC

// Daily OI enrichment: 9:32am ET
cron.schedule('32 13 * * 1-5', () => dailyPipeline.run());

// Pick outcomes: 6pm ET
cron.schedule('0 22 * * 1-5', () => outcomes.update());

// Weekly email: Sunday 6pm ET
cron.schedule('0 22 * * 0', () => weeklyEmail.send());
```

### 8.3 PDF Generation (Replace Python)

Replace `generate-report.py` + WeasyPrint with Puppeteer (already in dependencies):

```javascript
// server/services/report-generator.js
async function generatePDF(tileId) {
  const data = await getEnrichedPick(tileId);
  const html = renderTemplate('report-v3.html', data);
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.setContent(html);
  const pdf = await page.pdf({ format: 'A4', landscape: true });
  await browser.close();
  return pdf;
}
```

### 8.4 Config Consolidation

Replace `scanner/config.json` + `.env` + inline credentials with a single env-based config:

```bash
# .env (single source of truth)
# Alpaca
ALPACA_API_KEY=...
ALPACA_API_SECRET=...

# Firebase
GOOGLE_APPLICATION_CREDENTIALS=./serviceAccountKey.json
FIREBASE_DB=newleafdb

# R2
R2_ACCOUNT_ID=...
R2_ACCESS_KEY=...
R2_SECRET_KEY=...
R2_BUCKET=...
R2_PUBLIC_URL=https://pub-04bbb919022645b3a3f318b2ebdf48c0.r2.dev

# AI Engines
ANTHROPIC_API_KEY=...     # or keep using CLI
GROK_API_KEY=...
GEMINI_API_KEY=...

# Email
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=...
SMTP_PASS=...
EMAIL_FROM=NewLeaf Invest <marketing@newleafsystem.com>

# App
PORT=3000
NODE_ENV=production
ADMIN_EMAILS=manishsaraan@gmail.com,manish28june@gmail.com
```

---

## 9. Migration Roadmap

### Phase 1: Unified Server (Week 1-2)
**Goal:** Replace `server.cjs` with Express, add API routes for existing CLI scripts.

| Task | Effort | Details |
|------|--------|---------|
| Create `server/index.js` Express app | Small | Static serving + SPA fallback (same as server.cjs) |
| Move R2 proxy to Express route | Small | Copy logic from server.cjs |
| Move performance API to Express route | Small | Copy Firestore queries from server.cjs |
| Wrap `publish-pick.cjs` as API route | Medium | Extract core logic into `services/strategy-builder.js` |
| Wrap `send-weekly-email.js` as API route | Medium | Extract into `services/email.js` |
| Wrap `create-weekly-picks.js` as API route | Small | Firestore queries already modular |
| Wrap `close-week.js` as API route | Small | Same |
| Unified config from env vars | Medium | Replace config.json reads with `process.env` |

### Phase 2: In-Process Scheduler (Week 2-3)
**Goal:** Replace system cron with `node-cron` inside the server process.

| Task | Effort | Details |
|------|--------|---------|
| Add node-cron dependency | Trivial | `npm install node-cron` |
| Port fast pipeline to scheduled job | Medium | Extract from `newleaf-pipeline.js` |
| Port daily pipeline to scheduled job | Medium | Extract OI enrichment logic |
| Port weekly email to scheduled job | Small | Already wrapped in Phase 1 |
| Add job status tracking | Small | In-memory or Firestore `job_runs` collection |
| Remove system crontab dependency | Small | Delete `scanner/crontab`, update docs |

### Phase 3: Replace Python with Node (Week 3-4)
**Goal:** Eliminate Python dependency for report generation.

| Task | Effort | Details |
|------|--------|---------|
| Port `build-enriched-report-data.py` to JS | Medium | JSON transformation — straightforward |
| Port `generate-report.py` to Puppeteer | Medium | HTML template → PDF via headless Chrome |
| Verify PDF output matches current quality | Small | Visual comparison |
| Remove Python files | Trivial | Delete after validation |

### Phase 4: Admin Dashboard (Week 4-6)
**Goal:** UI for all pipeline operations.

| Task | Effort | Details |
|------|--------|---------|
| Admin route guard (email whitelist) | Small | Already have `ADMIN_EMAILS` env var |
| Publish Pick page (form → API) | Medium | Symbol, strategy, expiry, dry-run toggle |
| Weekly Picks management page | Medium | Create/edit/close weeks |
| Email preview + send page | Medium | Renders HTML preview, send button |
| Pipeline status dashboard | Medium | Job health, last run, trigger buttons |
| Subscriber management | Small | List, add, remove from Firestore `users` |

### Phase 5: Deployment (Week 6-7)
**Goal:** Single deployment target.

| Option | Pros | Cons |
|--------|------|------|
| **Firebase + Cloud Run** | Already on Firebase, auto-scaling, managed | Need Docker, cold starts for scanner |
| **Single VPS (Railway/Render)** | Always-on for scanner, simple, cheap ($7/mo) | Manual scaling, no Firebase CDN edge |
| **Fly.io** | Always-on, global edge, good free tier | New platform to learn |

**Recommended:** Railway or Render for the server (always-on for cron jobs) + Firebase Hosting for the static SPA (keep current CDN).

---

## Summary: What You Need to Build

| # | What | Why | Effort |
|---|------|-----|--------|
| 1 | Express API server | Replace server.cjs + CLI scripts with HTTP endpoints | Medium |
| 2 | Service modules | Extract publish, email, report, sentiment logic into importable modules | Medium |
| 3 | In-process scheduler | Replace system cron with node-cron | Small |
| 4 | Puppeteer PDF generator | Replace Python WeasyPrint | Medium |
| 5 | Unified config | Single `.env` instead of scattered config files | Small |
| 6 | Admin React pages | UI for publish, email, weekly management, pipeline status | Large |
| 7 | Deployment setup | Docker/Railway for server, Firebase Hosting for SPA | Medium |

**Total estimated scope:** 5-7 weeks of focused solo development.

**Biggest wins for least effort:**
1. **Phase 1** (unified server) immediately eliminates CLI workflow pain
2. **Phase 2** (scheduler) eliminates cron/sleep reliability issues
3. **Phase 4** (admin UI) makes the system self-service

**Can defer:**
- Phase 3 (Python replacement) — Python works fine, just adds a dependency
- Phase 5 (deployment) — can keep running locally until admin UI is ready
