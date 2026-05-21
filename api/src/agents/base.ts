import type { z } from 'zod';
import type { AgentContext, AgentStatus } from '../types.js';
import type { LLMRouter, ModelTier } from '../llm/router.js';
import type { JobStore } from '../state/store.js';

export abstract class BaseAgent<Input, Report> {
  abstract readonly name: string;
  abstract readonly model: ModelTier;
  /** Override model for budget mode. If undefined, always uses premium model. */
  readonly budgetModel?: ModelTier;

  constructor(protected llm: LLMRouter, protected store: JobStore) {}

  abstract run(input: Input, ctx: AgentContext): Promise<Report>;

  /** Returns the effective model based on mode */
  protected getModel(ctx: AgentContext): ModelTier {
    if (!ctx.modelMode || ctx.modelMode === 'premium') return this.model;
    if (!this.budgetModel) return this.model; // no budget override = always premium
    switch (ctx.modelMode) {
      case 'budget-v3':  return 'deepseek';
      case 'budget-r1':  return 'deepseek-r1';
      case 'budget-qwq': return 'qwq'; // qwen-plus for regular agents
      default:           return this.model;
    }
  }

  /** Returns qwen-max for critical agents in Qwen3 mode */
  protected getModelCritical(ctx: AgentContext): ModelTier {
    if (!ctx.modelMode || ctx.modelMode === 'premium') return this.model;
    switch (ctx.modelMode) {
      case 'budget-v3':  return 'deepseek';
      case 'budget-r1':  return 'deepseek-r1';
      case 'budget-qwq': return 'qwen-max'; // qwen-max for Judge/Fixer/Advisor
      default:           return this.model;
    }
  }

  protected async report(jobId: string, status: AgentStatus, payload?: unknown) {
    await this.store.updateAgent(jobId, this.name, status, payload);
  }

  protected extractJSON<T>(raw: string, schema: z.ZodType<T>): T {
    // Strip markdown code fences if present
    let cleaned = raw.trim();
    const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
    if (fenceMatch) cleaned = fenceMatch[1].trim();

    // Try to find JSON object in response
    if (!cleaned.startsWith('{')) {
      const objStart = cleaned.indexOf('{');
      const objEnd = cleaned.lastIndexOf('}');
      if (objStart !== -1 && objEnd !== -1) {
        cleaned = cleaned.slice(objStart, objEnd + 1);
      }
    }

    const parsed = JSON.parse(cleaned);
    return schema.parse(parsed);
  }
}
