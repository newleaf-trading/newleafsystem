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
   - Single-name concentration: max 20% of portfolio capital-at-risk in one ticker.
   - Max simultaneous short premium positions: 8.
   - Sector concentration (max 35% per GICS sector) and correlation (>0.7) are NOT evaluated in this run — sector/correlation data is not provided. Do not invent it.

   IMPORTANT: Base your decision ONLY on the portfolio actually provided below. If no portfolio is connected, evaluate the trade on its standalone risk and say so — never fabricate existing exposure or concentration percentages.

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

## Example (portfolio provided)

Input: trade on NFLX; portfolio shows existing NFLX exposure at 17% of capital-at-risk, 5 active short-premium positions.
Output:
{
  "portfolioFit": "reduce_size",
  "rationale": "This NFLX trade pushes single-name exposure past 20% of portfolio risk. Reduce size to stay under the ceiling. Short-premium count (6) within the 8 cap.",
  "thetaImpact": 18,
  "vegaImpact": -25
}

## Example (no portfolio connected)

Input: trade on NFLX; no portfolio connected.
Output:
{
  "portfolioFit": "cleared",
  "rationale": "No portfolio connected, so no concentration limits apply. Trade's standalone defined risk is acceptable at proposed size.",
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

## Current portfolio
${buildPortfolioBlock(trade)}

## Analyst evidence
Technical: trend=${evidence.technical.trend}, breakoutRisk=${evidence.technical.breakoutRisk}
Gamma: wallIntegrity=${evidence.gamma.wallIntegrity}, flipDistance=${evidence.gamma.flipDistance}
IV: ivRank=${evidence.iv.ivRank}, premiumFairness=${evidence.iv.premiumFairness}
Sentiment: polarity=${evidence.sentiment.polarity}, catalysts=${evidence.sentiment.catalystsInWindow.length}

## Debate summary
${debateLines}

Assess portfolio fit, theta impact, and vega impact using ONLY the portfolio above. Apply the single-name concentration (20%) and short-premium count (8) limits. Do not evaluate sector or correlation.`;
}

// Render the real Invest portfolio (or an explicit "not connected" notice) so
// the Risk Manager reasons on actual exposure instead of fabricating it.
function buildPortfolioBlock(trade: TradeIdea): string {
  const positions = trade.portfolio ?? [];
  if (positions.length === 0) {
    return 'No portfolio connected. Evaluate this trade on its own standalone defined risk. Do NOT assume any existing exposure or invent concentration percentages.';
  }
  const totalCar = positions.reduce((s, p) => s + (p.capitalAtRisk ?? 0), 0) || 1;
  const bySymbol = new Map<string, number>();
  for (const p of positions) {
    bySymbol.set(p.symbol, (bySymbol.get(p.symbol) ?? 0) + (p.capitalAtRisk ?? 0));
  }
  const shortCount = positions.filter(p => p.shortPremium).length;
  const existingThis = bySymbol.get(trade.ticker) ?? 0;
  const pct = (v: number) => `${Math.round((v / totalCar) * 100)}%`;
  const byName = [...bySymbol.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([sym, car]) => `  ${sym}: $${Math.round(car)} (${pct(car)} of portfolio risk)`)
    .join('\n');
  return `Active positions: ${positions.length} | Total capital-at-risk: $${Math.round(totalCar)}
Active short-premium positions: ${shortCount} (hard cap 8).
Existing ${trade.ticker} exposure: $${Math.round(existingThis)} (${pct(existingThis)} of portfolio risk) — single-name cap is 20%.
By name:
${byName}`;
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
    const hasPortfolio = (input.input.portfolio?.length ?? 0) > 0;
    const result: RiskReport = process.env.USE_MOCK_LLM === 'true'
      ? hasPortfolio
        ? { portfolioFit: 'reduce_size', rationale: 'Single-name exposure near the 20% ceiling — trim size to stay clear.', thetaImpact: 24, vegaImpact: -32 }
        : { portfolioFit: 'cleared', rationale: 'No portfolio connected; standalone defined risk acceptable at proposed size.', thetaImpact: 24, vegaImpact: -32 }
      : this.parseReport(raw);
    await this.report(ctx.jobId, 'complete', result);
    return result;
  }

  private parseReport(raw: string): RiskReport {
    return this.extractJSON(raw, RiskReportSchema);
  }
}
