import { SuggestedFixSchema } from '../types.js';
import type { TradeIdea, TechnicalReport, GammaReport, IVReport, SentimentReport, RiskReport, Verdict, SuggestedFix, ModelMode } from '../types.js';
import type { LLMRouter } from '../llm/router.js';
import type { MarketData } from '../tools/market-data.js';

const SYSTEM = `You are the Trade Fixer on the NewLeaf Verification Desk. A proposed trade was rejected or rated marginal by the verification panel. Your job: suggest a CONCRETE alternative that addresses the specific failures.

## Actions

1. **"adjust"** — Same strategy type, different strikes or sizing. Use when the structure is right but placement is wrong. Provide exact new legs with strikes from the available chain.

2. **"switch"** — Different strategy entirely. Use when the current market regime doesn't suit the proposed structure (e.g., selling premium in low IV, or iron condor in a trending market).

3. **"wait"** — No trade right now. Use when conditions are temporarily unfavorable but may improve. Specify the exact condition to wait for.

## Rules

- Every suggestion must directly address the flip conditions from the verdict
- Use REAL strikes from the available chain — don't invent prices
- Be specific: "Move short put from 225 to 220" not "widen the strikes"
- If suggesting a switch, explain why the new structure fits the current regime

## Output

Return ONLY a JSON object:

{
  "action": "adjust" | "wait" | "switch",
  "strategy": "<strategy name or description>",
  "legs": [{ "type": "call"|"put", "side": "long"|"short", "strike": <number> }],
  "rationale": "<≤60 words: what was wrong and how this fixes it>",
  "waitCondition": "<if action=wait: specific condition to re-evaluate>"
}

For "wait" action, legs can be omitted.`;

export class TradeFixer {
  constructor(private llm: LLMRouter) {}

  async fix(opts: {
    input: TradeIdea;
    verdict: Verdict;
    evidence: { technical: TechnicalReport; gamma: GammaReport; iv: IVReport; sentiment: SentimentReport };
    riskReport: RiskReport;
    marketData?: MarketData;
    modelMode?: ModelMode;
  }): Promise<SuggestedFix> {
    const { input, verdict, evidence, riskReport, marketData, modelMode } = opts;
    const expiry = input.legs[0]?.expiry ?? 'unknown';
    const dte = Math.max(0, Math.round((new Date(expiry).getTime() - Date.now()) / 86400000));

    let prompt = `The following trade was ${verdict.call === 'fail' ? 'REJECTED' : 'rated MARGINAL'} by the verification panel. Suggest what to do instead.

## REJECTED TRADE
Ticker: ${input.ticker} | Structure: ${input.structure} | DTE: ${dte}
Legs: ${input.legs.map(l => `${l.side} ${l.strike} ${l.type}`).join(' / ')}
${input.netCredit != null ? `Net credit: $${input.netCredit}` : ''}

## VERDICT
Call: ${verdict.call} | Confidence: ${verdict.confidence}
Rationale: ${verdict.rationale}
Flip conditions: ${verdict.flipConditions.join(' | ')}

## ANALYST EVIDENCE
Technical: ${evidence.technical.trend}, RSI ${evidence.technical.rsi}, breakout ${evidence.technical.breakoutRisk}
Gamma: wall integrity ${evidence.gamma.wallIntegrity}, flip distance ${evidence.gamma.flipDistance}, ${evidence.gamma.insideBand ? 'inside' : 'outside'} band
IV: rank ${evidence.iv.ivRank}, ${evidence.iv.termStructure}, premium ${evidence.iv.premiumFairness}
Sentiment: polarity ${evidence.sentiment.polarity}, ${evidence.sentiment.catalystsInWindow.length} catalysts

## RISK
Portfolio fit: ${riskReport.portfolioFit} — ${riskReport.rationale}`;

    if (marketData) {
      prompt += `

## CURRENT MARKET
Spot: $${marketData.snapshot.price}`;

      if (marketData.gammaAnalysis) {
        const ga = marketData.gammaAnalysis;
        prompt += `
Put wall: ${ga.putWallStrike ?? 'none'} | Call wall: ${ga.callWallStrike ?? 'none'}
Top OI strikes: ${ga.walls.map(w => `${w.strike} (${w.totalOI} OI, ${w.side})`).join(', ')}`;
      }

      // Show available strikes for the fixer to pick from
      const nearStrikes = marketData.legs.length > 0
        ? `Available leg data: ${marketData.legs.map(l => `${l.strike}${l.type[0]} mid=$${l.mid}`).join(', ')}`
        : '';
      if (nearStrikes) prompt += `\n${nearStrikes}`;
    }

    prompt += `

Based on the failures above, suggest the best course of action. Address each flip condition specifically.`;

    const modeModelMap: Record<string, import('../llm/router.js').ModelTier> = {
      'premium': 'claude-sonnet', 'budget-v3': 'deepseek', 'budget-r1': 'deepseek-r1', 'budget-qwq': 'qwen-max',
    };
    const fixerModel = modeModelMap[modelMode ?? 'premium'] ?? 'claude-sonnet';
    const raw = await this.llm.call(fixerModel, { system: SYSTEM, user: prompt, maxTokens: 1500 });

    // Parse
    let cleaned = raw.trim();
    const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (fenceMatch) cleaned = fenceMatch[1].trim();
    if (!cleaned.startsWith('{')) {
      const s = cleaned.indexOf('{'), e = cleaned.lastIndexOf('}');
      if (s !== -1 && e !== -1) cleaned = cleaned.slice(s, e + 1);
    }
    return SuggestedFixSchema.parse(JSON.parse(cleaned));
  }
}
