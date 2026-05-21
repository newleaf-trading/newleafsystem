import { Link } from 'react-router-dom';

export default function CommonOptionsMistakes() {
  return (
    <>
      <p>
        Options trading offers extraordinary leverage, flexible strategies, and the ability to profit in any market direction.
        But that same flexibility creates traps that catch even experienced traders off guard. Studies consistently show that
        the majority of retail options traders lose money — not because the strategies are flawed, but because of repeatable,
        preventable mistakes.
      </p>
      <p>
        This guide breaks down the seven most common options trading mistakes we see, explains <em>why</em> each one is so
        dangerous, and gives you a concrete fix for every single one. Whether you are brand new to options or have been
        trading for years, this checklist-style approach can save you thousands.
      </p>

      {/* ── Mistake #1 ── */}
      <h2 id="not-understanding-greeks">Mistake #1: Trading Without Understanding the Greeks</h2>
      <div className="blog-callout warning">
        <strong>Warning</strong>
        Trading options without understanding the Greeks is like flying a plane without reading the instruments. You might
        stay airborne for a while, but you have no idea what forces are acting on your position — and no way to react when
        conditions change.
      </div>
      <p>
        The options Greeks — <Link to="/blog/options-greeks-explained">delta, gamma, theta, and vega</Link> — tell you
        exactly how your position will respond to changes in the underlying price, time decay, and implied volatility.
        Traders who skip this step often discover that a trade they thought was "safe" is actually hemorrhaging value
        because of theta decay, or that a small move in implied volatility wiped out their entire edge.
      </p>
      <h3>Why This Mistake Hurts</h3>
      <ul>
        <li><strong>Delta blindness:</strong> You buy calls expecting a big move, but delta is only 0.15 — the stock moves $5 and your option barely budges.</li>
        <li><strong>Theta ignorance:</strong> You hold long options over a weekend and lose 3 days of time value with zero stock movement.</li>
        <li><strong>Vega surprises:</strong> You buy options before earnings, IV crushes after the announcement, and your calls lose money even though the stock went up.</li>
        <li><strong>Gamma risk:</strong> You sell short-dated options near the money and get whipsawed as gamma amplifies small moves into large P&L swings.</li>
      </ul>
      <div className="blog-callout tip">
        <strong>The Fix</strong>
        Before entering any trade, write down the primary Greek driving your thesis. Are you selling theta? Trading delta?
        Betting on a vega expansion? If you cannot name the Greek, you do not have a thesis — you have a guess. Start with
        our <Link to="/blog/options-greeks-explained">plain-language Greeks guide</Link> and commit to checking your
        position Greeks before every single entry.
      </div>

      {/* ── Mistake #2 ── */}
      <h2 id="over-sizing">Mistake #2: Over-Sizing Positions</h2>
      <div className="blog-callout warning">
        <strong>Warning</strong>
        Over-sizing is the single fastest path to account blowup. One oversized loss can erase weeks or months of
        carefully accumulated gains — and the psychological damage often leads to even worse decisions.
      </div>
      <p>
        New traders frequently risk 10%, 20%, or even 50% of their account on a single options trade. They see the
        leverage as an opportunity, not a risk. But options can and do go to zero. If you risk 20% of your capital on one
        trade and it expires worthless, you need a 25% return just to get back to even. Two bad trades in a row and you
        have lost nearly half your account.
      </p>
      <h3>The 1-2% Rule</h3>
      <p>
        Professional traders and risk managers almost universally follow some version of the <strong>1-2% rule</strong>:
        never risk more than 1-2% of your total account on any single trade. For a $50,000 account, that means your maximum
        loss on any one position should be $500-$1,000.
      </p>
      <p>
        This does not mean you can only deploy $500 of capital. With defined-risk strategies like{' '}
        <Link to="/blog/selling-options-for-income">credit spreads</Link>, your max loss is the width of the spread minus
        the premium received. A $5-wide iron condor collecting $1.50 in premium has a max loss of $350 per contract — well
        within the 1-2% rule for a reasonably sized account.
      </p>
      <p>
        For a deeper dive on how to size every trade, see our{' '}
        <Link to="/blog/position-sizing-framework">position sizing framework</Link>.
      </p>
      <div className="blog-callout tip">
        <strong>The Fix</strong>
        Calculate your maximum possible loss <em>before</em> you enter. If that number exceeds 2% of your account, reduce
        the number of contracts or switch to a narrower spread. Keep a running tally of your total portfolio risk ("portfolio
        heat") and never exceed 10-15% aggregate exposure across all open positions.
      </div>

      {/* ── Mistake #3 ── */}
      <h2 id="low-iv">Mistake #3: Selling Premium in Low IV Environments</h2>
      <div className="blog-callout warning">
        <strong>Warning</strong>
        Selling options when implied volatility is low is the textbook definition of picking up pennies in front of a
        steamroller. The premiums are tiny, the risk/reward is terrible, and any volatility expansion will punish you
        disproportionately.
      </div>
      <p>
        Premium sellers make money because options tend to overstate future volatility — implied volatility is, on average,
        higher than realized volatility. But this edge only exists when IV is <em>elevated</em>. When{' '}
        <Link to="/blog/implied-volatility-rank-explained">IV Rank</Link> is in the bottom quartile (below 25), the
        premiums you collect are slim and the potential for a volatility spike is high.
      </p>
      <h3>Why Low-IV Selling Fails</h3>
      <ul>
        <li><strong>Tiny credit:</strong> You collect $0.30 on a $5-wide spread. Your risk/reward is 15:1 against you.</li>
        <li><strong>Vega exposure:</strong> If IV rises from the 10th percentile to the 50th, your short options gain value fast, creating an unrealized loss far larger than the premium collected.</li>
        <li><strong>Mean reversion works against you:</strong> Low IV tends to revert higher. You are fighting the statistical current.</li>
      </ul>
      <p>
        The best premium selling opportunities come when IV Rank is above 50 — ideally above 70. At those levels, the
        premiums are fat enough to justify the risk, and volatility is statistically more likely to contract in your favor.
      </p>
      <div className="blog-callout tip">
        <strong>The Fix</strong>
        Check <Link to="/blog/implied-volatility-rank-explained">IV Rank</Link> before every premium-selling trade. If IV
        Rank is below 30, consider buying strategies (debit spreads, long calls or puts) instead of selling. If IV Rank is
        above 50, selling strategies have a meaningful statistical edge. NewLeaf System scores every pick with an IV
        environment rating so you never have to guess — <Link to="/how-we-manage">see how we manage trades</Link>.
      </div>

      {/* ── Mistake #4 ── */}
      <h2 id="earnings">Mistake #4: Holding Through Earnings</h2>
      <div className="blog-callout warning">
        <strong>Warning</strong>
        Earnings announcements are binary events. The stock gaps up or gaps down, often far beyond the expected move. If
        your original trade thesis did not account for earnings risk, holding through the announcement introduces a risk
        that was never part of your plan.
      </div>
      <p>
        Earnings releases routinely produce 5-15% overnight gaps in individual stocks. For a short iron condor or credit
        spread, a gap through your strikes can produce maximum loss in a single session. Even if the stock moves in your
        direction, the post-earnings IV crush can behave unpredictably — the options you sold may not deflate as much as
        you expected because the realized move was larger than implied.
      </p>
      <h3>When Earnings Risk Bites</h3>
      <ul>
        <li>You sell a put spread on AAPL 14 DTE, forgetting that earnings are in 10 days. The stock drops 8% after the report and your spread hits max loss.</li>
        <li>You hold a long call through earnings expecting a beat. The company beats estimates, but the stock sells off 4% on guidance — and IV crush destroys the remaining extrinsic value.</li>
        <li>You sell an iron condor around earnings intentionally, but underestimate the expected move. The stock gaps past your short strike and the remaining leg barely offsets the loss.</li>
      </ul>
      <div className="blog-callout tip">
        <strong>The Fix</strong>
        Before opening any trade, check the earnings calendar. If an earnings date falls within your expiration window and
        your thesis does <em>not</em> specifically include an earnings play, either close before the announcement or choose
        an expiration that avoids the event entirely. If you <em>do</em> trade earnings intentionally, use defined-risk
        strategies and size the position for max loss — because max loss is a realistic outcome with binary events.
      </div>

      {/* ── Mistake #5 ── */}
      <h2 id="assignment-risk">Mistake #5: Ignoring Assignment Risk</h2>
      <div className="blog-callout warning">
        <strong>Warning</strong>
        If you sell options, you can be assigned. Assignment means you are obligated to buy (for short puts) or sell (for
        short calls) 100 shares of the underlying at the strike price. Ignoring this risk — especially near expiration —
        leads to margin calls, unexpected stock positions, and forced liquidations.
      </div>
      <p>
        Assignment risk is highest when your short option is in-the-money (ITM) and expiration is near. American-style
        options (which include most equity options) can be exercised at any time, though early assignment is most common
        when there is little extrinsic value remaining. Dividends add another layer: short calls that are ITM ahead of an
        ex-dividend date are frequently assigned early as the option holder wants to capture the dividend.
      </p>
      <h3>Common Assignment Scenarios</h3>
      <ul>
        <li><strong>Pin risk at expiration:</strong> Your short option is right at the strike. You might or might not be assigned, creating uncertainty over the weekend.</li>
        <li><strong>Short puts in a crash:</strong> The stock drops sharply, your short put is deep ITM, and you wake up long 100 shares at a much higher price than the current market.</li>
        <li><strong>Dividend assignment:</strong> You are short a covered call that is slightly ITM. The night before ex-dividend, you get assigned and lose the shares you intended to keep.</li>
        <li><strong>Spread leg removal:</strong> One leg of your spread is assigned, but the other leg is not exercised. You now have a naked stock position with undefined risk.</li>
      </ul>
      <div className="blog-callout tip">
        <strong>The Fix</strong>
        Close or roll short options that are ITM with less than one week to expiration. Never let a short option expire
        ITM unless you are prepared to take assignment. For credit spreads, always monitor both legs as expiration
        approaches — if your short leg is ITM and your long leg is OTM, close the spread rather than risking partial
        assignment. Check the ex-dividend date for any underlying where you hold short calls.
      </div>

      {/* ── Mistake #6 ── */}
      <h2 id="no-exit-plan">Mistake #6: No Exit Plan Before Entering</h2>
      <div className="blog-callout warning">
        <strong>Warning</strong>
        Entering a trade without a defined exit plan is not trading — it is gambling. Without predetermined profit targets
        and stop-loss levels, you are relying on real-time emotional decision-making, which is the least reliable tool in
        your toolkit.
      </div>
      <p>
        The most disciplined traders decide exactly three things before they click "submit order": (1) when they will take
        profit, (2) when they will cut the loss, and (3) when they will exit if neither target is hit (a time stop). Without
        these anchors, traders fall into two traps: they hold losers too long hoping for a recovery, and they cut winners too
        early because they are afraid of giving back gains.
      </p>
      <h3>What a Complete Exit Plan Looks Like</h3>
      <ul>
        <li><strong>Profit target:</strong> Close at 50% of max profit for credit strategies. This captures the bulk of the premium while cutting your time exposure in half.</li>
        <li><strong>Stop loss:</strong> Close at 2x the premium received (or when the spread reaches 50% of max loss). This prevents a small loss from becoming a catastrophic one.</li>
        <li><strong>Time stop:</strong> If the trade has not hit either target at 21 DTE (for 45 DTE entries), reassess. Time decay accelerates, but so does gamma risk.</li>
        <li><strong>Event stop:</strong> Close before earnings, ex-dividend dates, or Fed announcements that were not part of the original thesis.</li>
      </ul>
      <div className="blog-callout tip">
        <strong>The Fix</strong>
        Write your exit plan in a trade journal before you submit the order. Better yet, set GTC (Good Til Cancelled)
        orders for your profit target immediately after your fill. This removes emotion from the exit decision. At{' '}
        <Link to="/how-we-manage">NewLeaf System</Link>, every published pick includes predefined profit targets and
        management rules so you never have to improvise mid-trade.
      </div>

      {/* ── Mistake #7 ── */}
      <h2 id="chasing-losses">Mistake #7: Chasing Losses with Bigger Positions</h2>
      <div className="blog-callout warning">
        <strong>Warning</strong>
        Revenge trading — the impulse to immediately make back a loss by doubling down or taking an oversized position — is
        the most psychologically destructive pattern in trading. It turns a manageable loss into an account-threatening one
        and creates a vicious cycle of escalating risk.
      </div>
      <p>
        After a losing trade, your brain wants to "get even." The temptation is to take a bigger position on the next trade,
        or to force a trade in a setup that does not meet your criteria, just to recover the loss. This is how a $500 loss
        becomes a $2,000 loss becomes a $5,000 loss in a single week.
      </p>
      <h3>The Psychology Behind Revenge Trading</h3>
      <p>
        Behavioral economists call this <strong>loss aversion</strong> — losses feel roughly twice as painful as equivalent
        gains feel pleasurable. After a loss, your emotional brain hijacks your rational process. You stop following your
        rules, ignore your position sizing framework, and make decisions based on the need to feel "whole" again rather than
        on probability and edge.
      </p>
      <ul>
        <li>A 3-trade losing streak is statistically normal. With a 60% win rate, you will see 3 consecutive losses roughly 6% of the time. It is not a crisis — it is expected.</li>
        <li>Doubling position size after a loss does not improve your odds. It only increases the magnitude of the next potential loss.</li>
        <li>The market does not owe you a recovery. Each trade is independent. Your prior losses have zero influence on future probabilities.</li>
      </ul>
      <div className="blog-callout tip">
        <strong>The Fix</strong>
        Implement a <strong>circuit breaker rule</strong>: if you lose more than 3-5% of your account in a single week,
        stop trading for at least 48 hours. When you return, go back to minimum position size. Only scale back up after
        two or three consecutive wins at the smaller size. Journaling every trade — including your emotional state — helps
        you identify revenge trading patterns before they spiral. Visit our{' '}
        <Link to="/learn">learning center</Link> for more on building sustainable trading habits.
      </div>

      {/* ── Checklist ── */}
      <h2 id="checklist">Building a Trading Checklist</h2>
      <p>
        The best defense against all seven mistakes above is a simple pre-trade checklist. Airline pilots do not rely on
        memory before takeoff — they run a checklist every single time. Your trading should work the same way. Here is the
        checklist we recommend before every options trade:
      </p>
      <h3>Pre-Trade Checklist</h3>
      <ol>
        <li><strong>What is my thesis?</strong> Can I state in one sentence why this trade should make money? Which Greek am I primarily trading?</li>
        <li><strong>What is the IV environment?</strong> Is <Link to="/blog/implied-volatility-rank-explained">IV Rank</Link> above 30 for selling strategies, or below 30 for buying strategies?</li>
        <li><strong>Have I sized correctly?</strong> Is my max loss under 2% of my account? Is my total portfolio heat under 15%? Review our <Link to="/blog/position-sizing-framework">position sizing framework</Link> if unsure.</li>
        <li><strong>Are there earnings or dividends?</strong> Does any event fall within my expiration window that was not part of my original thesis?</li>
        <li><strong>Do I have an exit plan?</strong> What is my profit target, stop loss, and time stop? Have I written them down?</li>
        <li><strong>Am I in the right emotional state?</strong> Am I chasing a loss? Am I bored? Am I overconfident after a win streak?</li>
        <li><strong>Does this pass the "sleep test"?</strong> Can I hold this position overnight without checking my phone at 3 AM?</li>
      </ol>
      <div className="blog-callout tip">
        <strong>Pro Tip</strong>
        Print this checklist and tape it next to your monitor. Run through it mechanically for every trade. After a few
        weeks it becomes second nature, but the physical reminder prevents shortcuts on days when discipline is hardest.
        NewLeaf System builds many of these checks directly into our{' '}
        <Link to="/how-we-manage">trade management process</Link> so you can focus on execution rather than analysis.
      </div>

      {/* ── FAQ ── */}
      <h2 id="faq">Frequently Asked Questions</h2>
      <div className="blog-faq">
        <div className="blog-faq-item">
          <div className="blog-faq-q">Why do most options traders lose money?</div>
          <div className="blog-faq-a">
            Most options traders lose money because of poor risk management, not because options strategies are inherently
            unprofitable. The most common culprits are over-sizing positions, trading without understanding how the Greeks
            affect their P&L, and lacking a predefined exit plan. These mistakes compound: one oversized loss triggers
            revenge trading, which leads to even larger losses. Traders who follow a systematic approach with strict
            position sizing, IV-aware entry criteria, and predefined exits can achieve consistent profitability over time.
          </div>
        </div>
        <div className="blog-faq-item">
          <div className="blog-faq-q">What is the biggest mistake beginner options traders make?</div>
          <div className="blog-faq-a">
            The single biggest mistake is over-sizing positions. Beginners see the leverage of options and allocate far too
            much capital to a single trade. When that trade goes against them, the loss is large enough to be both
            financially damaging and psychologically destabilizing. Following the{' '}
            <Link to="/blog/position-sizing-framework">1-2% risk rule</Link> ensures that no single trade can derail your
            account, giving you the staying power to learn and improve.
          </div>
        </div>
        <div className="blog-faq-item">
          <div className="blog-faq-q">How do I stop revenge trading after a loss?</div>
          <div className="blog-faq-a">
            Implement a circuit breaker: if you lose more than 3-5% of your account in a week, stop trading for at least
            48 hours. When you return, trade at minimum position size until you have two or three consecutive wins. Keep
            a trade journal that records your emotional state alongside your entries and exits. Over time, you will
            recognize the emotional patterns that precede revenge trades and learn to step away before the damage is done.
          </div>
        </div>
        <div className="blog-faq-item">
          <div className="blog-faq-q">Should I always avoid holding options through earnings?</div>
          <div className="blog-faq-a">
            Not necessarily — some strategies are specifically designed for earnings events. The mistake is holding through
            earnings when your original thesis did <em>not</em> account for it. If you intentionally trade an earnings
            event, use defined-risk strategies (iron condors, strangles, straddles), size for maximum loss, and understand
            the expected move priced into the options chain. If earnings simply happen to fall within your expiration window,
            either close before the announcement or choose a different expiration cycle.
          </div>
        </div>
      </div>

      {/* ── Closing CTA ── */}
      <h2 id="next-steps">Putting It All Together</h2>
      <p>
        Every mistake on this list shares a common root cause: lack of process. Profitable options trading is not about
        finding the perfect trade — it is about executing a repeatable system that manages risk, respects volatility, and
        removes emotion from decision-making.
      </p>
      <p>
        NewLeaf System was built to be that system. Every pick we publish comes with IV-aware scoring, predefined risk
        parameters, and clear management rules. Whether you use our platform or build your own process, the principles
        are the same: know your Greeks, size small, sell when IV is high, plan your exit, and never chase a loss.
      </p>
      <p>
        Ready to trade with a system instead of guessing? Explore our{' '}
        <Link to="/learn">strategy guides</Link> or see what our AI scoring engine is recommending{' '}
        <Link to="/how-we-manage">this week</Link>.
      </p>
    </>
  );
}
