/**
 * RiskGauge — loss zone / profit zone / break-even / "now" marker.
 *
 * The gauge is unit-free: marker position is the same percentage regardless
 * of Total vs Per-contract toggle. The toggle only changes dollar labels.
 *
 * Props from derivePosition():
 *   maxLossTotal: number
 *   maxProfitTotal: number
 *   pnlTotal?: number       — marker shown only when provided
 *   nowPct?: number          — pre-computed gauge position (0=maxLoss, 100=maxProfit)
 *   qty: number
 *
 * Display control:
 *   unit: 'total' | 'perContract'  — which dollar labels to show
 *   inline?: boolean               — compact row mode (22px vs 30px)
 *   showLabel?: boolean            — "+$176 now" below the marker
 *   showEnds?: boolean             — end labels below track
 */

import { useState } from 'react';
import { signedUsd } from '../../lib/money';
import styles from './invest.module.css';

export function RiskGauge({
  maxLossTotal,
  maxProfitTotal,
  pnlTotal,
  nowPct,
  qty = 1,
  unit: initialUnit = 'total',
  inline = false,
  showLabel = false,
  showEnds = true,
  showToggle = false,
}) {
  const [unit, setUnit] = useState(initialUnit);
  const span = maxLossTotal + maxProfitTotal;
  const bePct = span > 0 ? (maxLossTotal / span) * 100 : 50;

  const hasMarker = nowPct != null && pnlTotal != null;
  const markerColor = pnlTotal >= 0 ? styles.markerProfit : styles.markerLoss;
  const clampedPct = hasMarker ? Math.max(0, Math.min(100, nowPct)) : 0;

  // Dollar labels scale with unit toggle
  const divisor = unit === 'perContract' && qty > 0 ? qty : 1;
  const lossLabel = signedUsd(-maxLossTotal / divisor);
  const profitLabel = signedUsd(maxProfitTotal / divisor);
  const nowLabel = pnlTotal != null ? `${signedUsd(pnlTotal / divisor)} now` : '';

  const trackClass = inline ? styles.gaugeTrackInline : styles.gaugeTrack;
  const markerClass = inline
    ? `${styles.gaugeMarkerInline} ${markerColor}`
    : `${styles.gaugeMarker} ${markerColor}`;
  const endsClass = inline ? styles.gaugeEndsInline : styles.gaugeEnds;

  return (
    <div>
      {showToggle && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <div className={styles.toggle}>
            <button
              className={unit === 'total' ? styles.toggleBtnActive : styles.toggleBtn}
              onClick={() => setUnit('total')}
            >
              Total position
            </button>
            <button
              className={unit === 'perContract' ? styles.toggleBtnActive : styles.toggleBtn}
              onClick={() => setUnit('perContract')}
            >
              Per contract
            </button>
          </div>
        </div>
      )}

      <div className={trackClass}>
        <div className={styles.zoneLoss} style={{ width: `${bePct}%` }} />
        <div className={styles.zoneProfit} style={{ width: `${100 - bePct}%` }} />
        <div className={styles.gaugeBE} style={{ left: `${bePct}%` }} />
        {hasMarker && (
          <>
            <div className={markerClass} style={{ left: `${clampedPct}%` }} />
            {showLabel && (
              <div
                className={`${styles.gaugeLabel} ${pnlTotal >= 0 ? styles.pos : styles.neg}`}
                style={{ left: `${clampedPct}%` }}
              >
                {nowLabel}
              </div>
            )}
          </>
        )}
      </div>

      {showEnds && (
        <div className={endsClass}>
          <span>Max loss {lossLabel}</span>
          <span style={{ color: 'var(--inv-text)' }}>Break-even</span>
          <span>Max profit {profitLabel}</span>
        </div>
      )}
    </div>
  );
}
