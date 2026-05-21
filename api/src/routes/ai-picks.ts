import type { FastifyInstance } from 'fastify';
import { requireTier } from '../middleware/rbac.js';
import type { LLMRouter } from '../llm/router.js';
import type { ModelTier } from '../llm/router.js';

export function registerAIPicksRoutes(fastify: FastifyInstance, llm: LLMRouter) {
  // POST /api/picks-narrative — basic tier (Pro)
  fastify.post('/api/picks-narrative', { preHandler: [requireTier('basic')] }, async (req) => {
    const body = req.body as Record<string, unknown>;
    const { picks, weekId, theme } = body as {
      picks: Array<{ symbol: string; strategy: string; direction: string; ivRank?: number; sentiment?: { label: string; score: number } }>;
      weekId: string;
      theme?: string;
    };

    if (!picks?.length) return { error: 'picks array required' };

    const validModes = ['premium', 'budget-v3', 'budget-r1', 'budget-qwq'] as const;
    const mode = validModes.includes(body.modelMode as any) ? body.modelMode as typeof validModes[number] : 'budget-qwq';
    const modelMap: Record<string, ModelTier> = {
      'premium': 'qwq', 'budget-v3': 'deepseek', 'budget-r1': 'deepseek-r1', 'budget-qwq': 'qwq',
    };

    const picksStr = picks.map(p =>
      `${p.symbol} ${p.strategy} (${p.direction})${p.ivRank ? ` IV:${p.ivRank}` : ''}${p.sentiment ? ` Sent:${p.sentiment.label}` : ''}`
    ).join('\n');

    const system = `You are a market strategist writing the weekly picks narrative for NewLeaf Invest subscribers. Write a 2-3 paragraph market commentary explaining this week's picks selection, market bias, and key themes. Be specific, cite the picks by name. Professional but accessible tone.

Return ONLY valid JSON:
{"narrative": "markdown text...", "marketBias": "bullish|bearish|neutral", "keyThemes": ["theme1", "theme2", "theme3"]}`;

    const user = `Week: ${weekId}
Theme: ${theme || 'AI-selected options strategies'}
Picks this week:
${picksStr}`;

    llm.resetUsage();
    const raw = await llm.call(modelMap[mode] ?? 'qwq', { system, user, maxTokens: 800 });

    try {
      const start = raw.indexOf('{'), end = raw.lastIndexOf('}');
      const parsed = JSON.parse(raw.slice(start, end + 1));
      return { narrative: parsed.narrative, marketBias: parsed.marketBias, keyThemes: parsed.keyThemes || [], cost: llm.getUsage() };
    } catch {
      return { narrative: raw.slice(0, 1000), marketBias: 'neutral', keyThemes: [], cost: llm.getUsage() };
    }
  });
}
