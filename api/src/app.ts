import Fastify from 'fastify';
import cors from '@fastify/cors';
import { authMiddleware } from './middleware/auth.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerMarketRoutes } from './routes/market.js';
import { registerAIRoutes } from './routes/ai.js';
import { registerVerifyRoutes } from './routes/verify.js';
import { registerAdminRoutes } from './routes/admin.js';
import { registerAIVerdictRoutes } from './routes/ai-verdict.js';
import { registerAIPicksRoutes } from './routes/ai-picks.js';
import { registerAIStrikesRoutes } from './routes/ai-strikes.js';
import { registerAIEventsRoutes } from './routes/ai-events.js';
import { registerAIAdjustRoutes } from './routes/ai-adjust.js';
import { registerPublishRoutes } from './routes/publish.js';
import { LLMRouter } from './llm/router.js';
import { JobStore } from './state/store.js';
import { VerificationOrchestrator } from './orchestrator.js';
import { TechnicalAnalyst } from './agents/analysts/technical.js';
import { GammaAnalyst } from './agents/analysts/gamma.js';
import { IVAnalyst } from './agents/analysts/iv.js';
import { SentimentAnalyst } from './agents/analysts/sentiment.js';
import { BullResearcher } from './agents/researchers/bull.js';
import { BearResearcher } from './agents/researchers/bear.js';
import { RiskManager } from './agents/risk.js';
import { Judge } from './agents/judge.js';
import { TradeFixer } from './agents/fixer.js';

export function createApp() {
  const fastify = Fastify({ logger: { level: process.env.LOG_LEVEL ?? 'info' } });

  fastify.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'DELETE'],
    allowedHeaders: ['Content-Type', 'X-API-Key', 'Authorization'],
  });

  // Auth middleware
  fastify.addHook('onRequest', authMiddleware);

  // Shared services
  const llm = new LLMRouter();
  const store = new JobStore();
  const orchestrator = new VerificationOrchestrator(
    {
      technical: new TechnicalAnalyst(llm, store),
      gamma: new GammaAnalyst(llm, store),
      iv: new IVAnalyst(llm, store),
      sentiment: new SentimentAnalyst(llm, store),
    },
    new BullResearcher(llm, store),
    new BearResearcher(llm, store),
    new RiskManager(llm, store),
    new Judge(llm, store),
    new TradeFixer(llm),
    llm,
    store,
  );

  // Register routes
  registerHealthRoutes(fastify);
  registerMarketRoutes(fastify, llm);
  registerAIRoutes(fastify, llm);
  registerVerifyRoutes(fastify, orchestrator, store);
  registerAdminRoutes(fastify, llm);
  registerAIVerdictRoutes(fastify, llm);
  registerAIPicksRoutes(fastify, llm);
  registerAIStrikesRoutes(fastify, llm);
  registerAIEventsRoutes(fastify, llm);
  registerAIAdjustRoutes(fastify, llm);
  registerPublishRoutes(fastify);

  return fastify;
}
