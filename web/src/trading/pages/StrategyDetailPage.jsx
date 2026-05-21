import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect, useMemo } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import { usePositionState } from '../hooks/usePositionState';
import { usePortfolio } from '../hooks/usePortfolio';
import { useShortlist } from '../hooks/useShortlist';
import { useVerdict, VERDICT_CONFIG, VERDICT_STATES } from '../hooks/useVerdict';
import { usePositionLiveData } from '../hooks/usePositionLiveData';
import { usePriceContext } from '../contexts/PriceContext';
import { formatStrategy } from '../utils/formatters';
import { calculateMetrics, getUnderlyingPrice } from '../utils/optionsCalc';
import { getStrategyTheme } from '../utils/strategyThemes';
import { LivePriceLarge } from '../components/LivePrice';
import { PhaseHeader } from '../components/PhaseHeader';
import { AdjustTab } from '../components/AdjustTab';
import { useStrikeComparison } from '../hooks/useStrikeComparison';
import { useEventRisk } from '../hooks/useEventRisk';
import { useAIAdjust } from '../hooks/useAIAdjust';

// Extracted tab components
import { SetupTab } from '../components/strategy/SetupTab';
import { ThesisTab } from '../components/strategy/ThesisTab';
import { ChartTab } from '../components/strategy/ChartTab';
import { RisksTab } from '../components/strategy/RisksTab';
import { NowTab } from '../components/strategy/NowTab';
import { PositionTab } from '../components/strategy/PositionTab';
import { ManageChartTab } from '../components/strategy/ManageChartTab';
import { HistoryTab } from '../components/strategy/HistoryTab';
import { SentimentTab } from '../components/strategy/SentimentTab';
import { VitalTile, fmt, btnPrimary, btnGold, btnGhost, btnDanger, btnBack } from '../components/strategy/shared';

import '../styles/newleaf-system.css';

const COMPANY_NAMES = {
  AMZN: 'Amazon', AAPL: 'Apple', SPY: 'S&P 500 ETF', MSFT: 'Microsoft',
  NVDA: 'Nvidia', GOOGL: 'Alphabet', GOOG: 'Alphabet', META: 'Meta',
  TSLA: 'Tesla', NFLX: 'Netflix', QQQ: 'Nasdaq 100', IWM: 'Russell 2000',
  AMD: 'AMD', DIS: 'Disney', JPM: 'JPMorgan', V: 'Visa', MA: 'Mastercard',
  BA: 'Boeing', COST: 'Costco', CRM: 'Salesforce', AVGO: 'Broadcom',
  BABA: 'Alibaba', ADBE: 'Adobe', U: 'Unity', ORCL: 'Oracle', HON: 'Honeywell',
};

/**
 * /trading/strategy/:id — Dual-mode strategy detail page.
 *
 * Evaluate mode (unowned): thesis-led, [Take this trade] CTA.
 * Manage mode (owned):     verdict-led, action CTA.
 */
export function StrategyDetailPage({ tiles, onOpenChat }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const positionState = usePositionState(id);
  const { portfolioItems, isInPortfolio } = usePortfolio();
  const { addToShortlist, isShortlisted } = useShortlist();
  const { subscribe, unsubscribe, getPrice } = usePriceContext();
  const { alternatives, reasoning, loading: strikeLoading, error: strikeError, fetchComparison } = useStrikeComparison();
  const { alerts: eventAlerts, ivCrushRisk, loading: eventLoading, fetchRisk } = useEventRisk();
  const { adjustments: aiAdjustments, marketContext, urgency, loading: adjustLoading, fetchAdjust } = useAIAdjust();

  const [activeTab, setActiveTab] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [analysisLoading, setAnalysisLoading] = useState(true);

  const tile = tiles?.find(t => t.id === id);
  const mode = positionState === 'owned' ? 'manage' : 'evaluate';

  const portfolioItem = portfolioItems.find(p => p.tileId === id) || null;
  const liveData = usePositionLiveData(tile, portfolioItem);
  const verdict = useVerdict(id, tile, liveData);

  useEffect(() => { setActiveTab(mode === 'evaluate' ? 'setup' : 'now'); }, [mode]);

  useEffect(() => {
    if (tile?.symbol) { subscribe(tile.symbol); return () => unsubscribe(tile.symbol); }
  }, [tile?.symbol, subscribe, unsubscribe]);

  useEffect(() => {
    if (!id) { setAnalysisLoading(false); return; }
    const fetchAnalysis = async () => {
      try {
        const snap = await getDoc(doc(db, 'analyses', id));
        if (snap.exists()) setAnalysis(snap.data());
      } catch (err) { console.error('Error fetching analysis:', err); }
      finally { setAnalysisLoading(false); }
    };
    fetchAnalysis();
  }, [id]);

  // ─── Not found ───
  if (!tile) {
    return (
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '80px 2rem', textAlign: 'center' }}>
        <h2 style={{ fontFamily: "'Playfair Display', serif", fontSize: 28, fontWeight: 400, color: '#0B2D23', marginBottom: 12 }}>
          Strategy not found
        </h2>
        <button onClick={() => navigate('/invest/discover')} style={btnPrimary}>Back to Discover</button>
      </div>
    );
  }

  // ─── Derived data ───
  const { lottery = {}, technical = {}, greeks = {}, symbol, strategy = '', legs = [] } = tile;
  const daysToExpiry = tile.daysToExpiry ?? (tile.expiry ? Math.max(0, Math.round((new Date(tile.expiry + 'T16:00:00') - new Date()) / 86400000)) : null);
  const metrics = calculateMetrics(tile);
  const livePrice = tile.symbol ? getPrice(tile.symbol) : null;
  const spotPrice = livePrice?.price || tile.underlyingPrice || tile.currentPrice || getUnderlyingPrice(tile);
  const maxProfit = tile.maxProfit ?? lottery.maxWin ?? technical.maxProfit ?? metrics.maxProfit;
  const maxLoss = tile.maxLoss ?? lottery.ticketCost ?? technical.maxLoss ?? metrics.maxLoss;
  const probability = tile.oddsOfProfit || tile.probOfProfit || lottery.oddsOfProfit || technical.probability || 0;
  const rewardRisk = maxLoss > 0 ? maxProfit / maxLoss : (maxProfit > 0 ? Infinity : 0);
  const rrDisplay = rewardRisk === Infinity ? '\u221E' : `${rewardRisk.toFixed(2)}\u00D7`;
  const theme = getStrategyTheme(strategy);
  const publishedAt = analysis?.createdAt || tile.createdAt || tile.publishedAt;
  const saved = isShortlisted(id);

  const evalStatus = probability >= 55 && rewardRisk >= 0.3 ? 'good' : probability >= 40 ? 'marginal' : 'avoid';
  const evalStatusCfg = {
    good:     { label: 'Good setup',  color: '#0B7A52', bg: 'rgba(11,122,82,0.10)', border: 'rgba(11,122,82,0.25)' },
    marginal: { label: 'Marginal',    color: '#B7791F', bg: 'rgba(183,121,31,0.10)', border: 'rgba(183,121,31,0.25)' },
    avoid:    { label: 'Avoid',       color: '#C94F4F', bg: 'rgba(201,79,79,0.10)',  border: 'rgba(201,79,79,0.25)' },
  }[evalStatus];

  const netCredit = legs.reduce((sum, leg) => sum + (leg.action === 'sell' ? (leg.premium || 0) : -(leg.premium || 0)), 0);
  const isCredit = netCredit > 0;

  const thesisOneLiner = useMemo(() => {
    if (analysis?.strategyRationale?.whyThisStrategy) {
      const full = analysis.strategyRationale.whyThisStrategy;
      const firstSentence = full.split(/\.\s/)[0];
      return firstSentence.endsWith('.') ? firstSentence : firstSentence + '.';
    }
    const dir = strategy.toLowerCase().includes('bull') ? 'bullish' : strategy.toLowerCase().includes('bear') ? 'bearish' : 'neutral';
    return `${formatStrategy(strategy)} on ${symbol} — ${dir} thesis targeting ${probability.toFixed(0)}% probability of profit.`;
  }, [analysis, strategy, symbol, probability]);

  const formatDate = (ts) => {
    if (!ts) return null;
    const d = ts.toDate ? ts.toDate() : new Date(ts);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  // ═══════════════════════════════════════════════════════════════
  // EVALUATE MODE
  // ═══════════════════════════════════════════════════════════════
  if (mode === 'evaluate') {
    const tabs = [
      { key: 'setup', label: 'Setup' },
      { key: 'thesis', label: 'Thesis', badge: !analysisLoading && analysis?.strategyRationale },
      { key: 'chart', label: 'Chart' },
      { key: 'risks', label: 'Risks' },
      ...((tile.sentiment || analysis?._sentiment) ? [{ key: 'sentiment', label: 'Sentiment', badge: true }] : []),
    ];

    return (
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '22px 0 60px' }}>
        <PhaseHeader currentPhase="decide" title={`${symbol} ${formatStrategy(strategy)}`} subtitle={thesisOneLiner} compact />

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
          <button onClick={() => navigate('/invest/discover')} style={btnBack}>&larr; Discover</button>
          <span style={{ color: '#d1d5db' }}>/</span>
          <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#6b7280' }}>{symbol}</span>
          <span style={{ color: '#d1d5db' }}>/</span>
          <span style={{ fontSize: 13, color: '#9ca3af' }}>{formatStrategy(strategy)}</span>
        </div>

        {/* Evaluate Hero */}
        <div style={{
          background: 'linear-gradient(135deg, rgba(11,45,35,0.96), rgba(11,45,35,0.88))',
          borderRadius: 22, padding: '28px 28px 24px', color: '#fff', marginBottom: 20,
          boxShadow: '0 10px 24px rgba(17,24,39,0.08)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', background: evalStatusCfg.bg, color: evalStatusCfg.color, border: `1px solid ${evalStatusCfg.border}` }}>{evalStatusCfg.label}</span>
              <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', background: `${theme.primary}30`, color: theme.light, border: `1px solid ${theme.primary}50` }}>{formatStrategy(strategy)}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>
              <span>{daysToExpiry} DTE</span>
              {publishedAt && <span>&middot; Published {formatDate(publishedAt)}</span>}
            </div>
          </div>

          <div style={{ marginBottom: 6 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
              <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 36, fontWeight: 400 }}>{symbol}</span>
              <span style={{ fontSize: 20, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{COMPANY_NAMES[symbol] || ''}</span>
            </div>
          </div>

          <div style={{ marginBottom: 16 }}><LivePriceLarge symbol={symbol} /></div>

          <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontStyle: 'italic', color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, marginBottom: 20, maxWidth: '70ch' }}>{thesisOneLiner}</p>

          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={() => navigate(`/invest/build?add=${id}`)} style={btnGold}>Take this trade</button>
            <button onClick={() => { if (!saved) addToShortlist(tile); }} style={btnGhost}>{saved ? '\u2713 Saved' : 'Save for later'}</button>
            {onOpenChat && (
              <button onClick={() => onOpenChat(`Tell me about this ${symbol} ${formatStrategy(strategy)} trade. Is it a good setup right now?`)} style={{ ...btnGhost, display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 14 }}>&#9889;</span> Ask AI
              </button>
            )}
          </div>
        </div>

        {/* Vitals */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
          <VitalTile label="Max Profit" value={fmt(maxProfit)} positive />
          <VitalTile label="Max Loss" value={fmt(maxLoss)} negative />
          <VitalTile label="Reward:Risk" value={rrDisplay} primary />
          <VitalTile label="Probability" value={`${probability.toFixed(0)}%`} />
        </div>

        <TabBar tabs={tabs} activeTab={activeTab} onSelect={setActiveTab} />

        {activeTab === 'setup' && <SetupTab tile={tile} legs={legs} netCredit={netCredit} isCredit={isCredit} metrics={metrics} spotPrice={spotPrice} strikeComparison={{ alternatives, reasoning, loading: strikeLoading, error: strikeError }} onCompareStrikes={() => fetchComparison({ ticker: symbol, expiry: tile.expiry, currentLegs: tile.legs, spot: spotPrice, strategy: tile.strategy })} />}
        {activeTab === 'thesis' && <ThesisTab analysis={analysis} analysisLoading={analysisLoading} strategy={strategy} />}
        {activeTab === 'chart' && <ChartTab tile={tile} spotPrice={spotPrice} maxProfit={maxProfit} maxLoss={maxLoss} metrics={metrics} strategy={strategy} />}
        {activeTab === 'risks' && <RisksTab analysis={analysis} analysisLoading={analysisLoading} tile={tile} eventAlerts={eventAlerts} ivCrushRisk={ivCrushRisk} eventLoading={eventLoading} fetchRisk={fetchRisk} />}
        {activeTab === 'sentiment' && <SentimentTab sentiment={tile.sentiment || analysis?._sentiment} analysis={analysis} />}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════
  // MANAGE MODE
  // ═══════════════════════════════════════════════════════════════
  const verdictCfg = VERDICT_CONFIG[verdict.state];
  const isUrgent = verdict.state === VERDICT_STATES.EXIT || verdict.state === VERDICT_STATES.ACTION_NEEDED;

  const manageCta = {
    [VERDICT_STATES.ON_TRACK]: { label: null, secondary: 'View position' },
    [VERDICT_STATES.TAKE_PROFIT]: { label: `Close for +${fmt(Math.abs(liveData.pnlPerContract))}`, secondary: 'Let expire' },
    [VERDICT_STATES.MONITOR]: { label: 'Set alert', secondary: 'View position' },
    [VERDICT_STATES.ACTION_NEEDED]: { label: verdict.recommendedAction || 'Review adjustments', secondary: 'Hold & monitor' },
    [VERDICT_STATES.EXIT]: { label: 'Close now', secondary: 'Details' },
  }[verdict.state] || { label: null, secondary: 'View position' };

  const heroMessage = {
    [VERDICT_STATES.ON_TRACK]: `Let it work — ${liveData.profitCapturePct}% toward target.`,
    [VERDICT_STATES.TAKE_PROFIT]: `Close for +${fmt(Math.abs(liveData.pnlPerContract))} or let expire worthless.`,
    [VERDICT_STATES.MONITOR]: verdict.reason,
    [VERDICT_STATES.ACTION_NEEDED]: verdict.recommendedAction || verdict.reason,
    [VERDICT_STATES.EXIT]: 'Close now — stop triggered.',
  }[verdict.state] || verdict.reason;

  const maxLossUsedPct = maxLoss > 0 && liveData.pnlPerContract < 0
    ? Math.round((Math.abs(liveData.pnlPerContract) / maxLoss) * 100) : 0;

  const manageTabs = [
    { key: 'now', label: 'Now' },
    { key: 'position', label: 'Position' },
    { key: 'chart', label: 'Chart' },
    { key: 'adjust', label: 'Adjust' },
    { key: 'history', label: 'History' },
    ...((tile.sentiment || analysis?._sentiment) ? [{ key: 'sentiment', label: 'Sentiment', badge: true }] : []),
  ];

  return (
    <div style={{ maxWidth: 1280, margin: '0 auto', padding: '22px 0 60px' }}>
      <PhaseHeader currentPhase="defend" title={`${symbol} ${formatStrategy(strategy)}`} subtitle={verdict.reason} compact />

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <button onClick={() => navigate('/invest/positions')} style={btnBack}>&larr; Positions</button>
        <span style={{ color: '#d1d5db' }}>/</span>
        <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#6b7280' }}>{symbol}</span>
        <span style={{ color: '#d1d5db' }}>/</span>
        <span style={{ fontSize: 13, color: '#9ca3af' }}>{formatStrategy(strategy)}</span>
      </div>

      {/* Manage Hero */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(11,45,35,0.96), rgba(11,45,35,0.88))',
        borderRadius: 22, padding: '28px', color: '#fff', marginBottom: isUrgent ? 0 : 20,
        boxShadow: '0 10px 24px rgba(17,24,39,0.08)',
        borderBottomLeftRadius: isUrgent ? 0 : 22, borderBottomRightRadius: isUrgent ? 0 : 22,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 999, fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', background: verdictCfg.bg, color: verdictCfg.color, border: `1px solid ${verdictCfg.border}` }}>{verdictCfg.label}</span>
            <span style={{ padding: '4px 10px', borderRadius: 999, fontSize: 10, fontWeight: 700, letterSpacing: '.1em', textTransform: 'uppercase', background: `${theme.primary}30`, color: theme.light, border: `1px solid ${theme.primary}50` }}>{formatStrategy(strategy)}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, color: 'rgba(255,255,255,0.65)' }}>
            <span>{liveData.dte ?? daysToExpiry} DTE</span>
            {portfolioItem?.entryDate && <span>&middot; Entered {portfolioItem.entryDate}</span>}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6, flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 14 }}>
            <span style={{ fontFamily: "'Playfair Display', serif", fontSize: 36, fontWeight: 400 }}>{symbol}</span>
            <span style={{ fontSize: 20, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{COMPANY_NAMES[symbol] || ''}</span>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 28, fontWeight: 700, color: liveData.pnlPerContract >= 0 ? 'rgba(162,242,208,0.95)' : 'rgba(255,182,182,0.95)' }}>
              {liveData.pnlPerContract >= 0 ? '+' : ''}{fmt(liveData.pnlPerContract)}
            </div>
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
              per contract &middot; {liveData.quantity} qty &middot; total {liveData.pnlPerContract >= 0 ? '+' : ''}{fmt(liveData.pnlTotal)}
            </div>
          </div>
        </div>

        <div style={{ marginBottom: 16 }}><LivePriceLarge symbol={symbol} /></div>

        <p style={{ fontFamily: "'Playfair Display', serif", fontSize: 17, fontStyle: 'italic', color: 'rgba(255,255,255,0.85)', lineHeight: 1.6, marginBottom: 20, maxWidth: '70ch' }}>{heroMessage}</p>

        <div style={{ display: 'flex', gap: 10 }}>
          {manageCta.label && <button style={isUrgent ? btnDanger : btnGold}>{manageCta.label}</button>}
          {manageCta.secondary && <button onClick={() => setActiveTab('position')} style={btnGhost}>{manageCta.secondary}</button>}
          {onOpenChat && (
            <button onClick={() => onOpenChat(`Analyze my ${symbol} ${strategy} position. Current P&L, risks, and should I adjust?`)} style={{ ...btnGhost, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 14 }}>&#9889;</span> Ask AI
            </button>
          )}
        </div>
      </div>

      {/* Exit Signal Strip */}
      {isUrgent && (
        <div style={{
          background: verdict.state === VERDICT_STATES.EXIT ? 'rgba(201,79,79,0.12)' : 'rgba(234,88,12,0.10)',
          border: `1px solid ${verdict.state === VERDICT_STATES.EXIT ? 'rgba(201,79,79,0.25)' : 'rgba(234,88,12,0.20)'}`,
          borderTop: 'none', borderBottomLeftRadius: 22, borderBottomRightRadius: 22,
          padding: '12px 28px', marginBottom: 20, display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <span style={{ fontSize: 10, fontWeight: 900, letterSpacing: '.14em', textTransform: 'uppercase', color: verdict.state === VERDICT_STATES.EXIT ? '#C94F4F' : '#ea580c' }}>
            {verdict.state === VERDICT_STATES.EXIT ? 'EXIT SIGNAL' : 'ACTION NEEDED'}
          </span>
          <span style={{ fontSize: 13, color: '#374151' }}>{verdict.reason}</span>
        </div>
      )}

      {/* Vitals */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 }}>
        <VitalTile label="Current P&L" value={`${liveData.pnlPerContract >= 0 ? '+' : ''}${fmt(liveData.pnlPerContract)}`} positive={liveData.pnlPerContract >= 0} negative={liveData.pnlPerContract < 0} />
        <VitalTile label="Max Loss Used" value={maxLossUsedPct > 0 ? `${maxLossUsedPct}%` : '0%'} negative={maxLossUsedPct > 50} />
        <VitalTile label="Time Left" value={`${liveData.dte ?? daysToExpiry}d`} negative={(liveData.dte ?? daysToExpiry) <= 21} />
        <VitalTile label="Probability" value={`${probability.toFixed(0)}%`} />
      </div>

      <TabBar tabs={manageTabs} activeTab={activeTab} onSelect={setActiveTab} />

      {activeTab === 'now' && <NowTab liveData={liveData} portfolioItem={portfolioItem} tile={tile} verdict={verdict} symbol={symbol} strategy={strategy} greeks={greeks} />}
      {activeTab === 'position' && <PositionTab tile={tile} liveData={liveData} />}
      {activeTab === 'chart' && <ManageChartTab tile={tile} spotPrice={spotPrice} maxProfit={maxProfit} maxLoss={maxLoss} metrics={metrics} liveData={liveData} strategy={strategy} />}
      {activeTab === 'adjust' && <AdjustTab tile={tile} portfolioItem={portfolioItem} liveData={liveData} verdict={verdict} aiAdjustments={aiAdjustments} marketContext={marketContext} urgency={urgency} adjustLoading={adjustLoading} fetchAdjust={fetchAdjust} />}
      {activeTab === 'history' && <HistoryTab portfolioItem={portfolioItem} liveData={liveData} symbol={symbol} strategy={strategy} />}
      {activeTab === 'sentiment' && <SentimentTab sentiment={tile.sentiment || analysis?._sentiment} analysis={analysis} />}
    </div>
  );
}

// ─── Shared tab bar ─────────────────────────────────────────────────────────

function TabBar({ tabs, activeTab, onSelect }) {
  return (
    <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid rgba(17,24,39,0.10)', marginBottom: 24 }}>
      {tabs.map(tab => (
        <button
          key={tab.key}
          onClick={() => onSelect(tab.key)}
          style={{
            padding: '12px 20px', border: 'none', background: 'none', cursor: 'pointer',
            fontSize: 14, fontWeight: activeTab === tab.key ? 700 : 500,
            color: activeTab === tab.key ? '#0B2D23' : '#9ca3af',
            borderBottom: activeTab === tab.key ? '2px solid #0B2D23' : '2px solid transparent',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          {tab.label}
          {tab.badge && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#C9A96E' }} />}
        </button>
      ))}
    </div>
  );
}
