/**
 * TradeDecisionHero — Single hero card replacing Market State, Band Position,
 * Condor Planner, and the separate "Entry Not Recommended" card.
 */
export default function TradeDecisionHero({ data }) {
  if (!data) return null;

  const { spot, put_wall, call_wall, center, confidence_score, position_in_band_pct: pos, condor_allowed, condorGate, band_width_pct } = data;
  const pct = pos ?? 50;
  const confidence = Math.round((confidence_score || 0) * 100);
  const allowed = condor_allowed || condorGate?.condorAllowed || false;
  const bandWidth = call_wall && put_wall ? (call_wall - put_wall) : 0;

  // Derive the blocked reason
  const blockedReasons = [];
  if (!allowed) {
    if (pct > 80) blockedReasons.push(`Price is near the call wall ($${call_wall}). Wait for rotation toward center ($${center}).`);
    else if (pct < 20) blockedReasons.push(`Price is near the put wall ($${put_wall}). Wait for rotation toward center ($${center}).`);
    else if (confidence_score < 0.3) blockedReasons.push(`Confidence score is low (${confidence}%). Gamma wall data may be unreliable.`);
    else if (band_width_pct < 2) blockedReasons.push(`Band width is too narrow (${band_width_pct?.toFixed(1)}%). Not enough room for an iron condor.`);
    else blockedReasons.push(`Condor gate blocked entry. Wait for better positioning.`);

    // Add reasons from condorGate if available
    const gateReasons = condorGate?.reasons || [];
    for (const r of gateReasons) {
      const text = typeof r === 'string' ? r : r?.detail || r?.rule || '';
      if (text && !blockedReasons.some(b => b.includes(text))) blockedReasons.push(text);
    }
  }

  const reasonText = allowed
    ? `Spot is well-positioned at ${pct.toFixed(0)}% of band. Entry conditions met.`
    : blockedReasons[0] || 'Condor entry not recommended at this time.';

  return (
    <div className="nl-card" style={{ padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px 12px',
        borderBottom: '1px solid var(--nl-border)',
        background: allowed ? 'rgba(34,197,94,0.04)' : 'rgba(239,68,68,0.04)',
      }}>
        <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--nl-muted-text)', marginBottom: 8 }}>
          Condor Status
        </div>
        <div style={{
          fontSize: 22, fontWeight: 900,
          color: allowed ? 'var(--nl-success)' : 'var(--nl-danger)',
        }}>
          {allowed ? '✓ Entry Clear' : '✕ Entry Blocked'}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>

        {/* Confidence bar */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--nl-muted-text)' }}>Confidence</span>
            <span style={{ fontSize: 13, fontWeight: 800, color: confidence >= 50 ? 'var(--nl-success)' : 'var(--nl-danger)' }}>{confidence}%</span>
          </div>
          <div style={{ height: 8, borderRadius: 4, background: '#f1f5f9', overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 4,
              width: `${Math.min(100, Math.max(2, confidence))}%`,
              background: confidence >= 50 ? '#22c55e' : confidence >= 30 ? '#f59e0b' : '#ef4444',
              transition: 'width 0.4s ease',
            }} />
          </div>
        </div>

        {/* Reason text */}
        <div style={{
          fontSize: 13, lineHeight: 1.5, color: '#374151',
          padding: '10px 14px', borderRadius: 8,
          background: allowed ? 'rgba(34,197,94,0.06)' : 'rgba(239,68,68,0.06)',
          border: `1px solid ${allowed ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)'}`,
        }}>
          {reasonText}
        </div>

        {/* Band position visual */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--nl-muted-text)', marginBottom: 8 }}>
            Band Position
          </div>
          <div style={{ position: 'relative', height: 36, borderRadius: 10, overflow: 'hidden', background: '#f1f5f9', border: '1px solid var(--nl-border)' }}>
            {/* Zone colors */}
            <div style={{ position: 'absolute', inset: 0, display: 'flex' }}>
              <div style={{ width: '20%', background: 'rgba(239,68,68,0.12)' }} />
              <div style={{ width: '15%', background: 'rgba(245,158,11,0.08)' }} />
              <div style={{ width: '30%', background: 'rgba(34,197,94,0.10)' }} />
              <div style={{ width: '15%', background: 'rgba(245,158,11,0.08)' }} />
              <div style={{ width: '20%', background: 'rgba(239,68,68,0.12)' }} />
            </div>
            {/* Put wall label */}
            <div style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 10, fontWeight: 700, color: '#ef4444' }}>
              ${put_wall}
            </div>
            {/* Call wall label */}
            <div style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 10, fontWeight: 700, color: '#22c55e' }}>
              ${call_wall}
            </div>
            {/* Spot marker */}
            <div style={{
              position: 'absolute', top: '50%', left: `${Math.min(96, Math.max(4, pct))}%`,
              transform: 'translate(-50%, -50%)', width: 14, height: 14, borderRadius: '50%',
              background: '#0B2D23', border: '2.5px solid #fff',
              boxShadow: '0 0 0 3px rgba(11,45,35,0.2), 0 2px 4px rgba(0,0,0,0.15)',
            }} />
          </div>
          {/* Labels row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6, fontSize: 10, color: 'var(--nl-muted-text)', fontWeight: 600 }}>
            <span>Put Wall</span>
            <span>Center (${center})</span>
            <span>Call Wall</span>
          </div>
        </div>

        {/* Center + Band Width mini row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <MiniStat label="Center" value={`$${center}`} />
          <MiniStat label="Band Width" value={`$${bandWidth.toFixed(0)} (${band_width_pct?.toFixed(1)}%)`} />
        </div>

        {/* Blocked reasons (only if blocked) */}
        {!allowed && blockedReasons.length > 1 && (
          <div style={{ fontSize: 11, color: 'var(--nl-danger)', lineHeight: 1.5 }}>
            {blockedReasons.slice(1).map((r, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, marginBottom: 2 }}>
                <span>•</span><span>{r}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div style={{ padding: '8px 12px', borderRadius: 8, background: '#f8f9fa', border: '1px solid var(--nl-border)' }}>
      <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--nl-muted-text)', marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--nl-text)' }}>{value}</div>
    </div>
  );
}
