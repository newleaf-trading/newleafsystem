#!/usr/bin/env python3
"""
NewLeaf Yahoo Options Service — port 5300
Provides option chain data (including Open Interest) via yfinance.
Yahoo Finance blocks direct Node.js calls — this Python wrapper is the solution.

Endpoints:
  GET /health
  GET /api/options/{symbol}          → expiry dates + current price
  GET /api/options/{symbol}/{expiry} → full chain with real OI per strike

Caching: OI data changes once per day (after market close ~5:30 PM ET).
Responses are cached in-memory for 60 minutes to avoid Yahoo rate limits.

Start: python option_api.py
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import yfinance as yf
import pandas as pd
from datetime import datetime
import traceback
import time
import threading
from greeks_calculator import calculate_greeks, years_to_expiration

app = Flask(__name__)
CORS(app)

# ── In-memory cache ──────────────────────────────────────────────────────────
# OI updates once daily after market close. 60-minute cache is very safe.
CACHE_TTL = 3600  # 60 minutes in seconds
_cache = {}
_cache_lock = threading.Lock()

def cache_get(key):
    with _cache_lock:
        entry = _cache.get(key)
        if entry and (time.time() - entry['ts']) < CACHE_TTL:
            return entry['data']
        return None

def cache_set(key, data):
    with _cache_lock:
        _cache[key] = {'data': data, 'ts': time.time()}
        # Prune old entries (keep max 200)
        if len(_cache) > 200:
            oldest = sorted(_cache.items(), key=lambda x: x[1]['ts'])
            for k, _ in oldest[:50]:
                del _cache[k]

# ── Helpers ──────────────────────────────────────────────────────────────────

def format_option_data(df, option_type='call'):
    if df.empty:
        return []
    records = []
    for idx, row in df.iterrows():
        records.append({
            'contractSymbol': row.get('contractSymbol', ''),
            'strike':         float(row.get('strike', 0)),
            'lastPrice':      float(row.get('lastPrice', 0)),
            'bid':            float(row.get('bid', 0)),
            'ask':            float(row.get('ask', 0)),
            'midPrice':       (float(row.get('bid', 0)) + float(row.get('ask', 0))) / 2,
            'volume':         int(row.get('volume', 0))       if not pd.isna(row.get('volume'))       else 0,
            'openInterest':   int(row.get('openInterest', 0)) if not pd.isna(row.get('openInterest')) else 0,
            'impliedVolatility': float(row.get('impliedVolatility', 0)),
            'inTheMoney':     bool(row.get('inTheMoney', False)),
            'optionType':     option_type
        })
    return records

# ── Endpoints ────────────────────────────────────────────────────────────────

@app.route('/health')
def health():
    return jsonify({
        'status': 'healthy',
        'service': 'NewLeaf Yahoo Options Service',
        'timestamp': datetime.now().isoformat(),
        'cacheSize': len(_cache),
        'cacheTTL': CACHE_TTL,
    })

@app.route('/api/options/<symbol>')
def get_expirations(symbol):
    sym = symbol.upper()
    cache_key = f'expirations:{sym}'
    cached = cache_get(cache_key)
    if cached:
        return jsonify({**cached, 'cached': True})

    try:
        ticker = yf.Ticker(sym)
        expirations = ticker.options
        info = ticker.info
        price = info.get('currentPrice') or info.get('regularMarketPrice', 0)
        result = {'symbol': sym, 'currentPrice': price, 'expirations': list(expirations), 'expirationCount': len(expirations)}
        cache_set(cache_key, result)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/options/<symbol>/<expiry>')
def get_chain(symbol, expiry):
    sym = symbol.upper()
    cache_key = f'chain:{sym}:{expiry}'
    cached = cache_get(cache_key)
    if cached:
        return jsonify({**cached, 'cached': True})

    try:
        ticker = yf.Ticker(sym)
        info = ticker.info
        price = info.get('currentPrice') or info.get('regularMarketPrice', 0)
        chain = ticker.option_chain(expiry)
        calls = format_option_data(chain.calls, 'call')
        puts  = format_option_data(chain.puts,  'put')
        result = {
            'symbol': sym, 'currentPrice': price, 'expiration': expiry,
            'calls': calls, 'puts': puts,
            'summary': {
                'totalCallOI': sum(c['openInterest'] for c in calls),
                'totalPutOI':  sum(p['openInterest'] for p in puts),
                'callCount': len(calls), 'putCount': len(puts)
            }
        }
        cache_set(cache_key, result)
        return jsonify(result)
    except Exception as e:
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 400

if __name__ == '__main__':
    PORT = int(__import__('os').environ.get('PORT', 5300))
    print(f"\n  NewLeaf Yahoo Options Service → http://localhost:{PORT}")
    print(f"  Cache TTL: {CACHE_TTL}s ({CACHE_TTL // 60} minutes)")
    print(f"  Endpoints: /health  /api/options/SYMBOL  /api/options/SYMBOL/EXPIRY\n")
    app.run(host='0.0.0.0', port=PORT, debug=False, threaded=False, processes=1)
