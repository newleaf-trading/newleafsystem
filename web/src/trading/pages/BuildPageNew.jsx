/**
 * BuildPageNew — stage an execution batch (mock 06).
 *
 * Held positions are locked at real qty (closable to free budget).
 * New candidates are sizable against available budget (removable).
 * All math from deriveAllocation(). No page-level recomputation.
 */

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { usePortfolio } from '../hooks/usePortfolio';
import { usePortfolioSettings } from '../hooks/usePortfolioSettings';
import { usePlanOfRecord } from '../hooks/usePlanOfRecord';
import { useShortlist } from '../hooks/useShortlist';
import { usePositionLiveData } from '../hooks/usePositionLiveData';
import { toCanonical } from '../lib/toCanonical';
import { derivePosition } from '../lib/derivePosition';
import { deriveAllocation, buildExecutionBatch, autoAllocateEqual } from '../lib/build/deriveAllocation';
import { signedUsd, usd } from '../lib/money';
import { formatStrategy } from '../utils/formatters';
import { DEFAULT_MAX_DRAWDOWN } from '../lib/build/evConstants';
import { investStyles as s } from '../components/invest';
import { StartPlanNudge } from '../components/StartPlanNudge';

import './BuildPageNew.css';

/** Load live P&L for a held position so we can show realized on close */
function useHeldLiveData(portfolioItem, tile) {
  const liveData = usePositionLiveData(tile, portfolioItem);
  const hasPnl = !liveData.loading && liveData.pnlResult?.method !== 'none';
  const canonical = useMemo(() => {
    if (!portfolioItem) return null;
    return toCanonical(portfolioItem, {
      pnlPerContract: hasPnl ? liveData.pnlPerContract : null,
      spot: liveData.currentSpot || undefined,
      dte: liveData.dte ?? undefined,
    });
  }, [portfolioItem, liveData, hasPnl]);
  const d = useMemo(() => canonical?.pnlTotal != null ? derivePosition(canonical) : null, [canonical]);
  return d;
}

/** Invisible component that loads live data for a held position and reports it up via onData */
function HeldLiveLoader({ item, tile, onData }) {
  const d = useHeldLiveData(item, tile);
  useEffect(() => {
    if (d && d.pnlTotal != null) onData(item.id, d);
  }, [d, item.id, onData]);
  return null;
}

export function BuildPageNew({ tiles }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { activePositions, portfolioItems, addPosition, closePosition, updateQuantity, isInPortfolio } = usePortfolio();
  const { settings } = usePortfolioSettings();
  const { shortlistItems, removeFromShortlist, addToShortlist } = useShortlist();

  // Handle ?add=:tileId — auto-add to shortlist when routed from "Take this trade"
  const addTileId = searchParams.get('add');
  useEffect(() => {
    if (addTileId && tiles && tiles.length > 0) {
      const tile = tiles.find(t => t.id === addTileId);
      if (tile) {
        addToShortlist(tile).catch(() => {});
        window.history.replaceState({}, '', '/invest/build');
      }
    }
  }, [addTileId, tiles, addToShortlist]);

  // Risk budget follows the active plan: the WEEKLY risk the plan says to deploy =
  // cadence × per-idea risk. This is NOT the portfolio max-loss ceiling (that's the
  // absolute drawdown limit on the plan card). Re-derived at the account's current
  // capital so it holds even while the plan is in reconcile. Falls back to the
  // default drawdown when no plan. Diagnostic only — sizing/labels, never blocks.
  const { plan } = usePlanOfRecord();
  const totalCapital = settings?.totalCapital || 0;
  // Per-idea risk cap from the plan (riskCapPct × current capital).
  const perTradeCap = plan ? Math.round(totalCapital * (plan.riskCapPct || 0)) : null;
  const tradesPerWk = plan ? Math.max(1, Math.round(plan.tradesPerWeek || 0)) : null;
  const planWeeklyBudget = perTradeCap != null && tradesPerWk != null ? perTradeCap * tradesPerWk : null;
  const riskBudget = planWeeklyBudget ?? Math.round(totalCapital * DEFAULT_MAX_DRAWDOWN);

  // ── Held state: closing toggles ──
  const [closingSet, setClosingSet] = useState(new Set());
  const toggleClose = useCallback((id) => {
    setClosingSet(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  // ── Candidate state: qty overrides ──
  const [qtyOverrides, setQtyOverrides] = useState({});

  const stepQty = useCallback((id, delta) => {
    setQtyOverrides(prev => ({
      ...prev,
      [id]: Math.max(0, (prev[id] ?? 1) + delta),
    }));
  }, []);

  const handleRemove = useCallback(async (id) => {
    try {
      await removeFromShortlist(id);
    } catch (err) {
      console.error('Failed to remove from shortlist:', err);
    }
  }, [removeFromShortlist]);

  const handleUndoRemove = useCallback(async (tile) => {
    try {
      await addToShortlist(tile);
    } catch (err) {
      console.error('Failed to re-add to shortlist:', err);
    }
  }, [addToShortlist]);

  // ── Build held items (need live P&L for each) ──
  // We'll collect live data via render children pattern
  const [heldLiveData, setHeldLiveData] = useState({});
  const reportHeldData = useCallback((id, d) => {
    setHeldLiveData(prev => {
      // Compare by pnlTotal to avoid re-render loops from new object references
      if (prev[id] && prev[id].pnlTotal === d.pnlTotal) return prev;
      return { ...prev, [id]: d };
    });
  }, []);

  // ── Candidate tiles (from shortlist, not already held) ──
  const candidateTiles = useMemo(() => {
    const ownedIds = new Set(activePositions.map(p => p.tileId || p.id));
    return shortlistItems
      .map(item => tiles?.find(t => t.id === item.tileId))
      .filter(t => t && !ownedIds.has(t.id));
  }, [shortlistItems, activePositions, tiles]);

  // ── Build deriveAllocation input ──
  const held = useMemo(() =>
    activePositions.map(p => {
      const d = heldLiveData[p.id];
      return {
        id: p.id,
        tileId: p.tileId,
        symbol: p.symbol,
        strategy: p.strategyType || 'unknown',
        committedRisk: (p.maxLoss || 0) * (p.quantity || 1),
        qty: p.quantity || 1,
        pnlTotal: d?.pnlTotal ?? null,
        closing: closingSet.has(p.id),
      };
    }),
    [activePositions, heldLiveData, closingSet]
  );

  const candidates = useMemo(() =>
    candidateTiles.map(t => ({
      id: t.id,
      symbol: t.symbol,
      strategy: t.strategy || 'unknown',
      riskPerContract: Math.abs(t.maxLoss || 0),
      qty: qtyOverrides[t.id] ?? 1,
      removed: false, // removal is now persistent via Firestore — removed items leave shortlistItems
    })),
    [candidateTiles, qtyOverrides]
  );

  const alloc = deriveAllocation({ riskBudget, held, candidates });

  // ── Auto-allocate ──
  const handleAutoAllocate = useCallback(() => {
    const qtys = autoAllocateEqual(alloc.available, candidates);
    setQtyOverrides(prev => ({ ...prev, ...qtys }));
  }, [alloc.available, candidates]);

  // ── Execute ──
  const [executing, setExecuting] = useState(false);
  const handleExecute = useCallback(async () => {
    const batch = buildExecutionBatch({ held, candidates });
    if (batch.length === 0) return;

    const closeOrders = batch.filter(o => o.action === 'close');
    const openOrders = batch.filter(o => o.action === 'open');

    const summary = [];
    if (openOrders.length) summary.push(`Open ${openOrders.length} new position${openOrders.length > 1 ? 's' : ''}`);
    if (closeOrders.length) {
      const closeSummary = closeOrders.map(o => `${o.symbol} for ${signedUsd(o.realizedPnl)} realized`).join(', ');
      summary.push(`Close ${closeSummary}`);
    }

    if (!window.confirm(`Execute batch?\n\n${summary.join('\n')}\n\nThis will update your portfolio.`)) return;

    setExecuting(true);
    try {
      // Closes first (frees budget)
      for (const order of closeOrders) {
        await closePosition(order.id, order.realizedPnl / (held.find(h => h.id === order.id)?.qty || 1), 'manual');
      }
      // Opens
      for (const order of openOrders) {
        const tile = tiles?.find(t => t.id === order.id);
        if (tile) {
          await addPosition(tile);
          if (order.qty > 1) await updateQuantity(order.id, order.qty);
          await removeFromShortlist(order.id);
        }
      }
      navigate('/invest/positions');
    } catch (err) {
      console.error('Execute failed:', err);
      alert('Execution failed: ' + err.message);
    } finally {
      setExecuting(false);
    }
  }, [held, candidates, tiles, closePosition, addPosition, updateQuantity, removeFromShortlist, navigate]);

  // ── Execute label ──
  let execLabel = 'Execute';
  if (alloc.openCount > 0) execLabel += ` · open ${alloc.openCount}`;
  if (alloc.closeCount > 0) execLabel += ` · close ${alloc.closeCount}`;

  return (
    <div className="bp-wrap">
      {/* Stepper */}
      <div className="bp-stepper">
        <div className="bp-step bp-done"><span className="bp-o">&#10003;</span><small>Discover</small></div><div className="bp-seg" />
        <div className="bp-step bp-done"><span className="bp-o">&#10003;</span><small>Decide</small></div><div className="bp-seg" />
        <div className="bp-step bp-cur"><span className="bp-o" /><small>Build</small></div><div className="bp-seg" />
        <div className="bp-step"><span className="bp-o" /><small>Execute</small></div><div className="bp-seg" />
        <div className="bp-step"><span className="bp-o" /><small>Defend</small></div>
      </div>

      <div className="bp-ph">
        <span className={s.eyebrow}>Build &middot; stage your next batch</span>
        <h1 className="bp-title">Build</h1>
        <p className="bp-sub">Open new trades against the budget you have left &mdash; or close a held one to free budget. Everything here becomes one execution batch.</p>
      </div>

      {/* ══════════════ Budget waterfall ══════════════ */}
      <div className="bp-waterfall">
        <div className="bp-wf">
          <div className="bp-wf-lbl">Risk budget</div>
          <div className="bp-wf-val">{usd(riskBudget)}</div>
          <div className="bp-wf-sub">{
            totalCapital > 0
              ? (planWeeklyBudget != null
                  ? `${tradesPerWk}/wk × ${usd(perTradeCap)} per idea · from your plan`
                  : `${Math.round((riskBudget / totalCapital) * 100)}% of ${usd(totalCapital)} capital`)
              : 'configure in settings'
          }</div>
          <span className="bp-arrow">&rarr;</span>
        </div>
        <div className="bp-wf bp-wf-committed">
          <div className="bp-wf-lbl">Committed &middot; held</div>
          <div className="bp-wf-val">{usd(alloc.committed)}</div>
          <div className="bp-wf-sub">
            {held.filter(h => !h.closing).length} held
            {alloc.closeCount > 0 && ` · ${alloc.closeCount} closing`}
            {alloc.closeCount === 0 && ' · already executed'}
          </div>
          <span className="bp-arrow">&rarr;</span>
        </div>
        <div className="bp-wf bp-wf-available">
          <div className="bp-wf-lbl">Available for new</div>
          <div className="bp-wf-val">{usd(alloc.available)}</div>
          <div className="bp-wf-sub">
            {alloc.freed > 0 ? `incl. ${usd(alloc.freed)} freed by closing` : `${riskBudget > 0 ? Math.round((alloc.available / riskBudget) * 100) : 0}% of budget`}
          </div>
          <span className="bp-arrow">&rarr;</span>
        </div>
        <div className={`bp-wf ${alloc.overBudget > 0 ? 'bp-wf-over' : ''}`}>
          <div className="bp-wf-lbl">Unallocated</div>
          <div className={`bp-wf-val ${alloc.overBudget > 0 ? 'bp-over' : ''}`}>{usd(alloc.unallocated)}</div>
          <div className="bp-wf-sub">after staging batch</div>
        </div>
      </div>

      {/* Stacked bar */}
      <div className="bp-bbar">
        <div className="bp-seg-c" style={{ width: `${alloc.bar.committed}%` }} />
        <div className="bp-seg-n" style={{ width: `${alloc.bar.allocating}%` }} />
        <div className="bp-seg-u" style={{ width: `${alloc.bar.unallocated}%` }} />
      </div>
      <div className="bp-bkey">
        <span><i className="bp-key-c" />Committed (held) <b>{usd(alloc.committed)}</b></span>
        <span><i className="bp-key-n" />Allocating to new <b>{usd(alloc.allocating)}</b></span>
        <span><i className="bp-key-u" />Unallocated <b>{usd(Math.max(0, alloc.unallocated))}</b></span>
      </div>

      {/* ══════════════ Held positions ══════════════ */}
      <div className="bp-sec-h">
        <h3>Held positions</h3>
        <span className="bp-sec-note">Locked size &middot; close to free budget, or resize on the Defend page</span>
      </div>

      {held.length === 0 ? (
        <p style={{ color: '#6b7280', fontSize: 14 }}>No held positions.</p>
      ) : (
        <table className="bp-alloc">
          <thead><tr><th>Strategy</th><th>Risk / contract</th><th>Contracts</th><th>Committed</th><th>% of budget</th><th></th></tr></thead>
          <tbody>
            {held.map(h => {
              const hRow = alloc.rows.held.find(r => r.id === h.id);
              return (
                <tr key={h.id} className={h.closing ? 'bp-held-row bp-closing' : 'bp-held-row'}>
                  <td>
                    <div className={`bp-strat bp-strat-held`}>
                      <span className={`bp-pill ${h.closing ? 'bp-pill-closing' : 'bp-pill-held'}`}>
                        {h.closing ? 'Will close' : 'Held'}
                      </span>
                      <div>
                        <div className="bp-nm">{h.symbol}</div>
                        <div className="bp-ty">{formatStrategy(h.strategy)}</div>
                      </div>
                    </div>
                  </td>
                  <td>{usd(h.committedRisk / h.qty)}</td>
                  <td>{h.closing ? h.qty : <>{h.qty} &#128274;</>}</td>
                  {h.closing ? (
                    <>
                      <td><span className="bp-freed">+{usd(h.committedRisk)} freed</span>
                        {h.pnlTotal != null && <div style={{ fontSize: 11, marginTop: 2 }}>{h.symbol} {signedUsd(h.pnlTotal)} realized</div>}
                      </td>
                      <td>&mdash;</td>
                    </>
                  ) : (
                    <>
                      <td>{usd(h.committedRisk)}</td>
                      <td>{Math.round(hRow?.pctOfBudget || 0)}%</td>
                    </>
                  )}
                  <td>
                    <button className={`bp-rowbtn ${h.closing ? 'bp-rowbtn-keep' : 'bp-rowbtn-close'}`} onClick={() => toggleClose(h.id)}>
                      {h.closing ? 'Keep' : 'Close'}
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* Invisible loaders to collect live P&L for held positions */}
      {activePositions.map(p => (
        <HeldLiveLoader key={p.id} item={p} tile={tiles?.find(t => t.id === (p.tileId || p.id))} onData={reportHeldData} />
      ))}

      {/* ══════════════ New candidates ══════════════ */}
      <div className="bp-sec-h" style={{ marginTop: 30 }}>
        <h3>New &mdash; sizing now</h3>
        <span className="bp-sec-note">
          From Discover &middot; competing for the <b style={{ color: '#0d6347' }}>{usd(alloc.available)}</b> available
          {perTradeCap ? <> &middot; plan caps risk per idea at <b>{usd(perTradeCap)}</b></> : null}
        </span>
      </div>

      <div className="bp-allocrow">
        <div><b>Auto-allocate available equally</b> <span style={{ color: '#6b7280' }}>Split the available budget across the active new strategies only</span></div>
        <div className="bp-allocrow-btns">
          <button className="bp-abtn" onClick={handleAutoAllocate}>Reset to equal</button>
        </div>
      </div>

      {candidates.length === 0 ? (
        <>
          <StartPlanNudge tone="light" />
          <p style={{ color: '#6b7280', fontSize: 14 }}>No candidates shortlisted. <Link to="/invest/discover" style={{ color: '#0f4a36', fontWeight: 500 }}>Discover strategies</Link></p>
        </>
      ) : (
        <table className="bp-alloc">
          <thead><tr><th>Strategy</th><th>Risk / contract</th><th>Contracts</th><th>Amount</th><th>% of available</th><th></th></tr></thead>
          <tbody>
            {candidates.map(c => {
              const cRow = alloc.rows.candidates.find(r => r.id === c.id);
              const qty = qtyOverrides[c.id] ?? c.qty;
              return (
                <tr key={c.id}>
                  <td><div className="bp-strat bp-strat-new"><span className="bp-pill bp-pill-new">New</span><div><div className="bp-nm">{c.symbol}</div><div className="bp-ty">{formatStrategy(c.strategy)}</div></div></div></td>
                  <td>{usd(c.riskPerContract)}</td>
                  <td>
                    <div className="bp-qstep">
                      <button className="bp-qbtn" onClick={() => stepQty(c.id, -1)}>&minus;</button>
                      <span className="bp-qval">{qty}</span>
                      <button className="bp-qbtn" onClick={() => stepQty(c.id, 1)}>+</button>
                    </div>
                  </td>
                  <td>
                    {usd(cRow?.amount || 0)}
                    {perTradeCap && (cRow?.amount || 0) > perTradeCap && (
                      <span
                        title={`Plan caps risk per idea at ${usd(perTradeCap)}`}
                        style={{ marginLeft: 6, fontFamily: '"Space Mono", monospace', fontSize: 9, fontWeight: 700, letterSpacing: '0.04em', color: '#9c4f33', background: '#F0DED4', borderRadius: 6, padding: '2px 6px', whiteSpace: 'nowrap' }}
                      >
                        over plan cap
                      </span>
                    )}
                  </td>
                  <td>{Math.round(cRow?.pctOfAvailable || 0)}%</td>
                  <td><button className="bp-rowbtn bp-rowbtn-close" onClick={() => handleRemove(c.id)}>&#10005; Remove</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      {/* ══════════════ Footer ══════════════ */}
      <div className="bp-foot">
        <button className="bp-exec" onClick={handleExecute} disabled={executing || (alloc.openCount === 0 && alloc.closeCount === 0)}>
          {executing ? 'Executing…' : execLabel}
        </button>
        <Link to="/invest/discover" className="bp-ghostbtn">Add more strategies</Link>
        {alloc.overBudget > 0 && (
          <span className="bp-over">Over available by {usd(alloc.overBudget)} &mdash; reduce a new position or close a held one</span>
        )}
      </div>

      <div style={{ height: 48 }} />
    </div>
  );
}
