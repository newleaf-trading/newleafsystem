# Yahoo Options Service

**This service is deployed as a Firebase Cloud Function (2nd gen). Always use the cloud version — do not run locally in production.**

## Cloud URL

```
https://yahoo-options-svc-m2cty2vxuq-uc.a.run.app
```

Pipeline reads this from `config.json -> yahoosvc.url`.

## Endpoints

```
GET /health                          -> { status, service, timestamp }
GET /api/options/{SYMBOL}            -> { symbol, currentPrice, expirations[] }
GET /api/options/{SYMBOL}/{EXPIRY}   -> { symbol, currentPrice, calls[], puts[], summary }
```

## Redeployment

```bash
cd yahoo-svc
firebase deploy --only functions
```

Requires Firebase CLI (`npm i -g firebase-tools`) and login (`firebase login`).

## Specs

- Firebase project: `newleaf-trading`
- Runtime: Python 3.10 (2nd gen Cloud Function)
- Memory: 1024 MB
- Timeout: 120s
- Max instances: 2 (scales to zero when idle)
- Concurrency: 1 per instance (yfinance is not thread-safe)
- CORS: all origins, GET only

## Local development (not for production)

```bash
./start.sh        # Runs Flask dev server on port 5300
```
