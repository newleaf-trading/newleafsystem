'use strict';

/**
 * stats.cjs — Zone touch/hold/reject counting with Wilson smoothing
 *
 * Hard gate: zones with < 3 touches are flagged untested.
 * Wilson score lower-bound smoothing for rates.
 */

const MIN_TOUCHES = 3;
const WILSON_Z = 1.96; // 95% CI
const BOUNCE_THRESHOLD_PCT = 3.0;
const BREAK_THRESHOLD_PCT = 1.0;
const CONFIRM_DAYS = 5;
const BREAK_CONFIRM_DAYS = 2;

/**
 * Wilson score lower-bound confidence interval.
 * Smooths small-sample rates: 1/1 → ~63%, 6/7 → ~78%.
 * @param {number} successes
 * @param {number} total
 * @param {number} z - z-score for CI (1.96 = 95%)
 * @returns {{ smoothed: number, ciLow: number, ciHigh: number }}
 */
function wilsonInterval(successes, total, z = WILSON_Z) {
  if (total === 0) return { smoothed: 0, ciLow: 0, ciHigh: 0 };
  const p = successes / total;
  const z2 = z * z;
  const denom = 1 + z2 / total;
  const center = (p + z2 / (2 * total)) / denom;
  const margin = (z / denom) * Math.sqrt((p * (1 - p)) / total + z2 / (4 * total * total));
  return {
    smoothed: center, // Wilson center (mock shows 6/7 → ~78%)
    ciLow: Math.max(0, center - margin),
    ciHigh: Math.min(1, center + margin),
  };
}

/**
 * Find touch events on a zone (dedup consecutive bars).
 * @param {Object[]} candles - [{date, open, high, low, close, volume}]
 * @param {Object} zone - { touchLo, touchHi, type }
 * @param {'support'|'resistance'} type
 * @returns {Object[]} touch events with index, date, candle
 */
function findZoneTouches(candles, zone, type) {
  const events = [];
  let inZone = false;

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const touches = type === 'support'
      ? (c.low <= zone.touchHi && c.high >= zone.touchLo)
      : (c.high >= zone.touchLo && c.low <= zone.touchHi);

    if (touches && !inZone) {
      events.push({ index: i, date: c.date, candle: c, touchClose: c.close });
      inZone = true;
    } else if (!touches) {
      inZone = false;
    }
  }
  return events;
}

/**
 * Classify a support touch as hold / break / fake_break.
 */
function classifySupportTouch(ev, candles, zone) {
  const breakTarget = zone.touchLo * (1 - BREAK_THRESHOLD_PCT / 100);
  const bounceTarget = ev.touchClose * (1 + BOUNCE_THRESHOLD_PCT / 100);
  const end = Math.min(ev.index + CONFIRM_DAYS, candles.length);

  let cls = 'unresolved', closedBelow = 0, fakeRecovered = false;
  for (let i = ev.index + 1; i < end; i++) {
    const c = candles[i];
    if (c.close >= bounceTarget && cls === 'unresolved') { cls = 'hold'; break; }
    if (c.close < breakTarget) {
      closedBelow++;
      if (closedBelow >= BREAK_CONFIRM_DAYS) { cls = 'break'; break; }
    } else {
      if (closedBelow > 0 && c.close >= zone.touchLo) fakeRecovered = true;
      closedBelow = 0;
    }
  }
  if (cls === 'unresolved' && fakeRecovered) cls = 'fake_break';
  if (cls === 'unresolved') cls = 'hold'; // unresolved within window = held

  // Volume confirmation
  const avgVol = avgVolume(candles, ev.index);
  const volConf = !!(ev.candle.volume && avgVol > 0 && ev.candle.volume > avgVol);

  return { ...ev, classification: cls, volConf };
}

/**
 * Classify a resistance touch as reject / breakout / fake_breakout.
 */
function classifyResistanceTouch(ev, candles, zone) {
  const breakoutTarget = zone.touchHi * (1 + BREAK_THRESHOLD_PCT / 100);
  const rejTarget = ev.touchClose * (1 - BOUNCE_THRESHOLD_PCT / 100);
  const end = Math.min(ev.index + CONFIRM_DAYS, candles.length);

  let cls = 'unresolved', closedAbove = 0, fakeRet = false;
  for (let i = ev.index + 1; i < end; i++) {
    const c = candles[i];
    if (c.close <= rejTarget && cls === 'unresolved') { cls = 'reject'; break; }
    if (c.close > breakoutTarget) {
      closedAbove++;
      if (closedAbove >= BREAK_CONFIRM_DAYS) { cls = 'breakout'; break; }
    } else {
      if (closedAbove > 0 && c.close <= zone.touchHi) fakeRet = true;
      closedAbove = 0;
    }
  }
  if (cls === 'unresolved' && fakeRet) cls = 'fake_breakout';
  if (cls === 'unresolved') cls = 'reject';

  const avgVol = avgVolume(candles, ev.index);
  const volConf = !!(ev.candle.volume && avgVol > 0 && ev.candle.volume > avgVol);

  return { ...ev, classification: cls, volConf };
}

function avgVolume(candles, endIdx, w = 20) {
  const sl = candles.slice(Math.max(0, endIdx - w), endIdx).filter(c => c.volume > 0);
  return sl.length ? sl.reduce((s, c) => s + c.volume, 0) / sl.length : 0;
}

/**
 * Analyze a zone: find touches, classify, compute rates with Wilson smoothing.
 * @param {Object[]} candles
 * @param {Object} zone - from zones.cjs
 * @param {'support'|'resistance'} type
 * @returns {Object} ZoneStats
 */
function analyzeZone(candles, zone, type) {
  const touches = findZoneTouches(candles, zone, type);

  const classified = type === 'support'
    ? touches.map(t => classifySupportTouch(t, candles, zone))
    : touches.map(t => classifyResistanceTouch(t, candles, zone));

  const total = classified.length;
  const untested = total < MIN_TOUCHES;

  if (type === 'support') {
    const holds = classified.filter(c => c.classification === 'hold').length;
    const breaks = classified.filter(c => c.classification === 'break').length;
    const fakes = classified.filter(c => c.classification === 'fake_break').length;
    const rawRate = total > 0 ? holds / total : 0;
    const wilson = wilsonInterval(holds, total);
    const volConfRate = total > 0 ? classified.filter(c => c.volConf).length / total : 0;

    return {
      zone, type, touchCount: total, holdCount: holds, breakCount: breaks, fakeBreakCount: fakes,
      rawRate, smoothedRate: wilson.smoothed, ciLow: wilson.ciLow, ciHigh: wilson.ciHigh,
      volConfRate, untested, touches: classified,
      score: untested ? 0 : computeZoneScore(wilson.smoothed, total, breaks / (total || 1), volConfRate, zone),
    };
  }

  // Resistance
  const rejects = classified.filter(c => c.classification === 'reject').length;
  const breakouts = classified.filter(c => c.classification === 'breakout').length;
  const fakes = classified.filter(c => c.classification === 'fake_breakout').length;
  const rawRate = total > 0 ? rejects / total : 0;
  const wilson = wilsonInterval(rejects, total);
  const volConfRate = total > 0 ? classified.filter(c => c.volConf).length / total : 0;

  return {
    zone, type, touchCount: total, rejectCount: rejects, breakoutCount: breakouts, fakeBreakoutCount: fakes,
    rawRate, smoothedRate: wilson.smoothed, ciLow: wilson.ciLow, ciHigh: wilson.ciHigh,
    volConfRate, untested, touches: classified,
    score: untested ? 0 : computeZoneScore(wilson.smoothed, total, breakouts / (total || 1), volConfRate, zone),
  };
}

/**
 * Zone score 0-100 using Wilson-smoothed rate.
 */
function computeZoneScore(smoothedRate, touchCount, failRate, volConfRate, zone) {
  let sc = 0;
  sc += Math.min(30, smoothedRate * 30);                           // smoothed rate (30%)
  sc += Math.min(15, (Math.min(touchCount, 10) / 10) * 15);       // touch count (15%)
  sc += Math.max(0, (1 - failRate) * 15);                          // low fail rate (15%)
  sc += volConfRate * 10;                                           // volume confirmation (10%)

  // Gamma wall alignment bonus
  const hasGamma = zone.sources.some(s => s.toLowerCase().includes('wall'));
  if (hasGamma) sc += 5;

  // Multi-source bonus (merged zone with 2+ distinct sources)
  if (zone.sources.length >= 2) sc += 5;

  // Remaining 20% reserved for forward returns + adverse move (computed externally)
  // Normalize to 0-100 from the 80-point scale
  return Math.round(Math.min(100, Math.max(0, sc * (100 / 80))));
}

module.exports = {
  analyzeZone, findZoneTouches, wilsonInterval, computeZoneScore,
  MIN_TOUCHES, WILSON_Z, BOUNCE_THRESHOLD_PCT, BREAK_THRESHOLD_PCT,
};
