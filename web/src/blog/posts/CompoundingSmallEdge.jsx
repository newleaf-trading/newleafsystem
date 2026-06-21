import { Link } from 'react-router-dom';

export default function CompoundingSmallEdge() {
  return (
    <>
      <p>
        Tripling an account in five years sounds like it should require home-run trades and
        heroic risk. It does not. It requires the opposite: a <strong>small, repeatable edge</strong>,
        applied with discipline, a few times a week, for a long time. This is the single most
        misunderstood idea in options income trading — so let us put real numbers on it.
      </p>
      <p>
        Everything below is illustrative, built from the same math behind our{' '}
        <strong>projection tool</strong>. The goal is to show <em>why</em> a modest win rate plus
        small per-trade risk can compound to roughly 3× over five years — and why turning the risk
        dial up to 5% per trade is the fastest way to never get there.
      </p>

      {/* ── Section 1 ── */}
      <h2 id="the-edge">The whole game is the edge per trade</h2>
      <p>
        A trading plan&apos;s engine is one number — the <strong>expected value per trade</strong>.
        It is the average amount you make (or lose) per trade once wins and losses are blended
        together:
      </p>
      <blockquote>
        EV per trade = (win rate × average win) − (loss rate × average loss)
      </blockquote>
      <p>
        Take a realistic premium-selling plan: a <strong>62% win rate</strong>, a typical winner of
        <strong> 1.2%</strong> of the account, and a typical loser of <strong>1.0%</strong> (hard-capped
        by your risk-per-trade ceiling, so it cannot run away). That works out to:
      </p>
      <blockquote>
        EV = (0.62 × 1.2%) − (0.38 × 1.0%) = 0.744% − 0.38% = <strong>0.364% per trade</strong>
      </blockquote>
      <p>
        Less than four-tenths of one percent. That number looks too small to matter. Compounding is
        what makes it matter.
      </p>
      <div className="blog-callout tip">
        <strong>The hard loss cap is doing quiet, critical work.</strong>
        Average loss is capped by your risk ceiling. If you size to lose 1% maximum, a trade that
        goes wrong still only counts as a 1% loss in the math. That single rule is what keeps the
        edge positive and the curve survivable.
      </div>

      {/* ── Section 2 ── */}
      <h2 id="compounding">How 0.364% becomes 3× (or more)</h2>
      <p>
        At the NewLeaf cadence — roughly <strong>100–200 trades a year</strong> — you apply that edge
        again and again, each time on a slightly larger balance. Compounding multiplies your capital
        by (1 + edge) after every trade. At 120 trades a year and a 0.364% edge, a $100,000 account
        grows about 55% in year one. Then it does it again on the bigger number.
      </p>
      <p>
        Here is the part that matters for honesty: the base model actually projects much more than 3×.
        We deliberately anchor on <strong>3×</strong> because real life takes a cut — slippage,
        commissions, taxes, missed weeks, and the simple fact that edges decay. The table shows both:
        the full-edge model, and a deliberately conservative version that assumes your real edge is
        only <em>half</em> of the model.
      </p>
      <table>
        <thead>
          <tr>
            <th>Year</th>
            <th>Base model (0.364%/trade)</th>
            <th>Conservative — half edge (0.18%/trade)</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>Start</td><td>$100,000</td><td>$100,000</td></tr>
          <tr><td>Year 1</td><td>$154,700</td><td>$124,400</td></tr>
          <tr><td>Year 2</td><td>$239,300</td><td>$154,700</td></tr>
          <tr><td>Year 3</td><td>$370,000</td><td>$192,000</td></tr>
          <tr><td>Year 4</td><td>$572,000</td><td>$239,000</td></tr>
          <tr><td>Year 5</td><td>~$885,000 (8.8×)</td><td><strong>~$298,000 (≈3×)</strong></td></tr>
        </tbody>
      </table>
      <p>
        Read the right-hand column carefully. Even if your true edge is <strong>half</strong> of the
        model — a brutal haircut — you still roughly triple in five years. That is about a 24.6%
        compound annual return, earned not from bigger bets but from a small edge surviving long
        enough to multiply. The margin of safety is the whole point.
      </p>

      {/* ── Section 3 ── */}
      <h2 id="why-not-5-percent">Why 5% risk per trade gets you there slower, not faster</h2>
      <p>
        The intuitive move is to risk more per trade to reach the goal sooner. On paper, 5% risk
        instead of 1% inflates the expected curve dramatically. In practice, it usually ends the
        journey early — because losing streaks are not optional. They are guaranteed. The only
        question is whether your account survives them.
      </p>
      <p>
        A 62%-win plan still loses 38% of the time. Strings of losses happen often. The table below
        shows how many <em>consecutive</em> losing trades it takes to cut an account in half at each
        risk level:
      </p>
      <table>
        <thead>
          <tr>
            <th>Risk per trade</th>
            <th>On $100k</th>
            <th>Consecutive losses to −50%</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>1% (the system default)</td><td>$1,000</td><td>~69 losses</td></tr>
          <tr><td>2%</td><td>$2,000</td><td>~34 losses</td></tr>
          <tr><td>5% (&quot;aggressive&quot;)</td><td>$5,000</td><td>~13 losses</td></tr>
        </tbody>
      </table>
      <p>
        A 13-trade losing streak is uncomfortable but entirely plausible over hundreds of trades. A
        34- or 69-trade streak is effectively a fantasy. That is the difference between sizing that
        survives variance and sizing that gets erased by it. When we model thousands of randomized
        paths, the share that finish <em>below</em> where they started — what we call losing-path
        risk — stays near zero at 1% and climbs fast as risk rises.
      </p>
      <div className="blog-callout warning">
        <strong>Bigger risk does not buy speed — it buys a wider distribution.</strong>
        A handful of paths shoot higher, but far more crater, and the median outcome gets
        <em> worse</em>, not better. Small, fixed-fraction risk is the price of admission for letting
        compounding actually run.
      </div>

      {/* ── Section 4 ── */}
      <h2 id="ingredients">The three ingredients you actually control</h2>
      <p>
        Compounding to 3× is not one decision; it is three habits repeated:
      </p>
      <ul>
        <li>
          <strong>Win rate.</strong> Safe, range-bound setups target 60–65%. You earn this through
          setup selection, not prediction — see <Link to="/blog/automating-technical-analysis-into-a-score">how a setup gets scored</Link>.
        </li>
        <li>
          <strong>Reward-to-risk and structure.</strong> A 1.2:1 winner-to-loser ratio is enough when
          the win rate is above 60%. The right{' '}
          <Link to="/blog/choosing-an-options-strategy-by-iv-and-regime">option structure for the conditions</Link>{' '}
          is what delivers that ratio.
        </li>
        <li>
          <strong>Fixed-fraction risk.</strong> Risk the same small percentage every time. This is the
          discipline covered in our <Link to="/blog/position-sizing-framework">position sizing framework</Link>.
        </li>
      </ul>
      <p>
        None of these requires being right about the market&apos;s direction. They require being
        consistent about process — which is exactly what software is good at enforcing.
      </p>

      {/* ── FAQ ── */}
      <h2 id="faq">Frequently asked questions</h2>
      <div className="blog-faq">
        <div className="blog-faq-item">
          <div className="blog-faq-q">Is 3× in five years guaranteed?</div>
          <div className="blog-faq-a">
            No. These are hypothetical, illustrative figures based on assumed inputs. Real results vary
            with market conditions, execution, costs, and discipline. Edges decay and drawdowns are
            real. The point is the mechanism — a small edge compounding under controlled risk — not a
            promise of a specific number.
          </div>
        </div>
        <div className="blog-faq-item">
          <div className="blog-faq-q">Why not just take fewer, bigger trades?</div>
          <div className="blog-faq-a">
            Compounding rewards the number of times a positive edge is applied. More small, controlled
            trades give the edge more chances to express itself while keeping any single outcome
            survivable. Fewer, larger trades increase variance and the chance of a ruinous streak.
          </div>
        </div>
        <div className="blog-faq-item">
          <div className="blog-faq-q">What if my real win rate is only 55%?</div>
          <div className="blog-faq-a">
            The conservative column already assumes a roughly halved edge and still reaches about 3×.
            That is the margin of safety: the plan does not need to hit its best-case numbers to work,
            it just needs the edge to stay positive and the risk to stay small.
          </div>
        </div>
      </div>

      <div className="blog-callout warning">
        <strong>Educational disclaimer.</strong>
        This article is for educational purposes only and is not investment advice. All figures are
        hypothetical and illustrative; they do not represent actual results and do not guarantee
        future performance. Options involve substantial risk and are not suitable for all investors.
        Never risk capital you cannot afford to lose.
      </div>
    </>
  );
}
