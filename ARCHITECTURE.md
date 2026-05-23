# NewLeaf Architecture

This file describes the structure of the `newleafsystem` monorepo and the rules for working in it. It is the canonical reference for any AI coding tool or contributor opening this repo. If something contradicts this file, this file is right.

**Last updated:** 21 May 2026 (post-monorepo migration)

---

## Repo structure

This is a **monorepo** at `/Users/manish/newleafsystem/`. Five main folders:

```
newleafsystem/
├── web/                       — React web app (Picks site, Invest app, Workbench)
├── api/                       — LLM Router + endpoints (TypeScript, Fastify)
├── pipeline/                  — Cron schedulers + data pipeline (Node.js)
├── generaterecommendations/   — Pick generation + tile creation
├── services/
│   └── yahoo-oi/              — Yahoo OI Service (Python Flask, deployed to Cloud Run)
├── shared/
│   └── indicators/            — Pure-math technical indicators (JS, used by api/)
└── docs/                      — Architecture docs, testing guide
```

The four app folders (`web/`, `api/`, `pipeline/`, `generaterecommendations/`) are **logically separate apps** that share a single git history. They are NOT npm workspaces. They are NOT a Turborepo. Each has its own `package.json`, dependencies, `.env` files, and runtime.

`services/` contains independently deployable microservices. `shared/` contains libraries imported by other folders.

---

## What each subfolder does

### `web/`

React web app served at `newleafsystem.com`. Three products live here:

- **Picks site** (`src/picks/`) — public, marketing/acquisition. Renders pick analysis pages at `/picks/analysis/{ticker}` from Firestore `analyses/{tileId}`.
- **Invest app** (`src/trading/`, `src/invest/`) — authenticated investor app. Five-phase lifecycle (Discover → Decide → Build → Execute → Defend). Reads same Firestore `analyses/{tileId}` documents.
- **Workbench** (`workbench/discover.html`) — DIY trade builder. Calls `api/` for AI/data tools. Today produces ephemeral output; eventually becomes the publishing surface for new picks.

**What lives here:** React components, routes, hooks, styles, the workbench static page.

**What does NOT live here:** backend code, LLM calls, scheduled jobs, pick generation, anything that writes to Firestore (except user-owned `users/{uid}/*` subcollections).

### `api/`

The AI gateway. TypeScript + Fastify. Deploys as a Firebase Cloud Function. Target domain: `api.newleafsystem.com` (via Cloudflare proxy to `us-central1-newleaf-trading.cloudfunctions.net`).

**What lives here:**
- **LLM Router** (`src/llm/router.ts`) — single point of truth for which model handles which request. All LLM calls — Claude, GPT, Gemini, Grok, DeepSeek, QWQ, Qwen — go through here.
- **Tools** (`src/tools/`) — Alpaca client, technical indicators (via `shared/indicators/`), 4-engine sentiment, full gamma analysis (via Yahoo OI Service), etc.
- **Endpoints** (`src/routes/`) — `/api/snapshot`, `/api/indicators`, `/api/gamma-analysis`, `/api/chain`, `/api/sentiment`, `/api/ai-read`, `/api/recommend`, `/verify`, `/api/llm/call`, `/admin/*`. Full reference: `docs/api-reference.html`.
- **Orchestrators** — multi-agent flows like the 8-agent verify pipeline.

**Rules for this subfolder:**
- **Every LLM call routes through `src/llm/router.ts`.** Never import an LLM SDK directly into a route handler or tool.
- **Cost tracking is non-negotiable.** Every router call returns a `TokenUsage` record.
- **Secrets are env vars only.** `.env`, `.env.local`, `.env.production` live in this folder, gitignored.
- **Provenance fields on writes.** Any endpoint that writes to Firestore must stamp `model_used`, `prompt_version`, `analysis_source`, and (where applicable) `verify_job_id`.

### `pipeline/`

The scheduling and data pipeline layer. **Pure orchestration — no services.**

**What lives here:**
- **Schedulers** — cron-equivalent jobs run by a macOS LaunchAgent (`com.newleaf.pipeline`), implemented via `node-cron` in `index.js`. Includes the 15-minute fast-pipeline scan, OI enrichment, daily catchup, health checks.
- **Data pipeline** (`newleaf-pipeline.js`) — scans watchlist, fetches OI from Yahoo OI Service (Cloud Run), enriches with gamma analysis, uploads to R2.
- **Watchlist and metadata** — `watchlist.json`, `company-metadata.json`.

**Rules for this subfolder:**
- **No services.** Pipeline is a scheduler — it calls URLs, not runs servers. The Yahoo OI Service lives in `services/yahoo-oi/`.
- **No direct LLM SDK imports.** If a scheduled job needs LLM work, it calls `api/` endpoints.
- **Idempotency.** Scheduled jobs may run twice (retry, network flake). Every job should be safe to re-run.

**Note on current state:** the active production LaunchAgent currently points at `/Users/manish/dev/newleaf-pipeline/` (legacy path). Cutting it over to `/Users/manish/newleafsystem/pipeline/` is an open task.

### `services/yahoo-oi/`

Python Flask microservice serving Open Interest data from yfinance. Deployed independently to Cloud Run.

**Endpoints:**
- `GET /api/options/{symbol}` — available expiry dates + current price
- `GET /api/options/{symbol}/{expiry}` — full chain with real OI, volume per strike

**Access:**
- **Production:** `https://yahoo-options-svc-m2cty2vxuq-uc.a.run.app`
- **Development:** `http://localhost:5300` (run `python3 option_api.py`)

**Why Python?** Yahoo Finance blocks direct Node.js calls. This Python wrapper (yfinance) is the only reliable OI data source.

**Consumed by:** `api/src/tools/nasdaq-oi.ts` (primary OI source, with Nasdaq.com scraping as fallback), `pipeline/newleaf-pipeline.js` (direct HTTP calls to Cloud Run URL).

### `generaterecommendations/`

The pick generator. Turns raw market data into ranked candidates and structured tile documents.

**What lives here:**
- **Candidate scanning** — walks the watchlist, scores each symbol for whether it's worth deeper analysis.
- **Tile creation** — `publish-pick.cjs`, `analyse-tiles.cjs`, `create-weekly-picks.js`, `close-week.js` — these are the files responsible for writing to Firestore `tiles`, `analyses`, and `weeklyPicks` collections. After the 21 May migration, this subfolder is the **sole writer** to those collections.
- **Weekly workflow** — `send-weekly-email.js`, `generate-outputs.js`, report generation.
- **Pick outcome tracking** — after picks expire, calculate P&L and update outcome records.

**Rules for this subfolder:**
- **Sole writer for `tiles`, `analyses`, `weeklyPicks`.** No code outside this folder should write to those collections.
- **No direct LLM SDK imports.** Call `api/` for verify, sentiment, synthesis.
- **Provenance on writes.** Stamp `model_used`, `prompt_version`, `analysis_source`, `verify_job_id` on every Firestore write.

---

## Firestore ownership

| Collection | Writer | Notes |
|---|---|---|
| `analyses/{tileId}` | `generaterecommendations/` | Read by `web/` (Picks + Invest). |
| `tiles/{tileId}` | `generaterecommendations/` | |
| `weeklyPicks` | `generaterecommendations/` | |
| `recommendations` | `generaterecommendations/` | From workbench publish path. |
| `pick_outcomes` | `generaterecommendations/` | Daily outcome update. |
| `marketState` | `pipeline/` | Synced from R2 snapshots. |
| `users/{uid}/*` | `web/` | User-owned subcollections, React hooks. |
| `apiKeys`, `jobs` | `api/` | API-internal. |
| `discover_usage` | `web/` (workbench) | Workbench analytics. Eventually moves to `api/`. |

**Hard rule:** if you're about to write to a collection from a subfolder not listed as the writer above, stop and ask.

---

## Sensitive files

These files exist locally but are gitignored. They must be present for the corresponding subfolder to run:

```
web/.env
api/.env
api/.env.local
api/.env.production
generaterecommendations/.env
web/scanner/serviceAccountKey.json
pipeline/serviceAccountKey.json
generaterecommendations/serviceAccountKey.json
pipeline/config.json
```

These are NOT in git. They were manually copied during the migration. If you're setting up a fresh checkout on a new machine, you'll need to populate them from a secure source (1Password, etc.) — there is no automated bootstrap for them.

**Templates exist** at `.env.template` and `.env.example` in each subfolder. These document what env vars are needed.

---

## Conventions

### LLM call routing

All LLM calls go through `api/src/llm/router.ts`. The router owns:
- Model selection (which model handles which kind of request)
- Cost tracking
- Token usage
- Version pinning
- Retry policy

**Forbidden:** importing `@anthropic-ai/sdk`, `openai`, `@google/generative-ai`, `groq-sdk`, or any other LLM client directly into route handlers, tools, or scripts.

**Legacy pattern to remove:** `spawnSync('claude', [...args])` for Claude CLI calls. This was used in `analyse-tiles.cjs` and `sentiment-engine.js` in the old pipeline; the canonical copies in `generaterecommendations/` should be migrated to route through `api/` instead.

### Publish gate

Picks publish only when:
- `verdict.call === 'pass'` from the `/verify` orchestrator
- `verdict.confidence >= 65` (a NewLeaf-defined floor)

Marginal verdicts go to a review queue. **There is no analyst override path.** This is a discipline decision, not a technical one.

### Data sources

- **Open Interest + Gamma Analysis:** Yahoo OI Service at `services/yahoo-oi/`, deployed to Cloud Run. Accessed exclusively through `api/` endpoints (`/api/gamma` and `/api/gamma-analysis`). The `/api/gamma-analysis` endpoint computes GEX walls, ATM IV, and confidence scores server-side for ANY ticker — no R2 pipeline dependency. Frontend never calls Yahoo OI Service directly.
- **Spot, chains, bars, dividends:** Alpaca Markets via `api/src/tools/alpaca.ts`.
- **News/sentiment:** 4-engine sentiment (Claude + Grok + Gemini + Reddit) in `api/src/tools/sentiment.ts`, all routed through the LLM router. genrecs calls via `/api/sentiment/:ticker`.
- **Technical indicators:** Computed in `api/src/tools/indicators.ts` using `shared/indicators/`. MACD, RSI, Bollinger, SMA all computed from real price data. genrecs calls via `/api/indicators/:ticker` and injects as ground truth into LLM prompts.
- **Earnings calendar:** Static `earnings-calendar.json` in `pipeline/`.

### Naming

- React components: PascalCase.
- Files in `api/src/`: kebab-case (e.g. `gamma-analyzer.ts`).
- Files in `generaterecommendations/`: kebab-case, with `.cjs` for CommonJS modules and `.js` for ESM where applicable.
- Firestore collection names: lowercase, singular nouns where the document is a singular thing (`analyses` because each doc IS an analysis), pluralised when listing.

---

## Legacy state at `/Users/manish/dev/`

Before the monorepo, these four directories were separate working copies:

- `/Users/manish/dev/newleafsystem/` — predecessor of `web/`, but also held `scanner/` and `pipeline/` legacy directories with code now in `generaterecommendations/` and `pipeline/`
- `/Users/manish/dev/newleaf-api/` — predecessor of `api/`
- `/Users/manish/dev/newleaf-pipeline/` — predecessor of `pipeline/`
- `/Users/manish/dev/newleaf-generaterecommendations/` — predecessor of `generaterecommendations/`

These directories **still exist on disk** as a fallback during the migration period. The active production LaunchAgent still points at `/Users/manish/dev/newleaf-pipeline/`. Do NOT delete the `dev/` directories until the monorepo's runtime is verified working and the LaunchAgent is cut over.

`/Users/manish/dev/OptionAdvisor/` is a separate legacy repo containing the Firebase `aiChat` callable function. It is not the source of `cloudfunctions.net/api` (that's `api/`). Its decommissioning is an open task; for now, leave it untouched.

---

## What to do when you're unsure

Stop and ask. Especially if:

- A change would route an LLM call outside the router
- A change would write to a Firestore collection from a subfolder not listed as the writer
- A change would touch the Yahoo OI service's response shape
- A change would move files between subfolders
- A change would touch anything under `/Users/manish/dev/` (those directories are fallback, leave them alone)

Never assume the structure described here is wrong because the code suggests otherwise. If code contradicts this file, the code is the legacy and this file is the target. Flag the contradiction, don't silently follow the code.

---

## Open questions and known issues

- **`model_used: 'claude-cli'` placeholder in genrecs provenance.** `publish-pick.cjs` and `analyse-tiles.cjs` stamp provenance with `'claude-cli'` because they still invoke the Claude CLI via `spawnSync`. Fixed in F3 when CLI calls migrate to the LLM router — provenance will then record the actual model string (e.g. `'claude-sonnet-4-7'`).
- **Gemini SDK has no construction-time timeout.** The Gemini client in `api/src/llm/router.ts` (added in F2.1) does not accept a timeout at construction. Long-running Gemini calls have no shared timeout config. If this becomes a problem in production, wrap `callGemini` in `Promise.race` with a manual deadline.
- **Sentiment engine duplication.** A 4-engine implementation exists in `generaterecommendations/sentiment-engine.cjs`; the canonical home is `api/src/tools/sentiment.ts`. F3 migrates this — all 4 engines (Claude, Grok, Gemini, Reddit) route through the LLM router uniformly.
- **LaunchAgent cutover.** Still points at the legacy `/Users/manish/dev/newleaf-pipeline/` path. Switch to the monorepo's `pipeline/` after the runtime is verified end-to-end.
- **OptionAdvisor decommissioning.** The Firebase `aiChat` callable function lives at `/Users/manish/dev/OptionAdvisor/`. Target: move into `api/` as `/api/portfolio-chat`. Deferred — OptionAdvisor stays as legacy-but-live until a full cutover is planned.
- **Pipeline LLM calls.** `generaterecommendations/analyse-tiles.cjs` and `publish-pick.cjs` still use direct Claude CLI via `spawnSync`. Should route through `api/src/llm/router.ts`. Fixed in F3.
- **IV and supportResistance in published analyses.** These two fields in the `technicalIndicators` block remain LLM-narrative (the LLM invents values). IV computation requires historical IV data over ~252 days; supportResistance is genuinely judgmental. Future phase to address.
- **Enrichment-update provenance.** When `analyse-tiles.cjs` updates an existing tile to add sentiment data, the update does NOT carry provenance — the tile's original creation-time provenance is preserved. If you need to track enrichment events later, consider adding a `provenance_history[]` array rather than overwriting.

See `docs/architecture-deck-v4.html` for the full narrative, decision log, and forward plan.
