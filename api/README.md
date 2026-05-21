# newleaf-api

Standalone API deployed on Firebase Cloud Functions serving market data, AI-powered strategy recommendations, multi-agent trade verification, and multi-engine sentiment analysis.

**Deployed URL:** `https://us-central1-newleaf-trading.cloudfunctions.net/api`

## Quick Start

```bash
cp .env.example .env   # fill in credentials
npm install
npm run dev            # local dev server on :5400
```

## Endpoints

| Method | Path | Tier | Description |
|--------|------|------|-------------|
| GET | `/health` | none | Health check |
| GET | `/api/snapshot/:ticker` | free | Price snapshot + expiration dates |
| GET | `/api/indicators/:ticker` | basic | Technical indicators (RSI, ADX, ATR, SMAs, Bollinger) |
| GET | `/api/chain/:ticker/:expiry` | basic | Full option chain with Greeks |
| GET | `/api/gamma/:ticker/:expiry` | basic | Gamma wall / OI distribution |
| GET | `/api/bars/:ticker` | basic | Historical daily OHLCV bars |
| GET | `/api/sentiment/:ticker` | basic | Multi-engine sentiment (Grok, Gemini, Reddit, StockTwits) |
| POST | `/api/ai-read` | premium | Single-line AI market read |
| POST | `/api/recommend` | premium | AI strategy recommendation (3 ranked strategies) |
| POST | `/api/chat` | premium | Follow-up conversational Q&A |
| POST | `/verify` | premium | Full 10-agent verification pipeline (~30s) |
| GET | `/status/:jobId` | premium | Poll async verification job status |
| POST | `/admin/keys` | admin | Create API key |
| GET | `/admin/keys` | admin | List API keys (prefix only) |
| DELETE | `/admin/keys/:id` | admin | Deactivate API key |

## RBAC Tiers

All requests require `X-API-Key` header (except `/health`).

| Tier | Access |
|------|--------|
| **free** | Snapshot only |
| **basic** | Market data, indicators, chain, gamma, bars, sentiment |
| **premium** | AI endpoints (ai-read, recommend, chat, verify) |
| **admin** | Key management |

## Model Routing

| Mode | Model | Provider |
|------|-------|----------|
| `premium` | Qwen Max | DashScope (via Cloudflare Worker proxy) |
| `budget-v3` | DeepSeek V3 | DeepSeek |
| `budget-r1` | DeepSeek Reasoner | DeepSeek |
| `budget-qwq` | Qwen Plus | DashScope (via Cloudflare Worker proxy) |

**Architecture note:** Qwen models (DashScope) are routed through a Cloudflare Worker proxy because DashScope blocks requests originating from GCP IP ranges.

## Deployment

```bash
npm run build && firebase deploy --only functions
```

Or shorthand:

```bash
npm run deploy
```

## Environment Variables

```
# Firebase
FIREBASE_PROJECT_ID=newleaf-trading
FIREBASE_CLIENT_EMAIL=...
FIREBASE_PRIVATE_KEY=...

# Market Data
ALPACA_API_KEY=...
ALPACA_API_SECRET=...

# LLM Providers
DASHSCOPE_API_KEY=...
DEEPSEEK_API_KEY=...
ANTHROPIC_API_KEY=...
OPENAI_API_KEY=...
GOOGLE_AI_KEY=...
XAI_API_KEY=...

# Cloudflare Worker (Qwen proxy)
CF_WORKER_URL=...

# Sentiment
REDDIT_CLIENT_ID=...
REDDIT_CLIENT_SECRET=...
```

## Creating API Keys

Via CLI script:

```bash
npx tsx scripts/create-api-key.ts --name "my-service" --role premium --owner "user-123"
```

Via admin API (requires admin key):

```bash
curl -X POST -H "X-API-Key: $ADMIN_KEY" \
  -H "Content-Type: application/json" \
  -d '{"name":"my-service","role":"basic","ownerId":"service-id"}' \
  https://us-central1-newleaf-trading.cloudfunctions.net/api/admin/keys
```

Roles: `free`, `basic`, `premium`, `admin`
