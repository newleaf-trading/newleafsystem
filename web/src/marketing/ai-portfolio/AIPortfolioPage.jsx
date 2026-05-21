/**
 * /ai-portfolio — NewLeaf Invest AI Portfolio Management documentation.
 *
 * Documents the target architecture for Google Vertex AI-powered
 * portfolio management, investor profiling, and automated portfolio construction.
 */
import { PipelineFlow, VerticalFlow, MergeDiagram, ArchitectureBox } from '../shared/Diagrams';
import PageSEO from '../../shared/components/PageSEO';

export function AIPortfolioPage() {
  return (
    <div style={{
      fontFamily: "'Inter', -apple-system, sans-serif",
      background: '#F7F4EE', color: '#0B0F14', minHeight: '100vh',
    }}>
      <PageSEO title="AI Portfolio Intelligence — Position Analysis" description="AI-powered portfolio analysis with position-level risk assessment, correlation monitoring, and portfolio-wide Greeks management for options traders." path="/ai-portfolio" />
      {/* Hero */}
      <section style={{ maxWidth: 800, margin: '0 auto', padding: '120px 2rem 60px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.15em', textTransform: 'uppercase', color: '#C9A96E', marginBottom: 16 }}>Target Architecture</div>
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 400, lineHeight: 1.1, letterSpacing: '-1.5px', color: '#0B2D23', marginBottom: 16 }}>
          NewLeaf Invest
        </h1>
        <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(16px, 2vw, 20px)', fontStyle: 'italic', color: '#C9A96E', marginBottom: 32 }}>
          AI that understands you. Portfolios that reflect it.
        </p>
        <p style={{ fontSize: 15, lineHeight: 1.75, color: '#6b6b60', maxWidth: 620, margin: '0 auto' }}>
          NewLeaf Invest uses Google Vertex AI to have a conversation with each investor &mdash;
          understanding their risk tolerance, income goals, market views, and experience level &mdash;
          then builds and manages an options portfolio tailored specifically to them.
        </p>
      </section>

      {/* End-to-end pipeline */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <Card>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 12 }}>
            NewLeaf Invest Pipeline
          </div>
          <PipelineFlow steps={[
            { label: 'Investor', sub: 'Conversation', color: '#4285F4', icon: '\u{1F464}' },
            { label: 'Profile', sub: 'Risk + Goals', color: '#4285F4', icon: '\u{1F4CB}' },
            { label: 'Filter', sub: '111 stocks', color: '#6b7280', icon: '\u{1F50D}' },
            { label: 'Score', sub: 'Opportunity', color: '#0B7A52', icon: '\u{2B50}' },
            { label: 'Strategy', sub: 'IC/BWB/IB', color: '#6366F1', icon: '\u{1F3AF}' },
            { label: 'Size', sub: 'Kelly criterion', color: '#B7791F', icon: '\u{1F4B0}' },
            { label: 'Portfolio', sub: 'Managed', color: '#C9A96E', icon: '\u{1F4BC}', round: true },
          ]} />
        </Card>
      </section>

      {/* Architecture merge */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <MergeDiagram
          inputs={[
            { label: 'Vertex AI', detail: 'Conversation', color: '#4285F4', icon: 'V' },
            { label: 'Claude', detail: 'Research', color: '#D97706', icon: 'C' },
            { label: 'Quant Engine', detail: 'Scoring', color: '#0B7A52', icon: 'Q' },
            { label: 'Sentiment', detail: 'AI signals', color: '#7C3AED', icon: 'S' },
          ]}
          output={{ label: 'Personalised Portfolio', detail: 'Built, managed, and monitored by AI', color: '#0B2D23', icon: '\u{1F4BC}' }}
          label="AI orchestration"
        />
      </section>

      {/* Technology architecture boxes */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <SectionTitle>System Architecture</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <ArchitectureBox
            title="AI Layer"
            titleColor="#4285F4"
            borderColor="#4285F4"
            sections={[
              { label: 'Google Vertex AI', detail: 'Investor conversation & profiling', color: '#4285F4', icon: '\u{1F4AC}' },
              { label: 'Claude (Anthropic)', detail: 'Market research & analysis', color: '#D97706', icon: '\u{1F50D}' },
              { label: 'Grok + Gemini', detail: 'Sentiment signals', color: '#6366F1', icon: '\u{1F9E0}' },
            ]}
          />
          <ArchitectureBox
            title="Data Layer"
            titleColor="#0B7A52"
            borderColor="#0B7A52"
            sections={[
              { label: 'Alpaca Markets', detail: 'Real-time options & price data', color: '#0B7A52', icon: '\u{1F4C8}' },
              { label: 'Yahoo Finance', detail: 'Open Interest & OI delta', color: '#B7791F', icon: '\u{1F4CA}' },
              { label: 'Firebase + Firestore', detail: 'Portfolio state & real-time sync', color: '#C94F4F', icon: '\u{1F5C4}' },
              { label: 'Cloudflare R2', detail: 'Report storage & CDN', color: '#6b7280', icon: '\u{2601}' },
            ]}
          />
        </div>
      </section>

      {/* Architecture pillars */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <SectionTitle>Three Pillars of AI Portfolio Management</SectionTitle>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          <PillarCard
            icon="&#128172;"
            title="Understand"
            subtitle="Investor Profiling"
            color="#4285F4"
            points={[
              'Conversational risk assessment via AI dialogue',
              'Income goals and capital allocation preferences',
              'Market outlook and sector views',
              'Options experience level calibration',
              'Dynamic re-profiling as conditions change',
            ]}
          />
          <PillarCard
            icon="&#128736;"
            title="Build"
            subtitle="Portfolio Construction"
            color="#0B7A52"
            points={[
              'Strategy mix optimised for investor profile',
              'Position sizing based on risk budget',
              'Sector and correlation diversification',
              'DTE and delta laddering for income smoothing',
              'Automatic opportunity scoring integration',
            ]}
          />
          <PillarCard
            icon="&#128202;"
            title="Manage"
            subtitle="Ongoing Supervision"
            color="#D97706"
            points={[
              'Daily portfolio health monitoring',
              'Automated adjustment recommendations',
              'Rebalancing triggers and notifications',
              'Performance attribution and reporting',
              'Risk regime adaptation',
            ]}
          />
        </div>
      </section>

      {/* Vertex AI integration */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <SectionTitle>Google Vertex AI Integration</SectionTitle>
        <Card>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: '#374151', marginBottom: 20 }}>
            Vertex AI provides the conversational intelligence layer that makes portfolio management accessible
            to investors of all experience levels:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <FeatureRow
              title="Natural Language Risk Assessment"
              description="Instead of traditional questionnaires, Vertex AI conducts a natural conversation to understand the investor's financial situation, goals, and risk appetite. It asks follow-up questions based on responses and identifies unstated preferences."
              color="#4285F4"
            />
            <FeatureRow
              title="Portfolio Reasoning Engine"
              description="Vertex AI explains every portfolio decision in plain language. Why this strategy? Why this allocation? What's the expected outcome? Investors understand the 'why' behind every trade."
              color="#0B7A52"
            />
            <FeatureRow
              title="Market Context Integration"
              description="The AI continuously monitors market conditions and proactively communicates relevant changes to the investor. It translates complex market dynamics into actionable insights."
              color="#D97706"
            />
            <FeatureRow
              title="Adaptive Learning"
              description="Over time, the AI learns the investor's preferences from their decisions — which recommendations they accept, which they decline, and how they react to market moves. The profile refines itself."
              color="#6366F1"
            />
          </div>
        </Card>
      </section>

      {/* Investor profiles */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <SectionTitle>Investor Profile Archetypes</SectionTitle>
        <Card>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: '#374151', marginBottom: 20 }}>
            The AI profiles each investor along multiple dimensions and maps them to a portfolio strategy:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <ProfileCard
              name="Income Seeker"
              risk="Conservative"
              color="#0B7A52"
              strategy="Primarily Iron Butterflies and Bull Put Spreads on blue-chip stocks. Weekly income focus. Max 3 concurrent positions."
              allocation="60% defined-risk spreads, 30% cash reserve, 10% growth opportunities"
            />
            <ProfileCard
              name="Active Trader"
              risk="Moderate"
              color="#D97706"
              strategy="Mixed Iron Condors, BWB, and directional spreads across sectors. 5-8 concurrent positions. Dynamic adjustment."
              allocation="40% neutral strategies, 35% directional, 25% cash buffer"
            />
            <ProfileCard
              name="Growth Oriented"
              risk="Moderate-Aggressive"
              color="#6366F1"
              strategy="Broken Wing Butterflies and directional spreads on high-momentum names. Higher conviction, larger position sizes."
              allocation="50% directional strategies, 30% neutral income, 20% opportunistic"
            />
            <ProfileCard
              name="Portfolio Hedger"
              risk="Defensive"
              color="#4285F4"
              strategy="Protective puts and collar strategies on existing equity positions. Income generation secondary to downside protection."
              allocation="70% hedging structures, 20% income spreads, 10% cash"
            />
          </div>
        </Card>
      </section>

      {/* Portfolio construction */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <SectionTitle>Automated Portfolio Construction</SectionTitle>
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <ProcessStep step="1" title="Profile Assessment" description="Vertex AI conversation determines risk tolerance (1-10), income target, capital allocation, sector preferences, and options experience." />
            <ProcessStep step="2" title="Universe Filtering" description="The 111-stock watchlist is filtered to match the investor's profile. Conservative profiles get blue-chips; aggressive profiles include high-beta names." />
            <ProcessStep step="3" title="Opportunity Ranking" description="Filtered stocks are ranked by opportunity score. AI selects the top candidates that satisfy diversification constraints (max 2 per sector, correlation limits)." />
            <ProcessStep step="4" title="Strategy Assignment" description="Each selected stock gets the strategy that best matches the investor's profile and current market conditions. Income seekers get more Iron Butterflies; directional traders get BWBs." />
            <ProcessStep step="5" title="Position Sizing" description="Kelly Criterion-informed position sizing ensures no single trade risks more than the investor's comfort threshold. Total portfolio risk is capped." />
            <ProcessStep step="6" title="Execution Plan" description="The AI generates a complete execution plan with entry prices, target exits, and adjustment triggers. The investor reviews and approves." />
          </div>
        </Card>
      </section>

      {/* AI technology stack */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <SectionTitle>AI Technology Stack</SectionTitle>
        <Card>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
            <TechCard name="Google Vertex AI" role="Primary conversational AI and reasoning engine" description="Handles investor profiling, portfolio explanation, and market context translation. Fine-tuned on options trading domain knowledge." />
            <TechCard name="Claude (Anthropic)" role="Analysis and research layer" description="Performs deep market research, earnings analysis, and generates trade rationales with cited reasoning." />
            <TechCard name="NewLeaf Quant Engine" role="Quantitative analysis backbone" description="Three-pillar scoring, gamma wall analysis, technical indicators, and Black-Scholes pricing provide the data foundation." />
            <TechCard name="Firebase + Firestore" role="Real-time data and state management" description="Portfolio state, investor profiles, and live P&L data stored in Firestore with real-time sync to the investor's dashboard." />
          </div>
        </Card>
      </section>

      {/* Roadmap */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <SectionTitle>Implementation Roadmap</SectionTitle>
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <RoadmapRow phase="Phase 1" status="Live" title="Manual Portfolio Management" description="Current: investors use the Workbench and Picks to manually select and manage positions with scoring assistance." />
            <RoadmapRow phase="Phase 2" status="In Progress" title="AI-Assisted Recommendations" description="Vertex AI suggests portfolio adjustments and new positions based on the investor's profile and current market conditions." />
            <RoadmapRow phase="Phase 3" status="Planned" title="Conversational Portfolio Builder" description="Full natural-language portfolio construction. Investor describes goals, AI builds the portfolio with full transparency." />
            <RoadmapRow phase="Phase 4" status="Planned" title="Automated Execution" description="With investor approval, the AI can execute trades through connected brokerage accounts (Alpaca, IBKR)." />
            <RoadmapRow phase="Phase 5" status="Research" title="Autonomous Management" description="AI continuously monitors and adjusts the portfolio within pre-approved parameters, notifying the investor of actions taken." />
          </div>
        </Card>
      </section>

      {/* CTA */}
      <section style={{ maxWidth: 600, margin: '0 auto', padding: '60px 2rem 100px', textAlign: 'center' }}>
        <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(22px, 3.5vw, 32px)', fontWeight: 400, color: '#0B2D23', marginBottom: 12 }}>
          Your portfolio. Your goals. AI that listens.
        </h2>
        <p style={{ fontSize: 15, color: '#6b6b60', lineHeight: 1.7, marginBottom: 32 }}>
          NewLeaf Invest combines the precision of quantitative analysis with the empathy of conversational AI.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/how-we-score" style={{ padding: '14px 28px', borderRadius: 10, background: 'rgba(11,45,35,0.06)', border: '1px solid rgba(11,45,35,0.12)', fontSize: 14, fontWeight: 600, color: '#0B2D23', textDecoration: 'none' }}>Scoring algorithm &rarr;</a>
          <a href="/invest" style={{ padding: '14px 28px', borderRadius: 10, background: '#C9A96E', color: '#0B2D23', fontSize: 14, fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 16px rgba(201,169,110,0.25)' }}>Try NewLeaf Invest &rarr;</a>
        </div>
      </section>
    </div>
  );
}

// Sub-components
function Card({ children }) { return <div style={{ background: '#fff', border: '1px solid rgba(17,24,39,0.08)', borderRadius: 16, padding: '24px 28px' }}>{children}</div>; }
function SectionTitle({ children }) { return <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 400, color: '#0B2D23', marginBottom: 16 }}>{children}</h2>; }

function PillarCard({ icon, title, subtitle, color, points }) {
  return (
    <div style={{ background: `${color}06`, borderRadius: 16, padding: '24px 20px', border: `1px solid ${color}12` }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>{icon}</div>
      <div style={{ fontWeight: 700, fontSize: 18, color: '#0B2D23', marginBottom: 2 }}>{title}</div>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color, marginBottom: 14 }}>{subtitle}</div>
      <ul style={{ margin: 0, paddingLeft: 16 }}>
        {points.map((p, i) => <li key={i} style={{ fontSize: 12, color: '#374151', lineHeight: 1.8 }}>{p}</li>)}
      </ul>
    </div>
  );
}

function FeatureRow({ title, description, color }) {
  return (
    <div style={{ padding: '16px 20px', borderRadius: 12, background: `${color}06`, border: `1px solid ${color}12` }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: '#0B2D23', marginBottom: 6 }}>{title}</div>
      <p style={{ fontSize: 13, lineHeight: 1.7, color: '#6b6b60', margin: 0 }}>{description}</p>
    </div>
  );
}

function ProfileCard({ name, risk, color, strategy, allocation }) {
  return (
    <div style={{ background: `${color}06`, borderRadius: 14, padding: '18px 20px', border: `1px solid ${color}15` }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <div style={{ fontWeight: 700, fontSize: 16, color: '#0B2D23' }}>{name}</div>
        <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: `${color}12`, color, letterSpacing: '.06em', textTransform: 'uppercase' }}>{risk}</span>
      </div>
      <p style={{ fontSize: 12, lineHeight: 1.6, color: '#6b6b60', marginBottom: 10 }}>{strategy}</p>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.06em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 4 }}>Allocation</div>
      <div style={{ fontSize: 12, color: '#374151' }}>{allocation}</div>
    </div>
  );
}

function ProcessStep({ step, title, description }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '32px 1fr', gap: 14, alignItems: 'start', padding: '12px 14px', borderLeft: '2px solid #C9A96E', marginLeft: 14 }}>
      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 16, fontWeight: 700, color: '#C9A96E' }}>{step}</span>
      <div>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#0B2D23', marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 12, color: '#6b6b60', lineHeight: 1.6 }}>{description}</div>
      </div>
    </div>
  );
}

function TechCard({ name, role, description }) {
  return (
    <div style={{ background: 'rgba(17,24,39,0.02)', borderRadius: 12, padding: '16px 18px', border: '1px solid rgba(17,24,39,0.06)' }}>
      <div style={{ fontWeight: 700, fontSize: 14, color: '#0B2D23', marginBottom: 2 }}>{name}</div>
      <div style={{ fontSize: 11, fontWeight: 600, color: '#C9A96E', marginBottom: 8 }}>{role}</div>
      <p style={{ fontSize: 12, lineHeight: 1.6, color: '#6b6b60', margin: 0 }}>{description}</p>
    </div>
  );
}

function RoadmapRow({ phase, status, title, description }) {
  const colors = { 'Live': '#0B7A52', 'In Progress': '#D97706', 'Planned': '#6366F1', 'Research': '#9ca3af' };
  const c = colors[status] || '#6b7280';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '70px 1fr', gap: 16, padding: '12px 16px', borderRadius: 10, background: `${c}06`, border: `1px solid ${c}12` }}>
      <div>
        <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 11, fontWeight: 700, color: '#9ca3af' }}>{phase}</div>
        <div style={{ fontSize: 10, fontWeight: 700, color: c, marginTop: 2, letterSpacing: '.04em', textTransform: 'uppercase' }}>{status}</div>
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: 14, color: '#0B2D23', marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 12, color: '#6b6b60', lineHeight: 1.5 }}>{description}</div>
      </div>
    </div>
  );
}
