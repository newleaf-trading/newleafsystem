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

// ── ATM Contracts for Strategy Builder ───────────────────────────────────────
const { saveATMContracts } = require('./save-atm-contracts');

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
let EARNINGS_CALENDAR = null;
function loadEarningsCalendar() {
  if (EARNINGS_CALENDAR) return EARNINGS_CALENDAR;
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
const sleep  = ms => new Promise(r => setTimeout(r, ms));
const jitter = (base=150) => base + Math.random()*150;

function nextFridayISO() {
  const d = new Date(); d.setHours(0,0,0,0);
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
  d.setHours(0, 0, 0, 0);

  // Find first Friday
  while (d.getDay() !== 5) {
    d.setDate(d.getDate() + 1);
  }

  // Third Friday is 14 days after first Friday
  d.setDate(d.getDate() + 14);

  // If third Friday is in the past, get next month's third Friday
  now.setHours(0, 0, 0, 0);
  if (d <= now) {
    d = new Date(year, month + 1, 1);
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

async function getStockBars(symbol, hdrs, days=250) {
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
  const url = `${NASDAQ_BASE}/${symbol}/option-chain?assetclass=${assetclass}&limit=500`;
  let d = await nasdaqGet(url);

  // Fallback: try other asset class if empty
  if (!d?.data?.table?.rows?.length) {
    const alt = assetclass === 'stocks' ? 'etf' : 'stocks';
    d = await nasdaqGet(`${NASDAQ_BASE}/${symbol}/option-chain?assetclass=${alt}&limit=500`);
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

// ── Technicals ────────────────────────────────────────────────────────────────
const calcSMA = (prices,n) => prices.length<n ? null : prices.slice(-n).reduce((a,b)=>a+b,0)/n;

function calcBB(prices, n=20, k=2) {
  if (prices.length<n) return null;
  const sl=prices.slice(-n), sma=sl.reduce((a,b)=>a+b,0)/n;
  const sd=Math.sqrt(sl.map(p=>(p-sma)**2).reduce((a,b)=>a+b,0)/n);
  return {upper:sma+k*sd, middle:sma, lower:sma-k*sd, width:(k*sd*2/sma)*100};
}

function calcRSI(prices, n=14) {
  if (prices.length<n+1) return null;
  const sl=prices.slice(-(n+1)), diffs=sl.slice(1).map((p,i)=>p-sl[i]);
  const avgG=diffs.filter(d=>d>0).reduce((a,b)=>a+b,0)/n;
  const avgL=diffs.filter(d=>d<0).map(Math.abs).reduce((a,b)=>a+b,0)/n;
  return avgL===0?100:100-100/(1+avgG/avgL);
}

function analyzeTechnicals(bars, spot) {
  const closes=bars.map(b=>b.c), rsi=calcRSI(closes), bb=calcBB(closes);
  const sma50=calcSMA(closes,50), sma100=calcSMA(closes,100), sma200=calcSMA(closes,200), recent=closes.slice(-20);
  let rsiState='Neutral';
  if (rsi!==null) { if(rsi<20)rsiState='Oversold'; else if(rsi<30)rsiState='Near Oversold'; else if(rsi>80)rsiState='Overbought'; else if(rsi>70)rsiState='Near Overbought'; }
  let trendScore=0.5;
  if (sma50&&sma100) { if(spot>sma50&&sma50>sma100)trendScore=0.8; else if(spot<sma50&&sma50<sma100)trendScore=0.2; }
  else if (sma50) trendScore=spot>sma50?0.65:0.35;
  const trendState=trendScore>0.6?'Bullish':trendScore<0.4?'Bearish':'Neutral';
  const bbW=bb?.width??0, volState=bbW<5?'Squeeze':bbW>20?'High Volatility':bbW>12?'High':'Normal';
  const bbSeries=[]; for(let i=19;i<bars.length;i++){const v=calcBB(bars.slice(i-19,i+1).map(b=>b.c));if(v)bbSeries.push({t:bars[i].t,upper:v.upper,middle:v.middle,lower:v.lower});}
  const rsiSeries=[]; for(let i=14;i<bars.length;i++){const v=calcRSI(bars.slice(i-14,i+1).map(b=>b.c));if(v!==null)rsiSeries.push({t:bars[i].t,rsi:v});}

  // Calculate derived fields
  const aboveSMA50 = sma50 ? spot > sma50 : null;
  const aboveSMA100 = sma100 ? spot > sma100 : null;
  const aboveSMA200 = sma200 ? spot > sma200 : null;
  const realizedVol30d = calcRealizedVol(closes);
  const atrPct = calcATRPct(closes, spot);

  return { rsi, sma50, sma100, sma200, bb, avgScore:trendScore,
    rsiEngine:{state:rsiState}, trendEngine:{state:trendState,score:trendScore},
    volatilityEngine:{state:volState,squeeze:bbW<5},
    sr:{support1:Math.min(...recent),resistance1:Math.max(...closes)},
    priceHistory:bars, bbSeries, rsiSeries,
    aboveSMA50, aboveSMA100, aboveSMA200, realizedVol30d, atrPct };
}

// ── Realized Volatility & ATR ─────────────────────────────────────────────────
function calcRealizedVol(closes) {
  if (!closes || closes.length < 30) return null;
  const recent = closes.slice(-30);
  const returns = recent.slice(1).map((p, i) => Math.log(p / recent[i]));
  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance = returns.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / returns.length;
  return Math.sqrt(variance * 252); // annualized
}

function calcATRPct(closes, price) {
  if (!closes || closes.length < 15) return 0.02; // default 2%
  const ranges = closes.slice(-14).map((p, i, arr) =>
    i === 0 ? 0 : Math.abs(arr[i] - arr[i-1]) / arr[i-1]
  );
  return ranges.slice(1).reduce((a, b) => a + b, 0) / 13;
}

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

// ── Scoring ───────────────────────────────────────────────────────────────────
function calcScore(gammaData, technicalData) {
  const {confidence_score:cs=0,band_width_pct:bw=30}=gammaData.analysis;
  const hasGex=(gammaData.analysis.topStrikes||[]).some(s=>Math.abs(s.gamma_exposure)>0);
  const hasOI=(gammaData.analysis.topStrikes||[]).some(s=>(s.call_oi+s.put_oi)>0);
  let gammaPillar;
  if(hasGex){const wallQ=Math.min(1,cs*1.5),bandQ=bw>=3&&bw<=15?1:bw<3?bw/3:Math.max(0,1-(bw-15)/15);gammaPillar=Math.round((wallQ*0.6+bandQ*0.4)*40);}
  else if(hasOI){const bandQ=bw>=3&&bw<=15?1:bw<3?bw/3:Math.max(0,1-(bw-15)/15);gammaPillar=Math.round(bandQ*28);}
  else{const rsi=technicalData.rsi??50,bbW=technicalData.bb?.width??15;const rsiScore=rsi>20&&rsi<80?1-Math.abs(rsi-50)/50:0.2,bbScore=bbW>=3&&bbW<=15?1:bbW<3?bbW/3:Math.max(0,1-(bbW-15)/15);gammaPillar=Math.round((rsiScore*0.5+bbScore*0.5)*22);}
  const iv=gammaData.ivData?.atmIv, ivScore=iv?(iv>20&&iv<50?1:iv<20?iv/20:Math.max(0,1-(iv-50)/50)):0.6;
  const ivPillar=Math.round(ivScore*35), ts=technicalData.trendEngine?.score??0.5, trendPillar=Math.round((0.5+Math.abs(ts-0.5))*25);
  return {total:gammaPillar+ivPillar+trendPillar, pillars:{gamma:gammaPillar,iv:ivPillar,trend:trendPillar}, hasOptions:hasGex||hasOI};
}

function getDirection(gammaData, technicalData) {
  const ts=technicalData.trendEngine?.score??0.5, cs=gammaData.analysis.confidence_score;
  if(ts>0.65&&cs>0.4)return'bullish'; if(ts<0.35&&cs>0.4)return'bearish'; return'neutral';
}

const STRATEGIES={
  iron_condor:     {name:'Iron Condor',     code:'iron_condor',      icon:'🦅',reasons:['Strong gamma walls identified','Optimal band width for premium','Neutral regime confirmed','Sell both sides for income']},
  iron_butterfly:  {name:'Iron Butterfly',  code:'iron_butterfly',   icon:'🦋',reasons:['Gamma band exists but narrow','Tighter profit zone, higher premium','Lower risk than condor','Benefits from low volatility']},
  bull_put_spread: {name:'Bull Put Spread', code:'bull_put_spread',  icon:'📈',reasons:['Bullish trend confirmed','Put wall provides strong support','Collect premium with defined risk','Theta decay works in your favour']},
  bear_call_spread:{name:'Bear Call Spread',code:'bear_call_spread', icon:'📉',reasons:['Bearish trend identified','Call wall acts as resistance','Defined risk, defined reward','Premium income in downtrend']},
  broken_wing_butterfly:{name:'Broken Wing Butterfly',code:'broken_wing_butterfly',icon:'🦗',reasons:['Gamma wall provides dealer floor/ceiling','Credit entry — zero risk on one side','Wider band favours asymmetric structure','IV supports sufficient credit collection']},
};

// ── Broken Wing Butterfly Strike Selection ────────────────────────────────────
function roundToStrike(price, basePrice) {
  if (basePrice < 50)  return Math.round(price);
  if (basePrice < 200) return Math.round(price / 2.5) * 2.5;
  return Math.round(price / 5) * 5;
}

function calculateBWBStrikes(data, direction = 'put') {
  const price = data.snapshot?.price || data.price || 0;
  const pw = data.gammaData?.analysis?.put_wall || price * 0.93;
  const cw = data.gammaData?.analysis?.call_wall || price * 1.07;

  if (direction === 'put') {
    const body = roundToStrike(pw, price);
    const upperWing = roundToStrike(body + (price - body) * 0.6, price);
    const upperWidth = upperWing - body;
    const lowerWing = roundToStrike(body - (upperWidth * 1.7), price);
    return {
      direction: 'put', subtype: 'put_bwb',
      longPutUpper: upperWing, shortPut: body, longPutLower: lowerWing,
      upperWidth, lowerWidth: body - lowerWing,
      maxProfitZone: `$${body}`, zeroRiskAbove: `$${upperWing}`, maxLossBelow: `$${lowerWing}`,
      notes: `Body at $${body} gamma wall. Zero risk above $${upperWing}. Wider lower wing collects credit.`
    };
  }

  if (direction === 'call') {
    const body = roundToStrike(cw, price);
    const lowerWing = roundToStrike(body - (body - price) * 0.6, price);
    const lowerWidth = body - lowerWing;
    const upperWing = roundToStrike(body + (lowerWidth * 1.7), price);
    return {
      direction: 'call', subtype: 'call_bwb',
      longCallLower: lowerWing, shortCall: body, longCallUpper: upperWing,
      lowerWidth, upperWidth: upperWing - body,
      maxProfitZone: `$${body}`, zeroRiskBelow: `$${lowerWing}`, maxLossAbove: `$${upperWing}`,
      notes: `Body at $${body} gamma wall. Zero risk below $${lowerWing}. Wider upper wing collects credit.`
    };
  }
  return null;
}

function scoreBWB(gammaData, bwbStrikes, price) {
  let bonus = 0;
  const { confidence_score, put_wall, call_wall } = gammaData.analysis;
  const atmIv = gammaData.ivData?.atmIv || 0;

  // Bonus: gamma wall confidence is high
  if (confidence_score > 0.6) bonus += 5;

  // Bonus: body is at gamma wall (within 2.5)
  const bodyAtWall = bwbStrikes.direction === 'put'
    ? Math.abs(bwbStrikes.shortPut - put_wall) <= 2.5
    : Math.abs((bwbStrikes.shortCall || 0) - call_wall) <= 2.5;
  if (bodyAtWall) bonus += 5;

  // Bonus: IV in sweet spot (30-50%)
  if (atmIv >= 0.30 && atmIv <= 0.50) bonus += 5;

  // Bonus: price has buffer above upper put wing
  if (bwbStrikes.direction === 'put' && price > 0) {
    const bufferPct = (price - bwbStrikes.longPutUpper) / price;
    if (bufferPct > 0.03) bonus += 3;
  }

  // Penalty: IV too high (>60%)
  if (atmIv > 0.60) bonus -= 5;

  return Math.max(0, bonus);
}

// ── Strategy Selection (updated with BWB) ─────────────────────────────────────
function selectStrategy(gammaData, direction, snapshotPrice) {
  // 1. Iron Condor: strong walls, optimal band (3-15%)
  if (gammaData.condorGate.condorAllowed) return STRATEGIES.iron_condor;

  // 2. Broken Wing Butterfly: wider band (>15%) OR moderate confidence + strong single wall
  const bw = gammaData.analysis.band_width_pct || 0;
  const conf = gammaData.analysis.confidence_score || 0;
  const atmIv = gammaData.ivData?.atmIv || 0;
  const bwbEligible = (
    (bw > 15 && bw <= 40 && conf >= 0.15) ||           // wider band, walls exist (relaxed conf for wider bands)
    (bw > 10 && bw <= 35 && conf >= 0.30 && atmIv >= 0.25)  // moderate band + decent conf + good IV
  );

  if (bwbEligible) {
    const bwbDir = (direction === 'bearish') ? 'call' : 'put';
    const bwbStrikes = calculateBWBStrikes(
      { snapshot: { price: snapshotPrice }, gammaData },
      bwbDir
    );
    const bwbBonus = scoreBWB(gammaData, bwbStrikes, snapshotPrice);

    if (bwbBonus >= 0) {  // any non-negative = eligible
      const strat = { ...STRATEGIES.broken_wing_butterfly };
      strat.subtype = bwbStrikes.subtype;
      strat.strikes = bwbStrikes;
      strat.bwbBonus = bwbBonus;
      strat.characteristics = {
        entryType: 'credit',
        zeroRiskSide: bwbDir === 'put' ? 'above' : 'below',
        maxLossSide: bwbDir === 'put' ? 'below' : 'above',
        dteIdeal: '21-35',
        riskProfile: `low — only at risk on severe ${bwbDir === 'put' ? 'downside' : 'upside'}`
      };
      strat.reasons = [
        `Strong ${bwbDir} gamma wall at $${bwbDir === 'put' ? gammaData.analysis.put_wall : gammaData.analysis.call_wall} acts as dealer ${bwbDir === 'put' ? 'floor' : 'ceiling'}`,
        `Credit entry — zero risk if stock stays ${bwbDir === 'put' ? 'above' : 'below'} $${bwbDir === 'put' ? bwbStrikes.zeroRiskAbove : bwbStrikes.zeroRiskBelow}`.replace(/\$/g, ''),
        `IV at ${atmIv > 1 ? Math.round(atmIv) : Math.round(atmIv * 100)}% provides sufficient premium for asymmetric credit`,
        `Band width ${bw.toFixed(1)}% — too wide for Iron Condor, BWB preferred`
      ];
      return strat;
    }
  }

  // 3. Directional spreads
  if (direction === 'bullish') return STRATEGIES.bull_put_spread;
  if (direction === 'bearish') return STRATEGIES.bear_call_spread;

  // 4. Fallback
  return STRATEGIES.iron_butterfly;
}

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
  const weekly    = contracts.filter(c => { const d=calcDTE(c.expiry||expiryStr); return d>=0&&d<=8; });
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

  log(`Put wall $${gammaData.analysis.put_wall.toFixed(2)} | Call wall $${gammaData.analysis.call_wall.toFixed(2)} | Confidence ${(gammaData.analysis.confidence_score*100).toFixed(0)}%`);

  // 3. Score + strategy
  const {total:opportunityScore, pillars, hasOptions} = calcScore(gammaData, technicalData);
  const direction = getDirection(gammaData, technicalData);
  const strategy  = selectStrategy(gammaData, direction, spot);
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
      bb:technicalData.bb, rsiEngine:technicalData.rsiEngine, trendEngine:technicalData.trendEngine,
      volatilityEngine:technicalData.volatilityEngine, sr:technicalData.sr, avgScore:technicalData.avgScore,
      priceHistory:technicalData.priceHistory, bbSeries:technicalData.bbSeries, rsiSeries:technicalData.rsiSeries,
      aboveSMA50:technicalData.aboveSMA50, aboveSMA100:technicalData.aboveSMA100, aboveSMA200:technicalData.aboveSMA200,
      realizedVol30d:technicalData.realizedVol30d, atrPct:technicalData.atrPct },
    gammaData,
    scoring: {
      opportunityScore: strategy.bwbBonus ? opportunityScore + strategy.bwbBonus : opportunityScore,
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
          report.gammaData = daily.gammaData;
          report.meta.dataSource.openInterest = daily.meta.dataSource.openInterest;
          report.meta.oiConfidence = daily.meta.oiConfidence;
          report.meta.oiEnrichedAt = daily.meta.oiEnrichedAt;
          report.meta.dataSource.greeks = daily.meta.dataSource.greeks;
          // Recalculate score with OI-enriched gamma data
          const {total:oiScore, pillars:oiPillars, hasOptions:oiHasOpts} = calcScore(report.gammaData, technicalData);
          const oiDir = getDirection(report.gammaData, technicalData);
          const oiStrat = selectStrategy(report.gammaData, oiDir, spot);
          report.scoring = {
            opportunityScore: oiStrat.bwbBonus ? oiScore + oiStrat.bwbBonus : oiScore,
            pillars: oiPillars, direction: oiDir, strategy: oiStrat, hasOptions: oiHasOpts,
            ...(oiStrat.code === 'broken_wing_butterfly' ? { bwbBonus: oiStrat.bwbBonus } : {})
          };
        }
      } catch(_) {}
    }
  }

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
      await saveATMContracts(symbol, allContracts, spot, date);
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
      confidence:+gammaData.analysis.confidence_score.toFixed(3),
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

  // 7. Manifest
  const manifest = upsertManifest(symbol, date, {
    opportunityScore: strategy.bwbBonus ? opportunityScore + strategy.bwbBonus : opportunityScore,
    direction,
    strategy:strategy.name, strategyCode:strategy.code, strategyIcon:strategy.icon,
    ...(strategy.subtype ? { strategySubtype: strategy.subtype } : {}),
    price:snapshot.price, changePercent:snapshot.changePercent,
    iv:atmIv??null, hasOptions
  });

  // 8. Upload to R2
  if (!noUpload && cfg.r2?.accountId) {
    try {
      const body = JSON.stringify(report);
      await uploadToR2(cfg.r2, `reports/${symbol}/latest.json`, body);  // always current
      await uploadToR2(cfg.r2, `reports/${symbol}/${tsKey}`,     body);  // timestamped history
      // Only daily/full runs with real OI data write {date}.json — never overwrite with proxy data
      if (!intradayMode && gammaData.analysis.contracts_analyzed > 0) {
        await uploadToR2(cfg.r2, `reports/${symbol}/${date}.json`, body);
      } else if (!intradayMode) {
        log(C.dim(`Skipping ${date}.json upload (proxy gamma, 0 contracts)`));
      }
      await uploadToR2(cfg.r2, 'reports/manifest.json', JSON.stringify(manifest));
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

  if (!noUpload&&cfg.r2) {
    const base=cfg.r2.publicBaseUrl||`https://${cfg.r2.accountId}.r2.dev`;
    console.log(`  🌐 ${C.dim(base+'/pipeline-status/runs.json')}\n`);
  }
}

main().catch(err=>{ console.error(C.red(`\n  Fatal: ${err.message}\n`)); process.exit(1); });
