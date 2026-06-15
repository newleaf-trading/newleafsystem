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

const jobLock = require('./lib/jobLock.cjs');
const jobStatus = require('./lib/jobStatus.cjs');

const ONCE = process.argv.includes('--once');
const NEWLEAF_DIR = path.resolve(__dirname, '..');
const NODE_BIN = process.execPath;
const SERVER_PORT = 3000;
const DAILY_OI_STAMP = path.join(__dirname, '.daily-oi-stamp');
const DAILY_FUNNEL_STAMP = path.join(__dirname, '.daily-funnel-stamp');
let serverProc = null;
let caffeinateProc = null;
let fastPipelineRunning = false;

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
// Market hours via true ET wall-clock — no manual DST math, robust to the machine's timezone.
const ET_TZ = 'America/New_York';
function isMarketHours() {
  const et = new Date(new Date().toLocaleString('en-US', { timeZone: ET_TZ }));
  if (et.getDay() === 0 || et.getDay() === 6) return false;
  const total = et.getHours() * 60 + et.getMinutes();
  return total >= 9 * 60 + 30 && total < 16 * 60; // 9:30am–4:00pm ET
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
  if (!fs.existsSync(snapshotScript)) throw new Error(`weekly-premium-snapshot.js not found at ${snapshotScript}`);
  await runJob('../generaterecommendations/weekly-premium-snapshot.js');
  markWeeklySnapDone();
}

// Daily-OI sub-steps, tracked INDIVIDUALLY. Previously these were `.catch(console.error)`
// (swallowed) inside one 'daily-oi' job, so a failed sync hid behind a green status and the
// monitor never retried it. Now each step records its own status; the sequence skips any step
// that already succeeded today, so a monitor retry re-runs ONLY the failed step (not the whole
// ~20-min sequence) — and never re-hammers a step that already worked.
const DAILY_OI_STEPS = [
  { name: 'daily-oi-enrich', script: 'pipeline-oi-enrichment.js',     args: ['--watchlist'] },
  { name: 'daily-watchlist', script: 'pipeline-watchlist.js',         args: [] },
  { name: 'daily-sync',      script: 'sync-r2-to-firestore-fixed.mjs', args: [] },
];
const dailyOIAllDone = () => DAILY_OI_STEPS.every(s => jobStatus.ranOkToday(s.name));

async function runDailyOISequence() {
  if (!jobLock.acquire('daily-oi')) {
    console.log(`[${nowET()}] Daily OI already running (locked), skipping`);
    return;
  }
  try {
    console.log(`[${nowET()}] === Daily OI Enrichment Sequence ===`);
    for (const step of DAILY_OI_STEPS) {
      if (jobStatus.ranOkToday(step.name)) {
        console.log(`[${nowET()}] ${step.name} already ok today — skipping`);
        continue;
      }
      await track(step.name, () => runJob(step.script, step.args));
    }
    if (dailyOIAllDone()) markDailyOIDone();
    console.log(`[${nowET()}] === Daily sequence complete (${DAILY_OI_STEPS.filter(s => jobStatus.ranOkToday(s.name)).length}/${DAILY_OI_STEPS.length} ok) ===`);
  } finally {
    jobLock.release('daily-oi');
  }
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

// ── Job status tracking + missed-job monitor ──────────────────────────────────
// Wrap any job so its success/failure/duration is recorded to pipeline-status/jobs.json.
async function track(name, fn) {
  const start = Date.now();
  try {
    await fn();
    await jobStatus.record(name, { ok: true, durationSec: +((Date.now() - start) / 1000).toFixed(1) });
  } catch (err) {
    await jobStatus.record(name, { ok: false, durationSec: +((Date.now() - start) / 1000).toFixed(1), error: err.message });
    console.error(`[${nowET()}] ${name} FAILED: ${err.message}`);
  }
}

async function runDailyFunnel() {
  console.log(`[${nowET()}] === Daily Funnel: Rank → Price → Publish ===`);
  const funnelScript = path.join(NEWLEAF_DIR, 'generaterecommendations', 'funnel-price.cjs');
  if (!fs.existsSync(funnelScript)) throw new Error(`funnel-price.cjs not found at ${funnelScript}`);
  await runJob('../generaterecommendations/funnel-price.cjs');
  fs.writeFileSync(DAILY_FUNNEL_STAMP, todayET());
}

async function runEventCalendar() {
  console.log(`[${nowET()}] === Event Calendar Refresh (Yahoo + FMP ex-div) ===`);
  const script = path.join(NEWLEAF_DIR, 'scripts', 'refresh-event-calendar.js');
  if (!fs.existsSync(script)) throw new Error(`refresh-event-calendar.js not found at ${script}`);
  await runJob('../scripts/refresh-event-calendar.js');
}

// Registry the scheduled cron handlers AND the monitor both drive. etMin = minutes past ET midnight.
const SCHEDULED_JOBS = [
  { name: 'daily-oi',        label: 'Daily OI + manifest + sync', cadence: 'daily',  etMin: 9 * 60 + 32,  marketDay: true, run: runDailyOISequence, done: dailyOIAllDone },
  { name: 'daily-funnel',    label: 'Daily funnel (publish picks)', cadence: 'daily', etMin: 10 * 60,      marketDay: true, run: runDailyFunnel },
  { name: 'event-calendar',  label: 'Event calendar refresh',     cadence: 'daily',  etMin: 16 * 60 + 15, marketDay: true, run: runEventCalendar },
  { name: 'weekly-snapshot', label: 'Weekly premium snapshot',    cadence: 'weekly', dow: 5, etMin: 16 * 60 + 30,            run: runWeeklySnapshot },
];

// Monitor: re-run any daily/weekly job that is past its scheduled time and hasn't succeeded
// (today / this week). Runs from the 5-min health check, so a job missed because the machine
// was asleep gets started automatically.
async function catchUpMissed() {
  const et = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const dow = et.getDay(); // 0=Sun … 6=Sat
  const mins = et.getHours() * 60 + et.getMinutes();
  const isWeekday = dow >= 1 && dow <= 5;
  for (const j of SCHEDULED_JOBS) {
    if (j.cadence === 'daily') {
      if (j.marketDay && !isWeekday) continue;
      if (mins < j.etMin) continue;
      // `done` (composite jobs like daily-oi) lets the monitor retry when ANY sub-step
      // failed, even if the wrapper "ran"; the sequence then re-runs only the failed step.
      const isDone = j.done ? j.done() : jobStatus.ranOkToday(j.name);
      if (isDone) continue;
      console.log(`[${nowET()}] Monitor: ${j.name} incomplete today — starting catch-up`);
      await track(j.name, j.run);
    } else if (j.cadence === 'weekly') {
      const dueNow = dow > j.dow || (dow === j.dow && mins >= j.etMin) || dow === 0; // Fri-eve → Sun
      if (!dueNow) continue;
      if (jobStatus.ranOkThisWeek(j.name)) continue;
      console.log(`[${nowET()}] Monitor: ${j.name} missed this week — starting catch-up`);
      await track(j.name, j.run);
    }
  }
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

  // All schedules run in true ET via node-cron's timezone option — no UK-local / DST hacks.
  const TZ = { timezone: ET_TZ };

  // Fast pipeline: every 15 min, Mon-Fri, market hours only
  cron.schedule('*/15 * * * 1-5', async () => {
    if (!isMarketHours()) return;
    if (fastPipelineRunning) { console.log(`[${nowET()}] Fast pipeline still running, skipping`); return; }
    fastPipelineRunning = true;
    try { await track('fast-pipeline', () => runJob('pipeline-fast.js', ['--watchlist'])); }
    finally { fastPipelineRunning = false; }
  }, TZ);

  // Daily OI enrichment + watchlist + Firestore sync: 9:32am ET
  cron.schedule('32 9 * * 1-5', async () => {
    if (dailyOIAllDone()) return;
    await track('daily-oi', runDailyOISequence);
  }, TZ);

  // Pre-market service check: 9:25am ET — ensure services are up before daily jobs
  cron.schedule('25 9 * * 1-5', async () => {
    console.log(`[${nowET()}] === Pre-market service check ===`);
    await ensureServer().catch(console.error);
  }, TZ);

  // Daily funnel: rank scanner signals → price top N → publish to tiles. 10:00am ET.
  cron.schedule('0 10 * * 1-5', async () => {
    if (jobStatus.ranOkToday('daily-funnel')) return;
    await track('daily-funnel', runDailyFunnel);
  }, TZ);

  // Event calendar refresh (Yahoo earnings + FMP ex-div): daily after market close, 4:15pm ET.
  cron.schedule('15 16 * * 1-5', async () => {
    if (jobStatus.ranOkToday('event-calendar')) return;
    await track('event-calendar', runEventCalendar);
  }, TZ);

  // Canonical weekly premium snapshot: Fridays at 4:30pm ET.
  cron.schedule('30 16 * * 5', async () => {
    if (jobStatus.ranOkThisWeek('weekly-snapshot')) return;
    await track('weekly-snapshot', runWeeklySnapshot);
  }, TZ);

  // Health check: every 5 min — restart down services + monitor (re-run any missed daily/weekly job).
  cron.schedule('*/5 * * * *', async () => {
    if (!(await isServerRunning())) {
      console.log(`[${nowET()}] server.cjs down, restarting...`);
      await ensureServer().catch(console.error);
    }
    // Monitor: start any daily/weekly job that's past its scheduled time and hasn't succeeded.
    await catchUpMissed().catch(e => console.error(`[${nowET()}] monitor error:`, e.message));

    // Run health check script (pipeline freshness, R2 status)
    const healthScript = path.join(__dirname, 'check-scheduler-health.sh');
    if (fs.existsSync(healthScript)) {
      spawn('bash', [healthScript], { cwd: __dirname, stdio: 'inherit' });
    }
  }, TZ);

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
  console.log('║  Pre-market:      9:25am ET (ensure services up)            ║');
  console.log('║  Daily OI+sync:   9:32am ET (Mon-Fri)                      ║');
  console.log('║  Daily funnel:     10:00am ET (rank→price→publish)         ║');
  console.log('║  Event calendar:   4:15pm ET (Yahoo earn + FMP ex-div)     ║');
  console.log('║  Weekly snapshot:  Fri 4:30pm ET (canonical premium+catchup)║');
  console.log('║  Health check:    */5 min (auto-restarts + missed catchup)║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`  Current time: ${nowET()}`);
  console.log(`  Market open:  ${isMarketHours() ? 'YES' : 'NO'}`);
  console.log('');
}
