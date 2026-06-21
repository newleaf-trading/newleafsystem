import { Link } from 'react-router-dom';

export default function ChoosingStrategyByIV() {
  return (
    <>
      <p>
        Most traders pick a favorite strategy and force it onto every chart. The iron-condor person
        sells condors in a runaway uptrend; the spread person sells spreads into dead, rangebound tape.
        The structure should not be a preference — it should be an <strong>output of the conditions</strong>.
        Implied volatility, trend, and where the gamma walls sit decide the trade; you just read the
        rules.
      </p>
      <p>
        Here is the actual decision tree we use to turn a scored setup into a specific option
        structure, with the thresholds that gate each choice.
      </p>

      {/* ── Section 1 ── */}
      <h2 id="inputs">The five inputs that decide everything</h2>
      <p>
        Strategy selection takes five readings off the setup:
      </p>
      <ul>
        <li><strong>Band width</strong> — the distance from the put wall to the call wall (the corridor).</li>
        <li><strong>Gamma confidence</strong> — how reliable those walls are.</li>
        <li><strong>Trend direction</strong> — bullish, bearish, or neutral.</li>
        <li><strong>IV regime</strong> — low, normal, or high implied volatility.</li>
        <li><strong>Liquidity</strong> — whether enough contracts trade to build the structure cleanly.</li>
      </ul>
      <p>
        Those five readings — most of which come straight from the{' '}
        <Link to="/blog/automating-technical-analysis-into-a-score">opportunity score</Link> — narrow the
        universe to one structure.
      </p>

      {/* ── Section 2 ── */}
      <h2 id="iv-first">Start with IV: are you selling or buying premium?</h2>
      <p>
        Implied volatility sets the entire posture. It answers the first question before structure even
        comes up: should you be a net seller or a net buyer of options?
      </p>
      <ul>
        <li><strong>IV in the 20–50% sweet spot:</strong> premium is rich enough to sell — favor credit structures (condors, spreads).</li>
        <li><strong>IV below 25% with vol mean-reverting:</strong> premium is cheap — a debit/calendar structure that benefits from vol expanding becomes attractive.</li>
        <li><strong>IV above 50%:</strong> the market is stressed — treat as a danger flag and demand a wider margin, or pass.</li>
      </ul>

      <figure style={{ margin: '24px 0 28px', padding: '18px 18px 12px', background: '#fff', border: '1px solid rgba(17,24,39,0.08)', borderRadius: 14 }}>
        <svg viewBox="0 0 600 112" width="100%" role="img" aria-label="Implied volatility posture: below 20% buy or wait, 20 to 50% sell premium, above 50% caution">
          <text x="300" y="18" textAnchor="middle" fontSize="11" fontWeight="700" fill="#0B2D23" fontFamily="'Inter', sans-serif">Implied volatility sets the posture</text>
          <rect x="30" y="30" width="154" height="32" fill="#D9D5C8" />
          <rect x="184" y="30" width="232" height="32" fill="#2E7D5B" />
          <rect x="416" y="30" width="154" height="32" fill="#B5483A" />
          <text x="107" y="50" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#5a564a" fontFamily="'Inter', sans-serif">Buy / wait</text>
          <text x="300" y="50" textAnchor="middle" fontSize="11" fontWeight="700" fill="#fff" fontFamily="'Inter', sans-serif">Sell premium</text>
          <text x="493" y="50" textAnchor="middle" fontSize="10.5" fontWeight="700" fill="#fff" fontFamily="'Inter', sans-serif">Caution</text>
          {[['0%', 30], ['20%', 184], ['50%', 416], ['70%+', 570]].map(([lbl, x]) => (
            <g key={lbl}>
              <line x1={x} y1="62" x2={x} y2="70" stroke="#9b9b8e" strokeWidth="1" />
              <text x={x} y="84" textAnchor="middle" fontSize="10" fill="#9b9b8e" fontFamily="'Space Mono', monospace">{lbl}</text>
            </g>
          ))}
        </svg>
        <figcaption style={{ fontFamily: "'Inter', sans-serif", fontSize: 12.5, color: '#6b6b60', textAlign: 'center', marginTop: 6 }}>
          High IV → sell premium. Low IV → buy or wait. The posture comes before the structure.
        </figcaption>
      </figure>

      <p>
        If you only remember one thing: <strong>high IV means sell, low IV means buy (or wait)</strong>.
        For the full treatment, see{' '}
        <Link to="/blog/implied-volatility-rank-explained">implied volatility rank explained</Link>.
      </p>

      {/* ── Section 3 ── */}
      <h2 id="decision-tree">The structure decision tree</h2>
      <p>
        With IV setting the posture, trend and the gamma corridor pick the exact structure. These are
        the real gates:
      </p>
      <table>
        <thead>
          <tr><th>Structure</th><th>Fires when</th></tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Iron Condor</strong></td>
            <td>Neutral trend, band width 3–15%, gamma confidence ≥ 60%, and ≥ 50 contracts of liquidity. The clean, narrow-corridor base case.</td>
          </tr>
          <tr>
            <td><strong>Iron Butterfly</strong></td>
            <td>Walls exist but the band has converged below 3% near the money. Narrowest profit zone, highest max profit.</td>
          </tr>
          <tr>
            <td><strong>Broken-Wing Butterfly</strong></td>
            <td>Band too wide for a condor (15–40%) with weak-but-present walls, or 10–35% with confidence ≥ 30% and IV ≥ 25%. Anchors to one wall and zeroes risk on a side.</td>
          </tr>
          <tr>
            <td><strong>Bull Put Spread</strong></td>
            <td>Bullish trend with a put wall providing support. Sell the put at the floor, buy protection below.</td>
          </tr>
          <tr>
            <td><strong>Bear Call Spread</strong></td>
            <td>Bearish trend with a call wall providing resistance. Sell the call at the ceiling, buy protection above.</td>
          </tr>
          <tr>
            <td><strong>Calendar Spread</strong></td>
            <td>Neutral trend, IV below 25%, and IV running below realized vol (a mean-reversion signal). A long-vol, theta-positive structure for cheap-premium regimes.</td>
          </tr>
        </tbody>
      </table>
      <div className="blog-callout tip">
        <strong>Notice what decides the directional trades.</strong>
        Bull put and bear call spreads are not guesses about direction — they fire when the trend
        engine and a gamma wall <em>agree</em>. The wall gives the short strike a structural reason to
        hold.
      </div>

      {/* ── Section 4 ── */}
      <h2 id="regime">Trend strength gates the choice</h2>
      <p>
        Before any structure is chosen, the regime is classified by trend strength (an ADX-style read).
        This is the gate that stops you from selling a neutral condor into a freight-train trend:
      </p>
      <ul>
        <li><strong>Strong trend (ADX ≥ 25)</strong> with a clear directional bias → a <strong>directional spread</strong> (bull put or bear call).</li>
        <li><strong>Weak trend (ADX &lt; 20)</strong> with reliable gamma and price inside the band → a <strong>neutral condor</strong>.</li>
        <li><strong>Overbought or oversold without a trend</strong> → a <strong>mean-reversion directional</strong> play.</li>
        <li><strong>Developing trend (ADX 20–25)</strong> → conviction is reduced; the idea is more likely to be parked on the watchlist than approved.</li>
      </ul>
      <p>
        Pair this with the score&apos;s decision tiers and you get the full filter: a structure is only
        recommended when the conditions, the corridor, and the regime line up.
      </p>

      {/* ── Section 5 ── */}
      <h2 id="management">Choosing the trade is half the job — managing it is the other half</h2>
      <p>
        Once a structure is on, it is evaluated against five states, checked in priority order so the
        worst problems are handled first:
      </p>
      <table>
        <thead>
          <tr><th>Priority</th><th>State</th><th>Trigger</th></tr>
        </thead>
        <tbody>
          <tr><td>1</td><td><strong>Exit</strong></td><td>Loss reaches ~1.5× the credit, or a short strike is breached for two-plus sessions.</td></tr>
          <tr><td>2</td><td><strong>Take profit</strong></td><td>~50% of max profit captured (condor); ~25% (butterfly).</td></tr>
          <tr><td>3</td><td><strong>Action needed</strong></td><td>Short-strike delta climbing toward the money; consider a roll.</td></tr>
          <tr><td>4</td><td><strong>Monitor</strong></td><td>Delta rising or ≤ 21 days to expiry; watch closely.</td></tr>
          <tr><td>5</td><td><strong>On track</strong></td><td>Behaving normally; hold.</td></tr>
        </tbody>
      </table>
      <p>
        The priority ordering matters: you close disasters before you bother optimizing winners. Size
        every one of these the same disciplined way — see the{' '}
        <Link to="/blog/position-sizing-framework">position sizing framework</Link> — and the structure
        choice becomes one repeatable step in a repeatable process.
      </p>

      {/* ── FAQ ── */}
      <h2 id="faq">Frequently asked questions</h2>
      <div className="blog-faq">
        <div className="blog-faq-item">
          <div className="blog-faq-q">Why does band width matter so much?</div>
          <div className="blog-faq-a">
            The corridor between the gamma walls is the trade&apos;s working room. A narrow, reliable band
            suits an iron condor; a wide band needs an asymmetric structure like a broken-wing butterfly;
            a collapsed band points to an iron butterfly. The width literally picks the shape.
          </div>
        </div>
        <div className="blog-faq-item">
          <div className="blog-faq-q">When would you buy premium instead of selling it?</div>
          <div className="blog-faq-a">
            When IV is low (under ~25%) and sitting below realized volatility — a sign vol may revert
            upward. There, a calendar spread that is long vol and theta-positive can beat selling thin
            premium for almost no reward.
          </div>
        </div>
        <div className="blog-faq-item">
          <div className="blog-faq-q">Can a high score still be a no-trade?</div>
          <div className="blog-faq-a">
            Yes. Guardrails only downgrade. A developing trend, thin liquidity, or price about to test a
            wall can move an otherwise-approved idea to the watchlist. The structure is the last step,
            not the first.
          </div>
        </div>
      </div>

      <div className="blog-callout warning">
        <strong>Educational disclaimer.</strong>
        This article is for educational purposes only and is not investment advice. Strategy rules and
        thresholds are illustrative of one systematic approach and do not guarantee any outcome. Options
        involve substantial risk and are not suitable for all investors.
      </div>
    </>
  );
}
