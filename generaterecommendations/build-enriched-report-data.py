#!/usr/bin/env python3
"""
Build report JSON from enriched-pick.json for the v3+ PDF template.

Usage:
    python3 build-enriched-report-data.py <enriched-pick.json> [<output.json>]

This reads the enriched pick (tile + Claude analysis merged) and flattens it
into the key-value format expected by generate-report.py's template filler.
"""

import sys, json, math
from datetime import datetime
from pathlib import Path


def build_from_enriched(enriched):
    """Flatten enriched pick into template placeholder dict."""
    analysis = enriched.get('analysis', {})
    rationale = analysis.get('strategyRationale', {})
    tech = analysis.get('technicalIndicators', {})
    theta = analysis.get('thetaDecaySchedule', {})
    risk = analysis.get('riskAnalysis', {})
    greeks = enriched.get('greeks', {})
    gamma = enriched.get('gammaData', {})

    spot = enriched.get('spotPrice', 0)
    symbol = enriched.get('symbol', '')
    strategy = enriched.get('strategy', '')

    def fmt(v, decimals=2):
        if v is None: return 'N/A'
        return f"${float(v):,.{decimals}f}"

    def truncate(text, max_sentences=3):
        """Keep first N sentences to prevent PDF overflow."""
        if not text: return ''
        sentences = text.split('. ')
        return '. '.join(sentences[:max_sentences]) + ('.' if len(sentences) > max_sentences else '')

    d = {}

    # ── Basic tile data ──
    COMPANY_NAMES = {
        'AAPL': 'Apple', 'MSFT': 'Microsoft', 'NVDA': 'Nvidia', 'AMZN': 'Amazon',
        'GOOG': 'Alphabet', 'META': 'Meta Platforms', 'TSLA': 'Tesla', 'AMD': 'AMD',
        'AVGO': 'Broadcom', 'NFLX': 'Netflix', 'ADBE': 'Adobe', 'CRM': 'Salesforce',
        'INTC': 'Intel', 'PLTR': 'Palantir', 'COIN': 'Coinbase', 'RIOT': 'Riot Platforms',
        'MARA': 'Marathon Digital', 'RIVN': 'Rivian', 'LCID': 'Lucid', 'SOFI': 'SoFi',
        'SNAP': 'Snap', 'SHOP': 'Shopify', 'JPM': 'JPMorgan', 'BAC': 'Bank of America',
        'GS': 'Goldman Sachs', 'MS': 'Morgan Stanley', 'C': 'Citigroup', 'WFC': 'Wells Fargo',
        'SCHW': 'Charles Schwab', 'XOM': 'Exxon Mobil', 'CVX': 'Chevron', 'COP': 'ConocoPhillips',
        'SLB': 'Schlumberger', 'EOG': 'EOG Resources', 'MPC': 'Marathon Petroleum',
        'PSX': 'Phillips 66', 'VLO': 'Valero', 'OXY': 'Occidental', 'HES': 'Hess',
        'HAL': 'Halliburton', 'CAT': 'Caterpillar', 'DE': 'John Deere', 'CMI': 'Cummins',
        'IR': 'Ingersoll Rand', 'EMR': 'Emerson', 'HON': 'Honeywell', 'MMM': '3M Company',
        'BA': 'Boeing', 'LMT': 'Lockheed Martin', 'RTX': 'RTX Corp', 'GE': 'GE Aerospace',
        'UNH': 'UnitedHealth', 'PFE': 'Pfizer', 'JNJ': 'Johnson & Johnson', 'MRK': 'Merck',
        'ABBV': 'AbbVie', 'LLY': 'Eli Lilly', 'WMT': 'Walmart', 'COST': 'Costco',
        'TGT': 'Target', 'KR': 'Kroger', 'PG': 'Procter & Gamble', 'KO': 'Coca-Cola',
        'PEP': 'PepsiCo', 'MDLZ': 'Mondelez', 'CL': 'Colgate-Palmolive', 'GIS': 'General Mills',
        'HD': 'Home Depot', 'MCD': 'McDonald\'s', 'NKE': 'Nike', 'NUE': 'Nucor',
        'FCX': 'Freeport-McMoRan', 'NEM': 'Newmont', 'VMC': 'Vulcan Materials',
        'MLM': 'Martin Marietta', 'APD': 'Air Products', 'NEE': 'NextEra Energy',
        'DUK': 'Duke Energy', 'SO': 'Southern Company', 'D': 'Dominion Energy',
        'AEP': 'American Electric Power', 'BABA': 'Alibaba', 'BIDU': 'Baidu',
        'JD': 'JD.com', 'PDD': 'PDD Holdings', 'NIO': 'NIO', 'DIS': 'Walt Disney',
        'SPY': 'S&P 500 ETF', 'QQQ': 'Nasdaq 100 ETF', 'IWM': 'Russell 2000 ETF',
        'DIA': 'Dow Jones ETF', 'TLT': 'Treasury Bond ETF', 'GLD': 'Gold ETF',
        'SLV': 'Silver ETF', 'USO': 'Oil ETF', 'UNG': 'Natural Gas ETF',
        'GDX': 'Gold Miners ETF', 'BITO': 'Bitcoin ETF', 'ARKK': 'ARK Innovation ETF',
        'XLF': 'Financial Select ETF', 'XLK': 'Tech Select ETF', 'XLE': 'Energy Select ETF',
        'XLY': 'Consumer Disc ETF', 'XLI': 'Industrial Select ETF', 'XLP': 'Consumer Staples ETF',
        'XLU': 'Utilities Select ETF', 'XLB': 'Materials Select ETF',
        'EEM': 'Emerging Markets ETF', 'FXI': 'China Large-Cap ETF',
        'UVXY': 'VIX Short-Term ETF', 'SQQQ': 'Nasdaq Bear 3x', 'TQQQ': 'Nasdaq Bull 3x',
    }
    d['SYMBOL'] = symbol
    d['COMPANY_NAME'] = COMPANY_NAMES.get(symbol, enriched.get('companyName', symbol))
    d['STRATEGY_NAME'] = strategy
    d['CURRENT_PRICE'] = fmt(spot)
    d['EXPIRATION_DATE'] = enriched.get('expiry', '')
    d['DAYS_TO_EXPIRY'] = str(enriched.get('dte', ''))
    d['REPORT_DATE'] = datetime.now().strftime('%B %d, %Y')
    d['REPORT_TIME'] = datetime.now().strftime('%I:%M %p ET')
    max_profit = enriched.get('maxProfit', 0)
    max_loss = enriched.get('maxLoss', 0)
    pop = enriched.get('oddsOfProfit', 0) or enriched.get('probOfProfit', 0) or 0
    rr = enriched.get('rewardRisk', 0) or 0
    legs = enriched.get('legs', [])
    net_credit_val = enriched.get('netCredit', 0) or 0

    d['MAX_PROFIT'] = fmt(max_profit)
    d['MAX_LOSS'] = fmt(max_loss)
    d['MAX_PROFIT_DESC'] = f"Full credit kept if {symbol} stays between short strikes at expiration"
    d['MAX_LOSS_DESC'] = f"Spread width minus credit received per contract"
    d['WIN_RATE'] = str(pop)
    d['WIN_RATE_DESC'] = f"Based on strike positioning and delta probability"
    d['RISK_REWARD'] = f"{rr:.2f}x" if rr else 'N/A'
    d['RISK_REWARD_DESC'] = f"Max profit / max loss ratio"
    pc = enriched.get('priceChange')
    d['PRICE_CHANGE'] = f"({'+' if pc > 0 else ''}{pc:.2f})" if pc else ''

    # Legs / strikes
    puts = [l for l in legs if l.get('type', '').lower() == 'put']
    calls = [l for l in legs if l.get('type', '').lower() == 'call']
    short_put = next((l for l in puts if l.get('action', '').lower() == 'sell'), {})
    long_put = next((l for l in puts if l.get('action', '').lower() == 'buy'), {})
    short_call = next((l for l in calls if l.get('action', '').lower() == 'sell'), {})
    long_call = next((l for l in calls if l.get('action', '').lower() == 'buy'), {})

    d['SHORT_PUT_STRIKE'] = fmt(short_put.get('strike'))
    d['SHORT_PUT_PREMIUM'] = fmt(short_put.get('premium') or short_put.get('mid'))
    d['LONG_PUT_STRIKE'] = fmt(long_put.get('strike'))
    d['LONG_PUT_PREMIUM'] = fmt(long_put.get('premium') or long_put.get('mid'))
    d['SHORT_CALL_STRIKE'] = fmt(short_call.get('strike'))
    d['SHORT_CALL_PREMIUM'] = fmt(short_call.get('premium') or short_call.get('mid'))
    d['LONG_CALL_STRIKE'] = fmt(long_call.get('strike'))
    d['LONG_CALL_PREMIUM'] = fmt(long_call.get('premium') or long_call.get('mid'))

    # Breakevens
    sp = short_put.get('strike', 0) or 0
    sc = short_call.get('strike', 0) or 0
    be_low = sp - net_credit_val if sp else 0
    be_high = sc + net_credit_val if sc else 0
    d['BREAKEVEN_LOW'] = fmt(be_low)
    d['BREAKEVEN_HIGH'] = fmt(be_high)
    d['BREAKEVEN_RANGE'] = f"{fmt(be_low)}-{fmt(be_high)}"
    d['BREAKEVEN_RANGE_DESC'] = f"Profit zone at expiration ({fmt(be_high - be_low)} wide)" if be_high and be_low else ''

    # ── Enriched from Claude: Strategy Rationale (Page 1 thesis) ──
    d['TRADE_CONFIG'] = f"{strategy} on {symbol} @ {fmt(spot)}"
    iv_desc = tech.get('impliedVolatility', {}).get('description', 'See technical analysis')
    # Cover page: concise market environment (first 2 sentences)
    iv_sentences = iv_desc.split('. ')
    d['MARKET_ENVIRONMENT'] = '. '.join(iv_sentences[:2]) + ('.' if len(iv_sentences) > 2 else '')

    # Cover page thesis: one concise bullet per rationale point (first sentence only)
    def first_sentence(text, max_len=200):
        s = text.split('. ')[0]
        return s[:max_len] + ('.' if not s.endswith('.') else '')

    thesis_points = []
    if rationale.get('whyThisStrategy'):
        thesis_points.append(first_sentence(rationale['whyThisStrategy']))
    if rationale.get('whyTheseStrikes'):
        thesis_points.append(first_sentence(rationale['whyTheseStrikes']))
    if rationale.get('whyThisExpiry'):
        thesis_points.append(first_sentence(rationale['whyThisExpiry']))
    d['THESIS_POINTS'] = ''.join(f'<li>{p}</li>' for p in thesis_points)

    # ── Strategy Rationale (for Risk Scenarios page) ──
    d['WHY_THIS_STRATEGY'] = rationale.get('whyThisStrategy', '')
    d['WHY_THESE_STRIKES'] = rationale.get('whyTheseStrikes', '')
    d['WHY_THIS_EXPIRY'] = rationale.get('whyThisExpiry', '')

    alternatives = rationale.get('alternativesConsidered', [])
    d['ALTERNATIVES_TABLE_ROWS'] = ''.join(
        f'<tr><td>{a.get("strategy", "")}</td><td>{a.get("reason", "")}</td></tr>'
        for a in alternatives
    )
    # Shortened version for the strategy page — must match 6-col format (Strategy, Profit, Loss, Win%, Capital, Note)
    alt_rows = ''
    for a in alternatives[:2]:
        name = a.get('strategy', '')
        # Extract just first few words as a short note
        reason = a.get('reason', '')
        short = reason.split(' — ')[0].split('. ')[0][:40]
        alt_rows += f'<tr><td>{name}</td><td>—</td><td>—</td><td>—</td><td>—</td><td>{short}</td></tr>'
    d['ALT_STRATEGY_TABLE_ROWS'] = alt_rows

    # Rationale points as bullet list
    rat_points = []
    if rationale.get('whyThisStrategy'): rat_points.append(rationale['whyThisStrategy'])
    if rationale.get('whyTheseStrikes'): rat_points.append(rationale['whyTheseStrikes'])
    d['RATIONALE_POINTS'] = ''.join(f'<li>{p}</li>' for p in rat_points)

    # Strategy comparison table
    strat_rows = f'<tr><td>{strategy}</td><td>{fmt(max_profit)}</td><td>{fmt(max_loss)}</td><td>{pop}%</td><td>{fmt(max_loss)}</td></tr>'
    for alt in alternatives[:2]:
        strat_rows += f'<tr><td>{alt.get("strategy","")}</td><td>—</td><td>—</td><td>—</td><td>—</td></tr>'
    d['STRATEGY_TABLE_ROWS'] = strat_rows

    # Capital allocation table
    portfolios = [10000, 25000, 50000, 100000]
    cap_rows = ''
    for p in portfolios:
        max_risk = round(p * 0.02)
        contracts = max(0, int(max_loss / 100) and int(max_risk / max_loss) if max_loss else 0)
        margin = fmt(contracts * max_loss) if contracts else '--'
        note = 'Portfolio too small' if contracts == 0 else f'{contracts} contract{"s" if contracts > 1 else ""}'
        cap_rows += f'<tr><td>{fmt(p)}</td><td>{fmt(max_risk)}</td><td>{contracts}</td><td>{margin}</td><td>{note}</td></tr>'
    d['CAPITAL_TABLE_ROWS'] = cap_rows

    # Score interpretation
    d['SCORE_FACTORS'] = f"Score based on: Gamma wall analysis, OI concentration, IV levels, and strike positioning"
    d['SCORE_INTERPRETATION'] = f"This trade scores {pop}/100 — {'meets' if pop >= 60 else 'below'} the 60+ recommended threshold."

    # Company context (from sentiment if available)
    sent = enriched.get('sentiment') or {}
    d['COMPANY_HEADLINE'] = f"{d['COMPANY_NAME']} ({symbol}) — {strategy} Analysis"
    drivers = sent.get('keyDrivers', [])
    d['COMPANY_NEWS_BULLETS'] = ''.join(f'<li>{dr.get("factor","")}</li>' for dr in drivers[:4]) or '<li>See analysis for details</li>'
    tailwinds = [dr for dr in drivers if dr.get('impact') == 'positive']
    headwinds = [dr for dr in drivers if dr.get('impact') == 'negative']
    d['COMPANY_TAILWINDS'] = ''.join(f'<li>{dr.get("factor","")}</li>' for dr in tailwinds[:3]) or '<li>N/A</li>'
    d['COMPANY_HEADWINDS'] = ''.join(f'<li>{dr.get("factor","")}</li>' for dr in headwinds[:3]) or '<li>N/A</li>'

    # Analyst data (from sentiment key drivers if available)
    d['ANALYST_CONSENSUS'] = 'Hold' if 40 <= (sent.get('score') or 50) <= 60 else ('Buy' if (sent.get('score') or 50) > 60 else 'Sell')
    d['ANALYST_COUNT'] = ''
    d['ANALYST_BUY_PCT'] = ''
    d['ANALYST_HOLD_PCT'] = ''
    d['ANALYST_SELL_PCT'] = ''
    d['ANALYST_TARGET_HIGH'] = ''
    d['ANALYST_TARGET_LOW'] = ''
    d['ANALYST_NUANCE'] = sent.get('sectorContext', '') or ''

    # HAS_ flags for conditional template sections
    has_sent = bool(sent.get('summary') or sent.get('keyDrivers'))
    d['HAS_COMPANY'] = 'true' if has_sent else ''
    d['HAS_ANALYST'] = ''  # No real analyst data available yet
    d['HAS_MACRO'] = 'true' if (sent.get('sectorContext') or has_sent) else ''

    # Macro environment boxes (from sentiment)
    d['MACRO_BOX_1_TITLE'] = 'Market Sentiment'
    d['MACRO_BOX_1_TEXT'] = f"Composite score: {sent.get('composite', sent).get('score', 'N/A')}/100 ({sent.get('composite', sent).get('label', 'N/A')}) from {sent.get('activeEngines', 1)} AI engines. Confidence: {round((sent.get('composite', sent).get('confidence', 0)) * 100)}%."
    d['MACRO_BOX_2_TITLE'] = 'Sector Theme'
    d['MACRO_BOX_2_TEXT'] = sent.get('sectorContext') or 'No sector-specific themes identified.'
    d['MACRO_BOX_3_TITLE'] = 'Social Mood'
    d['MACRO_BOX_3_TEXT'] = sent.get('socialSentiment') or 'No significant social media activity detected.'

    # Gamma wall data
    put_wall = gamma.get('put_wall', 0)
    call_wall = gamma.get('call_wall', 0)
    d['PUT_GAMMA_WALL'] = fmt(put_wall)
    d['CALL_GAMMA_WALL'] = fmt(call_wall)
    d['GAMMA_WALL_EXPLANATION'] = f"Gamma walls at {fmt(put_wall)} (put) and {fmt(call_wall)} (call) define dealer-enforced boundaries. Confidence: {round((gamma.get('confidence_score',0))*100)}%."

    # Generate gamma chart SVG from topStrikes
    top_strikes = gamma.get('topStrikes', [])
    # Filter to strikes near the current price and sort
    nearby = [s for s in top_strikes if abs(s['strike'] - spot) < spot * 0.15]
    nearby.sort(key=lambda x: x['strike'])
    # Use total volume as the bar height metric
    chart_data = []
    for s in nearby[:12]:
        vol = (s.get('call_volume', 0) or 0) + (s.get('put_volume', 0) or 0)
        if vol > 0:
            chart_data.append((s['strike'], vol))

    if chart_data:
        max_vol = max(v for _, v in chart_data)
        bw, gap, bl = 36, 8, 120
        cw = len(chart_data) * (bw + gap) + 40
        svg_lines = [f'<svg viewBox="0 0 {cw} 145" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-height:110pt;">']
        for i, (strike, vol) in enumerate(chart_data):
            x = 20 + i * (bw + gap)
            cx = x + bw / 2
            h = max(4, (vol / max_vol) * 90)
            y = bl - h
            if strike == put_wall:
                color, label = "#dc2626", "PUT WALL"
            elif strike == call_wall:
                color, label = "#059669", "CALL WALL"
            elif abs(strike - spot) <= spot * 0.01:
                color, label = "#C9A96E", "SPOT"
            else:
                color, label = "#9CA3AF", ""
            svg_lines.append(f'<rect x="{x}" y="{y:.0f}" width="{bw}" height="{h:.0f}" fill="{color}" rx="2"/>')
            svg_lines.append(f'<text x="{cx:.0f}" y="{bl+10:.0f}" text-anchor="middle" font-size="6" fill="#4B5563">${strike:.0f}</text>')
            if label:
                svg_lines.append(f'<text x="{cx:.0f}" y="{bl+18:.0f}" text-anchor="middle" font-size="5" fill="{color}" font-weight="700">{label}</text>')
        svg_lines.append(f'<line x1="15" y1="{bl}" x2="{cw-5}" y2="{bl}" stroke="#E6E8EB" stroke-width="0.5"/>')
        svg_lines.append('</svg>')
        d['GAMMA_CHART_SVG'] = '\n'.join(svg_lines)
    elif put_wall and call_wall and spot:
        # Synthetic gamma wall visualization from key levels
        sr_tech = tech.get('supportResistance', {})
        all_levels = []
        for s in sr_tech.get('support', []):
            lvl = s.get('level', 0)
            strength = 80 if s.get('strength') == 'strong' else 40
            all_levels.append((lvl, strength, 'support'))
        for r in sr_tech.get('resistance', []):
            lvl = r.get('level', 0)
            strength = 80 if r.get('strength') == 'strong' else 40
            all_levels.append((lvl, strength, 'resistance'))
        # Add walls and spot
        all_levels.append((put_wall, 100, 'put_wall'))
        all_levels.append((call_wall, 100, 'call_wall'))
        all_levels.append((spot, 60, 'spot'))
        all_levels.sort(key=lambda x: x[0])
        # Deduplicate close levels
        deduped = []
        for lvl, strength, kind in all_levels:
            if not deduped or abs(lvl - deduped[-1][0]) > spot * 0.01:
                deduped.append((lvl, strength, kind))
            elif strength > deduped[-1][1]:
                deduped[-1] = (lvl, strength, kind)
        bw, gap, bl = 44, 6, 110
        cw = len(deduped) * (bw + gap) + 40
        svg_lines = [f'<svg viewBox="0 0 {cw} 140" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-height:110pt;">']
        for i, (lvl, strength, kind) in enumerate(deduped):
            x = 20 + i * (bw + gap)
            cx = x + bw / 2
            h = max(6, strength * 0.85)
            y = bl - h
            if kind == 'put_wall':
                color, label = "#dc2626", "PUT WALL"
            elif kind == 'call_wall':
                color, label = "#059669", "CALL WALL"
            elif kind == 'spot':
                color, label = "#C9A96E", "CURRENT"
            elif kind == 'support':
                color, label = "#dc262680", ""
            else:
                color, label = "#05966980", ""
            svg_lines.append(f'<rect x="{x}" y="{y:.0f}" width="{bw}" height="{h:.0f}" fill="{color}" rx="2"/>')
            svg_lines.append(f'<text x="{cx:.0f}" y="{bl+10:.0f}" text-anchor="middle" font-size="6" fill="#4B5563" font-weight="600">${lvl:.0f}</text>')
            if label:
                svg_lines.append(f'<text x="{cx:.0f}" y="{bl+18:.0f}" text-anchor="middle" font-size="5" fill="{color}" font-weight="700">{label}</text>')
        svg_lines.append(f'<line x1="15" y1="{bl}" x2="{cw-5}" y2="{bl}" stroke="#E6E8EB" stroke-width="0.5"/>')
        svg_lines.append('</svg>')
        d['GAMMA_CHART_SVG'] = '\n'.join(svg_lines)
    else:
        d['GAMMA_CHART_SVG'] = '<p style="font-size:7pt;color:var(--grey);">No gamma chart data available.</p>'

    # Alignment points
    sp_strike = short_put.get('strike', 0) or 0
    sc_strike = short_call.get('strike', 0) or 0
    alignment = []
    if sp_strike and put_wall:
        alignment.append(f'Short Put (${sp_strike:.0f}) near Put Wall (${put_wall:.0f}) — dealer buying support')
    if sc_strike and call_wall:
        alignment.append(f'Short Call (${sc_strike:.0f}) near Call Wall (${call_wall:.0f}) — dealer selling pressure')
    alignment.append(f'Current Price (${spot:.2f}) within gamma band')
    if put_wall and call_wall:
        bw_pct = (call_wall - put_wall) / spot * 100
        alignment.append(f'Band width ${call_wall - put_wall:.0f} ({bw_pct:.1f}% of price)')
    d['GAMMA_ALIGNMENT_POINTS'] = ''.join(f'<li>{p}</li>' for p in alignment)

    # Event risk rows
    event_risk_rows = ''
    mat_events = sent.get('materialEvents', [])
    for evt in mat_events:
        event_risk_rows += f'<tr><td>Upcoming</td><td>{evt}</td><td>HIGH</td><td>Monitor closely</td></tr>'
    d['EVENT_RISK_ROWS'] = event_risk_rows

    # Exit protocol
    d['EXIT_PROFIT_TRIGGER'] = f"Position reaches 50% of max profit ({fmt(max_profit * 0.5)})"
    d['EXIT_PROFIT_DETAIL'] = "Close entire position via limit order. GTC."
    d['EXIT_STOP_TRIGGER'] = f"Position loses 100% of credit ({fmt(net_credit_val * 100)})"
    d['EXIT_STOP_DETAIL'] = f"Max loss capped at {fmt(max_loss)} per contract."
    d['EXIT_TIME_TRIGGER'] = f"2 days before expiration"
    d['EXIT_TIME_DETAIL'] = "Close to avoid pin risk and gamma acceleration."
    d['EXIT_ADJUST_TRIGGER'] = "Short strike tested (price within 2%)"
    d['EXIT_ADJUST_DETAIL'] = "Roll tested side further OTM if credit available."

    # Price journey from key levels
    kl = enriched.get('keyLevels', {})
    supports = sorted(kl.get('support', []))
    resistances = sorted(kl.get('resistance', []))
    pj_rows = ''
    if supports:
        pj_rows += f'<tr><td>Key Support</td><td>{fmt(supports[0])}</td></tr>'
    if gamma.get('put_wall'):
        pj_rows += f'<tr><td>Put Gamma Wall</td><td>{fmt(gamma["put_wall"])}</td></tr>'
    pj_rows += f'<tr class="highlight-row"><td>Current Price</td><td>{fmt(spot)}</td></tr>'
    if gamma.get('call_wall'):
        pj_rows += f'<tr><td>Call Gamma Wall</td><td>{fmt(gamma["call_wall"])}</td></tr>'
    if resistances:
        pj_rows += f'<tr><td>Key Resistance</td><td>{fmt(resistances[-1])}</td></tr>'
    d['PRICE_JOURNEY_HTML'] = pj_rows

    # Trade spec rows (page 9)
    spec_rows = ''
    spec_rows += f'<tr><td>Strategy</td><td>{strategy} (4-legged spread)</td></tr>'
    spec_rows += f'<tr><td>Underlying</td><td>{symbol} -- {d["COMPANY_NAME"]}</td></tr>'
    spec_rows += f'<tr><td>Expiration</td><td>{enriched.get("expiry","")} ({enriched.get("dte","")} DTE at entry)</td></tr>'
    spec_rows += f'<tr><td>Put Spread</td><td>Buy {fmt(long_put.get("strike"))} Put / Sell {fmt(short_put.get("strike"))} Put</td></tr>'
    spec_rows += f'<tr><td>Call Spread</td><td>Sell {fmt(short_call.get("strike"))} Call / Buy {fmt(long_call.get("strike"))} Call</td></tr>'
    spec_rows += f'<tr><td>Net Credit</td><td>{fmt(net_credit_val)} per share ({fmt(net_credit_val * 100)} per contract)</td></tr>'
    spec_rows += f'<tr><td>Max Profit</td><td>{fmt(max_profit)} per contract (full credit kept)</td></tr>'
    spec_rows += f'<tr><td>Max Loss</td><td>{fmt(max_loss)} per contract (spread width minus credit)</td></tr>'
    spec_rows += f'<tr><td>Break-Even Low</td><td>{fmt(be_low)} ({fmt(sp)} - {fmt(net_credit_val)})</td></tr>'
    spec_rows += f'<tr><td>Break-Even High</td><td>{fmt(be_high)} ({fmt(sc)} + {fmt(net_credit_val)})</td></tr>'
    pz = (be_high - be_low) if be_high and be_low else 0
    spec_rows += f'<tr><td>Profit Zone Width</td><td>{fmt(pz)} ({round(pz/spot*100,1)}% of current price)</td></tr>'
    d['TRADE_SPEC_ROWS'] = spec_rows

    # ── Technical Analysis page (NEW) ──
    rsi = tech.get('rsi', {})
    def fmtNum(v, dp=2):
        """Format a number to fixed decimals, stripping floating point noise."""
        if v is None or v == '': return 'N/A'
        try: return f"{float(v):.{dp}f}"
        except: return str(v)

    d['RSI_VALUE'] = fmtNum(rsi.get('value'), 1)
    d['RSI_SIGNAL'] = rsi.get('signal', '')
    d['RSI_DESCRIPTION'] = truncate(rsi.get('description', ''), 2)

    iv = tech.get('impliedVolatility', {})
    d['IV_RANK'] = fmtNum(iv.get('ivRank'), 0)
    d['CURRENT_IV'] = fmtNum(iv.get('currentIV'), 1)
    d['HISTORICAL_VOL'] = fmtNum(iv.get('historicalVol30'), 1)
    d['IV_VALUE'] = f"{iv.get('currentIV', '')}% (Rank: {iv.get('ivRank', '')})"

    ma = tech.get('movingAverages', {})
    d['SMA_20'] = fmt(ma.get('sma20'))
    d['SMA_50'] = fmt(ma.get('sma50'))
    d['SMA_100'] = fmt(ma.get('sma100'))
    d['MA_SIGNAL'] = ma.get('signal', '')
    d['MA_DESCRIPTION'] = truncate(ma.get('description', ''), 2)

    # MA_SEGMENT: empty — detailed SMAs shown on the dedicated Technical Analysis page
    d['MA_SEGMENT'] = ''

    macd = tech.get('macd', {})
    d['MACD_LINE'] = fmtNum(macd.get('macdLine'), 2)
    d['MACD_SIGNAL_LINE'] = fmtNum(macd.get('signalLine'), 2)
    d['MACD_HISTOGRAM'] = fmtNum(macd.get('histogram'), 2)
    d['MACD_DESCRIPTION'] = truncate(macd.get('description', ''), 2)

    bb = tech.get('bollingerBands', {})
    d['BB_UPPER'] = fmt(bb.get('upper'))
    d['BB_MIDDLE'] = fmt(bb.get('middle'))
    d['BB_LOWER'] = fmt(bb.get('lower'))
    d['BB_WIDTH'] = fmtNum(bb.get('width'), 1)
    d['BB_DESCRIPTION'] = truncate(bb.get('description', ''), 2)

    # ── Risk Scenarios page (NEW) — truncate to fit PDF boxes ──
    d['MAX_PAIN_SCENARIO'] = truncate(risk.get('maxPainScenario', ''), 3)
    d['EARNINGS_RISK'] = truncate(risk.get('earningsRisk', ''), 3)
    d['EVENT_RISK'] = truncate(risk.get('eventRisk', ''), 4)
    d['MANAGEMENT_PLAN'] = truncate(risk.get('managementPlan', ''), 4)
    d['DIVIDEND_RISK'] = risk.get('dividendRisk', '')

    # ── Theta decay schedule (for existing Greeks page) ──
    decay = theta.get('dailyDecay', [])
    # Show at most 7 rows — sample evenly if more
    if len(decay) > 7:
        step = max(1, len(decay) // 6)
        sampled = decay[::step][:6] + [decay[-1]]
    else:
        sampled = decay
    d['THETA_SCHEDULE_ROWS'] = ''.join(
        f'<tr><td>{r.get("daysToExpiry", "")}d before</td><td>{r.get("daysToExpiry", "")}</td>'
        f'<td>{fmt(r.get("dailyTheta"))}/day</td><td>{fmt(r.get("cumulativeTheta"))}</td></tr>'
        for r in sampled
    )
    d['THETA_VALUE'] = fmt(greeks.get('netTheta'))
    # Truncate theta explanation to first 2 sentences to fit Greek box
    theta_desc = theta.get('description', 'See theta decay schedule')
    theta_sentences = theta_desc.split('. ')
    d['THETA_EXPLANATION'] = '. '.join(theta_sentences[:2]) + ('.' if len(theta_sentences) > 2 else '')
    vega = greeks.get('netVega', 0)
    d['VEGA_VALUE'] = f"{float(vega):.4f}" if vega else '0'
    iv_context = enriched.get('ivContext', {})
    vega_desc = iv_context.get('signal', '')
    d['VEGA_EXPLANATION'] = truncate(vega_desc, 2) if vega_desc else 'Position benefits when IV contracts.'

    # ── S&R from Claude (existing page, upgraded) ──
    sr = tech.get('supportResistance', {})
    supports = sr.get('support', [])
    resistances = sr.get('resistance', [])
    sr_rows = ''
    for s in supports:
        strength = s.get("strength", "")
        sr_rows += f'<tr><td style="white-space:nowrap">{fmt(s.get("level"))}</td><td>Support — {strength}</td></tr>'
    for r in resistances:
        strength = r.get("strength", "")
        sr_rows += f'<tr><td style="white-space:nowrap">{fmt(r.get("level"))}</td><td>Resistance — {strength}</td></tr>'
    d['SR_LEVELS_HTML'] = sr_rows

    # ── Legs / execution table (8 cols: Leg, Strike, Bid×Ask, Last, VWAP, Spread, OI, Trades) ──
    legs = enriched.get('legs', [])
    exec_rows = ''
    for l in legs:
        action = l.get('action', '').upper()
        ltype = l.get('type', '').upper()
        strike = l.get('strike', 0)
        prem = l.get('premium') or l.get('mid') or 0
        delta = l.get('delta', 0)
        iv_leg = l.get('iv', 0)
        iv_str = f"{round(iv_leg*100,1)}%" if iv_leg else '—'
        exec_rows += (
            f'<tr><td>{action} {ltype}</td><td>${strike}</td>'
            f'<td>{fmt(prem)}</td><td>{fmt(prem)}</td>'
            f'<td>δ {delta:.3f}</td><td>IV {iv_str}</td>'
            f'<td>—</td><td>—</td></tr>'
        )
    d['EXECUTION_TABLE_ROWS'] = exec_rows

    net_credit = enriched.get('netCredit', 0)
    d['MID_MARKET_PRICE'] = fmt(net_credit)
    d['ESTIMATED_SLIPPAGE'] = '$0.02-0.05 per leg'
    d['MARGIN_PER_CONTRACT'] = fmt(enriched.get('maxLoss'))

    # ── Sentiment (4-engine AI analysis) ──
    sent = enriched.get('sentiment') or {}
    composite = sent.get('composite', sent)
    d['SENTIMENT_SCORE'] = str(composite.get('score', ''))
    d['SENTIMENT_LABEL'] = composite.get('label', 'N/A').upper()
    d['SENTIMENT_CONFIDENCE'] = f"{round((composite.get('confidence', 0)) * 100)}%"
    d['SENTIMENT_SUMMARY'] = sent.get('summary', 'No sentiment data available.')
    d['SENTIMENT_SOCIAL'] = sent.get('socialSentiment', 'N/A') or 'N/A'
    d['SENTIMENT_SECTOR'] = sent.get('sectorContext', 'N/A') or 'N/A'
    d['SENTIMENT_SOURCE'] = sent.get('source', 'N/A')
    d['SENTIMENT_ENGINES_COUNT'] = str(sent.get('activeEngines', 0))

    # Key drivers as HTML list
    drivers = sent.get('keyDrivers', [])
    drivers_html = ''
    for drv in drivers[:6]:
        icon = '&#9650;' if drv.get('impact') == 'positive' else '&#9660;' if drv.get('impact') == 'negative' else '&#9679;'
        color = '#1D9E75' if drv.get('impact') == 'positive' else '#E24B4A' if drv.get('impact') == 'negative' else '#d97706'
        src = f" <span style='color:#9ca3af;font-size:9px'>({drv.get('source', '')})</span>" if drv.get('source') else ''
        drivers_html += f"<div style='display:flex;gap:6px;margin-bottom:4px;font-size:11px'><span style='color:{color}'>{icon}</span><span>{drv.get('factor', '')}{src}</span></div>"
    d['SENTIMENT_DRIVERS_HTML'] = drivers_html or '<div style="font-size:11px;color:#9ca3af">No key drivers identified.</div>'

    # Material events
    events = sent.get('materialEvents', [])
    d['SENTIMENT_EVENTS'] = '; '.join(events) if events else 'None'
    d['SENTIMENT_HAS_EVENTS'] = 'true' if events else 'false'

    # Per-engine breakdown HTML
    engines = sent.get('engines', {})
    engines_html = ''
    engine_colors = {'claude': '#D97706', 'grok': '#1DA1F2', 'gemini': '#4285F4', 'reddit': '#7C3AED'}
    engine_labels = {'claude': 'Claude', 'grok': 'Grok / X', 'gemini': 'Gemini', 'reddit': 'Reddit'}
    for name, eng in engines.items():
        color = engine_colors.get(name, '#6b7280')
        label = engine_labels.get(name, name.title())
        engines_html += f"<div style='text-align:center;padding:8px;border:1px solid {color}20;border-radius:8px;background:{color}08'><div style='font-weight:700;font-size:11px;color:{color}'>{label}</div><div style='font-family:monospace;font-size:18px;font-weight:700;color:{color}'>{eng.get('score', '--')}</div><div style='font-size:9px;color:#9ca3af'>{round(eng.get('weight', 0) * 100)}% weight</div></div>"
    d['SENTIMENT_ENGINES_HTML'] = engines_html

    # ── Confidence ──
    d['TRADE_SCORE'] = str(enriched.get('oddsOfProfit', ''))
    pop = enriched.get('oddsOfProfit', 0)
    if pop >= 75:
        d['CONFIDENCE_LEVEL'] = 'HIGH CONFIDENCE'
    elif pop >= 60:
        d['CONFIDENCE_LEVEL'] = 'MODERATE CONFIDENCE'
    else:
        d['CONFIDENCE_LEVEL'] = 'SPECULATIVE'
    d['CONFIDENCE_THRESHOLD_LABEL'] = f"PoP: {pop}%"

    return d


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print("Usage: python3 build-enriched-report-data.py <enriched-pick.json> [output.json]")
        sys.exit(1)

    with open(sys.argv[1]) as f:
        enriched = json.load(f)

    data = build_from_enriched(enriched)

    output_path = sys.argv[2] if len(sys.argv) > 2 else sys.argv[1].replace('.json', '-report-data.json')
    with open(output_path, 'w') as f:
        json.dump(data, f, indent=2)

    print(f"Report data written to {output_path} ({len(data)} fields)")
