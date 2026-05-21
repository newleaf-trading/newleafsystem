import { Link } from 'react-router-dom';

export default function ImpliedVolatilityRank() {
  return (
    <>
      {/* ── Section 1: What Is Implied Volatility? ── */}
      <h2 id="what-is-iv">What Is Implied Volatility?</h2>
      <p>
        Before you can understand IV Rank, you need a solid grasp of <strong>implied volatility</strong> itself.
        Implied volatility (IV) is the market's consensus forecast of how much a stock will move over a given
        period. It is not a prediction of direction — it is a prediction of <em>magnitude</em>.
      </p>
      <p>
        When you see that AAPL has an IV of 28%, the options market is implying that AAPL will move
        roughly 28% on an annualized basis. Higher IV means the market expects bigger swings; lower IV
        means it expects calm sailing.
      </p>

      <h3>IV vs. Historical Volatility</h3>
      <p>
        Traders often confuse implied volatility with <strong>historical volatility (HV)</strong>.
        Historical volatility is backward-looking — it measures how much the stock actually moved over a
        past period (usually 20 or 30 trading days). Implied volatility is forward-looking — it is
        derived from current option prices using a pricing model like Black-Scholes.
      </p>
      <ul>
        <li><strong>Historical Volatility (HV):</strong> What <em>did</em> happen. Calculated from past closing prices.</li>
        <li><strong>Implied Volatility (IV):</strong> What the market <em>expects</em> to happen. Extracted from live option prices.</li>
      </ul>
      <p>
        The gap between IV and HV is where opportunity lives. When IV is significantly higher than HV,
        options may be overpriced relative to the stock's actual movement — a key signal for{' '}
        <Link to="/blog/selling-options-for-income">premium sellers</Link>.
      </p>

      <div className="blog-callout tip">
        <strong>Key Insight</strong>
        Research consistently shows that implied volatility overstates realized moves roughly 85% of the
        time. This "volatility risk premium" is the structural edge that premium sellers exploit.
      </div>

      {/* ── Section 2: What Is IV Rank? ── */}
      <h2 id="what-is-iv-rank">What Is IV Rank (IVR)?</h2>
      <p>
        <strong>IV Rank</strong> tells you where the current implied volatility sits relative to its own
        range over the past 52 weeks. It answers a simple but powerful question: <em>Is IV high or low
        for this particular stock right now?</em>
      </p>

      <h3>The IV Rank Formula</h3>
      <p>
        The calculation is straightforward:
      </p>
      <blockquote>
        IV Rank = (Current IV - 52-Week IV Low) / (52-Week IV High - 52-Week IV Low) x 100
      </blockquote>
      <p>
        The result is a number on a <strong>0 to 100 scale</strong>:
      </p>
      <ul>
        <li><strong>IVR = 0</strong> — Current IV is at the 52-week low. Options are as cheap as they have been all year.</li>
        <li><strong>IVR = 50</strong> — Current IV is exactly halfway between its annual high and low.</li>
        <li><strong>IVR = 100</strong> — Current IV is at the 52-week high. Options are as expensive as they have been all year.</li>
      </ul>

      <h3>A Worked Example</h3>
      <p>
        Suppose MSFT currently has an IV of 32%. Over the past year, its IV ranged from a low of 20%
        to a high of 50%.
      </p>
      <table>
        <thead>
          <tr>
            <th>Metric</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Current IV</td><td>32%</td></tr>
          <tr><td>52-Week IV Low</td><td>20%</td></tr>
          <tr><td>52-Week IV High</td><td>50%</td></tr>
          <tr><td>IV Rank</td><td>(32 - 20) / (50 - 20) x 100 = <strong>40</strong></td></tr>
        </tbody>
      </table>
      <p>
        An IVR of 40 means MSFT's current volatility is 40% of the way between its lowest and highest
        levels over the past year — moderately low, but not rock-bottom.
      </p>

      {/* ── Section 3: IV Rank vs. IV Percentile ── */}
      <h2 id="rank-vs-percentile">IV Rank vs. IV Percentile</h2>
      <p>
        These two metrics sound similar and are frequently confused, but they measure different things.
        Understanding the distinction will sharpen your trade selection.
      </p>

      <table>
        <thead>
          <tr>
            <th>Metric</th>
            <th>What It Measures</th>
            <th>Sensitive To</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>IV Rank</strong></td>
            <td>Where current IV falls within the 52-week high/low range</td>
            <td>Extreme spikes (one big event can skew the range)</td>
          </tr>
          <tr>
            <td><strong>IV Percentile</strong></td>
            <td>Percentage of trading days in the past year with IV below the current level</td>
            <td>Overall distribution of IV readings</td>
          </tr>
        </tbody>
      </table>

      <p>
        Here is why the difference matters. Imagine a stock spent 350 of the last 252 trading days with
        IV between 20% and 25%, then had a single earnings spike to 80%. Today IV is 30%.
      </p>
      <ul>
        <li><strong>IV Rank:</strong> (30 - 20) / (80 - 20) x 100 = only <strong>17</strong> — looks very low.</li>
        <li><strong>IV Percentile:</strong> IV is higher than it was on about 95% of trading days = <strong>95th percentile</strong> — looks very high.</li>
      </ul>
      <p>
        The IV Rank got distorted by that single spike. IV Percentile gives a more stable view of
        where IV typically resides.
      </p>

      <div className="blog-callout tip">
        <strong>When to Use Each</strong>
        Many professional traders check both. Use IV Rank for a quick "high or low" read, but confirm
        with IV Percentile — especially for stocks with recent earnings or event-driven spikes. If both
        metrics agree, you have higher conviction.
      </div>

      {/* ── Section 4: Why IV Rank Matters for Premium Sellers ── */}
      <h2 id="why-it-matters">Why IV Rank Matters for Premium Sellers</h2>
      <p>
        If you sell options — <Link to="/blog/iron-condor-strategy-explained">iron condors</Link>,
        credit spreads, strangles, or any other premium-collection strategy — IV Rank is one of the
        most important filters in your toolkit. Here is why.
      </p>

      <h3>High IVR = Expensive Options = Better Premiums</h3>
      <p>
        When IV Rank is elevated, option prices are inflated relative to where they normally trade.
        Selling an iron condor when IVR is 65 collects meaningfully more premium than selling the
        identical spread when IVR is 15. That extra premium translates directly into:
      </p>
      <ul>
        <li><strong>Wider breakeven points</strong> — your trade can absorb a larger move before losing money.</li>
        <li><strong>Higher max profit</strong> — you keep more if the stock stays inside your strikes.</li>
        <li><strong>Better risk/reward ratio</strong> — the same defined-risk structure earns more for the same max loss.</li>
      </ul>

      <h3>The Mean-Reversion Edge</h3>
      <p>
        Volatility is one of the most mean-reverting metrics in all of finance. When IV spikes, it
        almost always contracts back toward its average — and it typically does so faster than it
        expanded. This is the core structural edge for premium sellers:
      </p>
      <ol>
        <li>IV spikes (often on fear, earnings anticipation, or macro uncertainty).</li>
        <li>You sell premium at elevated IV levels.</li>
        <li>IV contracts back toward its mean.</li>
        <li>Your short options lose value (that is your profit as a seller).</li>
      </ol>
      <p>
        By using IV Rank as a filter, you are systematically timing your entries to when this
        mean-reversion tailwind is strongest.
      </p>

      <div className="blog-callout warning">
        <strong>Important Caveat</strong>
        High IV Rank does not mean "sell blindly." Sometimes IV is high for good reason — an upcoming
        earnings report, FDA decision, or macro event. Always understand <em>why</em> IV is elevated
        before putting on a trade. If the event hasn't happened yet, IV may continue climbing.
      </div>

      {/* ── Section 5: How to Use IV Rank in Trade Selection ── */}
      <h2 id="trade-selection">How to Use IV Rank in Trade Selection</h2>
      <p>
        Not all IV Rank levels are created equal. Here is a practical framework for incorporating IVR
        into your trade decisions.
      </p>

      <table>
        <thead>
          <tr>
            <th>IV Rank</th>
            <th>Environment</th>
            <th>Strategy Guidance</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>0 - 15</strong></td>
            <td>Very low IV</td>
            <td>Avoid selling premium. Consider buying strategies (debit spreads, long options) if you have a directional thesis.</td>
          </tr>
          <tr>
            <td><strong>15 - 30</strong></td>
            <td>Below average</td>
            <td>Selective selling only. Require strong technical or fundamental conviction to justify entry.</td>
          </tr>
          <tr>
            <td><strong>30 - 50</strong></td>
            <td>Moderate</td>
            <td>Reasonable for selling premium with proper position sizing. This is where most trades land.</td>
          </tr>
          <tr>
            <td><strong>50 - 75</strong></td>
            <td>Elevated — ideal</td>
            <td>Sweet spot for credit spreads, iron condors, and strangles. Strong mean-reversion tailwind.</td>
          </tr>
          <tr>
            <td><strong>75 - 100</strong></td>
            <td>Very high IV</td>
            <td>Excellent premiums but investigate the cause. Size conservatively. Consider wider wings for added protection.</td>
          </tr>
        </tbody>
      </table>

      <h3>Practical Guidelines</h3>
      <ul>
        <li><strong>Minimum threshold of IVR 30</strong> for any premium-selling trade. Below that, the risk/reward tilts against you.</li>
        <li><strong>IVR above 50 is ideal</strong> — this is where you want to concentrate your selling activity.</li>
        <li><strong>Scale position size with IVR.</strong> At IVR 70, you might allocate a full position. At IVR 35, use half-size.</li>
        <li><strong>Combine with DTE (days to expiration).</strong> Selling 30-45 DTE options when IVR is above 50 captures the best theta decay curve with elevated premium.</li>
      </ul>

      <div className="blog-callout tip">
        <strong>Pro Tip</strong>
        When IVR is above 50, consider selling slightly wider iron condors or strangles to give
        yourself more room. The extra premium from elevated IV lets you move your strikes further
        out-of-the-money while still collecting attractive credits.
      </div>

      {/* ── Section 6: IV Rank Across Different Underlyings ── */}
      <h2 id="across-underlyings">IV Rank Across Different Underlyings</h2>
      <p>
        One of the most common mistakes newer traders make is comparing raw IV numbers across different
        stocks. This is misleading because every stock has its own "normal" volatility range.
      </p>

      <h3>Why Raw IV Comparisons Fail</h3>
      <p>
        Consider two stocks:
      </p>
      <table>
        <thead>
          <tr>
            <th>Stock</th>
            <th>Current IV</th>
            <th>52-Week Range</th>
            <th>IV Rank</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>NVDA</td>
            <td>45%</td>
            <td>30% - 90%</td>
            <td>25</td>
          </tr>
          <tr>
            <td>KO</td>
            <td>22%</td>
            <td>12% - 28%</td>
            <td>63</td>
          </tr>
        </tbody>
      </table>
      <p>
        If you only looked at raw IV, you might rush to sell premium on NVDA (45% sounds high!) and
        skip KO (22% sounds low). But IV Rank tells the real story: NVDA's volatility is actually
        near its yearly low, while KO is sitting well above its midpoint. <strong>KO is the better
        premium-selling candidate</strong> despite having less than half the raw IV.
      </p>

      <h3>IVR Normalizes the Playing Field</h3>
      <p>
        IV Rank puts every stock on the same 0-100 scale regardless of whether it is a high-beta tech
        name or a low-volatility consumer staple. This normalization lets you:
      </p>
      <ul>
        <li>Compare opportunities across sectors and market caps on equal footing.</li>
        <li>Build a diversified portfolio of premium-selling trades without IV bias.</li>
        <li>Quickly scan a watchlist and identify which names are actually in "high IV" territory <em>for them</em>.</li>
      </ul>

      <div className="blog-callout tip">
        <strong>Scanning Tip</strong>
        When building a weekly watchlist, sort your universe by IV Rank descending. The stocks at the
        top are the ones where the options market is pricing in the most fear relative to their own
        history — and those are your best premium-selling candidates.
      </div>

      {/* ── Section 7: Combining IV Rank with Other Filters ── */}
      <h2 id="combining-filters">Combining IV Rank with Other Filters</h2>
      <p>
        IV Rank is a powerful filter, but it works best as part of a multi-factor analysis. The highest-
        probability trades layer IVR with technical, statistical, and sentiment signals.
      </p>

      <h3>IVR + Technical Analysis</h3>
      <p>
        Look for stocks with elevated IV Rank that are also in a defined range or sitting at key
        support/resistance levels. A stock with IVR above 50 that is range-bound between clear
        support and resistance is an ideal iron condor candidate — the IV gives you premium, and the
        technicals define your strikes.
      </p>

      <h3>IVR + Probability Analysis</h3>
      <p>
        Pair IV Rank with{' '}
        <Link to="/blog/options-greeks-explained">delta-based probability estimates</Link>.
        Selling a 16-delta strangle when IVR is 60 gives you roughly an 84% probability of
        profit on each side, plus the tailwind of IV mean-reversion. The combination of high
        probability and elevated premium creates a compelling expected value.
      </p>

      <h3>IVR + Gamma Exposure Analysis</h3>
      <p>
        Advanced traders also consider the gamma profile at their chosen strikes. High IV Rank with
        low nearby gamma means your position is less sensitive to rapid directional moves — adding
        another layer of safety to your credit trades.
      </p>

      <h3>How NewLeaf Scoring Uses IVR</h3>
      <p>
        The <Link to="/how-we-score">NewLeaf scoring engine</Link> treats IV Rank as one of its core
        inputs when evaluating trade candidates across 108 stocks and 8 strategy types each week. The
        system integrates IVR alongside:
      </p>
      <ul>
        <li><strong>AI-powered sentiment analysis</strong> from four independent language models.</li>
        <li><strong>Probability of profit estimates</strong> from the{' '}
          <Link to="/probability-engine">probability engine</Link>.</li>
        <li><strong>Gamma risk profiling</strong> to flag positions with outsized short-gamma exposure.</li>
        <li><strong>Technical support/resistance levels</strong> to anchor strike selection.</li>
      </ul>
      <p>
        This multi-factor approach ensures that high-IVR alone never drives a recommendation — the
        trade must also pass probability, sentiment, and risk filters to surface as a top pick.
      </p>

      <div className="blog-callout tip">
        <strong>Systematic Edge</strong>
        Discretionary traders often chase the highest-IVR names without checking other factors. A
        systematic framework like NewLeaf's scoring ensures every trade is evaluated on the same
        criteria, removing emotion from the selection process.
      </div>

      {/* ── Section 8: FAQ ── */}
      <h2 id="faq">Frequently Asked Questions</h2>
      <div className="blog-faq">
        <div className="blog-faq-item">
          <div className="blog-faq-q">What is a good IV Rank for selling options?</div>
          <div className="blog-faq-a">
            Most premium sellers look for an IV Rank of at least 30, with 50 or above being ideal.
            Above 50, options are priced in the upper half of their annual range, giving you elevated
            premium and a strong mean-reversion tailwind. However, always investigate why IV is high
            before entering a trade.
          </div>
        </div>
        <div className="blog-faq-item">
          <div className="blog-faq-q">Can IV Rank be over 100?</div>
          <div className="blog-faq-a">
            Yes. If the current IV exceeds the 52-week high (which happens when volatility breaks into
            new territory), IV Rank will exceed 100. This often occurs during extreme fear events,
            sudden earnings surprises, or market-wide selloffs. An IVR above 100 signals truly
            exceptional premium-selling opportunities — but size conservatively, because the underlying
            reason for the spike may cause further movement.
          </div>
        </div>
        <div className="blog-faq-item">
          <div className="blog-faq-q">Is IV Rank or IV Percentile better?</div>
          <div className="blog-faq-a">
            Neither is strictly "better." IV Rank is simpler and faster to compute, but it can be skewed
            by a single extreme spike. IV Percentile gives a more robust picture of where IV typically
            sits. Professional traders often use both: if IV Rank and IV Percentile both read above 50,
            you have high conviction that volatility is genuinely elevated.
          </div>
        </div>
        <div className="blog-faq-item">
          <div className="blog-faq-q">How often should I check IV Rank?</div>
          <div className="blog-faq-a">
            For a weekly premium-selling approach, checking IV Rank once during your weekend scan or
            Monday morning review is sufficient. IV Rank changes slowly on most days since it is based
            on a 52-week range. The exceptions are around earnings, major economic releases, or sudden
            market selloffs — those can shift IVR meaningfully in a single session.
          </div>
        </div>
      </div>

      <p>
        Understanding IV Rank gives you a critical edge in timing your premium-selling entries.
        Combined with the right strategy, proper{' '}
        <Link to="/blog/selling-options-for-income">income generation framework</Link>, and a
        systematic scoring approach, IVR becomes the lens through which you identify the
        highest-probability opportunities week after week.
      </p>
    </>
  );
}
