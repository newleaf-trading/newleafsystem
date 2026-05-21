#!/usr/bin/env python3
"""
NewLeaf Yahoo Options Service — port 5300
Provides option chain data (including Open Interest) via yfinance.
Yahoo Finance blocks direct Node.js calls — this Python wrapper is the solution.

Endpoints used by newleaf-pipeline.js:
  GET /health
  GET /api/options/{symbol}          → expiry dates + current price
  GET /api/options/{symbol}/{expiry} → full chain with real OI per strike

Start: python option_api.py
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
import yfinance as yf
import pandas as pd
from datetime import datetime
import traceback
from greeks_calculator import calculate_greeks, years_to_expiration

app = Flask(__name__)
CORS(app)

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

@app.route('/health')
def health():
    return jsonify({'status': 'healthy', 'service': 'NewLeaf Yahoo Options Service', 'timestamp': datetime.now().isoformat()})

@app.route('/api/options/<symbol>')
def get_expirations(symbol):
    try:
        ticker = yf.Ticker(symbol.upper())
        expirations = ticker.options
        info = ticker.info
        price = info.get('currentPrice') or info.get('regularMarketPrice', 0)
        return jsonify({'symbol': symbol.upper(), 'currentPrice': price, 'expirations': list(expirations), 'expirationCount': len(expirations)})
    except Exception as e:
        return jsonify({'error': str(e)}), 400

@app.route('/api/options/<symbol>/<expiry>')
def get_chain(symbol, expiry):
    try:
        ticker = yf.Ticker(symbol.upper())
        info = ticker.info
        price = info.get('currentPrice') or info.get('regularMarketPrice', 0)
        chain = ticker.option_chain(expiry)
        calls = format_option_data(chain.calls, 'call')
        puts  = format_option_data(chain.puts,  'put')
        return jsonify({
            'symbol': symbol.upper(), 'currentPrice': price, 'expiration': expiry,
            'calls': calls, 'puts': puts,
            'summary': {
                'totalCallOI': sum(c['openInterest'] for c in calls),
                'totalPutOI':  sum(p['openInterest'] for p in puts),
                'callCount': len(calls), 'putCount': len(puts)
            }
        })
    except Exception as e:
        return jsonify({'error': str(e), 'traceback': traceback.format_exc()}), 400

if __name__ == '__main__':
    PORT = int(__import__('os').environ.get('PORT', 5300))
    print(f"\n  NewLeaf Yahoo Options Service → http://localhost:{PORT}")
    print(f"  Endpoints: /health  /api/options/SYMBOL  /api/options/SYMBOL/EXPIRY\n")
    # threaded=False + processes=1 prevents thread pool exhaustion
    # yfinance is not thread-safe — requests must be sequential
    app.run(host='0.0.0.0', port=PORT, debug=False, threaded=False, processes=1)
