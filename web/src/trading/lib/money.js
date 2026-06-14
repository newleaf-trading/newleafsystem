/**
 * money.js — Shared money/percent formatters.
 *
 * All formatting happens at the display boundary.
 * Never round inside derivePosition or business logic.
 */

const USD_FMT = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const USD_CENTS = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** "$1,234" — unsigned, no decimals. */
export function usd(n) {
  if (n == null || isNaN(n)) return '—';
  return USD_FMT.format(Math.abs(n));
}

/** "+$176" / "−$611" / "$0" — signed, no decimals. */
export function signedUsd(n) {
  if (n == null || isNaN(n)) return '—';
  if (n === 0) return '$0';
  const abs = USD_FMT.format(Math.abs(n));
  return n > 0 ? `+${abs}` : `\u2212${abs}`;
}

/** "$3.18" — unsigned, 2 decimals (for per-share prices). */
export function usdCents(n) {
  if (n == null || isNaN(n)) return '—';
  return USD_CENTS.format(Math.abs(n));
}

/** "38.7%" — signed or unsigned, configurable decimals. */
export function pct(n, dp = 1) {
  if (n == null || isNaN(n)) return '—';
  return `${n >= 0 ? '' : '\u2212'}${Math.abs(n).toFixed(dp)}%`;
}

/** "+6%" / "−11%" — always shows sign. */
export function signedPct(n, dp = 0) {
  if (n == null || isNaN(n)) return '—';
  if (n === 0) return '0%';
  return `${n > 0 ? '+' : '\u2212'}${Math.abs(n).toFixed(dp)}%`;
}
