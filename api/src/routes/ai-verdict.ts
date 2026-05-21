import type { FastifyInstance } from 'fastify';
import { requireTier } from '../middleware/rbac.js';
import type { LLMRouter } from '../llm/router.js';
import type { ModelTier } from '../llm/router.js';

export function registerAIVerdictRoutes(fastify: FastifyInstance, llm: LLMRouter) {
  // POST /api/verdict-explain — premium tier
  fastify.post('/api/verdict-explain', { preHandler: [requireTier('premium')] }, async (req) => {
    const body = req.body as Record<string, unknown>;
    const { ticker, strategy, verdictState, verdictReason, marketData, position } = body as {
      ticker: string;
      strategy: string;
      verdictState: string;
      verdictReason: string;
      marketData: Record<string, unknown>;
      position: Record<string, unknown>;
    };

    if (!ticker || !verdictState) return { error: 'ticker and verdictState required' };

    const validModes = ['premium', 'budget-v3', 'budget-r1', 'budget-qwq'] as const;
    const mode = validModes.includes(body.modelMode as any) ? body.modelMode as typeof validModes[number] : 'budget-qwq';
    const modelMap: Record<string, ModelTier> = {
      'premium': 'qwq', 'budget-v3': 'deepseek', 'budget-r1': 'deepseek-r1', 'budget-qwq': 'qwq',
    };

    const system = `You are an options position risk analyst. Given a position's verdict state and market data, explain in 1-2 concise sentences WHY the verdict was reached. Be specific — cite numbers (P&L %, DTE, delta, IV rank). No hedging language. Also provide a confidence score 0-100 for how certain this verdict is correct.

Return ONLY valid JSON: {"explanation": "...", "confidence": 0}`;

    const user = `Ticker: ${ticker}
Strategy: ${strategy}
Verdict: ${verdictState}
Reason: ${verdictReason}
Market data: ${JSON.stringify(marketData || {}).slice(0, 2000)}
Position: ${JSON.stringify(position || {}).slice(0, 1000)}`;

    llm.resetUsage();
    const raw = await llm.call(modelMap[mode] ?? 'qwq', { system, user, maxTokens: 300 });

    try {
      const start = raw.indexOf('{'), end = raw.lastIndexOf('}');
      const parsed = JSON.parse(raw.slice(start, end + 1));
      return { explanation: parsed.explanation || raw, confidence: parsed.confidence ?? 50, cost: llm.getUsage() };
    } catch {
      return { explanation: raw.slice(0, 200), confidence: 50, cost: llm.getUsage() };
    }
  });
}
