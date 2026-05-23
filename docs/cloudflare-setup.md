# Cloudflare Setup: api.newleafsystem.com

## Goal

Put the NewLeaf API behind Cloudflare using a custom domain `api.newleafsystem.com` instead of the raw Firebase Cloud Functions URL (`us-central1-newleaf-trading.cloudfunctions.net/api`).

**Benefits:**
- Clean domain (no Google infrastructure in the URL)
- DDoS protection (Cloudflare proxy)
- Rate limiting (protect expensive /verify endpoint)
- Caching for GET endpoints (snapshot, indicators)
- Analytics (request volume, geographic distribution)
- SSL termination at edge

## Prerequisites

- Cloudflare account with `newleafsystem.com` DNS managed there
- Firebase project `newleaf-trading` with Cloud Functions deployed
- Current production URL: `https://us-central1-newleaf-trading.cloudfunctions.net/api`

---

## Step 1: Cloudflare DNS

Go to: **Cloudflare Dashboard → newleafsystem.com → DNS → Records → Add Record**

```
Type:    CNAME
Name:    api
Target:  us-central1-newleaf-trading.cloudfunctions.net
Proxy:   ON (orange cloud)
TTL:     Auto
```

This creates `api.newleafsystem.com` pointing to the Firebase Cloud Functions origin, with Cloudflare proxy in front.

**Note:** The proxy (orange cloud) is required for DDoS protection and rate limiting. If you turn it off (grey cloud), traffic goes direct to Firebase and Cloudflare features don't apply.

---

## Step 2: SSL/TLS

Go to: **Cloudflare Dashboard → newleafsystem.com → SSL/TLS → Overview**

```
Mode: Full (strict)
```

This means:
- Browser → Cloudflare: HTTPS (Cloudflare's cert)
- Cloudflare → Firebase: HTTPS (Firebase's cert)

Both legs are encrypted. "Full (strict)" validates Firebase's certificate.

---

## Step 3: Firebase Custom Domain (if needed)

Firebase Cloud Functions are invoked by URL path, not hostname. The CNAME approach works because Cloudflare forwards requests to the Firebase origin, and Firebase serves them regardless of the `Host` header.

**However**, if Firebase rejects requests with a non-Firebase `Host` header, you may need to add a Cloudflare Transform Rule to rewrite the Host header:

Go to: **Cloudflare Dashboard → Rules → Transform Rules → Modify Request Header**

```
Rule name: Rewrite Host for API
When:      Hostname equals "api.newleafsystem.com"
Then:      Set header "Host" to "us-central1-newleaf-trading.cloudfunctions.net"
```

**Test first without this rule** — Firebase Cloud Functions usually accept any Host header. Only add if you get 404s.

---

## Step 4: Path Rewriting

The current Firebase URL structure is:
```
https://us-central1-newleaf-trading.cloudfunctions.net/api/api/snapshot/AAPL
                                                        ^^^
                                                     function name
```

The first `/api` is the Firebase function name. The second `/api` is the route path. When accessed via `api.newleafsystem.com`, the URL would be:

```
https://api.newleafsystem.com/api/snapshot/AAPL
```

If you want to remove the double `/api` and serve as:
```
https://api.newleafsystem.com/snapshot/AAPL
```

Add a Cloudflare Transform Rule:

Go to: **Cloudflare Dashboard → Rules → Transform Rules → Rewrite URL**

```
Rule name: Add /api prefix to origin
When:      Hostname equals "api.newleafsystem.com"
Then:      Rewrite path: concat("/api", http.request.uri.path)
```

**Recommendation:** Keep the `/api` prefix for now. It's clearer and matches the existing code. Revisit later if you want a cleaner URL.

---

## Step 5: Rate Limiting

Go to: **Cloudflare Dashboard → Security → WAF → Rate limiting rules**

### Rule 1: General API rate limit
```
Rule name:     API general rate limit
When:          URI Path starts with "/api/"
Rate:          60 requests per 1 minute
Per:           IP address
Action:        Block (429)
Duration:      1 minute
```

### Rule 2: Verify endpoint (expensive — 8 agents, ~$0.05/call)
```
Rule name:     Verify rate limit
When:          URI Path equals "/verify" AND Method equals "POST"
Rate:          5 requests per 1 minute
Per:           IP address
Action:        Block (429)
Duration:      1 minute
```

### Rule 3: LLM call endpoint
```
Rule name:     LLM call rate limit
When:          URI Path starts with "/api/llm/"
Rate:          20 requests per 1 minute
Per:           IP address
Action:        Block (429)
Duration:      1 minute
```

---

## Step 6: Caching (Optional)

GET endpoints with stable data can be cached at the Cloudflare edge:

Go to: **Cloudflare Dashboard → Caching → Cache Rules**

### Cache snapshot data (1 minute)
```
When:          URI Path starts with "/api/snapshot/"
Cache:         Eligible
Edge TTL:      60 seconds
Browser TTL:   30 seconds
```

### Cache indicators (5 minutes — computed from 250 daily bars, stable intraday)
```
When:          URI Path starts with "/api/indicators/"
Cache:         Eligible
Edge TTL:      300 seconds
Browser TTL:   60 seconds
```

### Cache gamma analysis (2 minutes)
```
When:          URI Path starts with "/api/gamma"
Cache:         Eligible
Edge TTL:      120 seconds
Browser TTL:   60 seconds
```

### DO NOT cache:
- POST endpoints (AI, verify, recommend)
- Admin endpoints
- Sentiment (changes frequently)

---

## Step 7: Update Application Configs

After the domain is live, update these files:

### web/workbench/discover.html (line ~11)
```javascript
// Before:
window.__CONFIG__ = { API_URL: "https://us-central1-newleaf-trading.cloudfunctions.net/api", ... };

// After:
window.__CONFIG__ = { API_URL: "https://api.newleafsystem.com", ... };
```

### web/workbench/strategy-builder.html (if it uses the API)
```javascript
window.__CONFIG__ = { API_URL: "https://api.newleafsystem.com", ... };
```

### generaterecommendations/.env
```
NEWLEAF_API_URL=https://api.newleafsystem.com
```

### desk/ (environment or config)
```
VITE_API_BASE_URL=https://api.newleafsystem.com
```

### web/src/trading/components/admin/ModelAssignmentsPanel.jsx
```javascript
const API_BASE = 'https://api.newleafsystem.com';
```

---

## Step 8: Verify

After DNS propagation (usually 1-5 minutes):

```bash
# Health check
curl https://api.newleafsystem.com/health

# Snapshot
curl -H "X-API-Key: your-key" https://api.newleafsystem.com/api/snapshot/AAPL

# Gamma analysis
curl -H "X-API-Key: your-key" https://api.newleafsystem.com/api/gamma-analysis/AAPL/2026-06-12

# Indicators
curl -H "X-API-Key: your-key" https://api.newleafsystem.com/api/indicators/AAPL

# Verify Cloudflare headers
curl -I https://api.newleafsystem.com/health
# Look for: cf-ray, cf-cache-status, server: cloudflare
```

---

## Step 9: CORS (if needed)

If the browser blocks cross-origin requests from `newleafsystem.com` to `api.newleafsystem.com`, the API already handles CORS via Fastify:

```typescript
// api/src/app.ts
fastify.register(cors, {
  origin: true,  // allows all origins
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type', 'X-API-Key', 'Authorization'],
});
```

This should work. If Cloudflare strips CORS headers, add them back via Transform Rules:

```
Response header: Access-Control-Allow-Origin: *
Response header: Access-Control-Allow-Headers: Content-Type, X-API-Key
```

---

## Rollback

If anything breaks, turn off the Cloudflare proxy (grey cloud the CNAME) and revert the config URLs to the Firebase direct URL. The Firebase function continues serving regardless.

---

## Summary Checklist

- [ ] Add CNAME `api` → Firebase Cloud Functions (proxy ON)
- [ ] SSL/TLS: Full (strict)
- [ ] Test: `curl https://api.newleafsystem.com/health`
- [ ] Add rate limiting rules (general, verify, LLM)
- [ ] Optional: add caching rules for GET endpoints
- [ ] Update `discover.html` API_URL
- [ ] Update `generaterecommendations/.env` NEWLEAF_API_URL
- [ ] Update `desk/` API_BASE
- [ ] Update `ModelAssignmentsPanel.jsx` API_BASE
- [ ] Test full flow: discover → snapshot → strategies → verify → verdict
- [ ] Test genrecs: `npm run publish -- AAPL --strategy "iron condor" --expiry 2026-07-18`
- [ ] Test desk: `newleaf-desk.web.app` loads model assignments
