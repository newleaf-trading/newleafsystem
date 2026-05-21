import { BaseAgent } from '../base.js';
import { ResearcherArgumentSchema } from '../../types.js';
import type { ResearcherArgument, AgentContext, TradeIdea, TechnicalReport, GammaReport, IVReport, SentimentReport } from '../../types.js';

export interface ResearcherInput {
  input: TradeIdea;
  evidence: { technical: TechnicalReport; gamma: GammaReport; iv: IVReport; sentiment: SentimentReport };
  opposing?: ResearcherArgument;
  round: 1 | 2;
}

const SYSTEM = `You are the Bull Researcher on the NewLeaf Verification Desk — a multi-agent options trade verification panel.

Your job: argue FOR the trade proceeding. You are an advocate, not a neutral analyst. Build the strongest honest case that this trade will achieve its target outcome (premium capture for credit structures, directional profit for debit structures).

## Rules

1. **Every claim must cite analyst evidence.** You receive reports from four analysts (Technical, Gamma, IV, Sentiment). Reference specific numbers: "RSI at 58 confirms neutral drift" not "RSI is fine."

2. **Round 1**: Build your opening case using the analyst evidence. Identify the 2–3 strongest reasons this trade works.

3. **Round 2**: You receive the Bear's Round 1 argument. You MUST directly address their specific objections — don't just repeat your Round 1 case. Concede points that are genuinely strong, then explain why the trade still works despite them.

4. **No fabrication.** If the evidence doesn't support a point, don't make it. A concise honest argument beats a long dishonest one.

5. **Quantify when possible.** "Net credit of $1.05 on $395 BP = 26.6% annualised at 21 DTE" is stronger than "good return."

## Output

Return ONLY a JSON object — no markdown, no commentary:

{
  "thesis": "<1-2 sentence core argument>",
  "evidence": ["<specific evidence point 1>", "<specific evidence point 2>", ...],
  "round": <1 | 2>
}`;

function buildUserPrompt(input: ResearcherInput): string {
  const { input: trade, evidence, opposing, round } = input;
  const expiry = trade.legs[0]?.expiry ?? 'unknown';
  const dte = Math.max(0, Math.round((new Date(expiry).getTime() - Date.now()) / 86400000));

  let prompt = `Argue FOR this trade proceeding (Round ${round}):

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

## Bear's Round 1 argument (you must address this)
Thesis: "${opposing.thesis}"
Evidence: ${opposing.evidence.map(e => `- ${e}`).join('\n')}`;
  }

  return prompt;
}

export class BullResearcher extends BaseAgent<ResearcherInput, ResearcherArgument> {
  readonly name = 'bull';
  readonly model = 'gpt-4' as const;
  readonly budgetModel = 'deepseek' as const;

  async run(input: ResearcherInput, ctx: AgentContext): Promise<ResearcherArgument> {
    await this.report(ctx.jobId, 'running');

    if (process.env.USE_MOCK_LLM === 'true') {
      const result: ResearcherArgument = {
        thesis: input.round === 1 ? 'Theta will work fast at 21 DTE with neutral RSI and no catalysts in window' : 'Bear overstates gamma risk — wall integrity at 0.62 is moderate, not weak, and flip distance of 1.5 gives adequate buffer',
        evidence: input.round === 1
          ? ['RSI 62 in neutral zone — no overbought/oversold risk for mean reversion', 'No catalysts in expiry window — clean decay path', 'Short DTE accelerates premium decay — theta dominant over vega']
          : ['Gamma wall at 0.62 has held through two prior pullbacks at this level', 'IV thin is offset by low catalyst risk — realised vol likely stays below implied', 'Net credit of $1.05 on $395 BP = 26.6% annualised — compensates for moderate gamma risk'],
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
