/**
 * VerificationDeskPage — marketing page explaining the multi-agent
 * Verification Desk service, exclusive to NewLeaf Desk subscribers.
 *
 * Content adapted from the reference design (newleaf-verify-design.html).
 * All user journey copy, SVG diagram, and agent cards are verbatim.
 */

export function VerificationDeskPage() {
  return (
    <>
      <style>{`
        /* ═══ Verification Desk page — scoped via .vd ═══ */
        .vd {
          --forest: #0F3D2E;
          --forest-deep: #082319;
          --forest-soft: #1B5E48;
          --gold: #C8A85A;
          --gold-soft: #E0C988;
          --cream: #F7F4EE;
          --cream-deep: #EDE7DA;
          --paper: #FFFFFF;
          --ink: #1A1A1A;
          --ink-soft: #4A4A4A;
          --ink-muted: #7A7A7A;
          --hairline: rgba(15, 61, 46, 0.12);
          --hairline-strong: rgba(15, 61, 46, 0.25);
          --analyst-purple: #6B4E9A;
          --analyst-green: #2D7A52;
          --analyst-amber: #B8884A;
          --analyst-blue: #3B6B96;
          --bull: #2D7A52;
          --bull-bg: #E8F1EB;
          --bear: #B0463C;
          --bear-bg: #F5E8E5;
          --risk: #B8884A;
          --risk-bg: #F5EDDA;
          --judge: #0F3D2E;
          --pass: #2D7A52;
          --marginal: #C8A85A;
          --fail: #B0463C;
          --font-display: 'Fraunces', Georgia, serif;
          --font-body: 'DM Sans', system-ui, sans-serif;
          --font-mono: 'Space Mono', monospace;

          font-family: var(--font-body);
          background: var(--cream);
          color: var(--ink);
          line-height: 1.6;
          font-size: 16px;
          -webkit-font-smoothing: antialiased;
        }

        .vd-main { max-width: 1080px; margin: 0 auto; padding: 80px 40px 120px; }

        .vd section { margin-bottom: 96px; }
        .vd .eyebrow {
          font-family: var(--font-body);
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--gold);
          margin-bottom: 20px;
          text-align: center;
        }
        .vd h2 {
          font-family: var(--font-display);
          font-size: clamp(32px, 4.5vw, 44px);
          font-weight: 500;
          color: var(--forest);
          text-align: center;
          line-height: 1.1;
          letter-spacing: -0.005em;
          margin-bottom: 14px;
        }
        .vd .subhead {
          font-family: var(--font-display);
          font-style: italic;
          font-size: clamp(18px, 2.2vw, 22px);
          color: var(--gold);
          text-align: center;
          margin-bottom: 40px;
        }
        .vd .lede {
          max-width: 720px;
          margin: 0 auto 24px;
          text-align: center;
          color: var(--ink-soft);
          font-size: 17px;
          line-height: 1.65;
        }

        /* desk-pill */
        .desk-pill {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          border: 1px solid var(--gold);
          background: transparent;
          color: var(--gold);
          font-family: var(--font-body);
          font-size: 12px;
          font-weight: 500;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          padding: 8px 20px;
          border-radius: 100px;
          width: fit-content;
          margin: 0 auto 24px;
        }
        .desk-pill-dot {
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--gold);
          flex-shrink: 0;
        }

        /* hero */
        .vd .hero { padding-top: 32px; padding-bottom: 32px; }
        .vd .hero .eyebrow { color: var(--gold); }
        .vd .hero h1 {
          font-family: var(--font-display);
          font-size: clamp(40px, 6vw, 64px);
          font-weight: 500;
          color: var(--forest);
          text-align: center;
          line-height: 1.05;
          letter-spacing: -0.01em;
          margin-bottom: 24px;
        }
        .hero-meta {
          display: flex;
          justify-content: center;
          gap: 32px;
          margin-top: 32px;
          color: var(--ink-muted);
          font-size: 13px;
          letter-spacing: 0.05em;
        }
        .hero-meta span { display: flex; align-items: center; gap: 8px; }
        .hero-meta span::before {
          content: '';
          width: 6px; height: 6px; border-radius: 50%;
          background: var(--gold);
        }

        /* video embed */
        .vd-video-wrap {
          position: relative;
          width: 100%;
          max-width: 860px;
          margin: 0 auto 0;
          padding-bottom: 56.25%;
          border-radius: 16px;
          overflow: hidden;
          border: 1px solid var(--hairline);
          box-shadow: 0 4px 24px rgba(15, 61, 46, 0.08);
        }
        .vd-video-wrap iframe {
          position: absolute;
          top: 0; left: 0;
          width: 100%;
          height: 100%;
          border: none;
        }

        /* architecture diagram */
        .diagram-frame {
          background: var(--paper);
          border: 1px solid var(--hairline);
          border-radius: 16px;
          padding: 48px 32px 32px;
          margin-top: 24px;
        }
        .diagram-label {
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--ink-muted);
          text-align: center;
          margin-bottom: 24px;
        }
        .diagram-frame img {
          width: 100%;
          height: auto;
          display: block;
          margin: 0 auto;
          border-radius: 8px;
        }

        /* agent role grid */
        .agent-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
          margin-top: 40px;
        }
        .agent-card {
          background: var(--paper);
          border: 1px solid var(--hairline);
          border-left: 3px solid var(--analyst-blue);
          border-radius: 8px;
          padding: 20px;
        }
        .agent-card.purple { border-left-color: var(--analyst-purple); }
        .agent-card.green { border-left-color: var(--analyst-green); }
        .agent-card.amber { border-left-color: var(--analyst-amber); }
        .agent-card.blue { border-left-color: var(--analyst-blue); }
        .agent-card.bull { border-left-color: var(--bull); }
        .agent-card.bear { border-left-color: var(--bear); }
        .agent-card.risk { border-left-color: var(--risk); }
        .agent-card.judge { border-left-color: var(--judge); }
        .agent-name {
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          color: var(--ink-muted);
          margin-bottom: 8px;
        }
        .agent-title {
          font-family: var(--font-display);
          font-size: 18px;
          font-weight: 500;
          color: var(--forest);
          margin-bottom: 8px;
        }
        .agent-desc {
          font-size: 13px;
          color: var(--ink-soft);
          line-height: 1.55;
        }
        .agent-grid.tier-2 {
          grid-template-columns: repeat(4, 1fr);
          margin-top: 16px;
        }

        /* integration section */
        .vd-integration {
          text-align: center;
        }
        .vd-integration .accent-rule {
          width: 48px;
          height: 2px;
          background: var(--gold);
          margin: 0 auto 32px;
        }
        .vd-integration .integration-body {
          max-width: 680px;
          margin: 0 auto;
          font-size: 16px;
          color: var(--ink-soft);
          line-height: 1.7;
        }

        /* user journeys */
        .journey {
          background: var(--paper);
          border: 1px solid var(--hairline);
          border-radius: 16px;
          margin-top: 32px;
          overflow: hidden;
        }
        .journey-header {
          padding: 28px 32px;
          border-bottom: 1px solid var(--hairline);
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 16px;
        }
        .journey-header.pass { background: linear-gradient(180deg, rgba(45, 122, 82, 0.06), transparent); }
        .journey-header.marginal { background: linear-gradient(180deg, rgba(200, 168, 90, 0.08), transparent); }
        .journey-header.fail { background: linear-gradient(180deg, rgba(176, 70, 60, 0.06), transparent); }
        .journey-num {
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: var(--ink-muted);
          margin-bottom: 4px;
        }
        .journey-title {
          font-family: var(--font-display);
          font-size: 24px;
          font-weight: 500;
          color: var(--forest);
        }
        .journey-tag {
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          padding: 6px 12px;
          border-radius: 4px;
        }
        .journey-tag.pass { background: rgba(45, 122, 82, 0.12); color: var(--pass); }
        .journey-tag.marginal { background: rgba(200, 168, 90, 0.18); color: #8C7430; }
        .journey-tag.fail { background: rgba(176, 70, 60, 0.12); color: var(--fail); }
        .journey-body { padding: 32px; }
        .step-label {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          color: var(--ink-muted);
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .step-label::before {
          content: '';
          width: 24px; height: 1px;
          background: var(--gold);
        }

        /* trade ticket */
        .ticket {
          background: var(--cream);
          border: 1px solid var(--hairline);
          border-radius: 8px;
          padding: 20px 24px;
          font-family: var(--font-mono);
          margin-bottom: 32px;
        }
        .ticket-row {
          display: flex;
          align-items: baseline;
          gap: 12px;
          margin-bottom: 8px;
        }
        .ticket-row:last-child { margin-bottom: 0; }
        .ticket-key {
          font-size: 10px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: var(--ink-muted);
          min-width: 70px;
        }
        .ticket-val {
          font-size: 13px;
          color: var(--ink);
        }
        .ticket-val strong { color: var(--forest); font-weight: 700; }
        .ticket-source {
          margin-top: 14px;
          padding-top: 14px;
          border-top: 1px dashed var(--hairline);
          font-size: 11px;
          color: var(--ink-muted);
          letter-spacing: 0.05em;
        }

        /* analyst panel */
        .analyst-panel {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 32px;
        }
        .analyst-tile {
          background: var(--cream);
          border: 1px solid var(--hairline);
          border-radius: 8px;
          padding: 16px;
          position: relative;
        }
        .analyst-tile::before {
          content: '';
          position: absolute;
          top: 16px;
          right: 16px;
          width: 8px; height: 8px;
          border-radius: 50%;
        }
        .analyst-tile.ok::before { background: var(--pass); }
        .analyst-tile.warn::before { background: var(--marginal); }
        .analyst-tile.bad::before { background: var(--fail); }
        .analyst-tile-name {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--ink-muted);
          margin-bottom: 8px;
        }
        .analyst-tile-finding {
          font-family: var(--font-display);
          font-size: 16px;
          font-weight: 500;
          color: var(--forest);
          line-height: 1.25;
          margin-bottom: 8px;
        }
        .analyst-tile-detail {
          font-size: 12px;
          color: var(--ink-soft);
          line-height: 1.45;
        }

        /* debate */
        .debate {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-bottom: 32px;
        }
        .debate-card {
          border-radius: 8px;
          padding: 20px;
        }
        .debate-card.bull { background: var(--bull-bg); border: 1px solid rgba(45, 122, 82, 0.2); }
        .debate-card.bear { background: var(--bear-bg); border: 1px solid rgba(176, 70, 60, 0.2); }
        .debate-role {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .debate-role::before {
          content: '';
          width: 6px; height: 6px; border-radius: 50%;
        }
        .debate-card.bull .debate-role { color: var(--bull); }
        .debate-card.bull .debate-role::before { background: var(--bull); }
        .debate-card.bear .debate-role { color: var(--bear); }
        .debate-card.bear .debate-role::before { background: var(--bear); }
        .debate-quote {
          font-family: var(--font-display);
          font-style: italic;
          font-size: 16px;
          line-height: 1.5;
          color: var(--ink);
          margin-bottom: 12px;
        }
        .debate-points {
          list-style: none;
          font-size: 13px;
          color: var(--ink-soft);
          padding: 0;
        }
        .debate-points li {
          padding-left: 16px;
          position: relative;
          margin-bottom: 6px;
          line-height: 1.5;
        }
        .debate-points li::before {
          content: '\u00b7';
          position: absolute;
          left: 4px;
          font-weight: 700;
        }

        /* risk row */
        .risk-row {
          display: flex;
          gap: 16px;
          align-items: stretch;
          background: var(--risk-bg);
          border: 1px solid rgba(184, 136, 74, 0.25);
          border-radius: 8px;
          padding: 18px 22px;
          margin-bottom: 32px;
        }
        .risk-label {
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: #8C6A35;
          min-width: 130px;
          padding-top: 2px;
        }
        .risk-content {
          flex: 1;
          font-size: 14px;
          color: var(--ink);
          line-height: 1.55;
        }

        /* verdict */
        .verdict {
          border-radius: 12px;
          padding: 32px;
          text-align: center;
          color: var(--paper);
          position: relative;
          overflow: hidden;
        }
        .verdict.pass { background: var(--forest); }
        .verdict.marginal { background: linear-gradient(135deg, #B89548, var(--gold)); color: var(--forest-deep); }
        .verdict.fail { background: var(--bear); }
        .verdict-label {
          font-family: var(--font-mono);
          font-size: 11px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          opacity: 0.75;
          margin-bottom: 8px;
        }
        .verdict-call {
          font-family: var(--font-display);
          font-size: 56px;
          font-weight: 500;
          line-height: 1;
          margin-bottom: 12px;
          letter-spacing: 0.02em;
        }
        .verdict-confidence {
          font-family: var(--font-mono);
          font-size: 14px;
          letter-spacing: 0.05em;
          margin-bottom: 24px;
          opacity: 0.85;
        }
        .verdict-conditions {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 8px;
          padding: 18px 24px;
          text-align: left;
          max-width: 480px;
          margin: 0 auto;
        }
        .verdict.marginal .verdict-conditions { background: rgba(15, 61, 46, 0.08); }
        .verdict-cond-label {
          font-family: var(--font-mono);
          font-size: 10px;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          opacity: 0.8;
          margin-bottom: 10px;
        }
        .verdict-cond-list {
          list-style: none;
          font-size: 14px;
          padding: 0;
        }
        .verdict-cond-list li {
          padding: 6px 0 6px 18px;
          position: relative;
          line-height: 1.45;
        }
        .verdict-cond-list li::before {
          content: '\u2192';
          position: absolute;
          left: 0;
          opacity: 0.7;
        }

        /* CTA section */
        .vd-cta {
          text-align: center;
        }
        .vd-cta .cta-body {
          max-width: 640px;
          margin: 0 auto 40px;
          font-size: 16px;
          color: var(--ink-soft);
          line-height: 1.7;
        }
        .vd-cta-buttons {
          display: flex;
          justify-content: center;
          gap: 16px;
          flex-wrap: wrap;
        }
        .vd-btn-primary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: var(--forest);
          color: var(--cream);
          font-family: var(--font-body);
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.04em;
          padding: 14px 32px;
          border-radius: 8px;
          text-decoration: none;
          transition: all 0.2s;
        }
        .vd-btn-primary:hover { background: var(--forest-soft); transform: translateY(-1px); }
        .vd-btn-secondary {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: transparent;
          color: var(--forest);
          font-family: var(--font-body);
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.04em;
          padding: 14px 32px;
          border-radius: 8px;
          border: 1px solid var(--forest);
          text-decoration: none;
          transition: all 0.2s;
        }
        .vd-btn-secondary:hover { background: rgba(15, 61, 46, 0.04); }

        /* FAQ */
        .vd-faq-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
          margin-top: 32px;
        }
        .vd-faq-card {
          background: var(--paper);
          border: 1px solid var(--hairline);
          border-radius: 12px;
          padding: 28px;
        }
        .vd-faq-q {
          font-family: var(--font-display);
          font-size: 20px;
          font-weight: 500;
          color: var(--forest);
          line-height: 1.3;
          margin-bottom: 12px;
        }
        .vd-faq-a {
          font-size: 14px;
          color: var(--ink-soft);
          line-height: 1.6;
        }

        /* responsive */
        @media (max-width: 780px) {
          .vd-main { padding: 60px 24px 80px; }
          .analyst-panel, .agent-grid, .agent-grid.tier-2, .debate, .vd-faq-grid {
            grid-template-columns: 1fr;
          }
          .verdict-call { font-size: 44px; }
          .hero-meta { flex-direction: column; align-items: center; gap: 12px; }
          .risk-row { flex-direction: column; }
          .risk-label { min-width: auto; }
        }

        /* staggered entrance */
        @media (prefers-reduced-motion: no-preference) {
          .vd section { opacity: 0; transform: translateY(8px); animation: vdFade 0.6s ease forwards; }
          .vd section:nth-child(1) { animation-delay: 0.05s; }
          .vd section:nth-child(2) { animation-delay: 0.15s; }
          .vd section:nth-child(3) { animation-delay: 0.25s; }
          .vd section:nth-child(4) { animation-delay: 0.35s; }
          .vd section:nth-child(5) { animation-delay: 0.45s; }
          .vd section:nth-child(6) { animation-delay: 0.55s; }
          @keyframes vdFade { to { opacity: 1; transform: translateY(0); } }
        }
        @media (prefers-reduced-motion: reduce) {
          .vd section { opacity: 1; transform: none; animation: none; }
        }
      `}</style>

      <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,400;1,9..144,500&family=DM+Sans:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />

      <div className="vd">
        <main className="vd-main">

          {/* ═══ HERO ═══ */}
          <section className="hero">
            <div className="desk-pill">
              <span className="desk-pill-dot" />
              Available exclusively to NewLeaf Desk subscribers
            </div>
            <div className="eyebrow">Exclusive to NewLeaf Desk</div>
            <h1>The Verification Desk</h1>
            <p className="subhead">A second opinion before you press buy.</p>
            <p className="lede">
              Today, NewLeaf publishes trades after a one-time analysis pipeline orchestrated by Claude CLI.
              The signal speaks once. Verify gives investors a panel of seven specialised agents — analysts,
              a Bull and Bear in adversarial debate, a Risk Manager, and a Judge — that they can convene
              on demand against any trade idea.
            </p>
            <div className="hero-meta">
              <span>Seven specialised agents</span>
              <span>Live debate transcript</span>
              <span>On-demand, sub-60s verdict</span>
            </div>

            <div className="vd-video-wrap" style={{ marginTop: 48 }}>
              <iframe
                src="https://www.youtube.com/embed/bW03V5Re_2g"
                title="NewLeaf Verification Desk"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            </div>
          </section>

          {/* ═══ TARGET ARCHITECTURE ═══ */}
          <section>
            <div className="eyebrow">Target architecture</div>
            <h2>Seven agents. One verdict.</h2>
            <p className="subhead">Four analysts feed a debate. The Judge calls it.</p>

            <div className="diagram-frame">
              <div className="diagram-label">Verification Pipeline</div>
              <img
                src="/verification-desk-architecture.png"
                alt="Verification Pipeline — seven agents flow from investor request through orchestrator, analyst panel, evidence bus, adversarial debate, risk manager, and judge to produce a Pass/Marginal/Fail verdict."
              />
            </div>

            <div className="agent-grid">
              <div className="agent-card purple">
                <div className="agent-name">Analyst · 01</div>
                <div className="agent-title">Technical</div>
                <div className="agent-desc">Trend regime, breakout risk, support/resistance proximity. Wraps the existing trend pillar from the Opportunity Score.</div>
              </div>
              <div className="agent-card green">
                <div className="agent-name">Analyst · 02</div>
                <div className="agent-title">Gamma</div>
                <div className="agent-desc">Wall integrity, gamma flip distance, position relative to the band. Wraps the existing gamma-wall-service.</div>
              </div>
              <div className="agent-card amber">
                <div className="agent-name">Analyst · 03</div>
                <div className="agent-title">Implied vol</div>
                <div className="agent-desc">IV rank, term structure, IV vs HV spread. Is premium fair? Are the wings pricing a hidden catalyst?</div>
              </div>
              <div className="agent-card blue">
                <div className="agent-name">Analyst · 04</div>
                <div className="agent-title">Sentiment</div>
                <div className="agent-desc">Existing four-engine composite (Claude · Grok · Gemini · Reddit). Catalyst flags inside the DTE window.</div>
              </div>
            </div>

            <div className="agent-grid tier-2">
              <div className="agent-card bull">
                <div className="agent-name">Researcher · Bull</div>
                <div className="agent-title">The advocate</div>
                <div className="agent-desc">Reads all four analyst reports. Builds the strongest case for the trade working. Cites historically similar setups.</div>
              </div>
              <div className="agent-card bear">
                <div className="agent-name">Researcher · Bear</div>
                <div className="agent-title">The skeptic</div>
                <div className="agent-desc">Same inputs, opposite mandate. Hunts the failure modes. Two rounds of rebuttal force calibration.</div>
              </div>
              <div className="agent-card risk">
                <div className="agent-name">Risk · 06</div>
                <div className="agent-title">Portfolio fit</div>
                <div className="agent-desc">Correlation, sector concentration, total theta and vega, BP usage, max-loss vs NAV. Reads live Firestore portfolio state.</div>
              </div>
              <div className="agent-card judge">
                <div className="agent-name">Judge · 07</div>
                <div className="agent-title">The verdict</div>
                <div className="agent-desc">Reads debate plus risk verdict. Renders Pass / Marginal / Fail with confidence and the three conditions that would flip it.</div>
              </div>
            </div>
          </section>

          {/* ═══ INTEGRATION SECTION ═══ */}
          <section className="vd-integration">
            <div className="eyebrow">Inside the desk</div>
            <h2>One click from every position.</h2>
            <p className="subhead">Verify lives where your trades live.</p>
            <div className="accent-rule" />
            <p className="integration-body">
              Every position in NewLeaf Desk and every published Pick carries a Verify button. Press it,
              and the desk convenes the panel against live market state — analyst panel, Bull and Bear debate,
              risk check, judge — and streams the verdict back to you in under a minute.
            </p>
          </section>

          {/* ═══ USER JOURNEYS ═══ */}
          <section>
            <div className="eyebrow">User Journeys</div>
            <h2>Three trades. Three verdicts.</h2>
            <p className="subhead">What investors ask. What the desk says back.</p>

            {/* JOURNEY 1: PASS */}
            <div className="journey" id="journey-01">
              <div className="journey-header pass">
                <div>
                  <div className="journey-num">Journey 01</div>
                  <div className="journey-title">Sarah verifies a published Pick</div>
                </div>
                <div className="journey-tag pass">Outcome · Pass</div>
              </div>
              <div className="journey-body">
                <div className="step-label">Investor request</div>
                <p style={{ marginBottom: 24, color: 'var(--ink-soft)', fontSize: 15 }}>
                  Sarah opens NewLeaf Picks on Monday morning and sees an Iron Condor on SPY.
                  Before sizing it into her portfolio, she presses <em>Verify this trade</em>.
                </p>

                <div className="ticket">
                  <div className="ticket-row"><span className="ticket-key">Ticker</span><span className="ticket-val"><strong>SPY</strong> · S&amp;P 500 ETF</span></div>
                  <div className="ticket-row"><span className="ticket-key">Structure</span><span className="ticket-val"><strong>Iron Condor</strong> · 35 DTE</span></div>
                  <div className="ticket-row"><span className="ticket-key">Strikes</span><span className="ticket-val">690p / 695p &nbsp;&mdash;&nbsp; 735c / 740c</span></div>
                  <div className="ticket-row"><span className="ticket-key">Credit</span><span className="ticket-val">$1.85 net &nbsp;·&nbsp; BP req $315 &nbsp;·&nbsp; PoP 72%</span></div>
                  <div className="ticket-source">Source · NewLeaf Picks · published 06:30 UTC</div>
                </div>

                <div className="step-label">Analyst panel</div>
                <div className="analyst-panel">
                  <div className="analyst-tile ok">
                    <div className="analyst-tile-name">Technical</div>
                    <div className="analyst-tile-finding">Range-bound chop</div>
                    <div className="analyst-tile-detail">RSI 54, inside Bollinger. No breakout signal. SMA 50/100 flat-cross.</div>
                  </div>
                  <div className="analyst-tile ok">
                    <div className="analyst-tile-name">Gamma</div>
                    <div className="analyst-tile-finding">Inside the band</div>
                    <div className="analyst-tile-detail">Spot 712.5, walls firm at 690 / 735. GEX positive, no flip near.</div>
                  </div>
                  <div className="analyst-tile ok">
                    <div className="analyst-tile-name">IV</div>
                    <div className="analyst-tile-finding">Sweet spot</div>
                    <div className="analyst-tile-detail">IV rank 42, term structure flat. Wings priced fairly vs realised vol.</div>
                  </div>
                  <div className="analyst-tile ok">
                    <div className="analyst-tile-name">Sentiment</div>
                    <div className="analyst-tile-finding">Quiet tape</div>
                    <div className="analyst-tile-detail">No earnings or macro inside DTE. News tone neutral. Reddit chatter low.</div>
                  </div>
                </div>

                <div className="step-label">Bull / Bear debate</div>
                <div className="debate">
                  <div className="debate-card bull">
                    <div className="debate-role">Bull researcher</div>
                    <p className="debate-quote">&ldquo;All four pillars line up. Theta will outpace gamma as long as the walls hold the range.&rdquo;</p>
                    <ul className="debate-points">
                      <li>30-day realised vol below implied — premium is rich</li>
                      <li>Walls have held this band for 14 of last 20 sessions</li>
                      <li>72% PoP is conservative given the gamma profile</li>
                    </ul>
                  </div>
                  <div className="debate-card bear">
                    <div className="debate-role">Bear researcher</div>
                    <p className="debate-quote">&ldquo;FOMC mid-cycle minutes drop in 12 days. Could reprice IV — but expansion stays inside the band.&rdquo;</p>
                    <ul className="debate-points">
                      <li>FOMC inside DTE window, but no rate decision</li>
                      <li>Concedes after round 2: failure path requires &gt;3&sigma; surprise</li>
                      <li>Bull case stands</li>
                    </ul>
                  </div>
                </div>

                <div className="risk-row">
                  <div className="risk-label">Risk manager</div>
                  <div className="risk-content">
                    Adds $24 theta/day to portfolio. Total theta now $89 — under target $120. SPY correlation with existing positions is low (no other index trades).
                    Max-loss $315 is 0.4% of NAV. <strong>Cleared at full size.</strong>
                  </div>
                </div>

                <div className="verdict pass">
                  <div className="verdict-label">Judge · Final verdict</div>
                  <div className="verdict-call">PASS</div>
                  <div className="verdict-confidence">Confidence 78%</div>
                  <div className="verdict-conditions">
                    <div className="verdict-cond-label">Conditions that would flip this verdict</div>
                    <ul className="verdict-cond-list">
                      <li>Daily close outside Bollinger band on rising volume</li>
                      <li>IV rank rising past 60 (pre-announcement vol expansion)</li>
                      <li>Macro tape risk-off — VIX spike past 20</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* JOURNEY 2: MARGINAL */}
            <div className="journey">
              <div className="journey-header marginal">
                <div>
                  <div className="journey-num">Journey 02</div>
                  <div className="journey-title">David tests his own AAPL idea</div>
                </div>
                <div className="journey-tag marginal">Outcome · Marginal</div>
              </div>
              <div className="journey-body">
                <div className="step-label">Investor request</div>
                <p style={{ marginBottom: 24, color: 'var(--ink-soft)', fontSize: 15 }}>
                  David has been watching AAPL drift up. He drafts a tight Iron Condor at 21 DTE
                  and asks the desk to check it before he commits the buying power.
                </p>

                <div className="ticket">
                  <div className="ticket-row"><span className="ticket-key">Ticker</span><span className="ticket-val"><strong>AAPL</strong></span></div>
                  <div className="ticket-row"><span className="ticket-key">Structure</span><span className="ticket-val"><strong>Iron Condor</strong> · 21 DTE</span></div>
                  <div className="ticket-row"><span className="ticket-key">Strikes</span><span className="ticket-val">220p / 225p &nbsp;&mdash;&nbsp; 255c / 260c</span></div>
                  <div className="ticket-row"><span className="ticket-key">Credit</span><span className="ticket-val">$1.05 net &nbsp;·&nbsp; BP req $395 &nbsp;·&nbsp; PoP 68%</span></div>
                  <div className="ticket-source">Source · Investor draft · entered manually</div>
                </div>

                <div className="step-label">Analyst panel</div>
                <div className="analyst-panel">
                  <div className="analyst-tile warn">
                    <div className="analyst-tile-name">Technical</div>
                    <div className="analyst-tile-finding">Mild bullish drift</div>
                    <div className="analyst-tile-detail">RSI 62. Holding above 50/100 SMA. Trend pushing toward upper wing.</div>
                  </div>
                  <div className="analyst-tile warn">
                    <div className="analyst-tile-name">Gamma</div>
                    <div className="analyst-tile-finding">Short call near flip</div>
                    <div className="analyst-tile-detail">Call wall at 252, gamma flip 254. 255 short strike sits in the danger zone.</div>
                  </div>
                  <div className="analyst-tile bad">
                    <div className="analyst-tile-name">IV</div>
                    <div className="analyst-tile-finding">Premium too thin</div>
                    <div className="analyst-tile-detail">IV rank 22 — bottom of the range. Credit is meagre for the risk taken.</div>
                  </div>
                  <div className="analyst-tile warn">
                    <div className="analyst-tile-name">Sentiment</div>
                    <div className="analyst-tile-finding">One-sided bullish</div>
                    <div className="analyst-tile-detail">Reddit and X skewed long. News tone positive. No earnings inside DTE but momentum-heavy.</div>
                  </div>
                </div>

                <div className="step-label">Bull / Bear debate</div>
                <div className="debate">
                  <div className="debate-card bull">
                    <div className="debate-role">Bull researcher</div>
                    <p className="debate-quote">&ldquo;21 DTE means theta works fast. If the trend stalls between 240–250, this prints in two weeks.&rdquo;</p>
                    <ul className="debate-points">
                      <li>Short DTE accelerates premium decay</li>
                      <li>Long-side wing is far enough from spot</li>
                      <li>If the trend tops out, the trade is clean</li>
                    </ul>
                  </div>
                  <div className="debate-card bear">
                    <div className="debate-role">Bear researcher</div>
                    <p className="debate-quote">&ldquo;Trend is pushing at the call wall, IV is 22, and the credit doesn&rsquo;t compensate. This is the wrong tape for premium-selling.&rdquo;</p>
                    <ul className="debate-points">
                      <li>Short call at 255 is past the gamma flip — adverse profile</li>
                      <li>$1.05 credit on $395 BP is poor risk-adjusted return</li>
                      <li>Sentiment skew suggests breakout, not mean revert</li>
                    </ul>
                  </div>
                </div>

                <div className="risk-row">
                  <div className="risk-label">Risk manager</div>
                  <div className="risk-content">
                    Investor already holds an AAPL credit spread expiring next month. Adding this raises single-name exposure to 18% of theta budget — just under the 20% ceiling.
                    Total vega negative tilts further. <strong>Permitted at half size only.</strong>
                  </div>
                </div>

                <div className="verdict marginal">
                  <div className="verdict-label">Judge · Final verdict</div>
                  <div className="verdict-call">MARGINAL</div>
                  <div className="verdict-confidence">Confidence 51%</div>
                  <div className="verdict-conditions">
                    <div className="verdict-cond-label">What would change this verdict</div>
                    <ul className="verdict-cond-list">
                      <li>Move short call up to 260 — clears the gamma flip</li>
                      <li>Wait for IV rank to lift past 35 — better credit for the risk</li>
                      <li>Or close the existing AAPL position first to free single-name budget</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* JOURNEY 3: FAIL */}
            <div className="journey">
              <div className="journey-header fail">
                <div>
                  <div className="journey-num">Journey 03</div>
                  <div className="journey-title">Priya asks about NVDA into earnings</div>
                </div>
                <div className="journey-tag fail">Outcome · Fail</div>
              </div>
              <div className="journey-body">
                <div className="step-label">Investor request</div>
                <p style={{ marginBottom: 24, color: 'var(--ink-soft)', fontSize: 15 }}>
                  Priya sees NVDA&rsquo;s IV spike and wants to sell premium. She drafts a short strangle
                  at 25 DTE — but earnings are in the window. The desk needs to flag it clearly.
                </p>

                <div className="ticket">
                  <div className="ticket-row"><span className="ticket-key">Ticker</span><span className="ticket-val"><strong>NVDA</strong></span></div>
                  <div className="ticket-row"><span className="ticket-key">Structure</span><span className="ticket-val"><strong>Short Strangle</strong> · 25 DTE</span></div>
                  <div className="ticket-row"><span className="ticket-key">Strikes</span><span className="ticket-val">160p &nbsp;&mdash;&nbsp; 200c</span></div>
                  <div className="ticket-row"><span className="ticket-key">Credit</span><span className="ticket-val">$5.40 net &nbsp;·&nbsp; BP req $4,820 &nbsp;·&nbsp; PoP 64%</span></div>
                  <div className="ticket-source">Source · Investor draft · entered manually</div>
                </div>

                <div className="step-label">Analyst panel</div>
                <div className="analyst-panel">
                  <div className="analyst-tile warn">
                    <div className="analyst-tile-name">Technical</div>
                    <div className="analyst-tile-finding">Choppy uptrend</div>
                    <div className="analyst-tile-detail">Above the 200 SMA but RSI overbought at 71. Whipsaw risk into the print.</div>
                  </div>
                  <div className="analyst-tile bad">
                    <div className="analyst-tile-name">Gamma</div>
                    <div className="analyst-tile-finding">Walls dissolving</div>
                    <div className="analyst-tile-detail">GEX flipping negative. Walls are weak — dealer flows favour breakouts.</div>
                  </div>
                  <div className="analyst-tile bad">
                    <div className="analyst-tile-name">IV</div>
                    <div className="analyst-tile-finding">Earnings vol</div>
                    <div className="analyst-tile-detail">IV rank 78. Term structure backwardated — front-month bid because earnings is priced in.</div>
                  </div>
                  <div className="analyst-tile bad">
                    <div className="analyst-tile-name">Sentiment</div>
                    <div className="analyst-tile-finding">Earnings in 8 days</div>
                    <div className="analyst-tile-detail">Catalyst flagged. Mixed buy-side expectations. Past 4 prints have moved &gt;7%.</div>
                  </div>
                </div>

                <div className="step-label">Bull / Bear debate</div>
                <div className="debate">
                  <div className="debate-card bull">
                    <div className="debate-role">Bull researcher</div>
                    <p className="debate-quote">&ldquo;IV rank 78 is rare. If you can survive the print, the IV crush after earnings pays out fast.&rdquo;</p>
                    <ul className="debate-points">
                      <li>Premium is genuinely rich</li>
                      <li>Strikes are wide — 160 / 200 covers a 12% move</li>
                      <li>Concedes after round 2: this is a coin flip on direction, not a premium-selling trade</li>
                    </ul>
                  </div>
                  <div className="debate-card bear">
                    <div className="debate-role">Bear researcher</div>
                    <p className="debate-quote">&ldquo;Selling naked premium through a known earnings catalyst is the failure mode. The IV is rich because the move is real.&rdquo;</p>
                    <ul className="debate-points">
                      <li>Past 4 earnings moved 7–12% — strikes are not wide enough</li>
                      <li>Undefined risk on both sides — strangle, not condor</li>
                      <li>Gamma walls offer no protection through the print</li>
                    </ul>
                  </div>
                </div>

                <div className="risk-row">
                  <div className="risk-label">Risk manager</div>
                  <div className="risk-content">
                    Undefined-risk position breaches the portfolio&rsquo;s &ldquo;no naked through earnings&rdquo; rule. BP requirement of $4,820 is 14% of NAV in a single-name event trade.
                    Vega exposure would triple. <strong>Blocked. Hard limit.</strong>
                  </div>
                </div>

                <div className="verdict fail">
                  <div className="verdict-label">Judge · Final verdict</div>
                  <div className="verdict-call">FAIL</div>
                  <div className="verdict-confidence">Confidence 22%</div>
                  <div className="verdict-conditions">
                    <div className="verdict-cond-label">What you could do instead</div>
                    <ul className="verdict-cond-list">
                      <li>Wait until after the earnings print — sell into the IV crush at lower IV rank</li>
                      <li>Define the risk — convert to an Iron Condor with $5 wings</li>
                      <li>Reduce size and treat as an event trade, not a premium-seller</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ═══ CTA SECTION ═══ */}
          <section className="vd-cta">
            <div className="eyebrow">Get started</div>
            <h2>Run your first verification in minutes.</h2>
            <p className="cta-body">
              NewLeaf Desk subscribers get unlimited verifications across the full ticker universe,
              full debate transcripts saved to your account, and live progress streaming on web and mobile.
            </p>
            <div className="vd-cta-buttons">
              <a href="/desk" className="vd-btn-primary">Upgrade to Desk &rarr;</a>
              <a href="#journey-01" className="vd-btn-secondary">See a sample verdict</a>
            </div>
          </section>

          {/* ═══ FAQ SECTION ═══ */}
          <section>
            <div className="eyebrow">Questions</div>
            <h2>What you need to know.</h2>
            <p className="subhead">The short answers.</p>

            <div className="vd-faq-grid">
              <div className="vd-faq-card">
                <div className="vd-faq-q">How long does a verification take?</div>
                <div className="vd-faq-a">Typically 30 to 60 seconds end to end. Analysts run in parallel, then the Bull and Bear debate sequentially over two rounds, then the Risk Manager and Judge.</div>
              </div>
              <div className="vd-faq-card">
                <div className="vd-faq-q">Does this give me trading advice?</div>
                <div className="vd-faq-a">No. The desk delivers a structured second opinion with full reasoning. Every verdict comes with the conditions that would flip it. The decision to trade remains yours.</div>
              </div>
              <div className="vd-faq-card">
                <div className="vd-faq-q">Which trades can I verify?</div>
                <div className="vd-faq-a">Any published NewLeaf Pick, any iron condor, broken-wing butterfly, calendar, diagonal, or vertical spread on the ticker universe (currently ~108 symbols).</div>
              </div>
              <div className="vd-faq-card">
                <div className="vd-faq-q">What happens to the debate transcript?</div>
                <div className="vd-faq-a">Saved to your account in NewLeaf Desk. You can revisit any past verification, compare against the realised outcome, and audit the reasoning later.</div>
              </div>
            </div>
          </section>

        </main>
      </div>
    </>
  );
}
