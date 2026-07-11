/**
 * quality-names.ts — mega-cap "quality" set for the reaction gate's mean-reversion exception.
 * ─────────────────────────────────────────────────────────────────────────────
 * MIRROR of company-metadata.json entries with marketCapTier === 'mega'. The pipeline
 * scanner reads that JSON directly; the API (Cloud Function) has no metadata file, so we
 * keep the same set here. KEEP IN SYNC: if a name's marketCapTier changes in
 * company-metadata.json, update this set — otherwise scanner and Discover would disagree
 * on who is eligible for the quality mean-reversion bounce.
 *
 * Eligibility here only gates WHO can qualify; the actual exception still requires the
 * name to be oversold AND sitting above a defended support wall (see shared/reaction/gate.cjs).
 * ─────────────────────────────────────────────────────────────────────────────
 */

const MEGA_CAPS: ReadonlySet<string> = new Set([
  // Backfilled mega-caps (Magnificent-7 + AVGO/NFLX/TSLA)
  'AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOG', 'META', 'TSLA', 'AVGO', 'NFLX',
  // Originally-tagged mega-caps
  'ADBE', 'CRM', 'INTC', 'TSM', 'MU', 'ASML', 'ORCL', 'V', 'CSCO', 'MA', 'BRK.B', 'HSBC',
]);

/** True if the ticker is a mega-cap eligible for the quality mean-reversion exception. */
export function isMegaCap(ticker: string): boolean {
  return MEGA_CAPS.has((ticker || '').toUpperCase());
}

export { MEGA_CAPS };
