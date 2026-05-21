import { Link } from 'react-router-dom';

export default function SellingOptionsForIncome() {
  return (
    <>
      <p>
        Most retail traders buy options hoping for a big move. They spend $500 on calls, watch
        theta eat the position alive, and wonder why they keep losing. Meanwhile, a quieter
        group of traders sits on the other side of those trades — <strong>collecting premium,
        profiting from time decay, and generating income month after month</strong>.
      </p>
      <p>
        Selling options for income is not a get-rich-quick play. It is a repeatable, systematic
        approach to extracting returns from the options market. In this guide, we will cover the
        strategies, the math, the risks, and the practical mechanics of building a premium-selling
        portfolio that generates real income.
      </p>

      {/* ─── Section 1 ─── */}
      <h2 id="why-sell">Why Sell Options Instead of Buying Them?</h2>
      <p>
        Here is the statistic that changes everything: <strong>studies consistently show that
        roughly 70-80% of options held to expiration expire worthless</strong>. That does not
        mean every option buyer loses — many close early for profit. But it tells you something
        fundamental about the market's pricing structure.
      </p>
      <p>
        When you buy an option, you need the stock to move far enough, fast enough, to overcome
        the premium you paid. When you sell an option, you start the trade with cash in your
        pocket. The stock can go up, go sideways, or even move slightly against you — and you
        still win.
      </p>
      <p>
        Think of it this way: option buyers are paying for insurance, and option sellers are the
        insurance company. Insurance companies do not win every claim, but they price policies so
        that over thousands of transactions, the math works decisively in their favor.
      </p>

      <h3>The Three Built-In Edges</h3>
      <ul>
        <li>
          <strong>Theta decay:</strong> Every day that passes, the time value in the option
          you sold melts away. This is money flowing from the buyer to you. A 30-DTE option
          loses roughly 3-5% of its value per day early on, accelerating as expiration approaches.
        </li>
        <li>
          <strong>Implied volatility overstatement:</strong> Options are priced on implied
          volatility (IV), and{' '}
          <Link to="/blog/implied-volatility-rank-explained">IV tends to overstate actual realized moves</Link>.
          This "volatility risk premium" means sellers, on average, collect more than they pay out.
        </li>
        <li>
          <strong>Probability:</strong> Out-of-the-money options have a statistical likelihood
          of expiring worthless. A 0.20 delta put has roughly an 80% chance of expiring out of
          the money. You get to choose your probability of success before entering the trade.
        </li>
      </ul>

      <div className="blog-callout tip">
        <strong>Key Insight</strong>
        You do not need to be right about direction to profit from selling options. You just need
        the stock to <em>not</em> move too far against you — a meaningfully easier task.
      </div>

      {/* ─── Section 2 ─── */}
      <h2 id="core-strategies">The Three Core Premium Selling Strategies</h2>
      <p>
        Premium selling comes in many forms, but three strategies form the backbone of
        nearly every income-focused options portfolio. Each has a different risk profile,
        capital requirement, and ideal use case.
      </p>

      <h3>1. Cash-Secured Puts</h3>
      <p>
        You sell a put option on a stock you would be happy to own at a lower price and keep
        enough cash in your account to buy 100 shares if assigned. If the stock stays above your
        strike, the put expires worthless and you keep the entire premium.
      </p>
      <p>
        <strong>Example:</strong> AAPL is trading at $190. You sell the $180 put expiring in 35
        days for $2.50 ($250 per contract). You set aside $18,000 in cash. If AAPL stays above
        $180, you pocket the $250. If it drops below $180, you buy 100 shares at an effective cost
        basis of $177.50 ($180 strike minus $2.50 premium). That is an 8.3% discount from where
        the stock traded when you opened the position.
      </p>

      <h3>2. Covered Calls</h3>
      <p>
        You own 100 shares of a stock and sell a call against them. The premium you collect
        lowers your cost basis and generates income while you hold the position. If the stock
        rallies past your strike, your shares get called away at a profit.
      </p>
      <p>
        <strong>Example:</strong> You own 100 shares of MSFT at $420. You sell the $440 call
        expiring in 30 days for $4.00 ($400). If MSFT stays below $440, you keep the $400 and
        your shares. That is roughly a 1% return in one month. If MSFT rises above $440, you sell
        your shares at $440 plus keep the $400 premium — a $2,400 total gain (5.7% in one month).
      </p>
      <p>
        Cash-secured puts and covered calls are actually two sides of the same coin. For a deeper
        comparison, see our guide on{' '}
        <Link to="/blog/covered-call-vs-cash-secured-put">covered calls vs. cash-secured puts</Link>.
      </p>

      <h3>3. Credit Spreads</h3>
      <p>
        A credit spread involves selling an option and buying a further out-of-the-money option
        at the same expiration. The option you sell collects more premium than the one you buy
        costs, leaving you with a net credit. The purchased option caps your maximum loss.
      </p>
      <p>
        <strong>Example:</strong> Stock XYZ trades at $100. You sell the $95/$90 put spread
        (sell the $95 put, buy the $90 put) for a $1.20 net credit ($120 per spread). Your max
        risk is $380 ($500 spread width minus $120 credit). You profit if XYZ stays above $95 at
        expiration. Even if it dips to $96, you keep the full $120.
      </p>

      <div className="blog-callout tip">
        <strong>Which Strategy Should You Start With?</strong>
        If you have a smaller account (under $25,000), credit spreads let you sell premium with
        defined risk and lower capital requirements. If you have more capital and want to build
        long-term stock positions, cash-secured puts are an excellent entry point.
      </div>

      <table>
        <thead>
          <tr>
            <th>Strategy</th>
            <th>Capital Needed</th>
            <th>Max Risk</th>
            <th>Best For</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Cash-Secured Put</td>
            <td>High (full share cost)</td>
            <td>Stock goes to $0</td>
            <td>Building positions at a discount</td>
          </tr>
          <tr>
            <td>Covered Call</td>
            <td>High (own 100 shares)</td>
            <td>Stock drops (offset by premium)</td>
            <td>Generating yield on holdings</td>
          </tr>
          <tr>
            <td>Credit Spread</td>
            <td>Low (spread width - credit)</td>
            <td>Defined (spread width - credit)</td>
            <td>Smaller accounts, defined risk</td>
          </tr>
        </tbody>
      </table>

      {/* ─── Section 3 ─── */}
      <h2 id="income-expectations">How Much Income Can You Generate?</h2>
      <p>
        Let us talk real numbers. The internet is full of absurd claims — "make $10,000/month
        selling options with $5,000!" — and they are nonsense. Here is what realistic,
        sustainable premium selling actually looks like.
      </p>

      <h3>Conservative Targets</h3>
      <p>
        A disciplined premium seller targeting high-probability trades (70-85% win rate) with
        proper position sizing can realistically aim for <strong>1-3% monthly return on
        capital</strong>, or roughly <strong>12-36% annualized</strong>. The range depends on
        market conditions, strategy selection, and how aggressively you size positions.
      </p>
      <p>
        Here is what that looks like at different account sizes:
      </p>

      <table>
        <thead>
          <tr>
            <th>Account Size</th>
            <th>Monthly Target (2%)</th>
            <th>Annual Income</th>
            <th>With Compounding</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>$25,000</td>
            <td>$500</td>
            <td>$6,000</td>
            <td>$8,040</td>
          </tr>
          <tr>
            <td>$50,000</td>
            <td>$1,000</td>
            <td>$12,000</td>
            <td>$16,080</td>
          </tr>
          <tr>
            <td>$100,000</td>
            <td>$2,000</td>
            <td>$24,000</td>
            <td>$32,160</td>
          </tr>
          <tr>
            <td>$250,000</td>
            <td>$5,000</td>
            <td>$60,000</td>
            <td>$80,400</td>
          </tr>
        </tbody>
      </table>

      <p>
        The "With Compounding" column assumes you reinvest your premium income back into larger
        positions. At 2% monthly compounded, a $50,000 account grows to roughly $66,000 in a year —
        a 32% total return. That is not flashy, but it is the kind of consistent performance
        that builds serious wealth over 5-10 years.
      </p>

      <div className="blog-callout warning">
        <strong>Reality Check</strong>
        These numbers assume consistent execution and normal market conditions. Every premium
        seller will have losing months. A 3-5% drawdown month is normal. A 10% drawdown during
        a market correction is possible. The key is sizing so that no single loss derails
        your portfolio. See our{' '}
        <Link to="/blog/position-sizing-framework">position sizing framework</Link> for details.
      </div>

      {/* ─── Section 4 ─── */}
      <h2 id="stock-selection">Choosing What to Sell: Stock Selection</h2>
      <p>
        Not every stock is suitable for premium selling. The wrong underlying can turn a
        high-probability trade into a nightmare. Here is what to look for.
      </p>

      <h3>Liquidity Is Non-Negotiable</h3>
      <p>
        You need tight bid-ask spreads on the options chain. Wide spreads eat your edge. If the
        bid is $1.00 and the ask is $1.40, you are giving up $20 per contract just to get
        filled — that can be 10-20% of your expected profit on a credit spread.
      </p>
      <p>
        <strong>Target underlyings with:</strong>
      </p>
      <ul>
        <li>Daily options volume above 10,000 contracts</li>
        <li>Bid-ask spreads on your target strikes of $0.05 or less for stocks under $100, and $0.10 or less for higher-priced names</li>
        <li>Multiple strike prices available at $1 or $2.50 increments</li>
      </ul>
      <p>
        Large-cap stocks like AAPL, MSFT, AMZN, META, GOOGL, SPY, and QQQ are the gold standard.
        Mid-cap names with active options markets (AMD, NFLX, PYPL) also work well.
      </p>

      <h3>IV Rank: Sell When Premium Is Rich</h3>
      <p>
        <Link to="/blog/implied-volatility-rank-explained">IV Rank</Link> tells you whether
        current implied volatility is high or low relative to the stock's own history. When IV
        Rank is above 30-50, options are relatively expensive — which means more premium for
        sellers. When IV Rank is below 15, you are selling cheap insurance.
      </p>
      <p>
        <strong>Practical rule:</strong> Prioritize underlyings with IV Rank above 30. If you
        cannot find anything above 30, ETFs like SPY and IWM in the 20-30 range still offer
        acceptable premium with lower single-stock risk.
      </p>

      <h3>Avoid Earnings and Binary Events</h3>
      <p>
        Earnings announcements can cause 5-15% overnight gaps. That is exactly the kind of
        tail risk that blows up premium sellers. If a stock reports earnings within your trade's
        expiration window, either skip it or close the position before the announcement.
      </p>
      <p>
        The same logic applies to FDA decisions for biotech, product launches, and major
        litigation rulings. These are coin flips, and coin flips have no edge.
      </p>

      <div className="blog-callout tip">
        <strong>NewLeaf System Approach</strong>
        Our <Link to="/picks">weekly picks</Link> scan 108 liquid underlyings, filter for
        IV Rank, and avoid earnings-week setups automatically. Each pick includes a signal
        quality score so you know which trades have the strongest statistical edge. Learn more
        about <Link to="/how-we-pick">how we select trades</Link>.
      </div>

      {/* ─── Section 5 ─── */}
      <h2 id="strike-selection">Strike Selection and Expiration Timing</h2>
      <p>
        Once you know what to sell, the next decisions are where (which strike) and when
        (which expiration). These two choices determine your probability of profit, your
        potential return, and how much risk you take.
      </p>

      <h3>Delta as Your Probability Guide</h3>
      <p>
        <Link to="/blog/options-greeks-explained">Delta</Link> serves double duty: it measures
        how much the option price changes per $1 move in the stock, and it roughly approximates
        the probability that the option finishes in the money.
      </p>
      <p>
        For premium selling, the sweet spot is <strong>0.20 to 0.30 delta</strong>:
      </p>
      <ul>
        <li>
          <strong>0.30 delta</strong> (~70% probability of profit): More premium collected, but
          the stock does not need to move much to test your strike. Good for high-IV environments
          where you are getting paid well for the risk.
        </li>
        <li>
          <strong>0.20 delta</strong> (~80% probability of profit): Less premium, but a much
          wider margin of safety. Better for lower-IV environments or volatile stocks.
        </li>
        <li>
          <strong>0.16 delta</strong> (~84% probability of profit): One standard deviation.
          Very conservative, but the premium collected may not justify the capital tied up.
        </li>
      </ul>

      <h3>The 30-45 DTE Sweet Spot</h3>
      <p>
        Theta decay is not linear — it accelerates as expiration approaches, but the steepest
        part of the curve starts around 30-45 days to expiration (DTE). This window gives you:
      </p>
      <ul>
        <li>Enough time premium to collect meaningful income</li>
        <li>The beginning of accelerated theta decay working in your favor</li>
        <li>Time to manage or adjust the trade if it moves against you</li>
        <li>Less gamma risk than very short-dated options (under 14 DTE)</li>
      </ul>
      <p>
        If you sell a 45-DTE option and close it at 21 DTE (after capturing roughly half the
        premium), you have been in the trade during the most favorable part of the theta curve
        while avoiding the wild gamma swings of the final two weeks.
      </p>

      <table>
        <thead>
          <tr>
            <th>DTE Range</th>
            <th>Theta Decay Rate</th>
            <th>Gamma Risk</th>
            <th>Recommendation</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>7-14 DTE</td>
            <td>Very fast</td>
            <td>High</td>
            <td>Experienced traders only</td>
          </tr>
          <tr>
            <td>30-45 DTE</td>
            <td>Accelerating</td>
            <td>Moderate</td>
            <td>Ideal for most sellers</td>
          </tr>
          <tr>
            <td>45-60 DTE</td>
            <td>Moderate</td>
            <td>Low</td>
            <td>Good for larger positions</td>
          </tr>
          <tr>
            <td>60+ DTE</td>
            <td>Slow</td>
            <td>Low</td>
            <td>Capital tied up too long</td>
          </tr>
        </tbody>
      </table>

      <div className="blog-callout tip">
        <strong>Pro Tip: Weekly vs. Monthly Expirations</strong>
        Monthly options (third Friday expirations) typically have better liquidity than weekly
        options. If you are building a{' '}
        <Link to="/blog/weekly-options-income-plan">weekly income plan</Link>, use weekly
        expirations on only the most liquid underlyings (SPY, QQQ, AAPL, MSFT) and stick to
        monthlies for everything else.
      </div>

      {/* ─── Section 6 ─── */}
      <h2 id="managing-trades">Managing Winners and Losers</h2>
      <p>
        The difference between profitable and unprofitable premium sellers often comes down
        to trade management — not trade selection. Having mechanical rules for when to close
        trades removes emotion and locks in consistent results.
      </p>

      <h3>Taking Profits Early</h3>
      <p>
        Do not hold trades to expiration. The final 25% of a trade's potential profit takes
        the longest to capture and exposes you to the most gamma risk. Set profit targets:
      </p>
      <ul>
        <li>
          <strong>50% of max profit:</strong> The most widely recommended target. If you
          collected $1.00 in credit, close the trade when you can buy it back for $0.50. This
          typically happens in 10-20 days on a 45-DTE trade.
        </li>
        <li>
          <strong>75% of max profit:</strong> More aggressive target. Captures more premium per
          trade but requires holding longer and accepting more risk.
        </li>
      </ul>
      <p>
        <strong>Why 50% works so well:</strong> On a $1.00 credit spread, closing at $0.50
        profit means you captured 50% of the max in perhaps half the time. You free up the
        capital to immediately open a new position. Over a year, the capital efficiency of
        recycling trades at 50% far outweighs the extra $0.25-$0.50 you might squeeze out by
        holding longer.
      </p>

      <h3>Managing Losers</h3>
      <p>
        Losing trades are inevitable. The question is how much you let them cost you. Common
        stop-loss approaches:
      </p>
      <ul>
        <li>
          <strong>2x the credit received:</strong> If you collected $1.00, close the trade if
          the loss reaches $2.00 (i.e., the spread is trading at $3.00). This limits any single
          trade to a 2:1 loss-to-win ratio.
        </li>
        <li>
          <strong>Fixed percentage of max loss:</strong> Close the trade when your unrealized
          loss hits 50% of the max potential loss. On a $5 wide spread with a $1.00 credit,
          close when the spread reaches $3.00.
        </li>
        <li>
          <strong>21 DTE exit:</strong> If the trade is not profitable by 21 DTE, close it
          regardless. This prevents you from riding losers into high-gamma territory where
          small moves cause large P&L swings.
        </li>
      </ul>

      <h3>Rolling Trades</h3>
      <p>
        Rolling means closing your current position and simultaneously opening a new one —
        typically at the same strike but a later expiration. Rolling is appropriate when:
      </p>
      <ul>
        <li>The stock is near your strike but your thesis has not changed</li>
        <li>You can roll for a net credit (you collect additional premium)</li>
        <li>The new position still meets your entry criteria</li>
      </ul>
      <p>
        <strong>Never roll for a debit.</strong> If you have to pay money to roll, you are
        throwing good money after bad. Accept the loss and move on.
      </p>

      <div className="blog-callout warning">
        <strong>Emotional Discipline</strong>
        The hardest part of premium selling is not finding trades — it is following your rules
        when a position goes against you. Write your management rules down before you enter any
        trade. When the loss hits your threshold, close it. No exceptions, no "just one more day."
      </div>

      {/* ─── Section 7 ─── */}
      <h2 id="building-portfolio">Building a Monthly Income Portfolio</h2>
      <p>
        A single trade is a gamble. A portfolio of premium-selling trades across multiple
        underlyings and strategies is a business. Here is how to structure one.
      </p>

      <h3>Diversification Rules</h3>
      <ul>
        <li>
          <strong>No more than 5% of your account in any single underlying.</strong> If you
          have a $50,000 account, no single position should risk more than $2,500.
        </li>
        <li>
          <strong>Spread across sectors.</strong> Do not sell puts on AAPL, MSFT, GOOGL, and
          META all at once — they are all tech and will move together in a sell-off. Mix in
          financials, healthcare, energy, and consumer names.
        </li>
        <li>
          <strong>Mix strategies.</strong> Combine credit spreads, cash-secured puts, and
          covered calls. Each performs differently in various market environments.
        </li>
        <li>
          <strong>Stagger expirations.</strong> Open new positions every week with 30-45 DTE
          expirations. This creates a "ladder" of trades expiring at different times, smoothing
          your income and reducing the risk of all trades going wrong simultaneously.
        </li>
      </ul>

      <h3>A Sample Monthly Cycle ($50,000 Account)</h3>
      <table>
        <thead>
          <tr>
            <th>Week</th>
            <th>Action</th>
            <th>Positions</th>
            <th>Capital Used</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Week 1</td>
            <td>Open 2-3 new credit spreads</td>
            <td>SPY put spread, AAPL put spread</td>
            <td>$3,000-$4,000</td>
          </tr>
          <tr>
            <td>Week 2</td>
            <td>Open 2 new positions, manage Week 1</td>
            <td>MSFT put spread, IWM iron condor</td>
            <td>$3,000-$4,000</td>
          </tr>
          <tr>
            <td>Week 3</td>
            <td>Close Week 1 winners at 50%, open new</td>
            <td>AMZN covered call, JPM put spread</td>
            <td>$3,000-$4,000</td>
          </tr>
          <tr>
            <td>Week 4</td>
            <td>Close Week 2 winners, open new</td>
            <td>GOOGL put spread, XLF put spread</td>
            <td>$3,000-$4,000</td>
          </tr>
        </tbody>
      </table>

      <p>
        At any given time, you might have 6-10 open positions using 30-40% of your total
        capital. The rest stays in cash as a reserve for adjustments, new opportunities, or
        assignment risk. Never be fully deployed — always maintain at least 50% buying power.
      </p>

      <div className="blog-callout tip">
        <strong>Automate Your Scanning</strong>
        Manually scanning 100+ stocks for IV Rank, delta targets, and earnings dates every week
        is tedious. That is exactly what <Link to="/picks">NewLeaf System's weekly picks</Link> do
        for you — delivering the highest-quality premium selling setups ranked by our AI scoring
        engine every week.
      </div>

      {/* ─── Section 8 ─── */}
      <h2 id="risks">The Risks of Selling Premium</h2>
      <p>
        We would be doing you a disservice if we only talked about the income. Premium selling
        has real risks, and understanding them is what separates traders who survive from those
        who blow up.
      </p>

      <h3>Assignment Risk</h3>
      <p>
        When you sell options, you can be assigned — forced to buy (puts) or sell (calls) shares
        at the strike price. For cash-secured puts, this means buying 100 shares at potentially
        above-market prices. For covered calls, it means your shares get called away and you
        miss further upside.
      </p>
      <p>
        Assignment is most common when options are in the money near expiration or when a stock
        goes ex-dividend. The fix: close or roll positions before expiration week if they are
        near the money. And for cash-secured puts, only sell on stocks you genuinely want to own.
      </p>

      <h3>Gap Risk</h3>
      <p>
        Stocks can gap through your strike overnight on earnings, economic data, or geopolitical
        events. A stock at $100 with your short put at $95 can open at $85 the next morning.
        For naked puts, that means an instant $1,000 loss per contract. For put spreads with a
        $90 long put, your loss is capped at $500 minus the credit received.
      </p>
      <p>
        <strong>This is why credit spreads exist</strong> — the long option you buy caps your
        worst-case loss. Beginners should always use defined-risk strategies until they have both
        the capital and the experience for naked premium selling.
      </p>

      <h3>Tail Events and Correlation Risk</h3>
      <p>
        In a market crash, correlations spike toward 1.0. Your "diversified" portfolio of puts
        across 8 different stocks all move against you at the same time. March 2020 (COVID crash)
        saw the S&P 500 drop 34% in three weeks. September-October 2008 was worse.
      </p>
      <p>
        No amount of diversification protects you when the entire market sells off
        simultaneously. The only defenses are:
      </p>
      <ul>
        <li><strong>Position sizing:</strong> No single trade should be large enough to hurt you</li>
        <li><strong>Portfolio heat limit:</strong> Cap your total open risk at 20-30% of your account</li>
        <li><strong>Stop losses:</strong> Mechanical exits before losses compound</li>
        <li><strong>Cash reserves:</strong> Always maintain at least 50% buying power so you can survive drawdowns and capitalize on high-IV opportunities</li>
      </ul>

      <h3>The Illusion of Consistency</h3>
      <p>
        Premium selling produces small, frequent wins and occasional larger losses. Your monthly
        P&L might look like: +$800, +$1,200, +$600, +$900, -$2,500, +$1,000. The winning
        months feel great. The losing month feels devastating, even though the net over six
        months is positive ($2,000).
      </p>
      <p>
        This payoff structure is psychologically challenging. You must be prepared for the
        losing months and trust your system's long-term edge. Backtesting and tracking your
        results over at least 6-12 months is essential for building that trust.
      </p>

      <div className="blog-callout warning">
        <strong>Honest Assessment</strong>
        Premium selling is not free money. It is a strategy with a genuine statistical edge, but
        it requires discipline, proper sizing, and the emotional resilience to handle drawdowns.
        If you are not willing to follow strict risk management rules, you will eventually give
        back all your profits — and more — in a single bad month.
      </div>

      {/* ─── Section 9: FAQ ─── */}
      <h2 id="faq">Frequently Asked Questions</h2>

      <div className="blog-faq">
        <div className="blog-faq-item">
          <div className="blog-faq-q">
            How much money do I need to start selling options for income?
          </div>
          <div className="blog-faq-a">
            It depends on the strategy. Credit spreads can be opened with as little as $500-$1,000
            per position, making a $5,000-$10,000 account workable for defined-risk strategies.
            Cash-secured puts require enough capital to buy 100 shares, so a single put on a $50
            stock ties up $5,000. For a diversified premium-selling portfolio, $25,000 is a
            practical starting point — it gives you enough to spread across 5-8 positions with
            proper{' '}
            <Link to="/blog/position-sizing-framework">position sizing</Link>.
          </div>
        </div>

        <div className="blog-faq-item">
          <div className="blog-faq-q">
            Is selling options for income better than buying dividend stocks?
          </div>
          <div className="blog-faq-a">
            They serve different purposes. Dividend stocks yield 2-4% annually with relatively
            low effort. Premium selling targets 12-36% annually but requires active management,
            ongoing education, and emotional discipline. Many income investors combine both —
            holding dividend-paying stocks in long-term accounts and selling premium in a
            dedicated trading account. The strategies are complementary, not mutually exclusive.
          </div>
        </div>

        <div className="blog-faq-item">
          <div className="blog-faq-q">
            What happens if I get assigned on a short put?
          </div>
          <div className="blog-faq-a">
            You are obligated to buy 100 shares of the underlying stock at the strike price.
            If you sold a $50 put, you buy 100 shares at $50 regardless of where the stock is
            trading. For cash-secured puts, you already have the $5,000 set aside, so this is
            the expected outcome if the stock drops. Once you own the shares, you can immediately
            start selling covered calls against them — this is known as the "wheel strategy."
            See our guide on{' '}
            <Link to="/blog/covered-call-vs-cash-secured-put">the wheel strategy</Link> for
            the full walkthrough.
          </div>
        </div>

        <div className="blog-faq-item">
          <div className="blog-faq-q">
            Should I sell weekly or monthly options for income?
          </div>
          <div className="blog-faq-a">
            For most traders, the 30-45 DTE range (monthly expirations) offers the best balance
            of premium collection, theta decay, and manageable gamma risk. Weekly options (7-14
            DTE) collect less absolute premium per trade and expose you to higher gamma risk,
            though they can be profitable on the most liquid underlyings like SPY and QQQ. A
            solid approach is to build the core of your portfolio around monthly expirations and
            add selective weekly trades as you gain experience. Our{' '}
            <Link to="/blog/weekly-options-income-plan">weekly options income plan</Link> walks
            through a complete framework for this hybrid approach.
          </div>
        </div>
      </div>
    </>
  );
}
