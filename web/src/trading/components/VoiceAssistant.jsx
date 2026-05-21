import { useState, useRef, useCallback } from 'react';
import { Mic, MicOff, X, Volume2 } from 'lucide-react';
import {
  getLiveGenerativeModel,
  startAudioConversation,
  ResponseModality,
} from 'firebase/ai';
import { ai } from '../../firebase/config';
import { usePortfolio } from '../hooks/usePortfolio';
import { usePortfolioSettings } from '../hooks/usePortfolioSettings';

function buildSystemPrompt(portfolioItems, tiles, settings) {
  const totalCapital = settings?.totalCapital || 50000;

  const portfolioSummary = (portfolioItems || []).map(pi => {
    const tile = tiles?.find(t => t.id === pi.tileId) || {};
    const legs = (pi.legs || []).map(l =>
      `${l.action?.toUpperCase()} ${l.type} ${l.strike} @ ${(l.entryPremium || 0).toFixed(2)}${l.currentPremium ? ` (now ${l.currentPremium.toFixed(2)})` : ''}`
    ).join(', ');
    return `• ${pi.symbol} ${pi.strategy} | Entry: $${pi.entryNetCredit || 0} | P&L: $${pi.unrealizedPnl || 0} | DTE: ${tile.daysToExpiry || '?'} | Status: ${pi.status || 'active'}${legs ? ` | Legs: ${legs}` : ''}`;
  }).join('\n') || 'No positions yet.';

  const availableTiles = (tiles || []).filter(t => t.isActive !== false).map(t =>
    `• ${t.symbol} ${t.strategy} | ROC: ${t.returnOnCapital || t.technical?.returnOnCapital || 0}% | MaxLoss: $${t.technical?.maxLoss || t.maxLoss || 0} | DTE: ${t.daysToExpiry || 0} | Prob: ${t.oddsOfProfit || t.probOfProfit || t.lottery?.oddsOfProfit || '?'}%`
  ).join('\n') || 'No strategies available.';

  return `You are NewLeaf AI, a structured options strategy assistant inside the NewLeaf System platform.
You help users manage their options portfolio — answering questions, explaining positions, and suggesting adjustments based on disciplined, rules-based frameworks.

IMPORTANT RULES:
- Keep responses SHORT and conversational — you're speaking, not writing. Max 2-3 sentences unless they ask for detail.
- Use dollar amounts and percentages when discussing P&L.
- Be calm, confident, and analytical. You're a structured strategy co-pilot.
- Never give definitive financial advice — frame suggestions as options to consider.
- If they ask to add or remove positions, tell them to use the text chat or Portfolio page since voice can't execute trades.

USER'S PORTFOLIO (Capital: $${totalCapital.toLocaleString()}):
${portfolioSummary}

AVAILABLE STRATEGIES (can be added to portfolio):
${availableTiles}

Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}.`;
}

export function VoiceAssistant({ tiles }) {
  const { portfolioItems } = usePortfolio();
  const { settings } = usePortfolioSettings();
  const [isOpen, setIsOpen] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [status, setStatus] = useState('idle'); // idle | connecting | listening | error
  const [error, setError] = useState(null);

  const controllerRef = useRef(null);

  const startConversation = useCallback(async () => {
    try {
      setIsConnecting(true);
      setStatus('connecting');
      setError(null);

      const systemPrompt = buildSystemPrompt(portfolioItems, tiles, settings);

      const model = getLiveGenerativeModel(ai, {
        model: "gemini-2.5-flash-native-audio-preview-12-2025",
        systemInstruction: { parts: [{ text: systemPrompt }] },
        generationConfig: {
          responseModalities: [ResponseModality.AUDIO],
        },
      });

      console.log('[VoiceAssistant] Connecting to Live API with portfolio context...');
      const session = await model.connect();
      console.log('[VoiceAssistant] Session connected, starting audio conversation...');

      const controller = await startAudioConversation(session);
      controllerRef.current = controller;
      console.log('[VoiceAssistant] Audio conversation started.');

      setIsActive(true);
      setIsConnecting(false);
      setStatus('listening');
    } catch (err) {
      console.error('[VoiceAssistant] Error:', err);
      console.error('[VoiceAssistant] Error name:', err?.name);
      console.error('[VoiceAssistant] Error code:', err?.code);
      console.error('[VoiceAssistant] Error details:', JSON.stringify(err, null, 2));
      setError(err.message || 'Failed to start voice assistant');
      setStatus('error');
      setIsConnecting(false);
      setIsActive(false);
    }
  }, [portfolioItems, tiles, settings]);

  const stopConversation = useCallback(async () => {
    try {
      if (controllerRef.current) {
        await controllerRef.current.stop();
        controllerRef.current = null;
      }
    } catch (err) {
      console.error('[VoiceAssistant] Error stopping:', err);
    } finally {
      setIsActive(false);
      setStatus('idle');
    }
  }, []);

  const handleClose = useCallback(async () => {
    await stopConversation();
    setIsOpen(false);
  }, [stopConversation]);

  if (!isOpen) {
    return (
      <button
        className="voice-fab"
        onClick={() => setIsOpen(true)}
        aria-label="Open voice assistant"
      >
        <Mic size={22} />
      </button>
    );
  }

  return (
    <div className="voice-overlay">
      <div className="voice-panel">
        <div className="voice-header">
          <div className="voice-title">
            <Volume2 size={18} />
            <span>NewLeaf System</span>
          </div>
          <button className="voice-close" onClick={handleClose}>
            <X size={18} />
          </button>
        </div>

        <div className="voice-body">
          <div className={`voice-orb ${status}`}>
            <div className="voice-orb-inner">
              {status === 'listening' && <Mic size={32} />}
              {status === 'connecting' && <div className="voice-spinner" />}
              {status === 'idle' && <Mic size={32} />}
              {status === 'error' && <MicOff size={32} />}
            </div>
          </div>

          <div className="voice-status">
            {status === 'idle' && 'Tap to start talking'}
            {status === 'connecting' && 'Connecting...'}
            {status === 'listening' && 'Listening — speak now'}
            {status === 'error' && (error || 'Something went wrong')}
          </div>
        </div>

        <div className="voice-actions">
          {!isActive ? (
            <button
              className="voice-start-btn"
              onClick={startConversation}
              disabled={isConnecting}
            >
              <Mic size={20} />
              {isConnecting ? 'Connecting...' : 'Start Conversation'}
            </button>
          ) : (
            <button
              className="voice-stop-btn"
              onClick={stopConversation}
            >
              <MicOff size={20} />
              End Conversation
            </button>
          )}
        </div>

        <div className="voice-hint">
          Try: "How's my portfolio?" or "Tell me about my AMZN position"
        </div>
      </div>
    </div>
  );
}
