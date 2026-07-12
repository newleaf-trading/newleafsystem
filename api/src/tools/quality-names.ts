/**
 * quality-names.ts — the "mean-reversion eligible" set for the reaction gate's exception.
 * ─────────────────────────────────────────────────────────────────────────────
 * Two groups earn the assumption that an oversold dip is a BOUNCE, not a falling knife:
 *   1. Mega-cap stocks  — durable, wide-moat single names (marketCapTier === 'mega').
 *   2. Blue-chip ETFs   — broad index / major commodity baskets that structurally mean-revert.
 *
 * MIRROR of company-metadata.json: the pipeline scanner reads that JSON directly; the API
 * (Cloud Function) has no metadata file, so we keep the same sets here. KEEP IN SYNC — if a
 * name's eligibility changes in company-metadata.json (or the ETF list below), update BOTH the
 * scanner and this file, or the two surfaces disagree on who qualifies.
 *
 * Eligibility only gates WHO can qualify; the exception STILL requires the name to be oversold
 * AND sitting above a defended support wall (see shared/reaction/gate.cjs).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const MEGA_CAPS: ReadonlySet<string> = new Set([
  // Backfilled mega-caps (Magnificent-7 + AVGO/NFLX/TSLA)
  'AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOG', 'META', 'TSLA', 'AVGO', 'NFLX',
  // Originally-tagged mega-caps
  'ADBE', 'CRM', 'INTC', 'TSM', 'MU', 'ASML', 'ORCL', 'V', 'CSCO', 'MA', 'BRK.B', 'HSBC',
]);

// Blue-chip ETFs that mean-revert from oversold. SPY/QQQ (equity indices) are the most reliable
// bouncers there are; GLD/SLV (commodities) mean-revert too but can trend depressed for longer —
// the structural-break guard (spot > put wall) + the defined-risk debit vertical bound that risk.
const MEAN_REVERT_ETFS: ReadonlySet<string> = new Set([
  'SPY', 'QQQ', 'GLD', 'SLV',
]);

/** True if the ticker is a mega-cap (single name). */
export function isMegaCap(ticker: string): boolean {
  return MEGA_CAPS.has((ticker || '').toUpperCase());
}

/** True if the ticker is a blue-chip ETF eligible for the mean-reversion bounce. */
export function isBlueChipETF(ticker: string): boolean {
  return MEAN_REVERT_ETFS.has((ticker || '').toUpperCase());
}

/**
 * True if the ticker earns the mean-reversion exception (mega-cap OR blue-chip ETF).
 * This is what the reaction gate's `isQualityName` should be fed.
 */
export function isMeanReversionEligible(ticker: string): boolean {
  const t = (ticker || '').toUpperCase();
  return MEGA_CAPS.has(t) || MEAN_REVERT_ETFS.has(t);
}

export { MEGA_CAPS, MEAN_REVERT_ETFS };
