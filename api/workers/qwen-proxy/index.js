/**
 * Cloudflare Worker — Qwen/DashScope proxy
 * Forwards OpenAI-compatible requests to DashScope (unreachable from GCP).
 * The Authorization header passes through (DashScope API key).
 */
const DASHSCOPE_URL = 'https://dashscope-intl.aliyuncs.com/compatible-mode/v1';

export default {
  async fetch(request) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Only proxy POST requests
    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
    }

    // Forward the path (e.g., /chat/completions → DashScope /v1/chat/completions)
    const url = new URL(request.url);
    const targetUrl = DASHSCOPE_URL + url.pathname;

    const body = await request.text();

    const resp = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': request.headers.get('Authorization') || '',
      },
      body,
    });

    const respBody = await resp.text();

    return new Response(respBody, {
      status: resp.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  },
};
