/**
 * PositionMonitor — live P&L progress bar, metrics, and action alerts.
 */

const mono = "'Space Mono', monospace";

export default function PositionMonitor({ liveData, symbol }) {
  if (!liveData || liveData.loading) return null;

  const {
    pnlPerContract, pnlTotal, quantity, maxProfit, maxLoss,
    progressPct, profitCapturePct, entrySpot, currentSpot, priceMove,
    dte, strategyStatus, pnlResult,
  } = liveData;

  const isProfit = pnlPerContract >= 0;
  const pnlColor = isProfit ? '#1D9E75' : '#E24B4A';
  const entryCredit = Math.abs(liveData.pnlResult.entryNetCredit || 0);

  // Progress bar gradient: red (0%) → amber (50%) → green (100%)
  // Marker position: progressPct maps max loss=0% → max profit=100%
  const markerLeft = `${Math.max(2, Math.min(98, progressPct))}%`;
  const markerColor = progressPct > 60 ? '#1D9E75' : progressPct > 40 ? '#C9A96E' : '#E24B4A';

  // Alert styling
  const alertColors = {
    critical: { bg: 'rgba(226,75,74,.08)', border: '#E24B4A' },
    high: { bg: 'rgba(226,75,74,.06)', border: '#E24B4A' },
    medium: { bg: 'rgba(201,169,110,.08)', border: '#C9A96E' },
    low: { bg: 'rgba(29,158,117,.06)', border: '#1D9E75' },
    none: { bg: 'rgba(15,61,46,.04)', border: '#0B2D23' },
  };
  const alertStyle = alertColors[strategyStatus.urgency] || alertColors.none;

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0B2D23, #1a5c44)',
      borderRadius: 12, overflow: 'hidden', marginBottom: 20,
    }}>
      {/* Header row */}
      <div style={{ padding: '18px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: '.12em', textTransform: 'uppercase', color: '#C9A96E' }}>
            Your Position · {quantity} contract{quantity > 1 ? 's' : ''}
          </div>
          <div style={{ fontSize: 12, color: 'rgba(255,255,255,.45)', marginTop: 4 }}>
            Entry {entryCredit > 0 ? 'credit' : 'debit'} ${Math.abs(entryCredit).toFixed(0)}/contract
            {quantity > 1 && ` · Total $${(Math.abs(entryCredit) * quantity).toFixed(0)}`}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontFamily: mono, fontSize: 28, fontWeight: 700, color: pnlColor }}>
            {pnlTotal >= 0 ? '+' : '-'}${Math.abs(pnlTotal).toFixed(0)}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,.45)' }}>
            {quantity > 1 && `${pnlPerContract >= 0 ? '+' : '-'}$${Math.abs(pnlPerContract).toFixed(0)}/contract · `}
            {pnlResult.method === 'live' ? 'Live option prices' : pnlResult.method === 'estimated' ? 'BS estimate' : 'At expiry'}
          </div>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ padding: '0 24px 16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: mono, fontSize: 9, color: 'rgba(255,255,255,.35)', marginBottom: 6, letterSpacing: '.06em' }}>
          <span>MAX LOSS -${maxLoss}</span>
          <span>BREAKEVEN</span>
          <span>MAX PROFIT +${maxProfit}</span>
        </div>
        <div style={{ height: 8, background: 'rgba(255,255,255,.1)', borderRadius: 4, position: 'relative' }}>
          {/* Gradient track */}
          <div style={{
            position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', borderRadius: 4,
            background: 'linear-gradient(90deg, #E24B4A 0%, #E24B4A 30%, #C9A96E 50%, #1D9E75 70%, #1D9E75 100%)',
            opacity: 0.2,
          }} />
          {/* Center line (breakeven) */}
          <div style={{
            position: 'absolute', top: -2, left: `${maxLoss / (maxLoss + maxProfit) * 100}%`,
            width: 1, height: 12, background: 'rgba(255,255,255,.3)',
          }} />
          {/* Current position marker */}
          <div style={{
            position: 'absolute', top: -4, left: markerLeft,
            width: 16, height: 16, background: markerColor,
            border: '3px solid rgba(255,255,255,.9)', borderRadius: '50%',
            boxShadow: '0 2px 6px rgba(0,0,0,.3)', transform: 'translateX(-50%)',
            transition: 'left .3s ease',
          }} />
        </div>
        <div style={{ fontSize: 12, fontWeight: 600, color: pnlColor, marginTop: 8 }}>
          {profitCapturePct >= 0
            ? `${profitCapturePct}% of max profit captured`
            : `${Math.abs(profitCapturePct)}% of max loss reached`
          }
          {strategyStatus.details?.breachedLeg && ` · ${strategyStatus.details.breachedLeg} breached`}
        </div>
      </div>

      {/* Metrics row */}
      <div style={{ padding: '0 24px 16px', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        <MetricBox label="Entry Price" value={`$${entrySpot.toFixed(2)}`} />
        <MetricBox label="Current Price" value={`$${currentSpot.toFixed(2)}`} />
        <MetricBox label="Price Move" value={`${priceMove >= 0 ? '+' : ''}${priceMove.toFixed(1)}%`} valueColor={priceMove >= 0 ? '#5dba8e' : '#ff6b6b'} />
        <MetricBox label="Days Left" value={dte != null ? `${dte}d` : '—'} valueColor={dte != null && dte <= 5 ? '#ff6b6b' : undefined} />
      </div>

      {/* Action alert */}
      {strategyStatus.suggestion && (
        <div style={{ padding: '0 24px 18px' }}>
          <div style={{
            padding: '12px 16px', background: alertStyle.bg, borderRadius: 8,
            borderLeft: `3px solid ${alertStyle.border}`, fontSize: 13, color: 'rgba(255,255,255,.8)', lineHeight: 1.5,
          }}>
            <strong style={{ color: alertStyle.border }}>
              {strategyStatus.urgency === 'critical' ? 'Action Required: ' : strategyStatus.urgency === 'low' && profitCapturePct >= 50 ? 'Take Profit: ' : ''}
            </strong>
            {strategyStatus.suggestion}
          </div>
        </div>
      )}
    </div>
  );
}

function MetricBox({ label, value, valueColor }) {
  return (
    <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,.06)', borderRadius: 8 }}>
      <div style={{ fontFamily: mono, fontSize: 8, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontFamily: mono, fontSize: 15, fontWeight: 700, color: valueColor || '#fff' }}>{value}</div>
    </div>
  );
}
