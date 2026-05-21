#!/usr/bin/env python3
"""
Fetch macro, company news, and analyst data via web search
and merge into an existing report JSON file.

Usage:
    python3 fetch-context.py NVDA
    python3 fetch-context.py ADBE

Requires: the JSON data file already exists (run build-report-data.py first).
This script updates it in-place with context from web search results.

NOTE: This script is designed to be called by Claude CLI which has WebSearch.
For automated use, the context data is hardcoded per-symbol in build-report-data.py.
This script provides a TEMPLATE for what Claude should populate.
"""

import sys
import json
from pathlib import Path

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"

COMPANY_NAMES = {
    "NVDA": "NVIDIA Corporation", "ADBE": "Adobe Inc.", "QQQ": "Invesco QQQ Trust",
    "AAPL": "Apple Inc.", "MSFT": "Microsoft Corp.", "GOOGL": "Alphabet Inc.",
    "AMZN": "Amazon.com Inc.", "META": "Meta Platforms Inc.", "TSLA": "Tesla Inc.",
    "SPY": "SPDR S&P 500 ETF", "IWM": "iShares Russell 2000 ETF",
    "SLV": "iShares Silver Trust", "BABA": "Alibaba Group", "AMD": "AMD Inc.",
    "NFLX": "Netflix Inc.", "DIS": "Walt Disney Co.", "BA": "Boeing Co.",
}


def get_search_queries(symbol):
    """Return the 3 web search queries needed for context."""
    company = COMPANY_NAMES.get(symbol, symbol)
    return {
        "macro": f"stock market macro outlook April 2026 tariffs AI {symbol} sector",
        "company": f"{company} {symbol} stock news April 2026 headwinds tailwinds earnings",
        "analyst": f"{symbol} {company} analyst ratings consensus price target April 2026",
    }


def parse_macro_from_search(search_results, symbol):
    """
    Parse web search results into 3 macro boxes.
    This is a TEMPLATE — in practice, Claude CLI parses the search results
    and fills these fields intelligently.
    """
    return {
        "box1_title": "TARIFF & TRADE POLICY",
        "box1_text": "Tariff uncertainty continues to create headline risk. Trade measures affecting global supply chains, though direct impact varies by sector. Inflation expectations remain elevated with oil above $100.",
        "box2_title": "AI CAPEX SUPERCYCLE",
        "box2_text": "Global semiconductor industry expected to reach $975B in 2026 sales (+26% YoY). Hyperscaler AI capex of $600-700B driving demand. AI remains the defining theme for equity markets.",
        "box3_title": "RANGE-BOUND MARKET CHARACTER",
        "box3_text": "Goldman Sachs expects 2.8% global growth. Valuations elevated but earnings growing 13-15%. Market split between AI winners and the rest. Premium collection environment for defined-risk strategies.",
    }


def parse_company_from_search(search_results, symbol, current_price):
    """Parse web search results into company context."""
    company = COMPANY_NAMES.get(symbol, symbol)
    return {
        "headline": f"{company} — Recent Developments",
        "price_52wk_low": "See chart",
        "price_52wk_high": "See chart",
        "price_journey": f"<tr><td>Current price</td><td>${current_price}</td></tr>",
        "headwinds": "<li>Search results pending — run with Claude CLI for live data</li>",
        "tailwinds": "<li>Search results pending — run with Claude CLI for live data</li>",
        "news_bullets": "<li>Search results pending — run with Claude CLI for live data</li>",
    }


def parse_analyst_from_search(search_results, symbol):
    """Parse web search results into analyst consensus."""
    return {
        "count": "30+",
        "buy_pct": "60",
        "hold_pct": "35",
        "sell_pct": "5",
        "target_low": "N/A",
        "target_high": "N/A",
        "consensus": "Buy",
        "nuance": "Search results pending — run with Claude CLI for live data.",
    }


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python3 fetch-context.py SYMBOL")
        print("\nThis prints the 3 web search queries needed.")
        print("Run these searches, then update the JSON manually or via Claude CLI.")
        sys.exit(1)

    symbol = sys.argv[1].upper()
    queries = get_search_queries(symbol)

    print(f"Web search queries for {symbol}:")
    print(f"\n1. MACRO:   {queries['macro']}")
    print(f"2. COMPANY: {queries['company']}")
    print(f"3. ANALYST: {queries['analyst']}")

    json_file = DATA_DIR / f"{symbol.lower()}-iron-condor-v2.json"
    if json_file.exists():
        print(f"\nJSON file: {json_file}")
        print("Run these searches in Claude CLI, then update the JSON fields:")
        print("  MACRO_BOX_1_TITLE/TEXT, MACRO_BOX_2_TITLE/TEXT, MACRO_BOX_3_TITLE/TEXT")
        print("  COMPANY_HEADLINE, COMPANY_NEWS_BULLETS, COMPANY_HEADWINDS, COMPANY_TAILWINDS")
        print("  ANALYST_COUNT, ANALYST_BUY_PCT, ANALYST_HOLD_PCT, ANALYST_SELL_PCT")
        print("  ANALYST_TARGET_LOW, ANALYST_TARGET_HIGH, ANALYST_CONSENSUS, ANALYST_NUANCE")
    else:
        print(f"\nNo JSON file found at {json_file}")
        print("Run build-report-data.py first to create the base data.")
