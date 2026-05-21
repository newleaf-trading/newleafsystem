import { z } from 'zod';
import type { LLMRouter } from '../llm/router.js';
import type { StockSnapshot } from '../tools/alpaca.js';
import type { TechnicalIndicators } from '../tools/indicators.js';
import type { GammaAnalysis, LegMarketData } from '../tools/market-data.js';
import type { OptionContract } from '../tools/alpaca.js';

const RecommendationSchema = z.object({
  strategies: z.array(z.object({
    strategy: z.enum(['iron_condor', 'broken_wing_butterfly', 'vertical_spread', 'short_strangle', 'calendar', 'diagonal']),
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

const SYSTEM = `You are the Strategy Advisor on the NewLeaf Verification Desk. Given live market data — spot price, technicals, IV, open interest, and gamma walls — recommend the top 3 option strategies ranked by risk-adjusted suitability.

## Decision framework

1. **Trend + IV environment determines structure class:**
   - Neutral trend + high IV → Iron Condor or Short Strangle (sell premium)
   - Neutral trend + low IV → Calendar or Diagonal (buy cheap vol)
   - Directional trend + any IV → Vertical Spread (directional credit/debit)
   - Neutral trend + skewed OI → Broken Wing Butterfly (asymmetric)

2. **Gamma walls determine strike placement:**
   - Short strikes should be OUTSIDE the gamma walls (support/resistance from dealer hedging)
   - Put wall = support level for short puts
   - Call wall = resistance level for short calls
   - Higher OI = stronger wall = safer short strike placement
   - If spot is inside the put/call wall band, range-bound strategies are favored

3. **OI concentration determines wing placement:**
   - High put OI at a strike = strong support → good for short put placement AT or below that strike
   - High call OI at a strike = strong resistance → good for short call placement AT or above that strike
   - Long wings go further out where OI drops off

4. **Score (0-100):** How well-suited this strategy is given current conditions.

## Output

Return ONLY a JSON object:

{
  "strategies": [
    {
      "strategy": "iron_condor" | "broken_wing_butterfly" | "vertical_spread" | "short_strangle" | "calendar" | "diagonal",
      "legs": [{ "type": "call"|"put", "side": "long"|"short", "strike": <number> }],
      "rationale": "<why this strategy fits current conditions, ≤40 words>",
      "score": <0-100>,
      "netCredit": <estimated net credit from mid prices>
    }
  ],
  "marketRead": "<≤30 words: overall market read driving these recommendations>"
}

Pick strikes from the AVAILABLE STRIKES in the chain data. Do not invent strikes that don't exist.
Return exactly 3 strategies, sorted by score descending.`;

export class StrategyAdvisor {
  constructor(private llm: LLMRouter) {}

  async recommend(opts: {
    ticker: string;
    expiry: string;
    snapshot: StockSnapshot;
    indicators: TechnicalIndicators;
    gammaAnalysis?: GammaAnalysis;
    chain: { strike: number; call?: OptionContract; put?: OptionContract }[];
    modelMode?: import('../types.js').ModelMode;
  }): Promise<StrategyRecommendation> {
    const { ticker, expiry, snapshot, indicators, gammaAnalysis, chain, modelMode } = opts;
    const dte = Math.max(0, Math.round((new Date(expiry).getTime() - Date.now()) / 86400000));

    // Build available strikes summary (near ATM ±15%)
    const range = snapshot.price * 0.15;
    const nearStrikes = chain.filter(s =>
      s.strike >= snapshot.price - range && s.strike <= snapshot.price + range
    );

    let prompt = `Recommend the top 3 option strategies for:

## TICKER: ${ticker}
Spot: $${snapshot.price.toFixed(2)} (${snapshot.change >= 0 ? '+' : ''}${snapshot.changePct}%)
Expiry: ${expiry} (${dte} DTE)

## TECHNICALS
RSI(14): ${indicators.rsi14} | ADX(14): ${indicators.adx14}
SMA trend: ${indicators.smaTrend} | Price vs SMAs: ${indicators.priceVsSma}
Bollinger width: ${indicators.bollingerWidth}% | ATR(14): $${indicators.atr14}

## AVAILABLE STRIKES (with IV and pricing)
${nearStrikes.map(s => {
  const c = s.call;
  const p = s.put;
  return `${s.strike}: C[bid=${c?.bid??0} ask=${c?.ask??0} iv=${c?.iv ? (c.iv*100).toFixed(0)+'%' : '--'} delta=${c?.delta?.toFixed(2)??'--'}] P[bid=${p?.bid??0} ask=${p?.ask??0} iv=${p?.iv ? (p.iv*100).toFixed(0)+'%' : '--'} delta=${p?.delta?.toFixed(2)??'--'}]`;
}).join('\n')}`;

    if (gammaAnalysis) {
      prompt += `

## GAMMA WALLS (from Nasdaq open interest)
Top walls by OI:
${gammaAnalysis.walls.map(w => `  Strike ${w.strike}: OI=${w.totalOI.toLocaleString()} side=${w.side} strength=${w.strength}`).join('\n')}
Put wall (support): ${gammaAnalysis.putWallStrike ?? 'none'}
Call wall (resistance): ${gammaAnalysis.callWallStrike ?? 'none'}
Spot inside band: ${gammaAnalysis.spotInsideBand}

## OI BY STRIKE
${gammaAnalysis.oiByStrike.map(s =>
  `${s.strike}: call_OI=${s.callOI.toLocaleString()} put_OI=${s.putOI.toLocaleString()}`
).join('\n')}`;
    }

    prompt += `

Pick the 3 best strategies with specific strikes from the available chain. Explain why each fits the current market conditions.`;

    const modeModelMap: Record<string, import('../llm/router.js').ModelTier> = {
      'premium': 'qwen-max', 'budget-v3': 'deepseek', 'budget-r1': 'deepseek-r1', 'budget-qwq': 'qwq',
    };
    const advisorModel = modeModelMap[modelMode ?? 'premium'] ?? 'qwq';
    const raw = await this.llm.call(advisorModel, { system: SYSTEM, user: prompt, maxTokens: 3000 });

    // Parse response — handle JSON mode (clean) and freeform (markdown fences)
    let cleaned = raw.trim();
    const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (fenceMatch) cleaned = fenceMatch[1].trim();
    if (!cleaned.startsWith('{')) {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start !== -1 && end !== -1) cleaned = cleaned.slice(start, end + 1);
    }
    const parsed = JSON.parse(cleaned);

    // Normalize: models return strategies in wildly different shapes
    const strategyMap: Record<string, string> = {
      'iron condor': 'iron_condor', 'ironcondor': 'iron_condor', 'iron_condor': 'iron_condor',
      'broken wing butterfly': 'broken_wing_butterfly', 'bwb': 'broken_wing_butterfly', 'broken_wing_butterfly': 'broken_wing_butterfly',
      'vertical spread': 'vertical_spread', 'vertical': 'vertical_spread', 'vertical_spread': 'vertical_spread',
      'bull call spread': 'vertical_spread', 'bear put spread': 'vertical_spread', 'call spread': 'vertical_spread', 'put spread': 'vertical_spread',
      'short strangle': 'short_strangle', 'strangle': 'short_strangle', 'short_strangle': 'short_strangle',
      'calendar': 'calendar', 'calendar spread': 'calendar',
      'diagonal': 'diagonal', 'diagonal spread': 'diagonal',
    };

    if (parsed.strategies && Array.isArray(parsed.strategies)) {
      parsed.strategies = parsed.strategies
        .map((s: any) => {
          const name = (s.strategy ?? '').toLowerCase().trim();
          const mapped = strategyMap[name] ?? 'iron_condor';
          const legs = Array.isArray(s.legs) ? s.legs.filter((l: any) => typeof l === 'object' && l.strike) : [];
          let score = typeof s.score === 'number' ? s.score : 70;
          if (score <= 10) score = score * 10; // normalize 1-10 scale to 0-100
          return {
            strategy: mapped,
            legs,
            rationale: s.rationale ?? s.description ?? s.reason ?? s.explanation ?? s.analysis ?? JSON.stringify(s).slice(0, 200),
            score: Math.round(score),
            netCredit: s.netCredit ?? s.net_credit ?? undefined,
          };
        })
        .slice(0, 3);
      // Ensure at least 1 strategy
      if (parsed.strategies.length === 0) {
        console.warn('Advisor: no valid strategies after normalization. Raw:', JSON.stringify(parsed).slice(0, 500));
      }
    }
    if (!parsed.marketRead) parsed.marketRead = parsed.market_read ?? parsed.summary ?? '';
    return RecommendationSchema.parse(parsed);
  }
}
