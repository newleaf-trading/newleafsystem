#!/usr/bin/env node
/**
 * newleaf-pipeline.js — NewLeaf Data Pipeline v2
 * ─────────────────────────────────────────────────────────────────────────────
 * Data sources:
 *   Alpaca DATA API  → live stock price, bars, option bid/ask + Greeks
 *   Nasdaq API       → expiry dates + Open Interest for ALL expiries
 *
 * Modes:
 *   (default)   Full run — Alpaca + Nasdaq OI → latest.json
 *   --intraday  Alpaca only (no Nasdaq OI). Fast. Updates prices+IV every 15 min.
 *               Also appends ATM IV to history/iv.json
 *   --daily     Full run + saves snapshots to history/:
 *               history/iv.json      ← ATM IV time series (30+ days)
 *               history/premium.json ← weekly ATM call/put premium %
 *               history/walls.json   ← gamma wall levels
 *
 * Usage:
 *   node newleaf-pipeline.js GLD --no-upload
 *   node newleaf-pipeline.js --watchlist
 *   node newleaf-pipeline.js --watchlist --intraday
 *   node newleaf-pipeline.js --watchlist --daily
 *   node newleaf-pipeline.js --watchlist --shard=0 --total-shards=3
 *
 * Cron:
 *   Every 15 min:  node newleaf-pipeline.js --watchlist --intraday
 *   Daily 9:30am:  node newleaf-pipeline.js --watchlist --daily
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

const fs   = require('fs');
const path = require('path');

// ── OI-Enhanced Architecture (v3.0) ───────────────────────────────────────────
const oiTracker = require('./oi-tracker');
const { analyzeGammaEnhanced } = require('./gamma-analyzer-enhanced');

// ── Shared Strategy Engine (single source of truth for scanner + discover) ───
const {
  analyzeTechnicals, calcScore, getDirection, selectStrategy, reconcileDirection, STRATEGIES,
  calcRealizedVol, calcATRPct, calcSMA, calcBB, calcRSI, premiumRiskPenalty,
} = require('./strategy-engine');

// ── ATM Contracts for Strategy Builder ───────────────────────────────────────
const { saveATMContracts } = require('./save-atm-contracts');
const { computeTrendTemplate, DEFAULT_CONFIG: TREND_CFG } = require('../shared/trend/trend-template.cjs');

// ── CLI ───────────────────────────────────────────────────────────────────────
const args        = process.argv.slice(2);
const flags       = args.filter(a => a.startsWith('--'));
const cliSymbols  = args.filter(a => !a.startsWith('--')).map(s => s.toUpperCase());
const noUpload    = flags.includes('--no-upload');
const useWatchlist= flags.includes('--watchlist');
const intradayMode= flags.includes('--intraday');
const dailyMode   = flags.includes('--daily');
const getFlag     = k => flags.find(f => f.startsWith(`--${k}=`))?.split('=')[1];

const CONFIG_FILE   = path.join(__dirname, 'config.json');
const REPORTS_DIR   = path.join(__dirname, 'reports');
const MANIFEST_PATH = path.join(REPORTS_DIR, 'manifest.json');
const ALPACA_DATA   = 'https://data.alpaca.markets';

// ── Market Cap Data ───────────────────────────────────────────────────────────
let WATCHLIST_DATA = null;
function loadWatchlistData() {
  if (WATCHLIST_DATA) return WATCHLIST_DATA;
  const watchlistPath = path.join(__dirname, 'watchlist.json');
  if (fs.existsSync(watchlistPath)) {
    WATCHLIST_DATA = JSON.parse(fs.readFileSync(watchlistPath, 'utf8'));
  }
  return WATCHLIST_DATA || {};
}

// ── Earnings Calendar ─────────────────────────────────────────────────────────
// Prefers new event-calendar.json (has earnings + exDiv per symbol).
// Falls back to old earnings-calendar.json (earnings only).
let EARNINGS_CALENDAR = null;
/** Invalidate cached calendar so next call reads fresh from disk. */
function invalidateEarningsCache() { EARNINGS_CALENDAR = null; }
function loadEarningsCalendar() {
  if (EARNINGS_CALENDAR) return EARNINGS_CALENDAR;
  // Try new format first (written by scripts/refresh-event-calendar.js)
  const newPath = path.join(__dirname, '..', 'web', 'scanner', 'event-calendar.json');
  if (fs.existsSync(newPath)) {
    try {
      const cal = JSON.parse(fs.readFileSync(newPath, 'utf8'));
      EARNINGS_CALENDAR = {};
      for (const [sym, data] of Object.entries(cal.symbols || {})) {
        EARNINGS_CALENDAR[sym] = (data && typeof data === 'object') ? data.earnings : data;
      }
      return EARNINGS_CALENDAR;
    } catch (err) { /* fall through */ }
  }
  // Fall back to old format
  const calendarPath = path.join(__dirname, 'earnings-calendar.json');
  if (fs.existsSync(calendarPath)) {
    try {
      const cal = JSON.parse(fs.readFileSync(calendarPath, 'utf8'));
      EARNINGS_CALENDAR = cal.symbols || {};
    } catch (err) {
      EARNINGS_CALENDAR = {};
    }
  }
  return EARNINGS_CALENDAR || {};
}

function getEarningsDate(symbol) {
  const calendar = loadEarningsCalendar();
  return calendar[symbol] || null;
}

function getMarketCapData(symbol) {
  const wl = loadWatchlistData();
  const tier = wl.marketCapMapping?.[symbol] || 'unknown';
  const tierInfo = wl.marketCapTiers?.[tier] || {};

  // Extract sector from groups
  let sector = null;
  if (wl.groups) {
    for (const [groupName, groupData] of Object.entries(wl.groups)) {
      if (groupData.symbols?.includes(symbol)) {
        sector = groupData.sector;
        break;
      }
    }
  }

  // Quality score proxy from tier
  const qualityScoreMap = {mega: 95, large: 80, mid: 60, small: 40, etf: 70};
  const qualityScore = qualityScoreMap[tier] || 50;

  return {
    marketCapTier: tier !== 'unknown' ? tier : null,
    marketCapLabel: tierInfo.label || null,
    optionsQuality: tierInfo.optionsQuality || 3,
    sector,
    qualityScore
  };
}

// ── "Mean-reversion eligible" set — source of truth for the reaction gate's exception. ─────
// Two groups earn the "oversold dip is a bounce, not a knife" assumption:
//   1. Mega-cap stocks — read from company-metadata.json (marketCapTier === 'mega'). watchlist.json
//      has no marketCapMapping, so getMarketCapData can't supply this.
//   2. Blue-chip ETFs — SPY/QQQ (equity indices) + GLD/SLV (commodities), which structurally
//      mean-revert. Hardcoded here (they carry no marketCapTier).
// Mirrors the API's quality-names.ts (MEGA_CAPS + MEAN_REVERT_ETFS) — keep the two in sync so
// scanner and Discover agree on who is eligible. Cached after first load.
const MEAN_REVERT_ETFS = new Set(['SPY', 'QQQ', 'GLD', 'SLV']);
let _megaCapSet = null;
function isMeanReversionEligible(symbol) {
  if (_megaCapSet === null) {
    _megaCapSet = new Set();
    try {
      const meta = JSON.parse(fs.readFileSync(path.join(__dirname, 'company-metadata.json'), 'utf8'));
      for (const [sym, info] of Object.entries(meta)) {
        if (info && info.marketCapTier === 'mega') _megaCapSet.add(sym);
      }
    } catch (_) { /* leave empty → exception simply never fires for mega-caps */ }
  }
  return _megaCapSet.has(symbol) || MEAN_REVERT_ETFS.has(symbol);
}


// ── Colours ───────────────────────────────────────────────────────────────────
const C = {
  green: s=>`\x1b[32m${s}\x1b[0m`, red:  s=>`\x1b[31m${s}\x1b[0m`,
  gold:  s=>`\x1b[33m${s}\x1b[0m`, dim:  s=>`\x1b[2m${s}\x1b[0m`,
  bold:  s=>`\x1b[1m${s}\x1b[0m`,
};

// ── Config ────────────────────────────────────────────────────────────────────
function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) throw new Error(`config.json not found at ${CONFIG_FILE}`);
  const cfg = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  if (!cfg.alpaca?.apiKey) throw new Error('Missing alpaca.apiKey in config.json');
  return cfg;
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function calcDTE(isoDate) {
  const exp = new Date(isoDate); exp.setHours(0,0,0,0);
  const now = new Date();        now.setHours(0,0,0,0);
  return Math.round((exp - now) / 86400000);
}

// ── Black-Scholes implied volatility (from mid price) ────────────────────────
// The Alpaca `indicative` feed used intraday returns no greeks/IV, so we solve IV
// ourselves from the option's mid price. No data subscription needed.
const RISK_FREE = 0.045;
function _normCdf(x) {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804014327 * Math.exp(-x * x / 2);
  const p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x >= 0 ? 1 - p : p;
}
function _bsPrice(S, K, T, sigma, isCall) {
  if (T <= 0 || sigma <= 0) return Math.max(0, isCall ? S - K : K - S);
  const sq = sigma * Math.sqrt(T);
  const d1 = (Math.log(S / K) + (RISK_FREE + sigma * sigma / 2) * T) / sq;
  const d2 = d1 - sq;
  return isCall
    ? S * _normCdf(d1) - K * Math.exp(-RISK_FREE * T) * _normCdf(d2)
    : K * Math.exp(-RISK_FREE * T) * _normCdf(-d2) - S * _normCdf(-d1);
}
/** Newton-Raphson (vega) with a bisection fallback. Returns σ (decimal) or null. */
function bsImpliedVol(price, S, K, T, isCall) {
  if (!(price > 0) || !(S > 0) || !(K > 0) || !(T > 0)) return null;
  const intrinsic = Math.max(0, isCall ? S - K : K - S);
  if (price <= intrinsic + 1e-6) return null; // no time value → unsolvable
  let sigma = 0.5;
  for (let i = 0; i < 40; i++) {
    const p = _bsPrice(S, K, T, sigma, isCall);
    const sq = sigma * Math.sqrt(T);
    const d1 = (Math.log(S / K) + (RISK_FREE + sigma * sigma / 2) * T) / sq;
    const vega = S * 0.3989422804014327 * Math.exp(-d1 * d1 / 2) * Math.sqrt(T);
    const diff = p - price;
    if (Math.abs(diff) < 1e-4) return (sigma > 0.01 && sigma < 5) ? sigma : null;
    if (vega < 1e-8) break;
    sigma -= diff / vega;
    if (!(sigma > 0) || sigma > 5 || !isFinite(sigma)) { sigma = 0.5; break; }
  }
  // Bisection fallback
  let lo = 0.01, hi = 5;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    (_bsPrice(S, K, T, mid, isCall) > price) ? (hi = mid) : (lo = mid);
  }
  const out = (lo + hi) / 2;
  return (out > 0.011 && out < 4.99) ? out : null;
}
/** Fill c.iv (decimal) from the mid price for contracts the feed left blank. Returns count filled. */
function enrichImpliedVol(contracts, spot) {
  let filled = 0;
  for (const c of contracts) {
    if (c.iv != null && c.iv > 0) continue;
    const mid = (c.bid > 0 && c.ask > 0) ? (c.bid + c.ask) / 2 : null;
    if (!mid || !c.dte || c.dte <= 0) continue;
    const iv = bsImpliedVol(mid, spot, c.strike, c.dte / 365, c.type === 'call');
    if (iv != null) { c.iv = iv; filled++; }
  }
  return filled;
}
const sleep  = ms => new Promise(r => setTimeout(r, ms));
const jitter = (base=150) => base + Math.random()*150;

function nextFridayISO() {
  const d = new Date(); d.setHours(12,0,0,0); // noon avoids UTC midnight off-by-one
  const day = d.getDay();
  d.setDate(d.getDate() + (day <= 5 ? (5-day)||7 : 6));
  return d.toISOString().split('T')[0];
}

function getThirdFriday() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();

  // Start with first day of current month
  let d = new Date(year, month, 1);
  d.setHours(12, 0, 0, 0); // noon avoids UTC midnight off-by-one

  // Find first Friday
  while (d.getDay() !== 5) {
    d.setDate(d.getDate() + 1);
  }

  // Third Friday is 14 days after first Friday
  d.setDate(d.getDate() + 14);

  // If third Friday is in the past, get next month's third Friday
  now.setHours(12, 0, 0, 0);
  if (d <= now) {
    d = new Date(year, month + 1, 1);
    d.setHours(12, 0, 0, 0);
    while (d.getDay() !== 5) {
      d.setDate(d.getDate() + 1);
    }
    d.setDate(d.getDate() + 14);
  }

  return d.toISOString().split('T')[0];
}

// ── Alpaca ────────────────────────────────────────────────────────────────────
function alpacaHdrs(cfg) {
  return { 'APCA-API-KEY-ID': cfg.alpaca.apiKey, 'APCA-API-SECRET-KEY': cfg.alpaca.secretKey, 'Accept': 'application/json' };
}

async function alpacaGet(url, hdrs, retries=2) {
  for (let i=0; i<=retries; i++) {
    try {
      const res = await fetch(url, { headers: hdrs, signal: AbortSignal.timeout(15000) });
      if (res.status===429) { await sleep(1000*(i+1)); continue; }
      if (!res.ok) { const t=await res.text().catch(()=>''); throw new Error(`HTTP ${res.status}: ${t.slice(0,80)}`); }
      return await res.json();
    } catch(err) { if (i===retries) throw err; await sleep(500); }
  }
}

async function getStockSnapshot(symbol, hdrs) {
  const d = await alpacaGet(`${ALPACA_DATA}/v2/stocks/${symbol}/snapshot`, hdrs);
  const q=d.latestQuote||{}, t=d.latestTrade||{}, b=d.dailyBar||{}, p=d.prevDailyBar||{};
  const price=t.p||q.ap||b.c||0, prevClose=p.c||0, change=price-prevClose;
  return { price, change, changePercent: prevClose?(change/prevClose)*100:0,
           volume:b.v||0, open:b.o||0, high:b.h||0, low:b.l||0, prevClose };
}

async function getStockBars(symbol, hdrs, days=400) {
  const end=new Date(), start=new Date(); start.setDate(start.getDate()-days);
  const url = `${ALPACA_DATA}/v2/stocks/${symbol}/bars?timeframe=1Day`
    + `&start=${start.toISOString().split('T')[0]}&end=${end.toISOString().split('T')[0]}&limit=500&adjustment=split`;
  const d = await alpacaGet(url, hdrs);
  return (d.bars||[]).map(b=>({t:b.t,o:b.o,h:b.h,l:b.l,c:b.c,v:b.v}));
}

async function getAlpacaChain(symbol, isoExpiry, hdrs) {
  const url = `${ALPACA_DATA}/v1beta1/options/snapshots/${symbol}?expiration_date=${isoExpiry}&feed=indicative&limit=1000`;
  const d   = await alpacaGet(url, hdrs).catch(()=>({snapshots:{}}));
  const out = [];
  for (const [occ, snap] of Object.entries(d.snapshots||{})) {
    const m = occ.match(/^([A-Z1-9]+)(\d{6})([CP])(\d{8})$/);
    if (!m) continue;
    const g=snap.greeks||{}, q=snap.latestQuote||{}, db=snap.dailyBar||{};
    out.push({ occ, type: m[3]==='C'?'call':'put', strike: parseInt(m[4],10)/1000,
               gamma: g.gamma??null, delta: g.delta??null,
               iv: g.midIV??snap.impliedVolatility??null,
               bid: q.bp??0, ask: q.ap??0, volume: db.v??0, openInterest: 0 });
  }
  return out;
}

// ── Nasdaq Option Chain API ───────────────────────────────────────────────────
const NASDAQ_BASE = 'https://api.nasdaq.com/api/quote';
const NASDAQ_HEADERS = { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', 'Accept': 'application/json' };

// ETFs require assetclass=etf, stocks use assetclass=stocks
const ETF_SYMBOLS = new Set(['SPY','QQQ','IWM','DIA','TLT','XLF','XLK','XLE','XLY','XLI','XLP','XLU','XLB','EEM','FXI','GLD','SLV','USO','UNG','GDX','BITO','UVXY','SQQQ','TQQQ','ARKK']);

function nasdaqAssetClass(symbol) {
  return ETF_SYMBOLS.has(symbol) ? 'etf' : 'stocks';
}

async function nasdaqGet(url, retries=3) {
  for (let i=0; i<=retries; i++) {
    try {
      const res = await fetch(url, { headers: NASDAQ_HEADERS, signal: AbortSignal.timeout(25000) });
      if (res.status===429) {
        const delay = 3000 * Math.pow(2, i); // 3s, 6s, 12s, 24s
        console.log(C.dim(`  [nasdaq] 429 rate limited, backoff ${(delay/1000).toFixed(0)}s`));
        await sleep(delay);
        continue;
      }
      if (!res.ok) throw new Error(`Nasdaq API ${res.status}: ${url}`);
      return await res.json();
    } catch(err) { if (i===retries) throw err; await sleep(jitter(1000)); }
  }
}

function parseNasdaqExpiryGroup(groupStr) {
  // "May 29, 2026" → "2026-05-29"
  // Parse as UTC noon to avoid timezone off-by-one
  try {
    const d = new Date(groupStr + ' 12:00:00 UTC');
    if (isNaN(d)) return null;
    return d.toISOString().split('T')[0];
  } catch { return null; }
}

async function getNasdaqExpiries(symbol) {
  const assetclass = nasdaqAssetClass(symbol);
  // Nasdaq defaults to a narrow date window and returns ONLY the nearest expiry's
  // full chain (~75 rows) — so without fromdate/todate we discover a single expiry.
  // Pass an explicit ~120-day window (money=all,type=all) to surface every expiry
  // group; the DTE filter downstream trims to dteMin–dteMax.
  const fromdate = new Date(); fromdate.setHours(12,0,0,0);
  const todate   = new Date(fromdate.getTime() + 120 * 86400000);
  const iso = dt => dt.toISOString().slice(0, 10);
  const dateRange = `&fromdate=${iso(fromdate)}&todate=${iso(todate)}&money=all&type=all`;
  // limit must be large enough to span the expiry GROUP headers, not just contracts. Daily-expiry
  // ETFs (QQQ, SPY) have ~150+ strikes per expiry, so limit=500 only surfaces ~3 dates; 3000 spans
  // ~18 dates. Weekly names are unaffected (they already fit). Downstream DTE filter + slice(0,7) trim.
  const EXPIRY_DISCOVERY_LIMIT = 3000;
  const url = `${NASDAQ_BASE}/${symbol}/option-chain?assetclass=${assetclass}&limit=${EXPIRY_DISCOVERY_LIMIT}${dateRange}`;
  let d = await nasdaqGet(url);

  // Fallback: try other asset class if empty
  if (!d?.data?.table?.rows?.length) {
    const alt = assetclass === 'stocks' ? 'etf' : 'stocks';
    d = await nasdaqGet(`${NASDAQ_BASE}/${symbol}/option-chain?assetclass=${alt}&limit=${EXPIRY_DISCOVERY_LIMIT}${dateRange}`);
  }

  if (!d?.data?.table?.rows?.length) throw new Error(`No option data from Nasdaq for ${symbol}`);

  const rows = d.data.table.rows;
  const expiries = [];
  for (const row of rows) {
    if (row.expirygroup && row.strike === null) {
      const iso = parseNasdaqExpiryGroup(row.expirygroup);
      if (iso) expiries.push(iso);
    }
  }

  if (!expiries.length) throw new Error(`No expirations from Nasdaq for ${symbol}`);
  return { expiries, currentPrice: null };
}

async function getNasdaqOIMap(symbol, isoExpiry) {
  try {
    const assetclass = nasdaqAssetClass(symbol);
    let url = `${NASDAQ_BASE}/${symbol}/option-chain?assetclass=${assetclass}&limit=200&expireDate=${isoExpiry}`;
    let d = await nasdaqGet(url);

    // Fallback asset class
    if (!d?.data?.table?.rows?.length) {
      const alt = assetclass === 'stocks' ? 'etf' : 'stocks';
      url = `${NASDAQ_BASE}/${symbol}/option-chain?assetclass=${alt}&limit=200&expireDate=${isoExpiry}`;
      d = await nasdaqGet(url);
    }

    const oiMap = {};
    const rows = d?.data?.table?.rows || [];

    for (const row of rows) {
      if (!row.strike || row.strike === null) continue;
      const strike = parseFloat(row.strike);
      if (isNaN(strike)) continue;

      const callOI = row.c_Openinterest && row.c_Openinterest !== '--' ? parseInt(row.c_Openinterest.replace(/,/g, '')) : 0;
      const callVol = row.c_Volume && row.c_Volume !== '--' ? parseInt(row.c_Volume.replace(/,/g, '')) : 0;
      const putOI = row.p_Openinterest && row.p_Openinterest !== '--' ? parseInt(row.p_Openinterest.replace(/,/g, '')) : 0;
      const putVol = row.p_Volume && row.p_Volume !== '--' ? parseInt(row.p_Volume.replace(/,/g, '')) : 0;

      if (callOI || callVol) {
        oiMap[`${strike}_call`] = { openInterest: callOI, volume: callVol, iv: 0 };
      }
      if (putOI || putVol) {
        oiMap[`${strike}_put`] = { openInterest: putOI, volume: putVol, iv: 0 };
      }
    }

    return oiMap;
  } catch(err) {
    console.log(C.dim(`  [nasdaq] OI failed for ${symbol}/${isoExpiry}: ${err.message}`));
    return {};
  }
}

// ── Yahoo svc (OI fallback) ──────────────────────────────────────────────────
let _yahooAvailable = null; // null = untested, true/false = cached at startup

async function checkYahooSvc(svcUrl) {
  try {
    const res = await fetch(svcUrl + '/health', { signal: AbortSignal.timeout(15000) });
    return res.ok;
  } catch(_) { return false; }
}

async function yahooGet(svcUrl, endpoint, retries=2) {
  for (let i=0; i<=retries; i++) {
    try {
      const res = await fetch(svcUrl+endpoint, { headers:{'Accept':'application/json'}, signal:AbortSignal.timeout(60000) });
      if (res.status===429) { await sleep(2000*(i+1)); continue; }
      if (!res.ok) throw new Error(`Yahoo svc ${res.status}: ${endpoint}`);
      return await res.json();
    } catch(err) { if (i===retries) throw err; await sleep(jitter(400)); }
  }
}

async function getYahooExpiries(symbol, svcUrl) {
  const d = await yahooGet(svcUrl, `/api/options/${symbol}`);
  if (!d.expirations?.length) throw new Error(`No expirations from Yahoo svc for ${symbol}`);
  return { expiries: d.expirations, currentPrice: d.currentPrice };
}

async function getYahooOIMap(symbol, isoExpiry, svcUrl) {
  try {
    const d = await yahooGet(svcUrl, `/api/options/${symbol}/${isoExpiry}`);
    const oiMap = {};
    const ingest = (contracts, type) => { for (const c of (contracts||[])) oiMap[`${c.strike}_${type}`] = { openInterest: c.openInterest||0, volume: c.volume||0, iv: c.impliedVolatility||0 }; };
    ingest(d.calls, 'call'); ingest(d.puts, 'put');
    return oiMap;
  } catch(err) {
    console.log(C.dim(`  [yahoo] OI failed for ${symbol}/${isoExpiry}: ${err.message}`));
    return {};
  }
}

function mergeOI(contracts, oiMap) {
  for (const c of contracts) {
    const e=oiMap[`${c.strike}_${c.type}`];
    if (e) { c.openInterest=e.openInterest; if (!c.iv&&e.iv) c.iv=e.iv; }
  }
  return contracts;
}

// ── Technicals, Scoring, Strategy Selection ──────────────────────────────────
// All imported from strategy-engine.js (shared with API)

// ── IV Rank ───────────────────────────────────────────────────────────────────
function calcIVRank(symbol, currentIV) {
  if (!currentIV) return null;
  const historyPath = path.join(REPORTS_DIR, symbol, 'history', 'iv.json');
  if (!fs.existsSync(historyPath)) return null;
  try {
    const history = JSON.parse(fs.readFileSync(historyPath, 'utf8'));
    const ivs = history.map(h => h.atmIv).filter(v => v && v > 0);
    if (ivs.length < 30) return null; // need at least 30 days
    const min = Math.min(...ivs);
    const max = Math.max(...ivs);
    if (max === min) return 50;
    return Math.round(((currentIV - min) / (max - min)) * 100);
  } catch (err) {
    return null;
  }
}

// ── Gamma Analysis ────────────────────────────────────────────────────────────
function estimateGamma(K, S, iv, T) {
  if (!iv||!T||T<=0) return 0;
  const sig=Math.min(iv,5), d1=(Math.log(S/K)+0.5*sig*sig*T)/(sig*Math.sqrt(T));
  return Math.exp(-0.5*d1*d1)/Math.sqrt(2*Math.PI)/(S*sig*Math.sqrt(T));
}

function analyzeGamma(contracts, spot, dteMin, dteMax) {
  const MUL=100, WALL_RANGE=0.15, strikeMap=new Map();
  for (const c of contracts) {
    if (!strikeMap.has(c.strike)) strikeMap.set(c.strike,{strike:c.strike,callGex:0,putGex:0,callOi:0,putOi:0});
    const row=strikeMap.get(c.strike), T=(c.dte||1)/365;
    const g=c.gamma??estimateGamma(c.strike,spot,c.iv||0.25,T), gex=g*(c.openInterest||0)*MUL*spot;
    if(c.type==='call'){row.callGex+=gex;row.callOi+=c.openInterest||0;}
    else{row.putGex+=gex;row.putOi+=c.openInterest||0;}
  }
  const sorted=[...strikeMap.values()].sort((a,b)=>a.strike-b.strike);
  let callWall=null,putWall=null,maxCG=0,maxPG=0;
  for (const r of sorted) {
    if (Math.abs(r.strike-spot)/spot>WALL_RANGE) continue;
    if(r.strike>spot&&r.callGex>maxCG){maxCG=r.callGex;callWall=r;}
    if(r.strike<spot&&r.putGex>maxPG){maxPG=r.putGex;putWall=r;}
  }
  if (!callWall||!putWall) {
    let maxCOI=0,maxPOI=0;
    for (const r of sorted) {
      if(Math.abs(r.strike-spot)/spot>WALL_RANGE)continue;
      if(r.strike>spot&&r.callOi>maxCOI){maxCOI=r.callOi;if(!callWall)callWall=r;}
      if(r.strike<spot&&r.putOi>maxPOI){maxPOI=r.putOi;if(!putWall)putWall=r;}
    }
  }
  const cw=callWall?.strike||+((spot*1.02).toFixed(2)), pw=putWall?.strike||+((spot*0.98).toFixed(2));
  const bandWidth=((cw-pw)/spot)*100, posInBand=cw!==pw?((spot-pw)/(cw-pw))*100:50;
  let gammaFlip=spot;
  for (let i=1;i<sorted.length;i++){const na=sorted[i-1].callGex-sorted[i-1].putGex,nb=sorted[i].callGex-sorted[i].putGex;if(Math.sign(na)!==Math.sign(nb)){gammaFlip=(sorted[i-1].strike+sorted[i].strike)/2;break;}}
  const totalGex=sorted.reduce((s,r)=>s+r.callGex+r.putGex,0);
  const wallStr=totalGex>0?(maxCG+maxPG)/totalGex:0, bandBonus=Math.max(0,1-bandWidth/20);
  const confidence=Math.min(1,wallStr*0.7+bandBonus*0.3);
  const condorAllowed=bandWidth>=3&&bandWidth<=15&&confidence>=0.6&&contracts.length>=50;
  const suggestedStrikes=condorAllowed?{longPut:Math.round(pw-(cw-pw)*0.3),shortPut:Math.round(pw),shortCall:Math.round(cw),longCall:Math.round(cw+(cw-pw)*0.3)}:null;
  const rows=sorted.map(r=>({strike:r.strike,gamma_exposure:r.callGex-r.putGex,call_oi:r.callOi,put_oi:r.putOi}));
  const hasGex=rows.some(r=>Math.abs(r.gamma_exposure)>0), hasOI=rows.some(r=>(r.call_oi+r.put_oi)>0);
  let topStrikes;
  if(hasGex) topStrikes=[...rows].sort((a,b)=>Math.abs(b.gamma_exposure)-Math.abs(a.gamma_exposure)).slice(0,20);
  else if(hasOI){topStrikes=rows.filter(r=>Math.abs(r.strike-spot)/spot<=0.25&&(r.call_oi+r.put_oi)>0).sort((a,b)=>(b.call_oi+b.put_oi)-(a.call_oi+a.put_oi)).slice(0,20).sort((a,b)=>a.strike-b.strike);if(!topStrikes.length)topStrikes=[...rows].sort((a,b)=>Math.abs(a.strike-spot)-Math.abs(b.strike-spot)).slice(0,20).sort((a,b)=>a.strike-b.strike);}
  else topStrikes=[...rows].sort((a,b)=>Math.abs(a.strike-spot)-Math.abs(b.strike-spot)).slice(0,20).sort((a,b)=>a.strike-b.strike);
  const atmC=contracts.filter(c=>Math.abs(c.strike-spot)/spot<0.05&&c.iv);
  const atmIv=atmC.length?(atmC.reduce((s,c)=>s+c.iv,0)/atmC.length)*100:null;
  const ivLevel=!atmIv?'normal':atmIv>50?'high':atmIv<25?'low':'normal';

  // Calculate IV by expiry for calendar spreads
  const ivByExpiry = {};
  const expiries = [...new Set(contracts.map(c => c.expiry))].sort();
  expiries.forEach(exp => {
    const expiryContracts = contracts.filter(c => c.expiry === exp && c.iv && c.iv > 0);
    if (expiryContracts.length > 0) {
      const avgIV = expiryContracts.reduce((sum, c) => sum + c.iv, 0) / expiryContracts.length;
      ivByExpiry[exp] = +(avgIV * 100).toFixed(2);
    }
  });

  return { analysis:{put_wall:pw,call_wall:cw,gamma_flip:gammaFlip,band_width_pct:bandWidth,position_in_band_pct:Math.round(posInBand),confidence_score:confidence,contracts_analyzed:contracts.length,dte_range:{min:dteMin,max:dteMax},topStrikes}, condorGate:{condorAllowed,suggestedStrikes}, ivData:{atmIv,ivLevel,ivByExpiry} };
}

// Scoring, direction, strategy selection — all from strategy-engine.js
// ── R2 Upload ─────────────────────────────────────────────────────────────────
async function uploadToR2(cfg, key, body) {
  const {S3Client,PutObjectCommand}=require('@aws-sdk/client-s3');
  const client=new S3Client({region:'auto',endpoint:cfg.endpoint,credentials:{accessKeyId:cfg.accessKeyId,secretAccessKey:cfg.secretAccessKey}});
  await client.send(new PutObjectCommand({Bucket:cfg.bucket,Key:key,Body:body,ContentType:'application/json',CacheControl:'public, max-age=300'}));
}

// ── Manifest ──────────────────────────────────────────────────────────────────
async function fetchR2Manifest(cfg) {
  if (!cfg.r2?.publicBaseUrl) return null;
  try { const res=await fetch(`${cfg.r2.publicBaseUrl}/reports/manifest.json`,{signal:AbortSignal.timeout(8000)});if(!res.ok)return null;return await res.json();}
  catch(_){return null;}
}

function upsertManifest(symbol, date, entry) {
  let manifest={updatedAt:new Date().toISOString(),reports:[]};
  if(fs.existsSync(MANIFEST_PATH)){try{manifest=JSON.parse(fs.readFileSync(MANIFEST_PATH,'utf8'));}catch(_){}}
  manifest.reports=manifest.reports||[];
  const idx=manifest.reports.findIndex(r=>r.symbol===symbol);
  const marketCapData = getMarketCapData(symbol);
  const row={symbol,date,...entry,...marketCapData};
  if(idx>=0)manifest.reports[idx]=row;else manifest.reports.push(row);
  manifest.updatedAt=new Date().toISOString();
  manifest.reports.sort((a,b)=>(b.opportunityScore||0)-(a.opportunityScore||0));
  // Keep legacy `symbols` + `count` keys in sync with `reports` so older
  // consumers (dataLoader.js fell back to manifest.symbols) don't see a stale
  // 20-entry subset frozen from a previous schema.
  manifest.symbols = manifest.reports.map(r=>r.symbol);
  manifest.count   = manifest.reports.length;
  fs.mkdirSync(REPORTS_DIR,{recursive:true});
  fs.writeFileSync(MANIFEST_PATH,JSON.stringify(manifest));
  return manifest;
}

// ── History (R2 time-series) ──────────────────────────────────────────────────
// R2 path: reports/{SYMBOL}/history/{type}.json  (array, newest last, max 90 entries)
// Types: iv | premium | walls

async function readR2History(cfg, symbol, type) {
  if (!cfg.r2?.publicBaseUrl) return [];
  try {
    const res=await fetch(`${cfg.r2.publicBaseUrl}/reports/${symbol}/history/${type}.json`,{signal:AbortSignal.timeout(8000)});
    if(!res.ok)return[];return await res.json();
  } catch(_){return[];}
}

async function appendHistory(cfg, symbol, type, entry) {
  const existing = await readR2History(cfg, symbol, type);

  // For premium type with expiryType, filter by both date AND expiryType
  // For other types, filter by date only
  const filtered = existing.filter(e => {
    if (type === 'premium' && entry.expiryType && e.expiryType) {
      return !(e.date === entry.date && e.expiryType === entry.expiryType);
    }
    return e.date !== entry.date;
  });

  const updated = [...filtered, entry].slice(-90);
  const localDir = path.join(REPORTS_DIR, symbol, 'history');
  fs.mkdirSync(localDir, {recursive:true});
  fs.writeFileSync(path.join(localDir, `${type}.json`), JSON.stringify(updated));
  if (!noUpload && cfg.r2?.accountId)
    await uploadToR2(cfg.r2, `reports/${symbol}/history/${type}.json`, JSON.stringify(updated)).catch(()=>{});
  return updated;
}

// Calculate weekly ATM premium from option contracts
function calcWeeklyPremium(contracts, spot) {
  const expiryStr = nextFridayISO();
  const weekly    = contracts.filter(c => { const d=calcDTE(c.expiry||expiryStr); return d>=1&&d<=8; });
  if (!weekly.length) return null;
  const atmStrike = [...new Set(weekly.map(c=>c.strike))].sort((a,b)=>Math.abs(a-spot)-Math.abs(b-spot))[0];
  if (!atmStrike) return null;
  const atmCall = weekly.find(c=>c.type==='call'&&c.strike===atmStrike);
  const atmPut  = weekly.find(c=>c.type==='put' &&c.strike===atmStrike);
  const callMid = atmCall ? (atmCall.bid+atmCall.ask)/2 : 0;
  const putMid  = atmPut  ? (atmPut.bid +atmPut.ask)/2  : 0;
  return {
    expiry: expiryStr, atmStrike,
    callMid:  +callMid.toFixed(3),
    putMid:   +putMid.toFixed(3),
    callPct:  spot>0?+((callMid/spot)*100).toFixed(3):0,
    putPct:   spot>0?+((putMid /spot)*100).toFixed(3):0,
    iv:       atmCall?.iv ? +(atmCall.iv*100).toFixed(2) : null,
  };
}

// Calculate monthly ATM premium from option contracts (3rd Friday)
function calcMonthlyPremium(contracts, spot) {
  const expiryStr = getThirdFriday();
  // Look for contracts expiring within 3 days of 3rd Friday (to account for weekends/holidays)
  const monthly = contracts.filter(c => {
    const dte = calcDTE(c.expiry || expiryStr);
    if (dte < 1) return false; // never select expired/expiring-today contracts
    const targetDTE = calcDTE(expiryStr);
    return Math.abs(dte - targetDTE) <= 3;
  });
  if (!monthly.length) return null;
  const atmStrike = [...new Set(monthly.map(c=>c.strike))].sort((a,b)=>Math.abs(a-spot)-Math.abs(b-spot))[0];
  if (!atmStrike) return null;
  const atmCall = monthly.find(c=>c.type==='call'&&c.strike===atmStrike);
  const atmPut  = monthly.find(c=>c.type==='put' &&c.strike===atmStrike);
  const callMid = atmCall ? (atmCall.bid+atmCall.ask)/2 : 0;
  const putMid  = atmPut  ? (atmPut.bid +atmPut.ask)/2  : 0;
  return {
    expiry: expiryStr, atmStrike,
    callMid:  +callMid.toFixed(3),
    putMid:   +putMid.toFixed(3),
    callPct:  spot>0?+((callMid/spot)*100).toFixed(3):0,
    putPct:   spot>0?+((putMid /spot)*100).toFixed(3):0,
    iv:       atmCall?.iv ? +(atmCall.iv*100).toFixed(2) : null,
  };
}

// ── Process one symbol ────────────────────────────────────────────────────────
// ── Phase 4a: advisory trend verdict — attached to the report, DISPLAY-ONLY.
// Never affects scoring/strategy/upload decisions; failures degrade to report.trend=null.
// Benchmark = SPY's last report (≤15min/≤1day stale; fine for a trend signal), read once per run.
let _benchBars;
function getBenchBars() {
  if (_benchBars !== undefined) return _benchBars;
  try {
    const spy = JSON.parse(fs.readFileSync(path.join(REPORTS_DIR, 'SPY', 'latest.json'), 'utf8'));
    _benchBars = (spy.technicalData?.priceHistory || []).map(b => ({ date: (b.t || '').split('T')[0], open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v || 0 }));
  } catch { _benchBars = []; }
  return _benchBars;
}
function attachTrend(report) {
  try {
    const t = report.technicalData || {};
    const bars = (t.priceHistory || []).map(b => ({ date: (b.t || '').split('T')[0], open: b.o, high: b.h, low: b.l, close: b.c, volume: b.v || 0 }));
    if (bars.length < TREND_CFG.minBars) { report.trend = null; return; }
    const atrPct = t.atrPct;
    const move3 = bars.length >= 4 ? bars[bars.length - 1].close / bars[bars.length - 4].close - 1 : 0;
    const velocityGuardFired = atrPct > 0 && Math.abs(move3) > 3 * atrPct;
    const tr = computeTrendTemplate({ bars, benchmarkBars: getBenchBars(), benchmarkSymbol: 'SPY', velocityGuardFired });
    report.trend = {
      verdict: tr.verdict, checks: tr.checks, down: tr.down, vcpActive: tr.vcpActive,
      velocityGuardFired, overlap: tr.overlap, trendScore: tr.trendScore,
      multipliers: { conflictMultiplier: TREND_CFG.conflictMultiplier, alignBonus: TREND_CFG.alignBonus, vcpNeutralMultiplier: TREND_CFG.vcpNeutralMultiplier },
      source: 'shared/trend v0', advisory: 'SHADOW · ADVISORY · UNVALIDATED', asOf: report.meta?.date || null,
    };
  } catch (_) { report.trend = null; }
}

async function processSymbol(symbol, cfg, date, dteMin, dteMax) {
  const hdrs   = alpacaHdrs(cfg);
  const log    = msg => console.log(`  ${C.gold('['+symbol+']')} ${msg}`);

  // 1. Stock snapshot + bars
  const snapshot      = await getStockSnapshot(symbol, hdrs);
  const spot          = snapshot.price;
  log(`Price ${C.bold('$'+spot.toFixed(2))} | Change ${snapshot.changePercent.toFixed(1)}%`);

  const bars          = await getStockBars(symbol, hdrs);
  const technicalData = analyzeTechnicals(bars, spot);
  log(`Bars: ${bars.length} | RSI: ${(technicalData.rsi||0).toFixed(1)} | Trend: ${technicalData.trendEngine.state}`);

  // 2. Options fetch (mode-dependent)
  let gammaData, allContracts=[], contractCount=0, withOI=0, oiSourceUsed='none';

  if (intradayMode) {
    // INTRADAY: Alpaca + Nasdaq expiries (7 max) — fast, no OI merge
    try {
      const {expiries} = await getNasdaqExpiries(symbol);
      const relevant   = expiries.filter(iso=>{ const d=calcDTE(iso); return d>=dteMin&&d<=dteMax; });
      log(`Expiries: ${expiries.length} total, ${relevant.length} in range`);
      if (!relevant.length) throw new Error('No expiries in DTE range');

      for (const isoExpiry of relevant.slice(0,7)) {
        const dte = calcDTE(isoExpiry);
        const chain  = await getAlpacaChain(symbol, isoExpiry, hdrs).catch(()=>[]);
        for (const c of chain) { c.dte=dte; c.expiry=isoExpiry; }
        allContracts.push(...chain);
        process.stdout.write('.');
        await sleep(jitter(200)); // brief pause between expiries
      }
      // Indicative feed returns no greeks/IV — solve IV from the mid price so intraday
      // runs produce a real ATM IV + term structure (not just the daily-preserved value).
      const _ivFilled = enrichImpliedVol(allContracts, spot);
      if (_ivFilled) log(C.dim(`Computed IV from mid for ${_ivFilled}/${allContracts.length} contracts`));
      process.stdout.write('\n');
      contractCount = allContracts.length;
      log(`Intraday: ${contractCount} contracts (Alpaca, no OI)`);

      // Calculate OI delta (reads from history, doesn't save)
      const oiDeltaData = oiTracker.calculateOIDelta(
        REPORTS_DIR, symbol, date, allContracts,
        snapshot.changePercent, { volumeTrend: technicalData.trendEngine?.state || 'neutral' }
      );

      gammaData = analyzeGammaEnhanced(allContracts, spot, dteMin, dteMax, oiDeltaData);
    } catch(err) {
      log(C.red(`Intraday failed: ${err.message}`));
      gammaData = analyzeGammaEnhanced([], spot, dteMin, dteMax, null);
    }
  } else {
    // FULL/DAILY: Alpaca + OI (Nasdaq primary, Yahoo fallback)
    const svcUrl = cfg.yahoosvc?.url || 'https://yahoo-options-svc-m2cty2vxuq-uc.a.run.app';
    try {
      let nasdaqFailed = false;

      // Step A: Get expiries (Nasdaq primary, Yahoo fallback)
      let expiries;
      try {
        ({ expiries } = await getNasdaqExpiries(symbol));
      } catch(nasdaqErr) {
        log(C.dim(`Nasdaq expiries failed: ${nasdaqErr.message}`));
        nasdaqFailed = true;
        if (_yahooAvailable) {
          log(C.dim('Trying Yahoo for expiries...'));
          ({ expiries } = await getYahooExpiries(symbol, svcUrl));
        } else {
          throw nasdaqErr;
        }
      }

      const relevant = expiries.filter(iso => { const d = calcDTE(iso); return d >= dteMin && d <= dteMax; });
      log(`Expiries: ${expiries.length} total, ${relevant.length} in range`);
      if (!relevant.length) throw new Error('No expiries in DTE range');

      // Step B: Per-expiry — Alpaca chain + OI (Nasdaq → Yahoo fallback)
      for (const isoExpiry of relevant.slice(0, 8)) {
        const dte = calcDTE(isoExpiry);
        const chain = await getAlpacaChain(symbol, isoExpiry, hdrs).catch(() => []);
        await sleep(jitter(300));

        let oiMap = {};

        // Try Nasdaq OI first (skip if already globally failed for this symbol)
        if (!nasdaqFailed) {
          oiMap = await getNasdaqOIMap(symbol, isoExpiry);
        }

        // Fallback to Yahoo if Nasdaq returned empty and Yahoo is available
        if (Object.keys(oiMap).length === 0 && _yahooAvailable) {
          oiMap = await getYahooOIMap(symbol, isoExpiry, svcUrl);
          if (Object.keys(oiMap).length > 0 && oiSourceUsed !== 'nasdaq-api') {
            oiSourceUsed = 'yahoo-svc';
          }
        }

        if (Object.keys(oiMap).length > 0 && oiSourceUsed === 'none') {
          oiSourceUsed = nasdaqFailed ? 'yahoo-svc' : 'nasdaq-api';
        }

        for (const c of chain) { c.dte = dte; c.expiry = isoExpiry; }
        mergeOI(chain, oiMap);
        allContracts.push(...chain);
        process.stdout.write('.');
        await sleep(jitter(500));
      }
      process.stdout.write('\n');
      contractCount = allContracts.length;
      withOI = allContracts.filter(c => c.openInterest > 0).length;
      log(`Contracts: ${contractCount} | With OI: ${withOI > 0 ? C.green(String(withOI)) : withOI} | Source: ${oiSourceUsed}`);

      // Save OI history BEFORE delta calc so today's snapshot is available
      if (dailyMode) {
        try { oiTracker.saveOIHistory(REPORTS_DIR, symbol, date, allContracts); }
        catch (e) { log(C.dim(`OI history pre-save failed: ${e.message}`)); }
      }

      // Calculate OI delta for enhanced gamma analysis
      const oiDeltaData = oiTracker.calculateOIDelta(
        REPORTS_DIR, symbol, date, allContracts,
        snapshot.changePercent, { volumeTrend: technicalData.trendEngine?.state || 'neutral' }
      );

      gammaData = analyzeGammaEnhanced(allContracts, spot, dteMin, dteMax, oiDeltaData);
    } catch(err) {
      log(C.red(`Options fetch failed: ${err.message}`));
      log(C.dim('→ Proxy scoring only'));
      gammaData = analyzeGammaEnhanced([], spot, dteMin, dteMax, null);
      oiSourceUsed = 'none';
    }
  }

  const confVal = gammaData.analysis.confidence_score;
  const confStr = confVal !== null
    ? `${(confVal*100).toFixed(0)}%`
    : C.red('NULL (no walls — OI data missing)');
  log(`Put wall $${gammaData.analysis.put_wall.toFixed(2)} | Call wall $${gammaData.analysis.call_wall.toFixed(2)} | Confidence ${confStr} | Quality: ${gammaData.analysis.data_quality}`);

  // 3. Score + strategy
  const {total:opportunityScore, pillars, hasOptions} = calcScore(gammaData, technicalData);
  const trendDirection = getDirection(gammaData, technicalData);
  let strategy  = selectStrategy(gammaData, trendDirection, spot, technicalData);
  let direction = reconcileDirection(trendDirection, strategy.code);
  // Reaction gate (engine unification): promote a neutral pick to the aligned directional spread.
  // Skip in intraday — S/R zones don't change within the day, this result isn't uploaded to
  // latest.json (no OI), and the intraday OI-preservation path below re-applies the gate. Daily
  // and full runs apply it here. (Optimisation #2 — removes a wasted recompute every 15 min.)
  if (!intradayMode) {
    try {
      const { computeReactionRails, applyReactionGate } = require('./reaction-gate.cjs');
      const _g = applyReactionGate(strategy.code, computeReactionRails({ snapshot: { price: spot }, technicalData, gammaData, isQualityName: isMegaCap(symbol) }));
      if (_g) {
        log(C.dim(`  Reaction gate: ${strategy.code} → ${_g.strategy} (${_g.note})`));
        strategy = { ...STRATEGIES[_g.strategy], reactionNote: _g.note, gammaCode: strategy.code };
        direction = _g.direction;
      }
    } catch (_) { /* non-fatal: keep the gamma pick */ }
  }
  log(`Score: ${C.bold(opportunityScore.toFixed(1))} | ${direction} | ${strategy.name}`);

  // Calculate ivRank and add to gammaData
  const ivRank = calcIVRank(symbol, gammaData.ivData?.atmIv);
  if (ivRank !== null) {
    gammaData.ivData.ivRank = ivRank;
    log(`IV Rank: ${ivRank}`);
  }

  // Get market cap and sector data
  const marketCapData = getMarketCapData(symbol);

  // 4. Assemble report with OI metadata
  const oiDate = new Date(date);
  oiDate.setDate(oiDate.getDate() - 1);
  const oiDateStr = oiDate.toISOString().split('T')[0];
  const oiConfidence = oiTracker.getOIConfidence(allContracts);
  const oiEnrichedAt = withOI > 0 ? new Date().toISOString() : null;

  const report = {
    meta: {
      symbol, date,
      generatedAt: new Date().toISOString(),
      generatedBy: 'newleaf-pipeline/3.0',
      dteMin, dteMax,
      mode: intradayMode ? 'intraday' : dailyMode ? 'daily' : 'full',
      dataSource: {
        prices: 'alpaca',
        openInterest: oiSourceUsed,
        greeks: gammaData.analysis.topStrikes?.some(s => Math.abs(s.gamma_exposure) > 0)
          ? 'alpaca-opra'
          : 'estimated-bs'
      },
      // OI-Enhanced Architecture (v3.0)
      oiDate: oiDateStr,
      oiFreshness: 'T-1',
      oiConfidence: +oiConfidence.toFixed(2),
      oiEnrichedAt
    },
    snapshot,
    technicalData: { rsi:technicalData.rsi, sma50:technicalData.sma50, sma100:technicalData.sma100, sma200:technicalData.sma200,
      bb:technicalData.bb, adx14:technicalData.adx14, rsiEngine:technicalData.rsiEngine, trendEngine:technicalData.trendEngine,
      volatilityEngine:technicalData.volatilityEngine, momentumFlag:technicalData.momentumFlag,
      sr:technicalData.sr, avgScore:technicalData.avgScore,
      priceHistory:technicalData.priceHistory, bbSeries:technicalData.bbSeries, rsiSeries:technicalData.rsiSeries,
      aboveSMA50:technicalData.aboveSMA50, aboveSMA100:technicalData.aboveSMA100, aboveSMA200:technicalData.aboveSMA200,
      realizedVol30d:technicalData.realizedVol30d, atrPct:technicalData.atrPct },
    gammaData,
    scoring: {
      opportunityScore: Math.max(0, (strategy.bwbBonus ? opportunityScore + strategy.bwbBonus : opportunityScore) + premiumRiskPenalty(strategy.code, gammaData, technicalData).penalty),
      pillars, direction, strategy, hasOptions,
      ...(strategy.code === 'broken_wing_butterfly' ? { bwbBonus: strategy.bwbBonus } : {})
    },
    // Market cap and sector metadata
    marketCapTier: marketCapData.marketCapTier,
    marketCapLabel: marketCapData.marketCapLabel,
    sector: marketCapData.sector,
    qualityScore: marketCapData.qualityScore,
    earningsDate: getEarningsDate(symbol),
    // Full option chain with OI changes (v3.0)
    optionChain: allContracts.map(c => {
      const strikeKey = c.strike.toString();
      const deltaInfo = gammaData.oiDelta ? null : null; // Will be populated when oiDelta available
      const oiDeltaData = oiTracker.calculateOIDelta(
        REPORTS_DIR, symbol, date, allContracts,
        snapshot.changePercent, { volumeTrend: technicalData.trendEngine?.state || 'neutral' }
      );
      const oiChangeInfo = oiDeltaData?.strikes?.[strikeKey];

      return {
        strike: c.strike,
        expiry: c.expiry,
        dte: c.dte,
        type: c.type,
        bid: c.bid,
        ask: c.ask,
        mid: +(((c.bid + c.ask) / 2).toFixed(3)),
        last: c.last,
        iv: c.iv,
        delta: c.delta,
        gamma: c.gamma,
        theta: c.theta,
        volume: c.volume || 0,
        openInterest: c.openInterest || 0,
        // OI change tracking
        oiChange: c.type === 'call'
          ? (oiChangeInfo?.call_oi_change || 0)
          : (oiChangeInfo?.put_oi_change || 0),
        oiChangePct: c.type === 'call'
          ? (oiChangeInfo?.call_oi_change_pct || 0)
          : (oiChangeInfo?.put_oi_change_pct || 0)
      };
    })
  };

  // 5. Save locally
  // latest.json      → always current
  // {date}.json      → today's snapshot (overwritten each run, end-of-day is final)
  // {datetime}.json  → timestamped copy of every run (full history)
  const symDir  = path.join(REPORTS_DIR, symbol);
  const ts      = new Date().toISOString().replace(/:/g, '').replace('T', 'T').slice(0, 15); // e.g. 20260327T1430
  const tsKey   = `${ts}.json`;
  fs.mkdirSync(symDir, {recursive:true});

  // Intraday: preserve OI-enriched gamma data from today's daily snapshot
  // The fast pipeline has no OI, but the daily run (pipeline-oi-enrichment.js)
  // writes {date}.json with real OI data. Carry it forward into latest.json
  // so the strategy builder always shows accurate gamma walls.
  if (intradayMode) {
    const dailyPath = path.join(symDir, `${date}.json`);
    if (fs.existsSync(dailyPath)) {
      try {
        const daily = JSON.parse(fs.readFileSync(dailyPath, 'utf8'));
        if (daily.gammaData && daily.meta?.dataSource?.openInterest !== 'none') {
          const computedIv = report.gammaData && report.gammaData.ivData; // BS-computed IV from this intraday run
          report.gammaData = daily.gammaData;
          // The daily OI snapshot has no IV of its own — don't let it clobber the IV we just
          // computed from mid price. Keep the fresh IV whenever the daily copy lacks it.
          if (computedIv && typeof computedIv.atmIv === 'number'
              && !(daily.gammaData.ivData && typeof daily.gammaData.ivData.atmIv === 'number')) {
            report.gammaData.ivData = computedIv;
          }
          report.meta.dataSource.openInterest = daily.meta.dataSource.openInterest;
          report.meta.oiConfidence = daily.meta.oiConfidence;
          report.meta.oiEnrichedAt = daily.meta.oiEnrichedAt;
          report.meta.dataSource.greeks = daily.meta.dataSource.greeks;
          // Recalculate score with OI-enriched gamma data
          const {total:oiScore, pillars:oiPillars, hasOptions:oiHasOpts} = calcScore(report.gammaData, technicalData);
          const oiTrendDir = getDirection(report.gammaData, technicalData);
          let oiStrat = selectStrategy(report.gammaData, oiTrendDir, spot, technicalData);
          let oiDir = reconcileDirection(oiTrendDir, oiStrat.code);
          try {
            const { computeReactionRails, applyReactionGate } = require('./reaction-gate.cjs');
            const _g = applyReactionGate(oiStrat.code, computeReactionRails({ snapshot: { price: spot }, technicalData, gammaData: report.gammaData, isQualityName: isMegaCap(symbol) }));
            if (_g) { oiStrat = { ...STRATEGIES[_g.strategy], reactionNote: _g.note, gammaCode: oiStrat.code }; oiDir = _g.direction; }
          } catch (_) { /* keep gamma pick */ }
          report.scoring = {
            opportunityScore: Math.max(0, (oiStrat.bwbBonus ? oiScore + oiStrat.bwbBonus : oiScore) + premiumRiskPenalty(oiStrat.code, report.gammaData, technicalData).penalty),
            pillars: oiPillars, direction: oiDir, strategy: oiStrat, hasOptions: oiHasOpts,
            ...(oiStrat.code === 'broken_wing_butterfly' ? { bwbBonus: oiStrat.bwbBonus } : {})
          };
        }
      } catch(_) {}
    }
  }

  // Intraday IV preservation: the Alpaca `indicative` feed returns no greeks/IV (and none at all
  // after hours), so intraday runs compute atmIv=null and would blank out the good daily IV. Carry
  // forward the last known-good ivData (from the prior latest.json) rather than clobbering it —
  // same principle as the OI preservation above. IV moves slowly, so a carried value is fine.
  if (intradayMode && !(report.gammaData && report.gammaData.ivData && typeof report.gammaData.ivData.atmIv === 'number')) {
    try {
      const prevPath = path.join(symDir, 'latest.json');
      if (fs.existsSync(prevPath)) {
        const prev = JSON.parse(fs.readFileSync(prevPath, 'utf8'));
        const pIv = prev.gammaData && prev.gammaData.ivData;
        if (pIv && typeof pIv.atmIv === 'number') {
          report.gammaData = report.gammaData || {};
          report.gammaData.ivData = { ...pIv, _ivPreserved: true };
          log(C.dim(`IV preserved from prior report (atmIv ${pIv.atmIv.toFixed(1)}%)`));
        }
      }
    } catch (_) { /* no prior IV to preserve */ }
  }

  attachTrend(report); // advisory trend verdict — added before any write/upload so R2 carries it
  fs.writeFileSync(path.join(symDir, 'latest.json'), JSON.stringify(report));
  fs.writeFileSync(path.join(symDir, tsKey),          JSON.stringify(report));
  // Only daily/full runs write {date}.json — intraday never overwrites it
  // so stock.html can always find a OI-rich snapshot for the day
  if (!intradayMode) {
    fs.writeFileSync(path.join(symDir, `${date}.json`), JSON.stringify(report));
  }
  log(C.dim(`Saved locally (${tsKey})`));

  // 5.5. Save ATM contracts for strategy builder (both modes now fetch multiple expiries)
  if (allContracts.length > 0) {
    try {
      await saveATMContracts(symbol, allContracts, spot, date, cfg);
    } catch (err) {
      log(C.red(`ATM contracts save failed: ${err.message}`));
    }
  }

  // 6. Save history snapshots (intraday: IV only, daily: IV + premium + walls)
  const atmIv = gammaData.ivData?.atmIv;
  if (atmIv && (intradayMode || dailyMode)) {
    // IV history — track every intraday update with timestamp
    const ivEntry = { date, time: new Date().toISOString(), atmIv: +atmIv.toFixed(2), spot: +spot.toFixed(2) };
    await appendHistory(cfg, symbol, 'iv', ivEntry).catch(()=>{});
    log(C.dim(`IV history: ${atmIv.toFixed(1)}%`));
  }

  if (dailyMode) {
    // Weekly premium history
    const premiumWeekly = calcWeeklyPremium(allContracts, spot);
    if (premiumWeekly) {
      await appendHistory(cfg, symbol, 'premium', { date, spot:+spot.toFixed(2), expiryType:'weekly', ...premiumWeekly }).catch(()=>{});
      log(C.dim(`Premium (weekly): call=${premiumWeekly.callPct.toFixed(2)}% put=${premiumWeekly.putPct.toFixed(2)}%`));
    }

    // Monthly premium history
    const premiumMonthly = calcMonthlyPremium(allContracts, spot);
    if (premiumMonthly) {
      await appendHistory(cfg, symbol, 'premium', { date, spot:+spot.toFixed(2), expiryType:'monthly', ...premiumMonthly }).catch(()=>{});
      log(C.dim(`Premium (monthly): call=${premiumMonthly.callPct.toFixed(2)}% put=${premiumMonthly.putPct.toFixed(2)}%`));
    }

    // Gamma walls history
    const walls = {
      date, spot: +spot.toFixed(2),
      putWall:   +gammaData.analysis.put_wall.toFixed(2),
      callWall:  +gammaData.analysis.call_wall.toFixed(2),
      gammaFlip: +gammaData.analysis.gamma_flip.toFixed(2),
      bandWidth: +gammaData.analysis.band_width_pct.toFixed(2),
      confidence: gammaData.analysis.confidence_score !== null ? +gammaData.analysis.confidence_score.toFixed(3) : null,
    };
    await appendHistory(cfg, symbol, 'walls', walls).catch(()=>{});
    log(C.dim(`Walls history saved`));

    // OI baseline history (v3.0) — save OI snapshot for delta calculation
    try {
      oiTracker.saveOIHistory(REPORTS_DIR, symbol, date, allContracts);
      const withOICount = allContracts.filter(c => c.openInterest > 0).length;
      log(C.dim(`OI history: ${withOICount} contracts with OI`));
    } catch (err) {
      log(C.red(`OI history save failed: ${err.message}`));
    }

    // OI delta history (v3.0) — calculate position changes
    const oiDeltaData = oiTracker.calculateOIDelta(
      REPORTS_DIR, symbol, date, allContracts,
      snapshot.changePercent,
      { volumeTrend: technicalData.trendEngine?.state || 'neutral' }
    );

    if (oiDeltaData) {
      try {
        oiTracker.saveOIDelta(REPORTS_DIR, symbol, oiDeltaData);
        const netChange = Object.values(oiDeltaData.strikes)
          .reduce((sum, s) => sum + Math.abs(s.net_change), 0);
        log(C.dim(`OI delta: net change ${Math.round(netChange)} contracts`));
      } catch (err) {
        log(C.red(`OI delta save failed: ${err.message}`));
      }
    } else {
      log(C.dim(`OI delta: insufficient history (need 2+ days)`));
    }
  }

  // 7. Manifest — use report.scoring (includes OI preservation from daily snapshot)
  const finalStrat = report.scoring.strategy;
  const manifest = upsertManifest(symbol, date, {
    opportunityScore: report.scoring.opportunityScore,
    direction: report.scoring.direction,
    strategy: finalStrat.name, strategyCode: finalStrat.code, strategyIcon: finalStrat.icon,
    ...(finalStrat.subtype ? { strategySubtype: finalStrat.subtype } : {}),
    price: snapshot.price, changePercent: snapshot.changePercent,
    iv: report.gammaData.ivData?.atmIv ?? null, hasOptions: report.scoring.hasOptions
  });

  // 8. Upload to R2
  if (!noUpload && cfg.r2?.accountId) {
    try {
      // Debug: verify OI preservation survived to upload point
      const oi = report.gammaData?.analysis?.contracts_analyzed || 0;
      const src = report.meta?.dataSource?.openInterest || 'none';
      if (intradayMode) {
        if (oi === 0 && src === 'none') log(C.dim(`R2 upload: NO OI preserved (${src})`));
        else log(C.dim(`R2 upload: OI preserved (${oi} contracts, ${src})`));
      }
      const body = JSON.stringify(report);
      // Intraday with no OI: skip latest.json upload to avoid clobbering daily OI data on R2
      if (intradayMode && oi === 0 && src === 'none') {
        log(C.dim(`Skipping latest.json upload (no OI — would clobber daily snapshot)`));
      } else {
        await uploadToR2(cfg.r2, `reports/${symbol}/latest.json`, body);  // always current
      }
      await uploadToR2(cfg.r2, `reports/${symbol}/${tsKey}`,     body);  // timestamped history
      // Only daily/full runs with real OI data write {date}.json — never overwrite with proxy data
      if (!intradayMode && gammaData.analysis.contracts_analyzed > 0) {
        await uploadToR2(cfg.r2, `reports/${symbol}/${date}.json`, body);
      } else if (!intradayMode) {
        log(C.dim(`Skipping ${date}.json upload (proxy gamma, 0 contracts)`));
      }
      // Watchlist runs rebuild the manifest authoritatively at end of main() (one atomic write),
      // so skip the racy per-symbol upload there. Single-symbol runs keep incremental upload.
      if (!useWatchlist) await uploadToR2(cfg.r2, 'reports/manifest.json', JSON.stringify(manifest));
      log(C.green(`✓ Uploaded to R2 (${tsKey})`));
    } catch(err) { log(C.red(`R2 upload failed: ${err.message}`)); }
  }

  return report;
}

// ── Run Logger ──────────────────────────────────────────────────────────────────
async function logRun(cfg, runLog) {
  const LOGS_PATH = path.join(REPORTS_DIR, 'logs', 'runs.json');
  // Read existing
  let runs = [];
  if (fs.existsSync(LOGS_PATH)) {
    try { runs = JSON.parse(fs.readFileSync(LOGS_PATH, 'utf8')); } catch(_) {}
  } else {
    // Try fetch from R2
    if (cfg.r2?.publicBaseUrl) {
      try {
        const res = await fetch(`${cfg.r2.publicBaseUrl}/logs/runs.json`, {signal:AbortSignal.timeout(5000)});
        if (res.ok) runs = await res.json();
      } catch(_) {}
    }
  }
  runs = [runLog, ...runs].slice(0, 50); // keep last 50 runs, newest first
  fs.mkdirSync(path.dirname(LOGS_PATH), {recursive:true});
  fs.writeFileSync(LOGS_PATH, JSON.stringify(runs));
  if (!noUpload && cfg.r2?.accountId) {
    await uploadToR2(cfg.r2, 'logs/runs.json', JSON.stringify(runs)).catch(()=>{});
  }
}

// ── Main ──────────────────────────────────────────────────────────────────
async function main() {
  const cfg  = loadConfig();
  const date = new Date().toISOString().split('T')[0];

  const dteMin      = parseInt(getFlag('dte-min')      ?? cfg.pipeline?.dteMin      ?? 0);
  const dteMax      = parseInt(getFlag('dte-max')      ?? cfg.pipeline?.dteMax      ?? 60);
  let   concurrency = parseInt(getFlag('concurrency')  ?? cfg.pipeline?.concurrency ?? 5);
  const myShard     = parseInt(getFlag('shard')        ?? 0);
  const totalShards = parseInt(getFlag('total-shards') ?? 1);

  let toScan = cliSymbols;
  // Load watchlist from watchlist.json (100 stocks with sectors)
  if (useWatchlist || !toScan.length) {
    const watchlistPath = path.join(__dirname, 'watchlist.json');
    if (fs.existsSync(watchlistPath)) {
      try {
        const watchlistData = JSON.parse(fs.readFileSync(watchlistPath, 'utf8'));
        const sectorMapping = watchlistData.sectorMapping || {};
        toScan = watchlistData.symbols || cfg.watchlist || ['SPY','QQQ','MSFT','AAPL'];
        console.log(C.green(`  ✓ Loaded ${toScan.length} symbols from watchlist.json`));
        
        // Count symbols per sector
        const sectorCounts = {};
        toScan.forEach(sym => {
          const sector = sectorMapping[sym] || 'Other';
          sectorCounts[sector] = (sectorCounts[sector] || 0) + 1;
        });
        
        // Show top 5 sectors
        const topSectors = Object.entries(sectorCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5)
          .map(([sector, count]) => `${sector}(${count})`)
          .join(', ');
        console.log(C.dim(`  Sectors: ${topSectors}...`));
      } catch (err) {
        console.log(C.dim(`  ⚠️  Failed to load watchlist.json: ${err.message}`));
        toScan = cfg.watchlist || ['SPY','QQQ','MSFT','AAPL'];
      }
    } else {
      console.log(C.dim(`  ⚠️  watchlist.json not found, using config.json`));
      toScan = cfg.watchlist || ['SPY','QQQ','MSFT','AAPL'];
    }
  }

  const sorted    = [...toScan].sort();
  const mySymbols = totalShards>1 ? sorted.filter((_,i)=>i%totalShards===myShard) : sorted;
  if (!mySymbols.length) { console.error('No symbols to process'); process.exit(1); }

  // Full/daily mode: cap concurrency for Nasdaq rate limiting
  if (!intradayMode && concurrency > 2) {
    console.log(C.dim(`  Concurrency capped at 2 for full/daily mode (Nasdaq rate limit)`));
    concurrency = 2;
  }

  // Check OI data sources (not needed for intraday mode)
  if (!intradayMode) {
    const svcUrl = cfg.yahoosvc?.url || 'https://yahoo-options-svc-m2cty2vxuq-uc.a.run.app';

    // Check Nasdaq
    let nasdaqOk = false;
    try {
      const h = await fetch(`${NASDAQ_BASE}/SPY/option-chain?assetclass=stocks&limit=1`, {headers: NASDAQ_HEADERS, signal:AbortSignal.timeout(8000)});
      nasdaqOk = h.ok;
    } catch(_) {}

    if (nasdaqOk) {
      console.log(C.green(`  ✓ Nasdaq API accessible`));
    } else {
      console.log(C.red(`  ✗ Nasdaq API not reachable`));
    }

    // Check Yahoo Cloud Function
    _yahooAvailable = await checkYahooSvc(svcUrl);
    if (_yahooAvailable) {
      console.log(C.green(`  ✓ Yahoo Cloud Function available`));
    } else {
      console.log(C.dim(`  ⚠ Yahoo Cloud Function not reachable at ${svcUrl}`));
    }

    // Exit only if BOTH are down
    if (!nasdaqOk && !_yahooAvailable) {
      console.error(C.red(`\n  ✗ No OI data source available`));
      console.error(C.dim(`    Check Yahoo Cloud Function: ${svcUrl}/health`));
      console.error(C.dim(`    Redeploy: cd yahoo-svc && firebase deploy --only functions`));
      console.error(C.dim(`    Or check internet for Nasdaq\n`));
      process.exit(1);
    }
  }

  // Seed manifest from R2 if no local copy
  if (!fs.existsSync(MANIFEST_PATH)) {
    console.log(C.dim('  No local manifest — fetching from R2...'));
    const r2m = await fetchR2Manifest(cfg);
    if (r2m?.reports?.length) {
      fs.mkdirSync(REPORTS_DIR, {recursive:true});
      fs.writeFileSync(MANIFEST_PATH, JSON.stringify(r2m));
      console.log(C.green(`  ✓ Seeded manifest from R2 (${r2m.reports.length} symbols)`));
    }
  }

  const modeLabel = intradayMode ? C.gold('INTRADAY') : dailyMode ? C.green('DAILY') : 'FULL';
  console.log(C.bold('\n  NewLeaf Pipeline v2'));
  console.log(C.dim('  ─────────────────────────────────────────────────'));
  console.log(`  Mode:     ${modeLabel}`);
  console.log(`  Symbols:  ${C.gold(String(mySymbols.length))} ${totalShards>1?C.dim(`(shard ${myShard}/${totalShards})`):''}  [${mySymbols.join(', ')}]`);
  console.log(`  DTE:      ${dteMin}–${dteMax}`);
  console.log(`  Parallel: ${concurrency}`);
  console.log(`  Upload:   ${!noUpload&&cfg.r2?C.green('R2'):C.dim('local only')}`);
  console.log(C.dim('  ─────────────────────────────────────────────────\n'));

  const results=[], t0=Date.now();
  const runId = new Date().toISOString().replace(/:/g,'').slice(0,15); // 20260327T0930

  for (let i=0; i<mySymbols.length; i+=concurrency) {
    const batch = mySymbols.slice(i, i+concurrency);
    const res   = await Promise.all(batch.map(sym =>
      processSymbol(sym, cfg, date, dteMin, dteMax)
        .then(r=>({sym,ok:true,score:r.scoring.opportunityScore}))
        .catch(err=>{console.error(C.red(`  [${sym}] FAILED: ${err.message}`));return{sym,ok:false,error:err.message};})
    ));
    results.push(...res);
    console.log();
  }

  const elapsed=((Date.now()-t0)/1000).toFixed(1), ok=results.filter(r=>r.ok), bad=results.filter(r=>!r.ok);
  console.log(C.bold('  ── Summary ─────────────────────────────────────'));
  for (const r of results.sort((a,b)=>(b.score||0)-(a.score||0)))
    console.log(`  ${r.ok?C.green('✓'):C.red('✗')} ${r.sym.padEnd(6)} ${r.ok?'score='+C.gold(r.score.toFixed(1)):r.error}`);
  console.log(C.dim('  ─────────────────────────────────────────────────'));
  console.log(`  ${C.green(ok.length+' ok')}  ${bad.length>0?C.red(bad.length+' failed'):C.dim('0 failed')}  ${C.dim(elapsed+'s')}\n`);

  // ── Log run status to R2 ─────────────────────────────────
  if (!noUpload && cfg.r2?.accountId) {
    try {
      const runLog = {
        runId,
        timestamp:    new Date().toISOString(),
        date,
        mode:         intradayMode?'intraday':dailyMode?'daily':'full',
        durationSec:  parseFloat(elapsed),
        totalSymbols: mySymbols.length,
        ok:           ok.length,
        failed:       bad.length,
        shard:        totalShards>1?`${myShard}/${totalShards}`:null,
        symbols:      results.map(r=>({sym:r.sym, ok:r.ok, score:r.ok?+r.score.toFixed(1):null, error:r.ok?null:r.error}))
      };
      // Prepend to rolling runs log (last 100)
      let runs = [];
      try {
        const res = await fetch(`${cfg.r2.publicBaseUrl}/pipeline-status/runs.json`,{signal:AbortSignal.timeout(5000)});
        if (res.ok) runs = await res.json();
      } catch(_){}
      runs = [runLog, ...runs].slice(0, 100);
      await uploadToR2(cfg.r2, 'pipeline-status/runs.json',   JSON.stringify(runs));
      await uploadToR2(cfg.r2, 'pipeline-status/latest.json', JSON.stringify(runLog));
      console.log(C.green(`  ✓ Run status logged → R2 (${ok.length}/${mySymbols.length} ok, ${elapsed}s)`));
    } catch(err) { console.log(C.dim(`  Status log failed: ${err.message}`)); }
  }

  // Authoritative manifest: ONE atomic rebuild from the local reports dir (the source of truth),
  // replacing the racy per-symbol upserts that silently dropped symbols (the 110-vs-297 bug).
  // Non-sharded watchlist runs only — a shard only has its own reports locally.
  if (useWatchlist && !noUpload && cfg.r2 && totalShards <= 1) {
    try {
      const { buildFromLocalDir } = require('./manifest-builder.cjs');
      let meta = {};
      try { meta = JSON.parse(fs.readFileSync(path.join(__dirname, 'company-metadata.json'), 'utf8')); } catch (_) {}
      const base = cfg.r2.publicBaseUrl || `https://${cfg.r2.accountId}.r2.dev`;
      const m = buildFromLocalDir(REPORTS_DIR, meta, base);
      fs.writeFileSync(MANIFEST_PATH, JSON.stringify(m));
      await uploadToR2(cfg.r2, 'reports/manifest.json', JSON.stringify(m));
      console.log(C.green(`  ✓ Manifest rebuilt authoritatively (${m.count} reports)`));
    } catch (err) { console.log(C.red(`  Manifest rebuild failed: ${err.message}`)); }
  }

  if (!noUpload&&cfg.r2) {
    const base=cfg.r2.publicBaseUrl||`https://${cfg.r2.accountId}.r2.dev`;
    console.log(`  🌐 ${C.dim(base+'/pipeline-status/runs.json')}\n`);
  }
}

main().catch(err=>{ console.error(C.red(`\n  Fatal: ${err.message}\n`)); process.exit(1); });
