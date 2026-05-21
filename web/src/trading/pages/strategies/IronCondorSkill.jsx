import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrandBar } from '../../../shared/components/BrandBar';
import { Footer } from '../../components/Footer';
import { useAuth } from '../../../shared/hooks/useAuth';
import PageSEO from '../../../shared/components/PageSEO';
import { StrategyTutorPanel } from '../../components/StrategyTutorPanel';

const STRATEGY_COLOR = '#06b6d4'; // Cyan accent for Iron Condor

export default function IronCondorSkill() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState('learn');
  const [tutorOpen, setTutorOpen] = useState(false);
  const canvasRef = useRef(null);
  const [hoverX, setHoverX] = useState(null);

  const [stockPrice, setStockPrice] = useState(100);
  const [shortPutStrike, setShortPutStrike] = useState(95);
  const [longPutStrike, setLongPutStrike] = useState(90);
  const [shortCallStrike, setShortCallStrike] = useState(105);
  const [longCallStrike, setLongCallStrike] = useState(110);
  const [putCredit, setPutCredit] = useState(1.5);
  const [callCredit, setCallCredit] = useState(1.5);

  useEffect(() => {
    document.title = 'Iron Condor Strategy | NewLeaf Invest';
  }, []);

  const calculatePL = (price) => {
    const totalCredit = putCredit + callCredit;
    let pl = totalCredit * 100;

    if (price < longPutStrike) {
      pl -= (longPutStrike - price) * 100;
      pl -= (shortPutStrike - longPutStrike) * 100;
    } else if (price < shortPutStrike) {
      pl -= (shortPutStrike - price) * 100;
    }

    if (price > longCallStrike) {
      pl -= (price - longCallStrike) * 100;
      pl -= (longCallStrike - shortCallStrike) * 100;
    } else if (price > shortCallStrike) {
      pl -= (price - shortCallStrike) * 100;
    }

    return pl;
  };

  const maxProfit = (putCredit + callCredit) * 100;
  const maxLoss = Math.max(
    (shortPutStrike - longPutStrike) * 100 - maxProfit,
    (longCallStrike - shortCallStrike) * 100 - maxProfit
  );
  const lowerBreakeven = shortPutStrike - (putCredit + callCredit);
  const upperBreakeven = shortCallStrike + (putCredit + callCredit);

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

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, W, H);

    const minPrice = stockPrice * 0.8;
    const maxPrice = stockPrice * 1.2;
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
    ctx.strokeStyle = '#9ca3af';
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
    const gradient = ctx.createLinearGradient(0, toY(maxPL), 0, toY(minPL));
    gradient.addColorStop(0, 'rgba(5, 150, 105, 0.1)');
    gradient.addColorStop(0.5, 'rgba(5, 150, 105, 0.05)');
    gradient.addColorStop(1, 'rgba(220, 38, 38, 0.08)');
    ctx.fillStyle = gradient;
    ctx.fill();

    ctx.strokeStyle = '#0B2D23';
    ctx.lineWidth = 2;
    ctx.beginPath();
    points.forEach((p, i) => i === 0 ? ctx.moveTo(p.x, toY(p.pl)) : ctx.lineTo(p.x, toY(p.pl)));
    ctx.stroke();

    ctx.fillStyle = '#C9A96E';
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
      ctx.strokeStyle = '#C9A96E';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 2]);
      ctx.beginPath();
      ctx.moveTo(hoverX, 0);
      ctx.lineTo(hoverX, H);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = 'white';
      ctx.strokeStyle = '#e5e7eb';
      ctx.lineWidth = 1;
      ctx.fillRect(hoverX - 60, 10, 120, 40);
      ctx.strokeRect(hoverX - 60, 10, 120, 40);
      ctx.fillStyle = '#111827';
      ctx.font = '11px IBM Plex Mono';
      ctx.textAlign = 'center';
      ctx.fillText(`$${price.toFixed(2)}`, hoverX, 27);
      ctx.fillStyle = pl >= 0 ? '#059669' : '#dc2626';
      ctx.fillText(`${pl >= 0 ? '+' : ''}$${pl.toFixed(0)}`, hoverX, 42);
    }
  }, [stockPrice, shortPutStrike, longPutStrike, shortCallStrike, longCallStrike, putCredit, callCredit, hoverX]);

  return (
    <div style={{ minHeight: '100vh', background: '#ffffff', color: '#111827', fontFamily: "'DM Sans', sans-serif", padding: '0' }}>
      <PageSEO title="Iron Condor Strategy — Options Income" description="Learn the iron condor options strategy: sell both a put spread and call spread to collect premium in range-bound markets. See live scanner results, entry rules, and adjustment triggers." path="/strategies/iron-condor" />
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=Fraunces:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" />

      {/* App Header */}
      <BrandBar surface="invest" authState="in" user={user} onSignOut={signOut} />

      {/* Header */}
      <div style={{ background: '#ffffff', borderBottom: '1px solid rgba(17,24,39,0.08)', padding: '40px 24px 36px' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <button onClick={() => navigate('/strategies')} style={{
            background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer',
            fontSize: 13, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6,
            padding: 0
          }}>← Back to Strategy Library</button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 8 }}>
            <div style={{
              background: STRATEGY_COLOR, borderRadius: 14, width: 48, height: 48,
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
            }}>🛡️</div>
            <div>
              <h1 style={{ margin: 0, fontSize: 32, fontWeight: 800, color: '#111827', fontFamily: "'Fraunces', Georgia, serif" }}>Iron Condor</h1>
              <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 15 }}>Get paid when a stock stays in a range</p>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '32px 24px 60px' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 32 }}>
          <div style={{ display: 'flex', gap: 4, background: '#f3f4f6', borderRadius: 16, padding: 4, maxWidth: 360 }}>
            {['learn', 'build', 'manage'].map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)} style={{
                flex: 1, padding: '10px 20px', borderRadius: 14, fontSize: 13, fontWeight: 750, border: 'none',
                background: activeTab === tab ? '#0B2D23' : 'transparent',
                color: activeTab === tab ? '#ffffff' : 'rgba(17,24,39,0.70)',
                cursor: 'pointer', transition: 'all 0.15s', textTransform: 'uppercase', letterSpacing: '0.04em'
              }}>{tab}</button>
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
              <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, color: '#0B2D23', fontFamily: "'Fraunces', Georgia, serif" }}>What does it feel like?</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20 }}>
                {[
                  { emoji: '💰', title: 'Steady Income', desc: 'Collect premium upfront, keep it if stock stays calm' },
                  { emoji: '🎯', title: 'Range Bound', desc: 'Profit when stock trades in the middle, not at extremes' },
                  { emoji: '⏰', title: 'Time Decay Friend', desc: 'Every day that passes, you make money (theta positive)' },
                  { emoji: '🔒', title: 'Defined Risk', desc: 'You know max loss from day one — wings protect you' }
                ].map(item => (
                  <div key={item.title} style={{ background: 'white', border: '1px solid rgba(17,24,39,0.08)', borderRadius: 18, padding: 24, boxShadow: '0 14px 30px rgba(17,24,39,0.06)' }}>
                    <div style={{ fontSize: 32, marginBottom: 12 }}>{item.emoji}</div>
                    <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: '#111827' }}>{item.title}</div>
                    <div style={{ fontSize: 14, color: '#6b7280', lineHeight: 1.6 }}>{item.desc}</div>
                  </div>
                ))}
              </div>
            </section>

            <section style={{ marginBottom: 48 }}>
              <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, color: '#0B2D23', fontFamily: "'Fraunces', Georgia, serif" }}>How does it work?</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  { num: 1, text: 'Sell a put spread below the current price (sell higher put, buy lower put)' },
                  { num: 2, text: 'Sell a call spread above the current price (sell lower call, buy higher call)' },
                  { num: 3, text: 'Collect premium from both sides — this is your max profit' },
                  { num: 4, text: 'If stock stays between your short strikes, both spreads expire worthless and you keep all the credit' }
                ].map(step => (
                  <div key={step.num} style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    <div style={{ width: 32, height: 32, borderRadius: 16, background: '#0B2D23', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, flexShrink: 0, fontSize: 15 }}>{step.num}</div>
                    <div style={{ fontSize: 15, lineHeight: 1.6, paddingTop: 4, color: '#374151' }}>{step.text}</div>
                  </div>
                ))}
              </div>
            </section>

            <section style={{ marginBottom: 48 }}>
              <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, color: '#0B2D23', fontFamily: "'Fraunces', Georgia, serif" }}>Risk Profile</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {[
                  { label: 'Risk', value: 3, color: '#dc2626' },
                  { label: 'Reward', value: 2, color: '#059669' },
                  { label: 'Complexity', value: 3, color: '#d97706' },
                  { label: 'Win Rate', value: 4, color: STRATEGY_COLOR }
                ].map(metric => (
                  <div key={metric.label} style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ width: 120, fontSize: 14, fontWeight: 600, color: '#374151' }}>{metric.label}</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div key={i} style={{ width: 6, height: 6, borderRadius: 3, background: i < metric.value ? metric.color : '#e5e7eb' }} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section>
              <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, color: '#dc2626', fontFamily: "'Fraunces', Georgia, serif" }}>⚠️ Why beginners lose money</h2>
              <div style={{ background: '#fef2f2', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 18, padding: 24 }}>
                <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 12, fontSize: 14, lineHeight: 1.7, color: '#374151' }}>
                  <li>Placing the trade before earnings — IV crush wipes out your wings' protection</li>
                  <li>Making the wings too narrow to save money — one big move and you hit max loss</li>
                  <li>Holding until expiration when stock approaches a short strike — gamma risk explodes</li>
                  <li>Not taking profit at 50% — greed turns winners into losers</li>
                </ul>
              </div>
            </section>
          </div>
        )}

        {activeTab === 'build' && (
          <div>
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 32 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: '#0B2D23', fontFamily: "'Fraunces', Georgia, serif" }}>Payoff Diagram</h2>
                <canvas
                  ref={canvasRef}
                  style={{ width: 600, height: 260, borderRadius: 12, cursor: 'crosshair', border: '1px solid #e5e7eb', display: 'block' }}
                  onMouseMove={e => {
                    const rect = e.target.getBoundingClientRect();
                    setHoverX(e.clientX - rect.left);
                  }}
                  onMouseLeave={() => setHoverX(null)}
                />

                <div style={{ marginTop: 32 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: '#111827' }}>Parameters</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {[
                      { label: 'Stock Price', value: stockPrice, setter: setStockPrice, min: 80, max: 120 },
                      { label: 'Short Put Strike', value: shortPutStrike, setter: setShortPutStrike, min: 85, max: 100 },
                      { label: 'Long Put Strike', value: longPutStrike, setter: setLongPutStrike, min: 80, max: 95 },
                      { label: 'Short Call Strike', value: shortCallStrike, setter: setShortCallStrike, min: 100, max: 115 },
                      { label: 'Long Call Strike', value: longCallStrike, setter: setLongCallStrike, min: 105, max: 120 },
                      { label: 'Put Credit', value: putCredit, setter: setPutCredit, min: 0.5, max: 3, step: 0.1 },
                      { label: 'Call Credit', value: callCredit, setter: setCallCredit, min: 0.5, max: 3, step: 0.1 }
                    ].map(param => (
                      <div key={param.label}>
                        <label style={{ fontSize: 13, color: '#374151', display: 'block', marginBottom: 6, fontWeight: 500 }}>
                          {param.label}: <span style={{ fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600, color: '#111827' }}>${param.value.toFixed(2)}</span>
                        </label>
                        <input type="range" min={param.min} max={param.max} step={param.step || 0.5} value={param.value} onChange={e => param.setter(parseFloat(e.target.value))} style={{ width: '100%', accentColor: '#0B2D23' }} />
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, marginBottom: 20, color: '#0B2D23', fontFamily: "'Fraunces', Georgia, serif" }}>Live Stats</h2>
                <div style={{ background: '#F7F8FA', border: '1px solid rgba(17,24,39,0.08)', borderRadius: 14, padding: 20, display: 'flex', flexDirection: 'column', gap: 20 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'rgba(17,24,39,0.60)', marginBottom: 4 }}>Max Profit</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: '#059669', fontFamily: "'IBM Plex Mono', monospace" }}>${maxProfit.toFixed(0)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'rgba(17,24,39,0.60)', marginBottom: 4 }}>Max Loss</div>
                    <div style={{ fontSize: 24, fontWeight: 900, color: '#dc2626', fontFamily: "'IBM Plex Mono', monospace" }}>-${maxLoss.toFixed(0)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'rgba(17,24,39,0.60)', marginBottom: 4 }}>Lower Breakeven</div>
                    <div style={{ fontSize: 20, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace", color: '#111827' }}>${lowerBreakeven.toFixed(2)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'rgba(17,24,39,0.60)', marginBottom: 4 }}>Upper Breakeven</div>
                    <div style={{ fontSize: 20, fontWeight: 600, fontFamily: "'IBM Plex Mono', monospace", color: '#111827' }}>${upperBreakeven.toFixed(2)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'rgba(17,24,39,0.60)', marginBottom: 4 }}>Win Rate (Est.)</div>
                    <div style={{ fontSize: 20, fontWeight: 600, color: STRATEGY_COLOR, fontFamily: "'IBM Plex Mono', monospace" }}>~65%</div>
                  </div>
                </div>

                <div style={{ marginTop: 24, background: 'white', border: '1px solid rgba(17,24,39,0.08)', borderRadius: 14, padding: 16, boxShadow: '0 14px 30px rgba(17,24,39,0.06)' }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 12, color: '#111827' }}>Position Legs</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#374151' }}>
                      <span style={{ color: '#dc2626', fontWeight: 600 }}>Sell Put</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>${shortPutStrike.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#374151' }}>
                      <span style={{ color: '#059669', fontWeight: 600 }}>Buy Put</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>${longPutStrike.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#374151' }}>
                      <span style={{ color: '#dc2626', fontWeight: 600 }}>Sell Call</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>${shortCallStrike.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#374151' }}>
                      <span style={{ color: '#059669', fontWeight: 600 }}>Buy Call</span>
                      <span style={{ fontFamily: "'IBM Plex Mono', monospace" }}>${longCallStrike.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'manage' && (
          <div>
            <h2 style={{ fontSize: 24, fontWeight: 700, marginBottom: 24, color: '#0B2D23', fontFamily: "'Fraunces', Georgia, serif" }}>Exit Rules</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {[
                { icon: '✅', title: 'Take Profit', color: '#059669', items: [
                  'Close at 50% of max profit (best risk/reward)',
                  'Close at 75% if hit within first week',
                  'Consider closing if stock moves toward center of profit zone'
                ]},
                { icon: '❌', title: 'Cut Losses', color: '#dc2626', items: [
                  'Exit if loss reaches 2x max profit (200% loss)',
                  'Close immediately if stock breaks through a short strike with momentum',
                  'Consider closing threatened side and keeping winning side'
                ]},
                { icon: '⏰', title: 'Time-Based Exits', color: '#d97706', items: [
                  'Never hold past 7 DTE (gamma risk becomes extreme)',
                  'If untested at 21 DTE, consider rolling to next cycle',
                  'Close both sides by 3 DTE regardless of P/L'
                ]},
                { icon: '🔧', title: 'Adjustment Triggers', color: '#0B2D23', items: [
                  'If stock breaches short strike: close threatened side, roll untested side closer',
                  'If IV rank drops below 30: theta decay accelerates, consider early close',
                  'Earnings announced during hold period: close immediately'
                ]}
              ].map(section => (
                <div key={section.title} style={{ background: 'white', border: '1px solid rgba(17,24,39,0.08)', borderRadius: 18, padding: 24, boxShadow: '0 14px 30px rgba(17,24,39,0.06)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div style={{ fontSize: 24 }}>{section.icon}</div>
                    <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: section.color }}>{section.title}</h3>
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, lineHeight: 1.6, color: '#374151' }}>
                    {section.items.map((item, i) => <li key={i}>{item}</li>)}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <Footer />

      {/* AI Strategy Tutor */}
      <StrategyTutorPanel
        strategy="iron_condor"
        strategyLabel="Iron Condor"
        sliderValues={{ stockPrice, shortPutStrike, longPutStrike, shortCallStrike, longCallStrike, putCredit, callCredit }}
        isOpen={tutorOpen}
        onClose={() => setTutorOpen(false)}
      />
    </div>
  );
}
