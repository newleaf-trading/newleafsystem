import { BaseAgent } from '../base.js';
import { SentimentReportSchema } from '../../types.js';
import type { TradeIdea, SentimentReport, AgentContext } from '../../types.js';
import type { MarketData } from '../../tools/market-data.js';
import { searchForSentiment } from '../../tools/serper.js';

const SYSTEM = `You are the Sentiment/Catalyst Analyst on the NewLeaf Verification Desk — a multi-agent options trade verification panel.

Your job: analyze REAL search results (news articles, Reddit posts, social media) to assess sentiment and identify binary-event catalysts within the trade's expiration window.

## Analytical framework

1. **Polarity** (-1.0 to 1.0)
   - Aggregate sentiment from the provided search results.
   - +1.0: extremely bullish consensus across news and social.
   - 0.0: neutral / balanced / no strong signal.
   - -1.0: extremely bearish consensus.
   - Extreme polarity in EITHER direction is risky for credit spreads — crowded positioning snaps back.

2. **Catalysts in window** (string array)
   - From the search results, identify every binary event between now and expiry:
     - Earnings report date
     - Ex-dividend date
     - FDA approval / PDUFA date
     - Major product launch / announcement
     - Antitrust / regulatory ruling
     - Index rebalance
   - An EMPTY array is favorable for premium sellers.
   - Format: "Earnings 2026-05-20" or "Ex-div 2026-05-12"

3. **Social volume** — Note if the search results show unusual attention (many recent articles/posts).

## Important
- Base your analysis ONLY on the provided search results, not on training knowledge.
- If no relevant results are found, report polarity 0 and empty catalysts.

## Output

Return ONLY a JSON object:

{
  "polarity": <number -1.0 to 1.0>,
  "catalystsInWindow": [<string>, ...],
  "summary": "<≤30 words: sentiment read and catalyst risk based on actual search results>"
}`;

function buildUserPrompt(input: TradeIdea, searchResults: string, md?: MarketData): string {
  const expiry = input.legs[0]?.expiry ?? 'unknown';
  const dte = Math.max(0, Math.round((new Date(expiry).getTime() - Date.now()) / 86400000));

  let prompt = `Analyze sentiment and catalysts for this proposed trade:

Ticker: ${input.ticker}
Structure: ${input.structure}
DTE: ${dte} days (expiry: ${expiry})
Trade window: now through ${expiry}`;

  if (md) {
    prompt += `
Spot: $${md.snapshot.price} (${md.snapshot.change >= 0 ? '+' : ''}${md.snapshot.changePct}% today)`;
  }

  prompt += `

## REAL-TIME SEARCH RESULTS (from Google/Serper)

${searchResults}

Based on these search results, assess sentiment polarity and identify any catalysts within the ${dte}-day trade window for ${input.ticker}.`;

  return prompt;
}

function formatSearchResults(results: Awaited<ReturnType<typeof searchForSentiment>>): string {
  let text = '### NEWS\n';
  if (results.news.length === 0) {
    text += 'No recent news found.\n';
  } else {
    results.news.forEach((r, i) => {
      text += `${i + 1}. ${r.title}${r.date ? ` (${r.date})` : ''}\n   ${r.snippet}\n\n`;
    });
  }

  text += '### REDDIT / SOCIAL\n';
  if (results.web.length === 0) {
    text += 'No relevant Reddit/social posts found.\n';
  } else {
    results.web.forEach((r, i) => {
      text += `${i + 1}. ${r.title}\n   ${r.snippet}\n\n`;
    });
  }

  return text;
}

export class SentimentAnalyst extends BaseAgent<TradeIdea, SentimentReport> {
  readonly name = 'sentiment';
  readonly model = 'deepseek' as const;
  readonly budgetModel = 'deepseek' as const;

  async run(input: TradeIdea, ctx: AgentContext): Promise<SentimentReport> {
    await this.report(ctx.jobId, 'running');

    if (process.env.USE_MOCK_LLM === 'true') {
      const result: SentimentReport = { polarity: 0.4, catalystsInWindow: [], summary: 'Mocked: Reddit/X tone mildly bullish, no earnings or ex-div in window. No catalyst risk.' };
      await this.report(ctx.jobId, 'complete', result);
      return result;
    }

    // Fetch real search results
    const expiry = input.legs[0]?.expiry ?? '';
    const dte = Math.max(0, Math.round((new Date(expiry).getTime() - Date.now()) / 86400000));
    let searchText = 'No search results available — Serper API key not configured.';

    if (process.env.SERPER_API_KEY) {
      try {
        const results = await searchForSentiment(input.ticker, dte);
        searchText = formatSearchResults(results);
      } catch (err) {
        searchText = `Search failed: ${err instanceof Error ? err.message : String(err)}. Analyze based on general knowledge.`;
      }
    }

    const raw = await this.llm.call(this.getModel(ctx), {
      system: SYSTEM,
      user: buildUserPrompt(input, searchText, ctx.marketData),
    });

    const result = this.extractJSON(raw, SentimentReportSchema);
    await this.report(ctx.jobId, 'complete', result);
    return result;
  }
}
