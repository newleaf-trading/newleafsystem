import { useState } from 'react';

const COLORS = {
  bullish: { dot: '#1D9E75', text: '#1D9E75', bg: 'rgba(29,158,117,0.08)', border: 'rgba(29,158,117,0.18)' },
  neutral: { dot: '#9ca3af', text: '#6b7280', bg: 'rgba(156,163,175,0.08)', border: 'rgba(156,163,175,0.18)' },
  bearish: { dot: '#E24B4A', text: '#E24B4A', bg: 'rgba(226,75,74,0.08)', border: 'rgba(226,75,74,0.18)' },
};

export function SentimentBadge({ sentiment, size = 'small' }) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!sentiment || sentiment.score == null) return null;

  const label = sentiment.label || (sentiment.score >= 70 ? 'bullish' : sentiment.score < 40 ? 'bearish' : 'neutral');
  const colors = COLORS[label] || COLORS.neutral;
  const hasCaution = sentiment.flags?.includes('caution');
  const hasSuppress = sentiment.flags?.includes('suppress');

  if (size === 'inline') {
    return (
      <span style={{
        display: 'inline-flex', alignItems: 'center', gap: 4,
        fontSize: 10, fontWeight: 700, color: colors.text,
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: colors.dot }} />
        {sentiment.score}
        {hasCaution && <span style={{ fontSize: 10 }}>&#9888;</span>}
      </span>
    );
  }

  return (
    <div
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: '3px 10px', borderRadius: 20,
        background: hasCaution ? 'rgba(217,119,6,0.08)' : colors.bg,
        border: `1px solid ${hasCaution ? 'rgba(217,119,6,0.2)' : colors.border}`,
        fontSize: 10, fontWeight: 700, letterSpacing: '.04em',
        color: hasCaution ? '#d97706' : colors.text,
        cursor: sentiment.summary ? 'help' : 'default',
      }}>
        {hasCaution ? (
          <span style={{ fontSize: 10 }}>&#9888;</span>
        ) : hasSuppress ? (
          <span style={{ fontSize: 10 }}>&#128683;</span>
        ) : (
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: colors.dot, flexShrink: 0 }} />
        )}
        {sentiment.score}
        {sentiment.modifier != null && sentiment.modifier !== 0 && (
          <span style={{ fontSize: 9, opacity: 0.7 }}>
            {sentiment.modifier > 0 ? '+' : ''}{sentiment.modifier}
          </span>
        )}
      </div>

      {showTooltip && sentiment.summary && (
        <div style={{
          position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
          marginTop: 6, width: 280, padding: '12px 14px',
          background: '#fff', border: '1px solid rgba(17,24,39,0.12)',
          borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          zIndex: 100, fontSize: 12, color: '#374151', lineHeight: 1.5,
        }}>
          <div style={{ fontWeight: 700, fontSize: 11, marginBottom: 6, color: colors.text, textTransform: 'uppercase', letterSpacing: '.06em' }}>
            {label} Sentiment &mdash; {sentiment.score}/100
          </div>
          <div style={{ marginBottom: 8 }}>{sentiment.summary}</div>
          {sentiment.keyDrivers?.length > 0 && (
            <div style={{ borderTop: '1px solid rgba(17,24,39,0.06)', paddingTop: 6 }}>
              {sentiment.keyDrivers.slice(0, 3).map((d, i) => (
                <div key={i} style={{ fontSize: 11, color: '#6b6b60', display: 'flex', gap: 4, marginBottom: 2 }}>
                  <span style={{ color: d.impact === 'positive' ? '#1D9E75' : d.impact === 'negative' ? '#E24B4A' : '#d97706', flexShrink: 0 }}>
                    {d.impact === 'positive' ? '+' : d.impact === 'negative' ? '-' : '~'}
                  </span>
                  {d.factor}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
