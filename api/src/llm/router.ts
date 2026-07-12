import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

export type ModelTier = 'claude-sonnet' | 'claude-haiku' | 'gpt-4' | 'gpt-5.5' | 'grok' | 'deepseek' | 'deepseek-r1' | 'qwen-max' | 'qwen-plus' | 'qwen3-max' | 'gemini-pro' | 'gemini-flash';

export interface LLMCall { system: string; user: string; maxTokens?: number; }

export interface TokenUsage {
  model: ModelTier;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

export interface LLMTrace {
  model: ModelTier;
  system: string;
  user: string;
  response: string;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  durationMs: number;
}

// Per-million-token pricing (as of May 2025)
const PRICING: Record<ModelTier, { input: number; output: number }> = {
  'claude-sonnet': { input: 3, output: 15 },
  'claude-haiku':  { input: 0.80, output: 4 },
  'gpt-4':         { input: 2.50, output: 10 },
  'gpt-5.5':       { input: 3, output: 12 },
  'grok':          { input: 3, output: 15 },
  'deepseek':      { input: 0.27, output: 1.10 },
  'deepseek-r1':   { input: 0.55, output: 2.19 },
  'qwen-max':      { input: 1.60, output: 6.40 },
  'qwen-plus':     { input: 0.80, output: 3.20 },
  'qwen3-max':     { input: 2.00, output: 8.00 },
  'gemini-pro':    { input: 1.25, output: 5.00 },
  'gemini-flash':  { input: 0.075, output: 0.30 },
};

function calcCost(model: ModelTier, inputTokens: number, outputTokens: number): number {
  const p = PRICING[model];
  return (inputTokens * p.input + outputTokens * p.output) / 1_000_000;
}

export class LLMRouter {
  private anthropic: Anthropic;
  private openai: OpenAI;
  private xai: OpenAI;
  private deepseek: OpenAI;
  private together: OpenAI;
  private dashscope: OpenAI;
  private gemini: GoogleGenerativeAI;
  private mock: boolean;
  private _usage: TokenUsage[] = [];
  private _traces: LLMTrace[] = [];

  constructor() {
    this.mock = process.env.USE_MOCK_LLM === 'true';
    const timeout = 120_000; // 2 min timeout for all LLM calls
    const key = (name: string) => (process.env[name] ?? 'mock').trim();
    this.anthropic = new Anthropic({ apiKey: key('ANTHROPIC_API_KEY'), timeout });
    this.openai = new OpenAI({ apiKey: key('OPENAI_API_KEY'), timeout });
    this.xai = new OpenAI({ apiKey: key('XAI_API_KEY'), baseURL: 'https://api.x.ai/v1', timeout });
    this.deepseek = new OpenAI({ apiKey: key('DEEPSEEK_API_KEY'), baseURL: 'https://api.deepseek.com', timeout });
    this.together = new OpenAI({ apiKey: key('TOGETHER_API_KEY'), baseURL: 'https://api.together.xyz/v1', timeout });
    this.dashscope = new OpenAI({ apiKey: key('DASHSCOPE_API_KEY'), baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1', timeout });
    this.gemini = new GoogleGenerativeAI(key('GEMINI_API_KEY'));
  }

  /** Reset usage tracking (call at start of each request) */
  resetUsage() { this._usage = []; this._traces = []; }

  /** Get accumulated usage since last reset */
  getUsage(): { calls: TokenUsage[]; totalCost: number; totalInputTokens: number; totalOutputTokens: number } {
    return {
      calls: this._usage,
      totalCost: +this._usage.reduce((s, u) => s + u.cost, 0).toFixed(6),
      totalInputTokens: this._usage.reduce((s, u) => s + u.inputTokens, 0),
      totalOutputTokens: this._usage.reduce((s, u) => s + u.outputTokens, 0),
    };
  }

  /** Get full traces (prompts + responses) */
  getTraces(): LLMTrace[] { return this._traces; }

  async call(model: ModelTier, opts: LLMCall): Promise<string> {
    if (this.mock) return this.mockResponse(model);
    console.log(`[LLM] calling ${model}...`);
    try {
      let result: string;
      switch (model) {
        case 'claude-sonnet': result = await this.callClaude('claude-sonnet-4-6', model, opts); break;
        case 'claude-haiku':  result = await this.callClaude('claude-haiku-4-5-20251001', model, opts); break;
        case 'gpt-4':         result = await this.callOpenAI('gpt-4o', model, opts); break;
        case 'gpt-5.5':       result = await this.callOpenAI('gpt-5.5', model, opts); break;
        case 'grok':          result = await this.callXAI('grok-4', model, opts); break;
        case 'deepseek':      result = await this.callDeepSeek('deepseek-chat', model, opts); break;
        case 'deepseek-r1':   result = await this.callDeepSeek('deepseek-reasoner', model, opts); break;
        case 'qwen-max':      result = await this.callQwen('qwen-max', model, opts); break;
        case 'qwen-plus':     result = await this.callQwen('qwen-plus', model, opts); break;
        case 'qwen3-max':     result = await this.callQwen('qwen3-max', model, opts); break;
        case 'gemini-pro':    result = await this.callGemini('gemini-2.5-pro', model, opts); break;
        case 'gemini-flash':  result = await this.callGemini('gemini-2.5-flash', model, opts); break;
        default: result = '';
      }
      console.log(`[LLM] ${model} done (${result.length} chars)`);
      return result;
    } catch (err: any) {
      console.error(`[LLM] ${model} FAILED:`, err?.message || err);
      throw err;
    }
  }

  private async callClaude(apiModel: string, tier: ModelTier, opts: LLMCall): Promise<string> {
    const t0 = Date.now();
    const r = await this.anthropic.messages.create({
      model: apiModel, max_tokens: opts.maxTokens ?? 2000,
      system: opts.system, messages: [{ role: 'user', content: opts.user }],
    });
    const inputTokens = r.usage?.input_tokens ?? 0;
    const outputTokens = r.usage?.output_tokens ?? 0;
    const cost = calcCost(tier, inputTokens, outputTokens);
    const response = r.content.map(b => b.type === 'text' ? b.text : '').join('');
    this._usage.push({ model: tier, inputTokens, outputTokens, cost });
    this._traces.push({ model: tier, system: opts.system, user: opts.user, response, inputTokens, outputTokens, cost, durationMs: Date.now() - t0 });
    return response;
  }

  private async callOpenAI(apiModel: string, tier: ModelTier, opts: LLMCall): Promise<string> {
    const t0 = Date.now();
    const r = await this.openai.chat.completions.create({
      model: apiModel, messages: [{ role: 'system', content: opts.system }, { role: 'user', content: opts.user }],
    });
    const inputTokens = r.usage?.prompt_tokens ?? 0;
    const outputTokens = r.usage?.completion_tokens ?? 0;
    const cost = calcCost(tier, inputTokens, outputTokens);
    const response = r.choices[0]?.message?.content ?? '';
    this._usage.push({ model: tier, inputTokens, outputTokens, cost });
    this._traces.push({ model: tier, system: opts.system, user: opts.user, response, inputTokens, outputTokens, cost, durationMs: Date.now() - t0 });
    return response;
  }

  private async callXAI(apiModel: string, tier: ModelTier, opts: LLMCall): Promise<string> {
    const t0 = Date.now();
    const r = await this.xai.chat.completions.create({
      model: apiModel, messages: [{ role: 'system', content: opts.system }, { role: 'user', content: opts.user }],
    });
    const inputTokens = r.usage?.prompt_tokens ?? 0;
    const outputTokens = r.usage?.completion_tokens ?? 0;
    const cost = calcCost(tier, inputTokens, outputTokens);
    const response = r.choices[0]?.message?.content ?? '';
    this._usage.push({ model: tier, inputTokens, outputTokens, cost });
    this._traces.push({ model: tier, system: opts.system, user: opts.user, response, inputTokens, outputTokens, cost, durationMs: Date.now() - t0 });
    return response;
  }

  private async callDeepSeek(apiModel: string, tier: ModelTier, opts: LLMCall): Promise<string> {
    const t0 = Date.now();
    const r = await this.deepseek.chat.completions.create({
      model: apiModel, messages: [{ role: 'system', content: opts.system }, { role: 'user', content: opts.user }],
    });
    const inputTokens = r.usage?.prompt_tokens ?? 0;
    const outputTokens = r.usage?.completion_tokens ?? 0;
    const cost = calcCost(tier, inputTokens, outputTokens);
    const response = r.choices[0]?.message?.content ?? '';
    this._usage.push({ model: tier, inputTokens, outputTokens, cost });
    this._traces.push({ model: tier, system: opts.system, user: opts.user, response, inputTokens, outputTokens, cost, durationMs: Date.now() - t0 });
    return response;
  }

  private async callQwen(apiModel: string, tier: ModelTier, opts: LLMCall): Promise<string> {
    // Route through Cloudflare Worker proxy (DashScope is unreachable from GCP)
    const proxyUrl = process.env.QWEN_PROXY_URL;
    if (proxyUrl) {
      const qwenProxy = new OpenAI({
        apiKey: (process.env.DASHSCOPE_API_KEY ?? 'mock').trim(),
        baseURL: proxyUrl,
        timeout: 120_000,
      });
      const t0 = Date.now();
      const r = await qwenProxy.chat.completions.create({
        model: apiModel,
        messages: [{ role: 'system', content: opts.system }, { role: 'user', content: opts.user }],
        max_tokens: opts.maxTokens ?? 2000,
      });
      const inputTokens = r.usage?.prompt_tokens ?? 0;
      const outputTokens = r.usage?.completion_tokens ?? 0;
      const cost = calcCost(tier, inputTokens, outputTokens);
      const response = r.choices[0]?.message?.content ?? '';
      this._usage.push({ model: tier, inputTokens, outputTokens, cost });
      this._traces.push({ model: tier, system: opts.system, user: opts.user, response, inputTokens, outputTokens, cost, durationMs: Date.now() - t0 });
      return response;
    }
    // Fallback to DashScope direct (works locally, not on GCP)
    return this.callDashscope(apiModel, tier, opts);
  }

  private async callDashscope(apiModel: string, tier: ModelTier, opts: LLMCall): Promise<string> {
    const t0 = Date.now();
    const r = await this.dashscope.chat.completions.create({
      model: apiModel,
      messages: [{ role: 'system', content: opts.system }, { role: 'user', content: opts.user }],
      temperature: 0.3,
    });
    const inputTokens = r.usage?.prompt_tokens ?? 0;
    const outputTokens = r.usage?.completion_tokens ?? 0;
    const cost = calcCost(tier, inputTokens, outputTokens);
    const response = r.choices[0]?.message?.content ?? '';
    this._usage.push({ model: tier, inputTokens, outputTokens, cost });
    this._traces.push({ model: tier, system: opts.system, user: opts.user, response, inputTokens, outputTokens, cost, durationMs: Date.now() - t0 });
    return response;
  }

  private async callGemini(apiModel: string, tier: ModelTier, opts: LLMCall): Promise<string> {
    const t0 = Date.now();
    const model = this.gemini.getGenerativeModel({ model: apiModel });
    const r = await model.generateContent({
      systemInstruction: opts.system,
      contents: [{ role: 'user', parts: [{ text: opts.user }] }],
      generationConfig: { maxOutputTokens: opts.maxTokens ?? 2000 },
    });
    const usage = r.response.usageMetadata;
    const inputTokens = usage?.promptTokenCount ?? 0;
    const outputTokens = usage?.candidatesTokenCount ?? 0;
    const cost = calcCost(tier, inputTokens, outputTokens);
    const response = r.response.text();
    this._usage.push({ model: tier, inputTokens, outputTokens, cost });
    this._traces.push({ model: tier, system: opts.system, user: opts.user, response, inputTokens, outputTokens, cost, durationMs: Date.now() - t0 });
    return response;
  }

  private async callTogether(apiModel: string, tier: ModelTier, opts: LLMCall): Promise<string> {
    const t0 = Date.now();
    const r = await Promise.race([
      this.together.chat.completions.create({
        model: apiModel, messages: [{ role: 'system', content: opts.system }, { role: 'user', content: opts.user }],
      }),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('Together.ai timeout (30s) — rate limit likely hit. Try V3 or R1.')), 30000)),
    ]);
    const inputTokens = r.usage?.prompt_tokens ?? 0;
    const outputTokens = r.usage?.completion_tokens ?? 0;
    const cost = calcCost(tier, inputTokens, outputTokens);
    const response = r.choices[0]?.message?.content ?? '';
    this._usage.push({ model: tier, inputTokens, outputTokens, cost });
    this._traces.push({ model: tier, system: opts.system, user: opts.user, response, inputTokens, outputTokens, cost, durationMs: Date.now() - t0 });
    return response;
  }

  private mockResponse(model: ModelTier): string {
    return JSON.stringify({ mocked: true, model, timestamp: Date.now() });
  }
}
