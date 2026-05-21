import { BaseAgent } from '../base.js';
import { TechnicalReportSchema } from '../../types.js';
import type { TradeIdea, TechnicalReport, AgentContext } from '../../types.js';
import type { MarketData } from '../../tools/market-data.js';

const SYSTEM = `You are the Technical Analyst on the NewLeaf Verification Desk — a multi-agent options trade verification panel.

Your job: assess the trend regime and technical setup for a proposed options structure. You determine whether current price action supports or threatens the trade's thesis.

## Analytical framework

Evaluate these dimensions and synthesise into a single assessment:

1. **Trend regime** — Is the underlying in a bullish, bearish, or neutral (range-bound) regime?
   - Use 20/50/100/200-day SMA alignment. All rising + price above all = bullish. Mixed = neutral. All falling + price below = bearish.
   - Check for recent SMA crossovers (golden cross / death cross within last 10 sessions).

2. **RSI (14-period)** — Report the current value.
   - >70: overbought — risk of mean reversion into short call.
   - <30: oversold — risk of mean reversion into short put.
   - 40–60: neutral zone, range-friendly for credit structures.

3. **Breakout risk** — How likely is a large directional move that breaches a short strike?
   - LOW: Bollinger Bands contracting, ADX < 20, price mid-range between support/resistance, no SMA crossover.
   - MEDIUM: Some expansion signals — ADX 20–30, price near one Bollinger band, approaching key S/R level.
   - HIGH: Bands expanding, ADX > 30, price pressing against or through major S/R, recent gap or momentum candle.

4. **Short-strike proximity** — How close is the current price to the proposed short strikes? Note if price is within 2% of either short strike.

## Output

Return ONLY a JSON object — no markdown, no commentary:

{
  "trend": "bullish" | "bearish" | "neutral",
  "rsi": <number 0-100>,
  "breakoutRisk": "low" | "medium" | "high",
  "summary": "<≤30 words: key technical finding and what it means for this trade>"
}

## Example

Input: AAPL iron condor, short 225P/255C, 21 DTE
Output:
{
  "trend": "bullish",
  "rsi": 58,
  "breakoutRisk": "medium",
  "summary": "Mild bullish drift, RSI neutral at 58. Price 3% from short call — watch 250 resistance. Bands flat."
}`;

function buildUserPrompt(input: TradeIdea, md?: MarketData): string {
  const shortLegs = input.legs.filter(l => l.side === 'short');
  const longLegs = input.legs.filter(l => l.side === 'long');
  const expiry = input.legs[0]?.expiry ?? 'unknown';
  const dte = Math.max(0, Math.round((new Date(expiry).getTime() - Date.now()) / 86400000));

  let prompt = `Assess the technical setup for this proposed trade:

Ticker: ${input.ticker}
Structure: ${input.structure}
DTE: ${dte} days (expiry: ${expiry})
Short strikes: ${shortLegs.map(l => `${l.strike} ${l.type}`).join(', ')}
Long strikes: ${longLegs.map(l => `${l.strike} ${l.type}`).join(', ')}
${input.netCredit != null ? `Net credit: $${input.netCredit}` : ''}
${input.bpRequired != null ? `Buying power: $${input.bpRequired}` : ''}`;

  if (md) {
    const ind = md.indicators;
    const snap = md.snapshot;
    prompt += `

## LIVE MARKET DATA (as of ${md.fetchedAt})
Price: $${snap.price} (${snap.change >= 0 ? '+' : ''}${snap.change}, ${snap.changePct}%)
Day range: $${snap.low} - $${snap.high} | Volume: ${snap.volume.toLocaleString()}

## COMPUTED INDICATORS
RSI(14): ${ind.rsi14}
SMA 20: $${ind.sma20} | SMA 50: $${ind.sma50} | SMA 100: $${ind.sma100} | SMA 200: $${ind.sma200}
Price vs SMAs: ${ind.priceVsSma} | SMA trend: ${ind.smaTrend}
Bollinger Bands: $${ind.bollingerLower} - $${ind.bollingerUpper} (width: ${ind.bollingerWidth}%)
ADX(14): ${ind.adx14} | ATR(14): $${ind.atr14}

Short strike proximity:
${shortLegs.map(l => {
  const dist = ((snap.price - l.strike) / snap.price * 100).toFixed(1);
  return `  ${l.strike} ${l.type}: ${dist}% from spot`;
}).join('\n')}`;
  }

  prompt += `

Evaluate the trend regime, RSI, and breakout risk for ${input.ticker}. Focus on whether current technicals support or threaten this ${input.structure}.`;

  return prompt;
}

export class TechnicalAnalyst extends BaseAgent<TradeIdea, TechnicalReport> {
  readonly name = 'technical';
  readonly model = 'claude-sonnet' as const;
  readonly budgetModel = 'deepseek' as const;

  async run(input: TradeIdea, ctx: AgentContext): Promise<TechnicalReport> {
    await this.report(ctx.jobId, 'running');
    const raw = await this.llm.call(this.getModel(ctx), {
      system: SYSTEM,
      user: buildUserPrompt(input, ctx.marketData),
    });
    const result: TechnicalReport = process.env.USE_MOCK_LLM === 'true'
      ? { trend: 'bullish', rsi: 62, breakoutRisk: 'medium', summary: 'Mocked: mild bullish drift, RSI 62, holding above 50/100 SMA.' }
      : this.parseReport(raw);
    await this.report(ctx.jobId, 'complete', result);
    return result;
  }

  private parseReport(raw: string): TechnicalReport {
    return this.extractJSON(raw, TechnicalReportSchema);
  }
}
