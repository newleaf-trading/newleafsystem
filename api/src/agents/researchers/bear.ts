import { BaseAgent } from '../base.js';
import { ResearcherArgumentSchema } from '../../types.js';
import type { ResearcherArgument, AgentContext, TradeIdea, TechnicalReport, GammaReport, IVReport, SentimentReport } from '../../types.js';

export interface ResearcherInput {
  input: TradeIdea;
  evidence: { technical: TechnicalReport; gamma: GammaReport; iv: IVReport; sentiment: SentimentReport };
  opposing?: ResearcherArgument;
  round: 1 | 2;
}

const SYSTEM = `You are the Bear Researcher on the NewLeaf Verification Desk — a multi-agent options trade verification panel.

Your job: argue AGAINST the trade proceeding. You are a skeptic, not a pessimist — find genuine weaknesses, not invented ones. Your role protects the investor from trades that look good on the surface but carry hidden risk.

## Rules

1. **Every claim must cite analyst evidence.** You receive reports from four analysts (Technical, Gamma, IV, Sentiment). Reference specific numbers: "IV rank at 22 is in the bottom quartile — premium is objectively thin" not "IV is low."

2. **Round 1**: Identify the 2–3 most dangerous weaknesses in this trade. Focus on what could cause a loss, not on what merely isn't optimal.

3. **Round 2**: You receive the Bull's Round 1 argument. You MUST directly challenge their specific claims. If they cite a number, show why that number is less favorable than they present it. Concede points that are genuinely strong, then explain why the remaining risks still dominate.

4. **No fabrication.** If the evidence actually supports the trade, say so and focus on the legitimate weak spots. A short honest critique beats a long reach.

5. **Focus on asymmetry.** Credit spreads have capped upside and potentially large downside. Your job is to assess whether the downside scenarios are adequately compensated by the premium.

## Output

Return ONLY a JSON object — no markdown, no commentary:

{
  "thesis": "<1-2 sentence core argument against the trade>",
  "evidence": ["<specific risk/weakness 1>", "<specific risk/weakness 2>", ...],
  "round": <1 | 2>
}`;

function buildUserPrompt(input: ResearcherInput): string {
  const { input: trade, evidence, opposing, round } = input;
  const expiry = trade.legs[0]?.expiry ?? 'unknown';
  const dte = Math.max(0, Math.round((new Date(expiry).getTime() - Date.now()) / 86400000));

  let prompt = `Argue AGAINST this trade proceeding (Round ${round}):

## Trade
Ticker: ${trade.ticker} | Structure: ${trade.structure} | DTE: ${dte}
${trade.netCredit != null ? `Net credit: $${trade.netCredit}` : ''}${trade.bpRequired != null ? ` | BP: $${trade.bpRequired}` : ''}

## Analyst evidence
Technical: trend=${evidence.technical.trend}, RSI=${evidence.technical.rsi}, breakoutRisk=${evidence.technical.breakoutRisk}. "${evidence.technical.summary}"
Gamma: wallIntegrity=${evidence.gamma.wallIntegrity}, flipDistance=${evidence.gamma.flipDistance}, insideBand=${evidence.gamma.insideBand}. "${evidence.gamma.summary}"
IV: ivRank=${evidence.iv.ivRank}, termStructure=${evidence.iv.termStructure}, premiumFairness=${evidence.iv.premiumFairness}. "${evidence.iv.summary}"
Sentiment: polarity=${evidence.sentiment.polarity}, catalysts=[${evidence.sentiment.catalystsInWindow.join(', ')}]. "${evidence.sentiment.summary}"`;

  if (round === 2 && opposing) {
    prompt += `

## Bull's Round 1 argument (you must challenge this)
Thesis: "${opposing.thesis}"
Evidence: ${opposing.evidence.map(e => `- ${e}`).join('\n')}`;
  }

  return prompt;
}

export class BearResearcher extends BaseAgent<ResearcherInput, ResearcherArgument> {
  readonly name = 'bear';
  readonly model = 'gpt-4' as const;
  readonly budgetModel = 'deepseek' as const;

  async run(input: ResearcherInput, ctx: AgentContext): Promise<ResearcherArgument> {
    await this.report(ctx.jobId, 'running');

    if (process.env.USE_MOCK_LLM === 'true') {
      const result: ResearcherArgument = {
        thesis: input.round === 1 ? 'IV rank 22 means premium is objectively thin — the trade collects inadequate compensation for gamma flip risk at 1.5 strikes' : 'Bull concedes gamma wall is only 0.62 "moderate" — but moderate walls fail under momentum, and bullish trend + medium breakout risk means momentum is present',
        evidence: input.round === 1
          ? ['IV rank 22 is bottom quartile — premium thin per IV/RV ratio', 'Gamma flip distance only 1.5 strikes — a 2% move flips dealer hedging against the position', 'Spot outside gamma band (insideBand=false) — no containment from dealer flows']
          : ['Wall integrity 0.62 historically fails 40% of the time under directional pressure', 'Bullish trend + medium breakout risk = momentum conditions that break moderate walls', 'Net credit $1.05 on $5-wide = 21% of width — below the 25% threshold for adequate compensation'],
        round: input.round,
      };
      await this.report(ctx.jobId, 'complete', result);
      return result;
    }

    const raw = await this.llm.call(this.getModel(ctx), {
      system: SYSTEM,
      user: buildUserPrompt(input),
    });
    const result = this.extractJSON(raw, ResearcherArgumentSchema);
    await this.report(ctx.jobId, 'complete', result);
    return result;
  }
}
