import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAIChat } from '../hooks/useAIChat';
import { usePortfolio } from '../hooks/usePortfolio';
import { usePortfolioSettings } from '../hooks/usePortfolioSettings';

const DEFAULT_CHIPS = [
  { label: "How's my portfolio?", icon: '📊' },
  { label: 'What should I adjust?', icon: '🔧' },
  { label: 'Build portfolio with AMZN & AAPL', icon: '⚡' },
  { label: 'Show my best performers', icon: '🏆' },
];

const POSITION_CHIPS = [
  { label: 'Should I adjust this position?', icon: '🔧' },
  { label: "What's my risk here?", icon: '⚠️' },
  { label: 'Explain my P&L', icon: '📊' },
  { label: 'When should I close?', icon: '🎯' },
];

const EVALUATE_CHIPS = [
  { label: 'Is this a good entry?', icon: '🎯' },
  { label: 'What are the risks?', icon: '⚠️' },
  { label: 'Compare with alternatives', icon: '🔄' },
  { label: "Explain the strategy's edge", icon: '💡' },
];

function getChips(initialMessage) {
  if (!initialMessage) return DEFAULT_CHIPS;
  const msg = initialMessage.toLowerCase();
  if (msg.includes('analyze my') || msg.includes('review my') || msg.includes('active positions')) return POSITION_CHIPS;
  if (msg.includes('tell me about') || msg.includes('good setup')) return EVALUATE_CHIPS;
  return DEFAULT_CHIPS;
}

// Check if browser supports Speech Recognition
const SpeechRecognition = typeof window !== 'undefined'
  ? (window.SpeechRecognition || window.webkitSpeechRecognition)
  : null;

export function AIChatDrawer({ isOpen, onClose, tiles, initialMessage }) {
  const navigate = useNavigate();
  const { portfolioItems, addToPortfolio, removeFromPortfolio, isInPortfolio } = usePortfolio();
  const { settings } = usePortfolioSettings();
  const { messages, loading, sendMessage, clearChat } = useAIChat({
    portfolioItems,
    tiles,
    settings,
  });

  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [interimText, setInterimText] = useState('');
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const processedInitialRef = useRef(null);
  const recognitionRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (isOpen) setTimeout(() => inputRef.current?.focus(), 300);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && initialMessage && initialMessage !== processedInitialRef.current) {
      processedInitialRef.current = initialMessage;
      sendMessage(initialMessage);
    }
  }, [isOpen, initialMessage, sendMessage]);

  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  // Cleanup recognition on close
  useEffect(() => {
    if (!isOpen && recognitionRef.current) {
      recognitionRef.current.abort();
      recognitionRef.current = null;
      setIsListening(false);
      setInterimText('');
    }
  }, [isOpen]);

  const handleSend = useCallback((text) => {
    const msg = text || input.trim();
    if (!msg || loading) return;
    sendMessage(msg);
    setInput('');
    setInterimText('');
  }, [input, loading, sendMessage]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  const handleChip = (label) => sendMessage(label);

  // Voice input via Web Speech API
  const toggleVoice = useCallback(() => {
    if (!SpeechRecognition) return;

    if (isListening && recognitionRef.current) {
      recognitionRef.current.stop();
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
      setIsListening(true);
      setInterimText('');
    };

    recognition.onresult = (event) => {
      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      if (final) {
        setInterimText('');
        setInput('');
        // Auto-send the final transcript
        handleSend(final.trim());
      } else {
        setInterimText(interim);
      }
    };

    recognition.onerror = (event) => {
      console.error('[Voice] Error:', event.error);
      setIsListening(false);
      setInterimText('');
    };

    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [isListening, handleSend]);

  const handleAction = useCallback(async (action) => {
    switch (action.type) {
      case 'NAVIGATE':
        onClose();
        setTimeout(() => navigate(action.to), 200);
        break;
      case 'SET_MODE':
        onClose();
        setTimeout(() => navigate('/invest/portfolio'), 200);
        break;
      case 'ADD_POSITION': {
        const tile = tiles?.find(t => t.id === action.tileId)
          || tiles?.find(t => t.symbol?.toUpperCase() === action.symbol?.toUpperCase());
        if (!tile) {
          sendMessage(`I couldn't find a strategy for ${action.symbol} in available tiles. Go to Discover to see what's available.`);
          return;
        }
        if (isInPortfolio(tile.id)) {
          sendMessage(`${action.symbol} is already in your portfolio.`);
          return;
        }
        try {
          await addToPortfolio(tile);
          sendMessage(`Done! I've added ${tile.symbol} ${tile.strategy || ''} to your portfolio. Check Portfolio → Manage Mode to see it.`);
        } catch (err) {
          sendMessage(`Sorry, I couldn't add ${action.symbol}: ${err.message}`);
        }
        break;
      }
      case 'REMOVE_POSITION': {
        const item = portfolioItems.find(p =>
          p.tileId === action.tileId || p.symbol?.toUpperCase() === action.symbol?.toUpperCase()
        );
        if (!item) {
          sendMessage(`${action.symbol} isn't in your portfolio.`);
          return;
        }
        try {
          await removeFromPortfolio(item.tileId);
          sendMessage(`Removed ${action.symbol} from your portfolio.`);
        } catch (err) {
          sendMessage(`Sorry, I couldn't remove ${action.symbol}: ${err.message}`);
        }
        break;
      }
      default:
        break;
    }
  }, [navigate, onClose, tiles, portfolioItems, addToPortfolio, removeFromPortfolio, isInPortfolio, sendMessage]);

  const handleClear = () => { clearChat(); processedInitialRef.current = null; };

  const LeafIcon = ({ size = 18 }) => (
    <svg viewBox="0 0 40 40" fill="none" width={size} height={size}>
      <circle cx="20" cy="12" r="3.5" fill="#0B2D23"/>
      <path d="M6 28 C6 28 12 18 20 18 C28 18 34 28 34 28" stroke="#C9A96E" strokeWidth="3" fill="none" strokeLinecap="round"/>
    </svg>
  );

  return (
    <>
      <div className={`chat-drawer-backdrop${isOpen ? ' open' : ''}`} onClick={onClose} />
      <div className={`chat-drawer${isOpen ? ' open' : ''}`}>
        {/* Header */}
        <div className="chat-drawer-header">
          <div className="chat-drawer-title">
            <div className="chat-drawer-logo"><LeafIcon size={20} /></div>
            <div>
              <div className="chat-drawer-name">NewLeaf System</div>
              <div className="chat-drawer-sub">Strategy assistant · {SpeechRecognition ? 'Voice enabled' : 'Text only'}</div>
            </div>
          </div>
          <div className="chat-drawer-actions">
            {messages.length > 0 && (
              <button className="chat-clear-btn" onClick={handleClear} title="Clear chat">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M5 6l1 14h12l1-14"/></svg>
              </button>
            )}
            <button className="chat-close-btn" onClick={onClose}>
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="chat-drawer-messages">
          {messages.length === 0 ? (
            <div className="chat-empty">
              <div className="chat-empty-icon" style={{fontSize:'2.5rem'}}>✦</div>
              <h4>Ask me anything about your portfolio</h4>
              <p>Type or tap the mic to speak. I can analyze positions, suggest structured strategies, and review adjustments.</p>
              <div className="chat-chips">
                {getChips(initialMessage).map(chip => (
                  <button key={chip.label} className="chat-chip" onClick={() => handleChip(chip.label)}>
                    <span>{chip.icon}</span> {chip.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map(msg => (
                <div key={msg.id} className={`chat-msg ${msg.role}`}>
                  {msg.role === 'assistant' && (
                    <div className="chat-msg-avatar"><LeafIcon /></div>
                  )}
                  <div className={`chat-msg-bubble ${msg.role}${msg.error ? ' error' : ''}`}>
                    <div className="chat-msg-text">{msg.text}</div>
                    {msg.actions && msg.actions.length > 0 && (
                      <div className="chat-msg-actions">
                        {msg.actions.map((action, i) => (
                          <button key={i} className="chat-action-btn" onClick={() => handleAction(action)}>
                            {action.type === 'NAVIGATE' && `📍 Go to ${action.to.replace('/', '') || 'Home'}`}
                            {action.type === 'ADD_POSITION' && `➕ Add ${action.symbol}`}
                            {action.type === 'REMOVE_POSITION' && `❌ Remove ${action.symbol}`}
                            {action.type === 'SET_MODE' && `🔄 Switch to ${action.mode} mode`}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {loading && (
                <div className="chat-msg assistant">
                  <div className="chat-msg-avatar"><LeafIcon /></div>
                  <div className="chat-msg-bubble assistant">
                    <div className="chat-typing"><span></span><span></span><span></span></div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Listening indicator */}
        {isListening && (
          <div className="chat-listening-bar">
            <div className="chat-listening-waves">
              <span></span><span></span><span></span><span></span><span></span>
            </div>
            <span className="chat-listening-text">
              {interimText || 'Listening...'}
            </span>
          </div>
        )}

        {/* Input area */}
        <div className="chat-drawer-input">
          <div className="chat-input-wrap">
            {SpeechRecognition && (
              <button
                className={`chat-mic-btn${isListening ? ' active' : ''}`}
                onClick={toggleVoice}
                title={isListening ? 'Stop listening' : 'Speak a command'}
                disabled={loading}
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                  <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                  <line x1="12" x2="12" y1="19" y2="22"/>
                </svg>
              </button>
            )}
            <textarea
              ref={inputRef}
              className="chat-input"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={isListening ? 'Listening...' : 'Type or speak a command...'}
              rows={1}
              disabled={loading || isListening}
            />
            <button
              className={`chat-send-btn${input.trim() && !loading ? ' active' : ''}`}
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13"/>
                <polygon points="22 2 15 22 11 13 2 9 22 2"/>
              </svg>
            </button>
          </div>
          <div className="chat-input-hint">Powered by Gemini · Voice + text · Actions enabled</div>
        </div>
      </div>
    </>
  );
}
