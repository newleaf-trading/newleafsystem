import { useState, useRef, useEffect } from 'react';

const API_URL = 'https://us-central1-newleaf-trading.cloudfunctions.net/api';
const API_KEY = import.meta.env.VITE_NL_API_KEY;

const CHIPS_BY_STRATEGY = {
  default: [
    'When should I enter this strategy?',
    'What IV rank is ideal?',
    'How do I adjust if tested?',
    'What are the main risks?',
  ],
  iron_condor: [
    'When should I enter an iron condor?',
    'How wide should I set the wings?',
    'What if a wing gets tested?',
    'Best IV rank for iron condors?',
  ],
  bull_put_spread: [
    'When is a bull put spread best?',
    'How do I pick the short strike?',
    'What if the stock drops below my short put?',
    'Roll down or close — which is better?',
  ],
};

export function StrategyTutorPanel({ strategy, strategyLabel, sliderValues, isOpen, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages]);

  const chips = CHIPS_BY_STRATEGY[strategy] || CHIPS_BY_STRATEGY.default;

  async function sendMessage(text) {
    if (!text.trim() || loading) return;
    const userMsg = { role: 'user', text: text.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
        body: JSON.stringify({
          message: text.trim(),
          context: {
            mode: 'strategy_tutor',
            strategy,
            strategyLabel,
            sliderValues: sliderValues || {},
          },
          modelMode: 'budget-qwq',
        }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, { role: 'assistant', text: data.response || data.text || 'No response.' }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', text: 'AI tutor unavailable. Try again later.' }]);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div style={{
      position: 'fixed', right: 0, top: 0, bottom: 0, width: 380,
      background: '#fff', borderLeft: '1px solid rgba(11,45,35,.12)',
      boxShadow: '-4px 0 24px rgba(0,0,0,.08)', zIndex: 1000,
      display: 'flex', flexDirection: 'column',
      fontFamily: "'Inter', sans-serif",
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px', borderBottom: '1px solid rgba(11,45,35,.08)',
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        background: '#0B2D23', color: '#C9A96E',
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '.02em' }}>
            AI Strategy Tutor
          </div>
          <div style={{ fontSize: 11, color: 'rgba(201,169,110,.6)', marginTop: 2, fontFamily: "'Space Mono', monospace" }}>
            {strategyLabel || strategy} &middot; NewLeaf-Plus
          </div>
        </div>
        <button
          onClick={onClose}
          style={{ background: 'none', border: 'none', color: '#C9A96E', fontSize: 20, cursor: 'pointer', padding: '4px 8px' }}
        >
          &times;
        </button>
      </div>

      {/* Messages */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
        {messages.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '24px 0' }}>
            <div style={{ fontSize: 28, marginBottom: 8 }}>&#129302;</div>
            <p style={{ fontSize: 13, color: '#6b6b60', lineHeight: 1.6, marginBottom: 16 }}>
              Ask me anything about {strategyLabel || strategy}. I can explain mechanics, entry timing, adjustments, and risks.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {chips.map(chip => (
                <button
                  key={chip}
                  onClick={() => sendMessage(chip)}
                  style={{
                    padding: '8px 14px', border: '1px solid rgba(11,45,35,.12)',
                    borderRadius: 8, background: '#F7F5F0', color: '#0B0F14',
                    fontSize: 12, cursor: 'pointer', textAlign: 'left',
                    fontFamily: "'Inter', sans-serif", transition: 'all .15s',
                  }}
                  onMouseOver={e => e.target.style.borderColor = '#0d6e56'}
                  onMouseOut={e => e.target.style.borderColor = 'rgba(11,45,35,.12)'}
                >
                  {chip}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={i} style={{
              marginBottom: 12,
              display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
            }}>
              <div style={{
                maxWidth: '85%', padding: '10px 14px', borderRadius: 12,
                fontSize: 13, lineHeight: 1.6,
                background: msg.role === 'user' ? '#0B2D23' : '#F7F5F0',
                color: msg.role === 'user' ? '#fff' : '#0B0F14',
                borderBottomRightRadius: msg.role === 'user' ? 4 : 12,
                borderBottomLeftRadius: msg.role === 'user' ? 12 : 4,
              }}>
                {msg.text}
              </div>
            </div>
          ))
        )}
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: 12 }}>
            <div style={{
              padding: '10px 14px', borderRadius: 12, background: '#F7F5F0',
              fontSize: 13, color: '#6b6b60', borderBottomLeftRadius: 4,
            }}>
              Thinking...
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div style={{
        padding: '12px 16px', borderTop: '1px solid rgba(11,45,35,.08)',
        display: 'flex', gap: 8,
      }}>
        <input
          ref={inputRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') sendMessage(input); }}
          placeholder="Ask about this strategy..."
          style={{
            flex: 1, padding: '10px 12px', border: '1px solid rgba(11,45,35,.15)',
            borderRadius: 8, fontSize: 13, outline: 'none', fontFamily: "'Inter', sans-serif",
          }}
        />
        <button
          onClick={() => sendMessage(input)}
          disabled={loading || !input.trim()}
          style={{
            padding: '10px 16px', background: '#0d6e56', color: '#fff',
            border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.5 : 1,
          }}
        >
          Send
        </button>
      </div>
    </div>
  );
}
