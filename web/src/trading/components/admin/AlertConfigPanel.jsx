import { useState } from 'react';
import { useAlertConfig } from '../../hooks/useAlertConfig';
import { DEFAULT_ALERT_CONFIG } from '../../utils/alertEngine';

/**
 * Admin panel for configuring alert thresholds.
 * Lives inside the Admin page as a new tab.
 */
export function AlertConfigPanel() {
  const { config, loading, toggleAlert, updateThreshold, saveConfig } = useAlertConfig();
  const [statusMsg, setStatusMsg] = useState('');

  const showStatus = (msg) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(''), 3000);
  };

  const handleThresholdChange = async (key, value) => {
    const ok = await updateThreshold(key, value);
    if (ok) showStatus(`Updated ${key} threshold`);
  };

  const handleToggle = async (key) => {
    const ok = await toggleAlert(key);
    if (ok) showStatus(`Toggled ${key}`);
  };

  const handleResetDefaults = async () => {
    const ok = await saveConfig(DEFAULT_ALERT_CONFIG);
    if (ok) showStatus('Reset to defaults');
  };

  if (loading) return <div className="adm-loading">Loading alert config...</div>;

  const alertTypes = [
    {
      key: 'take_profit',
      name: 'Profit Target',
      description: 'When P&L exceeds this % of max credit, suggest closing for profit. Checked FIRST — profitable positions skip all other alerts.',
      unit: '% of max credit',
      min: 25, max: 90, step: 5,
      color: '#059669',
    },
    {
      key: 'iron_fly_convert',
      name: 'Iron Fly Conversion',
      description: 'When stock moves this % of distance from center to a short strike, suggest converting the untested wing into an iron fly for extra credit.',
      unit: '% edge proximity',
      min: 50, max: 95, step: 5,
      color: '#8b5cf6',
    },
    {
      key: 'breakeven_breach',
      name: 'Breakeven Breach',
      description: 'Alert when stock price moves beyond one of the breakeven points. No threshold — it\'s binary.',
      unit: 'breach',
      min: 0, max: 1, step: 1,
      noSlider: true,
      color: '#dc2626',
    },
    {
      key: 'delta_breach',
      name: 'Short Strike Delta',
      description: 'When the absolute delta of a short strike exceeds this value, the position is being "tested" and may need rolling.',
      unit: 'Δ',
      min: 0.15, max: 0.50, step: 0.01,
      formatVal: v => v.toFixed(2),
      color: '#f59e0b',
    },
    {
      key: 'pop_drop',
      name: 'Probability of Profit',
      description: 'Alert when current PoP drops below this target. Only fires if profit target hasn\'t been reached.',
      unit: '%',
      min: 40, max: 80, step: 5,
      color: '#f59e0b',
    },
    {
      key: 'time_loss',
      name: 'Time + Loss',
      description: 'Alert when DTE is below this threshold AND the position is losing money. Creates urgency to act.',
      unit: ' DTE',
      min: 3, max: 21, step: 1,
      color: '#dc2626',
    },
  ];

  return (
    <div className="adm-section">
      <div className="adm-toolbar" style={{ justifyContent: 'space-between' }}>
        <div>
          <span style={{ fontSize: 14, fontWeight: 700 }}>🔔 Alert Thresholds</span>
          <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 12 }}>
            Stored in Firestore: <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 4, fontSize: 11 }}>config/alertThresholds</code>
          </span>
        </div>
        <button className="adm-btn" onClick={handleResetDefaults}>🔄 Reset to Defaults</button>
      </div>

      {statusMsg && <div className="adm-status">{statusMsg}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
        {alertTypes.map(at => {
          const cfg = config[at.key] || {};
          const enabled = cfg.enabled !== false;
          const threshold = cfg.threshold ?? DEFAULT_ALERT_CONFIG[at.key]?.threshold ?? 0;
          const displayVal = at.formatVal ? at.formatVal(threshold) : threshold;

          return (
            <div key={at.key} style={{
              background: '#fff',
              border: `1px solid ${enabled ? '#e5e7eb' : '#f3f4f6'}`,
              borderRadius: 12,
              padding: 20,
              opacity: enabled ? 1 : 0.5,
              transition: 'all 0.2s',
            }}>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 20 }}>{cfg.icon || DEFAULT_ALERT_CONFIG[at.key]?.icon}</span>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{at.name}</div>
                    <div style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: 4,
                      fontSize: 10,
                      fontWeight: 600,
                      marginTop: 2,
                      background: `${at.color}15`,
                      color: at.color,
                    }}>
                      → {cfg.action || DEFAULT_ALERT_CONFIG[at.key]?.action}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleToggle(at.key)}
                  style={{
                    width: 44, height: 24, borderRadius: 12,
                    border: 'none', cursor: 'pointer',
                    background: enabled ? '#059669' : '#d1d5db',
                    position: 'relative', transition: 'background 0.2s',
                  }}
                >
                  <div style={{
                    width: 18, height: 18, borderRadius: '50%', background: '#fff',
                    position: 'absolute', top: 3,
                    left: enabled ? 23 : 3,
                    transition: 'left 0.2s',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.15)',
                  }} />
                </button>
              </div>

              {/* Description */}
              <p style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5, margin: '0 0 12px' }}>
                {at.description}
              </p>

              {/* Threshold slider */}
              {!at.noSlider && (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 11, color: '#9ca3af' }}>Threshold</span>
                    <span style={{
                      fontSize: 14, fontWeight: 700, color: at.color,
                      fontFamily: "'SF Mono', 'Fira Code', monospace",
                    }}>
                      {displayVal}{at.unit}
                    </span>
                  </div>
                  <input
                    type="range"
                    min={at.min} max={at.max} step={at.step}
                    value={threshold}
                    onChange={(e) => handleThresholdChange(at.key, parseFloat(e.target.value))}
                    disabled={!enabled}
                    style={{ width: '100%', accentColor: at.color }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: '#9ca3af' }}>
                    <span>{at.formatVal ? at.formatVal(at.min) : at.min}{at.unit}</span>
                    <span>{at.formatVal ? at.formatVal(at.max) : at.max}{at.unit}</span>
                  </div>
                </div>
              )}

              {at.noSlider && (
                <div style={{ fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>
                  Binary check — no threshold to configure
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Decision Flow */}
      <div style={{
        marginTop: 20, background: '#f9fafb', borderRadius: 12,
        padding: 20, border: '1px solid #e5e7eb',
      }}>
        <h4 style={{ fontSize: 14, fontWeight: 700, margin: '0 0 12px' }}>🔄 Alert Priority Flow</h4>
        <div style={{ fontFamily: "'SF Mono', 'Fira Code', monospace", fontSize: 12, lineHeight: 1.8, color: '#374151' }}>
          <div>1. <span style={{ color: '#059669', fontWeight: 600 }}>🎯 Profit Target</span> — check if P&L ≥ {config.take_profit?.threshold || 50}% of max credit → "Close for Profit"</div>
          <div>2. <span style={{ color: '#8b5cf6', fontWeight: 600 }}>🦋 Iron Fly Convert</span> — check if price ≥ {config.iron_fly_convert?.threshold || 70}% toward short strike → "Convert to Iron Fly"</div>
          <div>3. <span style={{ color: '#dc2626', fontWeight: 600 }}>🚨 Breakeven Breach</span> — check if price beyond breakeven → "Close or Roll"</div>
          <div>4. <span style={{ color: '#f59e0b', fontWeight: 600 }}>⚡ Delta Breach</span> — check if short delta &gt; {config.delta_breach?.threshold || 0.30}Δ → "Review Adjustment"</div>
          <div>5. <span style={{ color: '#f59e0b', fontWeight: 600 }}>📉 PoP Drop</span> — check if PoP &lt; {config.pop_drop?.threshold || 60}% → "Review Position"</div>
          <div>6. <span style={{ color: '#dc2626', fontWeight: 600 }}>⏰ Time + Loss</span> — check if DTE &lt; {config.time_loss?.threshold || 10} AND losing → "Urgent Review"</div>
          <div>7. <span style={{ color: '#059669', fontWeight: 600 }}>✅ On Track</span> — none triggered → all good</div>
        </div>
      </div>
    </div>
  );
}
