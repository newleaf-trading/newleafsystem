import { useState, useCallback, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Hammer } from 'lucide-react';
import { fetchGammaWall, fetchTechnicalAnalysis } from '../api/analysisApi';
import BuildTradeModal from '../components/analysis/BuildTradeModal';

import TabSwitcher from '../components/analysis/TabSwitcher';
import ControlBar from '../components/analysis/ControlBar';
import SummaryCards from '../components/analysis/SummaryCards';
import PriceChart from '../components/analysis/PriceChart';
import GammaChart from '../components/analysis/GammaChart';
import GammaInsight from '../components/analysis/GammaInsight';
import StrikeHeatmap from '../components/analysis/StrikeHeatmap';
import RangePlaceholder from '../components/analysis/RangePlaceholder';
import MetaPanel from '../components/analysis/MetaPanel';
import TradeDecisionHero from '../components/analysis/TradeDecisionHero';
import DeepDiveTabs from '../components/analysis/DeepDiveTabs';
import TechnicalSummaryCards from '../components/analysis/TechnicalSummaryCards';
import TechnicalChart from '../components/analysis/TechnicalChart';
import TrendEngineCard from '../components/analysis/TrendEngineCard';
import VolatilityEngineCard from '../components/analysis/VolatilityEngineCard';
import LevelEngineCard from '../components/analysis/LevelEngineCard';
import TechnicalRecommendation from '../components/analysis/TechnicalRecommendation';

export function AnalysisPage() {
  const { ticker: urlTicker } = useParams();
  const navigate = useNavigate();
  const defaultTicker = urlTicker || 'SPY';

  const [activeTab, setActiveTab] = useState('gamma');
  const [gammaData, setGammaData] = useState(null);
  const [technicalData, setTechnicalData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [dataSource, setDataSource] = useState(null);
  const [dataDelay, setDataDelay] = useState(null);
  const [optionChain, setOptionChain] = useState(null);
  const [showBuildModal, setShowBuildModal] = useState(false);

  const [params, setParams] = useState({
    ticker: defaultTicker,
    spot: 0,
    dteMin: 20,
    dteMax: 60,
  });

  const handleFetch = useCallback(async (newParams) => {
    setParams(newParams);
    setLoading(true);
    setError(null);

    try {
      // Fetch gamma wall analysis
      const gammaResponse = await fetchGammaWall(newParams.ticker, newParams.dteMin, newParams.dteMax);

      // Set data source and delay info
      setDataSource(gammaResponse.dataSource);
      setDataDelay(gammaResponse.dataDelay);

      // Unwrap the analysis envelope
      const analysisData = {
        spot: gammaResponse.spot,
        ticker: gammaResponse.ticker,
        ...gammaResponse.analysis,
        condorGate: gammaResponse.condorGate,
        earnings: gammaResponse.earnings,
        meta: {
          generated_at: gammaResponse.timestamp,
        },
      };

      setGammaData(analysisData);
      setOptionChain(gammaResponse.optionChain || []);

      // Update spot price in params
      setParams(prev => ({ ...prev, spot: gammaResponse.spot }));

    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message || 'Failed to fetch analysis';
      setError(errorMsg);
      console.error('[AnalysisPage] Gamma wall fetch error:', errorMsg);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch technical analysis (separate from gamma wall)
  const fetchTechnical = useCallback(async (ticker, spot) => {
    try {
      const response = await fetchTechnicalAnalysis(ticker);
      setTechnicalData(response);
    } catch (err) {
      console.error('[AnalysisPage] Technical fetch error:', err.message);
      // Don't set error - just leave technicalData as null
      setTechnicalData({ error: err.message });
    }
  }, []);

  // Auto-fetch on mount and ticker change
  useEffect(() => {
    const ticker = params.ticker || defaultTicker;

    // Fetch gamma wall (which will give us spot price)
    handleFetch({ ticker, dteMin: 20, dteMax: 60, spot: 0 });
  }, [defaultTicker, handleFetch, params.ticker]);

  // Fetch technical when we have spot price
  useEffect(() => {
    if (params.spot > 0 && params.ticker) {
      fetchTechnical(params.ticker, params.spot);
    }
  }, [params.spot, params.ticker, fetchTechnical]);

  // Derive band state from gamma data
  const bandState = (() => {
    const pct = gammaData?.position_in_band_pct ?? 50;
    if (pct >= 85) return { label: 'Near Call Wall', color: 'danger' };
    if (pct >= 65) return { label: 'Above Center', color: 'warn' };
    if (pct >= 40) return { label: 'Sweet Spot', color: 'success' };
    if (pct >= 15) return { label: 'Below Center', color: 'warn' };
    return { label: 'Near Put Wall', color: 'danger' };
  })();

  // Helper to get regime colors
  const getRegimeColor = (state) => {
    if (!state) return 'var(--nl-info)';
    if (state.includes('Strong Bullish')) return 'var(--nl-success)';
    if (state.includes('Bullish')) return 'var(--nl-success)';
    if (state.includes('Strong Bearish')) return 'var(--nl-danger)';
    if (state.includes('Bearish')) return 'var(--nl-danger)';
    return 'var(--nl-info)';
  };

  return (
    <div className="nl-page">
      {/* ── Header ── */}
      <div className="nl-page-header">
        <div>
          <h1 className="nl-page-title">
            {activeTab === 'gamma'
              ? 'Gamma Wall Analysis'
              : activeTab === 'technical'
              ? 'Technical Analysis'
              : 'Strategy Planner'}
          </h1>
          <p className="nl-page-subtitle">
            {activeTab === 'gamma'
              ? 'Real-time options analytics with gamma exposure mapping and iron condor validation.'
              : activeTab === 'technical'
              ? 'SMA crossover, Bollinger Bands, and support/resistance analysis.'
              : 'Iron condor decision engine with suggested strikes.'
            }
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => setShowBuildModal(true)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              backgroundColor: '#0B2D23',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
            onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#0a2a20'}
            onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#0B2D23'}
          >
            <Hammer size={14} />
            Build Trade
          </button>
          <div style={{ fontSize: '12px', color: 'var(--nl-muted-text)', fontWeight: '600' }}>
            {loading
              ? 'Fetching data...'
              : gammaData?.meta?.generated_at
              ? `Updated ${new Date(gammaData.meta.generated_at).toLocaleTimeString()}`
              : 'Ready'}
          </div>
        </div>
      </div>

      {/* Build Trade Modal */}
      <BuildTradeModal
        isOpen={showBuildModal}
        onClose={() => setShowBuildModal(false)}
        defaultSymbol={params.ticker}
        defaultDirection={gammaData?.condorGate?.approved ? 'neutral' : 'neutral'}
        defaultDteMin={params.dteMin}
        defaultDteMax={params.dteMax}
      />

      {/* ── Data Source Banner ── */}
      {dataSource === 'massive' && dataDelay === 'end-of-day' && !loading && (
        <div style={{
          background: 'rgba(251, 191, 36, 0.1)',
          border: '1px solid rgba(251, 191, 36, 0.3)',
          borderRadius: 'var(--nl-radius-lg)',
          padding: '14px 20px',
          marginBottom: '20px',
          color: '#b45309',
          fontSize: '14px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px'
        }}>
          <span style={{ fontSize: '20px' }}>⚠️</span>
          <div>
            <strong>Delayed Data</strong> — Gamma Wall using end-of-day data from Massive API.
            IB Gateway is unavailable for real-time data.
          </div>
        </div>
      )}

      {/* ── Tab Switcher ── */}
      <TabSwitcher activeTab={activeTab} onTabChange={setActiveTab} />

      {/* ── Main Content ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        {activeTab === 'gamma' && (
          <>
            {/* 1. Input bar with state badge */}
            <ControlBar params={params} onFetch={handleFetch} loading={loading} bandState={gammaData ? bandState : null} />

            {/* Error banner */}
            {error && (
              <div style={{
                background: 'var(--nl-danger-light)',
                border: '1px solid var(--nl-danger-border)',
                borderRadius: 'var(--nl-radius-lg)',
                padding: '14px 20px',
                color: 'var(--nl-danger)',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <span style={{ fontSize: '20px' }}>⚠️</span>
                <div><strong>Error:</strong> {error}</div>
              </div>
            )}

            {/* 2. Main two-column: Price Chart (60%) + Trade Decision Hero (40%) */}
            {gammaData && (
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '20px', alignItems: 'start' }}>
                <PriceChart data={gammaData} technicalData={technicalData} />
                <TradeDecisionHero data={gammaData} />
              </div>
            )}

            {/* 4. Stat strip — 5 cards */}
            {gammaData && <SummaryCards data={gammaData} />}

            {/* 5. Second two-column: GEX chart (60%) + Gamma Insights (40%) */}
            {gammaData && (
              <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr', gap: '20px', alignItems: 'start' }}>
                <GammaChart data={gammaData} optionChain={optionChain} />
                <GammaInsight data={gammaData} />
              </div>
            )}

            {/* 6. Deep-dive tabs: Volume / Price Range / Meta */}
            {gammaData && (
              <DeepDiveTabs>
                <StrikeHeatmap data={gammaData} optionChain={optionChain} />
                <RangePlaceholder />
                <MetaPanel data={gammaData} />
              </DeepDiveTabs>
            )}
          </>
        )}

        {activeTab === 'technical' && (
          <>
            {technicalData && !technicalData.error ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Technical Summary Cards */}
                <TechnicalSummaryCards data={technicalData} />

                {/* Regime Summary Strip */}
                <div
                  className="nl-card"
                  style={{
                    padding: '16px 24px',
                    background: 'linear-gradient(135deg, rgba(247,248,250,0.8), rgba(255,255,255,1))',
                    border: '1px solid var(--nl-border)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
                    <div style={{ fontSize: '11px', color: 'var(--nl-muted-text)', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                      Market Regime:
                    </div>

                    {/* Trend */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--nl-muted-text)', fontWeight: '600' }}>Trend</span>
                      <div
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          background: 'var(--nl-surface)',
                          border: `1.5px solid ${getRegimeColor(technicalData.trendEngine?.state)}`,
                          fontSize: '12px',
                          fontWeight: '700',
                          color: getRegimeColor(technicalData.trendEngine?.state),
                        }}
                      >
                        {technicalData.trendEngine?.state?.split(' ')[0] || 'Neutral'}
                      </div>
                    </div>

                    {/* Volatility */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '10px', color: 'var(--nl-muted-text)', fontWeight: '600' }}>Volatility</span>
                      <div
                        style={{
                          padding: '4px 10px',
                          borderRadius: '6px',
                          background: 'var(--nl-surface)',
                          border: `1.5px solid ${technicalData.volatilityEngine?.squeeze ? '#f97316' : 'var(--nl-info)'}`,
                          fontSize: '12px',
                          fontWeight: '700',
                          color: technicalData.volatilityEngine?.squeeze ? '#f97316' : 'var(--nl-info)',
                        }}
                      >
                        {technicalData.volatilityEngine?.squeeze ? 'Squeeze' : technicalData.volatilityEngine?.state?.split(' ')[0] || 'Normal'}
                      </div>
                    </div>

                    {/* Best Fit Strategy */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
                      <span style={{ fontSize: '10px', color: 'var(--nl-muted-text)', fontWeight: '600' }}>Best Fit</span>
                      <div
                        style={{
                          padding: '6px 12px',
                          borderRadius: '8px',
                          background: technicalData.recommendation?.strategy === 'Wait' ? 'rgba(251, 191, 36, 0.1)' : 'rgba(59, 130, 246, 0.1)',
                          border: `2px solid ${technicalData.recommendation?.strategy === 'Wait' ? 'var(--nl-warn)' : 'var(--nl-info)'}`,
                          fontSize: '13px',
                          fontWeight: '800',
                          color: technicalData.recommendation?.strategy === 'Wait' ? 'var(--nl-warn)' : 'var(--nl-info)',
                        }}
                      >
                        {technicalData.recommendation?.strategy || 'Wait'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Technical Chart */}
                <TechnicalChart data={technicalData} />

                {/* Engine Cards + Recommendation */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
                  <TrendEngineCard data={technicalData} />
                  <VolatilityEngineCard data={technicalData} />
                  <LevelEngineCard data={technicalData} />
                  <TechnicalRecommendation
                    recommendation={technicalData.recommendation}
                    techScore={technicalData.techScore}
                    techState={technicalData.techState}
                  />
                </div>
              </div>
            ) : technicalData?.error ? (
              <div className="nl-card" style={{ padding: '40px 20px', textAlign: 'center', margin: '20px 0' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
                <div style={{ fontSize: '18px', fontWeight: '700', color: 'var(--nl-danger)', marginBottom: '12px' }}>
                  Error Loading Technical Analysis
                </div>
                <div style={{ fontSize: '14px', color: 'var(--nl-muted-text)', marginBottom: '20px', maxWidth: '500px', margin: '0 auto 20px' }}>
                  {technicalData.error}
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--nl-muted-text)' }}>
                <div style={{ fontSize: '16px', fontWeight: '600' }}>Loading technical analysis...</div>
              </div>
            )}
          </>
        )}

        {activeTab === 'strategy' && (
          <>
            {gammaData && gammaData.condorGate ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {/* Strategy planner showing condor gate result */}
                <CondorPlanner data={{ ...gammaData, ...gammaData.condorGate }} />

                {/* Band position for context */}
                <BandPosition data={gammaData} />

                {/* Market state */}
                <MarketStatePanel data={gammaData} />
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--nl-muted-text)' }}>
                <div style={{ fontSize: '16px', fontWeight: '600' }}>Strategy planner not available</div>
                <div style={{ fontSize: '14px', marginTop: '8px' }}>Fetch gamma wall data first</div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
