import { BaseAgent } from '../base.js';
import { IVReportSchema } from '../../types.js';
import type { TradeIdea, IVReport, AgentContext } from '../../types.js';
import type { MarketData } from '../../tools/market-data.js';

const SYSTEM = `You are the IV/Skew Analyst on the NewLeaf Verification Desk — a multi-agent options trade verification panel.

Your job: evaluate implied volatility conditions to determine whether the premium collected is adequate for the risk taken.

## Analytical framework

1. **IV Rank** (0–100)
   - Where current IV sits relative to its 52-week range: (current - 52wLow) / (52wHigh - 52wLow) × 100.
   - >50: elevated IV — favorable for selling premium (credit spreads, iron condors).
   - 30–50: moderate — acceptable but not ideal for premium selling.
   - <30: low IV — premium is thin, poor time to sell. Structures that sell premium have weak risk/reward.

2. **Term structure**
   - "normal": front-month IV < back-month IV (contango). Typical, healthy. Good for calendars and diagonals.
   - "flat": similar IV across expirations. Neutral signal.
   - "backwardated": front-month IV > back-month IV. Usually means a near-term event (earnings, FDA, ex-div) is inflating front vol. Dangerous for short premium if the event is within the trade window.

3. **Premium fairness**
   - "rich": collected premium significantly exceeds what historical realised vol would justify. Favorable for sellers.
   - "fair": premium is roughly in line with realised vol. Neutral.
   - "thin": collected premium is below what realised vol suggests is adequate. Unfavorable — the trade isn't being compensated for the risk.
   - Key metric: compare implied vol to 30-day realised vol. IV/RV ratio >1.2 = rich. 0.9–1.2 = fair. <0.9 = thin.

## Output

Return ONLY a JSON object — no markdown, no commentary:

{
  "ivRank": <number 0-100>,
  "termStructure": "normal" | "flat" | "backwardated",
  "premiumFairness": "rich" | "fair" | "thin",
  "summary": "<≤30 words: IV assessment and what it means for this trade's premium>"
}

## Example

Input: AAPL iron condor, $1.05 net credit, 21 DTE
Output:
{
  "ivRank": 38,
  "termStructure": "normal",
  "premiumFairness": "fair",
  "summary": "IV rank 38 — moderate. Normal term structure. Premium fair but not rich. Acceptable for 5-wide condor."
}`;

function buildUserPrompt(input: TradeIdea, md?: MarketData): string {
  const shortLegs = input.legs.filter(l => l.side === 'short');
  const expiry = input.legs[0]?.expiry ?? 'unknown';
  const dte = Math.max(0, Math.round((new Date(expiry).getTime() - Date.now()) / 86400000));

  let prompt = `Evaluate IV conditions for this proposed trade:

Ticker: ${input.ticker}
Structure: ${input.structure}
DTE: ${dte} days (expiry: ${expiry})
Short strikes: ${shortLegs.map(l => `${l.strike} ${l.type}`).join(', ')}
${input.netCredit != null ? `Net credit: $${input.netCredit}` : ''}`;

  if (md) {
    prompt += `

## LIVE OPTIONS DATA
Spot price: $${md.snapshot.price}

## LEG IV & PRICING
${md.legs.map(l =>
  `${l.side} ${l.strike} ${l.type}: IV=${l.iv != null ? (l.iv * 100).toFixed(1) + '%' : 'n/a'} bid=$${l.bid} ask=$${l.ask} mid=$${l.mid} theta=${l.theta ?? 'n/a'} vega=${l.vega ?? 'n/a'}`
).join('\n')}

## NEARBY STRIKE IV (for skew analysis)
${md.nearbyStrikes.slice(0, 15).map(s => {
  const call = md.legs.find(l => l.type === 'call' && Math.abs(l.strike - s.strike) < 0.01);
  const put = md.legs.find(l => l.type === 'put' && Math.abs(l.strike - s.strike) < 0.01);
  return `Strike ${s.strike}: call_vol=${s.callOI} put_vol=${s.putOI}`;
}).join('\n')}

## HISTORICAL VOLATILITY CONTEXT
ATR(14): $${md.indicators.atr14} | Bollinger width: ${md.indicators.bollingerWidth}%`;
  }

  prompt += `

Assess IV rank, term structure, and whether the premium collected is rich/fair/thin for ${input.ticker}.`;

  return prompt;
}

export class IVAnalyst extends BaseAgent<TradeIdea, IVReport> {
  readonly name = 'iv';
  readonly model = 'claude-haiku' as const;
  readonly budgetModel = 'deepseek' as const;

  async run(input: TradeIdea, ctx: AgentContext): Promise<IVReport> {
    await this.report(ctx.jobId, 'running');
    const raw = await this.llm.call(this.getModel(ctx), {
      system: SYSTEM,
      user: buildUserPrompt(input, ctx.marketData),
    });
    const result: IVReport = process.env.USE_MOCK_LLM === 'true'
      ? { ivRank: 22, termStructure: 'normal', premiumFairness: 'thin', summary: 'Mocked: IV rank 22 — below median. Term structure normal. Premium thin for this width.' }
      : this.parseReport(raw);
    await this.report(ctx.jobId, 'complete', result);
    return result;
  }

  private parseReport(raw: string): IVReport {
    return this.extractJSON(raw, IVReportSchema);
  }
}
