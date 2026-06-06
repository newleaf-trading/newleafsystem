#!/usr/bin/env node
/**
 * NewLeaf Pipeline — In-Process Scheduler
 * ─────────────────────────────────────────────────────────────────────────────
 * Replaces system crontab with node-cron. Runs all data collection on schedule.
 *
 * Schedule (all times ET, Mon-Fri):
 *   - Fast pipeline:  every 15 min, 9:30am-4:00pm (market hours)
 *   - Daily OI+sync:  9:32am (once per day)
 *   - Health check:   every 5 min (always)
 *
 * Usage:
 *   node index.js            # start scheduler (production)
 *   node index.js --once     # run fast pipeline once and exit
 */

'use strict';

require('dotenv').config();
const cron = require('node-cron');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ONCE = process.argv.includes('--once');
const NEWLEAF_DIR = path.resolve(__dirname, '..');
const NODE_BIN = process.execPath;
const SERVER_PORT = 3000;
const DAILY_OI_STAMP = path.join(__dirname, '.daily-oi-stamp');
let serverProc = null;
let caffeinateProc = null;

// ── server.cjs management ────────────────────────────────────────────────────
async function isServerRunning() {
  try {
    const res = await fetch(`http://localhost:${SERVER_PORT}`, { signal: AbortSignal.timeout(3000) });
    return res.ok || res.status === 304;
  } catch(_) { return false; }
}

async function ensureServer() {
  if (await isServerRunning()) return true;

  const serverFile = path.join(NEWLEAF_DIR, 'server.cjs');
  if (!fs.existsSync(serverFile)) {
    console.error(`[${nowET()}] server.cjs not found at ${serverFile}`);
    return false;
  }

  console.log(`[${nowET()}] Starting server.cjs on port ${SERVER_PORT}...`);
  serverProc = spawn(NODE_BIN, ['server.cjs'], {
    cwd: NEWLEAF_DIR,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  serverProc.stdout.on('data', (d) => {
    const line = d.toString().trim();
    if (line) console.log(`[server.cjs] ${line}`);
  });
  serverProc.stderr.on('data', (d) => {
    const line = d.toString().trim();
    if (line) console.error(`[server.cjs] ${line}`);
  });
  serverProc.on('exit', (code) => {
    console.log(`[${nowET()}] server.cjs exited (code ${code})`);
    serverProc = null;
  });

  // Wait up to 10s
  for (let i = 0; i < 20; i++) {
    await new Promise(r => setTimeout(r, 500));
    if (await isServerRunning()) {
      console.log(`[${nowET()}] server.cjs started successfully`);
      return true;
    }
  }
  console.error(`[${nowET()}] server.cjs failed to start within 10s`);
  return false;
}

// ── Yahoo svc ────────────────────────────────────────────────────────────────
// Yahoo Options Service is deployed as a Firebase Cloud Function (2nd gen).
// URL configured in config.json → yahoosvc.url
// Source code kept in yahoo-svc/ for redeployment: firebase deploy --only functions

// ── Market hours check (ET) ───────────────────────────────────────────────────
function isDST(date) {
  const jan = new Date(date.getFullYear(), 0, 1).getTimezoneOffset();
  const jul = new Date(date.getFullYear(), 6, 1).getTimezoneOffset();
  return Math.min(jan, jul) === date.getTimezoneOffset();
}

function isMarketHours() {
  const now = new Date();
  const day = now.getDay();
  if (day === 0 || day === 6) return false;

  const etOffset = isDST(now) ? -4 : -5;
  const etHour = now.getUTCHours() + etOffset;
  const etMin = now.getUTCMinutes();
  const etTotal = etHour * 60 + etMin;

  return etTotal >= 9 * 60 + 30 && etTotal < 16 * 60; // 9:30am-4:00pm ET
}

function nowET() {
  return new Date().toLocaleString('en-GB', { hour12: false, timeZone: 'America/New_York' }) + ' ET';
}

function todayET() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' }); // YYYY-MM-DD
}

function dailyOIRanToday() {
  try {
    const stamp = fs.readFileSync(DAILY_OI_STAMP, 'utf8').trim();
    return stamp === todayET();
  } catch { return false; }
}

function markDailyOIDone() {
  fs.writeFileSync(DAILY_OI_STAMP, todayET());
}

// ── Weekly premium snapshot catch-up ─────────────────────────────────────────
const WEEKLY_SNAP_STAMP = path.join(__dirname, '.weekly-snap-stamp');

function getISOWeekStr() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const jan4 = new Date(d.getFullYear(), 0, 4);
  const wk = 1 + Math.round(((d - jan4) / 86400000 - 3 + ((jan4.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(wk).padStart(2, '0')}`;
}

function weeklySnapRanThisWeek() {
  try {
    const stamp = fs.readFileSync(WEEKLY_SNAP_STAMP, 'utf8').trim();
    return stamp === getISOWeekStr();
  } catch { return false; }
}

function markWeeklySnapDone() {
  fs.writeFileSync(WEEKLY_SNAP_STAMP, getISOWeekStr());
}

async function runWeeklySnapshot() {
  console.log(`[${nowET()}] === Canonical Weekly Premium Snapshot ===`);
  const snapshotScript = path.join(NEWLEAF_DIR, 'generaterecommendations', 'weekly-premium-snapshot.js');
  if (fs.existsSync(snapshotScript)) {
    await runJob('../generaterecommendations/weekly-premium-snapshot.js').catch(console.error);
    markWeeklySnapDone();
  } else {
    console.error(`[${nowET()}] weekly-premium-snapshot.js not found at ${snapshotScript}`);
  }
}

async function runDailyOISequence() {
  console.log(`[${nowET()}] === Daily OI Enrichment Sequence ===`);
  await runJob('pipeline-oi-enrichment.js', ['--watchlist']).catch(console.error);
  await runJob('pipeline-watchlist.js').catch(console.error);
  await runJob('sync-r2-to-firestore-fixed.mjs').catch(console.error);
  markDailyOIDone();
  console.log(`[${nowET()}] === Daily sequence complete ===`);
}

// ── Job runner ────────────────────────────────────────────────────────────────
function runJob(script, args = []) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, script);
    const ext = path.extname(script);
    const cmd = ext === '.sh' ? 'bash' : 'node';
    const cmdArgs = ext === '.sh' ? [scriptPath, ...args] : [scriptPath, ...args];

    console.log(`[${nowET()}] Starting: ${script} ${args.join(' ')}`);
    const proc = spawn(cmd, cmdArgs, { cwd: __dirname, stdio: 'inherit' });

    proc.on('close', (code) => {
      if (code === 0) {
        console.log(`[${nowET()}] Completed: ${script}`);
        resolve();
      } else {
        console.error(`[${nowET()}] FAILED: ${script} (exit code ${code})`);
        reject(new Error(`${script} exited with code ${code}`));
      }
    });

    proc.on('error', (err) => {
      console.error(`[${nowET()}] ERROR spawning ${script}:`, err.message);
      reject(err);
    });
  });
}

// ── One-shot mode ─────────────────────────────────────────────────────────────
if (ONCE) {
  (async () => {
    console.log(`[${nowET()}] Running fast pipeline (one-shot mode)...`);
    await runJob('pipeline-fast.js', ['--watchlist']).catch(console.error);
    process.exit(0);
  })();
} else {
  // ── Scheduled mode ────────────────────────────────────────────────────────────

  // Prevent macOS idle sleep while scheduler runs — node-cron timers don't fire during sleep
  caffeinateProc = spawn('caffeinate', ['-i', '-w', String(process.pid)], {
    stdio: 'ignore', detached: true,
  });
  caffeinateProc.unref();
  console.log(`[${nowET()}] caffeinate started (PID ${caffeinateProc.pid}) — preventing idle sleep`);

  // Start services on scheduler boot
  ensureServer().catch(console.error);

  // Fast pipeline: every 15 min, Mon-Fri, market hours only
  cron.schedule('*/15 * * * 1-5', async () => {
    if (!isMarketHours()) return;
    await runJob('pipeline-fast.js', ['--watchlist']).catch(console.error);
  });

  // Daily OI enrichment + watchlist + Firestore sync: 9:32am ET
  // Using 13:32 UTC (summer) / 14:32 UTC (winter) — node-cron runs in local TZ
  // Since machine is in UK (BST/GMT), use 14:32 for BST (= 9:32 ET in summer)
  cron.schedule('32 14 * * 1-5', async () => {
    if (dailyOIRanToday()) return;
    await runDailyOISequence();
  });

  // Daily funnel: rank scanner signals → price top N → publish to tiles
  // 10:00am ET = 15:00 BST (summer) / 15:00 GMT (winter) — after market open, chains populated
  cron.schedule('0 15 * * 1-5', async () => {
    console.log(`[${nowET()}] === Daily Funnel: Rank → Price → Publish ===`);
    const funnelScript = path.join(NEWLEAF_DIR, 'generaterecommendations', 'funnel-price.cjs');
    if (fs.existsSync(funnelScript)) {
      await runJob('../generaterecommendations/funnel-price.cjs').catch(console.error);
    } else {
      console.error(`[${nowET()}] funnel-price.cjs not found at ${funnelScript}`);
    }
  });

  // Canonical weekly premium snapshot: Fridays at 4:30pm ET
  // 4:30pm ET = 21:30 BST (summer) / 21:30 GMT (winter) — both are cron '30 21'
  // because US and UK DST shifts cancel out (EDT→BST = EST→GMT = +5h)
  cron.schedule('30 21 * * 5', async () => {
    if (weeklySnapRanThisWeek()) return;
    await runWeeklySnapshot();
  });

  // Health check: every 5 min — auto-restart any down services
  // Also catches up daily OI if it was missed (e.g. machine was asleep at cron time)
  cron.schedule('*/5 * * * *', async () => {
    // Check and restart server.cjs if down
    if (!(await isServerRunning())) {
      console.log(`[${nowET()}] server.cjs down, restarting...`);
      await ensureServer().catch(console.error);
    }

    // Catch-up: if daily OI hasn't run today and market is open, run it now
    if (isMarketHours() && !dailyOIRanToday()) {
      console.log(`[${nowET()}] Daily OI missed (machine was likely asleep) — running catch-up`);
      await runDailyOISequence();
    }

    // Catch-up: weekly premium snapshot — if Friday or later and not yet captured this week
    const dayET = new Date().toLocaleDateString('en-US', { weekday: 'short', timeZone: 'America/New_York' });
    if (['Fri', 'Sat', 'Sun'].includes(dayET) && !weeklySnapRanThisWeek()) {
      console.log(`[${nowET()}] Weekly premium snapshot missed — running catch-up for ${getISOWeekStr()}`);
      await runWeeklySnapshot();
    }

    // Run health check script (pipeline freshness, R2 status)
    const healthScript = path.join(__dirname, 'check-scheduler-health.sh');
    if (fs.existsSync(healthScript)) {
      spawn('bash', [healthScript], { cwd: __dirname, stdio: 'inherit' });
    }
  });

  // Cleanup child processes on scheduler exit
  function cleanup() {
    if (caffeinateProc) { caffeinateProc.kill(); }
    if (serverProc) { console.log('Stopping server.cjs...'); serverProc.kill(); }
  }
  process.on('SIGINT', () => { console.log(''); cleanup(); process.exit(0); });
  process.on('SIGTERM', () => { cleanup(); process.exit(0); });

  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║         NewLeaf Pipeline Scheduler — Started                ║');
  console.log('╠══════════════════════════════════════════════════════════════╣');
  console.log('║  Services:        server.cjs (:3000)                        ║');
  console.log('║  Yahoo OI:        Firebase Cloud Function (remote)          ║');
  console.log('║  Fast pipeline:   */15 min (market hours, Mon-Fri)         ║');
  console.log('║  Pre-market:      9:25am ET (ensure all services up)       ║');
  console.log('║  Daily OI+sync:   9:32am ET (Mon-Fri)                      ║');
  console.log('║  Daily funnel:     10:00am ET (rank→price→publish)         ║');
  console.log('║  Weekly snapshot:  Fri 4:30pm ET (canonical premium+catchup)║');
  console.log('║  Health check:    */5 min (auto-restarts + missed catchup)║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`  Current time: ${nowET()}`);
  console.log(`  Market open:  ${isMarketHours() ? 'YES' : 'NO'}`);
  console.log('');
}
