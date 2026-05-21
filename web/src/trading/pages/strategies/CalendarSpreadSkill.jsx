import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrandBar } from '../../../shared/components/BrandBar';
import { Footer } from '../../components/Footer';
import { useAuth } from '../../../shared/hooks/useAuth';
import PageSEO from '../../../shared/components/PageSEO';
import { StrategyTutorPanel } from '../../components/StrategyTutorPanel';

const THEME_COLOR = '#6366f1';

export default function CalendarSpreadSkill() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('learn');
  const [tutorOpen, setTutorOpen] = useState(false);
  const canvasRef = useRef(null);
  const [hoverX, setHoverX] = useState(null);

  const [stockPrice, setStockPrice] = useState(100);
  const [strikePrice, setStrikePrice] = useState(100);
  const [frontPremium, setFrontPremium] = useState(3);
  const [backPremium, setBackPremium] = useState(5.5);

  useEffect(() => {
    document.title = 'Calendar Spread Strategy | NewLeaf Invest';
  }, []);

  const calculatePL = (price) => {
    const netDebit = backPremium - frontPremium;
    let pl = -netDebit * 100;

    // Front month expires worthless if away from strike
    const frontValue = Math.max(0, Math.abs(price - strikePrice));

    // Back month retains value (simplified tent shape)
    const priceDiff = Math.abs(price - strikePrice);
    const backValue = Math.max(0, backPremium - priceDiff * 0.3);

    // Profit is back month value minus net debit paid
    pl = (backValue - netDebit) * 100;

    return pl;
  };

  const maxProfit = 200; // Approximate at ATM
  const maxLoss = (backPremium - frontPremium) * 100;

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

    const minPrice = stockPrice * 0.85;
    const maxPrice = stockPrice * 1.15;
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
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.4)');
    gradient.addColorStop(1, 'rgba(239, 68, 68, 0.3)');
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.strokeStyle = THEME_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, toY(p.pl)) : ctx.lineTo(p.x, toY(p.pl)));
    ctx.stroke();

    // Mark ATM strike
    const strikeX = ((strikePrice - minPrice) / (maxPrice - minPrice)) * W;
    ctx.strokeStyle = '#10b981';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(strikeX, 0);
    ctx.lineTo(strikeX, H);
    ctx.stroke();
    ctx.setLineDash([]);

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
  }, [stockPrice, strikePrice, frontPremium, backPremium, hoverX]);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0f1a', color: '#e2e8f0', fontFamily: 'DM Sans, sans-serif', padding: '40px 20px' }}>
      <PageSEO title="Calendar Spread Strategy — Time Decay Trading" description="Trade calendar spreads to profit from time decay differentials between near and far-dated options. Learn entry timing, volatility requirements, and adjustment techniques." path="/strategies/calendar-spread" />
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

      {/* App Header */}
      <BrandBar surface="invest" authState="in" user={user} onSignOut={signOut} />

      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <button onClick={() => navigate('/strategies')} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 14, cursor: 'pointer', marginBottom: 30, display: 'flex', alignItems: 'center', gap: 6 }}>
          ← Back to Strategy Library
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40 }}>
          <div style={{ fontSize: 48 }}>📅</div>
          <div>
            <h1 style={{ fontSize: 36, fontWeight: 800, margin: 0, marginBottom: 4 }}>Calendar Spread</h1>
            <p style={{ fontSize: 16, color: '#94a3b8', margin: 0 }}>Profit from the passage of time</p>
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
                  { emoji: '⏰', title: 'Time Harvester', desc: 'Front month decays faster than back month — profit from the time spread' },
                  { emoji: '🎯', title: 'Pin the Strike', desc: 'Max profit when stock sits exactly at your strike price' },
                  { emoji: '📊', title: 'Volatility Play', desc: 'Benefits from rising IV after you open the trade' },
                  { emoji: '🔒', title: 'Defined Risk', desc: 'Max loss is net debit paid — can\'t lose more than initial cost' }
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
                  { num: 1, text: 'Sell a front-month call (30 DTE) at your target strike' },
                  { num: 2, text: 'Buy a back-month call (60 DTE) at the SAME strike' },
                  { num: 3, text: 'Net debit = your max loss' },
                  { num: 4, text: 'As time passes, front decays faster — profit from the difference' }
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
                  { label: 'Risk', value: 2, color: '#ef4444' },
                  { label: 'Reward', value: 3, color: '#10b981' },
                  { label: 'Complexity', value: 3, color: '#f59e0b' },
                  { label: 'Win Rate', value: 3, color: THEME_COLOR }
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
                  <li>Opening when IV is already elevated — IV crush kills both legs equally</li>
                  <li>Stock moves too far from strike — both legs expire worthless</li>
                  <li>Not closing before front expiry — assignment risk on short call</li>
                  <li>Forgetting about earnings — calendar spreads hate binary events</li>
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
                      <input type="range" min="85" max="115" step="0.5" value={stockPrice} onChange={e => setStockPrice(parseFloat(e.target.value))} style={{ width: '100%' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Strike Price: ${strikePrice.toFixed(2)}</label>
                      <input type="range" min="90" max="110" step="0.5" value={strikePrice} onChange={e => setStrikePrice(parseFloat(e.target.value))} style={{ width: '100%' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Front Premium (30 DTE): ${frontPremium.toFixed(2)}</label>
                      <input type="range" min="1" max="6" step="0.1" value={frontPremium} onChange={e => setFrontPremium(parseFloat(e.target.value))} style={{ width: '100%' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Back Premium (60 DTE): ${backPremium.toFixed(2)}</label>
                      <input type="range" min="3" max="9" step="0.1" value={backPremium} onChange={e => setBackPremium(parseFloat(e.target.value))} style={{ width: '100%' }} />
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: THEME_COLOR }}>Live Stats</h2>
                <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Max Profit (Est.)</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#10b981', fontFamily: 'JetBrains Mono' }}>${maxProfit.toFixed(0)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Max Loss</div>
                    <div style={{ fontSize: 24, fontWeight: 700, color: '#ef4444', fontFamily: 'JetBrains Mono' }}>-${maxLoss.toFixed(0)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Net Debit</div>
                    <div style={{ fontSize: 20, fontWeight: 600, fontFamily: 'JetBrains Mono' }}>${(backPremium - frontPremium).toFixed(2)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Optimal Zone</div>
                    <div style={{ fontSize: 14, fontWeight: 600 }}>Stock @ ${strikePrice.toFixed(2)}</div>
                  </div>
                </div>

                <div style={{ marginTop: 24, background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: 16 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Position Legs</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#ef4444' }}>Sell Call (30 DTE)</span>
                      <span style={{ fontFamily: 'JetBrains Mono' }}>${strikePrice.toFixed(2)} (+${frontPremium.toFixed(2)})</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#10b981' }}>Buy Call (60 DTE)</span>
                      <span style={{ fontFamily: 'JetBrains Mono' }}>${strikePrice.toFixed(2)} (-${backPremium.toFixed(2)})</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: '1px solid #1e293b' }}>
                      <span style={{ fontWeight: 600 }}>Net Cost</span>
                      <span style={{ fontFamily: 'JetBrains Mono', color: THEME_COLOR }}>-${(backPremium - frontPremium).toFixed(2)}</span>
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
                  <li>Close at 40-50% profit — time decay maxes out around here</li>
                  <li>If stock pinned at strike with 7 DTE, take profit before gamma kicks in</li>
                  <li>IV spike after opening? Close immediately for windfall profit</li>
                </ul>
              </div>

              <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ fontSize: 24 }}>❌</div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#ef4444' }}>Cut Losses</h3>
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, lineHeight: 1.6 }}>
                  <li>Stock moves more than 5-7% away from strike — both legs lose value</li>
                  <li>IV crush hits — spread value collapses, exit at 50% loss</li>
                  <li>Front month approaching expiry with stock away from strike — close to avoid assignment</li>
                </ul>
              </div>

              <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ fontSize: 24 }}>⏰</div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#f59e0b' }}>Time-Based Exits</h3>
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, lineHeight: 1.6 }}>
                  <li>Close or roll by 3-5 DTE on front month to avoid pin risk</li>
                  <li>If profitable at 21 DTE, roll front to next month against same back</li>
                  <li>Never hold short call into expiration week if ITM</li>
                </ul>
              </div>

              <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ fontSize: 24 }}>🔧</div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: THEME_COLOR }}>Adjustment Triggers</h3>
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, lineHeight: 1.6 }}>
                  <li>Stock drifts away: roll strike to new ATM price</li>
                  <li>IV rank spikes: perfect entry for new calendar, close old one for profit</li>
                  <li>Earnings announced: exit immediately unless playing the IV expansion</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <Footer />
      <StrategyTutorPanel
        strategy="calendar_spread"
        strategyLabel="Calendar Spread"
        sliderValues={{}}
        isOpen={tutorOpen}
        onClose={() => setTutorOpen(false)}
      />
    </div>
  );
}
