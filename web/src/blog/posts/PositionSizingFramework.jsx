import { Link } from 'react-router-dom';

export default function PositionSizingFramework() {
  return (
    <>
      <p>
        Most options traders obsess over finding the perfect strategy. They study iron condors,
        credit spreads, and calendar spreads — but completely neglect the single factor that
        determines whether they survive long enough to profit: <strong>position sizing</strong>.
      </p>
      <p>
        How much should you risk on a single trade? Too little and you waste your time. Too much
        and one bad stretch wipes you out. This guide walks through a practical position sizing
        framework for options trading — from the foundational 1-2% rule to portfolio-level heat
        management.
      </p>

      {/* ── Section 1 ── */}
      <h2 id="why-sizing-matters">Why Position Sizing Matters More Than Strategy</h2>
      <p>
        Here is an uncomfortable truth: a mediocre strategy with excellent position sizing will
        outperform a brilliant strategy with reckless sizing. Every time.
      </p>
      <p>
        The math behind this is well established. The <strong>Kelly Criterion</strong>, developed
        by mathematician John Kelly in 1956, provides a formula for optimal bet sizing:
      </p>
      <blockquote>
        Kelly % = W - [(1 - W) / R]<br />
        Where W = win rate and R = win/loss ratio (average win divided by average loss)
      </blockquote>
      <p>
        For a typical credit spread seller with a 70% win rate and a 1:2 win/loss ratio
        (you risk $2 to make $1), the Kelly fraction is 0.70 - (0.30 / 0.50) = 0.10, or 10%
        of your account. But here is the catch — <strong>full Kelly is extremely aggressive</strong>.
        Professional traders use "half Kelly" or even "quarter Kelly" because real-world variance
        is brutal.
      </p>
      <h3>Account Blowup Examples</h3>
      <p>
        Consider what happens when position sizing goes wrong:
      </p>
      <table>
        <thead>
          <tr>
            <th>Scenario</th>
            <th>Account Size</th>
            <th>Risk Per Trade</th>
            <th>Consecutive Losses to Ruin</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Reckless (10% risk)</td>
            <td>$50,000</td>
            <td>$5,000</td>
            <td>~7 losses = -50% drawdown</td>
          </tr>
          <tr>
            <td>Aggressive (5% risk)</td>
            <td>$50,000</td>
            <td>$2,500</td>
            <td>~13 losses = -50% drawdown</td>
          </tr>
          <tr>
            <td>Conservative (2% risk)</td>
            <td>$50,000</td>
            <td>$1,000</td>
            <td>~34 losses = -50% drawdown</td>
          </tr>
          <tr>
            <td>Ultra-safe (1% risk)</td>
            <td>$50,000</td>
            <td>$500</td>
            <td>~69 losses = -50% drawdown</td>
          </tr>
        </tbody>
      </table>
      <p>
        At 10% per trade, a streak of 7 losers — which <em>will</em> happen eventually — cuts
        your account in half. At 2% per trade, it takes 34 consecutive losers to reach that same
        drawdown. The difference between survival and blowup is position sizing, not strategy.
      </p>
      <div className="blog-callout warning">
        <strong>Reality Check</strong>
        Every options trader will experience losing streaks. In a strategy with a 70% win rate,
        there is roughly a 25% chance of hitting 4 or more consecutive losses at some point
        over 50 trades. Size accordingly.
      </div>

      {/* ── Section 2 ── */}
      <h2 id="one-two-percent-rule">The 1-2% Rule for Options Traders</h2>
      <p>
        The 1-2% rule is the bedrock of sound position sizing: <strong>never risk more than
        1-2% of your total trading account on any single trade</strong>. This is not a
        suggestion — it is a survival requirement.
      </p>
      <h3>How to Calculate Max Risk Per Trade</h3>
      <p>
        The formula is straightforward:
      </p>
      <blockquote>
        Max Risk = Account Value x Risk Percentage
      </blockquote>
      <table>
        <thead>
          <tr>
            <th>Account Size</th>
            <th>1% Risk</th>
            <th>1.5% Risk</th>
            <th>2% Risk</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>$25,000</td>
            <td>$250</td>
            <td>$375</td>
            <td>$500</td>
          </tr>
          <tr>
            <td>$50,000</td>
            <td>$500</td>
            <td>$750</td>
            <td>$1,000</td>
          </tr>
          <tr>
            <td>$100,000</td>
            <td>$1,000</td>
            <td>$1,500</td>
            <td>$2,000</td>
          </tr>
          <tr>
            <td>$250,000</td>
            <td>$2,500</td>
            <td>$3,750</td>
            <td>$5,000</td>
          </tr>
        </tbody>
      </table>
      <p>
        Notice we said "risk," not "invest" or "allocate." The distinction matters enormously in
        options trading. Your risk is not how much capital you deploy — it is the <strong>maximum
        amount you can lose</strong> if the trade goes to full loss. For defined-risk strategies
        like credit spreads and iron condors, this is a known number before you enter the trade.
      </p>
      <div className="blog-callout tip">
        <strong>Pro Tip</strong>
        New traders should start at 1% or even 0.5% per trade. You can always size up once you
        have 30-50 trades of track record proving your strategy works. You cannot un-blow-up an
        account.
      </div>

      {/* ── Section 3 ── */}
      <h2 id="sizing-credit-spreads">Position Sizing for Credit Spreads</h2>
      <p>
        <Link to="/blog/selling-options-for-income">Credit spreads</Link> are among the most
        popular defined-risk strategies. The key advantage for position sizing is that your
        maximum loss is known before entry.
      </p>
      <h3>Calculating Max Loss on a Credit Spread</h3>
      <blockquote>
        Max Loss = (Strike Width - Credit Received) x 100 x Number of Contracts
      </blockquote>
      <p>
        Let's walk through an example. You sell a bull put spread on AAPL:
      </p>
      <ul>
        <li>Sell the $170 put, buy the $165 put (5-point wide spread)</li>
        <li>Credit received: $1.20 per share ($120 per contract)</li>
        <li>Max loss per contract: ($5.00 - $1.20) x 100 = <strong>$380</strong></li>
      </ul>
      <p>
        Now apply the 2% rule to a $50,000 account:
      </p>
      <ul>
        <li>Max risk allowed: $50,000 x 0.02 = $1,000</li>
        <li>Max contracts: $1,000 / $380 = <strong>2.6 contracts, so round down to 2</strong></li>
        <li>Actual risk: 2 x $380 = $760 (1.52% of account)</li>
      </ul>
      <div className="blog-callout tip">
        <strong>Always Round Down</strong>
        When the math gives you a fractional number of contracts, always round down. Rounding
        up violates your risk rules, and violating risk rules "just this once" is how accounts
        die.
      </div>
      <h3>Narrower Spreads vs. Wider Spreads</h3>
      <p>
        Spread width directly impacts how many contracts you can trade:
      </p>
      <table>
        <thead>
          <tr>
            <th>Spread Width</th>
            <th>Credit</th>
            <th>Max Loss / Contract</th>
            <th>Contracts (2% of $50K)</th>
            <th>Total Premium</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>$2.50</td>
            <td>$0.60</td>
            <td>$190</td>
            <td>5</td>
            <td>$300</td>
          </tr>
          <tr>
            <td>$5.00</td>
            <td>$1.20</td>
            <td>$380</td>
            <td>2</td>
            <td>$240</td>
          </tr>
          <tr>
            <td>$10.00</td>
            <td>$2.30</td>
            <td>$770</td>
            <td>1</td>
            <td>$230</td>
          </tr>
        </tbody>
      </table>
      <p>
        Narrower spreads let you trade more contracts, which can be better for liquidity and
        partial profit-taking. Wider spreads give better risk/reward ratios but limit your
        contract count. There is no universally "right" answer — just make sure the total max
        loss stays within your risk budget.
      </p>

      {/* ── Section 4 ── */}
      <h2 id="sizing-iron-condors">Position Sizing for Iron Condors</h2>
      <p>
        <Link to="/blog/iron-condor-strategy-explained">Iron condors</Link> combine a bull put
        spread and a bear call spread. This creates a wrinkle for position sizing: while you
        collect premium from both sides, <strong>only one side can lose at expiration</strong>,
        but during the life of the trade, both sides carry risk.
      </p>
      <h3>Max Loss Calculation</h3>
      <blockquote>
        Max Loss = (Wider Spread Width - Total Credit) x 100 x Contracts
      </blockquote>
      <p>
        Example: You open an iron condor on SPY:
      </p>
      <ul>
        <li>Bull put spread: sell $520 put / buy $515 put ($5 wide)</li>
        <li>Bear call spread: sell $555 call / buy $560 call ($5 wide)</li>
        <li>Total credit: $2.10 per share ($210 per contract)</li>
        <li>Max loss per contract: ($5.00 - $2.10) x 100 = <strong>$290</strong></li>
      </ul>
      <p>
        With a $50,000 account at 2% risk ($1,000 max):
      </p>
      <ul>
        <li>Max contracts: $1,000 / $290 = 3.4, round down to <strong>3 contracts</strong></li>
        <li>Actual risk: 3 x $290 = $870 (1.74% of account)</li>
      </ul>
      <h3>Correlated Risk: The Hidden Danger</h3>
      <p>
        Here is where many traders get into trouble. If you have iron condors on SPY, QQQ,
        and AAPL, those positions are <strong>highly correlated</strong>. A sharp market move
        can blow through the same side of all three condors simultaneously.
      </p>
      <div className="blog-callout warning">
        <strong>Correlation Warning</strong>
        Three "properly sized" iron condors at 2% each looks like 6% total risk. But if all
        three are on correlated tech-heavy names, your effective risk in a crash scenario could
        be the full 6% — or worse if the move is fast enough to gap through your strikes. Always
        think about correlation when adding positions.
      </div>
      <p>
        To manage this, count correlated positions as partially overlapping risk. A simple rule:
        if two underlyings have a correlation above 0.7, treat their combined risk as 75% of the
        sum rather than sizing them independently.
      </p>

      {/* ── Section 5 ── */}
      <h2 id="portfolio-heat">Portfolio Heat: Total Risk Across All Positions</h2>
      <p>
        Individual position sizing is only half the picture. <strong>Portfolio heat</strong> measures
        your total risk exposure across all open positions.
      </p>
      <blockquote>
        Portfolio Heat = Sum of Max Loss on All Open Positions / Account Value
      </blockquote>
      <h3>The 20-30% Heat Rule</h3>
      <p>
        A sound rule for options income traders: keep total portfolio heat below 20-30% of your
        account value. This means if you have a $50,000 account, the sum of all your worst-case
        losses should not exceed $10,000 to $15,000.
      </p>
      <table>
        <thead>
          <tr>
            <th>Position</th>
            <th>Strategy</th>
            <th>Max Loss</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>AAPL Iron Condor</td>
            <td>3 contracts</td>
            <td>$870</td>
          </tr>
          <tr>
            <td>MSFT Bull Put Spread</td>
            <td>2 contracts</td>
            <td>$760</td>
          </tr>
          <tr>
            <td>AMZN Bear Call Spread</td>
            <td>2 contracts</td>
            <td>$680</td>
          </tr>
          <tr>
            <td>SPY Iron Condor</td>
            <td>3 contracts</td>
            <td>$900</td>
          </tr>
          <tr>
            <td>GOOGL Bull Put Spread</td>
            <td>2 contracts</td>
            <td>$520</td>
          </tr>
          <tr>
            <td colSpan="2"><strong>Total Portfolio Heat</strong></td>
            <td><strong>$3,730 (7.5%)</strong></td>
          </tr>
        </tbody>
      </table>
      <p>
        At 7.5% heat, this portfolio has plenty of room to add positions. A portfolio running at
        25%+ heat should stop adding new trades and focus on managing existing ones.
      </p>
      <div className="blog-callout tip">
        <strong>Heat Tiers</strong>
        <strong style={{ display: 'inline', margin: 0 }}>0-15%</strong> — Room to add positions freely.{' '}
        <strong style={{ display: 'inline', margin: 0 }}>15-25%</strong> — Be selective, only high-conviction trades.{' '}
        <strong style={{ display: 'inline', margin: 0 }}>25-30%</strong> — No new positions, manage existing ones.{' '}
        <strong style={{ display: 'inline', margin: 0 }}>30%+</strong> — Reduce exposure immediately.
      </div>
      <p>
        Portfolio heat is especially important during earnings season when multiple positions may
        be tested simultaneously. At NewLeaf System,{' '}
        <Link to="/how-we-manage">our risk management framework</Link> monitors portfolio-level
        exposure as part of every trade decision.
      </p>

      {/* ── Section 6 ── */}
      <h2 id="adjusting-size">Adjusting Size Based on Conviction and IV</h2>
      <p>
        Not every trade deserves the same allocation. Smart traders adjust position size based
        on two key factors: <strong>conviction level</strong> and{' '}
        <strong>implied volatility environment</strong>.
      </p>
      <h3>Conviction-Based Sizing</h3>
      <p>
        A tiered approach works well:
      </p>
      <ul>
        <li><strong>High conviction</strong> (strong setup, ideal IV, clear catalyst): 1.5-2% risk</li>
        <li><strong>Standard conviction</strong> (solid setup, acceptable IV): 1-1.5% risk</li>
        <li><strong>Low conviction</strong> (marginal setup, testing a thesis): 0.5-1% risk</li>
      </ul>
      <p>
        The key is having objective criteria for each tier <em>before</em> you look at any trade.
        If you decide conviction levels after seeing a setup you like, you will rationalize
        every trade into the "high conviction" bucket.
      </p>
      <h3>IV-Based Sizing: Higher IV = Smaller Size</h3>
      <p>
        This is counterintuitive for new traders. When implied volatility is elevated, premiums
        are fat and tempting. But high IV also means bigger moves are expected — and your
        spreads are more likely to be tested.
      </p>
      <table>
        <thead>
          <tr>
            <th>IV Rank</th>
            <th>Environment</th>
            <th>Size Adjustment</th>
            <th>Rationale</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>0-25</td>
            <td>Low IV</td>
            <td>Skip or minimum size</td>
            <td>Premiums too thin to justify risk</td>
          </tr>
          <tr>
            <td>25-50</td>
            <td>Normal IV</td>
            <td>Standard size (1-1.5%)</td>
            <td>Balanced risk/reward</td>
          </tr>
          <tr>
            <td>50-75</td>
            <td>Elevated IV</td>
            <td>Standard to full size (1.5-2%)</td>
            <td>Premium is rich, good opportunity</td>
          </tr>
          <tr>
            <td>75-100</td>
            <td>Very high IV</td>
            <td>Reduced size (0.5-1%)</td>
            <td>Big premiums but big moves expected</td>
          </tr>
        </tbody>
      </table>
      <div className="blog-callout warning">
        <strong>Earnings Warning</strong>
        Trades held through earnings announcements should be sized at the lowest tier regardless
        of conviction. Binary events can produce moves that blow through even wide spreads.
        Learn more about managing this risk in our guide to{' '}
        <Link to="/blog/common-options-trading-mistakes">common options trading mistakes</Link>.
      </div>

      {/* ── Section 7 ── */}
      <h2 id="calculator">A Simple Position Sizing Calculator</h2>
      <p>
        Let's walk through a complete position sizing calculation step by step. No software
        needed — just basic arithmetic.
      </p>
      <h3>The Setup</h3>
      <ul>
        <li><strong>Account value:</strong> $50,000</li>
        <li><strong>Risk tolerance:</strong> 2% per trade</li>
        <li><strong>Strategy:</strong> Bull put spread on NVDA</li>
        <li><strong>Spread:</strong> Sell $800 put / Buy $790 put ($10 wide)</li>
        <li><strong>Credit received:</strong> $2.80 per share</li>
      </ul>
      <h3>Step 1: Calculate Your Dollar Risk Budget</h3>
      <blockquote>
        $50,000 x 0.02 = <strong>$1,000</strong> maximum risk on this trade
      </blockquote>
      <h3>Step 2: Calculate Max Loss Per Contract</h3>
      <blockquote>
        ($10.00 spread width - $2.80 credit) x 100 = <strong>$720</strong> max loss per contract
      </blockquote>
      <h3>Step 3: Determine Number of Contracts</h3>
      <blockquote>
        $1,000 / $720 = 1.38 contracts → round down to <strong>1 contract</strong>
      </blockquote>
      <h3>Step 4: Verify Actual Risk</h3>
      <blockquote>
        1 contract x $720 = $720 actual risk (1.44% of account)
      </blockquote>
      <h3>Step 5: Check Portfolio Heat</h3>
      <p>
        Before entering, add $720 to your existing open position risk. If total heat stays
        below your threshold (say 20% = $10,000), you are good to proceed. If it would push
        you over, wait for an existing position to close before adding this one.
      </p>
      <div className="blog-callout tip">
        <strong>Quick Reference Formula</strong>
        Contracts = floor(Account x Risk% / ((Spread Width - Credit) x 100)). For the example
        above: floor($50,000 x 0.02 / $720) = floor(1.38) = 1 contract.
      </div>
      <p>
        This same process works for any defined-risk options strategy. For{' '}
        <Link to="/blog/iron-condor-strategy-explained">iron condors</Link>, use the wider
        spread side minus total credit for your max loss calculation.
      </p>

      {/* ── Section 8 ── */}
      <h2 id="mistakes">Common Position Sizing Mistakes</h2>
      <p>
        Even traders who understand the theory make these sizing errors repeatedly. Recognizing
        these patterns is the first step to fixing them.
      </p>
      <h3>Mistake 1: Sizing Based on Margin, Not Max Loss</h3>
      <p>
        Your broker's margin requirement is <em>not</em> your risk. A position that requires
        $2,000 in margin might have a max loss of $4,500. If you size based on margin alone,
        you are unknowingly taking on more risk than you think. Always calculate and size
        based on the true maximum loss.
      </p>
      <h3>Mistake 2: Concentration in a Single Sector</h3>
      <p>
        Having five "properly sized" positions all in semiconductor stocks is not
        diversification — it is a concentrated bet on one sector. If you would not put 10% of
        your account into a single NVDA trade, you should not have five correlated trades adding
        up to 10%.
      </p>
      <h3>Mistake 3: FOMO-Sizing</h3>
      <p>
        You see a "perfect" setup with fat premiums and wide profit zones. The temptation to
        double or triple your normal size is overwhelming. This is the most dangerous moment in
        trading. The trades that feel like "sure things" are exactly when you need discipline
        most — because when they go wrong (and they will), the oversized loss creates a
        drawdown that takes months to recover from.
      </p>
      <h3>Mistake 4: Not Reducing Size After Losses</h3>
      <p>
        After a losing streak, your account is smaller but your emotions want to "make it back."
        If your account drops from $50,000 to $45,000, your 2% risk drops from $1,000 to $900.
        Traders who keep sizing based on the original $50,000 are effectively increasing their
        risk percentage at the worst possible time.
      </p>
      <h3>Mistake 5: Ignoring Commissions and Slippage on Small Accounts</h3>
      <p>
        On a $10,000 account, 1% risk is just $100. After commissions and potential slippage,
        a single-contract credit spread might eat 5-10% of your profit in friction costs. Small
        accounts need to be realistic about whether a strategy is viable at their size, or
        consider wider spreads with fewer contracts to reduce the commission drag.
      </p>
      <p>
        For more on avoiding costly errors, see our complete guide to{' '}
        <Link to="/blog/common-options-trading-mistakes">common options trading mistakes</Link>.
      </p>

      {/* ── Section 9 ── */}
      <h2 id="faq">Frequently Asked Questions</h2>
      <div className="blog-faq">
        <div className="blog-faq-item">
          <div className="blog-faq-q">
            How much should a beginner risk per options trade?
          </div>
          <div className="blog-faq-a">
            Beginners should start with 0.5-1% of their account per trade. This gives you room
            to learn from mistakes without devastating your account. Once you have at least 30-50
            trades of track record with a defined strategy, you can consider moving to 1.5-2%.
            The goal in your first 6 months is survival and learning — not maximizing returns.
          </div>
        </div>
        <div className="blog-faq-item">
          <div className="blog-faq-q">
            Should I use the same position size for every trade?
          </div>
          <div className="blog-faq-a">
            No. Your risk percentage should stay within a defined range (for example 1-2%), but
            the exact size should vary based on conviction level, implied volatility environment,
            and how much portfolio heat you are already carrying. A{' '}
            <Link to="/blog/weekly-options-income-plan">disciplined weekly trading plan</Link>{' '}
            helps you evaluate these factors consistently rather than making sizing decisions on
            the fly.
          </div>
        </div>
        <div className="blog-faq-item">
          <div className="blog-faq-q">
            How do I position size for undefined-risk strategies like naked puts?
          </div>
          <div className="blog-faq-a">
            Undefined-risk strategies do not have a fixed max loss, so you need to define your
            own stop-loss level and size based on that. For example, if you sell a naked put and
            plan to close at 2x the credit received, use that as your "max loss" for sizing
            purposes. Be aware that gaps and fast moves can blow past your stop, so add an extra
            safety margin. Many traders use a "worst-case scenario" loss of 3-5x the credit
            received for sizing calculations.
          </div>
        </div>
        <div className="blog-faq-item">
          <div className="blog-faq-q">
            What is the minimum account size for trading options with proper position sizing?
          </div>
          <div className="blog-faq-a">
            For{' '}
            <Link to="/blog/selling-options-for-income">selling options for income</Link>{' '}
            with defined-risk spreads, a practical minimum is $5,000-$10,000. Below $5,000, the
            1-2% rule gives you only $50-$100 of risk per trade, which severely limits which
            spreads you can enter and makes commissions a significant drag. A $25,000+ account
            provides much more flexibility and lets you maintain proper diversification across
            3-5 concurrent positions.
          </div>
        </div>
      </div>

      {/* ── Closing ── */}
      <h2 id="putting-it-together">Putting It All Together</h2>
      <p>
        Position sizing is not glamorous. It will never be the reason you brag about a winning
        trade. But it is the reason you will still be trading a year from now while others have
        blown up their accounts chasing oversized bets.
      </p>
      <p>
        The framework is simple: risk 1-2% per trade, keep portfolio heat below 20-30%, adjust
        for conviction and IV, always round down on contracts, and recalculate as your account
        value changes. Tape these rules to your monitor if you have to.
      </p>
      <p>
        At <Link to="/">NewLeaf System</Link>, every trade recommendation includes a defined
        max loss and risk score so you can immediately plug the numbers into your sizing
        framework. Combine disciplined sizing with{' '}
        <Link to="/blog/iron-condor-strategy-explained">proven strategies</Link> and a{' '}
        <Link to="/blog/weekly-options-income-plan">consistent weekly plan</Link>, and you have
        the foundation for sustainable options income.
      </p>
    </>
  );
}
