import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useShortlist } from '../hooks/useShortlist';
import { usePortfolio } from '../hooks/usePortfolio';
import { usePortfolioSettings } from '../hooks/usePortfolioSettings';
import { useLiveEntry } from '../hooks/useLiveEntry';
import { useToast } from '../../shared/context/ToastContext';
import { formatStrategy } from '../utils/formatters';
import { calculateMetrics, getUnderlyingPrice } from '../utils/optionsCalc';
import { getStrategyTheme } from '../utils/strategyThemes';
import { computeSummaryStats, computeAllocation } from '../lib/build/allocationMath';
import { computeScenarios, computeAllocationByStrategy, computeRiskRewardBreakdown } from '../lib/build/scenarioAnalysis';
import { DEFAULT_MAX_DRAWDOWN } from '../lib/build/evConstants';
import { PhaseHeader } from '../components/PhaseHeader';
import { SummaryCards } from '../components/build/SummaryCards';
import { FundAllocationTab } from '../components/build/FundAllocationTab';
import { PortfolioMixTab } from '../components/build/PortfolioMixTab';
import { RiskSummaryTab } from '../components/build/RiskSummaryTab';
import { EntryConfirmModal } from '../components/EntryConfirmModal';
import { EmptyState } from '../../shared/components/ui/EmptyState';
import { Button } from '../../shared/components/ui/Button';
import styles from './BuildPage.module.css';
import '../styles/newleaf-system.css';

const fmt = (v) => {
  if (!v || isNaN(v)) return '$0';
  return '$' + Math.round(v).toLocaleString();
};

/**
 * /trading/build — Deploy phase. Full portfolio builder.
 *
 * Structure:
 *   Top: 5 summary cards (Expected Profit, Scenario, Max Gain, Max Risk, Risk Budget)
 *   Middle: 3 tabs (Fund Allocation, Portfolio Mix, Risk Summary)
 *   Bottom: Execute flow (shortlist → portfolio)
 */
export function BuildPage({ tiles }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { shortlistItems, loading: shortlistLoading, addToShortlist, removeFromShortlist } = useShortlist();
  const { portfolioItems, addToPortfolio, isInPortfolio, updateQuantity } = usePortfolio();
  const { settings, updateSettings, loading: settingsLoading } = usePortfolioSettings();

  const [activeTab, setActiveTab] = useState('fund-allocation');
  const [autoAllocate, setAutoAllocate] = useState(false);
  const [customAllocations, setCustomAllocations] = useState({});
  const [executing, setExecuting] = useState(false);
  const [executed, setExecuted] = useState(new Set());
  const [editingCapital, setEditingCapital] = useState(false);
  const [capitalInput, setCapitalInput] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const { loading: pricingLoading, entries: liveEntries, error: pricingError, fetchPrices } = useLiveEntry();
  const toast = useToast();

  // Handle ?add=:tileId — auto-add to shortlist when routed from "Take this trade"
  const addTileId = searchParams.get('add');
  useEffect(() => {
    if (addTileId && tiles && tiles.length > 0) {
      const tile = tiles.find(t => t.id === addTileId);
      if (tile) {
        // Add to shortlist regardless of portfolio status — user explicitly wants to build with this
        addToShortlist(tile).catch(() => {});
        // Clean URL
        window.history.replaceState({}, '', '/invest/build');
      }
    }
  }, [addTileId, tiles, addToShortlist]);

  const safeSettings = settings || { totalCapital: 0, riskTolerance: 'moderate', maxAllocation: 0.30 };
  const totalCapital = safeSettings.totalCapital || 0;
  const maxDrawdown = safeSettings.maxDrawdown || DEFAULT_MAX_DRAWDOWN;
  const riskBudget = totalCapital * maxDrawdown;

  // Resolve all strategies for the Build page:
  // 1. Shortlisted tiles (pre-entry, from "Take this trade")
  // 2. Active portfolio positions (already owned, for resizing)
  const shortlistedTiles = useMemo(() => {
    const fromShortlist = shortlistItems
      .map(item => tiles?.find(t => t.id === item.tileId))
      .filter(t => t && !executed.has(t.id));

    // Add active portfolio positions that have matching tiles
    const ownedIds = new Set(fromShortlist.map(t => t.id));
    const fromPortfolio = portfolioItems
      .filter(p => p.status === 'active' && !ownedIds.has(p.tileId))
      .map(p => tiles?.find(t => t.id === p.tileId))
      .filter(Boolean);

    return [...fromShortlist, ...fromPortfolio];
  }, [shortlistItems, portfolioItems, tiles, executed]);

  // Max loss per contract for a tile
  const getMaxLoss = useCallback((tile) => {
    const strategy = (tile.strategy || '').toLowerCase();
    const metrics = calculateMetrics(tile);
    const calculatedMaxLoss = metrics.maxLoss;
    if (strategy.includes('covered') && strategy.includes('call')) {
      const legs = tile.legs || [];
      const putLeg = legs.find(l => l.type === 'put' && l.action === 'buy');
      const currentPrice = tile.currentPrice || tile.underlyingPrice || getUnderlyingPrice(tile);
      if (putLeg && currentPrice) return Math.max((currentPrice - putLeg.strike) * 100, 0);
      const maxLoss = tile.technical?.maxLoss || tile.maxLoss || calculatedMaxLoss;
      return Math.min(maxLoss, currentPrice * 100 * 0.25);
    }
    return tile.technical?.maxLoss || tile.maxLoss || calculatedMaxLoss;
  }, []);

  // Build strategy data for computations
  const strategyData = useMemo(() => {
    return shortlistedTiles.map(tile => {
      const metrics = calculateMetrics(tile);
      const maxProfit = tile.maxProfit ?? tile.lottery?.maxWin ?? tile.technical?.maxProfit ?? metrics.maxProfit;
      const maxLoss = getMaxLoss(tile);
      const prob = tile.oddsOfProfit || tile.probOfProfit || tile.lottery?.oddsOfProfit || tile.technical?.probability || 50;

      return {
        id: tile.id,
        tileId: tile.id,
        symbol: tile.symbol,
        strategy: tile.strategy,
        tile,
        maxProfit,
        maxLoss,
        probability: prob,
        quantity: 1,
        daysToExpiry: tile.daysToExpiry,
      };
    });
  }, [shortlistedTiles, getMaxLoss]);

  // ─── Computations (all from pure functions) ───
  const stats = useMemo(() => computeSummaryStats(strategyData, totalCapital, maxDrawdown), [strategyData, totalCapital, maxDrawdown]);
  const allocation = useMemo(() => computeAllocation(strategyData, riskBudget, autoAllocate, customAllocations), [strategyData, riskBudget, autoAllocate, customAllocations]);
  const scenarios = useMemo(() => computeScenarios(strategyData), [strategyData]);
  const allocationByStrategy = useMemo(() => computeAllocationByStrategy(strategyData), [strategyData]);
  const riskReward = useMemo(() => computeRiskRewardBreakdown(strategyData), [strategyData]);

  // ─── Execute: open confirmation modal with live prices ───
  const handleExecuteClick = () => {
    if (shortlistedTiles.length === 0 || executing) return;
    setShowConfirmModal(true);
    fetchPrices(shortlistedTiles);
  };

  const handleConfirmExecute = async (livePricesMap) => {
    if (shortlistedTiles.length === 0 || executing) return;
    setExecuting(true);
    const newlyExecuted = new Set();
    try {
      for (const tile of shortlistedTiles) {
        const allocatedStrategy = allocation.strategies.find(s => s.id === tile.id);
        const qty = allocatedStrategy?.contracts || 1;
        const liveLegPrices = livePricesMap?.get(tile.id) || null;
        await addToPortfolio(tile, liveLegPrices);
        if (qty > 1) await updateQuantity(tile.id, qty);
        await removeFromShortlist(tile.id);
        newlyExecuted.add(tile.id);
      }
      setExecuted(prev => new Set([...prev, ...newlyExecuted]));
      setShowConfirmModal(false);
      toast.success(`${newlyExecuted.size} position${newlyExecuted.size !== 1 ? 's' : ''} entered successfully`);
      setTimeout(() => navigate('/invest/positions'), 500);
    } catch (err) {
      console.error('Execute failed:', err);
      toast.error('Failed to execute. Try again.');
    } finally {
      setExecuting(false);
    }
  };

  const handleQuantityChange = (id, newQty) => {
    setCustomAllocations(prev => ({
      ...prev,
      [id]: newQty * (strategyData.find(s => s.id === id)?.maxLoss || 0),
    }));
  };

  const loading = shortlistLoading || settingsLoading;

  const tabs = [
    { key: 'fund-allocation', label: 'Fund Allocation' },
    { key: 'portfolio-mix', label: 'Portfolio Mix' },
    { key: 'risk-summary', label: 'Risk Summary' },
  ];

  return (
    <div className={styles.page}>
      {/* Phase header */}
      <PhaseHeader
        currentPhase="build"
        title="Build Portfolio"
        subtitle="Allocate risk budgets, size strategies, and keep compounding cycles consistent."
        activeCount={shortlistedTiles.length || null}
      />

      {/* ─── No capital set ─── */}
      {totalCapital <= 0 ? (
        <div className={styles.capitalPrompt}>
          <div>
            <div className={styles.capitalTitle}>Set your total capital to start sizing strategies</div>
            <div className={styles.capitalSub}>This tells the system how to calculate your risk budget and allocation percentages.</div>
          </div>
          {editingCapital ? (
            <div className={styles.capitalInputRow}>
              <span className={styles.capitalSign}>$</span>
              <input autoFocus type="text" value={capitalInput}
                onChange={(e) => setCapitalInput(e.target.value.replace(/[^0-9,]/g, ''))}
                placeholder="50,000"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const num = parseInt(capitalInput.replace(/,/g, ''), 10);
                    if (num && num >= 1000) updateSettings({ totalCapital: num, riskTolerance: 'moderate', maxAllocation: 0.30, maxDrawdown: DEFAULT_MAX_DRAWDOWN });
                    setEditingCapital(false);
                  }
                  if (e.key === 'Escape') setEditingCapital(false);
                }}
                className={styles.capitalInput}
              />
              <Button variant="primary" size="sm" onClick={() => {
                const num = parseInt(capitalInput.replace(/,/g, ''), 10);
                if (num && num >= 1000) updateSettings({ totalCapital: num, riskTolerance: 'moderate', maxAllocation: 0.30, maxDrawdown: DEFAULT_MAX_DRAWDOWN });
                setEditingCapital(false);
              }}>Save</Button>
            </div>
          ) : (
            <Button variant="gold" onClick={() => setEditingCapital(true)}>Set capital</Button>
          )}
        </div>
      ) : (
        <>
          {/* ─── Summary Cards ─── */}
          <SummaryCards stats={stats} totalCapital={totalCapital} riskBudget={riskBudget} />

          {/* ─── Tabs ─── */}
          <div className={styles.tabBar}>
            {tabs.map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : styles.tabInactive}`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* ─── Tab Content ─── */}
          {activeTab === 'fund-allocation' && (
            <FundAllocationTab
              allocation={allocation}
              riskBudget={riskBudget}
              totalCapital={totalCapital}
              maxDrawdown={maxDrawdown}
              autoAllocate={autoAllocate}
              onAutoAllocateToggle={() => setAutoAllocate(p => !p)}
              onQuantityChange={handleQuantityChange}
              onCapitalChange={(newCapital) => updateSettings({ ...safeSettings, totalCapital: Math.max(1000, newCapital) })}
              onDrawdownChange={(newDrawdown) => updateSettings({ ...safeSettings, maxDrawdown: newDrawdown })}
              onApply={() => {
                // Apply allocation quantities to portfolio
                allocation.strategies.forEach(s => {
                  if (isInPortfolio(s.id || s.tileId)) {
                    updateQuantity(s.id || s.tileId, s.contracts);
                  }
                });
              }}
            />
          )}
          {activeTab === 'portfolio-mix' && (
            <PortfolioMixTab
              allocationByStrategy={allocationByStrategy}
              totalRisk={stats.totalMaxRisk}
            />
          )}
          {activeTab === 'risk-summary' && (
            <RiskSummaryTab
              stats={stats}
              scenarios={scenarios}
              riskReward={riskReward}
              totalCapital={totalCapital}
            />
          )}
        </>
      )}

      {/* ─── Empty state ─── */}
      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--nl-text-dim)' }}>Loading...</div>
      ) : shortlistedTiles.length === 0 && totalCapital > 0 ? (
        <EmptyState
          icon="&#127793;"
          title="No strategies queued"
          message="Browse Discover to find strategies, then tap &ldquo;Take this trade&rdquo; to add them here for sizing and execution."
          actionLabel="Go to Discover"
          onAction={() => navigate('/invest/discover')}
        />
      ) : null}

      {/* ─── Execute CTA (always visible when strategies exist) ─── */}
      {shortlistedTiles.length > 0 && (
        <div className={styles.executeBar}>
          <Button variant="secondary" onClick={() => navigate('/invest/discover')}>Add more strategies</Button>
          <Button variant="primary" onClick={handleExecuteClick} loading={executing} disabled={shortlistedTiles.length === 0}>
            {executing ? 'Executing...' : `Execute ${shortlistedTiles.length} Position${shortlistedTiles.length !== 1 ? 's' : ''}`}
          </Button>
        </div>
      )}

      {/* ─── Entry Confirmation Modal ─── */}
      {showConfirmModal && (
        <EntryConfirmModal
          tiles={shortlistedTiles}
          entries={liveEntries}
          loading={pricingLoading}
          error={pricingError}
          allocation={allocation}
          onConfirm={handleConfirmExecute}
          onCancel={() => setShowConfirmModal(false)}
          executing={executing}
        />
      )}
    </div>
  );
}
