#!/usr/bin/env node
/**
 * Phase 4: Parallel validation — old LLM-decides vs new engine-decides/LLM-explains.
 * Runs 20 tickers through both paths and surfaces disagreements.
 */

const API = 'http://localhost:5400';

// 20 tickers spanning the strategy distribution:
// condors, BWBs, butterflies, directional, calendar + various sectors
const TICKERS = [
  'AAPL', 'NVDA', 'TSLA', 'COIN', 'SPY',    // mega caps, mixed strategies
  'GOOG', 'PLTR', 'SOFI', 'NFLX', 'RIVN',   // condor candidates
  'BIDU', 'NIO', 'XOM', 'DUK', 'AEP',        // butterflies + calendar
  'META', 'JNJ', 'SCHW', 'IWM', 'GLD',       // various regimes
];

// Use a near-term expiry
const EXPIRY = (() => {
  const d = new Date();
  d.setDate(d.getDate() + (5 - d.getDay() + 7) % 7 || 7); // next Friday
  return d.toISOString().split('T')[0];
})();

const OLD_SYSTEM = `You are the Strategy Advisor on the NewLeaf Verification Desk. Given live market data — spot price, technicals, IV, open interest, and gamma walls — recommend the top 3 option strategies ranked by risk-adjusted suitability.

## Decision framework
1. Neutral trend + high IV → Iron Condor or Short Strangle
2. Neutral trend + low IV → Calendar or Diagonal
3. Directional trend + any IV → Vertical Spread
4. Neutral trend + skewed OI → Broken Wing Butterfly

## Output
Return ONLY a JSON object:
{
  "strategies": [
    { "strategy": "iron_condor" | "broken_wing_butterfly" | "vertical_spread" | "short_strangle" | "calendar" | "diagonal",
      "rationale": "<why, ≤40 words>",
      "score": <0-100> }
  ],
  "marketRead": "<≤30 words>"
}
Return exactly 3 strategies, sorted by score descending.`;

async function apiCall(path, body) {
  const res = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-API-Key': 'dev-key' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${await res.text().catch(() => '')}`);
  return res.json();
}

async function runTicker(ticker) {
  try {
    // 1. NEW: engine-decides + LLM-explains
    const newResult = await apiCall('/api/recommend', { ticker, expiry: EXPIRY, modelMode: 'budget-qwq' });
    const enginePick = newResult.enginePick;
    const newExplanation = newResult.recommendation?.strategies?.[0];

    // 2. OLD: LLM picks strategy (simulate with /api/llm/call using old prompt)
    const indicators = newResult.indicators;
    const ga = newResult.gammaAnalysis;
    const spot = newResult.snapshot?.price;

    let oldPrompt = `Recommend the top 3 option strategies for:
## TICKER: ${ticker}
Spot: $${spot?.toFixed(2)} | RSI(14): ${indicators?.rsi14} | ADX(14): ${indicators?.adx14}
SMA trend: ${indicators?.smaTrend} | Bollinger width: ${indicators?.bollingerWidth}%`;

    if (ga) {
      oldPrompt += `\nPut wall: ${ga.putWallStrike ?? 'none'} | Call wall: ${ga.callWallStrike ?? 'none'} | Spot inside band: ${ga.spotInsideBand}`;
    }
    oldPrompt += '\nReturn exactly 3 strategies sorted by score descending.';

    const oldResult = await apiCall('/api/llm/call', {
      model: 'qwq',
      system: OLD_SYSTEM,
      user: oldPrompt,
      maxTokens: 1500,
    });

    // Parse old LLM response
    let oldPick = '?';
    try {
      let raw = oldResult.response.trim();
      const fence = raw.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
      if (fence) raw = fence[1].trim();
      if (!raw.startsWith('{')) { const s = raw.indexOf('{'), e = raw.lastIndexOf('}'); if (s !== -1 && e !== -1) raw = raw.slice(s, e+1); }
      const parsed = JSON.parse(raw);
      oldPick = parsed.strategies?.[0]?.strategy || '?';
    } catch(e) {
      oldPick = 'PARSE_FAIL';
    }

    // Normalize old pick names
    const nameMap = {
      'vertical_spread': 'directional (vertical)',
      'vertical spread': 'directional (vertical)',
      'short_strangle': 'short_strangle (advisor-only)',
      'iron condor': 'iron_condor', 'iron_condor': 'iron_condor',
      'broken wing butterfly': 'broken_wing_butterfly', 'broken_wing_butterfly': 'broken_wing_butterfly',
      'calendar': 'calendar_spread', 'calendar spread': 'calendar_spread',
      'diagonal': 'diagonal_spread', 'diagonal spread': 'diagonal_spread',
    };
    const normalizedOld = nameMap[oldPick.toLowerCase()] || oldPick;

    const agrees = normalizedOld === enginePick?.strategy ||
      (normalizedOld === 'directional (vertical)' && (enginePick?.strategy === 'bull_put_spread' || enginePick?.strategy === 'bear_call_spread'));

    return {
      ticker, spot,
      engineStrategy: enginePick?.strategy,
      engineDirection: enginePick?.direction,
      engineScore: enginePick?.score,
      oldLlmPick: normalizedOld,
      agrees,
      newExplanation: newExplanation?.rationale || '(no rationale)',
      marketRead: newResult.recommendation?.marketRead || '',
      contradictions: [], // The advisor logs these server-side; check API logs
      adx: indicators?.adx14,
      trendStrength: '?', // from engine pick metadata
    };
  } catch (err) {
    return { ticker, error: err.message };
  }
}

async function main() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║  PHASE 4: Parallel Validation — 20 Tickers                 ║');
  console.log('║  Old: LLM decides  |  New: Engine decides, LLM explains    ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');
  console.log('Expiry:', EXPIRY, '\n');

  const results = [];
  // Run 2 at a time to avoid rate limits
  for (let i = 0; i < TICKERS.length; i += 2) {
    const batch = TICKERS.slice(i, i + 2);
    process.stdout.write(`Running ${batch.join(', ')}...`);
    const res = await Promise.all(batch.map(t => runTicker(t)));
    results.push(...res);
    console.log(' done');
    if (i + 2 < TICKERS.length) await new Promise(r => setTimeout(r, 2000));
  }

  // Report
  console.log('\n' + '═'.repeat(90) + '\n');

  let disagreeCount = 0;
  for (const r of results) {
    if (r.error) {
      console.log(`${r.ticker}: ERROR — ${r.error}\n`);
      continue;
    }

    const tag = r.agrees ? '✓ AGREE' : '✗ DISAGREE';
    if (!r.agrees) disagreeCount++;

    console.log(`── ${r.ticker} @ $${r.spot?.toFixed(2)} ──────────────────────────────────────`);
    console.log(`  Engine pick:    ${r.engineStrategy} (${r.engineDirection}, score ${r.engineScore})`);
    console.log(`  Old LLM pick:   ${r.oldLlmPick}`);
    console.log(`  ${tag}`);
    console.log(`  ADX:            ${r.adx}`);
    console.log(`  Explanation:    "${r.newExplanation}"`);
    console.log(`  Market read:    "${r.marketRead}"`);
    console.log('');
  }

  // Summary
  console.log('═'.repeat(90));
  console.log(`\nAGREEMENTS:    ${results.filter(r => r.agrees).length}/${results.filter(r => !r.error).length}`);
  console.log(`DISAGREEMENTS: ${disagreeCount}/${results.filter(r => !r.error).length}`);
  console.log(`ERRORS:        ${results.filter(r => r.error).length}`);

  if (disagreeCount > 0) {
    console.log('\n── DISAGREEMENTS (for manual review) ──');
    for (const r of results.filter(r => !r.agrees && !r.error)) {
      console.log(`  ${r.ticker}: engine=${r.engineStrategy} vs old_llm=${r.oldLlmPick} | ADX=${r.adx}`);
    }
  }
}

main().catch(err => { console.error('Fatal:', err.message); process.exit(1); });
