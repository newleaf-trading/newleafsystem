# NewLeaf Generate Recommendations

Automated options trading recommendation engine. Generates weekly picks, runs AI analysis, publishes to Firebase, sends newsletters, and produces PDF reports.

---

## What This App Does

1. **Publishes Options Picks** — Fetches live market data from Alpaca, auto-selects strikes, builds strategy legs, calculates P&L/Greeks/PoP, and writes to Firestore.

2. **Runs AI Deep Analysis** — Uses Claude CLI to generate strategy rationale, technical indicators (RSI, MACD, Bollinger Bands), theta decay schedule, and risk analysis for each pick.

3. **Multi-Engine Sentiment** — Aggregates sentiment from 4 AI engines:
   - Claude (30%) — financial news + analyst reports
   - Grok/xAI (25%) — X/Twitter social sentiment
   - Gemini (25%) — Google News + sector trends
   - Reddit (20%) — WSB + StockTwits retail mood

4. **Weekly Bundles** — Groups picks into weekly collections for the React app.

5. **PDF Reports** — Generates professional trade reports with full analysis via WeasyPrint.

6. **Email Newsletter** — Sends weekly picks to subscribers via Gmail SMTP.

7. **Week Close & P&L** — Calculates actual outcomes (WIN/LOSS) and archives results.

---

## Supported Strategies

- Iron Condor
- Iron Butterfly
- Bull Put Spread
- Bear Call Spread

---

## How to Run

### Publish a Pick

```bash
# Publish with live data + Claude analysis + sentiment
npm run publish -- NVDA --strategy "iron condor" --expiry 2026-05-29

# Dry run (no Firestore writes)
npm run publish -- NVDA --strategy "iron condor" --expiry 2026-05-29 --dry-run

# With PDF generation
npm run publish -- NVDA --strategy "iron condor" --expiry 2026-05-29 --pdf
```

### Run Deep Analysis on Unanalyzed Tiles

```bash
npm run analyse                  # All unanalyzed tiles
npm run analyse -- --all         # Re-analyse ALL tiles
npm run analyse -- --id <tileId> # One specific tile
```

### Generate Outputs (PDF, JSON archive, video script)

```bash
npm run outputs            # JSON + video script only
npm run outputs -- --pdf   # Also generate PDF reports
```

### Weekly Picks Management

```bash
npm run weekly                           # Create weekly bundle (current week)
npm run weekly -- --week 2026-W20        # Specific week
npm run weekly -- --theme "High IV environment"  # With theme
npm run close                            # Close week, calculate P&L
npm run close -- --dry-run               # Preview close
```

### Email Newsletter

```bash
npm run email:preview    # Save HTML locally + open in browser
npm run email:dry-run    # Show what would happen (no send)
npm run email:send       # Send to all subscribers
```

---

## What Gets Generated

| Output | Location | Description |
|--------|----------|-------------|
| Firestore tile | `tiles/{tileId}` | Strategy position (symbol, legs, Greeks, P&L bounds) |
| Firestore analysis | `analyses/{tileId}` | Claude deep analysis (rationale, technicals, risk) |
| Firestore weeklyPicks | `weeklyPicks/{weekId}` | Weekly bundle of picks |
| Enriched JSON | `output/{weekId}/enriched/{SYMBOL}-{strategy}.json` | Tile + analysis merged |
| Picks archive | `output/{weekId}/picks.json` | All picks for the week |
| Video script | `output/{weekId}/video-script.md` | Narration for content team |
| PDF reports | `output/{weekId}/pdf/{SYMBOL}-{Strategy}.pdf` | Professional trade reports |
| Email | Gmail SMTP → subscribers | Weekly newsletter with pick cards |

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.template .env
# Fill in your API keys and credentials
```

### 3. Add Firebase service account

Place `serviceAccountKey.json` in the project root (download from Firebase Console > Project Settings > Service Accounts).

### 4. Python dependencies (for PDF generation)

```bash
pip install weasyprint pypdf reportlab
```

---

## Environment Variables (.env)

| Variable | Purpose |
|----------|---------|
| `ALPACA_API_KEY` | Alpaca market data API key |
| `ALPACA_SECRET_KEY` | Alpaca market data secret |
| `R2_PUBLIC_BASE_URL` | Cloudflare R2 CDN (read-only, for gamma wall data) |
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to Firebase service account JSON |
| `FIREBASE_PROJECT_ID` | Firebase project (`newleaf-trading`) |
| `FIRESTORE_DATABASE_ID` | Named database (`newleafdb`) |
| `SMTP_HOST` | Email server (`smtp.gmail.com`) |
| `SMTP_PORT` | Email port (`587`) |
| `SMTP_USER` | Gmail address |
| `SMTP_PASS` | Gmail app password |
| `EMAIL_FROM` | Sender display name |
| `EMAIL_RECIPIENTS` | Default recipients (comma-separated) |
| `SENTIMENT_GROK_API_KEY` | xAI/Grok API key |
| `SENTIMENT_GEMINI_API_KEY` | Google Gemini API key |

---

## Typical Weekly Workflow

```
Monday–Thursday:
  npm run publish -- SYMBOL --strategy "iron condor" --expiry YYYY-MM-DD
  (repeat for 3-5 picks)

Thursday/Friday:
  npm run outputs -- --pdf          # Generate PDFs + archive
  npm run email:send                # Send newsletter

Following Friday:
  npm run close                     # Calculate P&L, archive results
```

---

## Architecture

```
Alpaca API (live prices, options, Greeks)
       ↓
publish-pick.cjs → Build strategy → Firestore tiles/{id}
       ↓
Claude CLI → Deep analysis → Firestore analyses/{id}
       ↓
Sentiment engines (Claude/Grok/Gemini/Reddit) → score
       ↓
generate-outputs.js → picks.json + video-script.md + PDFs
       ↓
send-weekly-email.js → Gmail SMTP → 11 subscribers
       ↓
close-week.js → P&L calculation → Firestore pick_outcomes
```

---

## Firebase Collections

- **tiles** — Active trade positions with full strategy data
- **analyses** — AI-generated deep analysis per tile
- **weeklyPicks** — Weekly bundles (what the React app serves at /picks)
- **pick_outcomes** — Historical P&L results
- **users** — Subscriber email list (for newsletter)
