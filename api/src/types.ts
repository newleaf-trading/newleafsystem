import { z } from 'zod';

export const TradeIdeaSchema = z.object({
  ticker: z.string(),
  structure: z.enum(['iron_condor', 'iron_butterfly', 'broken_wing_butterfly', 'calendar', 'calendar_spread', 'diagonal', 'vertical_spread', 'bull_put_spread', 'bear_call_spread', 'short_strangle']),
  legs: z.array(z.object({
    type: z.enum(['call', 'put']),
    side: z.enum(['long', 'short']),
    strike: z.number(),
    expiry: z.string(),
  })),
  netCredit: z.number().optional(),
  bpRequired: z.number().optional(),
  source: z.enum(['picks', 'investor_draft']),
  // Optional snapshot of the user's active Invest positions, passed by the
  // client so the Risk Manager can assess real concentration instead of
  // guessing. Compact by design — capital-at-risk is the exposure proxy.
  portfolio: z.array(z.object({
    symbol: z.string(),
    strategyType: z.string().optional(),
    quantity: z.number().optional(),
    capitalAtRisk: z.number().optional(),
    shortPremium: z.boolean().optional(),
  })).optional(),
});
export type TradeIdea = z.infer<typeof TradeIdeaSchema>;

export type AgentStatus = 'pending' | 'running' | 'complete' | 'failed';

export const TechnicalReportSchema = z.object({
  trend: z.enum(['bullish', 'bearish', 'neutral']),
  rsi: z.number(),
  breakoutRisk: z.enum(['low', 'medium', 'high']),
  summary: z.string(),
});
export type TechnicalReport = z.infer<typeof TechnicalReportSchema>;

export const GammaReportSchema = z.object({
  wallIntegrity: z.number(),
  flipDistance: z.number(),
  insideBand: z.boolean(),
  summary: z.string(),
});
export type GammaReport = z.infer<typeof GammaReportSchema>;

export const IVReportSchema = z.object({
  ivRank: z.number().nullable(),
  termStructure: z.enum(['normal', 'flat', 'backwardated', 'indeterminate']),
  premiumFairness: z.enum(['rich', 'fair', 'thin']),
  summary: z.string(),
});
export type IVReport = z.infer<typeof IVReportSchema>;

export const SentimentReportSchema = z.object({
  polarity: z.number(),
  catalystsInWindow: z.array(z.string()),
  summary: z.string(),
});
export type SentimentReport = z.infer<typeof SentimentReportSchema>;

export const ResearcherArgumentSchema = z.object({
  thesis: z.string(),
  evidence: z.array(z.string()),
  round: z.union([z.literal(1), z.literal(2)]),
});
export type ResearcherArgument = z.infer<typeof ResearcherArgumentSchema>;

export const RiskReportSchema = z.object({
  portfolioFit: z.enum(['cleared', 'reduce_size', 'blocked']),
  rationale: z.string(),
  thetaImpact: z.number(),
  vegaImpact: z.number(),
});
export type RiskReport = z.infer<typeof RiskReportSchema>;

export const SuggestedFixSchema = z.object({
  action: z.enum(['adjust', 'wait', 'switch']),
  strategy: z.string(),
  legs: z.array(z.object({
    type: z.enum(['call', 'put']),
    side: z.enum(['long', 'short']),
    strike: z.number(),
  })).optional(),
  rationale: z.string(),
  waitCondition: z.string().optional(),
});
export type SuggestedFix = z.infer<typeof SuggestedFixSchema>;

export const VerdictSchema = z.object({
  call: z.enum(['pass', 'marginal', 'fail']),
  confidence: z.number(),
  rationale: z.string(),
  flipConditions: z.array(z.string()),
});
export interface Verdict {
  call: 'pass' | 'marginal' | 'fail';
  confidence: number;
  rationale: string;
  flipConditions: string[];
}

export interface VerificationJob {
  jobId: string;
  status: 'queued' | 'running' | 'complete' | 'failed';
  input: TradeIdea;
  evidence?: { technical: TechnicalReport; gamma: GammaReport; iv: IVReport; sentiment: SentimentReport };
  debate?: { rounds: { bull: ResearcherArgument; bear: ResearcherArgument }[] };
  riskReport?: RiskReport;
  verdict?: Verdict;
  error?: string;
  createdAt: number;
  completedAt?: number;
  agents?: Record<string, { status: AgentStatus; payload?: unknown }>;
}

export type ModelMode = 'premium' | 'budget-v3' | 'budget-r1' | 'budget-qwq';
export interface AgentContext { jobId: string; marketData?: import('./tools/market-data.js').MarketData; modelMode?: ModelMode; }
