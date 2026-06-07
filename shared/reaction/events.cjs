'use strict';

/**
 * events.cjs — Earnings + ex-div event risk logic
 *
 * Reads event-calendar.json (new format) or earnings-calendar.json (old format).
 * Provides exclusion checks and staleness labels for the funnel.
 */

const STALE_DAYS = 7; // calendar older than 7 days → stale

/**
 * Parse event calendar from either format.
 * New: { _lastUpdated, symbols: { SYM: { earnings, exDiv } } }
 * Old: { _lastUpdated, symbols: { SYM: "YYYY-MM-DD"|null } }
 * @param {Object} calData - raw parsed JSON
 * @returns {{ lastUpdated: string|null, symbols: Record<string, { earnings: string|null, exDiv: string|null }>, isNew: boolean }}
 */
function parseEventCalendar(calData) {
  if (!calData?.symbols) return { lastUpdated: null, symbols: {}, isNew: false };
  const lastUpdated = calData._lastUpdated || null;
  const symbols = {};

  for (const [sym, val] of Object.entries(calData.symbols)) {
    // Skip non-symbol entries (comments like _ETFs_INDEX)
    if (sym.startsWith('_')) continue;
    if (val && typeof val === 'object' && ('earnings' in val || 'exDiv' in val)) {
      // New format (with optional provenance)
      symbols[sym] = {
        earnings: val.earnings || null, exDiv: val.exDiv || null,
        earningsSource: val.earningsSource || null, exDivSource: val.exDivSource || null,
      };
    } else if (typeof val === 'string' && val.match(/^\d{4}-/)) {
      // Old format: value is earnings date string
      symbols[sym] = { earnings: val, exDiv: null };
    } else {
      // null or non-date → no data
      symbols[sym] = { earnings: null, exDiv: null };
    }
  }

  const isNew = calData._source != null; // new format has _source
  return { lastUpdated, symbols, isNew };
}

/**
 * Get staleness label for the calendar.
 * @param {string|null} lastUpdated - YYYY-MM-DD
 * @param {Date} [today]
 * @returns {{ stale: boolean, label: string }}
 */
function stalenessLabel(lastUpdated, today) {
  today = today || new Date();
  if (!lastUpdated) return { stale: true, label: 'no calendar loaded' };
  const updated = new Date(lastUpdated);
  const ageMs = today - updated;
  const ageDays = ageMs / 86400000;
  if (ageDays <= STALE_DAYS) {
    return { stale: false, label: `updated ${lastUpdated}` };
  }
  return { stale: true, label: `stale — ${lastUpdated}` };
}

/**
 * Check if a symbol should be excluded for earnings inside DTE window.
 * @param {string|null} earningsDate - YYYY-MM-DD or null
 * @param {number} dteWindow - default 21
 * @param {Date} [today]
 * @returns {{ excluded: boolean, daysTo: number|null, verified: boolean }}
 */
function checkEarningsExclusion(earningsDate, dteWindow, today) {
  dteWindow = dteWindow || 21;
  today = today || new Date();
  if (!earningsDate) return { excluded: false, daysTo: null, verified: false };
  const ed = new Date(earningsDate);
  const daysTo = (ed - today) / 86400000;
  return {
    excluded: daysTo >= 0 && daysTo <= dteWindow,
    daysTo: Math.round(daysTo),
    verified: true,
  };
}

/**
 * Check if a symbol should be excluded for ex-div risk.
 * Applies when: bias includes a short call AND exDiv falls before candidate expiry.
 * @param {string|null} exDivDate - YYYY-MM-DD or null
 * @param {string} bias - strategy bias string
 * @param {number} dteWindow - default 21 (candidate expiry window)
 * @param {Date} [today]
 * @returns {{ excluded: boolean, daysTo: number|null, verified: boolean, reason: string|null }}
 */
function checkExDivExclusion(exDivDate, bias, dteWindow, today) {
  dteWindow = dteWindow || 21;
  today = today || new Date();
  if (!exDivDate) return { excluded: false, daysTo: null, verified: false, reason: null };

  const xd = new Date(exDivDate);
  const daysTo = (xd - today) / 86400000;

  // Only exclude when bias involves a short call (early assignment risk)
  const hasShortCall = bias && (
    bias.includes('bear_call') ||
    bias.includes('iron_condor') ||
    bias.includes('iron_butterfly')
  );

  if (!hasShortCall) {
    return { excluded: false, daysTo: Math.round(daysTo), verified: true, reason: null };
  }

  // Ex-div falls inside the DTE window → exclude
  if (daysTo >= 0 && daysTo <= dteWindow) {
    return {
      excluded: true,
      daysTo: Math.round(daysTo),
      verified: true,
      reason: `ex-div ${exDivDate} inside ${dteWindow}d window, short call risk`,
    };
  }

  return { excluded: false, daysTo: Math.round(daysTo), verified: true, reason: null };
}

module.exports = {
  parseEventCalendar, stalenessLabel, checkEarningsExclusion, checkExDivExclusion,
  STALE_DAYS,
};
