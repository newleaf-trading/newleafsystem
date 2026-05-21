/**
 * /ai-sentiment — AI-powered sentiment analysis documentation.
 *
 * Documents current and planned AI integrations:
 * - Claude CLI web search (current)
 * - Grok API for X/Twitter analysis (planned)
 * - Google Gemini for news/search analysis (planned)
 * - Social media sentiment aggregation (planned)
 */
import { MergeDiagram, PipelineFlow, VerticalFlow } from '../shared/Diagrams';
import PageSEO from '../../shared/components/PageSEO';

export function AISentimentPage() {
  return (
    <div style={{
      fontFamily: "'Inter', -apple-system, sans-serif",
      background: '#F7F4EE', color: '#0B0F14', minHeight: '100vh',
    }}>
      <PageSEO title="AI Sentiment Analysis — Market Intelligence" description="NewLeaf's 4-engine AI sentiment system aggregates news, social media, analyst ratings, and market microstructure signals for comprehensive market sentiment scoring." path="/ai-sentiment" />
      {/* Hero */}
      <section style={{ maxWidth: 800, margin: '0 auto', padding: '120px 2rem 60px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.15em', textTransform: 'uppercase', color: '#C9A96E', marginBottom: 16 }}>Target Architecture</div>
        <h1 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(32px, 5vw, 52px)', fontWeight: 400, lineHeight: 1.1, letterSpacing: '-1.5px', color: '#0B2D23', marginBottom: 16 }}>
          AI Sentiment Analysis
        </h1>
        <p style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(16px, 2vw, 20px)', fontStyle: 'italic', color: '#C9A96E', marginBottom: 32 }}>
          Four AI engines. One sentiment signal.
        </p>
        <p style={{ fontSize: 15, lineHeight: 1.75, color: '#6b6b60', maxWidth: 620, margin: '0 auto' }}>
          Beyond price and options data, market sentiment drives short-term moves. NewLeaf is building
          a multi-source AI sentiment layer that aggregates signals from web search, social media, news,
          and financial discussion &mdash; each powered by a specialised AI model.
        </p>
      </section>

      {/* Multi-model merge diagram */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <MergeDiagram
          inputs={[
            { label: 'Claude', detail: 'Web Search', color: '#D97706', icon: 'C' },
            { label: 'Grok', detail: 'X / Twitter', color: '#1DA1F2', icon: 'X' },
            { label: 'Gemini', detail: 'Google News', color: '#4285F4', icon: 'G' },
            { label: 'Social', detail: 'Reddit + Forums', color: '#7C3AED', icon: 'S' },
          ]}
          output={{ label: 'Composite Sentiment Score', detail: '0-100 (Bearish to Bullish)', color: '#0B2D23', icon: '\u{1F9E0}' }}
          label="weighted composite"
        />
      </section>

      {/* End-to-end flow */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <Card>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 12 }}>
            Sentiment Integration Flow
          </div>
          <PipelineFlow steps={[
            { label: 'Data\nSources', sub: 'Web, X, News, Reddit', color: '#6b7280', icon: '\u{1F310}' },
            { label: 'AI Models', sub: '4 specialised engines', color: '#6366F1', icon: '\u{1F916}' },
            { label: 'Normalise', sub: '0-100 score', color: '#B7791F', icon: '\u{1F4CA}' },
            { label: 'Sentiment\nSignal', sub: 'Bull/Neutral/Bear', color: '#0B7A52', icon: '\u{1F9ED}' },
            { label: 'Score\nModifier', sub: 'Boost or suppress', color: '#C9A96E', icon: '\u{2696}', round: true },
          ]} />
        </Card>
      </section>

      {/* Architecture overview */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <SectionTitle>Multi-Model Architecture</SectionTitle>
        <Card>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: '#374151', marginBottom: 20 }}>
            Each AI model brings unique strengths. By combining them, we get a robust sentiment signal
            that no single source could provide:
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <AIModelCard
              name="Claude"
              provider="Anthropic"
              color="#D97706"
              status="Active"
              icon="C"
              source="Web Search & Analysis"
              description="Claude CLI performs real-time web searches to gather market commentary, analyst opinions, and breaking news. It synthesises multiple sources into a structured sentiment assessment with reasoning."
              capabilities={[
                'Real-time web search across financial news sources',
                'Contextual analysis of market commentary and opinions',
                'Earnings call transcript analysis',
                'Macro-economic event impact assessment',
                'Multi-source synthesis with cited reasoning',
              ]}
              integration="Claude Code CLI with web search tool. Results feed into the pre-market analysis pipeline as a sentiment overlay on technical scores."
            />
            <AIModelCard
              name="Grok"
              provider="xAI"
              color="#1DA1F2"
              status="Planned"
              icon="X"
              source="X / Twitter Analysis"
              description="Grok API with native X/Twitter access provides real-time social sentiment analysis. It can read trending topics, influential trader posts, and measure retail sentiment velocity."
              capabilities={[
                'Real-time X/Twitter firehose analysis',
                'Influential trader mention tracking ($TICKER)',
                'Sentiment velocity (rate of sentiment change)',
                'Meme stock detection and retail crowd analysis',
                'Options flow commentary aggregation',
              ]}
              integration="Grok API with X data access. Scheduled pre-market scan of overnight social activity, plus intraday alerts for sudden sentiment shifts."
            />
            <AIModelCard
              name="Gemini"
              provider="Google"
              color="#4285F4"
              status="Planned"
              icon="G"
              source="Google Search & News"
              description="Google Gemini leverages Google's search index and news aggregation to provide comprehensive market news analysis. It detects narratives forming across traditional media."
              capabilities={[
                'Google News aggregation for market-moving events',
                'Sector rotation narrative detection',
                'Regulatory and policy impact analysis',
                'Supply chain disruption monitoring',
                'Competitor and industry trend mapping',
              ]}
              integration="Gemini API with Google Search grounding. Runs on a 30-minute cycle during market hours, producing sector-level and ticker-level sentiment scores."
            />
            <AIModelCard
              name="Social Aggregator"
              provider="Multi-Platform"
              color="#7C3AED"
              status="Planned"
              icon="S"
              source="Reddit, StockTwits & Forums"
              description="A unified social media sentiment engine that aggregates signals from Reddit (r/wallstreetbets, r/options), StockTwits, and financial forums."
              capabilities={[
                'Reddit WSB and r/options mention tracking',
                'StockTwits bullish/bearish ratio',
                'Forum discussion volume and sentiment',
                'Retail vs. institutional sentiment divergence',
                'Unusual social volume spike detection',
              ]}
              integration="Custom aggregation pipeline using platform APIs. Produces a normalised retail sentiment score (0-100) that modulates the opportunity score."
            />
          </div>
        </Card>
      </section>

      {/* Sentiment scoring */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <SectionTitle>Composite Sentiment Score</SectionTitle>
        <Card>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: '#374151', marginBottom: 16 }}>
            Individual AI signals are normalised and weighted into a single composite sentiment score:
          </p>
          <FormulaBlock>
            {'Sentiment Score = (\n  Claude Web    \u00d7 0.30 +\n  Grok X/Twitter \u00d7 0.25 +\n  Gemini News    \u00d7 0.25 +\n  Social Agg     \u00d7 0.20\n) \u00d7 100'}
          </FormulaBlock>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 20 }}>
            <SentimentZone label="Bullish" range="70-100" color="#0B7A52" description="Strong positive sentiment across sources. May boost opportunity score." />
            <SentimentZone label="Neutral" range="40-69" color="#6b7280" description="Mixed or quiet sentiment. No modifier applied." />
            <SentimentZone label="Bearish" range="0-39" color="#C94F4F" description="Negative sentiment convergence. May suppress opportunity score or trigger caution flags." />
          </div>
        </Card>
      </section>

      {/* Integration with scoring */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <SectionTitle>Integration with Opportunity Score</SectionTitle>
        <Card>
          <p style={{ fontSize: 14, lineHeight: 1.8, color: '#374151', marginBottom: 16 }}>
            The sentiment score does not replace the three-pillar scoring system. Instead, it acts as a
            confidence modifier and warning system:
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <IntegrationRow icon="+" label="Score Boost" description="When sentiment is strongly bullish (> 80) and aligns with the technical trend direction, the opportunity score receives a +3 to +5 bonus." color="#0B7A52" />
            <IntegrationRow icon="!" label="Caution Flag" description="When sentiment is strongly bearish (< 30) but technicals are neutral/bullish, a caution flag is displayed. The score is not reduced, but the divergence is highlighted." color="#B7791F" />
            <IntegrationRow icon="&times;" label="Suppress" description="When sentiment detects a material event (earnings surprise, regulatory action, M&A) not yet reflected in options pricing, the ticker is temporarily suppressed from recommendations." color="#C94F4F" />
            <IntegrationRow icon="&rarr;" label="Directional Tilt" description="Strong directional sentiment can influence strategy selection, tilting from neutral strategies (Iron Condor) toward directional ones (Bull Put / Bear Call)." color="#6366F1" />
          </div>
        </Card>
      </section>

      {/* Data pipeline */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <SectionTitle>Data Pipeline</SectionTitle>
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <PipelineStep step="1" time="Pre-market" title="Overnight Scan" description="Claude and Grok analyse overnight developments, earnings, and social media activity accumulated since the previous close." />
            <PipelineStep step="2" time="9:30 ET" title="Market Open Baseline" description="All four AI engines produce initial sentiment scores. These are stored as the day's baseline for measuring intraday shifts." />
            <PipelineStep step="3" time="Every 30 min" title="Intraday Updates" description="Gemini and Social Aggregator refresh on a rolling 30-minute cycle. Claude and Grok provide on-demand updates when significant events are detected." />
            <PipelineStep step="4" time="4:00 PM ET" title="Close Summary" description="End-of-day sentiment snapshot is stored for historical analysis and next-day comparison." />
          </div>
        </Card>
      </section>

      {/* Roadmap */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '0 2rem 48px' }}>
        <SectionTitle>Implementation Roadmap</SectionTitle>
        <Card>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <RoadmapItem phase="Phase 1" status="Active" title="Claude Web Search" description="Real-time web search sentiment analysis via Claude CLI. Available now as part of the analysis pipeline." />
            <RoadmapItem phase="Phase 2" status="In Development" title="Grok X/Twitter Integration" description="X API access via Grok for social sentiment tracking. Expected to capture retail sentiment momentum and meme stock detection." />
            <RoadmapItem phase="Phase 3" status="Planned" title="Gemini News Analysis" description="Google Gemini with search grounding for comprehensive news analysis and sector narrative detection." />
            <RoadmapItem phase="Phase 4" status="Planned" title="Social Media Aggregation" description="Unified Reddit, StockTwits, and forum sentiment. Normalised retail sentiment scoring." />
            <RoadmapItem phase="Phase 5" status="Research" title="Composite Scoring Integration" description="Weighted multi-model composite feeding directly into the opportunity score pipeline." />
          </div>
        </Card>
      </section>

      {/* CTA */}
      <section style={{ maxWidth: 600, margin: '0 auto', padding: '60px 2rem 100px', textAlign: 'center' }}>
        <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(22px, 3.5vw, 32px)', fontWeight: 400, color: '#0B2D23', marginBottom: 12 }}>
          AI that reads the room.
        </h2>
        <p style={{ fontSize: 15, color: '#6b6b60', lineHeight: 1.7, marginBottom: 32 }}>
          From web search to social media, every AI model adds a layer of understanding that pure quantitative analysis misses.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/technical-analysis" style={{ padding: '14px 28px', borderRadius: 10, background: 'rgba(11,45,35,0.06)', border: '1px solid rgba(11,45,35,0.12)', fontSize: 14, fontWeight: 600, color: '#0B2D23', textDecoration: 'none' }}>Technical analysis &rarr;</a>
          <a href="/ai-portfolio" style={{ padding: '14px 28px', borderRadius: 10, background: '#C9A96E', color: '#0B2D23', fontSize: 14, fontWeight: 700, textDecoration: 'none', boxShadow: '0 4px 16px rgba(201,169,110,0.25)' }}>AI portfolio management &rarr;</a>
        </div>
      </section>
    </div>
  );
}

// Sub-components
function Card({ children }) { return <div style={{ background: '#fff', border: '1px solid rgba(17,24,39,0.08)', borderRadius: 16, padding: '24px 28px' }}>{children}</div>; }
function SectionTitle({ children }) { return <h2 style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 'clamp(22px, 3vw, 30px)', fontWeight: 400, color: '#0B2D23', marginBottom: 16 }}>{children}</h2>; }
function FormulaBlock({ children }) { return <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 13, color: '#0B2D23', background: 'rgba(11,45,35,0.04)', borderRadius: 10, padding: '16px 20px', border: '1px solid rgba(11,45,35,0.08)', whiteSpace: 'pre-line' }}>{children}</div>; }

function AIModelCard({ name, provider, color, status, icon, source, description, capabilities, integration }) {
  const isActive = status === 'Active';
  return (
    <div style={{ background: `${color}06`, borderRadius: 16, padding: '22px 20px', border: `1px solid ${color}15` }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 16, color }}>{icon}</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: 16, color: '#0B2D23' }}>{name}</div>
          <div style={{ fontSize: 11, color: '#9ca3af' }}>{provider}</div>
        </div>
        <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: isActive ? '#0B7A5215' : `${color}12`, color: isActive ? '#0B7A52' : color, letterSpacing: '.06em', textTransform: 'uppercase' }}>
          {status}
        </span>
      </div>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color, marginBottom: 8 }}>{source}</div>
      <p style={{ fontSize: 13, lineHeight: 1.7, color: '#6b6b60', marginBottom: 14 }}>{description}</p>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 6 }}>Capabilities</div>
      <ul style={{ margin: '0 0 14px', paddingLeft: 16 }}>
        {capabilities.map((c, i) => <li key={i} style={{ fontSize: 12, color: '#374151', lineHeight: 1.7 }}>{c}</li>)}
      </ul>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: '#9ca3af', marginBottom: 4 }}>Integration</div>
      <p style={{ fontSize: 12, color: '#6b6b60', lineHeight: 1.6, margin: 0 }}>{integration}</p>
    </div>
  );
}

function SentimentZone({ label, range, color, description }) {
  return (
    <div style={{ textAlign: 'center', padding: '14px 10px' }}>
      <div style={{ width: '100%', height: 4, borderRadius: 2, background: color, marginBottom: 10, opacity: 0.6 }} />
      <div style={{ fontWeight: 700, fontSize: 14, color }}>{label}</div>
      <div style={{ fontFamily: "'Space Mono', monospace", fontSize: 15, fontWeight: 700, color: '#0B2D23', margin: '2px 0 6px' }}>{range}</div>
      <div style={{ fontSize: 12, color: '#6b6b60', lineHeight: 1.5 }}>{description}</div>
    </div>
  );
}

function IntegrationRow({ icon, label, description, color }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '32px 120px 1fr', gap: 12, alignItems: 'start', padding: '10px 14px', borderRadius: 10, background: `${color}06`, border: `1px solid ${color}12` }}>
      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 16, fontWeight: 700, color, textAlign: 'center' }}>{icon}</span>
      <span style={{ fontWeight: 700, fontSize: 13, color }}>{label}</span>
      <span style={{ fontSize: 12, color: '#6b6b60', lineHeight: 1.6 }}>{description}</span>
    </div>
  );
}

function PipelineStep({ step, time, title, description }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '28px 90px 1fr', gap: 12, alignItems: 'start', padding: '12px 14px', borderLeft: '2px solid #C9A96E', marginLeft: 14 }}>
      <span style={{ fontFamily: "'Space Mono', monospace", fontSize: 14, fontWeight: 700, color: '#C9A96E' }}>{step}</span>
      <span style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', letterSpacing: '.06em' }}>{time}</span>
      <div>
        <div style={{ fontWeight: 700, fontSize: 13, color: '#0B2D23', marginBottom: 2 }}>{title}</div>
        <div style={{ fontSize: 12, color: '#6b6b60', lineHeight: 1.5 }}>{description}</div>
      </div>
    </div>
  );
}

function RoadmapItem({ phase, status, title, description }) {
  const colors = { 'Active': '#0B7A52', 'In Development': '#D97706', 'Planned': '#6366F1', 'Research': '#9ca3af' };
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
