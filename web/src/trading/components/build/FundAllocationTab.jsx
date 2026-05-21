/**
 * FundAllocationTab — risk budget, auto-allocate, per-strategy sizing.
 * Matches the old PortfolioPageRefactored Fund Allocation tab.
 */
import { useState } from 'react';
import { formatStrategy } from '../../utils/formatters';
import { getStrategyTheme } from '../../utils/strategyThemes';

const fmt = (v) => '$' + Math.round(v || 0).toLocaleString();

export function FundAllocationTab({
  allocation,
  riskBudget,
  totalCapital,
  autoAllocate,
  onAutoAllocateToggle,
  onQuantityChange,
  onApply,
  onCapitalChange,
  onDrawdownChange,
  maxDrawdown,
}) {
  const [editingCapital, setEditingCapital] = useState(false);
  const [capitalInput, setCapitalInput] = useState('');
  const [editingBudget, setEditingBudget] = useState(false);

  const handleCapitalSave = () => {
    const num = parseInt(capitalInput.replace(/,/g, ''), 10);
    if (num && num >= 1000 && onCapitalChange) onCapitalChange(num);
    setEditingCapital(false);
  };

  return (
    <div>
      {/* Top stats row — editable */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        {/* Total Capital — editable */}
        <div style={{ ...cardStyle }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={labelStyle}>Total Capital</span>
            {!editingCapital && (
              <button onClick={() => { setEditingCapital(true); setCapitalInput((totalCapital || 0).toLocaleString()); }} style={editBtn}>Edit</button>
            )}
          </div>
          {editingCapital ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 6 }}>
              <span style={{ fontSize: 16, fontWeight: 700 }}>$</span>
              <input autoFocus type="text" value={capitalInput}
                onChange={(e) => setCapitalInput(e.target.value.replace(/[^0-9,]/g, ''))}
                onKeyDown={(e) => { if (e.key === 'Enter') handleCapitalSave(); if (e.key === 'Escape') setEditingCapital(false); }}
                onBlur={handleCapitalSave}
                style={{ border: '1px solid rgba(17,24,39,0.15)', borderRadius: 6, padding: '4px 8px', fontSize: 16, fontWeight: 700, width: 120, fontFamily: "'Space Mono', monospace" }}
              />
            </div>
          ) : (
            <>
              <div style={valueStyle}>{fmt(totalCapital)}</div>
              <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                <button onClick={() => onCapitalChange?.((totalCapital || 0) - 10000)} style={adjustBtn}>- $10K</button>
                <button onClick={() => onCapitalChange?.((totalCapital || 0) + 10000)} style={adjustBtn}>+ $10K</button>
              </div>
            </>
          )}
        </div>

        {/* Risk Budget — editable drawdown % */}
        <div style={{ ...cardStyle, borderColor: 'rgba(201,169,110,0.25)', background: 'linear-gradient(135deg, rgba(201,169,110,0.04), #fff)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ ...labelStyle, color: '#C9A96E' }}>Risk Budget</span>
            <button onClick={() => setEditingBudget(!editingBudget)} style={editBtn}>Edit</button>
          </div>
          <div style={valueStyle}>{fmt(riskBudget)}</div>
          <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{((maxDrawdown || 0.10) * 100).toFixed(0)}% of capital</div>
          {editingBudget && (
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <button onClick={() => onDrawdownChange?.(Math.max(0.05, (maxDrawdown || 0.10) - 0.01))} style={adjustBtn}>- 1%</button>
              <button onClick={() => onDrawdownChange?.(Math.min(0.50, (maxDrawdown || 0.10) + 0.01))} style={adjustBtn}>+ 1%</button>
            </div>
          )}
        </div>

        {/* Allocated */}
        <div style={{
          ...cardStyle,
          ...(allocation.isOverBudget ? { background: 'rgba(201,79,79,0.06)', borderColor: 'rgba(201,79,79,0.20)' } : {}),
        }}>
          <span style={labelStyle}>Allocated</span>
          <div style={{ ...valueStyle, color: allocation.isOverBudget ? '#C94F4F' : '#111827' }}>
            {fmt(allocation.allocatedAmount)}
          </div>
          <div style={{ fontSize: 11, color: allocation.isOverBudget ? '#C94F4F' : '#9ca3af', marginTop: 2 }}>
            {allocation.allocationPct.toFixed(1)}% of budget
          </div>
        </div>

        {/* Unallocated */}
        <div style={cardStyle}>
          <span style={labelStyle}>Unallocated</span>
          <div style={{
            ...valueStyle,
            color: allocation.unallocated >= 0 ? '#0B7A52' : '#C94F4F',
          }}>
            {fmt(allocation.unallocated)}
          </div>
          {allocation.unallocated < 0 && (
            <div style={{ fontSize: 11, color: '#C94F4F', marginTop: 2 }}>
              {fmt(Math.abs(allocation.unallocated))} over budget
            </div>
          )}
        </div>
      </div>

      {/* Auto-allocate toggle + actions */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '14px 18px', background: '#fff', borderRadius: 10,
        border: '1px solid rgba(17,24,39,0.08)', marginBottom: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={onAutoAllocateToggle}
            style={{
              width: 22, height: 22, borderRadius: 4, border: `2px solid ${autoAllocate ? '#0B2D23' : 'rgba(17,24,39,0.20)'}`,
              background: autoAllocate ? '#0B2D23' : '#fff', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: 12, fontWeight: 700,
            }}
          >
            {autoAllocate ? '✓' : ''}
          </button>
          <div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>Auto-allocate equally</div>
            <div style={{ fontSize: 11, color: 'rgba(17,24,39,0.55)' }}>
              Distribute risk budget evenly across all {allocation.strategies.length} strategies
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onAutoAllocateToggle} style={ghostBtn}>Reset to Equal</button>
          {onApply && (
            <button onClick={onApply} style={primaryBtn}>Apply to Portfolio</button>
          )}
        </div>
      </div>

      {/* Per-strategy rows */}
      {allocation.strategies.length === 0 ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
          No strategies in shortlist. Add strategies from Discover to start sizing.
        </div>
      ) : (
        <div>
          {/* Header */}
          <div style={{
            display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 120px',
            gap: 12, padding: '8px 16px', fontSize: 10, fontWeight: 700,
            letterSpacing: '.1em', textTransform: 'uppercase', color: 'rgba(17,24,39,0.45)',
          }}>
            <span>Strategy</span>
            <span style={{ textAlign: 'right' }}>Risk per Contract</span>
            <span style={{ textAlign: 'right' }}>Allocation</span>
            <span style={{ textAlign: 'right' }}>Amount</span>
            <span style={{ textAlign: 'right' }}>% of Budget</span>
            <span style={{ textAlign: 'center' }}>Contracts</span>
          </div>

          {/* Rows */}
          {allocation.strategies.map(s => {
            const theme = getStrategyTheme(s.strategy || s.tile?.strategy);
            return (
              <div key={s.id || s.tileId} style={{
                display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 120px',
                gap: 12, padding: '14px 16px', background: '#fff',
                border: '1px solid rgba(17,24,39,0.08)', borderRadius: 10,
                borderLeft: `3px solid ${theme.primary}`, alignItems: 'center',
                marginBottom: 6,
              }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 15 }}>{s.symbol || s.tile?.symbol}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af' }}>{formatStrategy(s.strategy || s.tile?.strategy)}</div>
                </div>
                <div style={{ textAlign: 'right', fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 600 }}>
                  {fmt(s.riskPerContract)}
                </div>
                <div style={{ textAlign: 'right', fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#6b7280' }}>
                  {fmt(s.allocationAmount)}
                </div>
                <div style={{ textAlign: 'right', fontFamily: "'Space Mono', monospace", fontSize: 13, fontWeight: 700, color: s.actualRisk > riskBudget * 0.4 ? '#C94F4F' : '#111827' }}>
                  {fmt(s.actualRisk)}
                </div>
                <div style={{ textAlign: 'right', fontSize: 12, color: s.allocationPct > 40 ? '#C94F4F' : '#6b7280' }}>
                  {s.allocationPct.toFixed(1)}%
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                  <button onClick={() => onQuantityChange(s.id || s.tileId, Math.max(1, s.contracts - 1))} style={qtyBtn}>-</button>
                  <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 16, fontWeight: 700, minWidth: 28, textAlign: 'center' }}>
                    {s.contracts}
                  </span>
                  <button onClick={() => onQuantityChange(s.id || s.tileId, s.contracts + 1)} style={qtyBtn}>+</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Over-budget advisory */}
      {allocation.isOverBudget && (
        <div style={{
          marginTop: 16, padding: '14px 18px', borderRadius: 10,
          background: 'rgba(201,79,79,0.06)', border: '1px solid rgba(201,79,79,0.15)',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: '#C94F4F' }}>Over Risk Budget</span>
          <span style={{ fontSize: 13, color: '#C94F4F' }}>
            Allocated {fmt(allocation.allocatedAmount)} exceeds risk budget of {fmt(riskBudget)} ({allocation.allocationPct.toFixed(1)}%)
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Shared styles ───

const cardStyle = {
  background: '#fff', border: '1px solid rgba(17,24,39,0.10)', borderRadius: 12, padding: 16,
};

const labelStyle = {
  fontSize: 10, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase',
  color: 'rgba(17,24,39,0.55)', display: 'block', marginBottom: 6,
};

const valueStyle = {
  fontFamily: "'Space Mono', monospace", fontSize: 22, fontWeight: 700, color: '#111827',
};

const editBtn = {
  background: 'none', border: '1px solid rgba(17,24,39,0.12)', borderRadius: 4,
  fontSize: 11, fontWeight: 600, color: '#6b7280', cursor: 'pointer', padding: '2px 8px',
};

const adjustBtn = {
  padding: '6px 14px', borderRadius: 6, border: '1px solid rgba(17,24,39,0.12)',
  background: '#fff', fontSize: 12, fontWeight: 600, color: '#111827', cursor: 'pointer',
};

const qtyBtn = {
  width: 28, height: 28, borderRadius: 6,
  border: '1px solid rgba(17,24,39,0.10)', background: '#fff',
  fontSize: 16, fontWeight: 600, color: '#111827',
  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
};

const ghostBtn = {
  padding: '8px 16px', borderRadius: 6, border: '1px solid rgba(17,24,39,0.15)',
  background: '#fff', fontSize: 12, fontWeight: 600, color: '#111827', cursor: 'pointer',
};

const primaryBtn = {
  padding: '8px 16px', borderRadius: 6, border: 'none',
  background: '#0B7A52', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
};
