import { useState, useCallback, useRef } from 'react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../firebase/config';

const aiChatFn = httpsCallable(functions, 'aiChat');

export function useAIChat({ portfolioItems, tiles, settings }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const historyRef = useRef([]);

  const sendMessage = useCallback(async (text) => {
    if (!text.trim() || loading) return null;

    const userMsg = { id: Date.now(), role: 'user', text: text.trim(), ts: new Date() };
    setMessages(prev => [...prev, userMsg]);
    historyRef.current.push({ role: 'user', text: text.trim() });

    setLoading(true);

    try {
      const portfolio = (portfolioItems || []).map(pi => {
        const tile = tiles?.find(t => t.id === pi.tileId) || {};
        return {
          tileId: pi.tileId,
          symbol: pi.symbol,
          strategy: pi.strategy,
          entryNetCredit: pi.entryNetCredit || 0,
          unrealizedPnl: pi.unrealizedPnl || 0,
          quantity: pi.quantity || 1,
          status: pi.status || 'active',
          daysToExpiry: tile.daysToExpiry || 0,
          legs: (pi.legs || []).map(l => ({
            type: l.type,
            action: l.action,
            strike: l.strike,
            entryPremium: l.entryPremium || 0,
            currentPremium: l.currentPremium || 0,
          })),
        };
      });

      const clientTiles = (tiles || []).filter(t => t.isActive !== false).map(t => ({
        id: t.id,
        symbol: t.symbol,
        strategy: t.strategy,
        returnOnCapital: t.returnOnCapital || 0,
        maxProfit: t.maxProfit || 0,
        maxLoss: t.maxLoss || 0,
        daysToExpiry: t.daysToExpiry || 0,
        oddsOfProfit: t.oddsOfProfit || t.probOfProfit || 0,
        technical: t.technical,
        lottery: t.lottery,
      }));

      const history = historyRef.current.slice(-10);

      const result = await aiChatFn({
        message: text.trim(),
        portfolio,
        tiles: clientTiles,
        settings: { totalCapital: settings?.totalCapital || 50000 },
        history: history.slice(0, -1),
      });

      const aiMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        text: result.data.text,
        actions: result.data.actions || [],
        ts: new Date(),
      };

      setMessages(prev => [...prev, aiMsg]);
      historyRef.current.push({ role: 'model', text: result.data.text });

      return aiMsg;
    } catch (err) {
      console.error('AI Chat error:', err);
      const errMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        text: err.code === 'functions/failed-precondition'
          ? 'AI is not configured yet. Ask your admin to set the GEMINI_API_KEY in Firebase secrets.'
          : 'Sorry, I had trouble processing that. Please try again.',
        error: true,
        ts: new Date(),
      };
      setMessages(prev => [...prev, errMsg]);
      return errMsg;
    } finally {
      setLoading(false);
    }
  }, [portfolioItems, tiles, settings, loading]);

  const clearChat = useCallback(() => {
    setMessages([]);
    historyRef.current = [];
  }, []);

  return { messages, loading, sendMessage, clearChat };
}
