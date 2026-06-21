/**
 * apply-reaction-gate.mjs — apply the Step 1 reaction gate to existing R2 reports.
 * ─────────────────────────────────────────────────────────────────────────────
 * Reprocesses each report in place using its OWN candles + gamma walls (no Alpaca/
 * Nasdaq calls, no rate limits, no scheduler conflict): if the gamma pick is neutral
 * and price is testing a strong tested rail, promote scoring.strategy/direction to the
 * aligned directional spread, then re-upload latest.json. Mirrors the API gate exactly.
 *
 * Usage: node apply-reaction-gate.mjs [--dry]
 * ─────────────────────────────────────────────────────────────────────────────
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const { computeReactionRails, applyReactionGate } = require('./reaction-gate.cjs');
const { STRATEGIES } = require('./strategy-engine.js');
const cfg = require('./config.json');
const base = cfg.r2.publicBaseUrl;
const DRY = process.argv.includes('--dry');
const CONC = 10;

const manifest = await (await fetch(`${base}/reports/manifest.json?cb=${process.pid}`)).json();
const symbols = (manifest.symbols && manifest.symbols.length ? manifest.symbols : (manifest.reports || []).map(r => r.symbol)).filter(Boolean);

const client = new S3Client({ region: 'auto', endpoint: cfg.r2.endpoint, credentials: { accessKeyId: cfg.r2.accessKeyId, secretAccessKey: cfg.r2.secretAccessKey } });

async function fetchReport(sym) {
  try { const r = await fetch(`${base}/reports/${sym}/latest.json`, { signal: AbortSignal.timeout(15000) }); return r.ok ? await r.json() : null; } catch { return null; }
}

const promoted = [];
let scanned = 0, errors = 0;

async function processOne(sym) {
  const rep = await fetchReport(sym);
  if (!rep || !rep.scoring?.strategy?.code) { errors++; return; }
  scanned++;
  const fromCode = rep.scoring.strategy.code;
  let rails;
  try { rails = computeReactionRails(rep); } catch { return; }
  const gate = applyReactionGate(fromCode, rails);
  if (!gate) return;

  // Promote: swap strategy + direction, keep a breadcrumb of the original gamma pick.
  rep.scoring.gammaStrategy = fromCode;
  rep.scoring.strategy = { ...STRATEGIES[gate.strategy] };
  rep.scoring.direction = gate.direction;
  rep.scoring.reactionPromoted = true;
  rep.scoring.reactionNote = gate.note;
  promoted.push({ sym, from: fromCode, to: gate.strategy, note: gate.note });

  if (!DRY) {
    await client.send(new PutObjectCommand({
      Bucket: cfg.r2.bucket, Key: `reports/${sym}/latest.json`,
      Body: JSON.stringify(rep), ContentType: 'application/json', CacheControl: 'public, max-age=300',
    }));
  }
}

for (let i = 0; i < symbols.length; i += CONC) {
  await Promise.all(symbols.slice(i, i + CONC).map(processOne));
  process.stdout.write(`\r  scanned ${Math.min(i + CONC, symbols.length)}/${symbols.length} · promoted ${promoted.length}`);
}
console.log();
console.log(`Scanned ${scanned} reports · ${errors} errors · PROMOTED ${promoted.length}${DRY ? ' (DRY RUN — not uploaded)' : ' (re-uploaded)'}`);
for (const p of promoted.slice(0, 40)) console.log(`  ${p.sym}: ${p.from} → ${p.to} (${p.note})`);
if (promoted.length > 40) console.log(`  …(+${promoted.length - 40} more)`);
