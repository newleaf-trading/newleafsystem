# CLAUDE.md — newleaf-pipeline

You are currently working in `/Users/manish/dev/newleaf-pipeline`.

## What this repo is

The always-on data and scheduling infrastructure for NewLeaf. Its job is to keep market data fresh and trigger downstream work on schedule. Specifically:

- **Yahoo OI service** — a Python service serving Open Interest data from `yfinance` on `localhost:5300`. Other repos (notably `newleaf-api`) call this service when they need OI data. This is the only real OI source in the ecosystem.
- **Daily schedulers** — cron-managed jobs that run on market hours and at end-of-day. Examples: fast intraday scans, daily OI enrichment, weekly email sends, pick outcome updates.
- **Health checks and monitoring** — process-level checks for the schedulers themselves.

## What this repo IS NOT

- Not a web app. No React. No HTML.
- Not an LLM caller. **If a scheduled job needs LLM analysis, it calls `newleaf-api`.** This repo does not import any LLM SDKs directly.
- Not the pick generator. Pick selection logic lives in `newleaf-generaterecommendations`. This repo *triggers* that generator on schedule; it doesn't contain the generation logic itself.
- Not a place for ad-hoc data tools. If a tool can be called by anyone (workbench, API, manual), it lives in `newleaf-api/src/tools/`. Things live here only if they need to run on a schedule or are infrastructure-level (like the local Yahoo service).

## Sibling repos

- `/Users/manish/dev/newleaf-api` — AI gateway. This repo's scheduled jobs call newleaf-api endpoints for any LLM work, sentiment analysis, or technical-indicator computation that's needed during a scheduled run.
- `/Users/manish/dev/newleaf-generaterecommendations` — pick generation. Triggered by jobs in this repo.
- `/Users/manish/dev/newleafsystem` — web app. No direct relationship with this repo; the web app consumes Firestore documents that are *eventually* the result of these scheduled jobs.
- `/Users/manish/dev/OptionAdvisor` — legacy. Some old schedulers may still be referenced here historically; do not assume parity with current production.

## Rules

- **Do not chdir outside `/Users/manish/dev/newleaf-pipeline`** without explicit confirmation.
- **No direct LLM SDK imports.** No `@anthropic-ai/sdk`, no `openai`, no `@google/generative-ai`. Schedule a job; the job calls `newleaf-api`.
- **Secrets in env vars.** API keys for Alpaca, R2, SMTP, Yahoo (if needed) live in env files, never hardcoded.
- **The Yahoo service is load-bearing for the whole ecosystem.** Treat changes to the OI endpoint carefully — `newleaf-api`'s gamma analysis tools depend on its response shape. If you change the response shape, that's a coordinated change with newleaf-api.
- **Idempotency matters.** Scheduled jobs may run twice (network flake, retry, etc). Every job should be safe to re-run without double-writing or double-emailing.
- **Failures must be loud.** A silently-failing cron is worse than a noisy one. If a job fails, log it and (where appropriate) page.

## When you're unsure

Stop and ask. Especially if a request would have this repo import an LLM SDK, write directly to Firestore documents that other repos own, or change the Yahoo service response shape.
