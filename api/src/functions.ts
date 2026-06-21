/**
 * Firebase Cloud Functions v2 entry point.
 * Secrets are only available inside the request handler, so we
 * defer app creation until the first request arrives.
 *
 * Cloud Functions pre-parse the body, so we use fastify.inject()
 * instead of emitting raw requests (which hangs on body parsing).
 */
import { onRequest } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');
const OPENAI_API_KEY = defineSecret('OPENAI_API_KEY');
const XAI_API_KEY = defineSecret('XAI_API_KEY');
const DEEPSEEK_API_KEY = defineSecret('DEEPSEEK_API_KEY');
const TOGETHER_API_KEY = defineSecret('TOGETHER_API_KEY');
const DASHSCOPE_API_KEY = defineSecret('DASHSCOPE_API_KEY');
const ALPACA_API_KEY = defineSecret('ALPACA_API_KEY');
const ALPACA_SECRET_KEY = defineSecret('ALPACA_SECRET_KEY');
const SERPER_API_KEY = defineSecret('SERPER_API_KEY');
const SENTIMENT_GROK_API_KEY = defineSecret('SENTIMENT_GROK_API_KEY');
const SENTIMENT_GEMINI_API_KEY = defineSecret('SENTIMENT_GEMINI_API_KEY');
const QWEN_PROXY_URL = defineSecret('QWEN_PROXY_URL');

let appReady: Promise<any> | null = null;

function getApp() {
  if (!appReady) {
    appReady = (async () => {
      const { initFirebase } = await import('./lib/firebase.js');
      const { createApp } = await import('./app.js');
      initFirebase();
      const app = createApp();
      await app.ready();
      return app;
    })();
  }
  return appReady;
}

export const api = onRequest(
  {
    timeoutSeconds: 540,
    memory: '1GiB',
    region: 'us-central1',
    secrets: [
      ANTHROPIC_API_KEY, OPENAI_API_KEY, XAI_API_KEY,
      DEEPSEEK_API_KEY, TOGETHER_API_KEY, DASHSCOPE_API_KEY,
      ALPACA_API_KEY, ALPACA_SECRET_KEY, SERPER_API_KEY,
      SENTIMENT_GROK_API_KEY, SENTIMENT_GEMINI_API_KEY,
      QWEN_PROXY_URL,
    ],
  },
  async (req, res) => {
    try {
      const app = await getApp();

      // Cloud Functions pre-parse the body, so we use fastify.inject()
      // to avoid the body-stream-already-consumed hang.
      // Clone headers, removing content-length since Cloud Functions pre-parses
      // the body and re-stringifying may change the size
      const hdrs = { ...req.headers };
      delete hdrs['content-length'];
      delete hdrs['transfer-encoding'];

      const injectOpts: any = {
        method: req.method as any,
        url: req.url,
        headers: hdrs,
      };

      // Pass the pre-parsed body for POST/PUT/PATCH
      if (req.body !== undefined && ['POST', 'PUT', 'PATCH'].includes(req.method)) {
        injectOpts.payload = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
      }

      const response = await app.inject(injectOpts);

      res.status(response.statusCode);
      for (const [key, value] of Object.entries(response.headers)) {
        if (value !== undefined) res.setHeader(key, value as string);
      }
      res.send(response.body);
    } catch (err: any) {
      console.error('[Functions] Request handler error:', err);
      res.status(500).json({ error: err.message, stack: err.stack?.split('\n').slice(0, 5) });
    }
  },
);
