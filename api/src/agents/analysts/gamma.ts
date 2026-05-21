import { BaseAgent } from '../base.js';
import { GammaReportSchema } from '../../types.js';
import type { TradeIdea, GammaReport, AgentContext } from '../../types.js';
import type { MarketData } from '../../tools/market-data.js';

const SYSTEM = `You are the Gamma/Flow Analyst on the NewLeaf Verification Desk — a multi-agent options trade verification panel.

Your job: assess gamma exposure (GEX) and dealer positioning to determine whether market-maker hedging flows support or threaten the proposed trade's short strikes.

## Analytical framework

1. **Gamma wall integrity** (0.0–1.0 scale)
   - A gamma wall is a strike with outsized open interest where dealer hedging creates a "magnet" or "barrier" effect.
   - 1.0 = massive, well-established wall with deep OI concentration — price is strongly repelled.
   - 0.5 = moderate wall — provides some support/resistance but can be overwhelmed by momentum.
   - <0.3 = weak or no wall — no meaningful dealer hedging barrier near the short strikes.
   - Report the integrity of the nearest wall between spot and each short strike.

2. **Flip distance** (in strikes)
   - The gamma flip point is where net dealer gamma changes sign (from long to short gamma or vice versa).
   - When dealers are short gamma, they amplify moves (buy high, sell low). When long gamma, they dampen moves.
   - Report how many strikes away the nearest flip point is from the short strikes.
   - <1 strike: dangerous — small move could flip dealer behavior.
   - 1–3 strikes: moderate.
   - >3 strikes: safe — flip is far from the action.

3. **Inside band** (boolean)
   - true if the current spot price is BETWEEN the two largest gamma walls (contained).
   - false if spot is outside or at the edge of the gamma band.
   - Being inside the band is favorable for credit spreads — price tends to oscillate within.

## Output

Return ONLY a JSON object — no markdown, no commentary:

{
  "wallIntegrity": <number 0.0-1.0>,
  "flipDistance": <number in strikes>,
  "insideBand": <boolean>,
  "summary": "<≤30 words: gamma/flow assessment and implication for this trade>"
}

## Example

Input: AAPL iron condor, short 225P/255C
Output:
{
  "wallIntegrity": 0.72,
  "flipDistance": 2.5,
  "insideBand": true,
  "summary": "Solid gamma wall at 240 (0.72). Flip point 2.5 strikes from short put. Spot contained inside 230-250 band."
}`;

function buildUserPrompt(input: TradeIdea, md?: MarketData): string {
  const shortLegs = input.legs.filter(l => l.side === 'short');
  const expiry = input.legs[0]?.expiry ?? 'unknown';
  const dte = Math.max(0, Math.round((new Date(expiry).getTime() - Date.now()) / 86400000));

  let prompt = `Assess gamma exposure and dealer positioning for this proposed trade:

Ticker: ${input.ticker}
Structure: ${input.structure}
DTE: ${dte} days (expiry: ${expiry})
Short strikes: ${shortLegs.map(l => `${l.strike} ${l.type}`).join(', ')}`;

  if (md) {
    prompt += `

## LIVE MARKET DATA
Spot price: $${md.snapshot.price}`;

    if (md.gammaAnalysis) {
      const ga = md.gammaAnalysis;
      prompt += `

## OPEN INTEREST BY STRIKE (from Nasdaq — real OI data)
${ga.oiByStrike.map(s =>
  `Strike ${s.strike}: call_OI=${s.callOI.toLocaleString()} put_OI=${s.putOI.toLocaleString()} call_vol=${s.callVolume.toLocaleString()} put_vol=${s.putVolume.toLocaleString()}`
).join('\n')}

## GAMMA WALLS (top 5 by total OI)
${ga.walls.map(w =>
  `Strike ${w.strike}: total_OI=${w.totalOI.toLocaleString()} side=${w.side} strength=${w.strength}`
).join('\n')}

## WALL ANALYSIS
Put wall (support): ${ga.putWallStrike ?? 'none detected'}
Call wall (resistance): ${ga.callWallStrike ?? 'none detected'}
Spot inside band: ${ga.spotInsideBand}`;
    }

    prompt += `

## OPTIONS GAMMA BY STRIKE (from Alpaca greeks)
${md.nearbyStrikes.map(s =>
  `Strike ${s.strike}: call_gamma=${s.callGamma ?? 'n/a'} put_gamma=${s.putGamma ?? 'n/a'}`
).join('\n')}

## TRADE LEG GREEKS
${md.legs.map(l =>
  `${l.side} ${l.strike} ${l.type}: delta=${l.delta ?? 'n/a'} gamma=${l.gamma ?? 'n/a'} bid=${l.bid} ask=${l.ask}`
).join('\n')}`;
  }

  prompt += `

Evaluate gamma wall integrity near the short strikes, flip distance, and whether spot is inside the gamma band for ${input.ticker}.`;

  return prompt;
}

export class GammaAnalyst extends BaseAgent<TradeIdea, GammaReport> {
  readonly name = 'gamma';
  readonly model = 'claude-sonnet' as const;
  readonly budgetModel = 'deepseek' as const;

  async run(input: TradeIdea, ctx: AgentContext): Promise<GammaReport> {
    await this.report(ctx.jobId, 'running');
    const raw = await this.llm.call(this.getModel(ctx), {
      system: SYSTEM,
      user: buildUserPrompt(input, ctx.marketData),
    });
    const result: GammaReport = process.env.USE_MOCK_LLM === 'true'
      ? { wallIntegrity: 0.62, flipDistance: 1.5, insideBand: false, summary: 'Mocked: gamma wall at 240 holding, flip point 1.5 strikes away from short put.' }
      : this.parseReport(raw);
    await this.report(ctx.jobId, 'complete', result);
    return result;
  }

  private parseReport(raw: string): GammaReport {
    return this.extractJSON(raw, GammaReportSchema);
  }
}
