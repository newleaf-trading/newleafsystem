import { useState, useEffect, useCallback } from 'react';
import { collection, getDocs, doc, updateDoc, query, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';

const TIERS = [
  { id: 'explorer', label: 'Explorer', color: '#6b7280', bg: '#f3f4f6', limit: 0 },
  { id: 'starter', label: 'Starter', color: '#92400e', bg: '#fef3c7', limit: 3 },
  { id: 'trader', label: 'Trader', color: '#166534', bg: '#dcfce7', limit: 5 },
  { id: 'institutional', label: 'Institutional', color: '#1e40af', bg: '#dbeafe', limit: 25 },
];

export function UsageReport() {
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, 'discover_usage'));
      const data = snap.docs
        .filter(d => d.data().email)
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.totalRequests || 0) - (a.totalRequests || 0));
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadEvents = useCallback(async (userId) => {
    try {
      const q = query(
        collection(db, 'discover_usage', userId, 'events'),
        orderBy('timestamp', 'desc'),
        limit(50)
      );
      const snap = await getDocs(q);
      setEvents(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err) {
      console.error('Failed to load events:', err);
      setEvents([]);
    }
  }, []);

  useEffect(() => { loadUsers(); }, [loadUsers]);

  const updateTier = async (userId, tier) => {
    try {
      await updateDoc(doc(db, 'discover_usage', userId), { tier, dailyLimit: TIERS.find(t => t.id === tier)?.limit || 5 });
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, tier, dailyLimit: TIERS.find(t => t.id === tier)?.limit || 5 } : u));
    } catch (err) {
      console.error('Failed to update tier:', err);
    }
  };

  const selectUser = (user) => {
    setSelectedUser(user);
    loadEvents(user.id);
  };

  // Aggregate model usage across all events
  const modelBreakdown = {};
  events.forEach(e => {
    (e.models || []).forEach(m => {
      if (!modelBreakdown[m]) modelBreakdown[m] = { calls: 0, cost: 0, tokens: 0 };
      modelBreakdown[m].calls++;
      modelBreakdown[m].cost += e.cost || 0;
      modelBreakdown[m].tokens += e.tokens || 0;
    });
  });

  return (
    <div>
      <div className="dk-week-header">
        <h1>Usage Report</h1>
        <p>Per-user LLM usage, model breakdown, and cost tracking</p>
      </div>

      {loading && <div className="dk-loading">Loading...</div>}

      {/* Users table */}
      <div className="dk-detail-section" style={{ marginBottom: 20 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>Users ({users.length})</h3>
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
                <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>Last Ticker</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} onClick={() => selectUser(u)} style={{ cursor: 'pointer', borderBottom: '1px solid #f0eeeb', background: selectedUser?.id === u.id ? '#ecfdf5' : '' }}>
                  <td style={{ padding: '8px 12px', fontWeight: 600 }}>{u.email}</td>
                  <td style={{ padding: '8px 12px' }} onClick={e => e.stopPropagation()}>
                    <select
                      value={u.tier || 'explorer'}
                      onChange={e => updateTier(u.id, e.target.value)}
                      style={{
                        padding: '3px 8px', borderRadius: 6, border: '1px solid #e8e5e0', fontSize: 11, fontWeight: 600, cursor: 'pointer',
                        background: TIERS.find(t => t.id === (u.tier || 'explorer'))?.bg || '#f3f4f6',
                        color: TIERS.find(t => t.id === (u.tier || 'explorer'))?.color || '#6b7280',
                      }}
                    >
                      {TIERS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                    </select>
                  </td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace", fontSize: 11 }}>{u.dailyLimit ?? TIERS.find(t => t.id === (u.tier || 'explorer'))?.limit ?? 0}/day</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace" }}>{u.totalRequests || 0}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace" }}>${(u.totalCost || 0).toFixed(3)}</td>
                  <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace" }}>{(u.totalTokens || 0).toLocaleString()}</td>
                  <td style={{ padding: '8px 12px', fontSize: 11, color: '#6b7280' }}>{u.lastActiveAt?.toDate?.()?.toLocaleDateString() || '---'}</td>
                  <td style={{ padding: '8px 12px' }}>{u.lastTicker || '---'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Selected user detail */}
      {selectedUser && (
        <div>
          <div className="dk-detail-section" style={{ marginBottom: 16 }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
              {selectedUser.email} — Model Breakdown
            </h3>
            {Object.keys(modelBreakdown).length > 0 ? (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #e8e5e0' }}>
                      <th style={{ padding: '8px 12px', textAlign: 'left', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>Model</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>Calls</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>Cost</th>
                      <th style={{ padding: '8px 12px', textAlign: 'right', fontSize: 10, color: '#9ca3af', textTransform: 'uppercase' }}>Tokens</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(modelBreakdown).sort((a, b) => b[1].cost - a[1].cost).map(([model, stats]) => (
                      <tr key={model} style={{ borderBottom: '1px solid #f0eeeb' }}>
                        <td style={{ padding: '8px 12px', fontWeight: 600 }}>
                          <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace", background: '#f3f2ef' }}>{model}</span>
                        </td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace" }}>{stats.calls}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace" }}>${stats.cost.toFixed(4)}</td>
                        <td style={{ padding: '8px 12px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace" }}>{stats.tokens.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p style={{ fontSize: 12, color: '#9ca3af' }}>No model data yet (events from before tracking update won't have models)</p>
            )}
          </div>

          <div className="dk-detail-section">
            <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 10 }}>
              Recent Events (last 50)
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
                        <span style={{ padding: '2px 6px', borderRadius: 4, fontSize: 10, fontWeight: 600, background: e.action === 'verify' ? '#fee2e2' : e.action === 'recommend' ? '#fef3c7' : '#f3f2ef', color: e.action === 'verify' ? '#991b1b' : e.action === 'recommend' ? '#92400e' : '#6b7280' }}>
                          {e.action}
                        </span>
                      </td>
                      <td style={{ padding: '6px 10px', fontWeight: 600 }}>{e.ticker || '---'}</td>
                      <td style={{ padding: '6px 10px', fontSize: 10, color: '#6b7280' }}>{(e.models || []).join(', ') || '---'}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace" }}>{e.cost ? '$' + e.cost.toFixed(4) : '---'}</td>
                      <td style={{ padding: '6px 10px', textAlign: 'right', fontFamily: "'IBM Plex Mono', monospace" }}>{e.tokens ? e.tokens.toLocaleString() : '---'}</td>
                      <td style={{ padding: '6px 10px', fontSize: 10, color: '#6b7280' }}>{e.timestamp?.toDate?.()?.toLocaleString() || e.date || '---'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
