import { Link } from 'react-router-dom';

export default function IronCondorGuide() {
  return (
    <>
      <h2 id="what-is-iron-condor">What Is an Iron Condor?</h2>
      <p>
        An iron condor is a four-legged options strategy designed to profit when a stock stays
        within a predictable range. Think of it like <strong>collecting rental income on a piece
        of real estate</strong> — you get paid upfront, and as long as nothing dramatic happens
        (the tenant doesn't trash the place), you keep the rent. With an iron condor, you collect
        a credit when you open the trade, and you keep that credit as long as the stock price
        stays between your two short strikes by expiration.
      </p>
      <p>
        In technical terms, an iron condor combines a <strong>bull put spread</strong> (below the
        current price) with a <strong>bear call spread</strong> (above the current price). You're
        simultaneously betting that the stock won't fall too far <em>and</em> won't rise too far.
        The result is a defined-risk, defined-reward trade with a high probability of profit — typically
        in the 60-80% range depending on your strike selection.
      </p>
      <p>
        This strategy is one of the most popular among income-focused options traders because it
        lets you profit from the passage of time (theta decay) without needing to predict which
        direction the stock will move. If you're interested in{' '}
        <Link to="/blog/selling-options-for-income">selling options for income</Link>, the iron
        condor is a foundational strategy to master.
      </p>

      <h2 id="how-it-works">How an Iron Condor Works</h2>
      <p>
        Every iron condor has exactly four legs — four separate options contracts that work
        together. Here's how they break down, using a stock trading at $100 as our example:
      </p>
      <ol>
        <li>
          <strong>Sell an OTM put</strong> (e.g., sell the $95 put) — This is the lower short
          strike. You collect premium here.
        </li>
        <li>
          <strong>Buy a further OTM put</strong> (e.g., buy the $90 put) — This protects you if
          the stock crashes. It defines your max loss on the downside.
        </li>
        <li>
          <strong>Sell an OTM call</strong> (e.g., sell the $105 call) — This is the upper short
          strike. More premium collected.
        </li>
        <li>
          <strong>Buy a further OTM call</strong> (e.g., buy the $110 call) — This caps your risk
          on the upside if the stock rallies hard.
        </li>
      </ol>
      <p>
        The two spreads create a "profit zone" between $95 and $105. As long as the stock stays
        in that range through expiration, all four options expire worthless and you keep the entire
        net credit. The bought options at $90 and $110 act as your safety net — they cap your
        maximum possible loss so you always know your worst-case scenario before entering the trade.
      </p>

      <div className="blog-callout tip">
        <strong>Pro Tip</strong>
        The iron condor is really just two credit spreads packaged together. If you already
        understand <Link to="/blog/selling-options-for-income">credit spreads</Link>, you
        already understand half of the iron condor. The key difference is that you're collecting
        premium from <em>both</em> sides of the trade.
      </div>

      <p>
        Understanding the{' '}
        <Link to="/blog/options-greeks-explained">options Greeks</Link> is essential for
        managing iron condors. Theta (time decay) works in your favor every day, while delta
        stays near zero when the stock is centered between your short strikes — exactly where
        you want it.
      </p>

      <h2 id="when-to-use">When to Use an Iron Condor</h2>
      <p>
        Iron condors aren't a strategy you should deploy blindly on any stock at any time.
        They work best under specific market conditions:
      </p>
      <ul>
        <li>
          <strong>Range-bound markets.</strong> The stock has been consolidating or trading in a
          defined channel. There's no strong directional momentum, and technical support and
          resistance levels are clearly visible.
        </li>
        <li>
          <strong>High implied volatility rank.</strong> When{' '}
          <Link to="/blog/implied-volatility-rank-explained">IV rank</Link> is above 30 (ideally
          above 50), options premiums are inflated. This means you collect a larger credit upfront,
          which improves your risk-to-reward ratio and gives you a wider profit zone.
        </li>
        <li>
          <strong>No upcoming earnings or major catalysts.</strong> Earnings announcements,
          FDA decisions, and similar binary events can cause stocks to gap well beyond your
          short strikes overnight. Avoid placing iron condors in the two weeks before earnings.
        </li>
        <li>
          <strong>Liquid underlyings.</strong> Stick to stocks and ETFs with tight bid-ask spreads
          on their options chains. Wide spreads eat into your credit and make the trade
          harder to manage. Think SPY, QQQ, AAPL, AMZN — not thinly traded small caps.
        </li>
      </ul>

      <div className="blog-callout warning">
        <strong>Watch Out</strong>
        One of the most common{' '}
        <Link to="/blog/common-options-trading-mistakes">options trading mistakes</Link> is
        placing an iron condor right before an earnings announcement. The stock might look
        range-bound, but earnings can blow right through both strikes in a single after-hours
        session.
      </div>

      <p>
        NewLeaf System's AI scoring engine automatically evaluates these conditions. Our{' '}
        <Link to="/strategies/iron-condor">iron condor scanner</Link> filters for high IV rank,
        range-bound technicals, and favorable risk-to-reward setups so you don't have to screen
        manually. You can learn more about our selection criteria on the{' '}
        <Link to="/how-we-pick">how we pick</Link> page.
      </p>

      <h2 id="setting-up">Setting Up Your First Iron Condor</h2>
      <p>
        Here's a step-by-step walkthrough for building your first iron condor trade:
      </p>
      <h3>Step 1: Pick Your Underlying</h3>
      <p>
        Choose a liquid stock or ETF that meets the criteria above. For your first trade,
        consider SPY or IWM — they're highly liquid, have penny-wide option spreads, and don't
        have earnings risk.
      </p>
      <h3>Step 2: Choose Your Expiration (30-45 DTE)</h3>
      <p>
        Select an expiration cycle that is <strong>30 to 45 days out</strong>. This is the sweet
        spot where theta decay accelerates but you still have enough time for the trade to work.
        Shorter expirations have faster decay but leave less room for error. Longer expirations
        tie up more capital for a similar credit.
      </p>
      <h3>Step 3: Select Your Short Strikes (16-25 Delta)</h3>
      <p>
        Place your short put and short call at strikes with a <strong>delta between 16 and
        25</strong>. A 16-delta strike has roughly an 84% probability of expiring out of the money.
        A 25-delta strike offers a fatter credit but a lower probability (about 75%). Most
        experienced traders land around 20 delta for a balanced approach.
      </p>
      <h3>Step 4: Determine Wing Width</h3>
      <p>
        The "wings" are how far apart your long options are from your short options. Common widths
        are $2, $3, $5, or $10, depending on the stock price. Wider wings collect more credit but
        increase your max loss. For a $100 stock, $5-wide wings are a typical starting point.
      </p>
      <h3>Step 5: Check Your Credit and Risk-to-Reward</h3>
      <p>
        Before clicking "send order," verify that your net credit is at least 25-33% of the wing
        width. On $5-wide wings, you want at least $1.25-$1.65 in credit. If the credit is too thin,
        the trade isn't worth the risk — move on and wait for a better setup.
      </p>

      <div className="blog-callout tip">
        <strong>Quick Setup Checklist</strong>
        Underlying is liquid with tight spreads. Expiration is 30-45 DTE. Short strikes are
        at 16-25 delta. Net credit is at least 1/3 of wing width. No earnings before expiration.
        If all five boxes check out, you're ready to place the trade.
      </div>

      <h2 id="risk-reward">Understanding the Risk and Reward</h2>
      <p>
        One of the biggest advantages of the iron condor is that your risk and reward are
        completely defined before you enter the trade. There are no surprises.
      </p>
      <p>
        <strong>Maximum profit</strong> = the net credit received. If you collect $3.50 per
        share ($350 per contract), that's the most you can make.
      </p>
      <p>
        <strong>Maximum loss</strong> = wing width minus net credit. With $5.00-wide wings and a
        $3.50 credit, your max loss is $5.00 - $3.50 = <strong>$1.50 per share ($150 per
        contract)</strong>.
      </p>
      <p>
        <strong>Breakeven points:</strong>
      </p>
      <ul>
        <li>
          <strong>Lower breakeven</strong> = short put strike minus net credit. If your short put
          is at $95 and you collected $3.50, the lower breakeven is $95.00 - $3.50 = <strong>$91.50</strong>.
        </li>
        <li>
          <strong>Upper breakeven</strong> = short call strike plus net credit. If your short call
          is at $105, the upper breakeven is $105.00 + $3.50 = <strong>$108.50</strong>.
        </li>
      </ul>
      <p>
        That gives you a <strong>$17 profit zone</strong> (from $91.50 to $108.50) on a $100
        stock — a 17% window. As long as the stock stays anywhere within that range, you
        profit. The stock can move quite a bit and you still win.
      </p>
      <p>
        In this example, the risk-to-reward ratio is $150 risk for $350 reward, meaning you're
        risking less than half of what you stand to gain. That's an unusually favorable setup.
        More typically, you'll see ratios closer to 2:1 (risking $2 for every $1 of potential
        profit), which still works well because your probability of profit is high.
      </p>

      <h2 id="managing">Managing Your Iron Condor Position</h2>
      <p>
        Opening the trade is only half the battle. Good management rules are what separate
        consistent income traders from those who give back their profits. Here are three
        rules to live by:
      </p>
      <h3>Rule 1: Take Profit at 50% of Max</h3>
      <p>
        If you collected $3.50 in credit, close the entire iron condor when you can buy it back
        for $1.75 or less. This locks in $1.75 of profit per share ($175 per contract). Why not
        hold for the full $3.50? Because the last 50% of profit takes the longest to materialize
        and exposes you to gamma risk in the final week. Taking profits early also frees up your
        capital for the next trade.
      </p>
      <h3>Rule 2: Stop at 2x Credit Loss</h3>
      <p>
        If the iron condor moves against you and the cost to close reaches $7.00 (that's your
        original $3.50 credit plus a $3.50 loss), close the trade. A $3.50 loss per contract ($350)
        hurts, but it's far better than riding it to the maximum loss of $5.00 per share. This
        rule keeps any single trade from doing serious damage to your account.
      </p>
      <h3>Rule 3: Roll the Untested Side</h3>
      <p>
        If the stock moves toward one side of your iron condor, the opposite spread will have
        decayed to near zero. You can close that "winning" spread for a few cents and
        re-sell it closer to the current price to collect additional credit. This effectively
        reduces your cost basis and widens your breakeven. For example, if the stock rallies
        to $104, your put spread might be worth $0.05. Close it, then sell a new put spread
        at higher strikes to collect another $0.80-$1.00 in credit.
      </p>

      <div className="blog-callout warning">
        <strong>Gamma Risk Alert</strong>
        Avoid holding iron condors into the final 7 days before expiration if either short strike
        is being tested. Gamma increases rapidly in the last week, meaning small stock moves cause
        large swings in your P&L. Close or roll early to avoid getting whipsawed.
      </div>

      <h2 id="common-mistakes">Common Iron Condor Mistakes</h2>
      <p>
        Even experienced traders fall into these traps. Recognizing them upfront saves you
        real money:
      </p>
      <ul>
        <li>
          <strong>Placing before earnings.</strong> This is the number one iron condor killer.
          Earnings can produce 5-10% overnight gaps that blow through both short strikes.
          Always check the earnings calendar before entering a trade.
        </li>
        <li>
          <strong>Wings too narrow.</strong> Narrow wings (e.g., $1 or $2 wide on a $200 stock)
          produce tiny credits that don't justify the commissions and risk. If your credit is less
          than 20% of the wing width, the trade math doesn't work.
        </li>
        <li>
          <strong>Holding through gamma risk.</strong> As expiration approaches, gamma accelerates
          and your position can swing from profitable to max loss in a single trading day. Close
          winning trades at 50% profit or at 21 DTE — whichever comes first.
        </li>
        <li>
          <strong>Over-sizing the position.</strong> An iron condor on a $500 stock with $10-wide
          wings risks $1,000 per contract. If you're running 10 contracts, that's $10,000 at risk
          in a single trade. Keep position sizes to 1-3% of your portfolio.
        </li>
        <li>
          <strong>Ignoring correlation.</strong> Running iron condors on AAPL, MSFT, GOOGL, and
          AMZN simultaneously isn't diversification — these stocks are highly correlated. One bad
          tech day can blow up all four positions at once. Spread across sectors.
        </li>
      </ul>
      <p>
        For a broader list of pitfalls,{' '}
        check out our guide on{' '}
        <Link to="/blog/common-options-trading-mistakes">common options trading mistakes</Link>.
      </p>

      <h2 id="vs-other-strategies">Iron Condor vs. Other Income Strategies</h2>
      <p>
        How does the iron condor stack up against other popular premium-selling strategies?
        Here's a side-by-side comparison:
      </p>

      <table>
        <thead>
          <tr>
            <th>Feature</th>
            <th>Iron Condor</th>
            <th>Covered Call</th>
            <th>Credit Spread</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Market outlook</td>
            <td>Neutral / range-bound</td>
            <td>Mildly bullish</td>
            <td>Directional (bull or bear)</td>
          </tr>
          <tr>
            <td>Capital required</td>
            <td>$150-$1,000 per contract</td>
            <td>Full stock price (e.g., $10,000+)</td>
            <td>$100-$500 per contract</td>
          </tr>
          <tr>
            <td>Max profit</td>
            <td>Net credit received</td>
            <td>Call premium + stock appreciation to strike</td>
            <td>Net credit received</td>
          </tr>
          <tr>
            <td>Max loss</td>
            <td>Wing width minus credit</td>
            <td>Stock drops to zero (minus premium)</td>
            <td>Spread width minus credit</td>
          </tr>
          <tr>
            <td>Risk defined?</td>
            <td>Yes</td>
            <td>No (large downside)</td>
            <td>Yes</td>
          </tr>
          <tr>
            <td>Typical win rate</td>
            <td>60-80%</td>
            <td>65-75%</td>
            <td>55-70%</td>
          </tr>
          <tr>
            <td>Best for</td>
            <td>Smaller accounts, neutral bias</td>
            <td>Investors who own shares</td>
            <td>Traders with a directional lean</td>
          </tr>
        </tbody>
      </table>

      <p>
        The iron condor's biggest edge over a covered call is <strong>capital efficiency</strong>.
        You can run an iron condor on AAPL for a few hundred dollars in buying power, whereas
        a covered call requires owning 100 shares ($15,000+). Meanwhile, compared to a single
        credit spread, the iron condor collects premium from <em>both</em> sides, which improves
        your breakevens and increases your probability of profit.
      </p>
      <p>
        That said, covered calls are simpler and have a more intuitive risk profile for investors
        who already own shares. And if you have a directional view, a single credit spread lets
        you focus your risk where your thesis is strongest. There's no universally "best" strategy
        — it depends on your account size, market outlook, and risk tolerance. Explore all of our{' '}
        <Link to="/strategies/iron-condor">strategy breakdowns</Link> to find the right fit.
      </p>

      <h2 id="faq">Frequently Asked Questions</h2>

      <div className="blog-faq">
        <div className="blog-faq-item">
          <div className="blog-faq-q">How much money do I need to trade iron condors?</div>
          <div className="blog-faq-a">
            The buying power requirement for an iron condor equals the wing width minus the
            credit received. A $5-wide iron condor that collects $1.50 in credit requires $350
            in buying power ($500 - $150). Most brokers let you start trading iron condors with
            as little as a $2,000-$5,000 account, though we recommend at least $5,000 so you
            can properly diversify across multiple positions.
          </div>
        </div>

        <div className="blog-faq-item">
          <div className="blog-faq-q">What is the ideal win rate for iron condors?</div>
          <div className="blog-faq-a">
            With 16-delta short strikes, you can expect a theoretical win rate around 70-80%.
            In practice, because you'll manage losing trades before they hit max loss (using the
            2x credit stop rule), your realized win rate may be slightly lower — typically 60-70%.
            The key is that your average winner is large enough relative to your average loser
            to maintain a positive expectancy over dozens of trades.
          </div>
        </div>

        <div className="blog-faq-item">
          <div className="blog-faq-q">Can I trade iron condors on weekly options?</div>
          <div className="blog-faq-a">
            Yes, but proceed with caution. Weekly iron condors experience faster theta decay (good)
            but also much higher gamma risk (bad). A stock only needs to move 2-3% on a Friday to
            blow through your short strikes on a weekly. If you use weeklies, take profits earlier
            (at 25-30% of max) and keep position sizes smaller. Monthly options with 30-45 DTE
            are a safer starting point.
          </div>
        </div>

        <div className="blog-faq-item">
          <div className="blog-faq-q">What happens if one side of my iron condor gets breached?</div>
          <div className="blog-faq-a">
            If the stock moves beyond one of your short strikes, that side of the condor will start
            losing money while the opposite side profits. You have three options: close the entire
            position, close only the losing side and keep the profitable side, or roll the tested
            spread to a later expiration or further strike. Most traders choose to close the full
            position if the loss reaches 2x their original credit to limit damage.
          </div>
        </div>

        <div className="blog-faq-item">
          <div className="blog-faq-q">Should I let iron condors expire or close them early?</div>
          <div className="blog-faq-a">
            Almost always close them before expiration. Letting options expire introduces
            assignment risk and pin risk (the stock landing right at a strike). Close winning
            trades at 50% profit, and close any remaining positions by 7-10 DTE. The small
            amount of profit left on the table isn't worth the headaches of holding into
            expiration week.
          </div>
        </div>
      </div>
    </>
  );
}
