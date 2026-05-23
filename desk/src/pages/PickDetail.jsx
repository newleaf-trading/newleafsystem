import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { CopyButton } from '../components/CopyButton';
import { ChannelStatus } from '../components/ChannelStatus';
import { buildHeyGenScript, buildPdfData } from '../utils/buildExports';

const R2_BASE = 'https://pub-04bbb919022645b3a3f318b2ebdf48c0.r2.dev';

export function PickDetail() {
  const { tileId } = useParams();
  const [tile, setTile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [publication, setPublication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [socialTab, setSocialTab] = useState('linkedin');
  const [jsonTab, setJsonTab] = useState(null);
  const [toast, setToast] = useState(null);

  const loadData = useCallback(async () => {
    const [tileSnap, analysisSnap, pubSnap] = await Promise.all([
      getDoc(doc(db, 'tiles', tileId)),
      getDoc(doc(db, 'analyses', tileId)),
      getDoc(doc(db, 'publications', tileId)),
    ]);
    if (tileSnap.exists()) setTile({ id: tileSnap.id, ...tileSnap.data() });
    if (analysisSnap.exists()) setAnalysis(analysisSnap.data());
    if (pubSnap.exists()) setPublication(pubSnap.data());
    setLoading(false);
  }, [tileId]);

  useEffect(() => { loadData(); }, [loadData]);

  const showToast = (msg) => { setToast(msg); setTimeout(() => setToast(null), 2500); };

  const updateChannel = async (channel, status, url = null) => {
    const ref = doc(db, 'publications', tileId);
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : { channels: {} };
    if (!data.channels) data.channels = {};
    data.channels[channel] = { status, url, updatedAt: new Date().toISOString() };
    await setDoc(ref, data, { merge: true });
    setPublication({ ...publication, channels: { ...(publication?.channels || {}), [channel]: data.channels[channel] } });
    showToast(`${channel} marked as ${status}`);
  };

  const downloadJson = (data, filename) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="dk-loading">Loading pick detail...</div>;
  if (!tile) return <div style={{ textAlign: 'center', padding: 60, color: '#9ca3af' }}>Tile not found: {tileId}</div>;

  const symbol = tile.symbol || '';
  const strategy = (tile.strategy || '').replace(/\s+/g, '-');
  const spot = tile.underlyingPrice || tile.currentPrice || tile.price || 0;
  const legs = tile.legs || [];
  const sentiment = tile.sentiment || analysis?._sentiment || null;
  const ti = analysis?.technicalIndicators;
  const rationale = analysis?.strategyRationale;
  const risk = analysis?.riskAnalysis;

  const pick = { tileId, tile, analysis, channels: publication?.channels || {} };
  const pdfUrl = `${R2_BASE}/reports/pdf/${symbol}/${symbol}-${strategy}-latest.pdf`;

  const channels = publication?.channels || {
    picks: { status: 'complete' }, invest: { status: 'complete' },
    pdf: { status: 'tbd' }, youtube: { status: 'tbd' },
    linkedin: { status: 'tbd' }, twitter: { status: 'tbd' },
    instagram: { status: 'tbd' }, email: { status: 'tbd' },
  };

  // Social copy
  const socialData = {
    linkedin: rationale
      ? `${symbol} ${tile.strategy} — ${rationale.whyThisStrategy}\n\nSetup: ${legs.map(l => `${l.action} ${l.type} $${l.strike}`).join(' / ')}\nCredit: $${(tile.netCredit || 0).toFixed(2)} | Max Profit: $${(tile.maxProfit || 0).toFixed(0)} | PoP: ${tile.oddsOfProfit || 0}%\n\nFull analysis: https://newleafsystem.com/picks/analysis/${symbol.toLowerCase()}`
      : null,
    twitter: [
      `$${symbol} ${tile.strategy} setup:\nCredit: $${(tile.netCredit || 0).toFixed(2)}/share\nPoP: ${tile.oddsOfProfit || 0}%\nR:R: ${(tile.rewardRisk || 0).toFixed(2)}x`,
      rationale ? `Why $${symbol}? ${rationale.whyThisStrategy?.slice(0, 200)}` : null,
      `Full analysis at newleafsystem.com/picks #options #trading #${symbol}`,
    ].filter(Boolean),
    instagram: rationale
      ? `${symbol} ${tile.strategy}\n\n${rationale.whyThisStrategy}\n\nMax Profit: $${(tile.maxProfit || 0).toFixed(0)}\nMax Loss: $${(tile.maxLoss || 0).toFixed(0)}\nPoP: ${tile.oddsOfProfit || 0}%\n\n#options #trading #ironcondor #theta #optionstrading #${symbol.toLowerCase()} #newleaf #wallstreet #investing #passiveincome`
      : null,
  };

  return (
    <div>
      <Link to="/" className="dk-back">&larr; Back to Week View</Link>

      <div className="dk-detail-header">
        <h1>{symbol} {tile.strategy}</h1>
        <p style={{ color: '#6b7280', fontSize: 13 }}>
          ${spot.toFixed(2)} | Credit: ${(tile.netCredit || 0).toFixed(2)} | PoP: {tile.oddsOfProfit || 0}% |
          Expiry: {tile.expiry || 'N/A'} | DTE: {tile.dte || 0}
        </p>
      </div>

      {/* ── Channel Status (full) ── */}
      <div className="dk-detail-section" style={{ marginBottom: 20 }}>
        <h3>Publishing Channels</h3>
        <ChannelStatus channels={channels} onStatusChange={updateChannel} />
      </div>

      <div className="dk-detail-grid">
        {/* ── Left column ── */}
        <div>
          {/* Export JSONs */}
          <div className="dk-detail-section">
            <h3>Export Data</h3>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <button className="dk-btn dk-btn-gold dk-btn-icon" onClick={() => {
                downloadJson(buildHeyGenScript(pick), `${symbol}-heygen-script.json`);
                showToast('HeyGen script downloaded');
              }}>
                🎬 HeyGen Script JSON
              </button>
              <button className="dk-btn dk-btn-gold dk-btn-icon" onClick={() => {
                downloadJson(buildPdfData(pick), `${symbol}-pdf-data.json`);
                showToast('PDF data downloaded');
              }}>
                📄 PDF Report JSON
              </button>
              <button className="dk-btn dk-btn-icon" onClick={() => setJsonTab(jsonTab === 'heygen' ? null : 'heygen')}>
                {jsonTab === 'heygen' ? 'Hide' : 'Preview'} HeyGen
              </button>
              <button className="dk-btn dk-btn-icon" onClick={() => setJsonTab(jsonTab === 'pdf' ? null : 'pdf')}>
                {jsonTab === 'pdf' ? 'Hide' : 'Preview'} PDF Data
              </button>
            </div>

            {jsonTab === 'heygen' && (
              <div className="dk-json-block">{JSON.stringify(buildHeyGenScript(pick), null, 2)}</div>
            )}
            {jsonTab === 'pdf' && (
              <div className="dk-json-block">{JSON.stringify(buildPdfData(pick), null, 2)}</div>
            )}
          </div>

          {/* Links */}
          <div className="dk-detail-section" style={{ marginTop: 16 }}>
            <h3>Published Links</h3>
            <div className="dk-assets">
              <div className="dk-asset-row">
                <span className="dk-asset-name">Picks Page</span>
                <div className="dk-asset-actions">
                  <a href={`https://newleafsystem.com/picks/analysis/${symbol.toLowerCase()}`} target="_blank" rel="noopener" className="dk-asset-btn">Open</a>
                  <CopyButton text={`https://newleafsystem.com/picks/analysis/${symbol.toLowerCase()}`} label="Copy" />
                </div>
              </div>
              <div className="dk-asset-row">
                <span className="dk-asset-name">Invest Page</span>
                <div className="dk-asset-actions">
                  <a href={`https://newleafsystem.com/invest/position/${tileId}`} target="_blank" rel="noopener" className="dk-asset-btn">Open</a>
                  <CopyButton text={`https://newleafsystem.com/invest/position/${tileId}`} label="Copy" />
                </div>
              </div>
              <div className="dk-asset-row">
                <span className="dk-asset-name">PDF Report</span>
                <div className="dk-asset-actions">
                  <a href={pdfUrl} target="_blank" rel="noopener" className="dk-asset-btn">View</a>
                  <CopyButton text={pdfUrl} label="Copy URL" />
                </div>
              </div>
            </div>
          </div>

          {/* Trade Setup */}
          <div className="dk-detail-section" style={{ marginTop: 16 }}>
            <h3>Trade Setup</h3>
            <table style={{ width: '100%', fontSize: 12, borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: 10, color: '#9ca3af' }}>Action</th>
                  <th style={{ padding: '6px 8px', textAlign: 'left', fontSize: 10, color: '#9ca3af' }}>Type</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right', fontSize: 10, color: '#9ca3af' }}>Strike</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right', fontSize: 10, color: '#9ca3af' }}>Premium</th>
                  <th style={{ padding: '6px 8px', textAlign: 'right', fontSize: 10, color: '#9ca3af' }}>Delta</th>
                </tr>
              </thead>
              <tbody>
                {legs.map((l, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid #f0eeeb' }}>
                    <td style={{ padding: '6px 8px', fontWeight: 600, color: l.action === 'sell' ? '#dc2626' : '#16a34a' }}>{(l.action || '').toUpperCase()}</td>
                    <td style={{ padding: '6px 8px' }}>{(l.type || '').toUpperCase()}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'var(--mono)' }}>${l.strike}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'var(--mono)' }}>${(l.premium || l.mid || 0).toFixed(2)}</td>
                    <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'var(--mono)' }}>{l.delta?.toFixed(3) || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Provenance */}
          <div className="dk-detail-section" style={{ marginTop: 16 }}>
            <h3>Provenance</h3>
            <div style={{ fontSize: 12, lineHeight: 2 }}>
              <div>Model: <code>{analysis?.model_used || 'N/A'}</code></div>
              <div>Prompt: <code>{analysis?.prompt_version || 'N/A'}</code></div>
              <div>Source: <code>{analysis?.analysis_source || 'N/A'}</code></div>
              <div>Generated: <code>{analysis?.generation_timestamp || 'N/A'}</code></div>
              <div>Commit: <code>{analysis?.code_commit_sha?.slice(0, 12) || 'N/A'}</code></div>
            </div>
          </div>
        </div>

        {/* ── Right column ── */}
        <div>
          {/* Social Media */}
          <div className="dk-detail-section">
            <h3>Social Media Copy</h3>
            <div className="dk-social-tabs">
              {['linkedin', 'twitter', 'instagram'].map(tab => (
                <button key={tab} className={`dk-social-tab ${socialTab === tab ? 'active' : ''}`} onClick={() => setSocialTab(tab)}>
                  {tab === 'linkedin' ? 'LinkedIn' : tab === 'twitter' ? 'Twitter/X' : 'Instagram'}
                </button>
              ))}
            </div>
            <div className="dk-social-preview">
              {socialTab === 'linkedin' && (socialData.linkedin || 'Generate analysis first.')}
              {socialTab === 'twitter' && (socialData.twitter.length > 0 ? socialData.twitter.map((t, i) => `Tweet ${i + 1}:\n${t}`).join('\n\n') : 'No copy available.')}
              {socialTab === 'instagram' && (socialData.instagram || 'No copy available.')}
            </div>
            <div className="dk-social-actions">
              {socialTab === 'linkedin' && socialData.linkedin && <CopyButton text={socialData.linkedin} label="Copy LinkedIn Post" className="dk-btn dk-btn-sm" />}
              {socialTab === 'twitter' && socialData.twitter.map((t, i) => <CopyButton key={i} text={t} label={`Copy Tweet ${i + 1}`} className="dk-btn dk-btn-sm" />)}
              {socialTab === 'instagram' && socialData.instagram && <CopyButton text={socialData.instagram} label="Copy Instagram" className="dk-btn dk-btn-sm" />}
            </div>
          </div>

          {/* Indicators */}
          {ti && (
            <div className="dk-detail-section" style={{ marginTop: 16 }}>
              <h3>Technical Indicators (Computed)</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                {ti.rsi && <div>RSI(14): <strong>{ti.rsi.value}</strong> ({ti.rsi.signal})</div>}
                {ti.macd && <div>MACD: <strong>{ti.macd.macdLine}</strong> ({ti.macd.signal})</div>}
                {ti.bollingerBands && <div>BB: {ti.bollingerBands.lower} — {ti.bollingerBands.upper}</div>}
                {ti.movingAverages && <div>SMA20: {ti.movingAverages.sma20} | SMA50: {ti.movingAverages.sma50}</div>}
              </div>
            </div>
          )}

          {/* Thesis */}
          {rationale && (
            <div className="dk-detail-section" style={{ marginTop: 16 }}>
              <h3>Thesis</h3>
              <p style={{ fontSize: 13, lineHeight: 1.7 }}>{rationale.whyThisStrategy}</p>
              {rationale.whyTheseStrikes && <p style={{ fontSize: 12, color: '#6b7280', marginTop: 8 }}><strong>Strikes:</strong> {rationale.whyTheseStrikes}</p>}
            </div>
          )}

          {/* Risk */}
          {risk && (
            <div className="dk-detail-section" style={{ marginTop: 16 }}>
              <h3>Risk Analysis</h3>
              <div style={{ fontSize: 12, lineHeight: 1.8 }}>
                {risk.maxPainScenario && <p><strong>Max Pain:</strong> {risk.maxPainScenario}</p>}
                {risk.managementPlan && <p style={{ marginTop: 6 }}><strong>Management:</strong> {risk.managementPlan}</p>}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Raw JSON */}
      <details style={{ marginTop: 24 }}>
        <summary style={{ cursor: 'pointer', fontSize: 13, color: '#6b7280', marginBottom: 8 }}>Raw Analysis JSON</summary>
        <div className="dk-json-block">{JSON.stringify(analysis, null, 2)}</div>
      </details>

      {toast && <div className="dk-copy-toast">{toast}</div>}
    </div>
  );
}
