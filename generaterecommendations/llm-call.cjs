'use strict';

/**
 * llm-call.cjs — Call the LLM router via HTTP instead of Claude CLI.
 *
 * Replaces spawnSync('claude', [...]) calls in genrecs scripts.
 * Routes through api/src/llm/router.ts for cost tracking and
 * model selection. Returns the raw text response.
 *
 * Default model: claude-sonnet (configurable via GENRECS_LLM_MODEL env var).
 */

const API_BASE_URL = process.env.NEWLEAF_API_URL || 'http://localhost:5400';
const API_KEY = process.env.NEWLEAF_API_KEY || 'dev-key';
const DEFAULT_MODEL = process.env.GENRECS_LLM_MODEL || 'claude-sonnet';

/**
 * Call the LLM router with a system + user prompt.
 * @param {string} prompt — the user message
 * @param {object} [opts]
 * @param {string} [opts.system] — system prompt (default: generic analyst)
 * @param {string} [opts.model] — model tier override (default: GENRECS_LLM_MODEL or claude-sonnet)
 * @param {number} [opts.maxTokens] — max output tokens (default: 4000)
 * @returns {Promise<string>} raw text response
 */
async function callLLM(prompt, opts = {}) {
  const model = opts.model || DEFAULT_MODEL;
  const system = opts.system || 'You are a professional options analyst. Return only valid JSON.';
  const maxTokens = opts.maxTokens || 4000;

  const url = `${API_BASE_URL}/api/llm/call`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 300000); // 5 min

  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': API_KEY },
      body: JSON.stringify({ model, system, user: prompt, maxTokens }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`callLLM: request timed out after 300s`);
    }
    throw new Error(`callLLM: network error — ${err.message}`);
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`callLLM: API returned ${res.status} ${res.statusText} — ${body}`);
  }

  let body;
  try {
    body = await res.json();
  } catch {
    throw new Error(`callLLM: malformed JSON response`);
  }

  if (!body.response) {
    throw new Error(`callLLM: response missing 'response' field`);
  }

  // Log cost if available
  if (body.cost?.totalCost > 0) {
    console.log(`     [LLM] ${body.model}: $${body.cost.totalCost.toFixed(4)} (${body.cost.totalInputTokens}in/${body.cost.totalOutputTokens}out)`);
  }

  return body.response;
}

module.exports = { callLLM, DEFAULT_MODEL };
