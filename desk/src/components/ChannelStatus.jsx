const CHANNEL_CONFIG = {
  picks:     { label: 'Picks Page',  icon: '🌿' },
  invest:    { label: 'Invest Page', icon: '📊' },
  pdf:       { label: 'PDF Report',  icon: '📄' },
  youtube:   { label: 'YouTube',     icon: '🎬' },
  linkedin:  { label: 'LinkedIn',    icon: '💼' },
  twitter:   { label: 'Twitter/X',   icon: '🐦' },
  instagram: { label: 'Instagram',   icon: '📸' },
  email:     { label: 'Email',       icon: '📧' },
};

const STATUS_STYLES = {
  complete: { bg: '#dcfce7', color: '#166534', label: 'Complete' },
  tbd:      { bg: '#fef3c7', color: '#92400e', label: 'TBD' },
  failed:   { bg: '#fee2e2', color: '#991b1b', label: 'Failed' },
};

export function ChannelStatus({ channels, onStatusChange, compact = false }) {
  const entries = Object.entries(channels || {});

  if (compact) {
    const complete = entries.filter(([, v]) => v.status === 'complete').length;
    const total = entries.length;
    return (
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        {entries.map(([key, val]) => {
          const cfg = CHANNEL_CONFIG[key] || { label: key, icon: '📌' };
          const st = STATUS_STYLES[val.status] || STATUS_STYLES.tbd;
          return (
            <span key={key} title={`${cfg.label}: ${st.label}`} style={{
              fontSize: 10, padding: '2px 6px', borderRadius: 8,
              background: st.bg, color: st.color, fontWeight: 600,
              cursor: onStatusChange ? 'pointer' : 'default',
            }} onClick={() => onStatusChange && val.status === 'tbd' && onStatusChange(key, 'complete')}>
              {cfg.icon}
            </span>
          );
        })}
        <span style={{ fontSize: 10, color: '#9ca3af', marginLeft: 4 }}>
          {complete}/{total}
        </span>
      </div>
    );
  }

  return (
    <div className="dk-assets">
      {entries.map(([key, val]) => {
        const cfg = CHANNEL_CONFIG[key] || { label: key, icon: '📌' };
        const st = STATUS_STYLES[val.status] || STATUS_STYLES.tbd;
        return (
          <div key={key} className="dk-asset-row">
            <span className="dk-asset-name">{cfg.icon} {cfg.label}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {val.url && (
                <a href={val.url} target="_blank" rel="noopener" className="dk-asset-btn" style={{ fontSize: 10 }}>
                  Open
                </a>
              )}
              <span style={{
                fontSize: 10, padding: '2px 8px', borderRadius: 10,
                background: st.bg, color: st.color, fontWeight: 600,
              }}>
                {st.label}
              </span>
              {onStatusChange && val.status === 'tbd' && (
                <button className="dk-asset-btn" style={{ fontSize: 10, color: '#166534' }}
                  onClick={() => onStatusChange(key, 'complete')}>
                  Mark Done
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
