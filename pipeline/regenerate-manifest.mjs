/**
 * regenerate-manifest.mjs — Authoritative rebuild of reports/manifest.json.
 * ─────────────────────────────────────────────────────────────────────────────
 * The manifest was maintained by upsertManifest()'s non-atomic read-modify-write,
 * which races across concurrent pipeline runs and silently drops symbols — it got
 * stuck listing the old ~111 watchlist even though all 297 reports exist on R2.
 *
 * This rebuilds the manifest in one shot from the watchlist + each symbol's R2
 * report + company-metadata (sector/marketcap), then writes local + uploads to R2.
 *
 * Usage:  node regenerate-manifest.mjs [--dry]
 * ─────────────────────────────────────────────────────────────────────────────
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const read = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8'));

const cfg = read('config.json');
const wl = read('watchlist.json');
const meta = read('company-metadata.json');
const base = cfg.r2.publicBaseUrl;
const DRY = process.argv.includes('--dry');
const CONC = 12;

const symbols = (Array.isArray(wl) ? wl : wl.symbols).map(s => (typeof s === 'string' ? s : s.symbol)).filter(Boolean);

const TIER_LABEL = { mega: 'Mega Cap', large: 'Large Cap', mid: 'Mid Cap', small: 'Small Cap', etf: 'ETF/Index' };
const TIER_OQ = { mega: 5, large: 5, mid: 4, small: 3, etf: 5 };

async function fetchReport(sym) {
  try {
    const r = await fetch(`${base}/reports/${sym}/latest.json`, { signal: AbortSignal.timeout(15000) });
    if (!r.ok) return null;
    return await r.json();
  } catch { return null; }
}

function buildRow(sym, rep) {
  const m = meta[sym] || {};
  const tier = m.marketCapTier || null;
  const sc = rep.scoring || {};
  const strat = sc.strategy || {};
  return {
    symbol: sym,
    sector: m.sector || null,
    marketCapTier: tier,
    marketCapLabel: tier ? (TIER_LABEL[tier] || tier) : null,
    optionsQuality: tier ? (TIER_OQ[tier] || 3) : 3,
    hasOptions: sc.hasOptions ?? !!rep.gammaData,
    opportunityScore: sc.opportunityScore ?? 0,
    direction: sc.direction ?? null,
    strategy: strat.name ?? null,
    strategyCode: strat.code ?? null,
    strategyIcon: strat.icon ?? null,
    price: rep.snapshot?.price ?? null,
    changePercent: rep.snapshot?.changePercent ?? null,
    iv: rep.gammaData?.ivData?.atmIv ?? null,
    url: `${base}/reports/${sym}/latest.json`,
    date: rep.meta?.generatedAt || rep.meta?.asOf || null,
  };
}

const rows = [];
const missing = [];
for (let i = 0; i < symbols.length; i += CONC) {
  const batch = symbols.slice(i, i + CONC);
  const reps = await Promise.all(batch.map(fetchReport));
  batch.forEach((sym, j) => { if (reps[j]) rows.push(buildRow(sym, reps[j])); else missing.push(sym); });
  process.stdout.write(`\r  fetched ${Math.min(i + CONC, symbols.length)}/${symbols.length}`);
}
console.log();

rows.sort((a, b) => (b.opportunityScore || 0) - (a.opportunityScore || 0));
const manifest = {
  updatedAt: new Date().toISOString(),
  totalReports: rows.length,
  reports: rows,
  symbols: rows.map(r => r.symbol),
  count: rows.length,
};

console.log(`Watchlist: ${symbols.length} · reports found: ${rows.length} · missing report: ${missing.length}`);
if (missing.length) console.log(`  no report yet: ${missing.slice(0, 25).join(', ')}${missing.length > 25 ? ` …(+${missing.length - 25})` : ''}`);

if (DRY) { console.log('DRY RUN — nothing written.'); process.exit(0); }

const localPath = path.join(__dirname, 'reports', 'manifest.json');
fs.mkdirSync(path.dirname(localPath), { recursive: true });
fs.writeFileSync(localPath, JSON.stringify(manifest));
console.log(`Wrote local: ${localPath}`);

const client = new S3Client({ region: 'auto', endpoint: cfg.r2.endpoint, credentials: { accessKeyId: cfg.r2.accessKeyId, secretAccessKey: cfg.r2.secretAccessKey } });
await client.send(new PutObjectCommand({ Bucket: cfg.r2.bucket, Key: 'reports/manifest.json', Body: JSON.stringify(manifest), ContentType: 'application/json', CacheControl: 'public, max-age=300' }));
console.log(`✓ Uploaded to R2: reports/manifest.json (${rows.length} reports)`);
