import type { TradeIdea, Verdict, TechnicalReport, GammaReport, IVReport, SentimentReport, ResearcherArgument, RiskReport, SuggestedFix } from './types.js';
import type { TechnicalAnalyst } from './agents/analysts/technical.js';
import type { GammaAnalyst } from './agents/analysts/gamma.js';
import type { IVAnalyst } from './agents/analysts/iv.js';
import type { SentimentAnalyst } from './agents/analysts/sentiment.js';
import type { BullResearcher } from './agents/researchers/bull.js';
import type { BearResearcher } from './agents/researchers/bear.js';
import type { RiskManager } from './agents/risk.js';
import type { Judge } from './agents/judge.js';
import type { TradeFixer } from './agents/fixer.js';
import type { JobStore } from './state/store.js';
import type { LLMRouter, TokenUsage, LLMTrace } from './llm/router.js';
import { fetchMarketData } from './tools/market-data.js';
import type { MarketData } from './tools/market-data.js';

export interface VerificationResult {
  jobId: string;
  verdict: Verdict;
  evidence: { technical: TechnicalReport; gamma: GammaReport; iv: IVReport; sentiment: SentimentReport };
  debate: { rounds: { bull: ResearcherArgument; bear: ResearcherArgument }[] };
  riskReport: RiskReport;
  suggestedFix?: SuggestedFix;
  marketData?: MarketData;
  cost?: { calls: TokenUsage[]; totalCost: number; totalInputTokens: number; totalOutputTokens: number };
  traces?: LLMTrace[];
  durationMs: number;
}

export class VerificationOrchestrator {
  constructor(
    private analysts: { technical: TechnicalAnalyst; gamma: GammaAnalyst; iv: IVAnalyst; sentiment: SentimentAnalyst },
    private bull: BullResearcher,
    private bear: BearResearcher,
    private risk: RiskManager,
    private judge: Judge,
    private fixer: TradeFixer,
    private llm: LLMRouter,
    private store: JobStore,
  ) {}

  async verify(input: TradeIdea, modelMode: import('./types.js').ModelMode = 'premium'): Promise<VerificationResult> {
    const start = Date.now();
    this.llm.resetUsage();
    const jobId = await this.store.createJob(input);

    // Fetch real market data before running agents
    let md: MarketData | undefined;
    if (process.env.ALPACA_API_KEY) {
      try {
        md = await fetchMarketData(input);
      } catch (err) {
        console.warn('Market data fetch failed, agents will reason without live data:', err);
      }
    }

    const ctx = { jobId, marketData: md, modelMode };

    try {
      const [technical, gamma, iv, sentiment] = await Promise.all([
        this.analysts.technical.run(input, ctx),
        this.analysts.gamma.run(input, ctx),
        this.analysts.iv.run(input, ctx),
        this.analysts.sentiment.run(input, ctx),
      ]);
      const evidence = { technical, gamma, iv, sentiment };

      const r1Bull = await this.bull.run({ input, evidence, round: 1 }, ctx);
      const r1Bear = await this.bear.run({ input, evidence, opposing: r1Bull, round: 1 }, ctx);
      const r2Bull = await this.bull.run({ input, evidence, opposing: r1Bear, round: 2 }, ctx);
      const r2Bear = await this.bear.run({ input, evidence, opposing: r2Bull, round: 2 }, ctx);
      const debate = { rounds: [{ bull: r1Bull, bear: r1Bear }, { bull: r2Bull, bear: r2Bear }] };

      const riskReport = await this.risk.run({ input, evidence, debate }, ctx);
      const verdict = await this.judge.run({ input, evidence, debate, riskReport }, ctx);

      // If fail or marginal, suggest a fix
      let suggestedFix: SuggestedFix | undefined;
      if (verdict.call !== 'pass') {
        try {
          suggestedFix = await this.fixer.fix({ input, verdict, evidence, riskReport, marketData: md, modelMode });
        } catch (err) {
          console.warn('Fixer failed:', err);
        }
      }

      await this.store.finalizeJob(jobId, verdict);
      return { jobId, verdict, evidence, debate, riskReport, suggestedFix, marketData: md, cost: this.llm.getUsage(), traces: this.llm.getTraces(), durationMs: Date.now() - start };
    } catch (err) {
      await this.store.failJob(jobId, err);
      throw err;
    }
  }
}
