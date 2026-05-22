import { useState, useEffect, useCallback } from 'react';

const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5400';
const API_KEY = import.meta.env.VITE_ADMIN_API_KEY || 'dev-key-change-me';

const CATEGORY_LABELS = {
  sentiment: 'Sentiment Engines',
  analysis: 'Analysis / AI Routes',
  verification: 'Verification Agents',
  tools: 'Tools',
};

const CATEGORY_ORDER = ['sentiment', 'analysis', 'verification', 'tools'];

const MODEL_COLORS = {
  'claude-sonnet': '#d97706',
  'claude-haiku': '#f59e0b',
  'gpt-4': '#10b981',
  'grok': '#6366f1',
  'deepseek': '#3b82f6',
  'deepseek-r1': '#2563eb',
  'qwq': '#8b5cf6',
  'qwen-max': '#a855f7',
  'gemini-pro': '#ef4444',
  'gemini-flash': '#f87171',
};

function ModelBadge({ model }) {
  const color = MODEL_COLORS[model] || '#6b7280';
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 12,
      fontSize: 11, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace",
      background: color + '18', color, border: `1px solid ${color}40`,
    }}>
      {model}
    </span>
  );
}

export function ModelAssignmentsPanel({ showStatus }) {
  const [assignments, setAssignments] = useState([]);
  const [usage, setUsage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const headers = { 'X-API-Key': API_KEY, 'Content-Type': 'application/json' };

  const loadAssignments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/admin/model-assignments`, { headers });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const data = await res.json();
      setAssignments(data.assignments || []);
    } catch (err) {
      setError(`Failed to load model assignments: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUsage = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/usage-summary`, { headers });
      if (!res.ok) return;
      const data = await res.json();
      setUsage(data);
    } catch { /* non-critical */ }
  }, []);

  useEffect(() => {
    loadAssignments();
    loadUsage();
  }, [loadAssignments, loadUsage]);

  const grouped = {};
  for (const a of assignments) {
    if (!grouped[a.category]) grouped[a.category] = [];
    grouped[a.category].push(a);
  }

  return (
    <div className="adm-section">
      <div className="adm-toolbar">
        <button className="adm-btn" onClick={() => { loadAssignments(); loadUsage(); showStatus('Refreshed'); }}>
          ↻ Refresh
        </button>
        <span style={{ fontSize: 12, color: '#9ca3af' }}>
          Model assignments are configured via env vars. Restart api/ after changes.
        </span>
      </div>

      {error && <div className="adm-error">{error}</div>}
      {loading && <div className="adm-loading">Loading model assignments...</div>}

      {/* Usage summary card */}
      {usage && usage.totalCalls > 0 && (
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: 12, marginBottom: 20,
        }}>
          <UsageCard label="Total Calls" value={usage.totalCalls} />
          <UsageCard label="Total Cost" value={`$${usage.totalCost.toFixed(4)}`} />
          <UsageCard label="Input Tokens" value={usage.totalInputTokens.toLocaleString()} />
          <UsageCard label="Output Tokens" value={usage.totalOutputTokens.toLocaleString()} />
        </div>
      )}

      {/* Usage by model */}
      {usage && usage.byModel && Object.keys(usage.byModel).length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>Session Usage by Model</h3>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>Model</th>
                  <th>Calls</th>
                  <th>Input Tokens</th>
                  <th>Output Tokens</th>
                  <th>Cost</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(usage.byModel).sort((a, b) => b[1].cost - a[1].cost).map(([model, stats]) => (
                  <tr key={model}>
                    <td><ModelBadge model={model} /></td>
                    <td className="adm-mono">{stats.calls}</td>
                    <td className="adm-mono">{stats.inputTokens.toLocaleString()}</td>
                    <td className="adm-mono">{stats.outputTokens.toLocaleString()}</td>
                    <td className="adm-mono">${stats.cost.toFixed(4)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Model assignments by category */}
      {CATEGORY_ORDER.map(cat => {
        const items = grouped[cat];
        if (!items || items.length === 0) return null;
        return (
          <div key={cat} style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 8 }}>
              {CATEGORY_LABELS[cat] || cat}
            </h3>
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Service</th>
                    <th>Description</th>
                    <th>Current Model</th>
                    <th>Alternatives</th>
                    <th>Env Override</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map(a => (
                    <tr key={a.service}>
                      <td className="adm-bold">{a.service}</td>
                      <td style={{ fontSize: 11, color: '#6b7280', maxWidth: 280 }}>{a.description}</td>
                      <td><ModelBadge model={a.currentModel} /></td>
                      <td>
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                          {a.alternatives.filter(m => m !== a.currentModel).map(m => (
                            <ModelBadge key={m} model={m} />
                          ))}
                        </div>
                      </td>
                      <td>
                        {a.envOverride && (
                          <code style={{ fontSize: 10, background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>
                            {a.envOverride}
                          </code>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function UsageCard({ label, value }) {
  return (
    <div style={{
      background: 'white', border: '1px solid #e5e7eb', borderRadius: 10,
      padding: '14px 16px', textAlign: 'center',
    }}>
      <div style={{ fontSize: 11, color: '#9ca3af', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.5 }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 700, fontFamily: "'IBM Plex Mono', monospace", marginTop: 4 }}>{value}</div>
    </div>
  );
}
