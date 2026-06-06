import { z } from 'zod';
import type { LLMRouter, ModelTier } from '../llm/router.js';
import { getModel } from '../llm/model-assignments.js';
import type { StockSnapshot } from '../tools/alpaca.js';
import type { BuiltLeg } from '../tools/leg-builder.js';

// ── Output schemas ───────────────────────────────────────────────────────────

// LLM only returns rationale + marketRead; legs are built deterministically
const ExplanationSchema = z.object({
  explanations: z.array(z.object({
    strategy: z.string(),
    rationale: z.string(),
  })).min(1).max(3),
  marketRead: z.string().default(''),
});

export type StrategyExplanation = z.infer<typeof ExplanationSchema>;

// Legacy schema for backward compat (discover.html expects this shape)
const RecommendationSchema = z.object({
  strategies: z.array(z.object({
    strategy: z.enum(['iron_condor', 'broken_wing_butterfly', 'vertical_spread', 'short_strangle', 'calendar', 'diagonal',
      'bull_put_spread', 'bear_call_spread', 'iron_butterfly', 'calendar_spread']),
    legs: z.array(z.object({
      type: z.enum(['call', 'put']),
      side: z.enum(['long', 'short']),
      strike: z.number(),
    })).default([]),
    rationale: z.string(),
    score: z.number().default(70),
    netCredit: z.number().optional(),
  })).min(1).max(5),
  marketRead: z.string().default(''),
});

export type StrategyRecommendation = z.infer<typeof RecommendationSchema>;

// ── Consistency check ────────────────────────────────────────────────────────

const BULLISH_WORDS = /\b(bullish|upside|rally|support|upward|rise|climb|recovery)\b/i;
const BEARISH_WORDS = /\b(bearish|downside|decline|resistance|downward|fall|drop|selloff)\b/i;
const NEUTRAL_WORDS = /\b(neutral|range.?bound|sideways|consolidat|flat|stable)\b/i;

function checkConsistency(strategy: string, direction: string, rationale: string): string | null {
  const hasBullish = BULLISH_WORDS.test(rationale);
  const hasBearish = BEARISH_WORDS.test(rationale);

  if (direction === 'bullish' && hasBearish && !hasBullish) {
    return `CONTRADICTION: Engine picked ${strategy} (bullish) but LLM explanation argues bearish: "${rationale.slice(0, 100)}"`;
  }
  if (direction === 'bearish' && hasBullish && !hasBearish) {
    return `CONTRADICTION: Engine picked ${strategy} (bearish) but LLM explanation argues bullish: "${rationale.slice(0, 100)}"`;
  }
  if ((strategy === 'iron_condor' || strategy === 'iron_butterfly') && !NEUTRAL_WORDS.test(rationale) && (hasBullish || hasBearish)) {
    return `TENSION: Engine picked ${strategy} (neutral) but LLM explanation has directional language: "${rationale.slice(0, 100)}"`;
  }
  return null;
}

// ── System prompt: explain, don't re-rank ────────────────────────────────────

const EXPLAIN_SYSTEM = `You are the Strategy Advisor on the NewLeaf Verification Desk. The deterministic scoring engine has already selected the strategy, and legs have been constructed deterministically. Your job is to EXPLAIN why the strategy fits the current market conditions.

## Rules
1. Do NOT change the strategy selection or re-rank. The engine decided; you explain.
2. For each strategy, write a rationale (≤40 words) explaining WHY it fits given the technicals, gamma walls, and IV environment.
3. Write a marketRead (≤30 words) summarizing the overall regime.
4. Do NOT pick strikes or output legs. Legs are built deterministically by the system.

## Output

Return ONLY a JSON object:

{
  "explanations": [
    {
      "strategy": "<the strategy code the engine selected>",
      "rationale": "<why this strategy fits, ≤40 words>"
    }
  ],
  "marketRead": "<≤30 words: overall market read>"
}`;

// ── StrategyAdvisor class ────────────────────────────────────────────────────

export class StrategyAdvisor {
  constructor(private llm: LLMRouter) {}

  /**
   * Engine-decides / LLM-explains flow.
   * Legs are built deterministically by leg-builder.ts. The LLM only writes rationale.
   */
  async explain(opts: {
    ticker: string;
    expiry: string;
    snapshot: StockSnapshot;
    enginePick: { strategy: string; direction: string; score: number; pillars: any };
    preBuiltLegs: BuiltLeg[];
    technicalSummary: string;
    gammaSummary: string;
    modelMode?: string;
  }): Promise<{ explanation: StrategyExplanation; contradictions: string[] }> {
    const { ticker, expiry, snapshot, enginePick, preBuiltLegs, technicalSummary, gammaSummary, modelMode } = opts;
    const dte = Math.max(0, Math.round((new Date(expiry).getTime() - Date.now()) / 86400000));

    const legsSummary = preBuiltLegs.map(l =>
      `${l.side} ${l.qty > 1 ? l.qty + 'x ' : ''}${l.type} $${l.strike}`
    ).join(', ');

    const prompt = `The engine selected **${enginePick.strategy}** (score ${enginePick.score}, direction: ${enginePick.direction}) for:

## TICKER: ${ticker}
Spot: $${snapshot.price.toFixed(2)} (${snapshot.change >= 0 ? '+' : ''}${snapshot.changePct}%)
Expiry: ${expiry} (${dte} DTE)

## TECHNICALS
${technicalSummary}
${gammaSummary}

## LEGS (built deterministically)
${legsSummary}

Explain why ${enginePick.strategy} fits these conditions.`;

    const modeModelMap: Record<string, ModelTier> = {
      'premium': getModel('recommend'), 'budget-v3': 'deepseek', 'budget-r1': 'deepseek-r1', 'budget-qwq': 'qwen-max',
    };
    const advisorModel = modeModelMap[modelMode ?? 'premium'] ?? getModel('recommend');
    const raw = await this.llm.call(advisorModel, { system: EXPLAIN_SYSTEM, user: prompt, maxTokens: 800 });

    // Parse
    let cleaned = raw.trim();
    const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (fenceMatch) cleaned = fenceMatch[1].trim();
    if (!cleaned.startsWith('{')) {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start !== -1 && end !== -1) cleaned = cleaned.slice(start, end + 1);
    }
    const parsed = JSON.parse(cleaned);

    // Normalize explanations array
    if (parsed.explanations && Array.isArray(parsed.explanations)) {
      parsed.explanations = parsed.explanations.map((e: any) => ({
        strategy: e.strategy ?? enginePick.strategy,
        rationale: e.rationale ?? e.description ?? e.reason ?? '',
      })).slice(0, 3);
    }
    if (!parsed.marketRead) parsed.marketRead = parsed.market_read ?? parsed.summary ?? '';

    const explanation = ExplanationSchema.parse(parsed);

    // Consistency check
    const contradictions: string[] = [];
    for (const ex of explanation.explanations) {
      const issue = checkConsistency(ex.strategy, enginePick.direction, ex.rationale);
      if (issue) contradictions.push(issue);
    }

    return { explanation, contradictions };
  }

  /**
   * Legacy recommend() — wraps engine-decides + LLM-explains into the old response shape
   * for backward compatibility with discover.html.
   * Legs come from the deterministic leg-builder, not the LLM.
   */
  async recommend(opts: {
    ticker: string;
    expiry: string;
    snapshot: StockSnapshot;
    enginePick: { strategy: string; direction: string; score: number; pillars: any };
    preBuiltLegs: BuiltLeg[];
    technicalSummary: string;
    gammaSummary: string;
    modelMode?: string;
  }): Promise<StrategyRecommendation> {
    const { explanation, contradictions } = await this.explain(opts);

    if (contradictions.length > 0) {
      console.warn('[Advisor] Consistency issues:', contradictions);
    }

    // Map to legacy shape — legs from deterministic builder, rationale from LLM
    const strategies = explanation.explanations.map((ex, i) => ({
      strategy: ex.strategy as any,
      legs: opts.preBuiltLegs.map(l => ({ type: l.type, side: l.side, strike: l.strike })),
      rationale: ex.rationale,
      score: Math.max(0, opts.enginePick.score - i * 5),
    }));

    return RecommendationSchema.parse({
      strategies,
      marketRead: explanation.marketRead,
    });
  }
}
