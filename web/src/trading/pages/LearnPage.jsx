import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PageSEO from '../../shared/components/PageSEO';

const strategies = [
  { id: "iron-condor", name: "Iron Condor", icon: "🛡️", emoji: "🛡️", color: "#06b6d4", gradient: "linear-gradient(135deg, #06b6d4, #0891b2)",
    tagline: "Get paid when a stock stays in a range", winStyle: "Steady Income", winIcon: "💰",
    category: "income", complexity: 2, risk: 3, reward: 2,
    oneLiner: "Like collecting rent — you earn income as long as the price doesn't move too far in either direction.",
    bestFor: "Calm markets, high IV, neutral outlook" },
  { id: "double-diagonal", name: "Double Diagonal", icon: "🔀", emoji: "🔀", color: "#a855f7", gradient: "linear-gradient(135deg, #a855f7, #7c3aed)",
    tagline: "Iron Condor with a time twist", winStyle: "Renewable Income", winIcon: "🔄",
    category: "income", complexity: 4, risk: 3, reward: 3,
    oneLiner: "Sell short-term options, buy longer-term protection — collecting income while the calendar works in your favour.",
    bestFor: "Range-bound stocks, upward term structure" },
  { id: "bull-put-spread", name: "Bull Put Spread", icon: "📈", emoji: "📈", color: "#10b981", gradient: "linear-gradient(135deg, #10b981, #059669)",
    tagline: "Get paid for believing a stock won't fall", winStyle: "Insurance Seller", winIcon: "🏦",
    category: "directional", complexity: 1, risk: 2, reward: 2,
    oneLiner: "You collect money upfront and keep it if the stock stays above your floor price.",
    bestFor: "Mildly bullish, support levels nearby" },
  { id: "bear-put-spread", name: "Bear Put Spread", icon: "📉", emoji: "📉", color: "#f43f5e", gradient: "linear-gradient(135deg, #f43f5e, #be123c)",
    tagline: "Profit when a stock drops — with limited risk", winStyle: "Targeted Strike", winIcon: "🎯",
    category: "directional", complexity: 1, risk: 2, reward: 3,
    oneLiner: "Pay a small amount upfront and make money if the stock falls below your target.",
    bestFor: "Bearish conviction, catalyst ahead" },
  { id: "covered-call-prot-put", name: "Covered Call + Protective Put", icon: "🏠", emoji: "🏠", color: "#f59e0b", gradient: "linear-gradient(135deg, #f59e0b, #d97706)",
    tagline: "Own the stock, collect income, sleep well", winStyle: "Property Income", winIcon: "🏠",
    category: "income", complexity: 2, risk: 2, reward: 2,
    oneLiner: "Like owning a rental property with insurance — income flows in while your downside is protected.",
    bestFor: "Long-term holders, income seekers" },
  { id: "calendar-spread", name: "Calendar Spread", icon: "📅", emoji: "📅", color: "#6366f1", gradient: "linear-gradient(135deg, #6366f1, #4f46e5)",
    tagline: "Profit from the passage of time", winStyle: "Time Harvester", winIcon: "⏰",
    category: "income", complexity: 3, risk: 2, reward: 3,
    oneLiner: "Sell a short-term option and buy a longer-term one at the same strike — the short one decays faster.",
    bestFor: "Stable stocks, low-volatility expected" },
  { id: "straddle-strangle", name: "Straddle & Strangle", icon: "💥", emoji: "💥", color: "#f97316", gradient: "linear-gradient(135deg, #f97316, #ea580c)",
    tagline: "Profit from big moves — either direction", winStyle: "Earthquake Bet", winIcon: "💥",
    category: "volatility", complexity: 2, risk: 3, reward: 5,
    oneLiner: "You don't need to predict which way, just that the stock will move dramatically.",
    bestFor: "Pre-earnings, FDA decisions, macro events" },
  { id: "butterfly", name: "Butterfly Spread", icon: "🦋", emoji: "🦋", color: "#ec4899", gradient: "linear-gradient(135deg, #ec4899, #db2777)",
    tagline: "A sniper shot at a specific price", winStyle: "Sniper Shot", winIcon: "🎯",
    category: "precision", complexity: 2, risk: 1, reward: 4,
    oneLiner: "Pay very little, and if the stock lands exactly where you predict, the reward is massive relative to cost.",
    bestFor: "Pinpointing a target price" },
  { id: "collar", name: "Collar", icon: "🔒", emoji: "🔒", color: "#14b8a6", gradient: "linear-gradient(135deg, #14b8a6, #0d9488)",
    tagline: "Lock in your stock gains with guardrails", winStyle: "Sleep Well", winIcon: "🔒",
    category: "protection", complexity: 1, risk: 1, reward: 2,
    oneLiner: "Cap your upside to pay for downside protection — like buying car insurance by selling future appreciation.",
    bestFor: "Protecting gains, uncertain markets" },
  { id: "jade-lizard", name: "Jade Lizard", icon: "🦎", emoji: "🦎", color: "#84cc16", gradient: "linear-gradient(135deg, #84cc16, #65a30d)",
    tagline: "No upside risk — the lizard's trick", winStyle: "Double Dipper", winIcon: "🦎",
    category: "income", complexity: 4, risk: 4, reward: 4,
    oneLiner: "Collect premium from both sides. If total credit exceeds call spread width, you can't lose money to the upside.",
    bestFor: "High IV, put skew, neutral-bullish" },
];

const categories = [
  { id: "all", label: "All Strategies", icon: "✨" },
  { id: "income", label: "Income", icon: "💰" },
  { id: "directional", label: "Directional", icon: "📊" },
  { id: "volatility", label: "Volatility", icon: "💥" },
  { id: "protection", label: "Protection", icon: "🛡️" },
  { id: "precision", label: "Precision", icon: "🎯" },
];

const routeMap = {
  'iron-condor': 'iron-condor',
  'double-diagonal': 'double-diagonal',
  'bull-put-spread': 'bull-put-spread',
  'bear-put-spread': 'bear-put-spread',
  'covered-call-prot-put': 'covered-call',
  'calendar-spread': 'calendar-spread',
  'straddle-strangle': 'straddle-strangle',
  'butterfly': 'butterfly',
  'collar': 'collar',
  'jade-lizard': 'jade-lizard',
};

function ComplexityDots({ value, max = 5, color }) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {Array.from({ length: max }).map((_, i) => (
        <div key={i} style={{ width: 6, height: 6, borderRadius: 3, background: i < value ? color : "#e5e7eb" }} />
      ))}
    </div>
  );
}

function StrategyCard({ strategy, onClick }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onClick={() => onClick(strategy.id)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "white",
        border: `1px solid ${hovered ? strategy.color + "33" : "rgba(17, 24, 39, 0.08)"}`,
        borderRadius: 18, padding: 0, cursor: "pointer",
        transition: "all 0.3s cubic-bezier(0.4, 0, 0.2, 1)",
        transform: hovered ? "translateY(-4px)" : "translateY(0)",
        boxShadow: hovered ? `0 14px 30px ${strategy.color}20, 0 4px 12px rgba(17, 24, 39, 0.08)` : "0 14px 30px rgba(17, 24, 39, 0.06)",
        overflow: "hidden", position: "relative",
      }}
    >
      <div style={{ height: 3, background: strategy.gradient, opacity: hovered ? 1 : 0.7, transition: "opacity 0.3s" }} />
      <div style={{ padding: "20px 20px 16px" }}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <div style={{
              background: strategy.gradient, borderRadius: 14, width: 40, height: 40,
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
              boxShadow: hovered ? `0 4px 16px ${strategy.color}40` : `0 2px 8px ${strategy.color}20`, transition: "box-shadow 0.3s",
            }}>{strategy.emoji}</div>
            <div>
              <div style={{ fontWeight: 700, fontSize: 16, color: "#111827", lineHeight: 1.2, fontFamily: "'Fraunces', Georgia, serif" }}>{strategy.name}</div>
              <div style={{ fontSize: 11, color: strategy.color, fontWeight: 600, marginTop: 2 }}>{strategy.winStyle} {strategy.winIcon}</div>
            </div>
          </div>
        </div>
        <div style={{ fontSize: 14, color: "#6b7280", lineHeight: 1.5, marginBottom: 16, minHeight: 42 }}>{strategy.oneLiner}</div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12 }}>
          {[
            { label: "Risk", value: strategy.risk, color: strategy.risk <= 2 ? "#059669" : strategy.risk <= 3 ? "#d97706" : "#dc2626" },
            { label: "Reward", value: strategy.reward, color: "#059669" },
            { label: "Complexity", value: strategy.complexity, color: strategy.color },
          ].map((m, i) => (
            <div key={i} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "rgba(17,24,39,0.60)", fontWeight: 700, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>{m.label}</div>
              <ComplexityDots value={m.value} color={m.color} />
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: "#374151", background: "#f9fafb", border: "1px solid rgba(17,24,39,0.08)", borderRadius: 8, padding: "8px 12px", display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ color: strategy.color, fontSize: 8 }}>●</span>{strategy.bestFor}
        </div>
      </div>
      <div style={{
        background: hovered ? `${strategy.color}08` : "#f9fafb",
        borderTop: "1px solid rgba(17,24,39,0.08)",
        padding: "12px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", transition: "all 0.3s",
      }}>
        <span style={{ fontSize: 12, color: hovered ? strategy.color : "#6b7280", fontWeight: 600, transition: "color 0.3s" }}>Learn this strategy</span>
        <span style={{ fontSize: 14, color: hovered ? strategy.color : "#9ca3af", transition: "all 0.3s", transform: hovered ? "translateX(4px)" : "translateX(0)" }}>→</span>
      </div>
    </div>
  );
}

export function LearnPage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = strategies.filter(s => {
    const matchCat = filter === "all" || s.category === filter;
    const matchSearch = !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.tagline.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const handleClick = (id) => navigate(`/strategies/${routeMap[id] || id}`);

  return (
    <div className="page-body">
      <PageSEO
        title="Learn Options Trading — NewLeaf Education"
        description="Free options trading education covering iron condors, bull put spreads, covered calls, calendar spreads, and more. Learn strategy mechanics, risk profiles, and when to use each."
        path="/learn"
      />
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 24, fontWeight: 600, marginBottom: 4 }}>Learn</h1>
        <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>Master options strategies with curated guides and learning paths</p>
      </div>

      {/* Featured Article */}
      <div className="learn-featured">
        <div>
          <div className="lf-tag">Featured Guide</div>
          <div className="lf-title">The Complete Guide to Income Strategies</div>
          <div className="lf-desc">
            Learn how to generate consistent monthly income using covered calls, iron condors,
            and credit spreads. Includes real portfolio examples and risk management frameworks.
          </div>
          <button className="lf-btn">Start Reading →</button>
        </div>
        <div className="lf-visual">📚</div>
      </div>

      {/* Strategy Guides */}
      <div className="section-label">Strategy Guides</div>
      <div className="guide-grid">
        {[
          { icon: '🦅', title: 'Iron Condor 101', desc: 'Profit from range-bound markets with limited risk. The bread and butter of income traders.' },
          { icon: '🛡️', title: 'Covered Calls', desc: 'Generate income from stock holdings. Best for steady income in flat to mildly bullish markets.' },
          { icon: '📐', title: 'Bull Put Spreads', desc: 'Bullish credit strategy with defined risk. Collect premium while maintaining downside protection.' },
          { icon: '📊', title: 'Diagonal Spreads', desc: 'Advanced strategy combining time decay and directional exposure across different expirations.' },
          { icon: '⚖️', title: 'Position Sizing', desc: 'How to size positions correctly based on account size, risk tolerance, and portfolio goals.' },
          { icon: '🔄', title: 'When to Roll', desc: 'Decision framework for rolling positions — when to extend, adjust strikes, or take the loss.' },
        ].map((guide, i) => (
          <div key={i} className="guide-card">
            <div className="guide-icon">{guide.icon}</div>
            <h4>{guide.title}</h4>
            <p>{guide.desc}</p>
          </div>
        ))}
      </div>

      {/* Learning Paths */}
      <div className="section-label">Learning Paths</div>
      <div className="path-grid">
        {[
          { title: 'Options Fundamentals', pct: 100 },
          { title: 'Income Strategies', pct: 75 },
          { title: 'Portfolio Construction', pct: 30 },
          { title: 'Advanced Adjustments', pct: 0 },
        ].map((path, i) => (
          <div key={i} className="path-card">
            <h4>{path.title}</h4>
            <div className="path-progress-bar">
              <div className="path-progress-fill" style={{ width: `${path.pct}%` }} />
            </div>
            <div className="path-pct">
              {path.pct === 100 ? '✓ Complete' : path.pct === 0 ? 'Not started' : `${path.pct}% complete`}
            </div>
          </div>
        ))}
      </div>

      {/* Strategy Library Section */}
      <div style={{ marginTop: 48, paddingTop: 32, borderTop: '1px solid rgba(17,24,39,0.08)' }}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontFamily: 'var(--serif)', fontSize: 22, fontWeight: 600, marginBottom: 8 }}>Strategy Library</h2>
          <p style={{ fontSize: 13, color: 'var(--gray-500)' }}>10 battle-tested strategies with interactive payoff charts and risk profiles</p>
        </div>

        {/* Search & Filters */}
        <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 24 }}>
          <div style={{ position: "relative", flex: "0 0 280px" }}>
            <input
              type="text"
              placeholder="Search strategies..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 16px 10px 38px",
                background: "white",
                border: "1px solid rgba(17,24,39,0.12)",
                borderRadius: 12,
                color: "#111827",
                fontSize: 14,
                outline: "none"
              }}
            />
            <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#9ca3af" }}>🔍</span>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {categories.map(cat => (
              <button
                key={cat.id}
                onClick={() => setFilter(cat.id)}
                style={{
                  background: filter === cat.id ? "#0B2D23" : "white",
                  border: `1px solid ${filter === cat.id ? "#0B2D23" : "rgba(17,24,39,0.12)"}`,
                  borderRadius: 20,
                  padding: "7px 14px",
                  color: filter === cat.id ? "white" : "#6b7280",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 5,
                  transition: "all 0.2s"
                }}
              >
                <span style={{ fontSize: 12 }}>{cat.icon}</span>{cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Strategy Cards */}
        <div style={{ marginBottom: 16, fontSize: 13, color: '#6b7280' }}>
          Showing <span style={{ color: '#111827', fontWeight: 600 }}>{filtered.length}</span> {filtered.length === 1 ? 'strategy' : 'strategies'}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 20 }}>
          {filtered.map(s => (<StrategyCard key={s.id} strategy={s} onClick={handleClick} />))}
        </div>
        {filtered.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: "#6b7280", marginBottom: 8 }}>No strategies match your search</div>
            <div style={{ fontSize: 14, color: "#9ca3af" }}>Try a different keyword or clear filters</div>
          </div>
        )}
      </div>
    </div>
  );
}
