/**
 * Local test: compare qwen-max vs qwen3.5-plus-2026-02-15
 * Run: node scripts/test-qwen-models.js
 */
import 'dotenv/config';
import OpenAI from 'openai';

const DASHSCOPE_KEY = process.env.DASHSCOPE_API_KEY;
if (!DASHSCOPE_KEY) {
  console.error('Missing DASHSCOPE_API_KEY in .env.local');
  process.exit(1);
}

const client = new OpenAI({
  apiKey: DASHSCOPE_KEY,
  baseURL: 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1',
  timeout: 60_000,
});

const MODELS = ['qwen-max', 'qwen3.5-plus-2026-02-15'];

const PROMPT = {
  system: 'You are a concise market analyst. Respond with exactly one sentence.',
  user: 'Given AAPL at $195, IV rank 45, RSI 55, ADX 22, trend neutral: produce one sentence market read.',
};

async function testModel(model, extraBody) {
  const t0 = Date.now();
  try {
    const params = {
      model,
      messages: [
        { role: 'system', content: PROMPT.system },
        { role: 'user', content: PROMPT.user },
      ],
      max_tokens: 200,
    };
    if (extraBody) params.extra_body = extraBody;

    const r = await client.chat.completions.create(params);
    const ms = Date.now() - t0;
    const msg = r.choices[0]?.message;
    const text = msg?.content || '';
    const thinking = msg?.reasoning_content || '';
    const input = r.usage?.prompt_tokens || 0;
    const output = r.usage?.completion_tokens || 0;
    console.log(`\n✅ ${model}`);
    console.log(`   Time: ${ms}ms`);
    console.log(`   Tokens: ${input} in / ${output} out`);
    if (thinking) console.log(`   Thinking: ${thinking.slice(0, 200)}...`);
    console.log(`   Response: ${text.slice(0, 150)}...`);
    return { model, ms, input, output, text, ok: true };
  } catch (err) {
    const ms = Date.now() - t0;
    console.log(`\n❌ ${model} FAILED (${ms}ms): ${err.message}`);
    return { model, ms, ok: false, error: err.message };
  }
}

async function run() {
  console.log('Testing Qwen models against DashScope...\n');

  // Test all models
  await testModel('qwen-turbo');
  await testModel('qwen-plus');
  await testModel('qwen-max');
  await testModel('qwen3-max');
  await testModel('qwen3.7-max');
  await testModel('qwq-plus');
  await testModel('qwen3.5-plus-2026-02-15');

  console.log('\n\nDone.');
}

run();
