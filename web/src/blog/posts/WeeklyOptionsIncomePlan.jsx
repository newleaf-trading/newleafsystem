import { Link } from 'react-router-dom';

export default function WeeklyOptionsIncomePlan() {
  return (
    <>
      <p>
        Weekly options have transformed how income-focused traders approach the market.
        Instead of waiting 30-45 days for a monthly cycle to play out, you can collect
        premium every single week — compounding returns faster and adapting to changing
        conditions in near real-time. But that speed cuts both ways. Without a structured
        plan, weekly options can erode your account just as quickly as they build it.
      </p>
      <p>
        This guide lays out a complete <strong>weekly options income strategy</strong> — a
        step-by-step trading plan you can follow from Sunday evening through Friday
        expiration. Whether you sell credit spreads, iron condors, or cash-secured puts,
        the framework applies. By the end, you will have a repeatable process designed
        for consistent, risk-managed income.
      </p>

      {/* ────────────────────────────────────── */}
      <h2 id="why-weekly">Why Weekly Options?</h2>
      <p>
        Weekly options expire every Friday (and on some underlyings, Monday and Wednesday
        as well). Their defining characteristic is <strong>accelerated theta decay</strong>.
        Time value melts fastest in the final 5-7 days of an option's life, which means
        weekly sellers capture the steepest portion of the decay curve every single cycle.
      </p>
      <p>
        For premium sellers, this is a structural edge. Monthly options spend most of
        their life in the slow-decay zone; weeklys live entirely in the fast-decay zone.
        That translates to more frequent income — 52 potential cycles per year versus 12.
      </p>

      <h3>The Trade-Off: Gamma Risk</h3>
      <p>
        The flip side of fast theta is elevated <strong>gamma</strong>. As expiration
        approaches, short options become increasingly sensitive to price moves. A stock
        that drifts 2% against you on a Tuesday might cause your short strike to go from
        safely out-of-the-money to in-the-money by Thursday. This{' '}
        <Link to="/blog/options-greeks-explained">gamma risk</Link> is the primary
        danger of weekly options, and it demands disciplined position sizing and
        management rules.
      </p>

      <div className="blog-callout tip">
        <strong>Key Takeaway</strong>
        Weekly options let you collect premium faster, but the compressed timeframe means
        less room for error. Success requires a rigid process — not more trades, but
        better-managed ones.
      </div>

      {/* ────────────────────────────────────── */}
      <h2 id="weekly-vs-monthly">Weekly vs. Monthly Options for Income</h2>
      <p>
        Before committing to a weekly cadence, understand how weeklys stack up against
        monthly expirations across the dimensions that matter most to income traders.
      </p>

      <table>
        <thead>
          <tr>
            <th>Factor</th>
            <th>Weekly Options</th>
            <th>Monthly Options</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Theta Decay Rate</strong></td>
            <td>Very fast — steepest portion of the curve</td>
            <td>Slow for the first 2-3 weeks, then accelerates</td>
          </tr>
          <tr>
            <td><strong>Gamma Exposure</strong></td>
            <td>High — strikes become binary near expiration</td>
            <td>Lower — more time cushions adverse moves</td>
          </tr>
          <tr>
            <td><strong>Income Frequency</strong></td>
            <td>52 cycles / year</td>
            <td>12 cycles / year</td>
          </tr>
          <tr>
            <td><strong>Premium per Trade</strong></td>
            <td>Lower absolute premium per contract</td>
            <td>Higher absolute premium per contract</td>
          </tr>
          <tr>
            <td><strong>Management Flexibility</strong></td>
            <td>Less time to adjust — decisions happen fast</td>
            <td>More time to roll, adjust, or wait</td>
          </tr>
          <tr>
            <td><strong>Ideal Strategy Type</strong></td>
            <td>Short credit spreads, iron condors, cash-secured puts</td>
            <td>Iron condors, strangles, calendar spreads</td>
          </tr>
          <tr>
            <td><strong>Commission Impact</strong></td>
            <td>Higher (more frequent trading)</td>
            <td>Lower (fewer round trips)</td>
          </tr>
          <tr>
            <td><strong>Best For</strong></td>
            <td>Active traders who monitor daily</td>
            <td>Part-time traders or set-and-forget approaches</td>
          </tr>
        </tbody>
      </table>

      <p>
        Many experienced traders blend both: weekly options on liquid, range-bound names
        and monthly options on positions that need more room to breathe. The framework
        below focuses on the weekly cadence, but the principles — especially around{' '}
        <Link to="/blog/position-sizing-framework">position sizing</Link> — apply
        regardless of expiration cycle.
      </p>

      {/* ────────────────────────────────────── */}
      <h2 id="framework">The Weekly Options Income Framework</h2>
      <p>
        Consistency in trading comes from process, not prediction. The weekly options
        income framework is a four-step cycle you repeat every week. Each step has
        a clear objective, a defined time window, and specific actions.
      </p>

      <div style={{
        background: '#fff',
        border: '1px solid rgba(11,45,35,.1)',
        borderRadius: 10,
        padding: '24px 28px',
        margin: '24px 0',
      }}>
        <h3 style={{ marginTop: 0 }}>The Four-Step Weekly Cycle</h3>
        <ol>
          <li>
            <strong>Sunday: Market Review</strong> — Assess macro conditions, identify
            candidates, set the week's bias.
          </li>
          <li>
            <strong>Monday: Trade Entry</strong> — Select 2-3 high-probability setups,
            execute after the open settles.
          </li>
          <li>
            <strong>Mid-Week: Management</strong> — Take profits at 50%, adjust or roll
            tested positions.
          </li>
          <li>
            <strong>Friday: Expiration</strong> — Close remaining positions by Thursday
            close or Friday morning.
          </li>
        </ol>
      </div>

      <p>
        The rest of this guide walks through each step in detail. Follow this process
        for 4-6 weeks to build confidence before adding complexity.
      </p>

      {/* ────────────────────────────────────── */}
      <h2 id="sunday-review">Step 1: Sunday Market Review</h2>
      <p>
        Your trading week starts on Sunday evening with 30-60 minutes of preparation.
        The goal is to enter Monday with a short list of candidates and a clear view of
        the macro backdrop. Here is the checklist:
      </p>

      <h3>1A. Check the Big Picture</h3>
      <ul>
        <li>
          <strong>SPX / SPY levels:</strong> Where did the S&P 500 close? Is it above or
          below key moving averages (20-day, 50-day)? Is the trend bullish, bearish, or
          rangebound?
        </li>
        <li>
          <strong>VIX level:</strong> A VIX above 18-20 generally means richer premiums
          for sellers. Below 14, premiums may be too thin for weekly trades to justify
          the risk.
        </li>
        <li>
          <strong>Economic calendar:</strong> Note any Fed announcements, CPI/PPI data,
          or major earnings in the coming week. Avoid opening new trades into binary
          events unless you are sizing down significantly.
        </li>
      </ul>

      <h3>1B. Screen for Candidates</h3>
      <ul>
        <li>
          Look for <strong>5-10 liquid names</strong> with weekly options and tight
          bid-ask spreads (penny or nickel-wide).
        </li>
        <li>
          Check{' '}
          <Link to="/blog/selling-options-for-income">implied volatility rank (IVR)</Link>{' '}
          — prioritize tickers where IVR is above 30, meaning current implied volatility
          is elevated relative to the past year.
        </li>
        <li>
          Scan for <strong>sector rotation</strong>: which sectors led or lagged last
          week? Rotate into sectors showing relative strength for bullish trades, or
          fading sectors for neutral/bearish setups.
        </li>
      </ul>

      <div className="blog-callout tip">
        <strong>NewLeaf Tip</strong>
        Our <Link to="/picks">weekly picks</Link> page surfaces the top-scoring setups
        across 108 tickers and 8 strategies every week — a ready-made candidate list for
        your Sunday review.
      </div>

      <h3>1C. Set the Weekly Bias</h3>
      <p>
        Based on your review, assign a directional bias for the week: <strong>bullish</strong>,{' '}
        <strong>neutral</strong>, or <strong>bearish</strong>. This does not mean you
        predict the market — it means you tilt your trade selection accordingly. In a
        neutral-to-bullish week, you might favor bull put spreads and iron condors. In a
        bearish week, you might favor bear call spreads or widen your iron condor wings.
      </p>

      {/* ────────────────────────────────────── */}
      <h2 id="monday-entry">Step 2: Monday Trade Entry</h2>
      <p>
        Monday is execution day. From your Sunday watchlist of 5-10 names, narrow down
        to the <strong>2-3 best setups</strong>. Quality matters far more than quantity
        in a weekly income plan.
      </p>

      <h3>2A. Wait for the Open to Settle</h3>
      <p>
        Avoid placing trades in the first 30 minutes of the session. The open is often
        volatile with wide spreads, overnight gap adjustments, and institutional order
        flow. Waiting until 10:00-10:30 AM ET gives you a clearer picture of the day's
        tone and tighter option pricing.
      </p>

      <h3>2B. Select Your Strikes</h3>
      <ul>
        <li>
          For <strong>credit spreads</strong> (bull put or bear call): target short
          strikes at the 15-20 delta level, which corresponds roughly to one standard
          deviation out-of-the-money. This gives a statistical probability of profit
          around 80-85%.
        </li>
        <li>
          For{' '}
          <Link to="/blog/iron-condor-strategy-explained">iron condors</Link>: place
          both short strikes at the 15-delta level. The total credit should be at
          least 1/3 the width of one spread wing to ensure favorable reward-to-risk.
        </li>
        <li>
          For <strong>cash-secured puts</strong>: sell at a strike where you would
          genuinely be comfortable owning the shares. Target the 20-25 delta range.
        </li>
      </ul>

      <h3>2C. Position Sizing</h3>
      <p>
        This is where most weekly traders fail. Because weekly trades happen frequently,
        the temptation to over-size is strong. Follow these rules:
      </p>
      <ul>
        <li>
          <strong>Max risk per trade:</strong> 1-2% of account value. For a $50K account,
          that is $500-$1,000 max loss per position.
        </li>
        <li>
          <strong>Total portfolio heat:</strong> No more than 5-6% of the account at
          risk across all open weekly trades simultaneously.
        </li>
        <li>
          <strong>Correlation check:</strong> Avoid having all 3 trades in the same
          sector or in highly correlated names. Diversification matters even in a
          3-trade portfolio.
        </li>
      </ul>
      <p>
        For a deeper dive, see our complete{' '}
        <Link to="/blog/position-sizing-framework">position sizing framework</Link>.
      </p>

      <div className="blog-callout warning">
        <strong>Common Mistake</strong>
        Trading too many weekly positions at once. Three well-chosen, well-sized trades
        per week is enough. Adding a fourth or fifth trade rarely improves returns — it
        just concentrates risk. Review our guide on{' '}
        <Link to="/blog/common-options-trading-mistakes">common options trading mistakes</Link>{' '}
        to avoid other pitfalls.
      </div>

      {/* ────────────────────────────────────── */}
      <h2 id="midweek">Step 3: Mid-Week Management</h2>
      <p>
        Wednesday is your primary management checkpoint, though you should glance at
        positions daily. The mid-week review takes about 15-20 minutes and focuses on
        two scenarios.
      </p>

      <h3>Scenario A: Profit Target Hit (50% of Max)</h3>
      <p>
        If a position has captured 50% or more of the original credit by Wednesday, close
        it. Do not wait for full expiration-day profit. The rationale is simple:
      </p>
      <ul>
        <li>
          The remaining 50% of profit would take the riskiest 2-3 days to capture
          (Thursday and Friday, when gamma is highest).
        </li>
        <li>
          Closing at 50% and redeploying next week produces better risk-adjusted returns
          over time. Studies have shown this management rule significantly improves the
          Sharpe ratio of credit spread strategies.
        </li>
        <li>
          It frees up capital and buying power for the following week's trades.
        </li>
      </ul>

      <h3>Scenario B: Position Is Tested</h3>
      <p>
        If the underlying has moved against you and your short strike is being approached
        (the option delta is now 35-40 or higher), you have three choices:
      </p>
      <ol>
        <li>
          <strong>Close for a loss:</strong> If the move is driven by a fundamental
          catalyst (earnings surprise, news event), take the loss and move on. Do not
          fight the tape.
        </li>
        <li>
          <strong>Roll the tested side:</strong> Roll the short strike further out-of-the-money
          or to next week's expiration. Only roll if you can do so for a net credit — never
          roll for a debit.
        </li>
        <li>
          <strong>Adjust the untested side:</strong> If one side of an iron condor is
          profitable, close it and let the tested side play out with reduced max loss.
        </li>
      </ol>

      <div className="blog-callout tip">
        <strong>Management Rule of Thumb</strong>
        Close winners at 50% profit. Close losers when the short strike delta reaches
        40 or when the loss equals your original credit received. Never let a weekly
        trade turn into a "hope and pray" position.
      </div>

      {/* ────────────────────────────────────── */}
      <h2 id="friday">Step 4: Friday Expiration Management</h2>
      <p>
        Expiration day is where weekly trading gets dangerous if you are not prepared.
        Gamma is at its peak, and even small moves can flip a profitable position into
        a losing one in minutes.
      </p>

      <h3>The Thursday Close Rule</h3>
      <p>
        The simplest and safest approach: <strong>close all remaining positions by
        Thursday's close</strong>. This eliminates overnight risk going into expiration
        Friday and avoids the chaotic final hours of trading. You leave a small amount
        of profit on the table, but you also avoid pin risk, assignment risk, and after-hours
        gaps.
      </p>

      <h3>If You Hold Into Friday</h3>
      <p>
        If you choose to hold a position into Friday (because it is far out-of-the-money
        and the remaining premium is minimal), follow these rules:
      </p>
      <ul>
        <li>
          Close by <strong>12:00 PM ET</strong> at the latest. The final 2 hours of
          expiration Friday are unpredictable and illiquid for many weekly options.
        </li>
        <li>
          Never let a short option expire in-the-money without a plan. Assignment can
          tie up significant capital and create unintended positions over the weekend.
        </li>
        <li>
          If the position is worth less than $0.05, some traders let it expire worthless.
          This is acceptable for defined-risk spreads but risky for naked positions.
        </li>
      </ul>

      <h3>Post-Expiration Review</h3>
      <p>
        After markets close Friday, spend 10 minutes logging your results: entry credit,
        exit debit, profit or loss, and a brief note on what worked or what you would
        change. This journal becomes your most valuable tool over time. Check the{' '}
        <Link to="/picks/recap">weekly recap</Link> to compare your results against
        NewLeaf's tracked picks.
      </p>

      {/* ────────────────────────────────────── */}
      <h2 id="sample-portfolio">Sample Weekly Income Portfolio</h2>
      <p>
        Here is what a typical week might look like for a <strong>$50,000 account</strong>{' '}
        targeting 0.5-1% weekly return ($250-$500). This example uses credit spreads and
        iron condors, but the framework applies to any premium-selling strategy.
      </p>

      <table>
        <thead>
          <tr>
            <th>Trade</th>
            <th>Strategy</th>
            <th>Credit</th>
            <th>Max Risk</th>
            <th>% of Account</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>AAPL 195/190 Bull Put Spread</strong></td>
            <td>Bull Put Spread (5-wide)</td>
            <td>$0.85 ($85/contract)</td>
            <td>$415</td>
            <td>0.8%</td>
          </tr>
          <tr>
            <td><strong>SPY 510/505/545/550 Iron Condor</strong></td>
            <td>Iron Condor (5-wide)</td>
            <td>$1.20 ($120/contract)</td>
            <td>$380</td>
            <td>0.8%</td>
          </tr>
          <tr>
            <td><strong>MSFT 400/395 Bull Put Spread</strong></td>
            <td>Bull Put Spread (5-wide)</td>
            <td>$0.75 ($75/contract)</td>
            <td>$425</td>
            <td>0.9%</td>
          </tr>
        </tbody>
      </table>

      <div style={{
        background: 'rgba(11,45,35,.03)',
        borderRadius: 10,
        padding: '20px 24px',
        margin: '24px 0',
        fontFamily: "'Inter', sans-serif",
        fontSize: 14,
        lineHeight: 1.7,
      }}>
        <strong style={{ display: 'block', marginBottom: 8, color: '#0B2D23' }}>
          Portfolio Summary
        </strong>
        <ul style={{ margin: 0, paddingLeft: 20 }}>
          <li><strong>Total credit collected:</strong> $280 (3 contracts across 3 trades)</li>
          <li><strong>Total capital at risk:</strong> $1,220 (2.4% of $50K account)</li>
          <li><strong>Weekly return if all expire worthless:</strong> 0.56%</li>
          <li><strong>Annualized (52 weeks, compounded):</strong> ~33% (theoretical maximum)</li>
          <li><strong>Realistic target (accounting for losses):</strong> 15-25% annualized</li>
        </ul>
      </div>

      <p>
        Notice that total portfolio heat stays well below the 5-6% guideline. This
        conservative sizing leaves room for unexpected moves and avoids the catastrophic
        losses that wipe out months of gains. Consistency beats aggression in weekly
        income trading.
      </p>

      <div className="blog-callout tip">
        <strong>Compounding Matters</strong>
        Even a modest 0.5% weekly return — after accounting for losing weeks — compounds
        to meaningful annual returns. The key is survival: avoid the blow-up trade that
        erases 10 weeks of profits. Size small, manage early, and let compounding do the
        heavy lifting.
      </div>

      {/* ────────────────────────────────────── */}
      <h2 id="risks">Risks Specific to Weekly Options</h2>
      <p>
        Weekly options are not inherently riskier than monthlies — they are differently
        risky. Understanding these specific risks is essential before committing real
        capital.
      </p>

      <h3>Gamma Explosion</h3>
      <p>
        As expiration approaches, gamma increases exponentially for at-the-money options.
        A short option that was safely 3% out-of-the-money on Monday can become deeply
        in-the-money by Thursday with just a moderate move. This is the number-one
        account killer for weekly sellers. The defense: close or roll positions before
        Thursday if they are anywhere near the money.
      </p>

      <h3>Gap Risk</h3>
      <p>
        Overnight gaps — from after-hours earnings, geopolitical events, or macro data
        releases — can move a stock past your short strike before the market even opens.
        Weekly options leave less time to recover from gaps compared to monthlies. The
        defense: always use defined-risk strategies (spreads, not naked options), and
        avoid holding weekly positions through known binary events.
      </p>

      <h3>Thin Time Value</h3>
      <p>
        Weekly options have very little extrinsic value by nature. This means:
      </p>
      <ul>
        <li>
          <strong>Rolling is harder:</strong> There may not be enough credit in the next
          week's option to make a roll worthwhile.
        </li>
        <li>
          <strong>Adjustment costs are higher:</strong> Closing and re-opening positions
          in thin-premium environments eats into potential profits quickly.
        </li>
        <li>
          <strong>Breakevens are tight:</strong> A $0.50 credit on a $5-wide spread
          means your breakeven is only $0.50 away from your short strike — less buffer
          than a monthly trade at the same delta.
        </li>
      </ul>

      <h3>Overtrading and Burnout</h3>
      <p>
        The weekly cadence can be psychologically taxing. Fifty-two cycles per year means
        fifty-two decisions to enter, manage, and exit. Traders who do not automate parts
        of their process (scanning, journaling, alerts) often burn out within a few months.
        Build systems, not heroics.
      </p>

      <div className="blog-callout warning">
        <strong>Risk Reminder</strong>
        Never risk more than 2% of your account on a single weekly trade, and keep total
        portfolio exposure below 6%. Weekly options amplify both gains and losses — respect
        the math, and the math will reward you over time.
      </div>

      {/* ────────────────────────────────────── */}
      <h2 id="faq">Frequently Asked Questions</h2>

      <div className="blog-faq">
        <div className="blog-faq-item">
          <div className="blog-faq-q">
            How much capital do I need to start trading weekly options for income?
          </div>
          <div className="blog-faq-a">
            A minimum of $5,000-$10,000 is practical for defined-risk strategies like
            credit spreads and iron condors. With a $5K account, you can place 1-2 trades
            per week while staying within the 1-2% risk-per-trade guideline. Smaller
            accounts face challenges with commission drag and position sizing granularity.
            A $25K+ account provides the most flexibility and allows proper diversification
            across 2-3 uncorrelated weekly trades. See our{' '}
            <Link to="/blog/position-sizing-framework">position sizing guide</Link> for
            detailed calculations.
          </div>
        </div>

        <div className="blog-faq-item">
          <div className="blog-faq-q">
            Can I trade weekly options with a full-time job?
          </div>
          <div className="blog-faq-a">
            Yes, but it requires planning. The framework in this guide is designed to
            minimize screen time: 30-60 minutes on Sunday for review, 15-20 minutes on
            Monday morning for entries (you can use limit orders placed before the open),
            a brief mid-week check, and a Thursday close routine. The total weekly time
            commitment is 2-3 hours. If you cannot check positions at all during market
            hours, consider using conditional orders (such as GTC limit orders to close at
            50% profit) and focusing on monthly expirations instead.
          </div>
        </div>

        <div className="blog-faq-item">
          <div className="blog-faq-q">
            What are the best underlyings for weekly options income strategies?
          </div>
          <div className="blog-faq-a">
            Focus on highly liquid names with tight bid-ask spreads on their weekly options.
            Top choices include SPY, QQQ, IWM (index ETFs), and large-cap stocks like AAPL,
            MSFT, AMZN, GOOGL, NVDA, and META. These names have penny-wide spreads,
            deep open interest, and predictable behavior. Avoid low-volume stocks where
            the bid-ask spread on weekly options can be $0.10-$0.20 wide — that spread
            alone can erase your edge. Our{' '}
            <Link to="/picks">weekly picks</Link> highlight the best setups across
            108 liquid tickers each week.
          </div>
        </div>

        <div className="blog-faq-item">
          <div className="blog-faq-q">
            Should I sell weekly options when the VIX is low?
          </div>
          <div className="blog-faq-a">
            Low VIX (below 14-15) means cheaper premiums, which makes weekly income
            strategies less attractive. The credit you collect may not justify the risk.
            In low-VIX environments, consider narrowing your spread width to maintain a
            favorable credit-to-width ratio, reducing position count to 1-2 trades per
            week, or shifting to monthly expirations where the absolute premium is higher.
            Conversely, elevated VIX (above 20) is prime territory for weekly sellers —
            premiums are rich and the statistical edge for premium-selling strategies is
            historically strongest. Learn more about volatility dynamics in our{' '}
            <Link to="/blog/options-greeks-explained">options Greeks guide</Link>.
          </div>
        </div>
      </div>

      {/* ────────────────────────────────────── */}
      <h3>Start Your Weekly Routine</h3>
      <p>
        A weekly options income strategy is not about finding the perfect trade — it is
        about executing a consistent process week after week. Start with the Sunday
        review, enter 2-3 trades on Monday, manage at mid-week, and close before
        expiration. Size conservatively, take profits early, and let compounding work
        in your favor.
      </p>
      <p>
        The framework above has been distilled from thousands of real weekly trades. It
        will not win every week — no strategy does. But it will keep you in the game
        long enough for the odds to play out. That is the real edge in options income
        trading.
      </p>
      <p>
        Ready to see this framework applied to real trades?{' '}
        <Link to="/picks">Browse this week's picks</Link> for AI-scored weekly setups,
        or review the <Link to="/picks/recap">latest recap</Link> to see how past
        weekly trades performed.
      </p>
    </>
  );
}
