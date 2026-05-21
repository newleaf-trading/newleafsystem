# NewLeaf System

AI-Powered Options Intelligence Platform — [newleafsystem.com](https://newleafsystem.com)

## Quick Start

```bash
cd /Users/manish/dev/newleafsystem
npm install
```

## Weekly Workflow

### Monday AM — Publish Picks

```bash
# Step 1: Analyze stocks in the strategy builder
open http://localhost:3000/strategy-builder.html

# Step 2: For each stock you like → click "Publish to Firebase"
# (sign in with Google first)

# Step 3: Generate weekly picks page + analysis pages
npm run weekly -- --theme "Your market commentary here"

# Step 4: Deploy to newleafsystem.com
npm run deploy
```

### Wednesday — Mid-Week Check

```bash
# Check positions — no scripts needed
# Close tiles manually from Firebase Console or admin page if targets hit
```

### Friday PM — Close Week

```bash
# Step 1: Close the week (deactivates tiles, calculates P&L)
npm run picks:close

# Step 2: Deploy updated review page
npm run deploy
```

---

## All Commands

| Command | What it does |
|---------|-------------|
| `npm run weekly` | Creates picks + analysis pages (Monday routine) |
| `npm run weekly -- --theme "..."` | Same, with custom market commentary |
| `npm run picks:create` | Create weekly picks only (no analysis pages) |
| `npm run picks:preview` | Dry run — shows what would be created |
| `npm run picks:close` | Close current week + generate review page |
| `npm run analysis:generate` | Generate analysis HTML pages only |
| `npm run analysis:pdf` | Generate analysis pages + PDF reports + upload to R2 |
| `npm run deploy` | Deploy everything to newleafsystem.com |

## Pipeline Scripts (detailed)

### `pipeline/create-weekly-picks.js`

Bundles published tiles into a Firestore `weeklyPicks` document and generates HTML pages.

```bash
# Basic (current week, auto-detects tiles)
node pipeline/create-weekly-picks.js

# With market theme
node pipeline/create-weekly-picks.js --theme "IV elevated — premium selling favoured"

# Specific week
node pipeline/create-weekly-picks.js --week 2026-W16

# Preview without writing to Firestore
node pipeline/create-weekly-picks.js --dry-run
```

**Reads:** Active tiles from Firestore where `source = 'strategy-builder'`
**Writes:** `weeklyPicks/{weekId}` doc in Firestore
**Generates:**
- `dist/picks/index.html` — current week's picks page
- `dist/picks/{weekId}/index.html` — permalink for the week

### `pipeline/generate-analysis-pages.js`

Creates rich HTML analysis pages for each pick with full trade detail.

```bash
# All picks from strategy-builder tiles
node pipeline/generate-analysis-pages.js

# Single symbol
node pipeline/generate-analysis-pages.js --symbol NVDA

# Also generate PDFs + upload to R2
node pipeline/generate-analysis-pages.js --pdf
```

**Reads:** Tiles from Firestore + R2 reports (gamma, technicals)
**Generates:** `dist/picks/analysis/{symbol}/index.html` per pick

### `pipeline/close-week.js`

Friday routine — closes tiles, calculates P&L, generates review page.

```bash
# Current week
node pipeline/close-week.js

# Specific week
node pipeline/close-week.js --week 2026-W16

# Preview
node pipeline/close-week.js --dry-run
```

**Updates:** Deactivates tiles in Firestore, adds `review` to weeklyPicks doc
**Generates:** `dist/picks/review/index.html`

### PDF + Video Scripts (from newleafreport)

```bash
# Generate PDF report for a symbol (requires weasyprint)
cd pipeline
python3 newleaf-report.py NVDA

# Generate video script only
python3 generate-script.py NVDA

# Batch generate for multiple symbols
python3 batch-generate.py SPY QQQ AAPL NVDA

# Upload PDFs to R2
python3 upload-to-r2.py NVDA --pdf-only
```

**Dependencies:** `pip install weasyprint yfinance boto3`

---

## Stock Data Pipeline

The data pipeline lives in the sister project and feeds all reports:

```bash
cd /Users/manish/dev/OptionAdvisor/newleaf-alpaca-r2/pipeline

# Scan specific symbols
node newleaf-pipeline.js NVDA AAPL TSLA

# Scan full watchlist (111 stocks)
node newleaf-pipeline.js --watchlist

# Data sources: Alpaca ($90/mo OPRA) + Yahoo (free, localhost:5300)
# Output: R2 → reports/{SYMBOL}/latest.json + contracts/atm-latest.json
```

---

## Live URLs

| URL | What |
|-----|------|
| [newleafsystem.com](https://newleafsystem.com) | Landing page |
| [newleafsystem.com/picks](https://newleafsystem.com/picks) | Weekly picks |
| [newleafsystem.com/picks/analysis/spy](https://newleafsystem.com/picks/analysis/spy/) | Analysis page (example) |
| [newleafsystem.com/sitemap.xml](https://newleafsystem.com/sitemap.xml) | Sitemap |
| [newleaf-alpaca-r2.web.app](https://newleaf-alpaca-r2.web.app) | Workbench (strategy builder) |
| [newleaf-trading.web.app](https://newleaf-trading.web.app) | Trading app (investor) |

## Project Structure

```
newleafsystem/
├── dist/                          ← Firebase Hosting (deployed)
│   ├── index.html                 ← Landing page
│   ├── robots.txt                 ← SEO
│   ├── sitemap.xml                ← SEO
│   └── picks/
│       ├── index.html             ← Current week picks
│       ├── review/index.html      ← Weekly review (after Friday close)
│       ├── 2026-W16/index.html    ← Week permalink
│       └── analysis/
│           ├── spy/index.html     ← Full analysis per symbol
│           ├── qqq/index.html
│           └── .../
│
├── pipeline/                      ← Report generation + data scripts
│   ├── create-weekly-picks.js     ← Monday: bundle tiles → picks page
│   ├── generate-analysis-pages.js ← Monday: tiles → analysis HTML
│   ├── close-week.js              ← Friday: close tiles, P&L review
│   ├── newleaf-report.py          ← PDF generation (WeasyPrint)
│   ├── generate-script.py         ← Video narration scripts
│   ├── generate-report.py         ← JSON → PDF renderer
│   ├── batch-generate.py          ← Multi-symbol batch
│   ├── build-report-data.py       ← Build JSON data from Alpaca/Yahoo
│   ├── upload-to-r2.py            ← Upload PDFs/scripts to R2
│   ├── alert.py                   ← Position alerts
│   ├── alpaca-config.json         ← Alpaca API credentials
│   ├── templates/                 ← PDF HTML templates
│   ├── assets/                    ← Logos, images
│   ├── data/                      ← Trade data JSONs
│   └── positions/                 ← Active position tracking
│
├── SITE_ARCHITECTURE.html         ← Architecture + access matrix doc
├── firebase.json                  ← Firebase Hosting config
├── .firebaserc                    ← Firebase project binding
└── package.json                   ← npm scripts
```

## Firebase

- **Project:** `newleaf-trading`
- **Database:** `newleafdb` (Firestore)
- **Hosting site:** `newleafsystem` → newleafsystem.com
- **Auth:** Google + email/password
- **Service account:** `../OptionAdvisor/newleaf-trading/scanner/serviceAccountKey.json`

## DNS (names.co.uk)

| Type | Host | Value |
|------|------|-------|
| A | @ | 199.36.158.100 |
| CNAME | www | newleafsystem.web.app |
| TXT | @ | hosting-site=newleafsystem |
| TXT | @ | google-site-verification=nUHDF3xK2ALhfDaesyjcBCBbSm9GauDGbXMLZ0yisVU |

## Google Analytics

- **Property:** G-06YFVHFNYT (shared with newleaf-trading)
- **Search Console:** Verified via DNS TXT record
- **Sitemap:** Submitted at newleafsystem.com/sitemap.xml
