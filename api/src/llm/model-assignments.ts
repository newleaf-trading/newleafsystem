/**
 * Model assignments — single source of truth for which LLM model each service uses.
 *
 * Every service that calls the LLM router should reference this config.
 * Env var overrides allow swapping models without code changes.
 *
 * Admin page at /invest/admin (Models tab) renders this table.
 */
import type { ModelTier } from './router.js';

export interface ModelAssignment {
  service: string;
  description: string;
  currentModel: ModelTier;
  alternatives: ModelTier[];
  envOverride: string | null;
  category: 'sentiment' | 'analysis' | 'verification' | 'tools';
}

function envOrDefault(envVar: string, defaultModel: ModelTier): ModelTier {
  const val = process.env[envVar];
  return val ? (val as ModelTier) : defaultModel;
}

export const MODEL_ASSIGNMENTS: ModelAssignment[] = [
  // ── Sentiment engines ──
  {
    service: 'sentiment-claude',
    description: 'Claude engine for web search + news sentiment',
    currentModel: envOrDefault('SENTIMENT_CLAUDE_MODEL', 'claude-haiku'),
    alternatives: ['claude-sonnet', 'claude-haiku'],
    envOverride: 'SENTIMENT_CLAUDE_MODEL',
    category: 'sentiment',
  },
  {
    service: 'sentiment-grok',
    description: 'Grok engine for X/Twitter social sentiment',
    currentModel: envOrDefault('SENTIMENT_GROK_MODEL', 'grok'),
    alternatives: ['grok'],
    envOverride: 'SENTIMENT_GROK_MODEL',
    category: 'sentiment',
  },
  {
    service: 'sentiment-gemini',
    description: 'Gemini engine for Google News + sector analysis',
    currentModel: envOrDefault('SENTIMENT_GEMINI_MODEL', 'gemini-flash'),
    alternatives: ['gemini-flash', 'gemini-pro'],
    envOverride: 'SENTIMENT_GEMINI_MODEL',
    category: 'sentiment',
  },
  // ── Analysis / AI routes ──
  {
    service: 'ai-read',
    description: 'One-sentence market read for workbench',
    currentModel: envOrDefault('AI_READ_MODEL', 'qwen-plus'),
    alternatives: ['qwen-plus', 'qwen-max', 'claude-haiku', 'deepseek', 'gemini-flash'],
    envOverride: 'AI_READ_MODEL',
    category: 'analysis',
  },
  {
    service: 'recommend',
    description: 'Strategy explanation from StrategyAdvisor',
    currentModel: envOrDefault('RECOMMEND_MODEL', 'qwen-plus'),
    alternatives: ['qwen-plus', 'qwen-max', 'claude-sonnet', 'gpt-4'],
    envOverride: 'RECOMMEND_MODEL',
    category: 'analysis',
  },
  {
    service: 'ai-picks-narrative',
    description: 'Weekly picks narrative generation',
    currentModel: envOrDefault('PICKS_NARRATIVE_MODEL', 'qwen-plus'),
    alternatives: ['qwen-plus', 'qwen-max', 'claude-sonnet', 'gpt-4'],
    envOverride: 'PICKS_NARRATIVE_MODEL',
    category: 'analysis',
  },
  // ── Reasoning (deep analysis, qwen3-max) ──
  {
    service: 'reasoning-thesis',
    description: 'Deep thesis generation with conviction scoring',
    currentModel: envOrDefault('REASONING_THESIS_MODEL', 'qwen3-max'),
    alternatives: ['qwen3-max', 'qwen-max', 'claude-sonnet'],
    envOverride: 'REASONING_THESIS_MODEL',
    category: 'analysis',
  },
  {
    service: 'reasoning-risk',
    description: 'Risk assessment with scenario analysis',
    currentModel: envOrDefault('REASONING_RISK_MODEL', 'qwen3-max'),
    alternatives: ['qwen3-max', 'qwen-max', 'claude-sonnet'],
    envOverride: 'REASONING_RISK_MODEL',
    category: 'analysis',
  },
  {
    service: 'reasoning-scenarios',
    description: 'P&L scenario analysis across spot moves and time',
    currentModel: envOrDefault('REASONING_SCENARIOS_MODEL', 'qwen3-max'),
    alternatives: ['qwen3-max', 'qwen-max', 'claude-sonnet'],
    envOverride: 'REASONING_SCENARIOS_MODEL',
    category: 'analysis',
  },
  {
    service: 'reasoning-exit',
    description: 'Exit strategy and adjustment triggers',
    currentModel: envOrDefault('REASONING_EXIT_MODEL', 'qwen3-max'),
    alternatives: ['qwen3-max', 'qwen-max', 'claude-sonnet'],
    envOverride: 'REASONING_EXIT_MODEL',
    category: 'analysis',
  },
  {
    service: 'reasoning-regime',
    description: 'Cross-asset regime and macro context',
    currentModel: envOrDefault('REASONING_REGIME_MODEL', 'qwen3-max'),
    alternatives: ['qwen3-max', 'qwen-max', 'claude-sonnet'],
    envOverride: 'REASONING_REGIME_MODEL',
    category: 'analysis',
  },
  {
    service: 'reasoning-sizing',
    description: 'Position sizing and allocation',
    currentModel: envOrDefault('REASONING_SIZING_MODEL', 'qwen3-max'),
    alternatives: ['qwen3-max', 'qwen-max', 'claude-sonnet'],
    envOverride: 'REASONING_SIZING_MODEL',
    category: 'analysis',
  },
  // ── Verification agents ──
  {
    service: 'verify-technical',
    description: 'Technical analysis agent in verify pipeline',
    currentModel: envOrDefault('VERIFY_TECHNICAL_MODEL', 'deepseek'),
    alternatives: ['deepseek', 'claude-haiku', 'qwen-max', 'gemini-flash'],
    envOverride: 'VERIFY_TECHNICAL_MODEL',
    category: 'verification',
  },
  {
    service: 'verify-gamma',
    description: 'Gamma analysis agent in verify pipeline',
    currentModel: envOrDefault('VERIFY_GAMMA_MODEL', 'deepseek'),
    alternatives: ['deepseek', 'claude-haiku', 'qwen-max'],
    envOverride: 'VERIFY_GAMMA_MODEL',
    category: 'verification',
  },
  {
    service: 'verify-iv',
    description: 'IV analysis agent in verify pipeline',
    currentModel: envOrDefault('VERIFY_IV_MODEL', 'deepseek'),
    alternatives: ['deepseek', 'claude-haiku', 'gemini-flash'],
    envOverride: 'VERIFY_IV_MODEL',
    category: 'verification',
  },
  {
    service: 'verify-sentiment',
    description: 'Sentiment agent in verify pipeline (Serper-based)',
    currentModel: envOrDefault('VERIFY_SENTIMENT_MODEL', 'deepseek'),
    alternatives: ['deepseek', 'claude-haiku', 'gemini-flash'],
    envOverride: 'VERIFY_SENTIMENT_MODEL',
    category: 'verification',
  },
  {
    service: 'verify-bull',
    description: 'Bull researcher in verify pipeline',
    currentModel: envOrDefault('VERIFY_BULL_MODEL', 'deepseek'),
    alternatives: ['deepseek', 'claude-haiku', 'qwen-max'],
    envOverride: 'VERIFY_BULL_MODEL',
    category: 'verification',
  },
  {
    service: 'verify-bear',
    description: 'Bear researcher in verify pipeline',
    currentModel: envOrDefault('VERIFY_BEAR_MODEL', 'deepseek'),
    alternatives: ['deepseek', 'claude-haiku', 'qwen-max'],
    envOverride: 'VERIFY_BEAR_MODEL',
    category: 'verification',
  },
  {
    service: 'verify-risk',
    description: 'Risk manager in verify pipeline',
    currentModel: envOrDefault('VERIFY_RISK_MODEL', 'claude-haiku'),
    alternatives: ['claude-haiku', 'claude-sonnet', 'deepseek'],
    envOverride: 'VERIFY_RISK_MODEL',
    category: 'verification',
  },
  {
    service: 'verify-judge',
    description: 'Final judge in verify pipeline',
    currentModel: envOrDefault('VERIFY_JUDGE_MODEL', 'claude-sonnet'),
    alternatives: ['claude-sonnet', 'gpt-4', 'gemini-pro'],
    envOverride: 'VERIFY_JUDGE_MODEL',
    category: 'verification',
  },
  // ── Tools ──
  {
    service: 'ai-adjust',
    description: 'Position adjustment recommendations',
    currentModel: envOrDefault('AI_ADJUST_MODEL', 'claude-haiku'),
    alternatives: ['claude-haiku', 'claude-sonnet', 'gemini-flash'],
    envOverride: 'AI_ADJUST_MODEL',
    category: 'tools',
  },
  {
    service: 'ai-events',
    description: 'Event risk analysis for positions',
    currentModel: envOrDefault('AI_EVENTS_MODEL', 'gemini-flash'),
    alternatives: ['gemini-flash', 'claude-haiku', 'grok'],
    envOverride: 'AI_EVENTS_MODEL',
    category: 'tools',
  },
  {
    service: 'ai-strikes',
    description: 'Strike comparison analysis',
    currentModel: envOrDefault('AI_STRIKES_MODEL', 'qwen-plus'),
    alternatives: ['qwen-plus', 'claude-haiku', 'deepseek', 'gemini-flash'],
    envOverride: 'AI_STRIKES_MODEL',
    category: 'tools',
  },
  {
    service: 'ai-verdict',
    description: 'Quick verdict explanation for trades',
    currentModel: envOrDefault('AI_VERDICT_MODEL', 'claude-haiku'),
    alternatives: ['claude-haiku', 'claude-sonnet', 'gemini-flash'],
    envOverride: 'AI_VERDICT_MODEL',
    category: 'tools',
  },
];

/** Get the model assignment for a specific service */
export function getAssignment(service: string): ModelAssignment | undefined {
  return MODEL_ASSIGNMENTS.find(a => a.service === service);
}

/** Get the current model for a service (with env override) */
export function getModel(service: string): ModelTier {
  const assignment = getAssignment(service);
  return assignment?.currentModel ?? 'claude-haiku';
}
