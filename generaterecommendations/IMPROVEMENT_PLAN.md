# NewLeaf Content Engine — Improvement Plan

## Problem

Currently we generate:
- PDF reports (WeasyPrint)
- Firestore tiles/analyses (React app)
- Email newsletter (SMTP)
- Video script (Markdown — manual narration)

**Missing:**
1. Automated video renditions per strategy (no manual video editing)
2. Social media cards (LinkedIn, Twitter/X) with one-click publish
3. Multi-channel distribution in a single command

---

## Proposed Architecture

```
npm run publish -- NVDA --strategy "iron condor" --expiry 2026-05-29
       ↓
[Existing: Tile + Analysis + PDF]
       ↓
npm run content                    ← NEW: generates all content assets
       ↓
┌─────────────────────────────────────────────────────────┐
│  Content Generator                                       │
│                                                          │
│  1. Video Rendition (Remotion)                          │
│     → 60s vertical (TikTok/Reels/Shorts)               │
│     → 2-3min horizontal (YouTube/LinkedIn)              │
│                                                          │
│  2. Social Cards (Puppeteer → PNG)                      │
│     → LinkedIn card (1200x627)                          │
│     → Twitter card (1200x675)                           │
│     → Instagram square (1080x1080)                      │
│                                                          │
│  3. Caption/Copy Generation (Claude)                    │
│     → LinkedIn post text (professional)                 │
│     → Twitter thread (concise, 280-char tweets)         │
│     → Instagram caption (engaging + hashtags)           │
│                                                          │
└─────────────────────────────────────────────────────────┘
       ↓
npm run distribute                 ← NEW: publishes to all channels
       ↓
┌─────────────────────────────────────────────────────────┐
│  Distribution Engine                                     │
│                                                          │
│  → LinkedIn (Posts API + image/video upload)            │
│  → Twitter/X (twitter-api-v2 + media)                  │
│  → YouTube Shorts (YouTube Data API v3)                 │
│  → Email (existing — already working)                   │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 1. Video Rendition — Remotion

### Why Remotion

| Option | Cost | Difficulty | Quality | Solo Dev Fit |
|--------|------|-----------|---------|-------------|
| **Remotion** | Free | Medium | High (React-rendered) | Best |
| Shotstack | $49/mo | Easy | Medium (template-locked) | Good |
| HeyGen (AI avatar) | $60-100/mo | Medium | High | Expensive |
| FFmpeg + canvas | Free | Hard | Low-Medium | Too manual |

Remotion is free, produces broadcast-quality MP4, and we already have React expertise.

### Video Template Structure (per strategy)

Each video is a React component rendered frame-by-frame:

```
src/videos/
├── IronCondorVideo.tsx        ← Strategy-specific video template
├── BullPutSpreadVideo.tsx
├── BearCallSpreadVideo.tsx
├── IronButterflyVideo.tsx
├── shared/
│   ├── IntroSlide.tsx         ← Logo + symbol + direction badge
│   ├── PayoffDiagram.tsx      ← Animated payoff chart with legs
│   ├── MetricsOverlay.tsx     ← Credit, PoP, R:R, Max P/L
│   ├── SentimentGauge.tsx     ← 4-engine sentiment visualization
│   ├── TechnicalSnapshot.tsx  ← RSI, MACD, Bollinger summary
│   ├── GammaWalls.tsx         ← Put/call wall levels + current price
│   ├── RiskCallout.tsx        ← Key risk + management plan
│   └── OutroSlide.tsx         ← CTA + website URL
└── compositions.ts            ← Register video compositions
```

### Video Outputs Per Pick

| Format | Resolution | Duration | Platform |
|--------|-----------|----------|----------|
| Vertical (9:16) | 1080x1920 | 45-60s | TikTok, Reels, Shorts |
| Horizontal (16:9) | 1920x1080 | 2-3 min | YouTube, LinkedIn |
| Square (1:1) | 1080x1080 | 30-45s | Instagram Feed, Twitter |

### Data → Video Mapping

```javascript
// Each enriched-pick.json maps to video props:
const videoProps = {
  // Intro (5s)
  symbol: pick.symbol,
  companyName: pick.companyName,
  direction: pick.direction,
  spotPrice: pick.spotPrice,

  // Strategy Setup (15s)
  strategy: pick.strategy,
  legs: pick.legs,
  maxProfit: pick.maxProfit,
  maxLoss: pick.maxLoss,
  netCredit: pick.netCredit,
  oddsOfProfit: pick.oddsOfProfit,

  // Why This Trade (10s)
  rationale: pick.analysis.strategyRationale.whyThisStrategy,
  strikes: pick.analysis.strategyRationale.whyTheseStrikes,

  // Market Context (10s)
  sentimentScore: pick.sentiment.composite.score,
  sentimentLabel: pick.sentiment.composite.label,
  keyDrivers: pick.sentiment.keyDrivers.slice(0, 3),
  rsi: pick.analysis.technicalIndicators.rsi,
  ivRank: pick.analysis.technicalIndicators.impliedVolatility.ivRank,

  // Gamma/Levels (10s)
  putWall: pick.gammaData.put_wall,
  callWall: pick.gammaData.call_wall,
  support: pick.keyLevels.support,
  resistance: pick.keyLevels.resistance,

  // Risk & Exit (10s)
  eventRisk: pick.analysis.riskAnalysis.eventRisk,
  managementPlan: pick.analysis.riskAnalysis.managementPlan,
};
```

### Render Command

```bash
# Render all formats for one pick
npx remotion render src/videos/IronCondorVideo.tsx \
  --props='enriched/BABA-iron-condor.json' \
  --output='output/2026-W20/video/BABA-iron-condor-vertical.mp4' \
  --width=1080 --height=1920

# Or via npm script:
npm run video -- --symbol BABA --week 2026-W20
```

### Implementation Estimate: 1-2 weeks

- Day 1-2: Remotion setup, project scaffold, shared components
- Day 3-5: Strategy video templates (Iron Condor first, then others)
- Day 6-7: Data ingestion from enriched-pick.json
- Day 8-10: Multi-format rendering, audio/music integration
- Day 11-14: Polish, transitions, branding

---

## 2. Social Media Cards — Puppeteer Screenshots

### Why Puppeteer

Already in our dependencies. Full HTML/CSS support. Can reuse PDF template styles.

### Card Templates

```
templates/social/
├── linkedin-card.html      ← 1200x627 landscape
├── twitter-card.html       ← 1200x675 landscape
├── instagram-square.html   ← 1080x1080 square
└── social-card.css         ← Shared styles
```

### Card Design Per Strategy

Each card shows:
- NewLeaf branding (logo, color scheme)
- Symbol + company name + direction badge
- Strategy name with leg visualization
- Key metrics: Credit, PoP, R:R, Max Profit
- Sentiment score gauge
- Gamma wall levels with price context
- Expiry date + DTE countdown

### Generator Script

```javascript
// generate-social-cards.js
async function generateCards(enrichedPick) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  const formats = [
    { name: 'linkedin', width: 1200, height: 627, template: 'linkedin-card.html' },
    { name: 'twitter',  width: 1200, height: 675, template: 'twitter-card.html' },
    { name: 'instagram', width: 1080, height: 1080, template: 'instagram-square.html' },
  ];

  for (const fmt of formats) {
    const html = renderTemplate(fmt.template, enrichedPick);
    await page.setViewport({ width: fmt.width, height: fmt.height });
    await page.setContent(html);
    await page.screenshot({
      path: `output/${pick.weekId}/social/${pick.symbol}-${fmt.name}.png`,
      type: 'png'
    });
  }

  await browser.close();
}
```

### Implementation Estimate: 3-5 days

- Day 1: HTML/CSS card templates (LinkedIn first)
- Day 2: Adapt for Twitter and Instagram dimensions
- Day 3: Generator script + data binding
- Day 4-5: Styling polish, brand consistency, edge cases

---

## 3. Caption/Copy Generation — Claude

### Strategy-Specific Social Copy

Use Claude CLI to generate platform-appropriate captions from enriched pick data:

```javascript
// generate-social-copy.js
async function generateCopy(enrichedPick) {
  const prompt = `
    Generate social media posts for this options trade pick:
    Symbol: ${pick.symbol} | Strategy: ${pick.strategy} | Direction: ${pick.direction}
    Credit: $${pick.netCredit} | PoP: ${pick.oddsOfProfit}% | R:R: ${pick.rewardRisk}x
    Sentiment: ${pick.sentiment.composite.label} (${pick.sentiment.composite.score}/100)
    Thesis: ${pick.analysis.strategyRationale.whyThisStrategy}

    Generate JSON with:
    1. "linkedin": Professional post (150-200 words, data-driven, no emojis)
    2. "twitter": Thread of 3 tweets (280 chars each, punchy, use $TICKER)
    3. "instagram": Engaging caption (100 words + 15 relevant hashtags)
  `;

  const result = spawnSync('claude', ['--print', '-p', prompt]);
  return JSON.parse(extractJSON(result.stdout.toString()));
}
```

### Output Structure

```json
{
  "linkedin": "Our AI engine identified a high-probability Iron Condor on $BABA...",
  "twitter": [
    "$BABA Iron Condor | 85% PoP | $37.50 credit\n\nSelling volatility with defined risk...",
    "Why this setup works:\n• Put wall at $125\n• Call wall at $140\n• Neutral sentiment (67/100)\n• 13 DTE sweet spot for theta decay",
    "Risk management:\n• Max loss capped at $662\n• Exit at 50% profit ($19)\n• Or roll if tested\n\nFull analysis: newleafsystem.com/picks"
  ],
  "instagram": "Iron Condor alert! Our 4-engine AI sentiment system flagged $BABA..."
}
```

### Implementation Estimate: 1-2 days

Already have Claude CLI integration. Just need the prompt template and output parser.

---

## 4. Distribution Engine — One-Click Multi-Channel Publish

### Architecture

```javascript
// distribute.js — One command publishes everywhere
// npm run distribute -- --week 2026-W20

async function distribute(weekId) {
  const picks = loadPicks(weekId);

  for (const pick of picks) {
    const cards = loadCards(pick);   // PNG files
    const copy = loadCopy(pick);    // JSON with platform text
    const video = loadVideo(pick);  // MP4 files

    // Parallel publishing
    await Promise.allSettled([
      publishLinkedIn(copy.linkedin, cards.linkedin, video.horizontal),
      publishTwitter(copy.twitter, cards.twitter),
      publishInstagram(copy.instagram, cards.instagram, video.vertical),
    ]);
  }
}
```

### Platform APIs

| Platform | Package | Auth | Content Types |
|----------|---------|------|---------------|
| LinkedIn | Direct REST API | OAuth 2.0 (w_member_social) | Text + image + video |
| Twitter/X | `twitter-api-v2` | OAuth 2.0 / Bearer token | Tweet + media + threads |
| Instagram | Graph API (via Meta) | Facebook OAuth | Photo + video + carousel |
| YouTube | `googleapis` | OAuth 2.0 | Shorts upload |

### Config Addition (.env)

```env
# Social Media APIs
LINKEDIN_ACCESS_TOKEN=
LINKEDIN_PERSON_URN=
TWITTER_API_KEY=
TWITTER_API_SECRET=
TWITTER_ACCESS_TOKEN=
TWITTER_ACCESS_SECRET=
INSTAGRAM_ACCESS_TOKEN=
INSTAGRAM_BUSINESS_ACCOUNT_ID=
YOUTUBE_CLIENT_ID=
YOUTUBE_CLIENT_SECRET=
YOUTUBE_REFRESH_TOKEN=
```

### Implementation Estimate: 1 week

- Day 1-2: LinkedIn API (OAuth flow + post creation)
- Day 3-4: Twitter/X API (tweet + thread + media upload)
- Day 5: Instagram Graph API (business account setup)
- Day 6-7: Unified distribute.js orchestrator + error handling

---

## 5. Updated Weekly Workflow

```bash
# Monday-Thursday: Publish picks (existing)
npm run publish -- NVDA --strategy "iron condor" --expiry 2026-05-29
npm run publish -- SLV --strategy "iron condor" --expiry 2026-05-29
npm run publish -- GLD --strategy "iron condor" --expiry 2026-05-29

# Thursday: Generate ALL content assets (NEW)
npm run content -- --week 2026-W20
#  → PDFs (existing)
#  → Videos per pick (Remotion: vertical + horizontal + square)
#  → Social cards (Puppeteer: LinkedIn + Twitter + Instagram PNGs)
#  → Social copy (Claude: platform-specific captions)
#  → picks.json + video-script.md (existing)

# Friday morning: One-click publish everywhere (NEW)
npm run distribute -- --week 2026-W20
#  → LinkedIn posts (3 picks with cards + video)
#  → Twitter threads (3 picks with cards)
#  → Instagram posts (3 picks with video)
#  → YouTube Shorts (3 picks, vertical video)
#  → Email newsletter (existing)

# Following Friday: Close week
npm run close
```

---

## 6. Output Directory Structure (After Enhancement)

```
output/2026-W20/
├── enriched/
│   ├── BABA-iron-condor.json
│   ├── GLD-iron-condor.json
│   └── SLV-iron-condor.json
├── pdf/
│   ├── BABA-Iron-Condor.pdf
│   ├── GLD-Iron-Condor.pdf
│   └── SLV-Iron-Condor.pdf
├── video/                          ← NEW
│   ├── BABA-iron-condor-vertical.mp4    (9:16, 60s)
│   ├── BABA-iron-condor-horizontal.mp4  (16:9, 2min)
│   ├── BABA-iron-condor-square.mp4      (1:1, 45s)
│   ├── GLD-iron-condor-vertical.mp4
│   ├── GLD-iron-condor-horizontal.mp4
│   ├── GLD-iron-condor-square.mp4
│   ├── SLV-iron-condor-vertical.mp4
│   ├── SLV-iron-condor-horizontal.mp4
│   └── SLV-iron-condor-square.mp4
├── social/                         ← NEW
│   ├── BABA-linkedin.png    (1200x627)
│   ├── BABA-twitter.png     (1200x675)
│   ├── BABA-instagram.png   (1080x1080)
│   ├── GLD-linkedin.png
│   ├── GLD-twitter.png
│   ├── GLD-instagram.png
│   ├── SLV-linkedin.png
│   ├── SLV-twitter.png
│   └── SLV-instagram.png
├── copy/                           ← NEW
│   ├── BABA-social-copy.json
│   ├── GLD-social-copy.json
│   └── SLV-social-copy.json
├── picks.json
└── video-script.md
```

---

## 7. New npm Scripts

```json
{
  "scripts": {
    "publish": "node publish-pick.cjs",
    "content": "node generate-content.js",
    "content:video": "node generate-content.js --video-only",
    "content:social": "node generate-content.js --social-only",
    "content:copy": "node generate-content.js --copy-only",
    "distribute": "node distribute.js",
    "distribute:linkedin": "node distribute.js --linkedin-only",
    "distribute:twitter": "node distribute.js --twitter-only",
    "distribute:instagram": "node distribute.js --instagram-only"
  }
}
```

---

## 8. New Dependencies

```json
{
  "dependencies": {
    "remotion": "^4.0.0",
    "@remotion/cli": "^4.0.0",
    "@remotion/renderer": "^4.0.0",
    "twitter-api-v2": "^1.17.0",
    "googleapis": "^140.0.0"
  }
}
```

---

## 9. Implementation Priority

| Phase | Feature | Effort | Impact |
|-------|---------|--------|--------|
| **Phase 1** | Social cards (Puppeteer) + Copy (Claude) | 1 week | High — immediate social presence |
| **Phase 2** | Distribution engine (LinkedIn + Twitter) | 1 week | High — automation saves 30min/pick |
| **Phase 3** | Video rendition (Remotion) | 2 weeks | Very High — professional content at scale |
| **Phase 4** | Instagram + YouTube Shorts | 1 week | Medium — expanded reach |

**Total: 5 weeks to full content engine.**

**Quick wins (can ship in 3 days):**
1. Social card HTML templates + Puppeteer screenshots
2. Claude-generated captions per platform
3. Twitter thread auto-publishing

---

## 10. Cost Analysis

| Component | Monthly Cost |
|-----------|-------------|
| Remotion | $0 (free for solo dev) |
| Puppeteer | $0 (already installed) |
| Claude CLI (copy gen) | $0 (already have access) |
| LinkedIn API | $0 (free) |
| Twitter/X API | $0 (free tier) |
| Instagram API | $0 (free via Meta) |
| YouTube API | $0 (free quota) |
| **Total** | **$0/month** |

Everything can be built on free tiers. The only cost is development time.
