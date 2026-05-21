import type { FastifyInstance } from 'fastify';
import { requireTier } from '../middleware/rbac.js';
import type { LLMRouter } from '../llm/router.js';
import type { ModelTier } from '../llm/router.js';

export function registerAIEventsRoutes(fastify: FastifyInstance, llm: LLMRouter) {
  // POST /api/event-risk — premium tier
  fastify.post('/api/event-risk', { preHandler: [requireTier('premium')] }, async (req) => {
    const body = req.body as Record<string, unknown>;
    const { ticker, expiry, strategy, legs, entryIvRank } = body as {
      ticker: string;
      expiry: string;
      strategy: string;
      legs: Array<{ type: string; action: string; strike: number }>;
      entryIvRank?: number;
    };

    if (!ticker || !expiry) return { error: 'ticker and expiry required' };

    const validModes = ['premium', 'budget-v3', 'budget-r1', 'budget-qwq'] as const;
    const mode = validModes.includes(body.modelMode as any) ? body.modelMode as typeof validModes[number] : 'budget-qwq';
    const modelMap: Record<string, ModelTier> = {
      'premium': 'qwq', 'budget-v3': 'deepseek', 'budget-r1': 'deepseek-r1', 'budget-qwq': 'qwq',
    };

    const legsStr = (legs || []).map(l => `${l.action} ${l.type} $${l.strike}`).join(' | ');
    const dte = Math.round((new Date(expiry + 'T16:00:00').getTime() - Date.now()) / 86400000);

    const system = `You are a risk analyst detecting event risks for options positions. Given a ticker, strategy, and expiry, identify upcoming risks: earnings dates, ex-dividend dates, Fed meetings, or other catalysts that could impact the position before expiration.

For each risk, assess severity (high/medium/low) and provide a specific recommendation. Also assess IV crush risk.

Use your knowledge of typical earnings schedules and market events. Return ONLY valid JSON:
{"alerts": [{"type": "earnings|dividend|fed|event", "severity": "high|medium|low", "date": "YYYY-MM-DD or approximate", "daysAway": 0, "description": "1 sentence", "recommendation": "1 sentence or null"}], "ivCrushRisk": {"level": "high|medium|low", "explanation": "1 sentence"}}`;

    const user = `Ticker: ${ticker}
Strategy: ${strategy}
Expiry: ${expiry} (${dte} DTE)
Legs: ${legsStr}
Entry IV Rank: ${entryIvRank ?? 'unknown'}
Current date: ${new Date().toISOString().split('T')[0]}`;

    llm.resetUsage();
    const raw = await llm.call(modelMap[mode] ?? 'qwq', { system, user, maxTokens: 600 });

    try {
      const start = raw.indexOf('{'), end = raw.lastIndexOf('}');
      const parsed = JSON.parse(raw.slice(start, end + 1));
      return { alerts: parsed.alerts || [], ivCrushRisk: parsed.ivCrushRisk || { level: 'low', explanation: 'N/A' }, cost: llm.getUsage() };
    } catch {
      return { alerts: [], ivCrushRisk: { level: 'unknown', explanation: raw.slice(0, 200) }, cost: llm.getUsage() };
    }
  });
}
