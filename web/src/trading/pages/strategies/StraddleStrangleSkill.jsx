import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StrategyTutorPanel } from '../../components/StrategyTutorPanel';

const THEME_COLOR = '#f97316';

export default function StraddleStrangleSkill() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('learn');
  const [tutorOpen, setTutorOpen] = useState(false);
  const canvasRef = useRef(null);
  const [hoverX, setHoverX] = useState(null);
  const [mode, setMode] = useState('straddle'); // 'straddle' or 'strangle'

  const [stockPrice, setStockPrice] = useState(100);
  const [putStrike, setPutStrike] = useState(mode === 'straddle' ? 100 : 95);
  const [callStrike, setCallStrike] = useState(mode === 'straddle' ? 100 : 105);
  const [totalDebit, setTotalDebit] = useState(mode === 'straddle' ? 8 : 5);

  useEffect(() => {
    document.title = 'Straddle / Strangle Strategy | NewLeaf Invest';
  }, []);

  useEffect(() => {
    if (mode === 'straddle') {
      setPutStrike(100);
      setCallStrike(100);
      setTotalDebit(8);
    } else {
      setPutStrike(95);
      setCallStrike(105);
      setTotalDebit(5);
    }
  }, [mode]);

  const calculatePL = (price) => {
    let pl = -totalDebit * 100;

    // Put payoff
    if (price < putStrike) {
      pl += (putStrike - price) * 100;
    }

    // Call payoff
    if (price > callStrike) {
      pl += (price - callStrike) * 100;
    }

    return pl;
  };

  const maxLoss = totalDebit * 100;
  const lowerBreakeven = putStrike - totalDebit;
  const upperBreakeven = callStrike + totalDebit;

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
    gradient.addColorStop(0, 'rgba(249, 115, 22, 0.4)');
    gradient.addColorStop(0.5, 'rgba(239, 68, 68, 0.4)');
    gradient.addColorStop(1, 'rgba(249, 115, 22, 0.4)');
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.strokeStyle = THEME_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, toY(p.pl)) : ctx.lineTo(p.x, toY(p.pl)));
    ctx.stroke();

    // Breakevens
    ctx.fillStyle = '#fbbf24';
    const beX1 = ((lowerBreakeven - minPrice) / (maxPrice - minPrice)) * W;
    const beX2 = ((upperBreakeven - minPrice) / (maxPrice - minPrice)) * W;
    if (beX1 >= 0 && beX1 <= W) {
      ctx.beginPath();
      ctx.arc(beX1, zeroY, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (beX2 >= 0 && beX2 <= W) {
      ctx.beginPath();
      ctx.arc(beX2, zeroY, 4, 0, Math.PI * 2);
      ctx.fill();
    }

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
  }, [stockPrice, putStrike, callStrike, totalDebit, mode, hoverX]);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0f1a', color: '#e2e8f0', fontFamily: 'DM Sans, sans-serif', padding: '40px 20px' }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <button onClick={() => navigate('/strategies')} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 14, cursor: 'pointer', marginBottom: 30, display: 'flex', alignItems: 'center', gap: 6 }}>
          ← Back to Strategy Library
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40 }}>
          <div style={{ fontSize: 48 }}>💥</div>
          <div>
            <h1 style={{ fontSize: 36, fontWeight: 800, margin: 0, marginBottom: 4 }}>Straddle / Strangle</h1>
            <p style={{ fontSize: 16, color: '#94a3b8', margin: 0 }}>Profit from big moves — in either direction</p>
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
                  { emoji: '💥', title: 'Earthquake Bet', desc: 'You don\'t care which way — just need a BIG move' },
                  { emoji: '📰', title: 'Event Play', desc: 'Perfect for earnings, FDA approvals, Fed meetings' },
                  { emoji: '♾️', title: 'Unlimited Profit', desc: 'Both sides have infinite profit potential' },
                  { emoji: '⚠️', title: 'High Cost', desc: 'Expensive to enter — need significant move to profit' }
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
                  { num: 1, text: 'Buy a put and a call at the SAME strike (straddle) or DIFFERENT strikes (strangle)' },
                  { num: 2, text: 'Pay upfront premium — this is your max loss' },
                  { num: 3, text: 'If stock moves BIG in either direction, one side pays off massively' },
                  { num: 4, text: 'Profit = intrinsic value of winning leg minus total debit paid' }
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
                  { label: 'Risk', value: 3, color: '#ef4444' },
                  { label: 'Reward', value: 5, color: '#10b981' },
                  { label: 'Complexity', value: 2, color: '#f59e0b' },
                  { label: 'Win Rate', value: 2, color: THEME_COLOR }
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
                  <li>Buying before IV spike — paying low premium but getting low move too</li>
                  <li>Buying AFTER the event — IV crush destroys value instantly</li>
                  <li>Holding too long — time decay eats both legs every day</li>
                  <li>Not taking profit when one side hits big — waiting for both legs to profit (impossible)</li>
                </ul>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'build' && (
          <div>
            <div style={{ marginBottom: 24, display: 'flex', gap: 12 }}>
              <button onClick={() => setMode('straddle')} style={{ padding: '8px 20px', background: mode === 'straddle' ? THEME_COLOR : '#1e293b', color: '#e2e8f0', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                Straddle (Same Strike)
              </button>
              <button onClick={() => setMode('strangle')} style={{ padding: '8px 20px', background: mode === 'strangle' ? THEME_COLOR : '#1e293b', color: '#e2e8f0', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 14, fontWeight: 600 }}>
                Strangle (Different Strikes)
              </button>
            </div>

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
                      <input type="range" min="70" max="130" step="0.5" value={stockPrice} onChange={e => setStockPrice(parseFloat(e.target.value))} style={{ width: '100%' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Put Strike: ${putStrike.toFixed(2)}</label>
                      <input type="range" min="85" max="100" step="0.5" value={putStrike} onChange={e => setPutStrike(parseFloat(e.target.value))} style={{ width: '100%' }} disabled={mode === 'straddle'} />
                    </div>
                    <div>
                      <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Call Strike: ${callStrike.toFixed(2)}</label>
                      <input type="range" min="100" max="115" step="0.5" value={callStrike} onChange={e => setCallStrike(parseFloat(e.target.value))} style={{ width: '100%' }} disabled={mode === 'straddle'} />
                    </div>
                    <div>
                      <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Total Debit: ${totalDebit.toFixed(2)}</label>
                      <input type="range" min="3" max="12" step="0.1" value={totalDebit} onChange={e => setTotalDebit(parseFloat(e.target.value))} style={{ width: '100%' }} />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: THEME_COLOR }}>Live Stats</h2>
                <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Max Profit</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#10b981', fontFamily: 'JetBrains Mono' }}>Unlimited</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Max Loss</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#ef4444', fontFamily: 'JetBrains Mono' }}>-${maxLoss.toFixed(0)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Lower Breakeven</div>
                    <div style={{ fontSize: 20, fontWeight: 600, fontFamily: 'JetBrains Mono' }}>${lowerBreakeven.toFixed(2)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Upper Breakeven</div>
                    <div style={{ fontSize: 20, fontWeight: 600, fontFamily: 'JetBrains Mono' }}>${upperBreakeven.toFixed(2)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Move Needed</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: THEME_COLOR, fontFamily: 'JetBrains Mono' }}>±{((totalDebit / stockPrice) * 100).toFixed(1)}%</div>
                  </div>
                </div>

                <div style={{ marginTop: 24, background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: 16 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Position Legs</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#10b981' }}>Buy Put</span>
                      <span style={{ fontFamily: 'JetBrains Mono' }}>${putStrike.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#10b981' }}>Buy Call</span>
                      <span style={{ fontFamily: 'JetBrains Mono' }}>${callStrike.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: '1px solid #1e293b' }}>
                      <span style={{ fontWeight: 600 }}>Total Cost</span>
                      <span style={{ fontFamily: 'JetBrains Mono', color: THEME_COLOR }}>-${totalDebit.toFixed(2)}</span>
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
                  <li>Close when one side hits 100% profit (doubled your money)</li>
                  <li>After earnings/event: close immediately if IV crushed, even at small profit</li>
                  <li>If stock moves big but volatility stays high, consider holding for more</li>
                </ul>
              </div>

              <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ fontSize: 24 }}>❌</div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#ef4444' }}>Cut Losses</h3>
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, lineHeight: 1.6 }}>
                  <li>Exit at 50% loss if no movement and time decay eating value</li>
                  <li>Close if event passed and stock didn't move — no more catalyst</li>
                  <li>IV crush post-event with no stock movement = immediate exit</li>
                </ul>
              </div>

              <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ fontSize: 24 }}>⏰</div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#f59e0b' }}>Time-Based Exits</h3>
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, lineHeight: 1.6 }}>
                  <li>Never hold past 7 DTE unless deep ITM — theta decay accelerates</li>
                  <li>If event-driven: exit within 24 hours after event regardless of P/L</li>
                  <li>If no movement by 50% time elapsed, strongly consider exit</li>
                </ul>
              </div>

              <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ fontSize: 24 }}>🔧</div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: THEME_COLOR }}>Adjustment Triggers</h3>
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, lineHeight: 1.6 }}>
                  <li>Stock moves big one direction: close losing leg, let winner run</li>
                  <li>IV expands after opening: take profit early, don't wait for move</li>
                  <li>New catalyst announced: consider rolling to later expiry for more time</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
      <StrategyTutorPanel
        strategy="straddle_strangle"
        strategyLabel="Straddle & Strangle"
        sliderValues={{}}
        isOpen={tutorOpen}
        onClose={() => setTutorOpen(false)}
      />
    </div>
  );
}
