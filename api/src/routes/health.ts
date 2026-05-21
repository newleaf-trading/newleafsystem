import type { FastifyInstance } from 'fastify';

export function registerHealthRoutes(fastify: FastifyInstance) {
  fastify.get('/health', async () => ({
    ok: true,
    ts: Date.now(),
    env: {
      hasAnthropicKey: !!process.env.ANTHROPIC_API_KEY && process.env.ANTHROPIC_API_KEY !== 'mock',
      hasDashscopeKey: !!process.env.DASHSCOPE_API_KEY && process.env.DASHSCOPE_API_KEY !== 'mock',
      hasAlpacaKey: !!process.env.ALPACA_API_KEY && process.env.ALPACA_API_KEY !== 'mock',
      nodeEnv: process.env.NODE_ENV,
    },
  }));
}
