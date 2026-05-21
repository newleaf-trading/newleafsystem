# CLAUDE.md — newleaf-api

You are currently working in `/Users/manish/dev/newleaf-api`.

## What this repo is

The NewLeaf AI gateway. TypeScript + Express. This repo owns:

- The **LLM Router** (`src/llm/router.ts`) — single point of truth for which model handles which request. All AI calls — Claude, GPT-4, Gemini, Grok, DeepSeek, QWQ, Qwen-Max — go through here. Token tracking, cost-per-call, model version pinning all live here.
- **Data tools** (`src/tools/`) — wrappers for Alpaca, Nasdaq, Serper, technical indicators (RSI, ADX, Bollinger, etc), sentiment engines, gamma analysis.
- **API endpoints** (`src/routes/`) — `/verify`, `/recommend`, `/snapshot`, `/api/ai-read`, `/api/sentiment`, etc. Consumed by workbench and other repos.
- **Orchestrators** (`src/orchestrator.ts`) — multi-agent flows like the 8-agent verify pipeline.

If a new LLM call needs to be added anywhere in the NewLeaf ecosystem, it gets added **here**, not in the calling repo.

## What this repo IS NOT

- Not a web app. No React. No HTML pages served from here.
- Not the scheduler. Cron jobs do not live here. If something needs to run on a schedule, that schedule is in `newleaf-pipeline`, and it *calls* this API.
- Not the pick generator. Candidate selection and tile creation live in `newleaf-generaterecommendations`.
- Not Firestore-writing for picks. The current intent is that pick publishing happens via an endpoint here (`/api/publish-pick`, not yet built), but that's the only write path. No other endpoint should write to `analyses/{tileId}`.

## Sibling repos

- `/Users/manish/dev/newleafsystem` — Web app (Picks site, Invest app, Workbench frontend). Calls this API for everything AI-related. Currently still contains legacy backend code that's being migrated out.
- `/Users/manish/dev/newleaf-pipeline` — Yahoo OI service (Python :5300), daily schedulers. Some tools in this repo (`src/tools/`) call into the Yahoo service on :5300.
- `/Users/manish/dev/newleaf-generaterecommendations` — pick generation. Calls this API for any LLM-driven analysis.
- `/Users/manish/dev/OptionAdvisor` — legacy, being decommissioned. Contains a `functions/index.js` whose target home is *this* repo as a regular endpoint (`/api/portfolio-chat`).

## Rules

- **Do not chdir outside `/Users/manish/dev/newleaf-api`** without explicit confirmation.
- **Every new LLM call routes through `src/llm/router.ts`.** Never import an LLM SDK directly into a route handler or tool. If you find code that does (e.g. `import { GoogleGenerativeAI } from '@google/generative-ai'` outside the router), flag it — that's a leak.
- **Cost-per-call and token tracking are non-negotiable.** Every router call returns a `TokenUsage` record. Never bypass this.
- **Secrets are env vars only.** They live in `.env.local` (gitignored). Never hardcode in source. Never commit `.env.local`.
- **Provenance fields on writes.** Any endpoint that writes to Firestore must stamp `model_used`, `prompt_version`, `analysis_source`, and (where applicable) `verify_job_id`.
- When you write a new endpoint, update the OpenAPI/route documentation in the same PR. Consumers in other repos need to know what's available.

## When you're unsure

Stop and ask. Especially if a request would route an LLM call outside the router, or write to Firestore outside the explicit set of endpoints permitted to do so.
