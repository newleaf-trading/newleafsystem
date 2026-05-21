import { Link } from 'react-router-dom';

export default function OptionsGreeksExplained() {
  return (
    <>
      <p>
        If you have ever opened an options chain and felt overwhelmed by columns of numbers labeled
        delta, gamma, theta, and vega, you are not alone. These metrics — collectively called
        the <strong>options Greeks</strong> — are the most important risk indicators in options
        trading, yet most educational material buries them in calculus notation that helps nobody.
      </p>
      <p>
        This guide explains every Greek in plain language with concrete examples. By the end you
        will know exactly what each Greek tells you, how they interact in multi-leg trades like
        an <Link to="/blog/iron-condor-strategy-explained">iron condor</Link>, and how to use
        them to make better trading decisions every single week.
      </p>

      {/* ───────── Section 1 ───────── */}
      <h2 id="what-are-greeks">What Are the Options Greeks?</h2>
      <p>
        Think of the Greeks as the <strong>dashboard gauges</strong> on a car. You would never drive
        on the highway without a speedometer, fuel gauge, and temperature readout. The Greeks serve
        the same purpose for an options position:
      </p>
      <ul>
        <li><strong>Delta</strong> — your speedometer. It tells you how fast your position moves when the stock moves.</li>
        <li><strong>Gamma</strong> — your accelerometer. It tells you how quickly delta itself is changing.</li>
        <li><strong>Theta</strong> — your fuel gauge. It shows how much value drains (or flows in) every day due to time decay.</li>
        <li><strong>Vega</strong> — your turbo boost gauge. It measures how sensitive your position is to changes in implied volatility.</li>
      </ul>
      <p>
        No single gauge tells the full story. A car can be moving fast (high delta) while burning
        fuel rapidly (high theta) and about to hit a bump that changes everything (high gamma).
        The power of the Greeks comes from reading them <em>together</em>.
      </p>

      <div className="blog-callout tip">
        <strong>NewLeaf Tip</strong>
        You do not need to memorize the Black-Scholes formula to use the Greeks effectively.
        Focus on what each number <em>means for your P&amp;L</em> and the rest follows naturally.
      </div>

      {/* ───────── Section 2 ───────── */}
      <h2 id="delta">Delta: Your Directional Exposure</h2>
      <p>
        Delta is the most intuitive Greek. It answers a simple question: <strong>if the underlying
        stock moves $1, how much does my option price change?</strong>
      </p>
      <p>
        A call option with a delta of 0.30 will gain roughly $0.30 in value for every $1 the stock
        rises. A put option with a delta of -0.40 will gain roughly $0.40 in value for every $1
        the stock falls. That is all delta is — a sensitivity measurement.
      </p>

      <h3>Delta as Probability of Expiring In-the-Money</h3>
      <p>
        Traders commonly use delta as a rough proxy for the probability that the option will finish
        in-the-money at expiration. A 0.30 delta call has roughly a 30% chance of expiring ITM; a
        0.10 delta put has about a 10% chance. This is an approximation, not an exact figure, but
        it is remarkably useful for strike selection.
      </p>
      <p>
        When you <Link to="/blog/selling-options-for-income">sell options for income</Link>, you
        typically sell at low deltas (0.10 to 0.20) because you want a high probability that the
        option expires worthless. When you buy options directionally, you might choose a higher
        delta (0.40 to 0.60) to get more leverage on the move.
      </p>

      <h3>Delta as Share Equivalency</h3>
      <p>
        Because each standard options contract controls 100 shares, delta also tells you your
        equivalent share exposure. If you hold 5 call contracts with a delta of 0.40, your
        position behaves like owning <strong>200 shares</strong> of stock (5 x 100 x 0.40 = 200).
        This is called your <em>delta-equivalent</em> or <em>delta dollars</em> exposure.
      </p>

      <table>
        <thead>
          <tr>
            <th>Delta Value</th>
            <th>Option Type</th>
            <th>Moneyness</th>
            <th>Approx. ITM Probability</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>0.80 - 1.00</td><td>Call</td><td>Deep ITM</td><td>80-100%</td></tr>
          <tr><td>0.50</td><td>Call</td><td>At-the-Money</td><td>~50%</td></tr>
          <tr><td>0.15 - 0.30</td><td>Call</td><td>OTM</td><td>15-30%</td></tr>
          <tr><td>-0.15 to -0.30</td><td>Put</td><td>OTM</td><td>15-30%</td></tr>
          <tr><td>-0.50</td><td>Put</td><td>At-the-Money</td><td>~50%</td></tr>
          <tr><td>-0.80 to -1.00</td><td>Put</td><td>Deep ITM</td><td>80-100%</td></tr>
        </tbody>
      </table>

      <div className="blog-callout tip">
        <strong>Practical Example</strong>
        You sell a 0.16 delta put on AAPL expiring in 30 days. Delta tells you there is roughly
        an 84% chance this put expires worthless and you keep the full premium. That is why
        premium sellers love low-delta strikes.
      </div>

      {/* ───────── Section 3 ───────── */}
      <h2 id="gamma">Gamma: The Rate of Change</h2>
      <p>
        If delta is speed, gamma is <strong>acceleration</strong>. Gamma measures how much delta
        changes when the stock moves $1. Technically, gamma is the second derivative of the
        option price with respect to the underlying — but you do not need to think in calculus
        terms.
      </p>
      <p>
        Suppose you own a call with a delta of 0.30 and a gamma of 0.05. If the stock rises $1,
        your new delta becomes approximately 0.35. The option is now more sensitive to further
        price changes. If the stock keeps rising, delta keeps climbing thanks to gamma, which is
        why long options can produce explosive gains on big moves.
      </p>

      <h3>Why Gamma Is Dangerous Near Expiration</h3>
      <p>
        Gamma is highest for at-the-money options that are close to expiration. In the final days
        before expiry, an ATM option's delta can swing from 0.40 to 0.90 on a relatively small
        stock move. This is called <strong>gamma risk</strong>, and it is the primary reason
        experienced traders close or roll positions before expiration week rather than holding
        to the bitter end.
      </p>
      <p>
        For sellers, gamma is the enemy. A short option position has negative gamma, meaning that
        moves against you accelerate your losses. This is why the{' '}
        <Link to="/blog/position-sizing-framework">position sizing framework</Link> matters so
        much — a single unmanaged gamma spike can wipe out weeks of theta income.
      </p>

      <div className="blog-callout warning">
        <strong>Gamma Risk Warning</strong>
        Never hold short options through expiration day with the stock near your strike.
        Gamma can turn a small winner into a large loser in minutes. Close or roll positions
        when they reach 50-80% of max profit or when expiration is less than 5 days away.
      </div>

      <h3>Gamma Across the Options Chain</h3>
      <ul>
        <li><strong>ATM options</strong> have the highest gamma — they are the most sensitive to stock movement.</li>
        <li><strong>Deep ITM and deep OTM options</strong> have low gamma — their deltas do not change much.</li>
        <li><strong>Longer-dated options</strong> have lower gamma than shorter-dated options at the same strike.</li>
      </ul>

      {/* ───────── Section 4 ───────── */}
      <h2 id="theta">Theta: Time Decay Working For or Against You</h2>
      <p>
        Theta measures the <strong>daily erosion of an option's extrinsic value</strong> due to the
        passage of time. Every day that passes, all else being equal, an option loses a small piece
        of its time value. Theta quantifies exactly how much.
      </p>
      <p>
        If a call option has a theta of -0.05, it loses $0.05 per share ($5.00 per contract) in
        value every day, all else equal. For option buyers, theta is a daily cost — the "rent"
        you pay for holding the position. For option sellers, theta is daily income — money that
        flows into your pocket while you sleep.
      </p>

      <h3>Theta as Daily Income for Sellers</h3>
      <p>
        This is the core mechanic behind every{' '}
        <Link to="/blog/selling-options-for-income">premium selling strategy</Link>. When you
        sell an iron condor, a credit spread, or a cash-secured put, you have <em>positive
        theta</em>. Each day that passes, the options you sold lose value, and that value
        transfers to you as profit. Theta is literally the income engine of premium selling.
      </p>

      <h3>The Theta Acceleration Curve</h3>
      <p>
        Theta is not constant. It accelerates as expiration approaches, following a roughly
        exponential curve. An option with 60 days to expiry might decay at $2 per day, but
        with only 14 days left, that same option might decay at $8 per day. In the final 5
        days, decay can reach $15-20 per day.
      </p>
      <p>
        This acceleration curve is why many income traders sell options with <strong>30 to 45 days
        to expiration</strong> (DTE). You capture the steepest part of the decay curve while still
        having enough time to manage the trade if the stock moves against you. Selling options with
        7 DTE gives you explosive theta, but the gamma risk is equally explosive.
      </p>

      <div className="blog-callout tip">
        <strong>The 30-45 DTE Sweet Spot</strong>
        Selling options at 30-45 DTE gives you roughly 60-70% of the total theta decay in the
        first half of the holding period. Once the position reaches 50% of max profit (often
        around 14-21 DTE), close it and redeploy. This approach maximizes theta per unit of
        gamma risk.
      </div>

      <table>
        <thead>
          <tr>
            <th>Days to Expiration</th>
            <th>Daily Theta (approx.)</th>
            <th>Gamma Risk</th>
            <th>Ideal For</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>60+ DTE</td><td>Low</td><td>Low</td><td>Long-dated trades, LEAPS</td></tr>
          <tr><td>30-45 DTE</td><td>Moderate to High</td><td>Manageable</td><td>Premium selling sweet spot</td></tr>
          <tr><td>14-21 DTE</td><td>High</td><td>Elevated</td><td>Aggressive sellers, quick trades</td></tr>
          <tr><td>0-7 DTE</td><td>Very High</td><td>Extreme</td><td>Experienced traders only</td></tr>
        </tbody>
      </table>

      {/* ───────── Section 5 ───────── */}
      <h2 id="vega">Vega: Volatility Sensitivity</h2>
      <p>
        Vega measures how much an option's price changes when{' '}
        <Link to="/blog/implied-volatility-rank-explained">implied volatility (IV)</Link> moves
        by one percentage point. If a call has a vega of 0.12, a 1-point increase in IV adds
        $0.12 to the option's price per share ($12 per contract).
      </p>
      <p>
        Volatility is the hidden variable that trips up beginners. You can be right about the
        stock's direction and still lose money on a long call if IV collapses after you buy.
        Conversely, a spike in IV can temporarily rescue a short option position that is moving
        against you — but only temporarily.
      </p>

      <h3>Vega and the Premium Seller's Edge</h3>
      <p>
        Premium sellers want to sell options when IV is <em>high</em> because they benefit from
        the subsequent volatility contraction. This is why{' '}
        <Link to="/blog/implied-volatility-rank-explained">IV Rank</Link> is such an important
        filter — it tells you whether current IV is high relative to the stock's own history.
        When IV Rank is above 30-40, options are relatively expensive and premium selling has a
        statistical edge.
      </p>
      <p>
        Short option positions have <strong>negative vega</strong>. When IV drops after you sell,
        the options you sold decrease in value faster, and you profit. When IV spikes (earnings
        announcements, market panics), your short vega position takes an immediate mark-to-market
        hit — even if the stock has not moved.
      </p>

      <div className="blog-callout tip">
        <strong>Vega Rule of Thumb</strong>
        Longer-dated options have higher vega than shorter-dated options. If you are selling
        premium and want to reduce your volatility exposure, shorter expirations will have less
        vega risk. But remember — shorter expirations mean more gamma risk. Trading is always
        about trade-offs.
      </div>

      <h3>How IV Changes Affect Your Positions</h3>
      <ul>
        <li><strong>IV increases:</strong> Helps long options (positive vega), hurts short options (negative vega).</li>
        <li><strong>IV decreases:</strong> Hurts long options, helps short options — this is the "volatility crush" after earnings.</li>
        <li><strong>IV stays flat:</strong> Vega has no effect; theta takes over as the dominant Greek.</li>
      </ul>

      {/* ───────── Section 6 ───────── */}
      <h2 id="working-together">How the Greeks Work Together</h2>
      <p>
        In isolation, each Greek tells only part of the story. Real trading decisions require
        reading them together. Let us walk through a concrete example using an{' '}
        <Link to="/strategies/iron-condor">iron condor</Link> on SPY trading at $530.
      </p>

      <h3>Example: SPY Iron Condor (30 DTE)</h3>
      <p>
        Suppose you sell the following iron condor for a $2.80 net credit:
      </p>
      <ul>
        <li>Sell 540 call / Buy 545 call (bear call spread)</li>
        <li>Sell 520 put / Buy 515 put (bull put spread)</li>
      </ul>
      <p>Here are the approximate <strong>net Greeks</strong> for the entire position:</p>

      <table>
        <thead>
          <tr>
            <th>Greek</th>
            <th>Net Value</th>
            <th>What It Means</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Delta</td>
            <td>+0.02</td>
            <td>Nearly market-neutral; tiny bullish lean</td>
          </tr>
          <tr>
            <td>Gamma</td>
            <td>-0.03</td>
            <td>Big moves in either direction hurt you</td>
          </tr>
          <tr>
            <td>Theta</td>
            <td>+$4.20/day</td>
            <td>You earn about $4.20 per day in time decay</td>
          </tr>
          <tr>
            <td>Vega</td>
            <td>-0.18</td>
            <td>A 1-point IV drop adds ~$18 in profit per contract</td>
          </tr>
        </tbody>
      </table>

      <p>
        Reading these together paints a clear picture: the iron condor is a <strong>market-neutral,
        short-volatility, positive-theta</strong> trade. You profit when the stock stays within
        your strikes (low delta matters), time passes (positive theta), and IV declines (negative
        vega). You lose when the stock makes a big move (negative gamma) or IV spikes.
      </p>
      <p>
        This is exactly why the <Link to="/blog/iron-condor-strategy-explained">iron condor</Link>{' '}
        is one of the most popular income strategies — the Greeks align to create a high-probability
        income trade when placed in the right conditions.
      </p>

      <div className="blog-callout tip">
        <strong>Portfolio Greeks</strong>
        You can add up the Greeks of all your open positions to get a portfolio-level view. If
        your total portfolio delta is getting too large in one direction, you can add a position
        to offset it. The <Link to="/gamma-analysis">Gamma Analysis</Link> tool in NewLeaf
        System shows your aggregate Greek exposure across all open trades.
      </div>

      {/* ───────── Section 7 ───────── */}
      <h2 id="using-greeks">Using Greeks in Your Trading Decisions</h2>
      <p>
        Knowing the definitions is only half the battle. Here is a practical decision framework
        for using the Greeks in your weekly trading routine:
      </p>

      <h3>Before You Enter a Trade</h3>
      <ol>
        <li>
          <strong>Check delta for strike selection.</strong> Selling premium? Target 0.10-0.20
          delta strikes. Buying directional? Look at 0.40-0.60 delta. The delta you choose sets
          your probability of profit.
        </li>
        <li>
          <strong>Check vega and IV Rank.</strong> Only sell premium when{' '}
          <Link to="/blog/implied-volatility-rank-explained">IV Rank is above 30</Link>. High IV
          means inflated option prices and more premium to collect. Your negative vega position
          benefits when IV contracts back to normal.
        </li>
        <li>
          <strong>Check theta for income potential.</strong> Calculate your daily theta income and
          compare it to the max risk of the trade. A good rule of thumb: daily theta should be at
          least 0.5-1% of max risk to make the trade worthwhile.
        </li>
        <li>
          <strong>Check gamma for risk awareness.</strong> If gamma is very high (options near
          expiry), be prepared for fast P&amp;L swings. Ensure your{' '}
          <Link to="/blog/position-sizing-framework">position size</Link> can handle the potential
          volatility.
        </li>
      </ol>

      <h3>While You Are in the Trade</h3>
      <ol>
        <li>
          <strong>Monitor delta drift.</strong> If delta grows too large, the trade is becoming
          directional. Consider adjusting or closing.
        </li>
        <li>
          <strong>Watch gamma as expiration approaches.</strong> Gamma accelerates in the final
          week. Close or roll winning positions early to avoid gamma surprises.
        </li>
        <li>
          <strong>Let theta work.</strong> If the stock stays within your expected range, theta
          is doing the heavy lifting. Resist the urge to over-manage a winning trade.
        </li>
        <li>
          <strong>React to vega moves.</strong> If IV spikes (perhaps on news), your short
          positions take a temporary hit. Evaluate whether the spike is temporary or structural
          before making adjustments.
        </li>
      </ol>

      <div className="blog-callout tip">
        <strong>Decision Shortcut</strong>
        When in doubt, ask: "Am I getting paid enough theta per day to justify the gamma and
        vega risk I am taking?" If the answer is no, the trade is not worth it.
      </div>

      {/* ───────── Section 8 ───────── */}
      <h2 id="cheat-sheet">Greeks Cheat Sheet</h2>
      <p>
        Bookmark this table. It covers everything you need to know about each Greek at a glance.
      </p>

      <table>
        <thead>
          <tr>
            <th>Greek</th>
            <th>Measures</th>
            <th>Long Options</th>
            <th>Short Options</th>
            <th>Key Insight</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Delta</strong></td>
            <td>Price change per $1 stock move</td>
            <td>Positive (calls) / Negative (puts)</td>
            <td>Negative (calls) / Positive (puts)</td>
            <td>Also approximates ITM probability</td>
          </tr>
          <tr>
            <td><strong>Gamma</strong></td>
            <td>Rate of delta change per $1 stock move</td>
            <td>Positive — big moves help you</td>
            <td>Negative — big moves hurt you</td>
            <td>Highest ATM near expiry; the "risk accelerator"</td>
          </tr>
          <tr>
            <td><strong>Theta</strong></td>
            <td>Daily time-value decay in dollars</td>
            <td>Negative — time works against you</td>
            <td>Positive — time works for you</td>
            <td>Accelerates exponentially near expiry</td>
          </tr>
          <tr>
            <td><strong>Vega</strong></td>
            <td>Price change per 1% IV move</td>
            <td>Positive — IV spikes help you</td>
            <td>Negative — IV drops help you</td>
            <td>Sell high IV, buy low IV for an edge</td>
          </tr>
        </tbody>
      </table>

      <div className="blog-callout tip">
        <strong>Remember the Relationships</strong>
        Theta and gamma are natural enemies — positions that benefit from time decay (positive
        theta) are hurt by large moves (negative gamma), and vice versa. This is not a flaw; it
        is the fundamental trade-off that makes options markets work.
      </div>

      {/* ───────── Section 9 ───────── */}
      <h2 id="faq">Frequently Asked Questions</h2>

      <div className="blog-faq">
        <div className="blog-faq-item">
          <div className="blog-faq-q">Which Greek is most important for option sellers?</div>
          <div className="blog-faq-a">
            Theta is the income engine — it is the Greek you are monetizing. But gamma is the
            Greek you need to respect the most, because it determines how quickly a trade can move
            against you. Smart sellers optimize for theta while actively managing gamma risk by
            sizing appropriately and closing positions before expiration.
          </div>
        </div>

        <div className="blog-faq-item">
          <div className="blog-faq-q">Can the Greeks predict where a stock is going?</div>
          <div className="blog-faq-a">
            No. The Greeks measure sensitivities and probabilities — they describe how your option
            position will behave under various scenarios, but they do not predict future stock
            price movement. Delta's probability approximation tells you what the <em>market</em>{' '}
            is pricing in, not what will actually happen. Use the Greeks for risk management, not
            for directional forecasting.
          </div>
        </div>

        <div className="blog-faq-item">
          <div className="blog-faq-q">Why does my option lose value even when the stock moves in my favor?</div>
          <div className="blog-faq-a">
            This usually happens because theta decay or a drop in implied volatility (vega effect)
            offsets the directional gain from delta. For example, if you buy a call and the stock
            moves up $1 (gaining $0.40 from delta), but IV drops 3 points (losing $0.36 from
            vega) and a day passes (losing $0.08 from theta), you end up with only a $-0.04
            change. This is why understanding all the Greeks together matters.
          </div>
        </div>

        <div className="blog-faq-item">
          <div className="blog-faq-q">How do I see the Greeks for my positions?</div>
          <div className="blog-faq-a">
            Every brokerage platform displays the Greeks in the options chain. Look for columns
            labeled delta, gamma, theta, and vega. For portfolio-level Greek analysis,
            the <Link to="/gamma-analysis">Gamma Analysis</Link> dashboard in NewLeaf System
            aggregates your net Greeks across all open positions so you can see your total
            exposure at a glance.
          </div>
        </div>
      </div>

      {/* ───────── Closing ───────── */}
      <h2 id="next-steps">Putting It All Together</h2>
      <p>
        The options Greeks are not abstract academic concepts — they are the day-to-day operating
        metrics of every successful options trader. Delta tells you your directional bet. Gamma
        tells you how fast things can change. Theta tells you whether time is your friend or your
        enemy. And vega tells you how much volatility is helping or hurting you.
      </p>
      <p>
        Master these four numbers and you will have a significant edge over traders who are
        guessing blindly. Combine them with sound{' '}
        <Link to="/blog/position-sizing-framework">position sizing</Link>, a disciplined{' '}
        <Link to="/blog/selling-options-for-income">income selling approach</Link>, and an
        understanding of <Link to="/blog/implied-volatility-rank-explained">implied volatility</Link>,
        and you have the foundation of a professional-grade options trading practice.
      </p>
    </>
  );
}
