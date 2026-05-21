import type { FastifyInstance } from 'fastify';
import { requireTier } from '../middleware/rbac.js';
import type { LLMRouter } from '../llm/router.js';
import type { ModelTier } from '../llm/router.js';

export function registerAIStrikesRoutes(fastify: FastifyInstance, llm: LLMRouter) {
  // POST /api/strike-compare — basic tier (Pro)
  fastify.post('/api/strike-compare', { preHandler: [requireTier('basic')] }, async (req) => {
    const body = req.body as Record<string, unknown>;
    const { ticker, expiry, currentLegs, spot, chain, strategy } = body as {
      ticker: string;
      expiry: string;
      currentLegs: Array<{ type: string; action: string; strike: number; premium?: number; iv?: number; delta?: number }>;
      spot: number;
      chain?: Array<{ strike: number; call?: Record<string, number>; put?: Record<string, number> }>;
      strategy: string;
    };

    if (!ticker || !currentLegs?.length) return { error: 'ticker and currentLegs required' };

    const validModes = ['premium', 'budget-v3', 'budget-r1', 'budget-qwq'] as const;
    const mode = validModes.includes(body.modelMode as any) ? body.modelMode as typeof validModes[number] : 'budget-qwq';
    // Strike comparison benefits from stronger reasoning
    const modelMap: Record<string, ModelTier> = {
      'premium': 'claude-sonnet', 'budget-v3': 'deepseek', 'budget-r1': 'deepseek-r1', 'budget-qwq': 'qwen-max',
    };

    const legsStr = currentLegs.map(l =>
      `${l.action} ${l.type} $${l.strike}${l.premium ? ` @${l.premium.toFixed(2)}` : ''}${l.delta ? ` Δ${l.delta.toFixed(2)}` : ''}`
    ).join(' | ');

    const chainStr = chain
      ? chain.slice(0, 30).map(s => `$${s.strike}: C=${s.call?.mid?.toFixed(2) || '?'} P=${s.put?.mid?.toFixed(2) || '?'}`).join('\n')
      : 'No chain data provided';

    const system = `You are an options strike selection analyst. Given a current trade setup and option chain data, suggest 3 alternative strike configurations. For each, explain the trade-off (wider/tighter, more credit/less risk, higher/lower probability). Be quantitative — estimate PoP, max profit, max loss for each alternative.

Return ONLY valid JSON:
{"alternatives": [{"name": "...", "legs": [{"type":"call|put","action":"BUY|SELL","strike":0}], "tradeoff": "1-2 sentences", "popEstimate": 0, "maxProfit": 0, "maxLoss": 0, "netCredit": 0}], "reasoning": "Why these alternatives were chosen"}`;

    const user = `Ticker: ${ticker} @ $${spot}
Strategy: ${strategy}
Expiry: ${expiry}
Current legs: ${legsStr}
Available strikes (sample):
${chainStr}`;

    llm.resetUsage();
    const raw = await llm.call(modelMap[mode] ?? 'qwq', { system, user, maxTokens: 1200 });

    try {
      const start = raw.indexOf('{'), end = raw.lastIndexOf('}');
      const parsed = JSON.parse(raw.slice(start, end + 1));
      return { alternatives: parsed.alternatives || [], reasoning: parsed.reasoning || '', cost: llm.getUsage() };
    } catch {
      return { alternatives: [], reasoning: raw.slice(0, 500), cost: llm.getUsage() };
    }
  });
}
