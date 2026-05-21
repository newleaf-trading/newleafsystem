import type { FastifyInstance } from 'fastify';
import { requireTier } from '../middleware/rbac.js';
import type { LLMRouter } from '../llm/router.js';
import type { ModelTier } from '../llm/router.js';

export function registerAIAdjustRoutes(fastify: FastifyInstance, llm: LLMRouter) {
  // POST /api/adjust — premium tier
  fastify.post('/api/adjust', { preHandler: [requireTier('premium')] }, async (req) => {
    const body = req.body as Record<string, unknown>;
    const {
      ticker, strategy, legs, entryNetCredit, currentSpot, dte,
      pnlPerContract, profitCapturePct, liveGreeks, verdictState, verdictReason, chain,
    } = body as {
      ticker: string;
      strategy: string;
      legs: Array<{ type: string; action: string; strike: number; expiry?: string; iv?: number; delta?: number; premium?: number }>;
      entryNetCredit: number;
      currentSpot: number;
      dte: number;
      pnlPerContract: number;
      profitCapturePct: number;
      liveGreeks: { delta: number; gamma: number; theta: number; vega: number };
      verdictState: string;
      verdictReason: string;
      chain?: Array<{ strike: number; call?: Record<string, number>; put?: Record<string, number> }>;
    };

    if (!ticker || !legs?.length) return { error: 'ticker and legs required' };

    const validModes = ['premium', 'budget-v3', 'budget-r1', 'budget-qwq'] as const;
    const mode = validModes.includes(body.modelMode as any) ? body.modelMode as typeof validModes[number] : 'budget-qwq';
    // AI Adjust uses critical model — high-stakes financial decisions
    const modelMap: Record<string, ModelTier> = {
      'premium': 'claude-sonnet', 'budget-v3': 'deepseek', 'budget-r1': 'deepseek-r1', 'budget-qwq': 'qwen-max',
    };

    const legsStr = legs.map(l =>
      `${l.action} ${l.type} $${l.strike}${l.premium ? ` @$${l.premium.toFixed(2)}` : ''}${l.delta ? ` Δ${l.delta.toFixed(2)}` : ''}`
    ).join('\n  ');

    const chainStr = chain
      ? chain.slice(0, 20).map(s => `$${s.strike}: C=${s.call?.mid?.toFixed(2) || '?'} P=${s.put?.mid?.toFixed(2) || '?'}`).join(', ')
      : 'No live chain';

    const system = `You are a professional options risk manager for NewLeaf Trading. Given a position's current state, verdict, and market data, recommend 2-4 specific adjustment actions ranked by risk-adjusted benefit.

For each adjustment:
- Give a clear type (roll_down, roll_out, close_tested_wing, widen_wings, reduce_size, take_profit, close_position)
- Specify the EXACT new legs (strikes, type, action)
- Estimate the net cost/credit of the adjustment
- Estimate new probability of profit after adjustment
- Explain WHY this adjustment helps in 1-2 sentences
- Rate risk level (low/medium/high)

Also provide market context (1 sentence) and urgency (immediate/soon/monitor).

Return ONLY valid JSON:
{
  "adjustments": [{"type": "...", "label": "...", "description": "...", "newLegs": [{"type":"call|put","action":"BUY|SELL","strike":0}], "estimatedNetCost": 0, "estimatedNewPop": 0, "reasoning": "...", "riskLevel": "low|medium|high"}],
  "marketContext": "1 sentence",
  "urgency": "immediate|soon|monitor"
}`;

    const user = `POSITION:
  ${ticker} ${strategy}
  Current spot: $${currentSpot}
  DTE: ${dte}
  Entry credit: $${entryNetCredit?.toFixed(2) || '?'}/share
  Current P&L: $${pnlPerContract?.toFixed(0) || '?'}/contract (${profitCapturePct?.toFixed(0) || '?'}% of max)
  Legs:
  ${legsStr}

GREEKS:
  Delta: ${liveGreeks?.delta?.toFixed(3) || '?'}  Gamma: ${liveGreeks?.gamma?.toFixed(4) || '?'}
  Theta: ${liveGreeks?.theta?.toFixed(2) || '?'}  Vega: ${liveGreeks?.vega?.toFixed(2) || '?'}

VERDICT: ${verdictState} — ${verdictReason}

NEARBY STRIKES: ${chainStr}`;

    llm.resetUsage();
    const raw = await llm.call(modelMap[mode] ?? 'qwen-max', { system, user, maxTokens: 1500 });

    try {
      const start = raw.indexOf('{'), end = raw.lastIndexOf('}');
      const parsed = JSON.parse(raw.slice(start, end + 1));
      return {
        adjustments: parsed.adjustments || [],
        marketContext: parsed.marketContext || '',
        urgency: parsed.urgency || 'monitor',
        cost: llm.getUsage(),
      };
    } catch {
      return { adjustments: [], marketContext: raw.slice(0, 300), urgency: 'monitor', cost: llm.getUsage() };
    }
  });
}
