import { BaseAgent } from './base.js';
import { VerdictSchema } from '../types.js';
import type { TradeIdea, TechnicalReport, GammaReport, IVReport, SentimentReport, ResearcherArgument, RiskReport, Verdict, AgentContext } from '../types.js';

export interface JudgeInput {
  input: TradeIdea;
  evidence: { technical: TechnicalReport; gamma: GammaReport; iv: IVReport; sentiment: SentimentReport };
  debate: { rounds: { bull: ResearcherArgument; bear: ResearcherArgument }[] };
  riskReport: RiskReport;
}

const SYSTEM = `You are the Judge on the NewLeaf Verification Desk — a multi-agent options trade verification panel.

Your job: weigh ALL evidence — analyst reports, the bull/bear debate (2 rounds), and the risk assessment — then render a final verdict. You are the neutral arbiter. You have no bias toward approving or rejecting trades.

## Decision framework

### Verdict call
- **"pass"**: the trade has sound structure, adequate premium, favorable technicals, manageable risk, and the bull case is materially stronger than the bear case. Proceed as proposed.
- **"marginal"**: the trade has merit but significant concerns remain. It COULD work with modifications. Always provide flipConditions that would upgrade this to a pass.
- **"fail"**: the trade has fatal flaws — one or more hard blockers (risk blocked, IV rank critically low, breakout risk high with thin premium, catalyst in window). Do not proceed.

### Weighting
When evidence conflicts, weight in this order:
1. Risk manager (hard limits are non-negotiable — if blocked, verdict is fail)
2. IV/premium adequacy (if premium is thin AND another factor is negative, that's a fail)
3. Gamma/flow (dealer positioning can override technicals in the short term)
4. Technical (trend regime)
5. Sentiment (tiebreaker only — sentiment is noisy)

The debate informs your reasoning but doesn't have mechanical weight. A compelling Bear argument with evidence should shift you, but the debate is persuasion, not data.

### Confidence (0–100)
- 80–100: strong conviction, evidence clearly aligned.
- 60–79: moderate conviction, most evidence aligns but some concerns.
- 40–59: low conviction, evidence is mixed or conflicting. Marginal territory.
- 0–39: very low conviction, evidence mostly against. Fail territory.

### Flip conditions
For "marginal" and "fail" verdicts, specify concrete, actionable conditions that would change the verdict:
- "Move short call up to 260" (specific strike adjustment)
- "Wait for IV rank above 35" (specific threshold)
- "Reduce size by 50%" (specific sizing change)
- "Wait for earnings to pass" (specific event)
Do NOT give vague conditions like "improve risk/reward" — be specific.

## Output

Return ONLY a JSON object — no markdown, no commentary:

{
  "call": "pass" | "marginal" | "fail",
  "confidence": <number 0-100>,
  "rationale": "<≤50 words: which inputs drove the decision and why>",
  "flipConditions": ["<specific condition>", ...]
}

For "pass" verdicts, flipConditions should list conditions that would DOWNGRADE to marginal/fail (e.g., "Fails if IV rank drops below 15 before entry").

## Example

Input: mixed evidence — bullish technicals, thin IV, moderate gamma risk, risk reduce_size
Output:
{
  "call": "marginal",
  "confidence": 48,
  "rationale": "Technicals support the structure but IV rank 22 means thin premium. Bear's gamma flip concern at 1.5 strikes is legitimate. Risk manager flags tight concentration.",
  "flipConditions": ["Wait for IV rank above 35", "Move short call up to 260 for wider buffer", "Close existing AAPL position first to clear concentration"]
}`;

function buildUserPrompt(input: JudgeInput): string {
  const { input: trade, evidence, debate, riskReport } = input;
  const expiry = trade.legs[0]?.expiry ?? 'unknown';
  const dte = Math.max(0, Math.round((new Date(expiry).getTime() - Date.now()) / 86400000));

  const debateTranscript = debate.rounds.map((r, i) =>
    `### Round ${i + 1}
Bull thesis: "${r.bull.thesis}"
Bull evidence: ${r.bull.evidence.map(e => `\n  - ${e}`).join('')}
Bear thesis: "${r.bear.thesis}"
Bear evidence: ${r.bear.evidence.map(e => `\n  - ${e}`).join('')}`
  ).join('\n\n');

  return `Render a verdict on this proposed trade:

## Trade
Ticker: ${trade.ticker} | Structure: ${trade.structure} | DTE: ${dte}
${trade.netCredit != null ? `Net credit: $${trade.netCredit}` : ''}${trade.bpRequired != null ? ` | BP: $${trade.bpRequired}` : ''}
Legs: ${trade.legs.map(l => `${l.side} ${l.strike} ${l.type}`).join(', ')}

## Analyst reports
Technical: trend=${evidence.technical.trend}, RSI=${evidence.technical.rsi}, breakoutRisk=${evidence.technical.breakoutRisk}
  "${evidence.technical.summary}"
Gamma: wallIntegrity=${evidence.gamma.wallIntegrity}, flipDistance=${evidence.gamma.flipDistance}, insideBand=${evidence.gamma.insideBand}
  "${evidence.gamma.summary}"
IV: ivRank=${evidence.iv.ivRank}, termStructure=${evidence.iv.termStructure}, premiumFairness=${evidence.iv.premiumFairness}
  "${evidence.iv.summary}"
Sentiment: polarity=${evidence.sentiment.polarity}, catalysts=[${evidence.sentiment.catalystsInWindow.join(', ')}]
  "${evidence.sentiment.summary}"

## Debate transcript
${debateTranscript}

## Risk assessment
portfolioFit=${riskReport.portfolioFit}, thetaImpact=${riskReport.thetaImpact}, vegaImpact=${riskReport.vegaImpact}
"${riskReport.rationale}"

Weigh all evidence and render your verdict. Apply the weighting hierarchy: risk limits > IV adequacy > gamma > technicals > sentiment.`;
}

export class Judge extends BaseAgent<JudgeInput, Verdict> {
  readonly name = 'judge';
  readonly model = 'claude-sonnet' as const;
  readonly budgetModel = 'deepseek' as const;

  async run(input: JudgeInput, ctx: AgentContext): Promise<Verdict> {
    await this.report(ctx.jobId, 'running');
    const raw = await this.llm.call(this.getModelCritical(ctx), {
      system: SYSTEM,
      user: buildUserPrompt(input),
    });
    const result: Verdict = process.env.USE_MOCK_LLM === 'true'
      ? { call: 'marginal', confidence: 51, rationale: 'Bear case stronger; gamma flip and IV thin combine.', flipConditions: ['Move short call up to 260', 'Wait for IV rank past 35', 'Close existing AAPL first'] }
      : this.parseReport(raw);
    await this.report(ctx.jobId, 'complete', result);
    return result;
  }

  private parseReport(raw: string): Verdict {
    return this.extractJSON(raw, VerdictSchema);
  }
}
