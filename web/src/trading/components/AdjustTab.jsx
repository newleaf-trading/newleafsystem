import { useState, useEffect, useCallback } from 'react';
import { collection, doc, addDoc, updateDoc, getDocs, query, where, orderBy, limit as firestoreLimit, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { useAuth } from '../../shared/hooks/useAuth';
import { useToast } from '../../shared/context/ToastContext';
import { getValidAdjustments, PILL } from '../utils/adjustmentCatalogue';
import { buildMarketData } from '../utils/verdictEngine';
import { fetchR2Report, matchOptionLeg } from '../api/r2Api';
import { formatStrategy } from '../utils/formatters';
import { PayoffChart } from './PayoffChart';
import { getStrategyTheme } from '../utils/strategyThemes';

const PILL_STYLES = {
  [PILL.RECOMMENDED]:       { label: 'Recommended',       color: '#0B7A52', bg: 'rgba(11,122,82,0.10)', border: 'rgba(11,122,82,0.25)', solid: true },
  [PILL.SMART_ROLL]:        { label: 'Smart roll',        color: '#0B7A52', bg: 'rgba(11,122,82,0.10)', border: 'rgba(11,122,82,0.25)' },
  [PILL.MARGINAL]:          { label: 'Marginal',          color: '#B7791F', bg: 'rgba(183,121,31,0.10)', border: 'rgba(183,121,31,0.25)' },
  [PILL.DEFENSIVE]:         { label: 'Defensive',         color: '#2563EB', bg: 'rgba(37,99,235,0.10)',  border: 'rgba(37,99,235,0.25)' },
  [PILL.DIRECTIONAL_PIVOT]: { label: 'Directional pivot', color: '#7c3aed', bg: 'rgba(124,58,237,0.10)', border: 'rgba(124,58,237,0.25)' },
  [PILL.CLEAN_EXIT]:        { label: 'Clean exit',        color: '#6b7280', bg: 'rgba(107,114,128,0.10)', border: 'rgba(107,114,128,0.25)' },
  [PILL.HIGH_RISK]:         { label: 'High risk',         color: '#C94F4F', bg: 'rgba(201,79,79,0.10)', border: 'rgba(201,79,79,0.25)' },
};

const fmt = (v) => {
  if (v == null || isNaN(v)) return '--';
  return '$' + Math.round(v).toLocaleString();
};

/**
 * AdjustTab — the Adjust tab inside Manage-mode strategy detail page.
 *
 * Renders the adjustment picker per brief §10.4:
 * - Context header
 * - Recommended adjustment card (full-width, green-tinted)
 * - Other valid adjustments list (compact)
 * - Why-this-recommendation footer
 *
 * Execute writes a pendingOrder to Firestore + copies ticket to clipboard.
 */
export function AdjustTab({ tile, portfolioItem, liveData, verdict, aiAdjustments, marketContext, urgency, adjustLoading, fetchAdjust }) {
  const { user } = useAuth();
  const toast = useToast();
  const [r2Chain, setR2Chain] = useState(null);
  const [r2Loading, setR2Loading] = useState(false);
  const [executing, setExecuting] = useState(false);

  // ─── Compute real net cost from R2 chain when available ───
  // Compares: cost to close current legs vs credit from opening proposed legs
  const enrichWithRealPricing = useCallback((adj, chain) => {
    if (!chain || !adj.newLegs || adj.newLegs.length === 0) return adj;
    if (adj.type === 'close_entire' || adj.type === 'hold_and_monitor') return adj;

    const currentLegs = tile?.legs || [];
    const expiry = tile?.expiry;

    // Cost to close current legs that are being replaced
    // For each current leg: if it's being removed or changed, we close it
    // Close = reverse the action (sell→buy, buy→sell) at current market price
    let closingCost = 0;
    let closingValid = true;
    const currentLegTypes = new Set(currentLegs.map(l => `${l.type}-${l.strike}`));
    const newLegTypes = new Set(adj.newLegs.map(l => `${l.type}-${l.strike}`));

    currentLegs.forEach(leg => {
      const key = `${leg.type}-${leg.strike}`;
      // If this leg doesn't exist in proposed position (changed strike or removed), we close it
      if (!newLegTypes.has(key)) {
        const price = matchOptionLeg(chain, leg.strike, leg.expiry || expiry, leg.type);
        if (price != null) {
          // Closing: reverse the action. If we sold it, we buy it back (cost). If we bought it, we sell it (credit).
          closingCost += (leg.action === 'sell' ? -price : price) * 100;
        } else {
          closingValid = false;
        }
      }
    });

    // Credit from opening new legs that didn't exist before
    let openingCredit = 0;
    let openingValid = true;
    adj.newLegs.forEach(leg => {
      const key = `${leg.type}-${leg.strike}`;
      if (!currentLegTypes.has(key)) {
        const price = matchOptionLeg(chain, leg.strike, leg.expiry || expiry, leg.type);
        if (price != null) {
          // Opening: sell collects premium (credit), buy pays (cost)
          openingCredit += (leg.action === 'sell' ? price : -price) * 100;
        } else {
          openingValid = false;
        }
      }
    });

    if (!closingValid || !openingValid) return adj; // Can't price, keep estimates

    const realNetCost = Math.round(closingCost + openingCredit);
    // Positive = debit (you pay), negative = credit (you receive)

    return {
      ...adj,
      netCost: realNetCost,
      newMaxLoss: Math.max(0, (tile?.maxLoss || 0) + realNetCost),
    };
  }, [tile]);

  // ─── Selection + hover state ───
  // selectedId: click commits. hoveredId: hover previews. displayedId: what chart/tiles show.
  const [selectedId, setSelectedId] = useState(null);
  const [hoveredId, setHoveredId] = useState(null);

  // Check if position has a pending adjustment
  const isPending = portfolioItem?.adjustment_pending === true;

  // Build market data and get adjustments
  const marketData = buildMarketData(liveData, tile, portfolioItem);
  const position = {
    ...portfolioItem,
    strategy: portfolioItem?.strategy || tile?.strategy,
    legs: tile?.legs || [],
    maxLoss: tile?.maxLoss || liveData?.maxLoss || 0,
    entryNetCredit: portfolioItem?.entryNetCredit || 0,
    expiry: portfolioItem?.expiry || tile?.expiry,
  };
  const rawAdjustments = getValidAdjustments(position, marketData);
  // Enrich with real R2 pricing when chain is available
  const adjustments = r2Chain
    ? rawAdjustments.map(adj => enrichWithRealPricing(adj, r2Chain))
    : rawAdjustments;
  const recommended = adjustments.find(a => a.isRecommended);
  const others = adjustments.filter(a => !a.isRecommended);

  // Default selection: recommended on mount
  useEffect(() => {
    if (recommended && !selectedId) {
      setSelectedId(recommended.type);
    }
  }, [recommended?.type]);

  // Computed: what's displayed in chart + tiles
  const displayedId = hoveredId ?? selectedId;
  const displayedAdj = adjustments.find(a => a.type === displayedId) || recommended;
  const selectedAdj = adjustments.find(a => a.type === selectedId) || recommended;

  // Fetch R2 chain eagerly (needed for chart)
  const fetchChain = useCallback(async () => {
    if (r2Chain || r2Loading || !tile?.symbol) return;
    setR2Loading(true);
    try {
      const report = await fetchR2Report(tile.symbol);
      setR2Chain(report.optionChain || []);
    } catch (err) {
      console.warn('[AdjustTab] R2 fetch failed:', err.message);
    } finally {
      setR2Loading(false);
    }
  }, [tile?.symbol, r2Chain, r2Loading]);

  // Fetch chain eagerly on mount (needed for chart pricing)
  useEffect(() => {
    fetchChain();
  }, [fetchChain]);

  // Look up real price for a leg from R2 chain
  const getChainPrice = (strike, expiry, type) => {
    if (!r2Chain) return null;
    return matchOptionLeg(r2Chain, strike, expiry, type);
  };

  // Build clipboard ticket text
  const buildTicket = (adj) => {
    const legs = tile?.legs || [];
    const closingLegs = legs
      .filter(l => l.action === 'sell')
      .map(l => `CLOSE ${l.action === 'sell' ? 'short' : 'long'} $${l.strike} ${l.type}`)
      .join(', ');
    const symbol = tile?.symbol || '???';
    const expiry = tile?.expiry || '???';
    const cost = adj.netCost != null ? (adj.netCost >= 0 ? `net $${Math.abs(adj.netCost)} debit` : `net $${Math.abs(adj.netCost)} credit`) : 'price TBD';

    return `${symbol} · ${adj.label} / ${closingLegs} / expires ${expiry} / ${cost}`;
  };

  // Execute: write pendingOrder + clipboard + toast + position flag
  const handleExecute = async (adj) => {
    if (!user || !portfolioItem || executing) return;
    setExecuting(true);

    try {
      const ticket = buildTicket(adj);

      // 1. Write pendingOrder
      const orderRef = collection(db, 'users', user.uid, 'pendingOrders');
      await addDoc(orderRef, {
        positionId: portfolioItem.tileId,
        orderType: adj.type,
        legs: (tile?.legs || []).map(l => ({
          action: l.action, type: l.type, strike: l.strike,
          expiry: l.expiry || tile?.expiry,
          estimatedPrice: getChainPrice(l.strike, l.expiry || tile?.expiry, l.type),
        })),
        closingLegs: (tile?.legs || []).filter(l => l.action === 'sell').map(l => ({
          action: 'buy', type: l.type, strike: l.strike,
          expiry: l.expiry || tile?.expiry,
          estimatedPrice: getChainPrice(l.strike, l.expiry || tile?.expiry, l.type),
        })),
        estimatedCost: adj.netCost || 0,
        estimatedFill: adj.netCost != null
          ? (adj.netCost >= 0 ? `$${Math.abs(adj.netCost)} debit` : `$${Math.abs(adj.netCost)} credit`)
          : 'TBD',
        status: 'ready_to_execute',
        sourceAdjustment: adj.label,
        relatedPositionId: portfolioItem.tileId,
        symbol: tile?.symbol,
        strategy: tile?.strategy,
        clipboardTicket: ticket,
        createdAt: serverTimestamp(),
        cancelledAt: null,
        executedAt: null,
      });

      // 2. Copy ticket to clipboard
      try { await navigator.clipboard.writeText(ticket); } catch (e) { /* clipboard may fail in some contexts */ }

      // 3. Set position as adjustment_pending
      const posRef = doc(db, 'users', user.uid, 'portfolio', portfolioItem.tileId);
      await updateDoc(posRef, { adjustment_pending: true });

      // 4. Show toast
      toast.success('Order ready — execute at your broker, or wait for NewLeaf Desk');
    } catch (err) {
      console.error('[AdjustTab] Execute failed:', err);
      toast.error('Failed to create order. Try again.');
    } finally {
      setExecuting(false);
    }
  };

  // Cancel pending order
  const handleCancel = async () => {
    if (!user || !portfolioItem) return;
    try {
      // Find the most recent ready_to_execute order for this position
      const ordersRef = collection(db, 'users', user.uid, 'pendingOrders');
      const q = query(ordersRef, where('positionId', '==', portfolioItem.tileId), where('status', '==', 'ready_to_execute'));
      const snap = await getDocs(q);
      // Mark all matching as cancelled
      for (const d of snap.docs) {
        await updateDoc(d.ref, { status: 'cancelled', cancelledAt: serverTimestamp() });
      }

      const posRef = doc(db, 'users', user.uid, 'portfolio', portfolioItem.tileId);
      await updateDoc(posRef, { adjustment_pending: false });
      toast.info('Pending adjustment cancelled.');
    } catch (err) {
      console.error('[AdjustTab] Cancel failed:', err);
    }
  };

  // Mark as executed — manual sync path for when trader executes at broker
  const [markingExecuted, setMarkingExecuted] = useState(false);
  const handleMarkExecuted = async () => {
    if (!user || !portfolioItem || markingExecuted) return;
    setMarkingExecuted(true);

    try {
      const positionId = portfolioItem.tileId;

      // 1. Find the pending order and flip to 'filled'
      const ordersRef = collection(db, 'users', user.uid, 'pendingOrders');
      const q = query(ordersRef, where('positionId', '==', positionId), where('status', '==', 'ready_to_execute'));
      const orderSnap = await getDocs(q);
      let pendingOrder = null;
      for (const d of orderSnap.docs) {
        pendingOrder = { id: d.id, ...d.data() };
        await updateDoc(d.ref, { status: 'filled', executedAt: serverTimestamp() });
      }

      // 2. Write to adjustments subcollection for history tracking
      const adjustmentsRef = collection(db, 'users', user.uid, 'portfolio', positionId, 'adjustments');
      await addDoc(adjustmentsRef, {
        type: pendingOrder?.orderType || 'manual',
        label: pendingOrder?.sourceAdjustment || 'Manual execution',
        oldLegs: portfolioItem.legs || [],
        newLegs: pendingOrder?.legs || [],
        estimatedCost: pendingOrder?.estimatedCost || 0,
        adjustedAt: serverTimestamp(),
        method: 'manual_mark', // vs 'newleaf_desk' when that ships
      });

      // 3. Close the old position entry and record the adjustment
      const posRef = doc(db, 'users', user.uid, 'portfolio', positionId);
      await updateDoc(posRef, {
        adjustment_pending: false,
        // Record that this position has been adjusted
        lastAdjustment: {
          type: pendingOrder?.orderType || 'manual',
          label: pendingOrder?.sourceAdjustment || 'Manual execution',
          adjustedAt: new Date().toISOString(),
        },
        // If the adjustment changes the legs, update them
        // For now we keep existing legs — the new position from the roll
        // would typically be a fresh tile. The trader manually confirms
        // the fill and the system records it happened.
        updatedAt: serverTimestamp(),
      });

      toast.success('Adjustment marked as executed. Position updated.');
    } catch (err) {
      console.error('[AdjustTab] Mark executed failed:', err);
      toast.error('Failed to mark as executed. Try again.');
    } finally {
      setMarkingExecuted(false);
    }
  };

  // ─── Pending state ───
  if (isPending) {
    return (
      <div>
        <div style={{
          ...cardBase, background: 'rgba(183,121,31,0.06)',
          borderColor: 'rgba(183,121,31,0.15)', textAlign: 'center', padding: 32,
        }}>
          <div style={{ fontSize: 28, marginBottom: 8 }}>&#9203;</div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#111827', marginBottom: 6 }}>
            Adjustment Pending
          </h3>
          <p style={{ fontSize: 13, color: '#6b7280', marginBottom: 16 }}>
            Waiting for execution at your broker or via NewLeaf Desk.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              onClick={handleMarkExecuted}
              disabled={markingExecuted}
              style={{
                padding: '10px 20px', borderRadius: 8, border: 'none',
                background: '#0B2D23', color: '#fff', fontSize: 13, fontWeight: 700,
                cursor: markingExecuted ? 'wait' : 'pointer',
                opacity: markingExecuted ? 0.6 : 1,
              }}
            >
              {markingExecuted ? 'Updating...' : 'Mark as executed'}
            </button>
            <button onClick={handleCancel} style={btnOutline}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── No adjustments available ───
  if (adjustments.length === 0) {
    return (
      <div style={{ ...cardBase, textAlign: 'center', padding: 32 }}>
        <p style={{ fontSize: 14, color: '#9ca3af' }}>No adjustments available for this strategy.</p>
      </div>
    );
  }

  return (
    <div>
      {/* ─── AI Recommendations Section ─── */}
      <div style={{ marginBottom: 20 }}>
        <button
          onClick={() => {
            if (!fetchAdjust || adjustLoading) return;
            fetchAdjust({
              ticker: tile?.symbol,
              strategy: tile?.strategy,
              legs: tile?.legs || [],
              entryNetCredit: portfolioItem?.entryNetCredit || 0,
              currentSpot: liveData?.currentSpot || 0,
              dte: liveData?.dte || 0,
              pnlPerContract: liveData?.pnlPerContract || 0,
              profitCapturePct: liveData?.profitCapturePct || 0,
              liveGreeks: liveData?.liveGreeks || null,
              verdictState: verdict?.state || null,
              verdictReason: verdict?.reason || '',
              chain: null,
            });
          }}
          disabled={adjustLoading}
          style={{
            padding: '10px 20px', background: '#0B2D23', color: '#fff',
            border: 'none', borderRadius: 8, cursor: adjustLoading ? 'wait' : 'pointer',
            fontSize: 13, fontWeight: 700, marginBottom: 16,
            opacity: adjustLoading ? 0.6 : 1,
          }}
        >
          {adjustLoading ? 'Analyzing...' : 'Get AI Recommendations'}
        </button>

        {aiAdjustments && aiAdjustments.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            {/* Urgency indicator */}
            {urgency && (
              <div style={{
                display: 'inline-block', padding: '3px 10px', borderRadius: 999,
                fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase',
                marginBottom: 12,
                background: urgency === 'immediate' ? 'rgba(201,79,79,0.10)' : urgency === 'soon' ? 'rgba(217,119,6,0.10)' : 'rgba(11,122,82,0.10)',
                color: urgency === 'immediate' ? '#C94F4F' : urgency === 'soon' ? '#B45309' : '#0B7A52',
                border: `1px solid ${urgency === 'immediate' ? 'rgba(201,79,79,0.25)' : urgency === 'soon' ? 'rgba(217,119,6,0.25)' : 'rgba(11,122,82,0.25)'}`,
              }}>
                {urgency === 'immediate' ? 'Immediate action' : urgency === 'soon' ? 'Act soon' : 'Monitor'}
              </div>
            )}

            {/* Market context */}
            {marketContext && (
              <p style={{ fontSize: 12, color: '#6b7280', fontStyle: 'italic', lineHeight: 1.5, margin: '0 0 12px' }}>
                {marketContext}
              </p>
            )}

            {/* AI adjustment cards */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {aiAdjustments.map((adj, i) => {
                const riskColor = adj.riskLevel === 'high' ? '#C94F4F' : adj.riskLevel === 'medium' ? '#B45309' : '#0B7A52';
                const riskBg = adj.riskLevel === 'high' ? 'rgba(201,79,79,0.10)' : adj.riskLevel === 'medium' ? 'rgba(217,119,6,0.10)' : 'rgba(11,122,82,0.10)';
                const riskBorder = adj.riskLevel === 'high' ? 'rgba(201,79,79,0.25)' : adj.riskLevel === 'medium' ? 'rgba(217,119,6,0.25)' : 'rgba(11,122,82,0.25)';

                return (
                  <div key={i} style={{
                    ...cardBase,
                    background: 'rgba(124,58,237,0.03)',
                    border: '1px solid rgba(124,58,237,0.12)',
                  }}>
                    {/* Header row: type badge + risk level badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                      {adj.type && (
                        <span style={{
                          display: 'inline-block', padding: '2px 8px', borderRadius: 999,
                          fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
                          background: 'rgba(124,58,237,0.10)', color: '#7c3aed', border: '1px solid rgba(124,58,237,0.20)',
                        }}>
                          {adj.type}
                        </span>
                      )}
                      {adj.riskLevel && (
                        <span style={{
                          display: 'inline-block', padding: '2px 8px', borderRadius: 999,
                          fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
                          background: riskBg, color: riskColor, border: `1px solid ${riskBorder}`,
                        }}>
                          {adj.riskLevel} risk
                        </span>
                      )}
                    </div>

                    {/* Label */}
                    {adj.label && (
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 4 }}>
                        {adj.label}
                      </div>
                    )}

                    {/* Description */}
                    {adj.description && (
                      <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, margin: '0 0 8px' }}>
                        {adj.description}
                      </p>
                    )}

                    {/* New legs */}
                    {adj.newLegs && adj.newLegs.length > 0 && (
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 4 }}>
                          New legs
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                          {adj.newLegs.map((leg, j) => (
                            <span key={j} style={{
                              padding: '3px 8px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                              background: 'rgba(17,24,39,0.05)', color: '#374151', border: '1px solid rgba(17,24,39,0.08)',
                            }}>
                              {leg.action} {leg.type} ${leg.strike}{leg.expiry ? ` (${leg.expiry})` : ''}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Estimated cost */}
                    {adj.estimatedCost != null && (
                      <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>
                        Est. cost: <strong style={{ color: '#374151' }}>{adj.estimatedCost >= 0 ? `$${Math.abs(adj.estimatedCost)} debit` : `$${Math.abs(adj.estimatedCost)} credit`}</strong>
                      </div>
                    )}

                    {/* Reasoning */}
                    {adj.reasoning && (
                      <p style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.5, margin: '4px 0 0', fontStyle: 'italic' }}>
                        {adj.reasoning}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Separator between AI and rule-based */}
            <div style={{
              borderTop: '1px solid rgba(17,24,39,0.08)', marginTop: 20, paddingTop: 12,
              fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9ca3af',
            }}>
              Rule-based adjustments
            </div>
          </div>
        )}
      </div>

      {/* Context header */}
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.6 }}>
          <strong>{tile?.symbol}</strong> {formatStrategy(tile?.strategy)} &middot;
          P&L: {liveData?.pnlPerContract >= 0 ? '+' : ''}{fmt(liveData?.pnlPerContract)} &middot;
          {adjustments.length} valid adjustment{adjustments.length !== 1 ? 's' : ''} &middot;
          <span style={{ color: '#9ca3af' }}> based on delta threshold, DTE, and improvement ratio.</span>
        </div>
      </div>

      {/* ─── Payoff chart — displayed adjustment vs current position ─── */}
      {tile?.legs?.length > 0 && liveData?.currentSpot > 0 && (
        <PayoffChart
          legs={displayedAdj?.type === 'close_entire'
            ? [{ action: 'buy', type: 'call', strike: liveData.currentSpot, premium: 0, quantity: 0 }] // flat line at zero
            : (displayedAdj?.newLegs?.length > 0 ? displayedAdj.newLegs : tile.legs)}
          comparisonLegs={tile.legs}
          spotPrice={liveData.currentSpot}
          height={260}
          accentColor={getStrategyTheme(tile.strategy).primary}
        />
      )}

      {/* ─── Recommended card ─── */}
      {recommended && (
        <AdjustmentCard
          adj={recommended}
          isSelected={selectedId === recommended.type}
          isDisplayed={displayedId === recommended.type}
          onSelect={() => setSelectedId(recommended.type)}
          onExecute={() => handleExecute(selectedAdj)}
          executing={executing}
          r2Chain={r2Chain}
          r2Loading={r2Loading}
          tile={tile}
          isRecommended
        />
      )}

      {/* ─── Other adjustments ─── */}
      {others.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 10 }}>
            Other options
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {others.map(adj => (
              <AdjustmentCard
                key={adj.type}
                adj={adj}
                isSelected={selectedId === adj.type}
                isDisplayed={displayedId === adj.type}
                onSelect={() => setSelectedId(adj.type)}
                onHoverStart={() => setHoveredId(adj.type)}
                onHoverEnd={() => setHoveredId(null)}
                onExecute={() => handleExecute(selectedAdj)}
                executing={executing}
                r2Chain={r2Chain}
                r2Loading={r2Loading}
                tile={tile}
              />
            ))}
          </div>
        </div>
      )}

      {/* ─── Why this recommendation ─── */}
      {recommended && (
        <div style={{ marginTop: 24, padding: 16, background: 'rgba(247,248,250,0.65)', borderRadius: 12, border: '1px solid rgba(17,24,39,0.06)' }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 6 }}>
            Why this recommendation
          </div>
          <p style={{ fontSize: 13, color: '#374151', lineHeight: 1.6, margin: 0 }}>
            {recommended.type === 'close_entire'
              ? 'No roll or defensive adjustment scored above the improvement threshold. Closing the position locks in the current P&L and frees capital for better setups.'
              : `"${recommended.label}" scored highest based on the improvement ratio: probability gain per dollar of adjustment cost. Smart rolls require ratio ≥ 0.30 and probability ≥ 55% after adjustment.`
            }
          </p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// AdjustmentCard — renders one adjustment (recommended or compact)
// ═══════════════════════════════════════════════════════════════

function AdjustmentCard({
  adj, isSelected, isDisplayed, onSelect, onHoverStart, onHoverEnd,
  onExecute, executing, r2Chain, r2Loading, tile, isRecommended = false,
}) {
  const pillCfg = PILL_STYLES[adj.verdictPill] || PILL_STYLES[PILL.MARGINAL];
  const showDetail = isSelected;

  // Row background: selected = green tint, hovered (displayed but not selected) = subtle grey, default = white
  let rowBg = '#fff';
  if (isSelected) rowBg = 'rgba(11,122,82,0.04)';
  else if (isDisplayed) rowBg = 'rgba(247,248,250,0.8)';

  return (
    <div
      style={{
        ...cardBase, background: rowBg,
        borderColor: isSelected ? 'rgba(11,122,82,0.15)' : 'rgba(17,24,39,0.10)',
        borderWidth: isSelected ? '1.5px' : '1px',
        transition: 'background 0.15s, border-color 0.15s',
      }}
      onMouseEnter={() => onHoverStart?.()}
      onMouseLeave={() => onHoverEnd?.()}
    >
      {/* Header row — click to select */}
      <div
        onClick={onSelect}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1 }}>
          <span style={{
            display: 'inline-block', padding: '3px 8px', borderRadius: 999,
            fontSize: 10, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase',
            background: pillCfg.bg, color: pillCfg.color, border: `1px solid ${pillCfg.border}`,
          }}>
            {pillCfg.label}
          </span>
          <span style={{ fontWeight: 700, fontSize: 14, color: '#111827' }}>{adj.label}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {!isRecommended && !isSelected && (
            <span style={{ fontSize: 12, color: '#9ca3af' }}>See detail</span>
          )}
          <span style={{ fontSize: 12, color: '#d1d5db', transform: showDetail ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
            &#9660;
          </span>
        </div>
      </div>

      {/* Detail content — visible when recommended or selected */}
      {showDetail && (
        <div style={{ marginTop: 10 }}>
          <p style={{ fontSize: 13, color: '#6b7280', lineHeight: 1.5, margin: '0 0 12px' }}>
            {adj.description}
          </p>

          {/* Outcome tiles */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 12 }}>
            <OutcomeTile
              label="Net Cost"
              value={adj.netCost != null ? (adj.netCost >= 0 ? fmt(adj.netCost) + ' debit' : fmt(Math.abs(adj.netCost)) + ' credit') : '--'}
              positive={adj.netCost < 0}
              negative={adj.netCost > 0}
            />
            <OutcomeTile
              label="New Probability"
              value={adj.newProbability != null ? `${adj.newProbability.toFixed(0)}%` : '--'}
            />
            <OutcomeTile
              label="New Max Loss"
              value={adj.newMaxLoss != null ? fmt(adj.newMaxLoss) : '--'}
            />
          </div>

          {/* Leg diff table — shows what stays, what's closing, what's opening */}
          {tile?.legs && adj.type !== 'hold_and_monitor' && (
            <LegDiffTable
              currentLegs={tile.legs}
              proposedLegs={adj.newLegs || []}
              expiry={tile.expiry}
              adjType={adj.type}
              r2Chain={r2Chain}
              r2Loading={r2Loading}
            />
          )}
          {adj.type === 'hold_and_monitor' && (
            <div style={{ marginBottom: 12, fontSize: 13, color: '#6b7280', fontStyle: 'italic' }}>
              No changes — current position remains as-is.
            </div>
          )}

          {/* Execute button — binds to selectedAdj, not this card's adj */}
          <div style={{ display: 'flex', gap: 8 }}>
            {adj.type !== 'hold_and_monitor' && (
              <button
                onClick={(e) => { e.stopPropagation(); onExecute(); }}
                disabled={executing}
                style={{
                  padding: '10px 20px', borderRadius: 8, border: 'none', cursor: executing ? 'wait' : 'pointer',
                  fontSize: 13, fontWeight: 700,
                  background: isSelected ? '#0B2D23' : 'rgba(11,45,35,0.08)',
                  color: isSelected ? '#fff' : '#0B2D23',
                  opacity: executing ? 0.6 : 1,
                }}
              >
                {executing ? 'Creating order...' : adj.label}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * LegDiffTable — shows current position legs as a diff:
 * - Unchanged legs: normal row
 * - Closing legs: strikethrough, red "CLOSING" badge
 * - Opening legs: green highlight, "OPENING" badge
 */
function LegDiffTable({ currentLegs, proposedLegs, expiry, adjType, r2Chain, r2Loading }) {
  if (adjType === 'close_entire') {
    // All legs closing
    return (
      <div style={{ marginBottom: 12 }}>
        <div style={diffHeader}>Position changes</div>
        <table style={tableStyle}>
          <thead><tr>{['Status', 'Action', 'Strike', 'Type', 'Expiry', 'Price'].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr></thead>
          <tbody>
            {currentLegs.map((leg, i) => (
              <DiffRow key={`close-${i}`} leg={leg} status="closing" expiry={expiry} r2Chain={r2Chain} r2Loading={r2Loading} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Build lookup keys for current and proposed legs
  const currentKeys = new Set(currentLegs.map(l => `${l.type}-${l.strike}-${l.expiry || expiry}`));
  const proposedKeys = new Set(proposedLegs.map(l => `${l.type}-${l.strike}-${l.expiry || expiry}`));

  // Categorise each leg
  const unchanged = [];
  const closing = [];
  const opening = [];

  currentLegs.forEach(leg => {
    const key = `${leg.type}-${leg.strike}-${leg.expiry || expiry}`;
    if (proposedKeys.has(key)) {
      unchanged.push(leg);
    } else {
      closing.push(leg);
    }
  });

  proposedLegs.forEach(leg => {
    const key = `${leg.type}-${leg.strike}-${leg.expiry || expiry}`;
    if (!currentKeys.has(key)) {
      opening.push(leg);
    }
  });

  const hasChanges = closing.length > 0 || opening.length > 0;
  if (!hasChanges) {
    return (
      <div style={{ marginBottom: 12, fontSize: 13, color: '#6b7280', fontStyle: 'italic' }}>
        Same strikes and expiry — only time premium changes.
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={diffHeader}>Position changes</div>
      <table style={tableStyle}>
        <thead>
          <tr>
            {['', 'Action', 'Strike', 'Type', 'Expiry', 'Price'].map(h => (
              <th key={h} style={thStyle}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {unchanged.map((leg, i) => (
            <DiffRow key={`keep-${i}`} leg={leg} status="unchanged" expiry={expiry} r2Chain={r2Chain} r2Loading={r2Loading} />
          ))}
          {closing.map((leg, i) => (
            <DiffRow key={`close-${i}`} leg={leg} status="closing" expiry={expiry} r2Chain={r2Chain} r2Loading={r2Loading} />
          ))}
          {opening.map((leg, i) => (
            <DiffRow key={`open-${i}`} leg={leg} status="opening" expiry={expiry} r2Chain={r2Chain} r2Loading={r2Loading} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DiffRow({ leg, status, expiry, r2Chain, r2Loading }) {
  const chainPrice = r2Chain ? matchOptionLeg(r2Chain, leg.strike, leg.expiry || expiry, leg.type) : null;
  const isClosing = status === 'closing';
  const isOpening = status === 'opening';

  const rowBg = isClosing ? 'rgba(201,79,79,0.04)' : isOpening ? 'rgba(11,122,82,0.04)' : 'transparent';
  const textDecoration = isClosing ? 'line-through' : 'none';
  const textColor = isClosing ? '#9ca3af' : '#111827';

  const statusBadge = {
    closing: { label: 'CLOSE', color: '#C94F4F', bg: 'rgba(201,79,79,0.10)' },
    opening: { label: 'OPEN', color: '#0B7A52', bg: 'rgba(11,122,82,0.10)' },
    unchanged: { label: 'KEEP', color: '#9ca3af', bg: 'rgba(17,24,39,0.04)' },
  }[status];

  return (
    <tr style={{ background: rowBg, borderBottom: '1px solid rgba(17,24,39,0.06)' }}>
      <td style={{ ...tdStyle, width: 60 }}>
        <span style={{
          display: 'inline-block', padding: '1px 6px', borderRadius: 4,
          fontSize: 9, fontWeight: 700, letterSpacing: '.06em',
          color: statusBadge.color, background: statusBadge.bg,
        }}>
          {statusBadge.label}
        </span>
      </td>
      <td style={{ ...tdStyle, textDecoration }}>
        <span style={{
          fontWeight: 700, textTransform: 'uppercase',
          color: (leg.action || '').toLowerCase() === 'sell' ? '#C94F4F' : '#0B7A52',
          opacity: isClosing ? 0.5 : 1,
        }}>
          {leg.action}
        </span>
      </td>
      <td style={{ ...tdStyle, fontFamily: "'Space Mono', monospace", fontWeight: 700, color: textColor, textDecoration }}>
        ${leg.strike}
      </td>
      <td style={{ ...tdStyle, color: textColor, textDecoration }}>
        {(leg.type || '').toUpperCase()}
      </td>
      <td style={{ ...tdStyle, color: textColor, textDecoration, fontSize: 11 }}>
        {leg.expiry || expiry || '--'}
      </td>
      <td style={{ ...tdStyle, fontFamily: "'Space Mono', monospace", fontWeight: 600, color: textColor, textAlign: 'right' }}>
        {r2Loading ? '...' : chainPrice != null ? `$${chainPrice.toFixed(2)}` : '--'}
      </td>
    </tr>
  );
}

const diffHeader = {
  fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase',
  color: '#9ca3af', marginBottom: 8,
};

const tableStyle = {
  width: '100%', borderCollapse: 'collapse', fontSize: 12,
  border: '1px solid rgba(17,24,39,0.08)', borderRadius: 10, overflow: 'hidden',
};

const thStyle = {
  padding: '8px 10px', fontSize: 9, fontWeight: 700,
  letterSpacing: '.1em', textTransform: 'uppercase',
  color: 'rgba(17,24,39,0.45)', textAlign: 'left',
  background: 'rgba(247,248,250,0.75)', borderBottom: '1px solid rgba(17,24,39,0.06)',
};

const tdStyle = {
  padding: '8px 10px', fontSize: 12,
};

function OutcomeTile({ label, value, positive, negative }) {
  let color = '#111827';
  if (positive) color = '#0B7A52';
  if (negative) color = '#C94F4F';

  return (
    <div style={{
      background: '#fff', border: '1px solid rgba(17,24,39,0.08)', borderRadius: 10, padding: 10,
    }}>
      <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, color }}>
        {value}
      </div>
    </div>
  );
}

const cardBase = {
  background: '#fff', border: '1px solid rgba(17,24,39,0.10)',
  borderRadius: 14, padding: 16,
};

const btnOutline = {
  padding: '8px 16px', borderRadius: 8,
  border: '1px solid rgba(17,24,39,0.12)', background: '#fff',
  fontSize: 12, fontWeight: 600, color: '#6b7280', cursor: 'pointer',
};
