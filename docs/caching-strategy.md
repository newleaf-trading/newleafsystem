# NewLeaf Caching Strategy

## Overview

Six API-level caches reduce LLM costs, latency, and external API load. Each cache is tuned to the data's natural freshness window.

## Cache Layers

### 1. Indicators Cache — 5 min
- **Endpoint:** `GET /api/indicators/:ticker`
- **Key:** ticker (e.g. `AAPL`)
- **What's cached:** RSI, MACD, Bollinger, SMA 20/50/100/200, ADX, ATR
- **Why cacheable:** Computed from 250 daily bars. Bars don't change intraday. Recomputing every request wastes ~800ms.
- **Savings:** ~800ms latency, 2 Alpaca API calls (bars + snapshot) per hit
- **Max entries:** 50

### 2. AI Read Cache — 5 min
- **Endpoint:** `POST /api/ai-read`
- **Key:** ticker (e.g. `AAPL`)
- **What's cached:** One-sentence market synthesis from LLM
- **Why cacheable:** Same ticker at the same time has the same market state. RSI/ADX/trend are daily — the synthesis doesn't change in 5 minutes.
- **Savings:** $0.003 + ~3s per cache hit (1 LLM call avoided)
- **Max entries:** 50
- **LLM model saved:** QwQ (DashScope)

### 3. Recommend Cache — 10 min
- **Endpoint:** `POST /api/recommend`
- **Key:** `{ticker}:{expiry}` (e.g. `AAPL:2026-06-12`)
- **What's cached:** 3 ranked strategies with scores, legs, rationale
- **Why cacheable:** Same ticker + expiry = same market data = same strategy ranking. The underlying data (chain, OI, indicators) doesn't shift meaningfully in 10 minutes.
- **Savings:** $0.01 + ~5s per cache hit (1 LLM call + 4 API calls avoided)
- **Max entries:** 30
- **LLM model saved:** Claude Sonnet or QwQ (depending on modelMode)

### 4. Sentiment Cache — 30 min
- **Endpoint:** `GET /api/sentiment/:ticker`
- **Key:** ticker (e.g. `AAPL`)
- **What's cached:** 4-engine composite sentiment (Claude + Grok + Gemini + Reddit)
- **Why cacheable:** News and social sentiment don't change meaningfully in 30 minutes. This is the most expensive cached endpoint — 4 parallel LLM calls.
- **Savings:** $0.01-0.03 + ~30s per cache hit (4 LLM calls + 2 HTTP calls avoided)
- **Max entries:** 30
- **LLM models saved:** Claude Haiku, Grok, Gemini Flash

### 5. Verify Cache — 30 min
- **Endpoint:** `POST /verify`
- **Key:** SHA256 of `{ticker + sorted legs JSON + modelMode}` (first 16 chars)
- **What's cached:** Full 8-agent verdict with evidence, debate, risk report, mutations
- **Why cacheable:** Same legs = same trade = same verdict. Re-verifying an unchanged trade within 30 minutes should not burn a daily credit ($0.05 + 24s).
- **Savings:** $0.05 + ~24s per cache hit (8 LLM calls avoided). Also saves 1 daily credit.
- **Max entries:** 20
- **LLM models saved:** DeepSeek, Claude Sonnet, Claude Haiku (8 agents total)

### 6. Gamma Analysis Cache — 60 min
- **Endpoint:** `GET /api/gamma-analysis/:ticker/:expiry`
- **Key:** `{ticker}:{expiry}` (e.g. `AAPL:2026-06-12`)
- **What's cached:** GEX walls, ATM IV, confidence scores, top gamma strikes
- **Why cacheable:** OI (Open Interest) updates once daily after market close (~5:30 PM ET). During trading hours, OI is yesterday's number. 60 minutes is very conservative.
- **Savings:** ~2s per cache hit (1 Yahoo OI Service call avoided, which itself has a 60-min cache)
- **Max entries:** 50

## What is NOT cached

| Endpoint | Why | Could we add cache? |
|---|---|---|
| `GET /api/snapshot/:ticker` | Real-time price — must be current for trading decisions | Maybe 30s via Cloudflare edge, but risky for live trading |
| `GET /api/chain/:ticker/:expiry` | Real-time bid/ask changes with every trade | Maybe 60s, but stale premiums cause incorrect P&L calculations |
| `POST /api/llm/call` | Generic LLM proxy — arbitrary prompts from genrecs scripts | No — each prompt is unique (analysis of specific tile data) |
| `POST /api/chat` | Conversational — context changes with each message | No — stateful conversation |
| `POST /api/publish-from-analysis` | Write operation — creates Firestore documents | No — must execute every time |
| `POST /api/adjust` | Position-specific advice with current market state | Maybe 5 min by position ID |
| `POST /api/event-risk` | Time-sensitive event analysis | Maybe 15 min |

## LLM Call Analysis

| LLM Call | Frequency | Cost | Cacheable? | Cache TTL | Reason |
|---|---|---|---|---|---|
| AI Read (QwQ) | Every snapshot load | $0.003 | **Yes** | 5 min | Same ticker = same daily indicators |
| Recommend (Claude/QwQ) | Every "Find strategies" | $0.01 | **Yes** | 10 min | Same ticker+expiry = same chain data |
| Sentiment: Claude Haiku | Every sentiment call | $0.003 | **Yes** | 30 min | News doesn't change in 30 min |
| Sentiment: Grok | Every sentiment call | $0.003 | **Yes** | 30 min | X/Twitter sentiment stable short-term |
| Sentiment: Gemini Flash | Every sentiment call | $0.001 | **Yes** | 30 min | Google News stable short-term |
| Verify: 8 agents | Every "Verify trade" | $0.05 | **Yes** | 30 min | Same legs = same verdict |
| GenRecs: analysis (Sonnet) | publish-pick.cjs | $0.03 | **No** | — | Unique prompt per tile |
| Chat (model varies) | Interactive chat | $0.01 | **No** | — | Stateful conversation |

## Cost Impact

### Before caching (every request hits LLM):
```
Full discover flow: ~$0.07, ~35s
10 users × 3 tickers each: ~$2.10/day
```

### After caching (2nd+ requests for same ticker use cache):
```
First user per ticker: ~$0.07, ~35s (cold miss)
Next 9 users same ticker: ~$0.00, ~5s (cache hits)
10 users × 3 tickers: ~$0.21/day (90% savings)
```

### Monthly projection:
- Without cache: ~$63/month (30 days × $2.10)
- With cache: ~$6.30/month
- **Savings: ~$57/month (90%)**

## Monitoring

Cache stats available at `GET /admin/cache-stats`:
```json
{
  "indicators": { "entries": 12, "hitRate": 78.5, "totalHits": 156, "totalMisses": 43 },
  "aiRead":     { "entries": 8,  "hitRate": 65.0, "totalHits": 39,  "totalMisses": 21 },
  "recommend":  { "entries": 5,  "hitRate": 45.0, "totalHits": 9,   "totalMisses": 11 },
  "sentiment":  { "entries": 6,  "hitRate": 72.0, "totalHits": 18,  "totalMisses": 7 },
  "verify":     { "entries": 3,  "hitRate": 33.0, "totalHits": 2,   "totalMisses": 4 },
  "gamma":      { "entries": 10, "hitRate": 80.0, "totalHits": 40,  "totalMisses": 10 }
}
```

## Cache Invalidation

All caches use TTL-based expiration only. No manual invalidation mechanism.

**When caches clear:**
- Container restart (Cloud Functions cold start) clears all caches
- TTL expiry (each cache has its own TTL)
- Max entries reached → oldest 20% pruned

**When caches should NOT be used:**
- During market-moving events (FOMC, earnings) where 5-minute-old data is stale
- Future: add a `/admin/cache-clear` endpoint for manual invalidation
