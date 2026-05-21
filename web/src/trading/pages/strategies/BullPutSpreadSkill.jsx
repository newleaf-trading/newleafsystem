import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrandBar } from '../../../shared/components/BrandBar';
import { Footer } from '../../components/Footer';
import { useAuth } from '../../../shared/hooks/useAuth';
import PageSEO from '../../../shared/components/PageSEO';
import { StrategyTutorPanel } from '../../components/StrategyTutorPanel';

const STRATEGY_COLOR = '#10b981'; // Emerald accent for Bull Put Spread

export default function BullPutSpreadSkill() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('learn');
  const [tutorOpen, setTutorOpen] = useState(false);
  const canvasRef = useRef(null);
  const [hoverX, setHoverX] = useState(null);

  const [stockPrice, setStockPrice] = useState(100);
  const [shortPutStrike, setShortPutStrike] = useState(95);
  const [longPutStrike, setLongPutStrike] = useState(90);
  const [creditReceived, setCreditReceived] = useState(1.8);

  useEffect(() => {
    document.title = 'Bull Put Spread Strategy | NewLeaf Invest';
  }, []);

  const calculatePL = (price) => {
    let pl = creditReceived * 100;

    if (price < longPutStrike) {
      pl -= (longPutStrike - price) * 100;
      pl -= (shortPutStrike - longPutStrike) * 100;
    } else if (price < shortPutStrike) {
      pl -= (shortPutStrike - price) * 100;
    }

    return pl;
  };

  const maxProfit = creditReceived * 100;
  const maxLoss = (shortPutStrike - longPutStrike) * 100 - maxProfit;
  const breakeven = shortPutStrike - creditReceived;

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

    // Breakeven marker (Gold)
    ctx.fillStyle = '#C9A96E';
    const beX = ((breakeven - minPrice) / (maxPrice - minPrice)) * W;
    if (beX >= 0 && beX <= W) {
      ctx.beginPath();
      ctx.arc(beX, zeroY, 5, 0, Math.PI * 2);
      ctx.fill();
    }

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
  }, [stockPrice, shortPutStrike, longPutStrike, creditReceived, hoverX]);

  return (
    <div style={{ minHeight: '100vh', background: '#ffffff', color: '#374151', fontFamily: 'IBM Plex Sans, sans-serif', paddingBottom: 60 }}>
      <PageSEO title="Bull Put Spread Strategy — Bullish Options Income" description="Master the bull put spread: sell a higher-strike put and buy a lower-strike put to profit from bullish or neutral price action. Risk-defined income strategy with clear entry signals." path="/strategies/bull-put-spread" />
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
            <div style={{ fontSize: 48, filter: 'grayscale(0.2)' }}>📈</div>
            <div>
              <h1 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 38, fontWeight: 800, margin: 0, marginBottom: 6, color: '#111827' }}>Bull Put Spread</h1>
              <p style={{ fontSize: 16, color: '#6b7280', margin: 0, fontWeight: 500 }}>Get paid for believing a stock won't fall</p>
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
                  { emoji: '🏦', title: 'Insurance Seller', desc: 'You are the insurance company — collect premium for downside protection' },
                  { emoji: '🎯', title: 'Directional Lean', desc: 'Bullish bias — you want the stock to stay flat or go up' },
                  { emoji: '💰', title: 'Income Strategy', desc: 'Keep the credit as long as stock stays above your short put' },
                  { emoji: '🛡️', title: 'Limited Risk', desc: 'Long put caps your loss — you know max downside from day one' }
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
                  { num: 1, text: 'Sell a put at a higher strike (collect premium)' },
                  { num: 2, text: 'Buy a put at a lower strike for protection (pay less premium)' },
                  { num: 3, text: 'Net credit = your max profit' },
                  { num: 4, text: 'If stock stays above short put, both expire worthless and you keep the credit' }
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
                  { label: 'Risk', value: 3, color: '#ef4444' },
                  { label: 'Reward', value: 2, color: '#10b981' },
                  { label: 'Complexity', value: 2, color: '#f59e0b' },
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
                  <li>Selling too close to the money for higher premium — one dip and you hit max loss</li>
                  <li>Ignoring support levels — selling puts below technical support is dangerous</li>
                  <li>Opening during high IV without a plan — when IV crushes, profits evaporate</li>
                  <li>Not rolling down when tested — letting assignment happen instead of managing</li>
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
                      { label: 'Short Put Strike', value: shortPutStrike, setter: setShortPutStrike, min: 85, max: 105, step: 0.5 },
                      { label: 'Long Put Strike', value: longPutStrike, setter: setLongPutStrike, min: 75, max: 95, step: 0.5 },
                      { label: 'Credit Received', value: creditReceived, setter: setCreditReceived, min: 0.5, max: 4, step: 0.1 }
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
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6, fontWeight: 500 }}>Breakeven</div>
                    <div style={{ fontSize: 22, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace", color: '#111827' }}>${breakeven.toFixed(2)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6, fontWeight: 500 }}>Win Rate (Est.)</div>
                    <div style={{ fontSize: 22, fontWeight: 600, color: STRATEGY_COLOR, fontFamily: "'IBM Plex Mono', monospace" }}>~68%</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6, fontWeight: 500 }}>Risk/Reward</div>
                    <div style={{ fontSize: 17, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace", color: '#374151' }}>
                      1:{(maxLoss / maxProfit).toFixed(2)}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 24, background: 'white', border: '1px solid rgba(17, 24, 39, 0.08)', borderRadius: 16, padding: 20 }}>
                  <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 15, fontWeight: 700, marginBottom: 16, color: '#111827' }}>Position Legs</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#ef4444', fontWeight: 500 }}>Sell Put</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: '#111827' }}>${shortPutStrike.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#10b981', fontWeight: 500 }}>Buy Put</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: '#111827' }}>${longPutStrike.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTop: '1px solid rgba(17, 24, 39, 0.08)' }}>
                      <span style={{ fontWeight: 700, color: '#111827' }}>Net Credit</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace", color: STRATEGY_COLOR, fontWeight: 700 }}>${creditReceived.toFixed(2)}</span>
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
                  <li>Close at 50% of max profit (optimal for credit spreads)</li>
                  <li>If hit 75% profit in first 3 days, take it and move on</li>
                  <li>Consider closing if stock rallies well above short put</li>
                </ul>
              </div>

              <div style={{ background: 'white', border: '1px solid rgba(17, 24, 39, 0.08)', borderRadius: 16, padding: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={{ fontSize: 26 }}>❌</div>
                  <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 19, fontWeight: 700, margin: 0, color: '#ef4444' }}>Cut Losses</h3>
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14, lineHeight: 1.7, color: '#374151' }}>
                  <li>Exit at 2x max profit loss (e.g., $180 credit → exit at -$360 loss)</li>
                  <li>Close if stock breaks key support with volume</li>
                  <li>Don't fight a losing trade — accept the loss and preserve capital</li>
                </ul>
              </div>

              <div style={{ background: 'white', border: '1px solid rgba(17, 24, 39, 0.08)', borderRadius: 16, padding: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={{ fontSize: 26 }}>⏰</div>
                  <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 19, fontWeight: 700, margin: 0, color: '#f59e0b' }}>Time-Based Exits</h3>
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14, lineHeight: 1.7, color: '#374151' }}>
                  <li>Close or roll by 7 DTE — gamma risk too high after that</li>
                  <li>If still profitable at 21 DTE, consider rolling to next month for more credit</li>
                  <li>Never hold into expiration week if stock is near short strike</li>
                </ul>
              </div>

              <div style={{ background: 'white', border: '1px solid rgba(17, 24, 39, 0.08)', borderRadius: 16, padding: 28 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                  <div style={{ fontSize: 26 }}>🔧</div>
                  <h3 style={{ fontFamily: "'Fraunces', Georgia, serif", fontSize: 19, fontWeight: 700, margin: 0, color: STRATEGY_COLOR }}>Adjustment Triggers</h3>
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 14, lineHeight: 1.7, color: '#374151' }}>
                  <li>Roll down and out if stock breaks short put — collect more time premium</li>
                  <li>If IV spikes, consider taking early profit (vega works against you in credit spreads)</li>
                  <li>Upcoming earnings? Close position — don't gamble on IV crush</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <Footer />
      <StrategyTutorPanel
        strategy="bull_put_spread"
        strategyLabel="Bull Put Spread"
        sliderValues={{}}
        isOpen={tutorOpen}
        onClose={() => setTutorOpen(false)}
      />
    </div>
  );
}
