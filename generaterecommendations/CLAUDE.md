# NewLeaf Generate Recommendations — Claude Code Guidelines

## What This Repo Does

Generates options trading picks (recommendations) and submits them to Firebase Firestore. This is the "publish pipeline" — it handles the full lifecycle from pick creation through analysis, bundling, email delivery, and PDF report generation.

## Architecture

- `publish-pick.cjs` — Main entry: fetch Alpaca data, build strategy, write tile + analysis to Firestore
- `analyse-tiles.cjs` — Run Claude CLI deep analysis on unanalyzed tiles
- `create-weekly-picks.js` — Bundle tiles into weeklyPicks/{weekId} documents
- `close-week.js` — Calculate P&L, mark week as closed
- `send-weekly-email.js` — Newsletter to Firestore subscribers via Gmail SMTP
- `generate-outputs.js` — Generate picks.json, video scripts, PDFs
- `generate-analysis-pages.js` — Static analysis page data prep
- `sentiment-engine.js` — 4-engine AI sentiment (Claude/Grok/Gemini/Reddit)
- `config.js` ��� Reads .env, exports config object
- `build-enriched-report-data.py` — Python: flatten data for PDF templates
- `generate-report.py` — Python: WeasyPrint PDF generation
- `templates/` — Email + report HTML templates
- `assets/` — Report assets (logos, fonts)

## Key Commands

```bash
npm run publish -- NVDA --strategy "iron condor" --expiry 2026-05-23
npm run publish -- NVDA --strategy "iron condor" --expiry 2026-05-23 --dry-run
npm run analyse
npm run weekly
npm run close
npm run email:preview
npm run email:send
npm run outputs
npm run pdf
```

## Configuration

All config via `.env` file (see `.env.template`). Key values:
- Alpaca API credentials (for live prices/options)
- Firebase service account (for Firestore writes)
- SMTP credentials (for email delivery)
- Sentiment API keys (Grok, Gemini)

## Firestore Collections Written

- `tiles/{tileId}` — Published trade positions
- `analyses/{tileId}` — Claude deep analysis
- `weeklyPicks/{weekId}` — Weekly bundles
- `pick_outcomes` — Closed picks with P&L

## External Dependencies

- Alpaca API (live stock + option data)
- R2 CDN (read-only, for gamma wall context)
- Claude CLI (deep analysis generation)
- Grok/Gemini APIs (sentiment engines)
- Gmail SMTP (email delivery)
- WeasyPrint (PDF generation, Python)
