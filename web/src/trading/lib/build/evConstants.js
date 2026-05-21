/**
 * Expected Value constants for portfolio math.
 *
 * WIN_TAKE_PCT: realistic target — most traders close credit trades at 50-60% of max profit,
 * not at full max. We use 60% as the expected capture rate for winning trades.
 *
 * LOSS_TAKE_PCT: worst case assumption — if a trade goes against you, assume the full max
 * loss is realised (100%). In practice, traders often cut losses earlier, but assuming worst
 * case keeps the EV estimate conservative.
 *
 * These constants are placeholders. Tune them based on closed-trade analysis:
 *   SELECT avg(pnl / maxProfit) FROM closed_trades WHERE pnl > 0  → WIN_TAKE_PCT
 *   SELECT avg(abs(pnl) / maxLoss) FROM closed_trades WHERE pnl < 0  → LOSS_TAKE_PCT
 */

export const WIN_TAKE_PCT = 0.60;
export const LOSS_TAKE_PCT = 1.00;

/**
 * Default risk budget as a fraction of total capital.
 * 10% means: with $100K capital, you can allocate up to $10K of max-loss exposure.
 */
export const DEFAULT_MAX_DRAWDOWN = 0.10;
