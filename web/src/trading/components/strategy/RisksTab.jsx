import { cardBase, sectionH3, placeholder } from './shared';

export function RisksTab({ analysis, analysisLoading, tile, eventAlerts, ivCrushRisk, eventLoading, fetchRisk }) {
  if (analysisLoading) return <div style={placeholder}>Loading risk analysis...</div>;

  const risk = analysis?.riskAnalysis;
  const hasRisk = risk && (risk.maxPainScenario || risk.earningsRisk || risk.eventRisk || risk.managementPlan);

  const severityStyles = {
    high:   { bg: 'rgba(201,79,79,0.10)', color: '#C94F4F', border: 'rgba(201,79,79,0.25)' },
    medium: { bg: 'rgba(217,119,6,0.10)', color: '#B45309', border: 'rgba(217,119,6,0.25)' },
    low:    { bg: 'rgba(107,114,128,0.10)', color: '#6b7280', border: 'rgba(107,114,128,0.25)' },
  };

  const handleCheckEventRisk = () => {
    if (!tile) return;
    fetchRisk({
      ticker: tile.symbol, expiry: tile.expiry, strategy: tile.strategy,
      legs: tile.legs || [], entryIvRank: tile.ivRank || tile.technical?.ivRank || null,
    });
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <button onClick={handleCheckEventRisk} disabled={eventLoading} style={{
          padding: '10px 20px', background: '#0B2D23', color: '#fff',
          border: 'none', borderRadius: 8, cursor: eventLoading ? 'wait' : 'pointer',
          fontSize: 13, fontWeight: 700, marginBottom: 16, opacity: eventLoading ? 0.6 : 1,
        }}>
          {eventLoading ? 'Checking...' : 'Check Event Risks'}
        </button>

        {eventAlerts.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 16 }}>
            {eventAlerts.map((alert, i) => {
              const sev = severityStyles[alert.severity] || severityStyles.low;
              return (
                <div key={i} style={{ ...cardBase, background: sev.bg, border: `1px solid ${sev.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{
                      display: 'inline-block', padding: '2px 8px', borderRadius: 999,
                      fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
                      background: sev.bg, color: sev.color, border: `1px solid ${sev.border}`,
                    }}>
                      {alert.severity}
                    </span>
                    {alert.type && <span style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{alert.type}</span>}
                  </div>
                  {alert.description && <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, margin: '0 0 4px' }}>{alert.description}</p>}
                  {alert.recommendation && <p style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5, margin: 0, fontStyle: 'italic' }}>{alert.recommendation}</p>}
                </div>
              );
            })}
          </div>
        )}

        {ivCrushRisk && (
          <div style={{ ...cardBase, background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.15)', marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#7c3aed', marginBottom: 4 }}>IV Crush Risk</div>
            <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, margin: 0 }}>
              {typeof ivCrushRisk === 'string' ? ivCrushRisk : (ivCrushRisk.summary || ivCrushRisk.level || 'Assessment available')}
            </p>
            {ivCrushRisk.detail && <p style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5, margin: '4px 0 0', fontStyle: 'italic' }}>{ivCrushRisk.detail}</p>}
          </div>
        )}
      </div>

      <h3 style={sectionH3}>What Could Go Wrong</h3>
      {hasRisk ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {[
            { label: 'Max Pain Scenario', text: risk.maxPainScenario },
            { label: 'Earnings Risk', text: risk.earningsRisk },
            { label: 'Dividend Risk', text: risk.dividendRisk },
            { label: 'Event Risk', text: risk.eventRisk },
          ].filter(r => r.text).map((item, i) => (
            <div key={i} style={{ ...cardBase, borderLeft: '3px solid rgba(201,79,79,0.3)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#C94F4F', marginBottom: 4 }}>{item.label}</div>
              <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, margin: 0 }}>{item.text}</p>
            </div>
          ))}
          {risk.managementPlan && (
            <div style={{ ...cardBase, borderLeft: '3px solid rgba(11,122,82,0.3)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#0B7A52', marginBottom: 4 }}>Management Plan</div>
              <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, margin: 0 }}>{risk.managementPlan}</p>
            </div>
          )}
        </div>
      ) : (
        <div style={placeholder}>Risk analysis not yet available for this strategy. Generated during market scans.</div>
      )}
    </div>
  );
}
