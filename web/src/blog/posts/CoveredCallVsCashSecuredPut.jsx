import { Link } from 'react-router-dom';

export default function CoveredCallVsCashSecuredPut() {
  return (
    <>
      <p>
        If you are exploring options trading for the first time, two strategies almost certainly appear at the top
        of every recommended reading list: <strong>covered calls</strong> and <strong>cash-secured puts</strong>.
        Both belong to the family of premium-selling strategies, both generate income, and both carry defined risk.
        Yet they solve different problems and fit different portfolio situations.
      </p>
      <p>
        This guide breaks down how each strategy works, when each one shines, and how experienced traders combine
        them into the powerful <strong>wheel strategy</strong> for continuous income generation.
      </p>

      {/* ── Section 1 ── */}
      <h2 id="two-strategies">The Two Most Popular Income Strategies</h2>
      <p>
        Covered calls and cash-secured puts serve as the gateway into options income trading for the vast
        majority of retail traders. Brokers typically approve them at the lowest options clearance level because
        both strategies carry clearly defined, limited downside.
      </p>
      <p>
        At their core, each strategy involves <strong>selling an option contract</strong> and collecting premium
        upfront. The difference lies in what you already own and what you are willing to commit:
      </p>
      <ul>
        <li><strong>Covered call</strong> — you already own the shares and sell someone the right to buy them.</li>
        <li><strong>Cash-secured put</strong> — you set aside enough cash to buy shares and sell someone the right to sell them to you.</li>
      </ul>
      <p>
        Both strategies benefit from <Link to="/blog/options-greeks-explained">time decay (theta)</Link> and from
        selling options when <Link to="/blog/selling-options-for-income">implied volatility is elevated</Link>.
        Understanding their mechanics deeply is the first step toward building a reliable income plan.
      </p>

      {/* ── Section 2 ── */}
      <h2 id="covered-calls">How Covered Calls Work</h2>
      <p>
        A covered call is the simplest income overlay an equity investor can add. You own 100 shares of a stock,
        then sell one call option against those shares. In exchange, you receive a premium payment immediately.
      </p>
      <p>
        Think of it as <strong>rental income on stocks you already own</strong>. Just as a landlord collects rent
        each month while still owning the property, a covered call writer collects option premium each cycle while
        retaining share ownership — unless the stock rallies above the strike price by expiration.
      </p>
      <h3>Covered Call Mechanics</h3>
      <ul>
        <li><strong>Position:</strong> Long 100 shares + short 1 call option</li>
        <li><strong>Premium received:</strong> Yours to keep immediately, regardless of outcome</li>
        <li><strong>If stock stays below the strike:</strong> Call expires worthless, you keep shares + premium</li>
        <li><strong>If stock rises above the strike:</strong> Shares are called away at the strike price; you keep the premium plus any gain up to the strike</li>
        <li><strong>If stock drops:</strong> You still own the shares and suffer the loss, but the premium partially offsets the decline</li>
      </ul>

      <div className="blog-callout tip">
        <strong>Example</strong>
        You own 100 shares of XYZ at $50. You sell the 30-day $55 call for $1.50 per share ($150 total).
        If XYZ stays below $55, you pocket $150 and repeat next month. If XYZ climbs to $60, your shares are
        sold at $55 — you earn $5 of stock gain plus $1.50 in premium, but miss the move from $55 to $60.
      </div>

      <h3>Why Traders Choose Covered Calls</h3>
      <ul>
        <li>Generate recurring income on long stock positions</li>
        <li>Reduce cost basis over time with repeated premium collection</li>
        <li>Provide a small buffer against downside moves</li>
        <li>Simple execution — most brokers allow this strategy at the lowest options approval level</li>
      </ul>

      <div className="blog-callout warning">
        <strong>Covered Call Trade-off</strong>
        Your upside is capped at the strike price plus the premium received. In a strong bull run, you may
        significantly underperform simply holding the stock. This is the premium you pay for income certainty.
      </div>

      {/* ── Section 3 ── */}
      <h2 id="cash-secured-puts">How Cash-Secured Puts Work</h2>
      <p>
        A cash-secured put flips the dynamic. Instead of owning shares first, you <strong>set aside enough cash
        to buy 100 shares</strong> at a price you find attractive, then sell a put option at that strike. You
        collect premium immediately for agreeing to be a buyer if the stock dips.
      </p>
      <p>
        Think of it as a <strong>limit order that pays you to wait</strong>. Traditional limit orders sit in the
        book and do nothing until they fill. With a cash-secured put, you get paid for your willingness to buy at
        a lower level — whether the order fills or not.
      </p>
      <h3>Cash-Secured Put Mechanics</h3>
      <ul>
        <li><strong>Position:</strong> Short 1 put option + cash reserve equal to (strike x 100)</li>
        <li><strong>Premium received:</strong> Yours to keep immediately, regardless of outcome</li>
        <li><strong>If stock stays above the strike:</strong> Put expires worthless, you keep the premium and remain in cash</li>
        <li><strong>If stock drops below the strike:</strong> You are assigned 100 shares at the strike price; effective cost basis = strike minus premium received</li>
        <li><strong>Maximum loss:</strong> The stock goes to $0, and you are stuck with shares purchased at the strike</li>
      </ul>

      <div className="blog-callout tip">
        <strong>Example</strong>
        XYZ trades at $52. You sell the 30-day $50 put for $1.20 per share ($120 total) and set aside $5,000
        in cash. If XYZ stays above $50, you keep $120 and repeat. If XYZ falls to $47, you buy shares at $50
        but your effective cost basis is $48.80 ($50 - $1.20 premium), still better than buying at $52 today.
      </div>

      <h3>Why Traders Choose Cash-Secured Puts</h3>
      <ul>
        <li>Accumulate shares at a discount to the current market price</li>
        <li>Earn income while waiting for a stock to pull back</li>
        <li>Lower effective cost basis from day one</li>
        <li>Works well in elevated IV environments where put premiums are richer</li>
      </ul>

      <div className="blog-callout warning">
        <strong>Cash-Secured Put Trade-off</strong>
        If the stock rallies sharply, you miss the entire move and only keep the premium. You also carry the
        risk of being assigned shares that continue to fall well below your strike price.
      </div>

      {/* ── Section 4 ── */}
      <h2 id="comparison">Side-by-Side Comparison</h2>
      <p>
        The table below compares covered calls and cash-secured puts across the dimensions that matter most
        for income traders. Study this carefully before choosing which strategy to deploy.
      </p>

      <table>
        <thead>
          <tr>
            <th>Dimension</th>
            <th>Covered Call</th>
            <th>Cash-Secured Put</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Capital Required</strong></td>
            <td>100 shares of the underlying stock</td>
            <td>Cash equal to strike price x 100</td>
          </tr>
          <tr>
            <td><strong>Risk Profile</strong></td>
            <td>Stock can decline to $0; premium offsets slightly</td>
            <td>Assigned shares can decline to $0; premium offsets slightly</td>
          </tr>
          <tr>
            <td><strong>Maximum Profit</strong></td>
            <td>Premium + (strike - stock purchase price)</td>
            <td>Premium received only</td>
          </tr>
          <tr>
            <td><strong>Maximum Loss</strong></td>
            <td>Stock price minus premium (stock goes to $0)</td>
            <td>Strike price minus premium (stock goes to $0)</td>
          </tr>
          <tr>
            <td><strong>Market Outlook</strong></td>
            <td>Neutral to mildly bullish</td>
            <td>Neutral to mildly bullish</td>
          </tr>
          <tr>
            <td><strong>Assignment Outcome</strong></td>
            <td>Shares are sold at the strike price</td>
            <td>Shares are purchased at the strike price</td>
          </tr>
          <tr>
            <td><strong>Margin Requirements</strong></td>
            <td>No additional margin — shares serve as collateral</td>
            <td>Cash must be held in reserve (or margin for naked puts)</td>
          </tr>
        </tbody>
      </table>

      <p>
        Mathematically, a covered call and a cash-secured put at the same strike and expiration have
        nearly identical risk/reward profiles — a concept known as <strong>put-call parity</strong>.
        The practical differences come down to whether you want to <em>own the shares now</em> (covered call)
        or <em>potentially own them later at a lower price</em> (cash-secured put).
      </p>

      {/* ── Section 5 ── */}
      <h2 id="when-covered-calls">When to Use Covered Calls</h2>
      <p>
        Covered calls are the right choice when you meet these criteria:
      </p>
      <ul>
        <li>
          <strong>You already own shares</strong> — Perhaps you built a long-term equity portfolio and want to
          extract incremental income without selling your positions.
        </li>
        <li>
          <strong>You are mildly bullish or neutral</strong> — You believe the stock will trade sideways or drift
          modestly higher, not surge. If you expect a major rally, selling a covered call caps your gain.
        </li>
        <li>
          <strong>You want income now</strong> — Each covered call cycle delivers premium that can be spent,
          reinvested, or used to offset other trading losses.
        </li>
        <li>
          <strong>You are comfortable selling at the strike</strong> — This is the key psychological hurdle.
          Pick a strike where you would be happy to part with your shares.
        </li>
      </ul>

      <div className="blog-callout tip">
        <strong>Pro Tip</strong>
        Many covered call sellers target a strike that sits just above a technical resistance level. This
        gives the trade a structural tailwind — the stock is less likely to break through resistance, and if
        it does, you sell at a favorable price.
      </div>

      <p>
        Covered calls are especially effective on high-dividend stocks. You collect dividends <em>plus</em>{' '}
        option premium, creating a dual income stream. Just be aware of early assignment risk near
        ex-dividend dates, particularly when the call is in-the-money.
      </p>

      {/* ── Section 6 ── */}
      <h2 id="when-cash-secured-puts">When to Use Cash-Secured Puts</h2>
      <p>
        Cash-secured puts fit a different set of circumstances:
      </p>
      <ul>
        <li>
          <strong>You want to accumulate shares at a cheaper price</strong> — Selling puts at a strike 5-10%
          below the current market price lets you buy the dip while getting paid to wait.
        </li>
        <li>
          <strong>You are neutral to mildly bullish</strong> — If the stock goes up, you keep the premium. If
          it pulls back to your target price, you acquire shares at a discount.
        </li>
        <li>
          <strong>Implied volatility is high</strong> — Elevated IV inflates put premiums, making this strategy
          particularly attractive after earnings announcements, market corrections, or sector-wide volatility spikes.
        </li>
        <li>
          <strong>You have idle cash earning low returns</strong> — Rather than parking cash in a money market
          fund, selling cash-secured puts can generate significantly higher yield, though with more risk.
        </li>
      </ul>

      <div className="blog-callout tip">
        <strong>Pro Tip</strong>
        Sell puts on stocks you genuinely want to own at the strike price. This mindset shift transforms
        assignment from a negative event into a positive one. If you would not want to own 100 shares at
        the strike, you should not be selling that put.
      </div>

      <p>
        Cash-secured puts are ideal for building positions in quality companies during market pullbacks.
        Instead of trying to time the exact bottom, you let the market come to you — and get paid for the
        privilege. See our <Link to="/blog/position-sizing-framework">position sizing framework</Link> to
        determine appropriate allocation per trade.
      </p>

      {/* ── Section 7 ── */}
      <h2 id="wheel-strategy">The Wheel Strategy: Using Both Together</h2>
      <p>
        The <strong>wheel strategy</strong> is the natural evolution for traders who master both covered calls
        and cash-secured puts. It combines them into a continuous income cycle:
      </p>
      <ol>
        <li>
          <strong>Phase 1 — Sell cash-secured puts:</strong> Choose a quality stock you want to own. Sell puts
          at a strike below the current price. Collect premium each cycle until you are assigned shares.
        </li>
        <li>
          <strong>Phase 2 — Sell covered calls:</strong> Once assigned, immediately begin selling calls above
          your effective cost basis. Collect premium each cycle until your shares are called away.
        </li>
        <li>
          <strong>Phase 3 — Repeat:</strong> After shares are called away, return to Phase 1 and sell puts
          again. The cycle continues, generating income in both directions.
        </li>
      </ol>

      <div className="blog-callout tip">
        <strong>Wheel Strategy Example</strong>
        XYZ trades at $50. You sell the $48 put for $1.00. The stock drops to $46 and you are assigned at $48
        (effective basis: $47.00). You sell the $50 call for $0.80. The stock rallies to $51 and shares are
        called away at $50. Your total gain: $3.00 in stock appreciation + $1.80 in combined premiums = $4.80
        per share, or about 10% return on the initial $48 capital deployed.
      </div>

      <p>
        The wheel works best on stocks with the following characteristics:
      </p>
      <ul>
        <li><strong>Liquid options</strong> with tight bid-ask spreads</li>
        <li><strong>Moderate implied volatility</strong> (rich enough premiums, stable enough price action)</li>
        <li><strong>Strong fundamentals</strong> — companies you are happy to own through a drawdown</li>
        <li><strong>Stock price in a range you can commit capital to</strong> (typically $30-$80 for most retail accounts)</li>
      </ul>
      <p>
        NewLeaf System's <Link to="/picks">weekly picks</Link> identify high-probability setups across
        multiple strategies, including the <Link to="/strategies/covered-call">covered call</Link> approach.
        Each pick includes AI-powered scoring that evaluates technical setup, volatility conditions, and
        risk/reward profile.
      </p>

      {/* ── Section 8 ── */}
      <h2 id="which-more-income">Which Strategy Generates More Income?</h2>
      <p>
        There is no universal answer. The income potential of each strategy depends on several context-specific
        factors:
      </p>

      <h3>Covered Call Income Drivers</h3>
      <ul>
        <li><strong>Stock price matters:</strong> Higher-priced stocks generate larger absolute premiums per contract</li>
        <li><strong>Distance to strike:</strong> Closer (at-the-money) strikes pay more but cap upside sooner</li>
        <li><strong>Volatility environment:</strong> Higher IV means richer call premiums</li>
        <li><strong>Dividends:</strong> Dividend-paying stocks add a second income stream</li>
      </ul>

      <h3>Cash-Secured Put Income Drivers</h3>
      <ul>
        <li><strong>Volatility skew:</strong> Puts are often more expensive than calls at equal distances from the current price due to demand for downside protection</li>
        <li><strong>Fear premium:</strong> During selloffs, put premiums spike dramatically, rewarding sellers who step in</li>
        <li><strong>Capital efficiency:</strong> Some brokers allow you to earn interest on the cash reserve, adding marginal income</li>
      </ul>

      <h3>Practical Comparison</h3>
      <p>
        Consider XYZ trading at $100 with 30 days to expiration and 30% implied volatility:
      </p>
      <table>
        <thead>
          <tr>
            <th>Metric</th>
            <th>Covered Call ($105 strike)</th>
            <th>Cash-Secured Put ($95 strike)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Premium Collected</strong></td>
            <td>~$2.10 ($210 per contract)</td>
            <td>~$1.80 ($180 per contract)</td>
          </tr>
          <tr>
            <td><strong>Capital Deployed</strong></td>
            <td>$10,000 (100 shares)</td>
            <td>$9,500 (cash reserve)</td>
          </tr>
          <tr>
            <td><strong>Monthly Yield</strong></td>
            <td>2.1%</td>
            <td>1.9%</td>
          </tr>
          <tr>
            <td><strong>Annualized (12 cycles)</strong></td>
            <td>~25.2%</td>
            <td>~22.8%</td>
          </tr>
        </tbody>
      </table>
      <p>
        In this example, the covered call generates slightly more income because the at-the-money call carries
        more extrinsic value. However, during a market correction where IV spikes to 50%, the cash-secured put
        premium would roughly double while the covered call premium increases less dramatically. Context is
        everything.
      </p>

      <div className="blog-callout warning">
        <strong>Annualized Yields Are Theoretical</strong>
        The annualized figures above assume 12 consecutive successful cycles with no adverse moves. Real-world
        returns will be lower due to assignments, stock price changes, and varying IV levels. Use these
        numbers as a guide, not a guarantee. Always apply proper{' '}
        <Link to="/blog/position-sizing-framework">position sizing</Link>.
      </div>

      {/* ── Section 9 ── */}
      <h2 id="faq">Frequently Asked Questions</h2>

      <div className="blog-faq">
        <div className="blog-faq-item">
          <div className="blog-faq-q">Is a covered call or cash-secured put safer?</div>
          <div className="blog-faq-a">
            Neither strategy is inherently safer — they have mathematically similar risk profiles at the same
            strike and expiration (put-call parity). The practical difference is that covered call losses come
            from stock you already own declining, while cash-secured put losses come from being assigned shares
            that then decline. Choose based on whether you already hold the stock, not on perceived safety.
          </div>
        </div>

        <div className="blog-faq-item">
          <div className="blog-faq-q">Can I sell covered calls and cash-secured puts in a retirement account (IRA)?</div>
          <div className="blog-faq-a">
            Yes. Both strategies are available in most IRA accounts because they carry defined risk and do not
            require margin. Covered calls require you to hold the underlying shares, and cash-secured puts
            require the full cash reserve. Check with your broker for specific approval requirements, but these
            are typically the first strategies approved for retirement accounts.
          </div>
        </div>

        <div className="blog-faq-item">
          <div className="blog-faq-q">What happens if I get assigned on a cash-secured put?</div>
          <div className="blog-faq-a">
            Assignment means you buy 100 shares at the strike price using the cash you had reserved. Your
            effective cost basis is the strike price minus the premium you collected. From there, you can hold
            the shares, sell them, or transition into selling covered calls against them as part of the wheel
            strategy. Assignment is not a loss event — it simply means you now own the stock at a price you
            agreed to when you sold the put.
          </div>
        </div>

        <div className="blog-faq-item">
          <div className="blog-faq-q">How do I choose the right strike price and expiration for these strategies?</div>
          <div className="blog-faq-a">
            For both strategies, most income traders target 30-45 day expirations where{' '}
            <Link to="/blog/options-greeks-explained">theta decay</Link> accelerates, and strikes that fall
            between 0.20 and 0.35 delta. This translates roughly to strikes 5-10% out of the money. Closer
            strikes pay more premium but increase the probability of assignment; further strikes pay less but
            offer a wider margin of safety. Your choice should balance income goals with your willingness to
            be assigned.
          </div>
        </div>
      </div>

      {/* ── Closing ── */}
      <h2 id="bottom-line" style={{ borderBottom: 'none', marginBottom: 8 }}>The Bottom Line</h2>
      <p>
        Covered calls and cash-secured puts are two sides of the same coin. If you already own shares and want
        income, sell covered calls. If you want to buy shares at a discount while earning premium, sell
        cash-secured puts. And if you want a complete system, combine them into the wheel strategy for a
        continuous income loop.
      </p>
      <p>
        The best traders do not pick one strategy and ignore the other. They use the right tool for the right
        market condition — and they let data, not emotion, drive the decision.
      </p>
      <p>
        Explore our <Link to="/blog/selling-options-for-income">complete guide to selling options for income</Link>{' '}
        for a deeper dive into premium selling mechanics, or browse this week's{' '}
        <Link to="/picks">AI-scored picks</Link> to see these strategies in action.
      </p>
    </>
  );
}
