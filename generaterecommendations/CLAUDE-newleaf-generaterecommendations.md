# CLAUDE.md — newleaf-generaterecommendations

You are currently working in `/Users/manish/dev/newleaf-generaterecommendations`.

## What this repo is

The pick generator. Its job is to turn raw market data into ranked trade candidates and structured tile documents that the web app can render. Specifically:

- **Candidate scanning** — walk the watchlist (~144 symbols), score each for whether it's worth deeper analysis. Output: a ranked list of candidates per week.
- **Tile creation** — for selected candidates, produce the structured tile JSON that gets written to Firestore `analyses/{tileId}` and `candidates/{weekId}/{symbol}`.
- **Pick outcome tracking** — after picks expire, calculate P&L and update outcome records.

## What this repo IS NOT

- Not a web app. No React. No HTML.
- Not an LLM caller. **If pick analysis needs LLM work — verify, recommend, sentiment, synthesis — it calls `newleaf-api`.** No direct SDK imports here.
- Not the scheduler. Cron lives in `newleaf-pipeline`. This repo provides functions and scripts; the schedule that invokes them lives elsewhere.
- Not the publisher. Once the architectural migration is complete, the *human-in-the-loop* publish step happens from the workbench (in `newleafsystem`) via `newleaf-api`'s `/api/publish-pick`. This repo writes *candidates*, not *published picks*.

## Sibling repos

- `/Users/manish/dev/newleaf-api` — AI gateway. This repo calls newleaf-api endpoints for verify, sentiment, synthesis. All LLM work flows through there.
- `/Users/manish/dev/newleaf-pipeline` — Schedulers. The jobs that invoke scripts in this repo are defined in newleaf-pipeline's cron. The Yahoo OI service (`localhost:5300`) is also there; if you need OI data, call newleaf-api's tools (which in turn call newleaf-pipeline's :5300).
- `/Users/manish/dev/newleafsystem` — Web app. Consumes the Firestore documents this repo writes (`candidates/{weekId}/{symbol}` for the workbench; `analyses/{tileId}` once published via newleaf-api).
- `/Users/manish/dev/OptionAdvisor` — legacy. Old generation code may have lived here historically; do not import from it.

## Rules

- **Do not chdir outside `/Users/manish/dev/newleaf-generaterecommendations`** without explicit confirmation.
- **No direct LLM SDK imports.** All LLM calls go through `newleaf-api`. If you need verify, call `POST /verify`. If you need sentiment, call `GET /api/sentiment/:ticker`.
- **No direct calls to the Claude CLI (`spawnSync('claude', ...)`).** The legacy code used this; new code should not. Route through newleaf-api.
- **Provenance on writes.** When this repo writes to Firestore, stamp `model_used`, `prompt_version`, `analysis_source`, and `verify_job_id` where applicable.
- **Candidates ≠ published picks.** This repo writes candidates. Publishing to `analyses/{tileId}` is the workbench-via-newleaf-api path, not this repo's job.
- **Idempotency.** Generation scripts should be safe to re-run.

## When you're unsure

Stop and ask. Especially if a request would have this repo import an LLM SDK directly, write to `analyses/{tileId}` instead of `candidates/{weekId}/{symbol}`, or duplicate logic that already exists in `newleaf-api/src/tools/`.
