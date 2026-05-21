#!/usr/bin/env node
/**
 * server.js — Local dev server for NewLeaf System
 * ─────────────────────────────────────────────────────────────────
 * Serves static files on http://localhost:3000
 * AND proxies /r2/* → Cloudflare R2 public bucket
 * so there are zero CORS issues in local development.
 *
 * Usage:
 *   node server.js
 *   node server.js --port 3001
 *
 * No npm install needed — uses Node 18+ built-ins only.
 * ─────────────────────────────────────────────────────────────────
 */

'use strict';

const http = require('http');
const fs   = require('fs');
const path = require('path');

const admin = require('firebase-admin');

const R2_BASE = 'https://pub-04bbb919022645b3a3f318b2ebdf48c0.r2.dev';
const PORT    = parseInt(process.argv.find(a => a.startsWith('--port='))?.split('=')[1] || '3000');

// ── Firebase init ──────────────────────────────────────────────────
const SA_PATH = path.join(__dirname, 'scanner', 'serviceAccountKey.json');
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: 'newleaf-trading',
    credential: admin.credential.cert(JSON.parse(fs.readFileSync(SA_PATH, 'utf-8')))
  });
}
const db = admin.firestore();
db.settings({ databaseId: 'newleafdb' });

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.json': 'application/json',
  '.png':  'image/png',
  '.ico':  'image/x-icon',
  '.svg':  'image/svg+xml',
};

const c = {
  green:  s => `\x1b[32m${s}\x1b[0m`,
  blue:   s => `\x1b[34m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  dim:    s => `\x1b[2m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  // ── POST /api/save-watchlist-snapshot ────────────────────────
  if (req.method === 'POST' && url.pathname === '/api/save-watchlist-snapshot') {
    let body = '';
    req.on('data', chunk => body += chunk.toString());
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        console.log(c.blue('  [API]') + ' Save watchlist snapshot: ' + c.dim(data.date + ' ' + data.expiryType));

        // Spawn the pipeline script
        const { spawn } = require('child_process');
        const scriptPath = path.join(__dirname, 'scanner', 'save-watchlist-snapshot.js');

        const proc = spawn('node', [scriptPath, data.expiryType, data.date], {
          cwd: path.join(__dirname, 'scanner')
        });

        let output = '';
        proc.stdout.on('data', d => output += d);
        proc.stderr.on('data', d => output += d);

        proc.on('close', code => {
          if (code === 0) {
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: true, message: 'Snapshot saved' }));
            console.log(c.green('  [API] ✓ Snapshot saved'));
          } else {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ success: false, error: output }));
            console.error(c.yellow('  [API] ✗ Snapshot failed: ' + output.slice(0, 200)));
          }
        });
      } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: err.message }));
        console.error(c.yellow('  [API] ✗ Invalid request: ' + err.message));
      }
    });
    return;
  }

  // ── GET /api/picks/performance/* ─────────────────────────────
  if (url.pathname.startsWith('/api/picks/performance/')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Content-Type', 'application/json');

    try {
      const snap = await db.collection('pick_outcomes').get();
      const all = snap.docs.map(d => d.data());

      if (url.pathname === '/api/picks/performance/summary') {
        const total = all.length;
        const wins = all.filter(p => p.outcome === 'WIN').length;
        const pnl = all.reduce((s, p) => s + (p.actualPnl || 0), 0);

        // Best week
        const weekMap = {};
        for (const p of all) {
          if (!weekMap[p.weekId]) weekMap[p.weekId] = { total: 0, wins: 0, pnl: 0 };
          weekMap[p.weekId].total++;
          if (p.outcome === 'WIN') weekMap[p.weekId].wins++;
          weekMap[p.weekId].pnl += (p.actualPnl || 0);
        }
        let bestWeek = null, bestWeekRate = 0;
        for (const [wk, s] of Object.entries(weekMap)) {
          const rate = s.wins / s.total;
          if (rate > bestWeekRate || (rate === bestWeekRate && s.pnl > (weekMap[bestWeek]?.pnl || 0))) {
            bestWeek = wk; bestWeekRate = rate;
          }
        }

        // Best month
        const monthMap = {};
        for (const p of all) {
          const m = p.weekStart?.slice(0, 7); // "2026-02"
          if (!monthMap[m]) monthMap[m] = { total: 0, wins: 0, pnl: 0 };
          monthMap[m].total++;
          if (p.outcome === 'WIN') monthMap[m].wins++;
          monthMap[m].pnl += (p.actualPnl || 0);
        }
        let bestMonth = null, bestMonthPnl = -Infinity;
        for (const [m, s] of Object.entries(monthMap)) {
          if (s.pnl > bestMonthPnl) { bestMonth = m; bestMonthPnl = s.pnl; }
        }

        // Win streak
        const sorted = [...all].sort((a, b) => (a.closedAtTs || '').localeCompare(b.closedAtTs || ''));
        let streak = 0, maxStreak = 0;
        for (const p of sorted) {
          if (p.outcome === 'WIN') { streak++; maxStreak = Math.max(maxStreak, streak); }
          else streak = 0;
        }

        res.writeHead(200);
        res.end(JSON.stringify({
          allTimeWinRate: total ? Math.round((wins / total) * 100) : 0,
          allTimePnl: pnl,
          totalPicks: total,
          totalWins: wins,
          bestWeek: bestWeek ? { weekId: bestWeek, winRate: Math.round(bestWeekRate * 100), ...weekMap[bestWeek] } : null,
          bestMonth: bestMonth ? { month: bestMonth, ...monthMap[bestMonth] } : null,
          winStreak: maxStreak
        }));
        return;
      }

      if (url.pathname === '/api/picks/performance/weekly') {
        const limit = parseInt(url.searchParams.get('limit') || '12');
        const filterWeek = url.searchParams.get('weekId');

        const weekMap = {};
        for (const p of all) {
          if (!weekMap[p.weekId]) weekMap[p.weekId] = {
            weekId: p.weekId, weekStart: p.weekStart, weekEnd: p.weekEnd,
            marketNote: p.marketNote, picks: []
          };
          weekMap[p.weekId].picks.push(p);
        }

        let weeks = Object.values(weekMap)
          .sort((a, b) => b.weekId.localeCompare(a.weekId));

        if (filterWeek) weeks = weeks.filter(w => w.weekId === filterWeek);

        weeks = weeks.slice(0, limit).map(w => {
          const wins = w.picks.filter(p => p.outcome === 'WIN').length;
          const partials = w.picks.filter(p => p.outcome === 'PARTIAL').length;
          const losses = w.picks.filter(p => p.outcome === 'LOSS').length;
          const netPnl = w.picks.reduce((s, p) => s + (p.actualPnl || 0), 0);
          return {
            ...w,
            weekStats: {
              total: w.picks.length, wins, partials, losses, netPnl,
              winRate: Math.round((wins / w.picks.length) * 100)
            }
          };
        });

        res.writeHead(200);
        res.end(JSON.stringify(weeks));
        return;
      }

      if (url.pathname === '/api/picks/performance/monthly') {
        const monthMap = {};
        for (const p of all) {
          const m = p.weekStart?.slice(0, 7);
          if (!monthMap[m]) monthMap[m] = { month: m, weeks: {} };
          if (!monthMap[m].weeks[p.weekId]) {
            monthMap[m].weeks[p.weekId] = {
              weekId: p.weekId, weekStart: p.weekStart, weekEnd: p.weekEnd, picks: []
            };
          }
          monthMap[m].weeks[p.weekId].picks.push(p);
        }

        const months = Object.values(monthMap)
          .sort((a, b) => a.month.localeCompare(b.month))
          .map(m => {
            const weeksArr = Object.values(m.weeks).sort((a, b) => a.weekId.localeCompare(b.weekId));
            const allPicks = weeksArr.flatMap(w => w.picks);
            const wins = allPicks.filter(p => p.outcome === 'WIN').length;
            const netPnl = allPicks.reduce((s, p) => s + (p.actualPnl || 0), 0);

            let bestWeek = null, bestRate = 0;
            const weeksWithStats = weeksArr.map(w => {
              const ww = w.picks.filter(p => p.outcome === 'WIN').length;
              const rate = ww / w.picks.length;
              if (rate > bestRate) { bestRate = rate; bestWeek = w.weekId; }
              return {
                weekId: w.weekId, weekStart: w.weekStart, weekEnd: w.weekEnd,
                total: w.picks.length,
                wins: ww,
                netPnl: w.picks.reduce((s, p) => s + (p.actualPnl || 0), 0),
                winRate: Math.round(rate * 100)
              };
            });

            return {
              month: m.month,
              year: parseInt(m.month.slice(0, 4)),
              weeks: weeksWithStats,
              monthStats: {
                totalPicks: allPicks.length, wins, netPnl,
                winRate: Math.round((wins / allPicks.length) * 100),
                bestWeek
              }
            };
          });

        res.writeHead(200);
        res.end(JSON.stringify(months));
        return;
      }

      res.writeHead(404);
      res.end(JSON.stringify({ error: 'Unknown performance endpoint' }));
    } catch (err) {
      console.error(c.yellow('  [API] Performance error: ' + err.message));
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    }
    return;
  }

  // ── /r2/* → proxy to Cloudflare R2 ───────────────────────────
  if (url.pathname.startsWith('/r2/')) {
    const r2Path = url.pathname.slice(3); // strip /r2
    const r2Url  = R2_BASE + r2Path;

    try {
      const r2Res = await fetch(r2Url);
      const body  = await r2Res.arrayBuffer();

      res.writeHead(r2Res.status, {
        'Content-Type':                r2Res.headers.get('content-type') || 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control':               'public, max-age=60',
      });
      res.end(Buffer.from(body));
      console.log(c.blue('  [R2]') + c.dim(' ') + c.dim(r2Path) + c.dim(' → ') + c.green(r2Res.status));
    } catch (err) {
      res.writeHead(502, { 'Content-Type': 'text/plain' });
      res.end('R2 proxy error: ' + err.message);
      console.error(c.yellow('  [R2 ERR] ' + r2Path + ': ' + err.message));
    }
    return;
  }

  // ── API proxy to api-gateway (for workbench) ──────────────────
  if (url.pathname.startsWith('/api/') || url.pathname === '/health') {
    try {
      const apiUrl = `http://localhost:4000${url.pathname}${url.search}`;
      const apiRes = await fetch(apiUrl, {
        method: req.method,
        headers: { 'Content-Type': 'application/json' },
      });
      const body = await apiRes.arrayBuffer();
      res.writeHead(apiRes.status, {
        'Content-Type': apiRes.headers.get('content-type') || 'application/json',
        'Access-Control-Allow-Origin': '*',
      });
      res.end(Buffer.from(body));
      console.log(c.blue('  [API]') + c.dim(` ${url.pathname} → `) + c.green(apiRes.status));
    } catch (err) {
      res.writeHead(502, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'API gateway unreachable' }));
      console.error(c.yellow('  [API ERR] ' + url.pathname + ': ' + err.message));
    }
    return;
  }

  // ── Static file serving ───────────────────────────────────────
  const DIST = path.join(__dirname, 'dist');

  // SPA fallback: /trading/*, /workbench/*, /picks/* → dist/index.html
  const SPA_PREFIXES = ['/trading/', '/trading', '/picks/', '/picks', '/strategies/', '/learn', '/workbench/analysis', '/verification-desk'];
  if (SPA_PREFIXES.some(p => url.pathname === p || url.pathname.startsWith(p + '/'))) {
    const candidate = path.join(DIST, url.pathname);
    const hasExtension = path.extname(url.pathname) !== '';
    // If the URL has no file extension (it's a route, not an asset), serve the SPA
    if (!hasExtension) {
      const spaIndex = path.join(DIST, 'index.html');
      if (fs.existsSync(spaIndex)) {
        const content = fs.readFileSync(spaIndex);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(content);
        if (!url.pathname.includes('.')) {
          console.log(c.green('  [SPA] ') + c.dim(url.pathname));
        }
        return;
      }
    }
  }

  let filePath = path.join(DIST, url.pathname === '/' ? '/index.html' : url.pathname);

  // No extension → try .html
  if (!path.extname(filePath)) {
    const withHtml = filePath + '.html';
    if (fs.existsSync(withHtml)) filePath = withHtml;
    // Try index.html inside directory
    const withIndex = path.join(filePath, 'index.html');
    if (fs.existsSync(withIndex)) filePath = withIndex;
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    // Try index.html in the directory
    const dirIndex = path.join(filePath, 'index.html');
    if (fs.existsSync(dirIndex)) {
      filePath = dirIndex;
    } else {
      // Fallback to dist/index.html
      filePath = path.join(DIST, 'index.html');
    }
  }

  const ext      = path.extname(filePath);
  const mimeType = MIME[ext] || 'text/plain';

  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': mimeType });
    res.end(content);
    if (!url.pathname.includes('.')) { // only log page loads, not assets
      console.log(c.green('  [GET] ') + c.dim(url.pathname));
    }
  } catch (err) {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not found: ' + url.pathname);
  }
});

server.listen(PORT, () => {
  console.log(c.bold('\n  NewLeaf System — Local Server'));
  console.log(c.dim('  ────────────────────────────────────'));
  console.log(`  ${c.green('Local:')}     http://localhost:${PORT}`);
  console.log(`  ${c.green('Status:')}    http://localhost:${PORT}/status.html`);
  console.log(`  ${c.green('Picks:')}     http://localhost:${PORT}/picks`);
  console.log(`  ${c.blue('R2 proxy:')}  /r2/* → ${R2_BASE}`);
  console.log(c.dim('\n  Ctrl+C to stop\n'));
});
