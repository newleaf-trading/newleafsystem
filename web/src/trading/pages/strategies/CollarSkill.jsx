import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StrategyTutorPanel } from '../../components/StrategyTutorPanel';

const THEME_COLOR = '#14b8a6';

export default function CollarSkill() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('learn');
  const [tutorOpen, setTutorOpen] = useState(false);
  const canvasRef = useRef(null);
  const [hoverX, setHoverX] = useState(null);

  const [stockPrice, setStockPrice] = useState(100);
  const [putStrike, setPutStrike] = useState(92);
  const [callStrike, setCallStrike] = useState(108);
  const [putPremium, setPutPremium] = useState(2.5);
  const [callPremium, setCallPremium] = useState(2.5);
  const [costBasis, setCostBasis] = useState(100);

  useEffect(() => {
    document.title = 'Collar Strategy | NewLeaf Invest';
  }, []);

  const calculatePL = (price) => {
    // Stock P/L
    let pl = (price - costBasis) * 100;

    // Add/subtract net premium
    pl += callPremium * 100;
    pl -= putPremium * 100;

    // Call caps upside
    if (price > callStrike) {
      pl -= (price - callStrike) * 100;
    }

    // Put floors downside
    if (price < putStrike) {
      pl += (putStrike - price) * 100;
    }

    return pl;
  };

  const maxProfit = (callStrike - costBasis) * 100 + callPremium * 100 - putPremium * 100;
  const maxLoss = (costBasis - putStrike) * 100 - callPremium * 100 + putPremium * 100;
  const netCost = putPremium - callPremium;

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

    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, W, H);

    const minPrice = stockPrice * 0.75;
    const maxPrice = stockPrice * 1.25;
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

    const zeroY = toY(0);
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(0, zeroY);
    ctx.lineTo(W, zeroY);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.beginPath();
    ctx.moveTo(0, zeroY);
    points.forEach(p => ctx.lineTo(p.x, toY(p.pl)));
    ctx.lineTo(W, zeroY);
    ctx.closePath();
    const gradient = ctx.createLinearGradient(0, 0, 0, H);
    gradient.addColorStop(0, 'rgba(20, 184, 166, 0.3)');
    gradient.addColorStop(0.5, 'rgba(16, 185, 129, 0.4)');
    gradient.addColorStop(1, 'rgba(20, 184, 166, 0.3)');
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.strokeStyle = THEME_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, toY(p.pl)) : ctx.lineTo(p.x, toY(p.pl)));
    ctx.stroke();

    if (hoverX !== null) {
      const price = minPrice + (maxPrice - minPrice) * (hoverX / W);
      const pl = calculatePL(price);
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(hoverX, 0);
      ctx.lineTo(hoverX, H);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#1e293b';
      ctx.fillRect(hoverX - 60, 10, 120, 40);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = '11px JetBrains Mono';
      ctx.textAlign = 'center';
      ctx.fillText(`$${price.toFixed(2)}`, hoverX, 25);
      ctx.fillStyle = pl >= 0 ? '#10b981' : '#ef4444';
      ctx.fillText(`${pl >= 0 ? '+' : ''}$${pl.toFixed(0)}`, hoverX, 40);
    }
  }, [stockPrice, putStrike, callStrike, putPremium, callPremium, costBasis, hoverX]);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0f1a', color: '#e2e8f0', fontFamily: 'DM Sans, sans-serif', padding: '40px 20px' }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <button onClick={() => navigate('/strategies')} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 14, cursor: 'pointer', marginBottom: 30, display: 'flex', alignItems: 'center', gap: 6 }}>
          ← Back to Strategy Library
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40 }}>
          <div style={{ fontSize: 48 }}>🔒</div>
          <div>
            <h1 style={{ fontSize: 36, fontWeight: 800, margin: 0, marginBottom: 4 }}>Collar</h1>
            <p style={{ fontSize: 16, color: '#94a3b8', margin: 0 }}>Lock in your stock gains with guardrails</p>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 40 }}>
          <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid #1e293b' }}>
            {['learn', 'build', 'manage'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{ background: activeTab === tab ? '#1e293b' : 'transparent', border: 'none', color: activeTab === tab ? THEME_COLOR : '#64748b', fontSize: 14, fontWeight: 600, padding: '12px 24px', cursor: 'pointer', borderBottom: activeTab === tab ? `2px solid ${THEME_COLOR}` : 'none', textTransform: 'uppercase', letterSpacing: 1 }}>
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
              <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, color: THEME_COLOR }}>What does it feel like?</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20 }}>
                {[
                  { emoji: '🔒', title: 'Sleep Well', desc: 'Floor on downside, ceiling on upside — no surprises' },
                  { emoji: '🛡️', title: 'Protect Gains', desc: 'Perfect after a stock has run up — lock in profits' },
                  { emoji: '🆓', title: 'Zero Cost (Ideal)', desc: 'Call premium pays for put premium — free insurance' },
                  { emoji: '📊', title: 'Defined Range', desc: 'Know exact profit and loss range from day one' }
                ].map(item => (
                  <div key={item.title} style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: 20 }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>{item.emoji}</div>
                    <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{item.title}</div>
                    <div style={{ fontSize: 13, color: '#94a3b8' }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </section>

            <section style={{ marginBottom: 48 }}>
              <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, color: THEME_COLOR }}>How does it work?</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  { num: 1, text: 'Own 100 shares of stock (already have gains you want to protect)' },
                  { num: 2, text: 'Buy 1 protective put below current price (floor)' },
                  { num: 3, text: 'Sell 1 covered call above current price (ceiling)' },
                  { num: 4, text: 'Ideally: call premium = put premium for zero cost collar' }
                ].map(step => (
                  <div key={step.num} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 16, background: THEME_COLOR, color: '#0a0f1a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0 }}>{step.num}</div>
                    <div style={{ fontSize: 15, lineHeight: 1.6, paddingTop: 4 }}>{step.text}</div>
                  </div>
                ))}
              </div>
            </section>

            <section style={{ marginBottom: 48 }}>
              <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, color: THEME_COLOR }}>Risk Profile</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  { label: 'Risk', value: 1, color: '#ef4444' },
                  { label: 'Reward', value: 2, color: '#10b981' },
                  { label: 'Complexity', value: 2, color: '#f59e0b' },
                  { label: 'Win Rate', value: 4, color: THEME_COLOR }
                ].map(metric => (
                  <div key={metric.label} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 120, fontSize: 14, fontWeight: 600 }}>{metric.label}</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} style={{ width: 6, height: 6, borderRadius: 3, background: i < metric.value ? metric.color : '#1e293b' }} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, color: '#ef4444' }}>⚠️ Why beginners lose money</h2>
              <div style={{ background: '#1e1214', border: '1px solid #3f1b1b', borderRadius: 8, padding: 24 }}>
                <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14, lineHeight: 1.7 }}>
                  <li>Stock rips past call strike — gains capped, watching from sidelines</li>
                  <li>Put expires worthless repeatedly — paying for insurance that never pays off</li>
                  <li>Not rolling the collar — letting it expire and stock becomes unprotected</li>
                  <li>Using collar on losing position — locks in losses instead of protecting gains</li>
                </ul>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'build' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 32 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: THEME_COLOR }}>Payoff Diagram</h2>
                <canvas
                  ref={canvasRef}
                  style={{ width: 600, height: 260, borderRadius: 8, cursor: 'crosshair', border: '1px solid #1e293b' }}
                  onMouseMove={e => {
                    const rect = e.target.getBoundingClientRect();
                    setHoverX(e.clientX - rect.left);
                  }}
                  onMouseLeave={() => setHoverX(null)}
                />

                <div style={{ marginTop: 32 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 16 }}>Parameters</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    <div>
                      <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Stock Price: ${stockPrice.toFixed(2)}</label>
                      <input type="range" min="75" max="125" step="0.5" value={stockPrice} onChange={e => setStockPrice(parseFloat(e.target.value))} style={{ width: '100%' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Cost Basis: ${costBasis.toFixed(2)}</label>
                      <input type="range" min="80" max="110" step="0.5" value={costBasis} onChange={e => setCostBasis(parseFloat(e.target.value))} style={{ width: '100%' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Put Strike (Floor): ${putStrike.toFixed(2)}</label>
                      <input type="range" min="80" max="98" step="0.5" value={putStrike} onChange={e => setPutStrike(parseFloat(e.target.value))} style={{ width: '100%' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Call Strike (Ceiling): ${callStrike.toFixed(2)}</label>
                      <input type="range" min="102" max="120" step="0.5" value={callStrike} onChange={e => setCallStrike(parseFloat(e.target.value))} style={{ width: '100%' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Put Premium: ${putPremium.toFixed(2)}</label>
                      <input type="range" min="1" max="5" step="0.1" value={putPremium} onChange={e => setPutPremium(parseFloat(e.target.value))} style={{ width: '100%' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Call Premium: ${callPremium.toFixed(2)}</label>
                      <input type="range" min="1" max="5" step="0.1" value={callPremium} onChange={e => setCallPremium(parseFloat(e.target.value))} style={{ width: '100%' }} />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: THEME_COLOR }}>Live Stats</h2>
                <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Max Profit</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#10b981', fontFamily: 'JetBrains Mono' }}>${maxProfit.toFixed(0)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Max Loss</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#ef4444', fontFamily: 'JetBrains Mono' }}>-${maxLoss.toFixed(0)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Net Cost</div>
                    <div style={{ fontSize: 20, fontWeight: 600, fontFamily: 'JetBrains Mono', color: netCost > 0 ? '#ef4444' : netCost < 0 ? '#10b981' : '#94a3b8' }}>
                      {netCost === 0 ? 'Zero Cost 🎉' : `$${Math.abs(netCost).toFixed(2)} ${netCost > 0 ? 'debit' : 'credit'}`}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Protected Range</div>
                    <div style={{ fontSize: 16, fontWeight: 600, fontFamily: 'JetBrains Mono' }}>
                      ${putStrike.toFixed(2)} - ${callStrike.toFixed(2)}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 24, background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: 16 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Position Components</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#10b981' }}>Own Stock</span>
                      <span style={{ fontFamily: 'JetBrains Mono' }}>100 shares @ ${costBasis.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#10b981' }}>Buy Put (Floor)</span>
                      <span style={{ fontFamily: 'JetBrains Mono' }}>${putStrike.toFixed(2)} (-${putPremium.toFixed(2)})</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#ef4444' }}>Sell Call (Ceiling)</span>
                      <span style={{ fontFamily: 'JetBrains Mono' }}>${callStrike.toFixed(2)} (+${callPremium.toFixed(2)})</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'manage' && (
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, color: THEME_COLOR }}>Exit Rules</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ fontSize: 24 }}>✅</div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#10b981' }}>Take Profit</h3>
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, lineHeight: 1.6 }}>
                  <li>If stock called away at call strike: accept it, you hit max profit</li>
                  <li>Stock pinned between strikes: roll both legs out for continued protection</li>
                  <li>Thesis complete (e.g., held through earnings): close entire collar</li>
                </ul>
              </div>

              <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ fontSize: 24 }}>❌</div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#ef4444' }}>Cut Losses</h3>
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, lineHeight: 1.6 }}>
                  <li>Stock crashing to put strike: exercise put, exit position at floor</li>
                  <li>Company fundamentals deteriorate: close collar, sell stock immediately</li>
                  <li>If maintaining collar becomes too expensive: consider exiting stock position</li>
                </ul>
              </div>

              <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ fontSize: 24 }}>⏰</div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#f59e0b' }}>Time-Based Exits</h3>
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, lineHeight: 1.6 }}>
                  <li>Roll collar quarterly (60-90 DTE) to maintain protection</li>
                  <li>Don't let protection lapse — stock becomes naked if collar expires</li>
                  <li>Consider rolling up call strikes as stock appreciates over time</li>
                </ul>
              </div>

              <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ fontSize: 24 }}>🔧</div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: THEME_COLOR }}>Adjustment Triggers</h3>
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, lineHeight: 1.6 }}>
                  <li>Stock approaching call strike: roll call up and out for more upside</li>
                  <li>Stock declining: consider rolling put down to tighten floor</li>
                  <li>IV spike: great time to roll — collect higher premiums on calls</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
      <StrategyTutorPanel
        strategy="collar"
        strategyLabel="Collar"
        sliderValues={{}}
        isOpen={tutorOpen}
        onClose={() => setTutorOpen(false)}
      />
    </div>
  );
}
