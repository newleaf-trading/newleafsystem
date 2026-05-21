import { useState, useEffect } from 'react';
import { useAdmin } from '../hooks/useAdmin';
import { formatStrategy, formatCurrency } from '../utils/formatters';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, ReferenceLine } from 'recharts';
import { AlertConfigPanel } from '../components/admin/AlertConfigPanel';
import { ApiDiagnostics } from '../components/admin/ApiDiagnostics';

export function AdminPage() {
  const {
    isAdmin, tiles, users, allUsers, impersonatedUserId, pnlHistory, loading, error,
    loadTiles, loadUsers, updateTile, updateTileLeg, updatePortfolioItem,
    refreshDTE, bulkUpdateExpiry, seedTestPnl,
    populateLegs, populateAllLegs, updateLegPremium, recalcPnl,
    quickSimulate, quickSimulateAll, resetToEntry, markOrphansAsClosed,
    recordPnlSnapshot, loadPnlHistory, resetAllPnl,
    seedClosedTradeHistory,
    deleteAllStrategies, clearAllPortfolioHistory,
    loadAllUsersFromFirestore, setImpersonatedUser,
  } = useAdmin();

  const [tab, setTab] = useState('portfolios');
  const [editingCell, setEditingCell] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [selectedTiles, setSelectedTiles] = useState(new Set());
  const [bulkExpiry, setBulkExpiry] = useState('');
  const [expandedPositions, setExpandedPositions] = useState(new Set());
  const [expandedTiles, setExpandedTiles] = useState(new Set());

  useEffect(() => { loadTiles(); loadUsers(); }, [loadTiles, loadUsers]);

  const showStatus = (msg) => { setStatusMsg(msg); setTimeout(() => setStatusMsg(''), 4000); };

  // ── Inline edit helpers ──
  const startEdit = (id, field, currentVal) => {
    setEditingCell({ id, field });
    setEditValue(currentVal?.toString() || '');
  };
  const cancelEdit = () => { setEditingCell(null); setEditValue(''); };

  const saveTileEdit = async (tileId, field) => {
    let val = editValue;
    if (['daysToExpiry', 'sortOrder', 'underlyingPrice'].includes(field)) val = parseFloat(val) || 0;
    if (field === 'isActive') val = val === 'true' || val === true;
    const ok = await updateTile(tileId, { [field]: val });
    if (ok) showStatus(`Updated ${field} for ${tileId}`);
    cancelEdit();
  };

  const saveTileLegEdit = async (tileId, legIndex, field) => {
    let val = editValue;
    if (['strike', 'premium', 'delta', 'quantity'].includes(field)) val = parseFloat(val) || 0;
    const ok = await updateTileLeg(tileId, legIndex, { [field]: val });
    if (ok) showStatus(`Updated leg ${legIndex} ${field}`);
    cancelEdit();
  };

  const savePortfolioEdit = async (userId, tileId, field) => {
    let val = editValue;
    if (['entryNetCredit', 'currentNetValue', 'unrealizedPnl', 'realizedPnl', 'currentUnderlyingPrice', 'entryUnderlyingPrice', 'quantity'].includes(field)) {
      val = parseFloat(val) || 0;
    }
    const ok = await updatePortfolioItem(userId, tileId, { [field]: val });
    if (ok) showStatus(`Updated ${field} for ${tileId}`);
    cancelEdit();
  };

  const handleDteRefresh = async () => {
    const result = await refreshDTE();
    showStatus(`DTE refreshed: ${result.updated} of ${result.total} tiles updated`);
  };

  const handleBulkExpiry = async () => {
    if (!bulkExpiry || selectedTiles.size === 0) return;
    const ok = await bulkUpdateExpiry([...selectedTiles], bulkExpiry);
    if (ok) { showStatus(`Updated expiry for ${selectedTiles.size} tiles`); setSelectedTiles(new Set()); setBulkExpiry(''); }
  };

  const toggleTileSelect = (tileId) => {
    setSelectedTiles(prev => { const n = new Set(prev); n.has(tileId) ? n.delete(tileId) : n.add(tileId); return n; });
  };
  const selectAllTiles = () => {
    setSelectedTiles(prev => prev.size === tiles.length ? new Set() : new Set(tiles.map(t => t.id)));
  };

  const toggleExpand = (itemId) => {
    setExpandedPositions(prev => { const n = new Set(prev); n.has(itemId) ? n.delete(itemId) : n.add(itemId); return n; });
  };
  const toggleTileExpand = (tileId) => {
    setExpandedTiles(prev => { const n = new Set(prev); n.has(tileId) ? n.delete(tileId) : n.add(tileId); return n; });
  };

  // count orphans
  const tileIds = new Set(tiles.map(t => t.id));
  const activePositions = users[0]?.portfolio?.filter(p => p.status !== 'closed') || [];
  const closedPositions = users[0]?.portfolio?.filter(p => p.status === 'closed') || [];
  const orphanCount = activePositions.filter(p => !tileIds.has(p.id)).length;

  // ── Editable cell ──
  const EditableCell = ({ id, field, value, type = 'text', onSave }) => {
    const isEditing = editingCell?.id === id && editingCell?.field === field;
    if (isEditing) {
      return (
        <span className="adm-edit-wrap">
          <input className="adm-edit-input" type={type} value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') onSave(); if (e.key === 'Escape') cancelEdit(); }}
            autoFocus style={{ width: type === 'number' ? '80px' : '120px' }} />
          <button className="adm-save-btn" onClick={onSave}>✓</button>
          <button className="adm-cancel-btn" onClick={cancelEdit}>✕</button>
        </span>
      );
    }
    const display = value === null || value === undefined || value === '' || value === 0 ? '—' : value;
    return <span className="adm-cell-val" onClick={() => startEdit(id, field, value)} title="Click to edit">{display}</span>;
  };

  // ── Leg premium editor ──
  const LegPremiumCell = ({ userId, tileId, leg }) => {
    const cellId = `leg-${tileId}-${leg.legIndex}`;
    const isEditing = editingCell?.id === cellId && editingCell?.field === 'currentPremium';

    if (isEditing) {
      return (
        <span className="adm-edit-wrap">
          <input className="adm-edit-input" type="number" step="0.01" value={editValue}
            onChange={e => setEditValue(e.target.value)}
            onKeyDown={async e => {
              if (e.key === 'Enter') {
                const ok = await updateLegPremium(userId, tileId, leg.legIndex, editValue);
                if (ok) showStatus(`Leg ${leg.legIndex} → $${editValue}`);
                cancelEdit();
              }
              if (e.key === 'Escape') cancelEdit();
            }}
            autoFocus style={{ width: '80px' }} />
          <button className="adm-save-btn" onClick={async () => {
            const ok = await updateLegPremium(userId, tileId, leg.legIndex, editValue);
            if (ok) showStatus(`Leg ${leg.legIndex} → $${editValue}`);
            cancelEdit();
          }}>✓</button>
          <button className="adm-cancel-btn" onClick={cancelEdit}>✕</button>
        </span>
      );
    }

    const val = leg.currentPremium || 0;
    return (
      <span className="adm-cell-val" onClick={() => startEdit(cellId, 'currentPremium', val)} title="Click to edit">
        {val > 0 ? `$${val.toFixed(2)}` : '—'}
      </span>
    );
  };

  return (
    <div className="page-body adm-page">
      <div className="adm-header">
        <div>
          <h1>⚙️ Admin Dashboard</h1>
          <p>Manage tiles, portfolios, and data pipelines</p>
          {impersonatedUserId && (
            <div style={{ marginTop: 8, padding: '6px 12px', background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 6, display: 'inline-block' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#92400e' }}>
                👤 Viewing as: {allUsers.find(u => u.uid === impersonatedUserId)?.email || impersonatedUserId}
              </span>
              <button
                style={{ marginLeft: 8, fontSize: 11, padding: '2px 8px', background: '#fff', border: '1px solid #d97706', borderRadius: 4, cursor: 'pointer' }}
                onClick={async () => {
                  await setImpersonatedUser(null);
                  showStatus('Returned to your account');
                }}>
                ✕ Exit
              </button>
            </div>
          )}
        </div>
        {statusMsg && <div className="adm-status">{statusMsg}</div>}
        {error && <div className="adm-error">Error: {error}</div>}
      </div>

      <div className="adm-tabs">
        <button className={`adm-tab${tab === 'tiles' ? ' active' : ''}`} onClick={() => setTab('tiles')}>
          📊 Tiles ({tiles.length})
        </button>
        <button className={`adm-tab${tab === 'portfolios' ? ' active' : ''}`} onClick={() => setTab('portfolios')}>
          💼 Portfolios ({users.reduce((s, u) => s + u.portfolio.length, 0)})
        </button>
        <button className={`adm-tab${tab === 'pnlChart' ? ' active' : ''}`} onClick={() => { setTab('pnlChart'); if (users[0]) loadPnlHistory(users[0].uid); }}>
          📈 P&L Chart
        </button>
        <button className={`adm-tab${tab === 'users' ? ' active' : ''}`} onClick={() => { setTab('users'); loadAllUsersFromFirestore(); }}>
          👥 Users ({allUsers.length || '...'})
        </button>
        <button className={`adm-tab${tab === 'alerts' ? ' active' : ''}`} onClick={() => setTab('alerts')}>
          🔔 Alerts
        </button>
        <button className={`adm-tab${tab === 'tools' ? ' active' : ''}`} onClick={() => setTab('tools')}>
          🛠 Tools
        </button>
        <button className={`adm-tab${tab === 'api' ? ' active' : ''}`} onClick={() => setTab('api')}>
          🔍 API Diagnostics
        </button>
      </div>

      {loading && <div className="adm-loading">Loading...</div>}

      {/* ═══ TILES TAB — with expandable legs ═══ */}
      {tab === 'tiles' && (
        <div className="adm-section">
          <div className="adm-toolbar">
            <button className="adm-btn" onClick={loadTiles}>↻ Refresh</button>
            <button className="adm-btn primary" onClick={handleDteRefresh}>🔄 Refresh All DTE</button>
            {selectedTiles.size > 0 && (
              <span className="adm-bulk-wrap">
                <input type="date" value={bulkExpiry} onChange={e => setBulkExpiry(e.target.value)} className="adm-date-input" />
                <button className="adm-btn warn" onClick={handleBulkExpiry}>Set Expiry for {selectedTiles.size} tiles</button>
              </span>
            )}
          </div>
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th style={{ width: 30 }}><input type="checkbox" checked={selectedTiles.size === tiles.length && tiles.length > 0} onChange={selectAllTiles} /></th>
                  <th style={{ width: 30 }}></th>
                  <th>Symbol</th><th>Strategy</th><th>Expiry</th><th>DTE</th><th>Underlying $</th>
                  <th>Net Premium</th><th>Max Loss</th><th>Max Win</th><th>Prob %</th><th>Active</th>
                </tr>
              </thead>
              <tbody>
                {tiles.map(tile => {
                  const maxLoss = tile.technical?.maxLoss || tile.maxLoss || 0;
                  const maxWin = tile.lottery?.maxWin || tile.maxProfit || 0;
                  const prob = tile.technical?.probability ? (tile.technical.probability * 100).toFixed(0) : tile.oddsOfProfit || tile.probOfProfit || '—';
                  const legs = tile.legs || [];
                  const isExpanded = expandedTiles.has(tile.id);
                  // Calculate net premium from legs
                  let netPrem = 0;
                  legs.forEach(l => {
                    const p = l.premium || 0;
                    if ((l.action === 'sell') || (l.type && l.type.startsWith('sell'))) netPrem += p;
                    else netPrem -= p;
                  });
                  return (
                    <tr key={tile.id} className={`${selectedTiles.has(tile.id) ? 'selected' : ''}${isExpanded ? ' expanded-parent' : ''}`}>
                      <td><input type="checkbox" checked={selectedTiles.has(tile.id)} onChange={() => toggleTileSelect(tile.id)} /></td>
                      <td style={{ cursor: 'pointer', fontSize: 12 }} onClick={() => toggleTileExpand(tile.id)}>
                        {legs.length > 0 ? (isExpanded ? '▼' : '▶') : '—'}
                      </td>
                      <td className="adm-bold">{tile.symbol}</td>
                      <td>{formatStrategy(tile.strategy)}</td>
                      <td><EditableCell id={tile.id} field="expiry" value={tile.expiry} type="date" onSave={() => saveTileEdit(tile.id, 'expiry')} /></td>
                      <td><EditableCell id={tile.id} field="daysToExpiry" value={tile.daysToExpiry} type="number" onSave={() => saveTileEdit(tile.id, 'daysToExpiry')} /></td>
                      <td><EditableCell id={tile.id} field="underlyingPrice" value={tile.underlyingPrice} type="number" onSave={() => saveTileEdit(tile.id, 'underlyingPrice')} /></td>
                      <td className="adm-mono" style={{ color: netPrem > 0 ? '#0B2D23' : '#dc2626' }}>${netPrem.toFixed(2)}</td>
                      <td className="adm-mono">{formatCurrency(maxLoss)}</td>
                      <td className="adm-mono adm-green">{formatCurrency(maxWin)}</td>
                      <td className="adm-mono">{prob}%</td>
                      <td>
                        <span className={`adm-badge ${tile.isActive ? 'on' : 'off'}`}
                          onClick={async () => { await updateTile(tile.id, { isActive: !tile.isActive }); showStatus(`Toggled ${tile.symbol}`); }}
                          style={{ cursor: 'pointer' }}>
                          {tile.isActive ? '● Active' : '○ Off'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Expanded tile legs — rendered below the table for each expanded tile */}
          {tiles.filter(t => expandedTiles.has(t.id) && t.legs?.length > 0).map(tile => (
            <div key={`legs-${tile.id}`} className="adm-tile-legs-panel">
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <h4 style={{ margin: 0, fontSize: 14 }}>
                  {tile.symbol} — {formatStrategy(tile.strategy)} Legs
                  <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: 8 }}>Click any value to edit</span>
                </h4>
                <button className="adm-btn" style={{ fontSize: 11 }} onClick={() => toggleTileExpand(tile.id)}>Close ✕</button>
              </div>
              <table className="adm-table adm-legs-table">
                <thead>
                  <tr>
                    <th>#</th><th>Type</th><th>Action</th><th>Strike</th><th>Premium</th><th>Delta</th><th>Expiry</th>
                  </tr>
                </thead>
                <tbody>
                  {tile.legs.map((leg, i) => {
                    // Handle both formats: combined "sell_put" or separate type/action
                    let displayType = leg.type || '';
                    let displayAction = leg.action || '';
                    if (displayType.includes('_')) {
                      const parts = displayType.split('_');
                      displayAction = parts[0]; // sell or buy
                      displayType = parts[1]; // put or call
                    }
                    return (
                      <tr key={i}>
                        <td className="adm-mono">{i + 1}</td>
                        <td>
                          <span className={`adm-leg-type ${displayType}`}>
                            {displayType === 'call' ? '📈 Call' : displayType === 'put' ? '📉 Put' : displayType}
                          </span>
                        </td>
                        <td>
                          <span className={`adm-leg-action ${displayAction}`}>
                            {displayAction.toUpperCase()}
                          </span>
                        </td>
                        <td>
                          <EditableCell id={`tile-leg-${tile.id}-${i}`} field="strike" value={leg.strike} type="number"
                            onSave={() => saveTileLegEdit(tile.id, i, 'strike')} />
                        </td>
                        <td>
                          <EditableCell id={`tile-leg-${tile.id}-${i}`} field="premium" value={leg.premium} type="number"
                            onSave={() => saveTileLegEdit(tile.id, i, 'premium')} />
                        </td>
                        <td>
                          <EditableCell id={`tile-leg-${tile.id}-${i}`} field="delta" value={leg.delta} type="number"
                            onSave={() => saveTileLegEdit(tile.id, i, 'delta')} />
                        </td>
                        <td>
                          <EditableCell id={`tile-leg-${tile.id}-${i}`} field="expiry" value={leg.expiry} type="date"
                            onSave={() => saveTileLegEdit(tile.id, i, 'expiry')} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      {/* ═══ PORTFOLIOS TAB — with Quick Simulate ═══ */}
      {tab === 'portfolios' && (
        <div className="adm-section">
          <div className="adm-toolbar">
            <button className="adm-btn" onClick={loadUsers}>↻ Refresh</button>
            {users[0] && (
              <>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center', marginLeft: 12 }}>
                  <span style={{ fontSize: 11, color: '#9ca3af', fontWeight: 600 }}>Quick Simulate All:</span>
                  {['profit', 'loss', 'breakeven', 'mixed'].map(scenario => (
                    <button key={scenario} className={`adm-btn ${scenario === 'profit' ? 'primary' : scenario === 'loss' ? 'danger' : ''}`}
                      style={{ fontSize: 11, padding: '4px 10px', textTransform: 'capitalize' }}
                      onClick={async () => {
                        const count = await quickSimulateAll(users[0].uid, scenario);
                        showStatus(`Simulated ${scenario} for ${count} positions`);
                      }}>
                      {scenario === 'profit' ? '📈' : scenario === 'loss' ? '📉' : scenario === 'breakeven' ? '⚖️' : '🎲'} {scenario}
                    </button>
                  ))}
                </div>
                <button className="adm-btn" style={{ marginLeft: 'auto', fontSize: 11 }}
                  onClick={async () => {
                    const count = await resetAllPnl(users[0].uid);
                    showStatus(`Reset P&L for ${count} positions`);
                  }}>
                  🔄 Reset All P&L
                </button>
                <button className="adm-btn danger" style={{ fontSize: 11, marginLeft: 8 }}
                  onClick={async () => {
                    if (!window.confirm(`⚠️ WARNING: This will permanently delete ALL portfolio positions and P&L history for ${users[0].displayName || users[0].email}.\n\nAre you absolutely sure?`)) return;
                    const result = await clearAllPortfolioHistory();
                    showStatus(`Deleted ${result.portfolio} positions and ${result.history} history records`);
                  }}>
                  🗑 Clear All History & Positions
                </button>
              </>
            )}
          </div>

          {users.map(usr => {
            const totalPnl = usr.portfolio
              .filter(p => p.status !== 'closed')
              .reduce((s, p) => s + ((p.unrealizedPnl || 0) * (p.quantity || 1)), 0);

            // Build bar chart data for quick view
            const barData = usr.portfolio
              .filter(p => p.status !== 'closed')
              .map(p => ({
                symbol: p.symbol,
                pnl: (p.unrealizedPnl || 0) * (p.quantity || 1),
              }))
              .sort((a, b) => b.pnl - a.pnl);

            return (
              <div key={usr.uid} className="adm-user-card">
                <div className="adm-user-header">
                  <h3>{usr.displayName || usr.email}</h3>
                  <span className="adm-count">{usr.portfolio.filter(p => p.status !== 'closed').length} active</span>
                  {closedPositions.length > 0 && <span className="adm-count" style={{ color: '#9ca3af' }}>{closedPositions.length} closed</span>}
                  <span className={`adm-count ${totalPnl >= 0 ? 'adm-pnl-pos' : 'adm-pnl-neg'}`}>
                    Total P&L: {totalPnl >= 0 ? '+' : ''}{formatCurrency(totalPnl)}
                  </span>
                  {orphanCount > 0 && (
                    <button className="adm-btn warn" style={{ fontSize: 11, marginLeft: 8 }}
                      onClick={async () => {
                        const count = await markOrphansAsClosed(usr.uid);
                        showStatus(`Marked ${count} orphaned positions as closed`);
                      }}>
                      ⚠️ {orphanCount} orphans → Close
                    </button>
                  )}
                  <button className="adm-btn primary" style={{ marginLeft: 'auto', fontSize: 11 }}
                    onClick={async () => {
                      const count = await populateAllLegs(usr.uid);
                      await loadUsers();
                      showStatus(`Synced legs for ${count} positions from tile data`);
                    }}>
                    🔗 Sync All Legs from Tiles
                  </button>
                </div>

                {/* Mini P&L bar chart */}
                {barData.some(d => d.pnl !== 0) && (
                  <div style={{ margin: '12px 0', padding: '12px 16px', background: '#fafafa', borderRadius: 8, border: '1px solid #f0f0f0' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#9ca3af', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                      Position P&L Overview
                    </div>
                    <ResponsiveContainer width="100%" height={120}>
                      <BarChart data={barData} layout="vertical" margin={{ left: 50, right: 20, top: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" tick={{ fontSize: 10 }} tickFormatter={v => `$${v}`} />
                        <YAxis type="category" dataKey="symbol" tick={{ fontSize: 11, fontWeight: 600 }} width={50} />
                        <Tooltip formatter={(v) => [`$${v.toFixed(2)}`, 'P&L']} />
                        <ReferenceLine x={0} stroke="#9ca3af" />
                        <Bar dataKey="pnl" radius={[0, 4, 4, 0]}>
                          {barData.map((entry, idx) => (
                            <Cell key={idx} fill={entry.pnl >= 0 ? '#0B2D23' : '#dc2626'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {usr.portfolio.length === 0 ? (
                  <p className="adm-empty">No portfolio items</p>
                ) : (
                  <div className="adm-positions-list">
                    {/* Active positions first */}
                    {usr.portfolio.filter(p => p.status !== 'closed').map(item => (
                      <PositionCard key={item.id} item={item} usr={usr} tiles={tiles}
                        isExpanded={expandedPositions.has(item.id)} toggleExpand={toggleExpand}
                        editingCell={editingCell} editValue={editValue} startEdit={startEdit}
                        cancelEdit={cancelEdit} setEditValue={setEditValue}
                        savePortfolioEdit={savePortfolioEdit} updateLegPremium={updateLegPremium}
                        showStatus={showStatus} quickSimulate={quickSimulate}
                        recalcPnl={recalcPnl} populateLegs={populateLegs} loadUsers={loadUsers}
                        EditableCell={EditableCell} LegPremiumCell={LegPremiumCell}
                        formatCurrency={formatCurrency} formatStrategy={formatStrategy}
                        updatePortfolioItem={updatePortfolioItem}
                      />
                    ))}
                    {/* Closed positions - collapsed section */}
                    {closedPositions.length > 0 && (
                      <details style={{ marginTop: 12 }}>
                        <summary style={{ cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#9ca3af', padding: '8px 0' }}>
                          📦 {closedPositions.length} Closed Positions
                        </summary>
                        {closedPositions.map(item => (
                          <div key={item.id} style={{ padding: '8px 16px', fontSize: 12, color: '#9ca3af', borderBottom: '1px solid #f0f0f0' }}>
                            {item.symbol} — {formatStrategy(item.strategy)} — Entry: {formatCurrency(item.entryNetCredit || 0)}
                            {item.closedReason === 'tile_removed' && <span style={{ marginLeft: 8, fontSize: 10, background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>tile removed</span>}
                          </div>
                        ))}
                      </details>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ═══ P&L CHART TAB ═══ */}
      {tab === 'pnlChart' && (
        <div className="adm-section">
          <div className="adm-toolbar">
            <button className="adm-btn" onClick={() => { if (users[0]) loadPnlHistory(users[0].uid); }}>↻ Refresh</button>
            <button className="adm-btn primary" onClick={async () => {
              if (!users[0]) return;
              const ok = await recordPnlSnapshot(users[0].uid);
              if (ok) {
                showStatus('P&L snapshot recorded for today');
                await loadPnlHistory(users[0].uid);
              }
            }}>
              📸 Record Today's Snapshot
            </button>
            <span style={{ fontSize: 11, color: '#9ca3af', marginLeft: 8 }}>
              Record a snapshot after each simulation to build the chart
            </span>
          </div>

          {pnlHistory.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>📈</div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#374151' }}>No P&L History Yet</h3>
              <p style={{ fontSize: 13, maxWidth: 400, margin: '8px auto' }}>
                Use "Quick Simulate" on the Portfolios tab to generate P&L values, 
                then click "Record Today's Snapshot" to start building your chart.
              </p>
              <div style={{ marginTop: 20, padding: 16, background: '#f9fafb', borderRadius: 8, display: 'inline-block', textAlign: 'left' }}>
                <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 8 }}>Quick Start:</div>
                <ol style={{ fontSize: 12, color: '#6b7280', margin: 0, paddingLeft: 20 }}>
                  <li>Go to Portfolios → Click "📈 profit" simulate</li>
                  <li>Come back here → Click "📸 Record Today's Snapshot"</li>
                  <li>Repeat with different scenarios on different "days"</li>
                </ol>
              </div>
            </div>
          ) : (
            <div>
              {/* Total P&L Line Chart */}
              <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e5e7eb', marginBottom: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Total Portfolio P&L Over Time</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={pnlHistory} margin={{ top: 10, right: 30, left: 20, bottom: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
                    <Tooltip formatter={(v) => [`$${v.toFixed(2)}`, 'Total P&L']} labelFormatter={l => `Date: ${l}`} />
                    <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
                    <Line type="monotone" dataKey="totalPnl" stroke="#0B2D23" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Per-Position breakdown for latest snapshot */}
              {pnlHistory.length > 0 && (
                <div style={{ background: '#fff', borderRadius: 12, padding: 20, border: '1px solid #e5e7eb' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
                    Latest Snapshot: {pnlHistory[pnlHistory.length - 1].date}
                    <span style={{ fontWeight: 400, color: '#9ca3af', marginLeft: 8 }}>
                      ({pnlHistory[pnlHistory.length - 1].positionCount} positions)
                    </span>
                  </h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart
                      data={(pnlHistory[pnlHistory.length - 1].positions || []).map(p => ({
                        name: p.symbol,
                        pnl: p.unrealizedPnl * (p.quantity || 1)
                      }))}
                      margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 600 }} />
                      <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
                      <Tooltip formatter={(v) => [`$${v.toFixed(2)}`, 'P&L']} />
                      <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
                      <Bar dataKey="pnl" radius={[4, 4, 0, 0]}>
                        {(pnlHistory[pnlHistory.length - 1].positions || []).map((entry, idx) => (
                          <Cell key={idx} fill={(entry.unrealizedPnl * (entry.quantity || 1)) >= 0 ? '#0B2D23' : '#dc2626'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>

                  {/* History table */}
                  <div style={{ marginTop: 16 }}>
                    <table className="adm-table" style={{ fontSize: 12 }}>
                      <thead>
                        <tr>
                          <th>Date</th><th>Positions</th><th>Total P&L</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[...pnlHistory].reverse().map(snap => (
                          <tr key={snap.date}>
                            <td className="adm-mono">{snap.date}</td>
                            <td>{snap.positionCount}</td>
                            <td className={`adm-mono ${snap.totalPnl >= 0 ? 'adm-green' : 'adm-red'}`}>
                              {snap.totalPnl >= 0 ? '+' : ''}${snap.totalPnl.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ═══ USERS TAB ═══ */}
      {tab === 'users' && (
        <div className="adm-section">
          <div className="adm-toolbar">
            <button className="adm-btn" onClick={loadAllUsersFromFirestore}>↻ Refresh Users</button>
            {impersonatedUserId && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 'auto', padding: '6px 12px', background: '#fef3c7', border: '1px solid #fbbf24', borderRadius: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: '#92400e' }}>
                  👤 Impersonating: {allUsers.find(u => u.uid === impersonatedUserId)?.email || impersonatedUserId}
                </span>
                <button className="adm-btn" style={{ fontSize: 11, padding: '2px 8px' }}
                  onClick={async () => {
                    await setImpersonatedUser(null);
                    showStatus('Returned to your account');
                  }}>
                  ✕ Exit Impersonation
                </button>
              </div>
            )}
          </div>

          {/* Debug Info Panel */}
          <div style={{ marginBottom: 16, padding: 16, background: '#f0f9ff', border: '1px solid #bae6fd', borderRadius: 8 }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: '#0369a1' }}>🔍 Debug Info</h3>
            <div style={{ fontSize: 12, color: '#0c4a6e', lineHeight: 1.8 }}>
              <div><strong>Your Email:</strong> {users[0]?.email || 'Not loaded'}</div>
              <div><strong>Your User ID:</strong> <code style={{ fontSize: 11, background: '#e0f2fe', padding: '2px 6px', borderRadius: 4 }}>{users[0]?.uid || 'Not loaded'}</code></div>
              <div><strong>Admin Emails (from rules):</strong> manishsaraan@gmail.com, manish28june@gmail.com</div>
              <div><strong>Users Found in Firestore:</strong> {allUsers.length}</div>
              <div><strong>Loading State:</strong> {loading ? '⏳ Loading...' : '✅ Ready'}</div>
              {error && <div style={{ color: '#dc2626', marginTop: 8 }}><strong>Error:</strong> {error}</div>}
            </div>
            <div style={{ marginTop: 12, padding: 12, background: '#fff', border: '1px solid #bae6fd', borderRadius: 6, fontSize: 12 }}>
              <strong>💡 Troubleshooting:</strong>
              <ul style={{ margin: '8px 0 0', paddingLeft: 20, lineHeight: 1.8 }}>
                <li>If you see 0 users, click "↻ Refresh Users" button above</li>
                <li>If you only see yourself, you might be the only user who has logged in</li>
                <li>Other users must log in at least once for their profiles to be created</li>
                <li>Check browser console (F12) for any permission errors</li>
              </ul>
            </div>
          </div>

          {allUsers.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: '#9ca3af' }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>👥</div>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#374151' }}>No Users Found</h3>
              <p style={{ fontSize: 13, maxWidth: 400, margin: '8px auto' }}>
                Click "Refresh Users" to load all users from Firestore.
              </p>
            </div>
          ) : (
            <div className="adm-table-wrap">
              <table className="adm-table">
                <thead>
                  <tr>
                    <th>Email</th>
                    <th>Display Name</th>
                    <th>User ID</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {allUsers.map(usr => {
                    const isCurrentUser = usr.uid === (impersonatedUserId || users[0]?.uid);
                    return (
                      <tr key={usr.uid} style={{ background: isCurrentUser ? '#f0fdf4' : undefined }}>
                        <td className="adm-mono" style={{ fontWeight: isCurrentUser ? 600 : 400 }}>
                          {isCurrentUser && '👤 '}
                          {usr.email || 'N/A'}
                        </td>
                        <td>{usr.displayName || '—'}</td>
                        <td className="adm-mono" style={{ fontSize: 11, color: '#9ca3af' }}>{usr.uid}</td>
                        <td>
                          <div style={{ display: 'flex', gap: 6 }}>
                            {!isCurrentUser && (
                              <button className="adm-btn primary" style={{ fontSize: 11, padding: '4px 10px' }}
                                onClick={async () => {
                                  await setImpersonatedUser(usr.uid);
                                  showStatus(`Now viewing as ${usr.email}`);
                                }}>
                                🔍 Impersonate
                              </button>
                            )}
                            {isCurrentUser && impersonatedUserId && (
                              <button className="adm-btn" style={{ fontSize: 11, padding: '4px 10px' }}
                                onClick={async () => {
                                  await setImpersonatedUser(null);
                                  showStatus('Returned to your account');
                                }}>
                                ✕ Exit
                              </button>
                            )}
                            <button className="adm-btn" style={{ fontSize: 11, padding: '4px 10px' }}
                              onClick={() => {
                                navigator.clipboard.writeText(usr.uid);
                                showStatus('User ID copied to clipboard');
                              }}>
                              📋 Copy ID
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          <div style={{ marginTop: 24, padding: 16, background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
            <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>🔐 Impersonation Guide</h3>
            <ul style={{ fontSize: 12, color: '#6b7280', margin: 0, paddingLeft: 20, lineHeight: 1.8 }}>
              <li><strong>Impersonate:</strong> Click "Impersonate" to view and edit another user's data (portfolio, strategies, history)</li>
              <li><strong>Active:</strong> When impersonating, all tabs (Portfolios, P&L Chart, etc.) show that user's data</li>
              <li><strong>Editing:</strong> You can edit positions, premiums, and simulate P&L for the impersonated user</li>
              <li><strong>Exit:</strong> Click "Exit Impersonation" in the yellow banner to return to your own account</li>
              <li><strong>Safety:</strong> Changes are saved to the impersonated user's Firestore documents</li>
            </ul>
          </div>
        </div>
      )}

      {/* ═══ ALERTS TAB ═══ */}
      {tab === 'alerts' && <AlertConfigPanel />}

      {/* ═══ TOOLS TAB ═══ */}
      {tab === 'tools' && (
        <div className="adm-section">
          <div className="adm-tools-grid">
            <div className="adm-tool-card">
              <h3>🗑 Delete All Strategies</h3>
              <p>Permanently delete ALL tiles/strategies from the database. This action cannot be undone!</p>
              <button className="adm-btn danger" onClick={async () => {
                if (!window.confirm(`⚠️ DANGER: This will permanently delete ALL ${tiles.length} strategy tiles from the database.\n\nThis action CANNOT be undone!\n\nAre you absolutely sure?`)) return;
                if (!window.confirm(`🚨 FINAL WARNING: Deleting ${tiles.length} tiles. Type "DELETE" to confirm.`)) return;
                const count = await deleteAllStrategies();
                showStatus(`Deleted ${count} strategy tiles`);
              }} disabled={loading || tiles.length === 0}>
                {loading ? 'Deleting...' : tiles.length === 0 ? '✓ No Strategies' : `Delete ${tiles.length} Strategies`}
              </button>
            </div>

            <div className="adm-tool-card">
              <h3>🔄 Refresh DTE</h3>
              <p>Recalculate <code>daysToExpiry</code> for all active tiles based on their expiry date vs today.</p>
              <button className="adm-btn primary" onClick={handleDteRefresh} disabled={loading}>
                {loading ? 'Running...' : 'Run DTE Refresh'}
              </button>
            </div>

            <div className="adm-tool-card">
              <h3>📅 Bulk Update Expiry</h3>
              <p>Set a new expiry date for multiple tiles at once. Select tiles in the Tiles tab first.</p>
              <div className="adm-tool-row">
                <input type="date" value={bulkExpiry} onChange={e => setBulkExpiry(e.target.value)} className="adm-date-input" />
                <button className="adm-btn warn" onClick={handleBulkExpiry} disabled={selectedTiles.size === 0 || !bulkExpiry}>
                  Update {selectedTiles.size} tiles
                </button>
              </div>
              {selectedTiles.size === 0 && <span className="adm-hint">Go to Tiles tab and select tiles first</span>}
            </div>

            <div className="adm-tool-card">
              <h3>🧪 Seed Test P&L Data</h3>
              <p>Populate realistic entry/current values for all portfolio positions. Uses strategy-level estimates.</p>
              <button className="adm-btn warn" onClick={async () => {
                const result = await seedTestPnl();
                showStatus(`Seeded P&L data for ${result.updated} positions`);
              }} disabled={loading}>
                {loading ? 'Running...' : 'Seed Test Data'}
              </button>
            </div>

            <div className="adm-tool-card">
              <h3>📦 Mark Orphans as Closed</h3>
              <p>Positions whose tiles have been deleted. Currently: <strong>{orphanCount} orphaned</strong></p>
              <button className="adm-btn warn" onClick={async () => {
                if (!users[0]) return;
                const count = await markOrphansAsClosed(users[0].uid);
                showStatus(`Marked ${count} orphaned positions as closed`);
              }} disabled={loading || orphanCount === 0}>
                {orphanCount === 0 ? '✓ No Orphans' : `Close ${orphanCount} Orphans`}
              </button>
            </div>

            <div className="adm-tool-card">
              <h3>🔗 Sync All Legs</h3>
              <p>Copy leg data (strikes, premiums) from tiles into portfolio items. Required for leg-level P&L tracking.</p>
              <button className="adm-btn primary" onClick={async () => {
                if (!users[0]) return;
                const count = await populateAllLegs(users[0].uid);
                await loadUsers();
                showStatus(`Synced legs for ${count} positions`);
              }} disabled={loading}>
                {loading ? 'Running...' : 'Sync Legs for All Positions'}
              </button>
            </div>

            <div className="adm-tool-card">
              <h3>🔄 Reset All P&L</h3>
              <p>Set all currentPremium values to 0 and reset unrealizedPnl to 0 for all positions.</p>
              <button className="adm-btn danger" onClick={async () => {
                if (!users[0]) return;
                const count = await resetAllPnl(users[0].uid);
                showStatus(`Reset P&L for ${count} positions`);
              }} disabled={loading}>
                Reset All P&L to $0
              </button>
            </div>

            <div className="adm-tool-card">
              <h3>📜 Seed Closed Trade History</h3>
              <p>Add realistic P&L values, dates, and reasons to closed trades. Also creates 7 monthly P&L snapshots (Jul '25 → Jan '26) for the growth chart.</p>
              <button className="adm-btn primary" onClick={async () => {
                if (!users[0]) return;
                const result = await seedClosedTradeHistory(users[0].uid);
                showStatus(`Seeded ${result.trades} trades + ${result.snapshots} monthly snapshots`);
              }} disabled={loading}>
                {loading ? 'Running...' : `Seed ${closedPositions.length} Closed Trades + Snapshots`}
              </button>
            </div>

            <div className="adm-tool-card" style={{ gridColumn: 'span 2' }}>
              <h3>🏗 P&L Data Flow</h3>
              <div className="adm-schema">
                <div><strong>1. Tile legs[]</strong> — scanner outputs strikes + premiums at scan time</div>
                <div><strong>2. Portfolio legs[]</strong> — copied from tile via "Sync Legs", stores entryPremium</div>
                <div><strong>3. currentPremium</strong> — updated per leg via Admin edit or IB API</div>
                <div><strong>4. unrealizedPnl</strong> — auto-calculated: Σ(entry − current) × 100 per leg</div>
                <div><strong>5. Display pages</strong> — Home, Portfolio, Performance read unrealizedPnl</div>
              </div>
            </div>

            <div className="adm-tool-card">
              <h3>📊 Leg P&L Formula</h3>
              <div className="adm-schema">
                <div><strong>SELL leg:</strong> P&L = (entryPremium − currentPremium) × 100</div>
                <div><em>Sold at $2.80, now $1.40 → profit = +$140</em></div>
                <div style={{ marginTop: 8 }}><strong>BUY leg:</strong> P&L = (currentPremium − entryPremium) × 100</div>
                <div><em>Bought at $1.20, now $0.60 → loss = −$60</em></div>
                <div style={{ marginTop: 8 }}><strong>Strategy P&L</strong> = sum of all leg P&Ls</div>
                <div><em>Iron Condor (4 legs): +$140 −$60 +$130 −$30 = +$180</em></div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ API DIAGNOSTICS TAB ═══ */}
      {tab === 'api' && <ApiDiagnostics />}
    </div>
  );
}

// ═══ POSITION CARD COMPONENT ═══
function PositionCard({
  item, usr, tiles, isExpanded, toggleExpand,
  editingCell, editValue, startEdit, cancelEdit, setEditValue,
  savePortfolioEdit, updateLegPremium, showStatus, quickSimulate,
  recalcPnl, populateLegs, loadUsers,
  EditableCell, LegPremiumCell, formatCurrency, formatStrategy,
  updatePortfolioItem,
}) {
  const hasLegs = item.legs && item.legs.length > 0;
  const pnl = (item.unrealizedPnl || 0) * (item.quantity || 1);
  const entryCredit = item.entryNetCredit || 0;
  const hasTile = tiles.some(t => t.id === item.id);

  return (
    <div className={`adm-pos-card${isExpanded ? ' expanded' : ''}`}>
      {/* Summary row */}
      <div className="adm-pos-summary" onClick={() => toggleExpand(item.id)}>
        <div className="adm-pos-expand">{isExpanded ? '▼' : '▶'}</div>
        <div className="adm-pos-sym">{item.symbol}</div>
        <div className="adm-pos-strat">{formatStrategy(item.strategy)}</div>
        <div className="adm-pos-meta">
          <span className="adm-pos-tag">Entry: {entryCredit !== 0 ? formatCurrency(entryCredit) : '—'}</span>
          <span className="adm-pos-tag">Current: {item.currentNetValue ? formatCurrency(item.currentNetValue) : '—'}</span>
          <span className={`adm-pos-tag ${pnl > 0 ? 'adm-pnl-pos' : pnl < 0 ? 'adm-pnl-neg' : ''}`}>
            P&L: {pnl !== 0 ? `${pnl > 0 ? '+' : ''}${formatCurrency(pnl)}` : '—'}
          </span>
          <span className="adm-pos-tag">{hasLegs ? `${item.legs.length} legs` : '⚠ No legs'}</span>
          {!hasTile && <span className="adm-pos-tag" style={{ color: '#f59e0b' }}>⚠ orphan</span>}

          {/* Quick Simulate buttons (inline) */}
          {hasLegs && (
            <span style={{ display: 'flex', gap: 3, marginLeft: 8 }} onClick={e => e.stopPropagation()}>
              <button className="adm-btn-mini profit" title="Simulate profit"
                onClick={async () => {
                  const r = await quickSimulate(usr.uid, item.id, 'profit');
                  if (r) showStatus(`${item.symbol}: P&L → ${r.unrealizedPnl >= 0 ? '+' : ''}$${r.unrealizedPnl.toFixed(2)}`);
                }}>📈</button>
              <button className="adm-btn-mini loss" title="Simulate loss"
                onClick={async () => {
                  const r = await quickSimulate(usr.uid, item.id, 'loss');
                  if (r) showStatus(`${item.symbol}: P&L → ${r.unrealizedPnl >= 0 ? '+' : ''}$${r.unrealizedPnl.toFixed(2)}`);
                }}>📉</button>
              <button className="adm-btn-mini" title="Simulate breakeven"
                onClick={async () => {
                  const r = await quickSimulate(usr.uid, item.id, 'breakeven');
                  if (r) showStatus(`${item.symbol}: P&L → ${r.unrealizedPnl >= 0 ? '+' : ''}$${r.unrealizedPnl.toFixed(2)}`);
                }}>⚖️</button>
              <button className="adm-btn-mini" title="Reset to Entry (0 P&L)" style={{ background: '#6b7280', color: 'white' }}
                onClick={async () => {
                  const ok = await resetToEntry(usr.uid, item.id);
                  if (ok) showStatus(`${item.symbol}: Reset to entry (P&L = $0)`);
                }}>↺</button>
            </span>
          )}

          <select className="adm-select" value={item.status || 'active'}
            onClick={e => e.stopPropagation()}
            onChange={async (e) => {
              await updatePortfolioItem(usr.uid, item.id, { status: e.target.value });
              showStatus(`${item.symbol} → ${e.target.value}`);
            }}>
            <option value="active">Active</option>
            <option value="watching">Watching</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      {/* Expanded detail */}
      {isExpanded && (
        <div className="adm-pos-detail">
          {/* Strategy-level fields */}
          <div className="adm-pos-fields">
            <div className="adm-field">
              <label>Entry Date</label>
              <EditableCell id={`${usr.uid}-${item.id}`} field="entryDate" value={item.entryDate} type="date"
                onSave={() => savePortfolioEdit(usr.uid, item.id, 'entryDate')} />
            </div>
            <div className="adm-field">
              <label>Expiry</label>
              <EditableCell id={`${usr.uid}-${item.id}`} field="expiry" value={item.expiry} type="date"
                onSave={() => savePortfolioEdit(usr.uid, item.id, 'expiry')} />
            </div>
            <div className="adm-field">
              <label>Entry UL $</label>
              <EditableCell id={`${usr.uid}-${item.id}`} field="entryUnderlyingPrice" value={item.entryUnderlyingPrice} type="number"
                onSave={() => savePortfolioEdit(usr.uid, item.id, 'entryUnderlyingPrice')} />
            </div>
            <div className="adm-field">
              <label>Current UL $</label>
              <EditableCell id={`${usr.uid}-${item.id}`} field="currentUnderlyingPrice" value={item.currentUnderlyingPrice} type="number"
                onSave={() => savePortfolioEdit(usr.uid, item.id, 'currentUnderlyingPrice')} />
            </div>
            <div className="adm-field">
              <label>Quantity</label>
              <EditableCell id={`${usr.uid}-${item.id}`} field="quantity" value={item.quantity} type="number"
                onSave={() => savePortfolioEdit(usr.uid, item.id, 'quantity')} />
            </div>
            <div className="adm-field">
              <label>Entry Credit</label>
              <span className="adm-mono">{entryCredit !== 0 ? formatCurrency(entryCredit) : '—'}</span>
            </div>
            <div className="adm-field">
              <label>Unrealized P&L</label>
              <span className={`adm-mono ${pnl > 0 ? 'adm-green' : pnl < 0 ? 'adm-red' : ''}`}>
                {pnl !== 0 ? `${pnl > 0 ? '+' : ''}${formatCurrency(pnl)}` : '—'}
              </span>
            </div>
          </div>

          {/* Legs table */}
          {hasLegs ? (
            <>
              <div className="adm-legs-header">
                <h4>Option Legs</h4>
                <span className="adm-hint">Click "Current $" to edit → P&L auto-recalculates</span>
              </div>
              <div className="adm-table-wrap" style={{ marginTop: 8 }}>
                <table className="adm-table adm-legs-table">
                  <thead>
                    <tr>
                      <th>#</th><th>Type</th><th>Action</th><th>Strike</th>
                      <th>Entry $ <span className="adm-th-hint">(per share)</span></th>
                      <th>Current $ <span className="adm-th-hint">(per share)</span></th>
                      <th>Leg P&L <span className="adm-th-hint">(×100)</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {item.legs.map(leg => {
                      const legPnl = leg.action === 'sell'
                        ? (leg.entryPremium - (leg.currentPremium || 0)) * 100
                        : ((leg.currentPremium || 0) - leg.entryPremium) * 100;
                      return (
                        <tr key={leg.legIndex}>
                          <td className="adm-mono">{leg.legIndex + 1}</td>
                          <td>
                            <span className={`adm-leg-type ${leg.type}`}>
                              {leg.type === 'call' ? '📈 Call' : leg.type === 'put' ? '📉 Put' : '📊 Stock'}
                            </span>
                          </td>
                          <td>
                            <span className={`adm-leg-action ${leg.action}`}>
                              {leg.action === 'sell' ? 'SELL' : 'BUY'}
                            </span>
                          </td>
                          <td className="adm-mono">${leg.strike}</td>
                          <td className="adm-mono">${(leg.entryPremium || 0).toFixed(2)}</td>
                          <td>
                            <LegPremiumCell userId={usr.uid} tileId={item.id} leg={leg} />
                          </td>
                          <td className={`adm-mono ${legPnl > 0 ? 'adm-green' : legPnl < 0 ? 'adm-red' : ''}`}>
                            {leg.currentPremium > 0 ? `${legPnl >= 0 ? '+' : ''}$${legPnl.toFixed(0)}` : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr className="adm-legs-total">
                      <td colSpan="4" style={{ textAlign: 'right', fontWeight: 600 }}>Strategy Total:</td>
                      <td className="adm-mono">{formatCurrency(Math.abs(entryCredit))}</td>
                      <td className="adm-mono">{item.currentNetValue ? formatCurrency(Math.abs(item.currentNetValue)) : '—'}</td>
                      <td className={`adm-mono ${pnl > 0 ? 'adm-green' : pnl < 0 ? 'adm-red' : ''}`} style={{ fontWeight: 700 }}>
                        {pnl !== 0 ? `${pnl >= 0 ? '+' : ''}${formatCurrency(pnl)}` : '—'}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </>
          ) : (
            <div className="adm-no-legs">
              <p>⚠ No legs stored for this position.</p>
              <button className="adm-btn primary" onClick={async () => {
                const ok = await populateLegs(usr.uid, item.id);
                if (ok) { await loadUsers(); showStatus(`Synced legs for ${item.symbol}`); }
                else showStatus(`Failed — tile may not have legs data`);
              }}>
                🔗 Sync Legs from Tile Data
              </button>
            </div>
          )}

          {/* Action buttons */}
          <div className="adm-pos-actions">
            {hasLegs && (
              <button className="adm-btn" onClick={async () => {
                const ok = await recalcPnl(usr.uid, item.id);
                if (ok) showStatus(`Recalculated P&L for ${item.symbol}`);
              }}>
                🔄 Recalculate P&L from Legs
              </button>
            )}
            <button className="adm-btn" onClick={async () => {
              const ok = await populateLegs(usr.uid, item.id);
              if (ok) { await loadUsers(); showStatus(`Re-synced legs for ${item.symbol}`); }
            }}>
              🔗 Re-sync Legs from Tile
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
