import { Link } from 'react-router-dom';

export default function ModelPortfolioOptionsOverlay() {
  return (
    <>
      <p>
        Most people hold one bet: a pile of stocks, and hope. It works until it doesn&apos;t — and the
        years it doesn&apos;t are the ones that matter. A more durable approach is to build a
        <strong> balanced core</strong> that holds up across different economic weather, then add a
        <strong> small, defined-risk options overlay</strong> for extra yield on top. This article walks
        through one illustrative model: a four-fund core, a tiny options sleeve, and a rebalancing rule.
      </p>
      <p>
        To be clear up front: this is an <em>educational illustration</em>, not a recommendation. The
        right mix for you depends on your goals, time horizon, and risk tolerance — and on advice from a
        professional who knows your situation.
      </p>

      {/* ── Section 1 ── */}
      <h2 id="the-core">The core: four funds that disagree with each other</h2>
      <p>
        Diversification only works when your holdings do <em>not</em> move together. The point of this
        core is that each piece tends to shine when another struggles, smoothing the overall ride:
      </p>
      <table>
        <thead>
          <tr><th>Allocation</th><th>Fund</th><th>Role</th></tr>
        </thead>
        <tbody>
          <tr><td><strong>40%</strong></td><td>SPY</td><td>Equity growth — the engine of long-run returns.</td></tr>
          <tr><td><strong>30%</strong></td><td>TLT</td><td>Long Treasuries — recession and deflation hedge; rises in flights to safety.</td></tr>
          <tr><td><strong>20%</strong></td><td>GLD</td><td>Gold — inflation and crisis hedge; insurance against currency stress.</td></tr>
          <tr><td><strong>10%</strong></td><td>SLV</td><td>Silver — inflation plus industrial demand; a smaller, more volatile satellite.</td></tr>
        </tbody>
      </table>
      <p>
        That is 40% growth and 60% in assets that historically zig when stocks zag. The mix will not win
        every year — by design, something is usually lagging. What it aims for is fewer catastrophic
        years, which is what actually lets compounding work.
      </p>

      {/* ── Section 2 ── */}
      <h2 id="weather">Why a mix like this holds up across regimes</h2>
      <p>
        No one knows which economic regime is next. Instead of predicting, this core tries to own
        something for each:
      </p>
      <table>
        <thead>
          <tr><th>Regime</th><th>Tends to help</th><th>Tends to hurt</th></tr>
        </thead>
        <tbody>
          <tr><td>Growth / expansion</td><td>SPY</td><td>TLT, gold lag</td></tr>
          <tr><td>Recession / deflation</td><td>TLT</td><td>SPY</td></tr>
          <tr><td>Inflation</td><td>GLD, SLV</td><td>TLT</td></tr>
          <tr><td>Crisis / flight to safety</td><td>TLT, GLD</td><td>SPY</td></tr>
        </tbody>
      </table>
      <div className="blog-callout tip">
        <strong>The goal is not maximum return — it is a smoother path.</strong>
        A portfolio that drops 50% needs a 100% gain just to break even. One that only ever draws down
        15–20% spends far less time clawing back, so the long-run compounding stays intact.
      </div>

      {/* ── Section 3 ── */}
      <h2 id="overlay">The options overlay: small by design (~5%)</h2>
      <p>
        On top of the core, this model sets aside roughly <strong>5% of capital</strong> as the risk and
        margin budget for a <strong>defined-risk options income</strong> sleeve — selling premium with
        structures like iron condors and credit spreads. The core does the heavy lifting; the overlay is a
        yield satellite, not the main event.
      </p>
      <p>
        Keeping it to ~5% is the whole discipline. Even a brutal losing stretch in the options sleeve
        barely scratches the portfolio, because the position sizing is small relative to total capital —
        exactly the risk-of-ruin logic in our{' '}
        <Link to="/blog/compounding-small-edge-3x-five-years">compounding article</Link>. Size each trade
        with the <Link to="/blog/position-sizing-framework">position sizing framework</Link>, and let the{' '}
        <Link to="/blog/choosing-an-options-strategy-by-iv-and-regime">conditions choose the structure</Link>.
      </p>
      <div className="blog-callout warning">
        <strong>Margin is leverage, and leverage cuts both ways.</strong>
        A small, defined-risk overlay is very different from running large leveraged or undefined-risk
        positions. Keep the sleeve small, keep every position defined-risk, and never let the &quot;extra
        yield&quot; tempt you into sizing that can damage the core.
      </div>

      {/* ── Section 4 ── */}
      <h2 id="rebalancing">Rebalancing: sell strength, buy weakness — on a rule</h2>
      <p>
        Left alone, the winners grow and quietly take over the portfolio, concentrating risk in whatever
        just ran up. Rebalancing fixes that by periodically trimming what is above target and topping up
        what is below — a disciplined, counter-cyclical habit that forces &quot;sell high, buy low&quot;
        without prediction. Focus the rebalancing on the three core pillars — <strong>SPY, TLT, and
        GLD</strong> — with silver treated as a smaller satellite that can drift a bit more.
      </p>
      <p>
        Two common rules (pick one and stick to it):
      </p>
      <ul>
        <li><strong>Calendar:</strong> rebalance back to target weights on a fixed schedule — quarterly or annually.</li>
        <li><strong>Threshold bands:</strong> rebalance only when a holding drifts beyond a band (for example, ±5 percentage points, or ±20% of its target weight). This trades less and lets winners run a little.</li>
      </ul>
      <p>
        An example of the threshold idea: if SPY&apos;s 40% target drifts to 47% after a strong run, you
        trim it back to 40% and redeploy the proceeds into whatever has fallen below target — often TLT or
        gold. You are systematically taking chips off whatever is hot and adding to whatever is out of
        favor. Over time, that harvested volatility is a quiet source of return and, more importantly, of
        risk control.
      </p>
      <div className="blog-callout tip">
        <strong>Mind the frictions.</strong>
        Rebalancing in a taxable account can trigger taxable gains, and every trade has costs. Doing it in
        tax-advantaged accounts, or using new contributions to top up laggards, keeps the bill down.
      </div>

      {/* ── FAQ ── */}
      <h2 id="faq">Frequently asked questions</h2>
      <div className="blog-faq">
        <div className="blog-faq-item">
          <div className="blog-faq-q">Is this the &quot;right&quot; allocation for me?</div>
          <div className="blog-faq-a">
            There is no universal right allocation. These weights are one illustrative model, not advice. A
            younger investor might tilt more to equities; someone near retirement might hold more bonds.
            Use it as a framework to think about diversification, not a prescription.
          </div>
        </div>
        <div className="blog-faq-item">
          <div className="blog-faq-q">How often should I rebalance?</div>
          <div className="blog-faq-a">
            Most evidence suggests less is more — quarterly or annually, or only when a holding breaks its
            threshold band. Over-rebalancing piles up costs and taxes without improving results. Consistency
            matters more than frequency.
          </div>
        </div>
        <div className="blog-faq-item">
          <div className="blog-faq-q">Why keep the options sleeve so small?</div>
          <div className="blog-faq-a">
            Because its job is to add a little yield, not to become the portfolio. At ~5%, even a bad run in
            the overlay is survivable and the diversified core stays in charge. Size discipline is what keeps
            the strategy repeatable.
          </div>
        </div>
      </div>

      <div className="blog-callout warning">
        <strong>Educational disclaimer.</strong>
        This article is for educational purposes only and is not investment advice or a recommendation to
        buy or sell any security. Allocations are hypothetical and illustrative; they do not guarantee any
        outcome and may not be suitable for your circumstances. Diversification does not ensure a profit or
        protect against loss. Options and margin involve substantial risk and are not suitable for all
        investors. Consult a licensed financial professional before making investment decisions.
      </div>
    </>
  );
}
