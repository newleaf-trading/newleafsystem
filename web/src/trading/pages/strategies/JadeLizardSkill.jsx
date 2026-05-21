import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { StrategyTutorPanel } from '../../components/StrategyTutorPanel';

const THEME_COLOR = '#84cc16';

export default function JadeLizardSkill() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('learn');
  const [tutorOpen, setTutorOpen] = useState(false);
  const canvasRef = useRef(null);
  const [hoverX, setHoverX] = useState(null);

  const [stockPrice, setStockPrice] = useState(100);
  const [putStrike, setPutStrike] = useState(95);
  const [shortCallStrike, setShortCallStrike] = useState(105);
  const [longCallStrike, setLongCallStrike] = useState(110);
  const [putPremium, setPutPremium] = useState(2);
  const [callSpreadCredit, setCallSpreadCredit] = useState(1.5);

  useEffect(() => {
    document.title = 'Jade Lizard Strategy | NewLeaf Invest';
  }, []);

  const totalCredit = putPremium + callSpreadCredit;
  const callSpreadWidth = longCallStrike - shortCallStrike;
  const lizardRulePass = totalCredit >= callSpreadWidth;

  const calculatePL = (price) => {
    let pl = totalCredit * 100;

    // Short put payoff
    if (price < putStrike) {
      pl -= (putStrike - price) * 100;
    }

    // Call spread payoff
    if (price > longCallStrike) {
      pl -= (price - longCallStrike) * 100;
      pl -= (longCallStrike - shortCallStrike) * 100;
    } else if (price > shortCallStrike) {
      pl -= (price - shortCallStrike) * 100;
    }

    return pl;
  };

  const maxProfit = totalCredit * 100;
  const maxLossDownside = (putStrike * 100) - totalCredit * 100; // If stock goes to 0
  const maxLossUpside = lizardRulePass ? 0 : (callSpreadWidth - totalCredit) * 100;

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
    gradient.addColorStop(0, 'rgba(132, 204, 22, 0.4)');
    gradient.addColorStop(0.5, 'rgba(16, 185, 129, 0.4)');
    gradient.addColorStop(1, 'rgba(132, 204, 22, 0.3)');
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
  }, [stockPrice, putStrike, shortCallStrike, longCallStrike, putPremium, callSpreadCredit, hoverX]);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0f1a', color: '#e2e8f0', fontFamily: 'DM Sans, sans-serif', padding: '40px 20px' }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

      <div style={{ maxWidth: 1200, margin: '0 auto' }}>
        <button onClick={() => navigate('/strategies')} style={{ background: 'transparent', border: 'none', color: '#94a3b8', fontSize: 14, cursor: 'pointer', marginBottom: 30, display: 'flex', alignItems: 'center', gap: 6 }}>
          ← Back to Strategy Library
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 40 }}>
          <div style={{ fontSize: 48 }}>🦎</div>
          <div>
            <h1 style={{ fontSize: 36, fontWeight: 800, margin: 0, marginBottom: 4 }}>Jade Lizard</h1>
            <p style={{ fontSize: 16, color: '#94a3b8', margin: 0 }}>Collect premium from both sides with no upside risk</p>
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
                  { emoji: '🦎', title: 'Double Dipper', desc: 'Collect premium from short put AND short call spread' },
                  { emoji: '🎯', title: 'No Upside Risk', desc: 'Credit ≥ call spread width = zero risk if stock moons' },
                  { emoji: '💰', title: 'High Credit', desc: 'Bigger premium than naked put, safer than naked call' },
                  { emoji: '⚠️', title: 'Naked Put Risk', desc: 'Full downside exposure on put side — use with caution' }
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
                  { num: 1, text: 'Sell a put below current price (collect premium)' },
                  { num: 2, text: 'Sell a call above current price (collect premium)' },
                  { num: 3, text: 'Buy a higher call for protection (pay less premium)' },
                  { num: 4, text: 'GOLDEN RULE: Total credit ≥ call spread width = NO UPSIDE RISK' }
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
                  { label: 'Risk', value: 4, color: '#ef4444' },
                  { label: 'Reward', value: 3, color: '#10b981' },
                  { label: 'Complexity', value: 4, color: '#f59e0b' },
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
                  <li>Violating the Lizard Rule — credit less than call spread width = upside risk</li>
                  <li>Stock crashes through put strike — naked put exposure is painful</li>
                  <li>Opening with insufficient margin — broker liquidates during volatility spike</li>
                  <li>Not managing when put gets tested — letting naked put become disaster</li>
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
                      <input type="range" min="70" max="130" step="0.5" value={stockPrice} onChange={e => setStockPrice(parseFloat(e.target.value))} style={{ width: '100%' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Put Strike: ${putStrike.toFixed(2)}</label>
                      <input type="range" min="80" max="100" step="0.5" value={putStrike} onChange={e => setPutStrike(parseFloat(e.target.value))} style={{ width: '100%' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Short Call Strike: ${shortCallStrike.toFixed(2)}</label>
                      <input type="range" min="100" max="115" step="0.5" value={shortCallStrike} onChange={e => setShortCallStrike(parseFloat(e.target.value))} style={{ width: '100%' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Long Call Strike: ${longCallStrike.toFixed(2)}</label>
                      <input type="range" min="105" max="120" step="0.5" value={longCallStrike} onChange={e => setLongCallStrike(parseFloat(e.target.value))} style={{ width: '100%' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Put Premium: ${putPremium.toFixed(2)}</label>
                      <input type="range" min="0.5" max="4" step="0.1" value={putPremium} onChange={e => setPutPremium(parseFloat(e.target.value))} style={{ width: '100%' }} />
                    </div>
                    <div>
                      <label style={{ fontSize: 13, color: '#94a3b8', display: 'block', marginBottom: 6 }}>Call Spread Credit: ${callSpreadCredit.toFixed(2)}</label>
                      <input type="range" min="0.5" max="3" step="0.1" value={callSpreadCredit} onChange={e => setCallSpreadCredit(parseFloat(e.target.value))} style={{ width: '100%' }} />
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
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Max Loss (Downside)</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#ef4444', fontFamily: 'JetBrains Mono' }}>-${maxLossDownside.toFixed(0)}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Max Loss (Upside)</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: lizardRulePass ? '#10b981' : '#ef4444', fontFamily: 'JetBrains Mono' }}>
                      {lizardRulePass ? '$0 ✅' : `-$${maxLossUpside.toFixed(0)} ❌`}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: '#64748b', marginBottom: 4 }}>Total Credit</div>
                    <div style={{ fontSize: 20, fontWeight: 600, color: THEME_COLOR, fontFamily: 'JetBrains Mono' }}>${totalCredit.toFixed(2)}</div>
                  </div>
                </div>

                <div style={{ marginTop: 24, background: lizardRulePass ? '#14532d' : '#7f1d1d', border: `2px solid ${lizardRulePass ? '#22c55e' : '#ef4444'}`, borderRadius: 8, padding: 16 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, color: lizardRulePass ? '#22c55e' : '#ef4444', display: 'flex', alignItems: 'center', gap: 8 }}>
                    {lizardRulePass ? '✅' : '❌'} Lizard Rule
                  </h3>
                  <div style={{ fontSize: 12, lineHeight: 1.6, color: '#e2e8f0', marginBottom: 8 }}>
                    Credit ≥ Call Spread Width
                  </div>
                  <div style={{ fontFamily: 'JetBrains Mono', fontSize: 13, fontWeight: 600 }}>
                    ${totalCredit.toFixed(2)} {lizardRulePass ? '≥' : '<'} ${callSpreadWidth.toFixed(2)}
                  </div>
                  <div style={{ fontSize: 11, marginTop: 8, color: '#94a3b8' }}>
                    {lizardRulePass ? 'No upside risk! 🦎' : 'Upside risk exists! Fix strikes or premiums.'}
                  </div>
                </div>

                <div style={{ marginTop: 16, background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: 16 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Position Legs</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#ef4444' }}>Sell Put</span>
                      <span style={{ fontFamily: 'JetBrains Mono' }}>${putStrike.toFixed(2)} (+${putPremium.toFixed(2)})</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#ef4444' }}>Sell Call</span>
                      <span style={{ fontFamily: 'JetBrains Mono' }}>${shortCallStrike.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#10b981' }}>Buy Call</span>
                      <span style={{ fontFamily: 'JetBrains Mono' }}>${longCallStrike.toFixed(2)}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 4, fontSize: 11, color: '#94a3b8' }}>
                      <span>Call Spread Net</span>
                      <span style={{ fontFamily: 'JetBrains Mono' }}>+${callSpreadCredit.toFixed(2)}</span>
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
                  <li>Close at 50% of max profit — risk/reward shifts unfavorably after that</li>
                  <li>If stock rallies well above short call, take profit early (upside maxed out)</li>
                  <li>Stock pinned between put and call with 7 DTE? Take the win and close.</li>
                </ul>
              </div>

              <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ fontSize: 24 }}>❌</div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#ef4444' }}>Cut Losses</h3>
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, lineHeight: 1.6 }}>
                  <li>Put gets tested: close immediately at 2x max profit loss</li>
                  <li>Stock crashes with momentum: don't wait — naked put risk is unlimited</li>
                  <li>Lizard Rule violated during adjustment: close and reassess</li>
                </ul>
              </div>

              <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ fontSize: 24 }}>⏰</div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: '#f59e0b' }}>Time-Based Exits</h3>
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, lineHeight: 1.6 }}>
                  <li>Close or roll by 7 DTE — assignment risk on put is real</li>
                  <li>If profitable at 21 DTE, consider rolling entire position to next cycle</li>
                  <li>Never hold naked put into expiration week if near strike</li>
                </ul>
              </div>

              <div style={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, padding: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ fontSize: 24 }}>🔧</div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, margin: 0, color: THEME_COLOR }}>Adjustment Triggers</h3>
                </div>
                <ul style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 8, fontSize: 14, lineHeight: 1.6 }}>
                  <li>Put breached: roll put down and out, check Lizard Rule still valid</li>
                  <li>Stock rallies past short call: let it go, you keep max profit</li>
                  <li>IV spike: excellent time to close for profit — all legs gain value</li>
                </ul>
              </div>
            </div>
          </div>
        )}
      </div>
      <StrategyTutorPanel
        strategy="jade_lizard"
        strategyLabel="Jade Lizard"
        sliderValues={{}}
        isOpen={tutorOpen}
        onClose={() => setTutorOpen(false)}
      />
    </div>
  );
}
