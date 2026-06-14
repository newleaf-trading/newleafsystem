/**
 * LegsTable — entry-only (candidate) vs entry+current (open) depending on status.
 *
 * Props:
 *   legs: Leg[]               — from CanonicalPosition
 *   status: PositionStatus    — controls which columns show
 *   qty?: number              — for net P&L display
 *   entryCreditPerContract?: number
 *   expiry?: string
 *   dte?: number
 *   canonicalPerContract?: number — from derivePosition; used for dev invariant
 */

import { signedUsd, usdCents } from '../../lib/money';
import styles from './invest.module.css';

export function LegsTable({ legs, status, qty = 1, entryCreditPerContract, expiry, dte, canonicalPerContract }) {
  if (!legs || legs.length === 0) return null;

  const isOpen = status === 'open' || status === 'closed';

  // Compute net per contract if open
  let netPnlPc = 0;
  let netDelta = 0;
  let netTheta = 0;
  if (isOpen) {
    for (const l of legs) {
      const sign = l.action === 'sell' ? 1 : -1;
      const entry = l.entryPrice || 0;
      const current = l.currentPrice ?? entry;
      netPnlPc += sign * (entry - current) * 100;
      netDelta += l.delta || 0;
      netTheta += l.theta || 0;
    }
  } else {
    for (const l of legs) {
      netDelta += l.delta || 0;
      netTheta += l.theta || 0;
    }
  }

  // ── Dev invariant: Σ leg P&L per contract must reconcile with canonical ──
  // Tolerance of $2 accounts for rounding across bid/ask mid calculations.
  if (process.env.NODE_ENV !== 'production' && isOpen && canonicalPerContract != null) {
    const allLegsHaveCurrent = legs.every(l => l.currentPrice != null);
    if (allLegsHaveCurrent && Math.abs(netPnlPc - canonicalPerContract) > 2) {
      console.error(
        `[LegsTable] P&L reconciliation failed: Σ legs = $${netPnlPc.toFixed(2)}, ` +
        `canonical perContract = $${canonicalPerContract.toFixed(2)}, ` +
        `Δ = $${(netPnlPc - canonicalPerContract).toFixed(2)}`
      );
    }
  }

  return (
    <div>
      {expiry && (
        <div style={{ fontSize: 12, color: 'var(--inv-muted)', marginBottom: 14, fontFamily: "'Space Mono', monospace" }}>
          {isOpen ? 'Expiry' : 'ADBE · expiry'} {expiry}
          {dte != null && ` · ${dte} DTE`}
          {entryCreditPerContract != null && ` · ${isOpen ? 'Entry credit' : 'Net credit'} ${usdCents(entryCreditPerContract / 100)}/share (${signedUsd(entryCreditPerContract)}/contract)`}
        </div>
      )}

      <table className={styles.legsTable}>
        <thead>
          <tr>
            <th>Action</th>
            <th>Strike</th>
            {isOpen ? (
              <>
                <th>Entry</th>
                <th>Current</th>
                <th>Leg P&L</th>
              </>
            ) : (
              <>
                <th>Type</th>
                <th>Price</th>
              </>
            )}
            <th>Delta</th>
            <th>Theta</th>
          </tr>
        </thead>
        <tbody>
          {legs.map((leg, i) => {
            const tagClass = leg.action === 'sell' ? styles.tagSell : styles.tagBuy;
            const sign = leg.action === 'sell' ? 1 : -1;
            const legPnl = isOpen && leg.currentPrice != null
              ? sign * (leg.entryPrice - leg.currentPrice) * 100
              : null;

            return (
              <tr key={i}>
                <td>
                  <span className={`${styles.legTag} ${tagClass}`}>
                    {leg.action === 'sell' ? 'Sell' : 'Buy'}
                  </span>
                </td>
                <td>${leg.strike} {leg.type === 'call' ? 'Call' : 'Put'}</td>
                {isOpen ? (
                  <>
                    <td>${(leg.entryPrice || 0).toFixed(2)}</td>
                    <td>${(leg.currentPrice ?? leg.entryPrice ?? 0).toFixed(2)}</td>
                    <td className={legPnl != null && legPnl >= 0 ? styles.pos : legPnl != null ? styles.neg : ''}>
                      {legPnl != null ? signedUsd(legPnl) : '—'}
                    </td>
                  </>
                ) : (
                  <>
                    <td>{leg.type === 'call' ? 'Call' : 'Put'}</td>
                    <td>${(leg.entryPrice || 0).toFixed(2)}</td>
                  </>
                )}
                <td>{(leg.delta || 0).toFixed(3)}</td>
                <td>{(leg.theta || 0).toFixed(3)}</td>
              </tr>
            );
          })}
          <tr className={styles.netRow}>
            <td colSpan={isOpen ? 4 : 3} style={{ textAlign: 'left' }}>
              {isOpen ? 'Net P&L per contract' : 'Net credit per contract'}
              <span style={{ color: 'var(--inv-muted)', fontWeight: 400, marginLeft: 12 }}>
                &Delta; {netDelta.toFixed(3)} · &Theta; {netTheta.toFixed(3)}
              </span>
            </td>
            <td className={isOpen ? (netPnlPc >= 0 ? styles.pos : styles.neg) : styles.pos}>
              {isOpen ? signedUsd(netPnlPc) : (entryCreditPerContract != null ? signedUsd(entryCreditPerContract) : '—')}
            </td>
            <td />
            <td />
          </tr>
        </tbody>
      </table>
    </div>
  );
}
