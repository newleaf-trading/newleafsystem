#!/usr/bin/env python3
"""
Generate HeyGen video narration script from report JSON data.

Usage:
    python3 generate-script.py CRM
    python3 generate-script.py NVDA
    python3 generate-script.py CRM --short    # 6-slide condensed version

Output: output/scripts/{SYMBOL}-video-script.md
"""

import sys
import json
from pathlib import Path
from datetime import datetime

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
OUTPUT_DIR = BASE_DIR / "output" / "scripts"

COMPANY_NAMES = {
    "NVDA": "NVIDIA", "ADBE": "Adobe", "QQQ": "QQQ", "CRM": "Salesforce",
    "AAPL": "Apple", "MSFT": "Microsoft", "GOOGL": "Alphabet",
    "AMZN": "Amazon", "META": "Meta", "TSLA": "Tesla",
    "SPY": "the S&P 500 ETF", "SLV": "the Silver ETF",
}


def generate_full_script(d):
    """Generate 10-slide full video script."""
    sym = d["SYMBOL"]
    name = COMPANY_NAMES.get(sym, sym)
    credit = d["NET_CREDIT"]
    mp = d["MAX_PROFIT"]
    ml = d["MAX_LOSS"]
    wr = d["WIN_RATE"]
    sp = d["SHORT_PUT_STRIKE"]
    sc = d["SHORT_CALL_STRIKE"]
    lp = d["LONG_PUT_STRIKE"]
    lc = d["LONG_CALL_STRIKE"]
    price = d["CURRENT_PRICE"]
    expiry = d["EXPIRATION_DATE"]
    dte = d["DAYS_TO_EXPIRY"]
    be = d["BREAKEVEN_RANGE"]
    score = d["TRADE_SCORE"]
    conf = d["CONFIDENCE_LEVEL"]
    theta = d["THETA_VALUE"]
    pw = d["PUT_GAMMA_WALL"]
    cw = d["CALL_GAMMA_WALL"]

    slides = []
    has_macro = bool(d.get("HAS_MACRO"))
    has_company = bool(d.get("HAS_COMPANY"))
    has_analyst = bool(d.get("HAS_ANALYST"))

    # Slide 1: Cover / Hook
    slides.append({
        "title": "Cover — The Trade",
        "duration": "30s",
        "script": f"""Welcome to NewLeaf System. Today we're looking at {name}, ticker {sym}, currently trading at {price}.

We're building an Iron Condor — a defined-risk options strategy that profits when the stock stays within a range. Our target? Collect {credit} per share in premium, for a max profit of {mp} per contract, with a {wr}% probability of success.

Let me walk you through exactly why this trade works right now."""
    })

    # Slide 2: Macro Environment (skip if no data)
    import re
    def first_sentences(text, n=2):
        sents = re.split(r'(?<=[.!?])\s+', text.strip()) if text else []
        return ' '.join(sents[:n])

    if has_macro:
        m1 = d.get("MACRO_BOX_1_TITLE", "")
        m1t = d.get("MACRO_BOX_1_TEXT", "")
        m2 = d.get("MACRO_BOX_2_TITLE", "")
        m2t = d.get("MACRO_BOX_2_TEXT", "")
        m3 = d.get("MACRO_BOX_3_TITLE", "")
        m3t = d.get("MACRO_BOX_3_TEXT", "")
        slides.append({
            "title": "Macro Environment",
            "duration": "45s",
            "script": f"""Before we get into the trade, let's understand the macro backdrop.

First, {m1.lower().replace('&', 'and')}. {first_sentences(m1t)}

Second, {m2.lower().replace('&', 'and')}. {first_sentences(m2t)}

And third, {m3.lower().replace('&', 'and')}. {first_sentences(m3t)}

This environment — volatile enough for premium but range-bound enough for our strikes — is exactly where iron condors thrive."""
        })

    # Slide 3: Company News (skip if no data)
    if has_company:
        news = d.get("COMPANY_NEWS_BULLETS", "")
        news_clean = re.sub(r'</li>\s*<li>', '|||', news)
        news_clean = re.sub(r'<[^>]+>', '', news_clean).replace('&amp;', 'and').replace('&ndash;', 'to').replace('&mdash;', ' -- ')
        bullets = [b.strip() for b in news_clean.split('|||') if b.strip()][:4]
        news_narration = '. '.join(bullets) + '.' if bullets else "No major catalysts in our trading window."
        slides.append({
            "title": "Company News",
            "duration": "40s",
            "script": f"""Now let's look at what's happening specifically with {name}.

{news_narration}

On the headwinds side, we're watching competition and valuation pressure. But on the tailwinds side, strong fundamentals and growth momentum provide a floor.

The key takeaway? No earnings in our {dte}-day window, and no catalyst that would break the range. That's exactly what we want."""
        })

    # Slide 4: Analyst Consensus (skip if no data)
    if has_analyst:
        ac = d.get("ANALYST_COUNT", "")
        abuy = d.get("ANALYST_BUY_PCT", "")
        consensus = d.get("ANALYST_CONSENSUS", "")
        tl = d.get("ANALYST_TARGET_LOW", "")
        th = d.get("ANALYST_TARGET_HIGH", "")
        slides.append({
            "title": "Analyst Consensus",
            "duration": "30s",
            "script": f"""{ac} analysts cover {sym}, and the consensus is {consensus}.

{abuy}% rate it a Buy, with an average price target between {tl} and {th}. That implies significant upside from the current {price}.

But here's what matters for us — Wall Street is broadly bullish, which means the stock isn't going to collapse. And the range-bound price action tells us it's not breaking out either. That's the sweet spot for our iron condor."""
        })

    # Slide 5: Support & Resistance
    slides.append({
        
        "title": "Support & Resistance",
        "duration": "35s",
        "script": f"""Let's look at the key price levels that define our trade.

The put gamma wall sits at {pw} — that's where massive open interest creates a mechanical floor. Dealers are forced to buy as price approaches this level.

The call gamma wall is at {cw} — the ceiling where dealer selling creates resistance.

Our short strikes at {sp} and {sc} are positioned just inside these walls. The current price of {price} is sitting right in the middle of this dealer-enforced range. This is structural support for our trade, not just a guess."""
    })

    # Slide 6: Trade Structure
    slides.append({
        "slide": 6,
        "title": "The Trade — How It's Built",
        "duration": "45s",
        "script": f"""Here's the exact trade structure.

On the put side, we sell the {sp} put and buy the {lp} put for protection. On the call side, we sell the {sc} call and buy the {lc} call.

This creates a defined-risk iron condor. We collect {credit} per share in premium — that's {mp} per contract.

Our profit zone runs from the breakeven at {be}. As long as {sym} stays in this range at expiration, we keep the full credit. The max we can lose is {ml} per contract, and that only happens if the stock moves well beyond our strikes.

Look at the P&L chart — flat profit in the middle, limited loss on both sides. That's the beauty of a defined-risk strategy."""
    })

    # Slide 7: Execution
    slides.append({
        "slide": 7,
        "title": "Execution Guide",
        "duration": "25s",
        "script": f"""For execution, place this as a limit order at {credit} credit, all-or-none.

The best entry window is between 10:30 AM and 2 PM Eastern, when liquidity is highest. Start with one to two contracts. You'll need Level 3 options approval and about {ml} in margin per contract.

Check the bid-ask spreads on the screen — all four legs have reasonable liquidity for clean fills."""
    })

    # Slide 8: Greeks & Exits
    slides.append({
        "slide": 8,
        "title": "Greeks & Exit Protocol",
        "duration": "50s",
        "script": f"""Time is working for us. Theta — our daily time decay — is {theta}. Every single day that passes, our position gains value just from the passage of time.

Vega is negative at {d['VEGA_VALUE']}, meaning we also benefit if implied volatility drops.

Now, the exit protocol. This is critical — know your exits before you enter.

Take profit at 50% of max gain. That means when your position is worth half the credit received, close it. Don't get greedy.

Stop loss if the position doubles in cost. Cut it — don't hope for recovery.

Time exit — close two days before expiration regardless of P&L. Gamma risk explodes in the final 48 hours.

And if price approaches either short strike, consider rolling further out-of-the-money."""
    })

    # Slide 9: Strategy & Confidence
    slides.append({
        "slide": 9,
        "title": "Confidence Index",
        "duration": "30s",
        "script": f"""Our NewLeaf Confidence Index scores this trade at {score} out of 100 — rated {conf}.

This score is based on gamma wall strength, volatility levels, strike positioning, and the overall market structure.

For capital allocation, we recommend risking no more than 2% of your portfolio on any single position. For a 50,000 dollar portfolio, that's one contract. For 100,000, two contracts maximum.

We chose the iron condor over alternatives like iron butterflies or naked strangles because it offers the best risk-reward for this specific setup."""
    })

    # Slide 10: Closing
    slides.append({
        "slide": 10,
        "title": "Complete Trade Spec & Close",
        "duration": "25s",
        "script": f"""Here's the complete trade specification on your screen. {sym} Iron Condor, expiring {expiry}, {dte} days from now.

Buy the {lp} put, sell the {sp} put. Sell the {sc} call, buy the {lc} call. Collect {credit} per share.

Defined risk. Defined reward. Let the system work.

This is NewLeaf System. If you found this analysis valuable, subscribe for more data-driven trade recommendations. Remember — this is educational content, not financial advice. Always do your own due diligence.

Thank you for watching."""
    })

    return slides


def generate_short_script(d):
    """Generate condensed 4-slide brief script."""
    sym = d["SYMBOL"]
    name = COMPANY_NAMES.get(sym, sym)
    slides = []

    slides.append({
        "slide": 1,
        "title": "The Opportunity",
        "duration": "30s",
        "script": f"""Welcome to NewLeaf System. Today's trade: a {d['STRATEGY_NAME']} on {name}, ticker {sym}, at {d['CURRENT_PRICE']}.

We're collecting {d['NET_CREDIT']} per share in premium for a max profit of {d['MAX_PROFIT']} per contract. {d['WIN_RATE']}% win probability. {d['DAYS_TO_EXPIRY']} days to expiration. Let me show you why."""
    })

    slides.append({
        "slide": 2,
        "title": "Why Now",
        "duration": "40s",
        "script": f"""Three reasons this trade works right now.

The macro environment is range-bound — enough volatility for premium but no catalysts to break the range.

{d.get('ANALYST_COUNT', 'Dozens of')} analysts cover {sym} with a {d.get('ANALYST_CONSENSUS', 'Buy')} consensus. Targets at {d.get('ANALYST_TARGET_LOW', 'N/A')} to {d.get('ANALYST_TARGET_HIGH', 'N/A')} mean the floor is solid.

And gamma walls at {d['PUT_GAMMA_WALL']} and {d['CALL_GAMMA_WALL']} create dealer-enforced boundaries right where we need them."""
    })

    slides.append({
        "slide": 3,
        "title": "The Trade",
        "duration": "35s",
        "script": f"""The structure: sell the {d['SHORT_PUT_STRIKE']} put, buy the {d['LONG_PUT_STRIKE']} put. Sell the {d['SHORT_CALL_STRIKE']} call, buy the {d['LONG_CALL_STRIKE']} call.

Profit zone: {d['BREAKEVEN_RANGE']}. Max profit {d['MAX_PROFIT']}, max loss {d['MAX_LOSS']}. Every day that passes, we earn {d['THETA_VALUE']} from time decay alone.

Take profit at 50%. Stop loss at 2x credit. Close two days before expiration."""
    })

    slides.append({
        "slide": 4,
        "title": "Closing",
        "duration": "20s",
        "script": f"""Confidence score: {d['TRADE_SCORE']} out of 100 — {d['CONFIDENCE_LEVEL']}.

Defined risk. Defined reward. Let the system work.

This is NewLeaf System. Subscribe for more. Not financial advice — always do your own research. Thank you for watching."""
    })

    return slides


def format_script(slides, symbol, mode):
    """Format slides into a readable markdown script."""
    lines = []
    lines.append(f"# {symbol} Iron Condor — HeyGen Video Script")
    lines.append(f"**Mode:** {'Full (10 slides)' if mode == 'full' else 'Brief (4 slides)'}")
    lines.append(f"**Generated:** {datetime.now().strftime('%B %d, %Y at %I:%M %p')}")
    total_duration = sum(int(s['duration'].replace('s','')) for s in slides)
    lines.append(f"**Estimated Duration:** {total_duration // 60}m {total_duration % 60}s")
    lines.append("")
    lines.append("---")
    lines.append("")

    for i, s in enumerate(slides, 1):
        lines.append(f"## Slide {i}: {s['title']}")
        lines.append(f"*Duration: ~{s['duration']}*")
        lines.append("")
        lines.append(s['script'].strip())
        lines.append("")
        lines.append("---")
        lines.append("")

    return "\n".join(lines)


def main():
    if len(sys.argv) < 2:
        print("Usage: python3 generate-script.py SYMBOL [--short]")
        sys.exit(1)

    symbol = sys.argv[1].upper()
    short_mode = "--short" in sys.argv

    # Find JSON
    candidates = [
        DATA_DIR / f"{symbol.lower()}-iron-condor-v2.json",
        DATA_DIR / f"{symbol.lower()}-iron-condor.json",
    ]
    json_file = None
    for c in candidates:
        if c.exists():
            json_file = c
            break

    if not json_file:
        print(f"Error: No data file found for {symbol}")
        print(f"Run: python3 build-report-data.py {symbol} YYYY-MM-DD")
        sys.exit(1)

    with open(json_file) as f:
        data = json.load(f)

    # Generate script
    mode = "short" if short_mode else "full"
    if short_mode:
        slides = generate_short_script(data)
    else:
        slides = generate_full_script(data)

    script = format_script(slides, symbol, mode)

    # Save
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    suffix = "-brief" if short_mode else ""
    out_path = OUTPUT_DIR / f"{symbol}-video-script{suffix}.md"
    with open(out_path, 'w') as f:
        f.write(script)

    total_duration = sum(int(s['duration'].replace('s','')) for s in slides)
    print(f"{symbol} video script generated ({len(slides)} slides, ~{total_duration//60}m {total_duration%60}s)")
    print(f"  {out_path}")


if __name__ == "__main__":
    main()
