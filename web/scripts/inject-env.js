/**
 * inject-env.js — post-build: substitute env values into static HTML.
 *
 * The React bundle has its `import.meta.env.VITE_*` values inlined by Vite.
 * The static workbench / public HTML pages are copied verbatim, so they carry
 * a `__NL_API_KEY__` placeholder that we replace here from the environment
 * (or a local .env file). This keeps the real key out of source control while
 * still producing a working build.
 *
 * Runs after `vite build` (which copies workbench/ + public/ into dist/) and
 * before prerender. Fails the build loudly if a placeholder is present but no
 * key is configured, so we never ship a broken key.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DIST = join(ROOT, 'dist');
const PLACEHOLDER = '__NL_API_KEY__';

function readEnvKey() {
  if (process.env.VITE_NL_API_KEY) return process.env.VITE_NL_API_KEY;
  for (const name of ['.env.local', '.env']) {
    const p = join(ROOT, name);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf-8').split('\n')) {
      const m = line.match(/^\s*VITE_NL_API_KEY\s*=\s*(.+?)\s*$/);
      if (m) return m[1].replace(/^['"]|['"]$/g, '');
    }
  }
  return null;
}

function walkHtml(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walkHtml(p, out);
    else if (name.endsWith('.html')) out.push(p);
  }
  return out;
}

const key = readEnvKey();
const files = existsSync(DIST) ? walkHtml(DIST) : [];
let touched = 0;
let placeholderFiles = 0;

for (const f of files) {
  const html = readFileSync(f, 'utf-8');
  if (!html.includes(PLACEHOLDER)) continue;
  placeholderFiles++;
  if (!key) continue;
  writeFileSync(f, html.split(PLACEHOLDER).join(key));
  touched++;
}

if (placeholderFiles > 0 && !key) {
  console.error(
    `  ✗ inject-env: ${placeholderFiles} file(s) contain ${PLACEHOLDER} but VITE_NL_API_KEY is not set ` +
    `(env var or web/.env). Refusing to ship a broken key.`
  );
  process.exit(1);
}

console.log(`  ✓ inject-env: replaced ${PLACEHOLDER} in ${touched} file(s)`);
