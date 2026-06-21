import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, updateDoc, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';

const TIERS = [
  { id: 'explorer', label: 'Explorer', color: '#6b7280', bg: '#f3f4f6', limit: 0 },
  { id: 'starter', label: 'Starter', color: '#92400e', bg: '#fef3c7', limit: 3 },
  { id: 'trader', label: 'Trader', color: '#166534', bg: '#dcfce7', limit: 5 },
  { id: 'premium', label: 'Premium', color: '#7c3aed', bg: '#ede9fe', limit: 10 },
  { id: 'institutional', label: 'Institutional', color: '#1e40af', bg: '#dbeafe', limit: 25 },
];

const MODEL_COLORS = {
  'claude-sonnet': '#0B2D23',
  'claude-haiku': '#1a5c44',
  'gpt-4': '#5a3a8a',
  'deepseek': '#1a7070',
  'deepseek-r1': '#2d7d4f',
  'qwen-max': '#C9A96E',
  'grok': '#b03030',
  'gemini-pro': '#1e40af',
  'gemini-flash': '#6b7280',
};

// Map internal tier names to actual API model names for display
const MODEL_DISPLAY = {
  'gpt-4': 'gpt-4o',
  'gemini-pro': 'gemini-2.5-pro',
  'gemini-flash': 'gemini-2.5-flash',
};
const displayModel = (tier) => MODEL_DISPLAY[tier] || tier;

/** Merge legacy "qwq" and "qwen-plus" keys into "qwen-max" in a usageByModel map */
function normalizeModelKeys(byModel) {
  if (!byModel) return byModel;
  const legacyKeys = ['qwq', 'qwen-plus'];
  if (!legacyKeys.some(k => byModel[k])) return byModel;
  const out = { ...byModel };
  if (!out['qwen-max']) out['qwen-max'] = { calls: 0, tokens: 0, cost: 0 };
  for (const key of legacyKeys) {
    if (out[key]) {
      out['qwen-max'] = {
        calls: (out['qwen-max'].calls || 0) + (out[key].calls || 0),
        tokens: (out['qwen-max'].tokens || 0) + (out[key].tokens || 0),
        cost: (out['qwen-max'].cost || 0) + (out[key].cost || 0),
      };
      delete out[key];
    }
  }
  return out;
}

export function UsageReport() {
  const [users, setUsers] = useState([]);
  const [apiKeys, setApiKeys] = useState([]);
  const [events, setEvents] = useState([]);
  const [allModelUsage, setAllModelUsage] = useState({});
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedApiKey, setSelectedApiKey] = useState(null);
  const [tab, setTab] = useState('models'); // 'models' | 'apikeys' | 'users'

  // Load API keys (new per-model tracking)
  const loadApiKeys = useCallback(async () => {
    try {
      const snap = await getDocs(collection(db, 'apiKeys'));
      const keys = snap.docs.map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.llmCost || 0) - (a.llmCost || 0));
      setApiKeys(keys);
    } catch (err) {
      console.error('Failed to load API keys:', err);
    }
  }, []);

  // Load discover_usage users (legacy)
  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const [usageSnap, authSnap] = await Promise.all([
        getDocs(collection(db, 'discover_usage')),
        getDocs(collection(db, 'users')),
      ]);

      const usageByEmail = {};
      usageSnap.docs.filter(d => d.data().email).forEach(d => {
        const data = d.data();
        usageByEmail[data.email] = { id: d.id, ...data };
      });

      const merged = [];
      const seenEmails = new Set();

      authSnap.docs.forEach(d => {
        const data = d.data();
        const email = data.email || '';
        if (!email || seenEmails.has(email)) return;
        seenEmails.add(email);
        const usage = usageByEmail[email] || {};
        merged.push({
          id: usage.id || email.replace(/[^a-zA-Z0-9]/g, '_'),
          email, displayName: data.displayName || '', uid: d.id,
          tier: usage.tier || null, dailyLimit: usage.dailyLimit ?? null,
          totalRequests: usage.totalRequests || 0, totalCost: usage.totalCost || 0,
          totalTokens: usage.totalTokens || 0,
          lastActiveAt: usage.lastActiveAt || data.lastLoginAt || null,
          lastTicker: usage.lastTicker || '', lastAction: usage.lastAction || '',
          firstSeenAt: usage.firstSeenAt || data.createdAt || null,
          hasUsage: !!usageByEmail[email],
        });
      });

      Object.values(usageByEmail).forEach(u => {
        if (!seenEmails.has(u.email)) {
          seenEmails.add(u.email);
          merged.push({ ...u, hasUsage: true });
        }
      });

      merged.sort((a, b) => (b.totalRequests || 0) - (a.totalRequests || 0));
      setUsers(merged);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEvents = useCallback(async (userId) => {
    try {
      const q = query(collection(db, 'discover_usage', userId, 'events'), orderBy('timestamp', 'desc'), limit(50));
      const snap = await getDocs(q);
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) { setEvents([]); }
  }, []);

  // Load all events from all users to build global model breakdown
  const loadAllModelUsage = useCallback(async (userList) => {
    const modelMap = {};
    for (const u of userList.filter(x => x.totalRequests > 0)) {
      try {
        const q = query(collection(db, 'discover_usage', u.id, 'events'), orderBy('timestamp', 'desc'), limit(200));
        const snap = await getDocs(q);
        snap.docs.forEach(d => {
          const e = d.data();
          (e.models || []).forEach(m => {
            if (!modelMap[m]) modelMap[m] = { calls: 0, tokens: 0, cost: 0, users: new Set() };
            modelMap[m].calls++;
            modelMap[m].tokens += e.tokens || 0;
            modelMap[m].cost += e.cost || 0;
            modelMap[m].users.add(u.email);
          });
        });
      } catch (_) {}
    }
    // Merge legacy qwq/qwen-plus → qwen-max
    for (const legacyKey of ['qwq', 'qwen-plus']) {
      if (modelMap[legacyKey]) {
        if (!modelMap['qwen-max']) modelMap['qwen-max'] = { calls: 0, tokens: 0, cost: 0, users: new Set() };
        modelMap['qwen-max'].calls += modelMap[legacyKey].calls;
        modelMap['qwen-max'].tokens += modelMap[legacyKey].tokens;
        modelMap['qwen-max'].cost += modelMap[legacyKey].cost;
        modelMap[legacyKey].users.forEach(u => modelMap['qwen-max'].users.add(u));
        delete modelMap[legacyKey];
      }
    }
    // Convert Sets to counts
    const result = {};
    Object.entries(modelMap).forEach(([m, s]) => {
      result[m] = { calls: s.calls, tokens: s.tokens, cost: s.cost, userCount: s.users.size };
    });
    setAllModelUsage(result);
  }, []);

  useEffect(() => { loadApiKeys(); loadUsers(); }, [loadApiKeys, loadUsers]);
  useEffect(() => { if (users.length > 0) loadAllModelUsage(users); }, [users, loadAllModelUsage]);

  const updateTier = async (userId, tier) => {
    try {
      await updateDoc(doc(db, 'discover_usage', userId), { tier, dailyLimit: TIERS.find(t => t.id === tier)?.limit || 5 });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, tier, dailyLimit: TIERS.find(t => t.id === tier)?.limit || 5 } : u));
    } catch (err) { console.error('Failed to update tier:', err); }
  };

  const selectUser = (user) => { setSelectedUser(user); setSelectedApiKey(null); loadEvents(user.id); };
  const selectApiKey = (key) => { setSelectedApiKey(key); setSelectedUser(null); };

  // Aggregate usage from BOTH sources: apiKeys (default db) + discover_usage (newleafdb)
  const globalModelUsage = {};
  let globalCost = 0, globalCalls = 0, globalTokens = 0;

  // From API keys (if available)
  apiKeys.forEach(k => {
    globalCost += k.llmCost || 0;
    globalCalls += k.llmCallCount || 0;
    globalTokens += k.llmTokens || 0;
    const byModel = k.usageByModel || {};
    Object.entries(byModel).forEach(([model, stats]) => {
      if (!globalModelUsage[model]) globalModelUsage[model] = { calls: 0, tokens: 0, cost: 0 };
      globalModelUsage[model].calls += stats.calls || 0;
      globalModelUsage[model].tokens += stats.tokens || 0;
      globalModelUsage[model].cost += stats.cost || 0;
    });
  });

  // From discover_usage users (the data that's actually populated)
  let discoverCost = 0, discoverCalls = 0, discoverTokens = 0;
  users.forEach(u => {
    discoverCost += u.totalCost || 0;
    discoverCalls += u.totalRequests || 0;
    discoverTokens += u.totalTokens || 0;
  });

  // Normalize legacy "qwq"/"qwen-plus" keys → "qwen-max"
  for (const legacyKey of ['qwq', 'qwen-plus']) {
    if (globalModelUsage[legacyKey]) {
      if (!globalModelUsage['qwen-max']) globalModelUsage['qwen-max'] = { calls: 0, tokens: 0, cost: 0 };
      globalModelUsage['qwen-max'].calls += globalModelUsage[legacyKey].calls;
      globalModelUsage['qwen-max'].tokens += globalModelUsage[legacyKey].tokens;
      globalModelUsage['qwen-max'].cost += globalModelUsage[legacyKey].cost;
      delete globalModelUsage[legacyKey];
    }
  }

  // Use whichever source has data
  const totalCost = globalCost > 0 ? globalCost : discoverCost;
  const totalCalls = globalCalls > 0 ? globalCalls : discoverCalls;
  const totalTokens = globalTokens > 0 ? globalTokens : discoverTokens;

  return (
    <div>
      <div className="dk-week-header">
        <h1>Usage Report</h1>
        <p>LLM usage per API key, per-model breakdown, and cost tracking</p>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <div className="dk-detail-section" style={{ padding: 16 }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: '#9ca3af', fontWeight: 600 }}>Total Cost</div>
          <div style={{ fontSize: 28, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace", color: '#166534', marginTop: 4 }}>${totalCost.toFixed(4)}</div>
        </div>
        <div className="dk-detail-section" style={{ padding: 16 }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: '#9ca3af', fontWeight: 600 }}>LLM Calls</div>
          <div style={{ fontSize: 28, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace", marginTop: 4 }}>{totalCalls.toLocaleString()}</div>
        </div>
        <div className="dk-detail-section" style={{ padding: 16 }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: '#9ca3af', fontWeight: 600 }}>Total Tokens</div>
          <div style={{ fontSize: 28, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace", marginTop: 4 }}>{totalTokens.toLocaleString()}</div>
        </div>
        <div className="dk-detail-section" style={{ padding: 16 }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '.1em', color: '#9ca3af', fontWeight: 600 }}>Active Users</div>
          <div style={{ fontSize: 28, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace", marginTop: 4 }}>{users.filter(u => u.totalRequests > 0).length}</div>
        </div>
      </div>

      {/* Global model breakdown */}
      {Object.keys(globalModelUsage).length > 0 && (
        <div className="dk-detail-section" style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Usage by Model (all keys)</h3>
          {/* Bar chart */}
          <div style={{ display: 'flex', height: 28, borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
            {Object.entries(globalModelUsage).sort((a, b) => b[1].cost - a[1].cost).map(([model, stats]) => {
              const pct = globalCost > 0 ? (stats.cost / globalCost) * 100 : 0;
              if (pct < 0.5) return null;
              return <div key={model} style={{ width: pct + '%', background: MODEL_COLORS[model] || '#6b7280', minWidth: 2 }} title={`${displayModel(model)}: $${stats.cost.toFixed(4)} (${pct.toFixed(1)}%)`} />;
            })}
          </div>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 11, color: '#6b7280' }}>
            {Object.entries(globalModelUsage).sort((a, b) => b[1].cost - a[1].cost).map(([model, stats]) => (
              <span key={model} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: MODEL_COLORS[model] || '#6b7280' }} />
                {displayModel(model)}: ${stats.cost.toFixed(4)} · {stats.calls} calls
              </span>
            ))}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginTop: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e8e5e0' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>Model</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>Calls</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>Tokens</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>Cost</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>% of Total</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(globalModelUsage).sort((a, b) => b[1].cost - a[1].cost).map(([model, stats]) => (
                <tr key={model} style={{ borderBottom: '1px solid #f0eeeb' }}>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 2, background: MODEL_COLORS[model] || '#6b7280' }} />
                      <span style={{ fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }}>{displayModel(model)}</span>
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace" }}>{stats.calls.toLocaleString()}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace" }}>{stats.tokens.toLocaleString()}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>${stats.cost.toFixed(4)}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#6b7280' }}>{globalCost > 0 ? ((stats.cost / globalCost) * 100).toFixed(1) : 0}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Global model breakdown from discover_usage events */}
      {Object.keys(allModelUsage).length > 0 && (
        <div className="dk-detail-section" style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Usage by Model</h3>
          <div style={{ display: 'flex', height: 32, borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
            {Object.entries(allModelUsage).sort((a, b) => b[1].cost - a[1].cost).map(([model, stats]) => {
              const pct = totalCost > 0 ? (stats.cost / totalCost) * 100 : 0;
              if (pct < 0.3) return null;
              return <div key={model} style={{ width: pct + '%', background: MODEL_COLORS[model] || '#6b7280', minWidth: 2 }} title={`${displayModel(model)}: $${stats.cost.toFixed(4)} (${pct.toFixed(1)}%)`} />;
            })}
          </div>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e8e5e0' }}>
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>Model</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>Calls</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>Tokens</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>Cost</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>% of Total</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>Avg $/Call</th>
                <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>Users</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(allModelUsage).sort((a, b) => b[1].cost - a[1].cost).map(([model, stats]) => (
                <tr key={model} style={{ borderBottom: '1px solid #f0eeeb' }}>
                  <td style={{ padding: '8px 12px' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ width: 10, height: 10, borderRadius: 3, background: MODEL_COLORS[model] || '#6b7280' }} />
                      <span style={{ fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace", fontSize: 12 }}>{displayModel(model)}</span>
                    </span>
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace" }}>{stats.calls.toLocaleString()}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace" }}>{stats.tokens.toLocaleString()}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>${stats.cost.toFixed(4)}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#6b7280' }}>{totalCost > 0 ? ((stats.cost / totalCost) * 100).toFixed(1) : 0}%</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#6b7280' }}>${stats.calls > 0 ? (stats.cost / stats.calls).toFixed(4) : '0'}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace" }}>{stats.userCount}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
        <button onClick={() => setTab('apikeys')} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', fontWeight: 600, fontSize: 12, cursor: 'pointer', background: tab === 'apikeys' ? '#0B2D23' : '#f3f2ef', color: tab === 'apikeys' ? '#fff' : '#6b7280' }}>API Keys ({apiKeys.length})</button>
        <button onClick={() => setTab('users')} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', fontWeight: 600, fontSize: 12, cursor: 'pointer', background: tab === 'users' ? '#0B2D23' : '#f3f2ef', color: tab === 'users' ? '#fff' : '#6b7280' }}>Discover Users ({users.length})</button>
      </div>

      {loading && <div className="dk-loading">Loading...</div>}

      {/* API Keys table */}
      {tab === 'apikeys' && (
        <div className="dk-detail-section" style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>API Keys</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e8e5e0' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>Owner</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>Role</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>Requests</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>LLM Calls</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>Tokens</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>Cost</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>Last Ticker</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {apiKeys.map(k => (
                  <tr key={k.id} onClick={() => selectApiKey(k)} style={{ cursor: 'pointer', borderBottom: '1px solid #f0eeeb', background: selectedApiKey?.id === k.id ? '#ecfdf5' : '' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{k.ownerId || k.id.slice(0, 12)}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600, background: k.role === 'admin' ? '#dbeafe' : k.role === 'premium' ? '#dcfce7' : '#f3f4f6', color: k.role === 'admin' ? '#1e40af' : k.role === 'premium' ? '#166534' : '#6b7280' }}>{k.role || 'free'}</span>
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace" }}>{(k.requestCount || 0).toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace" }}>{(k.llmCallCount || 0).toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace" }}>{(k.llmTokens || 0).toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>${(k.llmCost || 0).toFixed(4)}</td>
                    <td style={{ padding: '8px 12px' }}>{k.lastTicker || '---'}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: k.active ? '#22c55e' : '#ef4444', display: 'inline-block' }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Selected API key — per-model breakdown */}
      {selectedApiKey && (
        <div className="dk-detail-section" style={{ marginBottom: 16 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
            {selectedApiKey.ownerId || selectedApiKey.id.slice(0, 12)} — Per-Model Breakdown
          </h3>
          {selectedApiKey.usageByModel && Object.keys(selectedApiKey.usageByModel).length > 0 ? (() => {
            const normalized = normalizeModelKeys(selectedApiKey.usageByModel);
            return (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e8e5e0' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>Model</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>Calls</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>Tokens</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>Cost</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>Avg $/Call</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(normalized).sort((a, b) => (b[1].cost || 0) - (a[1].cost || 0)).map(([model, stats]) => (
                  <tr key={model} style={{ borderBottom: '1px solid #f0eeeb' }}>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: 2, background: MODEL_COLORS[model] || '#6b7280' }} />
                        <span style={{ fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }}>{displayModel(model)}</span>
                      </span>
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace" }}>{(stats.calls || 0).toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace" }}>{(stats.tokens || 0).toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600 }}>${(stats.cost || 0).toFixed(4)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", color: '#6b7280' }}>${stats.calls > 0 ? (stats.cost / stats.calls).toFixed(4) : '0'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            );
          })() : (
            <p style={{ fontSize: 12, color: '#9ca3af' }}>No per-model data yet. Model tracking starts with the next API call.</p>
          )}
        </div>
      )}

      {/* Users table (legacy discover_usage) */}
      {tab === 'users' && (
        <div className="dk-detail-section" style={{ marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Discover Users ({users.length})</h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e8e5e0' }}>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>Email</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>Tier</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>Daily Limit</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>Requests</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>Cost</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>Tokens</th>
                  <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>Last Active</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} onClick={() => selectUser(u)} style={{ cursor: 'pointer', borderBottom: '1px solid #f0eeeb', background: selectedUser?.id === u.id ? '#ecfdf5' : '' }}>
                    <td style={{ padding: '8px 12px', fontWeight: 600 }}>{u.email}</td>
                    <td style={{ padding: '8px 12px' }} onClick={e => e.stopPropagation()}>
                      <select value={u.tier || 'explorer'} onChange={e => updateTier(u.id, e.target.value)}
                        style={{ padding: '3px 8px', borderRadius: 6, border: '1px solid #e8e5e0', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                          background: TIERS.find(t => t.id === (u.tier || 'explorer'))?.bg || '#f3f4f6',
                          color: TIERS.find(t => t.id === (u.tier || 'explorer'))?.color || '#6b7280' }}>
                        {TIERS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }}>{u.dailyLimit ?? TIERS.find(t => t.id === (u.tier || 'explorer'))?.limit ?? 0}/day</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace" }}>{u.totalRequests || 0}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace" }}>${(u.totalCost || 0).toFixed(3)}</td>
                    <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace" }}>{(u.totalTokens || 0).toLocaleString()}</td>
                    <td style={{ padding: '8px 12px', fontSize: 11, color: '#6b7280' }}>{u.lastActiveAt?.toDate?.()?.toLocaleDateString() || '---'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Selected user events (legacy) */}
      {selectedUser && events.length > 0 && (
        <div className="dk-detail-section">
          <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
            {selectedUser.email} — Recent Events (last 50)
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #e8e5e0' }}>
                  <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: 9, color: '#9ca3af', textTransform: 'uppercase' }}>Action</th>
                  <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: 9, color: '#9ca3af', textTransform: 'uppercase' }}>Ticker</th>
                  <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: 9, color: '#9ca3af', textTransform: 'uppercase' }}>Models</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right', fontSize: 9, color: '#9ca3af', textTransform: 'uppercase' }}>Cost</th>
                  <th style={{ padding: '6px 10px', textAlign: 'right', fontSize: 9, color: '#9ca3af', textTransform: 'uppercase' }}>Tokens</th>
                  <th style={{ padding: '6px 10px', textAlign: 'left', fontSize: 9, color: '#9ca3af', textTransform: 'uppercase' }}>Time</th>
                </tr>
              </thead>
              <tbody>
                {events.map(e => (
                  <tr key={e.id} style={{ borderBottom: '1px solid #f0eeeb' }}>
                    <td style={{ padding: '6px 10px' }}>
                      <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: e.action === 'verify' ? '#fee2e2' : e.action === 'recommend' ? '#fef3c7' : '#f3f2ef', color: e.action === 'verify' ? '#991b1b' : e.action === 'recommend' ? '#92400e' : '#6b7280' }}>{e.action}</span>
                    </td>
                    <td style={{ padding: '6px 10px', fontWeight: 600 }}>{e.ticker || '---'}</td>
                    <td style={{ padding: '6px 10px', fontSize: 10, color: '#6b7280' }}>{(e.models || []).join(', ') || '---'}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace" }}>{e.cost ? '$' + e.cost.toFixed(4) : '---'}</td>
                    <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace" }}>{e.tokens ? e.tokens.toLocaleString() : '---'}</td>
                    <td style={{ padding: '6px 10px', fontSize: 10, color: '#6b7280' }}>{e.timestamp?.toDate?.()?.toLocaleString() || '---'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
