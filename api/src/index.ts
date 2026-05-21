import 'dotenv/config';
import { createApp } from './app.js';

const app = createApp();

// Local dev mode — start Fastify directly
const port = Number(process.env.PORT ?? 5400);
app.listen({ port, host: '0.0.0.0' }).then(() => {
  app.log.info(`NewLeaf API listening on :${port} (env: ${process.env.NODE_ENV ?? 'development'})`);
});
