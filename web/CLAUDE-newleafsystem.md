# CLAUDE.md — newleafsystem

You are currently working in `/Users/manish/dev/newleafsystem`.

## What this repo is

The NewLeaf web app. Three products share this codebase:

- **Picks site** — public marketing/acquisition pages at `/picks/analysis/{ticker}`. Source: `src/picks/`.
- **Invest app** — authenticated investor app at `/invest/strategy/{id}`. Source: `src/trading/` and `src/invest/`.
- **Workbench** — DIY trade builder at `/workbench/discover.html`. Source: `workbench/`.

All three render data from Firestore `analyses/{tileId}`. None of them generate that data — they read it.

## What this repo IS NOT

This repo is not the backend. It is not the LLM gateway. It is not where picks are generated. It does not run scheduled jobs.

Currently — and this is important — **this repo still contains legacy code that does not belong here**. The migration to split these out is in progress but not complete. You will find:

- `scanner/` and `pipeline/` directories — these are **legacy**. Their target home is `newleaf-generaterecommendations` (for pick generation) and `newleaf-pipeline` (for scheduling and Yahoo OI service). Do not extend, refactor, or add features to code in these directories without explicit instruction. Do not commit new files into them.
- `functions/` references — Firebase functions. Currently the live aiChat function is in the legacy `OptionAdvisor` repo. The target home is `newleaf-api` as a regular endpoint.

When in doubt about whether a file belongs in this repo, **stop and ask**.

## Sibling repos

You do not work in these unless explicitly told. They are listed here so you know the boundaries.

- `/Users/manish/dev/newleaf-api` — Centralized LLM Router. TypeScript + Express. Owns all LLM calls, all data tools, all API endpoints (e.g. `/verify`, `/recommend`, `/snapshot`, `/api/sentiment`). This is the AI gateway.
- `/Users/manish/dev/newleaf-pipeline` — Yahoo OI service (Python :5300), daily schedulers, cron-based infrastructure. The always-on data layer.
- `/Users/manish/dev/newleaf-generaterecommendations` — pick generation, tile creation, candidate scoring. Consumes from newleaf-pipeline, produces candidates and tiles in Firestore.
- `/Users/manish/dev/OptionAdvisor` — **legacy, being decommissioned**. May still serve live Firebase function traffic; do not modify or delete without an explicit migration plan.

## Rules

- **Do not chdir outside `/Users/manish/dev/newleafsystem`** without explicit confirmation from the user. If you need to check something in a sibling repo, stop and ask which file to look at.
- **Do not assume code structure is consistent across repos.** Each is its own world with its own conventions.
- **Do not migrate code between repos autonomously.** Moving files between repos is never a side-task — it's always a separately-scoped piece of work that needs a plan, including handling the deploys, the secrets, and the consumers.
- When asked to modify the workbench or any frontend code, remember that the AI calls go *through* `newleaf-api`, not directly to vendor SDKs. If you see direct fetches to OpenAI/Anthropic/etc, flag it — that's a leak from the older architecture.
- The Firestore source of truth for picks is `analyses/{tileId}`. Never write to it from this repo. Reads only.

## When you're unsure

Stop and ask. Do not guess at architecture. Do not assume that because a folder exists in this repo, the work belongs here.
