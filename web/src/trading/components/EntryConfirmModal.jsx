/**
 * EntryConfirmModal — shows live Alpaca prices for each leg before executing.
 *
 * Props:
 *   tiles — array of tiles being entered
 *   entries — Map<tileId, { tile, legs, netCredit, hasPricing }> from useLiveEntry
 *   loading — fetching live prices
 *   error — pricing error message
 *   allocation — { strategies: [{ id, contracts }] } from BuildPage
 *   onConfirm(livePricesMap) — called with Map<tileId, liveLegPrices[]>
 *   onCancel()
 *   executing — confirm button loading state
 */

import { useEffect } from 'react';
import { formatStrategy } from '../utils/formatters';
import { Button } from '../../shared/components/ui/Button';
import styles from './EntryConfirmModal.module.css';

const fmt = (v) => v != null ? `$${v.toFixed(2)}` : '--';
const fmtCost = (v) => {
  if (v == null || isNaN(v)) return '--';
  const abs = Math.abs(Math.round(v));
  return v >= 0 ? `$${abs} credit` : `$${abs} debit`;
};

export function EntryConfirmModal({
  tiles, entries, loading, error, allocation,
  onConfirm, onCancel, executing,
}) {
  // Close on Escape
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onCancel(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onCancel]);

  const handleConfirm = () => {
    if (!entries) return onConfirm(null);
    // Build liveLegPrices map: tileId → leg array matching addPosition's liveLegPrices format
    const livePricesMap = new Map();
    for (const [tileId, entry] of entries) {
      livePricesMap.set(tileId, entry.legs);
    }
    onConfirm(livePricesMap);
  };

  const totalPositions = tiles.length;
  const totalContracts = tiles.reduce((sum, t) => {
    const alloc = allocation?.strategies?.find(s => s.id === t.id);
    return sum + (alloc?.contracts || 1);
  }, 0);

  return (
    <div className={styles.overlay} onClick={onCancel}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className={styles.header}>
          <h2 className={styles.title}>Confirm Entry</h2>
          <div className={styles.subtitle}>
            {totalPositions} position{totalPositions !== 1 ? 's' : ''} &middot; {totalContracts} contract{totalContracts !== 1 ? 's' : ''}
          </div>
        </div>

        {/* Loading */}
        {loading && (
          <div className={styles.loadingBar}>
            <div className={styles.spinner} />
            <div>Fetching live Alpaca prices...</div>
          </div>
        )}

        {/* Error */}
        {error && <div className={styles.error}>{error}</div>}

        {/* Position list */}
        {!loading && tiles.map(tile => {
          const entry = entries?.get(tile.id);
          const legs = entry?.legs || tile.legs?.map(l => ({ ...l, scanPremium: l.premium, liveMid: null })) || [];
          const hasPricing = entry?.hasPricing ?? false;
          const netCredit = entry?.netCredit ?? null;
          const alloc = allocation?.strategies?.find(s => s.id === tile.id);
          const qty = alloc?.contracts || 1;

          return (
            <div key={tile.id} className={styles.position}>
              {/* Position header */}
              <div className={styles.posHeader}>
                <div>
                  <span className={styles.posSymbol}>{tile.symbol}</span>
                  <span className={styles.posStrategy}>{formatStrategy(tile.strategy)}</span>
                  {qty > 1 && <span className={styles.posStrategy}>&middot; {qty} contracts</span>}
                </div>
                <div>
                  <span className={`${styles.liveBadge} ${hasPricing ? styles.liveBadgeLive : styles.liveBadgeScan}`}>
                    {hasPricing ? 'LIVE' : 'SCAN'}
                  </span>
                </div>
              </div>

              {/* Legs table */}
              <table className={styles.legsTable}>
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Strike</th>
                    <th>Type</th>
                    <th style={{ textAlign: 'right' }}>Bid</th>
                    <th style={{ textAlign: 'right' }}>Mid</th>
                    <th style={{ textAlign: 'right' }}>Ask</th>
                  </tr>
                </thead>
                <tbody>
                  {legs.map((leg, i) => {
                    const isSell = (leg.action || '').toLowerCase() === 'sell';
                    const priceDiff = leg.liveMid != null && leg.scanPremium
                      ? leg.liveMid - leg.scanPremium
                      : null;

                    return (
                      <tr key={i}>
                        <td>
                          <span className={`${styles.action} ${isSell ? styles.actionSell : styles.actionBuy}`}>
                            {leg.action}
                          </span>
                        </td>
                        <td className={styles.strike}>${leg.strike}</td>
                        <td>{(leg.type || '').toUpperCase()}</td>
                        <td className={`${styles.price} ${leg.liveBid != null ? styles.livePrice : styles.scanPrice}`}>
                          {leg.liveBid != null ? fmt(leg.liveBid) : '--'}
                        </td>
                        <td className={`${styles.price} ${leg.liveMid != null ? styles.livePrice : styles.scanPrice}`}>
                          {fmt(leg.liveMid ?? leg.scanPremium)}
                          {priceDiff != null && Math.abs(priceDiff) >= 0.01 && (
                            <span className={`${styles.diff} ${priceDiff > 0 ? styles.diffUp : styles.diffDown}`}>
                              {priceDiff > 0 ? '+' : ''}{priceDiff.toFixed(2)}
                            </span>
                          )}
                        </td>
                        <td className={`${styles.price} ${leg.liveAsk != null ? styles.livePrice : styles.scanPrice}`}>
                          {leg.liveAsk != null ? fmt(leg.liveAsk) : '--'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Net credit/debit */}
              {netCredit != null && (
                <div style={{ marginTop: 8, textAlign: 'right' }}>
                  <span className={styles.posCredit} style={{ color: netCredit >= 0 ? 'var(--nl-profit)' : 'var(--nl-loss)' }}>
                    {fmtCost(netCredit)}
                    {qty > 1 && <span style={{ fontWeight: 400, fontSize: 11, color: 'var(--nl-text-muted)', marginLeft: 6 }}>
                      &times; {qty} = {fmtCost(netCredit * qty)}
                    </span>}
                  </span>
                </div>
              )}
            </div>
          );
        })}

        {/* Footer */}
        <div className={styles.footer}>
          <Button variant="secondary" onClick={onCancel} disabled={executing}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            loading={executing}
            disabled={loading}
          >
            {executing ? 'Executing...' : `Execute ${totalPositions} Position${totalPositions !== 1 ? 's' : ''}`}
          </Button>
        </div>
      </div>
    </div>
  );
}
