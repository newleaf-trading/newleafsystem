import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrandBar } from '../../../shared/components/BrandBar';
import { Footer } from '../../components/Footer';
import { useAuth } from '../../../shared/hooks/useAuth';
import PageSEO from '../../../shared/components/PageSEO';
import { StrategyTutorPanel } from '../../components/StrategyTutorPanel';

const STRATEGY_COLOR = '#f59e0b'; // Amber accent for Covered Call + Protective Put

export default function CoveredCallProtPutSkill() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('learn');
  const [tutorOpen, setTutorOpen] = useState(false);
  const canvasRef = useRef(null);
  const [hoverX, setHoverX] = useState(null);

  const [stockPrice, setStockPrice] = useState(100);
  const [callStrike, setCallStrike] = useState(110);
  const [putStrike, setPutStrike] = useState(90);
  const [callPremium, setCallPremium] = useState(3);
  const [putPremium, setPutPremium] = useState(2);
  const [costBasis, setCostBasis] = useState(100);

  useEffect(() => {
    document.title = 'Covered Call + Protective Put Strategy | NewLeaf Invest';
  }, []);

  const calculatePL = (price) => {
    // Stock P/L
    let pl = (price - costBasis) * 100;

    // Add premiums collected/paid
    pl += callPremium * 100;
    pl -= putPremium * 100;

    // Call payoff (caps upside)
    if (price > callStrike) {
      pl -= (price - callStrike) * 100;
    }

    // Put payoff (floor downside)
    if (price < putStrike) {
      pl += (putStrike - price) * 100;
    }

    return pl;
  };

  const maxProfit = (callStrike - costBasis) * 100 + callPremium * 100 - putPremium * 100;
  const maxLoss = (costBasis - putStrike) * 100 - callPremium * 100 + putPremium * 100;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    const W = 600, H = 260;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = W + 'px';
    canvas.style.height = H + 'px';
    ctx.scale(dpr, dpr);

    // White canvas background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    const minPrice = stockPrice * 0.7;
    const maxPrice = stockPrice * 1.3;
    const points = [];
    for (let i = 0; i <= W; i++) {
      const price = minPrice + (maxPrice - minPrice) * (i / W);
      const pl = calculatePL(price);
      points.push({ x: i, price, pl });
    }

    const pls = points.map(p => p.pl);
    const maxPL = Math.max(...pls);
    const minPL = Math.min(...pls);
    const plRange = maxPL - minPL || 1;
    const pad = 30;
    const toY = (pl) => pad + (H - 2 * pad) * (1 - (pl - minPL) / plRange);

    // Zero line (light gray)
    const zeroY = toY(0);
    ctx.strokeStyle = 'rgba(17, 24, 39, 0.12)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, zeroY);
    ctx.lineTo(W, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    // Gradient fill
    ctx.beginPath();
    ctx.moveTo(0, zeroY);
    points.forEach(p => ctx.lineTo(p.x, toY(p.pl)));
    ctx.lineTo(W, zeroY);
    ctx.closePath();
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.15)');
    gradient.addColorStop(1, 'rgba(239, 68, 68, 0.15)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // P/L line (Forest Green)
    ctx.strokeStyle = '#0B2D23';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, toY(p.pl)) : ctx.lineTo(p.x, toY(p.pl)));
    ctx.stroke();

    // Hover crosshair + tooltip
    if (hoverX !== null) {
      const price = minPrice + (maxPrice - minPrice) * (hoverX / W);
      const pl = calculatePL(price);
      ctx.strokeStyle = 'rgba(17, 24, 39, 0.15)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(hoverX, 0);
      ctx.lineTo(hoverX, H);
      ctx.stroke();
      ctx.setLineDash([]);

      // Tooltip box (white with border)
      ctx.fillStyle = '#ffffff';
      ctx.strokeStyle = 'rgba(17, 24, 39, 0.12)';
      ctx.lineWidth = 1;
      ctx.fillRect(hoverX - 60, 10, 120, 40);
      ctx.strokeRect(hoverX - 60, 10, 120, 40);

      ctx.fillStyle = '#374151';
      ctx.font = '11px IBM Plex Mono, monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`$${price.toFixed(2)}`, hoverX, 25);
      ctx.fillStyle = pl >= 0 ? '#10b981' : '#ef4444';
      ctx.fillText(`${pl >= 0 ? '+' : ''}$${pl.toFixed(0)}`, hoverX, 40);
    }
  }, [stockPrice, callStrike, putStrike, callPremium, putPremium, costBasis, hoverX]);

  return (
    <div style={{ minHeight: '100vh', background: '#ffffff', color: '#374151', fontFamily: 'IBM Plex Sans, sans-serif', paddingBottom: 60 }}>
      <PageSEO title="Covered Call with Protective Put — Options Strategy" description="Combine covered calls with protective puts for downside protection while generating income. Learn the collar-like setup, entry criteria, and management rules." path="/strategies/covered-call" />
      <link href="https://fonts.googleapis.com/css2?family=Fraunces:wght@400;600;700;800&family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" />

      {/* App Header */}
      <BrandBar surface="invest" authState="in" user={user} onSignOut={signOut} />

      {/* Header section with mint wash */}
      <div style={{ background: '#ffffff', borderBottom: '1px solid rgba(17,24,39,0.08)', padding: '40px 24px 36px' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <button onClick={() => navigate('/strategies')} style={{
            background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer',
            fontSize: 13, fontWeight: 600, marginBottom: 24, display: 'flex', alignItems: 'center', gap: 6
          }}>
            ← Back to Strategy Library
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ fontSize: 48, filter: 'grayscale(0.2)' }}>🏠</div>
            <div>
              <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 38, fontWeight: 800, margin: 0, marginBottom: 6, color: '#111827' }}>Covered Call + Protective Put</h1>
              <p style={{ fontSize: 16, color: '#6b7280', margin: 0, fontWeight: 500 }}>Own the stock, sell calls for income, buy puts for insurance</p>
            </div>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px' }}>
        {/* Tabs with NewLeaf styling */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
          <div style={{ display: 'flex', gap: 4, background: '#f3f4f6', borderRadius: 16, padding: 4, width: 'fit-content' }}>
            {['learn', 'build', 'manage'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                background: activeTab === tab ? '#0B2D23' : 'transparent',
                border: 'none',
                color: activeTab === tab ? '#ffffff' : 'rgba(17,24,39,0.70)',
                fontSize: 13,
                fontWeight: 750,
                padding: '10px 24px',
                cursor: 'pointer',
                borderRadius: 12,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
                transition: 'all 0.2s'
              }}>
                {tab}
              </button>
            ))}
          </div>
          <button onClick={() => setTutorOpen(true)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', borderRadius: 14,
            background: '#0d6e56', color: '#fff', border: 'none', fontSize: 12, fontWeight: 700,
            cursor: 'pointer', letterSpacing: '.04em', textTransform: 'uppercase',
          }}>
            <span style={{ fontSize: 14 }}>&#9889;</span> AI Tutor
          </button>
        </div>

        {activeTab === 'learn' && (
          <div>
            <section style={{ marginBottom: 48 }}>
              <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 700, marginBottom: 24, color: '#111827' }}>What does it feel like?</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20 }}>
                {[
                  { emoji: '🏠', title: 'Property Income', desc: 'Like owning rental property — collect income (calls) while protecting downside (puts)' },
                  { emoji: '🛡️', title: 'Sleep Insurance', desc: 'Stock crashes? Your put saves you. Rally capped but you still profit.' },
                  { emoji: '💰', title: 'Monthly Yield', desc: 'Sell calls every month, roll puts quarterly — steady cash flow' },
                  { emoji: '⚖️', title: 'Balanced Risk', desc: 'Upside capped but downside floored — perfect for retirement accounts' }
                ].map(item => (
                  <div key={item.title} style={{ background: 'white', border: '1px solid rgba(17, 24, 39, 0.08)', borderRadius: 16, padding: 24, transition: 'all 0.2s' }}>
                    <div style={{ fontSize: 32, marginBottom: 10 }}>{item.emoji}</div>
                    <div style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 17, fontWeight: 700, marginBottom: 8, color: '#111827' }}>{item.title}</div>
                    <div style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </section>

            <section style={{ marginBottom: 48 }}>
              <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 700, marginBottom: 24, color: '#111827' }}>How does it work?</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  { num: 1, text: 'Own 100 shares of the underlying stock' },
                  { num: 2, text: 'Sell 1 covered call above current price (collect premium, cap upside)' },
                  { num: 3, text: 'Buy 1 protective put below current price (pay premium, floor downside)' },
                  { num: 4, text: 'Net effect: defined range with income from call premium offsetting put cost' }
                ].map(step => (
                  <div key={step.num} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    <div style={{
                      width: 34, height: 34, borderRadius: 17,
                      background: STRATEGY_COLOR, color: '#ffffff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700, fontSize: 15, flexShrink: 0
                    }}>{step.num}</div>
                    <div style={{ fontSize: 15, lineHeight: 1.7, paddingTop: 6, color: '#374151' }}>{step.text}</div>
                  </div>
                ))}
              </div>
            </section>

            <section style={{ marginBottom: 48 }}>
              <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 700, marginBottom: 24, color: '#111827' }}>Risk Profile</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  { label: 'Risk', value: 2, color: '#ef4444' },
                  { label: 'Reward', value: 2, color: '#10b981' },
                  { label: 'Complexity', value: 3, color: '#f59e0b' },
                  { label: 'Win Rate', value: 4, color: STRATEGY_COLOR }
                ].map(metric => (
                  <div key={metric.label} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 120, fontSize: 14, fontWeight: 600, color: '#374151' }}>{metric.label}</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} style={{ width: 7, height: 7, borderRadius: 3.5, background: i < metric.value ? metric.color : '#e5e7eb' }} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 700, marginBottom: 24, color: '#dc2626' }}>⚠️ Why beginners lose money</h2>
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 16, padding: 28 }}>
                <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14, lineHeight: 1.7, color: '#7f1d1d' }}>
                  <li>Buying expensive puts that eat all the call premium — net cost makes strategy unprofitable</li>
                  <li>Letting stock get called away at a loss — didn't check cost basis vs call strike</li>
                  <li>Not rolling puts — let them expire worthless instead of rolling down and out</li>
                  <li>Selling calls too close ATM during bull run — stock gets called away, miss huge upside</li>
                </ul>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'build' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 32 }}>
              <div>
                <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 700, marginBottom: 20, color: '#111827' }}>Payoff Diagram</h2>
                <canvas
                  ref={canvasRef}
                  style={{
                    width: 600, height: 260, borderRadius: 12, cursor: 'crosshair',
                    border: '1px solid rgba(17, 24, 39, 0.10)',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.04)'
                  }}
                  onMouseMove={e => {
                    const rect = e.target.getBoundingClientRect();
                    setHoverX(e.clientX - rect.left);
                  }}
                  onMouseLeave={() => setHoverX(null)}
                />

                <div style={{ marginTop: 36 }}>
                  <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 18, fontWeight: 700, marginBottom: 20, color: '#111827' }}>Parameters</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {[
                      { label: 'Stock Price', value: stockPrice, setter: setStockPrice, min: 70, max: 130, step: 0.5 },
                      { label: 'Cost Basis', value: costBasis, setter: setCostBasis, min: 80, max: 120, step: 0.5 },
                      { label: 'Call Strike', value: callStrike, setter: setCallStrike, min: 100, max: 120, step: 0.5 },
                      { label: 'Put Strike', value: putStrike, setter: setPutStrike, min: 75, max: 100, step: 0.5 },
                      { label: 'Call Premium', value: callPremium, setter: setCallPremium, min: 1, max: 6, step: 0.1 },
                      { label: 'Put Premium', value: putPremium, setter: setPutPremium, min: 0.5, max: 5, step: 0.1 }
                    ].map(param => (
                      <div key={param.label}>
                        <label style={{ fontSize: 13, color: '#6b7280', display: 'block', marginBottom: 8, fontWeight: 500 }}>
                          {param.label}: <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: '#111827', fontWeight: 600 }}>${param.value.toFixed(2)}</span>
                        </label>
                        <input
                          type="range"
                          min={param.min}
                          max={param.max}
                          step={param.step}
                          value={param.value}
                          onChange={e => param.setter(parseFloat(e.target.value))}
                          style={{ width: '100%', accentColor: '#0B2D23' }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 22, fontWeight: 700, marginBottom: 20, color: '#111827' }}>Live Stats</h2>
                <div style={{ background: 'white', border: '1px solid rgba(17, 24, 39, 0.08)', borderRadius: 16, padding: 24, display: 'flex', flexDirection: 'column', gap: 24 }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6, fontWeight: 500 }}>Max Profit</div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: '#10b981', fontFamily: "'IBM Plex Mono', monospace" }}>${maxProfit.toFixed(0)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6, fontWeight: 500 }}>Max Loss</div>
                    <div style={{ fontSize: 26, fontWeight: 700, color: '#ef4444', fontFamily: "'IBM Plex Mono', monospace" }}>-${maxLoss.toFixed(0)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6, fontWeight: 500 }}>Net Premium</div>
                    <div style={{ fontSize: 22, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace", color: callPremium > putPremium ? '#10b981' : '#ef4444' }}>
                      ${(callPremium - putPremium).toFixed(2)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6, fontWeight: 500 }}>Capital at Risk</div>
                    <div style={{ fontSize: 19, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace", color: '#374151' }}>${(costBasis * 100).toFixed(0)}</div>
                  </div>
                </div>

                <div style={{ marginTop: 24, background: 'white', border: '1px solid rgba(17, 24, 39, 0.08)', borderRadius: 16, padding: 20 }}>
                  <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 15, fontWeight: 700, marginBottom: 16, color: '#111827' }}>Position Components</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#10b981', fontWeight: 500 }}>Own Stock</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: '#111827' }}>100 @ ${costBasis.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#ef4444', fontWeight: 500 }}>Sell Call</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: '#111827' }}>${callStrike.toFixed(2)} (+${callPremium.toFixed(2)})</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#10b981', fontWeight: 500 }}>Buy Put</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: '#111827' }}>${putStrike.toFixed(2)} (-${putPremium.toFixed(2)})</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'manage' && (
          <div>
            <h2 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 24, fontWeight: 700, marginBottom: 24, color: '#111827' }}>Exit Rules</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ background: 'white', border: '1px solid rgba(17, 24, 39, 0.08)', borderRadius: 16, padding: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={{ fontSize: 26 }}>✅</div>
                  <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 19, fontWeight: 700, margin: 0, color: '#10b981' }}>Take Profit</h3>
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14, lineHeight: 1.7, color: '#374151' }}>
                  <li>If call exercised at profit: let it go, redeploy capital</li>
                  <li>Stock near call strike at 7 DTE: roll call up and out for more premium</li>
                  <li>If put becomes deep OTM: sell put, keep call, harvest that premium</li>
                </ul>
              </div>

              <div style={{ background: 'white', border: '1px solid rgba(17, 24, 39, 0.08)', borderRadius: 16, padding: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={{ fontSize: 26 }}>❌</div>
                  <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 19, fontWeight: 700, margin: 0, color: '#ef4444' }}>Cut Losses</h3>
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14, lineHeight: 1.7, color: '#374151' }}>
                  <li>Stock approaching put strike: exercise put and exit, lock in floor</li>
                  <li>Thesis broken (company fundamentals deteriorate): close entire position</li>
                  <li>If net premium doesn't cover put cost: reevaluate strategy economics</li>
                </ul>
              </div>

              <div style={{ background: 'white', border: '1px solid rgba(17, 24, 39, 0.08)', borderRadius: 16, padding: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={{ fontSize: 26 }}>⏰</div>
                  <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 19, fontWeight: 700, margin: 0, color: '#f59e0b' }}>Time-Based Exits</h3>
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14, lineHeight: 1.7, color: '#374151' }}>
                  <li>Roll calls monthly at 21-30 DTE for optimal theta capture</li>
                  <li>Roll puts quarterly (60-90 DTE) to reduce cost drag</li>
                  <li>Never let calls go into expiration week uncovered</li>
                </ul>
              </div>

              <div style={{ background: 'white', border: '1px solid rgba(17, 24, 39, 0.08)', borderRadius: 16, padding: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={{ fontSize: 26 }}>🔧</div>
                  <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 19, fontWeight: 700, margin: 0, color: STRATEGY_COLOR }}>Adjustment Triggers</h3>
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14, lineHeight: 1.7, color: '#374151' }}>
                  <li>IV spike: calls become expensive — roll to higher strike for better premium</li>
                  <li>IV crush: puts get cheap — consider rolling down for tighter protection</li>
                  <li>Earnings approaching: close calls, tighten put strikes, wait for IV crush</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <Footer />
      <StrategyTutorPanel
        strategy="covered_call"
        strategyLabel="Covered Call & Protective Put"
        sliderValues={{}}
        isOpen={tutorOpen}
        onClose={() => setTutorOpen(false)}
      />
    </div>
  );
}
