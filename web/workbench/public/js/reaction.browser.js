/**
 * reaction.browser.js — Browser IIFE build of shared/reaction/
 * Auto-generated from shared/reaction/*.cjs — keep in sync.
 * Exposes window.Reaction with all exported functions.
 */
(function(window) {
'use strict';

// ── premium.cjs ──
const PREMIUM_THRESHOLDS = { cheap: 0.95, fair: 1.15 };
function premiumLabel(ivRv) {
  if (ivRv == null || !isFinite(ivRv) || ivRv <= 0) return '--';
  if (ivRv <= PREMIUM_THRESHOLDS.cheap) return 'cheap';
  if (ivRv < PREMIUM_THRESHOLDS.fair) return 'fair';
  return 'rich';
}
function premiumScore(ivRv) {
  if (ivRv == null || !isFinite(ivRv) || ivRv <= 0) return 0;
  if (ivRv <= 0.8) return 0;
  if (ivRv >= 1.5) return 100;
  return Math.round(((ivRv - 0.8) / 0.7) * 100);
}

// ── zones.cjs ──
const MERGE_ATR_MULT = 0.6, TOUCH_ATR_MULT = 0.25;
function clusterLevels(spot, levels, atrPct) {
  if (!spot || !levels?.length || !atrPct) return { supportZones: [], resistanceZones: [] };
  const mt = MERGE_ATR_MULT * atrPct * spot, tw = TOUCH_ATR_MULT * atrPct * spot;
  const sLevels = levels.filter(l => l.price > 0 && l.price < spot && (spot - l.price) / spot < 0.15).sort((a, b) => a.price - b.price);
  const rLevels = levels.filter(l => l.price > 0 && l.price > spot && (l.price - spot) / spot < 0.15).sort((a, b) => a.price - b.price);
  function merge(sorted, type) {
    const zones = [];
    for (const level of sorted) {
      const last = zones[zones.length - 1];
      if (last && Math.abs(level.price - last.hi) <= mt) { last.hi = Math.max(last.hi, level.price); last.sources.push(level.label || level.source); }
      else zones.push({ lo: level.price, hi: level.price, touchLo: 0, touchHi: 0, sources: [level.label || level.source], type });
    }
    for (const z of zones) { z.touchLo = z.lo - tw; z.touchHi = z.hi + tw; }
    return zones;
  }
  return { supportZones: merge(sLevels, 'support'), resistanceZones: merge(rLevels, 'resistance') };
}
function gatherLevels(spot, opts) {
  const levels = [];
  const add = (p, s, l) => { if (p && p > 0 && isFinite(p)) levels.push({ price: p, source: s, label: l }); };
  if (opts.putWall) add(opts.putWall, 'gamma_wall', 'Put wall');
  if (opts.callWall) add(opts.callWall, 'gamma_wall', 'Call wall');
  if (opts.sma50) add(opts.sma50, 'moving_average', 'SMA50');
  if (opts.sma100) add(opts.sma100, 'moving_average', 'SMA100');
  if (opts.sma200) add(opts.sma200, 'moving_average', 'SMA200');
  if (opts.bbLower) add(opts.bbLower, 'bollinger', 'BB lower');
  if (opts.bbUpper) add(opts.bbUpper, 'bollinger', 'BB upper');
  if (opts.bars?.length >= 20) {
    const recent = opts.bars.slice(-20);
    add(Math.min(...recent.map(b => b.low ?? b.l)), 'swing', '20d low');
    add(Math.max(...recent.map(b => b.high ?? b.h)), 'swing', '20d high');
  }
  return levels;
}
function nearestScoreableZones(spot, supportStats, resistanceStats) {
  const scoreS = (supportStats || []).filter(s => !s.untested && s.zone.hi < spot).sort((a, b) => (spot - a.zone.hi) - (spot - b.zone.hi));
  const scoreR = (resistanceStats || []).filter(r => !r.untested && r.zone.lo > spot).sort((a, b) => (a.zone.lo - spot) - (b.zone.lo - spot));
  const allS = (supportStats || []).filter(s => s.zone.hi < spot).sort((a, b) => (spot - a.zone.hi) - (spot - b.zone.hi));
  const allR = (resistanceStats || []).filter(r => r.zone.lo > spot).sort((a, b) => (a.zone.lo - spot) - (b.zone.lo - spot));
  return { nearestSupport: scoreS[0] || allS[0] || null, nearestResistance: scoreR[0] || allR[0] || null };
}

// ── stats.cjs ──
const MIN_TOUCHES = 3, WILSON_Z = 1.96;
function wilsonInterval(succ, total, z) {
  z = z || WILSON_Z; if (total === 0) return { smoothed: 0, ciLow: 0, ciHigh: 0 };
  const p = succ / total, z2 = z * z, d = 1 + z2 / total;
  const c = (p + z2 / (2 * total)) / d, m = (z / d) * Math.sqrt((p * (1 - p)) / total + z2 / (4 * total * total));
  return { smoothed: c, ciLow: Math.max(0, c - m), ciHigh: Math.min(1, c + m) };
}
function findZoneTouches(candles, zone, type) {
  const events = []; let inZone = false;
  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const t = type === 'support' ? (c.low <= zone.touchHi && c.high >= zone.touchLo) : (c.high >= zone.touchLo && c.low <= zone.touchHi);
    if (t && !inZone) { events.push({ index: i, date: c.date, candle: c, touchClose: c.close }); inZone = true; } else if (!t) inZone = false;
  }
  return events;
}
function avgVolume(candles, endIdx, w) { w = w || 20; const sl = candles.slice(Math.max(0, endIdx - w), endIdx).filter(c => c.volume > 0); return sl.length ? sl.reduce((s, c) => s + c.volume, 0) / sl.length : 0; }
function classifySupportTouch(ev, candles, zone) {
  const bkT = zone.touchLo * 0.99, boT = ev.touchClose * 1.03, end = Math.min(ev.index + 5, candles.length);
  let cls = 'unresolved', cb = 0, fr = false;
  for (let i = ev.index + 1; i < end; i++) { const c = candles[i]; if (c.close >= boT && cls === 'unresolved') { cls = 'hold'; break; } if (c.close < bkT) { cb++; if (cb >= 2) { cls = 'break'; break; } } else { if (cb > 0 && c.close >= zone.touchLo) fr = true; cb = 0; } }
  if (cls === 'unresolved' && fr) cls = 'fake_break'; if (cls === 'unresolved') cls = 'hold';
  const av = avgVolume(candles, ev.index);
  return { ...ev, classification: cls, volConf: !!(ev.candle.volume && av > 0 && ev.candle.volume > av) };
}
function classifyResistanceTouch(ev, candles, zone) {
  const boT = zone.touchHi * 1.01, rjT = ev.touchClose * 0.97, end = Math.min(ev.index + 5, candles.length);
  let cls = 'unresolved', ca = 0, fr = false;
  for (let i = ev.index + 1; i < end; i++) { const c = candles[i]; if (c.close <= rjT && cls === 'unresolved') { cls = 'reject'; break; } if (c.close > boT) { ca++; if (ca >= 2) { cls = 'breakout'; break; } } else { if (ca > 0 && c.close <= zone.touchHi) fr = true; ca = 0; } }
  if (cls === 'unresolved' && fr) cls = 'fake_breakout'; if (cls === 'unresolved') cls = 'reject';
  const av = avgVolume(candles, ev.index);
  return { ...ev, classification: cls, volConf: !!(ev.candle.volume && av > 0 && ev.candle.volume > av) };
}
function computeZoneScore(sr, tc, fr, vcr, zone) {
  let sc = Math.min(30, sr * 30) + Math.min(15, (Math.min(tc, 10) / 10) * 15) + Math.max(0, (1 - fr) * 15) + vcr * 10;
  if (zone.sources.some(s => s.toLowerCase().includes('wall'))) sc += 5;
  if (zone.sources.length >= 2) sc += 5;
  return Math.round(Math.min(100, Math.max(0, sc * (100 / 80))));
}
function analyzeZone(candles, zone, type, opts) {
  const minT = opts?.minTouches ?? MIN_TOUCHES;
  const touches = findZoneTouches(candles, zone, type);
  const classified = type === 'support' ? touches.map(t => classifySupportTouch(t, candles, zone)) : touches.map(t => classifyResistanceTouch(t, candles, zone));
  const total = classified.length, untested = total < minT;
  if (type === 'support') {
    const holds = classified.filter(c => c.classification === 'hold').length, breaks = classified.filter(c => c.classification === 'break').length, fakes = classified.filter(c => c.classification === 'fake_break').length;
    const rr = total > 0 ? holds / total : 0, w = wilsonInterval(holds, total), vcr = total > 0 ? classified.filter(c => c.volConf).length / total : 0;
    return { zone, type, touchCount: total, holdCount: holds, breakCount: breaks, fakeBreakCount: fakes, rawRate: rr, smoothedRate: w.smoothed, ciLow: w.ciLow, ciHigh: w.ciHigh, volConfRate: vcr, untested, touches: classified, score: untested ? 0 : computeZoneScore(w.smoothed, total, breaks / (total || 1), vcr, zone) };
  }
  const rejects = classified.filter(c => c.classification === 'reject').length, breakouts = classified.filter(c => c.classification === 'breakout').length, fakes = classified.filter(c => c.classification === 'fake_breakout').length;
  const rr = total > 0 ? rejects / total : 0, w = wilsonInterval(rejects, total), vcr = total > 0 ? classified.filter(c => c.volConf).length / total : 0;
  return { zone, type, touchCount: total, rejectCount: rejects, breakoutCount: breakouts, fakeBreakoutCount: fakes, rawRate: rr, smoothedRate: w.smoothed, ciLow: w.ciLow, ciHigh: w.ciHigh, volConfRate: vcr, untested, touches: classified, score: untested ? 0 : computeZoneScore(w.smoothed, total, breakouts / (total || 1), vcr, zone) };
}

// ── forward.cjs ──
function median(arr) { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b), m = Math.floor(s.length / 2); return s.length % 2 !== 0 ? s[m] : (s[m - 1] + s[m]) / 2; }
function percentile(arr, p) { if (!arr.length) return null; const s = [...arr].sort((a, b) => a - b), idx = (p / 100) * (s.length - 1), lo = Math.floor(idx), hi = Math.ceil(idx); return lo === hi ? s[lo] : s[lo] + (s[hi] - s[lo]) * (idx - lo); }
function forwardReturns(candles, touches, windows, type) {
  windows = windows || [3, 5, 10, 20]; type = type || 'support'; const result = {};
  for (const w of windows) { const rets = []; for (const t of touches) { const b = candles[t.index]?.close, f = candles[t.index + w]?.close; if (b && f) rets.push((f - b) / b); } result['median' + w + 'd'] = median(rets); }
  const am = []; for (const t of touches) { const b = candles[t.index]?.close; if (!b) continue; let ma = 0; const end = Math.min(t.index + 10, candles.length); for (let i = t.index + 1; i < end; i++) { const mv = type === 'support' ? (candles[i].low - b) / b : (candles[i].high - b) / b; if (type === 'support' && mv < ma) ma = mv; if (type === 'resistance' && mv > ma) ma = mv; } am.push(ma); }
  result.p75Adverse = percentile(am.map(Math.abs), 75); return result;
}

// ── regime.cjs ──
const UNCLEAR_CONFIDENCE_CAP = 40;
function computeContainment(candles, sZone, rZone, lookbackDays) {
  if (!sZone || !rZone || sZone.hi >= rZone.lo) return 0;
  const lo = sZone.touchLo, hi = rZone.touchHi, recent = candles.slice(-lookbackDays);
  if (!recent.length) return 0;
  let inside = 0; for (const c of recent) { if (c.low >= lo && c.high <= hi) inside++; }
  return inside / recent.length;
}
function classifyRegime(spot, nearS, nearR, containment, adx, atrPct) {
  const atrDist = (atrPct || 0.02) * spot, scoreable = z => z && !z.untested;
  if (containment > 0.70 && (adx || 25) < 20 && scoreable(nearS) && scoreable(nearR)) { const m = Math.min(containment - 0.70, 1 - (adx || 25) / 25); return { regime: 'range_bound', confidence: Math.round(55 + m * 100) }; }
  if (scoreable(nearR) && spot > nearR.zone.touchHi) { const d = (spot - nearR.zone.hi) / atrDist; return { regime: 'breakout_up', confidence: Math.round(Math.min(90, 50 + d * 20)) }; }
  if (scoreable(nearS) && spot < nearS.zone.touchLo) { const d = (nearS.zone.lo - spot) / atrDist; return { regime: 'breakout_down', confidence: Math.round(Math.min(90, 50 + d * 20)) }; }
  if (scoreable(nearS)) { const d = spot - nearS.zone.hi; if (d >= 0 && d < 0.5 * atrDist) { const p = 1 - d / (0.5 * atrDist); return { regime: 'testing_support', confidence: Math.round(45 + p * 30 + (nearS.smoothedRate || 0) * 15) }; } }
  if (scoreable(nearR)) { const d = nearR.zone.lo - spot; if (d >= 0 && d < 0.5 * atrDist) { const p = 1 - d / (0.5 * atrDist); return { regime: 'testing_resistance', confidence: Math.round(45 + p * 30 + (nearR.smoothedRate || 0) * 15) }; } }
  if ((adx || 25) > 25) return { regime: 'trending', confidence: Math.round(Math.min(75, 40 + ((adx || 25) - 25) * 2)) };
  return { regime: 'unclear', confidence: Math.min(UNCLEAR_CONFIDENCE_CAP, 30) };
}

// ── score.cjs ──
const SCORE_WEIGHTS = { zoneScore: 0.30, premiumRichness: 0.20, regimeConfidence: 0.15, distanceGeometry: 0.15, optionLiquidity: 0.10, forwardEdge: 0.10 };
const VOL_ETP_LIST = new Set(['UVXY','SVXY','VXX','VIXY','VIXM','SQQQ','TQQQ','SPXU','SPXL','TZA','TNA','SOXS','SOXL','LABU','LABD','ARKK']);
const RELEVANT_RAIL_MIN = 65;
function setupQuality(input) {
  const components = {}; let exclusionReason = null;
  const dteWindow = input.dteWindow || 21, today = input._today || new Date();
  const earningsVerified = input.earningsDate != null;
  if (input.earningsDate) { const ed = new Date(input.earningsDate), d = (ed - today) / 86400000; if (d >= 0 && d <= dteWindow) exclusionReason = 'earnings_in_window'; }
  if (!exclusionReason && input.exDivDate) { const xd = new Date(input.exDivDate), d = (xd - today) / 86400000; if (d >= 0 && d <= dteWindow) exclusionReason = 'exdiv_in_window'; }
  if (!exclusionReason && input.untested) exclusionReason = 'untested_zone';
  if (!exclusionReason && VOL_ETP_LIST.has(input.symbol)) exclusionReason = 'vol_etp';
  if (!exclusionReason && input.spreadPct && input.spreadPct > 5) exclusionReason = 'illiquid';
  if (!exclusionReason && input.oiDataAvailable === true && input.topStrikesOI != null && input.topStrikesOI < 500) exclusionReason = 'illiquid';
  const liquidityVerified = input.oiDataAvailable !== false;
  components.zoneScore = input.zoneScore || 0;
  components.premiumRichness = premiumScore(input.ivRv);
  components.regimeConfidence = input.regimeConfidence || 0;
  const dist = Math.abs(input.distancePct || 0);
  components.distanceGeometry = Math.round(Math.max(0, (1 - dist / 5) * 100));
  let liqScore = 50;
  if (input.oiDataAvailable !== false && input.topStrikesOI != null) { if (input.topStrikesOI > 50000) liqScore = 100; else if (input.topStrikesOI > 20000) liqScore = 80; else if (input.topStrikesOI > 5000) liqScore = 60; else liqScore = 30; }
  if (input.spreadPct != null) { if (input.spreadPct < 1) liqScore = Math.max(liqScore, 90); else if (input.spreadPct > 3) liqScore = Math.min(liqScore, 40); }
  components.optionLiquidity = liqScore;
  components.forwardEdge = Math.round(Math.min(100, Math.max(0, (input.median5d || 0) * 2000)));
  let eventPenalty = 0;
  if (input.earningsDate) { const d = (new Date(input.earningsDate) - today) / 86400000; if (d >= 0 && d <= dteWindow * 1.5) eventPenalty = Math.round(Math.max(0, 30 - d)); }
  components.eventRiskPenalty = eventPenalty;
  let total = Math.round(Math.min(100, Math.max(0, components.zoneScore * SCORE_WEIGHTS.zoneScore + components.premiumRichness * SCORE_WEIGHTS.premiumRichness + components.regimeConfidence * SCORE_WEIGHTS.regimeConfidence + components.distanceGeometry * SCORE_WEIGHTS.distanceGeometry + components.optionLiquidity * SCORE_WEIGHTS.optionLiquidity + components.forwardEdge * SCORE_WEIGHTS.forwardEdge - eventPenalty)));
  // Relevant-rail gate
  let gateReason = null;
  const bias = input.strategyBias || '', sZS = input.supportZoneScore ?? 0, rZS = input.resistanceZoneScore ?? 0;
  const needsS = bias.includes('bull_put') || bias.includes('bull_call') || input.regime === 'testing_support';
  const needsR = bias.includes('bear_call') || bias.includes('bear_put') || input.regime === 'testing_resistance';
  const needsBoth = bias.includes('condor') || bias.includes('butterfly');
  if (!exclusionReason) {
    if (needsBoth && (sZS < RELEVANT_RAIL_MIN || rZS < RELEVANT_RAIL_MIN)) { gateReason = 'weak relevant rail'; total = Math.min(total, 64); }
    else if (needsS && sZS < RELEVANT_RAIL_MIN) { gateReason = 'weak relevant rail'; total = Math.min(total, 64); }
    else if (needsR && rZS < RELEVANT_RAIL_MIN) { gateReason = 'weak relevant rail'; total = Math.min(total, 64); }
  }
  if (!exclusionReason && total < 65) exclusionReason = 'low_score';
  return { total, components, exclusionReason, liquidityVerified, earningsVerified, gateReason };
}

// ── rangeQuality ──
function rangeQuality(input) {
  let sc = Math.min(40, (input.containment || 0) * 40);
  const adx = input.adx || 25; sc += Math.max(0, (1 - adx / 25) * 25);
  const sS = input.supportTested && input.supportScore >= 65, rS = input.resistanceTested && input.resistanceScore >= 65;
  if (sS && rS) sc += 20; else if (sS || rS) sc += 8; else if (input.supportTested || input.resistanceTested) sc += 3;
  if (input.posInRange != null) { sc += Math.max(0, (1 - Math.abs(input.posInRange - 0.5) * 2) * 15); }
  return Math.round(Math.min(100, Math.max(0, sc)));
}

// ── bias.cjs (posInRange-aware) ──
const STRONG_RAIL_MIN_B = 65;
const INCOME_BIASES = new Set(['bull_put_spread','bear_call_spread','iron_condor','iron_butterfly','broken_wing_butterfly','skewed_condor']);
const DIRECTIONAL_BIASES = new Set(['bull_call_spread','bear_put_spread']);
function calcPosInRange(spot, sLo, rHi) { if (sLo==null||rHi==null) return null; const w=rHi-sLo; if(w<=0)return null; return Math.max(0,Math.min(1,(spot-sLo)/w)); }
function mapBias(input) {
  const { regime, supportScore: sS, resistanceScore: rS, supportTested: sT, resistanceTested: rT, ivRv, spot, supportLo, resistanceHi, bandCentre, gammaConfidence, containment, adx, trendIntoZone } = input;
  const sStrong = sT && sS >= STRONG_RAIL_MIN_B, rStrong = rT && rS >= STRONG_RAIL_MIN_B;
  const halfBlind = (sT && !rT) || (!sT && rT);
  const posInRange = calcPosInRange(spot, supportLo, resistanceHi);
  const ivRich = ivRv >= 1.15, ivCheap = ivRv <= 0.95;
  const out = (bias, cat, skew, body, rail, ntr) => ({ bias, category: cat, halfBlind, noTradeReason: ntr||null, posInRange, structureGeometry: { type: bias, skew: skew||'none', bodyAnchor: body||null, testedRail: rail||null } });
  if (regime === 'trending' && trendIntoZone) return out('no_trade','none','none',null,null,'breakdown/breakout risk — trend into zone, ADX '+Math.round(adx||25));
  if (regime === 'breakout_up') { if(ivRv<=1.0) return out('bull_call_spread','directional','bullish'); if(sStrong) return out('bull_put_spread','income','bullish','support','support'); return out('no_trade','none'); }
  if (regime === 'breakout_down') { if(ivRv<=1.0) return out('bear_put_spread','directional','bearish'); if(rStrong) return out('bear_call_spread','income','bearish','resistance','resistance'); return out('no_trade','none'); }
  const bothStrong = sStrong && rStrong, rb = regime==='range_bound'||((containment||0)>0.6&&(adx||25)<20);
  if (rb && bothStrong && posInRange!=null && posInRange>=0.40 && posInRange<=0.60) { if(posInRange>=0.45&&posInRange<=0.55&&(gammaConfidence||0)>0.6) return out('iron_butterfly','income','none','centre','both'); return out('iron_condor','income','none','centre','both'); }
  if (rb && bothStrong && posInRange!=null) { if(posInRange>=0.30&&posInRange<0.40) return out('skewed_condor','income','bullish','support','both'); if(posInRange>0.60&&posInRange<=0.70) return out('skewed_condor','income','bearish','resistance','both'); }
  const nearS = (posInRange!=null&&posInRange<0.40)||regime==='testing_support';
  if (nearS && sStrong) { if(ivRich) return out('bull_put_spread','income','bullish','support','support'); if(ivCheap) return out('bull_call_spread','directional','bullish',null,'support'); return out('broken_wing_butterfly','income','bullish','support','support'); }
  const nearR = (posInRange!=null&&posInRange>0.60)||regime==='testing_resistance';
  if (nearR && rStrong) { if(ivRich) return out('bear_call_spread','income','bearish','resistance','resistance'); if(ivCheap) return out('bear_put_spread','directional','bearish',null,'resistance'); return out('broken_wing_butterfly','income','bearish','resistance','resistance'); }
  if (regime==='trending') { if(sStrong&&ivRv>=1.0) return out('bull_put_spread','income','bullish','support','support'); if(rStrong&&ivRv>=1.0) return out('bear_call_spread','income','bearish','resistance','resistance'); return out('no_trade','none'); }
  if (sStrong&&ivRich) return out('bull_put_spread','income','bullish','support','support');
  if (rStrong&&ivRich) return out('bear_call_spread','income','bearish','resistance','resistance');
  return out('no_trade','none');
}

// ── Exports ──
window.Reaction = {
  premiumLabel, premiumScore, PREMIUM_THRESHOLDS,
  clusterLevels, gatherLevels, nearestScoreableZones, MERGE_ATR_MULT, TOUCH_ATR_MULT,
  analyzeZone, findZoneTouches, wilsonInterval, computeZoneScore, MIN_TOUCHES,
  forwardReturns, median, percentile,
  computeContainment, classifyRegime, UNCLEAR_CONFIDENCE_CAP,
  setupQuality, rangeQuality, SCORE_WEIGHTS, VOL_ETP_LIST, RELEVANT_RAIL_MIN,
  mapBias, INCOME_BIASES, DIRECTIONAL_BIASES,
};

})(typeof window !== 'undefined' ? window : globalThis);
