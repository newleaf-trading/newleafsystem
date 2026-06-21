/**
 * ReasoningEngine — 6 parallel deep-analysis tasks using qwen3-max.
 *
 * Produces: thesis, risk, scenarios, exit, regime, sizing
 * All calls fire in parallel via Promise.all for ~3s wall-clock.
 */
import type { LLMRouter, ModelTier } from '../llm/router.js';
import { getModel } from '../llm/model-assignments.js';

// ── Result types ─────────────────────────────────────────────────────────────

export interface ThesisResult {
  primaryDriver: string;
  structuralEdge: string;
  catalyst: string;
  timeHorizonMatch: boolean;
  timeHorizonReasoning: string;
  conviction: number;
  convictionReasoning: string;
  bearCase: string;
  thesis: string;
}

export interface RiskScenario {
  name: string;
  type: string;
  probability: number;
  trigger: string;
  pnlImpact: string;
  mitigation: string;
}

export interface RiskResult {
  scenarios: RiskScenario[];
  maxPainScenario: string;
  overallRiskGrade: string;
  riskRewardVerdict: string;
  killSwitch: string;
}

export interface ScenarioRow {
  spot: number;
  d7: number;
  d14: number;
  d21: number;
}

export interface ScenarioCase {
  description: string;
  probability: number;
  expectedPnl: string;
}

export interface ScenarioResult {
  pnlGrid: ScenarioRow[];
  bestCase: ScenarioCase;
  baseCase: ScenarioCase;
  worstCase: ScenarioCase;
}

export interface ExitResult {
  profitTarget: { percentage: number; reasoning: string; typicalDaysToHit: number };
  stopLoss: { percentage: number; spotTrigger: number | null; reasoning: string };
  timeExit: { daysBeforeExpiry: number; reasoning: string };
  adjustments: { trigger: string; action: string; newRisk: string }[];
  rollingStrategy: { shouldRoll: boolean; trigger: string; targetExpiry: string };
  summary: string;
}

export interface RegimeResult {
  marketRegime: string;
  sectorMomentum: string;
  vixEnvironment: string;
  correlationRisk: string;
  alignmentScore: number;
}

export interface SizingResult {
  allocation: number;
  contracts: Record<string, number>;
  maxLossDollars: Record<string, number>;
  kellyEstimate: string;
  scalingPlan: string;
}

export interface ReasoningMeta {
  totalConviction: number;
  overallGrade: string;
  shouldPublish: boolean;
  totalCostUsd: number;
  wallClockMs: number;
}

export interface ReasoningAnalysis {
  thesis: ThesisResult;
  risk: RiskResult;
  scenarios: ScenarioResult;
  exit: ExitResult;
  regime: RegimeResult;
  sizing: SizingResult;
  meta: ReasoningMeta;
}

// ── Input type ───────────────────────────────────────────────────────────────

export interface ReasoningInput {
  ticker: string;
  spot: number;
  expiry: string;
  dte: number;
  strategy: string;
  direction: string;
  score: number;
  // Technicals
  rsi: number;
  adx: number;
  atr: number;
  trendState: string;
  trendScore: number;
  trendStrength: string;
  bbWidth: number;
  volRegime: string;
  smaSummary: string;
  // Gamma
  putWall: number;
  callWall: number;
  bandWidth: number;
  confidence: number;
  condorAllowed: boolean;
  // IV
  atmIv: number;
  rv30: number;
  ivRvRatio: number;
  ivRank: number;
  // Legs (if available)
  legs?: { action: string; side?: string; type: string; strike: number; mid?: number; iv?: number }[];
  netCredit?: number;
  maxProfit?: number;
  maxLoss?: number;
  netDelta?: number;
  netGamma?: number;
  netTheta?: number;
  netVega?: number;
  // Events
  earningsDays?: number;
  exDivDays?: number;
}

// ── Engine ────────────────────────────────────────────────────────────────────

export class ReasoningEngine {
  constructor(private llm: LLMRouter) {}

  async analyze(data: ReasoningInput): Promise<ReasoningAnalysis> {
    const t0 = Date.now();
    this.llm.resetUsage();

    const model = getModel('reasoning-thesis');

    // All 6 reasoning calls in parallel
    const [thesis, risk, scenarios, exit, regime, sizing] = await Promise.all([
      this.reasonThesis(model, data),
      this.reasonRisk(model, data),
      this.reasonScenarios(model, data),
      this.reasonExit(model, data),
      this.reasonRegime(model, data),
      this.reasonSizing(model, data),
    ]);

    const totalConviction = this.computeConviction(thesis, regime);
    const overallGrade = this.computeGrade(totalConviction, risk);
    const usage = this.llm.getUsage();

    return {
      thesis, risk, scenarios, exit, regime, sizing,
      meta: {
        totalConviction,
        overallGrade,
        // Publish gate: conviction > 6 (B+ or above). Regime already flows
        // through conviction at 30% weight — no separate regime gate (avoids double-dock).
        shouldPublish: totalConviction > 6,
        totalCostUsd: usage.totalCost,
        wallClockMs: Date.now() - t0,
      },
    };
  }

  /**
   * Conviction = 70% thesis + 30% regime alignment (scaled to 10).
   * Regime is NOT penalized again in shouldPublish — it flows through conviction only.
   */
  private computeConviction(thesis: ThesisResult, regime: RegimeResult): number {
    return +(thesis.conviction * 0.7 + regime.alignmentScore * 10 * 0.3).toFixed(1);
  }

  /**
   * Grade mapping:
   *   A  (≥8)  → strong conviction, low risk
   *   A- (≥7)  → good conviction, manageable risk
   *   B+ (≥6)  → moderate conviction — publishable if regime aligned
   *   B  (≥5)  → below publish threshold
   *   C  (≥3)  → weak
   *   D  (<3)  → avoid
   *
   * shouldPublish gate: conviction > 6 (i.e. B+ or above).
   * Regime is already baked into conviction (30% weight), so it is NOT
   * applied as a separate gate — that would penalize it twice.
   */
  private computeGrade(conviction: number, risk: RiskResult): string {
    const riskPenalty = risk.overallRiskGrade === 'EXTREME' ? 2
      : risk.overallRiskGrade === 'HIGH' ? 1 : 0;
    const adjusted = conviction - riskPenalty;
    if (adjusted >= 8) return 'A';
    if (adjusted >= 7) return 'A-';
    if (adjusted >= 6) return 'B+';
    if (adjusted >= 5) return 'B';
    if (adjusted >= 3) return 'C';
    return 'D';
  }

  /** Classify the actual leg structure for accurate descriptions */
  private classifyStructure(d: ReasoningInput): string {
    if (!d.legs?.length) return 'unknown structure';
    const types = new Set(d.legs.map(l => l.type));
    const sides = d.legs.map(l => l.side || l.action || '');
    const allPuts = types.size === 1 && types.has('put');
    const allCalls = types.size === 1 && types.has('call');
    const legCount = d.legs.length;
    const hasLong = sides.some(s => s === 'long' || s === 'BUY');
    const hasShort = sides.some(s => s === 'short' || s === 'SELL');
    const definedRisk = hasLong && hasShort && legCount >= 3;

    const sideLabel = allPuts ? 'put-side' : allCalls ? 'call-side' : 'mixed put/call';
    const riskLabel = definedRisk ? 'DEFINED RISK (all wings protected)' : (hasLong && hasShort) ? 'defined risk' : 'check risk profile';

    return `${sideLabel} ${d.strategy.replace(/_/g, ' ')} | ${legCount} legs | ${riskLabel}`;
  }

  private buildMarketContext(d: ReasoningInput): string {
    const ivRankLabel = (!d.ivRank || d.ivRank === 0)
      ? 'IV Rank: UNAVAILABLE (do not assume IV is cheap or expensive without this data)'
      : `IV Rank: ${d.ivRank}`;
    const rv30Label = (!d.rv30 || d.rv30 === 0)
      ? 'Realized Vol 30d: UNAVAILABLE'
      : `Realized Vol 30d: ${d.rv30}%`;
    const ivRvLabel = (!d.ivRvRatio || d.ivRvRatio === 0 || d.ivRvRatio === 1)
      ? 'IV/RV Ratio: UNAVAILABLE'
      : `IV/RV Ratio: ${d.ivRvRatio.toFixed(2)}`;
    const structureLabel = this.classifyStructure(d);

    return `Ticker: ${d.ticker} at $${d.spot}
DTE: ${d.dte} days, Expiry: ${d.expiry}
Engine selected: ${d.strategy} (${d.direction}, score ${d.score}/100)
STRUCTURE: ${structureLabel}

TECHNICALS:
- Trend: ${d.trendState} (score ${d.trendScore}/1.0, strength: ${d.trendStrength})
- RSI(14): ${d.rsi} | ADX(14): ${d.adx}
- Bollinger Width: ${d.bbWidth}% | Vol Regime: ${d.volRegime}
- Price vs SMAs: ${d.smaSummary}
- ATR(14): $${d.atr}

GAMMA STRUCTURE:
- Put Wall: $${d.putWall} | Call Wall: $${d.callWall}
- Band Width: ${d.bandWidth}% | Confidence: ${(d.confidence * 100).toFixed(0)}%

IV ENVIRONMENT:
- ATM IV: ${d.atmIv ? d.atmIv + '%' : 'UNAVAILABLE'}
- ${rv30Label}
- ${ivRvLabel}
- ${ivRankLabel}`;
  }

  private buildLegsContext(d: ReasoningInput): string {
    if (!d.legs?.length) return '\nLEGS: Not available. Do NOT invent leg details — say "legs not provided" if needed.';
    const legsStr = d.legs.map(l => {
      const side = l.side || l.action || 'unknown';
      return `  ${side.toUpperCase()} ${l.type} $${l.strike}${l.mid ? ` (mid $${l.mid})` : ''}`;
    }).join('\n');

    const nc = d.netCredit;
    const mp = d.maxProfit;
    const ml = d.maxLoss;

    return `
ACTUAL LEGS (use ONLY these — do not invent different legs):
${legsStr}

COMPUTED P&L (use ONLY these numbers — do not calculate your own):
- Net Credit: ${nc != null ? '$' + nc : 'not provided'}
- Max Profit: ${mp != null ? '$' + mp : 'not provided'}
- Max Loss: ${ml != null ? '-$' + ml : 'not provided'}
- Net Greeks: delta=${d.netDelta ?? 'N/A'}, theta=${d.netTheta ?? 'N/A'}, vega=${d.netVega ?? 'N/A'}

CRITICAL RULES:
- This is a ${this.classifyStructure(d)}
- If all legs have long protection, loss is DEFINED — never say "unlimited loss"
- Reference the ACTUAL leg types (put/call) — do not describe put legs as call legs or vice versa
- Use the EXACT P&L numbers above — do not invent different credit/loss numbers`;
  }

  private async callAndParse<T>(model: ModelTier, system: string, user: string): Promise<T> {
    const raw = await this.llm.call(model, { system, user, maxTokens: 3000 });
    let cleaned = raw.trim();
    const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (fenceMatch) cleaned = fenceMatch[1].trim();
    if (!cleaned.startsWith('{')) {
      const start = cleaned.indexOf('{');
      const end = cleaned.lastIndexOf('}');
      if (start !== -1 && end !== -1) cleaned = cleaned.slice(start, end + 1);
    }
    return JSON.parse(cleaned) as T;
  }

  // ── 1. Thesis ──────────────────────────────────────────────────────────────

  private async reasonThesis(model: ModelTier, d: ReasoningInput): Promise<ThesisResult> {
    const system = `You are a senior options strategist at a systematic hedge fund. Construct a conviction-scored thesis for why a specific trade will profit.

Think step by step:
1. Identify the PRIMARY driver (volatility trade, directional trade, or income trade)
2. Identify the STRUCTURAL edge (what gives positive expected value)
3. Assess TIME HORIZON alignment (does catalyst timeline match DTE)
4. Score conviction 1-10 with explicit reasoning

CRITICAL RULES:
- Your thesis MUST be consistent with the engine's selected direction and strategy
- If the strategy is bearish, explain why bearish conditions favor profit — do NOT write a bullish thesis
- If the strategy is neutral (iron condor), explain why range-bound conditions favor profit
- If IV Rank is marked UNAVAILABLE, do NOT claim options are cheap or expensive — say IV data is insufficient
- Reference the ACTUAL legs provided (put-side vs call-side). Do not describe put legs as call legs
- Use ONLY the P&L numbers provided. Do not invent different credit/loss figures
- Be brutally honest. If conviction is below 5, say so

RESPOND IN JSON ONLY:
{"primaryDriver":"volatility_selling|directional|income|mean_reversion","structuralEdge":"string","catalyst":"string","timeHorizonMatch":true|false,"timeHorizonReasoning":"string","conviction":1-10,"convictionReasoning":"string","bearCase":"string","thesis":"string"}`;

    const user = this.buildMarketContext(d) + this.buildLegsContext(d);

    try {
      return await this.callAndParse<ThesisResult>(model, system, user);
    } catch (e) {
      console.error('[Reasoning] thesis parse failed:', e);
      return {
        primaryDriver: 'unknown', structuralEdge: 'Analysis failed', catalyst: 'N/A',
        timeHorizonMatch: false, timeHorizonReasoning: 'Parse error',
        conviction: 3, convictionReasoning: 'Could not complete analysis',
        bearCase: 'Analysis incomplete', thesis: 'Reasoning engine returned unparseable response',
      };
    }
  }

  // ── 2. Risk ────────────────────────────────────────────────────────────────

  private async reasonRisk(model: ModelTier, d: ReasoningInput): Promise<RiskResult> {
    const system = `You are the risk manager at a systematic options fund. Identify everything that could go wrong with a proposed trade. You are the devil's advocate.

Think through:
1. MARKET RISK: What spot move kills this trade?
2. VOLATILITY RISK: What IV change hurts most?
3. TIME RISK: What if theta decays differently?
4. EVENT RISK: Earnings, dividends, Fed within DTE
5. LIQUIDITY RISK: Can you exit cleanly?

For each scenario estimate probability (be realistic), P&L impact, and mitigation.

CRITICAL RULES:
- Check the STRUCTURE field to determine if risk is DEFINED or UNDEFINED
- A 3+ leg spread with long protection on both sides has DEFINED RISK — NEVER say "unlimited loss"
- Max loss for defined-risk structures = the Max Loss number provided. Do not invent a different number
- Reference the actual leg types (puts vs calls). A put spread's risk is on the downside, not the upside
- pnlImpact should reference the ACTUAL max loss number provided, not invented numbers
- If IV Rank is UNAVAILABLE, do not claim IV is elevated or cheap — note data is insufficient

RESPOND IN JSON ONLY:
{"scenarios":[{"name":"string","type":"market|volatility|time|event|liquidity","probability":0.0-1.0,"trigger":"string","pnlImpact":"string","mitigation":"string"}],"maxPainScenario":"string","overallRiskGrade":"LOW|MODERATE|HIGH|EXTREME","riskRewardVerdict":"string","killSwitch":"string"}`;

    const user = this.buildMarketContext(d) + this.buildLegsContext(d) +
      `\n\nEarnings in: ${d.earningsDays ?? 'unknown'} days | Ex-Div: ${d.exDivDays ?? 'unknown'} days`;

    try {
      return await this.callAndParse<RiskResult>(model, system, user);
    } catch (e) {
      console.error('[Reasoning] risk parse failed:', e);
      return {
        scenarios: [{ name: 'Analysis error', type: 'market', probability: 0, trigger: 'N/A', pnlImpact: 'N/A', mitigation: 'N/A' }],
        maxPainScenario: 'Could not complete analysis', overallRiskGrade: 'MODERATE',
        riskRewardVerdict: 'Incomplete analysis', killSwitch: 'Review manually',
      };
    }
  }

  // ── 3. Scenarios ───────────────────────────────────────────────────────────

  private async reasonScenarios(model: ModelTier, d: ReasoningInput): Promise<ScenarioResult> {
    const system = `You are a quantitative analyst. Estimate P&L at different spot price levels and time horizons for an options position.

Given the strategy, legs, and Greeks, estimate the dollar P&L per contract at these spot moves: -5%, -2.5%, 0%, +2.5%, +5% — at three time points: +7 days, +14 days, +21 days (or at expiry if DTE < 21).

Use the Greeks and IV data to make realistic estimates. Account for theta decay and vega changes.

CRITICAL RULES:
- P&L at expiry (+21d) should be bounded by the ACTUAL Max Profit and Max Loss numbers provided
- The P&L grid values must be consistent with the ACTUAL legs — a put-side structure loses on downside, not upside
- Best/base/worst case expectedPnl should use the ACTUAL credit and loss numbers, not invented ones
- For a defined-risk structure, worst case P&L = the provided Max Loss, not "unlimited"
- For a neutral strategy (iron condor), profit peaks when spot stays near center of the structure

RESPOND IN JSON ONLY:
{"pnlGrid":[{"spot":-5,"d7":number,"d14":number,"d21":number},{"spot":-2.5,...},{"spot":0,...},{"spot":2.5,...},{"spot":5,...}],"bestCase":{"description":"string","probability":0.0-1.0,"expectedPnl":"string"},"baseCase":{"description":"string","probability":0.0-1.0,"expectedPnl":"string"},"worstCase":{"description":"string","probability":0.0-1.0,"expectedPnl":"string"}}`;

    const user = this.buildMarketContext(d) + this.buildLegsContext(d);

    try {
      return await this.callAndParse<ScenarioResult>(model, system, user);
    } catch (e) {
      console.error('[Reasoning] scenarios parse failed:', e);
      return {
        pnlGrid: [
          { spot: -5, d7: 0, d14: 0, d21: 0 }, { spot: -2.5, d7: 0, d14: 0, d21: 0 },
          { spot: 0, d7: 0, d14: 0, d21: 0 }, { spot: 2.5, d7: 0, d14: 0, d21: 0 },
          { spot: 5, d7: 0, d14: 0, d21: 0 },
        ],
        bestCase: { description: 'Analysis incomplete', probability: 0, expectedPnl: 'N/A' },
        baseCase: { description: 'Analysis incomplete', probability: 0, expectedPnl: 'N/A' },
        worstCase: { description: 'Analysis incomplete', probability: 0, expectedPnl: 'N/A' },
      };
    }
  }

  // ── 4. Exit ────────────────────────────────────────────────────────────────

  private async reasonExit(model: ModelTier, d: ReasoningInput): Promise<ExitResult> {
    const system = `You are a trade management specialist. Produce a clear, actionable exit plan that a retail trader can follow without hesitation.

Rules:
- Every trade needs a profit target, stop loss, and time exit
- Be specific with numbers (close at 50% of max profit, not "take profit early")
- Consider theta acceleration (last 2 weeks decay fastest)
- Account for gamma risk as strikes approach spot
- Include 1-2 adjustment triggers with specific actions

CRITICAL RULES:
- Reference the ACTUAL legs (put-side or call-side) — never describe put legs as call legs
- Use the ACTUAL max profit and max loss numbers provided — do not invent different numbers
- stopTrigger should be a spot price level near the tested wing of the ACTUAL structure
- For a put-side structure, risk is to the DOWNSIDE. For a call-side structure, risk is to the UPSIDE
- Adjustments should reference rolling the ACTUAL leg types, not imaginary legs
- Use the actual strike numbers from the legs in your recommendations

RESPOND IN JSON ONLY:
{"profitTarget":{"percentage":number,"reasoning":"string","typicalDaysToHit":number},"stopLoss":{"percentage":number,"spotTrigger":number|null,"reasoning":"string"},"timeExit":{"daysBeforeExpiry":number,"reasoning":"string"},"adjustments":[{"trigger":"string","action":"string","newRisk":"string"}],"rollingStrategy":{"shouldRoll":boolean,"trigger":"string","targetExpiry":"string"},"summary":"string"}`;

    const user = this.buildMarketContext(d) + this.buildLegsContext(d);

    try {
      return await this.callAndParse<ExitResult>(model, system, user);
    } catch (e) {
      console.error('[Reasoning] exit parse failed:', e);
      return {
        profitTarget: { percentage: 50, reasoning: 'Default: close at 50% of max profit', typicalDaysToHit: 14 },
        stopLoss: { percentage: 200, spotTrigger: null, reasoning: 'Default: close at 2x credit lost' },
        timeExit: { daysBeforeExpiry: 7, reasoning: 'Default: close with 7 DTE' },
        adjustments: [], rollingStrategy: { shouldRoll: false, trigger: 'N/A', targetExpiry: 'N/A' },
        summary: 'Default exit rules applied — reasoning engine returned unparseable response.',
      };
    }
  }

  // ── 5. Regime ──────────────────────────────────────────────────────────────

  private async reasonRegime(model: ModelTier, d: ReasoningInput): Promise<RegimeResult> {
    const system = `You are a macro strategist. Assess whether the current market regime supports or contradicts the proposed trade.

Consider:
1. Overall market regime (risk-on, risk-off, rotation)
2. Sector momentum relative to broad market
3. VIX environment (is selling premium smart right now?)
4. Correlation risk (will this stock move with SPY?)
5. Provide an alignment score 0.0-1.0 (how well does macro support this trade?)

RESPOND IN JSON ONLY:
{"marketRegime":"string","sectorMomentum":"string","vixEnvironment":"string","correlationRisk":"string","alignmentScore":0.0-1.0}`;

    const user = `${this.buildMarketContext(d)}

TRADE CONTEXT:
- Strategy: ${d.strategy} (${d.direction})
- This is a ${d.direction === 'neutral' ? 'premium selling / range-bound' : d.direction} trade
- Requires ${d.direction === 'neutral' ? 'stable, low-vol environment' : 'directional momentum'} to profit`;

    try {
      return await this.callAndParse<RegimeResult>(model, system, user);
    } catch (e) {
      console.error('[Reasoning] regime parse failed:', e);
      return {
        marketRegime: 'Unable to assess', sectorMomentum: 'Unknown',
        vixEnvironment: 'Unknown', correlationRisk: 'Unknown', alignmentScore: 0.5,
      };
    }
  }

  // ── 6. Sizing ──────────────────────────────────────────────────────────────

  private async reasonSizing(model: ModelTier, d: ReasoningInput): Promise<SizingResult> {
    const system = `You are a portfolio manager specializing in position sizing. Recommend how much capital to allocate to this trade.

Consider:
1. Risk/reward ratio of the trade
2. Conviction level (will be provided)
3. Account size tiers: $10K, $25K, $50K, $100K
4. Never risk more than 5% of account on a single trade
5. Kelly criterion as a guide (but cap at conservative levels)

RESPOND IN JSON ONLY:
{"allocation":number,"contracts":{"10k":number,"25k":number,"50k":number,"100k":number},"maxLossDollars":{"10k":number,"25k":number,"50k":number,"100k":number},"kellyEstimate":"string","scalingPlan":"string"}`;

    const maxLoss = d.maxLoss ?? (d.netCredit ? d.netCredit * 5 : 500);
    const user = `${this.buildMarketContext(d)}

POSITION ECONOMICS:
- Net Credit: $${d.netCredit ?? 'unknown'}/contract
- Max Profit: $${d.maxProfit ?? 'unknown'}/contract
- Max Loss: $${maxLoss}/contract
- Risk/Reward: ${d.maxProfit && maxLoss ? (d.maxProfit / maxLoss).toFixed(2) : 'unknown'}`;

    try {
      return await this.callAndParse<SizingResult>(model, system, user);
    } catch (e) {
      console.error('[Reasoning] sizing parse failed:', e);
      return {
        allocation: 2, contracts: { '10k': 1, '25k': 1, '50k': 2, '100k': 4 },
        maxLossDollars: { '10k': 200, '25k': 250, '50k': 500, '100k': 1000 },
        kellyEstimate: 'Unable to calculate', scalingPlan: 'Start small — analysis incomplete',
      };
    }
  }
}
