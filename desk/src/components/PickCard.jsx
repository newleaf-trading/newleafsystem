import { useState } from 'react';
import { Link } from 'react-router-dom';
import { CopyButton } from './CopyButton';

export function PickCard({ pick }) {
  const [socialTab, setSocialTab] = useState('linkedin');
  const { tile, analysis, assets, hasAnalysis, provenance, sentiment } = pick;

  const symbol = tile.symbol || '';
  const strategy = tile.strategy || '';
  const spot = tile.underlyingPrice || tile.currentPrice || tile.price || 0;
  const maxProfit = tile.maxProfit || 0;
  const maxLoss = tile.maxLoss || 0;
  const rr = tile.rewardRisk || 0;
  const pop = tile.oddsOfProfit || tile.probOfProfit || 0;
  const credit = tile.netCredit || 0;
  const dte = tile.dte || tile.daysToExpiry || 0;
  const expiry = tile.expiry || tile.expirationDate || '';

  const sentScore = sentiment?.composite?.score ?? sentiment?.score ?? null;
  const sentLabel = sentiment?.composite?.label ?? sentiment?.label ?? null;

  // Technical indicators from analysis
  const ti = analysis?.technicalIndicators;
  const rsi = ti?.rsi?.value;
  const macd = ti?.macd;

  // Social copy from analysis (if present)
  const socialCopy = analysis?.socialCopy || null;

  return (
    <div className="dk-pick-card">
      {/* Header */}
      <div className="dk-pick-card-header">
        <div>
          <span className="dk-pick-symbol">{symbol}</span>
          <span className="dk-pick-price"> ${spot.toFixed(2)}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="dk-pick-strategy">{strategy}</span>
          <span style={{ fontSize: 11, color: '#6b7280' }}>{dte} DTE</span>
        </div>
      </div>

      {/* Body */}
      <div className="dk-pick-card-body">
        {/* Metrics */}
        <div className="dk-pick-metrics">
          <div className="dk-metric">
            <div className="dk-metric-label">Max Profit</div>
            <div className="dk-metric-value green">${maxProfit.toFixed(0)}</div>
          </div>
          <div className="dk-metric">
            <div className="dk-metric-label">Max Loss</div>
            <div className="dk-metric-value red">${maxLoss.toFixed(0)}</div>
          </div>
          <div className="dk-metric">
            <div className="dk-metric-label">R:R</div>
            <div className="dk-metric-value">{rr.toFixed(2)}x</div>
          </div>
          <div className="dk-metric">
            <div className="dk-metric-label">PoP</div>
            <div className="dk-metric-value">{pop}%</div>
          </div>
        </div>

        {/* Indicators */}
        {ti && (
          <div style={{ display: 'flex', gap: 12, marginBottom: 12, fontSize: 11, color: '#6b7280' }}>
            {rsi != null && <span>RSI: <strong>{rsi}</strong></span>}
            {macd && <span>MACD: <strong>{macd.macdLine}</strong></span>}
            {sentScore != null && <span>Sent: <strong style={{ color: sentLabel === 'bullish' ? '#16a34a' : sentLabel === 'bearish' ? '#dc2626' : '#6b7280' }}>{sentLabel} {sentScore}</strong></span>}
          </div>
        )}

        {/* Asset Status */}
        <div className="dk-assets">
          <div className="dk-asset-row">
            <span className="dk-asset-name">Analysis</span>
            <span className={`dk-asset-status ${hasAnalysis ? 'ready' : 'missing'}`}>
              {hasAnalysis ? 'Ready' : 'Missing'}
            </span>
          </div>
          <div className="dk-asset-row">
            <span className="dk-asset-name">PDF Report</span>
            <div className="dk-asset-actions">
              <a href={assets.pdfUrl} target="_blank" rel="noopener" className="dk-asset-btn">View</a>
              <CopyButton text={assets.pdfUrl} label="URL" />
            </div>
          </div>
          <div className="dk-asset-row">
            <span className="dk-asset-name">Provenance</span>
            <span style={{ fontSize: 10, fontFamily: 'var(--mono)', color: '#6b7280' }}>
              {provenance.model} | {provenance.source}
            </span>
          </div>
        </div>

        {/* Links */}
        <div className="dk-links">
          <a href={assets.picksUrl} target="_blank" rel="noopener" className="dk-link">Picks Page</a>
          <a href={assets.investUrl} target="_blank" rel="noopener" className="dk-link">Invest Page</a>
          <CopyButton text={assets.picksUrl} label="Copy Picks URL" className="" />
          <CopyButton text={assets.investUrl} label="Copy Invest URL" className="" />
        </div>

        {/* View Detail */}
        <div style={{ marginTop: 14, textAlign: 'center' }}>
          <Link to={`/pick/${pick.tileId}`} className="dk-btn dk-btn-primary" style={{ textDecoration: 'none', display: 'inline-block' }}>
            Open Publishing Detail
          </Link>
        </div>
      </div>
    </div>
  );
}
