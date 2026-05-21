/**
 * Prerender script — generates static HTML for public routes.
 *
 * Runs after `vite build`. Spins up a local server, visits each
 * route in headless Chrome, captures the fully-rendered DOM,
 * and writes it back to dist/ so crawlers see real content.
 */
import { createServer } from 'http';
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import puppeteer from 'puppeteer';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DIST = join(__dirname, '..', 'dist');
const PORT = 4173;

// All public routes to prerender
// Only prerender static content pages (blogs, product pages, simple pages).
// Interactive pages with charts/canvas/sliders are left as SPA — React
// handles them client-side, which avoids breaking JS asset loading.
const ROUTES = [
  '/',
  '/desk',
  '/quant',
  '/blog',
  '/blog/iron-condor-strategy-explained',
  '/blog/options-greeks-explained',
  '/blog/selling-options-for-income',
  '/blog/position-sizing-framework',
  '/blog/implied-volatility-rank-explained',
  '/blog/covered-call-vs-cash-secured-put',
  '/blog/common-options-trading-mistakes',
  '/blog/weekly-options-income-plan',
];

// Simple static file server with SPA fallback
function startServer() {
  const fallback = readFileSync(join(DIST, 'index.html'));
  const MIME = {
    '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
    '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
    '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
    '.woff': 'font/woff', '.ttf': 'font/ttf',
  };

  const server = createServer((req, res) => {
    const urlPath = req.url.split('?')[0];
    let filePath = join(DIST, urlPath);

    // If path is a directory, try index.html inside it
    if (existsSync(filePath) && statSync(filePath).isDirectory()) {
      filePath = join(filePath, 'index.html');
    }

    if (existsSync(filePath) && !statSync(filePath).isDirectory()) {
      const ext = '.' + filePath.split('.').pop();
      res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
      res.end(readFileSync(filePath));
    } else {
      // SPA fallback
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(fallback);
    }
  });

  return new Promise(resolve => server.listen(PORT, () => resolve(server)));
}

async function prerender() {
  console.log('  prerendering', ROUTES.length, 'routes...');

  const server = await startServer();
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  let success = 0;
  let failed = 0;

  for (const route of ROUTES) {
    try {
      const page = await browser.newPage();

      // Block external requests (fonts, analytics, firebase) to speed up rendering
      await page.setRequestInterception(true);
      page.on('request', req => {
        const url = req.url();
        if (
          url.includes('googleapis.com') ||
          url.includes('gstatic.com') ||
          url.includes('googletagmanager.com') ||
          url.includes('firebase') ||
          url.includes('google-analytics')
        ) {
          req.abort();
        } else {
          req.continue();
        }
      });

      await page.goto(`http://localhost:${PORT}${route}`, {
        waitUntil: 'networkidle0',
        timeout: 15000,
      });

      // Wait a moment for React to finish rendering
      await page.waitForSelector('#root > *', { timeout: 10000 });

      // Get the full rendered HTML
      const html = await page.content();

      // Determine output path
      const outDir = route === '/'
        ? DIST
        : join(DIST, route);
      const outFile = route === '/'
        ? join(DIST, 'index.html')
        : join(outDir, 'index.html');

      if (route !== '/') {
        mkdirSync(outDir, { recursive: true });
      }

      writeFileSync(outFile, html);
      success++;
      process.stdout.write(`  ✓ ${route}\n`);

      await page.close();
    } catch (err) {
      failed++;
      process.stdout.write(`  ✗ ${route} — ${err.message}\n`);
    }
  }

  await browser.close();
  server.close();
  console.log(`  prerender done: ${success} ok, ${failed} failed`);
}

prerender().catch(err => {
  console.error('Prerender failed:', err);
  process.exit(1);
});
