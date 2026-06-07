import { useState } from 'react';

const overlayStyle = {
  position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
  background: 'rgba(11,15,20,.45)', zIndex: 1000,
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  backdropFilter: 'blur(2px)',
};

const modalStyle = {
  background: '#fff', borderRadius: 14, width: 440, maxWidth: '92vw',
  padding: '28px 32px', boxShadow: '0 20px 60px rgba(0,0,0,.2)',
};

const fmt = (v) => '$' + Math.round(v).toLocaleString();

export function AddFundsModal({ currentCapital, onSave, onClose, mode = 'add' }) {
  const [amount, setAmount] = useState('');
  const [action, setAction] = useState(mode); // 'add' | 'withdraw' | 'set'

  const parsed = parseFloat(amount.replace(/[^0-9.]/g, '')) || 0;
  const newTotal = action === 'set' ? parsed
    : action === 'add' ? currentCapital + parsed
    : Math.max(0, currentCapital - parsed);

  const handleSave = () => {
    if (parsed <= 0 && action !== 'set') return;
    onSave(newTotal);
    onClose();
  };

  return (
    <div style={overlayStyle} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={modalStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontFamily: "'Playfair Display', serif", fontSize: 20, fontWeight: 600, color: '#0F3D2E', margin: 0 }}>
            {action === 'withdraw' ? 'Withdraw Funds' : action === 'set' ? 'Set Capital' : 'Add Funds'}
          </h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', fontSize: 22, color: '#999', cursor: 'pointer' }}>&times;</button>
        </div>

        <div style={{ fontSize: 13, color: '#6B7A72', marginBottom: 16, lineHeight: 1.5 }}>
          Current capital: <strong style={{ color: '#0F3D2E', fontFamily: "'Space Mono', monospace" }}>{fmt(currentCapital)}</strong>
          <br />This updates your tracking number only — no real money is moved.
        </div>

        {/* Action toggle */}
        <div style={{ display: 'flex', gap: 0, background: '#EDE8DC', borderRadius: 8, padding: 2, marginBottom: 16 }}>
          {['add', 'withdraw', 'set'].map(a => (
            <button
              key={a}
              onClick={() => setAction(a)}
              style={{
                flex: 1, padding: '8px 0', border: 'none', borderRadius: 6, cursor: 'pointer',
                fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 600, letterSpacing: '.5px',
                background: action === a ? '#0F3D2E' : 'transparent',
                color: action === a ? '#F7F4EE' : '#6B7A72',
                transition: '.15s',
              }}
            >
              {a === 'add' ? 'Add' : a === 'withdraw' ? 'Withdraw' : 'Set Total'}
            </button>
          ))}
        </div>

        {/* Amount input */}
        <div style={{ position: 'relative', marginBottom: 16 }}>
          <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontFamily: "'Space Mono', monospace", fontSize: 16, color: '#999' }}>$</span>
          <input
            type="text"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder={action === 'set' ? 'New total capital' : 'Amount'}
            autoFocus
            style={{
              width: '100%', padding: '14px 14px 14px 30px', fontSize: 18, fontFamily: "'Space Mono', monospace",
              border: '1px solid #E4DED2', borderRadius: 10, background: '#FDFCFA', outline: 'none',
              boxSizing: 'border-box',
            }}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
          />
        </div>

        {/* Preview */}
        {parsed > 0 && (
          <div style={{ background: '#F7F4EE', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontFamily: "'Space Mono', monospace", fontSize: 13 }}>
            New capital: <strong style={{ color: '#0F3D2E', fontSize: 16 }}>{fmt(newTotal)}</strong>
            {action !== 'set' && <span style={{ color: '#6B7A72', marginLeft: 8 }}>({action === 'add' ? '+' : '-'}{fmt(parsed)})</span>}
          </div>
        )}

        {/* Save */}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{ padding: '10px 20px', border: '1px solid #E4DED2', borderRadius: 8, background: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={parsed <= 0 && action !== 'set'}
            style={{
              padding: '10px 24px', border: 'none', borderRadius: 8, cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
              background: parsed > 0 || action === 'set' ? '#0F3D2E' : '#ccc',
              color: '#F7F4EE',
            }}
          >
            {action === 'set' ? 'Set Capital' : action === 'add' ? 'Add Funds' : 'Withdraw'}
          </button>
        </div>
      </div>
    </div>
  );
}
