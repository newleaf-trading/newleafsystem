import { Link } from 'react-router-dom';

export default function AutomatingTechnicalAnalysis() {
  return (
    <>
      <p>
        Ask ten traders to read the same chart and you will get ten opinions. Ask the same trader on
        two different days and you might get two. Discretionary technical analysis is inconsistent by
        nature — it depends on mood, memory, and which indicator caught your eye first. The fix is not
        a better indicator. It is <strong>turning the whole analysis into a single, reproducible
        number</strong>.
      </p>
      <p>
        This is how we automate technical analysis into a 0–100 opportunity score: the same six
        signals, computed the same way, on every symbol, every fifteen minutes — then combined into
        one figure you can rank, filter, and act on without re-litigating the chart each time.
      </p>

      {/* ── Section 1 ── */}
      <h2 id="six-signals">Six signals, computed the same way every time</h2>
      <p>
        Every symbol runs through the same battery of indicators on 250 days of price history,
        refreshed every fifteen minutes during market hours:
      </p>
      <ul>
        <li><strong>RSI (14-period)</strong> — momentum and overbought/oversold extremes.</li>
        <li><strong>Bollinger Bands (20-period, 2σ)</strong> — volatility and squeeze detection.</li>
        <li><strong>SMA 50 / 100 / 200</strong> — the moving-average stack that defines trend.</li>
        <li><strong>Realized volatility (30-day)</strong> — how much the stock has actually moved.</li>
        <li><strong>ATR % (14-period)</strong> — the expected daily move as a percentage.</li>
        <li><strong>Gamma walls</strong> — where dealer positioning concentrates support and resistance.</li>
      </ul>
      <p>
        The value of automation here is not any single calculation — it is that the calculation never
        changes. No symbol gets the benefit of the doubt; none gets unfairly punished. Consistency is
        the edge.
      </p>

      {/* ── Section 2 ── */}
      <h2 id="three-pillars">Three pillars, one score</h2>
      <p>
        The signals roll up into three weighted pillars that sum to 100:
      </p>
      <blockquote>
        Score = Gamma (0–40) + IV (0–35) + Trend (0–25) = Total (0–100)
      </blockquote>

      <figure style={{ margin: '24px 0 28px', padding: '20px 18px 12px', background: '#fff', border: '1px solid rgba(17,24,39,0.08)', borderRadius: 14 }}>
        <svg viewBox="0 0 600 96" width="100%" role="img" aria-label="The 0 to 100 score splits into Gamma 40 points, IV 35 points, and Trend 25 points">
          <rect x="0" y="14" width="240" height="44" fill="#0B2D23" />
          <rect x="240" y="14" width="210" height="44" fill="#C9A96E" />
          <rect x="450" y="14" width="150" height="44" fill="#6FA287" />
          <line x1="240" y1="14" x2="240" y2="58" stroke="#F7F4EE" strokeWidth="2" />
          <line x1="450" y1="14" x2="450" y2="58" stroke="#F7F4EE" strokeWidth="2" />
          <text x="120" y="34" textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff" fontFamily="'Inter', sans-serif">Gamma</text>
          <text x="120" y="50" textAnchor="middle" fontSize="11" fill="rgba(255,255,255,.85)" fontFamily="'Space Mono', monospace">40 pts</text>
          <text x="345" y="34" textAnchor="middle" fontSize="13" fontWeight="700" fill="#0B2D23" fontFamily="'Inter', sans-serif">IV</text>
          <text x="345" y="50" textAnchor="middle" fontSize="11" fill="#3d3d35" fontFamily="'Space Mono', monospace">35 pts</text>
          <text x="525" y="34" textAnchor="middle" fontSize="13" fontWeight="700" fill="#0B2D23" fontFamily="'Inter', sans-serif">Trend</text>
          <text x="525" y="50" textAnchor="middle" fontSize="11" fill="#1f3a2e" fontFamily="'Space Mono', monospace">25 pts</text>
          <text x="0" y="80" textAnchor="start" fontSize="10" fill="#9b9b8e" fontFamily="'Space Mono', monospace">0</text>
          <text x="600" y="80" textAnchor="end" fontSize="10" fill="#9b9b8e" fontFamily="'Space Mono', monospace">100</text>
        </svg>
        <figcaption style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: '#6b6b60', textAlign: 'center', marginTop: 6 }}>
          Three weighted pillars sum to one 0–100 opportunity score. Gamma carries the most weight.
        </figcaption>
      </figure>

      <table>
        <thead>
          <tr><th>Pillar</th><th>Max points</th><th>What it measures</th></tr>
        </thead>
        <tbody>
          <tr><td>Gamma</td><td>40</td><td>Wall strength and the quality of the price corridor.</td></tr>
          <tr><td>IV</td><td>35</td><td>Whether implied volatility sits in the premium-selling sweet spot.</td></tr>
          <tr><td>Trend</td><td>25</td><td>Directional conviction, scaled by how strong the trend actually is.</td></tr>
        </tbody>
      </table>
      <p>
        Gamma gets the most weight because the corridor between dealer walls is the most actionable
        piece of information for defined-risk premium selling — it tells you where price is likely to
        stall.
      </p>

      {/* ── Section 3 ── */}
      <h2 id="gamma-pillar">The Gamma pillar degrades gracefully</h2>
      <p>
        Not every stock has clean options data, so the gamma pillar uses a three-tier fallback — it
        always produces a score, just with appropriately lower confidence:
      </p>
      <table>
        <thead>
          <tr><th>Data available</th><th>How it scores</th><th>Cap</th></tr>
        </thead>
        <tbody>
          <tr><td>Full gamma exposure (GEX)</td><td>wall quality 60% + band quality 40%</td><td>40 pts</td></tr>
          <tr><td>Open interest only</td><td>band width quality</td><td>28 pts</td></tr>
          <tr><td>Technicals only</td><td>RSI 50% + Bollinger width 50%</td><td>22 pts</td></tr>
        </tbody>
      </table>
      <p>
        A stock with no options data simply cannot earn the top tier — which is correct. The score
        reflects not just the setup, but how much we can trust the data behind it.
      </p>

      {/* ── Section 4 ── */}
      <h2 id="iv-pillar">The IV pillar rewards the sweet spot</h2>
      <p>
        Premium selling works best in a specific volatility band. Too low and the premium is not worth
        the risk; too high and the market is panicking. The IV pillar encodes exactly that:
      </p>
      <ul>
        <li><strong>IV below 20%:</strong> score scales down proportionally — premiums are too thin.</li>
        <li><strong>IV 20–50%:</strong> full 35 points — the sweet spot for selling premium.</li>
        <li><strong>IV above 50%:</strong> score decays toward zero — elevated risk, treat as a danger flag.</li>
      </ul>
      <p>
        For the deeper logic on volatility, see{' '}
        <Link to="/blog/implied-volatility-rank-explained">implied volatility rank explained</Link>.
      </p>

      {/* ── Section 5 ── */}
      <h2 id="trend-pillar">The Trend pillar rewards conviction, not direction</h2>
      <p>
        The trend pillar does not care whether a stock is bullish or bearish — it rewards
        <em> conviction in either direction</em> and penalizes indecision. A strongly bullish tape and
        a strongly bearish tape both score well; a directionless chop scores low. That conviction is
        then scaled by trend strength (an ADX-style multiplier), so a weak trend cannot masquerade as a
        strong one.
      </p>
      <table>
        <thead>
          <tr><th>Trend score</th><th>State</th></tr>
        </thead>
        <tbody>
          <tr><td>0.85</td><td>Strong bullish — price above the stack, well clear of the 200-day</td></tr>
          <tr><td>0.70</td><td>Bullish — SMA50 over SMA100, price above SMA50</td></tr>
          <tr><td>0.50</td><td>Neutral — moving averages converging</td></tr>
          <tr><td>0.30</td><td>Bearish — price below SMA50, stack rolling over</td></tr>
          <tr><td>0.10</td><td>Strong bearish — price below the stack, well under the 200-day</td></tr>
        </tbody>
      </table>

      {/* ── Section 6 ── */}
      <h2 id="reading-the-score">Reading the number — and the decision it drives</h2>
      <p>
        Once the three pillars are summed, the total maps to a plain-English verdict:
      </p>
      <table>
        <thead>
          <tr><th>Score</th><th>Reading</th></tr>
        </thead>
        <tbody>
          <tr><td>75–100</td><td>Excellent — high-confidence setup</td></tr>
          <tr><td>60–74</td><td>Good — solid, with minor weakness</td></tr>
          <tr><td>40–59</td><td>Marginal — mixed signals, trade with caution</td></tr>
          <tr><td>0–39</td><td>Avoid — multiple pillars failing</td></tr>
        </tbody>
      </table>
      <p>
        The score then feeds a decision tier. A score of <strong>65 or higher</strong> that also clears
        its setup gates becomes an <strong>APPROVED</strong> idea; <strong>40–64</strong> lands on the{' '}
        <strong>WATCHLIST</strong>; below 40 is <strong>NO-TRADE</strong>. Guardrails can only
        <em> downgrade</em>, never upgrade: a developing (not-yet-confirmed) trend, or price about to
        test a wall, will knock an otherwise-approved idea down to the watchlist. The system is built to
        say &quot;not yet&quot; cheaply.
      </p>
      <div className="blog-callout tip">
        <strong>Why automate at all?</strong>
        A human cannot score every optionable symbol every fifteen minutes without fatigue or bias.
        Software can. The win is not that the machine is smarter — it is that it is <em>consistent</em>,
        and consistency is what turns a vague &quot;this looks good&quot; into a number you can rank,
        compare, and trust tomorrow.
      </div>

      {/* ── FAQ ── */}
      <h2 id="faq">Frequently asked questions</h2>
      <div className="blog-faq">
        <div className="blog-faq-item">
          <div className="blog-faq-q">Does a high score mean the trade will win?</div>
          <div className="blog-faq-a">
            No. The score measures the <em>quality of the setup and the data behind it</em> at a moment
            in time — not the outcome. A high score tilts the odds; it does not remove risk. Markets can
            and do move against well-scored setups.
          </div>
        </div>
        <div className="blog-faq-item">
          <div className="blog-faq-q">Why weight gamma more than trend?</div>
          <div className="blog-faq-a">
            For defined-risk premium selling, the corridor between dealer walls is the most actionable
            information — it frames where price is likely to stall. Trend matters, but it is a tilt, so
            it carries fewer points.
          </div>
        </div>
        <div className="blog-faq-item">
          <div className="blog-faq-q">What happens to stocks with no options data?</div>
          <div className="blog-faq-a">
            They still get a score via the technicals-only fallback, but the gamma pillar is capped well
            below the top tier. The number honestly reflects lower confidence rather than pretending the
            data exists.
          </div>
        </div>
      </div>

      <div className="blog-callout warning">
        <strong>Educational disclaimer.</strong>
        This article is for educational purposes only and is not investment advice. Scores and signals
        are analytical tools, not predictions, and do not guarantee any outcome. Options involve
        substantial risk and are not suitable for all investors.
      </div>
    </>
  );
}
