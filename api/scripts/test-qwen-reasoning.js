/**
 * Fair comparison: FAST prompt vs REASONING prompt across Qwen models
 * Tests whether reasoning models actually produce better hedge-fund-level analysis
 *
 * Run: node --env-file=.env.local scripts/test-qwen-reasoning.js
 */
import OpenAI from 'openai';

const DASHSCOPE_KEY = process.env.DASHSCOPE_API_KEY;
if (!DASHSCOPE_KEY) {
  console.error('Missing DASHSCOPE_API_KEY in .env.local');
  process.exit(1);
}

const client = new OpenAI({
  apiKey: DASHSCOPE_KEY,
  baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
  timeout: 120_000,
});

// ── Models to test ──────────────────────────────────────────────
const MODELS = [
  { id: 'qwen-plus',   label: 'qwen-plus',   tier: 'fast' },
  { id: 'qwen-max',    label: 'qwen-max',    tier: 'fast' },
  { id: 'qwen3-max',   label: 'qwen3-max',   tier: 'reasoning' },
  { id: 'qwen3.5-plus-2026-02-15', label: 'qwen3.5-plus', tier: 'reasoning', extra: { enable_thinking: false } },
];

// ── PROMPT 1: Fast (summarization) ──────────────────────────────
const FAST_PROMPT = {
  system: 'You are a concise market analyst. Respond with exactly one sentence.',
  user: 'Given AAPL at $195, IV rank 45, RSI 55, ADX 22, trend neutral: produce one sentence market read.',
  maxTokens: 200,
};

// ── PROMPT 2: Reasoning (strategy analysis from raw data) ───────
const REASONING_PROMPT = {
  system: `You are a senior options strategist at a quantitative hedge fund.
You receive raw market data and must independently analyze it to recommend
the optimal options strategy. Think step by step through the data.

Return a JSON object with:
{
  "strategy": "iron_condor" | "bull_put_spread" | "bear_call_spread" | "broken_wing_butterfly" | "calendar_spread" | "iron_butterfly",
  "conviction": 1-10,
  "thesis": "<why this trade works, 2-3 sentences>",
  "legs": [{ "type": "call|put", "side": "long|short", "strike": <number> }],
  "risks": ["<risk 1>", "<risk 2>"],
  "exit": "<when to take profit or cut loss>"
}`,

  user: `Analyze this data and recommend the best options strategy:

## TICKER: MSFT
Spot: $442.30 (+0.8%)
Expiry: 2026-06-19 (19 DTE)

## TECHNICALS
RSI(14): 62.1 | ADX(14): 31.5
SMA20: $435.80 | SMA50: $428.40 | SMA200: $410.20
Price vs SMAs: above_all | SMA trend: bullish
Bollinger width: 6.2% | ATR(14): $5.80
MACD: 3.2 (signal: 2.1, histogram: +1.1)

## GAMMA WALLS
Put wall: $430 (OI: 42,000) | Call wall: $455 (OI: 38,500)
Band width: 5.6% | Confidence: 0.78
GEX: net positive (dealers long gamma → mean-reverting)

## OPTIONS CHAIN (19 DTE)
Strike | C.Bid | C.Ask | C.IV  | P.Bid | P.Ask | P.IV  | C.OI   | P.OI
425    | 18.20 | 18.60 | 22.1% | 0.55  | 0.75  | 24.3% | 12,400 | 8,200
430    | 13.80 | 14.10 | 21.5% | 1.10  | 1.30  | 23.8% | 15,600 | 42,000
435    | 9.90  | 10.20 | 21.0% | 2.20  | 2.50  | 23.1% | 11,200 | 9,800
440    | 6.50  | 6.80  | 20.5% | 3.80  | 4.10  | 22.5% | 18,300 | 14,100
442.5  | 5.20  | 5.50  | 20.3% | 4.80  | 5.10  | 22.2% | 8,900  | 7,600
445    | 3.90  | 4.20  | 20.1% | 5.90  | 6.20  | 21.9% | 22,100 | 11,400
447.5  | 2.80  | 3.10  | 19.8% | 7.30  | 7.60  | 21.6% | 6,700  | 5,300
450    | 1.90  | 2.20  | 19.5% | 9.00  | 9.30  | 21.3% | 28,400 | 16,800
455    | 0.75  | 1.00  | 19.0% | 12.80 | 13.10 | 20.8% | 38,500 | 10,200
460    | 0.25  | 0.45  | 18.8% | 17.50 | 17.80 | 20.5% | 9,100  | 4,600

## IV ENVIRONMENT
ATM IV: 20.3% | IV Rank: 52 | IV Percentile: 58
Put skew: puts trading 2-3% richer than calls
Historical RV(20): 18.5% | IV/RV ratio: 1.10

## MARKET CONTEXT
SPY: +0.3% today, above 20-SMA
VIX: 14.2 (low vol regime)
Sector (XLK): +0.5%, in line with broad market
Earnings: none within expiry window

Based on ALL this data, what is the optimal strategy and why?`,
  maxTokens: 1500,
};

// ── Test runner ─────────────────────────────────────────────────
async function testModel(model, prompt, extra) {
  const t0 = Date.now();
  try {
    const params = {
      model: model.id,
      messages: [
        { role: 'system', content: prompt.system },
        { role: 'user', content: prompt.user },
      ],
      max_tokens: prompt.maxTokens,
    };
    if (extra) params.extra_body = extra;

    const r = await client.chat.completions.create(params);
    const ms = Date.now() - t0;
    const text = r.choices[0]?.message?.content || '';
    const input = r.usage?.prompt_tokens || 0;
    const output = r.usage?.completion_tokens || 0;
    return { model: model.label, ms, input, output, text, ok: true };
  } catch (err) {
    const ms = Date.now() - t0;
    return { model: model.label, ms, ok: false, error: err.message };
  }
}

function printResult(label, result) {
  if (!result.ok) {
    console.log(`\n  ❌ ${result.model} — FAILED (${(result.ms/1000).toFixed(1)}s): ${result.error}`);
    return;
  }
  console.log(`\n  ✅ ${result.model} — ${(result.ms/1000).toFixed(1)}s | ${result.output} tokens out`);
  // Show truncated response
  const lines = result.text.split('\n').slice(0, 15);
  for (const line of lines) {
    console.log(`     ${line.slice(0, 120)}`);
  }
  if (result.text.split('\n').length > 15) console.log('     ...(truncated)');
}

function scoreResponse(result) {
  if (!result.ok) return { strategy: false, legs: false, thesis: false, risks: false, exit: false, json: false };
  const t = result.text;

  // Try to extract JSON
  let parsed = null;
  try {
    const jsonMatch = t.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
  } catch {}

  return {
    json: !!parsed,
    strategy: parsed?.strategy ? true : false,
    legs: Array.isArray(parsed?.legs) && parsed.legs.length >= 2,
    thesis: typeof parsed?.thesis === 'string' && parsed.thesis.length > 20,
    risks: Array.isArray(parsed?.risks) && parsed.risks.length >= 1,
    exit: typeof parsed?.exit === 'string' && parsed.exit.length > 5,
    conviction: parsed?.conviction || '—',
    strategyName: parsed?.strategy || '—',
  };
}

async function run() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  Qwen Model Comparison: FAST vs REASONING prompts');
  console.log('═══════════════════════════════════════════════════════════════');

  // ── Round 1: Fast prompt ──
  console.log('\n─── ROUND 1: Fast Prompt (one-sentence market read) ───');
  const fastResults = [];
  for (const m of MODELS) {
    const r = await testModel(m, FAST_PROMPT, m.extra);
    fastResults.push(r);
    printResult('FAST', r);
  }

  // ── Round 2: Reasoning prompt ──
  console.log('\n\n─── ROUND 2: Reasoning Prompt (full strategy analysis) ───');
  const reasonResults = [];
  for (const m of MODELS) {
    const r = await testModel(m, REASONING_PROMPT, m.extra);
    reasonResults.push(r);
    printResult('REASONING', r);
  }

  // ── Summary table ──
  console.log('\n\n═══════════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════');

  console.log('\n  Fast Prompt (speed matters, quality doesn\'t):');
  console.log('  ┌────────────────┬────────┬────────────┐');
  console.log('  │ Model          │ Time   │ Tokens Out │');
  console.log('  ├────────────────┼────────┼────────────┤');
  for (const r of fastResults) {
    if (!r.ok) { console.log(`  │ ${r.model.padEnd(14)} │ FAIL   │ —          │`); continue; }
    console.log(`  │ ${r.model.padEnd(14)} │ ${(r.ms/1000).toFixed(1).padStart(5)}s │ ${String(r.output).padStart(10)} │`);
  }
  console.log('  └────────────────┴────────┴────────────┘');

  console.log('\n  Reasoning Prompt (quality matters):');
  console.log('  ┌────────────────┬────────┬────────────┬──────────┬──────┬──────┬────────┬───────┬──────┐');
  console.log('  │ Model          │ Time   │ Tokens Out │ Strategy │ Legs │ JSON │ Thesis │ Risks │ Exit │');
  console.log('  ├────────────────┼────────┼────────────┼──────────┼──────┼──────┼────────┼───────┼──────┤');
  for (const r of reasonResults) {
    if (!r.ok) {
      console.log(`  │ ${r.model.padEnd(14)} │ FAIL   │ —          │ —        │ —    │ —    │ —      │ —     │ —    │`);
      continue;
    }
    const s = scoreResponse(r);
    console.log(`  │ ${r.model.padEnd(14)} │ ${(r.ms/1000).toFixed(1).padStart(5)}s │ ${String(r.output).padStart(10)} │ ${(s.strategyName || '—').slice(0,8).padEnd(8)} │ ${s.legs ? '✅' : '❌'}   │ ${s.json ? '✅' : '❌'}   │ ${s.thesis ? '✅' : '❌'}     │ ${s.risks ? '✅' : '❌'}    │ ${s.exit ? '✅' : '❌'}   │`);
  }
  console.log('  └────────────────┴────────┴────────────┴──────────┴──────┴──────┴────────┴───────┴──────┘');

  console.log('\n  Legend: Strategy picked | Valid legs array | Parseable JSON | Has thesis | Has risks | Has exit plan');
  console.log('\nDone.');
}

run();
