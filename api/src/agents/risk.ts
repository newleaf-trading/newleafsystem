import { BaseAgent } from './base.js';
import { RiskReportSchema } from '../types.js';
import type { TradeIdea, TechnicalReport, GammaReport, IVReport, SentimentReport, ResearcherArgument, RiskReport, AgentContext } from '../types.js';

export interface RiskInput {
  input: TradeIdea;
  evidence: { technical: TechnicalReport; gamma: GammaReport; iv: IVReport; sentiment: SentimentReport };
  debate: { rounds: { bull: ResearcherArgument; bear: ResearcherArgument }[] };
}

const SYSTEM = `You are the Risk Manager on the NewLeaf Verification Desk — a multi-agent options trade verification panel.

Your job: evaluate whether this trade fits the portfolio and assess its Greeks impact. You are the guardrail — not an opinion on whether the trade is good, but whether it's SAFE to add given current exposure.

## Analytical framework

1. **Portfolio fit** — one of three verdicts:
   - "cleared": trade fits within all risk limits. Proceed at proposed size.
   - "reduce_size": trade is acceptable but current exposure to this underlying or sector is elevated. Reduce position size by 30-50%.
   - "blocked": trade would breach a hard risk limit. Do not proceed.

   Hard limits:
   - Single-name concentration: max 20% of portfolio buying power in one ticker.
   - Sector concentration: max 35% in one GICS sector.
   - Correlated positions: if >2 existing positions share >0.7 correlation with this trade, flag.
   - Max simultaneous short premium positions: 8.

2. **Rationale** — ≤40 words explaining the portfolio fit decision. Reference the specific limit that's binding.

3. **Theta impact** — estimated daily theta (in dollars) this trade adds to the portfolio. Positive = collecting theta.

4. **Vega impact** — estimated vega exposure (in dollars per 1-point IV change) this trade adds. Negative vega = short vol (typical for credit spreads).

## Output

Return ONLY a JSON object — no markdown, no commentary:

{
  "portfolioFit": "cleared" | "reduce_size" | "blocked",
  "rationale": "<≤40 words explaining the decision>",
  "thetaImpact": <number, daily theta in dollars>,
  "vegaImpact": <number, vega in dollars per 1pt IV change>
}

## Example

Input: AAPL iron condor, $1.05 credit, $395 BP, portfolio has 12% AAPL exposure
Output:
{
  "portfolioFit": "cleared",
  "rationale": "AAPL exposure rises to 15% with this trade — under 20% single-name ceiling. Tech sector at 28% — under 35% cap. 5 active short premium positions.",
  "thetaImpact": 18,
  "vegaImpact": -25
}`;

function buildUserPrompt(input: RiskInput): string {
  const { input: trade, evidence, debate } = input;
  const expiry = trade.legs[0]?.expiry ?? 'unknown';
  const dte = Math.max(0, Math.round((new Date(expiry).getTime() - Date.now()) / 86400000));

  const debateLines = debate.rounds.map((r, i) =>
    `Round ${i + 1}:\n  Bull: "${r.bull.thesis}"\n  Bear: "${r.bear.thesis}"`
  ).join('\n');

  return `Evaluate portfolio risk for this proposed trade:

## Trade
Ticker: ${trade.ticker} | Structure: ${trade.structure} | DTE: ${dte}
${trade.netCredit != null ? `Net credit: $${trade.netCredit}` : ''}${trade.bpRequired != null ? ` | BP required: $${trade.bpRequired}` : ''}
Legs: ${trade.legs.map(l => `${l.side} ${l.strike} ${l.type}`).join(', ')}

## Analyst evidence
Technical: trend=${evidence.technical.trend}, breakoutRisk=${evidence.technical.breakoutRisk}
Gamma: wallIntegrity=${evidence.gamma.wallIntegrity}, flipDistance=${evidence.gamma.flipDistance}
IV: ivRank=${evidence.iv.ivRank}, premiumFairness=${evidence.iv.premiumFairness}
Sentiment: polarity=${evidence.sentiment.polarity}, catalysts=${evidence.sentiment.catalystsInWindow.length}

## Debate summary
${debateLines}

Assess portfolio fit, theta impact, and vega impact. Apply the hard limits for single-name concentration, sector concentration, and position count.`;
}

export class RiskManager extends BaseAgent<RiskInput, RiskReport> {
  readonly name = 'risk';
  readonly model = 'claude-sonnet' as const;
  readonly budgetModel = 'deepseek' as const;

  async run(input: RiskInput, ctx: AgentContext): Promise<RiskReport> {
    await this.report(ctx.jobId, 'running');
    const raw = await this.llm.call(this.getModel(ctx), {
      system: SYSTEM,
      user: buildUserPrompt(input),
    });
    const result: RiskReport = process.env.USE_MOCK_LLM === 'true'
      ? { portfolioFit: 'reduce_size', rationale: 'Single-name AAPL exposure 18% — under 20% ceiling but tight.', thetaImpact: 24, vegaImpact: -32 }
      : this.parseReport(raw);
    await this.report(ctx.jobId, 'complete', result);
    return result;
  }

  private parseReport(raw: string): RiskReport {
    return this.extractJSON(raw, RiskReportSchema);
  }
}
